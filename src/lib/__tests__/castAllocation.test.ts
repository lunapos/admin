import { describe, it, expect } from 'vitest'
import { allocate, normalize, splitEvenly, addRow, removeRow } from '../castAllocation'
import type { AllocationRow } from '../castAllocation'

function rows(...amounts: number[]): AllocationRow[] {
  return amounts.map((amount, i) => ({ castId: `c${i + 1}`, amount }))
}

const sum = (rs: AllocationRow[]) => rs.reduce((s, r) => s + r.amount, 0)

// ===========================================
// allocate: 金額を指定して残りを振り分ける
// ===========================================
describe('allocate', () => {
  it('指定額を固定し、残りを他の1人に渡す', () => {
    const result = allocate(rows(12400, 12400), 0, 15000, 24800)
    expect(result[0].amount).toBe(15000)
    expect(result[1].amount).toBe(9800)
    expect(sum(result)).toBe(24800)
  })

  it('他の行が複数あるときは既存比率を保って分ける', () => {
    // 残り 10000 を 2:1 の比率で分ける
    const result = allocate(rows(0, 6000, 3000), 0, 20000, 30000)
    expect(result[0].amount).toBe(20000)
    expect(result[1].amount).toBe(6667)
    expect(result[2].amount).toBe(3333)
    expect(sum(result)).toBe(30000)
  })

  it('他の行が全員0なら均等に分ける', () => {
    const result = allocate(rows(0, 0, 0), 0, 10000, 30000)
    expect(result[0].amount).toBe(10000)
    expect(result[1].amount).toBe(10000)
    expect(result[2].amount).toBe(10000)
    expect(sum(result)).toBe(30000)
  })

  it('1人しかいない場合は全額を割り当てる', () => {
    const result = allocate(rows(5000), 0, 3000, 24800)
    expect(result[0].amount).toBe(24800)
    expect(sum(result)).toBe(24800)
  })

  it('subtotal を超える入力は subtotal で頭打ちにする', () => {
    const result = allocate(rows(10000, 10000), 0, 99999, 20000)
    expect(result[0].amount).toBe(20000)
    expect(result[1].amount).toBe(0)
    expect(sum(result)).toBe(20000)
  })

  it('マイナス入力は0として扱う', () => {
    const result = allocate(rows(10000, 10000), 0, -5000, 20000)
    expect(result[0].amount).toBe(0)
    expect(result[1].amount).toBe(20000)
    expect(sum(result)).toBe(20000)
  })

  it('割り切れない残額でも合計が一致する', () => {
    const result = allocate(rows(0, 0, 0), 0, 1, 10000)
    expect(result[0].amount).toBe(1)
    expect(sum(result)).toBe(10000)
  })

  it('範囲外のindexでは何もしない', () => {
    const input = rows(10000, 10000)
    expect(allocate(input, 5, 1000, 20000)).toEqual(input)
    expect(allocate(input, -1, 1000, 20000)).toEqual(input)
  })
})

// ===========================================
// normalize: 比率を保って合計を合わせ直す
// ===========================================
describe('normalize', () => {
  it('合計が不足していれば比率どおりに引き上げる', () => {
    const result = normalize(rows(6000, 3000), 30000)
    expect(result[0].amount).toBe(20000)
    expect(result[1].amount).toBe(10000)
    expect(sum(result)).toBe(30000)
  })

  it('合計が超過していれば比率どおりに引き下げる', () => {
    const result = normalize(rows(40000, 20000), 30000)
    expect(sum(result)).toBe(30000)
    expect(result[0].amount).toBe(20000)
    expect(result[1].amount).toBe(10000)
  })

  it('全員0なら均等に分ける', () => {
    const result = normalize(rows(0, 0, 0), 9000)
    expect(result).toEqual([
      { castId: 'c1', amount: 3000 },
      { castId: 'c2', amount: 3000 },
      { castId: 'c3', amount: 3000 },
    ])
  })

  it('割り切れなくても合計が一致する', () => {
    const result = normalize(rows(1, 1, 1), 10000)
    expect(sum(result)).toBe(10000)
  })

  it('空配列はそのまま返す', () => {
    expect(normalize([], 10000)).toEqual([])
  })
})

