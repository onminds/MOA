/**
 * WebSocket 실시간 진행 상황 API
 * 클라이언트와 실시간 통신을 위한 WebSocket 연결 관리
 */

import { NextRequest } from 'next/server';
import { WebSocketServer, WebSocket } from 'ws';
import { progressManager } from '@/lib/websocket-manager';

// WebSocket 서버 인스턴스 (싱글톤)
let wss: WebSocketServer | null = null;

// WebSocket 서버 초기화
function initializeWebSocketServer() {
  if (wss) return wss;

  wss = new WebSocketServer({ 
    port: 8080,
    path: '/ws/progress'
  });

  wss.on('connection', (ws: WebSocket, request) => {
    console.log('🔗 새 WebSocket 연결');

    // URL에서 sessionId 추출
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      console.error('❌ sessionId가 없는 WebSocket 연결 시도');
      ws.close(1008, 'sessionId required');
      return;
    }

    // 세션에 WebSocket 연결
    progressManager.attachWebSocket(sessionId, ws);

    // 연결 상태 확인 메시지
    ws.send(JSON.stringify({
      type: 'connection',
      message: '실시간 연결이 설정되었습니다',
      sessionId,
      timestamp: new Date().toISOString()
    }));

    // 주기적인 ping (30초마다)
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);

    // 연결 종료 처리
    ws.on('close', () => {
      console.log(`🔌 WebSocket 연결 종료: ${sessionId}`);
      clearInterval(pingInterval);
    });

    // 에러 처리
    ws.on('error', (error) => {
      console.error(`❌ WebSocket 오류: ${sessionId}`, error);
      clearInterval(pingInterval);
    });

    // 클라이언트 메시지 처리
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'ping':
            ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
            break;
          
          case 'status_request':
            // 현재 진행 상황 요청
            const sessionInfo = progressManager.getActiveSessionsInfo();
            ws.send(JSON.stringify({
              type: 'status_response',
              data: sessionInfo,
              timestamp: new Date().toISOString()
            }));
            break;
            
          default:
            console.log('📨 클라이언트 메시지:', message);
        }
      } catch (error) {
        console.error('WebSocket 메시지 파싱 오류:', error);
      }
    });
  });

  console.log('🚀 WebSocket 서버 시작 (포트: 8080)');
  return wss;
}

// HTTP 엔드포인트 (WebSocket 정보 제공)
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  switch (action) {
    case 'status':
      // 활성 세션 정보 반환
      const sessionsInfo = progressManager.getActiveSessionsInfo();
      return Response.json({
        success: true,
        websocketUrl: 'ws://localhost:8080/ws/progress',
        ...sessionsInfo
      });

    case 'init':
      // WebSocket 서버 초기화
      try {
        initializeWebSocketServer();
        return Response.json({
          success: true,
          message: 'WebSocket 서버가 초기화되었습니다',
          websocketUrl: 'ws://localhost:8080/ws/progress'
        });
      } catch (error) {
        return Response.json({
          success: false,
          error: 'WebSocket 서버 초기화 실패',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }

    default:
      return Response.json({
        success: true,
        message: 'WebSocket 진행 상황 API',
        endpoints: {
          'GET ?action=status': '활성 세션 상태 조회',
          'GET ?action=init': 'WebSocket 서버 초기화',
          'WebSocket ws://localhost:8080/ws/progress?sessionId=xxx': '실시간 진행 상황 연결'
        }
      });
  }
}

// POST 요청으로 WebSocket 서버 시작/중지 제어
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    switch (action) {
      case 'start':
        initializeWebSocketServer();
        return Response.json({
          success: true,
          message: 'WebSocket 서버가 시작되었습니다'
        });

      case 'stop':
        if (wss) {
          wss.close();
          wss = null;
          console.log('🛑 WebSocket 서버 중지');
        }
        return Response.json({
          success: true,
          message: 'WebSocket 서버가 중지되었습니다'
        });

      default:
        return Response.json({
          success: false,
          error: '유효하지 않은 액션입니다'
        }, { status: 400 });
    }
  } catch (error) {
    return Response.json({
      success: false,
      error: 'WebSocket 서버 제어 실패',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// 애플리케이션 시작 시 WebSocket 서버 자동 초기화
if (process.env.NODE_ENV !== 'test') {
  // 지연된 초기화 (다른 서비스들이 준비된 후)
  setTimeout(() => {
    try {
      initializeWebSocketServer();
    } catch (error) {
      console.error('WebSocket 서버 자동 초기화 실패:', error);
    }
  }, 2000);
} 