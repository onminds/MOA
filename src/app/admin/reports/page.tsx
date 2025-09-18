'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import { AlertTriangle, Eye, CheckCircle, XCircle, Clock, Filter, Trash2 } from 'lucide-react';

interface Report {
  target_type: 'post' | 'comment';
  target_id: number;
  first_reported_at: string;
  last_reported_at: string;
  report_count: number;
  reporters: string; // "이름1 (이메일1); 이름2 (이메일2)"
  reasons: string; // "스팸/홍보, 부적절한 내용"
  statuses: string; // "pending, reviewed"
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // 관리자 권한 확인
  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session?.user?.id) {
      router.push('/auth/signin');
      return;
    }

    if (session.user.role !== 'ADMIN') {
      alert('관리자 권한이 필요합니다.');
      router.push('/');
      return;
    }

    fetchReports();
  }, [session, status, router, statusFilter, pagination.page]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(statusFilter && { status: statusFilter })
      });

      const response = await fetch(`/api/community/reports?${params}`);
      const data = await response.json();

      if (response.ok) {
        setReports(data.reports);
        setPagination(data.pagination);
      } else {
        alert('신고 목록을 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('신고 목록 조회 오류:', error);
      alert('신고 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (targetType: string, targetId: number, newStatus: string) => {
    if (!confirm(`이 신고 그룹의 상태를 "${getStatusText(newStatus)}"로 변경하시겠습니까?\n\n같은 대상에 대한 모든 신고가 함께 변경됩니다.`)) {
      return;
    }

    try {
      // 해당 그룹의 모든 신고 상태를 변경
      const response = await fetch(`/api/community/reports/bulk-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetType,
          targetId,
          reason: null, // reason을 null로 설정하여 모든 신고를 대상으로 함
          status: newStatus,
          adminNotes: null
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert(data.message);
        // 신고 목록 새로고침
        fetchReports();
        // 상세 모달 닫기
        setShowDetailModal(false);
        setSelectedReport(null);
      } else {
        alert(data.error || '신고 상태 변경에 실패했습니다.');
      }
    } catch (error) {
      console.error('신고 상태 변경 오류:', error);
      alert('신고 상태 변경 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteReport = async (targetType: string, targetId: number) => {
    if (!confirm(`이 신고 그룹을 완전히 삭제하시겠습니까?\n\n같은 대상에 대한 모든 신고가 영구적으로 삭제됩니다.\n\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/community/reports/bulk-delete?targetType=${targetType}&targetId=${targetId}&reason=all`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        alert(data.message);
        // 신고 목록 새로고침
        fetchReports();
        // 상세 모달 닫기
        setShowDetailModal(false);
        setSelectedReport(null);
      } else {
        alert(data.error || '신고 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('신고 삭제 오류:', error);
      alert('신고 삭제 중 오류가 발생했습니다.');
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '대기중';
      case 'reviewed': return '검토중';
      case 'resolved': return '해결됨';
      case 'dismissed': return '기각됨';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'reviewed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'resolved': return 'bg-green-100 text-green-800 border-green-200';
      case 'dismissed': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getReasonText = (reason: string) => {
    const reasonMap: { [key: string]: string } = {
      'spam': '스팸/홍보',
      'inappropriate': '부적절한 내용',
      'copyright': '저작권 침해',
      'harassment': '괴롭힘/모욕',
      'fake_news': '허위정보',
      'other': '기타'
    };
    return reasonMap[reason] || reason;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    // 서버 시간을 한국 시간으로 변환 (9시간 차이 보정 - 빼기)
    const koreanTime = new Date(date.getTime() - (9 * 60 * 60 * 1000));
    
    return koreanTime.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Seoul'
    });
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleStatusFilterChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const openDetailModal = (report: Report) => {
    setSelectedReport(report);
    setShowDetailModal(true);
  };

  if (status === 'loading' || loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <svg className="animate-spin h-8 w-8 text-gray-400" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <span className="text-gray-400">로딩 중...</span>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-6">
          {/* 헤더 */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-8 h-8 text-red-500" />
              <h1 className="text-3xl font-bold text-gray-900">신고 관리</h1>
            </div>
            <p className="text-gray-600">커뮤니티 신고를 관리하고 처리하세요.</p>
          </div>

          {/* 필터 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">상태 필터:</span>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => handleStatusFilterChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">전체</option>
                <option value="pending">대기중</option>
                <option value="reviewed">검토중</option>
                <option value="resolved">해결됨</option>
                <option value="dismissed">기각됨</option>
              </select>
            </div>
          </div>

          {/* 신고 목록 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      신고 정보
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      신고자
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      신고일
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reports.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        신고 내역이 없습니다.
                      </td>
                    </tr>
                  ) : (
                                                             reports.map((report, index) => (
                      <tr key={`${report.target_type}-${report.target_id}-${index}`} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-gray-900">
                                {report.target_type === 'post' ? '게시글' : '댓글'} #{report.target_id}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600">
                              사유: {report.reasons.split(', ').map(reason => getReasonText(reason)).join(', ')}
                            </div>
                          </div>
                        </td>
                                                 <td className="px-6 py-4">
                           <div className="text-sm">
                             <div className="font-medium text-gray-900">
                               {report.report_count}명의 신고자
                             </div>
                             <details className="mt-1">
                               <summary className="cursor-pointer text-blue-600 hover:text-blue-800 text-xs">
                                 신고자 목록 보기
                               </summary>
                               <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                                 {report.reporters.split('; ').map((reporter, reporterIndex) => {
                                   const parts = reporter.split(' - ');
                                   const userInfo = parts[0];
                                   const description = parts[1];
                                   
                                   return (
                                     <div key={`reporter-${reporterIndex}`} className="mb-2 p-2 bg-white rounded border">
                                       <div className="font-medium text-gray-900">{userInfo}</div>
                                                                               {description && (
                                          <div className="mt-1 text-gray-600 text-xs">
                                            <span className="font-medium">상세 설명:</span> {description}
                                          </div>
                                        )}
                                     </div>
                                   );
                                 })}
                               </div>
                             </details>
                           </div>
                         </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {report.statuses.split(', ').map((status, statusIndex) => (
                              <span key={statusIndex} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(status)}`}>
                                {getStatusText(status)}
                              </span>
                            ))}
                          </div>
                        </td>
                                                 <td className="px-6 py-4 text-sm text-gray-500">
                           <div>
                             <div>최초: {formatDateTime(report.first_reported_at)}</div>
                             <div>최근: {formatDateTime(report.last_reported_at)}</div>
                           </div>
                         </td>
                                                 <td className="px-6 py-4">
                           <div className="flex items-center gap-2">
                             <button
                               onClick={() => openDetailModal(report)}
                               className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
                             >
                               <Eye className="w-4 h-4" />
                               상세보기
                             </button>
                             <button
                               onClick={() => handleDeleteReport(report.target_type, report.target_id)}
                               className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                             >
                               <Trash2 className="w-4 h-4" />
                               삭제
                             </button>
                           </div>
                         </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 페이지네이션 */}
          {pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                총 {pagination.total}개의 신고 중 {(pagination.page - 1) * pagination.limit + 1}-
                {Math.min(pagination.page * pagination.limit, pagination.total)}개 표시
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  이전
                </button>
                <span className="px-3 py-2 text-sm text-gray-700">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  다음
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 상세 모달 */}
      {showDetailModal && selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">신고 상세 정보</h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
                             <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">신고 대상</label>
                   <div className="flex items-center gap-2">
                     <p className="text-sm text-gray-900">
                       {selectedReport.target_type === 'post' ? '게시글' : '댓글'} #{selectedReport.target_id}
                     </p>
                     <a
                       href={selectedReport.target_type === 'post' 
                         ? `/community/${selectedReport.target_id}` 
                         : `/community/${selectedReport.target_id}#comment-${selectedReport.target_id}`
                       }
                       target="_blank"
                       rel="noopener noreferrer"
                       className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                     >
                       <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                       </svg>
                       보기
                     </a>
                   </div>
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">신고 사유</label>
                   <p className="text-sm text-gray-900">{selectedReport.reasons.split(', ').map(reason => getReasonText(reason)).join(', ')}</p>
                 </div>
                                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
                   <div className="flex flex-wrap gap-1">
                     {selectedReport.statuses.split(', ').map((status, statusIndex) => (
                       <span key={statusIndex} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(status)}`}>
                         {getStatusText(status)}
                       </span>
                     ))}
                   </div>
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">신고 횟수</label>
                   <p className="text-sm text-gray-900">{selectedReport.report_count}회</p>
                 </div>
              </div>

                             <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">신고자 정보</label>
                 <div className="bg-gray-50 rounded-md p-3">
                   <div className="text-sm text-gray-900 mb-2">
                     총 {selectedReport.report_count}명의 사용자가 신고했습니다.
                   </div>
                   <details>
                     <summary className="cursor-pointer text-blue-600 hover:text-blue-800 text-sm font-medium">
                       신고자 목록 보기
                     </summary>
                     <div className="mt-2 space-y-2">
                       {selectedReport.reporters.split('; ').map((reporter, reporterIndex) => {
                         const parts = reporter.split(' - ');
                         const userInfo = parts[0];
                         const description = parts[1];
                         
                         return (
                           <div key={`detail-reporter-${reporterIndex}`} className="p-2 bg-white rounded border">
                             <div className="text-sm font-medium text-gray-900">{userInfo}</div>
                                                           {description && (
                                <div className="mt-1 text-sm text-gray-600">
                                  <span className="font-medium">상세 설명:</span> {description}
                                </div>
                              )}
                           </div>
                         );
                       })}
                     </div>
                   </details>
                 </div>
               </div>

               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">신고 기간</label>
                 <div className="bg-gray-50 rounded-md p-3">
                   <p className="text-sm text-gray-900">최초 신고: {formatDateTime(selectedReport.first_reported_at)}</p>
                   <p className="text-sm text-gray-900">최근 신고: {formatDateTime(selectedReport.last_reported_at)}</p>
                 </div>
               </div>

                             {/* 상태 변경 버튼들 */}
               <div className="border-t pt-4">
                 <h3 className="text-sm font-medium text-gray-700 mb-3">상태 변경</h3>
                 <div className="flex gap-2">
                   <button
                     onClick={() => handleStatusChange(selectedReport.target_type, selectedReport.target_id, 'reviewed')}
                     className="flex items-center gap-1 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                   >
                     <Clock className="w-4 h-4" />
                     검토중
                   </button>
                   <button
                     onClick={() => handleStatusChange(selectedReport.target_type, selectedReport.target_id, 'resolved')}
                     className="flex items-center gap-1 px-3 py-2 text-sm bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
                   >
                     <CheckCircle className="w-4 h-4" />
                     해결됨
                   </button>
                   <button
                     onClick={() => handleStatusChange(selectedReport.target_type, selectedReport.target_id, 'dismissed')}
                     className="flex items-center gap-1 px-3 py-2 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                   >
                     <XCircle className="w-4 h-4" />
                     기각됨
                   </button>
                 </div>
               </div>

               {/* 삭제 버튼 */}
               <div className="border-t pt-4">
                 <h3 className="text-sm font-medium text-gray-700 mb-3">신고 삭제</h3>
                                   <button
                    onClick={() => handleDeleteReport(selectedReport.target_type, selectedReport.target_id)}
                    className="flex items-center gap-1 px-3 py-2 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    신고 그룹 삭제
                  </button>
                 <p className="text-xs text-gray-500 mt-1">
                   이 작업은 되돌릴 수 없습니다. 신중하게 진행해주세요.
                 </p>
               </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
