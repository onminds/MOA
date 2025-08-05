const fs = require('fs');
const path = require('path');

// 충돌 마커를 제거하는 함수
function removeConflictMarkers(content) {
  // <<<<<<< HEAD, =======, >>>>>>> 패턴 제거
  return content
    .replace(/<<<<<<< HEAD[\s\S]*?=======[\s\S]*?>>>>>>> [a-f0-9]+/g, '')
    .replace(/<<<<<<< HEAD[\s\S]*?>>>>>>> [a-f0-9]+/g, '')
    .replace(/=======[\s\S]*?>>>>>>> [a-f0-9]+/g, '')
    .replace(/<<<<<<< HEAD/g, '')
    .replace(/=======/g, '')
    .replace(/>>>>>>> [a-f0-9]+/g, '');
}

// Sidebar import 제거
function removeSidebarImport(content) {
  return content
    .replace(/import Sidebar from ['"]\.\.\/components\/Sidebar['"];?\n?/g, '')
    .replace(/<Sidebar[^>]*\/>/g, '')
    .replace(/<Sidebar[^>]*>[\s\S]*?<\/Sidebar>/g, '');
}

// 파일 처리 함수
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let newContent = removeConflictMarkers(content);
    newContent = removeSidebarImport(newContent);
    
    // 빈 줄 정리
    newContent = newContent.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`✅ 처리 완료: ${filePath}`);
  } catch (error) {
    console.error(`❌ 오류: ${filePath}`, error.message);
  }
}

// 충돌이 있는 파일들
const conflictFiles = [
  'src/app/ai-list/page.tsx',
  'src/app/ai-tool/[id]/page.tsx',
  'src/app/community/page.tsx',
  'src/app/image-create/page.tsx',
  'src/app/productivity/page.tsx',
  'src/app/productivity/ai-summary/page.tsx',
  'src/app/productivity/blog-writer/page.tsx',
  'src/app/productivity/cover-letter/page.tsx',
  'src/app/productivity/email-assistant/page.tsx',
  'src/app/productivity/report-writer/page.tsx',
  'src/app/settings/page.tsx',
  'src/app/usage/page.tsx',
  'src/lib/auth.ts',
  'src/lib/authOptions.ts',
  'tailwind.config.js'
];

console.log('🔧 Merge 충돌 해결 시작...');

conflictFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    processFile(filePath);
  } else {
    console.log(`⚠️ 파일 없음: ${file}`);
  }
});

console.log('✅ 모든 충돌 해결 완료!'); 