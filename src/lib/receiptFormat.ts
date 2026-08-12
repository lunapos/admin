// 売上伝票をレシート形式（80mm幅 = 48文字）に整形する。
//
// POS（Floor）の ReceiptFormatter.format と同じ体裁にしてあり、
// 管理画面で「実際に印字されるレシート」を確認・再印刷できるようにする。
// 印字レイアウトを変えるときは両方を揃えること。

export const RECEIPT_LINE_WIDTH = 48

/** 全角は2文字幅として数える（レシートは等幅前提のため） */
export function displayWidth(text: string): number {
  let w = 0
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    // 半角英数記号・半角カナ以外は全角扱い
    const isHalf =
      (code >= 0x20 && code <= 0x7e) || (code >= 0xff61 && code <= 0xff9f)
    w += isHalf ? 1 : 2
  }
  return w
}

export function center(text: string, width = RECEIPT_LINE_WIDTH): string {
  const pad = Math.max(0, Math.floor((width - displayWidth(text)) / 2))
  return ' '.repeat(pad) + text
}

export function leftRight(left: string, right: string, width = RECEIPT_LINE_WIDTH): string {
  const space = Math.max(1, width - displayWidth(left) - displayWidth(right))
  return left + ' '.repeat(space) + right
}

export function dashed(width = RECEIPT_LINE_WIDTH): string {
  return '-'.repeat(width)
}

export function yen(amount: number): string {
  return `¥${amount.toLocaleString()}`
}

export interface ReceiptStore {
  name: string
  address: string | null
  phone: string | null
  invoiceRegistrationNumber: string | null
  taxRate: number
}

export interface ReceiptPayment {
  paidAt: string
  tableName: string
  customerName: string | null
  subtotal: number
  nominationFee: number
  expenseTotal: number
  serviceFee: number
  tax: number
  discount: number
  total: number
  paymentMethodLabel: string
}

export interface ReceiptItem {
  menuItemName: string
  price: number
  quantity: number
  isExpense: boolean
}

/** 会計日時を「2026/08/11 10:44」形式にする */
function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function itemLine(item: ReceiptItem): string {
  const name = item.quantity > 1
    ? `${item.menuItemName} ×${item.quantity}`
    : item.menuItemName
  return leftRight(name, yen(item.price * item.quantity))
}

/**
 * レシート本文を組み立てる。
 * POS側と同じ並び（店舗情報 → 日時 → 明細 → 金額 → 支払い）にしてある。
 */
export function buildReceiptText(
  store: ReceiptStore,
  payment: ReceiptPayment,
  items: ReceiptItem[],
): string {
  const lines: string[] = []

  lines.push(center(store.name))
  if (store.address) lines.push(center(store.address))
  if (store.phone) lines.push(center(`TEL: ${store.phone}`))
  if (store.invoiceRegistrationNumber) {
    lines.push(center(`登録番号: ${store.invoiceRegistrationNumber}`))
  }

  lines.push(dashed())
  lines.push(formatDateTime(payment.paidAt))
  if (payment.tableName) lines.push(`テーブル: ${payment.tableName}`)
  if (payment.customerName) lines.push(`お客様: ${payment.customerName}`)

  lines.push(dashed())
  lines.push(leftRight('品名', '金額'))
  lines.push(dashed())

  // 建て替えはサービス料・税の対象外なので分けて出す
  const regular = items.filter(i => !i.isExpense)
  const expenses = items.filter(i => i.isExpense)

  for (const item of regular) lines.push(itemLine(item))

  if (expenses.length > 0) {
    lines.push(dashed())
    for (const item of expenses) {
      lines.push(itemLine({ ...item, menuItemName: `${item.menuItemName}(建替)` }))
    }
  }

  lines.push(dashed())
  lines.push(leftRight('小計', yen(payment.subtotal)))
  if (payment.nominationFee > 0) {
    lines.push(leftRight('指名料', yen(payment.nominationFee)))
  }
  if (payment.serviceFee > 0) {
    lines.push(leftRight('サービス料', yen(payment.serviceFee)))
  }
  const taxPercent = Math.round(store.taxRate * 100)
  if (payment.tax > 0) {
    lines.push(leftRight(`消費税（${taxPercent}%）`, yen(payment.tax)))
  }
  if (payment.discount > 0) {
    lines.push(leftRight('割引', `−${yen(payment.discount)}`))
  }
  if (payment.expenseTotal > 0) {
    lines.push(leftRight('建て替え計', yen(payment.expenseTotal)))
  }

  lines.push('='.repeat(RECEIPT_LINE_WIDTH))
  lines.push(leftRight('合計', yen(payment.total)))
  lines.push(dashed())

  // インボイス登録がある場合は税率区分を出す
  if (store.invoiceRegistrationNumber) {
    const taxable = payment.total - payment.expenseTotal
    lines.push(leftRight(`${taxPercent}%対象`, yen(taxable)))
    lines.push(leftRight('（内消費税）', yen(payment.tax)))
    lines.push(dashed())
  }

  lines.push(leftRight('お支払い', payment.paymentMethodLabel))
  lines.push('')
  lines.push(center('ご来店ありがとうございました'))
  // レシートの締めは店名にする（お客様が受け取るものなのでPOSの製品名は出さない）
  lines.push(center(store.name))

  return lines.join('\n')
}
