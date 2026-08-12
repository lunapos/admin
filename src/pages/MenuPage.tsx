import { useState, useEffect } from 'react'
import { Plus, Pencil, X, Search, Check } from 'lucide-react'
import { supabase, requireTenantId } from '../lib/supabase'
import type { MenuItemRow, MenuCategory } from '../types'

const CATEGORIES: { id: MenuCategory; label: string }[] = [
  { id: 'drink', label: 'ドリンク' },
  { id: 'whisky', label: 'ウイスキー' },
  { id: 'shochu', label: '焼酎' },
  { id: 'champagne', label: 'シャンパン' },
  { id: 'red_wine', label: '赤ワイン' },
  { id: 'white_wine', label: '白ワイン' },
  { id: 'food', label: 'フード' },
  { id: 'ladies_drink', label: 'レディース' },
  { id: 'other', label: 'その他' },
]

const EMPTY_FORM = {
  name: '', price: '', category: 'drink' as MenuCategory, sort_order: '0',
  back_rate: '', back_amount: '',
}

export default function MenuPage() {
  const [items, setItems] = useState<MenuItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<MenuCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    setLoading(true)
    setFetchError(null)
    try {
      const tid = requireTenantId()
      const { data, error } = await supabase.from('menu_items')
        .select('id, tenant_id, name, price, category, is_active, sort_order, back_rate, back_amount, created_at, updated_at')
        .eq('tenant_id', tid)
        .order('sort_order', { ascending: true })
      if (error) throw new Error(error.message)
      setItems((data || []) as MenuItemRow[])
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'データの取得に失敗しました。ページを再読み込みしてください。')
    }
    setLoading(false)
  }

  const filtered = items
    .filter(i => activeTab === 'all' || i.category === activeTab)
    .filter(i => showInactive || i.is_active)
    .filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()))

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  async function handleSave() {
    const price = parseInt(form.price)
    if (!form.name.trim() || isNaN(price) || price < 0) return
    // バックは率・絶対額のどちらか。空欄なら未設定（バックなし）
    const backAmountValue = form.back_amount.trim() ? Math.max(0, parseInt(form.back_amount) || 0) : null
    const backRateValue = form.back_rate.trim() ? Math.min(1, Math.max(0, (parseFloat(form.back_rate) || 0) / 100)) : null
    setSaving(true)
    try {
      const tid = requireTenantId()
      if (editingId) {
        const { error } = await supabase.from('menu_items').update({
          name: form.name.trim(),
          price,
          category: form.category,
          sort_order: parseInt(form.sort_order) || 0,
          back_rate: backRateValue,
          back_amount: backAmountValue,
          updated_at: new Date().toISOString(),
        }).eq('id', editingId).eq('tenant_id', tid)
        if (error) throw new Error(error.message)
        showToast('メニューを更新しました')
      } else {
        const { error } = await supabase.from('menu_items').insert({
          tenant_id: tid,
          name: form.name.trim(),
          price,
          category: form.category,
          sort_order: parseInt(form.sort_order) || 0,
          back_rate: backRateValue,
          back_amount: backAmountValue,
          is_active: true,
        })
        if (error) throw new Error(error.message)
        showToast('メニューを追加しました')
      }
      setForm(EMPTY_FORM)
      setShowForm(false)
      setEditingId(null)
      fetchItems()
    } catch (e) {
      alert(e instanceof Error ? e.message : '保存に失敗しました')
    }
    setSaving(false)
  }

  async function toggleActive(item: MenuItemRow) {
    try {
      const tid = requireTenantId()
      const { error } = await supabase.from('menu_items').update({
        is_active: !item.is_active,
        updated_at: new Date().toISOString(),
      }).eq('id', item.id).eq('tenant_id', tid)
      if (error) throw new Error(error.message)
      showToast(item.is_active ? '提供を停止しました' : '提供を再開しました')
      fetchItems()
    } catch (e) {
      alert(e instanceof Error ? e.message : '更新に失敗しました')
    }
  }

  function startEdit(item: MenuItemRow) {
    setEditingId(item.id)
    setForm({
      name: item.name,
      price: String(item.price),
      category: item.category,
      sort_order: String(item.sort_order),
      back_rate: item.back_rate != null ? String(Math.round(item.back_rate * 100)) : '',
      back_amount: item.back_amount != null ? String(item.back_amount) : '',
    })
    setShowForm(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">メニュー管理</h1>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM) }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#d4b870] text-black font-bold text-sm"
        >
          <Plus size={16} />メニュー追加
        </button>
      </div>

      {/* 検索 + フィルタ */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-[#141430] border border-[#2e2e50] rounded-lg px-3 py-2 flex-1 min-w-[200px]">
          <Search size={14} className="text-[#9090bb]" />
          <input
            type="text"
            placeholder="メニュー名で検索"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-white text-sm outline-none flex-1 placeholder-[#3a3a5e]"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-[#9090bb] cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
            className="rounded"
          />
          停止中も表示
        </label>
      </div>

      {/* カテゴリタブ */}
      <div className="flex gap-1 bg-[#141430] rounded-xl border border-[#2e2e50] p-1">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'all' ? 'bg-[#d4b870] text-black' : 'text-[#9090bb]'}`}
        >
          全て
        </button>
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => setActiveTab(c.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === c.id ? 'bg-[#d4b870] text-black' : 'text-[#9090bb]'}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* 追加/編集フォーム */}
      {showForm && (
        <div className="bg-[#141430] border border-[#2e2e50] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm text-[#d4b870] tracking-widest uppercase font-semibold">
              {editingId ? 'メニュー編集' : '新規メニュー'}
            </h3>
            <button onClick={() => { setShowForm(false); setEditingId(null) }} className="text-[#9090bb]"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="商品名 *"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-4 py-3 text-white placeholder-[#3a3a5e] outline-none focus:border-[#d4b870]/50"
            />
            <input
              type="number"
              placeholder="価格（税込） *"
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
              className="bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-4 py-3 text-white placeholder-[#3a3a5e] outline-none focus:border-[#d4b870]/50"
              min="0"
            />
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value as MenuCategory }))}
              className="bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-4 py-3 text-white outline-none focus:border-[#d4b870]/50"
            >
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <input
              type="number"
              placeholder="表示順"
              value={form.sort_order}
              onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
              className="bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-4 py-3 text-white placeholder-[#3a3a5e] outline-none focus:border-[#d4b870]/50"
            />
          </div>

          {/* バック設定 */}
          <div className="pt-4 border-t border-[#2e2e50]">
            <label className="text-xs text-[#9090bb] tracking-widest uppercase block mb-2">キャストバック</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-[#9090bb] block mb-1">バック率（%）</label>
                <input
                  type="number"
                  placeholder="例: 20"
                  value={form.back_rate}
                  onChange={e => setForm(f => ({ ...f, back_rate: e.target.value }))}
                  disabled={!!form.back_amount.trim()}
                  className="w-full bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-4 py-3 text-white placeholder-[#3a3a5e] outline-none focus:border-[#d4b870]/50 disabled:opacity-30"
                  min="0" max="100"
                />
              </div>
              <div>
                <label className="text-xs text-[#9090bb] block mb-1">バック額（円 / 1点あたり）</label>
                <input
                  type="number"
                  placeholder="例: 3000"
                  value={form.back_amount}
                  onChange={e => setForm(f => ({ ...f, back_amount: e.target.value }))}
                  className="w-full bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-4 py-3 text-white placeholder-[#3a3a5e] outline-none focus:border-[#d4b870]/50"
                  min="0"
                />
              </div>
            </div>
            <p className="text-xs text-[#9090bb] mt-2">
              バックは本指名のキャストにのみ付きます。本指名が複数いる卓では指名数で割り、伝票ごとに手動調整もできます。
              {form.back_amount.trim()
                ? '　金額が入力されているため、率ではなく金額を使います。'
                : '　両方空欄ならバックは付きません。'}
            </p>
            {form.back_rate.trim() && !form.back_amount.trim() && form.price && (
              <p className="text-xs text-[#d4b870] mt-1">
                1点あたり約 ¥{Math.round((parseInt(form.price) || 0) * (parseFloat(form.back_rate) || 0) / 100).toLocaleString()}
              </p>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim() || !form.price}
            className="px-6 py-3 rounded-xl bg-[#d4b870] text-black font-bold disabled:opacity-30"
          >
            {saving ? '保存中...' : editingId ? '更新' : '追加'}
          </button>
        </div>
      )}

      {fetchError && (
        <div className="bg-red-900/40 border border-red-500/50 rounded-xl px-4 py-3 text-red-300 text-sm">
          {fetchError}
        </div>
      )}

      {/* メニュー一覧 */}
      {loading ? (
        <div className="text-center py-10 text-[#9090bb]">読み込み中...</div>
      ) : (
        <div className="bg-[#141430] rounded-xl border border-[#2e2e50] divide-y divide-[#2e2e50]">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-[#3a3a5e] text-sm">メニューがありません</div>
          ) : (
            filtered.map(item => (
              <div key={item.id} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${item.is_active ? 'text-white' : 'text-[#9090bb] line-through'}`}>{item.name}</div>
                  <div className="text-xs text-[#9090bb] mt-0.5">
                    {CATEGORIES.find(c => c.id === item.category)?.label} / 順序: {item.sort_order}
                    {item.back_amount != null && (
                      <span className="text-[#d4b870]">　バック ¥{item.back_amount.toLocaleString()}</span>
                    )}
                    {item.back_amount == null && item.back_rate != null && (
                      <span className="text-[#d4b870]">　バック {Math.round(item.back_rate * 100)}%</span>
                    )}
                  </div>
                </div>
                <div className="text-[#d4b870] font-bold">¥{item.price.toLocaleString()}</div>
                <button
                  onClick={() => toggleActive(item)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    item.is_active
                      ? 'bg-emerald-900/20 border-emerald-800/50 text-emerald-400'
                      : 'bg-[#0f0f28] border-[#2e2e50] text-[#9090bb]'
                  }`}
                >
                  {item.is_active ? '提供中' : '停止中'}
                </button>
                <button onClick={() => startEdit(item)} className="p-2 rounded-lg bg-[#0f0f28] text-[#9090bb] hover:text-[#d4b870]">
                  <Pencil size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* トースト */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-emerald-900/90 border border-emerald-700 text-emerald-300 px-4 py-3 rounded-xl text-sm flex items-center gap-2 shadow-lg z-50">
          <Check size={16} />{toast}
        </div>
      )}
    </div>
  )
}
