"use client";

import Header from '../../components/Header';
import { useState, useRef, Suspense } from 'react';
import { Pencil, ArrowLeft, Save } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const allCategories = [
  { id: 1, name: '공지' },
  { id: 2, name: 'Q&A' },
  { id: 3, name: '자유' },
  { id: 4, name: '프롬프트 공유' },
  { id: 5, name: '정보' },
  { id: 6, name: '이미지' },
  { id: 7, name: '영상' }
];

const userCategories = allCategories.filter(cat => cat.name !== '공지');

// Toast 컴포넌트
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  return (
    <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
      {message}
      <button onClick={onClose} className="ml-2 font-bold">×</button>
    </div>
  );
}

// 로딩 컴포넌트
function WritePageLoading() {
  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    </>
  );
}

// 메인 컴포넌트
function WritePageContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const isAdmin = session?.user?.role === 'admin';
  const availableCategories = isAdmin ? allCategories : userCategories;
  
  const initialCategory = searchParams.get('category') || availableCategories[0].name;
  const [category, setCategory] = useState(initialCategory);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // 로그인 체크
  if (!session?.user?.id) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">로그인이 필요합니다</h2>
            <p className="text-gray-600 mb-6">게시글을 작성하려면 로그인해주세요.</p>
            <Link 
              href="/auth/signin"
              className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
            >
              로그인하기
            </Link>
          </div>
        </div>
      </>
    );
  }

  // 글쓰기 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const selectedCategory = allCategories.find(cat => cat.name === category);
      const category_id = selectedCategory ? selectedCategory.id : null;
      
      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          category_id
        })
      });
      
      if (res.ok) {
        setToast({ message: '게시글이 등록되었습니다!', type: 'success' });
        setTimeout(() => {
          router.push('/community');
        }, 1500);
      } else {
        const errorData = await res.json();
        setToast({ message: `게시글 등록에 실패했습니다: ${errorData.error}`, type: 'error' });
      }
    } catch (error) {
      console.error('게시글 등록 오류:', error);
      setToast({ message: '게시글 등록 중 오류가 발생했습니다.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <Header />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto p-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Link 
                href="/community"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>커뮤니티로 돌아가기</span>
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">게시글 작성</h1>
          </div>

          {/* 글쓰기 폼 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <form ref={formRef} onSubmit={handleSubmit} className="p-8">
              {/* 카테고리 선택 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  카테고리
                </label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-400 focus:outline-none text-gray-900 bg-white appearance-none"
                  >
                    {availableCategories.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
              </div>

              {/* 제목 입력 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  제목
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-400 focus:outline-none text-gray-900 bg-white placeholder-gray-500"
                  placeholder="제목을 입력하세요"
                  required
                  maxLength={100}
                />
                <div className="text-xs text-gray-500 mt-1 text-right">
                  {title.length}/100
                </div>
              </div>

              {/* 내용 입력 */}
              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  내용
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-4 py-3 min-h-[400px] rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-400 focus:outline-none text-gray-900 bg-white placeholder-gray-500 resize-y"
                  placeholder="내용을 입력하세요"
                  required
                  maxLength={5000}
                />
                <div className="text-xs text-gray-500 mt-1 text-right">
                  {content.length}/5000
                </div>
              </div>

              {/* 버튼 영역 */}
              <div className="flex gap-3 justify-end">
                <Link
                  href="/community"
                  className="px-6 py-3 rounded-lg bg-gray-300 hover:bg-gray-400 text-gray-700 font-medium shadow-sm border border-gray-400 transition-colors"
                >
                  취소
                </Link>
                <button
                  type="submit"
                  className="px-6 py-3 rounded-lg bg-black text-white font-semibold shadow-md hover:bg-gray-800 active:bg-gray-700 transition-colors flex items-center gap-2 disabled:opacity-60"
                  disabled={isSubmitting || !title.trim() || !content.trim()}
                >
                  {isSubmitting && (
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                    </svg>
                  )}
                  <Save className="w-5 h-5" />
                  {isSubmitting ? '등록 중...' : '게시글 등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default function WritePage() {
  return (
    <Suspense fallback={<WritePageLoading />}>
      <WritePageContent />
    </Suspense>
  );
}
