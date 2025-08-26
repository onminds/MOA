"use client";
import { useState } from "react";
import ReportWriterViewer from "@/components/ReportWriterViewer";
import { Loader2, ArrowLeft } from "lucide-react";
import Header from '../../components/Header';
import { useRouter } from 'next/navigation';

export default function ReportWriterBuilder() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [state, setState] = useState<any>({
    title: "",
    summary: "",
    toc: [],
    sections: [],
    sources: [],
    meta: { createdAt: new Date(), sourceCount: 0 }
  });

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
      const response = await fetch("/api/report-writers/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, domain }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
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
            <label className="block text-sm font-medium text-gray-700 mb-2">레포트 주제</label>
            <input 
              value={topic} 
              onChange={(e) => setTopic(e.target.value)} 
              placeholder="예: 한국 전자상거래 시장 동향 2025" 
              className="w-full border rounded-lg p-3" 
            />

            {/* 도메인 옵션 */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">도메인 (선택사항)</label>
              <input 
                value={domain} 
                onChange={(e) => setDomain(e.target.value)} 
                placeholder="예: 미생물학, UI/UX, 선거행정, 교육평가, 경제/시장" 
                className="w-full border rounded-lg p-3 text-sm" 
              />
              <p className="text-xs text-gray-500 mt-1">주제의 분야를 명시하여 의미 혼동을 방지합니다</p>
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
    </>
  );
}
