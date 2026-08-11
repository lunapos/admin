import { useState, useEffect, useRef } from 'react'
import { Plus, Pencil, X, Check, Trash2, GripVertical } from 'lucide-react'
import { supabase, requireTenantId } from '../lib/supabase'
import type { FloorTableRow, RoomRow } from '../types'

export default function TablesPage() {
  const [tables, setTables] = useState<FloorTableRow[]>([])
  const [rooms, setRooms] = useState<RoomRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [fetchError, setFetchError] = useState<string | null>(null)

  // テーブルフォーム
  const [showTableForm, setShowTableForm] = useState(false)
  const [editingTableId, setEditingTableId] = useState<string | null>(null)
  const [tableForm, setTableForm] = useState({ name: '', capacity: '4', room_id: '', position_x: '1', position_y: '1' })

  // ルームフォーム
  const [showRoomForm, setShowRoomForm] = useState(false)
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null)
  const [roomForm, setRoomForm] = useState({ name: '' })

  // ドラッグ&ドロップ
  const [dragItem, setDragItem] = useState<string | null>(null)
  const [dragOverItem, setDragOverItem] = useState<string | null>(null)
  const dragRoomId = useRef<string | null>(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    setFetchError(null)
    try {
      const tid = requireTenantId()
      const [tablesRes, roomsRes] = await Promise.all([
        supabase.from('floor_tables')
          .select('id, tenant_id, room_id, name, capacity, status, position_x, position_y, sort_order, visit_id, created_at, updated_at')
          .eq('tenant_id', tid).order('sort_order').order('name'),
        supabase.from('rooms')
          .select('id, tenant_id, name, sort_order, created_at, updated_at')
          .eq('tenant_id', tid).order('sort_order'),
      ])
      if (tablesRes.error) throw new Error(tablesRes.error.message)
      if (roomsRes.error) throw new Error(roomsRes.error.message)
      setTables((tablesRes.data || []) as FloorTableRow[])
      setRooms((roomsRes.data || []) as RoomRow[])
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'データの取得に失敗しました。ページを再読み込みしてください。')
    }
    setLoading(false)
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2000) }

  // --- ルーム CRUD ---
  async function saveRoom() {
    if (!roomForm.name.trim()) return
    try {
      const tid = requireTenantId()
      if (editingRoomId) {
        const { error } = await supabase.from('rooms').update({ name: roomForm.name.trim(), updated_at: new Date().toISOString() })
          .eq('id', editingRoomId).eq('tenant_id', tid)
        if (error) throw new Error(error.message)
        showToast('ルームを更新しました')
      } else {
        const { error } = await supabase.from('rooms').insert({ tenant_id: tid, name: roomForm.name.trim(), sort_order: rooms.length })
        if (error) throw new Error(error.message)
        showToast('ルームを追加しました')
      }
      setShowRoomForm(false); setEditingRoomId(null); setRoomForm({ name: '' })
      fetchAll()
    } catch (e) {
      alert(e instanceof Error ? e.message : '保存に失敗しました')
    }
  }

  async function deleteRoom(room: RoomRow) {
    if (rooms.length <= 1) return
    const tablesInRoom = tables.filter(t => t.room_id === room.id)
    if (tablesInRoom.some(t => t.status !== 'empty')) {
      showToast('使用中のテーブルがあるため削除できません')
      return
    }
    if (!confirm(`「${room.name}」を削除しますか？テーブルは別のルームに移動されます。`)) return
    try {
      const tid = requireTenantId()
      const fallbackRoom = rooms.find(r => r.id !== room.id)!
      if (tablesInRoom.length > 0) {
        const { error } = await supabase.from('floor_tables').update({ room_id: fallbackRoom.id }).eq('room_id', room.id).eq('tenant_id', tid)
        if (error) throw new Error(error.message)
      }
      const { error } = await supabase.from('rooms').delete().eq('id', room.id).eq('tenant_id', tid)
      if (error) throw new Error(error.message)
      showToast('ルームを削除しました')
      fetchAll()
    } catch (e) {
      alert(e instanceof Error ? e.message : '削除に失敗しました')
    }
  }

  // --- テーブル CRUD ---
  async function saveTable() {
    if (!tableForm.name.trim() || !tableForm.room_id) return
    try {
      const tid = requireTenantId()
      if (editingTableId) {
        const { error } = await supabase.from('floor_tables').update({
          name: tableForm.name.trim(),
          capacity: parseInt(tableForm.capacity) || 4,
          room_id: tableForm.room_id,
          position_x: parseInt(tableForm.position_x) || 1,
          position_y: parseInt(tableForm.position_y) || 1,
          updated_at: new Date().toISOString(),
        }).eq('id', editingTableId).eq('tenant_id', tid)
        if (error) throw new Error(error.message)
        showToast('テーブルを更新しました')
      } else {
        const roomTables = tables.filter(t => t.room_id === tableForm.room_id)
        const maxSort = roomTables.length > 0 ? Math.max(...roomTables.map(t => t.sort_order)) + 1 : 0
        const { error } = await supabase.from('floor_tables').insert({
          tenant_id: tid,
          name: tableForm.name.trim(),
          capacity: parseInt(tableForm.capacity) || 4,
          room_id: tableForm.room_id,
          position_x: parseInt(tableForm.position_x) || 1,
          position_y: parseInt(tableForm.position_y) || 1,
          sort_order: maxSort,
          status: 'empty',
        })
        if (error) throw new Error(error.message)
        showToast('テーブルを追加しました')
      }
      setShowTableForm(false); setEditingTableId(null)
      setTableForm({ name: '', capacity: '4', room_id: rooms[0]?.id || '', position_x: '1', position_y: '1' })
      fetchAll()
    } catch (e) {
      alert(e instanceof Error ? e.message : '保存に失敗しました')
    }
  }

  async function deleteTable(table: FloorTableRow) {
    if (table.status !== 'empty') {
      showToast('使用中のテーブルは削除できません')
      return
    }
    if (!confirm(`「${table.name}」を削除しますか？`)) return
    try {
      const tid = requireTenantId()
      const { error } = await supabase.from('floor_tables').delete().eq('id', table.id).eq('tenant_id', tid)
      if (error) throw new Error(error.message)
      showToast('テーブルを削除しました')
      fetchAll()
    } catch (e) {
      alert(e instanceof Error ? e.message : '削除に失敗しました')
    }
  }

  // --- ドラッグ&ドロップで並び替え ---
  function handleDragStart(tableId: string, roomId: string) {
    setDragItem(tableId)
    dragRoomId.current = roomId
  }

  function handleDragOver(e: React.DragEvent, tableId: string) {
    e.preventDefault()
    setDragOverItem(tableId)
  }

  async function handleDrop(targetId: string, roomId: string) {
    if (!dragItem || dragItem === targetId || dragRoomId.current !== roomId) {
      setDragItem(null)
      setDragOverItem(null)
      return
    }

    const roomTables = tables
      .filter(t => t.room_id === roomId)
      .sort((a, b) => a.sort_order - b.sort_order)

    const fromIdx = roomTables.findIndex(t => t.id === dragItem)
    const toIdx = roomTables.findIndex(t => t.id === targetId)
    if (fromIdx === -1 || toIdx === -1) return

    const reordered = [...roomTables]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)

    // ローカル状態を即座に更新
    const updatedTables = tables.map(t => {
      const idx = reordered.findIndex(r => r.id === t.id)
      if (idx !== -1) return { ...t, sort_order: idx }
      return t
    })
    setTables(updatedTables)

    // DBに保存
    const tid = requireTenantId()
    await Promise.all(
      reordered.map((t, idx) =>
        supabase.from('floor_tables')
          .update({ sort_order: idx, updated_at: new Date().toISOString() })
          .eq('id', t.id)
          .eq('tenant_id', tid)
      )
    )

    setDragItem(null)
    setDragOverItem(null)
    showToast('並び順を更新しました')
  }

  if (loading) return <div className="text-center py-10 text-[#9090bb]">読み込み中...</div>

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">テーブル・ルーム管理</h1>

      {fetchError && (
        <div className="bg-red-900/40 border border-red-500/50 rounded-xl px-4 py-3 text-red-300 text-sm">
          {fetchError}
        </div>
      )}

      {/* ルーム管理 */}
      <div className="bg-[#141430] rounded-xl border border-[#2e2e50] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[#9090bb] tracking-widest uppercase">ルーム</h2>
          <button onClick={() => { setShowRoomForm(true); setEditingRoomId(null); setRoomForm({ name: '' }) }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#d4b870] text-black text-xs font-bold">
            <Plus size={14} />追加
          </button>
        </div>

        {showRoomForm && (
          <div className="flex items-center gap-2 mb-4">
            <input type="text" placeholder="ルーム名" value={roomForm.name} onChange={e => setRoomForm({ name: e.target.value })}
              className="flex-1 bg-[#0f0f28] border border-[#2e2e50] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#d4b870]/50" autoFocus />
            <button onClick={saveRoom} className="px-4 py-2 rounded-lg bg-[#d4b870] text-black text-sm font-bold">
              {editingRoomId ? '更新' : '追加'}
            </button>
            <button onClick={() => { setShowRoomForm(false); setEditingRoomId(null) }} className="p-2 text-[#9090bb]"><X size={16} /></button>
          </div>
        )}

        <div className="space-y-2">
          {rooms.map(room => (
            <div key={room.id} className="flex items-center gap-3 bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-4 py-3">
              <span className="flex-1 text-white text-sm">{room.name}</span>
              <span className="text-xs text-[#9090bb]">{tables.filter(t => t.room_id === room.id).length}卓</span>
              <button onClick={() => { setEditingRoomId(room.id); setRoomForm({ name: room.name }); setShowRoomForm(true) }}
                className="p-1.5 rounded-lg bg-[#141430] text-[#9090bb] hover:text-[#d4b870]"><Pencil size={14} /></button>
              <button onClick={() => deleteRoom(room)} disabled={rooms.length <= 1}
                className={`p-1.5 rounded-lg ${rooms.length <= 1 ? 'bg-[#0f0f28] text-[#2e2e50]' : 'bg-[#141430] text-red-400'}`}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </div>

      {/* テーブル管理 */}
      <div className="bg-[#141430] rounded-xl border border-[#2e2e50] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-[#9090bb] tracking-widest uppercase">テーブル</h2>
            <span className="text-[10px] text-[#9090bb]/60">ドラッグで並び替え → POSに反映</span>
          </div>
          <button onClick={() => {
            setShowTableForm(true); setEditingTableId(null)
            setTableForm({ name: '', capacity: '4', room_id: rooms[0]?.id || '', position_x: '1', position_y: '1' })
          }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#d4b870] text-black text-xs font-bold">
            <Plus size={14} />追加
          </button>
        </div>

        {showTableForm && (
          <div className="grid grid-cols-2 gap-3 mb-4 bg-[#0f0f28] border border-[#2e2e50] rounded-xl p-4">
            <input type="text" placeholder="テーブル名 *" value={tableForm.name} onChange={e => setTableForm(f => ({ ...f, name: e.target.value }))}
              className="bg-[#141430] border border-[#2e2e50] rounded-lg px-3 py-2 text-white text-sm outline-none" />
            <input type="number" placeholder="定員" value={tableForm.capacity} onChange={e => setTableForm(f => ({ ...f, capacity: e.target.value }))}
              className="bg-[#141430] border border-[#2e2e50] rounded-lg px-3 py-2 text-white text-sm outline-none" min="1" />
            <select value={tableForm.room_id} onChange={e => setTableForm(f => ({ ...f, room_id: e.target.value }))}
              className="bg-[#141430] border border-[#2e2e50] rounded-lg px-3 py-2 text-white text-sm outline-none">
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <div className="flex gap-2">
              <input type="number" placeholder="X" value={tableForm.position_x} onChange={e => setTableForm(f => ({ ...f, position_x: e.target.value }))}
                className="flex-1 bg-[#141430] border border-[#2e2e50] rounded-lg px-3 py-2 text-white text-sm outline-none" min="1" />
              <input type="number" placeholder="Y" value={tableForm.position_y} onChange={e => setTableForm(f => ({ ...f, position_y: e.target.value }))}
                className="flex-1 bg-[#141430] border border-[#2e2e50] rounded-lg px-3 py-2 text-white text-sm outline-none" min="1" />
            </div>
            <div className="col-span-2 flex gap-2">
              <button onClick={saveTable} className="px-4 py-2 rounded-lg bg-[#d4b870] text-black text-sm font-bold">
                {editingTableId ? '更新' : '追加'}
              </button>
              <button onClick={() => { setShowTableForm(false); setEditingTableId(null) }} className="px-4 py-2 rounded-lg bg-[#141430] text-[#9090bb] text-sm">キャンセル</button>
            </div>
          </div>
        )}

        {rooms.map(room => {
          const roomTables = tables
            .filter(t => t.room_id === room.id)
            .sort((a, b) => a.sort_order - b.sort_order)

          return (
            <div key={room.id} className="mb-6">
              <h3 className="text-sm text-white font-medium mb-3">{room.name}</h3>
              <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                {roomTables.map(table => {
                  const statusColor = table.status === 'occupied' ? 'border-emerald-500 bg-emerald-900/20'
                    : table.status === 'waiting_checkout' ? 'border-amber-500 bg-amber-900/20'
                    : 'border-[#2e2e50] bg-[#0f0f28]'
                  const isDragOver = dragOverItem === table.id && dragItem !== table.id
                  return (
                    <div
                      key={table.id}
                      draggable
                      onDragStart={() => handleDragStart(table.id, room.id)}
                      onDragOver={(e) => handleDragOver(e, table.id)}
                      onDragEnd={() => { setDragItem(null); setDragOverItem(null) }}
                      onDrop={() => handleDrop(table.id, room.id)}
                      className={`rounded-xl border p-3 text-center cursor-grab active:cursor-grabbing transition-all ${statusColor} ${
                        isDragOver ? 'ring-2 ring-[#d4b870] scale-105' : ''
                      } ${dragItem === table.id ? 'opacity-40' : ''}`}
                    >
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <GripVertical size={10} className="text-[#9090bb]/40" />
                        <span className="text-sm font-semibold text-white">{table.name}</span>
                      </div>
                      <div className="text-[10px] text-[#9090bb]">{table.capacity}名</div>
                      <div className="flex gap-1 mt-2 justify-center">
                        <button onClick={() => {
                          setEditingTableId(table.id)
                          setTableForm({
                            name: table.name, capacity: String(table.capacity), room_id: table.room_id,
                            position_x: String(table.position_x), position_y: String(table.position_y),
                          })
                          setShowTableForm(true)
                        }} className="p-1 rounded bg-[#141430] text-[#9090bb] hover:text-[#d4b870]"><Pencil size={10} /></button>
                        <button onClick={() => deleteTable(table)} className="p-1 rounded bg-[#141430] text-[#9090bb] hover:text-red-400"><Trash2 size={10} /></button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-emerald-900/90 border border-emerald-700 text-emerald-300 px-4 py-3 rounded-xl text-sm flex items-center gap-2 shadow-lg z-50">
          <Check size={16} />{toast}
        </div>
      )}
    </div>
  )
}
