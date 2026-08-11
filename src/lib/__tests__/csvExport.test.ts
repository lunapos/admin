import { describe, it, expect, vi, beforeEach } from 'vitest'

// csvExportのdownloadCSVはDOM操作を含むので、内部関数をテスト可能にするために
// モジュールを直接テストする代わりに、エクスポート可能な部分をテストする

// escapeCSVとbuildCSVはexportされていないので、csvExportモジュールの動作を
// テストするために、同じロジックを抽出してテストする

// CSVエスケープロジック
function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function buildCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const BOM = '\uFEFF'
  const headerLine = headers.map(escapeCSV).join(',')
  const dataLines = rows.map(row => row.map(escapeCSV).join(','))
  return BOM + [headerLine, ...dataLines].join('\n')
}

describe('escapeCSV', () => {
  it('通常の文字列はそのまま返す', () => {
    expect(escapeCSV('abc')).toBe('abc')
    expect(escapeCSV('田中様')).toBe('田中様')
  })

  it('数値を文字列に変換する', () => {
    expect(escapeCSV(1000)).toBe('1000')
    expect(escapeCSV(0)).toBe('0')
  })

  it('null/undefinedを空文字にする', () => {
    expect(escapeCSV(null)).toBe('')
    expect(escapeCSV(undefined)).toBe('')
  })

  it('カンマを含む場合にダブルクォートで囲む', () => {
    expect(escapeCSV('田中,太郎')).toBe('"田中,太郎"')
  })

  it('ダブルクォートを含む場合にエスケープする', () => {
    expect(escapeCSV('田中"太郎"')).toBe('"田中""太郎"""')
  })

  it('改行を含む場合にダブルクォートで囲む', () => {
    expect(escapeCSV('行1\n行2')).toBe('"行1\n行2"')
  })
})

describe('buildCSV', () => {
  it('BOM付きCSVを生成する', () => {
    const result = buildCSV(['名前', '金額'], [['田中', 1000]])
    expect(result.startsWith('\uFEFF')).toBe(true)
  })

  it('ヘッダーとデータ行を正しく結合する', () => {
    const result = buildCSV(['A', 'B'], [['1', '2'], ['3', '4']])
    expect(result).toBe('\uFEFFA,B\n1,2\n3,4')
  })

  it('空データで空行なし', () => {
    const result = buildCSV(['A'], [])
    expect(result).toBe('\uFEFFA')
  })

  it('特殊文字を含むデータを正しくエスケープする', () => {
    const result = buildCSV(['名前'], [['田中,太郎']])
    expect(result).toBe('\uFEFF名前\n"田中,太郎"')
  })
})

// csvExport.tsの公開関数テスト（DOM操作をモック）
describe('csvExport公開関数', () => {
  beforeEach(() => {
    // URL.createObjectURL / revokeObjectURL のモック
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    const mockElement = {
      href: '',
      download: '',
      click: vi.fn(),
    }
    vi.spyOn(document, 'createElement').mockReturnValue(mockElement as unknown as HTMLElement)
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockElement as unknown as Node)
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockElement as unknown as Node)
  })

  it('exportDailyPaymentsCSVがクラッシュしない', async () => {
    const { exportDailyPaymentsCSV } = await import('../csvExport')
    const mockPayments = [{
      id: 'p1', tenant_id: 't1', visit_id: 'v1', table_id: 'tb1',
      customer_name: 'テスト客', subtotal: 10000, expense_total: 0,
      nomination_fee: 5000, service_fee: 4000, tax: 1400, discount: 0,
      total: 20400, payment_method: 'cash' as const,
      paid_at: '2026-03-20T21:00:00+09:00', created_at: '', updated_at: '',
    }]
    expect(() => exportDailyPaymentsCSV(mockPayments)).not.toThrow()
  })

  it('exportCastRankingCSVがクラッシュしない', async () => {
    const { exportCastRankingCSV } = await import('../csvExport')
    const rankings = [{
      castId: 'c1', stageName: 'あかり', photoUrl: null,
      nominations: 5, sales: 50000, drinkCount: 10,
    }]
    expect(() => exportCastRankingCSV(rankings)).not.toThrow()
  })

  it('exportMonthlyCSVがクラッシュしない', async () => {
    const { exportMonthlyCSV } = await import('../csvExport')
    const data = [{ date: '2026-03-01', total: 100000, count: 5 }]
    expect(() => exportMonthlyCSV(data)).not.toThrow()
  })
})
