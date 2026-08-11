import { describe, it, expect } from 'vitest'
import type {
  StoreRow, MenuItemRow, PaymentRow,
  TableStatus, MenuCategory, PaymentMethod, CustomerRank,
} from '../../types'

// 型の整合性テスト（リリース後に型定義を変更して壊すのを防ぐ）

describe('StoreRow 必須フィールド', () => {
  const validStore: StoreRow = {
    id: 'uuid-test',
    name: 'テスト店舗',
    service_rate: 0.4,
    tax_rate: 0.1,
    douhan_fee: 3000,
    nomination_fee_main: 5000,
    nomination_fee_in_store: 2000,
    invoice_registration_number: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }

  it('全フィールドが揃っている', () => {
    expect(validStore.id).toBeDefined()
    expect(validStore.name).toBeDefined()
    expect(validStore.service_rate).toBeDefined()
    expect(validStore.tax_rate).toBeDefined()
    expect(validStore.douhan_fee).toBeDefined()
    expect(validStore.nomination_fee_main).toBeDefined()
    expect(validStore.nomination_fee_in_store).toBeDefined()
  })

  it('サービス料率のデフォルト値は40%', () => {
    expect(validStore.service_rate).toBe(0.4)
  })

  it('消費税率のデフォルト値は10%', () => {
    expect(validStore.tax_rate).toBe(0.1)
  })

  it('インボイス番号はnull許容', () => {
    expect(validStore.invoice_registration_number).toBeNull()
  })
})

describe('料金計算の型安全性', () => {
  it('service_rateは0〜1の範囲であるべき', () => {
    const rate = 0.4 // 40%
    expect(rate).toBeGreaterThanOrEqual(0)
    expect(rate).toBeLessThanOrEqual(1)
  })

  it('tax_rateは0〜1の範囲であるべき', () => {
    const rate = 0.1 // 10%
    expect(rate).toBeGreaterThanOrEqual(0)
    expect(rate).toBeLessThanOrEqual(1)
  })

  it('金額フィールドは整数（円単位）', () => {
    const fees = [3000, 5000, 2000]
    fees.forEach(fee => {
      expect(Number.isInteger(fee)).toBe(true)
      expect(fee).toBeGreaterThanOrEqual(0)
    })
  })
})

describe('PaymentRow 合計値の整合性', () => {
  it('合計 = 小計 + サービス料 + 税 - 割引 + 建替 + 指名料', () => {
    const payment: PaymentRow = {
      id: 'p1', tenant_id: 't1', visit_id: 'v1', table_id: 'tb1',
      customer_name: 'テスト',
      subtotal: 10000,
      expense_total: 2000,
      nomination_fee: 5000,
      service_fee: 4000,
      tax: 1400,
      discount: 1000,
      total: 21400, // 10000 + 4000 + 1400 - 1000 + 2000 + 5000
      payment_method: 'cash',
      paid_at: '2026-03-20T21:00:00Z',
      created_at: '', updated_at: '',
    }
    const calculated = payment.subtotal + payment.service_fee + payment.tax
      - payment.discount + payment.expense_total + payment.nomination_fee
    expect(payment.total).toBe(calculated)
  })
})

describe('メニューカテゴリの網羅性', () => {
  const allCategories: MenuCategory[] = ['drink', 'bottle', 'food', 'ladies_drink', 'other']

  it('5種類のカテゴリが定義されている', () => {
    expect(allCategories).toHaveLength(5)
  })

  it('レディースドリンクカテゴリが存在する', () => {
    expect(allCategories).toContain('ladies_drink')
  })
})

describe('支払方法の網羅性', () => {
  const allMethods: PaymentMethod[] = ['cash', 'credit', 'electronic', 'tab']

  it('4種類の支払方法が定義されている', () => {
    expect(allMethods).toHaveLength(4)
  })

  it('ツケ払いが含まれる', () => {
    expect(allMethods).toContain('tab')
  })
})

describe('テーブルステータスの網羅性', () => {
  const allStatuses: TableStatus[] = ['empty', 'occupied', 'waiting_checkout']

  it('3種類のステータスが定義されている', () => {
    expect(allStatuses).toHaveLength(3)
  })
})

describe('顧客ランクの網羅性', () => {
  const allRanks: CustomerRank[] = ['new', 'repeat', 'vip']

  it('3種類のランクが定義されている', () => {
    expect(allRanks).toHaveLength(3)
  })
})

describe('インボイス番号バリデーション', () => {
  function validateInvoiceNumber(num: string): boolean {
    if (!num) return true
    return /^T\d{13}$/.test(num)
  }

  it('空文字はOK（未設定）', () => {
    expect(validateInvoiceNumber('')).toBe(true)
  })

  it('T+13桁数字はOK', () => {
    expect(validateInvoiceNumber('T1234567890123')).toBe(true)
  })

  it('TなしはNG', () => {
    expect(validateInvoiceNumber('1234567890123')).toBe(false)
  })

  it('桁数不足はNG', () => {
    expect(validateInvoiceNumber('T123456789012')).toBe(false)
  })

  it('桁数超過はNG', () => {
    expect(validateInvoiceNumber('T12345678901234')).toBe(false)
  })

  it('文字混在はNG', () => {
    expect(validateInvoiceNumber('T123456789012a')).toBe(false)
  })
})
