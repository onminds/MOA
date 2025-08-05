import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import KakaoProvider from "next-auth/providers/kakao";
import bcrypt from "bcryptjs";
import { getConnection } from "@/lib/db";

export const authOptions = {
  // adapter: PrismaAdapter(prisma), // JWT 세션 사용 시 주석 처리
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: false,
    }),
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID!,
      clientSecret: process.env.KAKAO_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: false,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials: any) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        
        try {
          const db = await getConnection();
          const userResult = await db.request()
            .input('email', credentials.email)
            .query('SELECT id, email, username, display_name, password_hash, role, avatar_url FROM users WHERE email = @email AND is_active = 1');
          
          const user = userResult.recordset[0];
          if (!user || !user.password_hash) {
            return null;
          }
          
          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password_hash
          );
          
          if (!isPasswordValid) {
            return null;
          }
          
          return {
            id: user.id,
            email: user.email,
            name: user.display_name || user.username,
            role: user.role,
            image: user.avatar_url,
          };
        } catch (error) {
          console.error('자체 로그인 오류:', error);
          return null;
        }
      }
    })
  ],
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user, account }: any) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.image = user.image;
        token.name = user.name; // display_name을 token에 저장
        if (account) {
          token.provider = account.provider;
        }
      }
      return token;
    },
    async session({ session, token }: any) {
      if (token && session.user) {
        try {
          // provider 정보를 세션에 저장
          session.user.provider = token.provider;
          
          // 모든 사용자에 대해 DB에서 최신 정보 조회 (소셜 로그인 + 자체 로그인)
          const db = await getConnection();
          const userResult = await db.request()
            .input('id', token.id)
            .query('SELECT display_name, avatar_url, role FROM users WHERE id = @id AND is_active = 1');
          
          if (userResult.recordset.length > 0) {
            const user = userResult.recordset[0];
            session.user.name = user.display_name;
            session.user.image = user.avatar_url;
            session.user.role = user.role;
          } else {
            // DB에서 사용자를 찾을 수 없는 경우 토큰 정보 사용
            session.user.name = token.name;
            session.user.image = token.image;
            session.user.role = token.role;
          }
          
          session.user.id = token.id;
        } catch (error) {
          console.error('세션 업데이트 오류:', error);
          // 오류 시 토큰 정보 사용
          session.user.name = token.name;
          session.user.image = token.image;
          session.user.role = token.role;
        }
      }
      return session;
    },
    async signIn({ user, account, profile }: any) {
      if (account?.provider === "credentials") {
        return true;
      }
      
      if (account?.provider === "google" || account?.provider === "kakao") {
        try {
          const db = await getConnection();
          
          // 카카오 로그인의 경우 이메일이 없을 수 있으므로 처리
          let userEmail = user.email;
          if (account.provider === 'kakao' && !userEmail) {
            // 카카오에서 이메일을 제공하지 않는 경우 임시 이메일 생성
            userEmail = `kakao_${user.id}@kakao.com`;
            user.email = userEmail;
          }
          
          // 기존 사용자 확인
          const existingUserResult = await db.request()
            .input('email', userEmail)
            .query('SELECT id, display_name, avatar_url, role FROM users WHERE email = @email AND is_active = 1');
          
          if (existingUserResult.recordset.length > 0) {
            // 기존 사용자 정보 업데이트
            const existingUser = existingUserResult.recordset[0];
            user.id = existingUser.id;
            user.role = existingUser.role;
            user.image = existingUser.avatar_url;
            user.name = existingUser.display_name;
          } else {
            // 새 사용자 생성
            const nickname = account.provider === 'kakao' ? `카카오${user.id}` : user.name;
            
            const newUserResult = await db.request()
              .input('email', userEmail)
              .input('username', userEmail)
              .input('display_name', nickname)
              .input('avatar_url', user.image)
              .input('role', 'USER')
              .input('provider', account.provider)
              .input('provider_id', user.id)
              .query(`
                INSERT INTO users (email, username, display_name, avatar_url, role, provider, provider_id, is_active, created_at, updated_at)
                VALUES (@email, @username, @display_name, @avatar_url, @role, @provider, @provider_id, 1, GETDATE(), GETDATE());
                SELECT SCOPE_IDENTITY() as id;
              `);
            
            const newUserId = newUserResult.recordset[0].id;
            user.id = newUserId;
            user.role = 'USER';
            user.name = nickname;
          }
          
          return true;
        } catch (error) {
          console.error("소셜 로그인 오류:", error);
          return false;
        }
      }
      
      return true;
    },
  },
}; 