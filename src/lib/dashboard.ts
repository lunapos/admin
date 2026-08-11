// ダッシュボード計算ロジック（テスト可能な純粋関数）

import type { PaymentRow, VisitRow, NominationRow, CastRow, CastRanking, HourlyData, CastSaleRow } from '../types'

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 現在の「営業日」の日付文字列を返す（正午〜翌正午を1営業日とする）
 * 12:00 以前なら前日の日付を返す
 */
export function todayBusinessDate(): string {
  const now = new Date()
  if (now.getHours() < 12) {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    return toDateStr(yesterday)
  }
  return toDateStr(now)
}

/**
 * 営業日の開始・終了時刻を返す（ISO8601 JST）
 * selectedDate の 12:00 JST 〜 翌日 11:59:59 JST
 */
export function businessDayRange(selectedDate: string): { dayStart: string; dayEnd: string } {
  const dayStart = `${selectedDate}T12:00:00+09:00`
  // 翌日の日付を計算
  const d = new Date(`${selectedDate}T12:00:00+09:00`)
  d.setDate(d.getDate() + 1)
  const nextDate = toDateStr(d)
  const dayEnd = `${nextDate}T11:59:59+09:00`
  return { dayStart, dayEnd }
}

export function formatYen(n: number): string {
  return `¥${n.toLocaleString()}`
}

export const METHOD_LABELS: Record<string, string> = {
  cash: '現金', credit: 'カード', electronic: '電子マネー', tab: 'ツケ',
}

export interface DailySummaryResult {
  totalSales: number
  visitCount: number
  guestCount: number
  avgSpend: number
  methodTotals: Record<string, number>
}

export function calcDailySummary(payments: PaymentRow[], visits: VisitRow[]): DailySummaryResult {
  const totalSales = payments.reduce((s, p) => s + p.total, 0)
  const visitCount = visits.length
  const guestCount = visits.reduce((s, v) => s + v.guest_count, 0)
  const avgSpend = visitCount > 0 ? Math.floor(totalSales / visitCount) : 0
  const methodTotals: Record<string, number> = {}
  for (const p of payments) {
    methodTotals[p.payment_method] = (methodTotals[p.payment_method] || 0) + p.total
  }
  return { totalSales, visitCount, guestCount, avgSpend, methodTotals }
}

export function calcCastRankings(
  visits: VisitRow[],
  nominations: NominationRow[],
  castSales: CastSaleRow[],
  casts: CastRow[],
): CastRanking[] {
  const visitIds = new Set(visits.map(v => v.id))
  const relevantNoms = nominations.filter(n => visitIds.has(n.visit_id) && n.nomination_type !== 'none')
  const castMap: Record<string, CastRanking> = {}
  for (const c of casts) {
    castMap[c.id] = { castId: c.id, stageName: c.stage_name, photoUrl: c.photo_url, nominations: 0, sales: 0, drinkCount: 0 }
  }
  for (const n of relevantNoms) {
    if (castMap[n.cast_id]) {
      castMap[n.cast_id].nominations += n.qty
    }
  }
  // 売上は cast_sales の配分額をそのまま集計する（キャスト別売上画面と同じ値になる）
  for (const cs of castSales) {
    if (castMap[cs.cast_id]) {
      castMap[cs.cast_id].sales += cs.amount
    }
  }
  return Object.values(castMap)
    .filter(c => c.nominations > 0 || c.sales > 0)
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 10)
}

export function calcHourlyData(visits: VisitRow[]): HourlyData[] {
  const hours: Record<number, number> = {}
  for (let h = 0; h < 24; h++) hours[h] = 0
  for (const v of visits) {
    const h = new Date(v.check_in_time).getHours()
    hours[h] += 1
  }
  return Object.entries(hours).map(([h, count]) => ({ hour: Number(h), count }))
}

export function calcMonthlyData(
  payments: { total: number; paid_at: string }[],
  year: number,
  month: number,
): { date: string; total: number; count: number }[] {
  const daysInMonth = new Date(year, month, 0).getDate()
  const selectedMonth = `${year}-${String(month).padStart(2, '0')}`
  const dailyMap: Record<string, { total: number; count: number }> = {}
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${selectedMonth}-${String(d).padStart(2, '0')}`
    dailyMap[key] = { total: 0, count: 0 }
  }
  for (const p of payments) {
    const date = new Date(p.paid_at)
    const key = toDateStr(date)
    if (dailyMap[key]) {
      dailyMap[key].total += p.total
      dailyMap[key].count += 1
    }
  }
  return Object.entries(dailyMap)
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
