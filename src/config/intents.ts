export type IntentKey = 'ppt_generate' | 'image_generate' | 'tool_search' | 'doc_create' | 'email_write';

export type IntentConfig = {
  nouns: string[];
  verbs: string[];
  negative?: RegExp[];
  slots: string[];
  chips: { label: string; send: string }[];
  replyTemplate?: {
    intro?: string; // 상단 한 줄
    bullets?: string[]; // 핵심 항목 라벨
    outro?: string; // 마무리 한 줄
  };
};

export const INTENT_REGISTRY: Record<IntentKey, IntentConfig> = {
  ppt_generate: {
    nouns: ['ppt', '피피티', '슬라이드', '발표자료', '프레젠'],
    verbs: ['만들', '제작', '생성', '초안', '템플릿'],
    slots: ['topic', 'slides', 'tone', 'language'],
    chips: [
      { label: '10장', send: 'ppt 10장으로 만들어줘' },
      { label: '격식 톤', send: 'ppt 10장 격식 톤으로 만들어줘' },
      { label: '친근 톤', send: 'ppt 10장 친근 톤으로 만들어줘' },
      { label: '생성 페이지', send: '__NAV__/ppt-create' }
    ],
    replyTemplate: {
      intro: '바로 슬라이드 초안을 만들어볼게요.',
      bullets: ['주제', '분량(장수)', '톤(격식/친근)', '언어'],
      outro: '필요하면 템플릿/브랜드 요소도 맞춰 드릴게요.'
    }
  },
  image_generate: {
    nouns: ['이미지', '사진', '그림', '로고', '썸네일'],
    verbs: ['생성', '만들', '제작', '그려', '디자인'],
    slots: ['prompt', 'style', 'size', 'format'],
    chips: [
      { label: '실사 스타일', send: '실사 스타일로 이미지 만들어줘' },
      { label: '로고', send: '로고 이미지를 만들어줘' },
      { label: '1024×1024', send: '1024x1024 사이즈로 만들어줘' },
      { label: '이미지 생성 페이지', send: '__NAV__/image-create' }
    ],
    replyTemplate: {
      intro: '이미지를 바로 만들어볼게요.',
      bullets: ['간단한 설명', '스타일(실사/애니/3D)', '사이즈', '형식(PNG/JPG)'],
      outro: '원하시면 참고 이미지 URL도 알려주세요.'
    }
  },
  tool_search: {
    nouns: ['툴', '도구', '서비스', 'ai', '플랫폼'],
    verbs: ['추천', '찾', '알려', '검색'],
    slots: ['category', 'price', 'features', 'count'],
    chips: [
      // 라벨은 런타임에서 실제 카테고리명으로 치환되는 랜덤 버튼을 유사하게 구성
      { label: '영상', send: '영상 ai 툴 추천해줘' },
      { label: '가격: 무료', send: '무료 ai 툴 추천해줘' },
      { label: '가격: 유료', send: '유료 ai 툴 추천해줘' },
      { label: 'API 연동', send: 'API 제공되는 ai 툴 추천해줘' },
      // 항상 마지막: 내비게이션 칩(프론트에서 파란색 스타일 처리)
      { label: 'AI 목록으로 이동', send: '__NAV__/ai-list' }
    ],
    replyTemplate: {
      intro: '요구에 맞는 AI 툴을 골라드릴게요.',
      bullets: ['카테고리', '가격(무료/유료)', '필수 기능', '개수'],
      outro: '필터 기준이 애매하면 먼저 5개로 시작해 볼게요.'
    }
  },
  // workflow/productivity 툴 추천을 정확히 트리거하기 위한 추상 카테고리도 tool_search로 커버
  doc_create: {
    nouns: ['보고서', '문서', '기획안', '리포트', '보고'],
    verbs: ['작성', '만들', '생성', '정리', '초안'],
    slots: ['docType', 'topic', 'pages', 'tone'],
    chips: [
      { label: '기획안', send: '기획안 문서를 작성해줘' },
      { label: '보고서 5p', send: '보고서 5페이지로 작성해줘' },
      { label: '격식 톤', send: '격식 톤으로 작성해줘' },
      { label: '문서 작성 페이지', send: '__NAV__/productivity/report-writers' }
    ],
    replyTemplate: {
      intro: '문서를 바로 작성해볼게요.',
      bullets: ['문서 유형(기획안/보고서)', '주제', '분량(페이지)', '톤'],
      outro: '참고 링크나 데이터가 있으면 함께 알려주세요.'
    }
  },
  email_write: {
    nouns: ['이메일', '메일', '안내메일', '문의메일'],
    verbs: ['작성', '보내', '초안', '생성'],
    slots: ['recipientRole', 'objective', 'tone', 'language'],
    chips: [
      { label: '문의 메일', send: '문의 내용을 담은 이메일 초안 작성해줘' },
      { label: '영업 메일', send: '영업 제안 이메일 초안 작성해줘' },
      { label: '공손 톤', send: '공손한 톤으로 작성해줘' },
      { label: '이메일 도우미', send: '__NAV__/productivity/email-assistant' }
    ],
    replyTemplate: {
      intro: '이메일 초안을 빠르게 잡아드릴게요.',
      bullets: ['받는 사람/역할', '목적(문의/제안/안내)', '톤(공손/친근)', '언어'],
      outro: '회사명/브랜드 톤이 있으면 함께 반영할게요.'
    }
  }
};


