"use client";

import Header from '../../../components/Header';
import { useState, useRef, Suspense, useEffect, useCallback } from 'react';
import { Pencil, ArrowLeft, Save, Image } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
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
function EditPageLoading() {
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
function EditPageContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const postId = params.id as string;
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [originalPost, setOriginalPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  
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

  const isAdmin = session?.user?.role === 'ADMIN';
  const availableCategories = isAdmin ? allCategories : userCategories;

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

  // 에디터 초기화
  useEffect(() => {
    if (editorRef.current && content && !editorRef.current.innerHTML.trim() && !loading) {
      // 마크다운을 HTML로 변환하여 에디터에 표시
      const lines = content.split('\n');
      let htmlContent = '';
      
      for (const line of lines) {
        const imageMatch = line.match(/!\[([^\]]*)\]\((\d+)\)/);
        const tempImageMatch = line.match(/!\[([^\]]*)\]\(temp_(\d+)\)/);
        
        if (imageMatch) {
          const [, alt, imageId] = imageMatch;
          htmlContent += `<img src="/api/community/posts/images/${imageId}" alt="${alt || '이미지'}" class="max-w-full h-auto rounded-lg border border-gray-200 my-2" />`;
        } else if (tempImageMatch) {
          const [, alt, tempId] = tempImageMatch;
          // temp_ ID인 경우 uploadedImages에서 해당 이미지 찾기
          const tempImage = uploadedImages.find(img => img.id === parseInt(tempId));
          if (tempImage && tempImage.previewUrl) {
            htmlContent += `<img src="${tempImage.previewUrl}" alt="${alt || tempImage.originalName}" class="max-w-full h-auto rounded-lg border border-gray-200 my-2" />`;
          }
        } else if (line.trim()) {
          htmlContent += `<div>${line}</div>`;
        } else {
          htmlContent += '<div><br></div>';
        }
      }
      
      editorRef.current.innerHTML = htmlContent || '<div class="text-gray-400">내용을 입력하세요.</div>';
    }
  }, [content, loading, uploadedImages]);

  // 기존 게시글 데이터 로드
  useEffect(() => {
    const fetchPost = async () => {
      if (!postId) return;
      
      try {
        const response = await fetch(`/api/community/posts/${postId}`);
        if (!response.ok) {
          if (response.status === 404) {
            setToast({ message: '게시글을 찾을 수 없습니다.', type: 'error' });
            router.push('/community');
            return;
          }
          throw new Error('게시글 로드 실패');
        }
        
        const post = await response.json();
        setOriginalPost(post);
        setTitle(post.title);
        setContent(post.content);
        setCategory(post.category);
        
        // 기존 이미지들 로드
        if (post.images && post.images.length > 0) {
          const existingImages = post.images.map((img: any) => ({
            id: img.id,
            fileName: img.file_name,
            originalName: img.original_name,
            fileSize: img.file_size,
            mimeType: img.mime_type,
            width: img.width,
            height: img.height,
            isTemp: false,
            previewUrl: `/api/community/posts/images/${img.id}`
          }));
          setUploadedImages(existingImages);
        }
        
      } catch (error) {
        console.error('게시글 로드 오류:', error);
        setToast({ message: '게시글을 불러오는데 실패했습니다.', type: 'error' });
        router.push('/community');
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [postId, router]);

  // 로그인 체크
  if (!session?.user?.id) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">로그인이 필요합니다</h2>
            <p className="text-gray-600 mb-6">게시글을 수정하려면 로그인해주세요.</p>
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

  // 권한 체크
  if (!loading && originalPost && String(originalPost.author_id) !== String(session.user.id) && !isAdmin) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">권한이 없습니다</h2>
            <p className="text-gray-600 mb-6">본인이 작성한 게시글만 수정할 수 있습니다.</p>
            <Link 
              href="/community"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              커뮤니티로 돌아가기
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

  // 글쓰기 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
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
          const res = await fetch(`/api/community/posts/${postId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: title.trim(),
              content: updatedContent.trim(),
              category_id
            })
          });
          
          if (res.ok) {
            setToast({ message: '게시글과 이미지가 수정되었습니다!', type: 'success' });
            setTimeout(() => {
              router.push(`/community/${postId}`);
            }, 1500);
          } else {
            const errorData = await res.json();
            setToast({ message: `게시글 수정에 실패했습니다: ${errorData.error}`, type: 'error' });
          }
        } else {
          setToast({ message: '이미지 업로드에 실패했습니다.', type: 'error' });
        }
      } else {
        // 임시 이미지가 없으면 바로 게시글 업데이트
        const res = await fetch(`/api/community/posts/${postId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            content: content.trim(),
            category_id
          })
        });
        
        if (res.ok) {
          setToast({ message: '게시글이 수정되었습니다!', type: 'success' });
          setTimeout(() => {
            router.push(`/community/${postId}`);
          }, 1500);
        } else {
          const errorData = await res.json();
          setToast({ message: `게시글 수정에 실패했습니다: ${errorData.error}`, type: 'error' });
        }
      }
    } catch (error) {
      console.error('게시글 수정 오류:', error);
      setToast({ message: '게시글 수정 중 오류가 발생했습니다.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // onInput 이벤트 핸들러
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

  if (loading) {
    return <EditPageLoading />;
  }

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
                href={`/community/${postId}`}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>게시글로 돌아가기</span>
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">게시글 수정</h1>
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
                <div className="relative">
                  {/* 리치 텍스트 에디터 */}
                  <div 
                    ref={editorRef}
                    className="w-full px-4 py-3 min-h-[400px] rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-gray-400 focus-within:outline-none text-gray-900 bg-white resize-y pr-12"
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleInput}
                    onPaste={(e) => {
                      e.preventDefault();
                      const text = e.clipboardData.getData('text/plain');
                      document.execCommand('insertText', false, text);
                    }}
                    onFocus={(e) => {
                      const placeholder = '<div class="text-gray-400">내용을 입력하세요.</div>';
                      if (e.currentTarget.innerHTML === placeholder) {
                        e.currentTarget.innerHTML = '';
                      }
                    }}
                    onBlur={(e) => {
                      if (!e.currentTarget.innerHTML.trim()) {
                        e.currentTarget.innerHTML = '<div class="text-gray-400">내용을 입력하세요.</div>';
                      }
                    }}
                    onKeyDown={(e) => {
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
                    className="absolute top-3 right-3 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
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
                  href={`/community/${postId}`}
                  className="px-6 py-3 rounded-lg bg-gray-300 hover:bg-gray-400 text-gray-700 font-medium shadow-sm border border-gray-400 transition-colors"
                >
                  취소
                </Link>
                                                   <button
                    type="submit"
                    className="px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold shadow-md hover:bg-blue-700 active:bg-blue-800 transition-colors flex items-center gap-2 disabled:opacity-60"
                    disabled={isSubmitting || !title.trim() || !content.trim()}
                  >
                  {isSubmitting && (
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                    </svg>
                  )}
                  <Save className="w-5 h-5" />
                  {isSubmitting ? '수정 중...' : '게시글 수정'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default function EditPage() {
  return (
    <Suspense fallback={<EditPageLoading />}>
      <EditPageContent />
    </Suspense>
  );
}
