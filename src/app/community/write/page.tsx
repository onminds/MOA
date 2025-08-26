"use client";

import Header from '../../components/Header';
import { useState, useRef, Suspense, useEffect, useCallback } from 'react';
import { Pencil, ArrowLeft, Save, Image } from 'lucide-react';
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
  const { data: session, status } = useSession(); // status 추가
  const router = useRouter();
  const searchParams = useSearchParams();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const isAdmin = session?.user?.role === 'ADMIN';
  const availableCategories = isAdmin ? allCategories : userCategories;
  
  const initialCategory = searchParams.get('category') || availableCategories[0].name;
  const [category, setCategory] = useState(initialCategory);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false); // 제출 완료 상태 (영구 비활성화용)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const isSubmittingRef = useRef(false); // 추가 보안을 위한 ref
  
  // 이미지 업로드 관련 상태
  const [uploadedImages, setUploadedImages] = useState<Array<{
    id: number;
    fileName: string;
    originalName: string;
    fileSize: number;
    mimeType: string;
    width?: number;
    height?: number;
    file?: File;
    isTemp?: boolean;
    previewUrl?: string;
  }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // 컴포넌트 언마운트 시 미리보기 URL 정리
  useEffect(() => {
    return () => {
      uploadedImages.forEach(image => {
        if (image.previewUrl) {
          URL.revokeObjectURL(image.previewUrl);
        }
      });
    };
  }, [uploadedImages]);

  // 에디터의 이미지와 uploadedImages 상태 동기화
  const syncImagesWithEditor = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const editorImages = Array.from(editor.querySelectorAll('img'));
    const currentImageUrls = new Set(editorImages.map(img => img.src));
    
    setUploadedImages(prev => {
      // 에디터에 없는 이미지들의 Blob URL 정리
      const imagesToRemove = prev.filter(img => 
        img.previewUrl && img.previewUrl.startsWith('blob:') && !currentImageUrls.has(img.previewUrl)
      );
      
      imagesToRemove.forEach(img => {
        if (img.previewUrl) {
          URL.revokeObjectURL(img.previewUrl);
        }
      });
      
      // 에디터에 있는 이미지만 유지
      return prev.filter(img => 
        !img.previewUrl || !img.previewUrl.startsWith('blob:') || currentImageUrls.has(img.previewUrl)
      );
    });
  }, []);

  // onInput 이벤트 핸들러 (Hook 순서를 위해 여기로 이동)
  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    // 플레이스홀더 제거
    const placeholder = '<div class="text-gray-400">내용을 입력하세요.</div>';
    if (e.currentTarget.innerHTML === placeholder) {
      e.currentTarget.innerHTML = '';
      return;
    }
    
    // 현재 에디터의 HTML 내용을 가져와서 마크다운으로 변환
    const html = e.currentTarget.innerHTML;
    let markdownContent = '';
    
    // HTML을 파싱하여 마크다운으로 변환
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // 각 노드를 순회하면서 마크다운으로 처리
    const processNode = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        // 텍스트 노드
        const text = node.textContent || '';
        return text;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        
        if (element.tagName === 'IMG') {
          // 이미지 요소를 마크다운으로 변환
          const imgElement = element as HTMLImageElement;
          const src = imgElement.src || '';
          const alt = imgElement.alt || '이미지';
          
          // Blob URL인 경우 uploadedImages에서 해당 이미지 찾기
          if (src.startsWith('blob:')) {
            const tempImage = uploadedImages.find(img => img.previewUrl === src);
            if (tempImage) {
              return `![${alt}](temp_${tempImage.id})\n\n`;
            }
          }
          
          // 일반 이미지 URL인 경우
          const imageId = src.split('/').pop();
          if (imageId) {
            return `![${alt}](${imageId})\n\n`;
          }
          
          return '';
        } else if (element.tagName === 'DIV' || element.tagName === 'P') {
          // div나 p 태그 처리
          let content = '';
          
          // 자식 노드들을 재귀적으로 처리
          for (let i = 0; i < element.childNodes.length; i++) {
            content += processNode(element.childNodes[i]);
          }
          
          // 내용이 있으면 줄바꿈 추가
          if (content.length > 0) {
            return content + '\n';
          } else {
            return '\n';
          }
        } else if (element.tagName === 'BR') {
          // 줄바꿈
          return '\n';
        } else {
          // 기타 요소의 텍스트
          const text = element.textContent || '';
          return text;
        }
      }
      return '';
    };
    
    // 모든 노드를 순회하면서 마크다운으로 처리
    for (let i = 0; i < tempDiv.childNodes.length; i++) {
      markdownContent += processNode(tempDiv.childNodes[i]);
    }
    
    // 연속된 줄바꿈을 정리
    markdownContent = markdownContent.replace(/\n{3,}/g, '\n\n');
    
    // 앞뒤 불필요한 줄바꿈 제거
    markdownContent = markdownContent.replace(/^\n+/, '').replace(/\n+$/, '');
    
    // 마크다운 content에 저장
    setContent(markdownContent.trim());
    
    // 이미지 동기화 (약간의 지연을 두어 DOM 업데이트 후 실행)
    setTimeout(() => {
      syncImagesWithEditor();
    }, 100);
  }, [syncImagesWithEditor, uploadedImages]);

  // 에디터 초기화
  useEffect(() => {
    if (editorRef.current && !content && !editorRef.current.innerHTML.trim()) {
      editorRef.current.innerHTML = '<div class="text-gray-400">내용을 입력하세요.</div>';
    }
  }, []);

  // 세션 로딩 중일 때 로딩 화면 표시
  if (status === 'loading') {
    return <WritePageLoading />;
  }

  // 로그인 체크 (세션 로딩 완료 후)
  if (status === 'unauthenticated' || !session?.user?.id) {
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

  // 이미지 업로드 및 텍스트에 삽입
  const handleImageUpload = async (files: FileList) => {
    if (files.length === 0) return;
    
    // 실제 에디터의 이미지 개수를 기준으로 체크
    const editor = editorRef.current;
    const currentImageCount = editor ? editor.querySelectorAll('img').length : 0;
    
    // 파일 개수 제한 (최대 10개)
    if (currentImageCount + files.length > 10) {
      setToast({ message: `현재 ${currentImageCount}개의 이미지가 있습니다. 최대 10개까지 업로드 가능합니다.`, type: 'error' });
      return;
    }
    
    // 파일 용량 사전 검증
    const maxSize = 10 * 1024 * 1024; // 10MB
    const oversizedFiles = Array.from(files).filter(file => file.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      const fileNames = oversizedFiles.map(file => file.name).join(', ');
      setToast({ 
        message: `다음 파일의 용량이 10MB를 초과합니다: ${fileNames}. 용량을 줄인 후 다시 시도해주세요.`, 
        type: 'error' 
      });
      return;
    }
    
    setIsUploading(true);
    
    try {
      // 파일들을 임시로 저장 (미리보기용 URL 생성)
      const newImages = Array.from(files).map((file, index) => ({
        id: Date.now() + index + Math.random() * 1000,
        file: file,
        fileName: file.name,
        originalName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        isTemp: true,
        previewUrl: URL.createObjectURL(file)
      }));
      
      setUploadedImages(prev => [...prev, ...newImages]);
      
      // 리치 텍스트 에디터에 이미지 삽입
      const editor = editorRef.current;
      if (editor) {
        // 에디터에 포커스 주기
        editor.focus();
        
        // 플레이스홀더 제거
        const placeholder = '<div class="text-gray-400">내용을 입력하세요.</div>';
        if (editor.innerHTML === placeholder) {
          editor.innerHTML = '';
        }
        
        // 현재 선택 영역 가져오기
        let selection = window.getSelection();
        let range = selection?.getRangeAt(0);
        
        // 선택 영역이 없거나 에디터 외부에 있으면 에디터 끝에 커서 위치시키기
        if (!selection || !range || !editor.contains(range.commonAncestorContainer)) {
          range = document.createRange();
          range.selectNodeContents(editor);
          range.collapse(false);
          
          selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
        
        if (range) {
          // 각 이미지를 실제 이미지 요소로 삽입
          newImages.forEach(img => {
            // 이미지 요소 생성
            const imgElement = document.createElement('img');
            imgElement.src = img.previewUrl;
            imgElement.alt = img.originalName;
            imgElement.className = 'max-w-full h-auto rounded-lg border border-gray-200 my-2';
            
            // 이미지 삽입
            range.insertNode(imgElement);
            
            // 이미지 뒤에 텍스트 노드로 줄바꿈 추가 (더 안전한 방식)
            const textNode = document.createTextNode('\n');
            range.insertNode(textNode);
            
            // 커서를 이미지 뒤의 텍스트 노드 뒤로 이동
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
          });
          
                     // 포커스 유지
           editor.focus();
         }
       }
       
       // 이미지 삽입 후 handleInput을 강제로 호출하여 글자 수 업데이트
       setTimeout(() => {
         if (editor) {
           const event = new Event('input', { bubbles: true });
           editor.dispatchEvent(event);
         }
       }, 100);
     
       setToast({ message: `${files.length}개의 이미지가 내용에 삽입되었습니다.`, type: 'success' });
    } catch (error) {
      console.error('이미지 삽입 오류:', error);
      setToast({ message: '이미지 삽입 중 오류가 발생했습니다.', type: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  // 이미지 삭제 (임시 이미지)
  const handleImageDelete = (imageId: number) => {
    // 삭제 전에 이미지 정보를 미리 저장
    const imageToDelete = uploadedImages.find(img => img.id === imageId);
    
    setUploadedImages(prev => {
      const imageToRemove = prev.find(img => img.id === imageId);
      if (imageToRemove?.previewUrl) {
        URL.revokeObjectURL(imageToRemove.previewUrl);
      }
      return prev.filter(img => img.id !== imageId);
    });
    
    // content에서 해당 이미지 마크다운 제거
    if (imageToDelete) {
      const imageMarkdown = `![${imageToDelete.originalName}](temp_${imageToDelete.id})`;
      setContent(prev => prev.replace(imageMarkdown, ''));
      
      // 에디터에서도 해당 이미지 제거
      const editor = editorRef.current;
      if (editor) {
        const imgElements = editor.querySelectorAll('img');
        imgElements.forEach(img => {
          if (img.src === imageToDelete.previewUrl) {
            img.remove();
          }
        });
      }
    }
    
    setToast({ message: '이미지가 제거되었습니다', type: 'success' });
  };

  // 글쓰기 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 이미 제출 중이면 중복 실행 방지 (이중 체크)
    if (isSubmitting || isSubmittingRef.current) {
      e.stopPropagation();
      return;
    }
    
    // 즉시 DOM 조작으로 폼 전체 비활성화 (React 상태 업데이트 지연 방지)
    const form = e.currentTarget as HTMLFormElement;
    const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    const allInputs = form.querySelectorAll('input, select, textarea, [contenteditable]');
    
    // 제출 버튼 즉시 비활성화
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.style.pointerEvents = 'none';
      submitButton.style.opacity = '0.6';
    }
    
    // 모든 입력 필드 즉시 비활성화
    allInputs.forEach((input: Element) => {
      if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement || input instanceof HTMLTextAreaElement) {
        input.disabled = true;
        input.style.pointerEvents = 'none';
        input.style.opacity = '0.5';
      } else if (input instanceof HTMLElement && input.hasAttribute('contenteditable')) {
        input.contentEditable = 'false';
        input.style.pointerEvents = 'none';
        input.style.opacity = '0.5';
      }
    });
    
    // 즉시 제출 상태로 변경하여 중복 클릭 방지
    setIsSubmitting(true);
    isSubmittingRef.current = true;
    
    try {
      const selectedCategory = allCategories.find(cat => cat.name === category);
      const category_id = selectedCategory ? selectedCategory.id : null;
      
      // 임시 이미지가 있는지 확인
      const tempImages = uploadedImages.filter(img => img.isTemp && img.file);
      
      if (tempImages.length > 0) {
        // 임시 이미지가 있으면 먼저 이미지 업로드
        const formData = new FormData();
        tempImages.forEach(img => {
          if (img.file) {
            formData.append('images', img.file);
          }
        });
        
        // 임시 게시글 생성 (이미지 없이)
        const tempRes = await fetch('/api/community/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            content: '임시 내용', // 임시 내용으로 생성
            category_id
          })
        });
        
        if (tempRes.ok) {
          const tempData = await tempRes.json();
          const postId = tempData.postId;
          
          // 이미지 업로드
          const imageRes = await fetch(`/api/community/posts/${postId}/images`, {
            method: 'POST',
            body: formData
          });
          
          if (imageRes.ok) {
            const imageData = await imageRes.json();
            
            // 내용의 임시 ID를 실제 이미지 ID로 변환
            let updatedContent = content;
            
            // 이미지 ID 매핑 생성
            const imageIdMap = new Map();
            tempImages.forEach((tempImg, index) => {
              const actualImage = imageData.images[index];
              if (actualImage) {
                imageIdMap.set(tempImg.id, actualImage.id);
              }
            });
            
            // 정확한 패턴으로 치환
            imageIdMap.forEach((actualId, tempId) => {
              const tempPattern = new RegExp(`!\\[([^\\]]*)\\]\\(temp_${tempId}\\)`, 'g');
              updatedContent = updatedContent.replace(tempPattern, `![$1](${actualId})`);
            });
            
            // 변환된 내용으로 게시글 업데이트
            const updateRes = await fetch(`/api/community/posts/${postId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                content: updatedContent.trim(),
                skipUpdatedAt: true 
              })
            });
            
                         if (updateRes.ok) {
               setToast({ message: '게시글과 이미지가 등록되었습니다!', type: 'success' });
               setIsSubmitted(true); // 제출 완료 상태로 설정 (영구 비활성화)
               setTimeout(() => {
                 router.push(`/community/${postId}`);
               }, 1500);
             } else {
               setToast({ message: '게시글은 등록되었지만 이미지 연결에 실패했습니다.', type: 'error' });
               setIsSubmitted(true); // 제출 완료 상태로 설정 (영구 비활성화)
             }
                     } else {
             setToast({ message: '게시글은 등록되었지만 이미지 업로드에 실패했습니다.', type: 'error' });
             setIsSubmitted(true); // 제출 완료 상태로 설정 (영구 비활성화)
           }
                 } else {
           const errorData = await tempRes.json();
           setToast({ message: `게시글 등록에 실패했습니다: ${errorData.error}`, type: 'error' });
           setIsSubmitted(true); // 제출 완료 상태로 설정 (영구 비활성화)
         }
      } else {
        // 이미지가 없으면 바로 게시글 생성
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
           const data = await res.json();
           setToast({ message: '게시글이 등록되었습니다!', type: 'success' });
           setIsSubmitted(true); // 제출 완료 상태로 설정 (영구 비활성화)
           setTimeout(() => {
             router.push(`/community/${data.postId}`);
           }, 1500);
         } else {
           const errorData = await res.json();
           setToast({ message: `게시글 등록에 실패했습니다: ${errorData.error}`, type: 'error' });
           setIsSubmitted(true); // 제출 완료 상태로 설정 (영구 비활성화)
         }
      }
         } catch (error) {
       console.error('게시글 등록 오류:', error);
       setToast({ message: '게시글 등록 중 오류가 발생했습니다.', type: 'error' });
       setIsSubmitted(true); // 제출 완료 상태로 설정 (영구 비활성화)
     } finally {
      // 상태 복구
      setIsSubmitting(false);
      isSubmittingRef.current = false;
      
      // isSubmitted 상태가 아닐 때만 DOM 상태 복구 (에러 발생 시를 대비)
      if (!isSubmitted) {
        const form = formRef.current;
        if (form) {
          const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
          const allInputs = form.querySelectorAll('input, select, textarea, [contenteditable]');
          
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.style.pointerEvents = '';
            submitButton.style.opacity = '';
          }
          
          allInputs.forEach((input: Element) => {
            if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement || input instanceof HTMLTextAreaElement) {
              input.disabled = false;
              input.style.pointerEvents = '';
              input.style.opacity = '';
            } else if (input instanceof HTMLElement && input.hasAttribute('contenteditable')) {
              input.contentEditable = 'true';
              input.style.pointerEvents = '';
              input.style.opacity = '';
            }
          });
        }
      }
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
                         <form 
               ref={formRef} 
               onSubmit={isSubmitted ? (e) => e.preventDefault() : handleSubmit} 
               className="p-8"
               // 제출 중일 때 폼 전체 비활성화
               {...(isSubmitting && { 'aria-disabled': true })}
               // 추가 보안: 제출 중이거나 완료된 경우 폼 제출 완전 차단
               onKeyDown={(e) => {
                 if ((isSubmitting || isSubmitted) && (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
                   e.preventDefault();
                   e.stopPropagation();
                 }
               }}
             >
              {/* 카테고리 선택 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  카테고리
                </label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    disabled={isSubmitting || isSubmitted}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-400 focus:outline-none text-gray-900 bg-white appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
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
                  disabled={isSubmitting || isSubmitted}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-400 focus:outline-none text-gray-900 bg-white placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                <div className="relative">
                  {/* 리치 텍스트 에디터 */}
                  <div 
                    ref={editorRef}
                    className={`w-full px-4 py-3 min-h-[400px] rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-gray-400 focus-within:outline-none text-gray-900 bg-white resize-y pr-12 ${(isSubmitting || isSubmitted) ? 'opacity-50 pointer-events-none' : ''}`}
                    contentEditable={!(isSubmitting || isSubmitted)}
                    suppressContentEditableWarning
                    onInput={handleInput}
                    onPaste={(e) => {
                      if (isSubmitting || isSubmitted) return;
                      e.preventDefault();
                      const text = e.clipboardData.getData('text/plain');
                      document.execCommand('insertText', false, text);
                    }}
                    onFocus={(e) => {
                      if (isSubmitting || isSubmitted) return;
                      const placeholder = '<div class="text-gray-400">내용을 입력하세요.</div>';
                      if (e.currentTarget.innerHTML === placeholder) {
                        e.currentTarget.innerHTML = '';
                      }
                    }}
                    onBlur={(e) => {
                      if (isSubmitting || isSubmitted) return;
                      if (!e.currentTarget.innerHTML.trim()) {
                        e.currentTarget.innerHTML = '<div class="text-gray-400">내용을 입력하세요.</div>';
                      }
                    }}
                    onKeyDown={(e) => {
                      if (isSubmitting || isSubmitted) return;
                      const placeholder = '<div class="text-gray-400">내용을 입력하세요.</div>';
                      if (e.currentTarget.innerHTML === placeholder) {
                        e.currentTarget.innerHTML = '';
                      }
                    }}
                    style={{ 
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      outline: 'none'
                    }}
                  />
                  
                  {/* 이미지 첨부 버튼 */}
                  <button
                    type="button"
                    className="absolute top-3 right-3 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || isSubmitting || isSubmitted}
                    title={`이미지 첨부 (현재 ${editorRef.current?.querySelectorAll('img').length || 0}/10개)`}
                  >
                    {isUploading ? (
                      <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                      </svg>
                    ) : (
                      <div className="relative">
                        <Image className="w-5 h-5" />
                        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                          {editorRef.current?.querySelectorAll('img').length || 0}
                        </span>
                      </div>
                    )}
                  </button>
                  
                                     {/* 숨겨진 파일 입력 */}
                   <input
                     ref={fileInputRef}
                     type="file"
                     multiple
                     accept="image/*"
                     className="hidden"
                     onChange={(e) => {
                       if (e.target.files) {
                         handleImageUpload(e.target.files);
                       }
                       e.target.value = '';
                     }}
                   />
                   
                                       {/* 용량 제한 안내 */}
                    <div className="text-xs text-gray-500 mt-2">
                      이미지 파일은 개당 최대 10MB까지 업로드 가능합니다.
                    </div>
                </div>
                
                                 <div className="text-xs text-gray-500 mt-1 text-right">
                   {content.length}/5000
                 </div>
              </div>

              {/* 버튼 영역 */}
              <div className="flex gap-3 justify-end">
                                 <Link
                   href={(isSubmitting || isSubmitted) ? "#" : "/community"}
                   className={`px-6 py-3 rounded-lg font-medium shadow-sm border border-gray-400 transition-colors ${
                     (isSubmitting || isSubmitted)
                       ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                       : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
                   }`}
                   onClick={(e) => {
                     if (isSubmitting || isSubmitted) {
                       e.preventDefault();
                     }
                   }}
                 >
                   {(isSubmitting || isSubmitted) ? '등록 완료' : '취소'}
                 </Link>
                                                                   <button
                  type="submit"
                  className="px-6 py-3 rounded-lg bg-black text-white font-semibold shadow-md hover:bg-gray-800 active:bg-gray-700 transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                     disabled={isSubmitting || isSubmitted || !title.trim() || !content.trim()}
                  onClick={(e) => {
                    // 이미 제출 중이면 클릭 이벤트 차단
                    if (isSubmitting) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                >
                  {isSubmitting && (
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                    </svg>
                  )}
                  <Save className="w-5 h-5" />
                                     {isSubmitting ? '등록 중... (잠시만 기다려주세요)' : isSubmitted ? '등록 완료' : '게시글 등록'}
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
