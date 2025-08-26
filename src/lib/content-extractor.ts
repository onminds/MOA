// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import mammoth from 'mammoth';
import * as cheerio from 'cheerio';

// 문서 내용 추출
export async function extractDocumentContent(file: File): Promise<string> {
  try {
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.split('.').pop();
    
    console.log(`문서 처리 시작: ${fileName} (${fileExtension})`);
    
    // HWP 파일은 지원하지 않음
    if (fileExtension === 'hwp') {
      throw new Error('한글 문서(.hwp)는 현재 지원되지 않습니다. Microsoft Word(.docx), 구형 Word(.doc), 또는 텍스트 파일(.txt)로 변환 후 업로드해주세요.');
    }
    
    // 파일을 ArrayBuffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    
    let textContent = '';
    
    // 파일 형식에 따른 처리
    switch (fileExtension) {
      case 'docx':
        // Word 문서 (.docx) 처리
        try {
          // ArrayBuffer를 Buffer로 변환
          const buffer = Buffer.from(arrayBuffer);
          const result = await mammoth.extractRawText({ buffer });
          textContent = result.value;
          console.log('Word 문서 파싱 성공:', textContent.length, '문자');
        } catch (docxError) {
          console.log('Word 문서 파싱 실패:', docxError);
          throw new Error('Word 문서를 읽을 수 없습니다.');
        }
        break;
        
      case 'doc':
        // 구형 Word 문서 (.doc) 처리
        try {
          // ArrayBuffer를 Buffer로 변환
          const buffer = Buffer.from(arrayBuffer);
          const result = await mammoth.extractRawText({ buffer });
          textContent = result.value;
          console.log('구형 Word 문서 파싱 성공:', textContent.length, '문자');
        } catch (docError) {
          console.log('구형 Word 문서 파싱 실패:', docError);
          throw new Error('구형 Word 문서를 읽을 수 없습니다.');
        }
        break;
        
      case 'txt':
        // 텍스트 파일 처리
        try {
          const decoder = new TextDecoder('utf-8');
          textContent = decoder.decode(arrayBuffer);
          console.log('텍스트 파일 파싱 성공:', textContent.length, '문자');
        } catch (txtError) {
          console.log('텍스트 파일 파싱 실패:', txtError);
          throw new Error('텍스트 파일을 읽을 수 없습니다.');
        }
        break;
        
      case 'pdf':
        // PDF 파일 처리 (간단한 텍스트 추출)
        try {
          // PDF 처리는 별도 라이브러리가 필요하므로 일단 텍스트로 시도
          const decoder = new TextDecoder('utf-8');
          textContent = decoder.decode(arrayBuffer);
          console.log('PDF 파일 파싱 시도:', textContent.length, '문자');
        } catch (pdfError) {
          console.log('PDF 파일 파싱 실패:', pdfError);
          throw new Error('PDF 파일을 읽을 수 없습니다. 지원되는 형식: .docx, .doc, .txt');
        }
        break;
        
      default:
        // 기본 텍스트 처리
        try {
          const decoder = new TextDecoder('utf-8');
          textContent = decoder.decode(arrayBuffer);
          console.log('기본 텍스트 파싱 성공:', textContent.length, '문자');
        } catch (defaultError) {
          console.log('기본 텍스트 파싱 실패:', defaultError);
          throw new Error(`지원하지 않는 파일 형식입니다: ${fileExtension}. 지원되는 형식: .docx, .doc, .txt`);
        }
    }
    
    // 내용이 너무 짧거나 바이너리인지 확인
    if (textContent.length < 10) {
      throw new Error('문서에서 텍스트를 추출할 수 없습니다. 지원되는 형식: .docx, .doc, .txt');
    }
    
    // 바이너리 데이터인지 확인 (일반적으로 읽을 수 없는 문자들이 많으면 바이너리)
    const readableChars = textContent.replace(/[^\w\s가-힣]/g, '').length;
    const totalChars = textContent.length;
    const readabilityRatio = readableChars / totalChars;
    
    if (readabilityRatio < 0.3) {
      throw new Error('바이너리 파일입니다. 텍스트 문서를 업로드해주세요. 지원되는 형식: .docx, .doc, .txt');
    }
    
    console.log(`문서 처리 완료: ${textContent.length} 문자, 가독성 비율: ${(readabilityRatio * 100).toFixed(1)}%`);
    return textContent;
    
  } catch (error) {
    console.error('문서 내용 추출 오류:', error);
    throw new Error('문서 내용을 읽을 수 없습니다. 지원되는 형식: .docx, .doc, .txt');
  }
}

