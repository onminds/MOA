"use client";

import { useState, useEffect } from 'react';
import { getNextMonthSameTime, getInitialResetDate, shouldResetUsage, getKoreanTimeNow, convertUTCToKorean } from '@/lib/utils';

export default function TestUsageReset() {
  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);
  const [userCreatedAt, setUserCreatedAt] = useState(new Date().toISOString().split('T')[0]);
  const [userCreatedTime, setUserCreatedTime] = useState('04:45');
  const [results, setResults] = useState<any>(null);

  const runTest = () => {
    const testDateObj = new Date(testDate);
    const userCreatedAtObj = new Date(`${userCreatedAt}T${userCreatedTime}`);
    
    // 한국 시간 기준으로 계산
    const koreanNow = getKoreanTimeNow();
    const nextMonthSame = getNextMonthSameTime(testDateObj);
    const initialReset = getInitialResetDate(userCreatedAtObj);
    const shouldReset = shouldResetUsage(initialReset);
    
    // UTC와 한국 시간 비교를 위한 정보
    const utcCreated = userCreatedAtObj.toISOString();
    const koreanCreated = convertUTCToKorean(userCreatedAtObj);
    const utcReset = initialReset.toISOString();
    const koreanReset = convertUTCToKorean(initialReset);
    
    // 시간대 변환 과정 상세 정보
    const KOREAN_OFFSET = 9 * 60 * 60 * 1000; // 9시간을 밀리초로
    const createdKoreanTime = new Date(userCreatedAtObj.getTime() + KOREAN_OFFSET);
    const resetKoreanTime = new Date(initialReset.getTime() + KOREAN_OFFSET);
    
    setResults({
      testDate: testDateObj.toLocaleDateString('ko-KR'),
      userCreatedAt: userCreatedAtObj.toLocaleDateString('ko-KR'),
      userCreatedTime: userCreatedAtObj.toLocaleTimeString('ko-KR'),
      nextMonthSame: nextMonthSame.toLocaleDateString('ko-KR'),
      nextMonthSameTime: nextMonthSame.toLocaleTimeString('ko-KR'),
      initialReset: initialReset.toLocaleDateString('ko-KR'),
      initialResetTime: initialReset.toLocaleTimeString('ko-KR'),
      shouldReset,
      daysUntilReset: Math.ceil((initialReset.getTime() - testDateObj.getTime()) / (1000 * 60 * 60 * 24)),
      
      // 시간대 디버깅 정보
      utcCreated,
      koreanCreated: koreanCreated.toLocaleString('ko-KR'),
      utcReset,
      koreanReset: koreanReset.toLocaleString('ko-KR'),
      koreanNow: koreanNow.toLocaleString('ko-KR'),
      serverNow: new Date().toISOString(),
      
      // 상세 시간대 변환 정보
      createdKoreanTime: createdKoreanTime.toLocaleString('ko-KR'),
      resetKoreanTime: resetKoreanTime.toLocaleString('ko-KR'),
      koreanOffset: 'UTC+9 (9시간)',
      offsetMs: KOREAN_OFFSET
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">월 초기화 시스템 테스트 (한국 시간 기준)</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">테스트 설정</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                테스트 기준 날짜
              </label>
              <input
                type="date"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                사용자 계정 생성일
              </label>
              <input
                type="date"
                value={userCreatedAt}
                onChange={(e) => setUserCreatedAt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                계정 생성 시간 (한국 시간)
              </label>
              <input
                type="time"
                value={userCreatedTime}
                onChange={(e) => setUserCreatedTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={runTest}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              테스트 실행
            </button>
            
            <button
              onClick={() => {
                const now = new Date();
                const koreanNow = getKoreanTimeNow();
                const KOREAN_OFFSET = 9 * 60 * 60 * 1000;
                
                alert(`시간대 테스트 결과:
                
현재 서버 시간: ${now.toISOString()}
현재 한국 시간: ${koreanNow.toISOString()}
한국 오프셋: ${KOREAN_OFFSET}ms (9시간)

계정 생성 시간: ${userCreatedAt}T${userCreatedTime}
계정 생성 (UTC): ${new Date(`${userCreatedAt}T${userCreatedTime}`).toISOString()}
계정 생성 (한국): ${new Date(new Date(`${userCreatedAt}T${userCreatedTime}`).getTime() + KOREAN_OFFSET).toISOString()}`);
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              시간대 테스트
            </button>
          </div>
        </div>
        
        {results && (
          <>
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">테스트 결과</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="font-medium">테스트 기준 날짜:</span>
                    <span>{results.testDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">사용자 계정 생성일:</span>
                    <span>{results.userCreatedAt}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">계정 생성 시간:</span>
                    <span>{results.userCreatedTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">다음 달 동일 시간:</span>
                    <span>{results.nextMonthSame}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">다음 달 시간:</span>
                    <span>{results.nextMonthSameTime}</span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="font-medium">초기 초기화 날짜:</span>
                    <span>{results.initialReset}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">초기 초기화 시간:</span>
                    <span>{results.initialResetTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">초기화 필요 여부:</span>
                    <span className={`font-bold ${results.shouldReset ? 'text-red-600' : 'text-green-600'}`}>
                      {results.shouldReset ? '초기화 필요' : '초기화 불필요'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">초기화까지 남은 일수:</span>
                    <span className={results.daysUntilReset < 0 ? 'text-red-600' : 'text-blue-600'}>
                      {results.daysUntilReset < 0 ? '초기화 지남' : `${results.daysUntilReset}일`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4 text-yellow-800">시간대 디버깅 정보</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="font-medium">계정 생성 (UTC):</span>
                    <span className="font-mono text-xs">{results.utcCreated}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">계정 생성 (한국):</span>
                    <span className="font-mono text-xs">{results.koreanCreated}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">초기화 (UTC):</span>
                    <span className="font-mono text-xs">{results.utcReset}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">초기화 (한국):</span>
                    <span className="font-mono text-xs">{results.koreanReset}</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="font-medium">현재 (한국):</span>
                    <span className="font-mono text-xs">{results.koreanNow}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">현재 (서버):</span>
                    <span className="font-mono text-xs">{results.serverNow}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">시간대 차이:</span>
                    <span className="font-mono text-xs">{results.koreanOffset}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">오프셋 (밀리초):</span>
                    <span className="font-mono text-xs">{results.offsetMs}</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <h3 className="font-semibold mb-2 text-blue-800">시간대 변환 과정</h3>
                <div className="text-xs text-blue-700 space-y-1">
                  <div>• <strong>계정 생성 (한국 시간)</strong>: {results.createdKoreanTime}</div>
                  <div>• <strong>초기화 (한국 시간)</strong>: {results.resetKoreanTime}</div>
                  <div>• <strong>변환 공식</strong>: UTC 시간 + 9시간 = 한국 시간</div>
                  <div>• <strong>계산 방식</strong>: 계정 생성일 + 1개월 (한국 시간 기준)</div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-gray-50 rounded-md">
              <h3 className="font-semibold mb-2">설명</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• <strong>초기 초기화 날짜</strong>: 계정 생성일 기준으로 정확히 한 달 후 (한국 시간 기준)</li>
                <li>• <strong>초기화 필요 여부</strong>: 현재 날짜가 초기화 날짜를 지났는지 확인 (한국 시간 기준)</li>
                <li>• <strong>남은 일수</strong>: 초기화 날짜까지 남은 일수 (음수면 이미 지남)</li>
                <li>• <strong>시간대 처리</strong>: 모든 계산은 한국 시간(KST, UTC+9) 기준으로 처리</li>
              </ul>
            </div>
          </>
        )}
        
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">한국 시간 기준 월 초기화 시스템 특징</h2>
          
          <div className="space-y-3 text-sm text-gray-700">
            <div className="flex items-start">
              <span className="text-blue-600 font-bold mr-2">•</span>
              <span><strong>초기화 주기</strong>: 계정 생성일 기준으로 정확히 한 달 후 (한국 시간 기준)</span>
            </div>
            <div className="flex items-start">
              <span className="text-blue-600 font-bold mr-2">•</span>
              <span><strong>시간 정확성</strong>: 계정 생성 시간과 동일한 시간에 초기화 (UTC+9)</span>
            </div>
            <div className="flex items-start">
              <span className="text-blue-600 font-bold mr-2">•</span>
              <span><strong>자동 연속</strong>: 이후 초기화는 이전 초기화일 기준으로 정확히 한 달 후</span>
            </div>
            <div className="flex items-start">
              <span className="text-blue-600 font-bold mr-2">•</span>
              <span><strong>사용자별 독립</strong>: 각 사용자의 계정 생성일 기준으로 개별 계산</span>
            </div>
            <div className="flex items-start">
              <span className="text-blue-600 font-bold mr-2">•</span>
              <span><strong>예시</strong>: 8월 25일 오전 4시 45분 생성 → 9월 25일 오전 4시 45분 초기화</span>
            </div>
            <div className="flex items-start">
              <span className="text-red-600 font-bold mr-2">•</span>
              <span><strong>시간대 처리</strong>: 서버 UTC 시간을 한국 시간(KST)으로 자동 변환하여 처리</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
