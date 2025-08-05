"use client";

export default function BlogWriter() {
  const router = useRouter();
  const [contentType, setContentType] = useState<'review' | 'info' | 'daily'>('review');
  const [postTopic, setPostTopic] = useState('');

  const handleGenerateBlog = async () => {
    if (!postTopic.trim()) {
      setError('게시물 주제를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {

      const response = await fetch('/api/blog-writer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({

        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '블로그 생성에 실패했습니다.');
      }

      }
    } catch (error) {
      console.error('블로그 생성 오류:', error);
      setError(error instanceof Error ? error.message : '블로그 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyBlog = () => {
    if (blogContent) {
      navigator.clipboard.writeText(blogContent);
    }
  };

                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      블로그 생성 중...
                    </>
                  ) : (
                    <>
                      <BookOpen className="w-5 h-5" />
                      블로그 생성
                    </>
                  )}
                </button>
                
                {error && (

                    <div className="text-red-800 font-medium">오류 발생</div>
                    <div className="text-red-600 text-sm mt-1">{error}</div>
                  </div>
                )}
              </div>

              </div>
            </div>
          </div>
        </div>
      </div>

  );
} 