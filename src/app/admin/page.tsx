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
    fetchUsers();
  }, [session, status, router]);

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/admin/users");
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "사용자 목록을 불러올 수 없습니다.");
      }
      
      setUsers(data.users);
    } catch (error: any) {
      setError(error.message);
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

  const getServiceTypeName = (serviceType: string) => {
    const names: { [key: string]: string } = {
      "image-generate": "이미지 생성",
      "ai-chat": "AI 채팅", 
      "code-generate": "코드 생성",
      "sns-post": "SNS 포스트"
    };
    return names[serviceType] || serviceType;
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
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
                      사용량
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      가입일
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      관리
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {user.name || "이름 없음"}
                          </div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={user.role}
                          onChange={(e) => updateUserRole(user.id, e.target.value)}
                          disabled={actionLoading === `role-${user.id}`}
                          className="text-sm border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="USER">일반 사용자</option>
                          <option value="ADMIN">관리자</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {user.usage.map((usage) => (
                            <div key={usage.id} className="flex items-center space-x-2">
                              <span className="text-xs text-gray-600 w-20">
                                {getServiceTypeName(usage.serviceType)}:
                              </span>
                              <span className="text-xs">
                                {usage.usageCount}/{usage.limitCount === 9999 ? "무제한" : usage.limitCount}
                              </span>
                              <button
                                onClick={() => updateUsage(user.id, "reset", usage.serviceType)}
                                disabled={actionLoading === `usage-${user.id}-${usage.serviceType}`}
                                className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 disabled:bg-gray-400"
                              >
                                리셋
                              </button>
                              <button
                                onClick={() => updateUsage(user.id, "unlimited", usage.serviceType)}
                                disabled={actionLoading === `usage-${user.id}-${usage.serviceType}`}
                                className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 disabled:bg-gray-400"
                              >
                                무제한
                              </button>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => updateUsage(user.id, "reset")}
                          disabled={actionLoading === `usage-${user.id}-all`}
                          className="text-sm bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 disabled:bg-gray-400"
                        >
                          전체 리셋
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 