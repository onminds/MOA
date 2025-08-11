import sql from 'mssql';
import { getConnectionPool } from './db-pool';

// 기존 코드와의 호환성을 위한 래퍼 함수
export async function getConnection(): Promise<sql.ConnectionPool> {
  try {
    // 먼저 db-pool을 시도
    const pool = await getConnectionPool();
    return pool;
  } catch (err) {
    console.log('db-pool 연결 실패, 직접 연결 시도:', err);
    
    // 환경 변수 검증
    if (!process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_SERVER || !process.env.DB_NAME) {
      throw new Error('데이터베이스 연결 정보가 환경 변수에 설정되지 않았습니다.');
    }
    
    const config: sql.config = {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      server: process.env.DB_SERVER,
      port: parseInt(process.env.DB_PORT || '1433'),
      database: process.env.DB_NAME,
      options: {
        encrypt: true,
        trustServerCertificate: true
      }
    };
    
    const pool = await sql.connect(config);
    return pool;
  }
} 