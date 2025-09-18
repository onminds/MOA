"use client";
import { useState } from "react";
import ReportWriterViewer from "@/components/ReportWriterViewer";
import { Loader2, ArrowLeft } from "lucide-react";
import Header from '../../components/Header';
import { useRouter } from 'next/navigation';
import { useToast } from "@/contexts/ToastContext";
import { createUsageToastData, createUsageToastMessage } from "@/lib/toast-utils";

export default function ReportWriterBuilder() {
  const router = useRouter();
  const { showToast } = useToast();
  const [topic, setTopic] = useState("");
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [attachmentsText, setAttachmentsText] = useState<string>("");
  const [state, setState] = useState<any>({
    title: "",
    summary: "",
    toc: [],
    sections: [],
    sources: [],
    meta: { createdAt: new Date(), sourceCount: 0 }
  });

  async function extractAttachments(files: File[]): Promise<string> {
    const fd = new FormData();
    files.slice(0, 1).forEach(f => fd.append('file', f));
    const resp = await fetch('/api/report-writers/attachments', { method: 'POST', body: fd });
    if (!resp.ok) {
      const msg = await resp.text().catch(() => '');
      throw new Error(`첨부 추출 실패: ${resp.status} ${msg}`);
    }
    const data = await resp.json();
    return data.attachmentsText || '';
  }

  const start = async () => {
    if (!topic.trim()) {
      setError("주제를 입력해주세요.");
      return;
    }

    setLoading(true);
    setError("");
    setState({
      title: "",
      summary: "",
      toc: [],
      sections: [],
      sources: [],
      meta: { createdAt: new Date(), sourceCount: 0 }
    });

    try {
      let attText = '';
      if (attachedFiles.length > 0) {
        attText = await extractAttachments(attachedFiles);
        setAttachmentsText(attText);
      }

      const response = await fetch("/api/report-writers/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, domain, attachmentsText: attText }),
      });

      if (!response.ok) {
        // 429 등 명확한 에러 응답 바디 처리
        try {
          const errJson = await response.json();
          if (response.status === 429) {
            const currentUsage = typeof errJson?.currentUsage === 'number' ? errJson.currentUsage : 0;
            const maxLimit = typeof errJson?.maxLimit === 'number' ? errJson.maxLimit : 0;
            const toastData = createUsageToastData('report-writers', currentUsage, maxLimit);
            const resetText = errJson?.resetDate ? `\n재설정: ${new Date(errJson.resetDate).toLocaleString('ko-KR')}` : '';
            showToast({
              type: 'error',
              title: `${toastData.serviceName} 한도 초과`,
              message: `${createUsageToastMessage(toastData)}${resetText}`,
              duration: 6000
            });
            setError(errJson?.error || '사용량 한도를 초과했습니다.');
          } else if (response.status === 401) {
            showToast({
              type: 'warning',
              title: '로그인이 필요합니다',
              message: '로그인 후 다시 시도해주세요.',
              duration: 4000
            });
            setError(errJson?.error || '로그인이 필요합니다.');
          } else {
            showToast({
              type: 'error',
              title: '요청 실패',
              message: errJson?.error || `요청 실패 (HTTP ${response.status})`,
              duration: 5000
            });
            setError(errJson?.error || `요청 실패 (HTTP ${response.status})`);
          }
        } catch {
          setError(`요청 실패 (HTTP ${response.status})`);
        }
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("스트림을 읽을 수 없습니다.");

      const decoder = new TextDecoder();
      let lineCount = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (!line.trim()) continue;
          lineCount++;
          console.log(`라인 ${lineCount}:`, line);
          
          try {
            // 'data: ' 접두사 제거
            const jsonLine = line.startsWith('data: ') ? line.substring(6) : line;
            const evt = JSON.parse(jsonLine);
            console.log("이벤트 타입:", evt.type, evt.data ? "데이터 있음" : "데이터 없음");
            
            if (evt.type === "meta") {
              setState((s: any) => ({ ...s, toc: evt.data.toc, sources: evt.data.sources, meta: { ...s.meta, sourceCount: evt.data.sources?.length || 0 } }));
              console.log("메타데이터 수신:", evt.data);
            } else if (evt.type === "section") {
              setState((s: any) => ({ ...s, sections: [...s.sections, evt.data] }));
              console.log("섹션 수신:", evt.data.id, evt.data.title);
            } else if (evt.type === "usage") {
              const toastData = createUsageToastData('report-writers', evt.data.current, evt.data.limit);
              showToast({
                type: 'success',
                title: `${toastData.serviceName} 사용`,
                message: createUsageToastMessage(toastData),
                duration: 5000
              });
            } else if (evt.type === "done") {
              setState((s: any) => ({ ...s, title: evt.data.title, summary: evt.data.summary, meta: { ...s.meta, model: evt.data.model } }));
              console.log("완료 수신:", evt.data);
            } else if (evt.type === "error") {
              throw new Error(evt.error || "스트리밍 에러");
            }
          } catch (parseError) {
            console.error("JSON 파싱 에러:", parseError, "라인:", line);
            throw new Error(`JSON 파싱 실패: ${parseError}`);
          }
        }
      }
      
      console.log("스트리밍 완료, 총 라인:", lineCount);
    } catch (e: any) {
      console.error("스트리밍 에러:", e);
      setError(e.message || "알 수 없는 에러");
    } finally {
      setLoading(false);
    }
  };

  const canView = state.sections.length > 0;

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
        <div className="max-w-6xl mx-auto p-8">
          {/* 돌아가기 버튼 */}
          <div className="mb-8">
            <button 
              onClick={() => router.push('/productivity')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              생산성 도구로 돌아가기
            </button>
          </div>

          {/* 메인 콘텐츠 영역 */}
          {!canView ? (
            <div className="flex flex-col items-center justify-center h-full pt-20 mb-16">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-900 mb-6">AI 레포트 작성</h1>
                <p className="text-lg text-gray-600">
                  주제만으로 인용이 달린 섹션형 레포트를 생성하고, 실시간으로 진행 상황을 확인할 수 있습니다.
                </p>
              </div>
            </div>
          ) : null}

          {/* 입력 폼 */}
          <div className="bg-white rounded-2xl p-6 shadow border border-gray-100 mb-8 w-full max-w-4xl mx-auto">
            <label className="block text-sm font-medium text-gray-700 mb-2">레포트 주제 <span className="text-red-500" aria-hidden="true">*</span><span className="sr-only">(필수)</span></label>
            <input 
              value={topic} 
              onChange={(e) => setTopic(e.target.value)} 
              placeholder="예: 한국 푸드테크 시장 규모와 전망" 
              className="w-full border rounded-lg p-3" 
            />

            {/* 도메인/유형 옵션 */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">분야/보고서 유형 (선택사항)</label>
              <input 
                value={domain} 
                onChange={(e) => setDomain(e.target.value)} 
                placeholder="예: 시장(마켓리서치), 기술 리뷰, 학술 요약, 제품 비교, 뉴스 브리핑, 가이드" 
                className="w-full border rounded-lg p-3 text-sm" 
              />
            </div>

            {/* 참고자료 업로드 (단일 파일) */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                참고자료 첨부(.pdf,.doc,.docx,.ppt,.pptx,.txt - 1개)
              </label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
                onChange={(e) => {
                  const file = (e.target.files && e.target.files[0]) || null;
                  setAttachedFiles(file ? [file] : []);
                  setAttachmentsText('');
                }}
                className="w-full border rounded-lg p-3 text-sm"
              />
              {attachedFiles.length > 0 && (
                <div className="mt-2 text-xs text-gray-600">
                  선택됨: {attachedFiles[0]?.name}
                </div>
              )}
            </div>

            <div className="mt-6">
              <button 
                onClick={start} 
                disabled={loading} 
                className="px-5 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin"/>
                    생성 중…
                  </span>
                ) : (
                  "레포트 생성"
                )}
              </button>
              {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
            </div>
          </div>

          {/* 결과 표시 */}
          {canView && (
            <div className="bg-white rounded-2xl shadow border border-gray-100">
              {/* 진행률 표시 */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between text-sm text-blue-700 mb-2">
                  {(() => { const total = state.toc.length || 0; const done = state.sections.length || 0; const pct = total > 0 ? Math.round((done / total) * 100) : 0; return (
                    <>
                      <span>생성 진행률: {done}/{total} 섹션 완료</span>
                      <span>{pct}%</span>
                    </>
                  ); })()}
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  {(() => { const total = state.toc.length || 0; const done = state.sections.length || 0; const pct = total > 0 ? (done / total) * 100 : 0; return (
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${pct}%` }}
                    ></div>
                  ); })()}
                </div>
              </div>
              <ReportWriterViewer report={state as any} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
