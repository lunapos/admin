import { describe, it, expect, vi, beforeEach } from 'vitest'

// supabase.tsはcreateClientが初期化時に実行されるため、
// モジュール全体をモックしてテナントID管理ロジックをテストする

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(),
  }),
}))

describe('テナントID管理', () => {
  beforeEach(async () => {
    // テスト間でモジュール状態をリセット
    vi.resetModules()
  })

  it('setTenantIdで設定した値をgetTenantIdで取得できる', async () => {
    const { setTenantId, getTenantId } = await import('../supabase')
    setTenantId('test-id-123')
    expect(getTenantId()).toBe('test-id-123')
  })

  it('setTenantIdを複数回呼ぶと最後の値が有効', async () => {
    const { setTenantId, getTenantId } = await import('../supabase')
    setTenantId('first')
    setTenantId('second')
    expect(getTenantId()).toBe('second')
  })

  it('requireTenantIdが設定済みの値を返す', async () => {
    const { setTenantId, requireTenantId } = await import('../supabase')
    setTenantId('required-id')
    expect(requireTenantId()).toBe('required-id')
  })

  it('supabaseUrl が export されている', async () => {
    const { supabaseUrl } = await import('../supabase')
    expect(typeof supabaseUrl).toBe('string')
    expect(supabaseUrl.length).toBeGreaterThan(0)
  })
})
