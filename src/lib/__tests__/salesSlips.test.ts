import { describe, it, expect } from 'vitest'
import {
  rangeToTimestamps, filterSlips, sortSlips, calcSlipSummary, isValidRange, EMPTY_FILTERS,
} from '../salesSlips'
import type { PaymentRow, PaymentMethod } from '../../types'

function slip(over: Partial<PaymentRow> & { id: string }): PaymentRow {
  return {
    tenant_id: 't1',
    visit_id: 'v1',
    table_id: 'tb1',
    customer_name: null,
    subtotal: 0,
    expense_total: 0,
    nomination_fee: 0,
    service_fee: 0,
    tax: 0,
    discount: 0,
    total: 0,
    payment_method: 'cash' as PaymentMethod,
    paid_at: '2026-08-01T20:00:00+09:00',
    created_at: '2026-08-01T20:00:00+09:00',
    updated_at: '2026-08-01T20:00:00+09:00',
    ...over,
  }
}

describe('rangeToTimestamps', () => {
  it('営業日ベースで開始12:00〜終了翌日11:59:59を返す', () => {
    const { rangeStart, rangeEnd } = rangeToTimestamps('2026-08-01', '2026-08-03')
    expect(rangeStart).toBe('2026-08-01T12:00:00+09:00')
    expect(rangeEnd).toBe('2026-08-04T11:59:59+09:00')
  })

  it('単日指定でも翌日11:59:59まで含む', () => {
    const { rangeStart, rangeEnd } = rangeToTimestamps('2026-08-01', '2026-08-01')
    expect(rangeStart).toBe('2026-08-01T12:00:00+09:00')
    expect(rangeEnd).toBe('2026-08-02T11:59:59+09:00')
  })

  it('月末をまたいでも翌月1日になる', () => {
    const { rangeEnd } = rangeToTimestamps('2026-07-01', '2026-07-31')
    expect(rangeEnd).toBe('2026-08-01T11:59:59+09:00')
  })
})

describe('filterSlips', () => {
  const rows = [
    slip({ id: 'a', customer_name: '田中様', total: 10000, payment_method: 'cash' }),
    slip({ id: 'b', customer_name: '佐藤様', total: 50000, payment_method: 'credit' }),
    slip({ id: 'c', customer_name: null, total: 30000, payment_method: 'tab' }),
  ]

  it('フィルタ未指定なら全件返す', () => {
    expect(filterSlips(rows, EMPTY_FILTERS)).toHaveLength(3)
  })

  it('顧客名の部分一致で絞り込む', () => {
    const r = filterSlips(rows, { ...EMPTY_FILTERS, keyword: '田中' })
    expect(r.map(x => x.id)).toEqual(['a'])
  })

  it('顧客名なしの伝票はキーワード検索でヒットしない', () => {
    const r = filterSlips(rows, { ...EMPTY_FILTERS, keyword: '様' })
    expect(r.map(x => x.id)).toEqual(['a', 'b'])
  })

  it('支払方法で絞り込む（複数選択はOR）', () => {
    const r = filterSlips(rows, { ...EMPTY_FILTERS, methods: ['credit', 'tab'] })
    expect(r.map(x => x.id)).toEqual(['b', 'c'])
  })

  it('金額の下限・上限で絞り込む（境界値を含む）', () => {
    expect(filterSlips(rows, { ...EMPTY_FILTERS, minTotal: 30000 }).map(x => x.id)).toEqual(['b', 'c'])
    expect(filterSlips(rows, { ...EMPTY_FILTERS, maxTotal: 30000 }).map(x => x.id)).toEqual(['a', 'c'])
    expect(filterSlips(rows, { ...EMPTY_FILTERS, minTotal: 30000, maxTotal: 30000 }).map(x => x.id)).toEqual(['c'])
  })

  it('複数条件はANDで効く', () => {
    const r = filterSlips(rows, { ...EMPTY_FILTERS, keyword: '様', minTotal: 20000 })
    expect(r.map(x => x.id)).toEqual(['b'])
  })
})

describe('sortSlips', () => {
  const rows = [
    slip({ id: 'a', customer_name: 'たなか', total: 10000, paid_at: '2026-08-01T20:00:00+09:00' }),
    slip({ id: 'b', customer_name: 'さとう', total: 50000, paid_at: '2026-08-01T22:00:00+09:00' }),
    slip({ id: 'c', customer_name: null, total: 30000, paid_at: '2026-08-01T21:00:00+09:00' }),
  ]

  it('会計日時の降順', () => {
    expect(sortSlips(rows, 'paid_at', 'desc').map(x => x.id)).toEqual(['b', 'c', 'a'])
  })

  it('合計金額の昇順', () => {
    expect(sortSlips(rows, 'total', 'asc').map(x => x.id)).toEqual(['a', 'c', 'b'])
  })

  it('顧客名なしは方向によらず末尾に来る', () => {
    expect(sortSlips(rows, 'customer_name', 'asc').map(x => x.id).at(-1)).toBe('c')
    expect(sortSlips(rows, 'customer_name', 'desc').map(x => x.id).at(-1)).toBe('c')
  })

  it('元配列を変更しない', () => {
    const before = rows.map(r => r.id)
    sortSlips(rows, 'total', 'desc')
    expect(rows.map(r => r.id)).toEqual(before)
  })

  it('同額なら会計日時で安定する', () => {
    const same = [
      slip({ id: 'x', total: 5000, paid_at: '2026-08-01T22:00:00+09:00' }),
      slip({ id: 'y', total: 5000, paid_at: '2026-08-01T20:00:00+09:00' }),
    ]
    expect(sortSlips(same, 'total', 'asc').map(x => x.id)).toEqual(['y', 'x'])
  })
})

describe('calcSlipSummary', () => {
  it('件数・売上合計・平均・支払方法別を集計する', () => {
    const s = calcSlipSummary([
      slip({ id: 'a', total: 10000, payment_method: 'cash' }),
      slip({ id: 'b', total: 50000, payment_method: 'credit' }),
      slip({ id: 'c', total: 30000, payment_method: 'cash' }),
    ])
    expect(s.count).toBe(3)
    expect(s.totalSales).toBe(90000)
    expect(s.avgSlip).toBe(30000)
    expect(s.methodTotals).toEqual({ cash: 40000, credit: 50000 })
  })

  it('0件でも平均は0（ゼロ除算しない）', () => {
    const s = calcSlipSummary([])
    expect(s.count).toBe(0)
    expect(s.totalSales).toBe(0)
    expect(s.avgSlip).toBe(0)
    expect(s.methodTotals).toEqual({})
  })

  it('平均は切り捨て', () => {
    const s = calcSlipSummary([
      slip({ id: 'a', total: 10000 }),
      slip({ id: 'b', total: 10001 }),
    ])
    expect(s.avgSlip).toBe(10000)
  })
})

describe('isValidRange', () => {
  it('開始日 <= 終了日 なら有効', () => {
    expect(isValidRange('2026-08-01', '2026-08-03')).toBe(true)
    expect(isValidRange('2026-08-01', '2026-08-01')).toBe(true)
  })

  it('開始日 > 終了日 なら無効', () => {
    expect(isValidRange('2026-08-05', '2026-08-01')).toBe(false)
  })
})
