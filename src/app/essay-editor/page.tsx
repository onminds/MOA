"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/Header";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Loader2, Send, Download, Scissors, Undo2, Redo2 } from "lucide-react";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

type ChatMessage = { role: "user" | "assistant"; content: string };

function EssayEditorInner() {
	const params = useSearchParams();
	const router = useRouter();
	const isEmbed = params?.get('embed') === '1';

	const [content, setContent] = useState("");
	// 섹션별 메시지 스레드 관리 (키: 섹션 id 또는 'single')
	const [messagesBySection, setMessagesBySection] = useState<Record<string, ChatMessage[]>>({});
	const [input, setInput] = useState("");
	const [loading, setLoading] = useState(false);
	const [autoApply, setAutoApply] = useState(true);
	const [selectionOnly, setSelectionOnly] = useState(false);
	const [title, setTitle] = useState<string | null>(null);
	const [sections, setSections] = useState<Array<{ id: number; title: string; text: string }>>([]);
	const [activeIdx, setActiveIdx] = useState(0);
	const [historyBySection, setHistoryBySection] = useState<Record<string, string[]>>({});
	const [redoBySection, setRedoBySection] = useState<Record<string, string[]>>({});

	const parseSectionsFromText = (text: string): Array<{ id: number; title: string; text: string }> => {
		const results: Array<{ id: number; title: string; text: string }> = [];
		if (!text || text.trim().length === 0) return results;
		try {
			// 패턴 1: [질문 N] 제목 [답변 시작] 내용
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
			// 백업: [질문 N]으로만 분할
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
	const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
	const overlayRef = useRef<HTMLDivElement | null>(null);
	const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
	const [selRange, setSelRange] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
	const editorRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const preload = params?.get("text");
		const storageKey = params?.get("storageKey");
		const t = params?.get("title");
		if (t) setTitle(t);
		if (preload) setContent(preload);
		if (!preload && storageKey && typeof window !== 'undefined') {
			try {
				let stored = sessionStorage.getItem(storageKey);
				// iframe 등 다른 browsing context에서 전달된 경우 localStorage 폴백 지원
				if (!stored) {
					stored = localStorage.getItem(storageKey) || '';
				}
				if (stored) setContent(stored);
			} catch {}
		}
		// 섹션 배열 전달 지원: sectionsKey(JSON)
		const sectionsKey = params?.get('sectionsKey');
		if (sectionsKey && typeof window !== 'undefined') {
			try {
				const raw = sessionStorage.getItem(sectionsKey);
				if (raw) {
					const parsed = JSON.parse(raw);
					if (Array.isArray(parsed)) {
						const mapped = parsed.map((p: any, i: number) => ({ id: Date.now() + i, title: String(p.title || `질문 ${i + 1}`), text: String(p.text || '') }));
						if (mapped.length > 0) setSections(mapped);
					}
				}
			} catch {}
		}
		// 단일 제목 + 본문이 들어온 경우, 단일 섹션으로 초기화 가능
		if (!sectionsKey && t && (preload || storageKey)) {
			setSections([{ id: Date.now(), title: t, text: preload || content }]);
		}
	}, [params]);

	// 자동 분리: content가 있고 섹션이 비어 있으며 [질문 N] 패턴이 감지되면 섹션 생성
	useEffect(() => {
		if (sections.length === 0 && content && /\[질문\s+\d+\]/.test(content)) {
			const parsed = parseSectionsFromText(content);
			if (parsed.length > 0) {
				setSections(parsed);
				setActiveIdx(0);
			}
		}
	}, [content]);

	const hasSelection = useMemo(() => selRange.end > selRange.start, [selRange]);

	const currentQuestionTitle = useMemo(() => {
		if (sections.length > 0) {
			const idx = Math.max(0, Math.min(activeIdx, sections.length - 1));
			return sections[idx]?.title || '';
		}
		return title || '';
	}, [sections, activeIdx, title]);

	// contenteditable helpers
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
		let acc = 0; let start = 0; let end = 0; let sawStart = false;
		for (const t of getTextNodes(root)) {
			const len = t.nodeValue?.length ?? 0;
			if (!sawStart && t === range.startContainer) { start = acc + Math.min(range.startOffset, len); sawStart = true; }
			if (t === range.endContainer) { end = acc + Math.min(range.endOffset, len); break; }
			acc += len;
		}
		if (!sawStart) return null;
		return { start, end };
	};

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
		const sel = window.getSelection();
		if (!sel) return;
		sel.removeAllRanges();
		sel.addRange(r);
	};

	const createRangeFromOffsets = (root: HTMLElement, start: number, end: number): Range | null => {
		const texts = getTextNodes(root);
		let acc = 0; let aNode: Text | null = null; let aOff = 0; let bNode: Text | null = null; let bOff = 0;
		for (const t of texts) {
			const len = t.nodeValue?.length ?? 0;
			if (aNode == null && start <= acc + len) { aNode = t; aOff = Math.max(0, start - acc); }
			if (bNode == null && end <= acc + len) { bNode = t; bOff = Math.max(0, end - acc); break; }
			acc += len;
		}
		if (!aNode || !bNode) return null;
		const r = document.createRange();
		r.setStart(aNode as Node, aOff);
		r.setEnd(bNode as Node, bOff);
		return r;
	};

	const clearPreviewMarks = () => {
		if (!overlayRef.current) return;
		overlayRef.current.innerHTML = '';
	};

	// Persisted overlay rects (relative to editor content box, before scroll offsets)
	const overlayRectsRef = useRef<Array<{ x: number; y: number; w: number; h: number }>>([]);

	const renderOverlayFromRects = () => {
		if (!overlayRef.current || !editorRef.current) return;
		const scrollTop = editorRef.current.scrollTop;
		const scrollLeft = editorRef.current.scrollLeft;
		const frag = document.createDocumentFragment();
		for (const r of overlayRectsRef.current) {
			// 배경 하이라이트(더 높은 대비 - 노란색)
			const bg = document.createElement('div');
			bg.style.position = 'absolute';
			bg.style.left = `${r.x + scrollLeft}px`;
			bg.style.top = `${r.y + scrollTop}px`;
			bg.style.width = `${r.w}px`;
			bg.style.height = `${r.h}px`;
			bg.style.background = 'rgba(147,197,253,0.22)'; // blue-300 @ ~22%
			bg.style.border = '1px solid rgba(59,130,246,0.6)'; // blue-500 border
			bg.style.borderRadius = '3px';
			frag.appendChild(bg);

			// 밑줄 제거: 배경 하이라이트만 유지
		}
		overlayRef.current.innerHTML = '';
		overlayRef.current.appendChild(frag);
	};

	const applyPreviewHighlight = () => {
		if (!editorRef.current || !overlayRef.current) { clearPreviewMarks(); overlayRectsRef.current = []; return; }
		if (!selectionOnly) { clearPreviewMarks(); overlayRectsRef.current = []; return; }
		const root = editorRef.current;
		const sel = window.getSelection();
		let updated = false;
		if (sel && sel.rangeCount > 0) {
			const range = sel.getRangeAt(0);
			if (root.contains(range.startContainer) && root.contains(range.endContainer) && !range.collapsed) {
				// 실제 선택 범위를 기준으로 좌표 저장(컨테이너 기준)
				const clientRects = Array.from(range.getClientRects());
				const containerRect = root.getBoundingClientRect();
				overlayRectsRef.current = clientRects.map((cr) => ({ x: cr.left - containerRect.left, y: cr.top - containerRect.top, w: cr.width, h: cr.height }));
				updated = true;
			}
		}
		if (!updated) {
			// 기존 좌표를 그대로 재렌더
			if (overlayRectsRef.current.length === 0) { clearPreviewMarks(); return; }
		}
		renderOverlayFromRects();
	};

	// Throttle selectionchange-driven work
	const selTimerRef = useRef<number | null>(null);
	const handleSelectionUpdateThrottled = () => {
		if (selTimerRef.current) {
			clearTimeout(selTimerRef.current as number);
		}
		selTimerRef.current = window.setTimeout(() => {
			if (editorRef.current) {
				const off = getOffsetsInEditable(editorRef.current);
				if (off && off.end > off.start) setSelRange(off);
				applyPreviewHighlight();
				return;
			}
			const el = textAreaRef.current;
			if (el) setSelRange({ start: el.selectionStart, end: el.selectionEnd });
		}, 80);
	};

	const handleSelectionUpdate = () => {
		if (editorRef.current) {
			const off = getOffsetsInEditable(editorRef.current);
			if (off && off.end > off.start) {
				setSelRange(off);
			} else {
				// 에디터 내부에서 선택이 접힌 경우: 저장 범위 및 오버레이 초기화
				setSelRange({ start: 0, end: 0 });
				clearPreviewMarks();
				overlayRectsRef.current = [];
			}
			applyPreviewHighlight();
			return;
		}
		const el = textAreaRef.current;
		if (el) setSelRange({ start: el.selectionStart, end: el.selectionEnd });
	};

	// 현재 선택 범위를 다시 강조(재선택)
	const reselectCurrentRange = () => {
		if (editorRef.current) {
			const { start, end } = selRange;
			setEditableSelection(editorRef.current as HTMLElement, start, end);
			(editorRef.current as HTMLElement).focus();
			applyPreviewHighlight();
			return;
		}
		const el = textAreaRef.current;
		if (!el) return;
		const start = selRange.start; const end = selRange.end;
		el.focus(); el.selectionStart = start; el.selectionEnd = end;
	};

	const getCurrent = () => {
		if (sections.length > 0) {
			return sections[Math.max(0, Math.min(activeIdx, sections.length - 1))]?.text || '';
		}
		return content;
	};

	const setCurrent = (nextText: string) => {
		if (sections.length > 0) {
			setSections(prev => {
				const copy = [...prev];
				if (!copy[activeIdx]) return prev;
				copy[activeIdx] = { ...copy[activeIdx], text: nextText };
				return copy;
			});
			return;
		}
		setContent(nextText);
	};

	const getSelectedText = () => getCurrent().slice(selRange.start, selRange.end);

	const buildPrompt = (userInstruction: string) => {
		if (selectionOnly && hasSelection) {
			const selected = getSelectedText();
			return [
				"다음은 자기소개서의 일부 단락입니다.",
				"사용자의 지시를 반영해 이 단락만 자연스럽게 고쳐 주세요.",
				"- 의미는 유지하되 간결성/가독성/설득력을 개선",
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
			content,
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

	const applyRevision = (revised: string) => {
		if (selectionOnly && hasSelection) {
			const current = getCurrent();
			const before = current.slice(0, selRange.start);
			const after = current.slice(selRange.end);
			const next = before + revised + after;
			setCurrent(next);
			const start = before.length;
			const end = before.length + revised.length;
			requestAnimationFrame(() => {
				if (textAreaRef.current) {
					textAreaRef.current.focus();
					textAreaRef.current.selectionStart = start;
					textAreaRef.current.selectionEnd = end;
				}
			});
		} else {
			setCurrent(revised);
			requestAnimationFrame(() => textAreaRef.current?.focus());
		}
	};

	const handleSend = async (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		const question = input.trim();
		if (!question) return;
		if (!content.trim() && !(selectionOnly && hasSelection)) {
			alert("수정할 본문이 없습니다. 먼저 자기소개서 본문을 입력해 주세요.");
			return;
		}
		setLoading(true);

		const userMsg: ChatMessage = { role: "user", content: question };
		pushMessage(userMsg);
		setInput("");

		try {
			// 선택 영역만 수정이면 해당 부분만 텍스트로 보냄
			const baseText = getCurrent();
			const targetText = selectionOnly && hasSelection ? getSelectedText() : baseText;
			const res = await fetch("/api/essay-edit", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ content: targetText, instruction: question }),
			});
			const data = await res.json();
			const raw = data?.revised ?? "";
			const revised = stripFences(raw);
			const assistantMsg: ChatMessage = { role: "assistant", content: revised };
			pushMessage(assistantMsg);

			if (autoApply) {
				// 적용 전 현재 텍스트를 히스토리에 저장
				pushHistory(baseText);
				applyRevision(revised);
			}
		} catch (err) {
			const assistantMsg: ChatMessage = { role: "assistant", content: "오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
			pushMessage(assistantMsg);
		} finally {
			setLoading(false);
		}
	};



	const downloadWord = async () => {
		const children: Paragraph[] = [];
		const docTitle = title || "자기소개서";
		children.push(new Paragraph({ text: docTitle, heading: HeadingLevel.TITLE }));
		children.push(new Paragraph({ text: " " }));

		const addText = (text: string) => {
			(text || "").split(/\n/).forEach(line => {
				children.push(new Paragraph({ children: [new TextRun(line)] }));
			});
			children.push(new Paragraph({ text: " " }));
		};

		if (sections.length > 0) {
			sections.forEach(s => {
				children.push(new Paragraph({ text: s.title || "문항", heading: HeadingLevel.HEADING_2 }));
				addText(s.text);
			});
		} else {
			addText(content);
		}

		const doc = new Document({ sections: [{ children }] });
		const blob = await Packer.toBlob(doc);
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${docTitle.replace(/\s+/g, "_")}_${Date.now()}.docx`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const autoResizeChatInput = () => {
		const el = chatInputRef.current;
		if (!el) return;
		el.style.height = "auto";
		const next = Math.min(el.scrollHeight, 192); // 최대 12rem
		el.style.height = `${next}px`;
	};

	// 현재 섹션/싱글 키
	const getActiveKey = () => {
		if (sections.length > 0) {
			const idx = Math.max(0, Math.min(activeIdx, sections.length - 1));
			const id = sections[idx]?.id;
			return String(id ?? 'single');
		}
		return 'single';
	};

	const getCurrentMessages = (): ChatMessage[] => {
		const key = getActiveKey();
		return messagesBySection[key] || [];
	};

	const pushMessage = (msg: ChatMessage) => {
		const key = getActiveKey();
		setMessagesBySection(prev => ({
			...prev,
			[key]: [...(prev[key] || []), msg]
		}));
	};

	const pushHistory = (prevText: string) => {
		const key = getActiveKey();
		setHistoryBySection(prev => ({
			...prev,
			[key]: ([...(prev[key] || []), prevText]).slice(-20)
		}));
		// 새 히스토리가 추가되면 앞으로 가기 스택은 무효화
		setRedoBySection(prev => ({ ...prev, [key]: [] }));
	};

	const canUndo = (): boolean => {
		const key = getActiveKey();
		return (historyBySection[key] || []).length > 0;
	};

	const canRedo = (): boolean => {
		const key = getActiveKey();
		return (redoBySection[key] || []).length > 0;
	};

	const undoLast = () => {
		const key = getActiveKey();
		const hist = historyBySection[key] || [];
		if (hist.length === 0) return;
		const last = hist[hist.length - 1];
		const newHist = hist.slice(0, -1);
		const current = getCurrent();
		// 순서를 명확히: 먼저 히스토리/리두 스택 갱신 후 본문 변경
		setHistoryBySection(prev => ({ ...prev, [key]: newHist }));
		setRedoBySection(prev => ({ ...prev, [key]: ([...(prev[key] || []), current]).slice(-20) }));
		setCurrent(last);
		requestAnimationFrame(() => textAreaRef.current?.focus());
	};

	const redoNext = () => {
		const key = getActiveKey();
		const redo = redoBySection[key] || [];
		if (redo.length === 0) return;
		const next = redo[redo.length - 1];
		const newRedo = redo.slice(0, -1);
		const current = getCurrent();
		setRedoBySection(prev => ({ ...prev, [key]: newRedo }));
		setHistoryBySection(prev => ({ ...prev, [key]: ([...(prev[key] || []), current]).slice(-20) }));
		setCurrent(next);
		requestAnimationFrame(() => textAreaRef.current?.focus());
	};

	const currentTextLength = (sections.length > 0 ? (sections[activeIdx]?.text || '') : content).length;

	// selectionchange 동기화 및 초기 동기화
	useEffect(() => {
		const onSel = () => handleSelectionUpdateThrottled();
		document.addEventListener('selectionchange', onSel);
		return () => document.removeEventListener('selectionchange', onSel);
	}, [sections, activeIdx, selectionOnly]);

	// 에디터 DOM을 상태와 동기화(프로그램적 변경 시)
	useEffect(() => {
		if (!editorRef.current) return;
		const text = sections.length > 0 ? (sections[activeIdx]?.text || '') : content;
		const el = editorRef.current;
		// DOM과 상태가 동일하면 재설정하지 않아 커서가 앞으로 튀는 것을 방지
		if (el.innerText !== text) {
			el.innerText = text;
			clearPreviewMarks();
		}
	}, [sections, activeIdx, content]);

	// selRange/selectionOnly/section 변경 시 하이라이트 재적용
	useEffect(() => {
		applyPreviewHighlight();
	}, [selRange, sections, activeIdx, selectionOnly]);

	// selectionOnly 토글이 꺼질 때 즉시 오버레이 제거
	useEffect(() => {
		if (!selectionOnly) { clearPreviewMarks(); overlayRectsRef.current = []; }
	}, [selectionOnly]);

	// 창 크기 변경 시 위치 재계산
	useEffect(() => {
		const onResize = () => applyPreviewHighlight();
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);

	return (
		<>
			{!isEmbed && <Header />}
			<div className={isEmbed ? '' : 'min-h-screen bg-gray-50'}>
				<div className={isEmbed ? 'p-4' : 'p-8 max-w-7xl mx-auto'}>
					{!isEmbed && (
						<div className="mb-6 text-center">
							<h1 className="text-2xl font-bold text-gray-900">{title || '자기소개서 에디터 + AI 수정'}</h1>
							<p className="text-gray-600 mt-2">본문을 직접 편집하고, AI에게 지시하면 즉시 반영됩니다.</p>
						</div>
					)}

					<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
						<div className="lg:col-span-8">
							<div className="bg-white rounded-xl shadow-lg p-4">
								<div className="flex items-center justify-between mb-3">
									{sections.length > 0 && (
										<div className="flex items-center gap-2">
											<select
												className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
												value={activeIdx}
												onChange={(e) => {
													const idx = Number(e.target?.value ?? 0);
													setActiveIdx(idx);
													// 섹션 변경 시 선택/오버레이 초기화
													setSelRange({ start: 0, end: 0 });
													overlayRectsRef.current = [];
													clearPreviewMarks();
													requestAnimationFrame(() => textAreaRef.current?.focus());
												}}
												aria-label="질문 선택"
											>
												{sections.map((s, i) => (
													<option key={s.id} value={i} title={s.title}>
														{s.title}
													</option>
												))}
											</select>
										</div>
									)}
									<div className="flex items-center gap-2">
										{sections.length === 0 && (
											<button
												onClick={() => {
												const parsed = parseSectionsFromText(content);
												if (parsed.length > 0) { 
													setSections(parsed); 
													setActiveIdx(0); 
													// 섹션 생성 시 선택/오버레이 초기화
													setSelRange({ start: 0, end: 0 });
													overlayRectsRef.current = [];
													clearPreviewMarks();
												}
											}}
											className="px-3 py-1.5 text-xs border rounded-md hover:bg-gray-50"
										>
											질문 자동 분리
										</button>
										)}
										<button
											onClick={undoLast}
											disabled={!canUndo()}
											className={`px-2 py-1.5 rounded-md border ${canUndo() ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'}`}
											title="되돌리기"
											aria-label="되돌리기"
										>
											<Undo2 className="w-4 h-4" />
										</button>
										<button
											onClick={redoNext}
											disabled={!canRedo()}
											className={`px-2 py-1.5 rounded-md border ${canRedo() ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'}`}
											title="다시 실행"
											aria-label="다시 실행"
										>
											<Redo2 className="w-4 h-4" />
										</button>
									</div>
								</div>
								<div className="flex items-center justify-between mb-3">
									<div className="flex items-center gap-3">
										<label className="flex items-center gap-2 text-sm text-gray-700">
											<input
												type="checkbox"
												checked={selectionOnly}
												onChange={(e) => setSelectionOnly(e.target.checked)}
											/>
											<span className="flex items-center gap-1">
												<Scissors className="w-4 h-4" /> 선택 영역만 수정
											</span>
										</label>
										{selectionOnly && (
											hasSelection ? (
												<span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
													선택됨 {selRange.end - selRange.start}자
												</span>
											) : (
												<span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">
													선택 없음
												</span>
											)
										)}
									</div>
									<div className="flex items-center gap-2">
										<button onClick={downloadWord} className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50">
											<Download className="w-4 h-4 inline mr-1" />
											Word로 다운로드
										</button>
									</div>
								</div>

								{currentQuestionTitle && (
									<div className="mb-2 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-800 whitespace-pre-wrap break-words">
										{currentQuestionTitle}
									</div>
								)}
								<div className="relative">
									{/* overlay for selection highlight */}
									<div
										ref={overlayRef}
										className="pointer-events-none absolute inset-0 rounded-lg"
										style={{ zIndex: 2 }}
									/>
									<div
										ref={editorRef}
										contentEditable
										suppressContentEditableWarning
										onInput={() => {
											if (!editorRef.current) return;
											const next = editorRef.current.innerText.replace(/\r\n?/g, '\n');
											setCurrent(next);
											// 내용 변경 시 하이라이트 초기화
											clearPreviewMarks();
											overlayRectsRef.current = [];
										}}
										onKeyUp={handleSelectionUpdate}
										onMouseUp={handleSelectionUpdate}
										onBlur={() => applyPreviewHighlight()}
										onFocus={() => applyPreviewHighlight()}
										onScroll={() => renderOverlayFromRects()}
										className="ai-editor relative w-full h-[520px] p-4 overflow-auto border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none whitespace-pre-wrap break-words"
										style={{ outline: 'none', zIndex: 1 }}
									/>
									<div className="pointer-events-none absolute bottom-2 right-2 text-xs text-gray-400 bg-white/70 rounded px-2 py-0.5 border border-gray-200">
										{currentTextLength}자
									</div>
								</div>
							</div>
						</div>

						{/* selection preview panel removed */}

						<div className="lg:col-span-4">
							<div className="bg-white rounded-xl shadow-lg p-4 flex flex-col h-[760px]">
								<div className="flex items-center justify-between mb-2">
									<h3 className="text-lg font-semibold text-gray-900">Haaro chat</h3>
								</div>

								<div className="flex-1 overflow-y-auto space-y-3 pr-1 border border-gray-200 rounded-lg p-3 bg-white">
									{getCurrentMessages().length === 0 && (
										<div className="text-sm text-gray-500">
											예) “2문장 줄여줘”, “경험 중심으로 더 구체화”, “마지막 문단 톤을 겸손하게”
										</div>
									)}
									{getCurrentMessages().map((m, idx) => (
										<div
											key={idx}
											className={m.role === "user" ? "text-right" : "text-left"}
										>
											<div
												className={
													(m.role === "user"
														? "bg-blue-600 text-white"
														: "bg-gray-100 text-gray-800") +
													" inline-block px-3 py-2 rounded-lg text-sm max-w-[90%] whitespace-pre-wrap"
												}
											>
												{m.content}
											</div>
										</div>
									))}
								</div>

								<form onSubmit={handleSend} className="mt-3">
									<div className="flex items-stretch gap-2">
										<textarea
											ref={chatInputRef}
											value={input}
											onChange={(e) => { setInput(e.target.value); autoResizeChatInput(); }}
											onFocus={autoResizeChatInput}
											onKeyDown={(e) => {
												if (e.key === 'Enter' && !e.shiftKey) {
													e.preventDefault();
													handleSend();
												}
											}}
											rows={1}
											placeholder="AI에게 수정 지시를 입력하세요…"
											className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-6 overflow-hidden"
										/>
										<button
											type="submit"
											disabled={loading || (!content.trim() && !(selectionOnly && hasSelection))}
											className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:bg-gray-300 flex items-center gap-1"
										>
											{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
											보내기
										</button>
									</div>
								</form>
							</div>

							{!autoApply && getCurrentMessages().length > 0 && getCurrentMessages()[getCurrentMessages().length - 1].role === "assistant" && (
								<div className="bg-white rounded-xl shadow-lg p-4 mt-4">
									<div className="flex items-center justify-between mb-2">
										<div className="font-semibold text-gray-900 text-sm">AI 수정안</div>
										<div className="flex items-center gap-2">
											<button
												onClick={() => setCurrent(getCurrentMessages()[getCurrentMessages().length - 1].content)}
												className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs hover:bg-blue-700"
											>
												적용
											</button>
											<button
												onClick={() => {
												const key = getActiveKey();
												setMessagesBySection(prev => ({ ...prev, [key]: (prev[key] || []).slice(0, -1) }));
											}}
												className="px-3 py-1.5 border rounded-md text-xs hover:bg-gray-50"
											>
												취소
											</button>
										</div>
									</div>
									<div className="text-sm text-gray-800 whitespace-pre-wrap">
										{getCurrentMessages()[getCurrentMessages().length - 1].content}
										</div>
								</div>
							)}
						</div>
					</div>

					{selectionOnly && (
						<style jsx>{`
							.ai-editor::selection { background: rgba(147,197,253,0.6); }
							.ai-editor *::selection { background: rgba(147,197,253,0.6); }
						`}</style>
					)}
				</div>
			</div>
		</>
	);
}

export default function EssayEditor() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-600">로딩 중…</div>}>
      <EssayEditorInner />
    </Suspense>
  );
}


