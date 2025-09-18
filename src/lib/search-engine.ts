import { getConnection } from '@/lib/db';
import sql from 'mssql';
import { KOREAN_CATEGORY_SYNONYMS, KOREAN_FEATURE_SYNONYMS } from '@/config/koreanSynonyms';

export interface SearchResult {
  id: string;
  name: string;
  url: string;
  domain?: string;
  category: string;
  summary?: string;
  description?: string;
  iconUrl?: string;
  score: number;
  matchReason: string[];
  koreanSupport?: boolean;
  isKoreanService?: boolean;
  apiSupport?: boolean;
}

export interface SearchOptions {
  category?: string;
  limit?: number;
  includeScores?: boolean;
}

interface SearchPriority {
  level: number;
  field: string;
  weight: number;
  matchType: 'exact' | 'contains' | 'synonym';
}

const SEARCH_PRIORITIES: SearchPriority[] = [
  { level: 1, field: 'category',     weight: 100, matchType: 'exact' },
  { level: 2, field: 'tags',         weight: 80,  matchType: 'contains' },
  { level: 3, field: 'name',         weight: 60,  matchType: 'contains' },
  { level: 4, field: 'summary',      weight: 40,  matchType: 'contains' },
  { level: 5, field: 'description',  weight: 20,  matchType: 'contains' }
];

const SCORING_RULES = {
  categoryMatch: 100,      // 카테고리 일치
  tagExactMatch: 80,       // 태그 정확 일치
  tagSynonymMatch: 70,     // 태그 동의어 일치
  nameExactMatch: 60,      // 이름 정확 일치
  namePartialMatch: 50,    // 이름 부분 일치
  summaryMatch: 40,        // 한줄평 일치
  descriptionMatch: 20,    // 상세설명 일치
  koreanBonus: 10          // 한국어 서비스 보너스
};

export class PrioritySearchEngine {
  private pool: sql.ConnectionPool | null = null;

  async initialize() {
    this.pool = await getConnection();
  }

  /**
   * 한국어 동의어 확장
   */
  private expandKoreanSynonyms(query: string, category?: string): string[] {
    const synonyms = new Set<string>();
    synonyms.add(query.toLowerCase());

    // 카테고리 동의어 추가
    if (category) {
      const catSynonyms = KOREAN_CATEGORY_SYNONYMS[category.toLowerCase()] || [];
      catSynonyms.forEach(s => synonyms.add(s.toLowerCase()));
    }

    // 쿼리에서 키워드 추출 및 동의어 확장
    const words = query.split(/\s+/);
    words.forEach(word => {
      const wordLower = word.toLowerCase();
      
      // 카테고리 동의어 확인
      Object.entries(KOREAN_CATEGORY_SYNONYMS).forEach(([key, values]) => {
        if (values.includes(wordLower)) {
          values.forEach(v => synonyms.add(v.toLowerCase()));
        }
      });

      // 기능 동의어 확인
      Object.entries(KOREAN_FEATURE_SYNONYMS).forEach(([key, values]) => {
        if (values.includes(wordLower)) {
          values.forEach(v => synonyms.add(v.toLowerCase()));
        }
      });
    });

    return Array.from(synonyms);
  }

