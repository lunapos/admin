import { describe, it, expect } from 'vitest'
import {
  filterCashEntries, calcCashEntrySummary, calcCategoryBreakdown, calcDailyCashTotals,
  jstDateOf, validateCashEntry, EMPTY_CASH_FILTERS,
} from '../cashEntries'
import type { CashWithdrawalRow } from '../../types'

function entry(over: Partial<CashWithdrawalRow> & { id: string }): CashWithdrawalRow {
  return {
    tenant_id: 't1',
    amount: 1000,
    entry_type: 'withdrawal',
    category: null,
    note: null,
    deleted_at: null,
    deleted_by: null,
    delete_reason: null,
    created_at: '2026-08-01T20:00:00+09:00',
    updated_at: '2026-08-01T20:00:00+09:00',
    ...over,
  }
}

describe('filterCashEntries', () => {
  const rows = [
    entry({ id: 'a', entry_type: 'deposit', amount: 5000, category: '釣銭補充', note: '千円札' }),
    entry({ id: 'b', entry_type: 'withdrawal', amount: 3000, category: '買い出し', note: '氷' }),
    entry({ id: 'c', entry_type: 'withdrawal', amount: 8000, category: null, note: null }),
  ]

  it('未指定なら全件返す', () => {
    expect(filterCashEntries(rows, EMPTY_CASH_FILTERS)).toHaveLength(3)
  })

  it('区分で絞り込む', () => {
    expect(filterCashEntries(rows, { ...EMPTY_CASH_FILTERS, types: ['deposit'] }).map(x => x.id)).toEqual(['a'])
    expect(filterCashEntries(rows, { ...EMPTY_CASH_FILTERS, types: ['withdrawal'] }).map(x => x.id)).toEqual(['b', 'c'])
  })

  it('区分を両方選ぶと全件返る', () => {
    const r = filterCashEntries(rows, { ...EMPTY_CASH_FILTERS, types: ['deposit', 'withdrawal'] })
    expect(r).toHaveLength(3)
  })

  it('用途カテゴリで絞り込む', () => {
    expect(filterCashEntries(rows, { ...EMPTY_CASH_FILTERS, categories: ['買い出し'] }).map(x => x.id)).toEqual(['b'])
  })

  it('メモとカテゴリの両方をキーワード検索の対象にする', () => {
    expect(filterCashEntries(rows, { ...EMPTY_CASH_FILTERS, keyword: '氷' }).map(x => x.id)).toEqual(['b'])
    expect(filterCashEntries(rows, { ...EMPTY_CASH_FILTERS, keyword: '釣銭' }).map(x => x.id)).toEqual(['a'])
  })

  it('メモ・カテゴリがnullの行はキーワード検索でヒットしない', () => {
    expect(filterCashEntries(rows, { ...EMPTY_CASH_FILTERS, keyword: 'あ' })).toHaveLength(0)
  })

  it('複数条件はANDで効く', () => {
    const r = filterCashEntries(rows, { ...EMPTY_CASH_FILTERS, types: ['withdrawal'], keyword: '氷' })
    expect(r.map(x => x.id)).toEqual(['b'])
  })
})

describe('calcCashEntrySummary', () => {
  it('入金・出金を区分ごとに集計し差引を出す', () => {
    const s = calcCashEntrySummary([
      entry({ id: 'a', entry_type: 'deposit', amount: 5000 }),
      entry({ id: 'b', entry_type: 'deposit', amount: 3000 }),
      entry({ id: 'c', entry_type: 'withdrawal', amount: 10000 }),
    ])
    expect(s.depositCount).toBe(2)
    expect(s.depositTotal).toBe(8000)
    expect(s.withdrawalCount).toBe(1)
    expect(s.withdrawalTotal).toBe(10000)
    expect(s.net).toBe(-2000)
  })

  it('出金の方が多ければ差引はマイナスになる', () => {
    const s = calcCashEntrySummary([entry({ id: 'a', entry_type: 'withdrawal', amount: 500 })])
    expect(s.net).toBe(-500)
  })

  it('0件なら全て0', () => {
    const s = calcCashEntrySummary([])
    expect(s).toEqual({
      depositCount: 0, depositTotal: 0, withdrawalCount: 0, withdrawalTotal: 0, net: 0,
    })
  })
})

