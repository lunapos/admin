import { useState, useEffect, useMemo } from 'react'
import {
  Wallet, ArrowDownCircle, ArrowUpCircle, ChevronLeft, ChevronRight,
  Plus, PiggyBank, Calendar, Download, Search, X, ChevronUp, ChevronDown, Scale,
} from 'lucide-react'
import { supabase, requireTenantId, getHomeTenantId } from '../lib/supabase'
import { toDateStr, todayBusinessDate, formatYen, METHOD_LABELS } from '../lib/dashboard'
import { rangeToTimestamps, isValidRange } from '../lib/salesSlips'
import {
  filterCashEntries, calcCashEntrySummary, calcCategoryBreakdown,
  validateCashEntry, ENTRY_TYPE_LABELS, DEPOSIT_CATEGORIES, WITHDRAWAL_CATEGORIES,
  EMPTY_CASH_FILTERS,
} from '../lib/cashEntries'
import type { CashEntryFilters } from '../lib/cashEntries'
import { exportCashEntriesCSV } from '../lib/csvExport'
import CashEntryList from '../components/CashEntryList'
import type {
  PaymentRow, CashWithdrawalRow, RegisterSessionRow, CashEntryType,
} from '../types'

/** 日次=レジ締め / 期間=入出金の集計 */
type ViewMode = 'daily' | 'period'

type PresetKey = 'week' | 'month' | 'prevMonth'

function presetRange(key: PresetKey): { start: string; end: string } {
  const today = todayBusinessDate()
  if (key === 'week') {
    const s = new Date(`${today}T12:00:00+09:00`)
    s.setDate(s.getDate() - 6)
    return { start: toDateStr(s), end: today }
  }
  if (key === 'month') return { start: `${today.slice(0, 7)}-01`, end: today }
  const [y, m] = today.split('-').map(Number)
  return { start: toDateStr(new Date(y, m - 2, 1)), end: toDateStr(new Date(y, m - 1, 0)) }
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'week', label: '直近7日' },
  { key: 'month', label: '今月' },
  { key: 'prevMonth', label: '先月' },
]

const ENTRY_TYPES: CashEntryType[] = ['deposit', 'withdrawal']

