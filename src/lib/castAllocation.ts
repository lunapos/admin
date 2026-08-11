// キャスト売上の配分計算（テスト可能な純粋関数）
//
// 不変条件: どの関数も戻り値の amount 合計が subtotal と一致する。
// 会計そのもの（元の売上）は変えず、分配だけを動かすための計算。

export interface AllocationRow {
  castId: string
  amount: number
}

/**
 * index 行を target 円に固定し、残額を他の行へ振り分ける。
 * 他の行は既存の比率を保つ（全員0なら均等割り）。
 */
export function allocate(rows: AllocationRow[], index: number, target: number, subtotal: number): AllocationRow[] {
  if (rows.length === 0) return rows
  if (index < 0 || index >= rows.length) return rows

  const fixed = Math.min(subtotal, Math.max(0, Math.round(target)))
  if (rows.length === 1) {
    return rows.map((r, i) => (i === index ? { ...r, amount: subtotal } : r))
  }

  const otherCount = rows.length - 1
  const othersTotal = rows.reduce((s, r, i) => (i === index ? s : s + r.amount), 0)
  const remaining = subtotal - fixed

  let assigned = 0
  const next = rows.map((r, i) => {
    if (i === index) return { ...r, amount: fixed }
    const ratio = othersTotal > 0 ? r.amount / othersTotal : 1 / otherCount
    const amt = Math.max(0, Math.round(remaining * ratio))
    assigned += amt
    return { ...r, amount: amt }
  })

  // 丸め誤差を他の行に寄せて合計を合わせる
  const gap = remaining - assigned
  if (gap !== 0) {
    for (let i = next.length - 1; i >= 0; i--) {
      if (i === index) continue
      next[i] = { ...next[i], amount: Math.max(0, next[i].amount + gap) }
      break
    }
  }
  return next
}

/** 全行の比率を保ったまま合計を subtotal に合わせ直す */
export function normalize(rows: AllocationRow[], subtotal: number): AllocationRow[] {
  if (rows.length === 0) return rows

  const total = rows.reduce((s, r) => s + r.amount, 0)
  let assigned = 0
  const next = rows.map(r => {
    const ratio = total > 0 ? r.amount / total : 1 / rows.length
    const amt = Math.max(0, Math.round(subtotal * ratio))
    assigned += amt
    return { ...r, amount: amt }
  })

  const gap = subtotal - assigned
  if (gap !== 0) {
    let maxIdx = 0
    next.forEach((r, i) => { if (r.amount > next[maxIdx].amount) maxIdx = i })
    next[maxIdx] = { ...next[maxIdx], amount: Math.max(0, next[maxIdx].amount + gap) }
  }
  return next
}

/** 全員で均等に分ける（端数は先頭から1円ずつ） */
export function splitEvenly(rows: AllocationRow[], subtotal: number): AllocationRow[] {
  if (rows.length === 0) return rows
  const base = Math.floor(subtotal / rows.length)
  const remainder = subtotal - base * rows.length
  return rows.map((r, i) => ({ ...r, amount: base + (i < remainder ? 1 : 0) }))
}

/** キャストを追加し、均等割り相当を与えて残りを既存行へ振り直す */
export function addRow(rows: AllocationRow[], castId: string, subtotal: number): AllocationRow[] {
  if (!castId || rows.some(r => r.castId === castId)) return rows
  const next = [...rows, { castId, amount: 0 }]
  return allocate(next, next.length - 1, Math.round(subtotal / next.length), subtotal)
}

/** 行を削除し、その分を残りのキャストへ比率どおり振り直す */
export function removeRow(rows: AllocationRow[], index: number, subtotal: number): AllocationRow[] {
  return normalize(rows.filter((_, i) => i !== index), subtotal)
}
