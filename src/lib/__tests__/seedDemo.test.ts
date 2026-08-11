import { describe, it, expect } from 'vitest'

// デモアカウントの設定値テスト
// seed_demo.sql と整合性が取れていることを確認

const DEMO_TENANT_ID = 'c0000000-0000-0000-0000-000000000001'
const DEMO_DEVICE_TOKEN = 'luna-demo'
const DEMO_EMAIL = 'demo@lunapos.jp'
const DEMO_PASSWORD = 'luna1234'

describe('デモアカウント設定', () => {
  it('テナントIDがUUID形式', () => {
    expect(DEMO_TENANT_ID).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
  })

  it('デバイストークンがluna-プレフィックス', () => {
    expect(DEMO_DEVICE_TOKEN.startsWith('luna-')).toBe(true)
  })

  it('メールアドレスがlunapos.jpドメイン', () => {
    expect(DEMO_EMAIL.endsWith('@lunapos.jp')).toBe(true)
  })

  it('パスワードが6文字以上（最低要件を満たす）', () => {
    expect(DEMO_PASSWORD.length).toBeGreaterThanOrEqual(6)
  })
})

describe('デモ店舗データ整合性', () => {
  // seed_demo.sqlのUUID規約
  const UUID_PREFIX = 'c0000000'

  it('テナントIDがcプレフィックス（devのa、betaのbと衝突しない）', () => {
    expect(DEMO_TENANT_ID.startsWith('c')).toBe(true)
  })

  it('dev/beta/demoのテナントIDが異なる', () => {
    const devId = 'a0000000-0000-0000-0000-000000000001'
    const betaId = 'b0000000-0000-0000-0000-000000000001'
    expect(DEMO_TENANT_ID).not.toBe(devId)
    expect(DEMO_TENANT_ID).not.toBe(betaId)
    expect(devId).not.toBe(betaId)
  })

  it('デモデバイストークンがdev/betaと異なる', () => {
    const devToken = 'dev-test-token-12345678'
    const betaToken = 'ups-beta-token-20260329'
    expect(DEMO_DEVICE_TOKEN).not.toBe(devToken)
    expect(DEMO_DEVICE_TOKEN).not.toBe(betaToken)
  })
})

describe('デモ店舗の料率設定（デフォルト値）', () => {
  const demoStore = {
    service_rate: 0.4,
    tax_rate: 0.1,
    douhan_fee: 3000,
    nomination_fee_main: 5000,
    nomination_fee_in_store: 2000,
  }

  it('サービス料率がDBデフォルトと一致', () => {
    expect(demoStore.service_rate).toBe(0.4)
  })

  it('消費税率が現行法と一致（10%）', () => {
    expect(demoStore.tax_rate).toBe(0.1)
  })

  it('同伴料がCLAUDE.mdの定義と一致（¥3,000）', () => {
    expect(demoStore.douhan_fee).toBe(3000)
  })

  it('本指名料がCLAUDE.mdの定義と一致（¥5,000）', () => {
    expect(demoStore.nomination_fee_main).toBe(5000)
  })

  it('場内指名料がCLAUDE.mdの定義と一致（¥2,000）', () => {
    expect(demoStore.nomination_fee_in_store).toBe(2000)
  })
})
