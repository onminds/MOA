"use client";

  ArrowLeft, FileText, Search as SearchIcon, BookOpen, Download, Copy, Loader2, Upload, Link, Globe, X, Plus
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ReportWriter() {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [pageCount, setPageCount] = useState(1);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [urls, setUrls] = useState<string[]>(['']);
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<'input' | 'generating' | 'complete'>('input');
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // AI 추천 주제 생성
  const generateSuggestedTopics = async (inputTopic: string) => {
    if (!inputTopic.trim()) return;
    
    setLoadingSuggestions(true);
    try {
      const response = await fetch('/api/suggest-topics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ topic: inputTopic.trim() }),
      });

      const data = await response.json();
      
      if (response.ok && data.suggestions) {
        setSuggestedTopics(data.suggestions);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('추천 주제 생성 오류:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // 추천 주제 선택
  const selectSuggestedTopic = (selectedTopic: string) => {
    setTopic(selectedTopic);
    setShowSuggestions(false);
  };

  // 주제 입력 변경 시 추천 주제 생성
  const handleTopicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTopic(value);
    
    // 입력값이 변경되면 추천 주제 숨기기
    if (showSuggestions) {
      setShowSuggestions(false);
    }
  };

  // 주제 입력 완료 후 추천 주제 생성
  const handleTopicBlur = () => {
    if (topic.trim() && !showSuggestions) {
      generateSuggestedTopics(topic);
    }
  };

  const handleGenerateReport = async () => {
    if (!topic.trim()) {
      setError('주제를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setCurrentStep('generating');
    
    try {
      const formData = new FormData();
      formData.append('topic', topic.trim());
      formData.append('pageCount', pageCount.toString());
      
      // 파일들 추가
      uploadedFiles.forEach((file, index) => {
        formData.append(`file_${index}`, file);
      });
      
      // URL들 추가
      urls.filter(url => url.trim()).forEach((url, index) => {
        formData.append(`url_${index}`, url.trim());
      });

      const response = await fetch('/api/report-writer', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '레포트 생성에 실패했습니다.');
      }
      
      if (data.report) {
        setReport(data.report);
        setCurrentStep('complete');
      } else {
        throw new Error('레포트 결과를 받지 못했습니다.');
      }
    } catch (error) {
      console.error('레포트 생성 오류:', error);
      setError(error instanceof Error ? error.message : '레포트 생성 중 오류가 발생했습니다.');
      setCurrentStep('input');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyReport = () => {
    if (report) {
      navigator.clipboard.writeText(report);
      // 복사 완료 알림을 추가할 수 있습니다
    }
  };

  const handleDownloadReport = () => {
    if (report) {
      const blob = new Blob([report], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${topic.replace(/[^a-zA-Z0-9가-힣]/g, '_')}_레포트.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const resetForm = () => {
    setTopic('');
    setPageCount(1);
    setUploadedFiles([]);
    setUrls(['']);
    setReport(null);
    setError(null);
    setCurrentStep('input');
    setSuggestedTopics([]);
    setShowSuggestions(false);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (uploadedFiles.length + files.length > 3) {
      setError('최대 3개까지만 업로드 가능합니다.');
      return;
    }
    
    const validFiles = files.filter(file => {
      const validTypes = ['.pdf', '.docx', '.hwp', '.txt'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      return validTypes.includes(fileExtension) && file.size <= 10 * 1024 * 1024; // 10MB
    });
    
    setUploadedFiles([...uploadedFiles, ...validFiles]);
    setError(null);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const addUrl = () => {
    if (urls.length < 2) {
      setUrls([...urls, '']);
    }
  };

  const removeUrl = (index: number) => {
    if (urls.length > 1) {
      setUrls(urls.filter((_, i) => i !== index));
    }
  };

  const updateUrl = (index: number, value: string) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };

  return (

              </div>
            </div>
          </div>
        </div>
      </div>

  );
} 