/*
  노션 데이터베이스 스키마 점검 스크립트
  필요 환경변수:
    - NOTION_API_KEY
    - NOTION_DATABASE_ID (AI도구 데이터베이스)
    - NOTION_RELEASES_DB_ID (선택: AI 도구의 API데이터 베이스)
*/

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const envCandidates = [
  '.env.local',
  '.env.development.local',
  '.env.development',
  '.env',
];
let loadedCount = 0;
for (const fname of envCandidates) {
  const p = path.resolve(process.cwd(), fname);
  if (fs.existsSync(p)) {
    const res = dotenv.config({ path: p, override: true });
    if (!res.error) loadedCount++;
  }
}
console.log(`[dotenv] loaded ${loadedCount} file(s) from ${envCandidates.join(', ')}`);
const { Client } = require('@notionhq/client');

(async () => {
  try {
    const apiKey = process.env.NOTION_API_KEY;
    const databaseId = process.env.NOTION_DATABASE_ID;
    const releasesDbId = process.env.NOTION_RELEASES_DB_ID;
    if (!apiKey || !databaseId) {
      console.error('[ERROR] NOTION_API_KEY 또는 NOTION_DATABASE_ID가 설정되지 않았습니다.');
      process.exit(1);
    }

    const notion = new Client({ auth: apiKey });
    const resp = await notion.databases.retrieve({ database_id: databaseId });
    const props = resp.properties || {};

    const rows = Object.entries(props).map(([name, def]) => {
      const type = def?.type || 'unknown';
      return { name, type };
    });

    console.log('--- Notion Database Properties (NOTION_DATABASE_ID) ---');
    for (const r of rows) {
      console.log(`${r.name}\t${r.type}`);
    }

    // 필수 권장 속성 검사
    const required = [
      'ID',
      '도구 이름',
      'URL',
      '태그',
      '카테고리',
      '가격 형태',
      '한국어 지원',
      '한국 서비스',
      'api여부',
      '로그인 방식',
    ];
    const optionalIcon = ['아이콘', '아이콘 URL'];

    const missing = required.filter(k => !(k in props));
    const hasIcon = optionalIcon.some(k => k in props);

    console.log('\n--- Validation (NOTION_DATABASE_ID) ---');
    if (missing.length > 0) {
      console.log('누락된 필수 속성:', missing.join(', '));
    } else {
      console.log('필수 속성: OK');
    }
    if (!hasIcon) {
      console.log('권장 아이콘 속성 없음: 아이콘(files) 또는 아이콘 URL(url/rich_text) 중 하나를 추가하세요.');
    } else {
      console.log('아이콘 속성: OK');
    }

    if (releasesDbId) {
      const rel = await notion.databases.retrieve({ database_id: releasesDbId });
      const relProps = rel.properties || {};
      const relRows = Object.entries(relProps).map(([name, def]) => ({ name, type: def?.type || 'unknown' }));
      console.log('\n--- Notion Database Properties (NOTION_RELEASES_DB_ID) ---');
      for (const r of relRows) {
        console.log(`${r.name}\t${r.type}`);
      }
    }

    process.exit(0);
  } catch (e) {
    console.error('[ERROR]', e.message);
    process.exit(1);
  }
})();


