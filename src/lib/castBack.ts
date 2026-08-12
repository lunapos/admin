// キャストバックの計算。
//
// DB側（generate_cast_backs）と同じ規則をここにも置き、
// 管理画面での試算・検証に使う。ロジックを変えるときは両方を揃えること。

/** メニューのバック設定 */
export interface BackConfig {
  /** バック率（0〜1）。backAmount が設定されていればそちらが優先される */
  backRate: number | null
  /** 1点あたりのバック額（円） */
  backAmount: number | null
}

/** 按分先の1人 */
export interface BackShare {
  castId: string
  amount: number
}

/**
 * 1明細のバック総額を求める。
 * 絶対額が設定されていれば率より優先する（「1本3,000円」のような固定バックのため）。
 */
export function backTotal(config: BackConfig, price: number, quantity: number): number {
  if (quantity <= 0) return 0
  if (config.backAmount != null) {
    return Math.max(0, config.backAmount) * quantity
  }
  if (config.backRate != null) {
    return Math.round(price * quantity * Math.min(1, Math.max(0, config.backRate)))
  }
  return 0
}

/** バック設定があるか（どちらも未設定ならバックなし） */
export function hasBack(config: BackConfig): boolean {
  return config.backAmount != null || config.backRate != null
}

/**
 * バック総額を本指名キャストに按分する。
 * 端数は最大配分の人に寄せ、合計を total に一致させる。
 *
 * @param nominations 本指名のキャストと指名数
 */
export function splitBack(
  total: number,
  nominations: { castId: string; qty: number }[],
): BackShare[] {
  if (total <= 0 || nominations.length === 0) return []

  const totalQty = nominations.reduce((s, n) => s + n.qty, 0)
  if (totalQty <= 0) return []

  const shares = nominations.map(n => ({
    castId: n.castId,
    amount: Math.round((total / totalQty) * n.qty),
  }))

  // 端数調整: 合計を total に合わせる
  const allocated = shares.reduce((s, r) => s + r.amount, 0)
  const diff = total - allocated
  if (diff !== 0) {
    // 最大配分の人（同額ならcastIdの昇順）に寄せる。DB側と同じ規則
    let topIndex = 0
    for (let i = 1; i < shares.length; i++) {
      const cur = shares[i]
      const top = shares[topIndex]
      if (cur.amount > top.amount || (cur.amount === top.amount && cur.castId < top.castId)) {
        topIndex = i
      }
    }
    shares[topIndex] = { ...shares[topIndex], amount: shares[topIndex].amount + diff }
  }

  return shares.filter(s => s.amount > 0)
}
