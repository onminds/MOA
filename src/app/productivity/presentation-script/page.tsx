"use client";
import { useState } from "react";
import Header from '../../components/Header';
import { Presentation, Clock, Users, Target, Lightbulb, FileText, Download, Copy, RefreshCw, Upload, FileCheck } from 'lucide-react';

export default function PresentationScript() {
  const [formData, setFormData] = useState({
    topic: '',
    duration: '10',
    audience: '',
    purpose: '',
    keyPoints: [''],
    tone: '',
    additionalInfo: ''
  });
  
  const [generatedScript, setGeneratedScript] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // 파일 업로드 관련 상태
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [isFileMode, setIsFileMode] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  const durationOptions = [
    { value: '5', label: '5분' },
    { value: '10', label: '10분' },
    { value: '15', label: '15분' },
    { value: '20', label: '20분' },
    { value: '30', label: '30분' },
    { value: '45', label: '45분' },
    { value: '60', label: '1시간' }
  ];

  const audienceOptions = [
    { value: 'colleagues', label: '동료/팀원' },
    { value: 'executives', label: '경영진/상급자' },
    { value: 'clients', label: '고객/클라이언트' },
    { value: 'students', label: '학생/수강생' },
    { value: 'general', label: '일반 대중' },
    { value: 'professionals', label: '전문가/업계 관계자' },
    { value: 'investors', label: '투자자/파트너' }
  ];

  const purposeOptions = [
    { value: 'inform', label: '정보 전달' },
    { value: 'persuade', label: '설득/제안' },
    { value: 'educate', label: '교육/지식 공유' },
    { value: 'sell', label: '판매/마케팅' },
    { value: 'report', label: '보고/업데이트' },
    { value: 'inspire', label: '동기 부여/영감' },
    { value: 'entertain', label: '오락/흥미' }
  ];

  const toneOptions = [
    { value: 'formal', label: '공식적/전문적' },
    { value: 'friendly', label: '친근한/캐주얼' },
    { value: 'enthusiastic', label: '열정적/역동적' },
    { value: 'calm', label: '차분한/신중한' },
    { value: 'confident', label: '자신감 있는' },
    { value: 'conversational', label: '대화형/상호작용' }
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleKeyPointChange = (index: number, value: string) => {
    const newKeyPoints = [...formData.keyPoints];
    newKeyPoints[index] = value;
    setFormData(prev => ({
      ...prev,
      keyPoints: newKeyPoints
    }));
  };

  const addKeyPoint = () => {
    setFormData(prev => ({
      ...prev,
      keyPoints: [...prev.keyPoints, '']
    }));
  };

  const removeKeyPoint = (index: number) => {
    if (formData.keyPoints.length > 1) {
      const newKeyPoints = formData.keyPoints.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        keyPoints: newKeyPoints
      }));
    }
  };

  // 파일 업로드 처리
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 파일 타입 검증
    const allowedTypes = [
      'text/plain',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      setError('지원되는 파일 형식: .txt, .pdf, .docx, .doc');
      return;
    }

    setUploadedFile(file);
    setIsProcessingFile(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/presentation-script/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('파일 처리에 실패했습니다.');
      }

      const data = await response.json();
      setFileContent(data.content);
      setIsFileMode(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일 처리 중 오류가 발생했습니다.');
      setUploadedFile(null);
    } finally {
      setIsProcessingFile(false);
    }
  };

  // 파일 제거
  const removeFile = () => {
    setUploadedFile(null);
    setFileContent('');
    setIsFileMode(false);
    setError('');
  };

  // 모드 변경
  const switchMode = (mode: 'create' | 'improve') => {
    setIsFileMode(mode === 'improve');
    setError('');
    setGeneratedScript('');
  };

  const generateScript = async () => {
    if (isFileMode) {
      // 파일 개선 모드
      if (!fileContent.trim()) {
        setError('먼저 개선할 파일을 업로드해주세요.');
        return;
      }
    } else {
      // 새 대본 생성 모드
      if (!formData.topic.trim() || !formData.audience || !formData.purpose) {
        setError('발표 주제, 대상 청중, 발표 목적은 필수 입력 항목입니다.');
        return;
      }
    }

    setIsLoading(true);
    setError('');

    try {
      const endpoint = isFileMode ? '/api/presentation-script/improve' : '/api/presentation-script';
      const body = isFileMode 
        ? { fileContent, formData }
        : formData;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`${isFileMode ? '대본 개선' : '발표 대본 생성'}에 실패했습니다.`);
      }

      const data = await response.json();
      setGeneratedScript(data.script);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedScript);
  };

  const downloadScript = () => {
    const blob = new Blob([generatedScript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `발표대본_${formData.topic || '제목없음'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          {/* 헤더 */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <Presentation className="w-12 h-12 text-blue-600 mr-3" />
              <h1 className="text-3xl font-bold text-gray-900">AI 발표 대본 생성</h1>
            </div>
            <p className="text-gray-600 text-lg mb-6">
              새로운 발표 대본을 생성하거나 기존 대본을 개선할 수 있습니다
            </p>
            
            {/* 모드 선택 버튼 */}
            <div className="flex items-center justify-center space-x-4 mb-6">
              <button
                onClick={() => switchMode('create')}
                className={`px-6 py-3 rounded-lg font-medium flex items-center transition-colors ${
                  !isFileMode 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <FileText className="w-4 h-4 mr-2" />
                새 대본 생성
              </button>
              <button
                onClick={() => switchMode('improve')}
                className={`px-6 py-3 rounded-lg font-medium flex items-center transition-colors ${
                  isFileMode 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <FileCheck className="w-4 h-4 mr-2" />
                기존 대본 개선
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 입력 폼 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-6 text-gray-800">
                {isFileMode ? '기존 대본 개선' : '발표 정보 입력'}
              </h2>

              {/* 파일 업로드 섹션 (개선 모드일 때만 표시) */}
              {isFileMode && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h3 className="text-lg font-medium text-green-800 mb-3 flex items-center">
                    <Upload className="w-5 h-5 mr-2" />
                    대본 파일 업로드
                  </h3>
                  
                  {!uploadedFile ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-green-300 border-dashed rounded-lg cursor-pointer bg-green-50 hover:bg-green-100">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className="w-8 h-8 mb-2 text-green-500" />
                            <p className="mb-2 text-sm text-green-700">
                              <span className="font-semibold">클릭하여 파일 선택</span> 또는 드래그 앤 드롭
                            </p>
                            <p className="text-xs text-green-600">
                              TXT, PDF, DOC, DOCX 파일 지원
                            </p>
                          </div>
                          <input
                            type="file"
                            className="hidden"
                            accept=".txt,.pdf,.doc,.docx"
                            onChange={handleFileUpload}
                            disabled={isProcessingFile}
                          />
                        </label>
                      </div>
                      {isProcessingFile && (
                        <div className="flex items-center justify-center py-2">
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin text-green-600" />
                          <span className="text-green-600">파일 처리 중...</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-white border border-green-300 rounded-lg">
                        <div className="flex items-center">
                          <FileText className="w-5 h-5 mr-2 text-green-600" />
                          <span className="text-sm font-medium text-gray-800">{uploadedFile.name}</span>
                          <span className="ml-2 text-xs text-gray-500">
                            ({Math.round(uploadedFile.size / 1024)}KB)
                          </span>
                        </div>
                        <button
                          onClick={removeFile}
                          className="text-red-600 hover:text-red-800"
                        >
                          ✕
                        </button>
                      </div>
                      {fileContent && (
                        <div className="max-h-32 overflow-y-auto p-3 bg-gray-50 border rounded-lg">
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">
                            {fileContent.substring(0, 500)}
                            {fileContent.length > 500 && '...'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
                             {/* 발표 주제 */}
               <div className="mb-6">
                 <label className="block text-sm font-medium text-gray-800 mb-2">
                   <FileText className="w-4 h-4 inline mr-1" />
                   발표 주제 {!isFileMode && '*'}
                 </label>
                                 <input
                   type="text"
                   value={formData.topic}
                   onChange={(e) => handleInputChange('topic', e.target.value)}
                   placeholder={isFileMode ? "개선된 대본의 주제 (선택사항)" : "예: 신제품 마케팅 전략, 프로젝트 진행 현황 보고"}
                   className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder:text-gray-500"
                 />
              </div>

              {/* 발표 시간 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-800 mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  발표 시간
                </label>
                <select
                  value={formData.duration}
                  onChange={(e) => handleInputChange('duration', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                >
                  {durationOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

                             {/* 대상 청중 */}
               <div className="mb-6">
                 <label className="block text-sm font-medium text-gray-800 mb-2">
                   <Users className="w-4 h-4 inline mr-1" />
                   대상 청중 {!isFileMode && '*'}
                 </label>
                <select
                  value={formData.audience}
                  onChange={(e) => handleInputChange('audience', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                >
                  <option value="">청중을 선택하세요</option>
                  {audienceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

                             {/* 발표 목적 */}
               <div className="mb-6">
                 <label className="block text-sm font-medium text-gray-800 mb-2">
                   <Target className="w-4 h-4 inline mr-1" />
                   발표 목적 {!isFileMode && '*'}
                 </label>
                <select
                  value={formData.purpose}
                  onChange={(e) => handleInputChange('purpose', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                >
                  <option value="">발표 목적을 선택하세요</option>
                  {purposeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 발표 톤/스타일 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-800 mb-2">
                  발표 톤/스타일
                </label>
                <select
                  value={formData.tone}
                  onChange={(e) => handleInputChange('tone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                >
                  <option value="">스타일을 선택하세요 (선택사항)</option>
                  {toneOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 주요 포인트 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-800 mb-2">
                  <Lightbulb className="w-4 h-4 inline mr-1" />
                  주요 포인트
                </label>
                {formData.keyPoints.map((point, index) => (
                  <div key={index} className="flex items-center mb-2">
                    <input
                      type="text"
                      value={point}
                      onChange={(e) => handleKeyPointChange(index, e.target.value)}
                      placeholder={`주요 포인트 ${index + 1}`}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder:text-gray-500"
                    />
                    {formData.keyPoints.length > 1 && (
                      <button
                        onClick={() => removeKeyPoint(index)}
                        className="ml-2 text-red-600 hover:text-red-800"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addKeyPoint}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  + 포인트 추가
                </button>
              </div>

              {/* 추가 정보 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-800 mb-2">
                  추가 정보
                </label>
                <textarea
                  value={formData.additionalInfo}
                  onChange={(e) => handleInputChange('additionalInfo', e.target.value)}
                  placeholder="발표에 포함하고 싶은 추가 정보나 특별한 요구사항이 있다면 입력하세요"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-black placeholder:text-gray-500"
                />
              </div>

              {/* 생성 버튼 */}
                             <button
                 onClick={generateScript}
                 disabled={isLoading}
                 className={`w-full py-3 rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center font-medium text-white ${
                   isFileMode ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                 }`}
               >
                 {isLoading ? (
                   <>
                     <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                     {isFileMode ? '대본 개선 중...' : '대본 생성 중...'}
                   </>
                 ) : (
                   <>
                     {isFileMode ? <FileCheck className="w-4 h-4 mr-2" /> : <Presentation className="w-4 h-4 mr-2" />}
                     {isFileMode ? '대본 개선하기' : '발표 대본 생성하기'}
                   </>
                 )}
               </button>

              {error && (
                <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                  {error}
                </div>
              )}
            </div>

                         {/* 결과 영역 */}
             <div className="bg-white rounded-lg shadow-md p-6">
               <div className="flex items-center justify-between mb-4">
                 <h2 className="text-xl font-semibold text-gray-800">
                   {isFileMode ? '개선된 발표 대본' : '생성된 발표 대본'}
                 </h2>
                {generatedScript && (
                  <div className="flex space-x-2">
                    <button
                      onClick={copyToClipboard}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="클립보드에 복사"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={downloadScript}
                      className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded"
                      title="텍스트 파일로 다운로드"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {generatedScript ? (
                <div className="prose max-w-none">
                  <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                    {generatedScript}
                  </div>
                </div>
                             ) : (
                 <div className="text-center py-12 text-gray-500">
                   {isFileMode ? (
                     <FileCheck className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                   ) : (
                     <Presentation className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                   )}
                   <p className="text-lg mb-2">
                     {isFileMode ? '개선된 대본이 여기에 표시됩니다' : '발표 대본이 여기에 표시됩니다'}
                   </p>
                   <p className="text-sm">
                     {isFileMode 
                       ? '파일을 업로드하고 \'대본 개선하기\' 버튼을 클릭하세요'
                       : '왼쪽 폼을 작성하고 \'발표 대본 생성하기\' 버튼을 클릭하세요'
                     }
                   </p>
                 </div>
               )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 