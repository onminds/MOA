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
      alert(data.message);
    } catch (error: any) {
      alert(`오류: ${error.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const setUserPlan = async (userId: string, planType: string) => {
    if (!confirm(`사용자 플랜을 ${planType}로 변경하시겠습니까?`)) return;
    
    setActionLoading(`plan-${userId}`);
    try {
      // 결제 내역 생성 및 사용량 제한 설정
      const paymentResponse = await fetch("/api/admin/update-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, planType }),
      });

      if (!paymentResponse.ok) {
        const errorData = await paymentResponse.json();
        throw new Error(errorData.error || "플랜 설정에 실패했습니다.");
      }
      
      alert(`${planType} 플랜으로 설정되었습니다.`);
    } catch (error: any) {
      alert(`오류: ${error.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const getServiceTypeName = (serviceType: string) => {
    const names: { [key: string]: string } = {
      "image-generate": "이미지 생성",
      "video-generate": "영상 생성"
    };
    return names[serviceType] || serviceType;
  };

  const filterUsageByService = (usage: Usage[]) => {
    return usage.filter(u => u.serviceType === "image-generate" || u.serviceType === "video-generate");
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
        <div className="flex">
          {/* 공통 사이드바 */}
          {/* Sidebar import를 제거하고 나머지 충돌 마커들도 정리합니다. */}
          
          {/* 메인 콘텐츠 */}
          <div className="flex-1 p-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">관리자 대시보드</h1>
              <p className="mt-2 text-gray-600">사용자 관리 및 사용량 제어</p>
            </div>

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
                    {users.map((user) => (
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
                          <div className="space-y-2">
                            {filterUsageByService(user.usage).map((usage) => (
                              <div key={usage.id} className="text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">{getServiceTypeName(usage.serviceType)}</span>
                                  <span className="font-medium">{usage.usageCount} / {usage.limitCount}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                                  <div 
                                    className="bg-blue-500 h-1 rounded-full"
                                    style={{ width: `${(usage.usageCount / usage.limitCount) * 100}%` }}
                                  ></div>
                                </div>
                              </div>
                            ))}
                          </div>
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
          </div>
        </div>
      </div>
    </>
  );
} 