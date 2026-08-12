// 1会計のキャストバックを編集するコンポーネント。
//
// バックはメニューの設定（率 or 絶対額）から自動生成され、本指名のキャストに
// 指名数で按分される。「この卓のこのボトルはAちゃんの分」のように実態と違う場合に
// ここで個別に直せる。
//
// 売上配分（CastSalesAllocator）と違い、バックは店の支出なので
// 「合計 = 売上」のような制約はない。金額はそのまま入力した値になる。

import { useState, useEffect, useMemo } from 'react'
import { Plus, X, Check, Pencil } from 'lucide-react'
import { supabase, requireTenantId } from '../lib/supabase'
import { writeAuditLog } from '../lib/auditLog'
import { formatYen } from '../lib/dashboard'
import type { CastRow, CastBackRow } from '../types'

interface Props {
  visitId: string
  paymentId: string
  casts: CastRow[]
  onSaved?: () => void
}

/** 編集中の1行 */
interface BackRow {
  castId: string
  menuItemName: string
  orderItemId: string | null
  amount: number
}

export default function CastBackEditor({ visitId, paymentId, casts, onSaved }: Props) {
  const [saved, setSaved] = useState<CastBackRow[]>([])
  const [rows, setRows] = useState<BackRow[]>([])
  const [note, setNote] = useState('')
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const castMap = useMemo(() => new Map(casts.map(c => [c.id, c])), [casts])

  useEffect(() => {
    let cancelled = false
    async function fetchBacks() {
      setLoading(true)
      try {
        const tid = requireTenantId()
        const { data } = await supabase.from('cast_backs')
          .select('id, tenant_id, visit_id, payment_id, cast_id, order_item_id, menu_item_name, amount, is_adjusted, adjusted_by, adjusted_at, note, created_at, updated_at')
          .eq('tenant_id', tid)
          .eq('visit_id', visitId)
        if (cancelled) return
        const list = (data || []) as CastBackRow[]
        setSaved(list)
        setRows(list.map(b => ({
          castId: b.cast_id,
          menuItemName: b.menu_item_name,
          orderItemId: b.order_item_id,
          amount: b.amount,
        })))
        setNote(list.find(b => b.note)?.note ?? '')
      } catch {
        if (!cancelled) setError('バックの取得に失敗しました')
      }
      if (!cancelled) setLoading(false)
    }
    fetchBacks()
    return () => { cancelled = true }
  }, [visitId])

  const total = rows.reduce((s, r) => s + r.amount, 0)
  const savedTotal = saved.reduce((s, r) => s + r.amount, 0)
  const isAdjusted = saved.some(b => b.is_adjusted)

  function updateAmount(index: number, value: string) {
    const parsed = Math.max(0, Number(value) || 0)
    setRows(rs => rs.map((r, i) => (i === index ? { ...r, amount: parsed } : r)))
  }

  function updateCast(index: number, castId: string) {
    setRows(rs => rs.map((r, i) => (i === index ? { ...r, castId } : r)))
  }

  function handleAddRow() {
    const first = casts[0]
    if (!first) return
    setRows(rs => [...rs, { castId: first.id, menuItemName: '', orderItemId: null, amount: 0 }])
  }

  function handleRemoveRow(index: number) {
    setRows(rs => rs.filter((_, i) => i !== index))
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const tid = requireTenantId()
      const before = saved.map(b => ({
        cast: castMap.get(b.cast_id)?.stage_name ?? b.cast_id,
        item: b.menu_item_name,
        amount: b.amount,
      }))
      const after = rows.map(r => ({
        cast: castMap.get(r.castId)?.stage_name ?? r.castId,
        item: r.menuItemName,
        amount: r.amount,
      }))

      const { error: delErr } = await supabase.from('cast_backs')
        .delete().eq('tenant_id', tid).eq('visit_id', visitId)
      if (delErr) throw delErr

      const now = new Date().toISOString()
      const { data: userData } = await supabase.auth.getUser()
      const actor = userData?.user?.email ?? userData?.user?.id ?? null

      // 0円の行は保存しない（自動生成側と揃える）
      const payload = rows.filter(r => r.amount > 0).map(r => ({
        tenant_id: tid,
        visit_id: visitId,
        payment_id: paymentId,
        cast_id: r.castId,
        order_item_id: r.orderItemId,
        menu_item_name: r.menuItemName,
        amount: r.amount,
        is_adjusted: true,
        adjusted_by: actor,
        adjusted_at: now,
        note: note || null,
      }))

      let inserted: CastBackRow[] = []
      if (payload.length > 0) {
        const { data, error: insErr } = await supabase.from('cast_backs').insert(payload)
          .select('id, tenant_id, visit_id, payment_id, cast_id, order_item_id, menu_item_name, amount, is_adjusted, adjusted_by, adjusted_at, note, created_at, updated_at')
        if (insErr) throw insErr
        inserted = (data || []) as CastBackRow[]
      }

      await writeAuditLog({
        action: 'update',
        targetTable: 'cast_backs',
        targetId: visitId,
        oldValue: { backs: before, total: savedTotal },
        newValue: { backs: after, total, note: note || null },
      })

      setSaved(inserted)
      setEditing(false)
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'バックの保存に失敗しました')
    }
    setSaving(false)
  }

  function cancel() {
    setRows(saved.map(b => ({
      castId: b.cast_id,
      menuItemName: b.menu_item_name,
      orderItemId: b.order_item_id,
      amount: b.amount,
    })))
    setNote(saved.find(b => b.note)?.note ?? '')
    setEditing(false)
    setError(null)
  }

  if (loading) {
    return <div className="text-[10px] text-[#3a3a5e]">バックを読み込み中...</div>
  }

  // バック設定のある商品が無いか、本指名がつかなかった会計
  if (saved.length === 0 && !editing) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#3a3a5e]">キャストバックなし</span>
        <button
          onClick={() => setEditing(true)}
          className="text-[10px] text-[#d4b870] hover:underline flex items-center gap-1"
        >
          <Pencil size={10} /> 手動で追加
        </button>
      </div>
    )
  }

  if (!editing) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#9090bb]">
            キャストバック 計 {formatYen(savedTotal)}
            {isAdjusted && <span className="text-[#d4b870]">（手動調整済み）</span>}
          </span>
          <button
            onClick={() => setEditing(true)}
            className="text-[10px] text-[#d4b870] hover:underline flex items-center gap-1"
          >
            <Pencil size={10} /> 修正
          </button>
        </div>
        {saved.map(b => (
          <div key={b.id} className="flex items-center justify-between text-[10px] text-[#9090bb] pl-2">
            <span>
              {castMap.get(b.cast_id)?.stage_name ?? b.cast_id}
              {b.menu_item_name && <span className="text-[#3a3a5e]">　{b.menu_item_name}</span>}
            </span>
            <span className="text-[#d4b870]">{formatYen(b.amount)}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="text-[10px] text-[#9090bb]">キャストバックの修正</div>

      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            value={r.castId}
            onChange={e => updateCast(i, e.target.value)}
            className="flex-1 bg-[#0f0f28] border border-[#2e2e50] rounded-lg px-2 py-1 text-[10px] text-white outline-none"
          >
            {casts.map(c => <option key={c.id} value={c.id}>{c.stage_name}</option>)}
          </select>
          <span className="text-[10px] text-[#3a3a5e] w-24 truncate">{r.menuItemName || '—'}</span>
          <input
            type="number"
            value={r.amount}
            onChange={e => updateAmount(i, e.target.value)}
            className="w-20 bg-[#0f0f28] border border-[#2e2e50] rounded-lg px-2 py-1 text-[10px] text-white text-right outline-none"
            min="0"
          />
          <button onClick={() => handleRemoveRow(i)} className="text-[#9090bb] hover:text-red-400">
            <X size={12} />
          </button>
        </div>
      ))}

      <div className="flex items-center justify-between">
        <button
          onClick={handleAddRow}
          className="text-[10px] text-[#d4b870] hover:underline flex items-center gap-1"
        >
          <Plus size={10} /> 行を追加
        </button>
        <span className="text-[10px] text-[#9090bb]">計 {formatYen(total)}</span>
      </div>

      <input
        type="text"
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="修正の理由（任意）"
        className="w-full bg-[#0f0f28] border border-[#2e2e50] rounded-lg px-2 py-1 text-[10px] text-white placeholder-[#3a3a5e] outline-none"
      />

      {error && <div className="text-[10px] text-red-400">{error}</div>}

      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="text-[10px] px-3 py-1 rounded-lg bg-[#d4b870] text-black font-bold disabled:opacity-30 flex items-center gap-1"
        >
          <Check size={10} /> {saving ? '保存中...' : '保存'}
        </button>
        <button onClick={cancel} className="text-[10px] text-[#9090bb] hover:underline">
          キャンセル
        </button>
      </div>
    </div>
  )
}
