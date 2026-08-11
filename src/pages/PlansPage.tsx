import { useState, useEffect } from 'react'
import { Plus, Pencil, X, Check } from 'lucide-react'
import { supabase, requireTenantId } from '../lib/supabase'
import type { SetPlanRow } from '../types'

const EMPTY_FORM = { name: '', duration_minutes: '60', price: '' }

export default function PlansPage() {
  const [plans, setPlans] = useState<SetPlanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => { fetchPlans() }, [])

  async function fetchPlans() {
    setLoading(true)
    setFetchError(null)
    try {
      const tid = requireTenantId()
      const { data, error } = await supabase.from('set_plans')
        .select('id, tenant_id, name, duration_minutes, price, is_active, created_at, updated_at')
        .eq('tenant_id', tid)
        .order('duration_minutes', { ascending: true })
      if (error) throw new Error(error.message)
      setPlans((data || []) as SetPlanRow[])
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'データの取得に失敗しました。ページを再読み込みしてください。')
    }
    setLoading(false)
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2000) }

  async function handleSave() {
    const price = parseInt(form.price)
    const duration = parseInt(form.duration_minutes)
    if (!form.name.trim() || isNaN(price) || price < 0 || isNaN(duration) || duration <= 0) return
    setSaving(true)
    try {
      const tid = requireTenantId()
      if (editingId) {
        const { error } = await supabase.from('set_plans').update({
          name: form.name.trim(), duration_minutes: duration, price,
          updated_at: new Date().toISOString(),
        }).eq('id', editingId).eq('tenant_id', tid)
        if (error) throw new Error(error.message)
        showToast('セットプランを更新しました')
      } else {
        const { error } = await supabase.from('set_plans').insert({
          tenant_id: tid, name: form.name.trim(), duration_minutes: duration, price, is_active: true,
        })
        if (error) throw new Error(error.message)
        showToast('セットプランを追加しました')
      }
      setForm(EMPTY_FORM); setShowForm(false); setEditingId(null)
      fetchPlans()
    } catch (e) {
      alert(e instanceof Error ? e.message : '保存に失敗しました')
    }
    setSaving(false)
  }

  async function toggleActive(plan: SetPlanRow) {
    try {
      const tid = requireTenantId()
      const { error } = await supabase.from('set_plans').update({
        is_active: !plan.is_active, updated_at: new Date().toISOString(),
      }).eq('id', plan.id).eq('tenant_id', tid)
      if (error) throw new Error(error.message)
      showToast(plan.is_active ? '無効にしました' : '有効にしました')
      fetchPlans()
    } catch (e) {
      alert(e instanceof Error ? e.message : '更新に失敗しました')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">セットプラン管理</h1>
        <button onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM) }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#d4b870] text-black font-bold text-sm">
          <Plus size={16} />プラン追加
        </button>
      </div>

      {showForm && (
        <div className="bg-[#141430] border border-[#2e2e50] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm text-[#d4b870] tracking-widest uppercase font-semibold">
              {editingId ? 'プラン編集' : '新規プラン'}
            </h3>
            <button onClick={() => { setShowForm(false); setEditingId(null) }} className="text-[#9090bb]"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <input type="text" placeholder="プラン名 *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-4 py-3 text-white placeholder-[#3a3a5e] outline-none focus:border-[#d4b870]/50" />
            <input type="number" placeholder="時間（分）*" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}
              className="bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-4 py-3 text-white placeholder-[#3a3a5e] outline-none focus:border-[#d4b870]/50" min="1" />
            <input type="number" placeholder="料金（税込）*" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
              className="bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-4 py-3 text-white placeholder-[#3a3a5e] outline-none focus:border-[#d4b870]/50" min="0" />
          </div>
          <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.price}
            className="px-6 py-3 rounded-xl bg-[#d4b870] text-black font-bold disabled:opacity-30">
            {saving ? '保存中...' : editingId ? '更新' : '追加'}
          </button>
        </div>
      )}

      {fetchError && (
        <div className="bg-red-900/40 border border-red-500/50 rounded-xl px-4 py-3 text-red-300 text-sm">
          {fetchError}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-[#9090bb]">読み込み中...</div>
      ) : (
        <div className="bg-[#141430] rounded-xl border border-[#2e2e50] divide-y divide-[#2e2e50]">
          {plans.length === 0 ? (
            <div className="text-center py-10 text-[#3a3a5e] text-sm">セットプランがありません</div>
          ) : plans.map(plan => (
            <div key={plan.id} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${plan.is_active ? 'text-white' : 'text-[#9090bb] line-through'}`}>{plan.name}</div>
                <div className="text-xs text-[#9090bb] mt-0.5">{plan.duration_minutes}分</div>
              </div>
              <div className="text-[#d4b870] font-bold">¥{plan.price.toLocaleString()}</div>
              <button onClick={() => toggleActive(plan)}
                className={`text-xs px-3 py-1.5 rounded-lg border ${
                  plan.is_active ? 'bg-emerald-900/20 border-emerald-800/50 text-emerald-400' : 'bg-[#0f0f28] border-[#2e2e50] text-[#9090bb]'
                }`}>
                {plan.is_active ? '有効' : '無効'}
              </button>
              <button onClick={() => {
                setEditingId(plan.id)
                setForm({ name: plan.name, duration_minutes: String(plan.duration_minutes), price: String(plan.price) })
                setShowForm(true)
              }} className="p-2 rounded-lg bg-[#0f0f28] text-[#9090bb] hover:text-[#d4b870]"><Pencil size={14} /></button>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-emerald-900/90 border border-emerald-700 text-emerald-300 px-4 py-3 rounded-xl text-sm flex items-center gap-2 shadow-lg z-50">
          <Check size={16} />{toast}
        </div>
      )}
    </div>
  )
}
