import requests
from bs4 import BeautifulSoup

print(" 빠른 AI 도구 크롤링 테스트")
print("=" * 30)

try:
    print(" TopAI Tools 접속 중...")
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    response = requests.get("https://topai.tools", headers=headers, timeout=15)
    print(f" 접속 성공: {response.status_code}")
    
    if response.status_code == 200:
        soup = BeautifulSoup(response.content, "html.parser")
        title = soup.find("title")
        if title:
            print(f" 페이지 제목: {title.text.strip()}")
        
        links = soup.find_all("a")[:5]
        print(f" 상위 5개 링크:")
        for i, link in enumerate(links):
            text = link.text.strip()[:40]
            if text:
                print(f"   {i+1}. {text}")
    
    print(" 크롤링 테스트 완료!")
    
except Exception as e:
    print(f" 오류: {e}")

input("엔터를 눌러 종료...")
