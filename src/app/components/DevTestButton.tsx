"use client";
import { useState } from 'react';
import { Bug, Mail, Calendar, Shield } from 'lucide-react';

interface DevTestButtonProps {
  onTestGmail: () => void;
  onTestAuth: () => void;
  onTestCalendar: () => void;
}

export default function DevTestButton({ onTestGmail, onTestAuth, onTestCalendar }: DevTestButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-6 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-700 transition-colors flex items-center justify-center"
      >
        <Bug className="w-6 h-6" />
      </button>

      {isOpen && (
        <div className="absolute bottom-16 left-0 bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-48">
          <div className="text-sm font-semibold text-gray-900 mb-3">개발 테스트</div>
          <div className="space-y-2">
            <button
              onClick={() => {
                onTestGmail();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
            >
              <Mail className="w-4 h-4" />
              Gmail API 테스트
            </button>
            <button
              onClick={() => {
                onTestAuth();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors"
            >
              <Shield className="w-4 h-4" />
              Auth 테스트
            </button>
            <button
              onClick={() => {
                onTestCalendar();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-purple-50 text-purple-700 rounded hover:bg-purple-100 transition-colors"
            >
              <Calendar className="w-4 h-4" />
              Calendar API 테스트
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 