import { useState, useEffect, useMemo } from 'react'
import {
  Receipt, Calendar, Download, Search, X, ChevronDown, ChevronUp,
  ArrowUpDown, TrendingUp, CreditCard, FileText,
} from 'lucide-react'
import { supabase, requireTenantId } from '../lib/supabase'
import { toDateStr, todayBusinessDate, formatYen, METHOD_LABELS } from '../lib/dashboard'
import {
  rangeToTimestamps, filterSlips, sortSlips, calcSlipSummary, isValidRange,
  EMPTY_FILTERS,
} from '../lib/salesSlips'
import type { SlipFilters, SlipSortKey, SortDir } from '../lib/salesSlips'
import { exportSalesSlipsCSV } from '../lib/csvExport'
import CastSalesAllocator from '../components/CastSalesAllocator'
import CastBackEditor from '../components/CastBackEditor'
import ReceiptPreview from '../components/ReceiptPreview'
import type { ReceiptStore } from '../lib/receiptFormat'
import type { PaymentRow, PaymentMethod, FloorTableRow, CastRow } from '../types'

interface PaymentItemRow {
  id: string
  payment_id: string
  menu_item_name: string
  price: number
  quantity: number
  is_expense: boolean
}

const METHODS: PaymentMethod[] = ['cash', 'credit', 'electronic', 'tab']

/** 期間プリセット（営業日ベース） */
type PresetKey = 'today' | 'week' | 'month' | 'prevMonth'

function presetRange(key: PresetKey): { start: string; end: string } {
  const today = todayBusinessDate()
  const base = new Date(`${today}T12:00:00+09:00`)
  if (key === 'today') return { start: today, end: today }
  if (key === 'week') {
    const s = new Date(base)
    s.setDate(s.getDate() - 6)
    return { start: toDateStr(s), end: today }
  }
  if (key === 'month') {
    return { start: `${today.slice(0, 7)}-01`, end: today }
  }
  // 先月: 1日〜末日
  const [y, m] = today.split('-').map(Number)
  const first = new Date(y, m - 2, 1)
  const last = new Date(y, m - 1, 0)
  return { start: toDateStr(first), end: toDateStr(last) }
}

const PRESET_LABELS: { key: PresetKey; label: string }[] = [
  { key: 'today', label: '本日' },
  { key: 'week', label: '直近7日' },
  { key: 'month', label: '今月' },
  { key: 'prevMonth', label: '先月' },
]

