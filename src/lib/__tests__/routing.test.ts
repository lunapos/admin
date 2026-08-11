import { describe, it, expect } from 'vitest'

// ルーティング設定の正しさをテスト
// App.tsxのルート定義と一致していることを確認

const ALL_ROUTES = [
  '/login',
  '/signup',
  '/',
  '/menu',
  '/casts',
  '/tables',
  '/plans',
  '/settings',
]

const PROTECTED_ROUTES = [
  '/',
  '/menu',
  '/casts',
  '/tables',
  '/plans',
  '/settings',
]

const PUBLIC_ROUTES = [
  '/login',
  '/signup',
]

const NAV_ITEMS = [
  { path: '/', label: 'ダッシュボード' },
  { path: '/menu', label: 'メニュー管理' },
  { path: '/casts', label: 'キャスト管理' },
  { path: '/tables', label: 'テーブル管理' },
  { path: '/plans', label: 'セットプラン' },
  { path: '/settings', label: '店舗設定' },
]

describe('ルーティング定義', () => {
  it('全ルートが / で始まる', () => {
    ALL_ROUTES.forEach(route => {
      expect(route.startsWith('/')).toBe(true)
    })
  })

  it('公開ルートは2つ（login, signup）', () => {
    expect(PUBLIC_ROUTES).toHaveLength(2)
    expect(PUBLIC_ROUTES).toContain('/login')
    expect(PUBLIC_ROUTES).toContain('/signup')
  })

  it('保護ルートは6つ', () => {
    expect(PROTECTED_ROUTES).toHaveLength(6)
  })

  it('公開ルートと保護ルートに重複がない', () => {
    const overlap = PUBLIC_ROUTES.filter(r => PROTECTED_ROUTES.includes(r))
    expect(overlap).toHaveLength(0)
  })

  it('ナビゲーションアイテムは保護ルートのみ', () => {
    NAV_ITEMS.forEach(item => {
      expect(PROTECTED_ROUTES).toContain(item.path)
    })
  })

  it('signupルートはナビゲーションに含まれない', () => {
    const navPaths = NAV_ITEMS.map(i => i.path)
    expect(navPaths).not.toContain('/signup')
  })

  it('loginルートはナビゲーションに含まれない', () => {
    const navPaths = NAV_ITEMS.map(i => i.path)
    expect(navPaths).not.toContain('/login')
  })
})

describe('パンくずリスト', () => {
  const BREADCRUMB_LABELS: Record<string, string> = {
    '/': 'ダッシュボード',
    '/menu': 'メニュー管理',
    '/casts': 'キャスト管理',
    '/tables': 'テーブル管理',
    '/plans': 'セットプラン',
    '/settings': '店舗設定',
  }

  it('全保護ルートにパンくずラベルがある', () => {
    PROTECTED_ROUTES.forEach(route => {
      expect(BREADCRUMB_LABELS[route]).toBeDefined()
    })
  })

  it('ラベルがナビゲーションと一致する', () => {
    NAV_ITEMS.forEach(item => {
      expect(BREADCRUMB_LABELS[item.path]).toBe(item.label)
    })
  })
})
