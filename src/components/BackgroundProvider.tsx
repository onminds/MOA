"use client";
import { useLanguage } from '@/contexts/LanguageContext';
import { useEffect } from 'react';

interface BackgroundProviderProps {
  children: React.ReactNode;
}

export default function BackgroundProvider({ children }: BackgroundProviderProps) {
  const { currentBackground } = useLanguage();

  const getBackgroundClass = () => {
    switch (currentBackground) {
      case 'nature':
        return 'bg-nature';
      case 'space':
        return 'bg-space';
      case 'geometric':
        return 'bg-geometric';
      default:
        return 'bg-default';
    }
  };

  const getBackgroundStyle = () => {
    switch (currentBackground) {
      case 'nature':
        return {
          backgroundImage: 'url(/images/Forest.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed'
        };
      case 'space':
        return {
          backgroundImage: 'url(/images/Space.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed'
        };
      case 'geometric':
        return {
          backgroundImage: 'url(/images/architecture.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed'
        };
      default:
        return {
          backgroundColor: '#ffffff'
        };
    }
  };

  useEffect(() => {
    // body에 배경 클래스 적용
    const bodyClass = getBackgroundClass();
    document.body.className = document.body.className.replace(/bg-\w+/g, '').trim();
    document.body.classList.add(bodyClass);
    
    // body에 배경 스타일 직접 적용
    const style = getBackgroundStyle();
    Object.assign(document.body.style, style);
  }, [currentBackground]);

  return (
    <div 
      className={`min-h-screen transition-all duration-500 ${getBackgroundClass()}`}
      style={{
        minHeight: '100vh',
        width: '100%',
        position: 'relative',
        ...getBackgroundStyle()
      }}
    >
      {children}
    </div>
  );
} 