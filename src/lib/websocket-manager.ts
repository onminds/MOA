/**
 * WebSocket 기반 실시간 진행 상황 관리
 * 가짜 시뮬레이션이 아닌 실제 분석 진행 상황을 전송
 */

import { WebSocket } from 'ws';

export interface ProgressUpdate {
  sessionId: string;
  stage: string;
  percentage: number;
  message: string;
  details?: {
    currentFile?: string;
    processedFiles?: number;
    totalFiles?: number;
    staticIssues?: number;
    tokensUsed?: number;
    cacheHits?: number;
  };
  timestamp: string;
}

export interface AnalysisSession {
  sessionId: string;
  projectId: string;
  websocket?: WebSocket;
  startTime: number;
  stages: AnalysisStage[];
  currentStage: number;
  totalStages: number;
}

export interface AnalysisStage {
  name: string;
  displayName: string;
  estimatedDuration: number; // ms
  actualDuration?: number;
  startTime?: number;
  completed: boolean;
}

class WebSocketProgressManager {
  private sessions = new Map<string, AnalysisSession>();
  private readonly stages: AnalysisStage[] = [
    {
      name: 'extract',
      displayName: '📁 파일 추출',
      estimatedDuration: 5000,
      completed: false
    },
    {
      name: 'structure_analysis',
      displayName: '🧩 구조 분석',
      estimatedDuration: 3000,
      completed: false
    },
    {
      name: 'static_analysis',
      displayName: '🔧 정적 분석',
      estimatedDuration: 8000,
      completed: false
    },
    {
      name: 'grouping',
      displayName: '📋 기능 그룹핑',
      estimatedDuration: 2000,
      completed: false
    },
    {
      name: 'sanitization',
      displayName: '🛡️ 보안 처리',
      estimatedDuration: 4000,
      completed: false
    },
    {
      name: 'ai_analysis',
      displayName: '🤖 AI 분석',
      estimatedDuration: 25000,
      completed: false
    },
    {
      name: 'meta_analysis',
      displayName: '🎯 통합 분석',
      estimatedDuration: 8000,
      completed: false
    }
  ];

  constructor() {
    console.log('🔗 WebSocket 진행률 관리자 초기화');
  }

  /**
   * 새 분석 세션 시작
   */
  startSession(sessionId: string, projectId: string, totalFiles: number): AnalysisSession {
    const session: AnalysisSession = {
      sessionId,
      projectId,
      startTime: Date.now(),
      stages: this.stages.map(stage => ({ ...stage, completed: false })),
      currentStage: 0,
      totalStages: this.stages.length
    };

    // 파일 수에 따른 예상 시간 조정
    this.adjustEstimatedTimes(session.stages, totalFiles);

    this.sessions.set(sessionId, session);

    console.log(`📊 분석 세션 시작: ${sessionId} (파일: ${totalFiles}개)`);
    
    this.sendProgress(sessionId, {
      stage: 'initialized',
      percentage: 0,
      message: '🚀 분석 세션 초기화 완료',
      details: { totalFiles }
    });

    return session;
  }

  /**
   * WebSocket 연결
   */
  attachWebSocket(sessionId: string, ws: WebSocket): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.websocket = ws;
      console.log(`🔗 WebSocket 연결: ${sessionId}`);
      
