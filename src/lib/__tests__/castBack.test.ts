import { describe, it, expect } from 'vitest'
import { backTotal, hasBack, splitBack } from '../castBack'

const sum = (rs: { amount: number }[]) => rs.reduce((s, r) => s + r.amount, 0)

// ===========================================
// backTotal: 1明細のバック総額
// ===========================================
describe('backTotal', () => {
  it('率で計算する', () => {
    // ¥30,000 × 20% = ¥6,000
    expect(backTotal({ backRate: 0.2, backAmount: null }, 30000, 1)).toBe(6000)
  })

  it('数量を掛ける', () => {
    expect(backTotal({ backRate: 0.2, backAmount: null }, 1500, 3)).toBe(900)
  })

  it('絶対額は率より優先される', () => {
    // 率20%なら6,000円だが、絶対額3,000円が勝つ
    expect(backTotal({ backRate: 0.2, backAmount: 3000 }, 30000, 1)).toBe(3000)
  })

  it('絶対額は1点あたりで数量分になる', () => {
    expect(backTotal({ backRate: null, backAmount: 3000 }, 30000, 3)).toBe(9000)
  })

  it('どちらも未設定ならバックなし', () => {
    expect(backTotal({ backRate: null, backAmount: null }, 30000, 1)).toBe(0)
  })

  it('数量0以下はバックなし', () => {
    expect(backTotal({ backRate: 0.2, backAmount: null }, 30000, 0)).toBe(0)
  })

  it('率は0〜1にクランプする', () => {
    expect(backTotal({ backRate: 1.5, backAmount: null }, 10000, 1)).toBe(10000)
    expect(backTotal({ backRate: -0.5, backAmount: null }, 10000, 1)).toBe(0)
  })

  it('端数は四捨五入する', () => {
    // 3,333 × 15% = 499.95 → 500
    expect(backTotal({ backRate: 0.15, backAmount: null }, 3333, 1)).toBe(500)
  })
})

describe('hasBack', () => {
  it('率だけでも設定ありとみなす', () => {
    expect(hasBack({ backRate: 0.2, backAmount: null })).toBe(true)
  })
  it('額だけでも設定ありとみなす', () => {
    expect(hasBack({ backRate: null, backAmount: 3000 })).toBe(true)
  })
  it('両方未設定なら設定なし', () => {
    expect(hasBack({ backRate: null, backAmount: null })).toBe(false)
  })
  it('0%も設定ありとして扱う（明示的にバックなしにした場合）', () => {
    expect(hasBack({ backRate: 0, backAmount: null })).toBe(true)
  })
})

// ===========================================
// splitBack: 本指名キャストへの按分
// ===========================================
describe('splitBack', () => {
  it('1人ならそのまま全額', () => {
    const result = splitBack(6000, [{ castId: 'a', qty: 1 }])
    expect(result).toEqual([{ castId: 'a', amount: 6000 }])
  })

  it('2人なら半分ずつ', () => {
    const result = splitBack(900, [{ castId: 'a', qty: 1 }, { castId: 'b', qty: 1 }])
    expect(result.map(r => r.amount)).toEqual([450, 450])
    expect(sum(result)).toBe(900)
  })

  it('割り切れない場合も合計が一致する', () => {
    const result = splitBack(1000, [
      { castId: 'a', qty: 1 }, { castId: 'b', qty: 1 }, { castId: 'c', qty: 1 },
    ])
    expect(sum(result)).toBe(1000)
    expect(result.map(r => r.amount).sort((x, y) => y - x)).toEqual([334, 333, 333])
  })

  it('指名数の比率で按分する', () => {
    // 2:1 の比率
    const result = splitBack(3000, [{ castId: 'a', qty: 2 }, { castId: 'b', qty: 1 }])
    expect(result.find(r => r.castId === 'a')?.amount).toBe(2000)
    expect(result.find(r => r.castId === 'b')?.amount).toBe(1000)
    expect(sum(result)).toBe(3000)
  })

  it('本指名がいなければ按分しない（バックは本指名のみ）', () => {
    expect(splitBack(6000, [])).toEqual([])
  })

  it('バック総額が0なら按分しない', () => {
    expect(splitBack(0, [{ castId: 'a', qty: 1 }])).toEqual([])
  })

  it('0円になる行は返さない', () => {
    // 1円を3人で割ると2人は0円になる
    const result = splitBack(1, [
      { castId: 'a', qty: 1 }, { castId: 'b', qty: 1 }, { castId: 'c', qty: 1 },
    ])
    expect(result.every(r => r.amount > 0)).toBe(true)
    expect(sum(result)).toBe(1)
  })

  it('どんな金額・人数でも合計が一致する', () => {
    for (const total of [1, 7, 999, 6000, 12345]) {
      for (let n = 1; n <= 5; n++) {
        const noms = Array.from({ length: n }, (_, i) => ({ castId: `c${i}`, qty: 1 }))
        expect(sum(splitBack(total, noms))).toBe(total)
      }
    }
  })
})
