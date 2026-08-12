import { describe, it, expect } from 'vitest'
import {
  buildReceiptText, displayWidth, center, leftRight, RECEIPT_LINE_WIDTH,
} from '../receiptFormat'
import type { ReceiptStore, ReceiptPayment, ReceiptItem } from '../receiptFormat'

const store: ReceiptStore = {
  name: 'Luna 新宿店',
  address: '東京都新宿区1-1-1',
  phone: '03-1234-5678',
  invoiceRegistrationNumber: 'T1234567890123',
  taxRate: 0.1,
}

const payment: ReceiptPayment = {
  paidAt: '2026-08-11T10:44:00+09:00',
  tableName: '2番',
  customerName: null,
  subtotal: 10000,
  nominationFee: 0,
  expenseTotal: 0,
  serviceFee: 4000,
  tax: 1400,
  discount: 0,
  total: 15400,
  paymentMethodLabel: '現金',
}

const items: ReceiptItem[] = [
  { menuItemName: 'セット', price: 5000, quantity: 2, isExpense: false },
]

// ===========================================
// 文字幅（全角の桁ズレを防ぐ）
// ===========================================
describe('displayWidth', () => {
  it('半角は1文字幅', () => {
    expect(displayWidth('abc123')).toBe(6)
  })
  it('全角は2文字幅', () => {
    expect(displayWidth('小計')).toBe(4)
  })
  it('混在も正しく数える', () => {
    // ビール(6) + 半角空白(1) + ×(2) + 3(1) = 10。× は全角記号
    expect(displayWidth('ビール ×3')).toBe(10)
  })
  it('¥記号は全角扱い（レシートの等幅表示に合わせる）', () => {
    expect(displayWidth('¥1,000')).toBe(7)
  })
})

describe('leftRight', () => {
  it('全体幅がレシート幅に収まる', () => {
    const line = leftRight('小計', '¥10,000')
    expect(displayWidth(line)).toBe(RECEIPT_LINE_WIDTH)
  })
  it('長すぎる場合も最低1つは空ける', () => {
    const line = leftRight('あ'.repeat(30), '¥10,000')
    expect(line).toContain(' ')
  })
})

describe('center', () => {
  it('中央寄せになる', () => {
    const line = center('領収書')
    const pad = line.length - line.trimStart().length
    expect(pad).toBeGreaterThan(0)
  })
})

// ===========================================
// レシート本文
// ===========================================
describe('buildReceiptText', () => {
  it('店舗情報を印字する', () => {
    const t = buildReceiptText(store, payment, items)
    expect(t).toContain('Luna 新宿店')
    expect(t).toContain('東京都新宿区1-1-1')
    expect(t).toContain('TEL: 03-1234-5678')
    expect(t).toContain('登録番号: T1234567890123')
  })

  it('日時とテーブルを印字する', () => {
    const t = buildReceiptText(store, payment, items)
    // 実行環境のタイムゾーンで表示されるため、書式だけを検証する
    expect(t).toMatch(/2026\/08\/11 \d{2}:\d{2}/)
    expect(t).toContain('テーブル: 2番')
  })

  it('明細と金額を印字する', () => {
    const t = buildReceiptText(store, payment, items)
    expect(t).toContain('セット ×2')
    expect(t).toContain('¥10,000')
    expect(t).toContain('¥15,400')
  })

  it('数量1のときは ×1 を出さない', () => {
    const t = buildReceiptText(store, payment, [
      { menuItemName: 'ビール', price: 800, quantity: 1, isExpense: false },
    ])
    expect(t).toContain('ビール')
    expect(t).not.toContain('ビール ×1')
  })

  it('0円の項目は行を出さない', () => {
    const t = buildReceiptText(store, payment, items)
    expect(t).not.toContain('指名料')
    expect(t).not.toContain('割引')
  })

  it('指名料・割引がある場合は出す', () => {
    const t = buildReceiptText(store, { ...payment, nominationFee: 5000, discount: 1000 }, items)
    expect(t).toContain('指名料')
    expect(t).toContain('−¥1,000')
  })

  it('建て替えは分けて出す', () => {
    const t = buildReceiptText(store, { ...payment, expenseTotal: 3000 }, [
      ...items,
      { menuItemName: 'タクシー代', price: 3000, quantity: 1, isExpense: true },
    ])
    expect(t).toContain('タクシー代(建替)')
    expect(t).toContain('建て替え計')
  })

  it('インボイス登録がある場合は税率区分を出す', () => {
    const t = buildReceiptText(store, payment, items)
    expect(t).toContain('10%対象')
    expect(t).toContain('（内消費税）')
  })

  it('インボイス未登録なら税率区分を出さない', () => {
    const t = buildReceiptText(
      { ...store, invoiceRegistrationNumber: null }, payment, items)
    expect(t).not.toContain('10%対象')
    expect(t).not.toContain('登録番号')
  })

  it('住所・電話が未設定でも印字できる', () => {
    const t = buildReceiptText(
      { ...store, address: null, phone: null }, payment, items)
    expect(t).toContain('Luna 新宿店')
    expect(t).not.toContain('TEL:')
  })

  it('支払方法を印字する', () => {
    const t = buildReceiptText(store, payment, items)
    expect(t).toContain('お支払い')
    expect(t).toContain('現金')
  })

  it('全ての行がレシート幅を超えない', () => {
    const t = buildReceiptText(store, { ...payment, nominationFee: 5000, discount: 1000 }, [
      { menuItemName: 'シャンパン（グラス）', price: 30000, quantity: 3, isExpense: false },
    ])
    for (const line of t.split('\n')) {
      expect(displayWidth(line)).toBeLessThanOrEqual(RECEIPT_LINE_WIDTH)
    }
  })
})
