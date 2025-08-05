"use client";

import Header from '../components/Header';

  // 페이지 변경 시 스크롤 상단 이동
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 카테고리/검색 변경 시 1페이지로 이동
  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

    .slice(0, 5);

  const activeUsers = [
    { name: 'user123', posts: 12 },
    { name: 'ai_fan', posts: 9 },
    { name: 'curious', posts: 7 },
    { name: 'foodie', posts: 6 },
    { name: 'skyblue', posts: 5 },
  ];

  const recentComments = [
    { user: 'ai_fan', postTitle: '오늘의 잡담: AI가 바꿀 미래는?', content: '정말 기대돼요!', date: '2024-06-11' },
    { user: 'user123', postTitle: 'Q&A: AI 추천 좀 해주세요', content: 'GPT-4 추천합니다!', date: '2024-06-10' },
    { user: 'curious', postTitle: 'Q&A: GPT-4와 3.5 차이?', content: '답변 감사합니다!', date: '2024-06-09' },
    { user: 'foodie', postTitle: '자유: 오늘 점심 뭐 먹지?', content: '라면이 최고죠!', date: '2024-06-08' },
    { user: 'skyblue', postTitle: '자유: 오늘 날씨 너무 좋네요', content: '산책 가고 싶어요~', date: '2024-06-07' },
  ];

  return (
    <>

      </div>
    </>
  );
} 