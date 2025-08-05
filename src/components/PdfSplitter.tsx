'use client';

import { useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// PDF.js 워커 설정
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface Slide {
  pageNumber: number;
  imageData: string;
  text: string;
  slideType: 'text' | 'image' | 'mixed';
}

interface PdfSplitterProps {
  onSlidesGenerated: (slides: Slide[]) => void;
  onError: (error: string) => void;
}

export default function PdfSplitter({ onSlidesGenerated, onError }: PdfSplitterProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processPDF = async (file: File) => {
    try {
      setIsProcessing(true);
      setProgress(0);

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      const slides: Slide[] = [];
      const totalPages = pdf.numPages;

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        setProgress((pageNum / totalPages) * 100);

        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });

        // 캔버스 생성
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // 페이지 렌더링
        await page.render({
          canvasContext: context!,
          viewport: viewport
        }).promise;

        // 텍스트 추출
        const textContent = await page.getTextContent();
        const text = textContent.items
          .map((item: any) => item.str)
          .join(' ')
          .trim();

        // 이미지 데이터 생성
        const imageData = canvas.toDataURL('image/png', 0.8);

        // 슬라이드 타입 결정
        let slideType: 'text' | 'image' | 'mixed' = 'text';
        if (text.length > 50) {
          slideType = 'text';
        } else if (text.length === 0) {
          slideType = 'image';
        } else {
          slideType = 'mixed';
        }

        slides.push({
          pageNumber: pageNum,
          imageData,
          text,
          slideType
        });
      }

      setProgress(100);
      onSlidesGenerated(slides);

    } catch (error) {
      console.error('PDF 처리 오류:', error);
      onError('PDF 파일을 처리하는 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      onError('PDF 파일만 지원됩니다.');
      return;
    }

    await processPDF(file);
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      onError('PDF 파일만 지원됩니다.');
      return;
    }

    await processPDF(file);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <div
        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          className="hidden"
        />
        
        {isProcessing ? (
          <div className="space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-gray-600">PDF를 슬라이드로 분할 중...</p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-500">{Math.round(progress)}% 완료</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-6xl text-gray-400">📄</div>
            <h3 className="text-lg font-medium text-gray-900">
              PDF 파일을 여기에 드래그하거나 클릭하여 업로드
            </h3>
            <p className="text-sm text-gray-500">
              PDF 파일을 페이지별로 분할하여 슬라이드로 변환합니다
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 