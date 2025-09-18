// 자막 추출 경로 제거: oEmbed만 사용

// Whisper/ytdl 제거: 파일/디스크 작업과 오디오 STT는 지원하지 않음

// YouTube Video ID 추출
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

// YouTube Data API를 사용한 대체 방법
export async function getYouTubeInfoWithAPI(videoId: string): Promise<any> {
  try {
    // API 키 미사용: oEmbed로 최소 정보만 획득
    const oembed = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`);
    if (oembed.ok) {
      const data = await oembed.json();
      return {
        snippet: {
          title: data.title,
          channelTitle: data.author_name,
          description: ''
        },
        contentDetails: { duration: '' },
        statistics: {}
      };
    }
  } catch (e) {
    console.log('❌ oEmbed 실패:', e instanceof Error ? e.message : String(e));
  }
  return null;
}

// Whisper를 사용한 STT 기능 (서버리스 안전모드: 기본 비활성화, 환경변수 ENABLE_WHISPER_STT=true 일 때만 동작)
// Whisper/ytdl 관련 기능 제거됨

// YouTube 콘텐츠 추출 함수 개선
export async function extractYouTubeContent(url: string): Promise<string> {
  try {
    console.log('🎬 YouTube 콘텐츠 추출 시작:', url);
    
    const videoId = extractVideoId(url);
    if (!videoId) {
      throw new Error('유효한 YouTube URL이 아닙니다.');
    }
    
    console.log('📹 Video ID 추출:', videoId);
    
    // oEmbed 설명문만 사용
    let text = '';
    try {
      const apiInfo = await getYouTubeInfoWithAPI(videoId);
      if (apiInfo) {
        const title = apiInfo.snippet.title;
        const description = apiInfo.snippet.description || apiInfo.snippet.channelTitle || '';
        const shortDescription = description.length > 600 ? description.substring(0, 600) + '...' : description;
        text = `제목: ${title}\n\n설명: ${shortDescription}`;
        console.log('✅ oEmbed 설명문 사용');
      } else {
        throw new Error('YouTube oEmbed 응답 없음');
      }
    } catch (apiErr) {
      console.log('❌ oEmbed 실패:', apiErr);
      throw new Error('YouTube 영상에서 콘텐츠를 추출할 수 없습니다.');
    }
    const cleanedTranscript = cleanTranscript(text);
    console.log('🎉 YouTube 콘텐츠 추출 완료:', cleanedTranscript.length, '문자');
    console.log('🧾 추출 텍스트(앞 300자):', cleanedTranscript.substring(0, 300) + (cleanedTranscript.length > 300 ? '...' : ''));
    return cleanedTranscript;
    
  } catch (error) {
    console.error('❌ YouTube 콘텐츠 추출 실패:', error);
    
    // 구체적인 에러 메시지 제공
    if (error instanceof Error) {
      if (error.message.includes('자막')) {
        throw new Error('자막을 찾을 수 없습니다. 자막이 있는 영상을 사용하거나, 더 명확한 음성의 영상을 선택해주세요.');
      } else if (error.message.includes('음성')) {
        throw new Error('음성을 인식할 수 없습니다. 더 명확한 발음의 영상이나 자막이 있는 영상을 사용해주세요.');
      } else if (error.message.includes('네트워크')) {
        throw new Error('네트워크 연결을 확인해주세요. 잠시 후 다시 시도해주세요.');
      } else {
        throw new Error(`YouTube 콘텐츠 추출 실패: ${error.message}`);
      }
    }
    
    throw new Error('알 수 없는 오류가 발생했습니다. 다시 시도해주세요.');
  }
}

// 자막 정제 함수 추가
function cleanTranscript(transcript: string): string {
  console.log('🧹 자막 정제 시작:', transcript.length, '문자');
  
  let cleaned = transcript;
  
  // 1. 반복되는 단어 제거
  cleaned = cleaned.replace(/(\w+)(?:\s+\1){2,}/g, '$1');
  
  // 2. 의미 없는 패턴 제거
  cleaned = cleaned.replace(/\[음악\]|\[박수\]|\[웃음\]|\[비명\]/g, '');
  
  // 3. 연속된 공백 정리
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // 4. 문장 부호 정리
  cleaned = cleaned.replace(/\s+([,.!?])/g, '$1');
  
  // 5. 너무 짧은 문장 제거 (3글자 미만)
  cleaned = cleaned.split(/[.!?]/)
    .filter(sentence => sentence.trim().length >= 3)
    .join('. ');
  
  console.log('✅ 자막 정제 완료:', cleaned.length, '문자');
  return cleaned;
}

// HH:MM:SS 또는 MM:SS, SS.s 형식 등을 mm:ss 로 변환
// toMMSS 제거 (자막 경로 삭제)

// Puppeteer 기반 자막 추출 경로 제거됨