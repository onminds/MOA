"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send, Download, Scissors, Undo2, Redo2 } from "lucide-react";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import ReactMarkdown from 'react-markdown';

export interface EssayEditorEmbedProps {
	initialContent: string;
	initialTitle?: string | null;
	height?: number; // editor height in px
	layout?: 'tabs' | 'split';
	initialSections?: Array<{ id: number; title: string; text: string }>;
	onContentChange?: (text: string) => void;
	// 채팅 패널을 숨기는 옵션
	hideChat?: boolean;
	// 어시스턴트 응답을 채팅에 표시하지 않는 옵션
	suppressAssistantMessage?: boolean;
	// 내용 길이에 따라 에디터 상자의 높이를 자동으로 늘립니다.
	autoGrow?: boolean;
	// 채팅 입력창을 화면 중앙 하단에 고정합니다.
	fixedChatInput?: boolean;
	// 에디터 내부에서 마크다운 헤딩(#, ##, ###)을 시각적으로 스타일링
	styleMarkdownHeadings?: boolean;
	// 선택 영역을 하나의 오버레이 박스로만 표시
	singleSelectionOverlay?: boolean;
}

type ChatMessage = { role: "user" | "assistant"; content: string };

export default function EssayEditorEmbed({ initialContent, initialTitle = null, height = 520, layout = 'tabs', initialSections, onContentChange, hideChat = false, suppressAssistantMessage = false, autoGrow = false, fixedChatInput = false, styleMarkdownHeadings = false, singleSelectionOverlay = false }: EssayEditorEmbedProps) {
	const [content, setContent] = useState(initialContent || "");
	const [title, setTitle] = useState<string | null>(initialTitle);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [input, setInput] = useState("");
	const [loading, setLoading] = useState(false);
	const [autoApply, setAutoApply] = useState(true);
	const [selectionOnly, setSelectionOnly] = useState(false);
	const [activeTab, setActiveTab] = useState<'editor' | 'chat'>("editor");

	const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
	const overlayRef = useRef<HTMLDivElement | null>(null);
	// Body-level fixed overlay portal to avoid clipping/centering issues
	const overlayPortalRef = useRef<HTMLDivElement | null>(null);
	const overlayDebounceRef = useRef<number | null>(null);
	useEffect(() => {
		const div = document.createElement('div');
		div.style.position = 'fixed';
		div.style.left = '0';
		div.style.top = '0';
		div.style.width = '100vw';
		div.style.height = '100vh';
		div.style.pointerEvents = 'none';
		div.style.zIndex = '2147483000';
		overlayPortalRef.current = div;
		document.body.appendChild(div);
		// Recompute positions on window scroll/resize to keep overlay stuck to text while viewport moves
		const onWinScrollOrResize = () => {
			// hide during scroll for smoother UX
			if (overlayPortalRef.current) overlayPortalRef.current.innerHTML = '';
			if (overlayDebounceRef.current) cancelAnimationFrame(overlayDebounceRef.current);
			overlayDebounceRef.current = requestAnimationFrame(() => {
				// small timeout to wait for momentum/end of scroll
				setTimeout(() => applyPreviewHighlight(), 80);
			});
		};
		window.addEventListener('scroll', onWinScrollOrResize, true);
		window.addEventListener('resize', onWinScrollOrResize);
		return () => {
			window.removeEventListener('scroll', onWinScrollOrResize, true);
			window.removeEventListener('resize', onWinScrollOrResize);
			try { document.body.removeChild(div); } catch {}
		};
	}, []);
	const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
	const editorRef = useRef<HTMLDivElement | null>(null);

	const [selRange, setSelRange] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
	const hasSelection = useMemo(() => selRange.end > selRange.start, [selRange]);

	const getTextNodes = (root: HTMLElement): Text[] => {
		const out: Text[] = [];
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
		let n = walker.nextNode();
		while (n) { out.push(n as Text); n = walker.nextNode(); }
		return out;
	};

	const getOffsetsInEditable = (root: HTMLElement): { start: number; end: number } | null => {
		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0) return null;
		const range = sel.getRangeAt(0);
		if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
		try {
			// compute length using Range API so element-node boundaries are handled
			const pre = document.createRange();
			pre.selectNodeContents(root);
			pre.setEnd(range.startContainer, range.startOffset);
			const start = pre.toString().length;
			let selectedLen = range.toString().length;
			if (selectedLen === 0 && !range.collapsed) {
				// 빈 줄(개행)만 포함된 선택 등 텍스트 길이가 0으로 계산되는 경우를 보정
				selectedLen = 1;
			}
			return { start, end: start + selectedLen };
		} catch {
			return null;
		}
	};

	// Build a DOM Range from character offsets in the contentEditable
	const buildRangeFromOffsets = (root: HTMLElement, start: number, end: number): Range | null => {
		const texts = getTextNodes(root);
		if (texts.length === 0) return null;
		let acc = 0;
		let aNode: Text | null = null; let aOff = 0;
		let bNode: Text | null = null; let bOff = 0;
		for (const t of texts) {
			const len = t.nodeValue?.length ?? 0;
			if (!aNode && start <= acc + len) { aNode = t; aOff = Math.max(0, start - acc); }
			if (!bNode && end <= acc + len) { bNode = t; bOff = Math.max(0, end - acc); break; }
			acc += len;
		}
		if (!aNode) { aNode = texts[0]; aOff = 0; }
		if (!bNode) { const last = texts[texts.length - 1]; bNode = last; bOff = (last?.nodeValue?.length ?? 0); }
		try {
			const r = document.createRange();
			r.setStart(aNode as Node, aOff);
			r.setEnd(bNode as Node, bOff);
			return r;
		} catch { return null; }
	};

	const clearOverlay = () => { if (overlayRef.current) overlayRef.current.innerHTML = ""; };

	useEffect(() => {
		const onSel = () => {
			const root = editorRef.current; if (!root) return;
			const sel = window.getSelection();
			if (!sel || sel.rangeCount === 0) { 
				// 네이티브 선택이 없어져도 기존 하이라이트는 유지
				renderOverlayFromRects();
				return; 
			}
			const range = sel.getRangeAt(0);
			const inside = root.contains(range.startContainer) && root.contains(range.endContainer);
			if (inside) {
				const off = getOffsetsInEditable(root);
				if (off && off.end > off.start) {
					setSelRange(off);
					applyPreviewHighlight();
				} else {
					// collapsed → 기존 오버레이 유지
					renderOverlayFromRects();
				}
			} else {
				// outside editor → keep previous overlay
				renderOverlayFromRects();
			}
		};
		document.addEventListener('selectionchange', onSel);
		return () => document.removeEventListener('selectionchange', onSel);
	}, []);

	// Hide native selection highlight inside editor so only our overlay is visible
	useEffect(() => {
		const STYLE_ID = 'ai-editor-hide-native-selection';
		if (!document.getElementById(STYLE_ID)) {
			const style = document.createElement('style');
			style.id = STYLE_ID;
			style.textContent = `.ai-editor::selection{background:rgba(0,0,0,0)!important;color:inherit!important;} .ai-editor *::selection{background:rgba(0,0,0,0)!important;color:inherit!important;} .ai-editor::-moz-selection{background:rgba(0,0,0,0)!important;color:inherit!important;} .ai-editor *::-moz-selection{background:rgba(0,0,0,0)!important;color:inherit!important;}`;
			document.head.appendChild(style);
		}
	}, []);

	// remove early DOM sync that referenced getCurrent before init
	// (deleted useEffect block here)

	const buildPrompt = (userInstruction: string) => {
		if (selectionOnly && hasSelection) {
			const selected = getCurrent().slice(selRange.start, selRange.end);
			return [
				"다음은 자기소개서의 일부 단락입니다.",
				"사용자의 지시를 반영해 이 단락만 자연스럽게 고쳐 주세요.",
				"- 의미는 유지하되 간결성/가독성/설득력 개선",
				"- 맞춤법/문장부호 다듬기",
				"- 결과는 수정된 단락 '텍스트만' 출력 (설명/마크다운/따옴표 금지)",
				"",
				`[사용자 지시] ${userInstruction}`,
				"",
				"[단락]",
				selected,
			].join("\n");
		}
		return [
			"다음은 자기소개서 전체 본문입니다.",
			"사용자의 지시를 반영해 전체 본문을 자연스럽게 고쳐 주세요.",
			"- 의미는 유지하되 간결성/가독성/논리 전개 개선",
			"- 맞춤법/문장부호/중복 표현 정리",
			"- 결과는 수정된 전체 본문 '텍스트만' 출력 (설명/마크다운/따옴표 금지)",
			"",
			`[사용자 지시] ${userInstruction}`,
			"",
			"[전체 본문]",
			getCurrent(),
		].join("\n");
	};

	const stripFences = (t: string) => {
		let s = t.trim();
		if (s.startsWith("```")) {
			s = s.replace(/^```[a-zA-Z0-9-]*\s*/m, "");
			if (s.endsWith("```")) s = s.replace(/```$/m, "");
		}
		s = s.replace(/^"+|"+$/g, "").replace(/^'+|'+$/g, "");
		return s.trim();
	};

	const pushMessage = (m: ChatMessage) => setMessages(prev => [...prev, m]);

	// move section state earlier to define getCurrent/setCurrent before usage
	const [sections, setSections] = useState<Array<{ id: number; title: string; text: string }>>(initialSections || []);
	const [activeIdx, setActiveIdx] = useState(0);

	const getCurrent = () => sections.length > 0 ? (sections[Math.max(0, Math.min(activeIdx, sections.length - 1))]?.text || '') : content;
	const setCurrent = (nextText: string) => {
		if (sections.length > 0) {
			setSections(prev => {
				const copy = [...prev];
				if (!copy[activeIdx]) return prev;
				copy[activeIdx] = { ...copy[activeIdx], text: nextText };
				return copy;
			});
			onContentChange?.(nextText);
			return;
		}
		setContent(nextText);
		onContentChange?.(nextText);
	};

	const [messagesBySection, setMessagesBySection] = useState<Record<string, ChatMessage[]>>({});
	const [historyBySection, setHistoryBySection] = useState<Record<string, string[]>>({});
	const [redoBySection, setRedoBySection] = useState<Record<string, string[]>>({});
	// Debounced manual-typing history snapshot support
	const lastHistoryTsRef = useRef<number>(0);
	const HISTORY_DEBOUNCE_MS = 400;

	const parseSectionsFromText = (text: string): Array<{ id: number; title: string; text: string }> => {
		const results: Array<{ id: number; title: string; text: string }> = [];
		if (!text || text.trim().length === 0) return results;
		try {
			const patterns = [
				/\[질문\s+(\d+)\]\s*([^\n]*?)\s*\[답변\s*시작\]\s*([\s\S]*?)(?=\s*\[질문\s+\d+\]|$)/g,
				/\[질문\s+(\d+)\]\s*([^\n]*?)\s*([\s\S]*?)(?=\s*\[질문\s+\d+\]|$)/g,
			];
			for (let i = 0; i < patterns.length; i++) {
				const regex = new RegExp(patterns[i].source, 'g');
				let m: RegExpExecArray | null;
				while ((m = regex.exec(text)) !== null) {
					const idx = parseInt(m[1], 10);
					const title = (m[2] || '').trim() || `질문 ${idx}`;
					const answer = (m[3] || '').trim().replace(/^\[답변\s*시작\]\s*/, '');
					if (answer && answer.length > 3) {
						results.push({ id: Date.now() + idx, title: `[질문 ${idx}] ${title}`, text: answer });
					}
				}
				if (results.length > 0) break;
			}
			if (results.length === 0) {
				const markers = text.match(/\[질문\s+\d+\][^\n]*/g) || [];
				if (markers.length > 0) {
					for (let i = 0; i < markers.length; i++) {
						const q = markers[i];
						const questionIndex = i + 1;
						const currentStart = text.indexOf(q);
						const nextStart = i < markers.length - 1 ? text.indexOf(markers[i + 1]) : text.length;
						const answer = text.substring(currentStart + q.length, nextStart).trim().replace(/^\[답변\s*시작\]\s*/, '');
						const title = q.replace(/\[질문\s+\d+\]\s*/, '').trim() || `질문 ${questionIndex}`;
						if (answer && answer.length > 3) {
							results.push({ id: Date.now() + questionIndex, title: `[질문 ${questionIndex}] ${title}`, text: answer });
						}
					}
				}
			}
		} catch {}
		return results;
	};

	const getActiveKey = () => {
		if (sections.length > 0) {
			const idx = Math.max(0, Math.min(activeIdx, sections.length - 1));
			const id = sections[idx]?.id;
			return String(id ?? 'single');
		}
		return 'single';
	};
	const getCurrentMessages = (): ChatMessage[] => messagesBySection[getActiveKey()] || [];
	const pushMessageByKey = (msg: ChatMessage) => {
		const key = getActiveKey();
		setMessagesBySection(prev => ({ ...prev, [key]: ([...(prev[key] || []), msg]) }));
	};
	const pushHistoryByKey = (prevText: string) => {
		const key = getActiveKey();
		setHistoryBySection(prev => ({ ...prev, [key]: ([...(prev[key] || []), prevText]).slice(-20) }));
		setRedoBySection(prev => ({ ...prev, [key]: [] }));
	};
	const canUndoByKey = (): boolean => (historyBySection[getActiveKey()] || []).length > 0;
	const canRedoByKey = (): boolean => (redoBySection[getActiveKey()] || []).length > 0;
	const undoByKey = () => {
		const key = getActiveKey();
		const hist = historyBySection[key] || [];
		if (hist.length === 0) return;
		const last = hist[hist.length - 1];
		const newHist = hist.slice(0, -1);
		const current = sections.length > 0 ? (sections[activeIdx]?.text || '') : content;
		setHistoryBySection(prev => ({ ...prev, [key]: newHist }));
		setRedoBySection(prev => ({ ...prev, [key]: ([...(prev[key] || []), current]).slice(-20) }));
		setCurrent(last);
	};
	const redoByKey = () => {
		const key = getActiveKey();
		const stack = redoBySection[key] || [];
		if (stack.length === 0) return;
		const next = stack[stack.length - 1];
		const newRedo = stack.slice(0, -1);
		const current = sections.length > 0 ? (sections[activeIdx]?.text || '') : content;
		setRedoBySection(prev => ({ ...prev, [key]: newRedo }));
		setHistoryBySection(prev => ({ ...prev, [key]: ([...(prev[key] || []), current]).slice(-20) }));
		setCurrent(next);
	};

	const currentQuestionTitle = useMemo(() => {
		if (sections.length > 0) {
			const idx = Math.max(0, Math.min(activeIdx, sections.length - 1));
			return sections[idx]?.title || '';
		}
		return title || '';
	}, [sections, activeIdx, title]);

	// overlay highlight support
	const overlayRectsRef = useRef<Array<{ x: number; y: number; w: number; h: number }>>([]);
	const renderOverlayFromRects = () => {
		const host = overlayPortalRef.current || overlayRef.current;
		if (!host || !editorRef.current) return;
		const frag = document.createDocumentFragment();
		for (const r of overlayRectsRef.current) {
			const bg = document.createElement('div');
			bg.style.position = 'absolute';
			bg.style.left = `${r.x}px`;
			bg.style.top = `${r.y}px`;
			bg.style.width = `${r.w}px`;
			bg.style.height = `${r.h}px`;
			// Same color for both border and fill
			const overlayColor = 'rgba(59,130,246,0.35)';
			bg.style.background = overlayColor;
			bg.style.border = `2px solid ${overlayColor}`;
			bg.style.boxShadow = 'none';
			bg.style.borderRadius = '3px';
			frag.appendChild(bg);
		}
		host.innerHTML = '';
		host.appendChild(frag);
	};
	const clearPreviewMarks = () => { if (overlayRef.current) overlayRef.current.innerHTML = ''; };
	useEffect(() => { if (!selectionOnly) { clearPreviewMarks(); overlayRectsRef.current = []; } }, [selectionOnly]);

	const applyPreviewHighlight = () => {
		if (!editorRef.current) { clearPreviewMarks(); overlayRectsRef.current = []; return; }
		const root = editorRef.current;
		const sel = window.getSelection();
		let range: Range | null = null;
		if (sel && sel.rangeCount > 0) {
			range = sel.getRangeAt(0);
		} else if (selRange.end > selRange.start) {
			// 네이티브 selection이 없어도 마지막 선택 범위로 재구성
			range = buildRangeFromOffsets(root, selRange.start, selRange.end);
		}
		if (!range) { if (overlayRectsRef.current.length > 0) { renderOverlayFromRects(); } else { clearPreviewMarks(); } return; }
		if (!root.contains(range.startContainer) || !root.contains(range.endContainer) || range.collapsed) { 
			if (overlayRectsRef.current.length > 0) { renderOverlayFromRects(); return; }
			clearPreviewMarks(); return; 
		}
		let clientRects = Array.from(range.getClientRects());
		// 좌표 기준을 오버레이 레이어(overlayRef)로 통일하여 어긋남 방지
		// Use viewport coordinates for portal overlay
		const containerRect = { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight } as DOMRect;
		// 폴백 제거: getClientRects가 비어있으면 이전 오버레이 유지 또는 정리만 수행
		if (clientRects.length === 0) { if (overlayRectsRef.current.length > 0) { renderOverlayFromRects(); } else { clearPreviewMarks(); } return; }
		// Normalize rects to container coordinates
		let norm = clientRects.map((cr) => {
			const x = Math.max(0, cr.left - containerRect.left);
			const y = Math.max(0, cr.top - containerRect.top);
			const maxW = containerRect.width;
			const maxH = containerRect.height;
			const w = Math.min(cr.width, maxW - x);
			const h = Math.min(cr.height, maxH - y);
			return { x, y, w: Math.max(0, w), h: Math.max(0, h) };
		});

		// 3) 라인 병합 로직 보정: 극단치 제거 후 라인 단위로 하나의 박스만 생성
		norm = norm.filter(r => r.w > 0.8 && r.h > 0.8);
		if (norm.length === 0) { overlayRectsRef.current = []; clearPreviewMarks(); return; }
		// 높이 중앙값을 기준으로 과도하게 큰(블록 전체) 사각형 제거
		const heights = norm.map(r => r.h).sort((a,b)=>a-b);
		const mid = heights[Math.floor(heights.length/2)];
		const maxAllowedH = mid * 1.5;
		norm = norm.filter(r => r.h <= maxAllowedH);

		// y 우선, x 보조 정렬 후 같은 줄(EPS_Y)만 병합
		norm = norm.sort((a,b)=> (a.y - b.y) || (a.x - b.x));
		const EPS_Y = 2; // 같은 줄로 간주하는 y 허용치(px) 축소
		const merged: Array<{x:number;y:number;w:number;h:number}> = [];
		let lineGroup: Array<{x:number;y:number;w:number;h:number}> = [];
		const flushLine = () => {
			if (lineGroup.length === 0) return;
			let minX = Infinity, maxX = -Infinity, baseY = lineGroup[0].y, maxH2 = 0;
			for (const r of lineGroup) { minX = Math.min(minX, r.x); maxX = Math.max(maxX, r.x + r.w); maxH2 = Math.max(maxH2, r.h); }
			merged.push({ x: minX, y: baseY, w: Math.max(0, maxX - minX), h: maxH2 });
			lineGroup = [];
		};
		for (const r of norm) {
			if (lineGroup.length === 0 || Math.abs(r.y - lineGroup[0].y) <= EPS_Y) { lineGroup.push(r); }
			else { flushLine(); lineGroup.push(r); }
		}
		flushLine();
		overlayRectsRef.current = merged;
		renderOverlayFromRects();
	};
	useEffect(() => { applyPreviewHighlight(); }, [selRange, sections, activeIdx, selectionOnly]);

	// auto split sections on initial content load
	useEffect(() => {
		if (sections.length === 0 && content && /\[질문\s+\d+\]/.test(content)) {
			const parsed = parseSectionsFromText(content);
			if (parsed.length > 0) {
				setSections(parsed);
				setActiveIdx(0);
				setSelRange({ start: 0, end: 0 });
				overlayRectsRef.current = [];
				clearPreviewMarks();
			}
		}
	}, [content]);

	// chat input auto-resize
	const autoResizeChatInput = () => { const el = chatInputRef.current; if (!el) return; el.style.height = 'auto'; const next = Math.min(el.scrollHeight, 192); el.style.height = `${next}px`; };

	// sizing constants for chat panel
	const CHAT_INPUT_ZONE = 84; // px reserved for input + margins
	const CHAT_EXTRA_TOP = 124; // px to match title box + toggle rows (slightly reduced)

	// keep editor DOM synced
	useEffect(() => {
		if (!editorRef.current) return;
		const text = getCurrent();
		const el = editorRef.current;
		const renderMarkdownLines = (t: string) => {
			const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
			const styleFor = (lvl: number) => lvl === 1 ? 'font-weight:800;font-size:24px;margin:6px 0;' : lvl === 2 ? 'font-weight:700;font-size:20px;margin:6px 0;' : lvl === 3 ? 'font-weight:600;font-size:18px;margin:4px 0;' : '';
			return t.split(/\n/).map(line => {
				const m = line.match(/^(#{1,6})\s/);
				const level = m ? m[1].length : 0;
				const style = styleFor(level);
				if (level > 0) {
					const prefix = m ? m[1] + ' ' : '';
					const rest = line.replace(/^(#{1,6})\s/, '');
					return `<div class=\"md-line\" style=\"${style}\"><span class=\"md-prefix\" style=\"opacity:0;display:inline-block;width:0;overflow:hidden\">${esc(prefix)}</span>${esc(rest)}</div>`;
				}
				return `<div class=\"md-line\" style=\"${style}\">${esc(line)}</div>`;
			}).join("");
		};
		if (styleMarkdownHeadings) {
			if (el.innerText !== text) {
				el.innerHTML = renderMarkdownLines(text);
				clearPreviewMarks();
			}
		} else {
			if (el.innerText !== text) {
				el.innerText = text;
				clearPreviewMarks();
			}
		}
	}, [sections, activeIdx, content, styleMarkdownHeadings]);

	const handleEditorInput = () => {
		if (!editorRef.current) return;
		const root = editorRef.current;
		const prev = getCurrent();
		const next = root.innerText.replace(/\r\n?/g, '\n');
		const now = Date.now();
		if (now - lastHistoryTsRef.current > HISTORY_DEBOUNCE_MS) {
			pushHistoryByKey(prev);
			lastHistoryTsRef.current = now;
		}
		setCurrent(next);
		clearPreviewMarks();
		overlayRectsRef.current = [];
		if (styleMarkdownHeadings) {
			const off = getOffsetsInEditable(root);
			const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
			const styleFor = (lvl: number) => lvl === 1 ? 'font-weight:800;font-size:24px;margin:6px 0;' : lvl === 2 ? 'font-weight:700;font-size:20px;margin:6px 0;' : lvl === 3 ? 'font-weight:600;font-size:18px;margin:4px 0;' : '';
			const html = next.split(/\n/).map(line => {
				const m = line.match(/^(#{1,6})\s/);
				const level = m ? m[1].length : 0;
				const style = styleFor(level);
				if (level > 0) {
					const prefix = m ? m[1] + ' ' : '';
					const rest = line.replace(/^(#{1,6})\s/, '');
					return `<div class=\"md-line\" style=\"${style}\"><span class=\"md-prefix\" style=\"opacity:0;display:inline-block;width:0;overflow:hidden\">${esc(prefix)}</span>${esc(rest)}</div>`;
				}
				return `<div class=\"md-line\" style=\"${style}\">${esc(line)}</div>`;
			}).join("");
			root.innerHTML = html;
			if (off) setEditableSelection(root, off.start, off.end);
		}
	};

	const canUndoNow = canUndoByKey();
	const canRedoNow = canRedoByKey();
	const handleUndo = () => undoByKey();
	const handleRedo = () => redoByKey();

	// 채팅 숨김 시, 활성 탭이 채팅이면 편집 탭으로 강제 전환
	useEffect(() => {
		if (hideChat && activeTab === 'chat') {
			setActiveTab('editor');
		}
	}, [hideChat, activeTab]);

	const handleSend = async (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		const question = input.trim();
		if (!question) return;
		if (!getCurrent().trim() && !(selectionOnly && hasSelection)) { alert("수정할 본문이 없습니다."); return; }
		setLoading(true);
		pushMessageByKey({ role: 'user', content: question });
		setInput("");
		try {
			const baseText = getCurrent();
			const targetText = selectionOnly && hasSelection ? getCurrent().slice(selRange.start, selRange.end) : baseText;
			const res = await fetch("/api/essay-edit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: targetText, instruction: question }) });
			const data = await res.json();
			const rawRevised = (data?.revised ?? "");
			const revisedForApply = stripFences(rawRevised);
			if (!suppressAssistantMessage) {
				pushMessageByKey({ role: 'assistant', content: rawRevised });
			}
			if (autoApply) {
				pushHistoryByKey(baseText);
				if (selectionOnly && hasSelection) {
					const before = baseText.slice(0, selRange.start);
					const after = baseText.slice(selRange.end);
					setCurrent(before + revisedForApply + after);
				} else {
					setCurrent(revisedForApply);
				}
			}
		} finally {
			setLoading(false);
		}
	};

	const downloadWord = async () => {
		const children: Paragraph[] = [];
		const docTitle = title || "자기소개서";
		children.push(new Paragraph({ text: docTitle, heading: HeadingLevel.TITLE }));
		children.push(new Paragraph({ text: " " }));
		const addText = (text: string) => { (text || "").split(/\n/).forEach(line => children.push(new Paragraph({ children: [new TextRun(line)] }))); children.push(new Paragraph({ text: " " })); };
		if (sections.length > 0) { sections.forEach(s => { children.push(new Paragraph({ text: s.title || "문항", heading: HeadingLevel.HEADING_2 })); addText(s.text); }); } else { addText(content); }
		const doc = new Document({ sections: [{ children }] });
		const blob = await Packer.toBlob(doc);
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url; a.download = `${docTitle.replace(/\s+/g, "_")}_${Date.now()}.docx`;
		document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
	};

	// helper: set selection by offsets in contentEditable
	const setEditableSelection = (root: HTMLElement, start: number, end: number) => {
		const texts = getTextNodes(root);
		let acc = 0; let aNode: Text | null = null; let aOff = 0; let bNode: Text | null = null; let bOff = 0;
		for (const t of texts) {
			const len = t.nodeValue?.length ?? 0;
			if (aNode == null && start <= acc + len) { aNode = t; aOff = Math.max(0, start - acc); }
			if (bNode == null && end <= acc + len) { bNode = t; bOff = Math.max(0, end - acc); break; }
			acc += len;
		}
		if (!aNode) { aNode = texts[0]; aOff = 0; }
		if (!bNode) { const last = texts[texts.length - 1]; bNode = last; bOff = (last?.nodeValue?.length ?? 0); }
		const r = document.createRange();
		r.setStart(aNode as Node, aOff);
		r.setEnd(bNode as Node, bOff);
		const sel = window.getSelection(); if (!sel) return; sel.removeAllRanges(); sel.addRange(r);
	};

	// keep selection even when clicking outside editor
	// (removed reselect on outside click to avoid stealing focus from other UI)

	return (
		<div className="w-full">
			{layout === 'tabs' ? (
				<>
					{/* Tabs */}
					<div className="flex items-center gap-2 mb-3 border-b">
						<button onClick={() => setActiveTab('editor')} className={`px-3 py-2 text-sm ${activeTab==='editor' ? 'border-b-2 border-blue-600 text-blue-700 font-semibold' : 'text-gray-600 hover:text-gray-800'}`}>편집</button>
						{!hideChat && (
							<button onClick={() => setActiveTab('chat')} className={`px-3 py-2 text-sm ${activeTab==='chat' ? 'border-b-2 border-blue-600 text-blue-700 font-semibold' : 'text-gray-600 hover:text-gray-800'}`}>채팅</button>
						)}
					</div>

					{activeTab === 'editor' ? (
						<div className="bg-white rounded-xl shadow-lg p-4">
							<div className="flex items-center justify-between mb-3">
								<div className="flex items-center gap-3">
									{sections.length > 0 && (
										<div className="flex items-center gap-2">
											<select
												className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
												value={activeIdx}
												onChange={(e) => { const idx = Number(e.target?.value ?? 0); setActiveIdx(idx); setSelRange({ start: 0, end: 0 }); overlayRectsRef.current = []; clearPreviewMarks(); requestAnimationFrame(() => editorRef.current?.focus()); }}
												aria-label="질문 선택"
											>
												{sections.map((s, i) => (<option key={s.id} value={i} title={s.title}>{s.title}</option>))}
											</select>
										</div>
									)}
									{sections.length === 0 && (
										<button onClick={() => { const parsed = parseSectionsFromText(getCurrent()); if (parsed.length > 0) { setSections(parsed); setActiveIdx(0); setSelRange({ start: 0, end: 0 }); overlayRectsRef.current = []; clearPreviewMarks(); } }} className="px-3 py-1.5 text-xs border rounded-md hover:bg-gray-50">질문 자동 분리</button>
									)}
								</div>
								<div className="flex items-center gap-2">
									<button onClick={handleUndo} disabled={!canUndoNow} className={`px-2 py-1.5 rounded-md border ${canUndoNow ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'}`} title="되돌리기"><Undo2 className="w-4 h-4" /></button>
									<button onClick={handleRedo} disabled={!canRedoNow} className={`px-2 py-1.5 rounded-md border ${canRedoNow ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'}`} title="다시 실행"><Redo2 className="w-4 h-4" /></button>
									<button onClick={downloadWord} className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50"><Download className="w-4 h-4 inline mr-1" />Word로 다운로드</button>
								</div>
							</div>
							{currentQuestionTitle && (
								<div className="mb-2 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-800 whitespace-pre-wrap break-words">{currentQuestionTitle}</div>
							)}
							<div className="flex items-center gap-2">
								<label className="flex items-center gap-2 text-sm text-gray-700">
									<input type="checkbox" checked={selectionOnly} onChange={(e) => setSelectionOnly(e.target.checked)} />
									<span className="flex items-center gap-1"><Scissors className="w-4 h-4" /> 선택 영역만 수정</span>
								</label>
								{selectionOnly && (
									<span className={`text-xs px-2 py-1 rounded-full ${hasSelection ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{hasSelection ? `선택됨 ${selRange.end - selRange.start}자` : '선택 없음'}</span>
								)}
							</div>
						</div>
					) : null}

					{activeTab === 'editor' ? (
						<div className="relative mt-3">
							<div ref={overlayRef} className="pointer-events-none absolute inset-0 rounded-lg overflow-hidden" style={{ zIndex: 2 }} />
							<div
								ref={editorRef}
								contentEditable
								spellCheck={false}
								suppressContentEditableWarning
								onKeyDown={(e) => { const isMac = navigator.platform.toUpperCase().includes('MAC'); const ctrl = isMac ? e.metaKey : e.ctrlKey; if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) { handleRedo(); } else { handleUndo(); } } }}
								onMouseDown={() => { if (selectionOnly) { setSelRange({ start: 0, end: 0 }); clearPreviewMarks(); overlayRectsRef.current = []; } }}
								onInput={handleEditorInput}
								onKeyUp={() => { if (!editorRef.current) return; const off = getOffsetsInEditable(editorRef.current); if (off && off.end > off.start) setSelRange(off); applyPreviewHighlight(); }}
								onMouseUp={() => { if (!editorRef.current) return; const off = getOffsetsInEditable(editorRef.current); if (off && off.end > off.start) { setSelRange(off); try { const s = window.getSelection(); if (s) s.removeAllRanges(); } catch {} } applyPreviewHighlight(); }}
								onBlur={() => renderOverlayFromRects()}
								onFocus={() => { if (selectionOnly && selRange.end > selRange.start) { applyPreviewHighlight(); } }}
								onScroll={() => applyPreviewHighlight()}
								className={`ai-editor relative w-full p-4 ${autoGrow ? 'overflow-visible' : 'overflow-auto'} border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none whitespace-pre-wrap break-words`}
								style={{ outline: 'none', zIndex: 1, height: autoGrow ? 'auto' : height }}
							/>
							<div className="pointer-events-none absolute bottom-2 right-2 text-xs text-gray-400 bg-white/70 rounded px-2 py-0.5 border border-gray-200">{getCurrent().length}자</div>
						</div>
					) : (
						<div className="bg-white rounded-xl shadow-lg p-4" style={{ height: height + CHAT_EXTRA_TOP + CHAT_INPUT_ZONE }}>
							{!hideChat && (
								<div className="flex-1 overflow-y-auto space-y-3 pr-1 border border-gray-200 rounded-lg p-3 bg-white" style={{ height: height + CHAT_EXTRA_TOP }}>
									{getCurrentMessages().length === 0 && (
										<div className="text-sm text-gray-500">예) “2문장 줄여줘”, “경험 중심으로 더 구체화”, “마지막 문단 톤을 겸손하게”</div>
									)}
									{getCurrentMessages().map((m, i) => (
										<div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
											<div className={(m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800') + ' inline-block px-3 py-2 rounded-lg text-sm max-w-[90%]'}>
												<ReactMarkdown
													components={{
														code: ({className, children, ...props}: any) => {
															const text = Array.isArray(children) ? children.join('') : String(children ?? '');
															const isBlock = (typeof className === 'string' && className.includes('language-')) || text.includes('\n');
															return isBlock ? (
																<pre className="overflow-x-auto p-2 bg-gray-900 text-gray-100 rounded-md text-xs"><code className={className} {...props}>{children}</code></pre>
															) : (
																<code className="px-1 py-0.5 rounded bg-gray-200 text-gray-900" {...props}>{children}</code>
															);
														},
														p: ({children}: any) => <p className="whitespace-pre-wrap leading-relaxed">{children}</p>
													}}
												>
													{m.content}
												</ReactMarkdown>
											</div>
										</div>
									))}
								</div>
							)}
							{!hideChat && (
								<form onSubmit={handleSend} className={fixedChatInput ? "fixed left-1/2 -translate-x-1/2 bottom-6 z-40 w-full max-w-2xl px-4" : "mt-3"}>
									<div className={fixedChatInput ? "flex items-stretch gap-2 bg-white/90 backdrop-blur border border-gray-200 rounded-xl p-2 shadow-lg" : "flex items-stretch gap-2"}>
										<textarea ref={chatInputRef} value={input} onChange={(e) => { setInput(e.target.value); autoResizeChatInput(); }} onFocus={autoResizeChatInput} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} rows={1} placeholder="AI에게 수정 지시를 입력하세요…" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-6 overflow-hidden" />
										<button type="submit" disabled={loading || (!getCurrent().trim() && !(selectionOnly && hasSelection))} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:bg-gray-300 flex items-center gap-1">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} 보내기</button>
									</div>
								</form>
							)}
						</div>
					)}
				</>
			) : (
				/* split layout */
				<div className="grid grid-cols-12 gap-4">
					<div className="col-span-8">
						<div className="bg-white rounded-xl shadow-lg p-4">
							<div className="flex items-center justify-between mb-3">
								<div className="flex items-center gap-3">
									{sections.length > 0 && (
										<div className="flex items-center gap-2">
											<select className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50" value={activeIdx} onChange={(e) => { const idx = Number(e.target?.value ?? 0); setActiveIdx(idx); setSelRange({ start: 0, end: 0 }); overlayRectsRef.current = []; clearPreviewMarks(); requestAnimationFrame(() => editorRef.current?.focus()); }} aria-label="질문 선택">
												{sections.map((s, i) => (<option key={s.id} value={i} title={s.title}>{s.title}</option>))}
											</select>
										</div>
									)}
									{sections.length === 0 && (
										<button onClick={() => { const parsed = parseSectionsFromText(getCurrent()); if (parsed.length > 0) { setSections(parsed); setActiveIdx(0); setSelRange({ start: 0, end: 0 }); overlayRectsRef.current = []; clearPreviewMarks(); } }} className="px-3 py-1.5 text-xs border rounded-md hover:bg-gray-50">질문 자동 분리</button>
									)}
								</div>
								<div className="flex items-center gap-2">
									<button onClick={handleUndo} disabled={!canUndoNow} className={`px-2 py-1.5 rounded-md border ${canUndoNow ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'}`} title="되돌리기"><Undo2 className="w-4 h-4" /></button>
									<button onClick={handleRedo} disabled={!canRedoNow} className={`px-2 py-1.5 rounded-md border ${canRedoNow ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'}`} title="다시 실행"><Redo2 className="w-4 h-4" /></button>
									<button onClick={downloadWord} className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50"><Download className="w-4 h-4 inline mr-1" />Word로 다운로드</button>
								</div>
							</div>
							{currentQuestionTitle && (<div className="mb-2 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-800 whitespace-pre-wrap break-words">{currentQuestionTitle}</div>)}
							<div className="flex items-center gap-2">
								<label className="flex items-center gap-2 text-sm text-gray-700">
									<input type="checkbox" checked={selectionOnly} onChange={(e) => setSelectionOnly(e.target.checked)} />
									<span className="flex items-center gap-1"><Scissors className="w-4 h-4" /> 선택 영역만 수정</span>
								</label>
								{selectionOnly && (<span className={`text-xs px-2 py-1 rounded-full ${hasSelection ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{hasSelection ? `선택됨 ${selRange.end - selRange.start}자` : '선택 없음'}</span>)}
							</div>
						</div>
						<div className="relative mt-3">
							<div ref={overlayRef} className="pointer-events-none absolute inset-0 rounded-lg overflow-hidden" style={{ zIndex: 2 }} />
							<div
								ref={editorRef}
								contentEditable
								spellCheck={false}
								suppressContentEditableWarning
								onMouseDown={() => { if (selectionOnly) { setSelRange({ start: 0, end: 0 }); clearPreviewMarks(); overlayRectsRef.current = []; } }}
								onInput={handleEditorInput}
								onKeyUp={() => { if (!editorRef.current) return; const off = getOffsetsInEditable(editorRef.current); if (off && off.end > off.start) setSelRange(off); applyPreviewHighlight(); }}
								onMouseUp={() => { if (!editorRef.current) return; const off = getOffsetsInEditable(editorRef.current); if (off && off.end > off.start) setSelRange(off); applyPreviewHighlight(); }}
								onBlur={() => renderOverlayFromRects()}
								onFocus={() => { if (selectionOnly && selRange.end > selRange.start) { applyPreviewHighlight(); } }}
								onScroll={() => applyPreviewHighlight()}
								className={`ai-editor relative w-full p-4 ${autoGrow ? 'overflow-visible' : 'overflow-auto'} border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none whitespace-pre-wrap break-words`}
								style={{ outline: 'none', zIndex: 1, height: autoGrow ? 'auto' : height }}
							/>
							<div className="pointer-events-none absolute bottom-2 right-2 text-xs text-gray-400 bg-white/70 rounded px-2 py-0.5 border border-gray-200">{getCurrent().length}자</div>
						</div>
					</div>
					<div className="col-span-4">
						{!hideChat && (
							<div className="bg-white rounded-xl shadow-lg p-4" style={{ height: height + CHAT_EXTRA_TOP + CHAT_INPUT_ZONE }}>
								<div className="flex-1 overflow-y-auto space-y-3 pr-1 border border-gray-200 rounded-lg p-3 bg-white" style={{ height: height + CHAT_EXTRA_TOP }}>
									{getCurrentMessages().length === 0 && (<div className="text-sm text-gray-500">예) “2문장 줄여줘”, “경험 중심으로 더 구체화”, “마지막 문단 톤을 겸손하게”</div>)}
									{getCurrentMessages().map((m, i) => (
										<div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
											<div className={(m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800') + ' inline-block px-3 py-2 rounded-lg text-sm max-w-[90%]'}>
												<ReactMarkdown
													components={{
														code: ({className, children, ...props}: any) => {
															const text = Array.isArray(children) ? children.join('') : String(children ?? '');
															const isBlock = (typeof className === 'string' && className.includes('language-')) || text.includes('\n');
															return isBlock ? (
																<pre className="overflow-x-auto p-2 bg-gray-900 text-gray-100 rounded-md text-xs"><code className={className} {...props}>{children}</code></pre>
															) : (
																<code className="px-1 py-0.5 rounded bg-gray-200 text-gray-900" {...props}>{children}</code>
															);
														},
														p: ({children}: any) => <p className="whitespace-pre-wrap leading-relaxed">{children}</p>
													}}
												>
													{m.content}
												</ReactMarkdown>
											</div>
										</div>
									))}
								</div>
								<form onSubmit={handleSend} className={fixedChatInput ? "fixed left-1/2 -translate-x-1/2 bottom-6 z-40 w-full max-w-2xl px-4" : "mt-3"}>
									<div className={fixedChatInput ? "flex items-stretch gap-2 bg-white/90 backdrop-blur border border-gray-200 rounded-xl p-2 shadow-lg" : "flex items-stretch gap-2"}>
										<textarea ref={chatInputRef} value={input} onChange={(e) => { setInput(e.target.value); autoResizeChatInput(); }} onFocus={autoResizeChatInput} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} rows={1} placeholder="AI에게 수정 지시를 입력하세요…" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-6 overflow-hidden" />
										<button type="submit" disabled={loading || (!getCurrent().trim() && !(selectionOnly && hasSelection))} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:bg-gray-300 flex items-center gap-1">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} 보내기</button>
									</div>
								</form>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
