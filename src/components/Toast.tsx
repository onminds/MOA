'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';

export interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
  duration?: number;
  onClose: (id: string) => void;
}

const toastIcons = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const toastColors = {
  success: 'bg-black',
  error: 'bg-black',
  info: 'bg-black',
  warning: 'bg-black',
};

const toastBgColors = {
  success: 'bg-white border-gray-200',
  error: 'bg-white border-gray-200',
  info: 'bg-white border-gray-200',
  warning: 'bg-white border-gray-200',
};

export default function Toast({ id, type, title, message, duration = 4000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // 컴포넌트 마운트 시 애니메이션 시작
    const timer = setTimeout(() => setIsVisible(true), 100);
    
    // 자동으로 사라지는 타이머
    const autoHideTimer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => {
      clearTimeout(timer);
      clearTimeout(autoHideTimer);
    };
  }, [duration]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onClose(id);
    }, 300);
  };

  const IconComponent = toastIcons[type];

  return (
    <div
      className={`
        fixed top-6 right-6 w-80
        transform transition-all duration-300 ease-in-out
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        ${isLeaving ? 'translate-x-full opacity-0' : ''}
      `}
      style={{ 
        zIndex: 99999,
        position: 'fixed',
        top: '24px',
        right: '24px'
      }}
    >
      <div 
        className={`
          rounded-xl shadow-2xl border-2 p-6
          ${toastBgColors[type]}
          backdrop-blur-sm bg-opacity-95
        `}
        style={{ pointerEvents: 'auto' }}
      >
        <div className="flex items-start space-x-4">
          <div className={`flex-shrink-0 w-8 h-8 ${toastColors[type]} rounded-full flex items-center justify-center`}>
            <IconComponent className="w-5 h-5 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="text-lg font-bold text-gray-900 mb-2">{title}</h4>
            {message && (
              <p className="text-base text-gray-700 leading-relaxed whitespace-pre-line">{message}</p>
            )}
          </div>
          
          <button
            onClick={handleClose}
            className="flex-shrink-0 ml-3 text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <span className="sr-only">닫기</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
