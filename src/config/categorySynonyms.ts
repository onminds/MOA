// 카테고리 동의어(우선순위 매칭용)
// 카테고리별 한국어 동의어 매핑 (우선순위 검색용)
export const KOREAN_CATEGORY_SYNONYMS: Record<string, string[]> = {
  '3d': ['3차원', '쓰리디', '입체', '3D모델링', '3D그래픽', '3디', '삼차원', '입체영상', '3D애니메이션', '3D렌더링', 'VR', 'AR', '가상현실', '증강현실', '메타버스'],
  'marketing': ['마케팅', '광고', '홍보', '프로모션', '캠페인', '브랜딩', '마케터', '디지털마케팅', 'SNS마케팅', '온라인마케팅', '콘텐츠마케팅', '이메일마케팅', 'SEO', 'SEM', '인플루언서'],
  'nocode': ['노코드', '비개발', '코딩없이', '드래그앤드롭', '비주얼프로그래밍', '로우코드', '제로코딩', '클릭만으로', '쉽게만들기', '템플릿', '자동화', '워크플로우', '통합', '연동'],
  'ppt': ['프레젠테이션', '발표자료', '슬라이드', '파워포인트', 'PPT', '발표', '프리젠테이션', '키노트', '구글슬라이드', '발표준비', '피치덱', '제안서', '보고서'],
  'image': ['이미지', '사진', '그림', '일러스트', '디자인', '그래픽', '비주얼', '아트워크', '포스터', '배너', '썸네일', '로고', '아이콘', '인포그래픽', '목업'],
  'video': ['비디오', '영상', '동영상', '무비', '클립', '편집', '유튜브', '숏폼', '릴스', '틱톡', '브이로그', '모션그래픽', '애니메이션', '자막', '컷편집'],
  'text': ['텍스트', '글쓰기', '문서', '카피라이팅', '콘텐츠', '블로그', '기사', '에세이', '리포트', '번역', '요약', '교정', '문장', '스토리', '대본'],
  'audio': ['오디오', '음성', '소리', '음악', '보이스', '나레이션', 'TTS', 'STT', '음성합성', '음성인식', '팟캐스트', '더빙', '녹음', '사운드', 'BGM'],
  'code': ['코드', '코딩', '프로그래밍', '개발', '디버깅', '리팩토링', 'IDE', '컴파일', '스크립트', 'API', '함수', '알고리즘', '깃허브', '버전관리', '테스트'],
  'design': ['디자인', 'UI', 'UX', '인터페이스', '레이아웃', '와이어프레임', '프로토타입', '목업', '스케치', '피그마', '어도비', '일러스트레이터', '포토샵', '브랜딩'],
  'productivity': ['생산성', '업무효율', '자동화', '협업', '프로젝트관리', '일정관리', '태스크', '할일', '노트', '메모', '문서화', '정리', '계획', '스케줄', '캘린더'],
  'workflow': ['워크플로우', '업무흐름', '프로세스', '자동화', '통합', '연동', '파이프라인', '트리거', '액션', '조건', '분기', '루프', '스케줄링', '배치', '오케스트레이션']
};

// 기능별 한국어 동의어 매핑
export const KOREAN_FEATURE_SYNONYMS: Record<string, string[]> = {
  'ai': ['인공지능', 'AI', '머신러닝', '딥러닝', '자동', '스마트', '지능형', '학습', '예측', '분석', '추천', '최적화'],
  'free': ['무료', '프리', '공짜', '무료체험', '프리미엄', '트라이얼', '체험판', '베이직', '스타터'],
  'korean': ['한국어', '한글', '국내', '한국', '로컬', '국산', '토종', '한국형', '한글지원', '한국어지원'],
  'api': ['API', '연동', '통합', '인터페이스', '웹훅', 'REST', 'GraphQL', 'SDK', '라이브러리', '플러그인', '익스텐션', '애드온'],
  'realtime': ['실시간', '라이브', '즉시', '바로', '동시', '스트리밍', '실시간처리', '즉각', '리얼타임'],
  'collaboration': ['협업', '공동작업', '팀워크', '공유', '동시편집', '코워킹', '협력', '팀프로젝트', '멀티유저'],
  'mobile': ['모바일', '스마트폰', '앱', '애플리케이션', 'iOS', '안드로이드', '태블릿', '반응형', '모바일최적화'],
  'cloud': ['클라우드', 'SaaS', '웹기반', '온라인', '서버리스', '호스팅', '스토리지', '백업', '동기화'],
  'template': ['템플릿', '양식', '포맷', '샘플', '예제', '프리셋', '스타일', '테마', '레이아웃', '보일러플레이트'],
  'automation': ['자동화', '자동', '봇', '스크립트', '매크로', 'RPA', '반복작업', '일괄처리', '예약', '트리거']
};

