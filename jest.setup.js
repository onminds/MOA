// Jest DOM 확장
import '@testing-library/jest-dom'

// 전역 mocks
global.fetch = jest.fn()

// 환경 변수 설정
process.env.OPENAI_API_KEY = 'test-api-key'
process.env.NEXTAUTH_SECRET = 'test-secret'

// 콘솔 경고 무시 (테스트 중)
const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (args[0]?.includes?.('Warning: ReactDOM.render is deprecated')) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
}) 