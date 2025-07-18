"use client";
import { useState, useEffect } from "react";
import Header from '../../components/Header';
import { 
  MessageSquare, Hash, Image, Users, Briefcase, Target, 
  Wand2, Copy, CheckCircle, ArrowLeft, Loader2, Upload, X, Crop,
  Heart, MessageCircle, Share, Bookmark, MoreHorizontal, 
  Repeat2, Eye, ThumbsUp, Send, Play
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SNSPlatform {
  id: string;
  name: string;
  icon: string;
  charLimit: number;
  features: string[];
  color: string;
}

const snsplatforms: SNSPlatform[] = [
  {
    id: 'instagram',
    name: '인스타그램',
    icon: '📸',
    charLimit: 2200,
    features: ['해시태그 중심', '시각적 컨텐츠', '스토리텔링'],
    color: 'from-purple-500 to-pink-500'
  },
  {
    id: 'twitter',
    name: '트위터(X)',
    icon: '🐦',
    charLimit: 280,
    features: ['간결함', '실시간성', '논의 유발'],
    color: 'from-blue-400 to-blue-600'
  },
  {
    id: 'facebook',
    name: '페이스북',
    icon: '👥',
    charLimit: 63206,
    features: ['개인적 톤', '소통 중심', '스토리 공유'],
    color: 'from-blue-600 to-blue-800'
  },
  {
    id: 'linkedin',
    name: '링크드인',
    icon: '💼',
    charLimit: 3000,
    features: ['전문성', '비즈니스', '네트워킹'],
    color: 'from-blue-700 to-blue-900'
  },
  {
    id: 'youtube',
    name: '유튜브',
    icon: '🎥',
    charLimit: 5000,
    features: ['영상 설명', 'SEO 최적화', '시청자 유도'],
    color: 'from-red-500 to-red-700'
  },
  {
    id: 'tiktok',
    name: '틱톡',
    icon: '🎵',
    charLimit: 2200,
    features: ['트렌드 활용', '젊은 층', '바이럴 요소'],
    color: 'from-black to-gray-800'
  }
];

const imageRatios = {
  instagram: [
    { name: '정사각형 (피드)', ratio: '1:1', width: 1080, height: 1080 },
    { name: '세로 (피드)', ratio: '4:5', width: 1080, height: 1350 },
    { name: '가로 (피드)', ratio: '16:9', width: 1080, height: 608 },
    { name: '스토리', ratio: '9:16', width: 1080, height: 1920 }
  ],
  twitter: [
    { name: '일반 트윗', ratio: '16:9', width: 1200, height: 675 },
    { name: '트윗 카드', ratio: '2:1', width: 1200, height: 600 }
  ],
  facebook: [
    { name: '일반 게시물', ratio: '16:9', width: 1200, height: 675 },
    { name: '링크 미리보기', ratio: '1.91:1', width: 1200, height: 628 }
  ],
  linkedin: [
    { name: '일반 게시물', ratio: '1.91:1', width: 1200, height: 628 },
    { name: '세로형', ratio: '4:5', width: 1080, height: 1350 }
  ],
  youtube: [
    { name: '썸네일', ratio: '16:9', width: 1280, height: 720 }
  ],
  tiktok: [
    { name: '세로 영상', ratio: '9:16', width: 1080, height: 1920 }
  ]
};

const contentTypes = [
  { id: 'promotion', name: '홍보/마케팅', icon: <Target className="w-5 h-5" /> },
  { id: 'education', name: '교육/정보', icon: <MessageSquare className="w-5 h-5" /> },
  { id: 'entertainment', name: '엔터테인먼트', icon: <Users className="w-5 h-5" /> },
  { id: 'news', name: '뉴스/업데이트', icon: <Hash className="w-5 h-5" /> },
  { id: 'personal', name: '개인 스토리', icon: <Image className="w-5 h-5" /> },
  { id: 'business', name: '비즈니스', icon: <Briefcase className="w-5 h-5" /> }
];

export default function SNSPost() {
  const router = useRouter();
  const [selectedPlatform, setSelectedPlatform] = useState<SNSPlatform | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [generateMode, setGenerateMode] = useState<'single' | 'multiple'>('single');
  const [contentType, setContentType] = useState('');
  const [topic, setTopic] = useState('');
  const [keywords, setKeywords] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [tone, setTone] = useState('친근한');
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [includeEmoji, setIncludeEmoji] = useState(false);
  const [generatedPost, setGeneratedPost] = useState('');
  const [generatedResults, setGeneratedResults] = useState<any>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  // 이미지 관련 state
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [selectedRatio, setSelectedRatio] = useState<any>(null);
  const [croppedImage, setCroppedImage] = useState<string>('');

  // 플랫폼이 변경될 때 첫 번째 권장 비율로 자동 설정
  useEffect(() => {
    if (selectedPlatform && imagePreview) {
      const ratios = imageRatios[selectedPlatform.id as keyof typeof imageRatios];
      if (ratios && ratios.length > 0) {
        setSelectedRatio(ratios[0]);
        setCroppedImage(''); // 크롭된 이미지 초기화
      }
    }
  }, [selectedPlatform, imagePreview]);

  const handleGeneratePost = async () => {
    if (!topic.trim()) return;
    
    if (generateMode === 'single' && !selectedPlatform) return;
    if (generateMode === 'multiple' && selectedPlatforms.length === 0) return;

    setIsGenerating(true);
    try {
      const requestBody = {
        contentType,
        topic: topic.trim(),
        keywords: keywords.trim(),
        targetAudience: targetAudience.trim(),
        tone,
        includeHashtags,
        includeEmoji,
        charLimit: selectedPlatform?.charLimit || 5000
      };

      if (generateMode === 'single') {
        const response = await fetch('/api/sns-post', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...requestBody,
            platform: selectedPlatform?.id,
            charLimit: selectedPlatform?.charLimit
          }),
        });

        const data = await response.json();
        
        if (response.ok) {
          if (data.title && data.description) {
            // 유튜브의 경우 제목과 설명 분리
            setGeneratedPost(`제목: ${data.title}\n\n설명:\n${data.description}`);
          } else {
            setGeneratedPost(data.post || data.description || '');
          }
        } else {
          alert('게시물 생성 중 오류가 발생했습니다: ' + data.error);
        }
      } else {
        // 다중 플랫폼 생성
        const response = await fetch('/api/sns-post', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...requestBody,
            platforms: selectedPlatforms
          }),
        });

        const data = await response.json();
        
        if (response.ok) {
          setGeneratedResults(data.results);
        } else {
          alert('게시물 생성 중 오류가 발생했습니다: ' + data.error);
        }
      }
    } catch (error) {
      alert('게시물 생성 중 오류가 발생했습니다.');
      console.error('Error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyPost = () => {
    navigator.clipboard.writeText(generatedPost);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      
      // 플랫폼이 선택되어 있으면 첫 번째 권장 비율로 자동 설정
      if (selectedPlatform) {
        const ratios = imageRatios[selectedPlatform.id as keyof typeof imageRatios];
        if (ratios.length > 0) {
          setSelectedRatio(ratios[0]);
        }
      }
    }
  };

  const handleImageCrop = async () => {
    if (!imagePreview || !selectedRatio) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new window.Image();

    return new Promise<void>((resolve) => {
      img.onload = () => {
        canvas.width = selectedRatio.width;
        canvas.height = selectedRatio.height;

        // 이미지를 비율에 맞게 크롭
        const sourceAspect = img.width / img.height;
        const targetAspect = selectedRatio.width / selectedRatio.height;

        let sourceX = 0, sourceY = 0, sourceWidth = img.width, sourceHeight = img.height;

        if (sourceAspect > targetAspect) {
          // 이미지가 더 넓음 - 좌우를 자름
          sourceWidth = img.height * targetAspect;
          sourceX = (img.width - sourceWidth) / 2;
        } else {
          // 이미지가 더 높음 - 상하를 자름
          sourceHeight = img.width / targetAspect;
          sourceY = (img.height - sourceHeight) / 2;
        }

        if (ctx) {
          ctx.drawImage(
            img,
            sourceX, sourceY, sourceWidth, sourceHeight,
            0, 0, canvas.width, canvas.height
          );
        }

        const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setCroppedImage(croppedDataUrl);
        resolve();
      };
      img.src = imagePreview;
    });
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview('');
    setSelectedRatio(null);
    setCroppedImage('');
  };

  const resetForm = () => {
    setSelectedPlatform(null);
    setSelectedPlatforms([]);
    setGenerateMode('single');
    setContentType('');
    setTopic('');
    setKeywords('');
    setTargetAudience('');
    setTone('친근한');
    setIncludeHashtags(true);
    setIncludeEmoji(false);
    setGeneratedPost('');
    setGeneratedResults({});
    setShowPreview(false);
    removeImage();
  };

  const togglePlatformSelection = (platformId: string) => {
    setSelectedPlatforms(prev => {
      if (prev.includes(platformId)) {
        return prev.filter(id => id !== platformId);
      } else {
        return [...prev, platformId];
      }
    });
  };

  // 플랫폼별 미리보기 컴포넌트
  const PlatformPreview = ({ platform, post, image }: { platform: string, post: string, image?: string }) => {
    const commonProfileImage = "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face&auto=format";
    
    switch (platform) {
      case 'instagram':
        return (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-w-md mx-auto">
            {/* Instagram Header */}
            <div className="flex items-center p-3 border-b border-gray-100">
              <img src={commonProfileImage} alt="Profile" className="w-8 h-8 rounded-full mr-3" />
              <div className="flex-1">
                <div className="font-semibold text-sm">your_account</div>
              </div>
                             <MoreHorizontal className="w-6 h-6 text-gray-800" />
            </div>
            
                         {/* Instagram Image */}
             {image ? (
               <div className="aspect-square bg-gray-100">
                 <img src={image} alt="Post" className="w-full h-full object-cover" />
               </div>
             ) : (
               <div className="aspect-square bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                 <div className="text-center text-white">
                   <div className="text-6xl mb-4">📸</div>
                   <div className="text-lg font-bold">Instagram</div>
                 </div>
               </div>
             )}
            
            {/* Instagram Actions */}
            <div className="p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-4">
                  <Heart className="w-6 h-6" />
                  <MessageCircle className="w-6 h-6" />
                  <Send className="w-6 h-6" />
                </div>
                <Bookmark className="w-6 h-6" />
              </div>
              
                             <div className="text-sm font-semibold mb-1 text-black">좋아요 1,234개</div>
               
               <div className="text-sm">
                 <span className="font-semibold mr-2 text-black">your_account</span>
                 <span className="whitespace-pre-wrap text-black">{post}</span>
               </div>
               
               <div className="text-gray-900 text-xs mt-2 font-medium">1시간 전</div>
            </div>
          </div>
        );

      case 'twitter':
        return (
          <div className="bg-white border border-gray-200 rounded-xl p-4 max-w-lg mx-auto">
            <div className="flex space-x-3">
              <img src={commonProfileImage} alt="Profile" className="w-10 h-10 rounded-full" />
              <div className="flex-1">
                                                  <div className="flex items-center space-x-1">
                   <span className="font-bold text-sm text-black">Your Name</span>
                   <span className="text-gray-900 text-sm font-medium">@your_handle</span>
                   <span className="text-gray-900 text-sm font-medium">·</span>
                   <span className="text-gray-900 text-sm font-medium">1시간</span>
                 </div>
                 
                 <div className="mt-1 text-sm whitespace-pre-wrap text-black font-medium">{post}</div>
                 
                 {image ? (
                   <div className="mt-3 rounded-2xl overflow-hidden border border-gray-200">
                     <img src={image} alt="Post" className="w-full object-cover" />
                   </div>
                 ) : post.length > 100 && (
                   <div className="mt-3 rounded-2xl overflow-hidden border border-gray-200 bg-gradient-to-r from-blue-400 to-blue-600 p-8">
                     <div className="text-center text-white">
                       <div className="text-4xl mb-2">🐦</div>
                       <div className="text-sm font-medium">Twitter/X</div>
                     </div>
                   </div>
                 )}
                
                                 <div className="flex items-center justify-between mt-3 max-w-md">
                   <div className="flex items-center space-x-1 text-gray-900">
                     <MessageCircle className="w-4 h-4" />
                     <span className="text-xs font-semibold">12</span>
                   </div>
                   <div className="flex items-center space-x-1 text-gray-900">
                     <Repeat2 className="w-4 h-4" />
                     <span className="text-xs font-semibold">34</span>
                   </div>
                   <div className="flex items-center space-x-1 text-gray-900">
                     <Heart className="w-4 h-4" />
                     <span className="text-xs font-semibold">123</span>
                   </div>
                   <div className="flex items-center space-x-1 text-gray-900">
                     <Share className="w-4 h-4" />
                   </div>
                 </div>
              </div>
            </div>
          </div>
        );

      case 'facebook':
        return (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-w-lg mx-auto">
            <div className="p-4">
              <div className="flex items-center space-x-3 mb-3">
                <img src={commonProfileImage} alt="Profile" className="w-10 h-10 rounded-full" />
                                 <div className="flex-1">
                   <div className="font-semibold text-sm text-black">Your Name</div>
                   <div className="text-gray-900 text-xs font-medium">1시간 전 · 🌍</div>
                 </div>
                 <MoreHorizontal className="w-5 h-5 text-gray-800" />
              </div>
              
                             <div className="text-sm mb-3 whitespace-pre-wrap text-black font-medium">{post}</div>
            </div>
            
            {image ? (
              <div className="bg-gray-100">
                <img src={image} alt="Post" className="w-full object-cover" />
              </div>
            ) : (
              <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-12 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="text-5xl mb-3">👥</div>
                  <div className="text-lg font-bold">Facebook</div>
                </div>
              </div>
            )}
            
            <div className="p-4 border-t border-gray-100">
                             <div className="flex items-center justify-between mb-3">
                 <div className="text-sm text-gray-800">👍❤️😊 123명 외</div>
                 <div className="text-sm text-gray-800">댓글 12개</div>
               </div>
              
              <div className="flex items-center justify-around border-t border-gray-100 pt-2">
                                 <button className="flex items-center space-x-2 flex-1 justify-center py-2 hover:bg-gray-50 rounded">
                   <ThumbsUp className="w-5 h-5 text-gray-800" />
                   <span className="text-sm text-gray-800">좋아요</span>
                 </button>
                 <button className="flex items-center space-x-2 flex-1 justify-center py-2 hover:bg-gray-50 rounded">
                   <MessageCircle className="w-5 h-5 text-gray-800" />
                   <span className="text-sm text-gray-800">댓글</span>
                 </button>
                 <button className="flex items-center space-x-2 flex-1 justify-center py-2 hover:bg-gray-50 rounded">
                   <Share className="w-5 h-5 text-gray-800" />
                   <span className="text-sm text-gray-800">공유</span>
                 </button>
              </div>
            </div>
          </div>
        );

      case 'linkedin':
        return (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-w-lg mx-auto">
            <div className="p-4">
              <div className="flex items-center space-x-3 mb-3">
                <img src={commonProfileImage} alt="Profile" className="w-12 h-12 rounded-full" />
                                 <div className="flex-1">
                   <div className="font-semibold text-sm text-black">Your Name</div>
                   <div className="text-gray-900 text-xs font-medium">직책 | 회사명</div>
                   <div className="text-gray-900 text-xs font-medium">1시간 · 🌍</div>
                 </div>
                 <MoreHorizontal className="w-5 h-5 text-gray-800" />
              </div>
              
                             <div className="text-sm mb-3 whitespace-pre-wrap leading-relaxed text-black font-medium">{post}</div>
            </div>
            
            {image ? (
              <div className="bg-gray-100">
                <img src={image} alt="Post" className="w-full object-cover" />
              </div>
            ) : (
              <div className="bg-gradient-to-r from-blue-700 to-blue-900 p-12 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="text-5xl mb-3">💼</div>
                  <div className="text-lg font-bold">LinkedIn</div>
                </div>
              </div>
            )}
            
            <div className="p-4 border-t border-gray-100">
                             <div className="flex items-center justify-between mb-3 text-sm text-gray-800">
                 <span>👍💡❤️ 123명</span>
                 <span>댓글 12개 · 재게시 5개</span>
               </div>
              
              <div className="flex items-center justify-around border-t border-gray-100 pt-3">
                                 <button className="flex items-center space-x-2 flex-1 justify-center py-2 hover:bg-gray-50 rounded">
                   <ThumbsUp className="w-5 h-5 text-gray-800" />
                   <span className="text-sm text-gray-800 font-medium">좋아요</span>
                 </button>
                 <button className="flex items-center space-x-2 flex-1 justify-center py-2 hover:bg-gray-50 rounded">
                   <MessageCircle className="w-5 h-5 text-gray-800" />
                   <span className="text-sm text-gray-800 font-medium">댓글</span>
                 </button>
                 <button className="flex items-center space-x-2 flex-1 justify-center py-2 hover:bg-gray-50 rounded">
                   <Repeat2 className="w-5 h-5 text-gray-800" />
                   <span className="text-sm text-gray-800 font-medium">재게시</span>
                 </button>
                 <button className="flex items-center space-x-2 flex-1 justify-center py-2 hover:bg-gray-50 rounded">
                   <Send className="w-5 h-5 text-gray-800" />
                   <span className="text-sm text-gray-800 font-medium">보내기</span>
                 </button>
              </div>
            </div>
          </div>
        );

      case 'youtube':
        return (
                     <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-w-md mx-auto">
             {image ? (
               <div className="relative aspect-video bg-gray-100">
                 <img src={image} alt="Thumbnail" className="w-full h-full object-cover" />
                 <div className="absolute inset-0 flex items-center justify-center">
                   <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center">
                     <Play className="w-8 h-8 text-white ml-1" />
                   </div>
                 </div>
                 <div className="absolute bottom-2 right-2 bg-black bg-opacity-80 text-white text-xs px-1 rounded">
                   10:24
                 </div>
               </div>
             ) : (
               <div className="relative aspect-video bg-gradient-to-r from-red-500 to-red-700 flex items-center justify-center">
                 <div className="text-center text-white">
                   <div className="text-5xl mb-3">🎥</div>
                   <div className="text-lg font-bold">YouTube</div>
                 </div>
                 <div className="absolute inset-0 flex items-center justify-center">
                   <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center">
                     <Play className="w-8 h-8 text-white ml-1" />
                   </div>
                 </div>
                 <div className="absolute bottom-2 right-2 bg-black bg-opacity-80 text-white text-xs px-1 rounded">
                   10:24
                 </div>
               </div>
             )}
            
            <div className="p-3">
              <div className="flex space-x-3">
                <img src={commonProfileImage} alt="Channel" className="w-9 h-9 rounded-full" />
                <div className="flex-1">
                                     <div className="font-medium text-sm leading-tight mb-1 overflow-hidden text-black" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                     {post.split('\n')[0] || '영상 제목'}
                   </div>
                                     <div className="text-gray-800 text-xs">Your Channel</div>
                   <div className="text-gray-800 text-xs">조회수 1,234회 · 1시간 전</div>
                 </div>
                 <MoreHorizontal className="w-5 h-5 text-gray-800" />
              </div>
            </div>
          </div>
        );

      case 'tiktok':
        return (
          <div className="bg-black text-white rounded-lg overflow-hidden max-w-xs mx-auto" style={{ aspectRatio: '9/16', minHeight: '500px' }}>
            <div className="relative h-full">
              {image ? (
                <img src={image} alt="TikTok" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-6xl mb-4">🎵</div>
                    <div className="text-lg font-bold">TikTok</div>
                  </div>
                </div>
              )}
              
              {/* TikTok UI 오버레이 */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent">
                {/* 하단 정보 */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                                     <div className="mb-4">
                     <div className="font-semibold text-sm mb-1 text-white">@your_account</div>
                     <div className="text-sm whitespace-pre-wrap overflow-hidden text-white font-medium" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{post}</div>
                   </div>
                  
                  <div className="flex items-center space-x-2 text-sm">
                    <span>🎵</span>
                    <span className="text-xs">오리지널 사운드 - your_account</span>
                  </div>
                </div>
                
                {/* 우측 액션 버튼 */}
                <div className="absolute right-3 bottom-20 flex flex-col space-y-4">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center">
                      <Heart className="w-6 h-6" />
                    </div>
                    <span className="text-xs mt-1">1.2K</span>
                  </div>
                  
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center">
                      <MessageCircle className="w-6 h-6" />
                    </div>
                    <span className="text-xs mt-1">123</span>
                  </div>
                  
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center">
                      <Share className="w-6 h-6" />
                    </div>
                    <span className="text-xs mt-1">34</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return <div>미리보기를 사용할 수 없습니다.</div>;
    }
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto p-6">
          {/* 헤더 */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => router.push('/productivity')}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">SNS 게시물 생성</h1>
              <p className="text-gray-600 mt-2">SNS 플랫폼별 최적화된 게시물을 AI가 자동으로 생성해드립니다</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 입력 폼 */}
            <div className="space-y-6">
              {/* 생성 모드 선택 */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">생성 모드 선택</h3>
                <div className="flex gap-4 mb-4">
                  <button
                    onClick={() => {
                      setGenerateMode('single');
                      setSelectedPlatforms([]);
                    }}
                    className={`px-4 py-2 rounded-lg border-2 transition-all ${
                      generateMode === 'single'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    단일 플랫폼
                  </button>
                  <button
                    onClick={() => {
                      setGenerateMode('multiple');
                      setSelectedPlatform(null);
                    }}
                    className={`px-4 py-2 rounded-lg border-2 transition-all ${
                      generateMode === 'multiple'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    다중 플랫폼
                  </button>
                </div>

                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  {generateMode === 'single' ? 'SNS 플랫폼 선택' : '생성할 플랫폼들 선택 (여러 개 가능)'}
                </h4>
                
                <div className="grid grid-cols-2 gap-3">
                  {snsplatforms.map((platform) => (
                    <button
                      key={platform.id}
                      onClick={() => {
                        if (generateMode === 'single') {
                          setSelectedPlatform(platform);
                        } else {
                          togglePlatformSelection(platform.id);
                        }
                      }}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        generateMode === 'single'
                          ? selectedPlatform?.id === platform.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                          : selectedPlatforms.includes(platform.id)
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-2xl mb-2">{platform.icon}</div>
                      <div className="text-sm font-medium text-gray-900">{platform.name}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {platform.charLimit === 63206 ? '제한없음' : `${platform.charLimit}자`}
                      </div>
                      {generateMode === 'multiple' && selectedPlatforms.includes(platform.id) && (
                        <div className="text-green-600 text-xs mt-1 font-medium">✓ 선택됨</div>
                      )}
                    </button>
                  ))}
                </div>
                
                {generateMode === 'single' && selectedPlatform && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-700 mb-2">특징:</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedPlatform.features.map((feature, index) => (
                        <span key={index} className="px-2 py-1 bg-white rounded text-xs text-gray-600">
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {generateMode === 'multiple' && selectedPlatforms.length > 0 && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-700 mb-2">
                      선택된 플랫폼 ({selectedPlatforms.length}개):
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedPlatforms.map((platformId) => {
                        const platform = snsplatforms.find(p => p.id === platformId);
                        return platform ? (
                          <span key={platformId} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                            {platform.icon} {platform.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 컨텐츠 유형 */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">컨텐츠 유형</h3>
                <div className="grid grid-cols-2 gap-3">
                  {contentTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setContentType(type.id)}
                      className={`p-3 rounded-lg border transition-all flex items-center gap-2 ${
                        contentType === type.id
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      {type.icon}
                      <span className="text-sm font-medium">{type.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 게시물 정보 입력 */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">게시물 정보</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      주제 또는 내용 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="게시물의 주제나 전달하고 싶은 내용을 입력하세요"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black placeholder:text-gray-500"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      키워드 (쉼표로 구분)
                    </label>
                    <input
                      type="text"
                      value={keywords}
                      onChange={(e) => setKeywords(e.target.value)}
                      placeholder="관련 키워드를 입력하세요 (예: 마케팅, 브랜딩, 소셜미디어)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black placeholder:text-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      타겟 대상
                    </label>
                    <input
                      type="text"
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      placeholder="주요 타겟 대상을 입력하세요 (예: 20-30대 직장인, 창업자)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black placeholder:text-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      톤앤매너
                    </label>
                    <select
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                    >
                      <option value="친근한">친근한</option>
                      <option value="전문적인">전문적인</option>
                      <option value="유머러스한">유머러스한</option>
                      <option value="격려하는">격려하는</option>
                      <option value="정보제공형">정보제공형</option>
                      <option value="감정적인">감정적인</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 이미지 업로드 */}
              {generateMode === 'single' && selectedPlatform && (
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">이미지 추가</h3>
                  
                  {!imagePreview ? (
                    <div>
                      <label className="block w-full">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer">
                          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-600 font-medium">이미지를 업로드하세요</p>
                          <p className="text-sm text-gray-500 mt-2">JPG, PNG, GIF 파일을 지원합니다</p>
                        </div>
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* 비율 선택 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {selectedPlatform.name} 권장 비율 선택
                        </label>
                        <div className="grid grid-cols-1 gap-2">
                          {imageRatios[selectedPlatform.id as keyof typeof imageRatios]?.map((ratio, index) => (
                            <button
                              key={index}
                              onClick={() => setSelectedRatio(ratio)}
                              className={`p-3 rounded-lg border text-left transition-all ${
                                selectedRatio?.ratio === ratio.ratio
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
                              }`}
                            >
                              <div className="flex justify-between items-center">
                                <span className="font-medium">{ratio.name}</span>
                                <span className="text-sm text-gray-500">{ratio.ratio}</span>
                              </div>
                              <div className="text-sm text-gray-500">
                                {ratio.width} × {ratio.height}px
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 이미지 미리보기 */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">미리보기</span>
                          <div className="flex gap-2">
                            {selectedRatio && (
                              <button
                                onClick={handleImageCrop}
                                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors flex items-center gap-1"
                              >
                                <Crop className="w-4 h-4" />
                                크롭 적용
                              </button>
                            )}
                            <button
                              onClick={removeImage}
                              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors flex items-center gap-1"
                            >
                              <X className="w-4 h-4" />
                              제거
                            </button>
                          </div>
                        </div>
                        
                        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                          {croppedImage ? (
                            <div className="text-center">
                              <img
                                src={croppedImage}
                                alt="Cropped preview"
                                className="max-w-full max-h-64 mx-auto rounded-lg shadow-sm"
                              />
                              <p className="text-sm text-green-600 mt-2 font-medium">
                                ✓ {selectedRatio?.name} ({selectedRatio?.ratio}) 비율로 최적화됨
                              </p>
                            </div>
                          ) : (
                            <div className="text-center">
                              <img
                                src={imagePreview}
                                alt="Original preview"
                                className="max-w-full max-h-64 mx-auto rounded-lg shadow-sm"
                              />
                              {selectedRatio && (
                                <p className="text-sm text-gray-600 mt-2">
                                  선택한 비율: {selectedRatio.name} ({selectedRatio.ratio})
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 옵션 설정 */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">추가 옵션</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={includeHashtags}
                      onChange={(e) => setIncludeHashtags(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">해시태그 포함</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={includeEmoji}
                      onChange={(e) => setIncludeEmoji(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">이모지 포함 (최소한으로)</span>
                  </label>
                </div>
              </div>

              {/* 생성 버튼 */}
              <button
                onClick={handleGeneratePost}
                disabled={
                  !topic.trim() || 
                  isGenerating || 
                  (generateMode === 'single' && !selectedPlatform) ||
                  (generateMode === 'multiple' && selectedPlatforms.length === 0)
                }
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {generateMode === 'single' ? '게시물 생성 중...' : '다중 플랫폼 생성 중...'}
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5" />
                    {generateMode === 'single' 
                      ? 'SNS 게시물 생성' 
                      : `${selectedPlatforms.length}개 플랫폼 게시물 생성`
                    }
                  </>
                )}
              </button>
            </div>

            {/* 결과 영역 */}
            <div className="space-y-6">
              {(generatedPost || Object.keys(generatedResults).length > 0) ? (
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {generateMode === 'single' ? '생성된 게시물' : `생성된 게시물 (${Object.keys(generatedResults).length}개 플랫폼)`}
                    </h3>
                    <div className="flex gap-2">
                      {generateMode === 'single' && (
                        <button
                          onClick={handleCopyPost}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
                        >
                          {copied ? (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              복사됨
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              복사
                            </>
                          )}
                        </button>
                      )}
                      <button
                        onClick={resetForm}
                        className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                      >
                        새로 작성
                      </button>
                    </div>
                  </div>
                  
                                    {/* 단일 플랫폼 결과 */}
                  {generateMode === 'single' && generatedPost && (
                    <>
                      {selectedPlatform && (
                        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">{selectedPlatform.icon}</span>
                            <span className="font-medium text-gray-800">{selectedPlatform.name}</span>
                            <span className="text-sm text-gray-500">
                              ({generatedPost.length}/{selectedPlatform.charLimit === 63206 ? '무제한' : selectedPlatform.charLimit}자)
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {/* 탭 네비게이션 */}
                      <div className="flex mb-4 border-b border-gray-200">
                        <button
                          onClick={() => setShowPreview(false)}
                          className={`px-4 py-2 font-medium transition-colors ${
                            !showPreview 
                              ? 'text-blue-600 border-b-2 border-blue-600' 
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          기본 보기
                        </button>
                        <button
                          onClick={() => setShowPreview(true)}
                          className={`px-4 py-2 font-medium transition-colors ${
                            showPreview 
                              ? 'text-blue-600 border-b-2 border-blue-600' 
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          📱 {selectedPlatform?.name} 미리보기
                        </button>
                      </div>
                      
                      {/* 컨텐츠 영역 */}
                      {!showPreview ? (
                        <div className="bg-gray-50 rounded-lg p-4">
                          {/* 이미지가 있으면 표시 */}
                          {croppedImage && (
                            <div className="mb-4">
                              <img
                                src={croppedImage}
                                alt="Post image"
                                className="max-w-full rounded-lg shadow-sm"
                              />
                            </div>
                          )}
                          
                          <pre className="whitespace-pre-wrap text-gray-800 font-medium leading-relaxed">
                            {generatedPost}
                          </pre>
                        </div>
                      ) : (
                        <div className="py-6">
                          <div className="mb-4 text-center">
                            <h4 className="text-lg font-semibold text-gray-800 mb-2">
                              {selectedPlatform?.name} 실제 화면 미리보기
                            </h4>
                            <p className="text-sm text-gray-600">
                              실제 {selectedPlatform?.name}에서 보이는 모습입니다
                            </p>
                            {(croppedImage || imagePreview) && (
                              <p className="text-xs text-blue-600 mt-1">
                                ✓ 이미지 포함됨
                              </p>
                            )}
                          </div>
                          
                          <div className="flex justify-center">
                            <PlatformPreview 
                              platform={selectedPlatform?.id || ''} 
                              post={generatedPost}
                              image={croppedImage || imagePreview}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* 다중 플랫폼 결과 */}
                  {generateMode === 'multiple' && Object.keys(generatedResults).length > 0 && (
                    <div className="space-y-6">
                      {Object.entries(generatedResults).map(([platformId, result]: [string, any]) => {
                        const platform = snsplatforms.find(p => p.id === platformId);
                        if (!platform || !result) return null;

                        return (
                          <div key={platformId} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center gap-3 mb-4">
                              <span className="text-2xl">{platform.icon}</span>
                              <div>
                                <h4 className="text-lg font-semibold text-gray-900">{platform.name}</h4>
                                <p className="text-sm text-gray-600">{platform.features[0]}</p>
                              </div>
                              <button
                                onClick={() => {
                                  const textToCopy = result.title 
                                    ? `제목: ${result.title}\n\n설명:\n${result.description}`
                                    : result.post;
                                  navigator.clipboard.writeText(textToCopy);
                                }}
                                className="ml-auto px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm flex items-center gap-1"
                              >
                                <Copy className="w-4 h-4" />
                                복사
                              </button>
                            </div>

                            {/* 유튜브는 제목과 설명 분리 표시 */}
                            {result.title && result.description ? (
                              <div className="space-y-4">
                                <div>
                                  <div className="text-sm font-medium text-gray-700 mb-2">제목 ({result.charCount?.title || 0}자)</div>
                                  <div className="bg-blue-50 rounded-lg p-3">
                                    <div className="text-black font-medium">{result.title}</div>
                                  </div>
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-gray-700 mb-2">설명 ({result.charCount?.description || 0}자)</div>
                                  <div className="bg-gray-50 rounded-lg p-3">
                                    <pre className="whitespace-pre-wrap text-black font-medium leading-relaxed text-sm">
                                      {result.description}
                                    </pre>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="text-sm font-medium text-gray-700 mb-2">
                                  게시물 ({result.charCount || result.post?.length || 0}자)
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3">
                                  <pre className="whitespace-pre-wrap text-black font-medium leading-relaxed">
                                    {result.post}
                                  </pre>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <div className="text-center py-12">
                    <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-700 mb-2">게시물을 생성해보세요</h3>
                    <p className="text-gray-500">
                      {generateMode === 'single' 
                        ? '플랫폼과 주제를 선택한 후 생성 버튼을 눌러주세요'
                        : '여러 플랫폼을 선택하고 주제를 입력한 후 생성 버튼을 눌러주세요'
                      }
                    </p>
                  </div>
                </div>
              )}

              {/* 도움말 */}
              <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-3">💡 팁</h4>
                <ul className="text-sm text-blue-800 space-y-2">
                  <li>• <strong>단일 플랫폼:</strong> 한 플랫폼에 최적화된 게시물과 미리보기 제공</li>
                  <li>• <strong>다중 플랫폼:</strong> 여러 플랫폼에 맞는 게시물을 한 번에 생성</li>
                  <li>• <strong>유튜브:</strong> 제목(60자 이내)과 설명을 분리하여 SEO 최적화</li>
                  <li>• 각 플랫폼의 실제 문화와 톤에 맞는 자연스러운 글이 생성됩니다</li>
                  <li>• 이모지는 최소한으로 사용하며 플랫폼별로 적절히 조절됩니다</li>
                  <li>• 링크드인은 전문성 유지를 위해 이모지를 사용하지 않습니다</li>
                  <li>• 해시태그는 의미있고 검색 가능한 것만 선별하여 제공됩니다</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 