export default function SalesSlipsPage() {
  const initial = presetRange('week')
  const [startDate, setStartDate] = useState(initial.start)
  const [endDate, setEndDate] = useState(initial.end)

  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [items, setItems] = useState<PaymentItemRow[]>([])
  const [tables, setTables] = useState<FloorTableRow[]>([])
  const [casts, setCasts] = useState<CastRow[]>([])
  // レシートの発行者欄に使う。未設定なら省略して表示する
  const [store, setStore] = useState<ReceiptStore | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [filters, setFilters] = useState<SlipFilters>(EMPTY_FILTERS)
  const [sortKey, setSortKey] = useState<SlipSortKey>('paid_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const rangeValid = isValidRange(startDate, endDate)

  useEffect(() => {
    if (!rangeValid) return
    async function fetchSlips() {
      setLoading(true)
      setFetchError(null)
      try {
        const tid = requireTenantId()
        const { rangeStart, rangeEnd } = rangeToTimestamps(startDate, endDate)

        const [paymentsRes, tablesRes, castsRes, storeRes] = await Promise.all([
          supabase.from('payments')
            .select('id, tenant_id, visit_id, table_id, customer_name, subtotal, expense_total, nomination_fee, service_fee, tax, discount, total, payment_method, paid_at, created_at, updated_at')
            .eq('tenant_id', tid)
            .gte('paid_at', rangeStart)
            .lte('paid_at', rangeEnd)
            .order('paid_at', { ascending: false }),
          supabase.from('floor_tables')
            .select('id, tenant_id, room_id, name, capacity, status, position_x, position_y, sort_order, visit_id, created_at, updated_at')
            .eq('tenant_id', tid),
          supabase.from('casts')
            .select('id, tenant_id, stage_name, real_name, photo_url, drop_off_location, is_active, created_at, updated_at')
            .eq('tenant_id', tid)
            .eq('is_active', true),
          supabase.from('stores')
            .select('name, address, phone, invoice_registration_number, tax_rate')
            .eq('id', tid)
            .single(),
        ])

        if (paymentsRes.error) throw paymentsRes.error

        const fetched = (paymentsRes.data || []) as PaymentRow[]
        setPayments(fetched)
        setTables((tablesRes.data || []) as FloorTableRow[])
        setCasts((castsRes.data || []) as CastRow[])
        if (storeRes.data) {
          const st = storeRes.data as {
            name: string; address: string | null; phone: string | null
            invoice_registration_number: string | null; tax_rate: number
          }
          setStore({
            name: st.name,
            address: st.address,
            phone: st.phone,
            invoiceRegistrationNumber: st.invoice_registration_number,
            taxRate: st.tax_rate ?? 0.1,
          })
        }
        setExpandedId(null)

        if (fetched.length > 0) {
          const itemsRes = await supabase.from('payment_items')
            .select('id, payment_id, menu_item_name, price, quantity, is_expense')
            .eq('tenant_id', tid)
            .in('payment_id', fetched.map(p => p.id))
          setItems((itemsRes.data || []) as PaymentItemRow[])
        } else {
          setItems([])
        }
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : 'データの取得に失敗しました。ページを再読み込みしてください。')
        setPayments([])
        setItems([])
      }
      setLoading(false)
    }
    fetchSlips()
  }, [startDate, endDate, rangeValid])

  const tableNameMap = useMemo(
    () => new Map(tables.map(t => [t.id, t.name])),
    [tables],
  )

  const itemsByPayment = useMemo(() => {
    const map: Record<string, PaymentItemRow[]> = {}
    for (const i of items) {
      (map[i.payment_id] ||= []).push(i)
    }
    return map
  }, [items])

  const visibleSlips = useMemo(
    () => sortSlips(filterSlips(payments, filters), sortKey, sortDir),
    [payments, filters, sortKey, sortDir],
  )

  const summary = useMemo(() => calcSlipSummary(visibleSlips), [visibleSlips])

  const hasActiveFilters =
    filters.keyword !== '' || filters.methods.length > 0 ||
    filters.minTotal !== null || filters.maxTotal !== null

  function applyPreset(key: PresetKey) {
    const r = presetRange(key)
    setStartDate(r.start)
    setEndDate(r.end)
  }

  function toggleSort(key: SlipSortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'customer_name' ? 'asc' : 'desc')
    }
  }

  function toggleMethod(m: PaymentMethod) {
    setFilters(f => ({
      ...f,
      methods: f.methods.includes(m) ? f.methods.filter(x => x !== m) : [...f.methods, m],
    }))
  }

  function handleExport() {
    const label = startDate === endDate ? startDate : `${startDate}_${endDate}`
    const plain: Record<string, { menu_item_name: string; quantity: number }[]> = {}
    for (const [pid, list] of Object.entries(itemsByPayment)) {
      plain[pid] = list.map(i => ({ menu_item_name: i.menu_item_name, quantity: i.quantity }))
    }
    exportSalesSlipsCSV(visibleSlips, plain, label)
  }

  const today = todayBusinessDate()

  return (
    <div className="space-y-6">
      {/* 期間選択 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-[#141430] rounded-xl border border-[#2e2e50] p-1">
          {PRESET_LABELS.map(p => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className="px-3 py-2 rounded-lg text-xs font-medium text-[#9090bb] hover:bg-[#0f0f28] hover:text-white transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 bg-[#141430] border border-[#2e2e50] rounded-lg px-3 py-2">
          <Calendar size={14} className="text-[#9090bb]" />
          <input
            type="date"
            value={startDate}
            max={today}
            onChange={e => setStartDate(e.target.value)}
            className="bg-transparent text-white text-sm outline-none"
          />
          <span className="text-[#3a3a5e] text-sm">〜</span>
          <input
            type="date"
            value={endDate}
            max={today}
            onChange={e => setEndDate(e.target.value)}
            className="bg-transparent text-white text-sm outline-none"
          />
        </div>

        <button
          onClick={() => setShowFilters(v => !v)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-colors ${
            hasActiveFilters
              ? 'bg-[#d4b870]/10 border-[#d4b870]/30 text-[#d4b870]'
              : 'bg-[#141430] border-[#2e2e50] text-[#9090bb] hover:border-[#d4b870]/50'
          }`}
        >
          <Search size={14} />
          絞り込み
          {hasActiveFilters && <span className="text-[10px]">ON</span>}
          {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {visibleSlips.length > 0 && (
          <button
            onClick={handleExport}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-[#141430] border border-[#2e2e50] text-[#9090bb] text-sm hover:border-[#d4b870]/50"
          >
            <Download size={14} />CSV
          </button>
        )}
      </div>

      {/* 絞り込みパネル */}
      {showFilters && (
        <div className="bg-[#141430] rounded-xl border border-[#2e2e50] p-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* 顧客名 */}
            <div className="space-y-2">
              <label className="text-[10px] text-[#9090bb] tracking-widest uppercase">顧客名</label>
              <input
                type="text"
                value={filters.keyword}
                onChange={e => setFilters(f => ({ ...f, keyword: e.target.value }))}
                placeholder="部分一致で検索"
                className="w-full bg-[#0f0f28] border border-[#2e2e50] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#d4b870]"
              />
            </div>

            {/* 金額レンジ */}
            <div className="space-y-2">
              <label className="text-[10px] text-[#9090bb] tracking-widest uppercase">合計金額（円）</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={filters.minTotal ?? ''}
                  onChange={e => setFilters(f => ({ ...f, minTotal: e.target.value === '' ? null : Number(e.target.value) }))}
                  placeholder="下限"
                  className="w-full bg-[#0f0f28] border border-[#2e2e50] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#d4b870]"
                />
                <span className="text-[#3a3a5e] text-sm">〜</span>
                <input
                  type="number"
                  value={filters.maxTotal ?? ''}
                  onChange={e => setFilters(f => ({ ...f, maxTotal: e.target.value === '' ? null : Number(e.target.value) }))}
                  placeholder="上限"
                  className="w-full bg-[#0f0f28] border border-[#2e2e50] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#d4b870]"
                />
              </div>
            </div>

            {/* 支払方法 */}
            <div className="space-y-2">
              <label className="text-[10px] text-[#9090bb] tracking-widest uppercase">支払方法</label>
              <div className="flex flex-wrap gap-2">
                {METHODS.map(m => {
                  const on = filters.methods.includes(m)
                  return (
                    <button
                      key={m}
                      onClick={() => toggleMethod(m)}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                        on
                          ? 'bg-[#d4b870]/10 border-[#d4b870]/30 text-[#d4b870]'
                          : 'bg-[#0f0f28] border-[#2e2e50] text-[#9090bb] hover:text-white'
                      }`}
                    >
                      {METHOD_LABELS[m]}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {hasActiveFilters && (
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="flex items-center gap-1.5 text-xs text-[#9090bb] hover:text-white transition-colors"
            >
              <X size={12} />絞り込みをクリア
            </button>
          )}
        </div>
      )}

      {!rangeValid ? (
        <div className="text-center py-20 text-[#3a3a5e]">
          <p className="text-sm tracking-widest">開始日が終了日より後になっています</p>
        </div>
      ) : fetchError ? (
        <div className="bg-red-900/20 border border-red-900/40 rounded-xl p-5 text-sm text-red-400">
          {fetchError}
        </div>
      ) : loading ? (
        <div className="text-center py-20 text-[#9090bb]">読み込み中...</div>
      ) : (
        <>
          {/* サマリー */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#141430] rounded-xl p-5 border border-[#2e2e50]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[#9090bb] text-xs tracking-widest uppercase">伝票数</span>
                <FileText size={18} className="text-[#2e2e50]" />
              </div>
              <div className="text-2xl font-bold text-white">{summary.count}件</div>
            </div>
            <div className="bg-[#141430] rounded-xl p-5 border border-[#2e2e50]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[#9090bb] text-xs tracking-widest uppercase">売上合計</span>
                <TrendingUp size={18} className="text-[#2e2e50]" />
              </div>
              <div className="text-2xl font-bold text-[#d4b870]">{formatYen(summary.totalSales)}</div>
            </div>
            <div className="bg-[#141430] rounded-xl p-5 border border-[#2e2e50]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[#9090bb] text-xs tracking-widest uppercase">平均客単価</span>
                <Receipt size={18} className="text-[#2e2e50]" />
              </div>
              <div className="text-2xl font-bold text-white">{formatYen(summary.avgSlip)}</div>
            </div>
            <div className="bg-[#141430] rounded-xl p-5 border border-[#2e2e50]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[#9090bb] text-xs tracking-widest uppercase">支払方法別</span>
                <CreditCard size={18} className="text-[#2e2e50]" />
              </div>
              <div className="space-y-0.5">
                {METHODS.filter(m => summary.methodTotals[m]).map(m => (
                  <div key={m} className="flex justify-between text-xs">
                    <span className="text-[#9090bb]">{METHOD_LABELS[m]}</span>
                    <span className="text-white">{formatYen(summary.methodTotals[m])}</span>
                  </div>
                ))}
                {summary.count === 0 && <span className="text-xs text-[#3a3a5e]">---</span>}
              </div>
            </div>
          </div>

          {visibleSlips.length === 0 ? (
            <div className="text-center py-20 text-[#3a3a5e]">
              <p className="text-sm tracking-widest">
                {payments.length === 0 ? 'この期間の伝票はありません' : '絞り込み条件に一致する伝票がありません'}
              </p>
            </div>
          ) : (
            <div className="bg-[#141430] rounded-xl border border-[#2e2e50] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#2e2e50] flex items-center justify-between">
                <h2 className="text-xs font-semibold text-[#9090bb] tracking-widest uppercase">
                  <Receipt size={12} className="inline mr-1" />伝票一覧
                </h2>
                <span className="text-xs text-[#3a3a5e]">
                  {payments.length !== visibleSlips.length && `${payments.length}件中 `}{visibleSlips.length}件
                </span>
              </div>

              {/* ソートヘッダー */}
              <div className="hidden md:grid grid-cols-[auto_1.2fr_1fr_auto_auto_auto] gap-4 px-5 py-2 text-[10px] text-[#3a3a5e] tracking-widest uppercase border-b border-[#2e2e50]">
                <span className="w-4" />
                <button
                  onClick={() => toggleSort('paid_at')}
                  className={`flex items-center gap-1 hover:text-[#9090bb] ${sortKey === 'paid_at' ? 'text-[#d4b870]' : ''}`}
                >
                  会計日時 <ArrowUpDown size={10} />
                </button>
                <button
                  onClick={() => toggleSort('customer_name')}
                  className={`flex items-center gap-1 hover:text-[#9090bb] ${sortKey === 'customer_name' ? 'text-[#d4b870]' : ''}`}
                >
                  顧客名 <ArrowUpDown size={10} />
                </button>
                <span className="text-right w-20">テーブル</span>
                <span className="text-right w-20">支払方法</span>
                <button
                  onClick={() => toggleSort('total')}
                  className={`flex items-center justify-end gap-1 w-28 hover:text-[#9090bb] ${sortKey === 'total' ? 'text-[#d4b870]' : ''}`}
                >
                  合計 <ArrowUpDown size={10} />
                </button>
              </div>

              <div className="divide-y divide-[#2e2e50]">
                {visibleSlips.map(p => {
                  const isExpanded = expandedId === p.id
                  const slipItems = itemsByPayment[p.id] || []
                  return (
                    <div key={p.id}>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : p.id)}
                        className="w-full flex md:grid md:grid-cols-[auto_1.2fr_1fr_auto_auto_auto] gap-4 px-5 py-4 items-center text-left hover:bg-[#0f0f28] transition-colors"
                      >
                        <ChevronDown
                          size={14}
                          className={`text-[#9090bb] shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                        <span className="text-sm text-white shrink-0">
                          {new Date(p.paid_at).toLocaleString('ja-JP', {
                            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                        <span className="text-sm text-[#9090bb] truncate flex-1">{p.customer_name || '---'}</span>
                        <span className="hidden md:block text-right text-xs text-[#9090bb] w-20 shrink-0">
                          {tableNameMap.get(p.table_id) || '---'}
                        </span>
                        <span className="hidden md:block text-right text-xs text-[#9090bb] w-20 shrink-0">
                          {METHOD_LABELS[p.payment_method]}
                        </span>
                        <span className="text-right text-sm font-bold text-[#d4b870] w-28 shrink-0">
                          {formatYen(p.total)}
                        </span>
                      </button>

                      {/* 展開: 伝票内訳 */}
                      {isExpanded && (
                        <div className="mx-5 mb-4 bg-[#0f0f28] rounded-lg p-4 space-y-1 text-xs">
                          <div className="flex justify-between text-[#3a3a5e] mb-2 md:hidden">
                            <span>テーブル: {tableNameMap.get(p.table_id) || '---'}</span>
                            <span>{METHOD_LABELS[p.payment_method]}</span>
                          </div>
                          {slipItems.length > 0 && (
                            <>
                              {slipItems.map(item => (
                                <div key={item.id} className="flex justify-between text-[#9090bb]">
                                  <span>
                                    {item.menu_item_name} × {item.quantity}
                                    {item.is_expense && <span className="ml-1 text-[10px] text-[#3a3a5e]">(経費)</span>}
                                  </span>
                                  <span>{formatYen(item.price * item.quantity)}</span>
                                </div>
                              ))}
                              <div className="border-t border-[#2e2e50] my-1" />
                            </>
                          )}
                          <div className="flex justify-between text-[#9090bb]">
                            <span>小計</span><span>{formatYen(p.subtotal)}</span>
                          </div>
                          {p.nomination_fee > 0 && (
                            <div className="flex justify-between text-[#9090bb]">
                              <span>指名料</span><span>{formatYen(p.nomination_fee)}</span>
                            </div>
                          )}
                          {p.expense_total > 0 && (
                            <div className="flex justify-between text-[#9090bb]">
                              <span>経費</span><span>{formatYen(p.expense_total)}</span>
                            </div>
                          )}
                          {p.service_fee > 0 && (
                            <div className="flex justify-between text-[#9090bb]">
                              <span>サービス料</span><span>{formatYen(p.service_fee)}</span>
                            </div>
                          )}
                          {p.tax > 0 && (
                            <div className="flex justify-between text-[#9090bb]">
                              <span>消費税</span><span>{formatYen(p.tax)}</span>
                            </div>
                          )}
                          {p.discount > 0 && (
                            <div className="flex justify-between text-[#9090bb]">
                              <span>割引</span><span>-{formatYen(p.discount)}</span>
                            </div>
                          )}
                          <div className="border-t border-[#2e2e50] my-1" />
                          <div className="flex justify-between text-white font-bold">
                            <span>合計</span><span className="text-[#d4b870]">{formatYen(p.total)}</span>
                          </div>

                          {/* レシート表示（POSで印字されるものと同じ体裁） */}
                          <div className="border-t border-[#2e2e50] mt-3 pt-3">
                            <ReceiptPreview
                              store={store}
                              payment={{
                                paidAt: p.paid_at,
                                tableName: tableNameMap.get(p.table_id) || '',
                                customerName: p.customer_name,
                                subtotal: p.subtotal,
                                nominationFee: p.nomination_fee,
                                expenseTotal: p.expense_total,
                                serviceFee: p.service_fee,
                                tax: p.tax,
                                discount: p.discount,
                                total: p.total,
                                paymentMethodLabel: METHOD_LABELS[p.payment_method],
                              }}
                              items={slipItems.map(i => ({
                                menuItemName: i.menu_item_name,
                                price: i.price,
                                quantity: i.quantity,
                                isExpense: i.is_expense,
                              }))}
                            />
                          </div>

                          {/* キャスト売上の配分（会計は変えずに分配だけ調整する） */}
                          <div className="border-t border-[#2e2e50] mt-3 pt-3">
                            <CastSalesAllocator
                              visitId={p.visit_id}
                              paymentId={p.id}
                              subtotal={p.subtotal}
                              casts={casts}
                            />
                          </div>

                          {/* キャストバック（店の支出。売上配分とは別勘定） */}
                          <div className="border-t border-[#2e2e50] mt-3 pt-3">
                            <CastBackEditor
                              visitId={p.visit_id}
                              paymentId={p.id}
                              casts={casts}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="text-xs text-[#3a3a5e] px-1">
            <p>※ 期間は営業日ベース（各日 12:00 〜 翌 11:59）で集計しています</p>
          </div>
        </>
      )}
    </div>
  )
}
