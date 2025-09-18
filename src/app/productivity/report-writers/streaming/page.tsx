"use client";
import { useState } from "react";
import { Loader2, Plus, X, Zap } from "lucide-react";
import ReportWriterViewer from "@/components/ReportWriterViewer";

export default function ReportWriterBuilder() {
  const [topic, setTopic] = useState("");
  const [pageCount, setPageCount] = useState(3);
  const [urls, setUrls] = useState<string[]>([""]);
  const [state, setState] = useState<any>({ title: "", summary: "", toc: [], sections: [], sources: [], meta: { sourceCount: 0, createdAt: new Date().toISOString(), model: "" }, id: `sp_${Date.now()}` });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addUrl = () => setUrls((u) => (u.length < 6 ? [...u, ""] : u));
  const removeUrl = (i: number) => setUrls((u) => u.filter((_, idx) => idx !== i));
  const updateUrl = (i: number, v: string) => setUrls((u) => u.map((x, idx) => (idx === i ? v : x)));

  const start = async () => {
    setError(null); setLoading(true);
    setState({ title: "", summary: "", toc: [], sections: [], sources: [], meta: { sourceCount: 0, createdAt: new Date().toISOString(), model: "" }, id: `sp_${Date.now()}` });
    try {
      console.log("스트리밍 시작:", { topic: topic.trim(), pageCount, seedUrls: urls.filter((u) => u.trim()) });
      
      const res = await fetch("/api/report-writers/stream", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ topic: topic.trim(), pageCount, seedUrls: urls.filter((u) => u.trim()) }) 
      });
      
      console.log("응답 상태:", res.status, res.statusText);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error("API 에러:", errorText);
        throw new Error(`API 에러: ${res.status} - ${errorText}`);
      }
      
      if (!res.body) throw new Error("스트림 응답이 없습니다");
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let lineCount = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        
        for (const line of lines) {
          if (!line.trim()) continue;
          lineCount++;
          console.log(`라인 ${lineCount}:`, line);
          
          try {
            const evt = JSON.parse(line);
            console.log("이벤트 타입:", evt.type, evt.data ? "데이터 있음" : "데이터 없음");
            
            if (evt.type === "meta") {
              setState((s: any) => ({ ...s, toc: evt.data.toc, sources: evt.data.sources, meta: { ...s.meta, sourceCount: evt.data.sources?.length || 0 } }));
              console.log("메타데이터 수신:", evt.data);
            } else if (evt.type === "section") {
              setState((s: any) => ({ ...s, sections: [...s.sections, evt.data] }));
              console.log("섹션 수신:", evt.data.id, evt.data.title);
            } else if (evt.type === "done") {
              setState((s: any) => ({ ...s, title: evt.data.title, summary: evt.data.summary }));
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI 레포트 작성</h1>
          <p className="text-gray-600">주제와 참고 URL만으로 인용이 달린 섹션형 레포트를 생성하고, 실시간으로 진행 상황을 확인할 수 있습니다.</p>
        </div>

        {/* 입력 폼 */}
        <div className="bg-white rounded-2xl p-6 shadow border border-gray-100 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">레포트 주제 <span className="text-red-500" aria-hidden="true">*</span><span className="sr-only">(필수)</span></label>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="예: 한국 전자상거래 시장 동향 2025" className="w-full border rounded-lg p-3" />

          <div className="mt-4 flex items-center gap-4">
            <span className="text-sm text-gray-700">분량(1~5)</span>
            <input type="range" min={1} max={5} value={pageCount} onChange={(e) => setPageCount(Number(e.target.value))} />
            <span className="text-sm font-semibold">{pageCount}</span>
          </div>

          <div className="mt-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
              <Zap className="w-4 h-4"/> 참고 URL (선택)
            </div>
            <div className="space-y-2">
              {urls.map((u, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={u} onChange={(e) => updateUrl(i, e.target.value)} placeholder="https://example.com/article" className="flex-1 border rounded-lg p-2" />
                  {urls.length > 1 && (
                    <button onClick={() => removeUrl(i)} className="p-2 rounded-md hover:bg-gray-50"><X className="w-4 h-4 text-red-500"/></button>
                  )}
                </div>
              ))}
              {urls.length < 6 && (
                <button onClick={addUrl} className="text-sm text-indigo-600 hover:underline inline-flex items-center gap-1"><Plus className="w-4 h-4"/> URL 추가</button>
              )}
            </div>
          </div>

          <div className="mt-6">
            <button onClick={start} disabled={loading} className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60">
              {loading ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> 생성 중…</span> : "Sparkpage 생성"}
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
                <span>생성 진행률: {state.sections.length}/{state.toc.length} 섹션 완료</span>
                <span>{Math.round((state.sections.length / state.toc.length) * 100)}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${(state.sections.length / state.toc.length) * 100}%` }}
                ></div>
              </div>
            </div>
            <ReportWriterViewer report={state as any} />
          </div>
        )}
      </div>
    </div>
  );
}
