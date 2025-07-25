export function getTimeSplit(duration: number): { intro: string; body: string; conclusion: string; } {
  switch (duration) {
    case 5:
      return { intro: '0~1분', body: '1~4분', conclusion: '4~5분' };
    case 10:
      return { intro: '0~1.5분', body: '1.5~8.5분', conclusion: '8.5~10분' };
    case 15:
      return { intro: '0~2분', body: '2~13분', conclusion: '13~15분' };
    default:
      return { intro: '0~1분', body: '1~3분', conclusion: '3~5분' }; // fallback
  }
} 