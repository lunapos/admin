import { useState, useRef } from 'react'
import {
  BarChart3, Users, ShoppingBag, Settings, CalendarDays,
  TrendingUp, Clock, CreditCard, Star, Plus, Pencil, Trash2,
  Check, X, Camera, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Download,
} from 'lucide-react'
import { useApp } from '../contexts/AppContext'
import { initialShifts } from '../data/mockData'
import { exportPaymentsCSV } from '../lib/csvExport'
import type { MenuCategory, Cast } from '../types'

type AdminTab = 'report' | 'shift' | 'cast' | 'menu' | 'settings'

const TAB_CONFIG: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
  { id: 'report', label: 'レポート', icon: <BarChart3 size={16} /> },
  { id: 'shift', label: 'シフト', icon: <CalendarDays size={16} /> },
  { id: 'cast', label: 'キャスト', icon: <Users size={16} /> },
  { id: 'menu', label: 'メニュー', icon: <ShoppingBag size={16} /> },
  { id: 'settings', label: '設定', icon: <Settings size={16} /> },
]

// ---- Report Tab ----
function ReportTab() {
  const { state } = useApp()
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const todayPayments = state.payments.filter(p => new Date(p.paidAt) >= todayStart)
  const todayVisits = state.visits.filter(v => new Date(v.checkInTime) >= todayStart)
  const totalSales = todayPayments.reduce((s, p) => s + p.total, 0)
  const totalGroups = todayVisits.length
  const totalGuests = todayVisits.reduce((s, v) => s + v.guestCount, 0)
  const avgSpend = totalGroups > 0 ? Math.floor(totalSales / totalGroups) : 0
  const checkedOut = todayVisits.filter(v => v.isCheckedOut && v.checkOutTime)
  const avgStayMin = checkedOut.length > 0 ? Math.floor(checkedOut.reduce((s, v) => {
    const stay = (new Date(v.checkOutTime!).getTime() - new Date(v.checkInTime).getTime()) / 60000
    return s + stay
  }, 0) / checkedOut.length) : 0
  const methodTotals = todayPayments.reduce<Record<string, number>>((acc, p) => {
    acc[p.paymentMethod] = (acc[p.paymentMethod] || 0) + p.total; return acc
  }, {})
  const methodLabels: Record<string, string> = { cash: '現金', credit: 'カード', electronic: '電子マネー', tab: 'ツケ' }
  const castPerf = state.casts.map(cast => {
    const nominations = todayVisits.filter(v =>
      v.nominations.some(n => n.castId === cast.id && n.nominationType !== 'none')
    ).length
    const sales = todayPayments.filter(p => {
      const visit = state.visits.find(v => v.id === p.visitId)
      return visit?.nominations.some(n => n.castId === cast.id)
    }).reduce((s, p) => s + p.total, 0)
    return { cast, nominations, sales }
  }).filter(c => c.nominations > 0 || c.sales > 0).sort((a, b) => b.sales - a.sales)
  const menuRanking = todayVisits.flatMap(v => v.orderItems).reduce<Record<string, { name: string; count: number; revenue: number }>>((acc, item) => {
    if (!acc[item.menuItemId]) acc[item.menuItemId] = { name: item.menuItemName, count: 0, revenue: 0 }
    acc[item.menuItemId].count += item.quantity
    acc[item.menuItemId].revenue += item.price * item.quantity
    return acc
  }, {})
  const topMenus = Object.values(menuRanking).sort((a, b) => b.revenue - a.revenue).slice(0, 5)

  return (
    <div className="p-4 space-y-3">
      {/* CSVエクスポート */}
      <button
        onClick={() => exportPaymentsCSV(state.payments, state.visits, state.casts)}
        disabled={state.payments.length === 0}
        className="w-full py-3 rounded-xl bg-[#141430] border border-[#2e2e50] text-[#9090bb] font-semibold text-sm flex items-center justify-center gap-2 hover:border-[#d4b870]/50 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Download size={16} />売上データをCSVエクスポート
      </button>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: '本日売上', value: `¥${totalSales.toLocaleString()}`, icon: <TrendingUp size={16} />, gold: true },
          { label: '来店組数', value: `${totalGroups}組`, sub: `${totalGuests}名`, icon: <Users size={16} /> },
          { label: '客単価', value: `¥${avgSpend.toLocaleString()}`, sub: '1組あたり', icon: <CreditCard size={16} /> },
          { label: '平均滞在', value: avgStayMin > 0 ? `${avgStayMin}分` : '--', icon: <Clock size={16} /> },
        ].map(({ label, value, sub, icon, gold }) => (
          <div key={label} className="bg-[#141430] rounded-xl p-4 border border-[#2e2e50]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#9090bb] text-xs tracking-widest uppercase">{label}</span>
              <span className="text-[#2e2e50]">{icon}</span>
            </div>
            <div className={`text-2xl font-bold ${gold ? 'text-[#d4b870]' : 'text-white'}`}>{value}</div>
            {sub && <div className="text-xs text-[#9090bb] mt-1 tracking-wider">{sub}</div>}
          </div>
        ))}
      </div>
      {Object.keys(methodTotals).length > 0 && (
        <div className="bg-[#141430] rounded-xl p-4 border border-[#2e2e50]">
          <h2 className="text-xs font-semibold text-[#9090bb] tracking-widest uppercase mb-3">支払い方法</h2>
          <div className="space-y-2">
            {Object.entries(methodTotals).map(([method, amount]) => {
              const pct = totalSales > 0 ? Math.round((amount / totalSales) * 100) : 0
              return (
                <div key={method} className="flex items-center gap-3">
                  <span className="text-xs text-white w-20 tracking-wider">{methodLabels[method] || method}</span>
                  <div className="flex-1 h-1 bg-[#2e2e50] rounded-full overflow-hidden">
                    <div className="h-full bg-[#d4b870] rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-[#9090bb] w-28 text-right">¥{amount.toLocaleString()} ({pct}%)</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {castPerf.length > 0 && (
        <div className="bg-[#141430] rounded-xl p-4 border border-[#2e2e50]">
          <h2 className="text-xs font-semibold text-[#9090bb] tracking-widest uppercase mb-3">
            <Star size={12} className="inline mr-1" />Cast Ranking
          </h2>
          <div className="space-y-2">
            {castPerf.map(({ cast, nominations, sales }, idx) => (
              <div key={cast.id} className="flex items-center gap-3">
                <span className={`text-sm font-bold w-5 ${idx === 0 ? 'text-[#d4b870]' : 'text-[#3a3a5e]'}`}>{idx + 1}</span>
                {cast.photo ? (
                  <img src={cast.photo} alt={cast.stageName} className="w-7 h-7 rounded-full object-cover border border-[#2e2e50]" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#0f0f28] border border-[#2e2e50] flex items-center justify-center text-xs text-[#9090bb]">{cast.stageName.charAt(0)}</div>
                )}
                <span className="flex-1 text-sm text-white">{cast.stageName}</span>
                <span className="text-xs text-[#9090bb] tracking-wider">指名{nominations}件</span>
                <span className="text-sm font-bold text-[#d4b870]">¥{sales.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {topMenus.length > 0 && (
        <div className="bg-[#141430] rounded-xl p-4 border border-[#2e2e50]">
          <h2 className="text-xs font-semibold text-[#9090bb] tracking-widest uppercase mb-3">Menu Top 5</h2>
          <div className="space-y-2">
            {topMenus.map(({ name, count, revenue }, idx) => (
              <div key={name} className="flex items-center gap-3">
                <span className={`text-sm font-bold w-5 ${idx === 0 ? 'text-[#d4b870]' : 'text-[#3a3a5e]'}`}>{idx + 1}</span>
                <span className="flex-1 text-sm text-white">{name}</span>
                <span className="text-xs text-[#9090bb]">{count}杯</span>
                <span className="text-sm font-bold text-[#d4b870]">¥{revenue.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {todayPayments.length > 0 && (
        <div className="bg-[#141430] rounded-xl p-4 border border-[#2e2e50]">
          <h2 className="text-xs font-semibold text-[#9090bb] tracking-widest uppercase mb-3">会計履歴</h2>
          <div className="space-y-2">
            {todayPayments.map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-white">{p.customerName || '—'}</span>
                  <span className="text-[#9090bb] text-xs ml-2">{new Date(p.paidAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="text-right">
                  <span className="text-[#d4b870] font-bold">¥{p.total.toLocaleString()}</span>
                  <span className="text-[#9090bb] text-xs ml-2">{methodLabels[p.paymentMethod]}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {totalGroups === 0 && (
        <div className="text-center py-16 text-[#3a3a5e]">
          <p className="text-sm tracking-widest">NO DATA TODAY</p>
        </div>
      )}
    </div>
  )
}

// ---- Shift Tab ----
const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getCountStyle(count: number) {
  if (count === 0) return { text: 'text-[#3a3a5e]', bg: 'bg-[#1a1a2e]', badge: 'bg-[#1a1a2e] text-[#3a3a5e]' }
  if (count <= 2) return { text: 'text-amber-400', bg: 'bg-amber-900/20', badge: 'bg-amber-900/30 text-amber-400' }
  if (count <= 4) return { text: 'text-white', bg: 'bg-[#1e1e40]', badge: 'bg-[#2e2e50] text-white' }
  return { text: 'text-emerald-400', bg: 'bg-emerald-900/20', badge: 'bg-emerald-900/30 text-emerald-400' }
}

function ShiftTab() {
  const { state } = useApp()
  const [weekOffset, setWeekOffset] = useState(0)

  const today = new Date()
  const todayStr = toDateStr(today)
  const dow = today.getDay()
  const mondayDiff = dow === 0 ? -6 : 1 - dow
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() + mondayDiff + weekOffset * 7)
  weekStart.setHours(0, 0, 0, 0)

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  const dayData = days.map(day => {
    const dateStr = toDateStr(day)
    const shifts = initialShifts.filter(s => s.date === dateStr)
    return { date: day, dateStr, dayLabel: DAY_LABELS[day.getDay()], shifts, count: shifts.length, isToday: dateStr === todayStr }
  })

  const weekLabel = `${days[0].getMonth() + 1}/${days[0].getDate()} 〜 ${days[6].getMonth() + 1}/${days[6].getDate()}`

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setWeekOffset(w => w - 1)} className="p-2 rounded-lg bg-[#141430] border border-[#2e2e50] text-[#9090bb] active:bg-[#1e1e40]">
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <div className="text-sm font-bold text-white tracking-wider">{weekLabel}</div>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)} className="text-[10px] text-[#d4b870] tracking-wider mt-0.5">今週に戻る</button>
          )}
        </div>
        <button onClick={() => setWeekOffset(w => w + 1)} className="p-2 rounded-lg bg-[#141430] border border-[#2e2e50] text-[#9090bb] active:bg-[#1e1e40]">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {dayData.map(d => {
          const style = getCountStyle(d.count)
          const isWeekend = d.date.getDay() === 0 || d.date.getDay() === 6
          return (
            <div
              key={d.dateStr}
              className={`text-center rounded-xl py-2.5 border transition-colors ${
                d.isToday
                  ? 'border-[#d4b870] bg-[#1a1a3a]'
                  : 'border-[#2e2e50] bg-[#141430]'
              }`}
            >
              <div className={`text-[10px] font-bold tracking-wider ${isWeekend ? (d.date.getDay() === 0 ? 'text-red-400' : 'text-blue-400') : 'text-[#9090bb]'}`}>
                {d.dayLabel}
              </div>
              <div className={`text-xs mt-0.5 ${d.isToday ? 'text-[#d4b870] font-bold' : 'text-white'}`}>
                {d.date.getDate()}
              </div>
              <div className={`text-2xl font-black mt-1 leading-none ${style.text}`}>
                {d.count}
              </div>
              <div className="text-[9px] text-[#9090bb] mt-0.5 tracking-wider">人</div>
            </div>
          )
        })}
      </div>

      <div className="space-y-2">
        {dayData.map(d => {
          const style = getCountStyle(d.count)
          const isWeekend = d.date.getDay() === 0 || d.date.getDay() === 6
          return (
            <div
              key={d.dateStr}
              className={`rounded-xl border p-3 ${
                d.isToday
                  ? 'border-[#d4b870]/50 bg-[#141430]'
                  : 'border-[#2e2e50] bg-[#141430]'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-sm font-bold ${isWeekend ? (d.date.getDay() === 0 ? 'text-red-400' : 'text-blue-400') : 'text-white'}`}>
                  {d.date.getMonth() + 1}/{d.date.getDate()} ({d.dayLabel})
                </span>
                {d.isToday && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#d4b870]/20 text-[#d4b870] font-bold tracking-wider">TODAY</span>
                )}
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold ml-auto ${style.badge}`}>
                  {d.count}人出勤
                </span>
              </div>

              {d.shifts.length > 0 ? (
                <div className="space-y-1.5">
                  {d.shifts.map(s => {
                    const cast = state.casts.find(c => c.id === s.castId)
                    if (!cast) return null
                    return (
                      <div key={s.castId} className="flex items-center gap-2.5">
                        {cast.photo ? (
                          <img src={cast.photo} alt={cast.stageName} className="w-7 h-7 rounded-full object-cover border border-[#2e2e50]" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-[#0f0f28] border border-[#2e2e50] flex items-center justify-center text-[10px] text-[#9090bb]">
                            {cast.stageName.charAt(0)}
                          </div>
                        )}
                        <span className="text-sm text-white flex-1">{cast.stageName}</span>
                        <span className="text-xs text-[#9090bb] font-mono tracking-wide">{s.startTime}–{s.endTime}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-[#3a3a5e] py-1">出勤なし</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---- Cast Management Tab ----
const EMPTY_CAST_FORM = { stageName: '', realName: '', photo: '' }

function CastManagementTab() {
  const { state, dispatch } = useApp()
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_CAST_FORM)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editFileRef = useRef<HTMLInputElement>(null)

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setForm(f => ({ ...f, photo: ev.target?.result as string }))
    reader.readAsDataURL(file)
  }

  function handleAdd() {
    if (!form.stageName.trim()) return
    dispatch({ type: 'ADD_CAST', payload: { stageName: form.stageName.trim(), realName: form.realName.trim(), photo: form.photo || undefined } })
    setForm(EMPTY_CAST_FORM)
    setShowAdd(false)
  }

  function startEdit(cast: Cast) {
    setEditingId(cast.id)
    setForm({ stageName: cast.stageName, realName: cast.realName || '', photo: cast.photo || '' })
  }

  function saveEdit() {
    if (!editingId || !form.stageName.trim()) return
    dispatch({ type: 'UPDATE_CAST', payload: { id: editingId, stageName: form.stageName.trim(), realName: form.realName.trim(), photo: form.photo || undefined } })
    setEditingId(null)
  }

  return (
    <div className="p-4 space-y-3">
      <button onClick={() => { setShowAdd(true); setForm(EMPTY_CAST_FORM) }} className="w-full py-3 rounded-xl bg-[#d4b870] text-black font-bold tracking-wider flex items-center justify-center gap-2">
        <Plus size={16} />キャストを追加
      </button>

      {(showAdd || editingId) && (
        <div className="bg-[#141430] border border-[#2e2e50] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs text-[#d4b870] tracking-widest uppercase">{editingId ? 'Edit Cast' : 'New Cast'}</h3>
            <button onClick={() => { setShowAdd(false); setEditingId(null) }} className="text-[#9090bb]"><X size={16} /></button>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button onClick={() => (editingId ? editFileRef : fileInputRef).current?.click()} className="w-20 h-20 rounded-full overflow-hidden border border-[#2e2e50] flex items-center justify-center bg-[#0f0f28]">
              {form.photo ? <img src={form.photo} alt="" className="w-full h-full object-cover" /> : (
                <div className="flex flex-col items-center text-[#9090bb]"><Camera size={24} /><span className="text-xs mt-1">写真</span></div>
              )}
            </button>
            <input ref={editingId ? editFileRef : fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => handlePhoto(e)} />
            {form.photo && <button onClick={() => setForm(f => ({ ...f, photo: '' }))} className="text-xs text-red-400">削除</button>}
          </div>
          <input type="text" placeholder="源氏名 *" value={form.stageName} onChange={e => setForm(f => ({ ...f, stageName: e.target.value }))} className="w-full bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-4 py-3 text-white placeholder-[#3a3a5e] outline-none focus:border-[#d4b870]/50" />
          <input type="text" placeholder="本名" value={form.realName} onChange={e => setForm(f => ({ ...f, realName: e.target.value }))} className="w-full bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-4 py-3 text-white placeholder-[#3a3a5e] outline-none focus:border-[#d4b870]/50" />
          <button onClick={editingId ? saveEdit : handleAdd} disabled={!form.stageName.trim()} className="w-full py-3 rounded-xl bg-[#d4b870] text-black font-bold disabled:opacity-30">
            {editingId ? '保存' : '追加する'}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {state.casts.map(cast => (
          <div key={cast.id} className="bg-[#141430] border border-[#2e2e50] rounded-xl p-3 flex items-center gap-3">
            {cast.photo ? (
              <img src={cast.photo} alt={cast.stageName} className="w-10 h-10 rounded-full object-cover border border-[#2e2e50]" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#0f0f28] border border-[#2e2e50] flex items-center justify-center text-[#9090bb] font-semibold">{cast.stageName.charAt(0)}</div>
            )}
            <div className="flex-1 min-w-0">
              <span className="text-white font-semibold text-sm">{cast.stageName}</span>
              {cast.realName && <p className="text-xs text-[#9090bb]">{cast.realName}</p>}
            </div>
            <div className={`text-xs px-2 py-1 rounded-lg ${cast.isWorking ? 'bg-emerald-900/30 text-emerald-400' : 'bg-[#0f0f28] text-[#9090bb]'}`}>
              {cast.isWorking ? '出勤中' : '休み'}
            </div>
            <button onClick={() => startEdit(cast)} className="p-1.5 rounded-lg bg-[#0f0f28] text-[#9090bb] hover:text-[#d4b870]"><Pencil size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- Menu Management Tab ----
const MENU_CATEGORY_LABEL: Record<MenuCategory, string> = {
  drink: 'ドリンク', bottle: 'ボトル', food: 'フード', ladies_drink: 'レディース', other: 'その他',
}

function MenuManagementTab() {
  const { state, dispatch } = useApp()
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', price: '', category: 'drink' as MenuCategory })
  const [expandedCat, setExpandedCat] = useState<MenuCategory | null>('drink')

  const categories = Object.keys(MENU_CATEGORY_LABEL) as MenuCategory[]
  const itemsByCategory = (cat: MenuCategory) => state.menuItems.filter(m => m.category === cat)

  return (
    <div className="p-4 space-y-3">
      <button onClick={() => setShowAdd(v => !v)} className="w-full py-3 rounded-xl bg-[#d4b870] text-black font-bold tracking-wider flex items-center justify-center gap-2">
        <Plus size={16} />メニューを追加
      </button>

      {showAdd && (
        <div className="bg-[#141430] border border-[#2e2e50] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs text-[#d4b870] tracking-widest uppercase">New Menu Item</h3>
            <button onClick={() => setShowAdd(false)} className="text-[#9090bb]"><X size={16} /></button>
          </div>
          <select value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value as MenuCategory }))} className="w-full bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-4 py-3 text-white outline-none focus:border-[#d4b870]/50">
            {categories.map(c => <option key={c} value={c}>{MENU_CATEGORY_LABEL[c]}</option>)}
          </select>
          <input type="text" placeholder="商品名" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-4 py-3 text-white placeholder-[#3a3a5e] outline-none focus:border-[#d4b870]/50" />
          <input type="number" placeholder="価格" value={addForm.price} onChange={e => setAddForm(f => ({ ...f, price: e.target.value }))} className="w-full bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-4 py-3 text-white placeholder-[#3a3a5e] outline-none focus:border-[#d4b870]/50" />
          <button
            onClick={() => {
              const p = parseInt(addForm.price)
              if (!addForm.name.trim() || isNaN(p) || p <= 0) return
              dispatch({ type: 'ADD_MENU_ITEM', payload: { name: addForm.name.trim(), price: p, category: addForm.category } })
              setAddForm({ name: '', price: '', category: 'drink' })
              setShowAdd(false)
            }}
            disabled={!addForm.name.trim() || !addForm.price}
            className="w-full py-3 rounded-xl bg-[#d4b870] text-black font-bold disabled:opacity-30"
          >
            追加する
          </button>
        </div>
      )}

      {categories.map(cat => (
        <div key={cat} className="bg-[#141430] border border-[#2e2e50] rounded-xl overflow-hidden">
          <button
            onClick={() => setExpandedCat(expandedCat === cat ? null : cat)}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-sm font-semibold text-white tracking-wider">{MENU_CATEGORY_LABEL[cat]}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#9090bb]">{itemsByCategory(cat).length}件</span>
              {expandedCat === cat ? <ChevronUp size={16} className="text-[#9090bb]" /> : <ChevronDown size={16} className="text-[#9090bb]" />}
            </div>
          </button>
          {expandedCat === cat && (
            <div className="border-t border-[#2e2e50] divide-y divide-[#2e2e50]">
              {itemsByCategory(cat).map(item => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white">{item.name}</div>
                    <div className="text-xs text-[#d4b870]">¥{item.price.toLocaleString()}</div>
                  </div>
                  <button
                    onClick={() => dispatch({ type: 'TOGGLE_MENU_ITEM', payload: { id: item.id } })}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${item.isActive ? 'bg-emerald-900/20 border-emerald-800/50 text-emerald-400' : 'bg-[#0f0f28] border-[#2e2e50] text-[#9090bb]'}`}
                  >
                    {item.isActive ? '提供中' : '停止中'}
                  </button>
                </div>
              ))}
              {itemsByCategory(cat).length === 0 && (
                <p className="text-center text-xs text-[#3a3a5e] py-4">メニューなし</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ---- Settings Tab ----
function SettingsTab() {
  const { state, dispatch } = useApp()
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null)
  const [editRoomName, setEditRoomName] = useState('')
  const [addingRoom, setAddingRoom] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')

  return (
    <div className="p-4 space-y-4">
      {/* Room management */}
      <div className="bg-[#141430] border border-[#2e2e50] rounded-xl p-4">
        <h2 className="text-xs font-semibold text-[#9090bb] tracking-widest uppercase mb-3">部屋管理</h2>
        <div className="space-y-2">
          {state.rooms.map(room => (
            <div key={room.id} className="flex items-center gap-2 bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-4 py-3">
              {editingRoomId === room.id ? (
                <>
                  <input className="flex-1 bg-[#1a1a3a] text-white rounded-lg px-3 py-1.5 text-sm outline-none border border-[#d4b870]/50" value={editRoomName} onChange={e => setEditRoomName(e.target.value)} onKeyDown={e => e.key === 'Enter' && (() => { if (editRoomName.trim()) { dispatch({ type: 'UPDATE_ROOM', payload: { id: room.id, name: editRoomName.trim() } }); setEditingRoomId(null) } })()} autoFocus />
                  <button onClick={() => { if (editRoomName.trim()) { dispatch({ type: 'UPDATE_ROOM', payload: { id: room.id, name: editRoomName.trim() } }); setEditingRoomId(null) } }} className="p-1.5 rounded-lg bg-[#d4b870] text-black"><Check size={14} /></button>
                  <button onClick={() => setEditingRoomId(null)} className="p-1.5 rounded-lg bg-[#141430] text-[#9090bb]"><X size={14} /></button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-white text-sm">{room.name}</span>
                  <span className="text-xs text-[#9090bb] mr-2">{state.tables.filter(t => t.roomId === room.id).length} tables</span>
                  <button onClick={() => { setEditingRoomId(room.id); setEditRoomName(room.name) }} className="p-1.5 rounded-lg bg-[#141430] text-[#9090bb]"><Pencil size={14} /></button>
                  <button onClick={() => state.rooms.length > 1 && dispatch({ type: 'DELETE_ROOM', payload: { id: room.id } })} disabled={state.rooms.length <= 1} className={`p-1.5 rounded-lg ${state.rooms.length <= 1 ? 'bg-[#0f0f28] text-[#2e2e50] cursor-not-allowed' : 'bg-[#141430] text-red-400'}`}><Trash2 size={14} /></button>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3">
          {addingRoom ? (
            <div className="flex items-center gap-2">
              <input className="flex-1 bg-[#0f0f28] text-white rounded-xl px-4 py-3 text-sm outline-none border border-[#d4b870]/50" placeholder="部屋名を入力" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} autoFocus />
              <button onClick={() => { if (newRoomName.trim()) { dispatch({ type: 'ADD_ROOM', payload: { name: newRoomName.trim() } }); setNewRoomName(''); setAddingRoom(false) } }} className="px-4 py-3 rounded-xl bg-[#d4b870] text-black font-semibold text-sm">追加</button>
              <button onClick={() => { setAddingRoom(false); setNewRoomName('') }} className="px-3 py-3 rounded-xl bg-[#141430] text-[#9090bb]"><X size={16} /></button>
            </div>
          ) : (
            <button onClick={() => setAddingRoom(true)} className="w-full py-3 rounded-xl border border-dashed border-[#2e2e50] text-[#9090bb] text-sm flex items-center justify-center gap-2 hover:border-[#d4b870]/50">
              <Plus size={16} />部屋を追加
            </button>
          )}
        </div>
      </div>

      {/* Table room assignment */}
      <div className="bg-[#141430] border border-[#2e2e50] rounded-xl p-4">
        <h2 className="text-xs font-semibold text-[#9090bb] tracking-widest uppercase mb-3">テーブル割り当て</h2>
        <div className="space-y-2">
          {state.tables.map(table => (
            <div key={table.id} className="flex items-center gap-3 bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-4 py-3">
              <span className="text-white text-sm w-20 shrink-0">{table.name}</span>
              <select value={table.roomId} onChange={e => dispatch({ type: 'MOVE_TABLE_ROOM', payload: { tableId: table.id, roomId: e.target.value } })} className="flex-1 bg-[#1a1a3a] text-white rounded-lg px-3 py-1.5 text-sm outline-none border border-[#2e2e50] focus:border-[#d4b870]/50">
                {state.rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Table position editor */}
      <div className="bg-[#141430] border border-[#2e2e50] rounded-xl p-4">
        <h2 className="text-xs font-semibold text-[#9090bb] tracking-widest uppercase mb-3">テーブル配置</h2>
        <p className="text-xs text-[#9090bb] mb-3">X/Y座標でフロアマップ上の位置を設定します</p>
        <div className="space-y-2">
          {state.tables.map(table => (
            <div key={table.id} className="flex items-center gap-2 bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-3 py-2">
              <span className="text-white text-sm w-16 shrink-0 font-semibold">{table.name}</span>
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-xs text-[#9090bb] w-4">X</span>
                <button onClick={() => table.position.x > 1 && dispatch({ type: 'UPDATE_TABLE_POSITION', payload: { tableId: table.id, position: { x: table.position.x - 1, y: table.position.y } } })} className="w-7 h-7 rounded-lg bg-[#141430] border border-[#2e2e50] text-white flex items-center justify-center text-sm">−</button>
                <span className="text-white w-5 text-center text-sm font-bold">{table.position.x}</span>
                <button onClick={() => dispatch({ type: 'UPDATE_TABLE_POSITION', payload: { tableId: table.id, position: { x: table.position.x + 1, y: table.position.y } } })} className="w-7 h-7 rounded-lg bg-[#141430] border border-[#2e2e50] text-white flex items-center justify-center text-sm">＋</button>
                <span className="text-xs text-[#9090bb] w-4 ml-2">Y</span>
                <button onClick={() => table.position.y > 1 && dispatch({ type: 'UPDATE_TABLE_POSITION', payload: { tableId: table.id, position: { x: table.position.x, y: table.position.y - 1 } } })} className="w-7 h-7 rounded-lg bg-[#141430] border border-[#2e2e50] text-white flex items-center justify-center text-sm">−</button>
                <span className="text-white w-5 text-center text-sm font-bold">{table.position.y}</span>
                <button onClick={() => dispatch({ type: 'UPDATE_TABLE_POSITION', payload: { tableId: table.id, position: { x: table.position.x, y: table.position.y + 1 } } })} className="w-7 h-7 rounded-lg bg-[#141430] border border-[#2e2e50] text-white flex items-center justify-center text-sm">＋</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---- Admin Page ----
export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('report')

  return (
    <div className="min-h-screen bg-[#0a0a18] text-white flex flex-col">
      <header className="bg-[#0a0a18] border-b border-[#2e2e50] px-4 py-3 text-center sticky top-0 z-10">
        <p className="text-xs text-[#9090bb] tracking-[0.2em]">☽</p>
        <h1 className="text-lg font-bold tracking-[0.3em] text-[#d4b870] uppercase">LUNA ADMIN</h1>
      </header>

      <div className="flex border-b border-[#2e2e50] bg-[#0a0a18] sticky top-[57px] z-10">
        {TAB_CONFIG.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-semibold tracking-wider border-b-2 transition-colors ${tab === t.id ? 'border-[#d4b870] text-[#d4b870]' : 'border-transparent text-[#9090bb]'}`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'report' && <ReportTab />}
        {tab === 'shift' && <ShiftTab />}
        {tab === 'cast' && <CastManagementTab />}
        {tab === 'menu' && <MenuManagementTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </div>
  )
}
