import { getConnectionPool } from './db-pool';

// 기존 코드와의 호환성을 위한 래퍼 함수
export async function getConnection() {
  return getConnectionPool();
} 