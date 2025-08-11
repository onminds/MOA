import ytdl from '@distube/ytdl-core';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { YoutubeTranscript } from 'youtube-transcript';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 파일 시스템 유틸리티
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const exists = promisify(fs.exists);

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
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      console.log('⚠️ YouTube API 키가 없습니다. 기본 정보만 제공합니다.');
      return null;
    }
    
    console.log('🔍 YouTube Data API로 영상 정보 가져오기...');
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet,contentDetails,statistics`
    );
    
    if (!response.ok) {
      throw new Error(`YouTube API 오류: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      const video = data.items[0];
      console.log('✅ YouTube Data API 성공');
      console.log('📄 영상 제목:', video.snippet.title);
      console.log('📄 채널명:', video.snippet.channelTitle);
      console.log('📄 영상 길이:', video.contentDetails.duration);
      
      return video;
    } else {
      throw new Error('영상을 찾을 수 없습니다.');
    }
  } catch (error) {
    console.log('❌ YouTube Data API 실패:', error instanceof Error ? error.message : '알 수 없는 오류');
    return null;
  }
}

// Whisper를 사용한 STT 기능
export async function extractAudioWithWhisper(videoId: string): Promise<string> {
  try {
    console.log('🎵 Whisper STT 시작:', videoId);
    
    // 임시 파일 경로 설정
    const tempDir = path.join(process.cwd(), 'temp');
    const audioFilePath = path.join(tempDir, `${videoId}.mp3`);
    
    // temp 디렉토리가 없으면 생성
    if (!await exists(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // YouTube URL 생성
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    console.log('🔗 YouTube URL:', youtubeUrl);
    
    // YouTube 영상 정보 먼저 확인
    try {
      console.log('📊 YouTube 영상 정보 확인 중...');
      const info = await ytdl.getInfo(youtubeUrl);
      console.log('✅ YouTube 영상 정보 가져오기 성공');
      console.log('📄 영상 제목:', info.videoDetails.title);
      console.log('📄 영상 길이:', info.videoDetails.lengthSeconds, '초');
      console.log('📄 사용 가능한 형식:', info.formats.length, '개');
      
      // 오디오 형식 확인
      const audioFormats = info.formats.filter(format => format.hasAudio && !format.hasVideo);
      console.log('🎵 오디오 전용 형식:', audioFormats.length, '개');
      
      if (audioFormats.length === 0) {
        console.log('⚠️ 오디오 전용 형식이 없습니다. 비디오+오디오 형식 사용');
      }
      
    } catch (infoError) {
      console.log('❌ YouTube 영상 정보 가져오기 실패:', infoError instanceof Error ? infoError.message : '알 수 없는 오류');
      console.log('🔍 상세 오류 정보:', infoError);
      
      // YouTube Data API로 대체 시도
      console.log('🔄 YouTube Data API로 대체 시도...');
      const apiInfo = await getYouTubeInfoWithAPI(videoId);
      if (apiInfo) {
        console.log('✅ YouTube Data API로 영상 정보 확인 완료');
      }
    }
    
    console.log('📥 YouTube 오디오 다운로드 시작...');
    
    // ytdl을 사용하여 오디오 스트림 생성 (더 안전한 옵션)
    const audioStream = ytdl(youtubeUrl, {
      quality: 'highestaudio',
      filter: 'audioonly',
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      }
    });
    
    console.log('✅ 오디오 스트림 생성 성공');
    
    // 오디오 파일로 저장
    const writeStream = fs.createWriteStream(audioFilePath);
    
    return new Promise((resolve, reject) => {
      let downloadProgress = 0;
      let lastProgress = 0;
      
      audioStream.on('progress', (chunkLength, downloaded, total) => {
        const progress = (downloaded / total) * 100;
        if (progress - lastProgress >= 10) {
          console.log(`📥 다운로드 진행률: ${progress.toFixed(1)}%`);
          lastProgress = progress;
        }
        downloadProgress = progress;
      });
      
      audioStream.pipe(writeStream);
      
      audioStream.on('end', async () => {
        try {
          console.log('✅ 오디오 다운로드 완료:', audioFilePath);
          console.log('📊 최종 다운로드 진행률:', downloadProgress.toFixed(1), '%');
          
          // 파일 크기 확인
          const stats = fs.statSync(audioFilePath);
          console.log('📊 오디오 파일 크기:', stats.size, 'bytes');
          
          if (stats.size < 1000) {
            throw new Error('오디오 파일이 너무 작습니다. 다운로드에 실패했을 수 있습니다.');
          }
          
          // Whisper API로 음성 인식
          console.log('🎤 Whisper API로 음성 인식 시작...');
          
          const audioFile = fs.createReadStream(audioFilePath);
          
          const transcription = await openai.audio.transcriptions.create({
            file: audioFile,
            model: "whisper-1",
            language: "ko", // 한국어로 설정
            response_format: "text",
            temperature: 0.3,
          });
          
          console.log('✅ Whisper STT 완료:', transcription.length, '문자');
          
          // 임시 파일 삭제
          try {
            await unlink(audioFilePath);
            console.log('🗑️ 임시 오디오 파일 삭제 완료');
          } catch (deleteError) {
            console.log('⚠️ 임시 파일 삭제 실패:', deleteError);
          }
          
          resolve(transcription);
          
        } catch (error) {
          console.error('❌ Whisper STT 실패:', error);
          
          // 임시 파일 삭제 시도
          try {
            if (await exists(audioFilePath)) {
              await unlink(audioFilePath);
            }
          } catch (deleteError) {
            console.log('⚠️ 임시 파일 삭제 실패:', deleteError);
          }
          
          reject(error);
        }
      });
      
      audioStream.on('error', async (error) => {
        console.error('❌ 오디오 다운로드 실패:', error);
        console.error('🔍 오류 타입:', error.constructor.name);
        console.error('🔍 오류 메시지:', error.message);
        console.error('🔍 오류 스택:', error.stack);
        
        // 추가 디버깅 정보
        if (error.message.includes('Could not extract functions')) {
          console.error('⚠️ YouTube 보안 정책 변경으로 인한 오류일 수 있습니다.');
          console.error('💡 해결 방안: ytdl-core 업데이트 또는 대체 방법 사용');
          
          // 대체 방법 시도: 다른 옵션으로 재시도
          try {
            console.log('🔄 대체 방법 시도: 다른 옵션으로 재시도...');
            const alternativeStream = ytdl(youtubeUrl, {
              quality: 'lowestaudio',
              filter: 'audioonly',
              requestOptions: {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
              }
            });
            
            const alternativeWriteStream = fs.createWriteStream(audioFilePath);
            alternativeStream.pipe(alternativeWriteStream);
            
            alternativeStream.on('end', async () => {
              try {
                const stats = fs.statSync(audioFilePath);
                if (stats.size > 1000) {
                  console.log('✅ 대체 방법 성공');
                  const audioFile = fs.createReadStream(audioFilePath);
                  const transcription = await openai.audio.transcriptions.create({
                    file: audioFile,
                    model: "whisper-1",
                    language: "ko",
                    response_format: "text",
                    temperature: 0.3,
                  });
                  
                  await unlink(audioFilePath);
                  resolve(transcription);
                } else {
                  reject(new Error('대체 방법도 실패했습니다.'));
                }
              } catch (alternativeError) {
                reject(alternativeError);
              }
            });
            
            alternativeStream.on('error', (alternativeError) => {
              console.error('❌ 대체 방법도 실패:', alternativeError);
              reject(error); // 원래 오류 반환
            });
            
          } catch (alternativeError) {
            console.error('❌ 대체 방법 시도 실패:', alternativeError);
            reject(error);
          }
        } else {
          reject(error);
        }
      });
      
      writeStream.on('error', (error) => {
        console.error('❌ 파일 쓰기 실패:', error);
        console.error('🔍 오류 타입:', error.constructor.name);
        console.error('🔍 오류 메시지:', error.message);
        reject(error);
      });
    });
    
  } catch (error) {
    console.error('❌ Whisper STT 전체 실패:', error);
    console.error('🔍 오류 타입:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('🔍 오류 메시지:', error instanceof Error ? error.message : String(error));
    console.error('🔍 오류 스택:', error instanceof Error ? error.stack : '스택 정보 없음');
    
    // ytdl-core가 완전히 실파한 경우, 영상 정보만 제공
    if (error instanceof Error && error.message.includes('Could not extract functions')) {
      console.log('⚠️ ytdl-core가 YouTube 보안 정책으로 인해 작동하지 않습니다.');
      console.log('💡 영상 정보만 제공하는 대체 방법을 시도합니다.');
      
      try {
        const apiInfo = await getYouTubeInfoWithAPI(videoId);
        if (apiInfo) {
          const title = apiInfo.snippet.title;
          const channelTitle = apiInfo.snippet.channelTitle;
          const description = apiInfo.snippet.description;
          
          // 설명에서 일부 텍스트 추출 (간단한 요약용)
          const shortDescription = description.length > 200 ? description.substring(0, 200) + '...' : description;
          
          return `YouTube 영상 정보 (API):\n\n제목: ${title}\n채널: ${channelTitle}\n\n설명: ${shortDescription}\n\n오디오 다운로드가 불가능하여 영상 정보만 제공됩니다.`;
        }
      } catch (apiError) {
        console.log('❌ YouTube Data API도 실패:', apiError);
      }
    }
    
    throw new Error('Whisper STT 처리 중 오류가 발생했습니다.');
  }
}

// 스마트 샘플링을 위한 오디오 추출 함수
export async function extractAudioWithWhisperSampling(videoId: string): Promise<string> {
  try {
    console.log('🎵 Whisper STT 스마트 샘플링 시작:', videoId);
    
    // 임시 파일 경로 설정
    const tempDir = path.join(process.cwd(), 'temp');
    const audioFilePath = path.join(tempDir, `${videoId}.mp3`);
    
    // temp 디렉토리가 없으면 생성
    if (!await exists(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // YouTube URL 생성
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    console.log('🔗 YouTube URL:', youtubeUrl);
    
    // YouTube 영상 정보 먼저 확인
    let videoDuration = 0;
    try {
      console.log('📊 YouTube 영상 정보 확인 중...');
      const info = await ytdl.getInfo(youtubeUrl);
      console.log('✅ YouTube 영상 정보 가져오기 성공');
      console.log('📄 영상 제목:', info.videoDetails.title);
      console.log('📄 영상 길이:', info.videoDetails.lengthSeconds, '초');
      videoDuration = parseInt(info.videoDetails.lengthSeconds);
      
      // 영상이 10분 이상이면 샘플링 적용
      if (videoDuration > 600) {
        console.log('⏱️ 긴 영상 감지, 스마트 샘플링 적용');
        try {
          return await extractAudioWithSampling(youtubeUrl, videoDuration);
        } catch (samplingError) {
          console.log('❌ 스마트 샘플링 실패, 전체 오디오로 폴백:', samplingError);
          console.log('🔄 전체 오디오 처리로 전환...');
          // 샘플링 실패 시 전체 오디오로 폴백
          return await extractAudioWithWhisper(videoId);
        }
      } else {
        console.log('⏱️ 짧은 영상, 전체 오디오 처리');
      }
      
    } catch (infoError) {
      console.log('❌ YouTube 영상 정보 가져오기 실패:', infoError instanceof Error ? infoError.message : '알 수 없는 오류');
      console.log('🔄 전체 오디오 처리로 전환...');
    }
    
    // 기존 방식으로 전체 오디오 처리
    return await extractAudioWithWhisper(videoId);
    
  } catch (error) {
    console.error('❌ Whisper STT 스마트 샘플링 실패:', error);
    throw new Error('Whisper STT 처리 중 오류가 발생했습니다.');
  }
}

// 샘플링 기반 오디오 추출
async function extractAudioWithSampling(youtubeUrl: string, duration: number): Promise<string> {
  try {
    console.log('📊 스마트 샘플링 시작 (영상 길이:', duration, '초)');
    
    // 샘플링 구간 설정 (전체의 20%만 추출)
    const sampleSegments = [
      { start: 0, end: Math.min(60, duration * 0.1) }, // 시작 부분
      { start: Math.floor(duration * 0.25) - 30, end: Math.floor(duration * 0.25) + 30 }, // 25% 지점
      { start: Math.floor(duration * 0.5) - 30, end: Math.floor(duration * 0.5) + 30 }, // 50% 지점
      { start: Math.floor(duration * 0.75) - 30, end: Math.floor(duration * 0.75) + 30 }, // 75% 지점
      { start: Math.max(duration - 60, duration * 0.9), end: duration } // 끝 부분
    ];
    
    console.log('📊 샘플링 구간:', sampleSegments);
    
    let allTranscripts = '';
    let successCount = 0;
    
    for (let i = 0; i < sampleSegments.length; i++) {
      const segment = sampleSegments[i];
      try {
        console.log(`📝 구간 ${i + 1} 처리: ${segment.start}초 ~ ${segment.end}초`);
        
        // 각 구간별로 오디오 추출
        const segmentAudio = await extractAudioSegment(youtubeUrl, segment.start, segment.end);
        
        if (segmentAudio) {
          // Whisper API로 음성 인식
          const transcription = await openai.audio.transcriptions.create({
            file: segmentAudio,
            model: "whisper-1",
            language: "ko",
            response_format: "text",
            temperature: 0.3,
          });
          
          console.log(`✅ 구간 ${i + 1} STT 완료:`, transcription.length, '문자');
          allTranscripts += `[구간 ${i + 1}: ${segment.start}초~${segment.end}초]\n${transcription}\n\n`;
          successCount++;
        }
      } catch (segmentError) {
        console.log(`❌ 구간 ${i + 1} 실패:`, segmentError);
      }
    }
    
    // 성공한 구간이 있으면 반환
    if (successCount > 0) {
      console.log('✅ 스마트 샘플링 완료:', allTranscripts.length, '문자 (성공:', successCount, '구간)');
      return `YouTube 영상 스마트 샘플링 (Whisper):\n\n${allTranscripts}`;
    } else {
      // 모든 샘플링이 실패하면 전체 오디오로 폴백
      console.log('❌ 모든 샘플링 구간 실패. 전체 오디오로 폴백...');
      throw new Error('샘플링 실패, 전체 오디오로 폴백');
    }
    
  } catch (error) {
    console.error('❌ 스마트 샘플링 실패:', error);
    throw new Error('스마트 샘플링 처리 중 오류가 발생했습니다.');
  }
}

// 특정 구간의 오디오 추출
async function extractAudioSegment(youtubeUrl: string, startTime: number, endTime: number): Promise<any> {
  try {
    const tempDir = path.join(process.cwd(), 'temp');
    const segmentFilePath = path.join(tempDir, `segment_${startTime}_${endTime}.mp3`);
    
    // ytdl을 사용하여 특정 구간 오디오 추출
    const audioStream = ytdl(youtubeUrl, {
      quality: 'highestaudio',
      filter: 'audioonly',
      range: {
        start: startTime,
        end: endTime
      },
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      }
    });
    
    const writeStream = fs.createWriteStream(segmentFilePath);
    
    return new Promise((resolve, reject) => {
      audioStream.pipe(writeStream);
      
      audioStream.on('end', async () => {
        try {
          const stats = fs.statSync(segmentFilePath);
          // 파일 크기 체크를 완화 (1000 → 100 bytes)
          if (stats.size > 100) {
            const audioFile = fs.createReadStream(segmentFilePath);
            resolve(audioFile);
            
            // 임시 파일 삭제
            setTimeout(async () => {
              try {
                await unlink(segmentFilePath);
              } catch (deleteError) {
                console.log('⚠️ 세그먼트 파일 삭제 실패:', deleteError);
              }
            }, 5000);
          } else {
            console.log(`⚠️ 세그먼트 파일이 너무 작습니다: ${stats.size} bytes`);
            reject(new Error('세그먼트 파일이 너무 작습니다.'));
          }
        } catch (error) {
          reject(error);
        }
      });
      
      audioStream.on('error', (error) => {
        console.log(`❌ 세그먼트 오디오 추출 실패: ${startTime}초~${endTime}초`, error.message);
        reject(error);
      });
      
      writeStream.on('error', (error) => {
        reject(error);
      });
    });
    
  } catch (error) {
    console.error('❌ 오디오 세그먼트 추출 실패:', error);
    return null;
  }
}

// 비용 계산 함수
function calculateWhisperCost(durationSeconds: number): number {
  const durationMinutes = durationSeconds / 60;
  const costPerMinute = 0.006; // $0.006 per minute
  const costInDollars = durationMinutes * costPerMinute;
  const costInWon = costInDollars * 1300; // 1달러 = 1300원 (대략적 환율)
  return costInWon;
}

// YouTube 자막 추출 메인 함수
export async function extractYouTubeContent(url: string): Promise<string> {
  try {
    const videoId = extractVideoId(url);
    if (!videoId) {
      throw new Error('유효하지 않은 YouTube URL입니다.');
    }

    console.log('🎬 YouTube Video ID:', videoId);
    console.log('🔗 YouTube URL:', url);

    // YouTube 영상 정보 먼저 확인
    let videoDuration = 0;
    try {
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
      console.log('📊 YouTube 영상 정보 확인 중...');
      const info = await ytdl.getInfo(youtubeUrl);
      console.log('✅ YouTube 영상 정보 가져오기 성공');
      console.log('📄 영상 제목:', info.videoDetails.title);
      console.log('📄 영상 길이:', info.videoDetails.lengthSeconds, '초');
      videoDuration = parseInt(info.videoDetails.lengthSeconds);
      
      // 비용 계산
      const estimatedCost = calculateWhisperCost(videoDuration);
      console.log(`💰 예상 Whisper 비용: ${estimatedCost.toFixed(0)}원`);
      
      // 100원 이상이면 Puppeteer 사용
      if (estimatedCost > 100) {
        console.log('💸 비용이 100원을 초과합니다. Puppeteer를 사용합니다.');
        return await extractWithPuppeteer(url);
      }
      
    } catch (infoError) {
      console.log('❌ YouTube 영상 정보 가져오기 실패:', infoError instanceof Error ? infoError.message : '알 수 없는 오류');
    }

    // 방법 1: youtube-transcript 라이브러리 사용
    try {
      console.log('\n📝 방법 1: youtube-transcript 라이브러리 시도...');
      const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
        lang: 'ko'
      });
      
      if (transcript && transcript.length > 0) {
        const transcriptText = transcript.map(item => item.text).join(' ');
        console.log('✅ youtube-transcript 성공:', transcriptText.length, '문자');
        return `YouTube 영상 자막 (youtube-transcript):\n\n${transcriptText}`;
      }
    } catch (error) {
      console.log('❌ youtube-transcript 실패:', error instanceof Error ? error.message : '알 수 없는 오류');
    }

    // 방법 2: 영어 자막으로 시도
    try {
      console.log('\n📝 방법 2: 영어 자막 시도...');
      const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
        lang: 'en'
      });
      
      if (transcript && transcript.length > 0) {
        const transcriptText = transcript.map(item => item.text).join(' ');
        console.log('✅ 영어 자막 성공:', transcriptText.length, '문자');
        return `YouTube 영상 자막 (영어):\n\n${transcriptText}`;
      }
    } catch (error) {
      console.log('❌ 영어 자막 실패:', error instanceof Error ? error.message : '알 수 없는 오류');
    }

    // 방법 3: 자동 생성 자막 시도
    try {
      console.log('\n📝 방법 3: 자동 생성 자막 시도...');
      const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
        lang: 'ko'
      });
      
      if (transcript && transcript.length > 0) {
        const transcriptText = transcript.map(item => item.text).join(' ');
        console.log('✅ 자동 생성 자막 성공:', transcriptText.length, '문자');
        return `YouTube 영상 자막 (자동 생성):\n\n${transcriptText}`;
      }
    } catch (error) {
      console.log('❌ 자동 생성 자막 실패:', error instanceof Error ? error.message : '알 수 없는 오류');
    }

    // 방법 4: YouTube Data API로 자막 정보 확인
    try {
      console.log('\n📝 방법 4: YouTube Data API 자막 정보 확인...');
      const apiInfo = await getYouTubeInfoWithAPI(videoId);
      if (apiInfo) {
        const title = apiInfo.snippet.title;
        const description = apiInfo.snippet.description;
        const channelTitle = apiInfo.snippet.channelTitle;
        
        // 설명에서 자막 관련 정보 추출
        const captionInfo = description.match(/자막|subtitle|caption|CC/gi);
        if (captionInfo) {
          console.log('✅ 자막 정보 발견:', captionInfo);
        }
        
        const shortDescription = description.length > 500 ? description.substring(0, 500) + '...' : description;
        return `YouTube 영상 정보 (API):\n\n제목: ${title}\n채널: ${channelTitle}\n\n설명: ${shortDescription}`;
      }
    } catch (error) {
      console.log('❌ YouTube Data API 실패:', error instanceof Error ? error.message : '알 수 없는 오류');
    }

    // 방법 5: Whisper STT 시도
    try {
      console.log('\n🎵 방법 5: Whisper STT 시도...');
      const whisperText = await extractAudioWithWhisperSampling(videoId);
      
      if (whisperText && whisperText.length > 10) {
        console.log('✅ Whisper STT 성공:', whisperText.length, '문자');
        console.log('📄 Whisper STT 내용 샘플 (처음 500자):');
        console.log('─'.repeat(50));
        console.log(whisperText.substring(0, 500));
        console.log('─'.repeat(50));
        
        return `YouTube 영상 음성 인식 (Whisper):\n\n${whisperText}`;
      } else {
        console.log('❌ Whisper STT 결과가 너무 짧습니다.');
      }
    } catch (whisperError) {
      console.log('❌ Whisper STT 실패:', whisperError instanceof Error ? whisperError.message : '알 수 없는 오류');
    }

    // 방법 6: 다양한 언어 자막 시도
    const languages = ['ja', 'zh', 'es', 'fr', 'de', 'pt', 'ru', 'ar'];
    for (const lang of languages) {
      try {
        console.log(`\n📝 방법 6-${lang}: ${lang} 언어 자막 시도...`);
        const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
          lang: lang
        });
        
        if (transcript && transcript.length > 0) {
          const transcriptText = transcript.map(item => item.text).join(' ');
          console.log(`✅ ${lang} 자막 성공:`, transcriptText.length, '문자');
          return `YouTube 영상 자막 (${lang}):\n\n${transcriptText}`;
        }
      } catch (error) {
        console.log(`❌ ${lang} 자막 실패:`, error instanceof Error ? error.message : '알 수 없는 오류');
      }
    }

    // 방법 7: 자막 URL 직접 접근 시도
    try {
      console.log('\n📝 방법 7: 자막 URL 직접 접근 시도...');
      const captionUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=ko`;
      const response = await fetch(captionUrl);
      
      if (response.ok) {
        const captionXml = await response.text();
        if (captionXml.includes('<text')) {
          // XML 파싱하여 자막 추출
          const textMatches = captionXml.match(/<text[^>]*>([^<]+)<\/text>/g);
          if (textMatches) {
            const captions = textMatches.map(match => {
              const textMatch = match.match(/<text[^>]*>([^<]+)<\/text>/);
              return textMatch ? textMatch[1] : '';
            }).filter(text => text.length > 0);
            
            if (captions.length > 0) {
              const captionText = captions.join(' ');
              console.log('✅ 자막 URL 직접 접근 성공:', captionText.length, '문자');
              return `YouTube 영상 자막 (URL 직접 접근):\n\n${captionText}`;
            }
          }
        }
      }
    } catch (error) {
      console.log('❌ 자막 URL 직접 접근 실패:', error instanceof Error ? error.message : '알 수 없는 오류');
    }

    // 모든 방법이 실패한 경우
    console.log('\n❌ 모든 자막 추출 방법 실패');
    throw new Error('이 영상의 자막이나 정보를 가져올 수 없습니다. 자막이 있는 공개 영상인지 확인해주세요.');
  } catch (error) {
    console.error('❌ YouTube 내용 추출 오류:', error);
    throw new Error('YouTube 영상 내용을 가져올 수 없습니다. 자막이 있는 공개 영상인지 확인해주세요.');
  }
}

// Puppeteer를 사용한 자막 추출 (개선된 버전)
async function extractWithPuppeteer(url: string): Promise<string> {
  try {
    console.log('🤖 Puppeteer를 사용한 자막 추출 시작...');
    
    // Puppeteer import (동적 import)
    const puppeteer = await import('puppeteer');
    
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
    });
    
    const page = await browser.newPage();
    
    // User-Agent 설정
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // 자막 버튼 클릭 시도
    try {
      await page.waitForSelector('.ytp-subtitles-button', { timeout: 5000 });
      await page.click('.ytp-subtitles-button');
      console.log('✅ 자막 버튼 클릭 성공');
    } catch (error) {
      console.log('⚠️ 자막 버튼 클릭 실패, 기존 자막 확인');
    }
    
    // 잠시 대기하여 자막 로딩
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 다양한 자막 선택자 시도
    const captionSelectors = [
      '.ytp-caption-segment',
      '.ytp-caption-window-container .ytp-caption-segment',
      '.ytp-caption-window .ytp-caption-segment',
      '[class*="caption"]',
      '[class*="subtitle"]',
      '.ytp-caption-window-container',
      '.ytp-caption-window'
    ];
    
    let captions = '';
    
    for (const selector of captionSelectors) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          console.log(`✅ 자막 선택자 발견: ${selector}`);
          
          const texts = await page.evaluate((sel) => {
            const elements = document.querySelectorAll(sel);
            const texts: string[] = [];
            elements.forEach(element => {
              if (element.textContent && element.textContent.trim()) {
                texts.push(element.textContent.trim());
              }
            });
            return texts;
          }, selector);
          
          if (texts.length > 0) {
            captions = texts.join(' ');
            break;
          }
        }
      } catch (error) {
        console.log(`❌ 선택자 ${selector} 실패`);
      }
    }
    
    // 자막이 없으면 페이지 전체 텍스트에서 자막 관련 정보 추출
    if (!captions || captions.length < 10) {
      console.log('📝 페이지 전체 텍스트에서 자막 정보 추출 시도...');
      
      const pageText = await page.evaluate(() => {
        // 자막 관련 요소들 찾기
        const captionElements = document.querySelectorAll('[class*="caption"], [class*="subtitle"], [class*="transcript"]');
        const texts: string[] = [];
        
        captionElements.forEach(element => {
          if (element.textContent && element.textContent.trim()) {
            texts.push(element.textContent.trim());
          }
        });
        
        return texts.join(' ');
      });
      
      if (pageText && pageText.length > 10) {
        captions = pageText;
      }
    }
    
    await browser.close();
    
    if (captions && captions.length > 10) {
      console.log('✅ Puppeteer 자막 추출 성공:', captions.length, '문자');
      return `YouTube 영상 자막 (Puppeteer):\n\n${captions}`;
    } else {
      throw new Error('자막을 찾을 수 없습니다.');
    }
    
  } catch (error) {
    console.error('❌ Puppeteer 자막 추출 실패:', error);
    throw new Error('Puppeteer로 자막을 추출할 수 없습니다.');
  }
} 