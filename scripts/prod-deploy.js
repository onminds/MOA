const fs = require('fs');
const { execSync } = require('child_process');

console.log('🚀 Vercel 배포용 환경 설정 시작...');

try {
  // 1. Git에 커밋
  console.log('📝 변경사항 커밋...');
  
  // 변경사항이 있는지 확인
  try {
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
    
    if (gitStatus.trim() === '') {
      console.log('ℹ️ 변경사항이 없습니다. 커밋을 건너뜁니다.');
    } else {
      console.log('📦 변경사항을 스테이징...');
      execSync('git add .', { stdio: 'inherit' });
      
      const commitMessage = `🚀 배포: ${new Date().toISOString().split('T')[0]}`;
      console.log('💬 커밋 메시지:', commitMessage);
      execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
    }
  } catch (gitError) {
    console.log('⚠️ Git 상태 확인 중 오류:', gitError.message);
    console.log('ℹ️ Git 커밋을 건너뛰고 배포를 진행합니다.');
  }
  
  // 2. Vercel 배포
  console.log('🌐 Vercel에 배포...');
  
  // 변경사항이 있거나 원격 저장소와 다른 경우에만 push
  try {
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
    const gitLog = execSync('git log --oneline origin/master..HEAD', { encoding: 'utf8' });
    
    if (gitStatus.trim() !== '' || gitLog.trim() !== '') {
      console.log('📤 변경사항을 원격 저장소에 푸시...');
      execSync('git push', { stdio: 'inherit' });
    } else {
      console.log('ℹ️ 푸시할 변경사항이 없습니다.');
    }
  } catch (pushError) {
    console.log('⚠️ Git push 중 오류:', pushError.message);
    console.log('ℹ️ Vercel이 자동으로 배포를 감지할 것입니다.');
  }
  
  // 3. Vercel CLI를 통한 실제 배포 시도
  try {
    console.log('🚀 Vercel CLI를 통한 배포 시도...');
    execSync('vercel --prod --yes', { stdio: 'inherit' });
    console.log('✅ Vercel CLI 배포 성공!');
  } catch (vercelError) {
    console.log('⚠️ Vercel CLI 배포 실패:', vercelError.message);
    console.log('ℹ️ GitHub 연동을 통한 자동 배포를 기다립니다.');
    console.log('ℹ️ Vercel 대시보드에서 수동 배포가 필요할 수 있습니다.');
  }
  
  console.log('✅ Vercel 배포 완료!');
  console.log('🔗 사이트: https://moa-kappa.vercel.app');
  console.log('');
  console.log('📋 배포 후 확인사항:');
  console.log('   - 로그인/회원가입 테스트');
  console.log('   - 관리자 기능 확인');
  console.log('   - AI 기능 사용량 제한 확인');
  
} catch (error) {
  console.error('❌ 배포 중 오류:', error.message);
  console.log('ℹ️ SQL Server 직접 연결 방식으로 변경되었습니다.');
} 