export default function RegisterPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('daily')

  // 日次（レジ締め）
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()))
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [session, setSession] = useState<RegisterSessionRow | null>(null)

  // 期間
  const periodInitial = presetRange('week')
  const [startDate, setStartDate] = useState(periodInitial.start)
  const [endDate, setEndDate] = useState(periodInitial.end)
  const [filters, setFilters] = useState<CashEntryFilters>(EMPTY_CASH_FILTERS)
  const [showFilters, setShowFilters] = useState(false)

  // 共通
  const [entries, setEntries] = useState<CashWithdrawalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // 開始金額編集
  const [editingStart, setEditingStart] = useState(false)
  const [startAmountInput, setStartAmountInput] = useState('')

  // 入出金の記録
  const [formType, setFormType] = useState<CashEntryType | null>(null)
  const [formAmount, setFormAmount] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formNote, setFormNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const rangeValid = isValidRange(startDate, endDate)

  // 系列店の閲覧中は読み取り専用
  const readOnly = (() => {
    try {
      return requireTenantId() !== getHomeTenantId()
    } catch {
      return true
    }
  })()

  useEffect(() => {
    if (viewMode === 'period' && !rangeValid) return

    async function fetchData() {
      setLoading(true)
      setFetchError(null)
      try {
        const tid = requireTenantId()

        if (viewMode === 'daily') {
          const dayStart = `${selectedDate}T00:00:00+09:00`
          const dayEnd = `${selectedDate}T23:59:59+09:00`

          const [paymentsRes, entriesRes, sessionRes] = await Promise.all([
            supabase.from('payments')
              .select('*')
              .eq('tenant_id', tid)
              .gte('paid_at', dayStart)
              .lte('paid_at', dayEnd)
              .order('paid_at', { ascending: true }),
            supabase.from('cash_withdrawals')
              .select('*')
              .eq('tenant_id', tid)
              .is('deleted_at', null)
              .gte('created_at', dayStart)
              .lte('created_at', dayEnd)
              .order('created_at', { ascending: true }),
            supabase.from('register_sessions')
              .select('*')
              .eq('tenant_id', tid)
              .eq('business_date', selectedDate)
              .maybeSingle(),
          ])
          if (entriesRes.error) throw entriesRes.error

          setPayments((paymentsRes.data || []) as PaymentRow[])
          setEntries((entriesRes.data || []) as CashWithdrawalRow[])
          setSession(sessionRes.data as RegisterSessionRow | null)
        } else {
          const { rangeStart, rangeEnd } = rangeToTimestamps(startDate, endDate)
          const { data, error } = await supabase.from('cash_withdrawals')
            .select('*')
            .eq('tenant_id', tid)
            .is('deleted_at', null)
            .gte('created_at', rangeStart)
            .lte('created_at', rangeEnd)
            .order('created_at', { ascending: false })
          if (error) throw error
          setEntries((data || []) as CashWithdrawalRow[])
        }
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : 'データの取得に失敗しました。ページを再読み込みしてください。')
        setEntries([])
      }
      setLoading(false)
    }
    fetchData()
  }, [viewMode, selectedDate, startDate, endDate, rangeValid, reloadKey])

  // --- 日次の集計 ---
  const dailySummary = useMemo(() => {
    const byMethod = (m: string) =>
      payments.filter(p => p.payment_method === m).reduce((s, p) => s + p.total, 0)

    const cashSales = byMethod('cash')
    const totalSales = payments.reduce((s, p) => s + p.total, 0)
    const cash = calcCashEntrySummary(entries)
    const startAmount = session?.start_amount || 0

    return {
      cashSales,
      cardSales: byMethod('credit'),
      electronicSales: byMethod('electronic'),
      tabSales: byMethod('tab'),
      totalSales,
      totalWithdrawals: cash.withdrawalTotal,
      totalDeposits: cash.depositTotal,
      startAmount,
      expectedCash: startAmount + cashSales + cash.depositTotal - cash.withdrawalTotal,
      paymentCount: payments.length,
    }
  }, [payments, entries, session])

  // --- 期間の集計 ---
  const visibleEntries = useMemo(
    () => (viewMode === 'period' ? filterCashEntries(entries, filters) : entries),
    [viewMode, entries, filters],
  )
  const periodSummary = useMemo(() => calcCashEntrySummary(visibleEntries), [visibleEntries])
  const depositBreakdown = useMemo(() => calcCategoryBreakdown(visibleEntries, 'deposit'), [visibleEntries])
  const withdrawalBreakdown = useMemo(() => calcCategoryBreakdown(visibleEntries, 'withdrawal'), [visibleEntries])

  const usedCategories = useMemo(() => {
    const set = new Set<string>()
    for (const e of entries) if (e.category) set.add(e.category)
    return [...set].sort((a, b) => a.localeCompare(b, 'ja'))
  }, [entries])

  const hasActiveFilters =
    filters.types.length > 0 || filters.categories.length > 0 || filters.keyword !== ''

  const today = toDateStr(new Date())

  function changeDate(offset: number) {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + offset)
    const next = toDateStr(d)
    setSelectedDate(next > today ? today : next)
  }

  function applyPreset(key: PresetKey) {
    const r = presetRange(key)
    setStartDate(r.start)
    setEndDate(r.end)
  }

  async function saveStartAmount() {
    const amount = parseInt(startAmountInput, 10)
    if (isNaN(amount) || amount < 0) return
    const tid = requireTenantId()
    if (session) {
      await supabase.from('register_sessions')
        .update({ start_amount: amount })
        .eq('id', session.id)
    } else {
      await supabase.from('register_sessions')
        .insert({ tenant_id: tid, business_date: selectedDate, start_amount: amount })
    }
    setEditingStart(false)
    setReloadKey(k => k + 1)
  }

  function openForm(type: CashEntryType) {
    setFormType(type)
    setFormAmount('')
    setFormCategory('')
    setFormNote('')
    setFormError(null)
  }

  async function saveEntry() {
    if (!formType) return
    const err = validateCashEntry(formAmount)
    if (err) {
      setFormError(err)
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const tid = requireTenantId()
      const { error } = await supabase.from('cash_withdrawals').insert({
        tenant_id: tid,
        amount: Number(formAmount.trim()),
        entry_type: formType,
        category: formCategory || null,
        note: formNote || null,
      })
      if (error) throw error
      setFormType(null)
      setReloadKey(k => k + 1)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '保存に失敗しました')
    }
    setSaving(false)
  }

  /** 論理削除（現金の動きは痕跡を残す） */
  async function deleteEntry(id: string) {
    try {
      const target = entries.find(e => e.id === id)
      const { error } = await supabase.from('cash_withdrawals')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error

      // 操作ログを残す（失敗しても削除自体は成立させる）
      try {
        await supabase.from('audit_logs').insert({
          tenant_id: requireTenantId(),
          action: 'delete',
          target_table: 'cash_withdrawals',
          target_id: id,
          old_value: target
            ? {
                entry_type: target.entry_type,
                amount: String(target.amount),
                category: target.category ?? '',
                note: target.note ?? '',
                created_at: target.created_at,
              }
            : null,
        })
      } catch {
        // 監査ログの失敗は握りつぶす（本処理は完了済み）
      }

      setDeletingId(null)
      setReloadKey(k => k + 1)
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : '取り消しに失敗しました')
      setDeletingId(null)
    }
  }

  function handleExport() {
    const label = startDate === endDate ? startDate : `${startDate}_${endDate}`
    exportCashEntriesCSV(visibleEntries, label)
  }

  function toggleType(t: CashEntryType) {
    setFilters(f => ({
      ...f,
      types: f.types.includes(t) ? f.types.filter(x => x !== t) : [...f.types, t],
    }))
  }

  function toggleCategory(c: string) {
    setFilters(f => ({
      ...f,
      categories: f.categories.includes(c) ? f.categories.filter(x => x !== c) : [...f.categories, c],
    }))
  }

  const formCategories = formType === 'deposit' ? DEPOSIT_CATEGORIES : WITHDRAWAL_CATEGORIES

  return (
    <div className="space-y-6">
      {/* ヘッダー: モード切替 + 期間指定 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-[#141430] rounded-xl border border-[#2e2e50] p-1">
          <button
            onClick={() => setViewMode('daily')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'daily' ? 'bg-[#d4b870] text-black' : 'text-[#9090bb]'
            }`}
          >
            レジ締め
          </button>
          <button
            onClick={() => setViewMode('period')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'period' ? 'bg-[#d4b870] text-black' : 'text-[#9090bb]'
            }`}
          >
            入出金の集計
          </button>
        </div>

        {viewMode === 'daily' ? (
          <div className="flex items-center gap-2">
            <button onClick={() => changeDate(-1)} className="p-2 rounded-lg bg-[#141430] border border-[#2e2e50] text-[#9090bb] hover:text-white">
              <ChevronLeft size={18} />
            </button>
            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-[#141430] border border-[#2e2e50] rounded-lg px-3 py-2 text-white text-sm"
            />
            <button onClick={() => changeDate(1)} className="p-2 rounded-lg bg-[#141430] border border-[#2e2e50] text-[#9090bb] hover:text-white">
              <ChevronRight size={18} />
            </button>
          </div>
        ) : (
          <>
            <div className="flex bg-[#141430] rounded-xl border border-[#2e2e50] p-1">
              {PRESETS.map(p => (
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
              <Search size={14} />絞り込み
              {hasActiveFilters && <span className="text-[10px]">ON</span>}
              {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {viewMode === 'period' && visibleEntries.length > 0 && (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#141430] border border-[#2e2e50] text-[#9090bb] text-sm hover:border-[#d4b870]/50"
            >
              <Download size={14} />CSV
            </button>
          )}
          {!readOnly && (
            <>
              <button
                onClick={() => openForm('deposit')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-900/20 border border-green-900/40 text-green-400 text-sm hover:bg-green-900/30 transition-colors"
              >
                <Plus size={14} />入金
              </button>
              <button
                onClick={() => openForm('withdrawal')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-900/20 border border-red-900/40 text-red-400 text-sm hover:bg-red-900/30 transition-colors"
              >
                <Plus size={14} />出金
              </button>
            </>
          )}
        </div>
      </div>

      {/* 絞り込みパネル（期間モードのみ） */}
      {viewMode === 'period' && showFilters && (
        <div className="bg-[#141430] rounded-xl border border-[#2e2e50] p-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-[10px] text-[#9090bb] tracking-widest uppercase">区分</label>
              <div className="flex gap-2">
                {ENTRY_TYPES.map(t => (
                  <button
                    key={t}
                    onClick={() => toggleType(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                      filters.types.includes(t)
                        ? 'bg-[#d4b870]/10 border-[#d4b870]/30 text-[#d4b870]'
                        : 'bg-[#0f0f28] border-[#2e2e50] text-[#9090bb] hover:text-white'
                    }`}
                  >
                    {ENTRY_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] text-[#9090bb] tracking-widest uppercase">用途</label>
              {usedCategories.length === 0 ? (
                <p className="text-xs text-[#3a3a5e]">記録された用途がありません</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {usedCategories.map(c => (
                    <button
                      key={c}
                      onClick={() => toggleCategory(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                        filters.categories.includes(c)
                          ? 'bg-[#d4b870]/10 border-[#d4b870]/30 text-[#d4b870]'
                          : 'bg-[#0f0f28] border-[#2e2e50] text-[#9090bb] hover:text-white'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] text-[#9090bb] tracking-widest uppercase">メモ・用途を検索</label>
              <input
                type="text"
                value={filters.keyword}
                onChange={e => setFilters(f => ({ ...f, keyword: e.target.value }))}
                placeholder="部分一致で検索"
                className="w-full bg-[#0f0f28] border border-[#2e2e50] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#d4b870]"
              />
            </div>
          </div>

          {hasActiveFilters && (
            <button
              onClick={() => setFilters(EMPTY_CASH_FILTERS)}
              className="flex items-center gap-1.5 text-xs text-[#9090bb] hover:text-white transition-colors"
            >
              <X size={12} />絞り込みをクリア
            </button>
          )}
        </div>
      )}

      {viewMode === 'period' && !rangeValid ? (
        <div className="text-center py-20 text-[#3a3a5e]">
          <p className="text-sm tracking-widest">開始日が終了日より後になっています</p>
        </div>
      ) : fetchError ? (
        <div className="bg-red-900/20 border border-red-900/40 rounded-xl p-5 text-sm text-red-400">
          {fetchError}
        </div>
      ) : loading ? (
        <div className="text-center text-[#9090bb] py-16">読み込み中...</div>
      ) : viewMode === 'daily' ? (
        <>
          {/* レジ残高カード */}
          <div className="bg-gradient-to-br from-[#1a1040] to-[#0f0f28] border border-[#d4b870]/30 rounded-2xl p-6">
            <div className="text-center">
              <p className="text-[#9090bb] text-sm mb-1">レジ内 現金残高（見込み）</p>
              <p className="text-4xl font-bold text-[#d4b870]">{formatYen(dailySummary.expectedCash)}</p>
              <p className="text-xs text-[#9090bb] mt-2">
                開始 {formatYen(dailySummary.startAmount)} ＋ 現金売上 {formatYen(dailySummary.cashSales)}
                {dailySummary.totalDeposits > 0 && <> ＋ 入金 {formatYen(dailySummary.totalDeposits)}</>}
                {' '}− 出金 {formatYen(dailySummary.totalWithdrawals)}
              </p>
            </div>
          </div>

          {/* サマリカード */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              icon={<PiggyBank size={18} />}
              label="開始金額"
              value={formatYen(dailySummary.startAmount)}
              color="text-blue-400"
              onClick={readOnly ? undefined : () => {
                setStartAmountInput(String(dailySummary.startAmount))
                setEditingStart(true)
              }}
              editable={!readOnly}
            />
            <SummaryCard
              icon={<ArrowDownCircle size={18} />}
              label="現金売上"
              value={formatYen(dailySummary.cashSales)}
              sub={`${payments.filter(p => p.payment_method === 'cash').length}件`}
              color="text-green-400"
            />
            <SummaryCard
              icon={<ArrowUpCircle size={18} />}
              label="出金合計"
              value={formatYen(dailySummary.totalWithdrawals)}
              sub={`入金 ${formatYen(dailySummary.totalDeposits)}`}
              color="text-red-400"
            />
            <SummaryCard
              icon={<Wallet size={18} />}
              label="売上合計"
              value={formatYen(dailySummary.totalSales)}
              sub={`${dailySummary.paymentCount}件`}
              color="text-[#d4b870]"
            />
          </div>

          {/* 決済方法別の内訳 */}
          <div className="bg-[#0f0f28] border border-[#2e2e50] rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">決済方法別 内訳</h3>
            <div className="space-y-3">
              <MethodBar label="現金" amount={dailySummary.cashSales} total={dailySummary.totalSales} color="bg-green-500" />
              <MethodBar label="カード" amount={dailySummary.cardSales} total={dailySummary.totalSales} color="bg-blue-500" />
              <MethodBar label="電子マネー" amount={dailySummary.electronicSales} total={dailySummary.totalSales} color="bg-purple-500" />
              <MethodBar label="ツケ" amount={dailySummary.tabSales} total={dailySummary.totalSales} color="bg-orange-500" />
            </div>
          </div>

          {/* 入出金履歴（当日） */}
          <div className="bg-[#0f0f28] border border-[#2e2e50] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#2e2e50]">
              <h3 className="text-sm font-semibold text-white">入出金履歴</h3>
            </div>
            {entries.length === 0 ? (
              <p className="text-[#9090bb] text-sm text-center py-6">入出金なし</p>
            ) : (
              <CashEntryList
                entries={entries}
                readOnly={readOnly}
                deletingId={deletingId}
                onRequestDelete={setDeletingId}
                onConfirmDelete={deleteEntry}
                onCancelDelete={() => setDeletingId(null)}
              />
            )}
          </div>

          {/* 会計一覧 */}
          <div className="bg-[#0f0f28] border border-[#2e2e50] rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">
              会計一覧
              <span className="text-[#9090bb] font-normal ml-2 text-xs">全{payments.length}件</span>
            </h3>
            {payments.length === 0 ? (
              <p className="text-[#9090bb] text-sm text-center py-4">会計なし</p>
            ) : (
              <div className="space-y-2">
                {payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-[#141430] rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        p.payment_method === 'cash' ? 'bg-green-900/30 text-green-400' :
                        p.payment_method === 'credit' ? 'bg-blue-900/30 text-blue-400' :
                        p.payment_method === 'electronic' ? 'bg-purple-900/30 text-purple-400' :
                        'bg-orange-900/30 text-orange-400'
                      }`}>
                        {METHOD_LABELS[p.payment_method] || p.payment_method}
                      </span>
                      <span className="text-white text-sm">{p.customer_name || '---'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-white font-semibold text-sm">{formatYen(p.total)}</span>
                      <span className="text-[#9090bb] text-xs">
                        {new Date(p.paid_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* 期間サマリー */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-[#141430] rounded-xl p-5 border border-[#2e2e50]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[#9090bb] text-xs tracking-widest uppercase">入金合計</span>
                <ArrowDownCircle size={18} className="text-[#2e2e50]" />
              </div>
              <div className="text-2xl font-bold text-green-400">{formatYen(periodSummary.depositTotal)}</div>
              <div className="text-xs text-[#3a3a5e] mt-1">{periodSummary.depositCount}件</div>
            </div>
            <div className="bg-[#141430] rounded-xl p-5 border border-[#2e2e50]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[#9090bb] text-xs tracking-widest uppercase">出金合計</span>
                <ArrowUpCircle size={18} className="text-[#2e2e50]" />
              </div>
              <div className="text-2xl font-bold text-red-400">{formatYen(periodSummary.withdrawalTotal)}</div>
              <div className="text-xs text-[#3a3a5e] mt-1">{periodSummary.withdrawalCount}件</div>
            </div>
            <div className="bg-[#141430] rounded-xl p-5 border border-[#2e2e50]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[#9090bb] text-xs tracking-widest uppercase">差引</span>
                <Scale size={18} className="text-[#2e2e50]" />
              </div>
              <div className={`text-2xl font-bold ${periodSummary.net < 0 ? 'text-red-400' : 'text-[#d4b870]'}`}>
                {periodSummary.net < 0 ? '−' : ''}{formatYen(Math.abs(periodSummary.net))}
              </div>
              <div className="text-xs text-[#3a3a5e] mt-1">入金 − 出金</div>
            </div>
          </div>

          {/* 用途別内訳 */}
          {(depositBreakdown.length > 0 || withdrawalBreakdown.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              <CategoryPanel title="入金の用途別" rows={depositBreakdown} accent="text-green-400" barColor="bg-green-500" />
              <CategoryPanel title="出金の用途別" rows={withdrawalBreakdown} accent="text-red-400" barColor="bg-red-500" />
            </div>
          )}

          {/* 入出金一覧 */}
          {visibleEntries.length === 0 ? (
            <div className="text-center py-20 text-[#3a3a5e]">
              <Wallet size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm tracking-widest">
                {entries.length === 0 ? 'この期間の入出金はありません' : '絞り込み条件に一致する記録がありません'}
              </p>
            </div>
          ) : (
            <div className="bg-[#141430] rounded-xl border border-[#2e2e50] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#2e2e50] flex items-center justify-between">
                <h2 className="text-xs font-semibold text-[#9090bb] tracking-widest uppercase">
                  <Wallet size={12} className="inline mr-1" />入出金履歴
                </h2>
                <span className="text-xs text-[#3a3a5e]">
                  {entries.length !== visibleEntries.length && `${entries.length}件中 `}{visibleEntries.length}件
                </span>
              </div>
              <CashEntryList
                entries={visibleEntries}
                readOnly={readOnly}
                showDateHeaders
                deletingId={deletingId}
                onRequestDelete={setDeletingId}
                onConfirmDelete={deleteEntry}
                onCancelDelete={() => setDeletingId(null)}
              />
            </div>
          )}

          <div className="text-xs text-[#3a3a5e] px-1 space-y-1">
            <p>※ 期間は営業日ベース（各日 12:00 〜 翌 11:59）で集計しています</p>
            <p>※ POSから記録された入出金もここに表示されます</p>
            <p>※ 取り消した記録は一覧から除かれますが、データは監査のため保持されます</p>
          </div>
        </>
      )}

      {/* 開始金額編集モーダル */}
      {editingStart && (
        <Modal onClose={() => setEditingStart(false)}>
          <h3 className="text-lg font-bold text-white mb-4">開始金額を設定</h3>
          <p className="text-[#9090bb] text-sm mb-4">営業開始時のレジ内の現金額を入力してください。</p>
          <input
            type="number"
            min="0"
            step="1000"
            value={startAmountInput}
            onChange={e => setStartAmountInput(e.target.value)}
            className="w-full bg-[#141430] border border-[#2e2e50] rounded-lg px-4 py-3 text-white text-lg focus:border-[#d4b870] focus:outline-none mb-4"
            placeholder="例: 50000"
            autoFocus
          />
          <div className="flex gap-3">
            <button
              onClick={() => setEditingStart(false)}
              className="flex-1 px-4 py-2.5 rounded-lg bg-[#141430] border border-[#2e2e50] text-[#9090bb] text-sm hover:text-white"
            >
              キャンセル
            </button>
            <button
              onClick={saveStartAmount}
              className="flex-1 px-4 py-2.5 rounded-lg bg-[#d4b870] text-[#0a0a18] font-semibold text-sm hover:bg-[#c9a456]"
            >
              保存
            </button>
          </div>
        </Modal>
      )}

      {/* 入出金の記録モーダル */}
      {formType && (
        <Modal onClose={() => !saving && setFormType(null)}>
          <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
            {formType === 'deposit' ? (
              <ArrowDownCircle size={20} className="text-green-400" />
            ) : (
              <ArrowUpCircle size={20} className="text-red-400" />
            )}
            {ENTRY_TYPE_LABELS[formType]}を記録
          </h3>
          <p className="text-[#9090bb] text-xs mb-5">
            {formType === 'deposit'
              ? 'レジに入れた現金を記録します（釣銭補充・両替の戻しなど）'
              : 'レジから出した現金を記録します（両替・買い出し・タクシー代など）'}
          </p>

          <div className="space-y-4">
            <div>
              <label className="text-[#9090bb] text-xs block mb-1">金額（円）</label>
              <input
                type="number"
                min="1"
                step="1"
                value={formAmount}
                onChange={e => setFormAmount(e.target.value)}
                className="w-full bg-[#141430] border border-[#2e2e50] rounded-lg px-4 py-3 text-white text-lg focus:border-[#d4b870] focus:outline-none"
                placeholder="例: 10000"
                autoFocus
              />
            </div>

            <div>
              <label className="text-[#9090bb] text-xs block mb-1">用途（任意）</label>
              <div className="flex flex-wrap gap-2">
                {formCategories.map(c => (
                  <button
                    key={c}
                    onClick={() => setFormCategory(formCategory === c ? '' : c)}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                      formCategory === c
                        ? 'bg-[#d4b870]/10 border-[#d4b870]/30 text-[#d4b870]'
                        : 'bg-[#141430] border-[#2e2e50] text-[#9090bb] hover:text-white'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[#9090bb] text-xs block mb-1">メモ（任意）</label>
              <input
                type="text"
                value={formNote}
                onChange={e => setFormNote(e.target.value)}
                className="w-full bg-[#141430] border border-[#2e2e50] rounded-lg px-4 py-3 text-white text-sm focus:border-[#d4b870] focus:outline-none"
                placeholder="例: 千円札への両替"
              />
            </div>
          </div>

          {formError && <p className="text-red-400 text-xs mt-3">{formError}</p>}

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setFormType(null)}
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg bg-[#141430] border border-[#2e2e50] text-[#9090bb] text-sm hover:text-white disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              onClick={saveEntry}
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg bg-[#d4b870] text-[#0a0a18] font-semibold text-sm hover:bg-[#c9a456] disabled:opacity-50"
            >
              {saving ? '保存中...' : '記録する'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// --- サブコンポーネント ---

function SummaryCard({ icon, label, value, sub, color, onClick, editable }: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  color: string
  onClick?: () => void
  editable?: boolean
}) {
  return (
    <div
      className={`bg-[#0f0f28] border border-[#2e2e50] rounded-2xl p-4 ${editable ? 'cursor-pointer hover:border-[#d4b870]/30' : ''}`}
      onClick={onClick}
    >
      <div className={`flex items-center gap-2 mb-2 ${color}`}>
        {icon}
        <span className="text-xs text-[#9090bb]">{label}</span>
        {editable && <span className="text-[10px] text-[#9090bb] ml-auto">タップで編集</span>}
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-[#9090bb] mt-1">{sub}</p>}
    </div>
  )
}

function MethodBar({ label, amount, total, color }: {
  label: string
  amount: number
  total: number
  color: string
}) {
  const pct = total > 0 ? (amount / total) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-[#9090bb] text-xs w-16 text-right">{label}</span>
      <div className="flex-1 h-6 bg-[#141430] rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-white text-sm font-semibold w-28 text-right">{formatYen(amount)}</span>
      <span className="text-[#9090bb] text-xs w-12 text-right">{pct.toFixed(0)}%</span>
    </div>
  )
}

function CategoryPanel({ title, rows, accent, barColor }: {
  title: string
  rows: { category: string; count: number; total: number }[]
  accent: string
  barColor: string
}) {
  const max = rows[0]?.total || 1
  return (
    <div className="bg-[#141430] rounded-xl border border-[#2e2e50] p-5">
      <h3 className="text-xs font-semibold text-[#9090bb] tracking-widest uppercase mb-4">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-[#3a3a5e]">記録なし</p>
      ) : (
        <div className="space-y-3">
          {rows.map(r => (
            <div key={r.category} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#9090bb]">
                  {r.category}
                  <span className="text-[#3a3a5e] ml-2">{r.count}件</span>
                </span>
                <span className={`font-medium ${accent}`}>{formatYen(r.total)}</span>
              </div>
              <div className="h-1.5 bg-[#0f0f28] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${Math.round((r.total / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[#0f0f28] border border-[#2e2e50] rounded-2xl p-6 w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
