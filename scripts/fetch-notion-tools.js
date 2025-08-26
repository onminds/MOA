/*
  노션 AI 툴 데이터베이스 데이터 조회 스크립트
  실제 데이터를 가져와서 현재 구조 파악
*/

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// 환경변수 로드
const envCandidates = ['.env.local', '.env.development.local', '.env.development', '.env'];
for (const fname of envCandidates) {
  const p = path.resolve(process.cwd(), fname);
  if (fs.existsSync(p)) {
    dotenv.config({ path: p, override: true });
  }
}

const { Client } = require('@notionhq/client');

(async () => {
  try {
    const apiKey = process.env.NOTION_API_KEY;
    const databaseId = process.env.NOTION_DATABASE_ID;
    
    if (!apiKey || !databaseId) {
      console.error('[ERROR] NOTION_API_KEY 또는 NOTION_DATABASE_ID가 설정되지 않았습니다.');
      process.exit(1);
    }

    const notion = new Client({ auth: apiKey });
    
    // 데이터베이스에서 AI 툴 데이터 조회 (페이지네이션으로 전체 조회)
    let allResults = [];
    let hasMore = true;
    let startCursor = undefined;
    
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: databaseId,
        page_size: 100,
        start_cursor: startCursor,
        sorts: [
          {
            property: '도구 이름',
            direction: 'ascending'
          }
        ]
      });
      
      allResults = [...allResults, ...response.results];
      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }

    console.log(`\n총 ${allResults.length}개의 AI 툴 발견\n`);
    console.log('='.repeat(80));

    // 각 툴의 데이터 출력 (처음 10개만 표시, 전체는 너무 많음)
    const displayCount = Math.min(10, allResults.length);
    console.log(`(처음 ${displayCount}개만 표시합니다)\n`);
    
    allResults.slice(0, displayCount).forEach((page, index) => {
      const props = page.properties;
      
      // 도구 이름 추출
      const toolName = props['도구 이름']?.title?.[0]?.plain_text || '이름 없음';
      
      // 각 속성 추출
      const url = props['URL']?.url || '';
      const category = props['카테고리']?.multi_select?.map(s => s.name).join(', ') || '';
      const tags = props['태그']?.multi_select?.map(s => s.name).join(', ') || '';
      const priceType = props['가격 형태']?.multi_select?.map(s => s.name).join(', ') || '';
      const hasAPI = props['api여부']?.select?.name || '';
      const koreanSupport = props['한국어 지원']?.checkbox ? '✓' : '✗';
      const koreanService = props['한국 서비스']?.checkbox ? '✓' : '✗';
      const loginMethod = props['로그인 방식']?.multi_select?.map(s => s.name).join(', ') || '';
      const summary = props['한줄평']?.rich_text?.[0]?.plain_text || '';
      const iconUrl = props['아이콘 url']?.url || '';
      const status = props['상태']?.select?.name || '';
      const verified = props['서비스 검증']?.checkbox ? '✓' : '✗';
      
      console.log(`[${index + 1}] ${toolName}`);
      console.log(`    URL: ${url}`);
      console.log(`    카테고리: ${category}`);
      console.log(`    태그: ${tags}`);
      console.log(`    가격: ${priceType}`);
      console.log(`    API: ${hasAPI}`);
      console.log(`    한국어: ${koreanSupport} | 한국 서비스: ${koreanService}`);
      console.log(`    로그인: ${loginMethod}`);
      console.log(`    상태: ${status} | 검증: ${verified}`);
      if (summary) console.log(`    한줄평: ${summary}`);
      if (iconUrl) console.log(`    아이콘: ${iconUrl}`);
      console.log('-'.repeat(80));
    });

    // 통계 출력
    console.log('\n=== 통계 ===');
    
    // 카테고리별 집계
    const categories = {};
    allResults.forEach(page => {
      const cats = page.properties['카테고리']?.multi_select || [];
      cats.forEach(cat => {
        categories[cat.name] = (categories[cat.name] || 0) + 1;
      });
    });
    
    console.log('\n카테고리별 분포:');
    Object.entries(categories).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count}개`);
    });

    // 가격 형태별 집계
    const priceTypes = {};
    allResults.forEach(page => {
      const prices = page.properties['가격 형태']?.multi_select || [];
      prices.forEach(price => {
        priceTypes[price.name] = (priceTypes[price.name] || 0) + 1;
      });
    });
    
    console.log('\n가격 형태별 분포:');
    Object.entries(priceTypes).sort((a, b) => b[1] - a[1]).forEach(([price, count]) => {
      console.log(`  ${price}: ${count}개`);
    });

    // API 지원 여부
    const apiSupport = {};
    allResults.forEach(page => {
      const api = page.properties['api여부']?.select?.name || '미지정';
      apiSupport[api] = (apiSupport[api] || 0) + 1;
    });
    
    console.log('\nAPI 지원:');
    Object.entries(apiSupport).forEach(([api, count]) => {
      console.log(`  ${api}: ${count}개`);
    });

    // 한국어 지원
    let koreanCount = 0;
    allResults.forEach(page => {
      if (page.properties['한국어 지원']?.checkbox) koreanCount++;
    });
    console.log(`\n한국어 지원: ${koreanCount}개 / ${allResults.length}개`);

    process.exit(0);
  } catch (e) {
    console.error('[ERROR]', e.message);
    if (e.body) {
      console.error('상세 에러:', JSON.stringify(e.body, null, 2));
    }
    process.exit(1);
  }
})();
