// 발표 대상 청중 맵핑
export const audienceMap: { [key: string]: string } = {
  'colleagues': '동료/팀원',
  'executives': '경영진/임원',
  'clients': '고객/클라이언트', 
  'students': '학생/수강생',
  'general': '일반 대중',
  'investors': '투자자/파트너',
  'custom': '직접 입력' // 기본값
};

// 발표 목적 맵핑
export const purposeMap: { [key: string]: string } = {
  'inform': '정보 전달',
  'persuade': '설득/제안',
  'educate': '교육/지식 공유',
  'motivate': '동기부여/격려',
  'report': '보고/상황 전달',
  'present': '제품/서비스 소개',
  'custom': '직접 입력' // 기본값
};

// 발표 톤/스타일 맵핑
export const toneMap: { [key: string]: string } = {
  'formal': '공식적이고 전문적인',
  'friendly': '친근하고 캐주얼한',
  'enthusiastic': '열정적이고 역동적인',
  'calm': '차분하고 신중한',
  'confident': '자신감 있는',
  'conversational': '대화형이고 상호작용하는'
}; 