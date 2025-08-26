"use client";
import { useRef, useMemo, useEffect } from "react";
import { ReportWriter } from "@/lib/report-writers/types";
import { sanitizeHTML } from "@/lib/report-writers/utils";
import { Download, FileDown } from "lucide-react";

export default function ReportWriterViewer({ report }: { report: ReportWriter }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const safeSections = useMemo(() => report.sections.map((s) => ({ ...s, safe: sanitizeHTML(s.html) })), [report.sections]);

  // 보고서 생성 완료 여부 판단: 모든 섹션에 내용이 있고, TOC와 섹션 수가 일치할 때
  const isComplete = useMemo(() => {
    const hasAllSections = report.sections.length > 0 && report.sections.every(s => typeof s.html === 'string' && s.html.trim().length > 0);
    const tocMatches = Array.isArray(report.toc) && report.toc.length > 0 && report.toc.length === report.sections.length;
    return hasAllSections && tocMatches;
  }, [report.sections, report.toc]);

  // HTML 내용을 처리하여 표와 차트에 자동으로 클래스 추가
  const processHTMLContent = (html: string) => {
    let processed = html;
    
    // 표 자동 감지 및 tablewrap 클래스 추가
    const hasTable = /<table[^>]*>/i.test(processed);
    
    if (hasTable) {
      processed = processed.replace(
        /<table([^>]*)>/gi, 
        '<div class="tablewrap"><table$1>'
      );
      processed = processed.replace(
        /<\/table>/gi, 
        '</table></div>'
      );
    }
    
    // 차트 자동 감지 및 figure 클래스 추가  
    const hasCanvas = /<canvas[^>]*>/i.test(processed);
    
    if (hasCanvas) {
      processed = processed.replace(
        /<canvas([^>]*)>/gi, 
        '<div class="figure"><canvas$1></canvas></div>'
      );
    }
    
    // 숫자 목록 사용 금지: <ol>을 <ul>로 변환하여 번호를 제거
    processed = processed.replace(/<ol([^>]*)>/gi, '<ul$1>');
    processed = processed.replace(/<\/ol>/gi, '</ul>');

    // 헤딩 앞자리 숫자(예: "4.2 제목") 제거
    processed = processed.replace(/<h2>(\s*\d+(?:\.\d+)*\s+)([^<]+)<\/h2>/gi, '<h2>$2</h2>');
    processed = processed.replace(/<h3>(\s*\d+(?:\.\d+)*\s+)([^<]+)<\/h3>/gi, '<h3>$2</h3>');
    processed = processed.replace(/<h4>(\s*\d+(?:\.\d+)*\s+)([^<]+)<\/h4>/gi, '<h4>$2</h4>');

    // 내부/빈 앵커 제거: 블록 전체가 파란색이 되는 현상 방지
    // http/https, mailto 가 아닌 링크는 모두 제거하여 텍스트만 남김
    processed = processed.replace(/<a\b[^>]*href=['"](?!https?:|mailto:)[^'"]*['"][^>]*>/gi, '');
    processed = processed.replace(/<a\b(?:(?!href).)*>/gi, '');
    processed = processed.replace(/<\/a>/gi, '');
    
    // 불릿 포인트 자동 변환 제거 - AI가 필요시에만 생성하도록 함
    
    // 막대 차트와 선 차트는 이미 클래스가 있으므로 추가 처리 불필요
    
    return processed;
  };

  // ReportWriter 데이터를 localStorage에 저장 (인쇄용 페이지에서 사용)
  useEffect(() => {
    localStorage.setItem('report-writer-data', JSON.stringify(report));
  }, [report]);

  // Chart.js 자동 로드 (차트가 있을 때만)
  useEffect(() => {
    const hasChart = safeSections.some(section => section.safe.includes('<canvas'));
    if (hasChart) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      script.async = true;
      document.head.appendChild(script);
      
      return () => {
        document.head.removeChild(script);
      };
    }
  }, [safeSections]);

  // 렌더 후에도 혹시 다른 전역 CSS가 간섭하는 경우를 대비하여 DOM에서 보정
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const ols = root.querySelectorAll('.report ol');
    ols.forEach((ol) => {
      if (!ol.hasAttribute('start')) {
        ol.setAttribute('start', '1');
      }
    });
  }, [safeSections]);

  const exportHTML = () => {
    const dateStr = new Date(report.meta.createdAt).toLocaleDateString('ko-KR');
    
    // HTML 내용을 처리하여 표와 차트에 자동으로 클래스 추가
    const processHTMLContent = (html: string) => {
      let processed = html;
      
      // 표 자동 감지 및 tablewrap 클래스 추가
      processed = processed.replace(
        /<table([^>]*)>/g, 
        '<div class="tablewrap"><table$1>'
      );
      processed = processed.replace(
        /<\/table>/g, 
        '</table></div>'
      );
      
      // 차트 자동 감지 및 figure 클래스 추가
      processed = processed.replace(
        /<canvas([^>]*)>/g, 
        '<div class="figure"><canvas$1></canvas></div>'
      );
      
      // 숫자 목록 사용 금지: <ol>을 <ul>로 변환하여 번호 제거 (다운로드 HTML에도 동일 적용)
      processed = processed.replace(/<ol([^>]*)>/gi, '<ul$1>');
      processed = processed.replace(/<\/ol>/gi, '</ul>');
      processed = processed.replace(/<h2>(\s*\d+(?:\.\d+)*\s+)([^<]+)<\/h2>/gi, '<h2>$2</h2>');
      processed = processed.replace(/<h3>(\s*\d+(?:\.\d+)*\s+)([^<]+)<\/h3>/gi, '<h3>$2</h3>');
      processed = processed.replace(/<h4>(\s*\d+(?:\.\d+)*\s+)([^<]+)<\/h4>/gi, '<h4>$2</h4>');
      
      return processed;
    };
    
    const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    /* ===== Report Tone – Corporate Gray (Long Scroll) ===== */
    :root{
      --ink:#111827; --sub:#4b5563; --line:#e5e7eb; --paper:#ffffff; --bg:#f7f8fb; --accent:#1f3a93;
    }
    html, body { background: var(--bg); color: var(--ink); }
    
    /* 본문 타이포 (가독성 우선, 한국어용 줄바꿈) */
    .report { font-size: 15px; }
    .report p{ margin: .85rem 0; line-height: 1.95; word-break: keep-all; }
    .report ul{ list-style: disc; padding-left: 1.25rem; margin: .6rem 0; }
    .report ol{ list-style: decimal; padding-left: 1.25rem; margin: .6rem 0; }
    .report li{ margin: .25rem 0; }
    .report a{ color: var(--accent); text-underline-position: under; }
    
    /* 섹션: 카드 느낌 최소화 (각 잡힌 문서 톤) */
    .section{
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: none;
      padding: 1.25rem 1.25rem;
    }
    
    /* 장/절 번호 자동 부여 */
    main.report { counter-reset: h2counter h3counter figureCounter tableCounter; }
    .section > .sec-title{
      counter-increment: h2counter;
      border-bottom: 1px solid #f0f2f5;
      padding-bottom: .5rem;
      margin-bottom: 1rem;
      font-weight: 800; font-size: 1.125rem;
    }
    .section > .sec-title::before{
      content: counter(h2counter) ". ";
      font-weight: 900; color:#111827; margin-right: .15rem;
    }
    
    /* 표/그림 + 캡션 번호 */
    .tablewrap{ counter-increment: tableCounter; margin: .75rem 0; }
    .tablewrap .caption::before{ content: "표 " counter(tableCounter) ". "; font-weight:600; color:#374151; }
    .figure{ counter-increment: figureCounter; margin: .75rem 0; }
    .figure .caption::before{ content: "그림 " counter(figureCounter) ". "; font-weight:600; color:#374151; }
    .caption{ font-size: .875rem; color: var(--sub); margin-top: .35rem; }
    
    /* 표 톤(연회색 헤더 + 얇은 보더) */
    .tablewrap table{ width:100%; font-size: .95rem; border-collapse: collapse; }
    .tablewrap thead th{
      background:#f9fafb; color:#6b7280; text-align:left; padding:.5rem .75rem; border-bottom:1px solid var(--line);
    }
    .tablewrap tbody td{ padding:.5rem .75rem; border-top:1px solid var(--line); }
    
    /* 헤더/푸터: 과장 없이 얇게 */
    .site-header, .site-footer{ background:#fff; border-color: var(--line); }
    
    /* 인쇄 최적화 */
    @page{ size: A4; margin: 16mm 14mm; }
    @media print{
      body{ background:#fff !important }
      .site-header, .site-footer{ position: static !important; box-shadow:none !important; }
      .section{ break-inside: avoid; }
    }
  </style>
</head>
<body class="min-h-screen bg-[var(--bg)]">
  <!-- 헤더 -->
  <header class="site-header border-b">
    <div class="mx-auto max-w-5xl px-6 py-6">
      <h1 class="text-2xl font-extrabold tracking-tight text-gray-900">${report.title}</h1>
    </div>
  </header>

  <!-- 메인 콘텐츠 -->
  <main class="report mx-auto max-w-5xl px-6 py-8 space-y-8">
    <!-- 목차 영역 -->
    <div class="toc-area" style="background: linear-gradient(to right, #f8fafc, #f1f5f9); border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
        <div style="width: 8px; height: 8px; background-color: #64748b; border-radius: 50%;"></div>
        <h2 style="font-size: 18px; font-weight: 600; color: #374151;">📚 목차</h2>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px;">
        ${safeSections.map((section, index) => {
          const tocItem = report.toc[index];
          const sectionTitle = tocItem ? tocItem.title : (section.title && section.title.trim() ? section.title : `섹션 ${index + 1}`);
          return `
            <div style="background: white; padding: 12px 16px; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 12px; transition: all 0.2s;">
              <span style="width: 28px; height: 28px; background: #dbeafe; color: #1e40af; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem;">${index + 1}</span>
              <span style="color: #374151; font-weight: 500; font-size: 0.95rem;">${sectionTitle}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- 독립적인 요약 영역 -->
    <div class="summary-area" style="background: linear-gradient(to right, #eff6ff, #e0e7ff); border: 1px solid #bfdbfe; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
        <div style="width: 8px; height: 8px; background-color: #3b82f6; border-radius: 50%;"></div>
        <h2 style="font-size: 18px; font-weight: 600; color: #1e40af;">📋 전체 요약</h2>
      </div>
      <div style="color: #1e40af; line-height: 1.6;">
        <p>${report.summary}</p>
      </div>
    </div>

    <!-- 본문 섹션들 -->
    ${safeSections.map((section, index) => {
      const tocItem = report.toc[index];
      const sectionTitle = tocItem ? tocItem.title : (section.title && section.title.trim() ? section.title : `섹션 ${index + 1}`);
      const cleanTitle = sectionTitle.replace(/^\d+\.\s*/, '');
      
      // HTML 내용을 처리하여 표와 차트에 자동으로 클래스 추가
      const processedContent = processHTMLContent(section.safe);
      
      return `
        <section class="section">
          <h2 class="sec-title">${cleanTitle}</h2>
          <div class="content">
            ${processedContent}
          </div>
        </section>
      `;
    }).join('')}

    <!-- Sources 섹션 (출처가 있을 때만 표시) -->
    ${report.sources.length > 0 ? `
      <section class="section">
        <h2 class="sec-title">참고문헌</h2>
        <div class="content">
          <ol>
            ${report.sources.map((src, index) => `
              <li>
                <a href="${src.url}" target="_blank" rel="noopener noreferrer">
                  ${src.title}
                </a>
                ${src.publisher ? `<span class="ml-2">— ${src.publisher}</span>` : ''}
              </li>
            `).join('')}
          </ol>
        </div>
      </section>
    ` : ''}
  </main>

  <!-- 푸터 -->
  <footer class="site-footer border-t">
    <div class="mx-auto max-w-5xl px-6 py-3 text-[13px] text-[var(--sub)] flex justify-between">
      <span>Corporate Gray</span>
      <span>v1.0</span>
    </div>
  </footer>
</body>
</html>`;
    
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.title.replace(/[^a-zA-Z0-9가-힣]/g, '-')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportWord = async () => {
    try {
      const { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType, WidthType, Table, TableRow, TableCell, BorderStyle } = await import('docx');
      
      // HTML에서 표를 제외한 순수 텍스트만 추출
        const extractTextFromHTML = (html: string) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // 표 요소들을 모두 제거
    const tables = tempDiv.querySelectorAll('table');
    tables.forEach(table => table.remove());

    // 차트 요소들도 제거 (막대 차트, 선 차트 등)
    const charts = tempDiv.querySelectorAll('.bar-chart, .line-chart, .pie-chart');
    charts.forEach(chart => chart.remove());

    // 중복 제거를 위해 Set 사용
    const processedElements = new Set();
    let text = '';
    
    // 모든 텍스트 노드를 수집
    const textNodes: string[] = [];
    
    // 재귀적으로 텍스트 추출 (중복 방지)
    function extractTextRecursive(element: Element) {
      // 이미 처리된 요소는 건너뛰기
      if (processedElements.has(element)) {
        return;
      }
      processedElements.add(element);
      
      // 자식 노드들을 순회
      for (let i = 0; i < element.childNodes.length; i++) {
        const child = element.childNodes[i];
        
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent?.trim();
          if (text) {
            textNodes.push(text);
          }
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const childElement = child as Element;
          
                     // 불릿 포인트 처리 - <li> 태그만 정확히 처리
           if (childElement.tagName === 'LI') {
             // <li> 태그 안의 모든 텍스트를 추출 (중첩 태그 제거)
             let liText = '';
             const liWalker = document.createTreeWalker(
               childElement,
               NodeFilter.SHOW_TEXT,
               {
                 acceptNode: function(node) {
                   return NodeFilter.FILTER_ACCEPT;
                 }
               }
             );
             
             let liNode;
             while (liNode = liWalker.nextNode()) {
               const text = liNode.textContent?.trim();
               if (text) {
                 liText += text + ' ';
               }
             }
             
             if (liText.trim()) {
               textNodes.push('•' + liText.trim());
             }
           }
          // 제목 처리
          else if (childElement.tagName.match(/^H[1-6]$/)) {
            // 소제목 마커를 남겨서 Word 내 스타일을 구분 처리
            textNodes.push('\n§§HEAD§§' + (childElement.textContent?.trim() || '') + '\n');
          }
          // 단락 처리
          else if (childElement.tagName === 'P') {
            textNodes.push(childElement.textContent?.trim() + '\n');
          }
          // 강조 처리
          else if (childElement.tagName === 'STRONG' || childElement.tagName === 'B') {
            textNodes.push('**' + childElement.textContent?.trim() + '**');
          }
          // 다른 요소는 재귀적으로 처리
          else {
            extractTextRecursive(childElement);
          }
        }
      }
    }
    
    // 루트부터 시작
    extractTextRecursive(tempDiv);
    
    // 중복 제거하고 텍스트 결합
    const uniqueTexts = [...new Set(textNodes)];
    return uniqueTexts.join('\n');
  };
      
      // 표 데이터 추출 함수
      const extractTableData = (html: string) => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const table = tempDiv.querySelector('table');
        if (!table) return null;
        
        const rows = Array.from(table.querySelectorAll('tr'));
        return rows.map(row => 
          Array.from(row.querySelectorAll('th, td')).map(cell => cell.textContent || '')
        );
      };
      
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            // 제목 (중앙 정렬, 굵은 글씨)
            new Paragraph({
              children: [new TextRun({ text: report.title, bold: true, size: 36 })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 600 }
            }),
            
            // 목차 추가 (제목 다음, 요약 전)
            new Paragraph({
              children: [new TextRun({ text: "목차", bold: true, size: 28, color: "111827" })],
              spacing: { before: 400, after: 300 },
              alignment: AlignmentType.CENTER,
              border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "e5e7eb" } }
            }),
            // 각 섹션별 목차 (실제 섹션 제목 사용)
            ...safeSections.map((section, index) => {
              const tocItem = report.toc[index];
              const sectionTitle = tocItem ? tocItem.title : (section.title && section.title.trim() ? section.title : `섹션 ${index + 1}`);
              return new Paragraph({
                children: [new TextRun({ text: `${index + 1}. ${sectionTitle}`, size: 18, color: "374151" })],
                spacing: { after: 100 }
              });
            }),
            
            // 독립적인 요약 영역
            new Paragraph({
              children: [new TextRun({ text: "📋 전체 요약", bold: true, size: 24, color: "1e40af" })],
              spacing: { before: 400, after: 200 },
              border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "3b82f6" } }
            }),
            new Paragraph({
              children: [new TextRun({ text: report.summary, size: 20, color: "1e40af" })],
              spacing: { after: 400 }
            }),
            
            // 섹션들
            ...safeSections.map((section, index) => {
              const tocItem = report.toc[index];
              const sectionTitle = tocItem ? tocItem.title : (section.title && section.title.trim() ? section.title : `섹션 ${index + 1}`);
              const cleanTitle = sectionTitle.replace(/^\d+\.\s*/, '');
              
              // HTML 태그 제거하고 순수 텍스트만 사용
              const cleanText = extractTextFromHTML(section.safe);
              
              // 표가 있는지 확인
              const tableData = extractTableData(section.safe);
              
              const elements = [
                // 섹션 제목 (굵은 글씨, 하단 경계선 느낌)
                new Paragraph({
                  children: [new TextRun({ text: `${index + 1}. ${cleanTitle}`, bold: true, size: 24, color: "111827" })],
                  spacing: { before: 400, after: 200 },
                  border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "e5e7eb" } }
                })
              ];
              
              // 항상 텍스트 내용을 먼저 추가 (구조화된 형식 처리)
              if (cleanText.trim()) {
                // 텍스트를 줄 단위로 분리하여 불릿 포인트와 구조 처리
                const lines = cleanText.split('\n').filter(line => line.trim());
                
                lines.forEach(line => {
                  const trimmedLine = line.trim();
                  
                  // 소제목 마커 처리 → 굵게 + 12pt
                  if (trimmedLine.startsWith('§§HEAD§§')) {
                    const headText = trimmedLine.replace('§§HEAD§§', '').trim();
                    elements.push(
                      new Paragraph({
                        children: [new TextRun({ text: headText, bold: true, size: 24, color: "111827" })],
                        spacing: { before: 300, after: 150 }
                      })
                    );
                    return;
                  }

                  // 불릿 포인트인지 확인 (더 정확한 패턴 매칭)
                  if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-') || trimmedLine.startsWith('*') || 
                      trimmedLine.startsWith('○') || trimmedLine.startsWith('●') || trimmedLine.startsWith('▪') ||
                      trimmedLine.match(/^\s*[•\-*○●▪]\s*/)) {
                    
                    // 불릿 포인트 - 실제 글머리 기호 사용
                    let bulletChar = '•';
                    let content = trimmedLine;
                    
                    // 다양한 불릿 기호 처리
                    if (trimmedLine.startsWith('•')) {
                      bulletChar = '•';
                      content = trimmedLine.substring(1).trim();
                    } else if (trimmedLine.startsWith('-')) {
                      bulletChar = '•';
                      content = trimmedLine.substring(1).trim();
                    } else if (trimmedLine.startsWith('*')) {
                      bulletChar = '•';
                      content = trimmedLine.substring(1).trim();
                    } else if (trimmedLine.startsWith('○')) {
                      bulletChar = '○';
                      content = trimmedLine.substring(1).trim();
                    } else if (trimmedLine.startsWith('●')) {
                      bulletChar = '●';
                      content = trimmedLine.substring(1).trim();
                    } else if (trimmedLine.startsWith('▪')) {
                      bulletChar = '▪';
                      content = trimmedLine.substring(1).trim();
                    } else {
                      // 패턴 매칭으로 찾은 경우
                      const match = trimmedLine.match(/^\s*([•\-*○●▪])\s*(.*)/);
                      if (match) {
                        bulletChar = '•'; // 통일된 글머리 기호 사용
                        content = match[2].trim();
                      }
                    }
                    
                    elements.push(
                      new Paragraph({
                        children: [
                          new TextRun({ text: bulletChar, size: 20, color: "111827" }),
                          new TextRun({ text: content, size: 20, color: "111827" })
                        ],
                        spacing: { after: 200 }
                        // 들여쓰기 제거 - 왼쪽 끝에 붙어서 표시
                      })
                    );
                  } else if (trimmedLine.match(/^\d+\./)) {
                    // 번호 매기기 리스트
                    elements.push(
                      new Paragraph({
                        children: [
                          new TextRun({ text: trimmedLine, size: 20, color: "111827" })
                        ],
                        spacing: { after: 200 }
                        // 들여쓰기 제거 - 왼쪽 끝에 붙어서 표시
                      })
                    );
                  } else if (/^([A-Za-z가-힣][^:\n]{0,20}):$/.test(trimmedLine)) {
                    // 짧은 라벨형 소제목만 굵게/12pt (라인 전체가 콜론으로 끝나야 함)
                    elements.push(
                      new Paragraph({
                        children: [new TextRun({ text: trimmedLine, bold: true, size: 24, color: "111827" })],
                        spacing: { before: 300, after: 150 }
                      })
                    );
                  } else if (trimmedLine.startsWith('✅') || trimmedLine.startsWith('❌')) {
                    // 체크마크나 X 마크
                    elements.push(
                      new Paragraph({
                        children: [
                          new TextRun({ text: trimmedLine, size: 20, color: "111827" })
                        ],
                        spacing: { after: 200 }
                      })
                    );
                  } else if (trimmedLine.includes('📋') || trimmedLine.includes('📊') || trimmedLine.includes('💡')) {
                    // 요약 박스나 특별한 섹션 (이모지가 포함된 경우)
                    elements.push(
                      new Paragraph({
                        children: [
                          new TextRun({ text: trimmedLine, size: 22, bold: true, color: "111827" })
                        ],
                        spacing: { before: 400, after: 200 },
                        border: undefined,
                        shading: { fill: "f8fafc" } // 연한 회색 배경
                      })
                    );
                  } else if (trimmedLine.match(/^\[.*\]$/)) {
                    // 대괄호로 둘러싸인 카테고리 (예: [기회 요인], [주의사항])
                    elements.push(
                      new Paragraph({
                        children: [
                          new TextRun({ text: trimmedLine, size: 20, bold: true, color: "111827" })
                        ],
                        spacing: { before: 300, after: 200 },
                        alignment: AlignmentType.CENTER
                      })
                    );
                  } else {
                    // 일반 텍스트
                    elements.push(
                      new Paragraph({
                        children: [new TextRun({ text: trimmedLine, size: 20, color: "111827" })],
                        spacing: { after: 300 }
                      })
                    );
                  }
                });
              }
              
                      // 표가 있으면 표도 추가
        if (tableData && tableData.length > 0) {
          const tableRows = tableData.map((row, rowIndex) => {
            const cells = row.map((cell, cellIndex) => {
              const isHeader = rowIndex === 0;
              return new TableCell({
                children: [new Paragraph({
                  children: [new TextRun({ 
                    text: cell, 
                    bold: isHeader, 
                    size: isHeader ? 20 : 18,
                    color: isHeader ? "6b7280" : "111827"
                  })],
                  alignment: AlignmentType.CENTER // 가운데 맞춤
                })],
                width: { size: 100 / row.length, type: WidthType.PERCENTAGE },
                shading: isHeader ? { fill: "f9fafb" } : undefined,
                margins: { top: 100, bottom: 100, left: 100, right: 100 } // 셀 여백 추가
              });
            });
            return new TableRow({ children: cells });
          });
          
          elements.push(
            new Table({
              rows: tableRows,
              width: { size: 100, type: WidthType.PERCENTAGE },
              margins: { top: 200, bottom: 200, left: 200, right: 200 } // 표 전체 여백
            }) as any,
            new Paragraph({
              children: [new TextRun({ text: `표 ${index + 1}. ${cleanTitle}`, size: 16, color: "6b7280" })],
              spacing: { before: 200, after: 200 },
              alignment: AlignmentType.CENTER // 표 캡션도 가운데 맞춤
            })
          );
        }
        
        return elements;
      }).flat(),
      
      // 참고문헌 (출처가 있을 때만)
      ...(report.sources.length > 0 ? [
        new Paragraph({
          children: [new TextRun({ text: `${safeSections.length + 2}. 참고문헌`, bold: true, size: 24, color: "1f3a93" })],
          spacing: { before: 400, after: 200 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "e5e7eb" } }
        }),
        ...report.sources.map((src, index) => 
          new Paragraph({
            children: [new TextRun({ text: `${index + 1}. ${src.title}`, size: 20 })],
            spacing: { after: 200 }
          })
        )
      ] : [])
    ]
  }]
});
      
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.title.replace(/[^a-zA-Z0-9가-힣]/g, '-')}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Word 문서 생성 실패:', error);
      alert('Word 문서 생성에 실패했습니다.');
    }
  };

  return (
    <div>
      {/* Export 버튼: 보고서 생성 완료 후에만 표시 */}
      {isComplete ? (
        <div className="flex items-center gap-2 mb-6 p-4 bg-gray-50 rounded-lg">
          <span className="text-sm font-medium text-gray-700 mr-2">다운로드:</span>
          <button onClick={exportHTML} className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-white hover:border-gray-400 inline-flex items-center gap-1 transition-colors">
            <Download className="w-4 h-4"/> HTML
          </button>
          <button onClick={exportWord} className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-white hover:border-gray-400 inline-flex items-center gap-1 transition-colors">
            <FileDown className="w-4 h-4"/> Word
          </button>
        </div>
      ) : (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg text-sm">
          레포트 생성 중입니다. 생성이 완료되면 다운로드 버튼이 나타납니다.
        </div>
      )}

      {/* 레포트 컨테이너 */}
      <div ref={containerRef} className="min-h-screen bg-[var(--bg)]">
        {/* 헤더 */}
        <header className="site-header border-b">
          <div className="mx-auto max-w-5xl px-6 py-6">
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">{report.title}</h1>
          </div>
        </header>

        {/* 메인 콘텐츠 */}
        <main className="report mx-auto max-w-5xl px-6 py-8 space-y-8">
                  {/* 목차 영역 */}
        <div className="toc-area bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
            <h2 className="text-lg font-semibold text-gray-900">📚 목차</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {safeSections.map((section, index) => {
              const tocItem = report.toc[index];
              const sectionTitle = tocItem ? tocItem.title : (section.title && section.title.trim() ? section.title : `섹션 ${index + 1}`);
              return (
                <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100 hover:border-gray-300 transition-colors">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </span>
                  <span className="text-gray-700 font-medium">{sectionTitle}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 독립적인 요약 영역 */}
        <div className="summary-area bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <h2 className="text-lg font-semibold text-blue-900">📋 전체 요약</h2>
          </div>
          <div className="text-blue-800 leading-relaxed">
            <p>{report.summary}</p>
          </div>
        </div>

          {/* 본문 섹션들 */}
          {safeSections.map((s, index) => {
            const tocItem = report.toc[index];
            const sectionTitle = tocItem ? tocItem.title : (s.title && s.title.trim() ? s.title : `섹션 ${index + 1}`);
            const cleanTitle = sectionTitle.replace(/^\d+\.\s*/, '');
            
            return (
              <section key={`section-${s.id || index}`} className="section">
                <h2 className="sec-title">{cleanTitle}</h2>
                <div className="content content-body" dangerouslySetInnerHTML={{ __html: processHTMLContent(s.safe) }} />
              </section>
            );
          })}

          {/* Sources 섹션 (출처가 있을 때만 표시) */}
          {report.sources.length > 0 && (
            <section className="section">
              <h2 className="sec-title">참고문헌</h2>
              <div className="content">
                <ol>
                  {report.sources.map((src, index) => (
                    <li key={src.id}>
                      <a href={src.url} target="_blank" rel="noopener noreferrer">
                        {src.title}
                      </a>
                      {src.publisher && <span className="ml-2">— {src.publisher}</span>}
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          )}
        </main>


      </div>
    </div>
  );
}