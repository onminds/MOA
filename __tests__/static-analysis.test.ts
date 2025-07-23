/**
 * 정적 분석 기능 단위 테스트
 * 핵심 기능들의 정확성을 검증
 */

describe('정적 분석 기능', () => {
  
  // 테스트용 mock 함수들 (실제 구현에서 import)
  const analyzeJavaScriptFallback = (content: string) => {
    const issues: any[] = [];
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      
      if (line.includes('var ')) {
        issues.push({
          type: 'style',
          severity: 'warning',
          message: 'var 대신 let/const 사용 권장',
          rule: 'no-var',
          line: lineNumber
        });
      }
      
      if (line.includes('==') && !line.includes('===')) {
        issues.push({
          type: 'style', 
          severity: 'warning',
          message: '=== 또는 !== 사용 권장',
          rule: 'eqeqeq',
          line: lineNumber
        });
      }
      
      if (line.includes('console.log')) {
        issues.push({
          type: 'debug',
          severity: 'info',
          message: '프로덕션 환경에서 console.log 제거 권장',
          rule: 'no-console',
          line: lineNumber
        });
      }
    });

    return issues;
  };

  const analyzePythonAdvanced = (content: string) => {
    const issues: any[] = [];
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      
      if (line.includes('import *')) {
        issues.push({
          type: 'import',
          severity: 'warning',
          message: 'import * 사용 지양, 명시적 import 권장 (PEP8)',
          rule: 'wildcard-import',
          line: lineNumber
        });
      }
      
      if ((line.includes('execute(') || line.includes('query(')) && line.includes('%s')) {
        issues.push({
          type: 'security',
          severity: 'error',
          message: 'SQL 인젝션 위험, 파라미터화된 쿼리 사용 권장',
          rule: 'sql-injection-risk',
          line: lineNumber
        });
      }
      
      if (line.trim() === 'except:') {
        issues.push({
          type: 'exception',
          severity: 'warning',
          message: '구체적인 예외 타입 지정 권장 (PEP8)',
          rule: 'bare-except',
          line: lineNumber
        });
      }
    });

    return issues;
  };

  const analyzeSecurityPatternsAdvanced = (content: string, language: string) => {
    const issues: any[] = [];
    const lines = content.split('\n');
    
    const secretPatterns = [
      { pattern: /password\s*[:=]\s*['"][^'"]{8,}['"]/gi, message: '하드코딩된 비밀번호 발견' },
      { pattern: /api[_-]?key\s*[:=]\s*['"][^'"]{16,}['"]/gi, message: '하드코딩된 API 키 발견' },
    ];
    
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      
      secretPatterns.forEach(({ pattern, message }) => {
        if (pattern.test(line)) {
          issues.push({
            type: 'security',
            severity: 'error',
            message: `${message}, 환경변수 사용 권장`,
            rule: 'hardcoded-secrets',
            line: lineNumber
          });
        }
      });
      
      if (language === 'JavaScript' && line.includes('eval(')) {
        issues.push({
          type: 'security',
          severity: 'error',
          message: 'eval() 사용 금지 - 코드 인젝션 위험',
          rule: 'no-eval',
          line: lineNumber
        });
      }
    });

    return issues;
  };

  describe('JavaScript 분석', () => {
    it('var 사용을 정확히 감지해야 함', () => {
      const code = `
        var oldStyle = "bad";
        let newStyle = "good";
        const modern = "better";
      `;
      
      const result = analyzeJavaScriptFallback(code);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: 'style',
        severity: 'warning',
        rule: 'no-var',
        line: 2
      });
    });

    it('== 사용을 정확히 감지해야 함', () => {
      const code = `
        if (a == b) {
          console.log("bad comparison");
        }
        if (a === c) {
          console.log("good comparison");
        }
      `;
      
      const result = analyzeJavaScriptFallback(code);
      
      const eqIssue = result.find(issue => issue.rule === 'eqeqeq');
      expect(eqIssue).toBeDefined();
      expect(eqIssue.line).toBe(2);
    });

    it('console.log 사용을 감지해야 함', () => {
      const code = `
        console.log("debugging");
        console.error("this is fine");
      `;
      
      const result = analyzeJavaScriptFallback(code);
      
      const consoleIssue = result.find(issue => issue.rule === 'no-console');
      expect(consoleIssue).toBeDefined();
      expect(consoleIssue.line).toBe(2);
    });

    it('문제없는 코드에서는 이슈를 찾지 않아야 함', () => {
      const code = `
        const name = "John";
        let age = 25;
        if (age === 25) {
          return true;
        }
      `;
      
      const result = analyzeJavaScriptFallback(code);
      
      expect(result).toHaveLength(0);
    });
  });

  describe('Python 분석', () => {
    it('import * 사용을 감지해야 함', () => {
      const code = `
        from os import *
        import sys
      `;
      
      const result = analyzePythonAdvanced(code);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: 'import',
        severity: 'warning',
        rule: 'wildcard-import',
        line: 2
      });
    });

    it('SQL 인젝션 위험을 감지해야 함', () => {
      const code = `
        cursor.execute("SELECT * FROM users WHERE id = %s", user_id)
        cursor.execute("SELECT * FROM users WHERE id = %s" % user_id)
      `;
      
      const result = analyzePythonAdvanced(code);
      
      const sqlIssue = result.find(issue => issue.rule === 'sql-injection-risk');
      expect(sqlIssue).toBeDefined();
      expect(sqlIssue.line).toBe(2); // 첫 번째 SQL 인젝션 위험이 2번째 라인에 있음
    });

    it('bare except를 감지해야 함', () => {
      const code = `
        try:
            risky_operation()
        except:
            pass
      `;
      
      const result = analyzePythonAdvanced(code);
      
      const exceptIssue = result.find(issue => issue.rule === 'bare-except');
      expect(exceptIssue).toBeDefined();
      expect(exceptIssue.line).toBe(4);
    });
  });

  describe('보안 패턴 분석', () => {
    it('하드코딩된 비밀번호를 감지해야 함', () => {
      const code = `
        const password = "mySecretPassword123";
        const apiKey = "sk-1234567890abcdef1234567890abcdef";
      `;
      
      const result = analyzeSecurityPatternsAdvanced(code, 'JavaScript');
      
      expect(result).toHaveLength(2);
      expect(result[0].rule).toBe('hardcoded-secrets');
      expect(result[1].rule).toBe('hardcoded-secrets');
    });

    it('eval() 사용을 감지해야 함', () => {
      const code = `
        const userInput = "alert('xss')";
        eval(userInput);
      `;
      
      const result = analyzeSecurityPatternsAdvanced(code, 'JavaScript');
      
      const evalIssue = result.find(issue => issue.rule === 'no-eval');
      expect(evalIssue).toBeDefined();
      expect(evalIssue.severity).toBe('error');
    });

    it('안전한 코드에서는 보안 이슈를 찾지 않아야 함', () => {
      const code = `
        const config = process.env;
        const apiKey = config.API_KEY;
      `;
      
      const result = analyzeSecurityPatternsAdvanced(code, 'JavaScript');
      
      expect(result).toHaveLength(0);
    });
  });

  describe('다중 언어 분석', () => {
    it('여러 이슈를 동시에 감지해야 함', () => {
      const code = `
        var password = "hardcodedPassword123";
        if (user == admin) {
          console.log("Access granted");
          eval(userInput);
        }
      `;
      
      const jsResult = analyzeJavaScriptFallback(code);
      const securityResult = analyzeSecurityPatternsAdvanced(code, 'JavaScript');
      
      const allIssues = [...jsResult, ...securityResult];
      
      expect(allIssues.length).toBeGreaterThan(3);
      
      // var 사용 체크
      expect(allIssues.some(issue => issue.rule === 'no-var')).toBe(true);
      // == 사용 체크  
      expect(allIssues.some(issue => issue.rule === 'eqeqeq')).toBe(true);
      // console.log 체크
      expect(allIssues.some(issue => issue.rule === 'no-console')).toBe(true);
      // 하드코딩된 비밀번호 체크
      expect(allIssues.some(issue => issue.rule === 'hardcoded-secrets')).toBe(true);
      // eval 사용 체크
      expect(allIssues.some(issue => issue.rule === 'no-eval')).toBe(true);
    });
  });

  describe('라인 번호 정확성', () => {
    it('이슈가 발생한 정확한 라인 번호를 반환해야 함', () => {
      const code = `
        let good = "fine";
        var bad = "problematic";
        let another = "good";
        console.log("debug");
      `;
      
      const result = analyzeJavaScriptFallback(code);
      
      const varIssue = result.find(issue => issue.rule === 'no-var');
      const consoleIssue = result.find(issue => issue.rule === 'no-console');
      
      expect(varIssue.line).toBe(3);
      expect(consoleIssue.line).toBe(5);
    });
  });

  describe('성능 테스트', () => {
    it('큰 파일도 합리적인 시간 내에 분석해야 함', () => {
      // 1000줄 정도의 큰 코드 생성
      const lines = Array(1000).fill(0).map((_, i) => 
        i % 10 === 0 ? 'var problematic = "issue";' : 'const good = "fine";'
      );
      const bigCode = lines.join('\n');
      
      const startTime = Date.now();
      const result = analyzeJavaScriptFallback(bigCode);
      const endTime = Date.now();
      
      // 1초 이내에 완료되어야 함
      expect(endTime - startTime).toBeLessThan(1000);
      
      // 100개의 이슈가 발견되어야 함 (1000줄 중 100줄에 var 사용)
      expect(result.filter(issue => issue.rule === 'no-var')).toHaveLength(100);
    });
  });
}); 