import React from 'react';

interface TextLoadingAnimationProps {
  message?: string;
  subMessage?: string;
}

export default function TextLoadingAnimation({ 
  message = "요약을 생성하고 있습니다...", 
  subMessage = "AI가 내용을 분석하고 있어요" 
}: TextLoadingAnimationProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-left w-full max-w-4xl">
        <div className="mb-6">
          {/* 텍스트 생성 애니메이션 */}
          <div className="flex items-center justify-center space-x-2 mb-6">
            <div className="w-6 h-6 bg-black rounded-full animate-pulse"></div>
            <div className="w-6 h-6 bg-black rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
            <div className="w-6 h-6 bg-black rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
          </div>
          
          {/* 텍스트 스켈레톤 애니메이션 */}
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" style={{animationDelay: '0.1s'}}></div>
            <div className="h-4 bg-gray-200 rounded w-5/6 animate-pulse" style={{animationDelay: '0.2s'}}></div>
            <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse" style={{animationDelay: '0.3s'}}></div>
            <div className="h-4 bg-gray-200 rounded w-4/5 animate-pulse" style={{animationDelay: '0.4s'}}></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" style={{animationDelay: '0.5s'}}></div>
            <div className="h-4 bg-gray-200 rounded w-7/8 animate-pulse" style={{animationDelay: '0.6s'}}></div>
            <div className="h-4 bg-gray-200 rounded w-3/5 animate-pulse" style={{animationDelay: '0.7s'}}></div>
            <div className="h-4 bg-gray-200 rounded w-6/7 animate-pulse" style={{animationDelay: '0.8s'}}></div>
            <div className="h-4 bg-gray-200 rounded w-4/7 animate-pulse" style={{animationDelay: '0.9s'}}></div>
            <div className="h-4 bg-gray-200 rounded w-5/7 animate-pulse" style={{animationDelay: '1.0s'}}></div>
            <div className="h-4 bg-gray-200 rounded w-2/7 animate-pulse" style={{animationDelay: '1.1s'}}></div>
            <div className="h-4 bg-gray-200 rounded w-8/9 animate-pulse" style={{animationDelay: '1.2s'}}></div>
            <div className="h-4 bg-gray-200 rounded w-3/7 animate-pulse" style={{animationDelay: '1.3s'}}></div>
            <div className="h-4 bg-gray-200 rounded w-6/8 animate-pulse" style={{animationDelay: '1.4s'}}></div>
            <div className="h-4 bg-gray-200 rounded w-4/6 animate-pulse" style={{animationDelay: '1.5s'}}></div>
          </div>
        </div>
        <div className="text-center">
          <div className="text-black font-medium text-lg">{message}</div>
          <div className="text-sm text-gray-500 mt-3">{subMessage}</div>
        </div>
      </div>
    </div>
  );
} 