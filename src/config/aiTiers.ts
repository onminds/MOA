export type AITierConfig = {
  model: string;
  name: string;
  description: string;
  maxTokens: number;
  longFormMaxTokens: number;
  temperature: number;
  costCapUsd?: number;
};

export type AITierMap = Record<'GUEST' | 'USER' | 'PREMIUM', AITierConfig>;

// 기본값: 환경 변수로 덮어쓸 수 있도록 설계
export const DEFAULT_AI_TIERS: AITierMap = {
  GUEST: {
    model: process.env.AI_TIER_GUEST_MODEL || 'gpt-5-mini',
    name: '기본 AI',
    description: '빠르고 기본적인 응답',
    maxTokens: Number(process.env.AI_TIER_GUEST_MAXTOKENS || 1200),
    longFormMaxTokens: Number(process.env.AI_TIER_GUEST_LONGTOKENS || 2200),
    temperature: Number(process.env.AI_TIER_GUEST_TEMP || 0.3),
    costCapUsd: Number(process.env.AI_TIER_GUEST_COSTCAP || 0.01)
  },
  USER: {
    model: process.env.AI_TIER_USER_MODEL || 'gpt-5-mini',
    name: '향상된 AI',
    description: '더 정확하고 상세한 응답',
    maxTokens: Number(process.env.AI_TIER_USER_MAXTOKENS || 1600),
    longFormMaxTokens: Number(process.env.AI_TIER_USER_LONGTOKENS || 2600),
    temperature: Number(process.env.AI_TIER_USER_TEMP || 0.7),
    costCapUsd: Number(process.env.AI_TIER_USER_COSTCAP || 0.03)
  },
  PREMIUM: {
    model: process.env.AI_TIER_PREMIUM_MODEL || 'gpt-5-mini',
    name: '프리미엄 AI',
    description: '최고 수준의 정확하고 창의적인 응답',
    maxTokens: Number(process.env.AI_TIER_PREMIUM_MAXTOKENS || 2200),
    longFormMaxTokens: Number(process.env.AI_TIER_PREMIUM_LONGTOKENS || 3600),
    temperature: Number(process.env.AI_TIER_PREMIUM_TEMP || 0.8),
    costCapUsd: Number(process.env.AI_TIER_PREMIUM_COSTCAP || 0.1)
  }
};



