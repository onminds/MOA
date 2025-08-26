import type { NextRequest } from 'next/server';

export type ExperimentVariant = 'A' | 'B';

export type ExperimentFlags = {
  recommend_compare_style: boolean; // B에서 비교 스타일 선호 여부
};

export function resolveExperiment(req?: NextRequest): { variant: ExperimentVariant; flags: ExperimentFlags } {
  let variant: ExperimentVariant = 'A';
  try {
    const cookie = req?.cookies?.get?.('moa_ab')?.value || '';
    if (cookie === 'A' || cookie === 'B') variant = cookie;
    else if (process.env.AB_DEFAULT_VARIANT === 'B') variant = 'B';
  } catch {}

  const flags: ExperimentFlags = {
    recommend_compare_style: variant === 'B'
  };
  return { variant, flags };
}



