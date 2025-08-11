"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Language {
  code: string;
  name: string;
  flag: string;
}

export interface Background {
  code: string;
  name: string;
  icon: string;
}

export interface Translations {
  [key: string]: {
    [key: string]: string;
  };
}

interface LanguageContextType {
  currentLanguage: string;
  setLanguage: (languageCode: string) => void;
  t: (key: string) => string;
  languages: Language[];
  currentBackground: string;
  setBackground: (backgroundCode: string) => void;
  backgrounds: Background[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// 번역 데이터
const translations: Translations = {
  ko: {
    // 공통
    "loading": "로딩 중...",
    "back": "뒤로가기",
    "save": "저장",
    "cancel": "취소",
    "edit": "편집하기",
    "delete": "삭제",
    "confirm": "확인",
    "close": "닫기",
    "user": "사용자",
    "admin": "관리자",
    "login_required": "이 기능을 사용하려면 로그인이 필요합니다.",
    "search_subtitle": "당신에게 맞는 AI를 찾아보세요",
    "ai_list": "AI 목록",
    "plan": "플랜",
    "contact": "문의하기",
    
    // 헤더
    "home": "홈",
    "ai_chat": "AI 채팅",
    "image_generation": "이미지 생성",
    "video_generation": "비디오 생성",
    "productivity_tools": "생산성 도구",
    "community": "커뮤니티",
    "settings": "설정",
    "profile": "프로필",
    "logout": "로그아웃",
    "login": "로그인",
    "signup": "회원가입",
    
    // 메인 페이지
    "search_placeholder": "AI 도구를 검색해보세요...",
    "search_button": "검색",
    "feature_image_generation": "이미지 생성",
    "feature_video_generation": "비디오 생성",
    "feature_productivity": "생산성 도구",
    "feature_community": "커뮤니티",
    
    // 설정 페이지
    "settings_title": "설정",
    "profile_settings": "프로필 설정",
    "profile_photo": "프로필 사진",
    "profile_photo_description": "프로필 사진을 업로드하여 개인화된 경험을 제공받으세요.",
    "name": "이름",
    "email": "이메일",
    "email_cannot_change": "이메일은 변경할 수 없습니다.",
    "image_selected": "✓ 이미지 선택됨",
    "saving": "저장 중...",
    "profile_update_success": "프로필이 성공적으로 업데이트되었습니다.",
    "profile_update_failed": "프로필 업데이트에 실패했습니다.",
    
         // 앱 설정
     "app_settings": "앱 설정",
     "theme_settings": "배경 설정",
     "language_settings": "언어 설정",
     "help": "도움말",
     
     // 배경 옵션
     "background_default": "기본",
     "background_nature": "자연",
     "background_space": "우주",
     "background_geometric": "기하학",
    
    // 생산성 도구
    "productivity_title": "생산성 도구",
    "ai_writing": "AI 글쓰기",
    "content_creation": "콘텐츠 제작",
    "presentation": "프레젠테이션",
    "coding": "코딩",
    "blog_writer": "블로그 작성",
    "cover_letter": "자기소개서",
    "interview_prep": "면접 준비",
    "lecture_notes": "강의 노트",
    "report_writer": "보고서 작성",
    "sns_post": "SNS 포스트",
    
    // 관리자
    "admin_panel": "관리자 패널",
    "users": "사용자",
    "user_management": "사용자 관리",
    "plan_management": "플랜 관리",
    "basic_plan": "기본 플랜",
    "premium_plan": "프리미엄 플랜",
    "admin_plan": "관리자 플랜",
    "change_plan": "플랜 변경",
    "plan_changed": "플랜이 변경되었습니다.",
    
    // 사용량
    "usage": "사용량",
    "image_generation_usage": "이미지 생성 사용량",
    "video_generation_usage": "비디오 생성 사용량",
    "chat_usage": "채팅 사용량",
    "remaining": "남은 사용량",
    "used": "사용된 사용량",
    "limit": "제한",
  },
  en: {
    // Common
    "loading": "Loading...",
    "back": "Back",
    "save": "Save",
    "cancel": "Cancel",
    "edit": "Edit",
    "delete": "Delete",
    "confirm": "Confirm",
    "close": "Close",
    "user": "User",
    "admin": "Admin",
    "login_required": "Login is required to use this feature.",
    "search_subtitle": "Find the AI that's right for you",
    "ai_list": "AI List",
    "plan": "Plan",
    "contact": "Contact",
    
    // Header
    "home": "Home",
    "ai_chat": "AI Chat",
    "image_generation": "Image Generation",
    "video_generation": "Video Generation",
    "productivity_tools": "Productivity Tools",
    "community": "Community",
    "settings": "Settings",
    "profile": "Profile",
    "logout": "Logout",
    "login": "Login",
    "signup": "Sign Up",
    
    // Main page
    "search_placeholder": "Search AI tools...",
    "search_button": "Search",
    "feature_image_generation": "Image Generation",
    "feature_video_generation": "Video Generation",
    "feature_productivity": "Productivity Tools",
    "feature_community": "Community",
    
    // Settings page
    "settings_title": "Settings",
    "profile_settings": "Profile Settings",
    "profile_photo": "Profile Photo",
    "profile_photo_description": "Upload a profile photo to receive a personalized experience.",
    "name": "Name",
    "email": "Email",
    "email_cannot_change": "Email cannot be changed.",
    "image_selected": "✓ Image selected",
    "saving": "Saving...",
    "profile_update_success": "Profile updated successfully.",
    "profile_update_failed": "Failed to update profile.",
    
         // App settings
     "app_settings": "App Settings",
     "theme_settings": "Background Settings",
     "language_settings": "Language Settings",
     "help": "Help",
     
     // Background options
     "background_default": "Default",
     "background_nature": "Nature",
     "background_space": "Space",
     "background_geometric": "Geometric",
    
    // Productivity tools
    "productivity_title": "Productivity Tools",
    "ai_writing": "AI Writing",
    "content_creation": "Content Creation",
    "presentation": "Presentation",
    "coding": "Coding",
    "blog_writer": "Blog Writer",
    "cover_letter": "Cover Letter",
    "interview_prep": "Interview Prep",
    "lecture_notes": "Lecture Notes",
    "report_writer": "Report Writer",
    "sns_post": "SNS Post",
    
    // Admin
    "admin_panel": "Admin Panel",
    "users": "Users",
    "user_management": "User Management",
    "plan_management": "Plan Management",
    "basic_plan": "Basic Plan",
    "premium_plan": "Premium Plan",
    "admin_plan": "Admin Plan",
    "change_plan": "Change Plan",
    "plan_changed": "Plan changed successfully.",
    
    // Usage
    "usage": "Usage",
    "image_generation_usage": "Image Generation Usage",
    "video_generation_usage": "Video Generation Usage",
    "chat_usage": "Chat Usage",
    "remaining": "Remaining",
    "used": "Used",
    "limit": "Limit",
  },
  ja: {
    // 共通
    "loading": "読み込み中...",
    "back": "戻る",
    "save": "保存",
    "cancel": "キャンセル",
    "edit": "編集",
    "delete": "削除",
    "confirm": "確認",
    "close": "閉じる",
    
    // ヘッダー
    "home": "ホーム",
    "ai_chat": "AIチャット",
    "image_generation": "画像生成",
    "video_generation": "動画生成",
    "productivity_tools": "生産性ツール",
    "community": "コミュニティ",
    "settings": "設定",
    "profile": "プロフィール",
    "logout": "ログアウト",
    "login": "ログイン",
    "signup": "サインアップ",
    
    // メインページ
    "search_placeholder": "AIツールを検索...",
    "search_button": "検索",
    "feature_image_generation": "画像生成",
    "feature_video_generation": "動画生成",
    "feature_productivity": "生産性ツール",
    "feature_community": "コミュニティ",
    
    // 設定ページ
    "settings_title": "設定",
    "profile_settings": "プロフィール設定",
    "profile_photo": "プロフィール写真",
    "profile_photo_description": "プロフィール写真をアップロードしてパーソナライズされた体験を受け取ります。",
    "name": "名前",
    "email": "メールアドレス",
    "email_cannot_change": "メールアドレスは変更できません。",
    "image_selected": "✓ 画像が選択されました",
    "saving": "保存中...",
    "profile_update_success": "プロフィールが正常に更新されました。",
    "profile_update_failed": "プロフィールの更新に失敗しました。",
    
         // アプリ設定
     "app_settings": "アプリ設定",
     "theme_settings": "背景設定",
     "language_settings": "言語設定",
     "help": "ヘルプ",
     
     // 背景オプション
     "background_default": "デフォルト",
     "background_nature": "自然",
     "background_space": "宇宙",
     "background_geometric": "幾何学",
    
    // 生産性ツール
    "productivity_title": "生産性ツール",
    "ai_writing": "AIライティング",
    "content_creation": "コンテンツ作成",
    "presentation": "プレゼンテーション",
    "coding": "コーディング",
    "blog_writer": "ブログ作成",
    "cover_letter": "カバーレター",
    "interview_prep": "面接準備",
    "lecture_notes": "講義ノート",
    "report_writer": "レポート作成",
    "sns_post": "SNS投稿",
    
    // 管理者
    "admin_panel": "管理者パネル",
    "users": "ユーザー",
    "user_management": "ユーザー管理",
    "plan_management": "プラン管理",
    "basic_plan": "ベーシックプラン",
    "premium_plan": "プレミアムプラン",
    "admin_plan": "管理者プラン",
    "change_plan": "プラン変更",
    "plan_changed": "プランが正常に変更されました。",
    
    // 使用量
    "usage": "使用量",
    "image_generation_usage": "画像生成使用量",
    "video_generation_usage": "動画生成使用量",
    "chat_usage": "チャット使用量",
    "remaining": "残り",
    "used": "使用済み",
    "limit": "制限",
  },
  zh: {
    // 通用
    "loading": "加载中...",
    "back": "返回",
    "save": "保存",
    "cancel": "取消",
    "edit": "编辑",
    "delete": "删除",
    "confirm": "确认",
    "close": "关闭",
    
    // 头部
    "home": "首页",
    "ai_chat": "AI聊天",
    "image_generation": "图像生成",
    "video_generation": "视频生成",
    "productivity_tools": "生产力工具",
    "community": "社区",
    "settings": "设置",
    "profile": "个人资料",
    "logout": "退出登录",
    "login": "登录",
    "signup": "注册",
    
    // 主页
    "search_placeholder": "搜索AI工具...",
    "search_button": "搜索",
    "feature_image_generation": "图像生成",
    "feature_video_generation": "视频生成",
    "feature_productivity": "生产力工具",
    "feature_community": "社区",
    
    // 设置页面
    "settings_title": "设置",
    "profile_settings": "个人资料设置",
    "profile_photo": "个人头像",
    "profile_photo_description": "上传个人头像以获得个性化体验。",
    "name": "姓名",
    "email": "邮箱",
    "email_cannot_change": "邮箱无法更改。",
    "image_selected": "✓ 已选择图片",
    "saving": "保存中...",
    "profile_update_success": "个人资料更新成功。",
    "profile_update_failed": "个人资料更新失败。",
    
         // 应用设置
     "app_settings": "应用设置",
     "theme_settings": "背景设置",
     "language_settings": "语言设置",
     "help": "帮助",
     
     // 背景选项
     "background_default": "默认",
     "background_nature": "自然",
     "background_space": "宇宙",
     "background_geometric": "几何",
    
    // 生产力工具
    "productivity_title": "生产力工具",
    "ai_writing": "AI写作",
    "content_creation": "内容创作",
    "presentation": "演示文稿",
    "coding": "编程",
    "blog_writer": "博客写作",
    "cover_letter": "求职信",
    "interview_prep": "面试准备",
    "lecture_notes": "课堂笔记",
    "report_writer": "报告写作",
    "sns_post": "社交媒体帖子",
    
    // 管理员
    "admin_panel": "管理员面板",
    "users": "用户",
    "user_management": "用户管理",
    "plan_management": "套餐管理",
    "basic_plan": "基础套餐",
    "premium_plan": "高级套餐",
    "admin_plan": "管理员套餐",
    "change_plan": "更改套餐",
    "plan_changed": "套餐更改成功。",
    
    // 使用量
    "usage": "使用量",
    "image_generation_usage": "图像生成使用量",
    "video_generation_usage": "视频生成使用量",
    "chat_usage": "聊天使用量",
    "remaining": "剩余",
    "used": "已使用",
    "limit": "限制",
  }
};

const languages: Language[] = [
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
];

const backgrounds: Background[] = [
  { code: 'default', name: '기본', icon: '🎨' },
  { code: 'nature', name: '자연', icon: '🌿' },
  { code: 'space', name: '우주', icon: '🌌' },
  { code: 'geometric', name: '기하학', icon: '🔷' },
];

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState('ko');
  const [currentBackground, setCurrentBackground] = useState('default');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // 저장된 언어 설정 불러오기
    const savedLanguage = localStorage.getItem('selectedLanguage');
    if (savedLanguage && translations[savedLanguage]) {
      setCurrentLanguage(savedLanguage);
    }
    
    // 저장된 배경 설정 불러오기
    const savedBackground = localStorage.getItem('selectedBackground');
    if (savedBackground) {
      setCurrentBackground(savedBackground);
    }
    
    setIsInitialized(true);
  }, []);

  const setLanguage = (languageCode: string) => {
    if (translations[languageCode]) {
      setCurrentLanguage(languageCode);
      localStorage.setItem('selectedLanguage', languageCode);
    }
  };

  const setBackground = (backgroundCode: string) => {
    setCurrentBackground(backgroundCode);
    localStorage.setItem('selectedBackground', backgroundCode);
    
    // 배경 변경 시 즉시 body에 적용 (최적화)
    const body = document.body;
    if (body) {
      // 미리 정의된 배경 클래스 매핑
      const backgroundClassMap = {
        nature: 'bg-nature',
        space: 'bg-space',
        geometric: 'bg-geometric',
        default: 'bg-white'
      };
      
      // 기존 배경 클래스 제거 (정규식 대신 명시적 제거)
      const existingClasses = ['bg-nature', 'bg-space', 'bg-geometric', 'bg-white'];
      existingClasses.forEach(cls => body.classList.remove(cls));
      
      // 새로운 배경 클래스 추가
      const newClass = backgroundClassMap[backgroundCode as keyof typeof backgroundClassMap] || 'bg-white';
      body.classList.add(newClass);
      
      // 배경 스타일 직접 적용 (최적화된 방식)
      const backgroundStyles = {
        nature: {
          backgroundImage: 'url(/images/Forest.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed'
        },
        space: {
          backgroundImage: 'url(/images/Space.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed'
        },
        geometric: {
          backgroundImage: 'url(/images/architecture.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed'
        },
        default: {
          backgroundColor: '#ffffff'
        }
      };
      
      const style = backgroundStyles[backgroundCode as keyof typeof backgroundStyles] || backgroundStyles.default;
      Object.assign(body.style, style);
    }
  };

  const t = (key: string): string => {
    const currentTranslations = translations[currentLanguage];
    if (!currentTranslations) {
      // 현재 언어에 번역이 없으면 영어로 폴백
      return translations['en'][key] || key;
    }
    return currentTranslations[key] || translations['en'][key] || key;
  };

  const getCurrentBackground = () => {
    return backgrounds.find(bg => bg.code === currentBackground) || backgrounds[0];
  };

  const value: LanguageContextType = {
    currentLanguage,
    setLanguage,
    t,
    languages,
    currentBackground,
    setBackground,
    backgrounds,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}; 