import { NextRequest, NextResponse } from 'next/server';

// Calendar API 클라이언트 생성
async function createCalendarClient(accessToken: string) {
  // 개발 환경에서만 실제 Google API 사용
  if (process.env.NODE_ENV === 'development' && accessToken !== 'mock_access_token') {
    const { google } = await import('googleapis');
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    return google.calendar({ version: 'v3', auth: oauth2Client });
  }
  return null;
}

// 일정 목록 가져오기
export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get('google_access_token')?.value;
    
    if (!accessToken) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const calendar = await createCalendarClient(accessToken);
    
    if (calendar) {
      // 실제 Google Calendar API 사용
      const { searchParams } = new URL(request.url);
      const timeMin = searchParams.get('timeMin') || new Date().toISOString();
      const timeMax = searchParams.get('timeMax') || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin,
        timeMax: timeMax,
        singleEvents: true,
        orderBy: 'startTime'
      });

      return NextResponse.json({ events: response.data.items });
    } else {
      // Mock 일정 데이터 반환
      const mockEvents = [
        {
          id: 'mock_event_1',
          summary: '팀 미팅',
          description: '주간 진행 상황 공유',
          start: { dateTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() },
          end: { dateTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString() }
        },
        {
          id: 'mock_event_2',
          summary: '고객 미팅',
          description: '신규 프로젝트 논의',
          start: { dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
          end: { dateTime: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString() }
        }
      ];
      
      return NextResponse.json({ events: mockEvents });
    }
  } catch (error) {
    console.error('Calendar API 오류:', error);
    return NextResponse.json(
      { error: '일정을 가져오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// 일정 생성
export async function POST(request: NextRequest) {
  try {
    const accessToken = request.cookies.get('google_access_token')?.value;
    
    if (!accessToken) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const { summary, description, start, end, attendees } = await request.json();
    
    if (!summary || !start || !end) {
      return NextResponse.json(
        { error: '제목, 시작 시간, 종료 시간이 필요합니다.' },
        { status: 400 }
      );
    }

    const calendar = await createCalendarClient(accessToken);
    
    if (calendar) {
      // 실제 Google Calendar API 사용
      const event = {
        summary: summary,
        description: description,
        start: {
          dateTime: start,
          timeZone: 'Asia/Seoul'
        },
        end: {
          dateTime: end,
          timeZone: 'Asia/Seoul'
        },
        attendees: attendees ? attendees.map((email: string) => ({ email })) : undefined,
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 10 }
          ]
        }
      };

      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event
      });

      return NextResponse.json({ 
        success: true, 
        eventId: response.data.id,
        event: response.data
      });
    } else {
      // Mock 일정 생성 응답
      return NextResponse.json({ 
        success: true, 
        eventId: 'mock_event_' + Date.now(),
        event: {
          id: 'mock_event_' + Date.now(),
          summary,
          description,
          start: { dateTime: start },
          end: { dateTime: end }
        }
      });
    }
  } catch (error) {
    console.error('일정 생성 오류:', error);
    return NextResponse.json(
      { error: '일정 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
} 