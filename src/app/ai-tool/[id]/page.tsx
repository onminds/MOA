"use client";
import { useState, useEffect, useMemo, useRef } from 'react';
import Head from 'next/head';
import { useParams, useRouter } from 'next/navigation';
import { Star, ArrowLeft, ExternalLink, Play, MessageCircle, ThumbsUp, ThumbsDown, Trash2, Edit, Bold } from 'lucide-react';
import { useSession } from 'next-auth/react';
import Header from '../../components/Header';
import Logo from '../../../components/Logo';
import { getCategoryLabelKo } from '@/config/aiCategories';
import { invalidateAiServicesLocalCache, markAiListNeedsRefresh } from '@/lib/client-utils';
import SitePreviewCard from '../../components/SitePreviewCard';

type AlertModalState = {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  onClose?: () => void;
};

type ConfirmModalState = {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => Promise<void> | void;
  onCancel?: () => void;
};

const createInitialAlertModalState = (): AlertModalState => ({
  open: false,
  title: '',
  message: '',
  confirmText: '확인',
});

const createInitialConfirmModalState = (): ConfirmModalState => ({
  open: false,
  title: '',
  message: '',
  confirmText: '확인',
  cancelText: '취소',
});

interface AIService {
  id: string;
  name: string;
  summary: string;
  description: string;
  coreFeatures?: string;
  pros?: string;
  cons?: string;
  category: string[];
  rating: number;
  url: string;
  features: string[];
  pricing: string[];
  source: string;
  icon?: string;
  userCount?: number;
  videoUrl?: string;
  // 추가 필드(노션)
  koreanSupport?: boolean;
  isKoreanService?: boolean;
  apiSupport?: boolean;
  loginMethods?: string[];
  usage?: string;
}

interface EditFormData {
  name: string;
  summary: string;
  description: string;
  coreFeatures: string;
  pros: string;
  cons: string;
  url: string;
  category: string[];
  icon: string;
  pricing: string[];
  features: string[];
  loginMethods: string[];
  koreanSupport: boolean;
  isKoreanService: boolean;
  apiSupport: boolean;
  usage: string;
}

interface Review {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  date: string;
  helpful: number;
  notHelpful: number;
  userVote?: string;
}

