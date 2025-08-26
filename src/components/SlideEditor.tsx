'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Save } from 'lucide-react';

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

      // 좌표 변환 함수
      const toRootXY = (e: PointerEvent) => {
        const scale = 0.9;
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
          
          // 원래 자리에 레이아웃 유지용 placeholder 삽입
          try {
            const elRectForPlaceholder = element.getBoundingClientRect();
            const placeholder = iframeDoc.createElement('div');
            placeholder.className = 'drag-placeholder';
            
            // 원본 요소의 모든 스타일 복사 (크기, 여백, 패딩 등)
            const comp = iframe.contentWindow?.getComputedStyle(element);
            if (comp) {
              placeholder.style.width = comp.width;
              placeholder.style.height = comp.height;
              placeholder.style.margin = comp.margin;
              placeholder.style.padding = comp.padding;
              placeholder.style.border = comp.border;
              placeholder.style.display = comp.display;
              placeholder.style.float = comp.float;
              placeholder.style.position = comp.position;
              placeholder.style.boxSizing = comp.boxSizing;
            }
            
            placeholder.style.visibility = 'hidden';
            placeholder.style.pointerEvents = 'none';
            placeholder.style.opacity = '0';
            element.parentElement?.insertBefore(placeholder, element);
            dragPlaceholderRef.current = placeholder;
            
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
      
      // 이벤트 위임으로 중복 등록 방지
      const handleBodyClick = (e: Event) => {
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
          
          // 도형 안의 텍스트가 아닌 경우에만 배경색과 테두리 적용
          if (!isInsideShape) {
            htmlElement.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
            htmlElement.style.outline = '2px solid #3B82F6';
            htmlElement.style.borderRadius = '4px';
            htmlElement.style.padding = '4px 8px';
          } else {
            // 도형 안의 텍스트는 최소한의 편집 표시만
            htmlElement.style.outline = '1px dashed #3B82F6';
          }
          
          htmlElement.style.minHeight = '1.5em';
          htmlElement.style.zIndex = '999';
          // position은 기존 값 유지. static인 경우에만 relative로 승격
          try {
            const prevPos = iframe.contentWindow?.getComputedStyle(htmlElement).position;
            if (prevPos === 'static') {
              htmlElement.style.position = 'relative';
            }
          } catch {}
          
          // 드래그 핸들 생성
          setTimeout(() => {
            createDragHandle(htmlElement);
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
          
          // 편집 모드 해제 (레이아웃 보전: position/zIndex는 유지)
          target.contentEditable = 'false';
          
          // 도형 안의 텍스트인지 다시 확인
          let isInsideShape = false;
          let parentElement = target.parentElement;
          while (parentElement && parentElement !== iframeDoc.body) {
            const parentStyle = iframe.contentWindow?.getComputedStyle(parentElement);
            if (parentStyle && parentStyle.backgroundColor && parentStyle.backgroundColor !== 'rgba(0, 0, 0, 0)') {
              isInsideShape = true;
              break;
            }
            parentElement = parentElement.parentElement;
          }
          
          // 도형 안의 텍스트가 아닌 경우에만 스타일 초기화
          if (!isInsideShape) {
            target.style.backgroundColor = '';
            target.style.borderRadius = '';
            target.style.padding = '';
          }
          
          // 공통 스타일 초기화
          target.style.outline = '';
          target.style.minHeight = '';
          
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
          htmlElement.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
          htmlElement.style.cursor = 'pointer';
          htmlElement.style.outline = '1px solid rgba(59, 130, 246, 0.5)';
          htmlElement.style.borderRadius = '2px';
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
          htmlElement.style.backgroundColor = '';
          htmlElement.style.cursor = '';
          htmlElement.style.outline = '';
          htmlElement.style.borderRadius = '';
        }
      };

      // 이미지/도형 요소 클릭으로 드래그 핸들 생성
      const visualSelector = 'img,svg,figure,canvas,.circle,.gauge-container,.gauge,.gauge-background,.gauge-fill,.chart-container,.image-side,.footer,.arch,.arch-1,.arch-2,.arch-3,.arch-visual,.regulation-visual,rect,polygon,line,text,div[style*="border-radius"][style*="background"],div[style*="border-radius: 50%"],div[class*="circle"],div[class*="round"],div[class*="arch"]';
      const handleBodyClickVisual = (e: Event) => {
        if (isDraggingRef.current) return;
        const clickTarget = e.target as HTMLElement;
        let visual = clickTarget.closest(visualSelector) as HTMLElement | null;
        
        // 도형 요소 감지 개선 (스타일 기반)
        if (!visual) {
          const element = clickTarget as HTMLElement;
          const computedStyle = iframe.contentWindow?.getComputedStyle(element);
          if (computedStyle) {
            const borderRadius = computedStyle.borderRadius;
            const background = computedStyle.backgroundColor;
            // 원형이고 배경색이 있는 요소
            if ((borderRadius === '50%' || borderRadius.includes('50%')) && background && background !== 'rgba(0, 0, 0, 0)') {
              visual = element;
            }
            // 아치형 도형 감지 (border-radius가 있고 배경색이 있는 요소)
            else if (borderRadius && borderRadius !== '0px' && background && background !== 'rgba(0, 0, 0, 0)') {
              visual = element;
            }
          }
        }
        
        if (!visual) return;
        
        // 도형 안의 텍스트를 클릭한 경우: 텍스트 편집 우선, 도형 드래그 금지
        const textElement = clickTarget.closest('h1,h2,h3,h4,h5,h6,p,span,li,td,th,div');
        if (textElement && visual.contains(textElement as Node)) {
          console.log('도형 안의 텍스트 클릭됨 - 텍스트 편집 우선');
          return; // 텍스트 편집이 처리되도록 함
        }
        
        // 슬라이드 컨테이너 자체는 제외
        if (visual.classList.contains('slide-container')) return;
        
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
        
        // 도형 요소 감지 개선 (스타일 기반)
        if (!el) {
          const element = clickTarget as HTMLElement;
          const computedStyle = iframe.contentWindow?.getComputedStyle(element);
          if (computedStyle) {
            const borderRadius = computedStyle.borderRadius;
            const background = computedStyle.backgroundColor;
            // 원형이고 배경색이 있는 요소
            if ((borderRadius === '50%' || borderRadius.includes('50%')) && background && background !== 'rgba(0, 0, 0, 0)') {
              el = element;
            }
            // 아치형 도형 감지 (border-radius가 있고 배경색이 있는 요소)
            else if (borderRadius && borderRadius !== '0px' && background && background !== 'rgba(0, 0, 0, 0)') {
              el = element;
            }
          }
        }
        
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
        
        // 도형 요소 감지 개선 (스타일 기반)
        if (!el) {
          const element = clickTarget as HTMLElement;
          const computedStyle = iframe.contentWindow?.getComputedStyle(element);
          if (computedStyle) {
            const borderRadius = computedStyle.borderRadius;
            const background = computedStyle.backgroundColor;
            // 원형이고 배경색이 있는 요소
            if ((borderRadius === '50%' || borderRadius.includes('50%')) && background && background !== 'rgba(0, 0, 0, 0)') {
              el = element;
            }
            // 아치형 도형 감지 (border-radius가 있고 배경색이 있는 요소)
            else if (borderRadius && borderRadius !== '0px' && background && background !== 'rgba(0, 0, 0, 0)') {
              el = element;
            }
          }
        }
        
        if (!el) return;
        
        el.style.outline = '';
        el.style.cursor = '';
      };

      // body에 이벤트 위임으로 등록
      iframeDoc.body.addEventListener('click', handleBodyClick);
      iframeDoc.body.addEventListener('click', handleBodyClickVisual);
      iframeDoc.body.addEventListener('blur', handleBodyBlur, true); // 캡처 단계에서 처리
      iframeDoc.body.addEventListener('keydown', handleBodyKeydown);
      iframeDoc.body.addEventListener('mouseover', handleBodyMouseover);
      iframeDoc.body.addEventListener('mouseout', handleBodyMouseout);
      iframeDoc.body.addEventListener('mouseover', handleBodyMouseoverVisual);
      iframeDoc.body.addEventListener('mouseout', handleBodyMouseoutVisual);

      // 드래그 공통 정리 함수
      const finalizeDrag = (e?: PointerEvent, removePlaceholder: boolean = false) => {
        if (!isDraggingRef.current) return;
        
        // 원본 요소의 visibility 복원
        const originalElement = dragElementRef.current;
        if (originalElement && originalElement.style.visibility === 'hidden') {
          originalElement.style.visibility = '';
        }
        
        // 미리보기 제거
        const previewNode = dragPreviewRef.current;
        if (previewNode) {
          try { previewNode.remove(); } catch {}
        }
        setDragPreview(null);
        dragPreviewRef.current = null;
        // 핸들 제거
        const handles = iframeDoc.querySelectorAll('.drag-handle');
        handles.forEach(h => h.remove());
        // 상태 초기화
        setIsDragging(false);
        isDraggingRef.current = false;
        setDragElement(null);
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
        
        // 부모 컨테이너 제약을 피하기 위해 먼저 body에 직접 append
        if (movingEl.parentElement !== iframeDoc.body) {
          iframeDoc.body.appendChild(movingEl);
        }
        
        // 실제 요소 위치 업데이트 (다른 요소들 위에 표시되도록)
        movingEl.style.position = 'absolute';
        movingEl.style.left = `${finalX}px`;
        movingEl.style.top = `${finalY}px`;
        movingEl.style.zIndex = '1000';
        movingEl.style.pointerEvents = 'auto';

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
        
        // 포인터 캡처 해제 및 공통 정리 + 델타 초기화 (placeholder는 유지)
        finalizeDrag(e, false);
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
        iframeDoc.body.removeEventListener('click', handleBodyClick);
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
    
    // 편집 중인 요소가 있다면 강제로 완료 처리
    if (editingElement && isDirectEditing) {
      const newText = editingElement.textContent || '';
      
      console.log('편집 중인 요소 저장:', {
        selectedText,
        newText,
        isChanged: newText !== selectedText
      });
      
      // iframe에서 최신 HTML 가져오기
      const iframe = previewRef.current;
      if (iframe && iframe.contentDocument) {
        finalHtml = iframe.contentDocument.documentElement.outerHTML;
        console.log('iframe에서 최신 HTML 가져옴');
      } else if (newText !== selectedText && selectedText) {
        // iframe 접근 실패 시 fallback
        finalHtml = editedHtml.replace(selectedText, newText);
        console.log('fallback HTML 업데이트 사용');
      }
      
      // 편집 모드 해제 (레이아웃 보전: absolute/zIndex 유지)
      editingElement.contentEditable = 'false';
      
      // 도형 안의 텍스트인지 확인
      let isInsideShape = false;
      let parentElement = editingElement.parentElement;
      while (parentElement && parentElement !== iframe?.contentDocument?.body) {
        const parentStyle = iframe?.contentWindow?.getComputedStyle(parentElement);
        if (parentStyle && parentStyle.backgroundColor && parentStyle.backgroundColor !== 'rgba(0, 0, 0, 0)') {
          isInsideShape = true;
          break;
        }
        parentElement = parentElement.parentElement;
      }
      
      // 도형 안의 텍스트가 아닌 경우에만 스타일 초기화
      if (!isInsideShape) {
        editingElement.style.backgroundColor = '';
        editingElement.style.borderRadius = '';
        editingElement.style.padding = '';
      }
      
      // 공통 스타일 초기화
      editingElement.style.outline = '';
      editingElement.style.minHeight = '';
      
      setIsDirectEditing(false);
      setEditingElement(null);
    } else {
      // 편집 중이 아닌 경우에도 iframe에서 최신 HTML 가져오기
      const iframe = previewRef.current;
      if (iframe && iframe.contentDocument) {
        // 드래그 핸들 제거 후 HTML 가져오기
        const handles = iframe.contentDocument.querySelectorAll('.drag-handle');
        handles.forEach(handle => handle.remove());
        
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