// 웹사이트 내용 추출
export async function extractWebsiteContent(url: string): Promise<string> {
  try {
    console.log('웹사이트 스크래핑 시작:', url);

    // 1) URL 정규화
    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }
    const u0 = new URL(targetUrl);

    // 2) 다운로드(타임아웃/UA 포함) + 문자셋 처리
    const fetchHtml = async (inputUrl: string): Promise<{ html: string; finalUrl: string; }> => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const res = await fetch(inputUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
            'Accept-Language': 'ko,en;q=0.8'
          },
          redirect: 'follow',
          signal: controller.signal
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        // 우선 일부만 읽어서 charset 탐지 시도
        const buf = await res.arrayBuffer();
        let charset = '';
        const ct = res.headers.get('content-type') || '';
        const m = ct.match(/charset=([^;]+)/i);
        if (m) charset = m[1].toLowerCase();
        if (!charset) {
          // 메타에서 추정
          const head = new TextDecoder('utf-8').decode(buf.slice(0, 8192));
          const m1 = head.match(/<meta[^>]*charset=["']?([^\s"'>]+)/i);
          const m2 = head.match(/<meta[^>]*content=["'][^"']*charset=([^"']+)/i);
          charset = (m1?.[1] || m2?.[1] || '').toLowerCase();
        }
        const tryDecode = (label: string): string | null => {
          try {
            return new TextDecoder(label as any, { fatal: false }).decode(buf);
          } catch {
            return null;
          }
        };
        let html = '';
        if (charset) {
          html = tryDecode(charset) || tryDecode('utf-8') || new TextDecoder().decode(buf);
        } else {
          html = tryDecode('utf-8') || new TextDecoder().decode(buf);
        }
        return { html, finalUrl: res.url || inputUrl };
      } finally {
        clearTimeout(timeout);
      }
    };

    // 3) 1차 다운로드
    let { html, finalUrl } = await fetchHtml(targetUrl);

    // 3-1) 네이버 블로그 특수 처리: 모바일 페이지로 재시도 + frame/redirect 추적
    try {
      const host = new URL(finalUrl).hostname;
      if (/blog\.naver\.com$/i.test(host)) {
        // 1) og:url → 모바일 전환
        const ogUrlMatch = html.match(/<meta[^>]*(?:property|name)=["']og:url["'][^>]*content=["']([^"']+)["'][^>]*>/i);
        let mobileUrl = (ogUrlMatch?.[1] || finalUrl).replace('://blog.naver.com', '://m.blog.naver.com');

        // 2) 프레임 내 실제 본문 URL 찾기
        const frameSrcMatch = html.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/i);
        if (frameSrcMatch && frameSrcMatch[1]) {
          try {
            const fUrl = new URL(frameSrcMatch[1], finalUrl).toString();
            mobileUrl = fUrl.replace('://blog.naver.com', '://m.blog.naver.com');
          } catch {}
        }

        // 3) 모바일 페이지 요청
        const res2 = await fetchHtml(mobileUrl);
        let mobileHtml = res2.html;

        // 4) 모바일 문서에서 본문 JSON/iframe 경로 추출 (네이버 일부 템플릿)
        // data-contents-url, og:url 재지정, 또 다른 iframe 등 시도
        const dataUrlMatch = mobileHtml.match(/data-contents-url=["']([^"']+)["']/i);
        if (dataUrlMatch && dataUrlMatch[1]) {
          try {
            const dataUrl = new URL(dataUrlMatch[1], res2.finalUrl).toString();
            const res3 = await fetchHtml(dataUrl);
            if ((res3.html || '').length > (mobileHtml || '').length / 2) {
              mobileHtml = res3.html;
            }
          } catch {}
        }

        const frame2 = mobileHtml.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/i);
        if (frame2 && frame2[1]) {
          try {
            const f2 = new URL(frame2[1], res2.finalUrl).toString();
            const res4 = await fetchHtml(f2);
            if ((res4.html || '').length > (mobileHtml || '').length / 2) {
              mobileHtml = res4.html;
            }
          } catch {}
        }

        // 5) 블로그 홈/목록 URL인 경우 최신 글 링크를 찾아 본문으로 이동
        try {
          const uRes2 = new URL(res2.finalUrl);
          const pathSeg = uRes2.pathname.replace(/^\/+|\/+$/g, '');
          const looksLikeHome = /^PostList\.naver$/i.test(pathSeg) || (pathSeg && !/\d/.test(pathSeg));
          // blogId 추출: /{blogId} or ?blogId=
          let blogId = '';
          if (pathSeg && !pathSeg.includes('/')) {
            blogId = pathSeg;
          }
          if (!blogId) {
            blogId = (uRes2.searchParams.get('blogId') || '').trim();
          }
          if (!blogId) {
            blogId = (u0.pathname.replace(/^\/+|\/+$/g, '') || '').split('/')[0] || '';
          }

          if (looksLikeHome && blogId) {
            const $m = cheerio.load(mobileHtml);
            let latestHref = '';
            // a 태그에서 /{blogId}/{logNo} 패턴 우선 탐색
            const cand = $m(`a[href*="/${blogId}/"]`).attr('href');
            if (cand) {
              try { latestHref = new URL(cand, res2.finalUrl).toString(); } catch {}
            }
            if (!latestHref) {
              // data-log-no 기반 구성
              const logNo = ($m('[data-log-no]').attr('data-log-no') || '').trim();
              if (/^\d{5,}$/.test(logNo)) {
                latestHref = `https://m.blog.naver.com/${blogId}/${logNo}`;
              }
            }
            if (!latestHref) {
              // 정규식으로 백업 추출
              const mlink = mobileHtml.match(new RegExp(`/${blogId}/(\\d{5,})`));
              if (mlink && mlink[1]) {
                latestHref = `https://m.blog.naver.com/${blogId}/${mlink[1]}`;
              }
            }
            if (latestHref) {
              const resPost = await fetchHtml(latestHref);
              if ((resPost.html || '').length > (mobileHtml || '').length / 2) {
                mobileHtml = resPost.html;
                finalUrl = resPost.finalUrl;
              }
            }
          }
        } catch {}

        if ((mobileHtml || '').length > (html || '').length / 2) {
          html = mobileHtml;
          finalUrl = res2.finalUrl;
        }
      }
    } catch {}

    // 4) cheerio로 본문 추출
    const $ = cheerio.load(html);
    // 불필요 태그 제거
    $('script, style, noscript, iframe, header, footer, nav, aside, form, svg').remove();

    // 후보 셀렉터들(블로그/뉴스/워드프레스/브런치 등)
    const candidateSelectors = [
      'article',
      'main article',
      '.entry-content', '.post-content', '.article-content', '.content-article', '.content-body', '.postBody',
      '#content', '#main-content', '.main-content', '.prose', '.xl\\:prose', '[class*="prose"]',
      // 네이버 뉴스/블로그
      '#dic_area', '.newsct_article', '.newsct_article._article_body', '.se-main-container', '.se_component_wrap', '#postViewArea',
      // 다음 뉴스
      '#harmonyContainer',
      // 티스토리/워드프레스 일반
      '.tt_article_useless_p_margin', '.article', 'article .content',
      // 미디엄/브런치 등
      'section[role="main"]', 'section section', '.wrap_body', '.article_view'
    ];

    let bestText = '';
    let bestSel = '';
    for (const sel of candidateSelectors) {
      try {
        const t = $(sel).text().replace(/\s+/g, ' ').trim();
        if (t && t.length > bestText.length) {
          bestText = t;
          bestSel = sel;
        }
      } catch (e) {
        // 셀렉터 파싱 실패 시 무시하고 다음 후보로 진행
        continue;
      }
    }

    // 후보가 없으면 문서의 주요 텍스트 태그 묶어서 추출
    if (bestText.length < 300) {
      bestText = $('h1, h2, h3, p, li').map((_, el) => $(el).text()).get().join(' ').replace(/\s+/g, ' ').trim();
    }

    // 네이버 블로그 홈/목록 페이지로부터 본문을 못 찾은 경우: PostList → 최신 글 추적 시도
    if (bestText.length < 300) {
      try {
        const hostNow = new URL(finalUrl).hostname;
        const isNaverBlog = /(^|\.)blog\.naver\.com$/i.test(hostNow) || /(^|\.)m\.blog\.naver\.com$/i.test(hostNow);
        if (isNaverBlog) {
          let blogId = '';
          const pathNow = new URL(finalUrl).pathname.replace(/^\/+|\/+$/g, '');
          if (pathNow && !pathNow.includes('/')) blogId = pathNow;
          if (!blogId) blogId = (new URL(finalUrl).searchParams.get('blogId') || '').trim();
          if (!blogId) blogId = (u0.pathname.replace(/^\/+|\/+$/g, '') || '').split('/')[0] || '';

          if (blogId) {
            const listUrl = `https://m.blog.naver.com/PostList.naver?blogId=${encodeURIComponent(blogId)}`;
            const listRes = await (async () => { try { return await fetchHtml(listUrl); } catch { return null; } })();
            if (listRes && listRes.html) {
              let logNo = '';
              // 1) /{blogId}/{logNo} 패턴
              const m1 = listRes.html.match(new RegExp(`/${blogId}/(\\d{5,})`));
              if (m1 && m1[1]) logNo = m1[1];
              // 2) logNo= 패턴
              if (!logNo) {
                const m2 = listRes.html.match(/logNo=(\d{5,})/);
                if (m2 && m2[1]) logNo = m2[1];
              }
              if (logNo) {
                const postUrl = `https://m.blog.naver.com/${blogId}/${logNo}`;
                const postRes = await (async () => { try { return await fetchHtml(postUrl); } catch { return null; } })();
                if (postRes && postRes.html) {
                  const $p = cheerio.load(postRes.html);
                  $p('script, style, noscript, iframe, header, footer, nav, aside, form, svg').remove();
                  const t1 = $p('.se-main-container, .se_component_wrap, #postViewArea, .post_ct').text().replace(/\s+/g, ' ').trim();
                  const t2 = $p('article, #content, .article_content, .content-article, .entry-content, p, li').text().replace(/\s+/g, ' ').trim();
                  const merged = (t1.length > t2.length ? t1 : t2);
                  if (merged.length > bestText.length) {
                    bestText = merged;
                  }
                }
              }
            }
            // RSS 폴백
            if (bestText.length < 200) {
              const rssCandidates = [
                `https://rss.blog.naver.com/${encodeURIComponent(blogId)}.xml`,
                `https://blog.rss.naver.com/${encodeURIComponent(blogId)}.xml`
              ];
              for (const r of rssCandidates) {
                try {
                  const rss = await fetchHtml(r);
                  if (rss && rss.html) {
                    // description CDATA 추출
                    const descs = rss.html.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i);
                    if (descs && descs[1]) {
                      const tmp = cheerio.load(`<div>${descs[1]}</div>`);
                      const rssText = tmp('div').text().replace(/\s+/g, ' ').trim();
                      if (rssText.length > bestText.length) {
                        bestText = rssText;
                      }
                    }
                  }
                } catch {}
                if (bestText.length >= 200) break;
              }
            }
          }
        }
      } catch {}
    }

    // 메타데이터 추출
    const title = ($('meta[property="og:title"]').attr('content') || $('title').first().text() || '').trim();
    const description = ($('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '').trim();

    // 결과 구성 및 길이 제한(최대 12000자)
    let fullContent = '';
    if (title) fullContent += `제목: ${title}\n\n`;
    if (description) fullContent += `설명: ${description}\n\n`;
    fullContent += `웹사이트 내용:\n${bestText}`;
    if (fullContent.length > 12000) {
      fullContent = fullContent.slice(0, 12000);
    }

    // 본문이 너무 짧아도 제목/설명만으로 최소 콘텐츠를 반환 (사용자 요청 폴백)
    if (fullContent.replace(/\s+/g, '').length < 80) {
      const hostTitle = new URL(finalUrl).hostname.replace(/^www\./, '');
      const fallbackTitle = title || hostTitle;
      const fallbackDesc = description || '본문을 직접 읽을 수 없어 제목 중심으로 요약합니다.';
      fullContent = `제목: ${fallbackTitle}\n\n설명: ${fallbackDesc}\n\n웹사이트 내용:\n${bestText || fallbackTitle}`;
    }

    console.log('웹사이트 스크래핑 완료:', fullContent.length, '문자', bestSel ? `(selector: ${bestSel})` : '');
    return fullContent;
  } catch (error) {
    console.error('웹사이트 내용 추출 오류:', error);
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('웹사이트 로딩 시간이 초과되었습니다.');
      }
      if (/HTTP\s*\d+/.test(error.message)) {
        throw new Error('웹사이트에서 오류가 발생했습니다. URL을 확인해주세요.');
      }
    }
    throw new Error('웹사이트 내용을 가져올 수 없습니다. URL을 확인해주세요.');
  }
}