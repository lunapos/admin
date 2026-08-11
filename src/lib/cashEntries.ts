// 入出金履歴の絞り込み・集計ロジック（テスト可能な純粋関数）

import type { CashWithdrawalRow, CashEntryType } from '../types'

export const ENTRY_TYPE_LABELS: Record<CashEntryType, string> = {
  deposit: '入金',
  withdrawal: '出金',
}

/** 用途カテゴリの選択肢（自由入力も許容するため enum ではなく候補として扱う） */
export const DEPOSIT_CATEGORIES = ['釣銭補充', '両替戻し', '売上入金', 'その他'] as const
export const WITHDRAWAL_CATEGORIES = ['両替', '買い出し', 'タクシー代', '仕入れ', '経費精算', 'その他'] as const

export interface CashEntryFilters {
  /** 入出金区分。空配列なら全件 */
  types: CashEntryType[]
  /** 用途カテゴリ。空配列なら全件 */
  categories: string[]
  /** メモ・カテゴリの部分一致（大文字小文字を無視） */
  keyword: string
}

export const EMPTY_CASH_FILTERS: CashEntryFilters = {
  types: [],
  categories: [],
  keyword: '',
}

/** 入出金履歴を絞り込む */
export function filterCashEntries(entries: CashWithdrawalRow[], filters: CashEntryFilters): CashWithdrawalRow[] {
  const keyword = filters.keyword.trim().toLowerCase()
  return entries.filter(e => {
    if (filters.types.length > 0 && !filters.types.includes(e.entry_type)) return false
    if (filters.categories.length > 0 && !filters.categories.includes(e.category ?? '')) return false
    if (keyword) {
      const haystack = `${e.note ?? ''} ${e.category ?? ''}`.toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    return true
  })
}

export interface CashEntrySummary {
  depositCount: number
  depositTotal: number
  withdrawalCount: number
  withdrawalTotal: number
  /** 入金 − 出金。マイナスならレジから出た額の方が多い */
  net: number
}

/** 入出金の合計・差引を集計する */
export function calcCashEntrySummary(entries: CashWithdrawalRow[]): CashEntrySummary {
  let depositCount = 0
  let depositTotal = 0
  let withdrawalCount = 0
  let withdrawalTotal = 0

  for (const e of entries) {
    if (e.entry_type === 'deposit') {
      depositCount++
      depositTotal += e.amount
    } else {
      withdrawalCount++
      withdrawalTotal += e.amount
    }
  }

  return {
    depositCount,
    depositTotal,
    withdrawalCount,
    withdrawalTotal,
    net: depositTotal - withdrawalTotal,
  }
}

export interface CategoryBreakdown {
  category: string
  count: number
  total: number
}

/**
 * 用途カテゴリ別に集計する（合計金額の降順）
 * カテゴリ未設定は「未分類」にまとめる
 */
export function calcCategoryBreakdown(
  entries: CashWithdrawalRow[],
  type: CashEntryType,
): CategoryBreakdown[] {
  const map = new Map<string, CategoryBreakdown>()
  for (const e of entries) {
    if (e.entry_type !== type) continue
    const key = e.category && e.category.trim() !== '' ? e.category : '未分類'
    const cur = map.get(key) ?? { category: key, count: 0, total: 0 }
    cur.count++
    cur.total += e.amount
    map.set(key, cur)
  }
  return [...map.values()].sort((a, b) => b.total - a.total || a.category.localeCompare(b.category, 'ja'))
}

/** 日別に集計する（日付の昇順）。日付は JST の YYYY-MM-DD */
export interface DailyCashTotal {
  date: string
  depositTotal: number
  withdrawalTotal: number
  net: number
}

export function calcDailyCashTotals(entries: CashWithdrawalRow[]): DailyCashTotal[] {
  const map = new Map<string, DailyCashTotal>()
  for (const e of entries) {
    const date = jstDateOf(e.created_at)
    const cur = map.get(date) ?? { date, depositTotal: 0, withdrawalTotal: 0, net: 0 }
    if (e.entry_type === 'deposit') cur.depositTotal += e.amount
    else cur.withdrawalTotal += e.amount
    cur.net = cur.depositTotal - cur.withdrawalTotal
    map.set(date, cur)
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/** ISO文字列を JST の YYYY-MM-DD に変換する */
export function jstDateOf(iso: string): string {
  const d = new Date(iso)
  // JST(+09:00) に寄せてから日付を取り出す
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 10)
}

/** 入力値を検証する。問題があればエラーメッセージを返す */
export function validateCashEntry(amountInput: string): string | null {
  const trimmed = amountInput.trim()
  if (trimmed === '') return '金額を入力してください'
  const amount = Number(trimmed)
  if (!Number.isFinite(amount)) return '金額は数値で入力してください'
  if (!Number.isInteger(amount)) return '金額は1円単位で入力してください'
  if (amount <= 0) return '金額は1円以上で入力してください'
  return null
}