// ===========================================
// splitEvenly: 均等割り
// ===========================================
describe('splitEvenly', () => {
  it('割り切れる場合は全員同額', () => {
    const result = splitEvenly(rows(0, 0), 20000)
    expect(result[0].amount).toBe(10000)
    expect(result[1].amount).toBe(10000)
  })

  it('割り切れない場合は端数を先頭から配り合計を合わせる', () => {
    const result = splitEvenly(rows(0, 0, 0), 10001)
    expect(result.map(r => r.amount)).toEqual([3334, 3334, 3333])
    expect(sum(result)).toBe(10001)
  })

  it('空配列はそのまま返す', () => {
    expect(splitEvenly([], 10000)).toEqual([])
  })
})

// ===========================================
// addRow / removeRow
// ===========================================
describe('addRow', () => {
  it('追加後も合計が一致する', () => {
    const result = addRow(rows(24800), 'c2', 24800)
    expect(result).toHaveLength(2)
    expect(sum(result)).toBe(24800)
  })

  it('3人目を追加しても合計が一致する', () => {
    const result = addRow(rows(15000, 9800), 'c3', 24800)
    expect(result).toHaveLength(3)
    expect(sum(result)).toBe(24800)
  })

  it('既にいるキャストは追加しない', () => {
    const input = rows(24800)
    expect(addRow(input, 'c1', 24800)).toEqual(input)
  })

  it('空のcastIdは追加しない', () => {
    const input = rows(24800)
    expect(addRow(input, '', 24800)).toEqual(input)
  })
})

describe('removeRow', () => {
  it('削除した分を残りへ比率どおり振り直す', () => {
    const result = removeRow(rows(10000, 6000, 4000), 0, 20000)
    expect(result).toHaveLength(2)
    expect(result[0].amount).toBe(12000)
    expect(result[1].amount).toBe(8000)
    expect(sum(result)).toBe(20000)
  })

  it('2人から1人にしたら全額がその人に寄る', () => {
    const result = removeRow(rows(15000, 9800), 0, 24800)
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe(24800)
  })

  it('全員削除したら空になる', () => {
    expect(removeRow(rows(24800), 0, 24800)).toEqual([])
  })
})

// ===========================================
// 不変条件: どの操作を重ねても合計は subtotal のまま
// ===========================================
describe('不変条件', () => {
  it('連続操作しても合計が subtotal を保つ', () => {
    const subtotal = 24800
    let rs = splitEvenly(rows(0, 0), subtotal)
    expect(sum(rs)).toBe(subtotal)

    rs = allocate(rs, 0, 15000, subtotal)
    expect(sum(rs)).toBe(subtotal)

    rs = addRow(rs, 'c3', subtotal)
    expect(sum(rs)).toBe(subtotal)

    rs = allocate(rs, 2, 3333, subtotal)
    expect(sum(rs)).toBe(subtotal)

    rs = removeRow(rs, 1, subtotal)
    expect(sum(rs)).toBe(subtotal)

    rs = normalize(rs, subtotal)
    expect(sum(rs)).toBe(subtotal)
  })

  it('端数が出やすい金額でも合計が一致する', () => {
    for (const subtotal of [1, 7, 999, 10001, 33333, 99991]) {
      for (const n of [1, 2, 3, 5, 7]) {
        const rs = splitEvenly(Array.from({ length: n }, (_, i) => ({ castId: `c${i}`, amount: 0 })), subtotal)
        expect(sum(rs)).toBe(subtotal)
        expect(sum(allocate(rs, 0, Math.floor(subtotal / 3), subtotal))).toBe(subtotal)
        expect(sum(normalize(rs, subtotal))).toBe(subtotal)
      }
    }
  })

  it('マイナスの配分額は発生しない', () => {
    const rs = allocate(rows(0, 0, 0), 0, 30000, 30000)
    expect(rs.every(r => r.amount >= 0)).toBe(true)
    expect(sum(rs)).toBe(30000)
  })
})
