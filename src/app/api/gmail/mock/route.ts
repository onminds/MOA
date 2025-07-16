import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Mock 이메일 데이터
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
    },
    {
      id: '3',
      internalDate: '1704056400000',
      labelIds: ['INBOX', 'UNREAD'],
      snippet: '긴급: 서버 장애가 발생했습니다. 즉시 확인이 필요합니다.',
      payload: {
        headers: [
          { name: 'From', value: 'alert@company.com' },
          { name: 'Subject', value: '긴급: 서버 장애 발생' },
          { name: 'Date', value: 'Mon, 01 Jan 2024 07:00:00 +0900' }
        ]
      }
    },
    {
      id: '4',
      internalDate: '1704049200000',
      labelIds: ['INBOX'],
      snippet: '월간 리포트가 준비되었습니다. 첨부 파일을 확인해주세요.',
      payload: {
        headers: [
          { name: 'From', value: 'report@company.com' },
          { name: 'Subject', value: '월간 리포트 - 2024년 1월' },
          { name: 'Date', value: 'Mon, 01 Jan 2024 05:00:00 +0900' }
        ]
      }
    },
    {
      id: '5',
      internalDate: '1704042000000',
      labelIds: ['INBOX'],
      snippet: '새로운 팀원이 합류했습니다. 환영 메시지를 보내주세요.',
      payload: {
        headers: [
          { name: 'From', value: 'hr@company.com' },
          { name: 'Subject', value: '새로운 팀원 합류 안내' },
          { name: 'Date', value: 'Mon, 01 Jan 2024 03:00:00 +0900' }
        ]
      }
    }
  ];

  return NextResponse.json({ messages: mockEmails });
}

export async function POST(request: NextRequest) {
  try {
    // 개발 환경에서만 Mock 데이터 반환
    if (process.env.NODE_ENV === 'development') {
      const { to, subject, body } = await request.json();
      
      if (!to || !subject || !body) {
        return NextResponse.json(
          { error: '받는 사람, 제목, 내용이 필요합니다.' },
          { status: 400 }
        );
      }

      // Mock 이메일 전송 성공 응답
      return NextResponse.json({ 
        success: true, 
        messageId: 'mock_message_id_' + Date.now(),
        sentTo: to,
        subject: subject
      });
    } else {
      return NextResponse.json(
        { error: 'Mock API는 개발 환경에서만 사용 가능합니다.' },
        { status: 403 }
      );
    }
  } catch (error) {
    console.error('Mock 이메일 전송 오류:', error);
    return NextResponse.json(
      { error: '이메일 전송에 실패했습니다.' },
      { status: 500 }
    );
  }
} 