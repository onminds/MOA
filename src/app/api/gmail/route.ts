import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// Gmail API 클라이언트 생성
function createGmailClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth: oauth2Client });
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
      messages.map(async (message) => {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!
        });
        return detail.data;
      })
    );

    return NextResponse.json({ messages: detailedMessages });
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
    
    // 이메일 메시지 생성
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
  } catch (error) {
    console.error('이메일 전송 오류:', error);
    return NextResponse.json(
      { error: '이메일 전송에 실패했습니다.' },
      { status: 500 }
    );
  }
} 