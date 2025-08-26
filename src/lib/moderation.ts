import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type ModerationResult = {
  allowed: boolean;
  category?: string;
  severity?: 'low' | 'medium' | 'high';
  reason?: string;
};

export async function moderateInput(text: string): Promise<ModerationResult> {
  try {
    if (!text || !text.trim()) {
      return { allowed: true };
    }

    // Using text-moderation-latest (omni/updated naming may vary per provider)
    const res = await openai.moderations.create({
      model: 'omni-moderation-latest' as any,
      input: text,
    });

    const result = (res as any).results?.[0];
    if (!result) return { allowed: true };

    const flagged = !!result.flagged;
    if (!flagged) return { allowed: true };

    // Map to severity by categories
    const categories = result.categories || {};
    const severe = Object.entries(categories).some(([k, v]) => v && /violence|hate|sexual|minors|self-harm/i.test(k));
    const severity: ModerationResult['severity'] = severe ? 'high' : 'medium';

    return {
      allowed: false,
      category: Object.keys(categories).filter((k) => (categories as any)[k]).join(', '),
      severity,
      reason: 'Content flagged by moderation model',
    };
  } catch (e) {
    // Fail-open with logging at call site
    return { allowed: true };
  }
}



