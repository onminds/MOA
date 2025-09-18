import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // 인증 체크
    const authResult = await requireAuth();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');

    if (!videoId) {
      return NextResponse.json({ error: 'videoId가 필요합니다.' }, { status: 400 });
    }

    // YouTube Data API를 사용한 정보 가져오기
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      // API 키가 없으면 기본 정보 반환
      console.log('⚠️ YouTube API 키가 없습니다. 기본 정보를 반환합니다.');
      return NextResponse.json({
        title: 'YouTube 영상',
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        duration: '',
        channel: 'YouTube',
        url: `https://www.youtube.com/watch?v=${videoId}`,
        description: '',
        viewCount: '',
        likeCount: '',
        fallback: true
      });
    }

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet,contentDetails,statistics`
    );

    if (!response.ok) {
      // API 호출 실패 시에도 기본 정보 반환
      console.log('⚠️ YouTube API 호출 실패. 기본 정보를 반환합니다.');
      return NextResponse.json({
        title: 'YouTube 영상',
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        duration: '',
        channel: 'YouTube',
        url: `https://www.youtube.com/watch?v=${videoId}`,
        description: '',
        viewCount: '',
        likeCount: '',
        fallback: true
      });
    }

    const data = await response.json();

    if (data.items && data.items.length > 0) {
      const video = data.items[0];
      return NextResponse.json({
        title: video.snippet.title,
        thumbnail: video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url,
        duration: video.contentDetails.duration,
        channel: video.snippet.channelTitle,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        description: video.snippet.description,
        viewCount: video.statistics.viewCount,
        likeCount: video.statistics.likeCount
      });
    } else {
      // 영상을 찾을 수 없어도 기본 정보 반환
      console.log('⚠️ 영상을 찾을 수 없습니다. 기본 정보를 반환합니다.');
      return NextResponse.json({
        title: 'YouTube 영상',
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        duration: '',
        channel: 'YouTube',
        url: `https://www.youtube.com/watch?v=${videoId}`,
        description: '',
        viewCount: '',
        likeCount: '',
        fallback: true
      });
    }

  } catch (error) {
    console.error('YouTube 정보 가져오기 오류:', error);
    // 오류 발생 시에도 기본 정보 반환
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');
    
    return NextResponse.json({
      title: 'YouTube 영상',
      thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : '',
      duration: '',
      channel: 'YouTube',
      url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : '',
      description: '',
      viewCount: '',
      likeCount: '',
      fallback: true
    });
  }
}
