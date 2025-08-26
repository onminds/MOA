export async function sendAlert(message: string, meta?: Record<string, any>) {
  try {
    // 여기서 MCP 알림 툴 또는 웹훅(Slack/Discord)을 호출할 수 있음
    if (process.env.ALERTS_WEBHOOK_URL) {
      await fetch(process.env.ALERTS_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message, meta })
      } as any);
    } else {
      console.warn('[ALERT]', message, meta || {});
    }
  } catch (e) {
    console.error('sendAlert failed', e);
  }
}



