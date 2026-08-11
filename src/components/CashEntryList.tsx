import { ArrowDownCircle, ArrowUpCircle, Trash2 } from 'lucide-react'
import { formatYen } from '../lib/dashboard'
import { jstDateOf } from '../lib/cashEntries'
import type { CashWithdrawalRow } from '../types'

/**
 * 入出金の一覧表示（レジ金管理の日次・期間の両方で使う共通コンポーネント）
 * showDateHeaders=true で日付ごとに区切って差引を表示する
 */
export default function CashEntryList({
  entries,
  readOnly = false,
  showDateHeaders = false,
  deletingId,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  entries: CashWithdrawalRow[]
  readOnly?: boolean
  showDateHeaders?: boolean
  deletingId: string | null
  onRequestDelete: (id: string) => void
  onConfirmDelete: (id: string) => void
  onCancelDelete: () => void
}) {
  if (!showDateHeaders) {
    return (
      <div className="divide-y divide-[#2e2e50]">
        {entries.map(e => (
          <CashEntryRow
            key={e.id}
            entry={e}
            readOnly={readOnly}
            isDeleting={deletingId === e.id}
            onRequestDelete={onRequestDelete}
            onConfirmDelete={onConfirmDelete}
            onCancelDelete={onCancelDelete}
          />
        ))}
      </div>
    )
  }

  // 日付ごとにグループ化（新しい日付が上）
  const groups = new Map<string, CashWithdrawalRow[]>()
  for (const e of entries) {
    const d = jstDateOf(e.created_at)
    const list = groups.get(d) ?? []
    list.push(e)
    groups.set(d, list)
  }
  const sorted = [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]))

  return (
    <div className="divide-y divide-[#2e2e50]">
      {sorted.map(([date, rows]) => {
        const dayNet = rows.reduce((s, r) => s + (r.entry_type === 'deposit' ? r.amount : -r.amount), 0)
        return (
          <div key={date}>
            <div className="flex items-center justify-between px-5 py-2 bg-[#0f0f28]">
              <span className="text-xs text-[#9090bb]">
                {new Date(`${date}T00:00:00+09:00`).toLocaleDateString('ja-JP', {
                  month: 'long', day: 'numeric', weekday: 'short',
                })}
              </span>
              <span className={`text-xs font-medium ${dayNet < 0 ? 'text-red-400' : 'text-green-400'}`}>
                差引 {dayNet < 0 ? '−' : '+'}{formatYen(Math.abs(dayNet))}
              </span>
            </div>
            {rows.map(e => (
              <CashEntryRow
                key={e.id}
                entry={e}
                readOnly={readOnly}
                isDeleting={deletingId === e.id}
                onRequestDelete={onRequestDelete}
                onConfirmDelete={onConfirmDelete}
                onCancelDelete={onCancelDelete}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}

function CashEntryRow({
  entry: e,
  readOnly,
  isDeleting,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  entry: CashWithdrawalRow
  readOnly: boolean
  isDeleting: boolean
  onRequestDelete: (id: string) => void
  onConfirmDelete: (id: string) => void
  onCancelDelete: () => void
}) {
  const isDeposit = e.entry_type === 'deposit'
  return (
    <div className="flex items-center gap-3 px-5 py-3 hover:bg-[#0f0f28] transition-colors">
      {isDeposit ? (
        <ArrowDownCircle size={16} className="text-green-400 shrink-0" />
      ) : (
        <ArrowUpCircle size={16} className="text-red-400 shrink-0" />
      )}

      <span className="text-xs text-[#9090bb] w-12 shrink-0">
        {new Date(e.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {e.category ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#0f0f28] border border-[#2e2e50] text-[#9090bb] shrink-0">
              {e.category}
            </span>
          ) : (
            <span className="text-xs text-[#3a3a5e] shrink-0">未分類</span>
          )}
          {e.note && <span className="text-xs text-[#9090bb] truncate">{e.note}</span>}
        </div>
      </div>

      <span className={`text-sm font-bold shrink-0 ${isDeposit ? 'text-green-400' : 'text-red-400'}`}>
        {isDeposit ? '+' : '−'}{formatYen(e.amount)}
      </span>

      {!readOnly && (
        isDeleting ? (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onConfirmDelete(e.id)}
              className="px-2 py-1 rounded text-[10px] bg-red-900/30 text-red-400 hover:bg-red-900/50"
            >
              取り消す
            </button>
            <button
              onClick={onCancelDelete}
              className="px-2 py-1 rounded text-[10px] text-[#9090bb] hover:text-white"
            >
              やめる
            </button>
          </div>
        ) : (
          <button
            onClick={() => onRequestDelete(e.id)}
            className="p-1 rounded text-[#3a3a5e] hover:text-red-400 hover:bg-red-900/20 transition-colors shrink-0"
            title="取り消す（記録は残ります）"
          >
            <Trash2 size={13} />
          </button>
        )
      )}
    </div>
  )
}
