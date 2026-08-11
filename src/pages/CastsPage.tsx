import { useState, useEffect } from 'react'
import { Plus, Pencil, X, Check, Clock, Trash2, LayoutGrid, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase, supabaseUrl, supabaseAnonKey, requireTenantId } from '../lib/supabase'
import type { CastRow, CastShiftRow } from '../types'

const EMPTY_FORM = { stage_name: '', real_name: '', photo_url: '', drop_off_location: '', email: '' }

// Date → datetime-local の value 形式（ローカル時刻）
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function CastsPage() {
  const [casts, setCasts] = useState<CastRow[]>([])
  const [shifts, setShifts] = useState<CastShiftRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [hasAccount, setHasAccount] = useState(false)
  const [formError, setFormError] = useState('')
  const [toast, setToast] = useState('')
  const [showRetired, setShowRetired] = useState(false)
  const [selectedCastId, setSelectedCastId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  // シフト編集
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null)
  const [shiftForm, setShiftForm] = useState({ clock_in: '', clock_out: '' })
  const [shiftSaving, setShiftSaving] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    setFetchError(null)
    try {
      const tid = requireTenantId()
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const [castsRes, shiftsRes] = await Promise.all([
        supabase.from('casts')
          .select('id, tenant_id, stage_name, real_name, photo_url, drop_off_location, is_active, created_at, updated_at')
          .eq('tenant_id', tid)
          .order('stage_name', { ascending: true }),
        supabase.from('cast_shifts')
          .select('id, tenant_id, cast_id, clock_in, clock_out, scheduled_clock_in, scheduled_clock_out, created_at, updated_at')
          .eq('tenant_id', tid)
          .gte('clock_in', thirtyDaysAgo.toISOString())
          .order('clock_in', { ascending: false }),
      ])
      if (castsRes.error) throw new Error(castsRes.error.message)
      if (shiftsRes.error) throw new Error(shiftsRes.error.message)
      setCasts((castsRes.data || []) as CastRow[])
      setShifts((shiftsRes.data || []) as CastShiftRow[])
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'データの取得に失敗しました。ページを再読み込みしてください。')
    }
    setLoading(false)
  }

  async function fetchShifts() {
    try {
      const tid = requireTenantId()
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const { data, error } = await supabase.from('cast_shifts')
        .select('id, tenant_id, cast_id, clock_in, clock_out, scheduled_clock_in, scheduled_clock_out, created_at, updated_at')
        .eq('tenant_id', tid)
        .gte('clock_in', thirtyDaysAgo.toISOString())
        .order('clock_in', { ascending: false })
      if (error) throw new Error(error.message)
      setShifts((data || []) as CastShiftRow[])
    } catch (e) {
      console.error('シフト取得失敗:', e)
    }
  }

  async function fetchCasts() {
    try {
      const tid = requireTenantId()
      const { data, error } = await supabase.from('casts')
        .select('id, tenant_id, stage_name, real_name, photo_url, drop_off_location, is_active, created_at, updated_at')
        .eq('tenant_id', tid)
        .order('stage_name', { ascending: true })
      if (error) throw new Error(error.message)
      setCasts((data || []) as CastRow[])
    } catch (e) {
      console.error('キャスト取得失敗:', e)
    }
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  const activeCasts = casts.filter(c => c.is_active)
  const retiredCasts = casts.filter(c => !c.is_active)

  async function handleSave() {
    if (!form.stage_name.trim()) return
    setFormError('')
    setSaving(true)
    try {
      const tid = requireTenantId()

      if (editingId) {
        const { error: castError } = await supabase.from('casts').update({
          stage_name: form.stage_name.trim(),
          real_name: form.real_name.trim(),
          photo_url: form.photo_url || null,
          drop_off_location: form.drop_off_location || null,
          updated_at: new Date().toISOString(),
        }).eq('id', editingId).eq('tenant_id', tid)
        if (castError) throw new Error(castError.message)

        const emailTrimmed = form.email.trim()
        if (emailTrimmed) {
          if (hasAccount) {
            const res = await fetch(`${supabaseUrl}/functions/v1/cast-account?action=update-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseAnonKey}` },
              body: JSON.stringify({ cast_id: editingId, tenant_id: tid, email: emailTrimmed }),
            })
            const data = await res.json()
            if (!res.ok) {
              setFormError(`メール更新失敗: ${data.error}`)
              setSaving(false)
              return
            }
          } else {
            const res = await fetch(`${supabaseUrl}/functions/v1/cast-signup`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseAnonKey}` },
              body: JSON.stringify({ cast_id: editingId, email: emailTrimmed, password: 'luna1234', tenant_id: tid }),
            })
            const data = await res.json()
            if (!res.ok) {
              setFormError(data.error || 'アカウント作成に失敗しました')
              setSaving(false)
              return
            }
          }
        }

        showToast('キャスト情報を更新しました')
      } else {
        const { error } = await supabase.from('casts').insert({
          tenant_id: tid,
          stage_name: form.stage_name.trim(),
          real_name: form.real_name.trim(),
          photo_url: form.photo_url || null,
          drop_off_location: form.drop_off_location || null,
          is_active: true,
        })
        if (error) throw new Error(error.message)
        showToast('キャストを追加しました')
      }

      setForm(EMPTY_FORM)
      setShowForm(false)
      setEditingId(null)
      fetchCasts()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '保存に失敗しました')
    }
    setSaving(false)
  }

  async function toggleRetire(cast: CastRow) {
    try {
      const tid = requireTenantId()
      const newActive = !cast.is_active
      const { error } = await supabase.from('casts').update({
        is_active: newActive,
        updated_at: new Date().toISOString(),
      }).eq('id', cast.id).eq('tenant_id', tid)
      if (error) throw new Error(error.message)
      showToast(newActive ? '在籍に復帰しました' : '退職処理しました')
      fetchCasts()
    } catch (e) {
      alert(e instanceof Error ? e.message : '更新に失敗しました')
    }
  }

  async function startEdit(cast: CastRow) {
    setEditingId(cast.id)
    setHasAccount(false)
    setFormError('')
    setForm({
      stage_name: cast.stage_name,
      real_name: cast.real_name,
      photo_url: cast.photo_url || '',
      drop_off_location: cast.drop_off_location || '',
      email: '',
    })
    setShowForm(true)

    setEmailLoading(true)
    try {
      const tid = requireTenantId()
      const res = await fetch(
        `${supabaseUrl}/functions/v1/cast-account?action=get-email&cast_id=${cast.id}&tenant_id=${tid}`,
        { headers: { 'Authorization': `Bearer ${supabaseAnonKey}` } }
      )
      const data = await res.json()
      if (data.email) {
        setForm(f => ({ ...f, email: data.email }))
        setHasAccount(true)
      }
    } catch { /* ignore */ }
    setEmailLoading(false)
  }

  function startEditShift(shift: CastShiftRow) {
    setEditingShiftId(shift.id)
    setShiftForm({
      clock_in: toDatetimeLocal(shift.clock_in),
      clock_out: shift.clock_out ? toDatetimeLocal(shift.clock_out) : '',
    })
  }

  async function saveShift(shiftId: string) {
    if (!shiftForm.clock_in) return
    setShiftSaving(true)
    try {
      const tid = requireTenantId()
      const clockIn = new Date(shiftForm.clock_in).toISOString()
      const clockOut = shiftForm.clock_out ? new Date(shiftForm.clock_out).toISOString() : null
      const { error } = await supabase.from('cast_shifts').update({
        clock_in: clockIn,
        clock_out: clockOut,
        updated_at: new Date().toISOString(),
      }).eq('id', shiftId).eq('tenant_id', tid)
      if (error) throw new Error(error.message)
      setEditingShiftId(null)
      showToast('シフトを更新しました')
      fetchShifts()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'シフトの更新に失敗しました')
    }
    setShiftSaving(false)
  }

  async function deleteShift(shiftId: string) {
    if (!confirm('このシフト記録を削除しますか？')) return
    try {
      const tid = requireTenantId()
      const { error } = await supabase.from('cast_shifts').delete().eq('id', shiftId).eq('tenant_id', tid)
      if (error) throw new Error(error.message)
      showToast('シフトを削除しました')
      fetchShifts()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'シフトの削除に失敗しました')
    }
  }

  const selectedCastShifts = shifts.filter(s => s.cast_id === selectedCastId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">キャスト管理</h1>
        <div className="flex items-center gap-3">
          {/* ビュー切り替え */}
          <div className="flex bg-[#141430] rounded-xl border border-[#2e2e50] p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${viewMode === 'list' ? 'bg-[#d4b870] text-black' : 'text-[#9090bb]'}`}
            >
              <LayoutGrid size={13} />リスト
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${viewMode === 'calendar' ? 'bg-[#d4b870] text-black' : 'text-[#9090bb]'}`}
            >
              <CalendarDays size={13} />カレンダー
            </button>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM) }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#d4b870] text-black font-bold text-sm"
          >
            <Plus size={16} />キャスト追加
          </button>
        </div>
      </div>

      {viewMode === 'list' && (
        <button
          onClick={() => setShowRetired(v => !v)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
            showRetired
              ? 'border-[#9090bb]/50 bg-[#9090bb]/10 text-[#9090bb]'
              : 'border-[#2e2e50] bg-transparent text-[#3a3a5e] hover:text-[#9090bb] hover:border-[#9090bb]/30'
          }`}
        >
          <span className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${
            showRetired ? 'border-[#9090bb] bg-[#9090bb]/20' : 'border-[#3a3a5e]'
          }`}>
            {showRetired && <Check size={9} strokeWidth={3} />}
          </span>
          退職者も表示
          {retiredCasts.length > 0 && (
            <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] ${
              showRetired ? 'bg-[#9090bb]/20 text-[#9090bb]' : 'bg-[#2e2e50] text-[#3a3a5e]'
            }`}>
              {retiredCasts.length}
            </span>
          )}
        </button>
      )}

      {/* 追加/編集フォーム */}
      {showForm && (
        <div className="bg-[#141430] border border-[#2e2e50] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm text-[#d4b870] tracking-widest uppercase font-semibold">
              {editingId ? 'キャスト編集' : '新規キャスト'}
            </h3>
            <button onClick={() => { setShowForm(false); setEditingId(null) }} className="text-[#9090bb]"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input type="text" placeholder="源氏名 *" value={form.stage_name} onChange={e => setForm(f => ({ ...f, stage_name: e.target.value }))}
              className="bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-4 py-3 text-white placeholder-[#3a3a5e] outline-none focus:border-[#d4b870]/50" />
            <input type="text" placeholder="本名" value={form.real_name} onChange={e => setForm(f => ({ ...f, real_name: e.target.value }))}
              className="bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-4 py-3 text-white placeholder-[#3a3a5e] outline-none focus:border-[#d4b870]/50" />
            <input type="text" placeholder="送り先" value={form.drop_off_location} onChange={e => setForm(f => ({ ...f, drop_off_location: e.target.value }))}
              className="col-span-2 bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-4 py-3 text-white placeholder-[#3a3a5e] outline-none focus:border-[#d4b870]/50" />
            {editingId && (
              <>
                <div className="col-span-2 relative">
                  <input
                    type="email"
                    placeholder={emailLoading ? 'メールアドレス取得中...' : 'ログイン用メールアドレス（任意）'}
                    value={form.email}
                    disabled={emailLoading}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-4 py-3 text-white placeholder-[#3a3a5e] outline-none focus:border-[#d4b870]/50 disabled:opacity-50"
                  />
                  {emailLoading && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#9090bb]">取得中...</span>
                  )}
                </div>
                {!hasAccount && form.email.trim() && (
                  <p className="col-span-2 text-xs text-[#9090bb] bg-[#0f0f28] rounded-xl px-4 py-3 border border-[#2e2e50]">
                    初期パスワード <span className="text-[#d4b870] font-mono">luna1234</span> でアカウントを作成します。キャスト本人がログイン後に変更できます。
                  </p>
                )}
              </>
            )}
          </div>
          {formError && <p className="text-xs text-red-400">{formError}</p>}
          <button onClick={handleSave} disabled={saving || !form.stage_name.trim()}
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

      {/* キャスト一覧 */}
      {loading ? (
        <div className="text-center py-10 text-[#9090bb]">読み込み中...</div>
      ) : viewMode === 'calendar' ? (
        <ShiftCalendar
          casts={activeCasts}
          shifts={shifts}
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          startEditShift={startEditShift}
          deleteShift={deleteShift}
          editingShiftId={editingShiftId}
          shiftForm={shiftForm}
          setShiftForm={setShiftForm}
          shiftSaving={shiftSaving}
          saveShift={saveShift}
          setEditingShiftId={setEditingShiftId}
        />
      ) : (
        <div className="space-y-8">
          {/* 在籍キャスト */}
          <CastGrid
            casts={activeCasts}
            shifts={shifts}
            selectedCastId={selectedCastId}
            setSelectedCastId={setSelectedCastId}
            editingShiftId={editingShiftId}
            setEditingShiftId={setEditingShiftId}
            shiftForm={shiftForm}
            setShiftForm={setShiftForm}
            shiftSaving={shiftSaving}
            selectedCastShifts={selectedCastShifts}
            startEdit={startEdit}
            toggleRetire={toggleRetire}
            startEditShift={startEditShift}
            saveShift={saveShift}
            deleteShift={deleteShift}
          />

          {/* 退職者セクション */}
          {showRetired && retiredCasts.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs text-[#9090bb] tracking-widest uppercase font-semibold">退職者</span>
                <div className="flex-1 h-px bg-[#2e2e50]" />
                <span className="text-xs text-[#3a3a5e]">{retiredCasts.length}名</span>
              </div>
              <CastGrid
                casts={retiredCasts}
                shifts={shifts}
                selectedCastId={selectedCastId}
                setSelectedCastId={setSelectedCastId}
                editingShiftId={editingShiftId}
                setEditingShiftId={setEditingShiftId}
                shiftForm={shiftForm}
                setShiftForm={setShiftForm}
                shiftSaving={shiftSaving}
                selectedCastShifts={selectedCastShifts}
                startEdit={startEdit}
                toggleRetire={toggleRetire}
                startEditShift={startEditShift}
                saveShift={saveShift}
                deleteShift={deleteShift}
                dimmed
              />
            </div>
          )}
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

// ---- キャストグリッド（在籍・退職共用） ----
interface CastGridProps {
  casts: CastRow[]
  shifts: CastShiftRow[]
  selectedCastId: string | null
  setSelectedCastId: (id: string | null) => void
  editingShiftId: string | null
  setEditingShiftId: (id: string | null) => void
  shiftForm: { clock_in: string; clock_out: string }
  setShiftForm: (fn: (f: { clock_in: string; clock_out: string }) => { clock_in: string; clock_out: string }) => void
  shiftSaving: boolean
  selectedCastShifts: CastShiftRow[]
  startEdit: (cast: CastRow) => void
  toggleRetire: (cast: CastRow) => void
  startEditShift: (shift: CastShiftRow) => void
  saveShift: (id: string) => void
  deleteShift: (id: string) => void
  dimmed?: boolean
}

function CastGrid({
  casts, selectedCastId, setSelectedCastId, editingShiftId, setEditingShiftId,
  shiftForm, setShiftForm, shiftSaving, selectedCastShifts,
  startEdit, toggleRetire, startEditShift, saveShift, deleteShift, dimmed,
}: CastGridProps) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 items-start ${dimmed ? 'opacity-55' : ''}`}>
      {casts.map(cast => (
        <div key={cast.id} className="bg-[#141430] border border-[#2e2e50] rounded-xl p-4">
          <div className="flex items-center gap-4">
            {cast.photo_url ? (
              <img src={cast.photo_url} alt={cast.stage_name} className="w-14 h-14 rounded-full object-cover border border-[#2e2e50]" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-[#0f0f28] border border-[#2e2e50] flex items-center justify-center text-lg text-[#9090bb] font-semibold">
                {cast.stage_name.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className={`text-base font-semibold ${cast.is_active ? 'text-white' : 'text-[#9090bb] line-through'}`}>
                {cast.stage_name}
              </div>
              {cast.real_name && <div className="text-xs text-[#9090bb]">{cast.real_name}</div>}
              <div className={`text-xs mt-1 px-2 py-0.5 rounded inline-block ${
                cast.is_active ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'
              }`}>
                {cast.is_active ? '在籍' : '退職'}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setSelectedCastId(selectedCastId === cast.id ? null : cast.id); setEditingShiftId(null) }}
                className={`p-2 rounded-lg bg-[#0f0f28] ${selectedCastId === cast.id ? 'text-[#d4b870]' : 'text-[#9090bb] hover:text-white'}`}
              >
                <Clock size={14} />
              </button>
              <button onClick={() => startEdit(cast)} className="p-2 rounded-lg bg-[#0f0f28] text-[#9090bb] hover:text-[#d4b870]">
                <Pencil size={14} />
              </button>
              <button
                onClick={() => { if (confirm(cast.is_active ? 'このキャストを退職処理しますか？' : '在籍に復帰しますか？')) toggleRetire(cast) }}
                className={`px-3 py-2 rounded-lg text-xs font-medium ${cast.is_active ? 'bg-red-900/20 text-red-400' : 'bg-emerald-900/20 text-emerald-400'}`}
              >
                {cast.is_active ? '退職' : '復帰'}
              </button>
            </div>
          </div>

          {/* 出退勤履歴（展開） */}
          {selectedCastId === cast.id && (
            <div className="mt-4 pt-4 border-t border-[#2e2e50]">
              <h4 className="text-xs text-[#9090bb] tracking-widest uppercase mb-3">直近30日の出退勤履歴</h4>
              {selectedCastShifts.length === 0 ? (
                <p className="text-xs text-[#3a3a5e]">記録なし</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {selectedCastShifts.slice(0, 20).map(s => (
                    <div key={s.id}>
                      {editingShiftId === s.id ? (
                        <div className="bg-[#0f0f28] border border-[#d4b870]/30 rounded-lg p-3 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-[#9090bb] mb-1 block">出勤</label>
                              <input
                                type="datetime-local"
                                value={shiftForm.clock_in}
                                onChange={e => setShiftForm(f => ({ ...f, clock_in: e.target.value }))}
                                className="w-full bg-[#141430] border border-[#2e2e50] rounded-lg px-2 py-1.5 text-white text-xs outline-none focus:border-[#d4b870]/50"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-[#9090bb] mb-1 block">退勤（空欄 = 勤務中）</label>
                              <input
                                type="datetime-local"
                                value={shiftForm.clock_out}
                                onChange={e => setShiftForm(f => ({ ...f, clock_out: e.target.value }))}
                                className="w-full bg-[#141430] border border-[#2e2e50] rounded-lg px-2 py-1.5 text-white text-xs outline-none focus:border-[#d4b870]/50"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setEditingShiftId(null)} className="px-3 py-1.5 rounded-lg text-xs text-[#9090bb] hover:text-white">
                              キャンセル
                            </button>
                            <button
                              onClick={() => saveShift(s.id)}
                              disabled={shiftSaving || !shiftForm.clock_in}
                              className="px-3 py-1.5 rounded-lg bg-[#d4b870] text-black text-xs font-bold disabled:opacity-30"
                            >
                              {shiftSaving ? '保存中...' : '保存'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-xs group">
                          <span className="text-[#9090bb] w-12 shrink-0">
                            {new Date(s.clock_in).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                          </span>
                          <span className="text-white flex-1">
                            {new Date(s.clock_in).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                            {' - '}
                            {s.clock_out
                              ? new Date(s.clock_out).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
                              : <span className="text-emerald-400">勤務中</span>
                            }
                          </span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEditShift(s)} className="p-1 rounded text-[#9090bb] hover:text-[#d4b870]">
                              <Pencil size={11} />
                            </button>
                            <button onClick={() => deleteShift(s.id)} className="p-1 rounded text-[#9090bb] hover:text-red-400">
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ---- シフトカレンダービュー ----
interface ShiftCalendarProps {
  casts: CastRow[]
  shifts: CastShiftRow[]
  month: string
  onMonthChange: (m: string) => void
  startEditShift: (shift: CastShiftRow) => void
  deleteShift: (id: string) => void
  editingShiftId: string | null
  shiftForm: { clock_in: string; clock_out: string }
  setShiftForm: (fn: (f: { clock_in: string; clock_out: string }) => { clock_in: string; clock_out: string }) => void
  shiftSaving: boolean
  saveShift: (id: string) => void
  setEditingShiftId: (id: string | null) => void
}

function ShiftCalendar({
  casts, shifts, month, onMonthChange,
  startEditShift, deleteShift,
  editingShiftId, shiftForm, setShiftForm, shiftSaving, saveShift, setEditingShiftId,
}: ShiftCalendarProps) {
  const [tooltipShift, setTooltipShift] = useState<CastShiftRow | null>(null)

  const [year, monthNum] = month.split('-').map(Number)
  const daysInMonth = new Date(year, monthNum, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  function shiftMonth(offset: number) {
    const d = new Date(year, monthNum - 1 + offset, 1)
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  function shiftsForCastOnDay(castId: string, day: number): CastShiftRow[] {
    return shifts.filter(s => {
      const d = new Date(s.clock_in)
      return s.cast_id === castId && d.getFullYear() === year && d.getMonth() + 1 === monthNum && d.getDate() === day
    })
  }

  // 月の出勤日数合計
  function totalDays(castId: string): number {
    const daySet = new Set<number>()
    shifts.forEach(s => {
      const d = new Date(s.clock_in)
      if (s.cast_id === castId && d.getFullYear() === year && d.getMonth() + 1 === monthNum) {
        daySet.add(d.getDate())
      }
    })
    return daySet.size
  }

  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === monthNum

  return (
    <div className="space-y-4">
      {/* 月ナビ */}
      <div className="flex items-center gap-3">
        <button onClick={() => shiftMonth(-1)} className="p-2 rounded-lg bg-[#141430] border border-[#2e2e50] text-[#9090bb] hover:text-white">
          <ChevronLeft size={15} />
        </button>
        <span className="text-white font-semibold text-sm">{year}年{monthNum}月</span>
        <button onClick={() => shiftMonth(1)} className="p-2 rounded-lg bg-[#141430] border border-[#2e2e50] text-[#9090bb] hover:text-white">
          <ChevronRight size={15} />
        </button>
        <span className="text-xs text-[#9090bb] ml-2">出勤日数は当月の集計</span>
      </div>

      {/* グリッド: 横=日付、縦=キャスト */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr>
              {/* キャスト名列 */}
              <th className="sticky left-0 z-10 bg-[#0f0f28] border border-[#2e2e50] px-3 py-2 text-left text-[#9090bb] font-medium min-w-[90px]">
                キャスト
              </th>
              {days.map(d => {
                const date = new Date(year, monthNum - 1, d)
                const dow = date.getDay()
                const isToday = isCurrentMonth && d === today.getDate()
                return (
                  <th key={d} className={`border border-[#2e2e50] px-1 py-2 text-center font-medium min-w-[38px] ${
                    isToday ? 'bg-[#d4b870]/20 text-[#d4b870]' :
                    dow === 0 ? 'text-red-400/70' : dow === 6 ? 'text-blue-400/70' : 'text-[#9090bb]'
                  }`}>
                    <div>{d}</div>
                    <div className="text-[9px] opacity-60">{'日月火水木金土'[dow]}</div>
                  </th>
                )
              })}
              <th className="border border-[#2e2e50] px-2 py-2 text-center text-[#9090bb] font-medium min-w-[48px]">出勤数</th>
            </tr>
          </thead>
          <tbody>
            {casts.map(cast => (
              <tr key={cast.id} className="hover:bg-[#141430]/50 group">
                {/* キャスト名 */}
                <td className="sticky left-0 z-10 bg-[#0f0f28] border border-[#2e2e50] px-3 py-1.5 group-hover:bg-[#141430]">
                  <div className="flex items-center gap-2">
                    {cast.photo_url ? (
                      <img src={cast.photo_url} alt={cast.stage_name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-[#1a1a40] flex items-center justify-center text-[10px] text-[#9090bb] shrink-0">
                        {cast.stage_name.charAt(0)}
                      </div>
                    )}
                    <span className="text-white whitespace-nowrap">{cast.stage_name}</span>
                  </div>
                </td>

                {/* 日付セル */}
                {days.map(d => {
                  const dayShifts = shiftsForCastOnDay(cast.id, d)
                  const date = new Date(year, monthNum - 1, d)
                  const dow = date.getDay()
                  const isToday = isCurrentMonth && d === today.getDate()
                  return (
                    <td key={d} className={`border border-[#2e2e50] p-0 text-center align-middle relative ${
                      isToday ? 'bg-[#d4b870]/10' : dow === 0 || dow === 6 ? 'bg-[#0f0f28]/50' : ''
                    }`}>
                      {dayShifts.length > 0 && (
                        <div className="flex flex-col gap-0.5 p-0.5">
                          {dayShifts.map(s => (
                            <button
                              key={s.id}
                              onClick={() => setTooltipShift(tooltipShift?.id === s.id ? null : s)}
                              className="w-full bg-[#d4b870]/20 hover:bg-[#d4b870]/40 rounded text-[#d4b870] leading-tight py-0.5 px-0.5 transition-colors"
                            >
                              <div className="text-[9px] font-medium">
                                {new Date(s.clock_in).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                              {s.clock_out && (
                                <div className="text-[9px] opacity-70">
                                  {new Date(s.clock_out).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}
                              {!s.clock_out && <div className="text-[9px] text-emerald-400">〜</div>}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  )
                })}

                {/* 出勤日数 */}
                <td className="border border-[#2e2e50] px-2 py-1.5 text-center">
                  <span className={`font-bold ${totalDays(cast.id) > 0 ? 'text-[#d4b870]' : 'text-[#3a3a5e]'}`}>
                    {totalDays(cast.id)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* シフト詳細ポップオーバー（クリックしたセルの下に表示） */}
      {tooltipShift && (
        <div className="fixed inset-0 z-40" onClick={() => setTooltipShift(null)}>
          <div
            className="absolute bg-[#141430] border border-[#2e2e50] rounded-xl shadow-xl p-4 w-72 z-50"
            style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-white font-semibold">
                {new Date(tooltipShift.clock_in).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
              </span>
              <button onClick={() => setTooltipShift(null)} className="text-[#9090bb] hover:text-white"><X size={14} /></button>
            </div>

            {editingShiftId === tooltipShift.id ? (
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-[#9090bb] mb-1 block">出勤</label>
                  <input type="datetime-local" value={shiftForm.clock_in}
                    onChange={e => setShiftForm(f => ({ ...f, clock_in: e.target.value }))}
                    className="w-full bg-[#0f0f28] border border-[#2e2e50] rounded-lg px-2 py-1.5 text-white text-xs outline-none focus:border-[#d4b870]/50" />
                </div>
                <div>
                  <label className="text-[10px] text-[#9090bb] mb-1 block">退勤（空欄 = 勤務中）</label>
                  <input type="datetime-local" value={shiftForm.clock_out}
                    onChange={e => setShiftForm(f => ({ ...f, clock_out: e.target.value }))}
                    className="w-full bg-[#0f0f28] border border-[#2e2e50] rounded-lg px-2 py-1.5 text-white text-xs outline-none focus:border-[#d4b870]/50" />
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <button onClick={() => setEditingShiftId(null)} className="px-3 py-1.5 rounded-lg text-xs text-[#9090bb]">キャンセル</button>
                  <button onClick={() => { saveShift(tooltipShift.id); setTooltipShift(null) }}
                    disabled={shiftSaving || !shiftForm.clock_in}
                    className="px-3 py-1.5 rounded-lg bg-[#d4b870] text-black text-xs font-bold disabled:opacity-30">
                    {shiftSaving ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs text-[#9090bb]">
                  出勤: <span className="text-white">{new Date(tooltipShift.clock_in).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="text-xs text-[#9090bb]">
                  退勤: {tooltipShift.clock_out
                    ? <span className="text-white">{new Date(tooltipShift.clock_out).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span>
                    : <span className="text-emerald-400">勤務中</span>}
                </div>
                {tooltipShift.clock_out && (
                  <div className="text-xs text-[#9090bb]">
                    勤務時間: <span className="text-white">{
                      (() => {
                        const mins = Math.round((new Date(tooltipShift.clock_out).getTime() - new Date(tooltipShift.clock_in).getTime()) / 60000)
                        return `${Math.floor(mins / 60)}時間${mins % 60}分`
                      })()
                    }</span>
                  </div>
                )}
                <div className="flex gap-2 pt-2 border-t border-[#2e2e50]">
                  <button onClick={() => startEditShift(tooltipShift)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-[#0f0f28] border border-[#2e2e50] text-[#9090bb] hover:text-[#d4b870] text-xs">
                    <Pencil size={11} />修正
                  </button>
                  <button onClick={() => { deleteShift(tooltipShift.id); setTooltipShift(null) }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-[#0f0f28] border border-[#2e2e50] text-[#9090bb] hover:text-red-400 text-xs">
                    <Trash2 size={11} />削除
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
