/* eslint-disable no-console */
import 'dotenv/config';
import { Client } from '@notionhq/client';

async function main() {
  const apiKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_RELEASES_DATABASE_ID;
  if (!apiKey || !dbId) {
    console.error('NOTION_API_KEY 또는 NOTION_RELEASES_DATABASE_ID가 설정되어 있지 않습니다.');
    process.exit(1);
  }

  const notion = new Client({ auth: apiKey });
  const fieldStats: Record<string, { types: Set<string>; samples: Set<string> }> = {};

  const add = (name: string, type: string, sample?: string) => {
    if (!fieldStats[name]) fieldStats[name] = { types: new Set(), samples: new Set() };
    fieldStats[name].types.add(type);
    if (sample) fieldStats[name].samples.add(sample);
  };

  const toText = (prop: any): string => {
    try {
      if (Array.isArray(prop?.title)) return prop.title.map((t: any) => t?.plain_text || '').join('');
      if (Array.isArray(prop?.rich_text)) return prop.rich_text.map((t: any) => t?.plain_text || '').join('');
      if (typeof prop?.url === 'string') return prop.url;
      if (typeof prop?.select?.name === 'string') return prop.select.name;
      if (Array.isArray(prop?.multi_select)) return prop.multi_select.map((m: any) => m?.name || '').join(', ');
      if (prop?.date?.start) return String(prop.date.start);
    } catch {}
    return '';
  };

  let start_cursor: string | undefined = undefined;
  let has_more = true;
  let total = 0;
  while (has_more) {
    const resp: any = await notion.databases.query({ database_id: dbId, page_size: 50, start_cursor });
    const results: any[] = resp.results || [];
    for (const page of results) {
      const props = page.properties || {};
      for (const [name, prop] of Object.entries<any>(props)) {
        const type = prop?.type || 'unknown';
        const sample = toText(prop);
        add(name, type, sample);
      }
    }
    total += results.length;
    has_more = Boolean(resp.has_more);
    start_cursor = resp.next_cursor || undefined;
    if (total >= 300) break;
  }

  const report = Object.entries(fieldStats)
    .map(([name, info]) => ({
      name,
      types: Array.from(info.types),
      sample: Array.from(info.samples).slice(0, 3),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  console.log(JSON.stringify({ total_pages_scanned: total, fields: report }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


