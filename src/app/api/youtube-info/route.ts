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
      return NextResponse.json({ 
        error: 'YouTube API 키가 설정되지 않았습니다.',
        fallback: true 
      }, { status: 400 });
    }

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet,contentDetails,statistics`
    );

    if (!response.ok) {
      throw new Error(`YouTube API 오류: ${response.status}`);
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
      return NextResponse.json({ error: '영상을 찾을 수 없습니다.' }, { status: 404 });
    }

  } catch (error) {
    console.error('YouTube 정보 가져오기 오류:', error);
    return NextResponse.json({ 
      error: 'YouTube 정보를 가져오는 중 오류가 발생했습니다.',
      fallback: true 
    }, { status: 500 });
  }
}