  /**
   * 우선순위별 검색 실행
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.pool) {
      await this.initialize();
    }

    const { category, limit = 10, includeScores = true } = options;
    const results = new Map<string, SearchResult>();
    const synonyms = this.expandKoreanSynonyms(query, category);

    console.log('[SEARCH_ENGINE] Query:', query);
    console.log('[SEARCH_ENGINE] Synonyms:', synonyms);
    console.log('[SEARCH_ENGINE] Category:', category);

    // Level 1: 카테고리 정확 매칭
    if (category) {
      const categoryResults = await this.searchByCategory(category);
      categoryResults.forEach(r => {
        results.set(r.id, {
          ...r,
          score: SCORING_RULES.categoryMatch,
          matchReason: ['카테고리 일치']
        });
      });
      console.log('[SEARCH_ENGINE] Category matches:', categoryResults.length);
    }

    // Level 2: 태그 검색 (한국어 동의어 포함)
    const tagResults = await this.searchByTags(synonyms);
    tagResults.forEach(r => {
      const existing = results.get(r.id);
      if (existing) {
        existing.score += SCORING_RULES.tagSynonymMatch;
        existing.matchReason.push('태그 매칭');
      } else {
        results.set(r.id, {
          ...r,
          score: SCORING_RULES.tagSynonymMatch,
          matchReason: ['태그 매칭']
        });
      }
    });
    console.log('[SEARCH_ENGINE] Tag matches:', tagResults.length);

    // Level 3: 이름 검색 - 3D 도구는 특별 처리
    let nameResults: SearchResult[] = [];
    if (category === '3d') {
      // 3D 도구들의 정확한 이름으로 직접 검색 (a1.art 제외 - 이미지 도구임)
      const threeDToolNames = ['meshy', 'cascadeur', 'avaturn', 'creatie', 'spline', 'luma ai', 'dora ai', 'sparc3d'];
      nameResults = await this.searchByName(threeDToolNames);
      console.log('[SEARCH_ENGINE] 3D specific name search:', nameResults.map(r => r.name));
    } else {
      nameResults = await this.searchByName(synonyms);
    }
    
    nameResults.forEach(r => {
      const existing = results.get(r.id);
      if (existing) {
        existing.score += SCORING_RULES.namePartialMatch;
        existing.matchReason.push('이름 매칭');
      } else {
        results.set(r.id, {
          ...r,
          score: SCORING_RULES.namePartialMatch,
          matchReason: ['이름 매칭']
        });
      }
    });
    console.log('[SEARCH_ENGINE] Name matches:', nameResults.length);

    // Level 4: 한줄평(summary) 검색
    const summaryResults = await this.searchBySummary(synonyms);
    summaryResults.forEach(r => {
      const existing = results.get(r.id);
      if (existing) {
        existing.score += SCORING_RULES.summaryMatch;
        existing.matchReason.push('한줄평 매칭');
      } else {
        results.set(r.id, {
          ...r,
          score: SCORING_RULES.summaryMatch,
          matchReason: ['한줄평 매칭']
        });
      }
    });
    console.log('[SEARCH_ENGINE] Summary matches:', summaryResults.length);

    // Level 5: 상세설명(description) 검색
    const descResults = await this.searchByDescription(synonyms);
    descResults.forEach(r => {
      const existing = results.get(r.id);
      if (existing) {
        existing.score += SCORING_RULES.descriptionMatch;
        existing.matchReason.push('상세설명 매칭');
      } else {
        results.set(r.id, {
          ...r,
          score: SCORING_RULES.descriptionMatch,
          matchReason: ['상세설명 매칭']
        });
      }
    });
    console.log('[SEARCH_ENGINE] Description matches:', descResults.length);

    // 한국어 서비스 보너스 적용
    results.forEach(r => {
      if (r.koreanSupport || r.isKoreanService) {
        r.score += SCORING_RULES.koreanBonus;
        r.matchReason.push('한국어 지원');
      }
    });

    // 스코어 기준 정렬
    const sortedResults = Array.from(results.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    console.log('[SEARCH_ENGINE] Final results:', sortedResults.length);
    console.log('[SEARCH_ENGINE] Top 3 scores:', sortedResults.slice(0, 3).map(r => ({ name: r.name, score: r.score, reasons: r.matchReason })));

    return includeScores ? sortedResults : sortedResults.map(r => ({ ...r, score: 0 }));
  }

  /**
   * 카테고리별 검색 - 카테고리 필드가 정확히 일치하는 것만
   */
  private async searchByCategory(category: string): Promise<SearchResult[]> {
    if (!this.pool) throw new Error('Database not initialized');

    const req = this.pool.request();
    
    // 3D는 카테고리가 없으므로 빈 배열 반환
    if (category === '3d') {
      console.log('[SEARCH_ENGINE] 3D has no category field, returning empty');
      return [];
    }
    
    req.input('category', sql.NVarChar, category.toLowerCase());
    const query = `
      SELECT TOP 100
        s.id, s.name, s.url, s.domain, s.primary_category as category,
        s.summary, s.description, s.icon_url as iconUrl,
        s.korean_support as koreanSupport, s.is_korean_service as isKoreanService,
        s.api_support as apiSupport
      FROM dbo.ai_services s
      WHERE LOWER(s.primary_category) = @category
      ORDER BY s.name ASC
    `;

    const { recordset } = await req.query(query);
    console.log(`[SEARCH_ENGINE] Category search for '${category}' found:`, recordset.length, 'tools');
    return recordset.map(r => ({ ...r, score: 0, matchReason: [] }));
  }

