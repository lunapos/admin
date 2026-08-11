import { useState, useEffect, useMemo } from 'react'
import {
  ChevronLeft, ChevronRight, Calendar, Star, TrendingUp, Download,
} from 'lucide-react'
import { supabase, requireTenantId } from '../lib/supabase'
import { toDateStr, formatYen } from '../lib/dashboard'
import type { PaymentRow, CastRow, NominationRow, VisitRow, CastSaleRow } from '../types'

type PeriodMode = 'daily' | 'monthly'

interface CastSalesData {
  castId: string
  stageName: string
  photoUrl: string | null
  // 指名
  nominationsMain: number       // 本指名
  nominationsInStore: number    // 場内指名
  nominationsTotal: number      // 合計指名数
  // 同伴
  douhanCount: number
  // 売上（cast_sales の配分額合計。手動調整があればその値）
  sales: number
  // 手動で配分調整された会計を含むか
  hasAdjusted: boolean
  // 指名料
  nominationFee: number
}

function calcCastSalesData(
  visits: VisitRow[],
  nominations: NominationRow[],
  castSales: CastSaleRow[],
  casts: CastRow[],
  store: { nomination_fee_main: number; nomination_fee_in_store: number; douhan_fee: number } | null,
): CastSalesData[] {
  const visitMap = new Map(visits.map(v => [v.id, v]))

  const castMap: Record<string, CastSalesData> = {}
  for (const c of casts) {
    castMap[c.id] = {
      castId: c.id,
      stageName: c.stage_name,
      photoUrl: c.photo_url,
      nominationsMain: 0,
      nominationsInStore: 0,
      nominationsTotal: 0,
      douhanCount: 0,
      sales: 0,
      hasAdjusted: false,
      nominationFee: 0,
    }
  }

  // 売上は cast_sales をそのまま集計する（配分の唯一の正）
  for (const cs of castSales) {
    const cast = castMap[cs.cast_id]
    if (!cast) continue
    cast.sales += cs.amount
    if (cs.is_adjusted) cast.hasAdjusted = true
  }

  // 指名数・指名料は nominations から集計（配分とは別の指標）
  for (const n of nominations) {
    if (n.nomination_type === 'none') continue
    if (!visitMap.has(n.visit_id)) continue
    const cast = castMap[n.cast_id]
    if (!cast) continue

    if (n.nomination_type === 'main') {
      cast.nominationsMain += n.qty
      // 指名料（fee_override があればそれを使う）
      const fee = n.fee_override !== null ? n.fee_override : (store?.nomination_fee_main ?? 0)
      cast.nominationFee += fee * n.qty
    } else if (n.nomination_type === 'in_store') {
      cast.nominationsInStore += n.qty
      const fee = n.fee_override !== null ? n.fee_override : (store?.nomination_fee_in_store ?? 0)
      cast.nominationFee += fee * n.qty
    }
    cast.nominationsTotal += n.qty
  }

  // 同伴集計
  for (const v of visits) {
    if (v.douhan_cast_id && castMap[v.douhan_cast_id]) {
      castMap[v.douhan_cast_id].douhanCount += v.douhan_qty || 1
    }
  }

  return Object.values(castMap)
    .filter(c => c.nominationsTotal > 0 || c.douhanCount > 0 || c.sales > 0)
    .sort((a, b) => b.sales - a.sales)
}

