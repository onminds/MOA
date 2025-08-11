import sql from 'mssql';

// 전역 연결 풀 인스턴스
let pool: sql.ConnectionPool | null = null;
let isInitializing = false;
let initPromise: Promise<sql.ConnectionPool> | null = null;

// 연결 풀 설정
const poolConfig: sql.config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: {
    max: 10, // 최대 연결 수
    min: 0,  // 최소 연결 수
    idleTimeoutMillis: 30000, // 30초 후 유휴 연결 종료
    acquireTimeoutMillis: 30000, // 30초 내 연결 획득 실패 시 타임아웃
    createTimeoutMillis: 30000, // 30초 내 연결 생성 실패 시 타임아웃
    destroyTimeoutMillis: 5000, // 5초 내 연결 종료
    reapIntervalMillis: 1000, // 1초마다 유휴 연결 정리
    createRetryIntervalMillis: 200, // 연결 재시도 간격
  },
};

/**
 * 데이터베이스 연결 풀을 초기화합니다.
 */
async function initializePool(): Promise<sql.ConnectionPool> {
  if (pool) {
    return pool;
  }

  if (isInitializing && initPromise) {
    return initPromise;
  }

  isInitializing = true;
  initPromise = createPool();

  try {
    pool = await initPromise;
    console.log('데이터베이스 연결 풀 초기화 완료');
    return pool;
  } catch (error) {
    console.error('데이터베이스 연결 풀 초기화 실패:', error);
    isInitializing = false;
    initPromise = null;
    throw error;
  }
}

/**
 * 새로운 연결 풀을 생성합니다.
 */
async function createPool(): Promise<sql.ConnectionPool> {
  // 환경 변수 검증
  if (!process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_SERVER || !process.env.DB_NAME) {
    throw new Error('데이터베이스 연결 정보가 환경 변수에 설정되지 않았습니다.');
  }

  try {
    const newPool = await sql.connect(poolConfig);
    
    // 연결 풀 이벤트 리스너 설정
    newPool.on('error', (err) => {
      console.error('데이터베이스 연결 풀 오류:', err);
      // 연결 풀 오류 시 재초기화
      pool = null;
      isInitializing = false;
      initPromise = null;
    });

    return newPool;
  } catch (error) {
    console.error('데이터베이스 연결 실패:', error);
    throw error;
  }
}

/**
 * 데이터베이스 연결 풀을 가져옵니다.
 */
export async function getConnectionPool(): Promise<sql.ConnectionPool> {
  if (!pool) {
    return initializePool();
  }

  // 연결 풀이 유효한지 확인
  try {
    await pool.request().query('SELECT 1');
    return pool;
  } catch (error) {
    console.warn('기존 연결 풀이 유효하지 않음, 재초기화 중...');
    pool = null;
    isInitializing = false;
    initPromise = null;
    return initializePool();
  }
}

/**
 * 데이터베이스 연결을 안전하게 종료합니다.
 */
export async function closePool(): Promise<void> {
  if (pool) {
    try {
      await pool.close();
      console.log('데이터베이스 연결 풀 종료 완료');
    } catch (error) {
      console.error('데이터베이스 연결 풀 종료 중 오류:', error);
    } finally {
      pool = null;
      isInitializing = false;
      initPromise = null;
    }
  }
}

/**
 * 트랜잭션을 실행합니다.
 */
export async function executeTransaction<T>(
  callback: (transaction: sql.Transaction) => Promise<T>
): Promise<T> {
  const pool = await getConnectionPool();
  const transaction = new sql.Transaction(pool);
  
  try {
    await transaction.begin();
    const result = await callback(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/**
 * 쿼리를 실행합니다.
 */
export async function executeQuery<T = any>(
  query: string,
  params?: Record<string, any>
): Promise<T[]> {
  const pool = await getConnectionPool();
  const request = pool.request();
  
  // 파라미터 바인딩
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value);
    });
  }
  
  const result = await request.query(query);
  return result.recordset;
}

/**
 * 단일 결과를 조회합니다.
 */
export async function executeQuerySingle<T = any>(
  query: string,
  params?: Record<string, any>
): Promise<T | null> {
  const results = await executeQuery<T>(query, params);
  return results.length > 0 ? results[0] : null;
}

// 프로세스 종료 시 연결 풀 정리
process.on('SIGINT', async () => {
  console.log('프로세스 종료 중, 데이터베이스 연결 풀 정리...');
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('프로세스 종료 중, 데이터베이스 연결 풀 정리...');
  await closePool();
  process.exit(0);
}); 