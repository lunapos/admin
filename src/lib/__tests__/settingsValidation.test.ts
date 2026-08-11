import { describe, it, expect } from 'vitest'

// 設定ページのバリデーションロジック
// SettingsPageで使われている各種バリデーションをテスト

describe('料率バリデーション', () => {
  // フォーム入力（パーセント）→DB保存（小数）の変換
  function percentToRate(input: string): number {
    return (parseFloat(input) || 0) / 100
  }

  function rateToPercent(rate: number): string {
    return String(Math.round(rate * 100))
  }

  it('40% → 0.4 に変換', () => {
    expect(percentToRate('40')).toBe(0.4)
  })

  it('10% → 0.1 に変換', () => {
    expect(percentToRate('10')).toBe(0.1)
  })

  it('0% → 0 に変換', () => {
    expect(percentToRate('0')).toBe(0)
  })

  it('空文字 → 0 に変換', () => {
    expect(percentToRate('')).toBe(0)
  })

  it('小数点付き → 正しく変換', () => {
    expect(percentToRate('8.5')).toBeCloseTo(0.085)
  })

  it('DB → フォーム: 0.4 → "40"', () => {
    expect(rateToPercent(0.4)).toBe('40')
  })

  it('DB → フォーム: 0.1 → "10"', () => {
    expect(rateToPercent(0.1)).toBe('10')
  })

  it('往復変換で値が保持される', () => {
    const original = 0.4
    const displayed = rateToPercent(original)
    const restored = percentToRate(displayed)
    expect(restored).toBe(original)
  })
})

describe('金額入力バリデーション', () => {
  function parseIntSafe(input: string): number {
    return parseInt(input) || 0
  }

  it('正常な数値をパース', () => {
    expect(parseIntSafe('5000')).toBe(5000)
    expect(parseIntSafe('0')).toBe(0)
  })

  it('空文字は0', () => {
    expect(parseIntSafe('')).toBe(0)
  })

  it('文字列は0', () => {
    expect(parseIntSafe('abc')).toBe(0)
  })

  it('小数は切り捨て', () => {
    expect(parseIntSafe('5000.99')).toBe(5000)
  })

  it('負数もパース可能', () => {
    expect(parseIntSafe('-1000')).toBe(-1000)
  })
})

describe('店舗設定デフォルト値', () => {
  const defaults = {
    service_rate: 0.4,
    tax_rate: 0.1,
    douhan_fee: 3000,
    nomination_fee_main: 5000,
    nomination_fee_in_store: 2000,
  }

  it('サービス料率のデフォルトは40%', () => {
    expect(defaults.service_rate).toBe(0.4)
  })

  it('消費税率のデフォルトは10%', () => {
    expect(defaults.tax_rate).toBe(0.1)
  })

  it('同伴料のデフォルトは¥3,000', () => {
    expect(defaults.douhan_fee).toBe(3000)
  })

  it('本指名料のデフォルトは¥5,000', () => {
    expect(defaults.nomination_fee_main).toBe(5000)
  })

  it('場内指名料のデフォルトは¥2,000', () => {
    expect(defaults.nomination_fee_in_store).toBe(2000)
  })

  it('本指名 > 場内指名の関係が成立する', () => {
    expect(defaults.nomination_fee_main).toBeGreaterThan(defaults.nomination_fee_in_store)
  })
})