describe('calcCategoryBreakdown', () => {
  const rows = [
    entry({ id: 'a', entry_type: 'withdrawal', amount: 3000, category: '両替' }),
    entry({ id: 'b', entry_type: 'withdrawal', amount: 5000, category: '買い出し' }),
    entry({ id: 'c', entry_type: 'withdrawal', amount: 2000, category: '両替' }),
    entry({ id: 'd', entry_type: 'deposit', amount: 9000, category: '釣銭補充' }),
  ]

  it('指定した区分のみを集計する', () => {
    const r = calcCategoryBreakdown(rows, 'deposit')
    expect(r).toEqual([{ category: '釣銭補充', count: 1, total: 9000 }])
  })

  it('同一カテゴリをまとめる', () => {
    const r = calcCategoryBreakdown(rows, 'withdrawal')
    expect(r).toHaveLength(2)
    expect(r.find(x => x.category === '両替')).toEqual({ category: '両替', count: 2, total: 5000 })
    expect(r.find(x => x.category === '買い出し')).toEqual({ category: '買い出し', count: 1, total: 5000 })
  })

  it('合計金額の降順で返す', () => {
    const r = calcCategoryBreakdown([
      entry({ id: 'a', entry_type: 'withdrawal', amount: 1000, category: '両替' }),
      entry({ id: 'b', entry_type: 'withdrawal', amount: 9000, category: '買い出し' }),
      entry({ id: 'c', entry_type: 'withdrawal', amount: 5000, category: 'タクシー代' }),
    ], 'withdrawal')
    expect(r.map(x => x.category)).toEqual(['買い出し', 'タクシー代', '両替'])
  })

  it('同額の場合はカテゴリ名で安定した順序になる', () => {
    const r = calcCategoryBreakdown(rows, 'withdrawal')
    const again = calcCategoryBreakdown([...rows].reverse(), 'withdrawal')
    expect(r.map(x => x.category)).toEqual(again.map(x => x.category))
  })

  it('カテゴリ未設定・空文字は「未分類」にまとめる', () => {
    const r = calcCategoryBreakdown([
      entry({ id: 'x', entry_type: 'withdrawal', amount: 100, category: null }),
      entry({ id: 'y', entry_type: 'withdrawal', amount: 200, category: '   ' }),
    ], 'withdrawal')
    expect(r).toEqual([{ category: '未分類', count: 2, total: 300 }])
  })
})

describe('calcDailyCashTotals', () => {
  it('日別に入金・出金・差引を集計し日付昇順で返す', () => {
    const r = calcDailyCashTotals([
      entry({ id: 'a', entry_type: 'deposit', amount: 5000, created_at: '2026-08-02T20:00:00+09:00' }),
      entry({ id: 'b', entry_type: 'withdrawal', amount: 3000, created_at: '2026-08-01T20:00:00+09:00' }),
      entry({ id: 'c', entry_type: 'withdrawal', amount: 1000, created_at: '2026-08-02T22:00:00+09:00' }),
    ])
    expect(r).toEqual([
      { date: '2026-08-01', depositTotal: 0, withdrawalTotal: 3000, net: -3000 },
      { date: '2026-08-02', depositTotal: 5000, withdrawalTotal: 1000, net: 4000 },
    ])
  })
})

describe('jstDateOf', () => {
  it('JSTの日付を返す', () => {
    expect(jstDateOf('2026-08-01T20:00:00+09:00')).toBe('2026-08-01')
  })

  it('深夜営業（JST 翌1時）は翌日の日付になる', () => {
    expect(jstDateOf('2026-08-02T01:00:00+09:00')).toBe('2026-08-02')
  })

  it('UTC表記でもJSTに換算する', () => {
    // 2026-08-01T16:00:00Z = 2026-08-02T01:00:00+09:00
    expect(jstDateOf('2026-08-01T16:00:00Z')).toBe('2026-08-02')
  })
})

describe('validateCashEntry', () => {
  it('正の整数は通る', () => {
    expect(validateCashEntry('10000')).toBeNull()
    expect(validateCashEntry(' 500 ')).toBeNull()
  })

  it('空欄はエラー', () => {
    expect(validateCashEntry('')).toBe('金額を入力してください')
    expect(validateCashEntry('   ')).toBe('金額を入力してください')
  })

  it('数値でない場合はエラー', () => {
    expect(validateCashEntry('abc')).toBe('金額は数値で入力してください')
  })

  it('小数はエラー（1円単位）', () => {
    expect(validateCashEntry('100.5')).toBe('金額は1円単位で入力してください')
  })

  it('0以下はエラー（DBのCHECK制約と揃える）', () => {
    expect(validateCashEntry('0')).toBe('金額は1円以上で入力してください')
    expect(validateCashEntry('-500')).toBe('金額は1円以上で入力してください')
  })
})
