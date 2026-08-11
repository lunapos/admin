import { useState, useEffect, useMemo } from 'react'
import { Download, ScrollText } from 'lucide-react'
import { supabase, requireTenantId } from '../lib/supabase'
import type { AuditLogRow } from '../types'

// 操作種別のラベル・色（DB の action 値に対応）
const ACTION_META: Record<string, { label: string; cls: string }> = {
  checkout: { label: '会計確定', cls: 'bg-emerald-900/30 border-emerald-700/50 text-emerald-300' },
  cancel: { label: '会計取消', cls: 'bg-red-900/30 border-red-700/50 text-red-300' },
  discount: { label: '割引適用', cls: 'bg-amber-900/30 border-amber-700/50 text-amber-300' },
  price_override: { label: '価格変更', cls: 'bg-amber-900/30 border-amber-700/50 text-amber-300' },
  create: { label: '注文追加', cls: 'bg-sky-900/30 border-sky-700/50 text-sky-300' },
  delete: { label: '注文削除', cls: 'bg-rose-900/30 border-rose-700/50 text-rose-300' },
  update: { label: '更新', cls: 'bg-sky-900/30 border-sky-700/50 text-sky-300' },
  clock_in: { label: '出勤打刻', cls: 'bg-violet-900/30 border-violet-700/50 text-violet-300' },
  clock_out: { label: '退勤打刻', cls: 'bg-violet-900/30 border-violet-700/50 text-violet-300' },
  settings_change: { label: '設定変更', cls: 'bg-[#0f0f28] border-[#2e2e50] text-[#9090bb]' },
}

const TABLE_LABELS: Record<string, string> = {
  payments: '会計',
  order_items: '注文',
  visits: '来店',
  cast_shifts: '出退勤',
  menu_items: 'メニュー',
  rooms: 'ルーム',
  casts: 'キャスト',
  floor_tables: 'テーブル',
  stores: '店舗設定',
  nominations: '指名・同伴',
  cast_sales: 'キャスト売上の配分',
  cash_withdrawals: '入出金',
}

function actionMeta(action: string) {
  return ACTION_META[action] ?? { label: action, cls: 'bg-[#0f0f28] border-[#2e2e50] text-[#9090bb]' }
}

function formatValue(v: Record<string, unknown> | null): string {
  if (!v || Object.keys(v).length === 0) return '—'
  return Object.entries(v).map(([k, val]) => `${k}: ${val}`).join(' / ')
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // フィルタ
  const [days, setDays] = useState(7) // 直近N日
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [keyword, setKeyword] = useState('')

  useEffect(() => { fetchLogs() }, [days])

  async function fetchLogs() {
    setLoading(true)
    setFetchError(null)
    try {
      const tid = requireTenantId()
      const since = new Date()
      since.setDate(since.getDate() - days)
      const { data, error } = await supabase.from('audit_logs')
        .select('id, tenant_id, user_id, action, target_table, target_id, old_value, new_value, ip_address, created_at')
        .eq('tenant_id', tid)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(1000)
      if (error) throw new Error(error.message)
      setLogs((data || []) as AuditLogRow[])
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'データの取得に失敗しました。ページを再読み込みしてください。')
    }
    setLoading(false)
  }

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (actionFilter !== 'all' && l.action !== actionFilter) return false
      if (keyword) {
        const hay = [l.action, l.target_table, l.user_id ?? '',
          formatValue(l.old_value), formatValue(l.new_value)].join(' ').toLowerCase()
        if (!hay.includes(keyword.toLowerCase())) return false
      }
      return true
    })
  }, [logs, actionFilter, keyword])

  // フィルタUI用に、ログに実在する action 種別を抽出
  const availableActions = useMemo(() => {
    const set = new Set(logs.map(l => l.action))
    return Array.from(set)
  }, [logs])

  function exportCsv() {
    const header = ['日時', '操作', '対象', '対象ID', '操作者', '変更前', '変更後']
    const rows = filtered.map(l => [
      new Date(l.created_at).toLocaleString('ja-JP'),
      actionMeta(l.action).label,
      TABLE_LABELS[l.target_table] ?? l.target_table,
      l.target_id ?? '',
      l.user_id ?? '不明',
      formatValue(l.old_value),
      formatValue(l.new_value),
    ])
    const csv = [header, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ScrollText size={20} className="text-[#d4b870]" />
          <h2 className="text-xl font-bold text-white">操作ログ</h2>
        </div>
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#d4b870] text-black font-bold text-sm disabled:opacity-40"
        >
          <Download size={16} />CSVエクスポート
        </button>
      </div>

      <p className="text-sm text-[#9090bb]">
        POS端末での会計・割引・価格変更・注文・指名変更・出退勤打刻・設定変更、および管理画面でのキャスト売上の配分調整の記録です。不正やミスの確認にお使いいただけます。
      </p>
      <p className="text-xs text-[#3a3a5e]">
        ※ 操作者は、POSからの操作は端末名（POSは店舗単位の端末認証のため、個人までは特定できません）、管理画面からの操作はログイン中のアカウントを記録しています。
      </p>

      {/* フィルタ */}
      <div className="bg-[#141430] rounded-xl border border-[#2e2e50] p-4 flex flex-wrap items-center gap-3">
        <select
          value={days}
          onChange={e => setDays(Number(e.target.value))}
          className="px-3 py-2 rounded-lg bg-[#0f0f28] border border-[#2e2e50] text-sm text-white"
        >
          <option value={1}>直近1日</option>
          <option value={7}>直近7日</option>
          <option value={30}>直近30日</option>
          <option value={90}>直近90日</option>
        </select>

        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[#0f0f28] border border-[#2e2e50] text-sm text-white"
        >
          <option value="all">すべての操作</option>
          {availableActions.map(a => (
            <option key={a} value={a}>{actionMeta(a).label}</option>
          ))}
        </select>

        <input
          type="text"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          placeholder="キーワード検索（金額・テーブル名など）"
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-[#0f0f28] border border-[#2e2e50] text-sm text-white placeholder-[#3a3a5e]"
        />

        <span className="text-xs text-[#9090bb]">{filtered.length}件</span>
      </div>

      {fetchError && (
        <div className="bg-red-900/40 border border-red-500/50 rounded-xl px-4 py-3 text-red-300 text-sm">
          {fetchError}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-[#9090bb]">読み込み中...</div>
      ) : (
        <div className="bg-[#141430] rounded-xl border border-[#2e2e50] divide-y divide-[#2e2e50]">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-[#3a3a5e] text-sm">該当する操作ログがありません</div>
          ) : (
            filtered.map(l => {
              const meta = actionMeta(l.action)
              return (
                <div key={l.id} className="flex items-start gap-4 px-5 py-3.5">
                  <div className="w-32 shrink-0 text-xs text-[#9090bb] pt-0.5">
                    {new Date(l.created_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                    {' '}
                    {new Date(l.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <span className={`shrink-0 text-xs px-2.5 py-1 rounded-lg border ${meta.cls}`}>
                    {meta.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white">
                      {TABLE_LABELS[l.target_table] ?? l.target_table}
                    </div>
                    {(l.old_value || l.new_value) && (
                      <div className="text-xs text-[#9090bb] mt-0.5 break-words">
                        {l.old_value && <span className="text-rose-400/80">前: {formatValue(l.old_value)}　</span>}
                        {l.new_value && <span className="text-emerald-400/80">後: {formatValue(l.new_value)}</span>}
                      </div>
                    )}
                  </div>
                  <div className="w-28 shrink-0 text-right text-xs text-[#3a3a5e] pt-0.5 break-words">
                    {l.user_id || '不明'}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
