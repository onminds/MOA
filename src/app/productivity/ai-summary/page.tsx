"use client";

  ArrowLeft, Youtube, FileText, Globe, Type, Upload, Download, Copy, X
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const inputTypes = [
  { 
    id: 'youtube', 
    name: '유튜브', 
    icon: <Youtube className="w-6 h-6" />, 
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    hoverColor: 'hover:border-red-300',
    selectedColor: 'border-red-500 bg-red-50'
  },
  { 
    id: 'document', 
    name: '문서', 
    icon: <FileText className="w-6 h-6" />, 
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    hoverColor: 'hover:border-blue-300',
    selectedColor: 'border-blue-500 bg-blue-50'
  },
  { 
    id: 'website', 
    name: '웹사이트', 
    icon: <Globe className="w-6 h-6" />, 
    color: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    hoverColor: 'hover:border-green-300',
    selectedColor: 'border-green-500 bg-green-50'
  },
  { 
    id: 'text', 
    name: '텍스트', 
    icon: <Type className="w-6 h-6" />, 
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    hoverColor: 'hover:border-purple-300',
    selectedColor: 'border-purple-500 bg-purple-50'
  },
];

export default function AISummary() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      setIsLoginModalOpen(true);
    }
  }, [status]);

  const handleFileUpload = (file: File) => {
    setUploadedFile(file);
  };

  const handleGenerateSummary = async () => {
    // 로그인 체크
    if (!session) {
      setIsLoginModalOpen(true);
      return;
    }

    setLoading(true);
    setSummary(null);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('type', selectedType!);
      
      switch (selectedType) {
        case 'youtube':
          formData.append('youtubeUrl', youtubeUrl);
          break;
        case 'document':
          if (uploadedFile) {
            formData.append('document', uploadedFile);
          }
          break;
        case 'website':
          formData.append('websiteUrl', websiteUrl);
          break;
        case 'text':
          formData.append('textContent', textContent);
          break;
      }

      const response = await fetch('/api/ai-summary', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '요약 생성에 실패했습니다.');
      }
      
      if (data.summary) {
        setSummary(data.summary);
      } else {
        throw new Error('요약 결과를 받지 못했습니다.');
      }
    } catch (error) {
      console.error('요약 생성 오류:', error);
      setError(error instanceof Error ? error.message : '요약 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopySummary = () => {
    if (summary) {
      navigator.clipboard.writeText(summary);
      // 복사 완료 알림을 추가할 수 있습니다
    }
  };

  const renderInputSection = () => {
    switch (selectedType) {
      case 'youtube':
        return (
          <div className="space-y-4">
            <label className="font-semibold text-gray-700 flex items-center gap-2">
              <Youtube className="w-5 h-5 text-red-500" />
              유튜브 URL
            </label>
            <div className="relative">
              <input
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                className="w-full p-4 pl-12 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white shadow-sm"
                disabled={loading}
              />
              <Youtube className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
            <div className="text-sm text-gray-500 bg-blue-50 p-3 rounded-lg">
              💡 <strong>팁:</strong> 자막이 있는 YouTube 영상을 선택하면 더 정확한 요약을 받을 수 있습니다.
            </div>
          </div>
        );
      
      case 'document':
        return (
          <div className="space-y-4">
            <label className="font-semibold text-gray-700 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              문서 업로드
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-500 transition-all bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100">
              <Upload className="w-16 h-16 text-blue-400 mx-auto mb-4" />
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                className="hidden"
                id="file-upload"
                disabled={loading}
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="text-gray-700 mb-2 font-medium">
                  {uploadedFile ? uploadedFile.name : '파일을 선택하거나 여기에 드래그하세요'}
                </div>
                <div className="text-sm text-gray-500">
                  PDF, DOC, DOCX, TXT 파일 지원
                </div>
              </label>
            </div>
          </div>
        );
      
      case 'website':
        return (
          <div className="space-y-4">
            <label className="font-semibold text-gray-700 flex items-center gap-2">
              <Globe className="w-5 h-5 text-green-500" />
              웹사이트 URL
            </label>
            <div className="relative">
              <input
                type="url"
                placeholder="https://example.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="w-full p-4 pl-12 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all bg-white shadow-sm"
                disabled={loading}
              />
              <Globe className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
          </div>
        );
      
      case 'text':
        return (
          <div className="space-y-4">
            <label className="font-semibold text-gray-700 flex items-center gap-2">
              <Type className="w-5 h-5 text-purple-500" />
              요약하고 싶은 내용을 입력해 주세요
            </label>
            <textarea
              placeholder="요약하고 싶은 내용을 입력해 주세요"
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              className="w-full h-64 p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none bg-white shadow-sm transition-all"
              disabled={loading}
            />
          </div>
        );
      
      default:
        return null;
    }
  };

  const canGenerate = () => {
    switch (selectedType) {
      case 'youtube':
        return youtubeUrl.trim() !== '';
      case 'document':
        return uploadedFile !== null;
      case 'website':
        return websiteUrl.trim() !== '';
      case 'text':
        return textContent.trim() !== '';
      default:
        return false;
    }
  };

  return (

              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 로그인 모달 */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">로그인이 필요합니다</h2>
              <button
                onClick={() => setIsLoginModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="text-gray-600 mb-6">
              <p className="mb-4">AI 완벽요약 기능을 사용하려면 로그인이 필요합니다.</p>
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">플랜별 사용량</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• <strong>Basic:</strong> 2회</li>
                  <li>• <strong>Standard:</strong> 무제한</li>
                  <li>• <strong>Pro:</strong> 무제한</li>
                </ul>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/auth/signin')}
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                로그인하기
              </button>
              <button
                onClick={() => setIsLoginModalOpen(false)}
                className="flex-1 bg-gray-200 text-gray-800 py-3 px-6 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                나중에
              </button>
            </div>
          </div>
        </div>
      )}

  );
} 