export default function AIToolDetail() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [service, setService] = useState<AIService | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRating, setUserRating] = useState(0);
  const [userComment, setUserComment] = useState('');
  const [showVideo, setShowVideo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [releases, setReleases] = useState<Array<{id:string;version:string;date:string;summary:string;details:string[];status?:string;url?:string}>>([]);
  const [showAllReleases, setShowAllReleases] = useState(false);
  const [releasesLoading, setReleasesLoading] = useState(false);
  const [related, setRelated] = useState<AIService[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [alertModal, setAlertModal] = useState<AlertModalState>(() => createInitialAlertModalState());
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>(() => createInitialConfirmModalState());
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState<EditFormData | null>(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string>('');
  const [loginCustomInput, setLoginCustomInput] = useState<string>('');
  const [featureInput, setFeatureInput] = useState<string>('');
  const [pricingInput, setPricingInput] = useState<string>('');
  const [pricingColor, setPricingColor] = useState<string>('blue');
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const coreFeaturesRef = useRef<HTMLTextAreaElement>(null);
  const usageRef = useRef<HTMLTextAreaElement>(null);
  const [showAppDownloadModal, setShowAppDownloadModal] = useState(false);

  const categoryGroups = [
    {
      group: '글쓰기',
      options: [
        { value: 'writing', label: '글쓰기(메인)' },
        { value: 'writing:marketing_copywriting', label: '마케팅/카피라이팅' },
        { value: 'writing:seo_blog', label: 'SEO/블로그' },
        { value: 'writing:email_newsletter', label: '이메일/뉴스레터' },
        { value: 'writing:resume_cover', label: '자소서/이력서' },
      ],
    },
    {
      group: '이미지 생성',
      options: [
        { value: 'image', label: '이미지 생성(메인)' },
        { value: 'image:logo_branding', label: '로고/브랜딩' },
        { value: 'image:webtoon_illustration', label: '웹툰/일러스트' },
        { value: 'image:photo_enhance', label: '사진보정/화질개선' },
      ],
    },
    {
      group: '생산성',
      options: [
        { value: 'productivity', label: '생산성(메인)' },
        { value: 'productivity:ppt_presentation', label: 'PPT/프레젠테이션' },
        { value: 'productivity:pdf_summary', label: 'PDF/문서요약' },
        { value: 'productivity:excel_analysis', label: '엑셀/데이터분석' },
        { value: 'productivity:translation', label: '번역' },
      ],
    },
    {
      group: '영상 생성',
      options: [
        { value: 'video', label: '영상 생성(메인)' },
        { value: 'video:shortform_reels', label: '숏폼/릴스 제작' },
        { value: 'video:marketing_ads', label: '마케팅 홍보영상' },
        { value: 'video:editing_caption', label: '영상 편집/자막' },
      ],
    },
    {
      group: '음성/음악',
      options: [
        { value: 'audio', label: '음성/음악(메인)' },
        { value: 'audio:tts', label: 'TTS(음성생성)' },
        { value: 'audio:stt', label: 'STT(녹취/속기)' },
        { value: 'audio:bgm_music', label: 'BGM/음악생성' },
      ],
    },
    {
      group: '채팅/대화',
      options: [
        { value: 'chat', label: '채팅/대화(메인)' },
        { value: 'chat:search_research', label: '검색/리서치' },
        { value: 'chat:language_conversation', label: '어학/회화' },
        { value: 'chat:psychology_counseling', label: '심리/상담' },
      ],
    },
    {
      group: '코딩',
      options: [
        { value: 'coding', label: '코딩(메인)' },
        { value: 'coding:nocode_website', label: '웹사이트 제작(노코드)' },
        { value: 'coding:code_generation', label: '코드 생성/디버깅' },
      ],
    },
    {
      group: '아바타',
      options: [
        { value: 'avatar', label: '아바타(메인)' },
        { value: 'avatar:ai_profile', label: 'AI 프로필' },
        { value: 'avatar:virtual_model', label: '가상 모델' },
      ],
    },
    {
      group: '3D 모델링',
      options: [
        { value: '3d_modeling', label: '3D 모델링(메인)' },
        { value: '3d_modeling:character', label: '캐릭터/피규어' },
        { value: '3d_modeling:architecture', label: '건축/인테리어' },
        { value: '3d_modeling:product', label: '제품 디자인' },
      ],
    },
  ];

  const loginMethodOptions = [
    'Email',
    'Google',
    'Apple',
    'Microsoft',
    'GitHub',
    'X(Twitter)',
    'Facebook',
    'Discord',
    'Slack',
    'Kakao',
    'Naver',
    'LINE',
    'WeChat',
    'Telegram',
    'SMS',
    'Phone',
    'Magic Link',
    'OTP',
    'SSO',
    'Wallet',
  ];

  const pricingColorOptions: { key: string; label: string; className: string }[] = [
    { key: 'blue', label: '파랑', className: 'bg-blue-100 text-blue-800 border-blue-200' },
    { key: 'green', label: '녹색', className: 'bg-green-100 text-green-800 border-green-200' },
    { key: 'amber', label: '노랑', className: 'bg-amber-100 text-amber-800 border-amber-200' },
    { key: 'purple', label: '보라', className: 'bg-purple-100 text-purple-800 border-purple-200' },
    { key: 'rose', label: '핑크', className: 'bg-rose-100 text-rose-800 border-rose-200' },
    { key: 'gray', label: '회색', className: 'bg-gray-100 text-gray-800 border-gray-200' },
    { key: 'indigo', label: '남색', className: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    { key: 'emerald', label: '에메랄드', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    { key: 'cyan', label: '시안', className: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  ];

  const parsePricingToken = (p: string) => {
    if (!p) return { label: '', color: '' };
    const [label, color] = p.split('|');
    return { label: (label || '').trim(), color: (color || '').trim() };
  };

  const loginColorClass = (method: string, checked: boolean) => {
    const base = checked ? 'border-' : 'border-';
    const colorMap: Record<string, { bg: string; border: string; text: string; hover: string }> = {
      Email: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', hover: 'hover:bg-orange-100' },
      Google: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', hover: 'hover:bg-amber-100' },
      Apple: { bg: 'bg-gray-900 text-white', border: 'border-gray-800', text: 'text-white', hover: 'hover:bg-gray-800' },
      Microsoft: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', hover: 'hover:bg-blue-100' },
      GitHub: { bg: 'bg-slate-900 text-white', border: 'border-slate-800', text: 'text-white', hover: 'hover:bg-slate-800' },
      'X(Twitter)': { bg: 'bg-slate-900 text-white', border: 'border-slate-800', text: 'text-white', hover: 'hover:bg-slate-800' },
      Twitter: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-800', hover: 'hover:bg-sky-100' },
      Facebook: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', hover: 'hover:bg-blue-100' },
      Discord: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-800', hover: 'hover:bg-indigo-100' },
      Slack: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', hover: 'hover:bg-emerald-100' },
      Kakao: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', hover: 'hover:bg-yellow-100' },
      Naver: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', hover: 'hover:bg-green-100' },
      LINE: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', hover: 'hover:bg-green-100' },
      WeChat: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', hover: 'hover:bg-emerald-100' },
      Telegram: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-800', hover: 'hover:bg-cyan-100' },
      SMS: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-800', hover: 'hover:bg-gray-100' },
      Phone: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-800', hover: 'hover:bg-gray-100' },
      'Magic Link': { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', hover: 'hover:bg-purple-100' },
      OTP: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800', hover: 'hover:bg-rose-100' },
      SSO: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', hover: 'hover:bg-blue-100' },
      Wallet: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', hover: 'hover:bg-amber-100' },
    };
    const fallback = { bg: checked ? 'bg-blue-50' : 'bg-white', border: checked ? 'border-blue-300' : 'border-gray-200', text: checked ? 'text-blue-700' : 'text-gray-700', hover: 'hover:bg-gray-50' };
    return colorMap[method] || fallback;
  };

  // 서비스 ID에서 숫자 ID 추출 (예: "abc-276" → 276)
  const numericToolId = useMemo(() => {
    const raw = String(service?.id || '');
    const m = raw.match(/(\d+)$/);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    return Number.isNaN(n) ? null : n;
  }, [service?.id]);

  const extractYouTubeEmbedUrl = (text: string | undefined | null): string | null => {
    if (!text) return null;
    const ytWatch = text.match(/https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([\w-]{6,})/i);
    if (ytWatch && ytWatch[1]) return `https://www.youtube-nocookie.com/embed/${ytWatch[1]}`;
    const ytShort = text.match(/https?:\/\/(?:www\.)?youtu\.be\/([\w-]{6,})/i);
    if (ytShort && ytShort[1]) return `https://www.youtube-nocookie.com/embed/${ytShort[1]}`;
    return null;
  };

  const videoEmbedUrl = useMemo(() => {
    if (service?.videoUrl) {
      const idFromParam = extractYouTubeEmbedUrl(service.videoUrl);
      if (idFromParam) return idFromParam;
    }
    const joined = `${service?.description || ''}\n${service?.summary || ''}`;
    return extractYouTubeEmbedUrl(joined);
  }, [service?.videoUrl, service?.description, service?.summary]);

  const formatRating = (value: number | string | null | undefined): string => {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return '0';
    return num
      .toFixed(2)
      .replace(/0+$/, '')
      .replace(/\.$/, '');
  };

  const closeAlertModal = () => setAlertModal(createInitialAlertModalState());
  const handleAlertConfirm = () => {
    const onClose = alertModal.onClose;
    closeAlertModal();
    if (onClose) onClose();
  };
  const showAlertModal = (title: string, message: string, confirmText = '확인', onClose?: () => void) => {
    setAlertModal({
      open: true,
      title,
      message,
      confirmText,
      onClose,
    });
  };

  const closeConfirmModal = () => {
    setConfirmLoading(false);
    setConfirmModal(createInitialConfirmModalState());
  };
  const handleConfirmCancel = () => {
    if (confirmModal.onCancel) confirmModal.onCancel();
    closeConfirmModal();
  };
  const openConfirmModal = (config: Omit<ConfirmModalState, 'open'>) => {
    setConfirmModal({
      ...createInitialConfirmModalState(),
      ...config,
      open: true,
    });
  };
  const handleConfirmSubmit = async () => {
    if (!confirmModal.onConfirm) {
      closeConfirmModal();
      return;
    }
    try {
      setConfirmLoading(true);
      await confirmModal.onConfirm();
      closeConfirmModal();
    } catch (error) {
      console.error('Confirm modal 처리 중 오류:', error);
      setConfirmLoading(false);
    }
  };

  // 모바일 앱 다운로드 모달 표시 (최초 1회)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const isMobile = () => {
      const ua = window.navigator.userAgent;
      console.log('User Agent:', ua);
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    };

    const mobile = isMobile();
    console.log('Is Mobile:', mobile);
    
    if (!mobile) return;
    
    // 테스트용: localStorage 체크 임시 비활성화
    // const hasShownModal = window.localStorage.getItem('moa_app_download_modal_shown');
    // console.log('Has shown modal before:', hasShownModal);
    
    // if (!hasShownModal) {
      // 페이지 로드 후 1초 뒤에 모달 표시
      const timer = setTimeout(() => {
        console.log('Showing app download modal');
        setShowAppDownloadModal(true);
        // window.localStorage.setItem('moa_app_download_modal_shown', 'true');
      }, 1000);
      
      return () => clearTimeout(timer);
    // }
  }, []);

  // 세션 상태 모니터링 및 강제 업데이트
  useEffect(() => {
    if (status === 'authenticated' && session) {
      // 소셜 로그인 사용자의 경우 세션 강제 업데이트
      const checkAndUpdateSession = async () => {
        try {
          const { getSession } = await import('next-auth/react');
          await getSession();
        } catch (error) {
          console.log('세션 업데이트 중 오류:', error);
        }
      };
      
      // 1초 후 세션 상태 확인 및 업데이트
      const timer = setTimeout(checkAndUpdateSession, 1000);
      return () => clearTimeout(timer);
    }
  }, [status, session]);

  useEffect(() => {
    const load = async () => {
      if (!params.id) return;
      try {
        const res = await fetch(`/api/ai-services/${params.id}`);
        if (res.ok) {
          const data = await res.json();
          setService(data.service || null);
        } else {
          setService(null);
        }
      } catch (e) {
        console.error('Failed to fetch service detail:', e);
        setService(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [params.id]);

  // 관련 도구 로드(카테고리 기준 Top N)
  useEffect(() => {
    const loadRelated = async () => {
      try {
        const primaryCategory = Array.isArray(service?.category) ? service?.category[0] : service?.category;
        if (!primaryCategory) return;
        setRelatedLoading(true);
        const qs = new URLSearchParams({ thin: '1', limit: '8', sort: 'rating', category: primaryCategory });
        const res = await fetch(`/api/ai-services?${qs.toString()}`);
        const data = await res.json();
        const list: AIService[] = (data.services || []).filter((s: AIService) => s.id !== (service?.id ?? ''));
        setRelated(list);
      } catch {
        setRelated([]);
      } finally {
        setRelatedLoading(false);
      }
    };
    loadRelated();
  }, [service?.id, service?.category]);

  useEffect(() => {
    const fetchReleases = async () => {
      try {
        if (!service) return;
        setReleasesLoading(true);
        const normalizeDomain = (u?: string) => {
          if (!u) return '';
          try {
            const url = new URL(u.startsWith('http') ? u : `https://${u}`);
            return url.hostname.replace(/^www\./, '').toLowerCase();
          } catch {
            return String(u).replace(/^www\./, '').toLowerCase();
          }
        };
        const q = new URLSearchParams({ 
          name: service.name || '',
          id: String(service.id || ''),
          domain: normalizeDomain(service.url || '')
        }).toString();
        const cacheKey = `releases:${service.id}`;
        const etagKey = `releasesEtag:${service.id}`;
        const inm = typeof window !== 'undefined' ? window.sessionStorage.getItem(etagKey) || '' : '';
        const res = await fetch(`/api/ai-services/${service.id}/releases?${q}`, { headers: inm ? { 'If-None-Match': inm } : {} });
        if (res.status === 304) {
          const cached = window.sessionStorage.getItem(cacheKey);
          if (cached) setReleases(JSON.parse(cached));
          return;
        }
        if (!res.ok) {
          setReleases([]);
          return;
        }
        const data = await res.json();
        const etag = res.headers.get('ETag');
        if (etag) window.sessionStorage.setItem(etagKey, etag);
        const list = data.releases || [];
        setReleases(list);
        try { window.sessionStorage.setItem(cacheKey, JSON.stringify(list)); } catch {}
      } catch (e) {
        console.error('Failed to fetch releases:', e);
        setReleases([]);
      } finally {
        setReleasesLoading(false);
      }
    };
    fetchReleases();
  }, [service?.id, service?.name]);

  useEffect(() => {
    if (numericToolId) {
      fetchReviews();
    }
  }, [numericToolId, session?.user?.id]);

  // fetchServiceDetail 제거됨 (단건 API 사용)

  const fetchReviews = async () => {
    try {
      if (!numericToolId) return;
      const response = await fetch(`/api/reviews/${numericToolId}`, {
        headers: {
          'Authorization': `Bearer ${session?.user?.id || ''}`
        }
      });
      const data = await response.json();
      console.log('리뷰 데이터:', data.reviews); // 디버깅용
      setReviews(data.reviews || []);
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
      setReviews([]);
    }
  };

  const handleSubmitReview = async () => {
    if (!session?.user?.id) {
      showAlertModal('로그인 필요', '리뷰를 작성하려면 로그인하세요.');
      return;
    }

    if (userRating === 0) {
      showAlertModal('평점 입력 필요', '평점을 선택해주세요.');
      return;
    }

    if (!userComment.trim()) {
      showAlertModal('내용 입력 필요', '리뷰 내용을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (!numericToolId) {
        showAlertModal('오류', '리뷰 대상을 확인할 수 없습니다.');
        return;
      }
      const response = await fetch(`/api/reviews/${numericToolId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.user.id}`
        },
        body: JSON.stringify({
          rating: userRating,
          comment: userComment.trim(),
          userId: session.user.id
        })
      });

      if (response.ok) {
        setUserRating(0);
        setUserComment('');
        await fetchReviews(); // 리뷰 목록 새로고침
        invalidateAiServicesLocalCache();
        markAiListNeedsRefresh();
        showAlertModal('리뷰 등록 완료', '리뷰가 등록되었습니다.');
      } else {
        const errorData = await response.json();
        showAlertModal('오류', errorData.error || '리뷰 등록에 실패했습니다.');
      }
    } catch (error) {
      console.error('리뷰 등록 오류:', error);
      showAlertModal('오류', '리뷰 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleHelpful = async (reviewId: string, isHelpful: boolean) => {
    if (!session?.user?.id) {
      showAlertModal('로그인 필요', '투표를 하려면 로그인하세요.');
      return;
    }

    try {
      if (!numericToolId) return;
      const response = await fetch(`/api/reviews/${numericToolId}/${reviewId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.user.id}`
        },
        body: JSON.stringify({
          isHelpful: isHelpful,
          userId: session.user.id
        })
      });

      if (response.ok) {
        await fetchReviews(); // 리뷰 목록 새로고침
      } else {
        const errorData = await response.json();
        showAlertModal('오류', errorData.error || '투표에 실패했습니다.');
      }
    } catch (error) {
      console.error('투표 오류:', error);
      showAlertModal('오류', '투표 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteReview = (reviewId: string) => {
    if (!session?.user?.id) {
      showAlertModal('로그인 필요', '리뷰를 삭제하려면 로그인하세요.');
      return;
    }

    openConfirmModal({
      title: '리뷰 삭제',
      message: '정말로 이 리뷰를 삭제하시겠습니까?',
      confirmText: '삭제',
      cancelText: '취소',
      onConfirm: async () => {
        try {
          if (!numericToolId) {
            showAlertModal('오류', '리뷰 대상을 확인할 수 없습니다.');
            return;
          }
          const response = await fetch(`/api/reviews/${numericToolId}/${reviewId}/delete`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId: session.user.id, userRole: (session as any)?.user?.role || 'USER' })
          });

          if (response.ok) {
            await fetchReviews(); // 리뷰 목록 새로고침
            invalidateAiServicesLocalCache();
            markAiListNeedsRefresh();
            showAlertModal('삭제 완료', '리뷰가 삭제되었습니다.');
          } else {
            const errorData = await response.json();
            showAlertModal('오류', errorData.error || '리뷰 삭제에 실패했습니다.');
          }
        } catch (error) {
          console.error('리뷰 삭제 오류:', error);
          showAlertModal('오류', '리뷰 삭제 중 오류가 발생했습니다.');
        }
      },
    });
  };

  // 수정 모달 열기
  const handleOpenEditModal = () => {
    if (!service) return;
    
    // Twitter를 X(Twitter)로 자동 변환
    const convertedLoginMethods = (service.loginMethods || []).map(m => 
      m === 'Twitter' ? 'X(Twitter)' : m
    );
    
    setEditFormData({
      name: service.name || '',
      summary: service.summary || '',
      description: service.description || '',
      coreFeatures: service.coreFeatures || '',
      pros: service.pros || '',
      cons: service.cons || '',
      url: service.url || '',
      category: Array.isArray(service.category) ? service.category : (service.category ? [service.category] : []),
      icon: service.icon || '',
      pricing: service.pricing || [],
      features: service.features || [],
      loginMethods: convertedLoginMethods,
      koreanSupport: service.koreanSupport || false,
      isKoreanService: service.isKoreanService || false,
      apiSupport: service.apiSupport || false,
      usage: service.usage || ''
    });
    setIconFile(null);
    setIconPreview('');
    setShowEditModal(true);
  };

  // 아이콘 파일 선택 핸들러
  const handleIconFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 타입 검증
    if (!file.type.startsWith('image/')) {
      showAlertModal('오류', '이미지 파일만 선택 가능합니다.');
      return;
    }

    // 파일 크기 검증 (2MB)
    if (file.size > 2 * 1024 * 1024) {
      showAlertModal('오류', '이미지 파일 크기는 2MB 이하여야 합니다.');
      return;
    }

    setIconFile(file);

    // 미리보기 생성
    const reader = new FileReader();
    reader.onloadend = () => {
      setIconPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // 선택한 텍스트를 굵게 만들기
  const applyBold = (field: 'description' | 'coreFeatures' | 'usage') => {
    const ref = field === 'description' ? descriptionRef.current : 
                field === 'coreFeatures' ? coreFeaturesRef.current : 
                usageRef.current;
    if (!ref || !editFormData) return;
    
    const start = ref.selectionStart;
    const end = ref.selectionEnd;
    const value = field === 'description' ? editFormData.description : 
                  field === 'coreFeatures' ? (editFormData.coreFeatures || '') : 
                  editFormData.usage;
    
    if (start === end) {
      showAlertModal('텍스트 선택 필요', '굵게 만들 텍스트를 먼저 드래그하여 선택해주세요.');
      return;
    }
    
    const before = value.slice(0, start);
    const selected = value.slice(start, end);
    const after = value.slice(end);
    const newValue = `${before}**${selected}**${after}`;
    
    setEditFormData({ ...editFormData, [field]: newValue });
    
    // 커서 위치 복원
    setTimeout(() => {
      ref.focus();
      ref.setSelectionRange(start, end + 4); // ** ** 추가된 만큼
    }, 0);
  };

  const toggleCategory = (cat: string) => {
    if (!editFormData) return;
    setEditFormData((prev) => {
      if (!prev) return prev;
      const exists = (prev.category || []).includes(cat);
      const next = exists
        ? (prev.category || []).filter((c) => c !== cat)
        : [...(prev.category || []), cat];
      return { ...prev, category: next };
    });
  };

  const toggleLoginMethod = (method: string) => {
    if (!editFormData) return;
    setEditFormData((prev) => {
      if (!prev) return prev;
      const current = prev.loginMethods || [];
      
      // X(Twitter)를 추가/제거할 때 Twitter도 함께 처리
      if (method === 'X(Twitter)') {
        const hasXTwitter = current.includes('X(Twitter)');
        const hasTwitter = current.includes('Twitter');
        
        if (hasXTwitter || hasTwitter) {
          // 둘 중 하나라도 있으면 둘 다 제거
          return { 
            ...prev, 
            loginMethods: current.filter((m) => m !== 'X(Twitter)' && m !== 'Twitter') 
          };
        } else {
          // 없으면 X(Twitter)만 추가
          return { 
            ...prev, 
            loginMethods: [...current, 'X(Twitter)'] 
          };
        }
      }
      
      // 다른 메서드는 기존 로직
      const exists = current.includes(method);
      const next = exists
        ? current.filter((m) => m !== method)
        : [...current, method];
      return { ...prev, loginMethods: next };
    });
  };

  const moveCategory = (index: number, direction: 'up' | 'down') => {
    if (!editFormData) return;
    setEditFormData((prev) => {
      if (!prev) return prev;
      const list = [...(prev.category || [])];
      if (direction === 'up' && index > 0) {
        [list[index - 1], list[index]] = [list[index], list[index - 1]];
      }
      if (direction === 'down' && index < list.length - 1) {
        [list[index + 1], list[index]] = [list[index], list[index + 1]];
      }
      return { ...prev, category: list };
    });
  };

  const removeCategory = (index: number) => {
    if (!editFormData) return;
    setEditFormData((prev) => {
      if (!prev) return prev;
      const list = [...(prev.category || [])];
      list.splice(index, 1);
      return { ...prev, category: list };
    });
  };

  const addCustomLoginMethods = () => {
    if (!editFormData || !loginCustomInput.trim()) return;
    const tokens = loginCustomInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (tokens.length === 0) return;
    setEditFormData((prev) => {
      if (!prev) return prev;
      const current = new Set(prev.loginMethods || []);
      tokens.forEach((t) => current.add(t));
      return { ...prev, loginMethods: Array.from(current) };
    });
    setLoginCustomInput('');
  };

  const addFeatures = () => {
    if (!editFormData || !featureInput.trim()) return;
    const tokens = featureInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (tokens.length === 0) return;
    setEditFormData((prev) => {
      if (!prev) return prev;
      const current = new Set(prev.features || []);
      tokens.forEach((t) => current.add(t));
      return { ...prev, features: Array.from(current) };
    });
    setFeatureInput('');
  };

  const removeFeature = (f: string) => {
    if (!editFormData) return;
    setEditFormData((prev) => {
      if (!prev) return prev;
      return { ...prev, features: (prev.features || []).filter((x) => x !== f) };
    });
  };

  const addPricing = () => {
    if (!editFormData || !pricingInput.trim()) return;
    const trimmed = pricingInput.trim();
    if (!trimmed) return;
    setEditFormData((prev) => {
      if (!prev) return prev;
      const current = new Set(prev.pricing || []);
      current.add(pricingColor ? `${trimmed}|${pricingColor}` : trimmed);
      return { ...prev, pricing: Array.from(current) };
    });
    setPricingInput('');
  };

  const movePricing = (index: number, direction: 'up' | 'down') => {
    if (!editFormData) return;
    setEditFormData((prev) => {
      if (!prev) return prev;
      const list = [...(prev.pricing || [])];
      if (direction === 'up' && index > 0) {
        [list[index - 1], list[index]] = [list[index], list[index - 1]];
      }
      if (direction === 'down' && index < list.length - 1) {
        [list[index + 1], list[index]] = [list[index], list[index + 1]];
      }
      return { ...prev, pricing: list };
    });
  };

  const removePricing = (index: number) => {
    if (!editFormData) return;
    setEditFormData((prev) => {
      if (!prev) return prev;
      const list = [...(prev.pricing || [])];
      list.splice(index, 1);
      return { ...prev, pricing: list };
    });
  };

  // AI 서비스 정보 수정 제출
  const handleSubmitEdit = async () => {
    if (!editFormData || !service) return;

    // 필수 필드 검증
    if (!editFormData.name.trim() || !editFormData.url.trim()) {
      showAlertModal('입력 오류', '이름과 URL은 필수 항목입니다.');
      return;
    }

    setIsEditSubmitting(true);
    try {
      let iconUrl = editFormData.icon;

      // 아이콘 파일이 선택된 경우 먼저 업로드
      if (iconFile) {
        const iconFormData = new FormData();
        iconFormData.append('icon', iconFile);

        const iconUploadRes = await fetch('/api/ai-services/icon', {
          method: 'POST',
          body: iconFormData
        });

        const iconData = await iconUploadRes.json();

        if (iconUploadRes.ok) {
          iconUrl = iconData.iconUrl;
        } else {
          showAlertModal('오류', iconData.error || '아이콘 업로드에 실패했습니다.');
          setIsEditSubmitting(false);
          return;
        }
      }

      // AI 서비스 정보 업데이트
      const response = await fetch(`/api/ai-services/${service.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...editFormData,
          icon: iconUrl
        })
      });

      const data = await response.json();

      if (response.ok) {
        // 서비스 정보 새로고침
        const refreshRes = await fetch(`/api/ai-services/${service.id}`);
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          setService(refreshData.service || null);
        }
        
        // 캐시 무효화
        invalidateAiServicesLocalCache();
        markAiListNeedsRefresh();
        
        setShowEditModal(false);
        setIconFile(null);
        setIconPreview('');
        showAlertModal('수정 완료', 'AI 서비스 정보가 성공적으로 수정되었습니다.');
      } else {
        showAlertModal('오류', data.error || 'AI 서비스 정보 수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('AI 서비스 정보 수정 오류:', error);
      showAlertModal('오류', 'AI 서비스 정보 수정 중 오류가 발생했습니다.');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  // AI 서비스 삭제
  const handleDeleteService = () => {
    if (!service) return;

    // 수정 모달 먼저 닫기
    setShowEditModal(false);
    setIconFile(null);
    setIconPreview('');

    // 잠시 후 삭제 확인 모달 열기 (모달 닫힘 애니메이션 후)
    setTimeout(() => {
      openConfirmModal({
        title: 'AI 서비스 삭제',
        message: `정말로 "${service.name}"을(를) 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 관련된 모든 리뷰와 데이터도 함께 삭제됩니다.`,
        confirmText: '삭제',
        cancelText: '취소',
        onConfirm: async () => {
          try {
            const response = await fetch(`/api/ai-services/${service.id}`, {
              method: 'DELETE'
            });

            const data = await response.json();

            if (response.ok) {
              // 캐시 무효화
              invalidateAiServicesLocalCache();
              markAiListNeedsRefresh();
              
              showAlertModal('삭제 완료', 'AI 서비스가 성공적으로 삭제되었습니다.', '확인', () => {
                // AI 목록 페이지로 이동
                router.push('/ai-list');
              });
            } else {
              showAlertModal('오류', data.error || 'AI 서비스 삭제에 실패했습니다.');
            }
          } catch (error) {
            console.error('AI 서비스 삭제 오류:', error);
            showAlertModal('오류', 'AI 서비스 삭제 중 오류가 발생했습니다.');
          }
        }
      });
    }, 100);
  };

  const renderStars = (rating: number, interactive = false, onRatingChange?: (rating: number) => void) => {
    return (
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type={interactive ? 'button' : undefined}
            onClick={interactive && onRatingChange ? () => onRatingChange(star) : undefined}
            className={`${interactive ? 'cursor-pointer' : 'cursor-default'}`}
            disabled={!interactive}
          >
            <Star
              className={`w-5 h-5 ${
                star <= rating
                  ? 'text-yellow-400 fill-current'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  const getPricingLabel = (p: string) => {
    const { label } = parsePricingToken(p);
    const key = label.toLowerCase();
    return key === 'free' ? '무료' :
      key === 'trial' ? '무료체험' :
      key === 'paid' ? '유료' :
      key === 'partial' ? '부분유료' :
      key === 'subscription' ? '구독형태' :
      key === 'usage' ? '사용자기반' : label || p;
  };
  const getPricingBadgeClass = (p: string) => {
    const { label, color } = parsePricingToken(p);
    const byColor: Record<string, string> = {
      blue: 'bg-blue-100 text-blue-800 border-blue-200',
      green: 'bg-green-100 text-green-800 border-green-200',
      amber: 'bg-amber-100 text-amber-800 border-amber-200',
      purple: 'bg-purple-100 text-purple-800 border-purple-200',
      rose: 'bg-rose-100 text-rose-800 border-rose-200',
      gray: 'bg-gray-100 text-gray-800 border-gray-200',
      indigo: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      cyan: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    };
    if (color && byColor[color]) return byColor[color];
    const key = label.toLowerCase();
    return key === 'free' ? 'bg-green-100 text-green-800 border-green-200' :
      key === 'trial' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
      key === 'paid' ? 'bg-red-100 text-red-800 border-red-200' :
      key === 'partial' ? 'bg-amber-100 text-amber-800 border-amber-200' :
      key === 'subscription' ? 'bg-blue-100 text-blue-800 border-blue-200' :
      key === 'usage' ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-gray-100 text-gray-700 border-gray-200';
  };
  const getCategoryLabel = (category: string) => getCategoryLabelKo(category);
  const getStatusBadgeClass = (s?: string) => {
    const t = (s || '').toLowerCase();
    if (t.includes('운영중') || t.includes('stable') || t.includes('active')) return 'bg-green-100 text-green-800';
    if (t.includes('업데이트 중단') || t.includes('deprecated')) return 'bg-yellow-100 text-yellow-800';
    if (t.includes('운영중단') || t.includes('stop') || t.includes('inactive')) return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-700';
  };

  // 간단한 마크다운 렌더링 (굵게만)
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const content = part.slice(2, -2);
        return <strong key={index} className="font-bold text-gray-900">{content}</strong>;
      }
      return <span key={index}>{part}</span>;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="p-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-64 bg-gray-200 rounded mb-4"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="p-8">
          <Head>
            <meta name="robots" content="noindex,follow" />
          </Head>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">도구를 찾을 수 없습니다</h1>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              뒤로 가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  const jsonLd = service ? {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": service.name,
    "applicationCategory": Array.isArray(service.category) ? service.category.join(', ') : service.category,
    "applicationSubCategory": Array.isArray(service.category) ? service.category.join(', ') : service.category,
    "operatingSystem": "Web",
    "url": service.url,
    "description": service.summary || service.description,
    "aggregateRating": service.rating ? {
      "@type": "AggregateRating",
      "ratingValue": service.rating,
      "reviewCount": service.userCount || 0
    } : undefined,
    "offers": Array.isArray(service.pricing) && service.pricing.length > 0 ? {
      "@type": "Offer",
      "price": 0,
      "priceCurrency": "USD",
      "category": service.pricing.join(',')
    } : undefined
  } : null;

  const breadcrumbLd = service ? {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "홈",
        "item": "/"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "AI 목록",
        "item": "/ai-list"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": service.name,
        "item": typeof window !== 'undefined' ? window.location.pathname : ''
      }
    ]
  } : null;

  return (
    <>
      <div className="min-h-screen bg-gray-50">
      <Head>
        {jsonLd && (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        )}
        {breadcrumbLd && (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
        )}
        {service && (
          <>
            <title>{`${service.name} | 모아툴스`}</title>
            <meta name="description" content={(service.summary || service.description || '').slice(0, 160)} />
            <meta property="og:title" content={`${service.name} | 모아툴스`} />
            <meta property="og:description" content={(service.summary || service.description || '').slice(0, 200)} />
            <meta property="og:type" content="website" />
            <meta property="og:image" content={service.icon ? `/api/proxy-image?url=${encodeURIComponent(service.icon)}` : '/icon.png'} />
            <meta name="twitter:card" content="summary_large_image" />
            <link rel="canonical" href={`${process.env.NEXT_PUBLIC_BASE_URL || ''}${typeof window !== 'undefined' ? window.location.pathname : ''}`} />
            <meta name="robots" content="index,follow" />
          </>
        )}
      </Head>
      <Header />
      <div className="p-8 max-w-7xl mx-auto">
        {/* 뒤로 가기 버튼 */}
        <button
          aria-label="뒤로 가기"
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          뒤로 가기
        </button>

        {/* 헤더 섹션 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Logo url={service.url} icon={service.icon} alt={`${service.name} 로고`} size={64} className="shrink-0" />
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{service.name}</h1>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  {renderStars(service.rating)}
                <span className="text-lg font-semibold text-gray-900">{formatRating(service.rating)}</span>
                </div>
                {service.userCount && (
                  <div className="flex items-center gap-1 text-gray-600">
                    <span>👥</span>
                    <span className="font-medium">
                      {service.userCount >= 1000000
                        ? `${(service.userCount / 1000000).toFixed(1)}M`
                        : service.userCount >= 1000
                        ? `${(service.userCount / 1000).toFixed(1)}K`
                        : service.userCount}
                    </span>
                  </div>
                )}
                {(Array.isArray(service.category) ? service.category : []).map((cat, idx) => (
                  <span
                    key={cat + idx}
                    className="px-3 py-1 bg-gray-50 text-gray-800 border border-gray-200 rounded-full text-sm font-medium"
                  >
                    {getCategoryLabel(cat)}
                  </span>
                ))}
                {service.koreanSupport && (
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">한국어 지원</span>
                )}
                {service.apiSupport && (
                  <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">API 지원</span>
                )}
                {service.isKoreanService && (
                  <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">국내 서비스</span>
                )}
              </div>
            </div>
            {/* 관리자 전용 수정 버튼 */}
            {session?.user?.role === 'ADMIN' && (
              <button
                onClick={handleOpenEditModal}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                aria-label="AI 정보 수정"
              >
                <Edit className="w-4 h-4" />
                수정
              </button>
            )}
          </div>
        </div>

        {/* 2열 레이아웃 (좌:7, 우:5) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* 좌측 컬럼: 설명, 사용 방법, 한국어 지원, 로그인, 가격, 리뷰 */}
          <div className="space-y-6 lg:col-span-7">
            {/* 도구 설명 */}
            <div className="bg-white rounded-lg shadow-sm p-5">
              <h2 className="text-xl font-bold text-gray-900 mb-3">도구 설명</h2>
              {service.description ? (
                <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                  {renderMarkdown(service.description)}
                </div>
              ) : (
                <p className="text-gray-700 leading-relaxed">{service.summary}</p>
              )}
            </div>

            {/* 핵심 기능 */}
            {service.coreFeatures && (
              <div className="bg-white rounded-lg shadow-sm p-5">
                <h2 className="text-xl font-bold text-gray-900 mb-3">⭐ 핵심 기능</h2>
                <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                  {renderMarkdown(service.coreFeatures)}
                </div>
              </div>
            )}

            {/* 장점 */}
            {service.pros && (
              <div className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-green-500">
                <h2 className="text-xl font-bold text-gray-900 mb-3">👍 장점</h2>
                <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                  {renderMarkdown(service.pros)}
                </div>
              </div>
            )}

            {/* 단점 */}
            {service.cons && (
              <div className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-amber-500">
                <h2 className="text-xl font-bold text-gray-900 mb-3">⚠️ 단점 / 제한사항</h2>
                <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                  {renderMarkdown(service.cons)}
                </div>
              </div>
            )}

            {/* 사용 방법 (좌측, 일반 텍스트) */}
            {service.usage && (
              <div className="bg-white rounded-lg shadow-sm p-5">
                <h2 className="text-xl font-bold text-gray-900 mb-3">사용 방법</h2>
                <div className="text-gray-800 whitespace-pre-line leading-relaxed text-[15px]">
                  {renderMarkdown(service.usage)}
                </div>
              </div>
            )}

            {/* 정보 섹션: 한국어 지원 / 로그인 방식 / 가격 정보 (한 행 정렬) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 한국어 지원 */}
              <div className="bg-white rounded-lg shadow-sm p-5 text-center flex flex-col gap-3 min-h-[150px]">
                <h2 className="text-xl font-bold text-gray-900 mb-3">한국어 지원</h2>
                <div className="flex flex-wrap items-center justify-center gap-2 text-gray-800 min-h-[48px]">
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${service.koreanSupport ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                    {service.koreanSupport ? '한국어 UI/문서 지원' : '한국어 미지원'}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${service.isKoreanService ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'}`}>
                    {service.isKoreanService ? '국내 서비스' : '해외 서비스'}
                  </span>
                </div>
              </div>

              {/* 로그인 방식 */}
              <div className="bg-white rounded-lg shadow-sm p-5 text-center flex flex-col gap-3 min-h-[150px]">
                <h2 className="text-xl font-bold text-gray-900 mb-3">로그인 방식</h2>
                {service.loginMethods && service.loginMethods.length > 0 ? (
                  <div className="flex flex-wrap gap-2 justify-center items-center min-h-[48px]">
                    {service.loginMethods.map((m, i) => {
                      // Twitter를 X(Twitter)로 자동 변환
                      const displayMethod = m === 'Twitter' ? 'X(Twitter)' : m;
                      const colors = loginColorClass(displayMethod, true);
                      return (
                        <span
                          key={i}
                          className={`px-3 py-1 border rounded-full text-sm font-semibold ${colors.bg} ${colors.border} ${colors.text}`}
                        >
                          {displayMethod}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">정보 없음</p>
                )}
              </div>

              {/* 가격 정보 */}
              <div className="bg-white rounded-lg shadow-sm p-5 text-center flex flex-col gap-3 min-h-[150px]">
                <h2 className="text-xl font-bold text-gray-900 mb-3">가격 정보</h2>
                <div className="flex items-center gap-2 flex-wrap justify-center min-h-[48px]">
                  {(Array.isArray(service.pricing) ? service.pricing : [service.pricing].filter(Boolean)).map((p, index) => (
                    <span key={index} className={`px-3 py-1 rounded-full text-sm font-semibold ${getPricingBadgeClass(p)}`}>
                      {getPricingLabel(p)}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* 리뷰 섹션 */}
            <div className="bg-white rounded-lg shadow-sm p-5">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-gray-900">사용자 리뷰</h2>
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-gray-500" />
                  <span className="text-gray-600">{reviews.length}개의 리뷰</span>
                </div>
              </div>

              {/* 리뷰 작성 폼 */}
              {session?.user?.id && (
                <div className="border border-gray-200 rounded-lg p-5 mb-6 bg-gray-50">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">리뷰 작성</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">평점</label>
                      {renderStars(userRating, true, setUserRating)}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">리뷰 내용</label>
                      <textarea
                        value={userComment}
                        onChange={(e) => setUserComment(e.target.value)}
                        placeholder="이 도구에 대한 경험을 공유해주세요..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        rows={4}
                      />
                    </div>
                    <button
                      onClick={handleSubmitReview}
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                    >
                      {isSubmitting ? '등록 중...' : '리뷰 등록'}
                    </button>
                  </div>
                </div>
              )}

              {/* 리뷰 목록 */}
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div key={review.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-700">
                            {review.userName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{review.userName}</div>
                          <div className="flex items-center gap-2">
                            {renderStars(review.rating)}
                            <span className="text-sm text-gray-500">{review.date}</span>
                          </div>
                        </div>
                      </div>
                      {session?.user?.id === review.userId && (
                        <button
                          onClick={() => handleDeleteReview(review.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-gray-700 mb-3">{review.comment}</p>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleHelpful(review.id, true)}
                        className={`flex items-center gap-1 text-sm ${
                          review.userVote === 'helpful' ? 'text-blue-600' : 'text-gray-500 hover:text-blue-600'
                        }`}
                      >
                        <ThumbsUp className="w-4 h-4" />
                        도움됨 ({review.helpful})
                      </button>
                      <button
                        onClick={() => handleHelpful(review.id, false)}
                        className={`flex items-center gap-1 text-sm ${
                          review.userVote === 'notHelpful' ? 'text-red-600' : 'text-gray-500 hover:text-red-600'
                        }`}
                      >
                        <ThumbsDown className="w-4 h-4" />
                        도움안됨 ({review.notHelpful})
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {reviews.length === 0 && (
                <div className="text-center py-8">
                  <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">아직 리뷰가 없습니다.</p>
                  <p className="text-gray-400 text-sm">첫 번째 리뷰를 작성해보세요!</p>
                </div>
              )}
            </div>
          </div>

          {/* 우측 컬럼: 사이트 프리뷰, 릴리즈 */}
          <div className="space-y-6 lg:col-span-5">
            {/* 공식 사이트 프리뷰 카드 */}
            <div className="bg-white rounded-lg shadow-sm p-5">
              <h2 className="text-xl font-bold text-gray-900 mb-3">공식 사이트</h2>
              <SitePreviewCard url={service.url} title={service.name} />
            </div>

            {/* 주요 기능 (우측) */}
            <div className="bg-white rounded-lg shadow-sm p-5">
              <h2 className="text-xl font-bold text-gray-900 mb-3">주요 기능</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(service.features || []).map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-700 text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Releases 섹션 */}
            <div className="bg-white rounded-lg shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-gray-900">API 모델</h2>
                {!releasesLoading && releases.length > 0 && (
                  <span className="text-sm text-gray-500">총 {releases.length}개</span>
                )}
              </div>
              {releasesLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse rounded-md border border-gray-200 p-3">
                      <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
                      <div className="h-3 bg-gray-100 rounded w-3/4" />
                    </div>
                  ))}
                </div>
              ) : releases.length === 0 ? (
                <p className="text-gray-500 text-sm">등록된 릴리즈가 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {(showAllReleases ? releases : releases.slice(0, 5)).map((r) => (
                    <details key={r.id} className="rounded-md border border-gray-200">
                      <summary className="px-3 py-2 cursor-pointer font-medium text-gray-900">{r.version}</summary>
                      <div className="px-4 pb-3">
                        {r.summary && (
                          <p className="text-gray-700 mb-2 whitespace-pre-line">{r.summary}</p>
                        )}
                        {r.details && r.details.length > 0 && (
                          <ul className="list-disc pl-5 space-y-1 text-gray-700">
                            {r.details.map((d, i) => (<li key={i}>{d}</li>))}
                          </ul>
                        )}
                        <div className="mt-2 text-sm text-gray-500 flex items-center gap-2">
                          <span>릴리즈 일자: {r.date}</span>
                          {r.status && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(r.status)}`}>{r.status}</span>
                          )}
                        </div>
                      </div>
                    </details>
                  ))}
                  {releases.length > 5 && (
                    <button onClick={() => setShowAllReleases(v => !v)} className="w-full text-sm text-gray-600 hover:text-gray-900 py-2">
                      {showAllReleases ? '접기' : '모두 보기'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 관련 도구 */}
            <div className="bg-white rounded-lg shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-gray-900">관련 도구</h2>
                {!relatedLoading && related.length > 0 && (
                  <span className="text-sm text-gray-500">{related.length}개</span>
                )}
              </div>
              {relatedLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-md border border-gray-200 animate-pulse bg-gray-100" />
                  ))}
                </div>
              ) : related.length === 0 ? (
                <p className="text-gray-500 text-sm">관련 도구가 없습니다.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {related.map((r) => (
                    <a key={r.id} href={`/ai-tool/${r.id}`}
                       className="border border-gray-200 rounded-md p-3 hover:shadow-sm bg-white"
                       aria-label={`${r.name} 상세로 이동`}>
                      <div className="flex items-center gap-2">
                        <Logo url={r.url} icon={r.icon} alt={`${r.name} 로고`} size={24} />
                        <div className="text-sm font-medium text-gray-900 truncate">{r.name}</div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
        {/* // 2열 레이아웃 끝 */}

      </div>
      </div>
      {confirmModal.open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={handleConfirmCancel}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900">{confirmModal.title}</h3>
            <p className="mt-3 whitespace-pre-line text-sm text-gray-600">{confirmModal.message}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                disabled={confirmLoading}
              >
                {confirmModal.cancelText || '취소'}
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={confirmLoading}
              >
                {confirmLoading ? '처리 중...' : (confirmModal.confirmText || '확인')}
              </button>
            </div>
          </div>
        </div>
      )}
      {alertModal.open && (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          onClick={handleAlertConfirm}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900">{alertModal.title}</h3>
            <p className="mt-3 whitespace-pre-line text-sm text-gray-600">{alertModal.message}</p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleAlertConfirm}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                {alertModal.confirmText || '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 모바일 앱 다운로드 모달 */}
      {showAppDownloadModal && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowAppDownloadModal(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-3xl shadow-2xl p-6 pb-8 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center gap-4">
              {/* 상단 드래그 인디케이터 */}
              <div className="w-12 h-1 bg-gray-300 rounded-full mb-2"></div>
              
              {/* MOA 로고 */}
              <img 
                src="/images/Moa_Logo.png" 
                alt="MOA Tools" 
                className="w-20 h-20 object-contain mb-2"
              />
              
              <h3 className="text-xl font-bold text-gray-900 text-center">
                MOA Tools 앱으로<br />더 편리하게 이용하세요
              </h3>
              
              <p className="text-sm text-gray-600 text-center mb-4">
                앱에서 더 빠르고 편리한 AI 도구를 경험하세요
              </p>
              
              {/* 다운로드 버튼 */}
              <div className="w-full space-y-3">
                {typeof window !== 'undefined' && /iPhone|iPad|iPod/i.test(window.navigator.userAgent) ? (
                  <a
                    href="https://apps.apple.com/us/app/moa-tools/id6756276107"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3 w-full py-4 px-6 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors font-semibold"
                  >
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                    App Store에서 다운로드
                  </a>
                ) : (
                  <a
                    href="https://play.google.com/store/apps/details?id=com.onminds.moatools"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3 w-full py-4 px-6 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors font-semibold"
                  >
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                    </svg>
                    Google Play에서 다운로드
                  </a>
                )}
                
                <button
                  onClick={() => setShowAppDownloadModal(false)}
                  className="w-full py-3 px-6 text-gray-600 hover:text-gray-900 transition-colors font-medium"
                >
                  나중에 하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI 정보 수정 모달 */}
      {showEditModal && editFormData && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm overflow-y-auto"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            // 배경에서 마우스 다운이 시작된 경우만 기록
            if (e.target === e.currentTarget) {
              e.currentTarget.dataset.closeOnUp = 'true';
            }
          }}
          onMouseUp={(e) => {
            // 배경에서 마우스 다운이 시작되고, 배경에서 마우스 업이 발생한 경우만 닫기
            if (e.target === e.currentTarget && e.currentTarget.dataset.closeOnUp === 'true') {
              if (!isEditSubmitting) {
                setShowEditModal(false);
              }
            }
            // 초기화
            delete e.currentTarget.dataset.closeOnUp;
          }}
        >
          <div
            className="w-full max-w-5xl my-8 rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between p-6 pb-4 border-b">
              <div className="flex items-center gap-4">
                <h3 className="text-2xl font-bold text-gray-900">AI 서비스 정보 수정</h3>
                <button
                  onClick={handleDeleteService}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  disabled={isEditSubmitting}
                  title="AI 서비스 삭제"
                >
                  <Trash2 className="w-4 h-4" />
                  삭제
                </button>
              </div>
              <button
                onClick={() => !isEditSubmitting && setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
                disabled={isEditSubmitting}
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            {/* 스크롤 가능한 내용 영역 */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
              {/* 기본 정보 */}
              <div className="border-b pb-4">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">기본 정보</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      이름 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="AI 도구 이름"
                      disabled={isEditSubmitting}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      URL <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="url"
                      value={editFormData.url}
                      onChange={(e) => setEditFormData({ ...editFormData, url: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://example.com"
                      disabled={isEditSubmitting}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      카테고리 (각 그룹에서 여러 개 선택 가능)
                    </label>
                    <div className="space-y-3">
                      {categoryGroups.map((group) => (
                        <div key={group.group}>
                          <p className="text-xs font-semibold text-gray-600 mb-1">{group.group}</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {group.options.map((cat) => {
                              const checked = (editFormData.category || []).includes(cat.value);
                              return (
                                <button
                                  key={cat.value}
                                  type="button"
                                  onClick={() => toggleCategory(cat.value)}
                                  className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors ${
                                    checked
                                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                                  }`}
                                  disabled={isEditSubmitting}
                                >
                                  {cat.label}
                                  {checked && <span className="ml-1">✓</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      💡 같은 그룹 내에서도 여러 개를 선택할 수 있습니다. 모두 DB에 저장됩니다.
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">아이콘</label>
                    <div className="space-y-3">
                      <input
                        type="url"
                        value={editFormData.icon}
                        onChange={(e) => setEditFormData({ ...editFormData, icon: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="아이콘 URL 입력 (https://example.com/icon.png)"
                        disabled={isEditSubmitting}
                      />
                      <div className="flex items-center gap-3">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleIconFileChange}
                            className="hidden"
                            disabled={isEditSubmitting}
                          />
                          <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            또는 파일 업로드 (2MB 이하)
                          </span>
                        </label>
                        {iconPreview && (
                          <div className="flex items-center gap-2">
                            <img src={iconPreview} alt="아이콘 미리보기" className="w-12 h-12 rounded object-cover border border-gray-300" />
                            <span className="text-sm text-gray-600">{iconFile?.name}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setIconFile(null);
                                setIconPreview('');
                              }}
                              className="text-red-500 hover:text-red-700"
                            >
                              <span className="text-lg">&times;</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {editFormData.category && editFormData.category.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-gray-500">순서 조정 및 삭제 (↑↓ 순서 변경 / ✕ 삭제)</p>
                        <div className="flex flex-wrap gap-2">
                          {editFormData.category.map((cat, idx) => (
                            <div
                              key={cat + idx}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-gray-200 bg-gray-50 text-sm text-gray-800"
                            >
                              {getCategoryLabel(cat)}
                              <div className="flex items-center gap-1 ml-1 border-l border-gray-300 pl-1">
                                <button
                                  type="button"
                                  onClick={() => moveCategory(idx, 'up')}
                                  className="text-gray-500 hover:text-gray-700 disabled:opacity-40 transition-colors"
                                  disabled={idx === 0 || isEditSubmitting}
                                  aria-label="위로 이동"
                                  title="위로 이동"
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveCategory(idx, 'down')}
                                  className="text-gray-500 hover:text-gray-700 disabled:opacity-40 transition-colors"
                                  disabled={idx === editFormData.category.length - 1 || isEditSubmitting}
                                  aria-label="아래로 이동"
                                  title="아래로 이동"
                                >
                                  ↓
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeCategory(idx)}
                                  className="text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors font-bold"
                                  disabled={isEditSubmitting}
                                  aria-label="삭제"
                                  title="삭제"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 설명 */}
              <div className="border-b pb-4">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">설명</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">요약 (한줄 설명)</label>
                    <textarea
                      value={editFormData.summary}
                      onChange={(e) => setEditFormData({ ...editFormData, summary: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={2}
                      placeholder="AI 도구 요약 설명"
                      disabled={isEditSubmitting}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">상세 설명</label>
                      <button
                        type="button"
                        onClick={() => applyBold('description')}
                        className="flex items-center gap-1 px-3 py-1 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
                        disabled={isEditSubmitting}
                        title="드래그한 텍스트를 굵게"
                      >
                        <Bold className="w-3.5 h-3.5" />
                        굵게
                      </button>
                    </div>
                    <textarea
                      ref={descriptionRef}
                      value={editFormData.description}
                      onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                      rows={10}
                      placeholder="AI 도구의 기본적인 소개와 특징을 작성하세요"
                      disabled={isEditSubmitting}
                      style={{ minHeight: '200px', maxHeight: '400px' }}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {editFormData.description.length}자 | 텍스트 선택 후 "굵게" 버튼 클릭
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">핵심 기능</label>
                      <button
                        type="button"
                        onClick={() => applyBold('coreFeatures')}
                        className="flex items-center gap-1 px-3 py-1 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
                        disabled={isEditSubmitting}
                        title="드래그한 텍스트를 굵게"
                      >
                        <Bold className="w-3.5 h-3.5" />
                        굵게
                      </button>
                    </div>
                    <textarea
                      ref={coreFeaturesRef}
                      value={editFormData.coreFeatures || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, coreFeatures: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                      rows={8}
                      placeholder="이 AI 도구의 핵심 기능들을 작성하세요&#10;예:&#10;• 텍스트 생성 및 편집&#10;• 다국어 지원&#10;• API 연동 가능"
                      disabled={isEditSubmitting}
                      style={{ minHeight: '150px', maxHeight: '300px' }}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {(editFormData.coreFeatures || '').length}자 | 텍스트 선택 후 "굵게" 버튼 클릭
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      주요 기능 태그 (콤마 또는 Enter로 추가)
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {(editFormData.features || []).map((f, idx) => (
                        <span
                          key={`${f}-${idx}`}
                          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm bg-blue-50 text-blue-800 border border-blue-200"
                        >
                          {f}
                          <button
                            type="button"
                            onClick={() => removeFeature(f)}
                            className="text-blue-600 hover:text-blue-800"
                            disabled={isEditSubmitting}
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                      {(!editFormData.features || editFormData.features.length === 0) && (
                        <span className="text-xs text-gray-400">아직 추가된 기능이 없습니다.</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={featureInput}
                        onChange={(e) => setFeatureInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            addFeatures();
                          }
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="예: 텍스트 생성, 이미지 생성, API 지원"
                        disabled={isEditSubmitting}
                      />
                      <button
                        type="button"
                        onClick={addFeatures}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-200 transition-colors disabled:opacity-50"
                        disabled={isEditSubmitting}
                      >
                        추가
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">콤마(,) 또는 Enter로 기능을 추가하세요.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">장점</label>
                    <textarea
                      value={editFormData.pros || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, pros: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                      rows={6}
                      placeholder="이 AI 도구의 장점을 작성하세요&#10;예:&#10;• 직관적인 인터페이스&#10;• 빠른 처리 속도&#10;• 합리적인 가격"
                      disabled={isEditSubmitting}
                      style={{ minHeight: '120px', maxHeight: '250px' }}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {(editFormData.pros || '').length}자
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">단점</label>
                    <textarea
                      value={editFormData.cons || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, cons: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                      rows={6}
                      placeholder="이 AI 도구의 단점이나 제한사항을 작성하세요&#10;예:&#10;• 한국어 지원 제한적&#10;• 무료 플랜의 기능 제한&#10;• 학습 곡선이 있음"
                      disabled={isEditSubmitting}
                      style={{ minHeight: '120px', maxHeight: '250px' }}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {(editFormData.cons || '').length}자
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">사용 방법</label>
                      <button
                        type="button"
                        onClick={() => applyBold('usage')}
                        className="flex items-center gap-1 px-3 py-1 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
                        disabled={isEditSubmitting}
                        title="드래그한 텍스트를 굵게"
                      >
                        <Bold className="w-3.5 h-3.5" />
                        굵게
                      </button>
                    </div>
                    <textarea
                      ref={usageRef}
                      value={editFormData.usage}
                      onChange={(e) => setEditFormData({ ...editFormData, usage: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                      rows={8}
                      placeholder="AI 도구 사용 방법"
                      disabled={isEditSubmitting}
                      style={{ minHeight: '150px', maxHeight: '400px' }}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {editFormData.usage.length}자 | 텍스트 선택 후 "굵게" 버튼 클릭
                    </p>
                  </div>
                </div>
              </div>

              {/* 배열 필드 */}
              <div className="border-b pb-4">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">추가 정보</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      가격 정보 (Enter 또는 추가 버튼)
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {(editFormData.pricing || []).map((p, idx) => (
                        <span
                          key={`${p}-${idx}`}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold border ${getPricingBadgeClass(p)} border-opacity-70`}
                        >
                          {getPricingLabel(p)}
                          <div className="flex items-center gap-1 ml-1 border-l border-opacity-30 border-gray-500 pl-1">
                            <button
                              type="button"
                              onClick={() => movePricing(idx, 'up')}
                              className="text-gray-700 hover:text-gray-900 disabled:opacity-40 transition-colors text-xs"
                              disabled={idx === 0 || isEditSubmitting}
                              aria-label="위로 이동"
                              title="위로 이동"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => movePricing(idx, 'down')}
                              className="text-gray-700 hover:text-gray-900 disabled:opacity-40 transition-colors text-xs"
                              disabled={idx === editFormData.pricing.length - 1 || isEditSubmitting}
                              aria-label="아래로 이동"
                              title="아래로 이동"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => removePricing(idx)}
                              className="text-gray-700 hover:text-gray-900 disabled:opacity-40 transition-colors font-bold"
                              disabled={isEditSubmitting}
                              aria-label="삭제"
                              title="삭제"
                            >
                              ✕
                            </button>
                          </div>
                        </span>
                      ))}
                      {(!editFormData.pricing || editFormData.pricing.length === 0) && (
                        <span className="text-xs text-gray-400">아직 추가된 가격 정보가 없습니다.</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={pricingInput}
                        onChange={(e) => setPricingInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addPricing();
                          }
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="예: 무료, Plus 월 14,000원, Business 월 30,000원"
                        disabled={isEditSubmitting}
                      />
                      <div className="flex flex-wrap gap-1">
                        {pricingColorOptions.map((c) => (
                          <button
                            key={c.key}
                            type="button"
                            onClick={() => setPricingColor(c.key)}
                            className={`w-8 h-8 rounded-full border transition ${
                              pricingColor === c.key ? 'ring-2 ring-blue-400 ring-offset-1' : ''
                            } ${c.className}`}
                            aria-label={`${c.label} 색상 선택`}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={addPricing}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-200 transition-colors disabled:opacity-50"
                        disabled={isEditSubmitting}
                      >
                        추가
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">💡 Enter 키 또는 추가 버튼을 눌러 가격 정보를 추가하세요. 콤마(,)는 숫자 구분자로 사용 가능합니다.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      로그인 방식 (체크 선택)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {loginMethodOptions.map((method) => {
                        // X(Twitter) 체크 상태: X(Twitter) 또는 Twitter가 있으면 체크
                        const checked = method === 'X(Twitter)' 
                          ? (editFormData.loginMethods?.includes('X(Twitter)') || editFormData.loginMethods?.includes('Twitter'))
                          : editFormData.loginMethods?.includes(method);
                        const colors = loginColorClass(method, checked);
                        return (
                          <label
                            key={method}
                            className={`inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${colors.bg} ${colors.border} ${colors.text} ${colors.hover}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleLoginMethod(method)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              disabled={isEditSubmitting}
                            />
                            {method}
                          </label>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        type="text"
                        value={loginCustomInput}
                        onChange={(e) => setLoginCustomInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addCustomLoginMethods();
                          }
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="기타 로그인 방식 입력 후 Enter (예: SAML, JWT)"
                        disabled={isEditSubmitting}
                      />
                      <button
                        type="button"
                        onClick={addCustomLoginMethods}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-200 transition-colors disabled:opacity-50"
                        disabled={isEditSubmitting}
                      >
                        추가
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      기본 제공 옵션 외에 필요한 방식이 있으면 직접 입력해 추가할 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* 체크박스 옵션 */}
              <div className="border-b pb-4">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">서비스 속성</h4>
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={editFormData.koreanSupport}
                      onChange={(e) => setEditFormData({ ...editFormData, koreanSupport: e.target.checked })}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      disabled={isEditSubmitting}
                    />
                    <span className="text-sm font-medium text-gray-700">한국어 지원</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={editFormData.isKoreanService}
                      onChange={(e) => setEditFormData({ ...editFormData, isKoreanService: e.target.checked })}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      disabled={isEditSubmitting}
                    />
                    <span className="text-sm font-medium text-gray-700">국내 서비스</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={editFormData.apiSupport}
                      onChange={(e) => setEditFormData({ ...editFormData, apiSupport: e.target.checked })}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      disabled={isEditSubmitting}
                    />
                    <span className="text-sm font-medium text-gray-700">API 지원</span>
                  </label>
                </div>
              </div>

              </div>
            </div>

            {/* Sticky Footer - 항상 하단에 고정 */}
            <div className="sticky bottom-0 bg-white border-t p-6 rounded-b-2xl shadow-lg">
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  disabled={isEditSubmitting}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSubmitEdit}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isEditSubmitting}
                >
                  {isEditSubmitting ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 