export const CATEGORY_SYNONYMS_DB: Record<string, string[]> = {
  // 3D/아바타 계열 (최우선)
  '3d': ['3d','3차원','입체','쓰리디','three dimensional','three-d','avatar','아바타','virtual human','디지털휴먼','3d model','3d generation','mesh','spline','blender','maya','3ds max'],
  avatar: ['3d','3차원','입체','쓰리디','avatar','아바타','virtual human','디지털휴먼','vtuber','v-tuber','character','캐릭터'],

  // 프레젠테이션/PPT 계열
  ppt: ['ppt','powerpoint','power point','presentation','presentations','slide','slides','deck','프레젠테이션','슬라이드','발표','발표자료','발표 자료','덱'],
  presentation: ['ppt','presentation','presentations','slide','slides','deck','프레젠테이션','슬라이드','발표','발표자료','발표 자료','덱'],

  // 이미지/디자인
  image: ['image','이미지','사진','그림','art','ai art','일러스트','로고','썸네일','포스터','배너'],
  design: ['design','디자인','ui','ux','브랜딩','로고','썸네일','레이아웃'],

  // 비디오/영상
  video: ['video','비디오','영상','동영상','컷편집','자막','모션','편집'],

  // 오디오/음성/음악
  audio: ['audio','voice','음성','오디오','음악','tts','stt','보이스오버'],

  // 글/텍스트
  text: ['text','텍스트','글','글쓰기','라이팅','요약','번역','카피','카피라이팅','문서'],

  // 워크플로우/생산성
  workflow: ['workflow','워크플로우','automation','자동화','integration','연동','zapier','make','n8n','pipedream'],

  // 노코드/로우코드/워크플로우
  nocode: ['nocode','no-code','no code','노코드','비개발','비개발자','코딩없이','프로그래밍없이','드래그앤드롭','drag and drop','블록','block','플로우','flow','워크플로우','workflow','자동화','automation','빌더','builder','제작도구','만들기','생성기','generator','n8n','zapier','make','pipedream','bubble','webflow','wix','squarespace','wordpress','shopify','airtable','notion','coda','retool','glide','adalo','thunkable','appgyver','appsheet','outsystems','mendix','powerapps','power automate','microsoft power platform','google appsheet','salesforce lightning','salesforce flow','hubspot workflows','pipedrive','monday.com','asana','trello','clickup','smartsheet','airtable','notion','coda','retool','glide','adalo','thunkable','appgyver','appsheet','outsystems','mendix','powerapps','power automate','microsoft power platform','google appsheet','salesforce lightning','salesforce flow','hubspot workflows','pipedrive','monday.com','asana','trello','clickup','smartsheet'],

  // 마케팅/광고/홍보
  marketing: ['marketing','마케팅','광고','advertising','홍보','pr','promotion','프로모션','campaign','캠페인','branding','브랜딩','sns','소셜미디어','social media','인플루언서','influencer','콘텐츠마케팅','content marketing','이메일마케팅','email marketing','seo','sem','ppc','디지털마케팅','digital marketing','온라인마케팅','online marketing'],
  social: ['social','소셜','sns','인스타그램','instagram','페이스북','facebook','트위터','twitter','틱톡','tiktok','유튜브','youtube','링크드인','linkedin','핀터레스트','pinterest','스냅챗','snapchat','소셜미디어','social media'],
  advertising: ['advertising','광고','ad','ads','advertisement','adwords','구글광고','google ads','페이스북광고','facebook ads','인스타그램광고','instagram ads','유튜브광고','youtube ads','디스플레이광고','display ads','검색광고','search ads','리타겟팅','retargeting','리마케팅','remarketing'],
};

export function getCategorySynonymsForDb(category: string | undefined | null): string[] {
  if (!category) return [];
  const key = String(category).toLowerCase();
  return CATEGORY_SYNONYMS_DB[key] || [];
}


