import { useState, useEffect, useMemo } from 'react'
import {
  TrendingUp, Users, CreditCard, Clock, Star, Download,
  ChevronLeft, ChevronRight, Calendar, ChevronDown, Pencil, Check, X,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts'
import { supabase, requireTenantId } from '../lib/supabase'
import { exportDailyPaymentsCSV, exportMonthlyCSV, exportCastRankingCSV } from '../lib/csvExport'
import { toDateStr, todayBusinessDate, businessDayRange, formatYen, METHOD_LABELS, calcDailySummary, calcCastRankings, calcHourlyData, calcMonthlyData } from '../lib/dashboard'
import type { PaymentRow, CastRow, NominationRow, VisitRow, CastRanking, HourlyData, CastSaleRow } from '../types'

interface PaymentItemRow {
  id: string
  payment_id: string
  menu_item_name: string
  price: number
  quantity: number
  is_expense: boolean
}

type ViewMode = 'daily' | 'monthly'

export default function DashboardPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('daily')
  const [selectedDate, setSelectedDate] = useState(todayBusinessDate)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [visits, setVisits] = useState<VisitRow[]>([])
  const [nominations, setNominations] = useState<NominationRow[]>([])
  const [casts, setCasts] = useState<CastRow[]>([])
  const [monthlyData, setMonthlyData] = useState<{ date: string; total: number; count: number }[]>([])
  const [paymentItems, setPaymentItems] = useState<PaymentItemRow[]>([])
  const [castSales, setCastSales] = useState<CastSaleRow[]>([])
  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(null)
  const [editingPayment, setEditingPayment] = useState<PaymentRow | null>(null)
  const [editMethod, setEditMethod] = useState<string>('')
  const [editSaving, setEditSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // 日次データ取得
  useEffect(() => {
    if (viewMode !== 'daily') return
    async function fetchDaily() {
      setLoading(true)
      setFetchError(null)
      try {
        const tid = requireTenantId()
        const { dayStart, dayEnd } = businessDayRange(selectedDate)

        const [paymentsRes, visitsRes, nomsRes, castsRes] = await Promise.all([
          supabase.from('payments')
            .select('id, tenant_id, visit_id, table_id, customer_name, subtotal, expense_total, nomination_fee, service_fee, tax, discount, total, payment_method, paid_at, created_at, updated_at')
            .eq('tenant_id', tid)
            .gte('paid_at', dayStart)
            .lte('paid_at', dayEnd)
            .order('paid_at', { ascending: true }),
          supabase.from('visits')
            .select('id, tenant_id, table_id, customer_id, customer_name, guest_count, douhan_cast_id, douhan_qty, check_in_time, check_out_time, set_minutes, extension_minutes, set_price_override, douhan_fee_override, is_checked_out, created_at, updated_at')
            .eq('tenant_id', tid)
            .gte('check_in_time', dayStart)
            .lte('check_in_time', dayEnd),
          supabase.from('nominations')
            .select('id, tenant_id, visit_id, cast_id, nomination_type, qty, fee_override, created_at, updated_at')
            .eq('tenant_id', tid),
          supabase.from('casts')
            .select('id, tenant_id, stage_name, real_name, photo_url, drop_off_location, is_active, created_at, updated_at')
            .eq('tenant_id', tid)
            .eq('is_active', true),
        ])

        const fetchedPayments = (paymentsRes.data || []) as PaymentRow[]
        setPayments(fetchedPayments)
        setVisits((visitsRes.data || []) as VisitRow[])
        setNominations((nomsRes.data || []) as NominationRow[])
        setCasts((castsRes.data || []) as CastRow[])
        setExpandedPaymentId(null)

        // payment_items / cast_sales を payment_id でまとめて取得
        if (fetchedPayments.length > 0) {
          const paymentIds = fetchedPayments.map(p => p.id)
          const [itemsRes, castSalesRes] = await Promise.all([
            supabase.from('payment_items')
              .select('id, payment_id, menu_item_name, price, quantity, is_expense')
              .eq('tenant_id', tid)
              .in('payment_id', paymentIds),
            supabase.from('cast_sales')
              .select('id, tenant_id, visit_id, payment_id, cast_id, amount, is_adjusted, adjusted_by, adjusted_at, note, created_at, updated_at')
              .eq('tenant_id', tid)
              .in('payment_id', paymentIds),
          ])
          setPaymentItems((itemsRes.data || []) as PaymentItemRow[])
          setCastSales((castSalesRes.data || []) as CastSaleRow[])
        } else {
          setPaymentItems([])
          setCastSales([])
        }
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : 'データの取得に失敗しました。ページを再読み込みしてください。')
      }
      setLoading(false)
    }
    fetchDaily()
  }, [selectedDate, viewMode])

  // 月次データ取得
  useEffect(() => {
    if (viewMode !== 'monthly') return
    async function fetchMonthly() {
      setLoading(true)
      setFetchError(null)
      try {
        const tid = requireTenantId()
        const [year, month] = selectedMonth.split('-').map(Number)
        const daysInMonth = new Date(year, month, 0).getDate()
        const monthStart = `${selectedMonth}-01T00:00:00+09:00`
        const monthEnd = `${selectedMonth}-${String(daysInMonth).padStart(2, '0')}T23:59:59+09:00`

        const { data } = await supabase.from('payments')
          .select('total, paid_at')
          .eq('tenant_id', tid)
          .gte('paid_at', monthStart)
          .lte('paid_at', monthEnd)

        setMonthlyData(calcMonthlyData((data || []) as { total: number; paid_at: string }[], year, month))
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : 'データの取得に失敗しました。ページを再読み込みしてください。')
      }
      setLoading(false)
    }
    fetchMonthly()
  }, [selectedMonth, viewMode])

  // 日次集計
  const dailySummary = useMemo(() => calcDailySummary(payments, visits), [payments, visits])

  // キャスト別ランキング
  const castRankings = useMemo((): CastRanking[] => calcCastRankings(visits, nominations, castSales, casts), [visits, nominations, castSales, casts])

  // 時間帯別来店
  const hourlyData = useMemo((): HourlyData[] => calcHourlyData(visits), [visits])

  async function savePaymentMethod() {
    if (!editingPayment || !editMethod) return
    setEditSaving(true)
    try {
      const tid = requireTenantId()
      await supabase.from('payments')
        .update({ payment_method: editMethod, updated_at: new Date().toISOString() })
        .eq('id', editingPayment.id)
        .eq('tenant_id', tid)
      setPayments(prev => prev.map(p => p.id === editingPayment.id ? { ...p, payment_method: editMethod as PaymentRow['payment_method'] } : p))
    } catch (e) {
      alert(e instanceof Error ? e.message : '支払い方法の更新に失敗しました')
    }
    setEditSaving(false)
    setEditingPayment(null)
  }

  const today = toDateStr(new Date())
  const todayMonth = today.slice(0, 7)

  // 前日/前月移動（今日より先には進めない）
  function shiftDate(offset: number) {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + offset)
    const next = toDateStr(d)
    setSelectedDate(next > today ? today : next)
  }

  function shiftMonth(offset: number) {
    const [y, m] = selectedMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + offset, 1)
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(next > todayMonth ? todayMonth : next)
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー: 日次/月次切り替え + 日付選択 */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex bg-[#141430] rounded-xl border border-[#2e2e50] p-1">
          <button
            onClick={() => setViewMode('daily')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'daily' ? 'bg-[#d4b870] text-black' : 'text-[#9090bb]'}`}
          >
            日次
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'monthly' ? 'bg-[#d4b870] text-black' : 'text-[#9090bb]'}`}
          >
            月次
          </button>
        </div>

        {viewMode === 'daily' ? (
          <div className="flex items-center gap-2">
            <button onClick={() => shiftDate(-1)} className="p-2 rounded-lg bg-[#141430] border border-[#2e2e50] text-[#9090bb]">
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-2 bg-[#141430] border border-[#2e2e50] rounded-lg px-3 py-2">
              <Calendar size={14} className="text-[#9090bb]" />
              <input
                type="date"
                value={selectedDate}
                max={today}
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-transparent text-white text-sm outline-none"
              />
            </div>
            <button onClick={() => shiftDate(1)} className="p-2 rounded-lg bg-[#141430] border border-[#2e2e50] text-[#9090bb]">
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setSelectedDate(toDateStr(new Date()))}
              className="px-3 py-2 rounded-lg text-xs text-[#d4b870] bg-[#d4b870]/10 border border-[#d4b870]/30"
            >
              今日
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={() => shiftMonth(-1)} className="p-2 rounded-lg bg-[#141430] border border-[#2e2e50] text-[#9090bb]">
              <ChevronLeft size={16} />
            </button>
            <input
              type="month"
              value={selectedMonth}
              max={todayMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-[#141430] border border-[#2e2e50] rounded-lg px-3 py-2 text-white text-sm outline-none"
            />
            <button onClick={() => shiftMonth(1)} className="p-2 rounded-lg bg-[#141430] border border-[#2e2e50] text-[#9090bb]">
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* CSVエクスポート */}
        <div className="ml-auto flex gap-2">
          {viewMode === 'daily' && payments.length > 0 && (
            <button
              onClick={() => exportDailyPaymentsCSV(payments)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#141430] border border-[#2e2e50] text-[#9090bb] text-sm hover:border-[#d4b870]/50"
            >
              <Download size={14} />日次CSV
            </button>
          )}
          {viewMode === 'monthly' && monthlyData.length > 0 && (
            <button
              onClick={() => exportMonthlyCSV(monthlyData)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#141430] border border-[#2e2e50] text-[#9090bb] text-sm hover:border-[#d4b870]/50"
            >
              <Download size={14} />月次CSV
            </button>
          )}
          {castRankings.length > 0 && (
            <button
              onClick={() => exportCastRankingCSV(castRankings)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#141430] border border-[#2e2e50] text-[#9090bb] text-sm hover:border-[#d4b870]/50"
            >
              <Download size={14} />キャスト別CSV
            </button>
          )}
        </div>
      </div>

      {fetchError && (
        <div className="bg-red-900/40 border border-red-500/50 rounded-xl px-4 py-3 text-red-300 text-sm">
          {fetchError}
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-[#9090bb]">読み込み中...</div>
      ) : viewMode === 'daily' ? (
        <>
          {/* 日次サマリーカード */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: '本日売上', value: formatYen(dailySummary.totalSales), icon: <TrendingUp size={18} />, gold: true },
              { label: '来店組数', value: `${dailySummary.visitCount}組`, sub: `${dailySummary.guestCount}名`, icon: <Users size={18} /> },
              { label: '客単価', value: formatYen(dailySummary.avgSpend), sub: '1組あたり', icon: <CreditCard size={18} /> },
              { label: '指名数', value: `${castRankings.reduce((s, r) => s + r.nominations, 0)}件`, icon: <Star size={18} /> },
            ].map(({ label, value, sub, icon, gold }) => (
              <div key={label} className="bg-[#141430] rounded-xl p-5 border border-[#2e2e50]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[#9090bb] text-xs tracking-widest uppercase">{label}</span>
                  <span className="text-[#2e2e50]">{icon}</span>
                </div>
                <div className={`text-2xl font-bold ${gold ? 'text-[#d4b870]' : 'text-white'}`}>{value}</div>
                {sub && <div className="text-xs text-[#9090bb] mt-1">{sub}</div>}
              </div>
            ))}
          </div>

          {/* 支払方法別内訳 */}
          {Object.keys(dailySummary.methodTotals).length > 0 && (
            <div className="bg-[#141430] rounded-xl p-5 border border-[#2e2e50]">
              <h2 className="text-xs font-semibold text-[#9090bb] tracking-widest uppercase mb-4">支払い方法</h2>
              <div className="space-y-3">
                {Object.entries(dailySummary.methodTotals).map(([method, amount]) => {
                  const pct = dailySummary.totalSales > 0 ? Math.round((amount / dailySummary.totalSales) * 100) : 0
                  return (
                    <div key={method} className="flex items-center gap-3">
                      <span className="text-sm text-white w-24">{METHOD_LABELS[method] || method}</span>
                      <div className="flex-1 h-2 bg-[#2e2e50] rounded-full overflow-hidden">
                        <div className="h-full bg-[#d4b870] rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-sm text-[#9090bb] w-36 text-right">{formatYen(amount)} ({pct}%)</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 時間帯別来店 */}
          {visits.length > 0 && (
            <div className="bg-[#141430] rounded-xl p-5 border border-[#2e2e50]">
              <h2 className="text-xs font-semibold text-[#9090bb] tracking-widest uppercase mb-4">
                <Clock size={12} className="inline mr-1" />時間帯別来店
              </h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={hourlyData.filter(h => h.count > 0 || (h.hour >= 17 && h.hour <= 26))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2e2e50" />
                  <XAxis dataKey="hour" tick={{ fill: '#9090bb', fontSize: 12 }} tickFormatter={h => `${h}時`} />
                  <YAxis tick={{ fill: '#9090bb', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#141430', border: '1px solid #2e2e50', borderRadius: '8px' }}
                    labelFormatter={h => `${h}時台`}
                    formatter={(value) => [`${value}組`, '来店']}
                  />
                  <Bar dataKey="count" fill="#d4b870" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* キャスト別ランキング */}
          {castRankings.length > 0 && (
            <div className="bg-[#141430] rounded-xl p-5 border border-[#2e2e50]">
              <h2 className="text-xs font-semibold text-[#9090bb] tracking-widest uppercase mb-4">
                <Star size={12} className="inline mr-1" />キャスト別ランキング
              </h2>
              <div className="space-y-3">
                {castRankings.map((r, idx) => (
                  <div key={r.castId} className="flex items-center gap-3">
                    <span className={`text-sm font-bold w-6 ${idx === 0 ? 'text-[#d4b870]' : 'text-[#3a3a5e]'}`}>{idx + 1}</span>
                    {r.photoUrl ? (
                      <img src={r.photoUrl} alt={r.stageName} className="w-8 h-8 rounded-full object-cover border border-[#2e2e50]" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#0f0f28] border border-[#2e2e50] flex items-center justify-center text-xs text-[#9090bb]">
                        {r.stageName.charAt(0)}
                      </div>
                    )}
                    <span className="flex-1 text-sm text-white">{r.stageName}</span>
                    <span className="text-xs text-[#9090bb]">指名{r.nominations}件</span>
                    <span className="text-sm font-bold text-[#d4b870]">{formatYen(r.sales)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 会計履歴 */}
          {payments.length > 0 && (
            <div className="bg-[#141430] rounded-xl p-5 border border-[#2e2e50]">
              <h2 className="text-xs font-semibold text-[#9090bb] tracking-widest uppercase mb-4">会計履歴</h2>
              <div className="space-y-1">
                {payments.map(p => {
                  const items = paymentItems.filter(i => i.payment_id === p.id)
                  const isExpanded = expandedPaymentId === p.id
                  return (
                    <div key={p.id} className="border-b border-[#2e2e50] last:border-0">
                      {/* ヘッダー行（クリックで開閉） */}
                      <div className="flex items-center">
                        <button
                          onClick={() => setExpandedPaymentId(isExpanded ? null : p.id)}
                          className="flex-1 flex items-center justify-between text-sm py-3 hover:bg-[#1a1a40] rounded-lg px-2 -mx-2 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <ChevronDown size={14} className={`text-[#9090bb] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            <span className="text-white">{p.customer_name || '---'}</span>
                            <span className="text-[#9090bb] text-xs">
                              {new Date(p.paid_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[#d4b870] font-bold">{formatYen(p.total)}</span>
                            <span className="text-[#9090bb] text-xs">{METHOD_LABELS[p.payment_method]}</span>
                          </div>
                        </button>
                        <button
                          onClick={() => { setEditingPayment(p); setEditMethod(p.payment_method) }}
                          className="ml-2 p-1.5 rounded-lg text-[#3a3a5e] hover:text-[#9090bb] hover:bg-[#1a1a40] transition-colors"
                          title="支払方法を修正"
                        >
                          <Pencil size={13} />
                        </button>
                      </div>

                      {/* 展開: 内訳 */}
                      {isExpanded && (
                        <div className="mx-2 mb-3 bg-[#0f0f28] rounded-lg p-3 space-y-1 text-xs">
                          {/* 注文明細 */}
                          {items.length > 0 && (
                            <>
                              {items.map(item => (
                                <div key={item.id} className="flex justify-between text-[#9090bb]">
                                  <span>{item.menu_item_name} × {item.quantity}</span>
                                  <span>{formatYen(item.price * item.quantity)}</span>
                                </div>
                              ))}
                              <div className="border-t border-[#2e2e50] my-1" />
                            </>
                          )}
                          {/* 小計・各種料金 */}
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
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {dailySummary.visitCount === 0 && (
            <div className="text-center py-20 text-[#3a3a5e]">
              <p className="text-sm tracking-widest">この日のデータはありません</p>
            </div>
          )}
        </>
      ) : (
        <>
          {/* 月次売上推移グラフ */}
          <div className="bg-[#141430] rounded-xl p-5 border border-[#2e2e50]">
            <h2 className="text-xs font-semibold text-[#9090bb] tracking-widest uppercase mb-4">月次売上推移</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2e2e50" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#9090bb', fontSize: 11 }}
                  tickFormatter={d => String(new Date(d).getDate())}
                />
                <YAxis
                  tick={{ fill: '#9090bb', fontSize: 11 }}
                  tickFormatter={v => `${Math.floor(v / 1000)}k`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#141430', border: '1px solid #2e2e50', borderRadius: '8px' }}
                  labelFormatter={d => d}
                  formatter={(value) => [formatYen(Number(value)), '売上']}
                />
                <Line type="monotone" dataKey="total" stroke="#d4b870" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 月次サマリー */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#141430] rounded-xl p-5 border border-[#2e2e50]">
              <div className="text-xs text-[#9090bb] tracking-widest uppercase mb-2">月間合計</div>
              <div className="text-2xl font-bold text-[#d4b870]">{formatYen(monthlyData.reduce((s, d) => s + d.total, 0))}</div>
            </div>
            <div className="bg-[#141430] rounded-xl p-5 border border-[#2e2e50]">
              <div className="text-xs text-[#9090bb] tracking-widest uppercase mb-2">来店組数</div>
              <div className="text-2xl font-bold text-white">{monthlyData.reduce((s, d) => s + d.count, 0)}組</div>
            </div>
            <div className="bg-[#141430] rounded-xl p-5 border border-[#2e2e50]">
              <div className="text-xs text-[#9090bb] tracking-widest uppercase mb-2">日平均</div>
              <div className="text-2xl font-bold text-white">
                {formatYen(Math.floor(monthlyData.reduce((s, d) => s + d.total, 0) / Math.max(1, monthlyData.filter(d => d.total > 0).length)))}
              </div>
            </div>
          </div>

          {/* 日別一覧 */}
          <div className="bg-[#141430] rounded-xl p-5 border border-[#2e2e50]">
            <h2 className="text-xs font-semibold text-[#9090bb] tracking-widest uppercase mb-4">日別データ</h2>
            <div className="space-y-1">
              {monthlyData.map(d => (
                <div key={d.date} className="flex items-center justify-between text-sm py-2 border-b border-[#2e2e50] last:border-0">
                  <span className="text-[#9090bb] w-28">{d.date}</span>
                  <span className="text-white">{d.count}組</span>
                  <span className={`font-bold ${d.total > 0 ? 'text-[#d4b870]' : 'text-[#3a3a5e]'}`}>{formatYen(d.total)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      {/* 支払方法修正モーダル */}
      {editingPayment && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEditingPayment(null)}>
          <div className="bg-[#141430] border border-[#2e2e50] rounded-xl p-6 w-80" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">支払方法を修正</h3>
              <button onClick={() => setEditingPayment(null)} className="text-[#9090bb] hover:text-white"><X size={16} /></button>
            </div>
            <p className="text-xs text-[#9090bb] mb-4">{editingPayment.customer_name || '---'} / {formatYen(editingPayment.total)}</p>
            <div className="grid grid-cols-2 gap-2 mb-6">
              {(['cash', 'credit', 'electronic', 'tab'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setEditMethod(m)}
                  className={`py-3 rounded-xl text-sm font-medium transition-colors ${editMethod === m ? 'bg-[#d4b870] text-black' : 'bg-[#0f0f28] border border-[#2e2e50] text-[#9090bb]'}`}
                >
                  {METHOD_LABELS[m]}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditingPayment(null)} className="flex-1 py-2.5 rounded-xl text-sm text-[#9090bb] bg-[#0f0f28] border border-[#2e2e50]">キャンセル</button>
              <button
                onClick={savePaymentMethod}
                disabled={editSaving || editMethod === editingPayment.payment_method}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[#d4b870] text-black disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Check size={14} />{editSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
