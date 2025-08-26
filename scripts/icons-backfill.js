/*
  아이콘 백필 스크립트
  - 노션 DB의 모든 도구를 순회하며 실제 아이콘을 수집해 `아이콘(files)`와 `아이콘 URL`에 저장
  - 기본 동작: 아이콘이 비어있는 항목만 갱신
  - 옵션:
      --refresh  이미 아이콘이 있는 항목도 재수집하여 교체
      --limit=N  최대 N개 항목만 처리

  필요 환경변수:
    - NOTION_API_KEY
    - NOTION_DATABASE_ID
*/

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('@notionhq/client');

// Load env files
const envCandidates = ['.env.local', '.env.development.local', '.env.development', '.env'];
for (const fname of envCandidates) {
  const p = path.resolve(process.cwd(), fname);
  if (fs.existsSync(p)) dotenv.config({ path: p, override: true });
}

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DATABASE_ID;

if (!process.env.NOTION_API_KEY || !databaseId) {
  console.error('[ERROR] NOTION_API_KEY 또는 NOTION_DATABASE_ID가 설정되지 않았습니다.');
  process.exit(1);
}

const args = process.argv.slice(2);
const forceRefresh = args.includes('--refresh');
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

function extractDomain(input) {
  if (!input) return null;
  let s = String(input).trim();
  s = s.replace(/^(https?:)?\/\//i, '');
  s = s.split('/')[0];
  s = s.split(':')[0];
  s = s.replace(/^www\./i, '');
  if (!s || s.includes(' ')) return null;
  return s;
}

function candidateIconUrls(domain) {
  const size = 128;
  const urls = [];
  urls.push(`https://${domain}/favicon.ico`);
  urls.push(`https://${domain}/favicon-32x32.png`);
  urls.push(`https://${domain}/apple-touch-icon.png`);
  urls.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`);
  urls.push(`https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`);
  urls.push(`https://api.faviconkit.com/${encodeURIComponent(domain)}/${size}`);
  urls.push(`https://logo.clearbit.com/${encodeURIComponent(domain)}`);
  return urls;
}

function isAllowedIconSource(iconUrl, domain) {
  try {
    const u = new URL(iconUrl);
    const host = u.hostname;
    const allowedHosts = new Set([
      'www.google.com',
      'icons.duckduckgo.com',
      'api.faviconkit.com',
      'logo.clearbit.com',
    ]);
    if (domain && (host === domain || host === `www.${domain}`)) return true;
    if (allowedHosts.has(host)) return true;
    return false;
  } catch {
    return false;
  }
}

async function validateImage(url) {
  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) return false;
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) return false;
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 500) return false;
    return true;
  } catch {
    return false;
  }
}

function getProp(props, key) {
  return props ? props[key] : undefined;
}

function getUrlValue(prop) { return prop?.url || ''; }
function getFilesFirstUrl(prop) {
  try {
    const files = prop?.files;
    if (Array.isArray(files) && files.length > 0) {
      const f = files[0];
      if (f?.external?.url) return f.external.url;
      if (f?.file?.url) return f.file.url;
    }
  } catch {}
  return '';
}

async function listAllPages() {
  const results = [];
  let start_cursor = undefined;
  let has_more = true;
  while (has_more) {
    const resp = await notion.databases.query({ database_id: databaseId, page_size: 100, start_cursor });
    results.push(...(resp.results || []));
    has_more = !!resp.has_more;
    start_cursor = resp.next_cursor || undefined;
  }
  return results;
}

async function updateIcon(pageId, iconUrl, hasIconUrlProp) {
  // files 우선
  const filesPayload = { page_id: pageId, properties: { '아이콘': { files: [{ name: 'icon', external: { url: iconUrl } }] } } };
  let filesOk = false;
  try { await notion.pages.update(filesPayload); filesOk = true; } catch {}
  // URL도 동시 갱신
  if (hasIconUrlProp) {
    const urlPayload = { page_id: pageId, properties: { '아이콘 URL': { url: iconUrl } } };
    try { await notion.pages.update(urlPayload); } catch {}
  }
  return filesOk;
}

(async () => {
  try {
    const pages = await listAllPages();
    console.log(`[INFO] Fetched ${pages.length} pages.`);
    let processed = 0;

    for (const page of pages) {
      if (limit && processed >= limit) break;
      const props = page.properties || {};
      const pageId = page.id;
      const urlProp = getProp(props, 'URL');
      const iconFiles = getProp(props, '아이콘');
      const iconUrlProp = getProp(props, '아이콘 URL');
      const existingIcon = getFilesFirstUrl(iconFiles) || getUrlValue(iconUrlProp);
      if (existingIcon && !forceRefresh) {
        continue; // skip if already has icon
      }

      const targetUrl = getUrlValue(urlProp);
      const domain = extractDomain(targetUrl);
      if (!domain) {
        console.log(`[SKIP] No valid domain for page ${pageId}`);
        continue;
      }

      const candidates = candidateIconUrls(domain);
      let chosen = '';
      for (const c of candidates) {
        if (!isAllowedIconSource(c, domain)) continue;
        const ok = await validateImage(c);
        if (ok) { chosen = c; break; }
      }

      if (!chosen) {
        console.log(`[MISS] No icon found for ${domain} (page ${pageId})`);
        continue;
      }

      await updateIcon(pageId, chosen, !!iconUrlProp);
      processed++;
      console.log(`[OK] Updated icon for ${domain} (page ${pageId}) -> ${chosen}`);

      // rate-friendly delay
      await new Promise(r => setTimeout(r, 150));
    }

    console.log(`[DONE] Processed ${processed} page(s).`);
    process.exit(0);
  } catch (e) {
    console.error('[ERROR]', e.message);
    process.exit(1);
  }
})();