      // 연결 확인 메시지
      this.sendProgress(sessionId, {
        stage: 'connected',
        percentage: 0,
        message: '🔗 실시간 연결 설정 완료',
        details: {}
      });
    }
  }

  /**
   * 단계 시작
   */
  startStage(sessionId: string, stageName: string, details?: any): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const stageIndex = session.stages.findIndex(s => s.name === stageName);
    if (stageIndex === -1) return;

    session.currentStage = stageIndex;
    session.stages[stageIndex].startTime = Date.now();

    const stage = session.stages[stageIndex];
    const basePercentage = (stageIndex / session.totalStages) * 100;

    console.log(`📍 단계 시작: ${stage.displayName} (${sessionId})`);

    this.sendProgress(sessionId, {
      stage: stageName,
      percentage: Math.round(basePercentage),
      message: `${stage.displayName} 시작...`,
      details
    });
  }

  /**
   * 단계 내 진행률 업데이트
   */
  updateStageProgress(
    sessionId: string, 
    stageName: string, 
    stageProgress: number, 
    message: string, 
    details?: any
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const stageIndex = session.stages.findIndex(s => s.name === stageName);
    if (stageIndex === -1) return;

    // 전체 진행률 계산
    const basePercentage = (stageIndex / session.totalStages) * 100;
    const stageWeight = 100 / session.totalStages;
    const currentPercentage = basePercentage + (stageProgress * stageWeight / 100);

    const stage = session.stages[stageIndex];

    this.sendProgress(sessionId, {
      stage: stageName,
      percentage: Math.round(Math.min(currentPercentage, 100)),
      message: `${stage.displayName}: ${message}`,
      details
    });
  }

  /**
   * 단계 완료
   */
  completeStage(sessionId: string, stageName: string, details?: any): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const stageIndex = session.stages.findIndex(s => s.name === stageName);
    if (stageIndex === -1) return;

    const stage = session.stages[stageIndex];
    stage.completed = true;
    stage.actualDuration = Date.now() - (stage.startTime || Date.now());

    const completedPercentage = ((stageIndex + 1) / session.totalStages) * 100;

    console.log(`✅ 단계 완료: ${stage.displayName} (${stage.actualDuration}ms)`);

    this.sendProgress(sessionId, {
      stage: stageName,
      percentage: Math.round(completedPercentage),
      message: `${stage.displayName} 완료`,
      details: {
        ...details,
        duration: stage.actualDuration
      }
    });
  }

  /**
   * 세션 완료
   */
  completeSession(sessionId: string, finalDetails?: any): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const totalDuration = Date.now() - session.startTime;

    console.log(`🎉 분석 세션 완료: ${sessionId} (${totalDuration}ms)`);

    this.sendProgress(sessionId, {
      stage: 'completed',
      percentage: 100,
      message: '🎉 AI 코드 리뷰 완료!',
      details: {
        ...finalDetails,
        totalDuration,
        completedStages: session.stages.filter(s => s.completed).length
      }
    });

    // 5초 후 세션 정리
    setTimeout(() => {
      this.cleanupSession(sessionId);
    }, 5000);
  }

  /**
   * 에러 발생
   */
  reportError(sessionId: string, error: string, details?: any): void {
    console.error(`❌ 분석 오류: ${sessionId} - ${error}`);

    this.sendProgress(sessionId, {
      stage: 'error',
      percentage: -1,
      message: `❌ 오류: ${error}`,
      details
    });
  }

  /**
   * 진행 상황 전송
   */
  private sendProgress(sessionId: string, update: Partial<ProgressUpdate>): void {
    const session = this.sessions.get(sessionId);
    if (!session?.websocket) return;

    const progressUpdate: ProgressUpdate = {
      sessionId,
      stage: update.stage || 'unknown',
      percentage: update.percentage || 0,
      message: update.message || '',
      details: update.details,
      timestamp: new Date().toISOString()
    };

    try {
      if (session.websocket.readyState === WebSocket.OPEN) {
        session.websocket.send(JSON.stringify(progressUpdate));
      }
    } catch (error) {
      console.error(`WebSocket 전송 오류: ${sessionId}`, error);
    }
  }

  /**
   * 파일 수에 따른 예상 시간 조정
   */
  private adjustEstimatedTimes(stages: AnalysisStage[], totalFiles: number): void {
    const fileMultiplier = Math.max(1, Math.log10(totalFiles));
    
    stages.forEach(stage => {
      switch (stage.name) {
        case 'extract':
          stage.estimatedDuration *= fileMultiplier * 0.8;
          break;
        case 'static_analysis':
          stage.estimatedDuration *= fileMultiplier * 1.2;
          break;
        case 'ai_analysis':
          stage.estimatedDuration *= fileMultiplier * 1.5;
          break;
        default:
          stage.estimatedDuration *= fileMultiplier;
      }
    });
  }

  /**
   * 세션 정리
   */
  private cleanupSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session?.websocket) {
      session.websocket.close();
    }
    this.sessions.delete(sessionId);
    console.log(`🧹 세션 정리 완료: ${sessionId}`);
  }

  /**
   * 활성 세션 정보
   */
  getActiveSessionsInfo(): any {
    return {
      totalSessions: this.sessions.size,
      sessions: Array.from(this.sessions.values()).map(session => ({
        sessionId: session.sessionId,
        projectId: session.projectId,
        currentStage: session.currentStage,
        totalStages: session.totalStages,
        startTime: session.startTime,
        elapsedTime: Date.now() - session.startTime
      }))
    };
  }
}

// 싱글톤 인스턴스
export const progressManager = new WebSocketProgressManager();

export default progressManager; 