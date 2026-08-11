// 売上伝票一覧の絞り込み・集計ロジック（テスト可能な純粋関数）

import type { PaymentRow, PaymentMethod } from '../types'
import { toDateStr } from './dashboard'

export type SlipSortKey = 'paid_at' | 'total' | 'customer_name'
export type SortDir = 'asc' | 'desc'

export interface SlipFilters {
  /** 顧客名の部分一致（大文字小文字を無視）。空文字なら絞り込まない */
  keyword: string
  /** 支払方法の絞り込み。空配列なら全件 */
  methods: PaymentMethod[]
  /** 合計金額の下限（円）。null なら下限なし */
  minTotal: number | null
  /** 合計金額の上限（円）。null なら上限なし */
  maxTotal: number | null
}

export const EMPTY_FILTERS: SlipFilters = {
  keyword: '',
  methods: [],
  minTotal: null,
  maxTotal: null,
}

/**
 * 期間の開始・終了時刻を返す（ISO8601 JST）
 * 営業日ベース: 開始日の 12:00 JST 〜 終了日の翌日 11:59:59 JST
 */
export function rangeToTimestamps(startDate: string, endDate: string): { rangeStart: string; rangeEnd: string } {
  const rangeStart = `${startDate}T12:00:00+09:00`
  const d = new Date(`${endDate}T12:00:00+09:00`)
  d.setDate(d.getDate() + 1)
  const rangeEnd = `${toDateStr(d)}T11:59:59+09:00`
  return { rangeStart, rangeEnd }
}

/** 伝票を絞り込む */
export function filterSlips(payments: PaymentRow[], filters: SlipFilters): PaymentRow[] {
  const keyword = filters.keyword.trim().toLowerCase()
  return payments.filter(p => {
    if (keyword && !(p.customer_name ?? '').toLowerCase().includes(keyword)) return false
    if (filters.methods.length > 0 && !filters.methods.includes(p.payment_method)) return false
    if (filters.minTotal !== null && p.total < filters.minTotal) return false
    if (filters.maxTotal !== null && p.total > filters.maxTotal) return false
    return true
  })
}

/** 伝票を並び替える（元配列は変更しない） */
export function sortSlips(payments: PaymentRow[], key: SlipSortKey, dir: SortDir): PaymentRow[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...payments].sort((a, b) => {
    let cmp = 0
    if (key === 'total') {
      cmp = a.total - b.total
    } else if (key === 'customer_name') {
      // 顧客名なしは常に末尾に寄せる
      const an = a.customer_name ?? ''
      const bn = b.customer_name ?? ''
      if (an === '' && bn === '') cmp = 0
      else if (an === '') return 1
      else if (bn === '') return -1
      else cmp = an.localeCompare(bn, 'ja')
    } else {
      cmp = a.paid_at.localeCompare(b.paid_at)
    }
    // 同値のときは会計日時で安定させる
    if (cmp === 0) cmp = a.paid_at.localeCompare(b.paid_at)
    return cmp * sign
  })
}

export interface SlipSummary {
  count: number
  totalSales: number
  avgSlip: number
  methodTotals: Record<string, number>
}

/** 絞り込み後の伝票からサマリーを計算する */
export function calcSlipSummary(payments: PaymentRow[]): SlipSummary {
  const totalSales = payments.reduce((s, p) => s + p.total, 0)
  const count = payments.length
  const methodTotals: Record<string, number> = {}
  for (const p of payments) {
    methodTotals[p.payment_method] = (methodTotals[p.payment_method] || 0) + p.total
  }
  return {
    count,
    totalSales,
    avgSlip: count > 0 ? Math.floor(totalSales / count) : 0,
    methodTotals,
  }
}

/** 開始日が終了日より後になっていないか検証する */
export function isValidRange(startDate: string, endDate: string): boolean {
  return startDate <= endDate
}
