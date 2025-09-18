"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Header from "../components/Header";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  usage: Usage[];
  _count: {
    payments: number;
  };
}

interface Usage {
  id: string;
  serviceType: string;
  usageCount: number;
  limitCount: number;
  resetDate: string;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [openUserId, setOpenUserId] = useState<string | null>(null);
  const [serviceQuery, setServiceQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<'byUser' | 'byService'>('byUser');
  const [selectedService, setSelectedService] = useState<string>('productivity');
  const [userQuery, setUserQuery] = useState<string>("");

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/auth/signin");
      return;
    }
    
    // 관리자 권한 체크
    if (session.user?.role !== 'ADMIN') {
      setError("관리자 권한이 필요합니다");
      setLoading(false);
      return;
    }
    
    fetchUsers();
  }, [session, status, router]);

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/admin/users");
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "사용자 목록을 불러올 수 없습니다.");
      }
      
      setUsers(data.users || []);
    } catch (error: any) {
      setError(error.message);
      setUsers([]); // 오류 시 빈 배열로 설정
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    if (!confirm(`사용자 역할을 ${newRole}로 변경하시겠습니까?`)) return;
    
    setActionLoading(`role-${userId}`);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error);
      }
      
      await fetchUsers(); // 목록 새로고침
      alert("사용자 역할이 업데이트되었습니다.");
    } catch (error: any) {
      alert(`오류: ${error.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const updateUsage = async (userId: string, action: string, serviceType?: string, customLimit?: number) => {
    setActionLoading(`usage-${userId}-${serviceType || 'all'}`);
    try {
      const response = await fetch("/api/admin/usage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action, serviceType, customLimit }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error);
      }
      
      await fetchUsers(); // 목록 새로고침
      alert("사용량이 업데이트되었습니다.");
    } catch (error: any) {
      alert(`오류: ${error.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const setUserPlan = async (userId: string, planType: string) => {
    setActionLoading(`plan-${userId}`);
    try {
      const response = await fetch("/api/admin/update-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, planType }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error);
      }
      
      await fetchUsers(); // 목록 새로고침
      alert("사용자 플랜이 업데이트되었습니다.");
    } catch (error: any) {
      alert(`오류: ${error.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const getServiceTypeName = (serviceType: string) => {
    const names: { [key: string]: string } = {
      'chat': 'AI 채팅',
      'image': '이미지 생성',
      'image-generate': '이미지 생성',
      'video': '영상 생성',
      'video-generate': '영상 생성',
      'code': '코드 생성',
      'summary': 'AI 요약',
      'productivity': '생산성(통합)',
      // 생산성 도구 세부 매핑
      'ai-summary': 'AI 요약',
      'report-writers': '레포트 작성',
      'cover-letter': '자기소개서',
      'lecture-notes': '강의 노트',
      'interview-prep': '면접 준비',
      'presentation-script': '발표 대본',
      'code-review': '코드 리뷰',
      'code-generate': '코드 생성'
    };
    return names[serviceType] || serviceType;
  };

  const serviceOptions: { value: string; label: string }[] = [
    { value: 'image-generate', label: '이미지 생성' },
    { value: 'video-generate', label: '영상 생성' },
    { value: 'productivity', label: '생산성(통합)' },
  ];

  const filterUsageByService = (usage: Usage[]) => {
    // 중복된 서비스 타입 제거 (최신 것만 유지)
    const uniqueUsage = new Map();
    
    usage.forEach(u => {
      // 서비스 타입 정규화 (중복 제거)
      let serviceKey = u.serviceType;
      
      // image-generate와 image는 같은 서비스
      if (u.serviceType === 'image-generate') {
        serviceKey = 'image';
      }
      // video-generate와 video는 같은 서비스
      else if (u.serviceType === 'video-generate') {
        serviceKey = 'video';
      }
      // 생산성 개별 항목을 통합 버킷으로 정규화
      else if ([
        'productivity',
        'ai-summary','report-writers','cover-letter','lecture-notes',
        'interview-prep','code-review','presentation-script','code-generate','sns-post'
      ].includes(u.serviceType)) {
        serviceKey = 'productivity';
      }
      
      // 이미 존재하는 서비스라면 한도가 더 많은 것을 유지 (새 플랜 우선)
      if (uniqueUsage.has(serviceKey)) {
        const existing = uniqueUsage.get(serviceKey);
        const merged = {
          ...existing,
          usageCount: (existing.usageCount || 0) + (u.usageCount || 0),
          limitCount: Math.max(existing.limitCount || 0, u.limitCount || 0),
          serviceType: serviceKey,
        };
        uniqueUsage.set(serviceKey, merged);
      } else {
        uniqueUsage.set(serviceKey, { ...u, serviceType: serviceKey });
      }
    });
    
    // chat 서비스는 사용량이 있을 때만 표시
    return Array.from(uniqueUsage.values()).filter(u => 
      u.serviceType !== 'chat' || u.usageCount > 0
    );
  };

  // 생성 서비스/생산성 도구로 그룹 분리
  const groupUsages = (usage: Usage[]) => {
    const generationKeys = new Set(['image', 'image-generate', 'video', 'video-generate']);
    const generation: Usage[] = [];
    const productivity: Usage[] = [];
    usage.forEach(u => {
      if (generationKeys.has(u.serviceType)) generation.push(u);
      else productivity.push(u);
    });
    // 보기 좋게 정렬: 고정된 선호 순서
    const prodOrder = [
      'ai-summary','report-writers','cover-letter','lecture-notes',
      'interview-prep','code-review','presentation-script','code-generate'
    ];
    productivity.sort((a, b) => prodOrder.indexOf(a.serviceType) - prodOrder.indexOf(b.serviceType));
    return { generation, productivity };
  };

  const getProgressColor = (ratio: number) => {
    if (ratio >= 0.8) return 'bg-red-500';
    if (ratio >= 0.5) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const summarize = (items: Usage[]) => {
    const used = items.reduce((sum, u) => sum + u.usageCount, 0);
    const limit = items.reduce((sum, u) => sum + u.limitCount, 0);
    const ratio = limit > 0 ? used / limit : 0;
    return { used, limit, ratio };
  };

  const UsageModal = ({ user }: { user: User }) => {
    if (!user) return null;
    const grouped = groupUsages(filterUsageByService(user.usage));
    const all = [...grouped.generation, ...grouped.productivity];
    const filtered = all.filter(u => getServiceTypeName(u.serviceType).toLowerCase().includes(serviceQuery.toLowerCase()));
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/30" onClick={() => { setOpenUserId(null); setServiceQuery(""); }}></div>
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <div className="font-semibold text-gray-900">사용량 상세 - {user.name || user.email}</div>
            <button className="text-gray-500 hover:text-gray-700" onClick={() => { setOpenUserId(null); setServiceQuery(""); }}>닫기</button>
          </div>
          <div className="px-5 py-3 border-b flex items-center gap-2">
            <input
              value={serviceQuery}
              onChange={(e) => setServiceQuery(e.target.value)}
              placeholder="서비스 검색..."
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
          <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
            {filtered.length === 0 ? (
              <div className="text-sm text-gray-500">일치하는 서비스가 없습니다.</div>
            ) : (
              <div className="space-y-3">
                {filtered.map((usage) => {
                  const ratio = usage.limitCount > 0 ? usage.usageCount / usage.limitCount : 0;
                  return (
                    <div key={usage.id} className="text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-800">{getServiceTypeName(usage.serviceType)}</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700">
                          {usage.usageCount} / {usage.limitCount}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                        <div className={`${getProgressColor(ratio)} h-1.5 rounded-full`} style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="px-5 py-3 border-t flex justify-end">
            <button className="px-3 py-1.5 text-sm bg-gray-100 rounded-md hover:bg-gray-200" onClick={() => { setOpenUserId(null); setServiceQuery(""); }}>닫기</button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-gray-600">로딩 중...</div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-red-600">오류: {error}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">관리자 대시보드</h1>
            <p className="mt-2 text-gray-600">사용자 관리 및 사용량 제어</p>
          </div>

          {/* 보기 모드 전환 + 사용자 검색 */}
          <div className="mb-4 flex items-center gap-3 flex-wrap">
            <div className="inline-flex rounded-md shadow-sm" role="group">
              <button
                onClick={() => setViewMode('byUser')}
                className={`px-3 py-1.5 text-sm border ${viewMode==='byUser' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'} rounded-l-md`}
              >사용자별 보기</button>
              <button
                onClick={() => setViewMode('byService')}
                className={`px-3 py-1.5 text-sm border -ml-px ${viewMode==='byService' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'} rounded-r-md`}
              >서비스별 보기</button>
            </div>
            {viewMode==='byService' && (
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="ml-2 px-3 py-1.5 text-sm border rounded-md"
              >
                {serviceOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
            <div className="ml-auto flex items-center gap-2">
              <input
                value={userQuery}
                onChange={(e)=>setUserQuery(e.target.value)}
                placeholder="사용자 이름/이메일 검색..."
                className="px-3 py-1.5 text-sm border rounded-md w-64"
              />
            </div>
          </div>

          {viewMode==='byUser' ? (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">사용자 목록</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      사용자
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      역할
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      플랜 설정
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      사용량
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      액션
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users
                    .filter(u => (u.name || '').toLowerCase().includes(userQuery.toLowerCase()) || (u.email || '').toLowerCase().includes(userQuery.toLowerCase()))
                    .map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-700">
                                {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{user.name || '이름 없음'}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                          user.role === 'USER' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-2">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => setUserPlan(user.id, 'basic')}
                              disabled={actionLoading === `plan-${user.id}`}
                              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                            >
                              Basic
                            </button>
                            <button
                              onClick={() => setUserPlan(user.id, 'standard')}
                              disabled={actionLoading === `plan-${user.id}`}
                              className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                            >
                              Standard
                            </button>
                            <button
                              onClick={() => setUserPlan(user.id, 'pro')}
                              disabled={actionLoading === `plan-${user.id}`}
                              className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 disabled:opacity-50"
                            >
                              Pro
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {(() => {
                          const grouped = groupUsages(filterUsageByService(user.usage));
                          const gen = summarize(grouped.generation);
                          const prod = summarize(grouped.productivity);
                          return (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-blue-50 text-blue-700 border border-blue-200">
                                생성 {gen.used}/{gen.limit}
                              </span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                                생산성 {prod.used}/{prod.limit}
                              </span>
                              {/* 상세 모달 버튼 제거 요청에 따라 비활성화 */}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="space-y-2">
                          <button
                            onClick={() => updateUserRole(user.id, user.role === 'ADMIN' ? 'USER' : 'ADMIN')}
                            disabled={actionLoading === `role-${user.id}`}
                            className="px-3 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 disabled:opacity-50"
                          >
                            {user.role === 'ADMIN' ? '일반 사용자로' : '관리자로'}
                          </button>
                          <button
                            onClick={() => updateUsage(user.id, 'reset')}
                            disabled={actionLoading === `usage-${user.id}-all`}
                            className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
                          >
                            사용량 초기화
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">{getServiceTypeName(selectedService)} - 사용자별 사용량</h2>
              <span className="text-sm text-gray-500">총 사용자: {users.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">사용자</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이메일</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">사용량</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users
                    .filter(u => (u.name || '').toLowerCase().includes(userQuery.toLowerCase()) || (u.email || '').toLowerCase().includes(userQuery.toLowerCase()))
                    .map(user => {
                    const normalized = filterUsageByService(user.usage);
                    const target = normalized.find(u => u.serviceType === selectedService ||
                      (selectedService==='image-generate' && u.serviceType==='image') ||
                      (selectedService==='video-generate' && u.serviceType==='video'));
                    const usage = target || { id: `${user.id}-${selectedService}`, serviceType: selectedService, usageCount: 0, limitCount: 0, resetDate: new Date().toISOString() } as any;
                    const ratio = usage.limitCount > 0 ? usage.usageCount / usage.limitCount : 0;
                    return (
                      <tr key={user.id}>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">{user.name || '이름 없음'}</td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-gray-100 text-gray-700 border border-gray-200">
                              {usage.usageCount} / {usage.limitCount}
                            </span>
                            <div className="w-48 bg-gray-200 rounded-full h-1.5">
                              <div className={`${getProgressColor(ratio)} h-1.5 rounded-full`} style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          )}
        </div>
      </div>
    </>
  );
} 