const { execSync } = require('child_process');

// 충돌이 발생한 파일 목록 (git status에서 확인한 파일들)
const conflictFiles = [
  'scripts/check-admin.js',
  'scripts/check-local-db.js',
  'scripts/debug-usage.js',
  'scripts/fix-admin-role.js',
  'scripts/fix-image-limits.js',
  'scripts/make-admin.js',
  'src/app/admin/page.tsx',
  'src/app/ai-list/page.tsx',
  'src/app/ai-tool/[id]/page.tsx',
  'src/app/api/admin/update-plan/route.ts',
  'src/app/api/admin/usage/route.ts',
  'src/app/api/admin/users/route.ts',
  'src/app/api/ai-chat/route.ts',
  'src/app/api/ai-services/route.ts',
  'src/app/api/ai-summary/route.ts',
  'src/app/api/auth/signup/route.ts',
  'src/app/api/code-generate/route.ts',
  'src/app/api/debug/create-admin/route.ts',
  'src/app/api/debug/make-admin/route.ts',
  'src/app/api/debug/migrate/route.ts',
  'src/app/api/debug/set-plan/route.ts',
  'src/app/api/image-generate/route.ts',
  'src/app/api/interview-prep/evaluate-answer/route.ts',
  'src/app/api/interview-prep/generate-questions/route.ts',
  'src/app/api/lecture-notes/summarize/route.ts',
  'src/app/api/lecture-notes/transcribe/route.ts',
  'src/app/api/migrate/route.ts',
  'src/app/api/profile/update/route.ts',
  'src/app/api/reviews/[toolId]/[reviewId]/route.ts',
  'src/app/api/reviews/[toolId]/route.ts',
  'src/app/api/video-generate/route.ts',
  'src/app/community/page.tsx',
  'src/app/components/Header.tsx',
  'src/app/image-create/page.tsx',
  'src/app/layout.tsx',
  'src/app/page.tsx',
  'src/app/productivity/ai-summary/page.tsx',
  'src/app/productivity/blog-writer/page.tsx',
  'src/app/productivity/code-generate/page.tsx',
  'src/app/productivity/code-review/page.tsx',
  'src/app/productivity/cover-letter/page.tsx',
  'src/app/productivity/email-assistant/page.tsx',
  'src/app/productivity/interview-prep/page.tsx',
  'src/app/productivity/lecture-notes/page.tsx',
  'src/app/productivity/page.tsx',
  'src/app/productivity/report-writer/page.tsx',
  'src/app/providers.tsx',
  'src/app/settings/page.tsx',
  'src/app/usage/page.tsx',
  'src/app/video-create/page.tsx',
  'src/lib/auth.ts',
  'src/lib/authOptions.ts',
  'src/lib/client-utils.ts'
];

console.log('충돌 해결을 시작합니다...');

conflictFiles.forEach(file => {
  try {
    execSync(`git checkout --ours "${file}"`, { stdio: 'inherit' });
    console.log(`✓ ${file} 해결됨`);
  } catch (error) {
    console.log(`✗ ${file} 해결 실패: ${error.message}`);
  }
});

console.log('충돌 해결이 완료되었습니다.'); 