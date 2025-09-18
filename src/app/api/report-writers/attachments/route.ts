import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import { extractTextFromPPT } from '@/lib/pptParser';

export const runtime = 'nodejs';

type ExtractedFile = {
  name: string;
  type: string;
  size: number;
  method: 'mammoth-docx' | 'ppt-parser' | 'document-ocr' | 'plain-text' | 'unsupported' | 'error';
  text: string;
  error?: string;
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const single = formData.get('file') as File | null;
    const rawFiles = formData.getAll('files') as File[];
    const files = single ? [single] : (rawFiles?.length ? [rawFiles[0]] : []);

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'file 또는 files 중 하나로 첨부 파일을 업로드하세요.' }, { status: 400 });
    }
    const results: ExtractedFile[] = [];

    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host') || 'localhost:3000';
    const baseUrl = `${proto}://${host}`;

    for (const file of files) {
      const name = file.name || 'unnamed';
      const size = file.size || 0;
      const lower = name.toLowerCase();
      const type = lower.split('.').pop() || '';
      let method: ExtractedFile['method'] = 'unsupported';
      let text = '';
      try {
        if (lower.endsWith('.txt')) {
          method = 'plain-text';
          text = await file.text();
        } else if (lower.endsWith('.doc') || lower.endsWith('.docx')) {
          method = 'mammoth-docx';
          const buffer = Buffer.from(await file.arrayBuffer());
          const res = await mammoth.extractRawText({ buffer });
          text = (res.value || '').trim();
        } else if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) {
          method = 'ppt-parser';
          const buffer = Buffer.from(await file.arrayBuffer());
          text = (await extractTextFromPPT(buffer)) || '';
        } else if (lower.endsWith('.pdf')) {
          method = 'document-ocr';
          const fd = new FormData();
          fd.append('file', file);
          const resp = await fetch(`${baseUrl}/api/document-ocr`, { method: 'POST', body: fd });
          if (resp.ok) {
            const data = await resp.json();
            const items = Array.isArray(data?.results) ? data.results : [];
            const combined = items.map((r: any) => (r?.text || '').trim()).filter((s: string) => s.length > 0).join('\n\n');
            text = combined || '';
          } else {
            const msg = await resp.text().catch(() => '');
            throw new Error(`document-ocr 실패: ${resp.status} ${msg}`);
          }
        } else {
          method = 'unsupported';
          text = '';
        }

        results.push({
          name,
          type,
          size,
          method,
          text: text || '',
        });
      } catch (err: any) {
        results.push({
          name,
          type,
          size,
          method: 'error',
          text: '',
          error: err?.message || '추출 실패',
        });
      }
    }

    const attachmentsText = results.map((r) => r.text).filter(Boolean).join('\n\n').trim();

    return NextResponse.json({
      attachmentsText,
      files: results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: '첨부 처리 중 오류', details: error?.message || 'unknown' }, { status: 500 });
  }
}


