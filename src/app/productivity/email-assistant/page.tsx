"use client";
import { useState, useEffect, useRef } from "react";
import Header from '../../components/Header';
import {
  ArrowLeft, Mail, Send, Edit3, Clock, User, AlertCircle,
  Bot, Loader2, RefreshCw, Calendar, Filter, Star,
  X, ChevronLeft, ChevronRight, HelpCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import GoogleLogin from '../../components/GoogleLogin';
import DevTestButton from '../../components/DevTestButton';

export default function EmailAssistant() {
  const router = useRouter();
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // 개선된 챗봇 상태
  const [chatMessages, setChatMessages] = useState<Array<{
    id: string;
    type: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    actions?: Array<{
      label: string;
      action: string;
      icon?: React.ReactNode;
    }>;
  }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [emails, setEmails] = useState<Array<{
    id: string;
    internalDate: string;
    labelIds: string[];
    snippet: string;
    payload: {
      headers: Array<{
        name: string;
        value: string;
      }>;
    };
  }>>([]);
  const [selectedEmail, setSelectedEmail] = useState<{
    id: string;
    internalDate: string;
    labelIds: string[];
    snippet: string;
    payload: {
      headers: Array<{
        name: string;
        value: string;
      }>;
    };
  } | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  
  // Shortwave 스타일 레이아웃 상태
  // const { isSidebarCollapsed, toggleSidebar } = useSidebar();

  // AI 챗봇 응답 생성
  const generateAIResponse = async (message: string) => {
    setIsTyping(true);
    
    try {
      // 실제 AI API 호출 (현재는 Mock)
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          context: {
            selectedEmail,
            emailCount: emails.length,
            currentTime: new Date().toISOString()
          }
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          content: data.response || generateMockResponse(message),
          actions: data.actions || generateMockActions(message)
        };
      } else {
        // API 실패 시 Mock 응답
        return {
          content: generateMockResponse(message),
          actions: generateMockActions(message)
        };
      }
    } catch (error) {
      console.error('AI 응답 생성 오류:', error);
      return {
        content: generateMockResponse(message),
        actions: generateMockActions(message)
      };
    } finally {
      setIsTyping(false);
    }
  };

  // Mock 응답 생성
  const generateMockResponse = (message: string) => {
    const responses = {
      'inbox': '📧 현재 5개의 이메일이 있습니다. 중요도별로 정리해드릴까요?',
      'urgent': '🚨 긴급 이메일 2개를 발견했습니다. 즉시 확인이 필요합니다.',
      'plan': '📅 오늘의 일정을 확인했습니다. 회의 2개, 마감일 1개가 있습니다.',
      'reply': '✍️ 이메일 답장을 도와드리겠습니다. 어떤 톤으로 작성하시겠습니까?',
      'compose': '📝 새 이메일 작성을 도와드리겠습니다. 받는 사람과 제목을 알려주세요.',
      'default': '안녕하세요! 이메일 관리를 도와드리겠습니다. 무엇을 도와드릴까요?'
    };

    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('inbox') || lowerMessage.includes('organize')) return responses.inbox;
    if (lowerMessage.includes('urgent') || lowerMessage.includes('find')) return responses.urgent;
    if (lowerMessage.includes('plan') || lowerMessage.includes('day')) return responses.plan;
    if (lowerMessage.includes('reply')) return responses.reply;
    if (lowerMessage.includes('compose') || lowerMessage.includes('write')) return responses.compose;
    return responses.default;
  };

  // Mock 액션 생성
  const generateMockActions = (message: string) => {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('inbox') || lowerMessage.includes('organize')) {
      return [
        { label: '중요도별 정리', action: 'organize_by_priority', icon: <Star className="w-4 h-4" /> },
        { label: '날짜별 정리', action: 'organize_by_date', icon: <Calendar className="w-4 h-4" /> },
        { label: '보낸 사람별 정리', action: 'organize_by_sender', icon: <User className="w-4 h-4" /> }
      ];
    }
    
    if (lowerMessage.includes('urgent') || lowerMessage.includes('find')) {
      return [
        { label: '긴급 이메일 보기', action: 'show_urgent', icon: <AlertCircle className="w-4 h-4" /> },
        { label: '마감일 있는 이메일', action: 'show_deadline', icon: <Clock className="w-4 h-4" /> },
        { label: '미답변 이메일', action: 'show_unreplied', icon: <Mail className="w-4 h-4" /> }
      ];
    }

    return [
      { label: '이메일 작성', action: 'compose_email', icon: <Edit3 className="w-4 h-4" /> },
      { label: '일정 확인', action: 'check_calendar', icon: <Calendar className="w-4 h-4" /> },
      { label: '이메일 정리', action: 'organize_inbox', icon: <Filter className="w-4 h-4" /> }
    ];
  };

  // 챗봇 메시지 전송
  const sendChatMessage = async (message: string) => {
    const userMessage = {
      id: Date.now().toString(),
      type: 'user' as const,
      content: message,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');

    // AI 응답 생성
    const aiResponse = await generateAIResponse(message);
    
    const assistantMessage = {
      id: (Date.now() + 1).toString(),
      type: 'assistant' as const,
      content: aiResponse.content,
      timestamp: new Date(),
      actions: aiResponse.actions
    };

    setChatMessages(prev => [...prev, assistantMessage]);
  };

  // 액션 실행
  const executeAction = async (action: string) => {
    const actionMessage = {
      id: Date.now().toString(),
      type: 'user' as const,
      content: `액션 실행: ${action}`,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, actionMessage]);

    // 액션별 처리
    let response = '';
    switch (action) {
      case 'organize_by_priority':
        response = '📊 이메일을 중요도별로 정리했습니다. 상단에 긴급 이메일이 배치되었습니다.';
        break;
      case 'organize_by_date':
        response = '📅 이메일을 날짜별로 정리했습니다. 최신 이메일이 상단에 표시됩니다.';
        break;
      case 'show_urgent':
        response = '🚨 긴급 이메일 2개를 필터링했습니다. 즉시 확인이 필요합니다.';
        break;
      case 'compose_email':
        response = '✍️ 새 이메일 작성 모드로 전환했습니다. 받는 사람과 제목을 입력해주세요.';
        break;
      default:
        response = '✅ 요청하신 작업을 완료했습니다.';
    }

    const assistantMessage = {
      id: (Date.now() + 1).toString(),
      type: 'assistant' as const,
      content: response,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, assistantMessage]);
  };

  // 스크롤을 맨 아래로
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // 이메일 로드
  const loadEmails = async () => {
    setEmailLoading(true);
    try {
      const endpoint = process.env.NODE_ENV === 'development' 
        ? '/api/gmail/mock' 
        : '/api/gmail';
      
      const response = await fetch(endpoint);
      const data = await response.json();
      
      if (data.messages) {
        setEmails(data.messages);
      }
    } catch (error) {
      console.error('이메일 로드 오류:', error);
    } finally {
      setEmailLoading(false);
    }
  };

  // 컴포넌트 마운트 시 이메일 로드
  useEffect(() => {
    loadEmails();
  }, []);

  // 이메일 상세보기 토글
  const toggleEmailDetail = (email?: {
    id: string;
    internalDate: string;
    labelIds: string[];
    snippet: string;
    payload: {
      headers: Array<{
        name: string;
        value: string;
      }>;
    };
  }) => {
    if (email) {
      // 같은 이메일을 클릭한 경우 닫기
      if (selectedEmail?.id === email.id) {
        setSelectedEmail(null);
      } else {
        // 다른 이메일을 클릭한 경우 새로 열기
        setSelectedEmail(email);
      }
    } else {
      setSelectedEmail(null);
    }
  };



  return (
    <>
      <Header />
      <div className="min-h-screen bg-white flex flex-col">
        {/* 메인 콘텐츠 - 미니멀 스타일 */}
        <div className="flex-1 flex flex-col">
          {/* 상단 헤더 */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push('/productivity')}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                {/* 사이드바 접기/펼치기 버튼 완전 삭제 */}
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">Inbox</h1>
                  <p className="text-sm text-gray-500">Primary {emails.length}+</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  Compose
                </button>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search emails..."
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-600"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 메인 콘텐츠 영역 */}
          <div className="flex-1 flex relative">
            {/* 왼쪽: 이메일 목록 */}
            <div className="w-80 border-r-2 border-gray-300 bg-white">
              <div className="p-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">이메일 목록</h2>
                {emailLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="ml-3 text-gray-700">이메일 로딩 중...</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {emails.map((email) => (
                      <div
                        key={email.id}
                        onClick={() => toggleEmailDetail(email)}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                          selectedEmail?.id === email.id
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* 이메일 아이콘 - 정확한 정렬 */}
                          <div className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                            <Mail className="w-4 h-4 text-gray-700" />
                          </div>
                          
                          {/* 이메일 내용 - 정확한 정렬 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              <div className="font-medium text-gray-900 truncate flex-1">
                                {email.payload.headers.find((h: { name: string; value: string }) => h.name === 'From')?.value}
                              </div>
                              <div className="text-xs text-gray-700 flex-shrink-0 ml-2">
                                {new Date(parseInt(email.internalDate)).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="text-sm font-medium text-gray-900 mb-1 truncate">
                              {email.payload.headers.find((h: { name: string; value: string }) => h.name === 'Subject')?.value}
                            </div>
                            <div className="text-sm text-gray-800 line-clamp-2">
                              {email.snippet}
                            </div>
                            {email.labelIds.includes('UNREAD') && (
                              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 중앙: 이메일 상세보기 */}
            <div className="flex-1 bg-white border-r-2 border-gray-300">
              {selectedEmail ? (
                <div className="h-full flex flex-col">
                  {/* 이메일 헤더 */}
                  <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {selectedEmail.payload.headers.find((h: { name: string; value: string }) => h.name === 'Subject')?.value}
                    </h3>
                    <button
                      onClick={() => toggleEmailDetail()}
                      className="text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  {/* 이메일 내용 */}
                  <div className="flex-1 p-4 overflow-y-auto">
                    <div className="mb-4">
                      <div className="text-sm text-gray-800 mb-4">
                        <span className="font-medium">From:</span> {selectedEmail.payload.headers.find((h: { name: string; value: string }) => h.name === 'From')?.value}
                      </div>
                    </div>
                    <div className="prose max-w-none">
                      <p className="text-gray-900">{selectedEmail.snippet}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-gray-700 max-w-sm mx-auto px-8">
                    <Mail className="w-24 h-24 mx-auto mb-6 text-gray-500" />
                    <p className="text-gray-800 text-lg font-medium">이메일을 눌러서 상세정보를 확인하세요</p>
                  </div>
                </div>
              )}
            </div>

            {/* 오른쪽: AI 챗봇 전용 영역 - 자연스러운 구분선 */}
            <div className="w-96 bg-gray-50 flex flex-col border-l-2 border-gray-300">
              {/* 챗봇 헤더 */}
              <div className="p-4 border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-blue-600" />
                    <h3 className="text-sm font-medium text-gray-900">AI Assistant</h3>
                  </div>
                  <button
                    onClick={() => setChatMessages([])}
                    className="text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 챗봇 메시지 영역 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="flex items-center justify-center mb-4">
                      <Bot className="w-8 h-8 text-blue-600" />
                    </div>
                    <div className="text-gray-900 mb-4 font-medium">이메일 관리를 도와드리겠습니다!</div>
                    <div className="space-y-2">
                      <button
                        onClick={() => sendChatMessage('Organize my inbox')}
                        className="block w-full text-left px-4 py-2 text-sm bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center gap-2"
                      >
                        <Filter className="w-4 h-4 text-gray-900" />
                        <span className="text-gray-900 font-medium">이메일 정리하기</span>
                      </button>
                      <button
                        onClick={() => sendChatMessage('Find urgent emails')}
                        className="block w-full text-left px-4 py-2 text-sm bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center gap-2"
                      >
                        <AlertCircle className="w-4 h-4 text-gray-900" />
                        <span className="text-gray-900 font-medium">긴급 이메일 찾기</span>
                      </button>
                      <button
                        onClick={() => sendChatMessage('Plan my day')}
                        className="block w-full text-left px-4 py-2 text-sm bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center gap-2"
                      >
                        <Calendar className="w-4 h-4 text-gray-900" />
                        <span className="text-gray-900 font-medium">오늘 일정 확인</span>
                      </button>
                      <button
                        onClick={() => sendChatMessage('Help me reply to this email')}
                        className="block w-full text-left px-4 py-2 text-sm bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center gap-2"
                      >
                        <Edit3 className="w-4 h-4 text-gray-900" />
                        <span className="text-gray-900 font-medium">이메일 답장 도움</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {chatMessages.map((message) => (
                      <div key={message.id}>
                        <div
                          className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] px-4 py-2 rounded-lg ${
                              message.type === 'user'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border-2 border-gray-300 text-gray-900 font-medium'
                            }`}
                          >
                            {message.content}
                          </div>
                        </div>
                        
                        {/* 액션 버튼들 */}
                        {message.type === 'assistant' && message.actions && (
                          <div className="mt-2 space-y-1">
                            {message.actions.map((action, index) => (
                              <button
                                key={index}
                                onClick={() => executeAction(action.action)}
                                className="block w-full text-left px-3 py-2 text-xs bg-blue-50 border-2 border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-2"
                              >
                                <span className="text-blue-900">{action.icon}</span>
                                <span className="text-blue-900 font-medium">{action.label}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {/* 타이핑 표시 */}
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="bg-white border-2 border-gray-300 text-gray-900 font-medium px-4 py-2 rounded-lg flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          AI가 응답을 작성 중입니다...
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* 챗봇 입력 - 미니멀 스타일 */}
              <div className="p-4 border-t border-gray-200 bg-white">
                <div className="relative">
                  <textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && chatInput.trim()) {
                        e.preventDefault();
                        sendChatMessage(chatInput.trim());
                      }
                    }}
                    placeholder="Find, write, schedule, organize, ask anything..."
                    className="w-full h-16 px-4 py-3 pr-12 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none placeholder-gray-700"
                    style={{ minHeight: '64px' }}
                  />
                  <button
                    onClick={() => chatInput.trim() && sendChatMessage(chatInput.trim())}
                    disabled={!chatInput.trim() || isTyping}
                    className="absolute bottom-2 right-2 p-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {isTyping ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <div className="text-xs text-gray-700 text-center mt-2">
                  <a href="#" className="hover:text-blue-600 font-medium">What can I ask?</a>
                </div>
              </div>
            </div>
          </div>

          {/* 우하단 FAB 버튼 */}
          <button className="fixed bottom-6 right-6 w-14 h-14 bg-yellow-400 text-white rounded-full shadow-lg hover:bg-yellow-500 transition-colors flex items-center justify-center">
            <HelpCircle className="w-6 h-6" />
          </button>
        </div>
      </div>
      
      {/* 개발 테스트 버튼 */}
      <DevTestButton 
        onTestGmail={loadEmails}
        onTestAuth={() => console.log('Auth test clicked')}
        onTestCalendar={() => console.log('Calendar test clicked')}
      />
    </>
  );
} 