import { NextRequest, NextResponse } from 'next/server';

// Gmail API 클라이언트 생성
function createGmailClient(accessToken: string) {
  // 개발 환경에서만 실제 Google API 사용
  if (process.env.NODE_ENV === 'development' && accessToken !== 'mock_access_token') {
    const { google } = require('googleapis');
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    return google.gmail({ version: 'v1', auth: oauth2Client });
  }
  return null;
}

// 이메일 목록 가져오기
export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get('google_access_token')?.value;
    
    if (!accessToken) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const gmail = createGmailClient(accessToken);
    
    if (gmail) {
      // 실제 Gmail API 사용
      const { searchParams } = new URL(request.url);
      const query = searchParams.get('q') || 'in:inbox';
      const maxResults = parseInt(searchParams.get('maxResults') || '20');

      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: maxResults
      });

      const messages = response.data.messages || [];
      const detailedMessages = await Promise.all(
        messages.map(async (message: any) => {
          const detail = await gmail.users.messages.get({
            userId: 'me',
            id: message.id!
          });
          return detail.data;
        })
      );

      return NextResponse.json({ messages: detailedMessages });
    } else {
      // Mock 이메일 데이터 반환 (gmail/mock/route.ts와 동일)
      const mockEmails = [
        {
          id: '1',
          internalDate: '1704067200000',
          labelIds: ['INBOX', 'UNREAD'],
          snippet: '안녕하세요! 프로젝트 진행 상황에 대해 문의드립니다. 언제 한번 미팅을 가질 수 있을까요?',
          payload: {
            headers: [
              { name: 'From', value: 'project@company.com' },
              { name: 'Subject', value: '프로젝트 진행 상황 문의' },
              { name: 'Date', value: 'Mon, 01 Jan 2024 10:00:00 +0900' }
            ]
          }
        },
        {
          id: '2',
          internalDate: '1704063600000',
          labelIds: ['INBOX'],
          snippet: '회의 일정이 변경되었습니다. 다음 주 월요일 오후 2시로 변경되었습니다.',
          payload: {
            headers: [
              { name: 'From', value: 'meeting@company.com' },
              { name: 'Subject', value: '회의 일정 변경 안내' },
              { name: 'Date', value: 'Mon, 01 Jan 2024 09:00:00 +0900' }
            ]
          }
        }
      ];
      
      return NextResponse.json({ messages: mockEmails });
    }
  } catch (error) {
    console.error('Gmail API 오류:', error);
    return NextResponse.json(
      { error: '이메일을 가져오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// 이메일 보내기
export async function POST(request: NextRequest) {
  try {
    const accessToken = request.cookies.get('google_access_token')?.value;
    
    if (!accessToken) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const { to, subject, body } = await request.json();
    
    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: '받는 사람, 제목, 내용이 필요합니다.' },
        { status: 400 }
      );
    }

    const gmail = createGmailClient(accessToken);
    
    if (gmail) {
      // 실제 Gmail API 사용
      const message = [
        `To: ${to}`,
        `Subject: ${subject}`,
        '',
        body
      ].join('\n');

      const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage
        }
      });

      return NextResponse.json({ 
        success: true, 
        messageId: response.data.id 
      });
    } else {
      // Mock 이메일 전송 응답
      return NextResponse.json({ 
        success: true, 
        messageId: 'mock_message_' + Date.now(),
        sentTo: to,
        subject: subject
      });
    }
  } catch (error) {
    console.error('이메일 전송 오류:', error);
    return NextResponse.json(
      { error: '이메일 전송에 실패했습니다.' },
      { status: 500 }
    );
  }
} 