import { SearchResult } from './search-engine';

export interface ToolTemplate {
  header: (date: Date, count: number) => string;
  intro: (category: string, tools: SearchResult[]) => string;
  toolItem: (tool: SearchResult, index: number) => string;
  footer: (tools: SearchResult[]) => string;
}

// 카테고리별 소개 문구 매핑
const CATEGORY_INTROS: Record<string, string> = {
  '3d': '3D 모델링과 애니메이션 제작에 특화된 AI 도구들을 소개해드립니다. 각 도구는 고유한 기능과 특징을 가지고 있어 다양한 3D 작업에 활용할 수 있습니다.',
  'marketing': '마케팅 캠페인과 브랜딩 전략을 강화할 수 있는 AI 도구들입니다. 콘텐츠 제작부터 분석까지 마케팅 전 과정을 지원합니다.',
  'nocode': '코딩 없이도 강력한 애플리케이션과 워크플로우를 구축할 수 있는 노코드 도구들입니다. 드래그 앤 드롭으로 누구나 쉽게 개발할 수 있습니다.',
  'ppt': '프레젠테이션 제작을 혁신적으로 간소화하는 AI 도구들입니다. 전문적인 슬라이드를 빠르고 효율적으로 만들 수 있습니다.',
  'image': '이미지 생성과 편집을 위한 최신 AI 도구들입니다. 창의적인 비주얼 콘텐츠를 손쉽게 제작할 수 있습니다.',
  'video': '영상 제작과 편집을 자동화하는 AI 도구들입니다. 전문가 수준의 비디오 콘텐츠를 빠르게 생산할 수 있습니다.',
  'text': '글쓰기와 콘텐츠 생성을 지원하는 AI 도구들입니다. 고품질 텍스트를 효율적으로 작성할 수 있습니다.',
  'audio': '음성 처리와 오디오 생성에 특화된 AI 도구들입니다. 음성 합성부터 음악 제작까지 다양한 오디오 작업을 지원합니다.',
  'code': '코딩과 개발 생산성을 향상시키는 AI 도구들입니다. 코드 작성, 디버깅, 리뷰를 자동화할 수 있습니다.',
  'design': '디자인 작업을 혁신하는 AI 도구들입니다. UI/UX 디자인부터 그래픽 디자인까지 창의적인 작업을 지원합니다.',
  'productivity': '업무 효율성을 극대화하는 AI 생산성 도구들입니다. 일상적인 작업을 자동화하고 시간을 절약할 수 있습니다.',
  'workflow': '워크플로우와 프로세스를 자동화하는 AI 도구들입니다. 복잡한 업무 흐름을 간소화하고 최적화할 수 있습니다.',
  'default': '요청하신 조건에 맞는 AI 도구들을 선별했습니다. 각 도구의 특징과 장점을 확인하고 목적에 맞게 활용해보세요.'
};

// 카테고리별 효과 문구 매핑
const CATEGORY_EFFECTS: Record<string, string[]> = {
  '3d': [
    '3D 모델링 시간이 대폭 단축됩니다',
    '복잡한 3D 작업이 간소화됩니다',
    '전문가 수준의 3D 콘텐츠를 제작할 수 있습니다',
    '3D 애니메이션 제작이 쉬워집니다',
    '실시간 3D 렌더링이 가능해집니다'
  ],
  'marketing': [
    '마케팅 ROI가 크게 향상됩니다',
    '타겟 고객에게 효과적으로 도달할 수 있습니다',
    '마케팅 캠페인 성과가 개선됩니다',
    '브랜드 인지도가 높아집니다',
    '고객 참여율이 증가합니다'
  ],
  'nocode': [
    '개발 시간이 90% 이상 단축됩니다',
    '기술 장벽 없이 앱을 만들 수 있습니다',
    '프로토타입을 빠르게 구현할 수 있습니다',
    '유지보수가 간편해집니다',
    '개발 비용이 크게 절감됩니다'
  ],
  'ppt': [
    '프레젠테이션 제작 시간이 절반으로 줄어듭니다',
    '전문적인 슬라이드를 쉽게 만들 수 있습니다',
    '시각적 임팩트가 강화됩니다',
    '일관된 디자인을 유지할 수 있습니다',
    '청중의 집중도가 높아집니다'
  ],
  'default': [
    '업무 효율성이 향상됩니다',
    '작업 시간이 단축됩니다',
    '품질이 개선됩니다',
    '생산성이 증가합니다',
    '비용이 절감됩니다'
  ]
};

export class TemplateEngine {
  /**
   * 동적 템플릿 생성
   */
  generateTemplate(category: string = 'default'): ToolTemplate {
    const normalizedCategory = category.toLowerCase();
    
    return {
      header: (date: Date, count: number) => {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return `${year}. ${month}. ${day}. 기준, 요청하신 조건에 맞춘 AI 도구 ${count}개 목록입니다.`;
      },

      intro: (cat: string, tools: SearchResult[]) => {
        const intro = CATEGORY_INTROS[cat] || CATEGORY_INTROS['default'];
        
        // 도구들의 매칭 이유를 요약
        const matchReasons = new Set<string>();
        tools.forEach(tool => {
          tool.matchReason?.forEach(reason => matchReasons.add(reason));
        });
        
        if (matchReasons.size > 0) {
          const reasonText = Array.from(matchReasons).slice(0, 3).join(', ');
          return `${intro}\n\n선정 기준: ${reasonText}`;
        }
        
        return intro;
      },

      toolItem: (tool: SearchResult, index: number) => {
        const reasons = tool.matchReason?.join(', ') || '추천 도구';
        
        // KR 뱃지와 효과 제거, 추천 강도 단순화
        const recommendation = tool.score >= 100 ? '⭐ 강력 추천' : 
                             tool.score >= 70 ? '✨ 추천' : 
                             '💡 추천';
        
        return `${index + 1}. ${tool.name} - ${recommendation}\n` +
               `   • 매칭: ${reasons}\n` +
               `   • 특징: ${tool.summary || '다양한 기능을 제공합니다'}`;
      },

      footer: (tools: SearchResult[]) => {
        const avgScore = tools.reduce((sum, t) => sum + t.score, 0) / tools.length;
        
        let footer = '\n---\n';
        
        if (avgScore >= 80) {
          footer += '✅ 매우 관련성 높은 도구들입니다.\n';
        } else if (avgScore >= 50) {
          footer += '✅ 관련성 있는 도구들입니다.\n';
        }
        
        footer += '\n💡 각 도구를 클릭하면 상세 정보를 확인할 수 있습니다.';
        
        return footer;
      }
    };
  }

  /**
   * 카테고리별 효과 문구 반환
   */
  private getEffect(category: string, index: number): string {
    const effects = CATEGORY_EFFECTS[category] || CATEGORY_EFFECTS['default'];
    return effects[index % effects.length];
  }

  /**
   * 전체 응답 텍스트 생성
   */
  generateResponse(
    tools: SearchResult[], 
    category: string = 'default',
    date: Date = new Date()
  ): string {
    const template = this.generateTemplate(category);
    
    const header = template.header(date, tools.length);
    const intro = template.intro(category, tools);
    const items = tools.map((tool, index) => template.toolItem(tool, index));
    const footer = template.footer(tools);
    
    return [header, '', intro, '', ...items, footer].join('\n');
  }
}

// 싱글톤 인스턴스
export const templateEngine = new TemplateEngine();
