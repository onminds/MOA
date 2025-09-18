'use client';

import { useState } from 'react';
import SlideEditor from '@/components/SlideEditor';

const SAMPLE_HTML = `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charSet="utf-8" />
    <title>SlideEditor Playground - TOC</title>
    <style>
      body { margin:0; padding:0; width:1280px; height:720px; background:#ffffff; font-family:'Noto Sans KR', Arial, sans-serif; }
      .toc-title { position:absolute; left:80px; top:72px; font-size:64px; font-weight:900; letter-spacing:-1px; color:#111827; }
      .toc-wrap { position:absolute; left:80px; top:170px; width:560px; }
      .toc-item { display:flex; align-items:center; gap:14px; padding:14px 0; border-bottom:1px solid #E5E7EB; color:#111827; }
      .toc-item .idx { font-weight:800; color:#111827; width:52px; text-align:right; }
      .toc-item .text { font-size:18px; }
      .note { position:absolute; left:80px; bottom:72px; font-size:12px; color:#6B7280; }
      .image-side { position:absolute; right:80px; top:110px; width:520px; height:360px; background:#F3F4F6; border-radius:16px; display:flex; align-items:center; justify-content:center; color:#6B7280; font-weight:600; }
    </style>
  </head>
  <body>
    <div class="toc-title">목차</div>
    <div class="toc-wrap">
      <div class="toc-item"><span class="idx">01.</span><span class="text">서론</span></div>
      <div class="toc-item"><span class="idx">02.</span><span class="text">사회적·윤리적 영향</span></div>
      <div class="toc-item"><span class="idx">03.</span><span class="text">노동시장 및 일자리 변화</span></div>
      <div class="toc-item"><span class="idx">04.</span><span class="text">경제·경쟁력 프레임워크</span></div>
      <div class="toc-item"><span class="idx">05.</span><span class="text">보건의료 혁신</span></div>
      <div class="toc-item"><span class="idx">06.</span><span class="text">교육과 인간 역량 강화</span></div>
      <div class="toc-item"><span class="idx">07.</span><span class="text">산업별 적용 사례</span></div>
      <div class="toc-item"><span class="idx">08.</span><span class="text">보안·리스크 관리</span></div>
      <div class="toc-item"><span class="idx">09.</span><span class="text">연구개발 및 혁신 전략</span></div>
      <div class="toc-item"><span class="idx">10.</span><span class="text">실행 로드맵 및 권고</span></div>
    </div>
    <div class="image-side">시각 자료 영역</div>
    <div class="note">각 항목을 클릭해 직접 편집하거나 드래그로 재배치할 수 있습니다.</div>
  </body>
</html>`;

export default function SlideEditorPlayground() {
  const [isOpen, setIsOpen] = useState(false);
  const [html, setHtml] = useState<string>(SAMPLE_HTML);
  const [saved, setSaved] = useState<string>('');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">SlideEditor 플레이그라운드</h1>

        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setIsOpen(true)}
            className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800"
          >
            세부 수정 열기
          </button>
          <button
            onClick={() => setHtml(SAMPLE_HTML)}
            className="px-3 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
          >
            샘플 초기화
          </button>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-7">
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-2">현재 HTML 미리보기</h2>
              <div className="overflow-auto border rounded" style={{ maxHeight: 520 }}>
                <iframe
                  srcDoc={html}
                  className="w-full"
                  style={{ width: '1280px', height: '720px', transform: 'scale(0.6)', transformOrigin: 'top left', border: 'none' }}
                  title="preview"
                />
              </div>
            </div>
          </div>
          <div className="col-span-5">
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-2">저장 결과(요약)</h2>
              <textarea
                className="w-full h-[480px] border rounded p-2 text-xs font-mono"
                readOnly
                value={saved ? saved.substring(0, 1200) + (saved.length > 1200 ? '\n... (truncated)' : '') : '아직 저장된 결과가 없습니다.'}
              />
            </div>
          </div>
        </div>
      </div>

      <SlideEditor
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        htmlContent={html}
        onSave={(newHtml) => {
          setHtml(newHtml);
          setSaved(newHtml);
        }}
        slideIndex={1}
      />
    </div>
  );
}


