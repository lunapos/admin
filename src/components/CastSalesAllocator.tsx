// 1会計のキャスト売上配分を編集するコンポーネント。
//
// 「この卓はAちゃん6割、Bちゃん残り」という分け方に対応する。
// 配分の合計は元の売上（payments.subtotal）と必ず一致させ、
// 一致しない限り保存できない。会計そのもの（元の売上）は変更しない。

import { useState, useEffect, useMemo } from 'react'
import { Plus, X, Check, Pencil } from 'lucide-react'
import { supabase, requireTenantId } from '../lib/supabase'
import { writeAuditLog } from '../lib/auditLog'
import { formatYen } from '../lib/dashboard'
import { allocate, splitEvenly, addRow, removeRow } from '../lib/castAllocation'
import type { AllocationRow } from '../lib/castAllocation'
import type { CastRow, CastSaleRow } from '../types'

interface Props {
  visitId: string
  paymentId: string
  /** 配分対象の総額（payments.subtotal） */
  subtotal: number
  casts: CastRow[]
  /** 保存後に呼ばれる（親側で再取得する用） */
  onSaved?: () => void
}

export default function CastSalesAllocator({ visitId, paymentId, subtotal, casts, onSaved }: Props) {
  const [saved, setSaved] = useState<CastSaleRow[]>([])
  const [rows, setRows] = useState<AllocationRow[]>([])
  const [note, setNote] = useState('')
  // 金額欄の入力中の値。確定するまで他の行を動かさないために保持する
  const [draft, setDraft] = useState<{ index: number; value: string } | null>(null)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const castMap = useMemo(() => new Map(casts.map(c => [c.id, c])), [casts])

  useEffect(() => {
    let cancelled = false
    async function fetchAllocation() {
      setLoading(true)
      try {
        const tid = requireTenantId()
        const { data } = await supabase.from('cast_sales')
          .select('id, tenant_id, visit_id, payment_id, cast_id, amount, is_adjusted, adjusted_by, adjusted_at, note, created_at, updated_at')
          .eq('tenant_id', tid)
          .eq('visit_id', visitId)
        if (cancelled) return
        const list = (data || []) as CastSaleRow[]
        setSaved(list)
        setRows(list.map(cs => ({ castId: cs.cast_id, amount: cs.amount })))
        setNote(list.find(cs => cs.note)?.note ?? '')
      } catch {
        if (!cancelled) setError('配分の取得に失敗しました')
      }
      if (!cancelled) setLoading(false)
    }
    fetchAllocation()
    return () => { cancelled = true }
  }, [visitId])

  const allocated = rows.reduce((s, r) => s + r.amount, 0)
  const diff = subtotal - allocated
  const isAdjusted = saved.some(cs => cs.is_adjusted)

  /** 金額欄の入力を確定し、残額を他の行へ振り分ける */
  function commitDraft(index: number) {
    const raw = draft?.index === index ? draft.value : null
    setDraft(null)
    if (raw === null) return
    const parsed = Number(raw)
    if (raw.trim() === '' || Number.isNaN(parsed)) return
    setRows(rs => allocate(rs, index, parsed, subtotal))
  }

  /** ％入力: 指定行を subtotal の percent% にし、残額を他の行へ自動で振り分ける */
  function updatePercent(index: number, percent: number) {
    const clamped = Math.min(100, Math.max(0, percent))
    setRows(rs => allocate(rs, index, Math.round((subtotal * clamped) / 100), subtotal))
  }

  function handleSplitEvenly() {
    setDraft(null)
    setRows(rs => splitEvenly(rs, subtotal))
  }

  function handleAddRow(castId: string) {
    setDraft(null)
    setRows(rs => addRow(rs, castId, subtotal))
  }

  function handleRemoveRow(index: number) {
    setDraft(null)
    setRows(rs => removeRow(rs, index, subtotal))
  }

  async function save() {
    if (diff !== 0) return
    if (rows.length === 0) return
    setSaving(true)
    setError(null)
    try {
      const tid = requireTenantId()
      const before = saved.map(cs => ({
        cast: castMap.get(cs.cast_id)?.stage_name ?? cs.cast_id,
        amount: cs.amount,
      }))
      const after = rows.map(r => ({
        cast: castMap.get(r.castId)?.stage_name ?? r.castId,
        amount: r.amount,
      }))

      // 配分を入れ替える（会計そのものは変更しない）
      const { error: delErr } = await supabase.from('cast_sales')
        .delete().eq('tenant_id', tid).eq('visit_id', visitId)
      if (delErr) throw delErr

      const now = new Date().toISOString()
      const { data: userData } = await supabase.auth.getUser()
      const actor = userData?.user?.email ?? userData?.user?.id ?? null

      const { data: inserted, error: insErr } = await supabase.from('cast_sales').insert(
        rows.map(r => ({
          tenant_id: tid,
          visit_id: visitId,
          payment_id: paymentId,
          cast_id: r.castId,
          amount: r.amount,
          is_adjusted: true,
          adjusted_by: actor,
          adjusted_at: now,
          note: note || null,
        })),
      ).select('id, tenant_id, visit_id, payment_id, cast_id, amount, is_adjusted, adjusted_by, adjusted_at, note, created_at, updated_at')
      if (insErr) throw insErr

      await writeAuditLog({
        action: 'update',
        targetTable: 'cast_sales',
        targetId: visitId,
        oldValue: { subtotal, allocation: before },
        newValue: { subtotal, allocation: after, note: note || null },
      })

      setSaved((inserted || []) as CastSaleRow[])
      setEditing(false)
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : '配分の保存に失敗しました')
    }
    setSaving(false)
  }

  function cancel() {
    setRows(saved.map(cs => ({ castId: cs.cast_id, amount: cs.amount })))
    setNote(saved.find(cs => cs.note)?.note ?? '')
    setEditing(false)
    setError(null)
  }

  if (loading) {
    return <div className="text-[10px] text-[#3a3a5e]">配分を読み込み中...</div>
  }

  // 本指名がつかなかった会計は配分対象外
  if (saved.length === 0 && !editing) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[#3a3a5e]">
          キャスト売上の配分なし
          <span className="ml-1 text-[#2e2e50]">|</span>
          <span className="ml-1">本指名がないため自動配分されていません</span>
        </span>
        <button
          onClick={() => setEditing(true)}
          className="text-[11px] text-[#9090bb] hover:text-[#d4b870] flex items-center gap-1"
        >
          <Plus size={11} />手動で配分する
        </button>
      </div>
    )
  }

  const availableCasts = casts.filter(c => !rows.some(r => r.castId === c.id))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[#9090bb] tracking-widest uppercase">
          キャスト売上の配分
          {isAdjusted && (
            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] text-[#d4b870] bg-[#d4b870]/10 border border-[#d4b870]/30">
              手動で調整済み
            </span>
          )}
        </span>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-[11px] text-[#9090bb] hover:text-[#d4b870] flex items-center gap-1"
          >
            <Pencil size={11} />配分を変更
          </button>
        )}
      </div>

      {/* 何を分けているのかが分からないという声があったため明示する */}
      <div className="flex justify-between text-[11px] text-[#3a3a5e] pb-1">
        <span>配分するのは小計（サービス料・消費税を除いた金額）</span>
        <span className="text-[#9090bb]">{formatYen(subtotal)}</span>
      </div>

      {!editing ? (
        <div className="space-y-1">
          {saved.map(cs => {
            const pct = subtotal > 0 ? Math.round((cs.amount / subtotal) * 100) : 0
            return (
              <div key={cs.id} className="space-y-1">
                <div className="flex justify-between text-[12px] text-white">
                  <span>{castMap.get(cs.cast_id)?.stage_name ?? '（退店キャスト）'}</span>
                  <span>
                    {formatYen(cs.amount)}
                    <span className="ml-2 text-[11px] text-[#9090bb]">{pct}%</span>
                  </span>
                </div>
                {/* 割合を目で見て分かるようにする */}
                <div className="h-1 bg-[#2e2e50] rounded overflow-hidden">
                  <div className="h-full bg-[#d4b870]" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
          {saved.some(cs => cs.note) && (
            <div className="text-[10px] text-[#3a3a5e] pt-1">
              理由: {saved.find(cs => cs.note)?.note}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] text-[#3a3a5e]">
            スライダーか数値で割合を決めると、残りは他のキャストへ自動で振り分けます。
          </p>

          {rows.map((r, i) => (
            <div key={r.castId} className="space-y-1 pb-2">
              <div className="flex items-center gap-2">
              <span className="flex-1 truncate text-[12px] text-white">
                {castMap.get(r.castId)?.stage_name ?? '（退店キャスト）'}
              </span>
              {/*
                入力中は draft を表示し、確定（blur / Enter）で再配分する。
                打鍵ごとに再配分すると "15000" を打つ途中の "1" "15" で
                他の行が動いてしまい入力しづらいため。
              */}
              <input
                type="number"
                value={draft?.index === i ? draft.value : String(r.amount)}
                min={0}
                onFocus={() => setDraft({ index: i, value: String(r.amount) })}
                onChange={e => setDraft({ index: i, value: e.target.value })}
                onBlur={() => commitDraft(i)}
                onKeyDown={e => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') { setDraft(null); e.currentTarget.blur() }
                }}
                className="w-24 bg-[#141430] border border-[#2e2e50] rounded px-2 py-1 text-right text-white outline-none focus:border-[#d4b870]/50"
              />
              <span className="text-[#3a3a5e]">円</span>
              <input
                type="number"
                value={subtotal > 0 ? Math.round((r.amount / subtotal) * 100) : 0}
                min={0}
                max={100}
                onChange={e => updatePercent(i, Number(e.target.value))}
                className="w-14 bg-[#141430] border border-[#2e2e50] rounded px-2 py-1 text-right text-white outline-none focus:border-[#d4b870]/50"
              />
              <span className="text-[#3a3a5e]">%</span>
              <button
                onClick={() => handleRemoveRow(i)}
                className="p-1 text-[#3a3a5e] hover:text-red-400"
                title="この行を削除"
              >
                <X size={12} />
              </button>
              </div>
              {/* 数値入力より直感的に割合を決められるようにする */}
              <input
                type="range"
                min={0}
                max={100}
                value={subtotal > 0 ? Math.round((r.amount / subtotal) * 100) : 0}
                onChange={e => updatePercent(i, Number(e.target.value))}
                className="w-full accent-[#d4b870]"
              />
            </div>
          ))}

          <div className="flex items-center gap-2 flex-wrap">
            {availableCasts.length > 0 && (
              <select
                value=""
                onChange={e => handleAddRow(e.target.value)}
                className="bg-[#141430] border border-[#2e2e50] rounded px-2 py-1 text-[#9090bb] outline-none"
              >
                <option value="">+ キャストを追加</option>
                {availableCasts.map(c => (
                  <option key={c.id} value={c.id}>{c.stage_name}</option>
                ))}
              </select>
            )}
            {rows.length > 1 && (
              <button
                onClick={handleSplitEvenly}
                className="px-2 py-1 rounded border border-[#2e2e50] text-[#9090bb] hover:border-[#d4b870]/50"
              >
                均等割り
              </button>
            )}
          </div>

          <div className="border-t border-[#2e2e50] pt-2 space-y-1">
            <div className="flex justify-between items-center text-[12px]">
              <span className="text-[#9090bb]">配分合計</span>
              <span className={diff === 0 ? 'text-[#d4b870] font-bold' : 'text-red-400 font-bold'}>
                {formatYen(allocated)} / {formatYen(subtotal)}
              </span>
            </div>
            {/* 一致しないと保存できないので、あといくらかを具体的に出す */}
            {diff === 0 ? (
              <p className="text-[11px] text-[#d4b870]">小計と一致しています。保存できます。</p>
            ) : (
              <p className="text-[11px] text-red-400">
                {diff > 0
                  ? `あと ${formatYen(diff)} 割り当ててください（保存できません）`
                  : `${formatYen(-diff)} 多く割り当てられています（保存できません）`}
              </p>
            )}
          </div>

          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="調整理由（任意・例: 途中でヘルプ交代のため）"
            className="w-full bg-[#141430] border border-[#2e2e50] rounded px-2 py-1 text-white outline-none focus:border-[#d4b870]/50 placeholder:text-[#3a3a5e]"
          />

          {error && <div className="text-[10px] text-red-400">{error}</div>}

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={diff !== 0 || saving || rows.length === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#d4b870] text-black font-medium disabled:bg-[#2e2e50] disabled:text-[#3a3a5e]"
            >
              <Check size={12} />{saving ? '保存中...' : '保存'}
            </button>
            <button
              onClick={cancel}
              disabled={saving}
              className="px-3 py-1.5 rounded border border-[#2e2e50] text-[#9090bb]"
            >
              キャンセル
            </button>
          </div>
          <p className="text-[10px] text-[#3a3a5e]">
            ※ 配分を変更しても会計（元の売上 {formatYen(subtotal)}）は変わりません
          </p>
        </div>
      )}
    </div>
  )
}
