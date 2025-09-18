'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Save } from 'lucide-react';
import TextEditToolbar from './TextEditToolbar';

interface SlideEditorProps {
  isOpen: boolean;
  onClose: () => void;
  htmlContent: string;
  onSave: (newHtml: string) => void;
  slideIndex: number;
}

export default function SlideEditor({ isOpen, onClose, htmlContent, onSave, slideIndex }: SlideEditorProps) {
  const [editedHtml, setEditedHtml] = useState(htmlContent);
  const [selectedText, setSelectedText] = useState('');
  const [editingElement, setEditingElement] = useState<HTMLElement | null>(null);
  const [toolbarKey, setToolbarKey] = useState(0); // 툴바 리렌더링을 위한 키
  const [isDirectEditing, setIsDirectEditing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragElement, setDragElement] = useState<HTMLElement | null>(null);
  const [dragPreview, setDragPreview] = useState<HTMLElement | null>(null);

  const previewRef = useRef<HTMLIFrameElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // 드래그 상태/요소를 최신값으로 관리하는 ref
  const isDraggingRef = useRef<boolean>(false);
  const dragElementRef = useRef<HTMLElement | null>(null);
  const dragPreviewRef = useRef<HTMLElement | null>(null);
  const dragDeltaRef = useRef<{ x: number; y: number } | null>(null);
  const dragPlaceholderRef = useRef<HTMLElement | null>(null);
  const dragSizeRef = useRef<{ width: number; height: number } | null>(null);
  const dragImageStyleRef = useRef<{ objectFit?: string; objectPosition?: string } | null>(null);
  const toolbarInteractingRef = useRef<boolean>(false);
  const toolbarInteractTimerRef = useRef<number | null>(null);

  const handleToolbarInteractStart = () => {
    toolbarInteractingRef.current = true;
    if (toolbarInteractTimerRef.current) {
      try { window.clearTimeout(toolbarInteractTimerRef.current); } catch {}
      toolbarInteractTimerRef.current = null;
    }
    // 안전장치: 상호작용이 길어져도 자동 해제
    try {
      toolbarInteractTimerRef.current = window.setTimeout(() => {
        toolbarInteractingRef.current = false;
        toolbarInteractTimerRef.current = null;
      }, 1500);
    } catch {}
  };
  const handleToolbarInteractEnd = () => {
    // 포커스 복구를 먼저 시도
    toolbarInteractingRef.current = true;
    // 툴바 상호작용 후 포커스 복구
    const iframe = previewRef.current;
    if (editingElement && iframe && iframe.contentDocument) {
      setTimeout(() => {
        try {
          editingElement.focus();
          const sel = iframe.contentDocument!.getSelection();
          if (sel) {
            const range = iframe.contentDocument!.createRange();
            range.selectNodeContents(editingElement);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        } catch {}
        // 포커스 복구가 끝난 다음에 상호작용 플래그를 해제
        toolbarInteractingRef.current = false;
        if (toolbarInteractTimerRef.current) {
          try { window.clearTimeout(toolbarInteractTimerRef.current); } catch {}
          toolbarInteractTimerRef.current = null;
        }
      }, 0);
    } else {
      // 편집 요소가 없어도 반드시 플래그 해제
      setTimeout(() => {
        toolbarInteractingRef.current = false;
        if (toolbarInteractTimerRef.current) {
          try { window.clearTimeout(toolbarInteractTimerRef.current); } catch {}
          toolbarInteractTimerRef.current = null;
        }
      }, 0);
    }
  };

  // 툴바 명령 처리 함수
  const handleToolbarCommand = (command: string, value?: string) => {
    const iframe = previewRef.current;
    if (!iframe || !iframe.contentDocument) return;

    const iframeDoc = iframe.contentDocument;

    // 선택 없이도 동작해야 하는 명령: 이미지 삽입
    if (command === 'insertImage') {
      if (!value) return;
      try {
        if (editingElement && isDirectEditing) {
          // 선택된 편집 요소 내부에 삽입 (기존 방식)
          const img = iframeDoc.createElement('img');
          img.src = value;
          img.style.maxWidth = '200px';
          img.style.maxHeight = '150px';
          img.style.objectFit = 'cover';
          editingElement.appendChild(img);
        } else {
          // 독립 이미지로 중앙 삽입 (업로드 이미지 전용 규칙)
          const slideW = 1280; const slideH = 720;
          const img = iframeDoc.createElement('img');
          img.src = value;
          img.onload = () => {
            try {
              const natW = (img as HTMLImageElement).naturalWidth || 1;
              const natH = (img as HTMLImageElement).naturalHeight || 1;
              const aspect = natW / natH;
              const maxW = 480; const maxH = 320;
              let w = maxW; let h = Math.round(maxW / aspect);
              if (h > maxH) { h = maxH; w = Math.round(maxH * aspect); }
              img.style.position = 'absolute';
              img.style.width = `${w}px`;
              img.style.height = `${h}px`;
              img.style.left = `${(slideW - w) / 2}px`;
              img.style.top = `${(slideH - h) / 2}px`;
              // 업로드 이미지는 기본적으로 contain (aspect ratio 보존)
              img.style.objectFit = 'contain';
              img.style.zIndex = '1000';
              // 업로드 이미지 마킹 → 리사이즈 규칙(코너 비율 유지, 한 축 꾸기기) 적용용
              img.setAttribute('data-keep-aspect', '1');
              iframeDoc.body.appendChild(img);

              // 드래그/리사이즈 핸들 생성
              try { (iframe.contentWindow as any).__createDragHandle?.(img); } catch {}
              try { (iframe.contentWindow as any).__createResizeHandles?.(img); } catch {}
            } catch {}
          };
        }
      } catch (e) {
        console.error('이미지 삽입 실패:', e);
      }
      setToolbarKey(prev => prev + 1);
      return;
    }

    // 그 외 명령: 선택 없으면 무시
    if (!editingElement) return;
    
    switch (command) {
      case 'bold':
        const currentWeight = editingElement.style.fontWeight;
        editingElement.style.fontWeight = (currentWeight === 'bold' || currentWeight === '700') ? 'normal' : 'bold';
        // 폰트 굵기 변경 후 다음 프레임에서 크기 재측정 (폰트 래스터 갱신 대기)
        requestAnimationFrame(() => {
          try {
            const rect = editingElement.getBoundingClientRect();
            const h = Math.round(rect.height);
            editingElement.style.height = `${h}px`;
            editingElement.style.minHeight = `${h}px`;
            editingElement.style.maxHeight = `${h}px`;
          } catch {}
        });
        break;
      case 'italic':
        editingElement.style.fontStyle = editingElement.style.fontStyle === 'italic' ? 'normal' : 'italic';
        // 폰트 기울임 변경 후 다음 프레임에서 크기 재측정 (폰트 래스터 갱신 대기)
        requestAnimationFrame(() => {
          try {
            const rect = editingElement.getBoundingClientRect();
            const h = Math.round(rect.height);
            editingElement.style.height = `${h}px`;
            editingElement.style.minHeight = `${h}px`;
            editingElement.style.maxHeight = `${h}px`;
          } catch {}
        });
        break;
      case 'underline':
        const currentDecoration = editingElement.style.textDecoration;
        if (currentDecoration.includes('underline')) {
          editingElement.style.textDecoration = currentDecoration.replace('underline', '').trim();
        } else {
          editingElement.style.textDecoration = currentDecoration ? `${currentDecoration} underline` : 'underline';
        }
        break;
      case 'strikethrough':
        const currentStrike = editingElement.style.textDecoration;
        if (currentStrike.includes('line-through')) {
          editingElement.style.textDecoration = currentStrike.replace('line-through', '').trim();
        } else {
          editingElement.style.textDecoration = currentStrike ? `${currentStrike} line-through` : 'line-through';
        }
        break;
      case 'alignLeft':
        editingElement.style.textAlign = 'left';
        break;
      case 'alignCenter':
        editingElement.style.textAlign = 'center';
        break;
      case 'alignRight':
        editingElement.style.textAlign = 'right';
        break;
      case 'fontSize':
        if (value) {
          // 1) 글자 크기 적용
          editingElement.style.fontSize = value;

          // 2) 잠금 해제하여 자연 크기로 확장되도록 허용
          editingElement.style.height = '';
          editingElement.style.minHeight = '';
          editingElement.style.maxHeight = '';
          editingElement.style.overflow = '';

          // 3) 다음 프레임에서 새 크기를 측정하고 다시 픽셀로 잠금 + 원본 스타일 갱신
          const iframeWin = iframe.contentWindow;
          requestAnimationFrame(() => {
            try {
              const rect = editingElement.getBoundingClientRect();
              const cs = iframeWin?.getComputedStyle(editingElement);
              const newWidth = cs?.width || `${rect.width}px`;
              const newHeight = cs?.height || `${rect.height}px`;

              // 높이를 새 값으로 잠금 (상하 잘림 방지)
              editingElement.style.height = newHeight;
              editingElement.style.minHeight = newHeight;
              editingElement.style.maxHeight = newHeight;
              // 가로는 기존 값 유지하되, auto로 변경된 경우 픽셀값으로 고정
              if (!editingElement.style.width || editingElement.style.width === 'auto') {
                editingElement.style.width = newWidth;
                editingElement.style.minWidth = newWidth;
                editingElement.style.maxWidth = newWidth;
              }

              // data-original-styles 갱신하여 저장/blur 시 새 크기를 유지
              const data = editingElement.getAttribute('data-original-styles');
              if (data) {
                try {
                  const original = JSON.parse(data);
                  original.width = newWidth;
                  original.height = newHeight;
                  original.minHeight = newHeight;
                  original.maxHeight = newHeight;
                  if (!original.width || original.width === 'auto') {
                    original.width = newWidth;
                    original.minWidth = newWidth;
                    original.maxWidth = newWidth;
                  }
                  editingElement.setAttribute('data-original-styles', JSON.stringify(original));
                } catch {}
              }
            } catch {}
          });
        }
        break;
      case 'fontFamily':
        if (value) editingElement.style.fontFamily = value;
        break;
      case 'textColor':
        if (value) editingElement.style.color = value;
        break;
      case 'backgroundColor':
        if (value) editingElement.style.backgroundColor = value === 'transparent' ? '' : value;
        break;
      case 'insertImage':
        if (value && editingElement) {
          const img = iframeDoc.createElement('img');
          img.src = value;
          img.style.maxWidth = '200px';
          img.style.maxHeight = '150px';
          img.style.objectFit = 'cover';
          editingElement.appendChild(img);
        }
        break;
      case 'insertLink':
        if (value && editingElement) {
          try {
            const linkData = JSON.parse(value);
            const link = iframeDoc.createElement('a');
            link.href = linkData.url;
            link.textContent = linkData.text;
            link.style.color = '#3B82F6';
            link.style.textDecoration = 'underline';
            editingElement.appendChild(link);
          } catch (e) {
            console.error('링크 삽입 실패:', e);
          }
        }
        break;
      case 'duplicate': {
        // 선택 요소 복제하여 바로 아래에 배치
        try {
          const clone = editingElement.cloneNode(true) as HTMLElement;
          // id 충돌 방지
          if (clone.id) clone.id = `${clone.id}-copy-${Date.now()}`;
          // 위치가 absolute인 경우 약간 아래로 이동
          const cs = iframe.contentWindow?.getComputedStyle(editingElement);
          if (cs?.position === 'absolute') {
            const top = parseFloat(cs.top || '0') || 0;
            const left = parseFloat(cs.left || '0') || 0;
            clone.style.position = 'absolute';
            clone.style.top = `${top + 20}px`;
            clone.style.left = `${left + 20}px`;
            clone.style.zIndex = (parseInt(cs.zIndex || '1000') + 1).toString();
          } else {
            // 흐름 레이아웃에서는 바로 뒤에 삽입
            editingElement.insertAdjacentElement('afterend', clone);
          }
          // 이미 삽입했으므로 중복 appendChild 제거
          // 새 요소를 선택 상태로 전환
          setEditingElement(clone);
          setIsDirectEditing(true);
          setToolbarKey(prev => prev + 1);
          // 드래그 핸들 재생성: iframe 로드 컨텍스트 내 함수에 접근
          try {
            (iframe.contentWindow as any).__createDragHandle?.(clone);
            (iframe.contentWindow as any).__createResizeHandles?.(clone);
          } catch {}
        } catch (e) {
          console.error('복사 실패:', e);
        }
        break;
      }
      case 'delete': {
        try {
          const toRemove = editingElement;
          setIsDirectEditing(false);
          setEditingElement(null);
          // 핸들 제거
          iframeDoc.querySelectorAll('.drag-handle').forEach(h => h.remove());
          toRemove.remove();
        } catch (e) {
          console.error('삭제 실패:', e);
        }
        break;
      }
    }
    
    // 툴바 업데이트를 위해 리렌더링 트리거
    setToolbarKey(prev => prev + 1);
  };

  // HTML 코드 초기화
  useEffect(() => {
    if (isOpen) {
      // HTML에 기본 스타일만 추가 (구조 변경 없음)
      let processedHtml = htmlContent;
      
      // body에 편집용 스타일만 주입
      processedHtml = processedHtml.replace(
        /<body([^>]*)>/i,
        `<body$1 style="margin:0;padding:0;position:relative;width:1280px;height:720px;overflow:hidden;">`
      );
      
      setEditedHtml(processedHtml);
      setSelectedText('');
      setIsDirectEditing(false);
      setEditingElement(null);
    }
  }, [isOpen, htmlContent]);

  // 미리보기에서 직접 편집 기능
  useEffect(() => {
    const iframe = previewRef.current;
    if (!iframe || !isOpen) return;

    const handleIframeLoad = () => {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) return;

      // 공통 스케일 계산 함수
      const getScale = () => {
        if (!previewRef.current) return 1;
        return previewRef.current.getBoundingClientRect().width / 1280;
      };

      // 좌표 변환 함수
      const toRootXY = (e: PointerEvent) => {
        const scale = getScale();
        const iframeRect = iframe.getBoundingClientRect();
        const iframeWin = iframe.contentWindow!;
        const root = iframeDoc.body;
        const rootRect = root.getBoundingClientRect();
        
        const x = (e.clientX - iframeRect.left) / scale + iframeWin.scrollX - (rootRect.left + iframeWin.scrollX);
        const y = (e.clientY - iframeRect.top) / scale + iframeWin.scrollY - (rootRect.top + iframeWin.scrollY);
        
        return { x, y };
      };

      // 드래그 핸들 생성 함수
      const createDragHandle = (element: HTMLElement) => {
        // 기존 핸들 제거
        const existingHandles = iframeDoc.querySelectorAll('.drag-handle');
        existingHandles.forEach(handle => handle.remove());
        
        // 루트 컨테이너 확보
        const root = iframeDoc.body;
        
        // 드래그 핸들 생성 시에는 position 변경하지 않음 (레이아웃 보전)
        
        // 드래그 핸들 생성
        const handle = iframeDoc.createElement('div');
        handle.className = 'drag-handle';
        
        const elementRect = element.getBoundingClientRect();
        const rootRect = root.getBoundingClientRect();
        const iframeWin = iframe.contentWindow!;
        
        // 요소 상단 중앙에 핸들 위치 (요소 내부 10px 아래 지점에 표시하여 항상 보이도록)
        const handleLeft = (elementRect.left - rootRect.left) + (elementRect.width / 2) - 6 + iframeWin.scrollX;
        const handleTop = (elementRect.top - rootRect.top) + 10 + iframeWin.scrollY;
        
                 handle.style.cssText = `
           position: absolute;
           left: ${handleLeft}px;
           top: ${handleTop}px;
           width: 12px;
           height: 12px;
           background: #3B82F6;
           border: 2px solid white;
           border-radius: 50%;
           cursor: move;
           pointer-events: auto;
           box-shadow: 0 2px 4px rgba(0,0,0,0.3);
           z-index: 1002;
         `;
        
        // 드래그 시작 이벤트 (Pointer Events 사용)
        handle.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Pointer 캡처
          (e.target as Element).setPointerCapture(e.pointerId);
          
          console.log('드래그 시작');
          setIsDragging(true);
          isDraggingRef.current = true;
          setDragElement(element);
          dragElementRef.current = element;
          
          // 드래그 중에만 z-index 임시 상승 (클래스로 처리)
          element.classList.add('drag-elevated');
          // 드래그 시작 시 요소 렌더링 크기와 이미지 렌더링 속성 보존
          try {
            const elRect = element.getBoundingClientRect();
            dragSizeRef.current = { width: elRect.width, height: elRect.height };
            const cs = iframe.contentWindow?.getComputedStyle(element);
            if (element.tagName.toLowerCase() === 'img' && cs) {
              dragImageStyleRef.current = {
                objectFit: cs.objectFit || undefined,
                objectPosition: cs.objectPosition || undefined,
              };
            } else {
              dragImageStyleRef.current = null;
            }
          } catch {}
          
          // 원래 자리에 레이아웃 유지용 placeholder 삽입 (absolute/fixed 요소는 스킵)
          try {
            const comp = iframe.contentWindow?.getComputedStyle(element);
            const isAbs = comp?.position === 'absolute' || comp?.position === 'fixed';
            
            if (!isAbs) {
              const elRectForPlaceholder = element.getBoundingClientRect();
              const placeholder = iframeDoc.createElement('div');
              placeholder.className = 'drag-placeholder';
              
              // 원본 요소의 모든 스타일 복사 (크기, 여백, 패딩 등)
              if (comp) {
                placeholder.style.width = comp.width;
                placeholder.style.height = comp.height;
                placeholder.style.margin = comp.margin;
                placeholder.style.padding = comp.padding;
                placeholder.style.border = comp.border;
                // inline 요소는 inline-block으로 보정 (width/height 적용되도록)
                const display = comp.display;
                placeholder.style.display = (display === 'inline') ? 'inline-block' : display;
                placeholder.style.float = comp.float;
                placeholder.style.position = comp.position;
                placeholder.style.boxSizing = comp.boxSizing;
              }
              
              placeholder.style.visibility = 'hidden';
              placeholder.style.pointerEvents = 'none';
              placeholder.style.opacity = '0';
              element.parentElement?.insertBefore(placeholder, element);
              dragPlaceholderRef.current = placeholder;
            } else {
              dragPlaceholderRef.current = null; // absolute/fixed 요소는 스킵
            }
            
            // 드래그 중 원본 요소는 완전히 숨김 (미리보기와 겹침 방지)
            element.style.visibility = 'hidden';
          } catch {}

          // 초록색 미리보기 생성 (빈 박스 형태)
          const preview = iframeDoc.createElement('div');
          preview.className = 'drag-preview';
          
          // 현재 요소의 루트 기준 위치 계산 (getBoundingClientRect 사용)
          const elementRect = element.getBoundingClientRect();
          const rootRect = root.getBoundingClientRect();
          const iframeWin = iframe.contentWindow!;
          
          const currentLeft = elementRect.left - rootRect.left + iframeWin.scrollX;
          const currentTop = elementRect.top - rootRect.top + iframeWin.scrollY;
          // 시작 포인터 위치와 요소 좌상단 차이 저장
          const startPos = toRootXY(e as unknown as PointerEvent);
          dragDeltaRef.current = { x: startPos.x - currentLeft, y: startPos.y - currentTop };
          
          preview.style.cssText = `
            position: absolute;
            left: ${currentLeft}px;
            top: ${currentTop}px;
            width: ${elementRect.width}px;
            height: ${elementRect.height}px;
            background: rgba(34, 197, 94, 0.2);
            border: 2px dashed #22C55E;
            pointer-events: none;
            z-index: 1001;
            opacity: 0.8;
            box-sizing: border-box;
          `;
          
          // 미리보기 박스 내용 완전히 비우기
          preview.innerHTML = '';
          preview.textContent = '';
          
          // 미리보기도 body에 직접 append (일관된 좌표계 사용)
          iframeDoc.body.appendChild(preview);
          setDragPreview(preview);
          dragPreviewRef.current = preview;
        });
        
        // 핸들도 body에 직접 append (일관된 좌표계 사용)
        iframeDoc.body.appendChild(handle);
        return handle;
      };

      // 외부에서 접근할 수 있도록 window에 노출 (복사 후 핸들 재생성 용도)
      try { (iframe.contentWindow as any).__createDragHandle = createDragHandle; } catch {}

      // 리사이즈 핸들 생성 함수 (사이드/코너 하얀 점)
      const createResizeHandles = (element: HTMLElement) => {
        // 기존 리사이즈 핸들 제거
        Array.from(iframeDoc.querySelectorAll('.resize-handle')).forEach(h => {
          try { h.remove(); } catch {}
        });

        const root = iframeDoc.body;
        const rect = element.getBoundingClientRect();
        const rootRect = root.getBoundingClientRect();
        const iframeWin = iframe.contentWindow!;
        const baseLeft = rect.left - rootRect.left + iframeWin.scrollX;
        const baseTop = rect.top - rootRect.top + iframeWin.scrollY;

        const positions: Array<{ name: string; x: number; y: number; cursor: string }> = [
          { name: 'n',  x: 0.5, y: 0,   cursor: 'ns-resize' },
          { name: 's',  x: 0.5, y: 1,   cursor: 'ns-resize' },
          { name: 'w',  x: 0,   y: 0.5, cursor: 'ew-resize' },
          { name: 'e',  x: 1,   y: 0.5, cursor: 'ew-resize' },
          { name: 'nw', x: 0,   y: 0,   cursor: 'nwse-resize' },
          { name: 'ne', x: 1,   y: 0,   cursor: 'nesw-resize' },
          { name: 'sw', x: 0,   y: 1,   cursor: 'nesw-resize' },
          { name: 'se', x: 1,   y: 1,   cursor: 'nwse-resize' },
        ];

        positions.forEach(p => {
          const h = iframeDoc.createElement('div');
          h.className = `resize-handle handle-${p.name}`;
          h.style.cssText = `
            position:absolute; width:10px; height:10px; background:#fff; border:1.5px solid #4B5563; border-radius:50%;
            left:${baseLeft + p.x * rect.width - 5}px; top:${baseTop + p.y * rect.height - 5}px; cursor:${p.cursor}; z-index:1003; pointer-events:auto;`;

          // 리사이즈 드래그 로직
          let start = { x: 0, y: 0, left: 0, top: 0, width: 0, height: 0 };
          let isResizing = false;
          // 업로드 이미지 전용 비율 유지 플래그
          const preserveAspect = element.tagName.toLowerCase() === 'img' && (element.getAttribute('data-keep-aspect') === '1');
          let imgAspect = 1;
          
          const onDown = (e: PointerEvent) => {
            e.preventDefault(); e.stopPropagation();
            (e.target as Element).setPointerCapture(e.pointerId);
            isResizing = true;
            
            // 리사이즈 중에만 전역 리스너 등록
            const move = onMove as any, up = onUp as any;
            iframeDoc.addEventListener('pointermove', move);
            iframeDoc.addEventListener('pointerup', up, { once: true });
            iframeDoc.addEventListener('pointercancel', up, { once: true });
            const r = element.getBoundingClientRect();
            const rr = root.getBoundingClientRect();
            const win = iframe.contentWindow!;
            start = {
              x: e.clientX, y: e.clientY,
              left: r.left - rr.left + win.scrollX,
              top: r.top - rr.top + win.scrollY,
              width: r.width, height: r.height,
            };

            // 업로드 이미지면 원본 비율 저장
            if (preserveAspect) {
              try {
                const img = element as HTMLImageElement;
                const natW = img.naturalWidth || start.width || 1;
                const natH = img.naturalHeight || start.height || 1;
                imgAspect = natW / natH;
                // 기본은 fill (꾸기기 허용)
                img.style.objectFit = 'fill';
              } catch { imgAspect = start.width && start.height ? start.width / start.height : 1; }
            }
          };
          
          const onMove = (e: PointerEvent) => {
            if (!start.width || !isResizing) return;
            const scale = getScale(); // 동적 스케일 사용
            const dx = (e.clientX - start.x) / scale;
            const dy = (e.clientY - start.y) / scale;
            let newLeft = start.left; let newTop = start.top;
            let newW = start.width; let newH = start.height;
            
            if (p.name.includes('e')) newW = Math.max(20, start.width + dx);
            if (p.name.includes('s')) newH = Math.max(20, start.height + dy);
            if (p.name.includes('w')) { newW = Math.max(20, start.width - dx); newLeft = start.left + dx; }
            if (p.name.includes('n')) { newH = Math.max(20, start.height - dy); newTop = start.top + dy; }

            // 업로드 이미지는: 코너 비율 유지, 한 축만은 꾸기기
            if (preserveAspect) {
              const isHorizontalOnly = (p.name === 'e' || p.name === 'w');
              const isVerticalOnly = (p.name === 'n' || p.name === 's');
              const isCorner = !isHorizontalOnly && !isVerticalOnly;
              if (isCorner) {
                const scaleW = newW / start.width;
                const scaleH = newH / start.height;
                if (Math.abs(scaleW - 1) >= Math.abs(scaleH - 1)) {
                  newH = Math.max(20, newW / imgAspect);
                } else {
                  newW = Math.max(20, newH * imgAspect);
                }
                if (p.name.includes('w')) { newLeft = start.left + (start.width - newW); }
                if (p.name.includes('n')) { newTop = start.top + (start.height - newH); }
              } else if (isHorizontalOnly) {
                newH = start.height; // 가로만 꾸기기
                if (p.name.includes('w')) { newLeft = start.left + (start.width - newW); }
              } else if (isVerticalOnly) {
                newW = start.width; // 세로만 꾸기기
                if (p.name.includes('n')) { newTop = start.top + (start.height - newH); }
              }
            }

            element.style.position = 'absolute';
            element.style.left = `${newLeft}px`;
            element.style.top = `${newTop}px`;
            element.style.width = `${newW}px`;
            element.style.minWidth = `${newW}px`;
            element.style.maxWidth = `${newW}px`;
            element.style.height = `${newH}px`;
            element.style.minHeight = `${newH}px`;
            element.style.maxHeight = `${newH}px`;

            // 핸들 위치만 업데이트 (중복 생성 방지)
            const currentRect = element.getBoundingClientRect();
            const currentBaseLeft = currentRect.left - rootRect.left + iframeWin.scrollX;
            const currentBaseTop = currentRect.top - rootRect.top + iframeWin.scrollY;
            
            // 리사이즈 핸들 위치 업데이트
            Array.from(iframeDoc.querySelectorAll('.resize-handle')).forEach((handle, index) => {
              const pos = positions[index];
              if (pos) {
                (handle as HTMLElement).style.left = `${currentBaseLeft + pos.x * currentRect.width - 5}px`;
                (handle as HTMLElement).style.top = `${currentBaseTop + pos.y * currentRect.height - 5}px`;
              }
            });
            
            // 드래그 핸들 위치도 함께 업데이트
            const dragHandle = iframeDoc.querySelector('.drag-handle') as HTMLElement;
            if (dragHandle) {
              dragHandle.style.left = `${currentBaseLeft + currentRect.width / 2 - 6}px`;
              dragHandle.style.top = `${currentBaseTop + currentRect.height / 2 - 6}px`;
            }
          };
          
          const onUp = () => {
            isResizing = false;
            // 전역 리스너 제거 (once 옵션으로 pointerup/cancel은 자동 해제)
            iframeDoc.removeEventListener('pointermove', onMove as any);
            // data-original-styles 갱신
            try {
              const data = element.getAttribute('data-original-styles');
              if (data) {
                const o = JSON.parse(data);
                o.width = element.style.width;
                o.height = element.style.height;
                o.minWidth = element.style.minWidth;
                o.minHeight = element.style.minHeight;
                o.maxWidth = element.style.maxWidth;
                o.maxHeight = element.style.maxHeight;
                element.setAttribute('data-original-styles', JSON.stringify(o));
              }
            } catch {}
            
            // 리사이즈 완료 후 드래그 핸들 위치 최종 업데이트
            try {
              const finalRect = element.getBoundingClientRect();
              const finalBaseLeft = finalRect.left - rootRect.left + iframeWin.scrollX;
              const finalBaseTop = finalRect.top - rootRect.top + iframeWin.scrollY;
              
              const dragHandle = iframeDoc.querySelector('.drag-handle') as HTMLElement;
              if (dragHandle) {
                dragHandle.style.left = `${finalBaseLeft + finalRect.width / 2 - 6}px`;
                dragHandle.style.top = `${finalBaseTop + finalRect.height / 2 - 6}px`;
              }
            } catch {}
            
            start = { x: 0, y: 0, left: 0, top: 0, width: 0, height: 0 };
          };
          
          h.addEventListener('pointerdown', onDown as any);
          // pointermove/up은 onDown에서 등록, onUp에서 해제

          iframeDoc.body.appendChild(h);
        });
      };

      // 외부에서 접근하도록 노출
      try { (iframe.contentWindow as any).__createResizeHandles = createResizeHandles; } catch {}

      // SVG <text> 인라인 편집 오버레이 생성 함수 (flowchart 전용)
      const editSvgTextInline = (textEl: SVGTextElement) => {
        try {
          const root = iframeDoc.body;
          const rect = textEl.getBoundingClientRect();
          const rootRect = root.getBoundingClientRect();
          const iframeWin = iframe.contentWindow!;
          const left = rect.left - rootRect.left + iframeWin.scrollX;
          const top = rect.top - rootRect.top + iframeWin.scrollY - 6; // 약간 위로 보정
          const width = Math.max(rect.width + 20, 120);

          // 기존 편집기 제거
          Array.from(iframeDoc.querySelectorAll('.svg-text-editor')).forEach(n => n.remove());

          const input = iframeDoc.createElement('input');
          input.className = 'svg-text-editor';
          input.type = 'text';
          input.value = (textEl.textContent || '').trim();
          input.style.cssText = `
            position: absolute;
            left: ${left}px;
            top: ${top}px;
            width: ${width}px;
            height: 28px;
            padding: 4px 8px;
            font-size: 14px;
            font-family: 'Noto Sans KR', sans-serif;
            line-height: 1.2;
            color: #000;
            background: #fff;
            border: 1px solid #3B82F6;
            border-radius: 4px;
            z-index: 1100;
          `;

          const commit = () => {
            const v = input.value;
            textEl.textContent = v;
            input.remove();
          };

          input.addEventListener('keydown', (ev: KeyboardEvent) => {
            if (ev.key === 'Enter') {
              ev.preventDefault();
              commit();
            } else if (ev.key === 'Escape') {
              ev.preventDefault();
              input.remove();
            }
          });
          input.addEventListener('blur', () => commit());

          iframeDoc.body.appendChild(input);
          input.focus();
          input.select();
        } catch {}
      };

      // 편집 가능한 텍스트 요소만 선택 (leaf 노드 + 텍스트 콘텐츠가 있는 div 포함)
      const candidates = iframeDoc.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,li,td,th,div');
      const textElements = Array.from(candidates).filter(el => {
        const textContent = (el.textContent || '').trim();
        if (!textContent) return false;
        
        // leaf 노드이거나, div인 경우 직접적인 텍스트 콘텐츠가 있는 경우만
        if (el.childElementCount === 0) return true;
        
        // div의 경우: 자식이 있더라도 직접적인 텍스트 노드가 있으면 편집 가능
        if (el.tagName.toLowerCase() === 'div') {
          const directTextNodes = Array.from(el.childNodes).filter(
            node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
          );
          return directTextNodes.length > 0;
        }
        
        return false;
      });
      
      // 폰트 로드 후 텍스트 크기를 한 번만 잠그기
      const lockInitialSizes = async () => {
        try { 
          await (iframeDoc as any).fonts?.ready; 
        } catch {}
        
        // 텍스트 후보에서 리스트/표 제외 (li, ul, ol, table, td, th 제외)
        const textCandidates = iframeDoc.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,div');
        const textElements = Array.from(textCandidates).filter(el => {
          const textContent = (el.textContent || '').trim();
          if (!textContent) return false;
          
          // leaf 노드이거나, div인 경우 직접적인 텍스트 콘텐츠가 있는 경우만
          if (el.childElementCount === 0) return true;
          
          if (el.tagName.toLowerCase() === 'div') {
            const directTextNodes = Array.from(el.childNodes).filter(
              node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
            );
            return directTextNodes.length > 0;
          }
          
          return false;
        });
        
        textElements.forEach(el => {
          const element = el as HTMLElement;
          // 이미 잠겨있으면 스킵
          if (element.getAttribute('data-initial-size-lock') === '1') return;
          
          try {
            const rect = element.getBoundingClientRect();
            element.setAttribute('data-initial-size-lock', '1');
            
            // width는 즉시 픽셀 고정
            element.style.width = `${Math.round(rect.width)}px`;
            
            // height는 rAF 한 프레임 뒤 실제 줄바꿈 반영값으로 고정
            element.style.height = '';
            requestAnimationFrame(() => {
              element.style.height = `${Math.round(element.getBoundingClientRect().height)}px`;
            });
          } catch {}
        });
        
        // 도형은 box-model 건드리지 않고 크기만 픽셀로 스냅
        const shapeSelector = '.circle,.gauge-container,.gauge,.gauge-background,.gauge-fill,.chart-container,.image-side,.footer,.arch,.arch-1,.arch-2,.arch-3,.arch-visual,.regulation-visual,div[style*="border-radius"][style*="background"],div[style*="border-radius: 50%"],div[class*="circle"],div[class*="round"],div[class*="arch"]';
        const shapeElements = iframeDoc.querySelectorAll(shapeSelector);
        
        shapeElements.forEach(el => {
          const shapeEl = el as HTMLElement;
          if (shapeEl.getAttribute('data-shape-size-lock') === '1') return;
          
          try {
            const rect = shapeEl.getBoundingClientRect();
            shapeEl.setAttribute('data-shape-size-lock', '1');
            
            // 크기만 픽셀로 스냅, box-model은 원래 값 유지
            shapeEl.style.width = `${Math.round(rect.width)}px`;
            shapeEl.style.height = `${Math.round(rect.height)}px`;
            // boxSizing/margin/whiteSpace 등은 설정하지 않음(원래 값 유지)
          } catch {}
        });
      };
      
      // 모든 편집 대상 요소를 absolute+px 기반으로 초기화 (세부수정 진입 시 전체 편집 모드)
      const lockAllElementsAbsolute = () => {
        try {
          const iframeWin = iframe.contentWindow!;
          const root = iframeDoc.body;
          
          // 편집 대상: 텍스트 요소 + 이미지 + 도형 (리스트/표 제외)
          const textSelector = 'h1,h2,h3,h4,h5,h6,p,span,div';
          const visualSelector = 'img,svg,figure,canvas,.circle,.gauge-container,.gauge,.gauge-background,.gauge-fill,.chart-container,.image-side,.footer,.arch,.arch-1,.arch-2,.arch-3,.arch-visual,.regulation-visual,rect,polygon,line,text,div[style*="border-radius"][style*="background"],div[style*="border-radius: 50%"],div[class*="circle"],div[class*="round"],div[class*="arch"]';
          
          // 텍스트 요소 처리
          const textElements = Array.from(iframeDoc.querySelectorAll(textSelector)).filter(el => {
            const textContent = (el.textContent || '').trim();
            if (!textContent) return false;
            
            // leaf 노드이거나, div인 경우 직접적인 텍스트 콘텐츠가 있는 경우만
            if (el.childElementCount === 0) return true;
            
            if (el.tagName.toLowerCase() === 'div') {
              const directTextNodes = Array.from(el.childNodes).filter(
                node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
              );
              return directTextNodes.length > 0;
            }
            
            return false;
          });
          
          // 비주얼 요소 처리
          const visualElements = Array.from(iframeDoc.querySelectorAll(visualSelector)).filter(el => {
            // 슬라이드 컨테이너 자체는 제외
            if ((el as HTMLElement).classList.contains('slide-container')) return false;
            // 이미 absolute인 요소는 제외 (사용자가 추가한 요소들)
            const cs = iframeWin.getComputedStyle(el as HTMLElement);
            if (cs.position === 'absolute') return false;
            return true;
          });
          
          // 모든 대상 요소를 absolute로 변환
          const allElements = [...textElements, ...visualElements] as HTMLElement[];
          
          allElements.forEach(element => {
            // 이미 처리된 요소는 스킵
            if (element.getAttribute('data-absolute-locked') === '1') return;
            
            try {
              const rect = element.getBoundingClientRect();
              const cs = iframeWin.getComputedStyle(element);
              
              // 유효한 크기인지 확인
              if (rect.width < 1 || rect.height < 1) return;
              
              // 가장 가까운 position 지정 조상 찾기
              const findPositionedAncestor = (el: HTMLElement): HTMLElement => {
                let ancestor: HTMLElement | null = el.parentElement as HTMLElement;
                while (ancestor && ancestor !== root) {
                  const ancestorCs = iframeWin.getComputedStyle(ancestor);
                  if (ancestorCs.position !== 'static') return ancestor;
                  ancestor = ancestor.parentElement as HTMLElement;
                }
                return root; // 못 찾으면 body
              };
              
              const ancestor = findPositionedAncestor(element);
              const ancestorRect = ancestor.getBoundingClientRect();
              
              // 조상 padding과 내 margin 값 추출
              const acs = iframeWin.getComputedStyle(ancestor);
              const padL = parseFloat(acs.paddingLeft || '0') || 0;
              const padT = parseFloat(acs.paddingTop || '0') || 0;
              
              const mL = parseFloat(cs.marginLeft || '0') || 0;
              const mT = parseFloat(cs.marginTop || '0') || 0;
              
              // 조상 padding + 내 margin 보정 모두 반영
              const left = rect.left - ancestorRect.left - padL + iframeWin.scrollX - mL;
              const top = rect.top - ancestorRect.top - padT + iframeWin.scrollY - mT;
              
              // 원본 스타일 백업
              const originalStyles = {
                position: cs.position,
                left: cs.left,
                top: cs.top,
                width: cs.width,
                height: cs.height,
                margin: cs.margin,
                boxSizing: cs.boxSizing,
                whiteSpace: cs.whiteSpace
              };
              element.setAttribute('data-absolute-original-styles', JSON.stringify(originalStyles));
              element.setAttribute('data-absolute-locked', '1');
              
              // absolute 변환 (부모는 그대로, 좌표만 조상 기준으로 고정)
              element.style.position = 'absolute';
              element.style.left = `${Math.floor(left)}px`;  // floor로 통일
              element.style.top = `${Math.floor(top)}px`;    // floor로 통일
              element.style.margin = '0'; // 이제 좌표를 보정했으니 0으로 바꿔도 위치가 안 틀어짐
              element.style.width = `${Math.round(rect.width)}px`;   // round로 통일
              element.style.height = `${Math.round(rect.height)}px`; // round로 통일
              
            } catch (e) {
              console.warn('요소 absolute 변환 실패:', e, element);
            }
          });
          
          console.log(`전체 편집 모드: ${allElements.length}개 요소를 absolute로 변환 완료`);
          
        } catch (e) {
          console.error('lockAllElementsAbsolute 실패:', e);
        }
      };
      
      // 폰트 로딩과 동기화된 순서로 실행
      const initializeElements = async () => {
        try {
          await lockInitialSizes();
          await new Promise(requestAnimationFrame); // 한 프레임 대기
          lockAllElementsAbsolute();
        } catch (e) {
          console.error('요소 초기화 실패:', e);
        }
      };
      
      initializeElements();
      
      // 이벤트 위임으로 중복 등록 방지
      const handleBodyClick = (e: Event) => {
        // 툴바 클릭으로 발생한 이벤트는 무시하여 편집 상태 유지
        if (toolbarInteractingRef.current) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        // 드래그 중에는 클릭 편집 진입 금지 (ref 기준)
        if (isDraggingRef.current) return;
        const target = (e.target as HTMLElement).closest('h1,h2,h3,h4,h5,h6,p,span,li,td,th,div');
        if (!target) return;
        
        const textContent = (target.textContent || '').trim();
        if (!textContent) return;
        
        // leaf 노드이거나, div인 경우 직접적인 텍스트 콘텐츠가 있는 경우만
        let isEditable = false;
        if (target.childElementCount === 0) {
          isEditable = true;
        } else if (target.tagName.toLowerCase() === 'div') {
          const directTextNodes = Array.from(target.childNodes).filter(
            node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
          );
          isEditable = directTextNodes.length > 0;
        }
        
        if (!isEditable) return;
        
        const htmlElement = target as HTMLElement;
        e.preventDefault();
        e.stopPropagation();
        
        // 이미 편집 중인 다른 요소가 있다면 편집 완료
        if (editingElement && editingElement !== htmlElement && isDirectEditing) {
          editingElement.blur();
        }
        
        const originalText = htmlElement.textContent || '';
        if (originalText.trim() && !isDirectEditing) {
          // 직접 편집 모드 활성화
          setIsDirectEditing(true);
          setEditingElement(htmlElement);
          setSelectedText(originalText.trim());
          setToolbarKey(prev => prev + 1); // 툴바 리렌더링

          
          // 원본 요소의 크기와 위치를 정확히 측정하여 보존
          const originalRect = htmlElement.getBoundingClientRect();
          const computedStyle = iframe.contentWindow?.getComputedStyle(htmlElement);
          const originalStyles = {
            width: computedStyle?.width || 'auto',
            height: computedStyle?.height || 'auto',
            minWidth: computedStyle?.minWidth || 'auto',
            minHeight: computedStyle?.minHeight || 'auto',
            maxWidth: computedStyle?.maxWidth || 'none',
            maxHeight: computedStyle?.maxHeight || 'none',
            boxSizing: computedStyle?.boxSizing || 'content-box',
            padding: computedStyle?.padding || '0',
            margin: computedStyle?.margin || '0',
            border: computedStyle?.border || 'none',
            lineHeight: computedStyle?.lineHeight || 'normal',
            fontSize: computedStyle?.fontSize || 'inherit',
            fontFamily: computedStyle?.fontFamily || 'inherit'
          };
          // 현재 사용자 배경색을 별도 속성으로 저장하여 복원/유지에 활용
          try {
            (originalStyles as any).backgroundColor = computedStyle?.backgroundColor || '';
          } catch {}
          
          // 요소를 편집 가능하게 만들기 (레이아웃 보전)
          htmlElement.contentEditable = 'true';
          
          // 도형 안의 텍스트인지 확인 (배경색이 있는 부모 요소가 있는지 체크)
          let isInsideShape = false;
          let parentElement = htmlElement.parentElement;
          while (parentElement && parentElement !== iframeDoc.body) {
            const parentStyle = iframe.contentWindow?.getComputedStyle(parentElement);
            if (parentStyle && parentStyle.backgroundColor && parentStyle.backgroundColor !== 'rgba(0, 0, 0, 0)') {
              isInsideShape = true;
              break;
            }
            parentElement = parentElement.parentElement;
          }
          
          // 원본 크기를 픽셀 단위로 고정하여 레이아웃 변경 방지
          // width는 픽셀로 고정
          htmlElement.style.width = `${originalRect.width}px`;
          
          // 높이는 당장 잠그지 말고 다음 프레임에서 자연 높이로만 픽셀 고정
          htmlElement.style.height = '';
          htmlElement.style.minHeight = '';
          htmlElement.style.maxHeight = '';
          htmlElement.style.minWidth = '';
          htmlElement.style.maxWidth = '';
          htmlElement.style.overflow = '';      // 강제 해제
          htmlElement.style.whiteSpace = '';    // 강제 해제
          htmlElement.style.boxSizing = '';     // 강제 해제
          (htmlElement.style as any).wordWrap = ''; // 강제 해제
          
          requestAnimationFrame(() => {
            const h = Math.round(htmlElement.getBoundingClientRect().height);
            htmlElement.style.height = `${h}px`;
            htmlElement.style.minHeight = `${h}px`;
            htmlElement.style.maxHeight = `${h}px`;
          });
          
          // 도형 안의 텍스트가 아닌 경우에도 배경색은 변경하지 않음 (사용자 배경색 보존)
          if (!isInsideShape) {
            htmlElement.style.outline = '2px solid #3B82F6';
            htmlElement.style.outlineOffset = '0px';
          } else {
            // 도형 안의 텍스트는 최소한의 편집 표시만
            htmlElement.style.outline = '1px dashed #3B82F6';
            htmlElement.style.outlineOffset = '0px';
          }
          
          htmlElement.style.zIndex = '999';
          // position 변경 완전 제거 - 레이아웃 변경 방지
          
          // 원본 스타일을 data 속성으로 저장 (복원용)
          htmlElement.setAttribute('data-original-styles', JSON.stringify(originalStyles));
          
          // 드래그 핸들 생성
          setTimeout(() => {
            createDragHandle(htmlElement);
            try { (iframe.contentWindow as any).__createResizeHandles?.(htmlElement); } catch {}
          }, 100);
          
          // 포커스 및 텍스트 선택
          setTimeout(() => {
            htmlElement.focus();
            
            // 텍스트 전체 선택
            const selection = iframeDoc.getSelection();
            const range = iframeDoc.createRange();
            range.selectNodeContents(htmlElement);
            selection?.removeAllRanges();
            selection?.addRange(range);
          }, 50);
        }
      };

      const handleBodyBlur = (e: Event) => {
        // 툴바와 상호작용 중이면 blur 무시 (완전히 해제되기 전까지)
        if (toolbarInteractingRef.current) {
          e.preventDefault?.();
          e.stopPropagation?.();
          return;
        }
        const target = e.target as HTMLElement;
        if (target.contentEditable === 'true') {
          const newText = target.textContent || '';
          
          console.log('blur 이벤트 - 텍스트 변경:', {
            original: selectedText,
            new: newText,
            changed: newText !== selectedText
          });
          
          // 텍스트 변경 시 selectedText만 업데이트 (HTML 재주입 금지)
          if (newText !== selectedText && selectedText) {
            setSelectedText(newText);
            console.log('텍스트 변경됨:', { from: selectedText, to: newText });
          }
          
          // 편집 모드 해제 및 원본 스타일 복원
          target.contentEditable = 'false';
          
          // 저장된 원본 스타일 복원 (텍스트 서식은 유지). 배경색은 '사용자 설정 우선' 정책 적용
          const originalStylesData = target.getAttribute('data-original-styles');
          if (originalStylesData) {
            try {
              const originalStyles = JSON.parse(originalStylesData);
              target.style.width = originalStyles.width;
              target.style.height = originalStyles.height;
              target.style.minWidth = originalStyles.minWidth;
              target.style.minHeight = originalStyles.minHeight;
              target.style.maxWidth = originalStyles.maxWidth;
              target.style.maxHeight = originalStyles.maxHeight;
              target.style.boxSizing = originalStyles.boxSizing;
              target.style.padding = originalStyles.padding;
              target.style.margin = originalStyles.margin;
              target.style.border = originalStyles.border;
              target.style.overflow = '';
              target.style.wordWrap = '';
              target.style.whiteSpace = '';
              target.removeAttribute('data-original-styles');
              // 만약 편집 중 임시 색상(class 등)으로 덮은 이력이 있으면 제거
              if ((target as HTMLElement).classList.contains('editing-bg')) {
                (target as HTMLElement).classList.remove('editing-bg');
              }
            } catch (e) {
              console.warn('원본 스타일 복원 실패:', e);
              // fallback으로 기본 초기화
              target.style.width = '';
              target.style.height = '';
              target.style.minWidth = '';
              target.style.minHeight = '';
              target.style.maxWidth = '';
              target.style.maxHeight = '';
              target.style.boxSizing = '';
              target.style.overflow = '';
              target.style.wordWrap = '';
              target.style.whiteSpace = '';
            }
          } else {
            // 원본 스타일 정보가 없는 경우 기본 초기화
            target.style.width = '';
            target.style.height = '';
            target.style.minWidth = '';
            target.style.minHeight = '';
            target.style.maxWidth = '';
            target.style.maxHeight = '';
            target.style.boxSizing = '';
            target.style.overflow = '';
            target.style.wordWrap = '';
            target.style.whiteSpace = '';
          }
          
          // 편집 표시 스타일 제거 (배경색은 사용자 설정을 보존)
          target.style.outline = '';
          target.style.outlineOffset = '';
          target.style.zIndex = '';
          
          // 드래그 핸들 제거
          const handles = iframeDoc.querySelectorAll('.drag-handle');
          handles.forEach(handle => handle.remove());
          
          setIsDirectEditing(false);
          setEditingElement(null);
        }
      };

      const handleBodyKeydown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        if (e.key === 'Enter' && target.contentEditable === 'true') {
          e.preventDefault();
          target.blur();
        }
      };

      const handleBodyMouseover = (e: Event) => {
        const target = (e.target as HTMLElement).closest('h1,h2,h3,h4,h5,h6,p,span,li,td,th,div');
        if (!target) return;
        
        const textContent = (target.textContent || '').trim();
        if (!textContent) return;
        
        // leaf 노드이거나, div인 경우 직접적인 텍스트 콘텐츠가 있는 경우만
        let isEditable = false;
        if (target.childElementCount === 0) {
          isEditable = true;
        } else if (target.tagName.toLowerCase() === 'div') {
          const directTextNodes = Array.from(target.childNodes).filter(
            node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
          );
          isEditable = directTextNodes.length > 0;
        }
        
        if (!isEditable) return;
        
        const htmlElement = target as HTMLElement;
        if (!isDirectEditing && htmlElement.contentEditable !== 'true') {
          // 배경색은 사용자 설정을 보존하고, hover 하이라이트는 outline으로만 표시
          htmlElement.style.cursor = 'pointer';
          htmlElement.style.outline = '1px solid rgba(59, 130, 246, 0.5)';
          htmlElement.style.outlineOffset = '0px'; // box model에 영향 없도록
        }
      };

      const handleBodyMouseout = (e: Event) => {
        const target = (e.target as HTMLElement).closest('h1,h2,h3,h4,h5,h6,p,span,li,td,th,div');
        if (!target) return;
        
        const textContent = (target.textContent || '').trim();
        if (!textContent) return;
        
        // leaf 노드이거나, div인 경우 직접적인 텍스트 콘텐츠가 있는 경우만
        let isEditable = false;
        if (target.childElementCount === 0) {
          isEditable = true;
        } else if (target.tagName.toLowerCase() === 'div') {
          const directTextNodes = Array.from(target.childNodes).filter(
            node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
          );
          isEditable = directTextNodes.length > 0;
        }
        
        if (!isEditable) return;
        
        const htmlElement = target as HTMLElement;
        if (!isDirectEditing && htmlElement.contentEditable !== 'true') {
          // 배경색은 건드리지 않고 outline만 제거
          htmlElement.style.cursor = '';
          htmlElement.style.outline = '';
          htmlElement.style.outlineOffset = '';
        }
      };

      // 이미지/도형 요소 클릭으로 드래그 핸들 생성
      const visualSelector = 'img,svg,figure,canvas,.circle,.gauge-container,.gauge,.gauge-background,.gauge-fill,.chart-container,.image-side,.footer,.arch,.arch-1,.arch-2,.arch-3,.arch-visual,.regulation-visual,rect,polygon,line,text,div[style*="border-radius"][style*="background"],div[style*="border-radius: 50%"],div[class*="circle"],div[class*="round"],div[class*="arch"]';
      const handleBodyClickVisual = (e: Event) => {
        if (isDraggingRef.current) return;
        const clickTarget = e.target as HTMLElement;
        let visual = clickTarget.closest(visualSelector) as HTMLElement | null;
        
        // 도형 요소 감지 개선 (스타일 기반, 조상까지 탐색)
        if (!visual) {
          let probe: HTMLElement | null = clickTarget;
          while (probe && probe !== iframeDoc.body) {
            const cs = iframe.contentWindow?.getComputedStyle(probe);
            if (cs) {
              const br = cs.borderRadius || '';
              const bg = cs.backgroundColor || '';
              const hasRadius = br !== '0px' && br !== '0px 0px 0px 0px';
              const isCircle = br === '50%' || br.includes('50%');
              const hasBg = bg && bg !== 'rgba(0, 0, 0, 0)';
              if ((hasRadius || isCircle) && hasBg) {
                visual = probe;
                break;
              }
            }
            probe = probe.parentElement;
          }
        }
        
        // 플로우차트 컨텍스트 감지 (template10의 .regulation-visual)
        const flowContainer = clickTarget.closest('.regulation-visual') as HTMLElement | null;
        const inFlowchart = !!flowContainer && !!flowContainer.querySelector('svg');

        // SVG 텍스트 클릭 시: 드래그 금지하고 인라인 텍스트 편집
        if (inFlowchart) {
          const targetTag = (clickTarget as Element).tagName?.toLowerCase();
          if (targetTag === 'text') {
            e.preventDefault();
            e.stopPropagation();
            try { editSvgTextInline(clickTarget as unknown as SVGTextElement); } catch {}
            return;
          }
        }

        if (!visual && inFlowchart) {
          visual = flowContainer!; // 플로우차트는 항상 컨테이너만 드래그
        }

        if (!visual) return;
        
        // 도형 안의 텍스트를 클릭한 경우: 텍스트 편집 우선, 도형 드래그 금지
        const textCandidate = clickTarget.closest('h1,h2,h3,h4,h5,h6,p,span,li,td,th,div');
        let blockForText = false;
        if (textCandidate && visual.contains(textCandidate as Node)) {
          const el = textCandidate as HTMLElement;
          if (el !== visual) {
            const content = (el.textContent || '').trim();
            if (content) {
              let editable = false;
              if (el.childElementCount === 0) {
                editable = true;
              } else if (el.tagName.toLowerCase() === 'div') {
                const directTextNodes = Array.from(el.childNodes).filter(
                  node => node.nodeType === Node.TEXT_NODE && (node.textContent || '').trim()
                );
                editable = directTextNodes.length > 0;
              }
              blockForText = editable;
            }
          }
        }
        if (blockForText) {
          console.log('도형 안의 텍스트 클릭됨 - 텍스트 편집 우선');
          return; // 텍스트 편집이 처리되도록 함
        }
        
        // 슬라이드 컨테이너 자체는 제외
        if (visual.classList.contains('slide-container')) return;

        // 플로우차트 내부 shape(rect,line,polygon,text) 개별 드래그 금지 → 컨테이너로 승격
        if (inFlowchart && visual !== flowContainer) {
          visual = flowContainer!;
        }
        
        // 이미 텍스트 편집 중이면 먼저 종료
        if (isDirectEditing && editingElement) {
          try { editingElement.blur(); } catch {}
        }
        
        e.preventDefault();
        e.stopPropagation();
        
        console.log('시각적 요소 클릭:', visual.className || visual.tagName, visual.style.cssText);
        
        try { 
          createDragHandle(visual); 
        } catch (err) {
          console.log('드래그 핸들 생성 실패:', err);
        }
      };
      
      const handleBodyMouseoverVisual = (e: Event) => {
        if (isDirectEditing || isDraggingRef.current) return;
        const clickTarget = e.target as HTMLElement;
        let el = clickTarget.closest(visualSelector) as HTMLElement | null;
        
        // 도형 요소 감지 개선 (스타일 기반, 조상까지 탐색)
        if (!el) {
          let probe: HTMLElement | null = clickTarget;
          while (probe && probe !== iframeDoc.body) {
            const cs = iframe.contentWindow?.getComputedStyle(probe);
            if (cs) {
              const br = cs.borderRadius || '';
              const bg = cs.backgroundColor || '';
              const hasRadius = br !== '0px' && br !== '0px 0px 0px 0px';
              const isCircle = br === '50%' || br.includes('50%');
              const hasBg = bg && bg !== 'rgba(0, 0, 0, 0)';
              if ((hasRadius || isCircle) && hasBg) {
                el = probe as HTMLElement;
                break;
              }
            }
            probe = probe.parentElement;
          }
        }
        
        // 플로우차트 감지 시 컨테이너에만 아웃라인 표시
        const flowContainer = clickTarget.closest('.regulation-visual') as HTMLElement | null;
        if (flowContainer) el = flowContainer;

        if (!el) return;
        
        // 텍스트 편집 가능한 요소는 제외
        if (el.closest('h1,h2,h3,h4,h5,h6,p,span,li,td,th,div[contenteditable]')) return;
        
        // 슬라이드 컨테이너 자체는 제외
        if (el.classList.contains('slide-container')) return;
        
        el.style.outline = '2px dashed rgba(34, 197, 94, 0.8)';
        el.style.cursor = 'move';
      };
      
      const handleBodyMouseoutVisual = (e: Event) => {
        const clickTarget = e.target as HTMLElement;
        let el = clickTarget.closest(visualSelector) as HTMLElement | null;
        
        // 도형 요소 감지 개선 (스타일 기반, 조상까지 탐색)
        if (!el) {
          let probe: HTMLElement | null = clickTarget;
          while (probe && probe !== iframeDoc.body) {
            const cs = iframe.contentWindow?.getComputedStyle(probe);
            if (cs) {
              const br = cs.borderRadius || '';
              const bg = cs.backgroundColor || '';
              const hasRadius = br !== '0px' && br !== '0px 0px 0px 0px';
              const isCircle = br === '50%' || br.includes('50%');
              const hasBg = bg && bg !== 'rgba(0, 0, 0, 0)';
              if ((hasRadius || isCircle) && hasBg) {
                el = probe as HTMLElement;
                break;
              }
            }
            probe = probe.parentElement;
          }
        }
        
        const flowContainer = clickTarget.closest('.regulation-visual') as HTMLElement | null;
        if (flowContainer) el = flowContainer;

        if (!el) return;
        
        el.style.outline = '';
        el.style.cursor = '';
      };

      // body에 이벤트 위임으로 등록 (중복 실행 방지를 위해 이벤트 타입 분리)
      iframeDoc.body.addEventListener('mousedown', handleBodyClick); // 텍스트
      iframeDoc.body.addEventListener('click', handleBodyClickVisual); // 비주얼
      iframeDoc.body.addEventListener('blur', handleBodyBlur, true); // 캡처 단계에서 처리
      iframeDoc.body.addEventListener('keydown', handleBodyKeydown);
      iframeDoc.body.addEventListener('mouseover', handleBodyMouseover);
      iframeDoc.body.addEventListener('mouseout', handleBodyMouseout);
      iframeDoc.body.addEventListener('mouseover', handleBodyMouseoverVisual);
      iframeDoc.body.addEventListener('mouseout', handleBodyMouseoutVisual);

      // 드래그 공통 정리 함수
      const finalizeDrag = (e?: PointerEvent, removePlaceholder: boolean = false) => {
        if (!isDraggingRef.current) return;
        
        // 원본 요소의 visibility 복원 및 드래그 클래스 제거
        const originalElement = dragElementRef.current;
        if (originalElement && originalElement.style.visibility === 'hidden') {
          originalElement.style.visibility = '';
        }
        if (originalElement) {
          originalElement.classList.remove('drag-elevated');
        }
        
        // 미리보기 제거
        const previewNode = dragPreviewRef.current;
        if (previewNode) {
          try { previewNode.remove(); } catch {}
        }
        setDragPreview(null);
        dragPreviewRef.current = null;
        // 핸들 제거 후 현재 이동된 요소 기준으로 핸들 재생성 (상태 유지)
        const handles = iframeDoc.querySelectorAll('.drag-handle');
        handles.forEach(h => h.remove());
        try {
          const current = dragElementRef.current;
          if (current && !removePlaceholder) {
            createDragHandle(current);
            // 리사이즈 핸들도 함께 재생성
            (iframe.contentWindow as any).__createResizeHandles?.(current);
          }
        } catch {}
        // 상태 초기화
        setIsDragging(false);
        isDraggingRef.current = false;
        setDragElement(null);
        // dragElementRef는 핸들 재생성을 위해 유지했다가 마지막에 null 처리
        dragElementRef.current = null;
        // 필요 시 placeholder 제거 (취소 시)
        if (removePlaceholder && dragPlaceholderRef.current) {
          try { dragPlaceholderRef.current.remove(); } catch {}
          dragPlaceholderRef.current = null;
        }
        // 포인터 캡처 해제
        if (e && (e.target as Element)?.releasePointerCapture) {
          try { (e.target as Element).releasePointerCapture(e.pointerId); } catch {}
        }
      };

      // iframe 내부 Pointer Events (드래그 처리)
              const handlePointerMove = (e: PointerEvent) => {
        if (!isDraggingRef.current) return;
        const previewNode = dragPreviewRef.current;
        const movingEl = dragElementRef.current;
        const delta = dragDeltaRef.current;
        if (!previewNode || !movingEl || !delta) return;
        
        const { x, y } = toRootXY(e);
        const left = x - delta.x;
        const top = y - delta.y;
        
        previewNode.style.left = `${left}px`;
        previewNode.style.top = `${top}px`;
        
        // 드래그 중에도 리사이즈 핸들 위치 실시간 업데이트
        try {
          const resizeHandles = Array.from(iframeDoc.querySelectorAll('.resize-handle'));
          if (resizeHandles.length > 0) {
            const positions = [
              { x: 0.5, y: 0 }, { x: 0.5, y: 1 }, { x: 0, y: 0.5 }, { x: 1, y: 0.5 },
              { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }
            ];
            const rect = previewNode.getBoundingClientRect();
            const rootRect = iframeDoc.body.getBoundingClientRect();
            const iframeWin = iframe.contentWindow!;
            const baseLeft = rect.left - rootRect.left + iframeWin.scrollX;
            const baseTop = rect.top - rootRect.top + iframeWin.scrollY;
            
            resizeHandles.forEach((handle, index) => {
              const pos = positions[index];
              if (pos) {
                (handle as HTMLElement).style.left = `${baseLeft + pos.x * rect.width - 5}px`;
                (handle as HTMLElement).style.top = `${baseTop + pos.y * rect.height - 5}px`;
              }
            });
          }
        } catch {}
        
        console.log('드래그 중:', { rawX: x, rawY: y, left, top });
      };

      const handlePointerUp = (e: PointerEvent) => {
        if (!isDraggingRef.current) return;
        const movingEl = dragElementRef.current;
        const delta = dragDeltaRef.current;
        if (!movingEl || !delta) return;
        
        console.log('드래그 완료');
        
        const { x, y } = toRootXY(e);
        const finalX = x - delta.x;
        const finalY = y - delta.y;
        
        // 부모 변경 금지 - left/top만 갱신 (부모 바뀌면 1~2px 어긋남)
        
        // 실제 요소 위치 업데이트 (다른 요소들 위에 표시되도록)
        // 제목(h1~h6) 등 margin이 있는 요소는 margin을 보정하여 정확히 같은 위치에 놓이도록 처리
        const cs = iframe.contentWindow?.getComputedStyle(movingEl);
        const marginTop = cs ? parseFloat(cs.marginTop || '0') || 0 : 0;
        const marginLeft = cs ? parseFloat(cs.marginLeft || '0') || 0 : 0;
        movingEl.style.position = 'absolute';
        movingEl.style.left = `${finalX - marginLeft}px`;
        movingEl.style.top = `${finalY - marginTop}px`;
        // z-index 강제 상승 대신 기존 값 유지 (레이어 순서 보존)
        movingEl.style.pointerEvents = 'auto';

        // 이동 후에도 텍스트 서식이 유지되도록 contentEditable 해제/복원 방지
        // 단순 이동은 편집 모드와 무관

        // 이미지 사이즈가 변하지 않도록 픽셀 크기로 고정 및 렌더링 속성 유지
        if (movingEl.tagName.toLowerCase() === 'img') {
          const saved = dragSizeRef.current;
          if (saved) {
            (movingEl as HTMLElement).style.width = `${saved.width}px`;
            (movingEl as HTMLElement).style.height = `${saved.height}px`;
            (movingEl as HTMLElement).style.maxWidth = 'none';
            (movingEl as HTMLElement).style.maxHeight = 'none';
            (movingEl as HTMLElement).style.minWidth = '0px';
            (movingEl as HTMLElement).style.minHeight = '0px';
            (movingEl as HTMLElement).style.display = 'block';
          }
          if (dragImageStyleRef.current) {
            const { objectFit, objectPosition } = dragImageStyleRef.current;
            if (objectFit) (movingEl as HTMLElement).style.objectFit = objectFit;
            if (objectPosition) (movingEl as HTMLElement).style.objectPosition = objectPosition;
          }
        }
        
        // 포인터 캡처 해제 및 공통 정리 + placeholder 제거 (미세 이동 누적 방지)
        finalizeDrag(e, true);
        // 드래그 종료 후 리사이즈 핸들 위치 업데이트
        try {
          (iframe.contentWindow as any).__createResizeHandles?.(movingEl);
        } catch {}
        // 드래그 종료 후 포커스 유지 및 선택 복구 (편집 중이었다면)
        if (isDirectEditing && editingElement) {
          try {
            editingElement.focus();
            const sel = iframe.contentDocument!.getSelection();
            if (sel) {
              const range = iframe.contentDocument!.createRange();
              range.selectNodeContents(editingElement);
              sel.removeAllRanges();
              sel.addRange(range);
            }
          } catch {}
        }
        dragDeltaRef.current = null;
        dragSizeRef.current = null;
        dragImageStyleRef.current = null;
        
        console.log('요소 이동 완료:', { rawX: x, rawY: y, finalX, finalY });
      };

      const handlePointerCancel = (e: PointerEvent) => {
        // 취소 시 placeholder 제거
        finalizeDrag(e, true);
        dragDeltaRef.current = null;
      };

      // iframe 내부에만 이벤트 리스너 추가
      iframeDoc.addEventListener('pointermove', handlePointerMove);
      iframeDoc.addEventListener('pointerup', handlePointerUp);
      iframeDoc.addEventListener('pointercancel', handlePointerCancel);
      iframe.contentWindow?.addEventListener('pointerup', handlePointerUp);
      iframe.contentWindow?.addEventListener('pointercancel', handlePointerCancel);
      
      // 클린업 함수에서 이벤트 리스너 제거
      return () => {
        iframeDoc.body.removeEventListener('mousedown', handleBodyClick); // 등록 타입과 일치
        iframeDoc.body.removeEventListener('click', handleBodyClickVisual);
        iframeDoc.body.removeEventListener('blur', handleBodyBlur, true);
        iframeDoc.body.removeEventListener('keydown', handleBodyKeydown);
        iframeDoc.body.removeEventListener('mouseover', handleBodyMouseover);
        iframeDoc.body.removeEventListener('mouseout', handleBodyMouseout);
        iframeDoc.body.removeEventListener('mouseover', handleBodyMouseoverVisual);
        iframeDoc.body.removeEventListener('mouseout', handleBodyMouseoutVisual);
        iframeDoc.removeEventListener('pointermove', handlePointerMove);
        iframeDoc.removeEventListener('pointerup', handlePointerUp);
        iframeDoc.removeEventListener('pointercancel', handlePointerCancel);
        iframe.contentWindow?.removeEventListener('pointerup', handlePointerUp);
        iframe.contentWindow?.removeEventListener('pointercancel', handlePointerCancel);
      };
    };

    iframe.addEventListener('load', handleIframeLoad);
    
    // 이미 로드된 경우 즉시 실행
    if (iframe.contentDocument?.readyState === 'complete') {
      handleIframeLoad();
    }

    return () => {
      iframe.removeEventListener('load', handleIframeLoad);
    };
  }, [editedHtml, isOpen, isDirectEditing, selectedText, isDragging, dragPreview, dragElement]);



  // 저장 기능
  const handleSave = () => {
    let finalHtml = editedHtml;
    
    // 저장 전 임시 스타일/요소 정리 (핸들, 프리뷰, 초기 사이즈 잠금 해제 등)
    const prepareForSave = () => {
      const iframe = previewRef.current;
      if (!iframe || !iframe.contentDocument) return;
      const doc = iframe.contentDocument;
      try {
        // 드래그/리사이즈 관련 임시 요소 제거 (저장본에 포함되지 않도록)
        doc.querySelectorAll('.drag-handle, .drag-preview, .drag-placeholder, .resize-handle, .svg-text-editor, .svg-text-input').forEach(n => {
          try { n.remove(); } catch {}
        });
        // 초기 사이즈 잠금 해제 및 원본 스타일 복원
        const locked = Array.from(doc.querySelectorAll('[data-initial-size-lock="1"]')) as HTMLElement[];
        locked.forEach(el => {
          const data = el.getAttribute('data-initial-styles');
          if (data) {
            try {
              const s = JSON.parse(data);
              // 크기(width/height/min/max)는 현재 값(사용자 리사이즈 결과)을 유지
              // 박스 모델/흐름 관련 속성만 원래 값으로 복원
              el.style.boxSizing = s.boxSizing;
              el.style.overflow = s.overflow;
              el.style.whiteSpace = s.whiteSpace;
              el.style.wordWrap = s.wordWrap;
            } catch {}
          }
          // 잠금 해제만 수행하여 현재 크기를 보존
          el.removeAttribute('data-initial-size-lock');
          el.removeAttribute('data-initial-styles');
        });
      } catch {}
    };
    
    // 편집 중인 요소가 있다면 강제로 완료 처리
    if (editingElement && isDirectEditing) {
      const newText = editingElement.textContent || '';
      
      console.log('편집 중인 요소 저장:', {
        selectedText,
        newText,
        isChanged: newText !== selectedText
      });
      
      // iframe에서 최신 HTML 가져오기 (저장 전 임시 스타일 정리)
      const iframe = previewRef.current;
      if (iframe && iframe.contentDocument) {
        prepareForSave();
        finalHtml = iframe.contentDocument.documentElement.outerHTML;
        console.log('iframe에서 최신 HTML 가져옴');
      } else if (newText !== selectedText && selectedText) {
        // iframe 접근 실패 시 fallback
        finalHtml = editedHtml.replace(selectedText, newText);
        console.log('fallback HTML 업데이트 사용');
      }
      
      // 편집 모드 해제 및 원본 스타일 복원
      editingElement.contentEditable = 'false';
      
      // 저장된 원본 스타일 복원
      const originalStylesData = editingElement.getAttribute('data-original-styles');
      if (originalStylesData) {
        try {
          const originalStyles = JSON.parse(originalStylesData);
          editingElement.style.width = originalStyles.width;
          editingElement.style.height = originalStyles.height;
          editingElement.style.minWidth = originalStyles.minWidth;
          editingElement.style.minHeight = originalStyles.minHeight;
          editingElement.style.maxWidth = originalStyles.maxWidth;
          editingElement.style.maxHeight = originalStyles.maxHeight;
          editingElement.style.boxSizing = originalStyles.boxSizing;
          editingElement.style.padding = originalStyles.padding;
          editingElement.style.margin = originalStyles.margin;
          editingElement.style.border = originalStyles.border;
          // 폰트/라인하이트는 사용자 변경을 유지해야 하므로 복원하지 않음
          editingElement.style.overflow = '';
          editingElement.style.wordWrap = '';
          editingElement.style.whiteSpace = '';
          editingElement.removeAttribute('data-original-styles');
        } catch (e) {
          console.warn('저장 시 원본 스타일 복원 실패:', e);
          // fallback으로 기본 초기화
          editingElement.style.width = '';
          editingElement.style.height = '';
          editingElement.style.minWidth = '';
          editingElement.style.minHeight = '';
          editingElement.style.maxWidth = '';
          editingElement.style.maxHeight = '';
          editingElement.style.boxSizing = '';
          editingElement.style.overflow = '';
          editingElement.style.wordWrap = '';
          editingElement.style.whiteSpace = '';
        }
      } else {
        // 원본 스타일 정보가 없는 경우 기본 초기화
        editingElement.style.width = '';
        editingElement.style.height = '';
        editingElement.style.minWidth = '';
        editingElement.style.minHeight = '';
        editingElement.style.maxWidth = '';
        editingElement.style.maxHeight = '';
        editingElement.style.boxSizing = '';
        editingElement.style.overflow = '';
        editingElement.style.wordWrap = '';
        editingElement.style.whiteSpace = '';
      }
      
      // 편집 표시 스타일 제거 (배경색은 사용자 설정을 보존)
      editingElement.style.outline = '';
      editingElement.style.outlineOffset = '';
      editingElement.style.zIndex = '';
      
      setIsDirectEditing(false);
      setEditingElement(null);
    } else {
      // 편집 중이 아닌 경우에도 iframe에서 최신 HTML 가져오기 (저장 전 임시 스타일 정리)
      const iframe = previewRef.current;
      if (iframe && iframe.contentDocument) {
        prepareForSave();
        finalHtml = iframe.contentDocument.documentElement.outerHTML;
        console.log('저장 시 iframe에서 최신 HTML 가져옴');
      }
    }
    
    console.log('최종 저장 HTML 길이:', finalHtml.length);
    console.log('저장 HTML 미리보기:', finalHtml.substring(0, 200) + '...');
    
    onSave(finalHtml);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[95vw] h-[95vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">슬라이드 {slideIndex + 1}번 HTML 편집</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Save size={16} />
              저장
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 툴바 - 항상 표시 */}
        <div
          onMouseDownCapture={handleToolbarInteractStart}
          onMouseUpCapture={handleToolbarInteractEnd}
          onClick={(e) => { e.stopPropagation(); }}
        >
          <TextEditToolbar
            key={toolbarKey}
            onCommand={handleToolbarCommand}
            selectedElement={editingElement}
          />
        </div>

        {/* 편집 영역 */}
        <div className="flex-1 flex">
          {/* HTML 코드 에디터 - 숨김 처리 */}
          <div className="hidden">
            <textarea
              ref={textareaRef}
              value={editedHtml}
              onChange={(e) => setEditedHtml(e.target.value)}
            />
          </div>
          
          {/* 실시간 미리보기 - 전체 화면 */}
          <div className="flex-1 bg-gray-100">
            <div className="bg-gray-200 px-4 py-2 text-gray-700 text-sm font-medium border-b">
              슬라이드 편집
              <span className="text-xs text-gray-500 ml-2">
                💡 텍스트를 클릭하여 직접 편집
              </span>
            </div>
            <div className="p-4 h-full overflow-auto flex items-center justify-center">
              <iframe
                ref={previewRef}
                srcDoc={editedHtml}
                className="border rounded shadow-lg"
                style={{ 
                  width: '1280px',
                  height: '720px',
                  transform: 'scale(0.9)',
                  transformOrigin: 'top left'
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
