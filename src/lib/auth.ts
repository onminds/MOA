import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { authOptions } from "./authOptions";
import { getConnection } from "./db";
import { getKoreanTimeNow, getKoreanTomorrowMidnightUTC } from "./utils";
import { verifyUserJwt } from "./auth/mobileAuth";
import {
  toUnifiedServiceType,
  toActualUsage,
  toStoredUsageUnits,
  formatUsageNumber,
} from "./usageConstants";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user;
}

export async function checkUsageLimit(userId: string, serviceType: string) {
  try {
    const db = await getConnection();
    const unifiedServiceType = toUnifiedServiceType(serviceType);
    
    // 사용자의 현재 플랜 정보 조회 (payments 또는 subscriptions 기준)
    const userResult = await db.request()
      .input('userId', userId)
      .query(`
        SELECT TOP 1 plan_type, created_at as payment_date
        FROM payments 
        WHERE user_id = @userId AND status = 'completed' 
        ORDER BY created_at DESC
      `);
    
    // subscriptions 테이블에서도 조회 (어드민으로 변경한 경우)
    const subscriptionResult = await db.request()
      .input('userId', userId)
      .query(`
        SELECT TOP 1 plan_type, created_at as subscription_date, updated_at
        FROM subscriptions 
        WHERE user_id = @userId AND status = 'active' 
        ORDER BY updated_at DESC
      `);
    
    // payments가 없으면 subscriptions 사용
    const userPlan = userResult.recordset[0]?.plan_type || subscriptionResult.recordset[0]?.plan_type || 'basic';
    
    // 결제일 우선순위: payments > subscriptions updated_at > subscriptions created_at
    let paymentDate = userResult.recordset[0]?.payment_date;
    if (!paymentDate && subscriptionResult.recordset[0]) {
      // 어드민으로 변경한 경우 updated_at 사용 (변경 시점)
      paymentDate = subscriptionResult.recordset[0].updated_at || subscriptionResult.recordset[0].subscription_date;
    }
    
    console.log(`[DEBUG AUTH] userId=${userId}, userPlan=${userPlan}, paymentDate=${paymentDate} (from ${userResult.recordset[0] ? 'payments' : 'subscriptions'}), serviceType=${serviceType}`);
    
    // 플랜별 제한값 설정
    let planLimit: number;
    if (unifiedServiceType === 'image-generate') {
      // 이미지: Basic 1 / Standard 80 / Pro 180
      planLimit = userPlan === 'basic' ? 1 : userPlan === 'standard' ? 80 : 180;
    } else if (unifiedServiceType === 'video-generate') {
      // 영상: Basic 1 / Standard 20 / Pro 40
      planLimit = userPlan === 'basic' ? 1 : userPlan === 'standard' ? 20 : 40;
    } else if (unifiedServiceType === 'productivity') {
      // 생산성(통합): Basic 1 / Standard 120 / Pro 250
      planLimit = userPlan === 'basic' ? 1 : userPlan === 'standard' ? 120 : 250;
    } else {
      // 기타 기본값
      planLimit = userPlan === 'basic' ? 10 : userPlan === 'standard' ? 50 : 100;
    }
    
    // 사용량 정보 조회
    const usageResult = await db.request()
      .input('userId', userId)
      .input('serviceType', unifiedServiceType)
      .query('SELECT * FROM usage WHERE user_id = @userId AND service_type = @serviceType');
    
    let usage = usageResult.recordset[0];

    // UTC 기준 (모든 로직에서 사용)
    const now = new Date();

    // 사용량 정보가 없으면 생성
    if (!usage) {
      const defaultLimit = planLimit;
      let nextResetDate = null;
      
      // 베이직 플랜의 생산성 도구는 일일 초기화
      if (unifiedServiceType === 'productivity' && userPlan === 'basic') {
        // 한국 시간 기준 내일 자정 (UTC로 저장)
        nextResetDate = getKoreanTomorrowMidnightUTC();
        console.log(`[일일 리셋 날짜 초기 설정] ${nextResetDate.toISOString()}`);
      }
      // 스탠다드/프로 플랜은 결제일 기준으로 한 달 후
      else if (paymentDate && (userPlan === 'standard' || userPlan === 'pro')) {
        const resetDate = new Date(paymentDate);
        resetDate.setMonth(resetDate.getMonth() + 1);
        nextResetDate = resetDate;
      }
      // 베이직 플랜 (생산성 제외)은 계정 생성일 기준
      else {
        const userCreatedResult = await db.request()
          .input('userId', userId)
          .query('SELECT created_at FROM users WHERE id = @userId');
        
        const userCreatedAt = userCreatedResult.recordset[0]?.created_at;
        if (userCreatedAt) {
          const resetDate = new Date(userCreatedAt);
          resetDate.setMonth(resetDate.getMonth() + 1);
          nextResetDate = resetDate;
        }
      }
      
      await db.request()
        .input('userId', userId)
        .input('serviceType', unifiedServiceType)
        .input('limitCount', defaultLimit)
        .input('nextResetDate', nextResetDate)
        .query(`
          INSERT INTO usage (user_id, service_type, usage_count, limit_count, next_reset_date, created_at, updated_at)
          VALUES (@userId, @serviceType, 0, @limitCount, @nextResetDate, GETDATE(), GETDATE())
        `);
      
      usage = {
        usage_count: 0,
        limit_count: defaultLimit,
        next_reset_date: nextResetDate
      };
    } else {
      // 기존 사용량 정보가 있지만 플랜이 변경된 경우 limit_count 업데이트
      if (usage.limit_count !== planLimit) {
        console.log(`사용자 ${userId}의 ${serviceType} 제한값 업데이트: ${usage.limit_count} -> ${planLimit}`);
        
        await db.request()
          .input('userId', userId)
          .input('serviceType', unifiedServiceType)
          .input('limitCount', planLimit)
          .query(`
            UPDATE usage 
            SET limit_count = @limitCount, updated_at = GETDATE()
            WHERE user_id = @userId AND service_type = @serviceType
          `);
        
        usage.limit_count = planLimit;
      }
    }

    // 주간 리셋 체크 (계정 생성일 기준 일주일마다)
    let nextResetDate = usage.next_reset_date;
    
    // 베이직 플랜의 생산성 도구: 일일 리셋 체크 및 처리
    if (unifiedServiceType === 'productivity' && userPlan === 'basic') {
      // 리셋 시간이 지났는지 체크
      if (nextResetDate && now >= new Date(nextResetDate)) {
        console.log(`[일일 리셋 실행] userId=${userId}, serviceType=${unifiedServiceType}, 이전 사용량=${usage.usage_count}`);
        
        // 사용량 리셋
        usage.usage_count = 0;
        
        // 다음 리셋 날짜 = 내일 자정 (UTC)
        nextResetDate = getKoreanTomorrowMidnightUTC();
        
        console.log(`[일일 리셋 완료] 사용량: ${usage.usage_count}, 다음 리셋: ${nextResetDate.toISOString()}`);
        
        // DB 업데이트 (사용량 리셋 + 다음 리셋 날짜)
        await db
          .request()
          .input('userId', userId)
          .input('serviceType', unifiedServiceType)
          .input('nextResetDate', nextResetDate)
          .query(`
            UPDATE usage 
            SET usage_count = 0, next_reset_date = @nextResetDate, updated_at = GETDATE()
            WHERE user_id = @userId AND service_type = @serviceType
          `);
      }
      // next_reset_date가 null이면 초기 설정
      else if (!nextResetDate) {
        nextResetDate = getKoreanTomorrowMidnightUTC();
        console.log(`[일일 리셋 날짜 초기 설정] ${nextResetDate.toISOString()}`);
        
        await db
          .request()
          .input('userId', userId)
          .input('serviceType', unifiedServiceType)
          .input('nextResetDate', nextResetDate)
          .query(`
            UPDATE usage 
            SET next_reset_date = @nextResetDate 
            WHERE user_id = @userId AND service_type = @serviceType
          `);
      }
    }
    // 스탠다드/프로 플랜은 항상 결제일 기준으로 재설정 (즉시 적용)
    else if (paymentDate && (userPlan === 'standard' || userPlan === 'pro')) {
      console.log(`[DEBUG] 결제일 조회 성공: paymentDate=${paymentDate}, userPlan=${userPlan}, serviceType=${unifiedServiceType}`);
      const expectedResetDate = new Date(paymentDate);
      expectedResetDate.setMonth(expectedResetDate.getMonth() + 1);
      console.log(`[DEBUG] 예상 리셋 날짜: ${expectedResetDate.toISOString()}, 현재 리셋 날짜: ${nextResetDate ? new Date(nextResetDate).toISOString() : 'null'}`);
      
      // 날짜만 비교 (시:분:초는 무시)
      const needsUpdate = !nextResetDate || 
        new Date(nextResetDate).toDateString() !== expectedResetDate.toDateString();
      
      console.log(`[DEBUG] 업데이트 필요? ${needsUpdate}`);
      
      if (needsUpdate) {
        console.log(`[Standard/Pro 리셋 날짜 업데이트] ${nextResetDate ? new Date(nextResetDate).toISOString() : 'null'} → ${expectedResetDate.toISOString()}`);
        nextResetDate = expectedResetDate;
        
        await db.request()
          .input('userId', userId)
          .input('serviceType', unifiedServiceType)
          .input('nextResetDate', nextResetDate)
          .query(`
            UPDATE usage 
            SET next_reset_date = @nextResetDate 
            WHERE user_id = @userId AND service_type = @serviceType
          `);
      }
    }
    // next_reset_date가 없으면 설정
    else if (!nextResetDate) {
      // 스탠다드/프로 플랜은 결제일 기준
      if (paymentDate && (userPlan === 'standard' || userPlan === 'pro')) {
        const resetDate = new Date(paymentDate);
        resetDate.setMonth(resetDate.getMonth() + 1);
        nextResetDate = resetDate;
      }
      // 베이직 플랜은 계정 생성일 기준
      else {
        const userCreatedResult = await db.request()
          .input('userId', userId)
          .query('SELECT created_at FROM users WHERE id = @userId');
        
        const userCreatedAt = userCreatedResult.recordset[0]?.created_at;
        if (userCreatedAt) {
          const resetDate = new Date(userCreatedAt);
          resetDate.setMonth(resetDate.getMonth() + 1);
          nextResetDate = resetDate;
        }
      }
      
      // DB에 next_reset_date 저장
      if (nextResetDate) {
        await db.request()
          .input('userId', userId)
          .input('serviceType', unifiedServiceType)
          .input('nextResetDate', nextResetDate)
          .query(`
            UPDATE usage 
            SET next_reset_date = @nextResetDate 
            WHERE user_id = @userId AND service_type = @serviceType
          `);
      }
    }
    
    // 초기화 시간이 지났으면 사용량 리셋하고 다음 초기화 시간 설정
    console.log(`[리셋 체크] userId: ${userId}, serviceType: ${serviceType}, now: ${now.toISOString()}, nextResetDate: ${nextResetDate}, usage: ${usage.usage_count}`);
    if (nextResetDate && now > new Date(nextResetDate) && usage.usage_count > 0) {
      console.log(`⚠️ [사용량 리셋 실행!] 사용자 ${userId}의 ${serviceType} 사용량 초기화: ${usage.usage_count} -> 0`);
      
      // 다음 초기화 시간 설정
      let nextReset: Date;
      
      // 베이직 플랜의 생산성 도구는 일일 초기화, 나머지는 월간 초기화
      if (unifiedServiceType === 'productivity' && userPlan === 'basic') {
        // 한국 시간 기준 다음 날 자정 (UTC로 저장)
        nextReset = getKoreanTomorrowMidnightUTC();
        console.log(`[리셋 후 다음 리셋 날짜] ${nextReset.toISOString()}`);
      } else {
        // 월간 리셋: 결제일 기준으로 다음 리셋일 계산
        if (paymentDate) {
          // 결제일 기준으로 현재보다 미래인 다음 리셋일 찾기
          const base = new Date(paymentDate);
          while (base <= now) {
            base.setMonth(base.getMonth() + 1);
          }
          nextReset = base;
          console.log(`[월간 리셋] 결제일 ${new Date(paymentDate).toISOString()} 기준 → 다음 리셋: ${nextReset.toISOString()}`);
        } else {
          // 결제일이 없으면 기존 방식 (이전 리셋일 + 1개월)
          nextReset = new Date(nextResetDate);
          nextReset.setMonth(nextReset.getMonth() + 1);
          console.log(`[월간 리셋] 이전 리셋일 기준 → 다음 리셋: ${nextReset.toISOString()}`);
        }
      }
      
      await db.request()
        .input('userId', userId)
        .input('serviceType', unifiedServiceType)
        .input('nextResetDate', nextReset)
        .query(`
          UPDATE usage 
          SET usage_count = 0, next_reset_date = @nextResetDate, updated_at = GETDATE()
          WHERE user_id = @userId AND service_type = @serviceType
        `);
      
      usage.usage_count = 0;
      usage.next_reset_date = nextReset;
    }

    const actualUsageCount = toActualUsage(unifiedServiceType, usage.usage_count);
    const actualLimit = planLimit;

    if (actualUsageCount >= actualLimit) {
      return {
        allowed: false,
        remaining: 0,
        limit: actualLimit,
        resetDate: usage.next_reset_date,
      };
    }

    return {
      allowed: true,
      remaining: formatUsageNumber(actualLimit - actualUsageCount),
      limit: actualLimit,
      resetDate: usage.next_reset_date,
    };
  } catch (error) {
    console.error("사용량 체크 오류:", error);
    return {
      allowed: false,
      remaining: 0,
      limit: 0,
      resetDate: new Date(),
    };
  }
}

