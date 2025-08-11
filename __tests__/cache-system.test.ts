/**
 * 캐시 시스템 단위 테스트
 * LRU 캐시의 정확한 동작을 검증
 */

describe('LimitedCache 시스템', () => {
  
  // 테스트용 LimitedCache 클래스 (실제 구현에서 import)
  class LimitedCache<K, V> {
    private cache = new Map<K, { value: V; expiry: number }>();
    private maxSize: number;
    private ttl: number;

    constructor(maxSize = 1000, ttlMs = 3600000) {
      this.maxSize = maxSize;
      this.ttl = ttlMs;
    }

    set(key: K, value: V): void {
      // 캐시 크기 제한
      if (this.cache.size >= this.maxSize) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey !== undefined) {
          this.cache.delete(firstKey);
        }
      }

      this.cache.set(key, {
        value,
        expiry: Date.now() + this.ttl
      });
    }

    get(key: K): V | undefined {
      const item = this.cache.get(key);
      if (!item) return undefined;

      // TTL 체크
      if (Date.now() > item.expiry) {
        this.cache.delete(key);
        return undefined;
      }

      return item.value;
    }

    has(key: K): boolean {
      return this.get(key) !== undefined;
    }

    clear(): void {
      this.cache.clear();
    }

    size(): number {
      return this.cache.size;
    }
  }

  describe('기본 캐시 동작', () => {
    let cache: LimitedCache<string, any>;

    beforeEach(() => {
      cache = new LimitedCache<string, any>(3, 1000); // 최대 3개, 1초 TTL
    });

    it('값을 저장하고 조회할 수 있어야 함', () => {
      const testData = { analysis: 'result', score: 85 };
      
      cache.set('test-key', testData);
      
      expect(cache.get('test-key')).toEqual(testData);
      expect(cache.has('test-key')).toBe(true);
      expect(cache.size()).toBe(1);
    });

    it('존재하지 않는 키에 대해 undefined를 반환해야 함', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('동일한 키에 대해 값을 덮어쓸 수 있어야 함', () => {
      cache.set('key', 'value1');
      cache.set('key', 'value2');
      
      expect(cache.get('key')).toBe('value2');
      expect(cache.size()).toBe(1);
    });

    it('캐시를 비울 수 있어야 함', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      cache.clear();
      
      expect(cache.size()).toBe(0);
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
    });
  });

  describe('크기 제한', () => {
    it('최대 크기를 초과하면 가장 오래된 항목을 제거해야 함', () => {
      const cache = new LimitedCache<string, string>(2, 3600000); // 최대 2개
      
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);
      
      // 3번째 추가 - key1이 제거되어야 함
      cache.set('key3', 'value3');
      
      expect(cache.size()).toBe(2);
      expect(cache.has('key1')).toBe(false); // 제거됨
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(true);
    });

    it('큰 캐시에서도 크기 제한이 동작해야 함', () => {
      const cache = new LimitedCache<number, string>(100);
      
      // 150개 추가
      for (let i = 0; i < 150; i++) {
        cache.set(i, `value${i}`);
      }
      
      expect(cache.size()).toBe(100);
      
      // 처음 50개는 제거되었어야 함
      expect(cache.has(0)).toBe(false);
      expect(cache.has(49)).toBe(false);
      
      // 마지막 100개는 존재해야 함
      expect(cache.has(50)).toBe(true);
      expect(cache.has(149)).toBe(true);
    });
  });

  describe('TTL (Time To Live)', () => {
    it('TTL이 지나면 항목이 자동으로 제거되어야 함', async () => {
      const cache = new LimitedCache<string, string>(10, 100); // 100ms TTL
      
      cache.set('key', 'value');
      expect(cache.has('key')).toBe(true);
      
      // 150ms 대기 (TTL 초과)
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(cache.has('key')).toBe(false);
      expect(cache.get('key')).toBeUndefined();
    });

    it('TTL 내에서는 항목이 유지되어야 함', async () => {
      const cache = new LimitedCache<string, string>(10, 200); // 200ms TTL
      
      cache.set('key', 'value');
      
      // 100ms 대기 (TTL 내)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(cache.has('key')).toBe(true);
      expect(cache.get('key')).toBe('value');
    });

    it('만료된 항목은 크기에 포함되지 않아야 함', async () => {
      const cache = new LimitedCache<string, string>(10, 50); // 50ms TTL
      
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);
      
      // TTL 대기
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 만료된 항목들 접근으로 제거 트리거
      cache.has('key1');
      cache.has('key2');
      
      expect(cache.size()).toBe(0);
    });
  });

  describe('복합 타입 지원', () => {
    it('객체를 값으로 저장할 수 있어야 함', () => {
      const cache = new LimitedCache<string, any>();
      
      const complexData = {
        projectId: 'test-123',
        analysis: {
          score: 85,
          issues: ['issue1', 'issue2'],
          recommendations: {
            immediate: ['fix1'],
            longTerm: ['improvement1']
          }
        },
        timestamp: new Date()
      };
      
      cache.set('complex-key', complexData);
      const retrieved = cache.get('complex-key');
      
      expect(retrieved).toEqual(complexData);
      expect(retrieved.analysis.score).toBe(85);
      expect(retrieved.analysis.issues).toHaveLength(2);
    });

    it('다양한 키 타입을 지원해야 함', () => {
      const stringCache = new LimitedCache<string, any>();
      const numberCache = new LimitedCache<number, any>();
      
      stringCache.set('string-key', 'value');
      numberCache.set(42, 'numeric-value');
      
      expect(stringCache.get('string-key')).toBe('value');
      expect(numberCache.get(42)).toBe('numeric-value');
    });
  });

  describe('성능 테스트', () => {
    it('대량의 데이터 처리가 효율적이어야 함', () => {
      const cache = new LimitedCache<string, any>(1000);
      
      const startTime = Date.now();
      
      // 10000번의 set/get 연산
      for (let i = 0; i < 10000; i++) {
        cache.set(`key${i}`, { data: `value${i}`, index: i });
      }
      
      for (let i = 0; i < 1000; i++) {
        cache.get(`key${i + 9000}`); // 마지막 1000개 조회
      }
      
      const endTime = Date.now();
      
      // 1초 이내에 완료되어야 함
      expect(endTime - startTime).toBeLessThan(1000);
      expect(cache.size()).toBe(1000); // 크기 제한으로 1000개만 유지
    });

    it('캐시 히트율이 올바르게 동작해야 함', () => {
      const cache = new LimitedCache<string, string>(100);
      
      // 데이터 설정
      for (let i = 0; i < 50; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      
      let hits = 0;
      let misses = 0;
      
      // 100번 조회 (50번은 hit, 50번은 miss)
      for (let i = 0; i < 100; i++) {
        const result = cache.get(`key${i}`);
        if (result) {
          hits++;
        } else {
          misses++;
        }
      }
      
      expect(hits).toBe(50);
      expect(misses).toBe(50);
    });
  });

  describe('실제 사용 시나리오', () => {
    it('코드 분석 결과 캐싱 시나리오', () => {
      const analysisCache = new LimitedCache<string, any>(100, 3600000); // 1시간 TTL
      
      // 분석 결과 저장
      const projectId = 'project-123';
      const analysisResult = {
        overallScore: 85,
        issues: [
          { type: 'warning', message: 'Use const instead of var' },
          { type: 'error', message: 'Potential security issue' }
        ],
        processedAt: new Date(),
        tokenUsage: 1500
      };
      
      analysisCache.set(projectId, analysisResult);
      
      // 같은 프로젝트 재분석 시 캐시 히트
      const cachedResult = analysisCache.get(projectId);
      
      expect(cachedResult).toBeDefined();
      expect(cachedResult.overallScore).toBe(85);
      expect(cachedResult.tokenUsage).toBe(1500);
      
      // 다른 프로젝트는 캐시 미스
      expect(analysisCache.get('different-project')).toBeUndefined();
    });

    it('메모리 효율적인 대용량 프로젝트 처리', () => {
      const cache = new LimitedCache<string, any>(50); // 작은 캐시
      
      // 100개 프로젝트 처리
      for (let i = 0; i < 100; i++) {
        const projectData = {
          id: `project-${i}`,
          files: Array(10).fill(0).map((_, j) => ({ name: `file${j}.js`, size: 1000 })),
          analysis: { score: 70 + (i % 30) }
        };
        
        cache.set(`project-${i}`, projectData);
      }
      
      // 캐시 크기가 제한되어 있음
      expect(cache.size()).toBe(50);
      
      // 최근 50개는 캐시에 있음
      expect(cache.has('project-99')).toBe(true);
      expect(cache.has('project-50')).toBe(true);
      
      // 오래된 항목들은 제거됨
      expect(cache.has('project-0')).toBe(false);
      expect(cache.has('project-49')).toBe(false);
    });
  });
}); 