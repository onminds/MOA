// 안전한 JSON fetch 함수
export async function safeFetchJson(url: string, options?: RequestInit): Promise<any> {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

// 파일 업로드 함수
export async function uploadFile(file: File, url: string): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}

// 파일 읽기 함수
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      resolve(result);
    };
    reader.onerror = (e) => {
      reject(new Error('파일 읽기 실패'));
    };
    reader.readAsText(file);
  });
}

// 파일 읽기 함수 (ArrayBuffer)
export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as ArrayBuffer;
      resolve(result);
    };
    reader.onerror = (e) => {
      reject(new Error('파일 읽기 실패'));
    };
    reader.readAsArrayBuffer(file);
  });
}

// 로컬 스토리지 유틸리티
export const storage = {
  get: (key: string): any => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  },
  
  set: (key: string, value: any): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Storage set error:', error);
    }
  },
  
  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Storage remove error:', error);
    }
  },
  
  clear: (): void => {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Storage clear error:', error);
    }
  }
};

// 세션 스토리지 유틸리티
export const sessionStorageUtil = {
  get: (key: string): any => {
    try {
      const item = window.sessionStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  },
  
  set: (key: string, value: any): void => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Session storage set error:', error);
    }
  },
  
  remove: (key: string): void => {
    try {
      window.sessionStorage.removeItem(key);
    } catch (error) {
      console.error('Session storage remove error:', error);
    }
  },
  
  clear: (): void => {
    try {
      window.sessionStorage.clear();
    } catch (error) {
      console.error('Session storage clear error:', error);
    }
  }
};

// 디바운스 함수
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// 쓰로틀 함수
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// 클립보드 복사 함수
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // 폴백 방법
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    }
  } catch (error) {
    console.error('Copy to clipboard failed:', error);
    return false;
  }
}

// 파일 다운로드 함수
export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

// URL 파라미터 유틸리티
export const urlParams = {
  get: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(key);
  },
  
  set: (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set(key, value);
    window.history.replaceState({}, '', url.toString());
  },
  
  remove: (key: string): void => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.delete(key);
    window.history.replaceState({}, '', url.toString());
  }
};

// 에러 처리 함수
export function handleError(error: any, fallbackMessage: string = '오류가 발생했습니다.'): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return fallbackMessage;
}

// 로딩 상태 관리
export function createLoadingState() {
  let loading = false;
  let error: string | null = null;
  
  const setLoading = (isLoading: boolean) => {
    loading = isLoading;
    if (isLoading) {
      error = null;
    }
  };
  
  const setError = (errorMessage: string | null) => {
    error = errorMessage;
    if (errorMessage) {
      loading = false;
    }
  };
  
  return {
    get loading() { return loading; },
    get error() { return error; },
    setLoading,
    setError,
    reset: () => {
      loading = false;
      error = null;
    }
  };
} 