  /**
   * 이름별 검색 - 도구 이름에 동의어가 포함된 경우
   */
  private async searchByName(synonyms: string[]): Promise<SearchResult[]> {
    if (!this.pool) throw new Error('Database not initialized');
    
    const req = this.pool.request();
    const conditions: string[] = [];
    
    synonyms.slice(0, 10).forEach((syn, i) => {
      const param = `name${i}`;
      req.input(param, sql.NVarChar, `%${syn}%`);
      conditions.push(`LOWER(s.name) LIKE @${param}`);
    });
    
    if (conditions.length === 0) return [];
    
    const query = `
      SELECT TOP 100
        s.id, s.name, s.url, s.domain, s.primary_category as category,
        s.summary, s.description, s.icon_url as iconUrl,
        s.korean_support as koreanSupport, s.is_korean_service as isKoreanService,
        s.api_support as apiSupport
      FROM dbo.ai_services s
      WHERE ${conditions.join(' OR ')}
      ORDER BY s.name ASC
    `;
    
    const { recordset } = await req.query(query);
    return recordset.map(r => ({ ...r, score: 0, matchReason: [] }));
  }

  /**
   * 태그별 검색
   */
  private async searchByTags(synonyms: string[]): Promise<SearchResult[]> {
    if (!this.pool) throw new Error('Database not initialized');

    const req = this.pool.request();
    const conditions: string[] = [];

    synonyms.slice(0, 10).forEach((syn, i) => {
      const param = `tag${i}`;
      req.input(param, sql.NVarChar, `%${syn}%`);
      conditions.push(`LOWER(t.tag) LIKE @${param}`);
    });

    if (conditions.length === 0) return [];

    const query = `
      SELECT DISTINCT TOP 100
        s.id, s.name, s.url, s.domain, s.primary_category as category,
        s.summary, s.description, s.icon_url as iconUrl,
        s.korean_support as koreanSupport, s.is_korean_service as isKoreanService,
        s.api_support as apiSupport
      FROM dbo.ai_services s
      INNER JOIN dbo.ai_service_tags t ON s.id = t.service_id
      WHERE ${conditions.join(' OR ')}
      ORDER BY s.name ASC
    `;

    const { recordset } = await req.query(query);
    return recordset.map(r => ({ ...r, score: 0, matchReason: [] }));
  }

  

  /**
   * 한줄평별 검색
   */
  private async searchBySummary(synonyms: string[]): Promise<SearchResult[]> {
    if (!this.pool) throw new Error('Database not initialized');

    const req = this.pool.request();
    const conditions: string[] = [];

    synonyms.slice(0, 10).forEach((syn, i) => {
      const param = `summary${i}`;
      req.input(param, sql.NVarChar, `%${syn}%`);
      conditions.push(`LOWER(ISNULL(s.summary, '')) LIKE @${param}`);
    });

    if (conditions.length === 0) return [];

    const query = `
      SELECT TOP 100
        s.id, s.name, s.url, s.domain, s.primary_category as category,
        s.summary, s.description, s.icon_url as iconUrl,
        s.korean_support as koreanSupport, s.is_korean_service as isKoreanService,
        s.api_support as apiSupport
      FROM dbo.ai_services s
      WHERE ${conditions.join(' OR ')}
      ORDER BY s.name ASC
    `;

    const { recordset } = await req.query(query);
    return recordset.map(r => ({ ...r, score: 0, matchReason: [] }));
  }

  /**
   * 상세설명별 검색
   */
  private async searchByDescription(synonyms: string[]): Promise<SearchResult[]> {
    if (!this.pool) throw new Error('Database not initialized');

    const req = this.pool.request();
    const conditions: string[] = [];

    synonyms.slice(0, 10).forEach((syn, i) => {
      const param = `desc${i}`;
      req.input(param, sql.NVarChar, `%${syn}%`);
      conditions.push(`LOWER(ISNULL(s.description, '')) LIKE @${param}`);
    });

    if (conditions.length === 0) return [];

    const query = `
      SELECT TOP 100
        s.id, s.name, s.url, s.domain, s.primary_category as category,
        s.summary, s.description, s.icon_url as iconUrl,
        s.korean_support as koreanSupport, s.is_korean_service as isKoreanService,
        s.api_support as apiSupport
      FROM dbo.ai_services s
      WHERE ${conditions.join(' OR ')}
      ORDER BY s.name ASC
    `;

    const { recordset } = await req.query(query);
    return recordset.map(r => ({ ...r, score: 0, matchReason: [] }));
  }
}

// 싱글톤 인스턴스
export const searchEngine = new PrioritySearchEngine();