export async function incrementUsage(userId: string, serviceType: string, amount = 1) {
  try {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    const db = await getConnection();
    const unifiedServiceType = toUnifiedServiceType(serviceType);
    const unitsToAdd = toStoredUsageUnits(unifiedServiceType, amount);
    if (unitsToAdd <= 0) {
      return;
    }
    
    console.log(`[사용량 증가 시도] userId: ${userId}, serviceType: ${unifiedServiceType}, +${unitsToAdd}`);
    
    const result = await db.request()
      .input('userId', userId)
      .input('serviceType', unifiedServiceType)
      .input('amount', unitsToAdd)
      .query(`
        UPDATE usage 
        SET usage_count = usage_count + @amount, updated_at = GETDATE()
        WHERE user_id = @userId AND service_type = @serviceType
      `);
    
    const rowsAffected = result.rowsAffected?.[0] ?? 0;
    if (rowsAffected === 0) {
      console.error(`❌ [사용량 증가 실패] userId: ${userId}, serviceType: ${unifiedServiceType} - DB에 레코드가 없습니다!`);
    } else {
      console.log(`✅ [사용량 증가 완료] userId: ${userId}, serviceType: ${unifiedServiceType}, rows: ${rowsAffected}`);
    }
  } catch (error) {
    console.error("❌ [사용량 증가 오류]:", error);
  }
}

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    const headerList = await headers();
    const authorization = headerList.get("authorization") ?? headerList.get("Authorization");

    if (authorization?.startsWith("Bearer ")) {
      const token = authorization.replace("Bearer ", "").trim();

      try {
        const payload = verifyUserJwt(token);
        if (!payload?.sub) {
          throw new Error("JWT payload에 사용자 정보가 없습니다.");
        }

        const db = await getConnection();
        const userResult = await db
          .request()
          .input("id", payload.sub)
          .query(
            "SELECT id, email, display_name, avatar_url, role FROM users WHERE id = @id AND is_active = 1"
          );

        const user = userResult.recordset[0];

        if (!user) {
          throw new Error(`JWT 사용자(${payload.sub})를 찾을 수 없습니다.`);
        }

        return {
          user: {
            id: user.id,
            email: user.email,
            name: user.display_name,
            image: user.avatar_url,
            role: user.role,
            provider: payload.provider,
          },
        };
      } catch (error) {
        console.error("모바일 JWT 인증 오류:", error);
      }
    }

    return {
      error: "로그인이 필요합니다.",
      status: 401,
    };
  }

  return {
    user: session.user,
  };
} 