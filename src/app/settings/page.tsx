"use client";
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import { useLanguage } from '@/contexts/LanguageContext';

import {
  ArrowLeft, User, Camera, Save, X, Upload, Settings as SettingsIcon,
  Mail, Shield, Bell, Palette, Globe, HelpCircle, ChevronDown
} from 'lucide-react';
import Image from 'next/image';

interface UserProfile {
  name: string;
  email: string;
  image: string | null;
}

export default function Settings() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const { t, currentLanguage, setLanguage, languages, currentBackground, setBackground, backgrounds } = useLanguage();
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    email: '',
    image: null
  });
  const [isEditing, setIsEditing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [showBackgroundDropdown, setShowBackgroundDropdown] = useState(false);

  useEffect(() => {
    if (session?.user) {
      setProfile({
        name: session.user.name || '',
        email: session.user.email || '',
        image: session.user.image || null
      });
    }
  }, [session]);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', profile.name);
      
      if (selectedImage) {
        formData.append('image', selectedImage);
      }

      const response = await fetch('/api/profile/update', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '프로필 업데이트에 실패했습니다.');
      }

      // 성공 시 상태 업데이트
      setIsEditing(false);
      setSelectedImage(null);
      setPreviewImage(null);
      
      // 세션 데이터 갱신
      await update();
      
      // 성공 메시지 표시
      alert('프로필이 성공적으로 업데이트되었습니다.');
      
      // 세션을 다시 가져오기 위해 강제로 갱신
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (error) {
      console.error('프로필 업데이트 실패:', error);
      alert(error instanceof Error ? error.message : '프로필 업데이트에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSelectedImage(null);
    setPreviewImage(null);
    if (session?.user) {
      setProfile({
        name: session.user.name || '',
        email: session.user.email || '',
        image: session.user.image || null
      });
    }
  };

  const getInitials = () => {
    if (profile.name) {
      return profile.name.charAt(0).toUpperCase();
    }
    if (profile.email) {
      return profile.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  const handleLanguageChange = (languageCode: string) => {
    setLanguage(languageCode);
    setShowLanguageDropdown(false);
    // 언어 변경 후 페이지 새로고침하여 모든 컴포넌트에 적용
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  const getCurrentLanguage = () => {
    return languages.find(lang => lang.code === currentLanguage) || languages[0];
  };

  const handleBackgroundChange = (backgroundCode: string) => {
    setBackground(backgroundCode);
    setShowBackgroundDropdown(false);
  };

  const getCurrentBackground = () => {
    return backgrounds.find(bg => bg.code === currentBackground) || backgrounds[0];
  };

  if (status === 'loading') {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                         <p className="text-gray-600">{t('loading')}</p>
          </div>
        </div>
      </>
    );
  }

  if (!session) {
    router.push('/auth/signin');
    return null;
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50">
        <div className="p-8">
          {/* 메인 콘텐츠 */}
          <div className="flex">
            {/* 공통 사이드바 */}
            
            {/* 메인 콘텐츠 */}
            <div className="flex-1">
              {/* 헤더 */}
              <div className="flex items-center gap-4 mb-8">
                <button
                  onClick={() => router.push('/')}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-all duration-200 hover:bg-gray-100 px-3 py-2 rounded-lg"
                >
                  <ArrowLeft className="w-5 h-5" />
                                     {t('back')}
                </button>
                <div className="flex items-center gap-3">
                  <SettingsIcon className="w-8 h-8 text-gray-700" />
                                     <h1 className="text-3xl font-bold text-gray-900">{t('settings_title')}</h1>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 프로필 섹션 */}
                <div className="lg:col-span-2">
                  <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
                                         <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                       <User className="w-6 h-6 text-blue-600" />
                       {t('profile_settings')}
                     </h2>

                    <div className="space-y-6">
                      {/* 프로필 이미지 */}
                      <div className="flex items-center space-x-6">
                        <div className="relative">
                          {previewImage ? (
                            <Image
                              src={previewImage}
                              alt="프로필 미리보기"
                              width={80}
                              height={80}
                              className="w-20 h-20 rounded-full object-cover"
                            />
                          ) : profile.image ? (
                            <Image
                              src={profile.image}
                              alt="프로필"
                              width={80}
                              height={80}
                              className="w-20 h-20 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 font-semibold text-2xl">
                              {getInitials()}
                            </div>
                          )}
                          
                          {isEditing && (
                            <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700 transition-colors">
                              <Camera className="w-4 h-4" />
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>

                        <div className="flex-1">
                                                     <h3 className="text-lg font-medium text-gray-900 mb-2">
                             {t('profile_photo')}
                           </h3>
                           <p className="text-sm text-gray-500 mb-4">
                             {t('profile_photo_description')}
                           </p>
                          {isEditing && selectedImage && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-green-600">{t('image_selected')}</span>
                              <button
                                onClick={() => {
                                  setSelectedImage(null);
                                  setPreviewImage(null);
                                }}
                                className="text-sm text-red-600 hover:text-red-700"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 이름 */}
                      <div>
                                                 <label className="block text-sm font-medium text-gray-700 mb-2">
                           {t('name')}
                         </label>
                        <input
                          type="text"
                          value={profile.name}
                          onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                          disabled={!isEditing}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                        />
                      </div>

                      {/* 이메일 */}
                      <div>
                                                 <label className="block text-sm font-medium text-gray-700 mb-2">
                           {t('email')}
                         </label>
                        <input
                          type="email"
                          value={profile.email}
                          disabled
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                        />
                                                 <p className="text-xs text-gray-500 mt-1">
                           {t('email_cannot_change')}
                         </p>
                      </div>

                      {/* 액션 버튼 */}
                      <div className="flex gap-3 pt-4">
                        {!isEditing ? (
                          <button
                            onClick={() => setIsEditing(true)}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                          >
                                                         {t('edit')}
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={handleSave}
                              disabled={loading}
                              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                              {loading ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                                     {t('saving')}
                                </>
                              ) : (
                                <>
                                  <Save className="w-4 h-4" />
                                                                     {t('save')}
                                </>
                              )}
                            </button>
                            <button
                              onClick={handleCancel}
                              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                            >
                                                             {t('cancel')}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 사이드바 */}
                <div className="space-y-6">


                  {/* 앱 설정 */}
                  <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
                                         <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('app_settings')}</h3>
                    <div className="space-y-3">
                      <div className="relative">
                        <button 
                          onClick={() => setShowBackgroundDropdown(!showBackgroundDropdown)}
                          className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-3">
                            <Palette className="w-5 h-5 text-gray-500" />
                            <span className="text-sm text-gray-700">{t('theme_settings')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{getCurrentBackground().icon}</span>
                            <span className="text-sm text-gray-500">{t(`background_${getCurrentBackground().code}`)}</span>
                            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showBackgroundDropdown ? 'rotate-180' : ''}`} />
                          </div>
                        </button>
                        
                        {showBackgroundDropdown && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                            {backgrounds.map((background) => (
                              <button
                                key={background.code}
                                onClick={() => handleBackgroundChange(background.code)}
                                className={`w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left ${
                                  currentBackground === background.code ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                                }`}
                              >
                                <span className="text-lg">{background.icon}</span>
                                <span className="text-sm">{t(`background_${background.code}`)}</span>
                                {currentBackground === background.code && (
                                  <div className="ml-auto w-2 h-2 bg-blue-600 rounded-full"></div>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="relative">
                        <button 
                          onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                          className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-3">
                            <Globe className="w-5 h-5 text-gray-500" />
                                                         <span className="text-sm text-gray-700">{t('language_settings')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{getCurrentLanguage().flag}</span>
                            <span className="text-sm text-gray-500">{getCurrentLanguage().name}</span>
                            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showLanguageDropdown ? 'rotate-180' : ''}`} />
                          </div>
                        </button>
                        
                        {showLanguageDropdown && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                            {languages.map((language) => (
                              <button
                                key={language.code}
                                onClick={() => handleLanguageChange(language.code)}
                                                                 className={`w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left ${
                                   currentLanguage === language.code ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                                 }`}
                              >
                                <span className="text-lg">{language.flag}</span>
                                <span className="text-sm">{language.name}</span>
                                                                 {currentLanguage === language.code && (
                                  <div className="ml-auto w-2 h-2 bg-blue-600 rounded-full"></div>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left">
                        <HelpCircle className="w-5 h-5 text-gray-500" />
                                                 <span className="text-sm text-gray-700">{t('help')}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 