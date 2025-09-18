'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wand2, Download, RefreshCw, Eye, FileText, File, Edit3 } from 'lucide-react';
import Header from '../components/Header';
import SlideEditor from '../../components/SlideEditor';
import { useToast } from "@/contexts/ToastContext";
import { createUsageToastData, createUsageToastMessage } from "@/lib/toast-utils";

export default function PPTCreatePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [topic, setTopic] = useState('');
  const [htmlContents, setHtmlContents] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [currentSection, setCurrentSection] = useState(1);
  const [script, setScript] = useState<string>('');
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [templateSet, setTemplateSet] = useState<'Modern company' | 'Clinique Slide'>('Modern company');
  const [hancomMode, setHancomMode] = useState<boolean>(true);
  
  // 편집 관련 상태
  const [editingSlideIndex, setEditingSlideIndex] = useState<number | null>(null);
  const [editedHtmlContents, setEditedHtmlContents] = useState<string[]>([]);

  // 편집된 HTML 내용 초기화
  useEffect(() => {
    if (htmlContents.length > 0) {
      // 기존 편집된 내용이 없거나 길이가 다르면 새로 초기화
      if (editedHtmlContents.length !== htmlContents.length) {
        setEditedHtmlContents([...htmlContents]);
      }
    }
  }, [htmlContents, editedHtmlContents.length]);

  // 슬라이드 편집 시작
  const startEditingSlide = (index: number) => {
    setEditingSlideIndex(index);
  };

  // 슬라이드 편집 완료
  const finishEditingSlide = () => {
    setEditingSlideIndex(null);
  };

  // 슬라이드 내용 업데이트
  const updateSlideContent = (newHtml: string) => {
    if (editingSlideIndex !== null) {
      console.log('=== 슬라이드 내용 업데이트 시작 ===');
      console.log('슬라이드 인덱스:', editingSlideIndex);
      console.log('원본 길이:', editedHtmlContents[editingSlideIndex]?.length || 0);
      console.log('새 HTML 길이:', newHtml.length);
      console.log('새 HTML 미리보기:', newHtml.substring(0, 150) + '...');
      
      const newContents = [...editedHtmlContents];
      const oldContent = newContents[editingSlideIndex];
      newContents[editingSlideIndex] = newHtml;
      setEditedHtmlContents(newContents);
      
      console.log('내용이 실제로 변경됨:', oldContent !== newHtml);
      console.log('업데이트된 배열 길이:', newContents.length);
      console.log('=== 슬라이드 내용 업데이트 완료 ===');
      
      // 강제로 리렌더링 트리거
      setTimeout(() => {
        console.log('리렌더링 후 editedHtmlContents 확인:', editedHtmlContents.length);
      }, 100);
    } else {
      console.error('editingSlideIndex가 null입니다!');
    }
  };

  // 단계 진입 검증: 템플릿 선택 완료 여부 확인 후 값 주입 (주제는 이 페이지에서 입력)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedTpl = window.localStorage.getItem('ppt_template_set') as 'Modern company' | 'Clinique Slide' | null;
    if (!savedTpl) {
      router.replace('/ppt-template');
      return;
    }
    setTemplateSet(savedTpl);
  }, [router]);

  // 고정된 12페이지 구조
  const fixedSlideCount = 12;
  const slideTypes = [
    { type: 'title', name: '1. 제목 슬라이드' },
    { type: 'table-of-contents', name: '2. 목차' },
    { type: 'statistics', name: '3. 통계 & 트렌드' },
    { type: 'priority', name: '4. 우선순위 분석' },
    { type: 'metrics', name: '5. 성과 지표' },
    { type: 'jobs', name: '6. 일자리 변화와 기회' },
    { type: 'policy', name: '7. 한국의 AI 전략과 정책' },
    { type: 'ethics', name: '8. 윤리와 도전과제' },
    { type: 'cases', name: '9. 기술·비즈니스 사례' },
    { type: 'future', name: '10. 미래 준비사항' },
    { type: 'summary', name: '11. 요약 및 행동계획' },
    { type: 'thanks', name: '12. 감사합니다 & 참고자료' }
  ];

  // 병렬 요청 타임아웃 헬퍼
  const REQUEST_TIMEOUT_MS = 90000;
  const postJsonWithTimeout = async (url: string, body: any, timeoutMs = REQUEST_TIMEOUT_MS) => {
    const controller = new AbortController();
    const timer = typeof window !== 'undefined' ? window.setTimeout(() => controller.abort(), timeoutMs) : (setTimeout(() => controller.abort(), timeoutMs) as unknown as number);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Request failed: ${res.status}`);
      return data;
    } finally {
      try { clearTimeout(timer); } catch {}
    }
  };

  // 재시도(지수 백오프 + 지터)
  const postJsonWithRetry = async (url: string, body: any, opts?: { retries?: number; timeoutMs?: number }) => {
    const maxRetries = Math.max(0, opts?.retries ?? 2);
    const timeoutMs = opts?.timeoutMs ?? REQUEST_TIMEOUT_MS;
    let attempt = 0;
    // 첫 시도 포함 총 maxRetries+1회
    // 0,1,2 ...
    // backoff: 600ms * 2^attempt + [0..300]ms
    for (;;) {
      try {
        return await postJsonWithTimeout(url, body, timeoutMs);
      } catch (e) {
        if (attempt >= maxRetries) throw e;
        const base = 600 * Math.pow(2, attempt);
        const jitter = Math.floor(Math.random() * 300);
        await new Promise((r) => setTimeout(r, base + jitter));
        attempt += 1;
      }
    }
  };

  // 섹션 실패 시 폴백 HTML
  const buildFallbackSlide = (sectionNum: number, titleText?: string) => {
    const title = titleText || `${sectionNum}번째 섹션`;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="margin:0;padding:0;width:1280px;height:720px;background:#ffffff;">
      <div style="width:1280px;height:720px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Noto Sans KR', Arial, sans-serif;color:#111827;">
        <div style="font-size:40px;font-weight:800;margin-bottom:12px;">${title}</div>
        <div style="font-size:18px;opacity:.8;">일시적으로 내용을 불러오지 못했습니다. 나중에 다시 시도해주세요.</div>
      </div>
    </body></html>`;
  };

  // 텍스트 추출 유틸: 제목/불릿/본문
  const extractTextBlocks = (html: string): { title: string; bullets: string[]; paragraph: string } => {
    const container = document.createElement('div');
    container.innerHTML = cleanHtmlForPreview(html);

    // 헤더 우선순위로 제목 탐색
    const h = container.querySelector('h1, h2, h3, .title, .header-title');
    const title = (h?.textContent || '').trim().slice(0, 120);

    // 불릿 수집
    const bullets: string[] = [];
    container.querySelectorAll('li').forEach((li) => {
      const t = (li.textContent || '').trim();
      if (t) bullets.push(t.slice(0, 200));
    });

    // 본문 단락 수집
    let paragraph = '';
    if (!bullets.length) {
      // p > div 텍스트 순서대로 최대 600자
      const parts: string[] = [];
      container.querySelectorAll('p, div').forEach((el) => {
        const t = (el.textContent || '').trim();
        if (t && t.length > 3) parts.push(t);
      });
      paragraph = parts.join('\n').slice(0, 800);
    }

    return {
      title: title || '제목',
      bullets: bullets.slice(0, 8),
      paragraph,
    };
  };

  // PPTX 텍스트 기반 다운로드 (텍스트 박스 우선, 실패 시 이미지 폴백)
  const downloadAsPPTXText = async () => {
    if (htmlContents.length === 0) {
      alert('먼저 슬라이드를 생성해주세요.');
      return;
    }

    // 경고 및 동의
    const ok = window.confirm(
      '텍스트 기반 PPTX는 시스템 폰트(예: 맑은 고딕/굴림)로 대체되어 원본과 다르게 보일 수 있습니다.\n또한 복잡한 요소는 이미지 배경으로 포함됩니다. 계속하시겠습니까?'
    );
    if (!ok) return;

    // 헬퍼: 색상 -> hex
    const cssColorToHex = (input: string | null | undefined): string | undefined => {
      if (!input) return undefined;
      const s = String(input).trim();
      if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) return s.replace('#', '').toUpperCase();
      const m = s.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\)/i);
      if (!m) return undefined;
      const r = Math.max(0, Math.min(255, parseInt(m[1], 10)));
      const g = Math.max(0, Math.min(255, parseInt(m[2], 10)));
      const b = Math.max(0, Math.min(255, parseInt(m[3], 10)));
      const hex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
      return `${hex(r)}${hex(g)}${hex(b)}`;
    };

    // 헬퍼: px -> pt (approx 96dpi)
    const pxToPt = (pxStr: string | null | undefined, fallback = 18): number => {
      if (!pxStr) return fallback;
      const v = parseFloat(String(pxStr));
      if (!isFinite(v)) return fallback;
      return Math.max(6, Math.min(96, Math.round(v * 0.75)));
    };

    // 헬퍼: 텍스트 요소 판별(leaf 또는 직접 텍스트 보유 div)
    const isTextLike = (el: Element): boolean => {
      const tag = el.tagName.toLowerCase();
      if (!['h1','h2','h3','h4','h5','h6','p','span','li','div'].includes(tag)) return false;
      if ((el as HTMLElement).offsetWidth === 0 || (el as HTMLElement).offsetHeight === 0) return false;
      if (el.childElementCount === 0) return Boolean(el.textContent && el.textContent.trim());
      if (tag === 'div') {
        for (const node of Array.from(el.childNodes)) {
          if (node.nodeType === Node.TEXT_NODE && (node.textContent || '').trim()) return true;
        }
      }
      if (tag === 'ul' || tag === 'ol') {
        return (el as HTMLElement).querySelectorAll('li').length > 0;
      }
      return false;
    };

    const isTopLevelTextLike = (el: Element): boolean => {
      if (!isTextLike(el)) return false;
      let p: Element | null = el.parentElement;
      while (p) {
        if (isTextLike(p)) return false; // 상위에 텍스트 블록이 있으면 하위는 제외
        p = p.parentElement;
      }
      return true;
    };

    // 폰트 매핑 및 사이즈 보정계수
    const mapFont = (cssFamily: string | null | undefined): { pptFont: string; sizeScale: number } => {
      const fam = (cssFamily || '').toLowerCase();
      // 웹폰트 → 시스템폰트 매핑
      if (fam.includes('noto')) return { pptFont: hancomMode ? '맑은 고딕' : 'Malgun Gothic', sizeScale: hancomMode ? 0.94 : 0.97 };
      if (fam.includes('pretendard')) return { pptFont: hancomMode ? '맑은 고딕' : 'Malgun Gothic', sizeScale: hancomMode ? 0.93 : 0.96 };
      if (fam.includes('roboto')) return { pptFont: hancomMode ? '맑은 고딕' : 'Calibri', sizeScale: hancomMode ? 0.92 : 1.0 };
      if (fam.includes('inter')) return { pptFont: hancomMode ? '맑은 고딕' : 'Calibri', sizeScale: hancomMode ? 0.92 : 1.0 };
      if (fam.includes('apple sd')) return { pptFont: hancomMode ? '맑은 고딕' : 'Malgun Gothic', sizeScale: hancomMode ? 0.95 : 0.98 };
      return { pptFont: hancomMode ? '맑은 고딕' : 'Malgun Gothic', sizeScale: hancomMode ? 0.95 : 1.0 };
    };

    // 패딩 합계(px)
    const getPaddingPx = (cs: CSSStyleDeclaration) => {
      const p = (v: string) => (parseFloat(v || '0') || 0);
      const pl = p(cs.paddingLeft as string);
      const pr = p(cs.paddingRight as string);
      const pt = p(cs.paddingTop as string);
      const pb = p(cs.paddingBottom as string);
      return { pl, pr, pt, pb };
    };

    // 라인하이트 → pt
    const lineHeightToPt = (cs: CSSStyleDeclaration, basePt: number): number => {
      const lh = cs.lineHeight;
      if (!lh || lh === 'normal' || lh === 'initial' || lh === 'inherit') return Math.round(basePt * 1.2);
      const n = parseFloat(lh);
      if (String(lh).endsWith('px')) return pxToPt(lh, Math.round(basePt * 1.2));
      if (isFinite(n)) return Math.round(basePt * n);
      return Math.round(basePt * 1.2);
    };

    // 한쇼 보정: 좌표/폰트/라인스페이싱 보정
    const adjustForHancom = (val: { x: number; y: number; fontSize: number; lineSpacing: number }) => {
      if (!hancomMode) return val;
      return {
        x: Math.max(0, val.x + 0.05),           // 약간 오른쪽 보정
        y: Math.max(0, val.y + 0.02),           // 약간 아래 보정
        fontSize: Math.max(6, Math.round(val.fontSize * 0.96)), // 한쇼에서 크게 보이는 경향
        lineSpacing: Math.max(10, Math.round(val.lineSpacing * 0.94)),
      };
    };

    setIsDownloading(true);
    try {
      const PptxGenJS = (await import('pptxgenjs')).default;
      const html2canvas = (await import('html2canvas')).default;

      const pptx = new PptxGenJS();
      pptx.defineLayout({ name: 'LAYOUT_16x9', width: 10, height: 5.625 });
      pptx.layout = 'LAYOUT_16x9';

      // 텍스트 숨김 헬퍼(레이아웃은 유지)
      const hideTextNodes = (root: HTMLElement) => {
        const list = Array.from(root.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,li,div,ul,ol'));
        for (const el of list) {
          if (!isTextLike(el)) continue;
          const node = el as HTMLElement;
          // 배경/도형은 유지하고 텍스트만 투명화
          node.style.color = 'transparent';
          (node.style as any)['-webkit-text-fill-color'] = 'transparent';
          node.style.textShadow = 'none';
        }
        // SVG 텍스트도 숨김
        const svgTexts = Array.from(root.querySelectorAll('svg text')) as SVGTextElement[];
        for (const t of svgTexts) {
          try { (t.style as any).fill = 'transparent'; } catch {}
          try { t.setAttribute('fill', 'transparent'); } catch {}
          try { t.setAttribute('stroke', 'transparent'); } catch {}
        }
      };

      // 이미지 숨김(배경 캡처에서 텍스트/이미지를 제외)
      const hideImageNodes = (root: HTMLElement) => {
        root.querySelectorAll('img').forEach((img) => {
          (img as HTMLElement).style.visibility = 'hidden';
        });
      };

      // 이미지 → dataURL (CORS 우회 포함)
      const fetchImageAsDataURL = async (url: string): Promise<string | null> => {
        const toDataURL = async (blob: Blob) => new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.readAsDataURL(blob);
        });
        const tryFetch = async (u: string) => {
          const res = await fetch(u, { mode: 'cors' }).catch(() => null);
          if (!res || !res.ok) return null;
          const blob = await res.blob();
          return await toDataURL(blob);
        };
        // 1) 직접 시도
        let data = await tryFetch(url);
        if (data) return data;
        // 2) 프록시 시도
        try {
          const proxied = `/api/proxy-image?url=${encodeURIComponent(url)}`;
          const res = await fetch(proxied).catch(() => null);
          if (!res || !res.ok) return null;
          const blob = await res.blob();
          return await toDataURL(blob);
        } catch { return null; }
      };

      // shrink-to-fit: 텍스트가 박스에 넘치면 폰트 크기를 낮춰서 맞춤
      const shrinkToFitPt = (text: string, cs: CSSStyleDeclaration, basePt: number, widthPx: number, heightPx: number): number => {
        const meas = document.createElement('div');
        meas.style.position = 'absolute';
        meas.style.left = '-99999px';
        meas.style.top = '-99999px';
        meas.style.width = `${Math.max(4, Math.floor(widthPx))}px`;
        meas.style.height = `${Math.max(4, Math.floor(heightPx))}px`;
        meas.style.overflow = 'auto';
        meas.style.whiteSpace = 'pre-wrap';
        meas.style.wordBreak = 'break-word';
        meas.style.boxSizing = 'border-box';
        meas.style.padding = '0';
        meas.style.margin = '0';
        meas.style.fontFamily = cs.fontFamily || 'Malgun Gothic';
        meas.style.fontStyle = cs.fontStyle || 'normal';
        meas.style.fontWeight = cs.fontWeight || '400';
        meas.style.lineHeight = cs.lineHeight && cs.lineHeight !== 'normal' ? cs.lineHeight : '1.2';
        meas.style.letterSpacing = cs.letterSpacing || '0px';
        meas.style.color = cs.color || '#111827';
        meas.style.textAlign = cs.textAlign || 'left';
        meas.textContent = text;
        document.body.appendChild(meas);

        // pt→px 변환
        const ptToPx = (pt: number) => pt / 0.75;
        let currentPt = Math.max(6, Math.min(96, basePt));
        for (let i = 0; i < 8; i += 1) {
          meas.style.fontSize = `${ptToPx(currentPt)}px`;
          // 스크롤이 생기지 않으면 충분
          if (meas.scrollHeight <= meas.clientHeight && meas.scrollWidth <= meas.clientWidth) break;
          currentPt = Math.max(6, Math.floor(currentPt * 0.92));
        }

        try { document.body.removeChild(meas); } catch {}
        return currentPt;
      };

      for (let i = 0; i < htmlContents.length; i++) {
        const slide = pptx.addSlide();
        slide.background = { fill: 'FFFFFF' };

        // 1) 측정용 DOM(텍스트/이미지 포함)
        const tempMeasure = document.createElement('div');
        tempMeasure.style.position = 'absolute';
        tempMeasure.style.left = '-9999px';
        tempMeasure.style.width = '1280px';
        tempMeasure.style.height = '720px';
        tempMeasure.style.backgroundColor = 'white';
        tempMeasure.innerHTML = `<div class="pptx-measure-root" style="position:relative;width:1280px;height:720px;background:white;">${cleanHtmlForPreview(
          editedHtmlContents[i] || htmlContents[i]
        )}</div>`;
        document.body.appendChild(tempMeasure);
        const measureRoot = tempMeasure.querySelector('.pptx-measure-root') as HTMLElement;

        // 2) 배경 캡처용 DOM(텍스트/이미지 숨김)
        const tempBg = document.createElement('div');
        tempBg.style.position = 'absolute';
        tempBg.style.left = '-9999px';
        tempBg.style.width = '1280px';
        tempBg.style.height = '720px';
        tempBg.style.backgroundColor = 'white';
        tempBg.innerHTML = `<div class="pptx-render-root" style="position:relative;width:1280px;height:720px;background:white;">${cleanHtmlForPreview(
          editedHtmlContents[i] || htmlContents[i]
        )}</div>`;
        document.body.appendChild(tempBg);
        const renderRoot = tempBg.querySelector('.pptx-render-root') as HTMLElement;
        hideTextNodes(renderRoot);
        // 이미지(배경/사진)는 유지하여 배경 캡처에 포함

        // 배경 캡처 전에 이미지 로딩 보장
        const imgsToLoad = Array.from(renderRoot.querySelectorAll('img')) as HTMLImageElement[];
        if (imgsToLoad.length > 0) {
          await Promise.all(
            imgsToLoad.map((im) => new Promise<void>((resolve) => {
              if (im.complete) return resolve();
              const done = () => resolve();
              im.addEventListener('load', done, { once: true });
              im.addEventListener('error', done, { once: true });
            }))
          );
        }

        try {
          // 3) 배경 이미지(텍스트/이미지 숨김) 캡처
          const canvasBg = await html2canvas(tempBg, {
            width: 1280,
            height: 720,
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
            allowTaint: true,
            logging: false,
          });
          const bgData = canvasBg.toDataURL('image/png');
          // 배경 이미지를 슬라이드 배경으로 지정(개별 이미지 셰이프 생성 방지)
          slide.background = { data: bgData } as any;

          // 대비 색상 선택 유틸 (배경 캔버스 기반)
          const bgCtx = canvasBg.getContext('2d');
          const sampleAvgRGB = (x: number, y: number, w: number, h: number) => {
            if (!bgCtx) return { r: 255, g: 255, b: 255 };
            const sx = Math.max(0, Math.min(canvasBg.width - 1, Math.floor(x)));
            const sy = Math.max(0, Math.min(canvasBg.height - 1, Math.floor(y)));
            const sw = Math.max(1, Math.min(canvasBg.width - sx, Math.floor(w)));
            const sh = Math.max(1, Math.min(canvasBg.height - sy, Math.floor(h)));
            const data = bgCtx.getImageData(sx, sy, sw, sh).data;
            let r = 0, g = 0, b = 0, n = 0;
            // 샘플 밀도 축소: 4픽셀 단위로 평균
            for (let i = 0; i < data.length; i += 16) {
              r += data[i]; g += data[i + 1]; b += data[i + 2]; n += 1;
            }
            if (n === 0) return { r: 255, g: 255, b: 255 };
            return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
          };
          const relLum = (c: { r: number; g: number; b: number }) => {
            const toLin = (u: number) => {
              const s = u / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
            };
            const R = toLin(c.r), G = toLin(c.g), B = toLin(c.b);
            return 0.2126 * R + 0.7152 * G + 0.0722 * B;
          };
          const contrast = (lum1: number, lum2: number) => {
            const L1 = Math.max(lum1, lum2) + 0.05; const L2 = Math.min(lum1, lum2) + 0.05; return L1 / L2;
          };
          const pickContrastHex = (avg: { r: number; g: number; b: number }, preferredHex?: string) => {
            const lumBg = relLum(avg);
            const lumBlack = 0; const lumWhite = 1; // 근사
            const cBlack = contrast(lumBg, lumBlack);
            const cWhite = contrast(lumBg, lumWhite);
            // 우선 기본 선호 색상이 충분히 대비되면 유지
            if (preferredHex) {
              const ph = preferredHex.replace('#','');
              const pr = parseInt(ph.substring(0,2),16), pg = parseInt(ph.substring(2,4),16), pb = parseInt(ph.substring(4,6),16);
              const lumPref = relLum({ r: pr, g: pg, b: pb });
              const cPref = contrast(lumBg, lumPref);
              if (cPref >= 4.0) return preferredHex; // 가독성 기준 근사
            }
            return cBlack >= cWhite ? '111111' : 'FFFFFF';
          };
 
          // 4) 이미지 개별 오버레이는 제거(배경에 포함되어 중복 방지)
          const imgEls = Array.from(measureRoot.querySelectorAll('img')) as HTMLImageElement[];
          const rootRectImg = measureRoot.getBoundingClientRect();
          for (const img of imgEls) {
            const r = img.getBoundingClientRect();
            // 화면상에 없는 경우 스킵
            if (r.width <= 0 || r.height <= 0) continue;
            const dataURL = await fetchImageAsDataURL(img.src);
            if (!dataURL) continue;
            const x = Math.max(0, (r.left - rootRectImg.left) / 1280 * 10);
            const y = Math.max(0, (r.top - rootRectImg.top) / 720 * 5.625);
            const w = Math.max(0.1, Math.min(10, r.width / 1280 * 10));
            const h = Math.max(0.1, Math.min(5.625, r.height / 720 * 5.625));
            slide.addImage({ data: dataURL, x, y, w, h });
          }

          // 5) 텍스트 요소 오버레이(정밀 배치)
          const candidates = Array.from(measureRoot.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,li,div,ul,ol'))
            .filter(isTopLevelTextLike)
            .slice(0, 120);

          const rootRect = measureRoot.getBoundingClientRect();
          const placed: Array<{ x:number; y:number; w:number; h:number }> = [];
          for (const el of candidates) {
            const node = el as HTMLElement;
            const rect = node.getBoundingClientRect();
            const cs = window.getComputedStyle(node);

            // 너무 작은 텍스트(폰트 < 9px) 박스는 스킵
            const baseFontPx = parseFloat(cs.fontSize || '0') || 0;
            if (baseFontPx && baseFontPx < 9) continue;

            // 패딩 고려한 내부 박스 계산
            const { pl, pr, pt, pb } = getPaddingPx(cs);
            const innerWpx = Math.max(0, rect.width - (pl + pr));
            const innerHpx = Math.max(0, rect.height - (pt + pb));

            const xIn = Math.max(0, (rect.left - rootRect.left + pl) / 1280 * 10);
            const yIn = Math.max(0, (rect.top - rootRect.top + pt) / 720 * 5.625);
            const wIn = Math.max(0.2, Math.min(10, innerWpx / 1280 * 10));
            const hIn = Math.max(0.2, Math.min(5.625, innerHpx / 720 * 5.625));

            // 텍스트 콘텐츠 수집(UL/OL은 불릿으로 묶음)
            let text = '';
            let bullets: string[] | null = null;
            if (node.tagName.toLowerCase() === 'ul' || node.tagName.toLowerCase() === 'ol') {
              const lis = Array.from(node.querySelectorAll(':scope > li')) as HTMLElement[];
              bullets = lis.map((li) => (li.innerText || '').trim()).filter(Boolean);
              if (bullets.length === 0) continue;
            } else {
              text = (node.innerText || '').replace(/\s+$/g, '').slice(0, 4000);
              if (!text.trim()) continue;
            }

            const { pptFont, sizeScale } = mapFont(cs.fontFamily);
            let basePt = Math.max(6, Math.min(96, Math.round(pxToPt(cs.fontSize, 18) * sizeScale)));
            // 한쇼: 소문단 가독성 하한을 높임
            const minPt = hancomMode ? Math.max(10, Math.floor(basePt * 0.9)) : Math.max(8, Math.floor(basePt * 0.85));
            const maxPt = Math.max(minPt, Math.floor(basePt * 1.05));
            // shrink-to-fit 측정
            const fitPt = shrinkToFitPt(bullets ? bullets.join('\n') : text, cs, basePt, innerWpx, innerHpx);
            let fitPtClamped = Math.max(minPt, Math.min(maxPt, fitPt));
            const bold = (parseInt(cs.fontWeight || '400', 10) || 400) >= 700;
            const italic = cs.fontStyle === 'italic';
            let colorHex = cssColorToHex(cs.color) || '111827';
            const alignRaw = (cs.textAlign as any) || 'left';
            const align = ['left','center','right','justify'].includes(alignRaw) ? (alignRaw as any) : 'left';
            let lineSpacing = Math.max(10, Math.min(56, lineHeightToPt(cs, fitPtClamped)));

            // 한쇼 보정 적용
            const adj = adjustForHancom({ x: xIn, y: yIn, fontSize: fitPtClamped, lineSpacing });
            const xAdj = adj.x, yAdj = adj.y; const fontPtAdj = adj.fontSize; lineSpacing = adj.lineSpacing;

            // 대비 기반 색상 보정: 배경 평균 색과 대비가 더 높은 색 선택
            const scaleCanvas = 2; // html2canvas scale
            const sampleX = (rect.left - rootRect.left + pl) * scaleCanvas;
            const sampleY = (rect.top - rootRect.top + pt) * scaleCanvas;
            const sampleW = Math.max(2, innerWpx * scaleCanvas);
            const sampleH = Math.max(2, innerHpx * scaleCanvas);
            const avg = sampleAvgRGB(sampleX, sampleY, sampleW, sampleH);
            colorHex = pickContrastHex(avg, colorHex);

            // 인접 박스와 겹치면 아래로 밀어내기(최소 간격)
            let yPlace = yAdj;
            const minGap = Math.max(0.06, (fontPtAdj / 72) * 0.5); // 글자 크기 비례 간격
            const noOverlap = (a: {x:number;y:number;w:number;h:number}, b:{x:number;y:number;w:number;h:number}) => {
              return a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
            };
            let guard = 0;
            while (guard < 50) {
              const cur = { x: xAdj, y: yPlace, w: wIn, h: hIn };
              const overlap = placed.find(p => !noOverlap(cur, p));
              if (!overlap) break;
              yPlace = Math.min(5.625 - hIn, yPlace + minGap);
              guard += 1;
            }
            placed.push({ x: xAdj, y: yPlace, w: wIn, h: hIn });

            if (bullets && bullets.length) {
              slide.addText(
                bullets.map((t) => ({ text: t, options: { bullet: true } })),
                {
                  x: xAdj,
                  y: yPlace,
                  w: wIn,
                  h: hIn,
                  fontFace: pptFont,
                  fontSize: fontPtAdj,
                  bold,
                  italic,
                  color: colorHex,
                  align,
                  valign: 'top',
                  lineSpacing,
                }
              );
            } else {
              slide.addText(text, {
                x: xAdj,
                y: yPlace,
                w: wIn,
                h: hIn,
                fontFace: pptFont,
                fontSize: fontPtAdj,
                bold,
                italic,
                color: colorHex,
                align,
                valign: 'top',
                lineSpacing,
              });
            }
          }

          // Fallback: 텍스트가 거의 배치되지 않았으면 구조화하여 배치(제목/소제목/본문)
          if (placed.length < 1) {
            const titleEl = (measureRoot.querySelector('h1, h2, h3') as HTMLElement) || null;
            const subEl = (measureRoot.querySelector('p, .subtitle, small') as HTMLElement) || null;
            const paras = Array.from(measureRoot.querySelectorAll('p, li')) as HTMLElement[];

            const pickText = (el: HTMLElement | null) => (el && el.innerText ? el.innerText.trim() : '');
            const titleText = pickText(titleEl).slice(0, 120);
            const subText = pickText(subEl).slice(0, 160);
            const bodyText = paras.map(p => (p.innerText || '').trim())
                                  .filter(Boolean)
                                  .slice(0, 16)
                                  .join('\n')
                                  .slice(0, 2000);

            // 대비 색상 선택(상단 영역 기준)
            const sampleTop = sampleAvgRGB(1280 * 2 * 0.55, 720 * 2 * 0.25, 200, 120);
            let titleColor = pickContrastHex(sampleTop, '111111');
            let bodyColor = pickContrastHex(sampleTop, '111111');

            if (titleText) {
              slide.addText(titleText, {
                x: 0.7, y: 0.8, w: 8.6, h: 0.9,
                fontFace: hancomMode ? '맑은 고딕' : 'Malgun Gothic', fontSize: 36,
                bold: true, color: titleColor, align: 'left', valign: 'top', lineSpacing: 36,
              });
            }
            if (subText) {
              slide.addText(subText, {
                x: 0.7, y: 1.7, w: 8.6, h: 0.5,
                fontFace: hancomMode ? '맑은 고딕' : 'Malgun Gothic', fontSize: 20,
                color: bodyColor, align: 'left', valign: 'top', lineSpacing: 22,
              });
            }
            if (bodyText) {
              slide.addText(bodyText, {
                x: 0.7, y: 2.2, w: 8.6, h: 3.0,
                fontFace: hancomMode ? '맑은 고딕' : 'Malgun Gothic', fontSize: 18,
                color: bodyColor, align: 'left', valign: 'top', lineSpacing: 22,
              });
            }
          }
        } catch (e) {
          // 전체 폴백: 이미지 한 장
          try {
            const canvas = await html2canvas(measureRoot, {
              width: 1280,
              height: 720,
              scale: 2,
              backgroundColor: '#ffffff',
              useCORS: true,
              allowTaint: true,
              logging: false,
            });
            const img = canvas.toDataURL('image/png');
            slide.background = { data: img } as any;
          } catch {}
        } finally {
          try { document.body.removeChild(tempBg); } catch {}
          try { document.body.removeChild(tempMeasure); } catch {}
        }
      }

      const fileName = `${topic}_텍스트편집_${Date.now()}.pptx`;
      await pptx.writeFile({ fileName });
      alert('텍스트 기반 PPTX 파일이 다운로드되었습니다!\n디자인은 배경에, 텍스트/이미지는 네이티브로 배치되어 편집성이 향상되었습니다.');
    } catch (err) {
      console.error('텍스트 PPTX 다운로드 오류:', err);
      alert(err instanceof Error ? err.message : '텍스트 PPTX 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsDownloading(false);
    }
  };

  const generateSlides = async () => {
    if (!topic.trim()) {
      setError('주제를 입력해주세요.');
      return;
    }
    // 중복 실행 가드
    if (isLoading) return;

    // 이전 생성물/상태 완전 초기화
    setEditingSlideIndex(null);
    setHtmlContents([]);
    setEditedHtmlContents([]);
    setScript('');
    setCurrentSection(0);

    setIsLoading(true);
    setIsGeneratingAll(true);
    setError('');
    // 내부 결과 버퍼
    const results: string[] = new Array(fixedSlideCount).fill('');

    try {
      // 사용량 사전 체크(통합 버킷)
      try {
        const checkRes = await fetch('/api/usage/check?serviceType=productivity', { cache: 'no-store' });
        if (checkRes.status === 429) {
          const errJson = await checkRes.json().catch(() => ({}));
          const currentUsage = typeof errJson?.currentUsage === 'number' ? errJson.currentUsage : 0;
          const maxLimit = typeof errJson?.maxLimit === 'number' ? errJson.maxLimit : 0;
          const toastData = createUsageToastData('presentation-script', currentUsage, maxLimit);
          const resetText = errJson?.resetDate ? `\n재설정: ${new Date(errJson.resetDate).toLocaleString('ko-KR')}` : '';
          showToast({ type: 'error', title: `${toastData.serviceName} 한도 초과`, message: `${createUsageToastMessage(toastData)}${resetText}`, duration: 6000 });
          setIsLoading(false);
          setIsGeneratingAll(false);
          return;
        }
      } catch {}

      const apiPath = templateSet === 'Clinique Slide' ? '/api/slide-generate2' : '/api/slide-generate';

      // 1) 섹션 1 (제목) 생성
      console.log(`🎯 1번째 섹션 생성 중... (${slideTypes[0].name})`);
      setCurrentSection(1);
      const data1 = await postJsonWithRetry(apiPath, { topic, slideCount: fixedSlideCount, format: 'html', section: 1 });
      results[0] = data1.html;
      setHtmlContents([...results]);
      let scriptForAll: string = data1.script || '';
      setScript(scriptForAll);

      // 2) 섹션 2 (목차)
      console.log(`🎯 2번째 섹션 생성 중... (${slideTypes[1].name})`);
      setCurrentSection(2);
      const data2 = await postJsonWithRetry(apiPath, { topic, slideCount: fixedSlideCount, format: 'html', section: 2, script: scriptForAll });
      results[1] = data2.html;
      if (data2.script && typeof data2.script === 'string') {
        scriptForAll = data2.script;
        setScript(scriptForAll);
      }
      setHtmlContents([...results]);

      // 3) 섹션 3~12 제한 동시성(3) 큐 생성
      console.log('⚡ 섹션 3~12 제한 동시성(3) 생성 시작');
      let completed = 2;
      const sections = Array.from({ length: fixedSlideCount - 2 }, (_, i) => i + 3);
      const concurrency = 3;
      let cursor = 0;

      const runWorker = async () => {
        while (cursor < sections.length) {
          const idx = cursor;
          cursor += 1;
          const sectionNum = sections[idx];
          try {
            const data = await postJsonWithRetry(apiPath, {
              topic,
              slideCount: fixedSlideCount,
              format: 'html',
              section: sectionNum,
              script: scriptForAll,
            }, { retries: 2, timeoutMs: REQUEST_TIMEOUT_MS });
            if (data && typeof data.html === 'string') {
              results[sectionNum - 1] = data.html;
            } else {
              results[sectionNum - 1] = buildFallbackSlide(sectionNum, slideTypes[sectionNum - 1]?.name);
            }
          } catch (e) {
            console.error(`${sectionNum}번째 섹션 생성 오류(타임아웃/실패):`, e);
            results[sectionNum - 1] = buildFallbackSlide(sectionNum, slideTypes[sectionNum - 1]?.name);
          } finally {
            completed += 1;
            setCurrentSection(completed);
            setHtmlContents([...results]);
            // 과도한 부하 방지 소폭 지연
            await new Promise((r) => setTimeout(r, 150));
          }
        }
      };

      const workers = Array.from({ length: Math.min(concurrency, sections.length) }, () => runWorker());
      await Promise.all(workers);

      console.log('✅ 섹션 3~12 제한 동시성 생성 완료');
      setCurrentSection(fixedSlideCount);
      setHtmlContents([...results]);
      setEditedHtmlContents([...results]);

      // 사용량 증가(통합 productivity 카운트 차감)
      try {
        const incRes = await fetch('/api/usage/increment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serviceType: 'presentation-script' }) });
        if (incRes.ok) {
          const data = await incRes.json().catch(() => ({}));
          if (data?.usage) {
            const toastData = createUsageToastData('presentation-script', data.usage.current, data.usage.limit);
            showToast({ type: 'success', title: `${toastData.serviceName} 사용`, message: createUsageToastMessage(toastData), duration: 5000 });
          } else {
            const toastData = createUsageToastData('presentation-script', 0, 0);
            showToast({ type: 'success', title: `${toastData.serviceName} 사용`, message: createUsageToastMessage(toastData), duration: 5000 });
          }
        } else if (incRes.status === 429) {
          const errJson = await incRes.json().catch(() => ({}));
          const currentUsage = typeof errJson?.currentUsage === 'number' ? errJson.currentUsage : 0;
          const maxLimit = typeof errJson?.maxLimit === 'number' ? errJson.maxLimit : 0;
          const toastData = createUsageToastData('presentation-script', currentUsage, maxLimit);
          const resetText = errJson?.resetDate ? `\n재설정: ${new Date(errJson.resetDate).toLocaleString('ko-KR')}` : '';
          showToast({ type: 'error', title: `${toastData.serviceName} 한도 초과`, message: `${createUsageToastMessage(toastData)}${resetText}`, duration: 6000 });
        }
      } catch (e) {
        // 네트워크 오류 시 토스트는 생략
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      setIsGeneratingAll(false);
    }
  };

  const downloadAsPDF = async () => {
    if (htmlContents.length === 0) {
      alert('먼저 슬라이드를 생성해주세요.');
      return;
    }

    setIsDownloading(true);
    try {
      // 동적으로 jsPDF와 html2canvas 임포트
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      console.log(`📄 통합 PDF 생성 시작 (${htmlContents.length}개 섹션)`);
      
      // PDF 객체 생성 (A4 landscape)
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < htmlContents.length; i++) {
        console.log(`📄 섹션 ${i + 1}/${htmlContents.length} 처리 중...`);
        
        // 임시 div 생성하여 HTML 렌더링
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.width = '1280px';
        tempDiv.style.height = '720px';
        tempDiv.style.backgroundColor = 'white';
        tempDiv.innerHTML = `
          <div style="width: 1280px; height: 720px; background: white; position: relative;">
            ${cleanHtmlForPreview(htmlContents[i])}
          </div>
        `;
        
        document.body.appendChild(tempDiv);

        try {
          // HTML을 캔버스로 변환
          const canvas = await html2canvas(tempDiv, {
            width: 1280,
            height: 720,
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
            allowTaint: true,
            logging: false
          });

          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          
          // 첫 번째 페이지가 아니면 새 페이지 추가
          if (i > 0) {
            pdf.addPage();
          }
          
          // 이미지를 PDF에 추가
          pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

          console.log(`✅ 섹션 ${i + 1} 추가 완료`);
        } catch (sectionError) {
          console.error(`섹션 ${i + 1} 처리 오류:`, sectionError);
        } finally {
          // 임시 div 제거
          document.body.removeChild(tempDiv);
        }

        // 다음 섹션 처리 전 잠시 대기
        if (i < htmlContents.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // 통합 PDF 다운로드
      const fileName = `${topic}_전체슬라이드_${Date.now()}.pdf`;
      pdf.save(fileName);
      
      console.log(`✅ 통합 PDF 생성 완료: ${fileName}`);
      alert(`통합 PDF 파일이 다운로드되었습니다!\n파일명: ${fileName}`);
    } catch (err) {
      console.error('PDF 다운로드 오류:', err);
      alert(err instanceof Error ? err.message : 'PDF 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsDownloading(false);
    }
  };



  const downloadAsPPTX = async () => {
    if (htmlContents.length === 0) {
      alert('먼저 슬라이드를 생성해주세요.');
      return;
    }

    setIsDownloading(true);
    try {
      // 동적으로 pptxgenjs와 html2canvas 임포트
      const PptxGenJS = (await import('pptxgenjs')).default;
      const html2canvas = (await import('html2canvas')).default;

      console.log(`📊 통합 PPTX 생성 시작 (${htmlContents.length}개 슬라이드)`);
      
      // PowerPoint 생성
      const pptx = new PptxGenJS();
      
      // 슬라이드 크기 설정 (16:9)
      pptx.defineLayout({ 
        name: 'LAYOUT_16x9', 
        width: 10, 
        height: 5.625 
      });
      pptx.layout = 'LAYOUT_16x9';

      for (let i = 0; i < htmlContents.length; i++) {
        console.log(`📊 슬라이드 ${i + 1}/${htmlContents.length} 생성 중...`);
        
        // 슬라이드 추가
        const slide = pptx.addSlide();
        slide.background = { fill: 'FFFFFF' };
        
        // 임시 div 생성하여 HTML 렌더링
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.width = '1280px';
        tempDiv.style.height = '720px';
        tempDiv.style.backgroundColor = 'white';
        tempDiv.innerHTML = `
          <div style="width: 1280px; height: 720px; background: white; position: relative;">
            ${cleanHtmlForPreview(htmlContents[i])}
          </div>
        `;
        
        document.body.appendChild(tempDiv);

        try {
          // HTML을 캔버스로 변환
          const canvas = await html2canvas(tempDiv, {
            width: 1280,
            height: 720,
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
            allowTaint: true,
            logging: false
          });

          // 캔버스를 base64 이미지로 변환
          const imgData = canvas.toDataURL('image/png');
          
          // 이미지를 슬라이드에 추가 (전체 크기)
          slide.addImage({
            data: imgData,
            x: 0,
            y: 0,
            w: 10,
            h: 5.625
          });

          console.log(`✅ 슬라이드 ${i + 1} 추가 완료`);
        } catch (sectionError) {
          console.error(`슬라이드 ${i + 1} 처리 오류:`, sectionError);
          
          // 오류 시 텍스트만 추가
          slide.addText(`슬라이드 ${i + 1}\n\n생성 중 오류가 발생했습니다.\n원본 HTML을 확인해주세요.`, {
            x: 1,
            y: 2,
            w: 8,
            h: 2,
            fontSize: 24,
            fontFace: 'Arial',
            color: 'FF0000',
            align: 'center',
            valign: 'middle'
          });
        } finally {
          // 임시 div 제거
          document.body.removeChild(tempDiv);
        }

        // 다음 슬라이드 처리 전 잠시 대기
        if (i < htmlContents.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // PPTX 파일 다운로드
      const fileName = `${topic}_전체슬라이드_${Date.now()}.pptx`;
      await pptx.writeFile({ fileName });
      
      console.log(`✅ 통합 PPTX 생성 완료: ${fileName}`);
      alert(`통합 PPTX 파일이 다운로드되었습니다!\n파일명: ${fileName}\n\n✅ 미리보기와 100% 동일\n📊 ${htmlContents.length}개 슬라이드 포함`);
    } catch (err) {
      console.error('PPTX 다운로드 오류:', err);
      alert(err instanceof Error ? err.message : 'PPTX 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleBack = () => {
    router.push('/ppt-template');
  };

  // HTML에서 프롬프트 제거 함수 (강화)
  const cleanHtmlForPreview = (htmlContent: string) => {
    let cleanedHtml = htmlContent
      // self-closing meta 프롬프트 제거 (<meta ... />)
      .replace(/<meta\s+name=["']template-prompt["'][\s\S]*?\/>/gi, '')
      // 닫는 태그 형태 제거 (<meta ...></meta>)
      .replace(/<meta\s+name=["']template-prompt["'][\s\S]*?<\/meta>/gi, '')
      // 모든 script 태그 제거 (외부/인라인 모두)
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // 외부 스타일시트 링크 제거
      .replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi, '')
      // CSS @import 제거
      .replace(/@import\s+url\([^\)]*\)\s*;?/gi, '')
      // HTML 주석/CSS 주석/한 줄 주석 제거
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|\n)\s*\/\/.*$/gm, '');

    return cleanedHtml;
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="container mx-auto px-2 py-12 max-w-full">
        {/* 왼쪽 위 뒤로 버튼 */}
        <button 
          onClick={handleBack} 
          className="fixed top-20 left-4 z-10 flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-all text-gray-700 hover:text-gray-900 text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          뒤로
        </button>
        
        <div className="mb-2">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">AI PPT 생성기</h1>
            <p className="text-gray-600">주제를 입력하면 AI가 자동으로 프레젠테이션을 만들어드립니다</p>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-2">
          {/* 왼쪽 여백 */}
          <div className="col-span-1"></div>
          {/* 왼쪽: 입력 폼 */}
          <div className="bg-white rounded-2xl shadow-xl p-8 col-span-3">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">프레젠테이션 설정</h2>
              
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <input id="hancomMode" type="checkbox" checked={hancomMode} onChange={(e) => setHancomMode(e.target.checked)} />
                  <label htmlFor="hancomMode" className="text-sm text-gray-700">한쇼(Hancom) 보정 모드</label>
                </div>
                <div>
                  <div className="bg-gray-100 rounded-lg px-4 py-2 mb-2">
                    <label className="block text-sm font-medium text-gray-700 text-center">선택된 템플릿</label>
                  </div>
                  {/* 템플릿 미리보기 이미지 */}
                  <div className="mb-3 rounded-lg overflow-hidden border aspect-video max-w-xs mx-auto">
                    <img 
                      src={`/images/templates/${templateSet === 'Modern company' ? 'modern-company' : 'clinique-slide'}/1.${templateSet === 'Modern company' ? 'jpg' : 'png'}`}
                      alt={`${templateSet} template preview`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // 이미지 로드 실패시 다른 확장자 시도
                        const target = e.target as HTMLImageElement;
                        const currentSrc = target.src;
                        
                        if (currentSrc.includes('.jpg')) {
                          target.src = currentSrc.replace('.jpg', '.png');
                        } else if (currentSrc.includes('.png')) {
                          target.src = currentSrc.replace('.png', '.jpeg');
                        } else if (currentSrc.includes('.jpeg')) {
                          target.src = currentSrc.replace('.jpeg', '.webp');
                        } else {
                          // 모든 확장자 실패시 기본 그라디언트로 대체
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.style.background = templateSet === 'Modern company' 
                              ? 'linear-gradient(135deg, #1e3a8a, #4338ca)' 
                              : 'linear-gradient(135deg, #059669, #14b8a6)';
                            parent.style.display = 'flex';
                            parent.style.alignItems = 'center';
                            parent.style.justifyContent = 'center';
                            parent.innerHTML = `<span class="text-white font-medium">${templateSet}</span>`;
                          }
                        }
                      }}
                    />
                  </div>
                  <div className="px-3 py-2 rounded-lg border bg-gray-50 text-sm text-gray-800">{templateSet}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">주제 *</label>
                  <textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="예: AI의 미래, 기업 디지털 전환, 환경 보호 등"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={3}
                  />
                </div>



                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}

                <button
                  onClick={generateSlides}
                  disabled={isLoading || !topic.trim()}
                  className="w-full bg-black text-white py-4 px-6 rounded-lg font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
                >
                  {isLoading ? (
                    <span>
                      {currentSection}번째 슬라이드 생성 중... 
                      ({slideTypes[currentSection - 1]?.name})
                    </span>
                  ) : (
                    <span>12페이지 PPT 생성하기</span>
                  )}
                </button>

                {/* 생성 진행률 표시 */}
                {isLoading && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>진행률: {currentSection}/{fixedSlideCount}</span>
                      <span>{Math.round((currentSection / fixedSlideCount) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-black h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(currentSection / fixedSlideCount) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {false && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">액션</h3>
              </div>
            )}


          </div>

          {/* 오른쪽: HTML 미리보기 */}
          <div className="bg-gray-100 rounded-2xl shadow-xl px-4 py-8 col-span-8">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold text-gray-800 mr-1">HTML 미리보기</h2>
                {htmlContents.length > 0 && (
                  <div className="flex items-center gap-2 mr-44">
                    <button
                      onClick={downloadAsPDF}
                      disabled={isDownloading || currentSection < fixedSlideCount}
                      className="inline-flex items-center justify-center gap-2 bg-white text-black border border-gray-300 px-4 py-1.5 w-32 h-9 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-base sm:text-lg font-semibold"
                    >
                      {isDownloading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>PDF</span>
                        </>
                      ) : (
                        <span>PDF</span>
                      )}
                    </button>
                    <button
                      onClick={downloadAsPPTXText}
                      disabled={isDownloading || currentSection < fixedSlideCount}
                      className="inline-flex items-center justify-center gap-2 bg-white text-black border border-gray-300 px-4 py-1.5 w-32 h-9 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-base sm:text-lg font-semibold"
                    >
                      {isDownloading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>PPTX</span>
                        </>
                      ) : (
                        <span>PPTX</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
              {htmlContents.length > 0 ? (
                <div className="space-y-4">
                  
                  <div className="space-y-4 max-h-[800px] overflow-y-auto">
                    {htmlContents.map((content, index) => (
                      <div key={index} className="border rounded-lg overflow-hidden inline-block relative" style={{ height: '650px', minHeight: '600px', width: '1024px' }}>
                        <div className="bg-gray-100 px-4 py-1 text-sm font-medium text-gray-700 border-b flex items-center justify-between">
                          <span>{index + 1}번째 섹션</span>
                          <button
                            onClick={() => startEditingSlide(index)}
                            className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs"
                          >
                            <Edit3 size={14} />
                            세부 수정
                          </button>
                        </div>
                        <div style={{ width: '1280px', height: '720px', transform: 'scale(0.8)', transformOrigin: 'top left' }}>
                          {!(editedHtmlContents[index] || content) || (editedHtmlContents[index] || content).trim() === '' ? (
                            <div className="w-full h-full flex items-center justify-center bg-white relative" style={{ width: '1280px', height: '720px' }}>
                              <div className="relative flex items-center justify-center">
                                <div className="text-black font-bold text-5xl relative">MOA</div>
                                <div className="absolute top-16 left-1/2 -translate-x-1/2 transform text-black text-lg font-medium whitespace-nowrap">AI가 슬라이드를 제작중</div>
                                <div className="absolute w-60 h-60 border-2 border-black border-t-transparent rounded-full animate-spin flex items-center justify-center">
                                  <div className="w-48 h-48 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" style={{animationDirection: 'reverse', animationDuration: '2s'}}></div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <iframe
                              srcDoc={cleanHtmlForPreview(editedHtmlContents[index] || content)}
                              className="w-full h-full"
                              title={`Section ${index + 1} Preview`}
                              style={{ border: 'none', width: '1280px', height: '720px' }}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden inline-block" style={{ height: '650px', minHeight: '600px', width: '1024px' }}>
                  <div className="bg-gray-100 px-4 py-1 text-sm font-medium text-gray-700 border-b">
                    미리보기
                  </div>
                  <div style={{ width: '1280px', height: '720px', transform: 'scale(0.8)', transformOrigin: 'top left' }}>
                    <div className="w-full h-full bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center" style={{ width: '1280px', height: '720px' }}>
                      <div className="text-center">
                        <Wand2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500 text-lg">왼쪽에서 주제를 입력하고 PPT를 생성해보세요</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* 슬라이드 편집 모달 */}
      <SlideEditor
        isOpen={editingSlideIndex !== null}
        onClose={finishEditingSlide}
        htmlContent={editingSlideIndex !== null ? (editedHtmlContents[editingSlideIndex] || htmlContents[editingSlideIndex] || '') : ''}
        onSave={updateSlideContent}
        slideIndex={editingSlideIndex || 0}
      />
    </div>
  );
} 