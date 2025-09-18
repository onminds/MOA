'use client';

import { useState, useRef } from 'react';
import { 
  Bold, 
  Italic, 
  Underline, 
  Strikethrough, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  Type,
  Palette,
  Image,
  Link,
  ChevronDown,
  Copy,
  Trash,
  SquarePlus
} from 'lucide-react';

interface TextEditToolbarProps {
  onCommand: (command: string, value?: string) => void;
  selectedElement: HTMLElement | null;
}

export default function TextEditToolbar({ onCommand, selectedElement }: TextEditToolbarProps) {
  const [showFontSize, setShowFontSize] = useState(false);
  const [showFontFamily, setShowFontFamily] = useState(false);
  const [showTextColor, setShowTextColor] = useState(false);
  const [showBackgroundColor, setShowBackgroundColor] = useState(false);
  const [showImageMenu, setShowImageMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fontSizes = ['8px', '10px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px', '64px'];
  const fontFamilies = [
    { name: 'Noto Sans KR', value: "'Noto Sans KR', sans-serif" },
    { name: 'Noto Serif KR', value: "'Noto Serif KR', serif" },
    { name: 'Arial', value: 'Arial, sans-serif' },
    { name: 'Times New Roman', value: "'Times New Roman', serif" },
    { name: 'Courier New', value: "'Courier New', monospace" }
  ];
  
  const colors = [
    '#000000', '#333333', '#666666', '#999999', '#CCCCCC', '#FFFFFF',
    '#FF0000', '#FF6600', '#FFCC00', '#00FF00', '#0066FF', '#6600FF',
    '#FF3366', '#FF9933', '#FFFF33', '#33FF33', '#3366FF', '#9933FF'
  ];

  const getCurrentStyle = (property: string): string => {
    if (!selectedElement) return '';
    
    // iframe 내부의 요소인 경우 iframe의 contentWindow를 사용
    const iframe = selectedElement.ownerDocument?.defaultView;
    if (iframe) {
      const style = iframe.getComputedStyle(selectedElement);
      return style.getPropertyValue(property);
    }
    
    const style = window.getComputedStyle(selectedElement);
    return style.getPropertyValue(property);
  };

  const getCurrentFontSize = (): string => {
    const fontSize = getCurrentStyle('font-size');
    if (fontSize) {
      // px 값을 그대로 반환
      return fontSize;
    }
    return '16px';
  };

  const getCurrentFontFamily = (): string => {
    const fontFamily = getCurrentStyle('font-family');
    if (fontFamily) {
      // 첫 번째 폰트만 추출
      const firstFont = fontFamily.split(',')[0].replace(/['"]/g, '').trim();
      return firstFont;
    }
    return 'Noto Sans KR';
  };

  const getCurrentTextColor = (): string => {
    const color = getCurrentStyle('color');
    if (color) {
      // rgb 값을 hex로 변환
      const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (rgbMatch) {
        const r = parseInt(rgbMatch[1]);
        const g = parseInt(rgbMatch[2]);
        const b = parseInt(rgbMatch[3]);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      }
    }
    return '#000000';
  };

  const isActive = (command: string): boolean => {
    if (!selectedElement) return false;
    
    // iframe 내부의 요소인 경우 iframe의 contentWindow를 사용
    const iframe = selectedElement.ownerDocument?.defaultView;
    let style;
    if (iframe) {
      style = iframe.getComputedStyle(selectedElement);
    } else {
      style = window.getComputedStyle(selectedElement);
    }
    
    switch (command) {
      case 'bold':
        return style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 700;
      case 'italic':
        return style.fontStyle === 'italic';
      case 'underline':
        return style.textDecoration.includes('underline');
      case 'strikethrough':
        return style.textDecoration.includes('line-through');
      case 'alignLeft':
        return style.textAlign === 'left' || style.textAlign === 'start';
      case 'alignCenter':
        return style.textAlign === 'center';
      case 'alignRight':
        return style.textAlign === 'right' || style.textAlign === 'end';
      default:
        return false;
    }
  };

  const handleImageUrlInsert = () => {
    const url = prompt('이미지 URL을 입력하세요:');
    if (url) onCommand('insertImage', url);
    setShowImageMenu(false);
  };

  const handleImageUploadClick = () => {
    try { fileInputRef.current?.click(); } catch {}
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onCommand('insertImage', dataUrl);
      setShowImageMenu(false);
      try { e.target.value = ''; } catch {}
    };
    reader.readAsDataURL(file);
  };

  const handleLinkInsert = () => {
    const url = prompt('링크 URL을 입력하세요:');
    if (url) {
      const text = prompt('링크 텍스트를 입력하세요:', url);
      onCommand('insertLink', JSON.stringify({ url, text: text || url }));
    }
  };

  return (
    <div 
      className="bg-white border-b border-gray-200 p-2 flex items-center gap-1 flex-wrap shadow-sm overflow-visible"
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 글꼴 선택 */}
      <div className="relative">
                 <button
           onClick={() => setShowFontFamily(!showFontFamily)}
           className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
         >
           <Type size={14} />
           <span className="hidden sm:inline text-xs max-w-20 truncate">
             {selectedElement ? getCurrentFontFamily() : '글꼴'}
           </span>
           <ChevronDown size={12} />
         </button>
        {showFontFamily && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 min-w-[160px]">
            {fontFamilies.map(font => (
              <button
                key={font.value}
                onClick={() => {
                  onCommand('fontFamily', font.value);
                  setShowFontFamily(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                style={{ fontFamily: font.value }}
              >
                {font.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 글자 크기 */}
      <div className="relative">
                 <button
           onClick={() => setShowFontSize(!showFontSize)}
           className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
         >
           <span className="text-xs">
             {selectedElement ? getCurrentFontSize() : '크기'}
           </span>
           <ChevronDown size={12} />
         </button>
        {showFontSize && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 max-h-48 overflow-y-auto">
            {fontSizes.map(size => (
              <button
                key={size}
                onClick={() => {
                  onCommand('fontSize', size);
                  setShowFontSize(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
              >
                {size}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-6 bg-gray-300 mx-1"></div>

      {/* 텍스트 스타일 */}
      <button
        onClick={() => onCommand('bold')}
        className={`p-1.5 rounded hover:bg-gray-100 ${isActive('bold') ? 'bg-blue-100 text-blue-600' : ''}`}
        title="굵게"
      >
        <Bold size={16} />
      </button>
      
      <button
        onClick={() => onCommand('italic')}
        className={`p-1.5 rounded hover:bg-gray-100 ${isActive('italic') ? 'bg-blue-100 text-blue-600' : ''}`}
        title="기울임"
      >
        <Italic size={16} />
      </button>
      
      <button
        onClick={() => onCommand('underline')}
        className={`p-1.5 rounded hover:bg-gray-100 ${isActive('underline') ? 'bg-blue-100 text-blue-600' : ''}`}
        title="밑줄"
      >
        <Underline size={16} />
      </button>
      
      <button
        onClick={() => onCommand('strikethrough')}
        className={`p-1.5 rounded hover:bg-gray-100 ${isActive('strikethrough') ? 'bg-blue-100 text-blue-600' : ''}`}
        title="취소선"
      >
        <Strikethrough size={16} />
      </button>

      <div className="w-px h-6 bg-gray-300 mx-1"></div>

      {/* 정렬 */}
      <button
        onClick={() => onCommand('alignLeft')}
        className={`p-1.5 rounded hover:bg-gray-100 ${isActive('alignLeft') ? 'bg-blue-100 text-blue-600' : ''}`}
        title="왼쪽 정렬"
      >
        <AlignLeft size={16} />
      </button>
      
      <button
        onClick={() => onCommand('alignCenter')}
        className={`p-1.5 rounded hover:bg-gray-100 ${isActive('alignCenter') ? 'bg-blue-100 text-blue-600' : ''}`}
        title="가운데 정렬"
      >
        <AlignCenter size={16} />
      </button>
      
      <button
        onClick={() => onCommand('alignRight')}
        className={`p-1.5 rounded hover:bg-gray-100 ${isActive('alignRight') ? 'bg-blue-100 text-blue-600' : ''}`}
        title="오른쪽 정렬"
      >
        <AlignRight size={16} />
      </button>

      <div className="w-px h-6 bg-gray-300 mx-1"></div>

      {/* 글자 색상 */}
      <div className="relative overflow-visible">
        <button
          onClick={() => setShowTextColor(!showTextColor)}
          className="flex items-center gap-1 p-1.5 border border-gray-300 rounded hover:bg-gray-50"
          title="글자 색상"
        >
                     <div className="w-4 h-4 border border-gray-300 rounded" style={{ backgroundColor: getCurrentTextColor() }}></div>
          <ChevronDown size={12} />
        </button>
        {showTextColor && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-[100] p-3 w-[220px]">
            <div className="text-xs text-gray-500 mb-2">색상</div>
            <div className="grid grid-cols-6 gap-2">
              {colors.map(color => (
                <button
                  key={color}
                  onClick={() => {
                    onCommand('textColor', color);
                    // 팔레트 유지하여 비교 선택 가능
                  }}
                  className="w-7 h-7 border border-gray-300 rounded hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 배경 색상 */}
      <div className="relative overflow-visible">
        <button
          onClick={() => setShowBackgroundColor(!showBackgroundColor)}
          className="flex items-center gap-1 p-1.5 border border-gray-300 rounded hover:bg-gray-50"
          title="배경 색상"
        >
          <Palette size={14} />
          <ChevronDown size={12} />
        </button>
        {showBackgroundColor && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-[100] p-3 w-[220px]">
            <div className="text-xs text-gray-500 mb-2">배경 색상</div>
            <div className="grid grid-cols-6 gap-2">
              <button
                onClick={() => {
                  onCommand('backgroundColor', 'transparent');
                  // setShowBackgroundColor(false);
                }}
                className="w-7 h-7 border border-gray-300 rounded hover:scale-110 transition-transform bg-white relative"
                title="투명"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-red-500 via-transparent to-red-500 opacity-30"></div>
              </button>
              {colors.map(color => (
                <button
                  key={color}
                  onClick={() => {
                    onCommand('backgroundColor', color);
                    // 팔레트 유지하여 비교 선택 가능
                  }}
                  className="w-7 h-7 border border-gray-300 rounded hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="w-px h-6 bg-gray-300 mx-1"></div>

      {/* 텍스트 상자 삽입 */}
      <button
        onClick={() => onCommand('insertTextBox')}
        className="p-1.5 rounded hover:bg-gray-100"
        title="텍스트 상자 삽입"
      >
        <SquarePlus size={16} />
      </button>

      {/* 맨 앞으로 / 맨 뒤로 */}
      <button
        onClick={() => onCommand('bringToFront')}
        className="p-1.5 rounded hover:bg-gray-100"
        title="맨 앞으로"
      >
        {/* 상단 화살표 느낌 */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 8 12 2 6 8"/><line x1="12" y1="2" x2="12" y2="22"/><rect x="3" y="14" width="18" height="6" rx="1"/></svg>
      </button>
      <button
        onClick={() => onCommand('sendToBack')}
        className="p-1.5 rounded hover:bg-gray-100"
        title="맨 뒤로"
      >
        {/* 하단 화살표 느낌 */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 16 12 22 18 16"/><line x1="12" y1="2" x2="12" y2="22"/><rect x="3" y="4" width="18" height="6" rx="1"/></svg>
      </button>

      {/* 이미지 삽입 (URL/업로드 드롭다운) */}
      <div className="relative overflow-visible">
        <button
          onClick={() => setShowImageMenu(!showImageMenu)}
          className="p-1.5 rounded hover:bg-gray-100"
          title="이미지 삽입"
        >
          <Image size={16} />
        </button>
        {showImageMenu && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 min-w-[160px]">
            <button
              onClick={handleImageUrlInsert}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
            >URL로 추가</button>
            <button
              onClick={handleImageUploadClick}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
            >이미지 업로드</button>
          </div>
        )}
        {/* 숨겨진 파일 업로드 입력 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageFileChange}
        />
      </div>

      {/* 링크 삽입 */}
      <button
        onClick={handleLinkInsert}
        className="p-1.5 rounded hover:bg-gray-100"
        title="링크 삽입"
      >
        <Link size={16} />
      </button>

      <div className="w-px h-6 bg-gray-300 mx-1"></div>

      {/* 복사 */}
      <button
        onClick={() => onCommand('duplicate')}
        className="p-1.5 rounded hover:bg-gray-100"
        title="복사"
      >
        <Copy size={16} />
      </button>

      {/* 삭제 */}
      <button
        onClick={() => onCommand('delete')}
        className="p-1.5 rounded hover:bg-red-50 text-red-600"
        title="삭제"
      >
        <Trash size={16} />
      </button>
    </div>
  );
}
