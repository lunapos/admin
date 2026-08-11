import { describe, it, expect } from 'vitest'

// store-signup Edge Functionのバリデーションロジックをテスト
// （実際のEdge Functionと同じロジックを検証）

// デバイストークン生成ロジックのテスト
function generateDeviceToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const parts = [
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''),
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''),
  ]
  return `luna-${parts[0]}-${parts[1]}`
}

// バリデーションロジック
function validateSignupInput(input: {
  store_name?: string | null
  email?: string | null
  password?: string | null
}): string | null {
  const { store_name, email, password } = input
  if (!store_name || typeof store_name !== 'string' || !store_name.trim()) {
    return '店舗名は必須です'
  }
  if (!email || typeof email !== 'string') {
    return 'メールアドレスは必須です'
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return 'パスワードは6文字以上で入力してください'
  }
  return null
}

describe('デバイストークン生成', () => {
  it('luna-xxxx-xxxx形式で生成される', () => {
    const token = generateDeviceToken()
    expect(token).toMatch(/^luna-[a-z0-9]{4}-[a-z0-9]{4}$/)
  })

  it('毎回異なるトークンを生成する', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateDeviceToken()))
    // 100回生成して全て異なること（衝突確率は極めて低い）
    expect(tokens.size).toBeGreaterThan(90)
  })

  it('英小文字と数字のみで構成される', () => {
    for (let i = 0; i < 50; i++) {
      const token = generateDeviceToken()
      expect(token).toMatch(/^[a-z0-9-]+$/)
    }
  })
})

describe('サインアップバリデーション', () => {
  it('正常な入力ではnullを返す', () => {
    expect(validateSignupInput({
      store_name: 'テスト店舗',
      email: 'test@example.com',
      password: 'password123',
    })).toBeNull()
  })

  // 店舗名
  it('店舗名が空文字でエラー', () => {
    expect(validateSignupInput({
      store_name: '',
      email: 'test@example.com',
      password: 'password123',
    })).toBe('店舗名は必須です')
  })

  it('店舗名がスペースのみでエラー', () => {
    expect(validateSignupInput({
      store_name: '   ',
      email: 'test@example.com',
      password: 'password123',
    })).toBe('店舗名は必須です')
  })

  it('店舗名がnullでエラー', () => {
    expect(validateSignupInput({
      store_name: null,
      email: 'test@example.com',
      password: 'password123',
    })).toBe('店舗名は必須です')
  })

  it('店舗名がundefinedでエラー', () => {
    expect(validateSignupInput({
      email: 'test@example.com',
      password: 'password123',
    })).toBe('店舗名は必須です')
  })

  // メールアドレス
  it('メールが空でエラー', () => {
    expect(validateSignupInput({
      store_name: 'テスト店舗',
      email: '',
      password: 'password123',
    })).toBe('メールアドレスは必須です')
  })

  it('メールがnullでエラー', () => {
    expect(validateSignupInput({
      store_name: 'テスト店舗',
      email: null,
      password: 'password123',
    })).toBe('メールアドレスは必須です')
  })

  // パスワード
  it('パスワードが5文字以下でエラー', () => {
    expect(validateSignupInput({
      store_name: 'テスト店舗',
      email: 'test@example.com',
      password: '12345',
    })).toBe('パスワードは6文字以上で入力してください')
  })

  it('パスワードが6文字でOK', () => {
    expect(validateSignupInput({
      store_name: 'テスト店舗',
      email: 'test@example.com',
      password: '123456',
    })).toBeNull()
  })

  it('パスワードが空でエラー', () => {
    expect(validateSignupInput({
      store_name: 'テスト店舗',
      email: 'test@example.com',
      password: '',
    })).toBe('パスワードは6文字以上で入力してください')
  })

  it('パスワードがnullでエラー', () => {
    expect(validateSignupInput({
      store_name: 'テスト店舗',
      email: 'test@example.com',
      password: null,
    })).toBe('パスワードは6文字以上で入力してください')
  })

  // バリデーション優先順位（最初に見つかったエラーを返す）
  it('全て空の場合は店舗名のエラーが最初', () => {
    expect(validateSignupInput({
      store_name: '',
      email: '',
      password: '',
    })).toBe('店舗名は必須です')
  })
})
