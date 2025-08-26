'use client';

import { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ReportReason {
  id: number;
  reason_code: string;
  reason_name: string;
  description: string;
}

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'post' | 'comment';
  targetId: number;
  targetTitle?: string;
}

export default function ReportModal({ 
  isOpen, 
  onClose, 
  targetType, 
  targetId, 
  targetTitle 
}: ReportModalProps) {
  const [reasons, setReasons] = useState<ReportReason[]>([]);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  // 신고 사유 목록 가져오기
  useEffect(() => {
    if (isOpen) {
      fetchReportReasons();
    }
  }, [isOpen]);

  const fetchReportReasons = async () => {
    try {
      const response = await fetch('/api/community/reports/reasons');
      const data = await response.json();
      
      if (response.ok) {
        setReasons(data.reasons);
      } else {
        setError('신고 사유를 불러오는데 실패했습니다.');
      }
    } catch (error) {
      setError('신고 사유를 불러오는데 실패했습니다.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedReason) {
      setError('신고 사유를 선택해주세요.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/community/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetType,
          targetId,
          reason: selectedReason,
          description: description.trim() || null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert(data.message);
        onClose();
        // 폼 초기화
        setSelectedReason('');
        setDescription('');
      } else {
        setError(data.error || '신고 처리 중 오류가 발생했습니다.');
      }
    } catch (error) {
      setError('신고 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedReason('');
      setDescription('');
      setError('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold">신고하기</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 신고 대상 정보 */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-1">
            신고 대상: {targetType === 'post' ? '게시글' : '댓글'}
          </p>
          {targetTitle && (
            <p className="text-sm font-medium text-gray-800 truncate">
              {targetTitle}
            </p>
          )}
        </div>

        {/* 신고 폼 */}
        <form onSubmit={handleSubmit}>
          {/* 신고 사유 선택 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              신고 사유 *
            </label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              required
            >
              <option value="">신고 사유를 선택하세요</option>
              {reasons.map((reason) => (
                <option key={reason.id} value={reason.reason_code}>
                  {reason.reason_name}
                </option>
              ))}
            </select>
          </div>

          {/* 상세 설명 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              상세 설명 (선택사항)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              placeholder="신고 사유에 대한 추가 설명을 입력해주세요..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-gray-500 mt-1">
              {description.length}/500자
            </p>
          </div>

          {/* 오류 메시지 */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedReason}
              className="flex-1 px-4 py-2 text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '처리 중...' : '신고하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
