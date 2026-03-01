import type { Payment, Visit, Cast } from '../types'

const METHOD_LABELS: Record<string, string> = {
  cash: '現金',
  credit: 'カード',
  electronic: '電子マネー',
  tab: 'ツケ',
}

export function exportPaymentsCSV(payments: Payment[], visits: Visit[], casts: Cast[]) {
  const headers = [
    '会計日時',
    'テーブル',
    'お客様名',
    '来店人数',
    '指名キャスト',
    '小計',
    '指名料',
    'サービス料',
    '消費税',
    '値引き',
    '合計',
    '支払方法',
  ]

  const rows = payments.map(p => {
    const visit = visits.find(v => v.id === p.visitId)
    const nominationCasts = visit?.nominations
      .filter(n => n.nominationType !== 'none')
      .map(n => {
        const cast = casts.find(c => c.id === n.castId)
        return cast?.stageName || ''
      })
      .join(' / ') || ''

    return [
      new Date(p.paidAt).toLocaleString('ja-JP'),
      visit?.tableId || '',
      p.customerName || '',
      visit?.guestCount?.toString() || '',
      nominationCasts,
      p.subtotal.toString(),
      p.nominationFee.toString(),
      p.serviceFee.toString(),
      p.tax.toString(),
      p.discount.toString(),
      p.total.toString(),
      METHOD_LABELS[p.paymentMethod] || p.paymentMethod,
    ]
  })

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')),
  ].join('\n')

  const bom = '\uFEFF'
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const today = new Date().toISOString().slice(0, 10)
  link.href = url
  link.download = `luna_sales_${today}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