export default function CastSalesPage() {
  const [periodMode, setPeriodMode] = useState<PeriodMode>('daily')
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()))
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  // payments は cast_sales を期間で絞るためだけに使うので state には持たない
  const [visits, setVisits] = useState<VisitRow[]>([])
  const [nominations, setNominations] = useState<NominationRow[]>([])
  const [castSales, setCastSales] = useState<CastSaleRow[]>([])
  const [casts, setCasts] = useState<CastRow[]>([])
  const [store, setStore] = useState<{ nomination_fee_main: number; nomination_fee_in_store: number; douhan_fee: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const tid = requireTenantId()
        let rangeStart: string
        let rangeEnd: string

        if (periodMode === 'daily') {
          rangeStart = `${selectedDate}T00:00:00+09:00`
          rangeEnd = `${selectedDate}T23:59:59+09:00`
        } else {
          const [year, month] = selectedMonth.split('-').map(Number)
          const daysInMonth = new Date(year, month, 0).getDate()
          rangeStart = `${selectedMonth}-01T00:00:00+09:00`
          rangeEnd = `${selectedMonth}-${String(daysInMonth).padStart(2, '0')}T23:59:59+09:00`
        }

        const [paymentsRes, visitsRes, nomsRes, castsRes, storeRes] = await Promise.all([
          supabase.from('payments')
            .select('id, tenant_id, visit_id, table_id, customer_name, subtotal, expense_total, nomination_fee, service_fee, tax, discount, total, payment_method, paid_at, created_at, updated_at')
            .eq('tenant_id', tid)
            .gte('paid_at', rangeStart)
            .lte('paid_at', rangeEnd),
          supabase.from('visits')
            .select('id, tenant_id, table_id, customer_id, customer_name, guest_count, douhan_cast_id, douhan_qty, check_in_time, check_out_time, set_minutes, extension_minutes, set_price_override, douhan_fee_override, is_checked_out, created_at, updated_at')
            .eq('tenant_id', tid)
            .gte('check_in_time', rangeStart)
            .lte('check_in_time', rangeEnd),
          supabase.from('nominations')
            .select('id, tenant_id, visit_id, cast_id, nomination_type, qty, fee_override, created_at, updated_at')
            .eq('tenant_id', tid),
          supabase.from('casts')
            .select('id, tenant_id, stage_name, real_name, photo_url, drop_off_location, is_active, created_at, updated_at')
            .eq('tenant_id', tid)
            .eq('is_active', true),
          supabase.from('stores')
            .select('nomination_fee_main, nomination_fee_in_store, douhan_fee')
            .eq('id', tid)
            .single(),
        ])

        const paymentRows = (paymentsRes.data || []) as PaymentRow[]

        // cast_sales は会計に紐づくので、期間内の payment_id で絞り込む
        let castSaleRows: CastSaleRow[] = []
        if (paymentRows.length > 0) {
          const { data: csData } = await supabase.from('cast_sales')
            .select('id, tenant_id, visit_id, payment_id, cast_id, amount, is_adjusted, adjusted_by, adjusted_at, note, created_at, updated_at')
            .eq('tenant_id', tid)
            .in('payment_id', paymentRows.map(p => p.id))
          castSaleRows = (csData || []) as CastSaleRow[]
        }

        setVisits((visitsRes.data || []) as VisitRow[])
        setNominations((nomsRes.data || []) as NominationRow[])
        setCastSales(castSaleRows)
        setCasts((castsRes.data || []) as CastRow[])
        setStore(storeRes.data ?? null)
      } catch {
        // エラー時は空データ
      }
      setLoading(false)
    }
    fetchData()
  }, [periodMode, selectedDate, selectedMonth])

  const castSalesData = useMemo(
    () => calcCastSalesData(visits, nominations, castSales, casts, store),
    [visits, nominations, castSales, casts, store],
  )

  const totalNominations = castSalesData.reduce((s, c) => s + c.nominationsTotal, 0)
  const totalDouhan = castSalesData.reduce((s, c) => s + c.douhanCount, 0)

  const today = toDateStr(new Date())
  const todayMonth = today.slice(0, 7)

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

  function exportCSV() {
    const header = 'キャスト名,本指名,場内指名,指名計,同伴,指名料合計,売上,配分調整'
    const rows = castSalesData.map(c =>
      `${c.stageName},${c.nominationsMain},${c.nominationsInStore},${c.nominationsTotal},${c.douhanCount},${c.nominationFee},${c.sales},${c.hasAdjusted ? 'あり' : ''}`
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const label = periodMode === 'daily' ? selectedDate : selectedMonth
    a.href = url
    a.download = `cast-sales-${label}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー: 日次/月次切り替え + 日付選択 */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex bg-[#141430] rounded-xl border border-[#2e2e50] p-1">
          <button
            onClick={() => setPeriodMode('daily')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${periodMode === 'daily' ? 'bg-[#d4b870] text-black' : 'text-[#9090bb]'}`}
          >
            日次
          </button>
          <button
            onClick={() => setPeriodMode('monthly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${periodMode === 'monthly' ? 'bg-[#d4b870] text-black' : 'text-[#9090bb]'}`}
          >
            月次
          </button>
        </div>

        {periodMode === 'daily' ? (
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

        {castSalesData.length > 0 && (
          <button
            onClick={exportCSV}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-[#141430] border border-[#2e2e50] text-[#9090bb] text-sm hover:border-[#d4b870]/50"
          >
            <Download size={14} />CSV
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-20 text-[#9090bb]">読み込み中...</div>
      ) : castSalesData.length === 0 ? (
        <div className="text-center py-20 text-[#3a3a5e]">
          <p className="text-sm tracking-widest">この期間のデータはありません</p>
        </div>
      ) : (
        <>
          {/* サマリーカード */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-[#141430] rounded-xl p-5 border border-[#2e2e50]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[#9090bb] text-xs tracking-widest uppercase">指名合計</span>
                <Star size={18} className="text-[#2e2e50]" />
              </div>
              <div className="text-2xl font-bold text-white">{totalNominations}件</div>
            </div>
            <div className="bg-[#141430] rounded-xl p-5 border border-[#2e2e50]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[#9090bb] text-xs tracking-widest uppercase">同伴合計</span>
                <Star size={18} className="text-[#2e2e50]" />
              </div>
              <div className="text-2xl font-bold text-white">{totalDouhan}件</div>
            </div>
            <div className="bg-[#141430] rounded-xl p-5 border border-[#2e2e50]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[#9090bb] text-xs tracking-widest uppercase">指名料合計</span>
                <TrendingUp size={18} className="text-[#2e2e50]" />
              </div>
              <div className="text-2xl font-bold text-[#d4b870]">
                {formatYen(castSalesData.reduce((s, c) => s + c.nominationFee, 0))}
              </div>
            </div>
          </div>

          {/* TOP3 バーグラフ */}
          {castSalesData.length > 0 && (() => {
            const top3 = castSalesData.slice(0, 3)
            const maxSales = top3[0]?.sales || 1
            const medals = ['🥇', '🥈', '🥉']
            const barColors = ['#d4b870', '#9090bb', '#4a4a6e']
            return (
              <div className="bg-[#141430] rounded-xl border border-[#2e2e50] p-5 space-y-4">
                <h2 className="text-xs font-semibold text-[#9090bb] tracking-widest uppercase">
                  <TrendingUp size={12} className="inline mr-1" />売上 TOP3
                </h2>
                {top3.map((c, idx) => (
                  <div key={c.castId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span>{medals[idx]}</span>
                        {c.photoUrl ? (
                          <img src={c.photoUrl} alt={c.stageName} className="w-6 h-6 rounded-full object-cover border border-[#2e2e50]" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-[#0f0f28] border border-[#2e2e50] flex items-center justify-center text-[10px] text-[#9090bb]">
                            {c.stageName.charAt(0)}
                          </div>
                        )}
                        <span className="text-white font-medium">{c.stageName}</span>
                      </div>
                      <span className={`font-bold ${idx === 0 ? 'text-[#d4b870]' : 'text-white'}`}>
                        {formatYen(c.sales)}
                      </span>
                    </div>
                    <div className="h-2 bg-[#0f0f28] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.round((c.sales / maxSales) * 100)}%`,
                          backgroundColor: barColors[idx],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* キャスト別一覧テーブル */}
          <div className="bg-[#141430] rounded-xl border border-[#2e2e50] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#2e2e50]">
              <h2 className="text-xs font-semibold text-[#9090bb] tracking-widest uppercase">
                <Star size={12} className="inline mr-1" />キャスト別実績
              </h2>
            </div>

            {/* ヘッダー行 */}
            <div className="hidden md:grid grid-cols-[auto_1fr_repeat(5,auto)] gap-4 px-5 py-2 text-[10px] text-[#3a3a5e] tracking-widest uppercase border-b border-[#2e2e50]">
              <span className="w-6" />
              <span />
              <span className="text-right w-16">本指名</span>
              <span className="text-right w-16">場内指名</span>
              <span className="text-right w-16">同伴</span>
              <span className="text-right w-24">指名料</span>
              <span className="text-right w-28">売上</span>
            </div>

            <div className="divide-y divide-[#2e2e50]">
              {castSalesData.map((c, idx) => (
                <div key={c.castId} className="flex md:grid md:grid-cols-[auto_1fr_repeat(5,auto)] gap-4 px-5 py-4 items-center hover:bg-[#0f0f28] transition-colors">
                  {/* 順位 */}
                  <span className={`text-sm font-bold w-6 shrink-0 ${idx === 0 ? 'text-[#d4b870]' : 'text-[#3a3a5e]'}`}>
                    {idx + 1}
                  </span>

                  {/* キャスト名 */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {c.photoUrl ? (
                      <img src={c.photoUrl} alt={c.stageName} className="w-9 h-9 rounded-full object-cover border border-[#2e2e50] shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-[#0f0f28] border border-[#2e2e50] flex items-center justify-center text-xs text-[#9090bb] shrink-0">
                        {c.stageName.charAt(0)}
                      </div>
                    )}
                    <span className="text-sm text-white truncate">{c.stageName}</span>
                    {c.hasAdjusted && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] text-[#d4b870] bg-[#d4b870]/10 border border-[#d4b870]/30">
                        調整済み
                      </span>
                    )}
                  </div>

                  {/* 本指名 */}
                  <div className="text-right w-16 shrink-0">
                    <div className="text-sm text-white">{c.nominationsMain}</div>
                    <div className="text-[10px] text-[#3a3a5e] md:hidden">本指名</div>
                  </div>

                  {/* 場内指名 */}
                  <div className="text-right w-16 shrink-0">
                    <div className="text-sm text-white">{c.nominationsInStore}</div>
                    <div className="text-[10px] text-[#3a3a5e] md:hidden">場内</div>
                  </div>

                  {/* 同伴 */}
                  <div className="text-right w-16 shrink-0">
                    <div className="text-sm text-white">{c.douhanCount}</div>
                    <div className="text-[10px] text-[#3a3a5e] md:hidden">同伴</div>
                  </div>

                  {/* 指名料 */}
                  <div className="text-right w-24 shrink-0">
                    <div className="text-sm text-white">{formatYen(c.nominationFee)}</div>
                    <div className="text-[10px] text-[#3a3a5e] md:hidden">指名料</div>
                  </div>

                  {/* 売上 */}
                  <div className="text-right w-28 shrink-0">
                    <div className={`text-sm font-bold ${idx === 0 ? 'text-[#d4b870]' : 'text-white'}`}>
                      {formatYen(c.sales)}
                    </div>
                    <div className="text-[10px] text-[#3a3a5e] md:hidden">売上</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 凡例 */}
          <div className="text-xs text-[#3a3a5e] px-1 space-y-1">
            <p>※ 売上 = 会計ごとの配分額の合計。既定では「来店の小計 ÷ 本指名数 × 自分の本指名数」で自動配分され、伝票単位で任意の割合に変更できます</p>
            <p>※ <span className="text-[#d4b870]">調整済み</span> = その期間に手動で配分を変更した会計が含まれるキャスト</p>
            <p>※ 指名料 = 本指名・場内指名の料金合計（fee_override が設定されている場合はその値を使用）</p>
          </div>
        </>
      )}
    </div>
  )
}
