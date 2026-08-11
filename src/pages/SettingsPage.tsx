import { useState, useEffect } from 'react'
import { Check, AlertTriangle, Copy, Trash2 } from 'lucide-react'
import { supabase, requireTenantId } from '../lib/supabase'
import type { StoreRow, RoundingType } from '../types'

interface DeviceRow {
  id: string
  device_name: string
  device_token: string
}

export default function SettingsPage() {
  const [store, setStore] = useState<StoreRow | null>(null)
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // フォーム状態
  const [form, setForm] = useState({
    name: '',
    address: '',
    phone: '',
    service_rate: '',
    tax_rate: '',
    douhan_fee: '',
    nomination_fee_main: '',
    nomination_fee_in_store: '',
    invoice_registration_number: '',
    enable_drop_off: true,
    rounding_unit: 1,
    rounding_type: 'none' as RoundingType,
    receipt_default_proviso: '',
    receipt_proviso_presets: [] as string[],
  })

  useEffect(() => { fetchStore(); fetchDevices() }, [])

  async function fetchStore() {
    setLoading(true)
    setFetchError(null)
    try {
      const tid = requireTenantId()
      const { data, error } = await supabase.from('stores')
        .select('id, name, address, phone, service_rate, tax_rate, douhan_fee, nomination_fee_main, nomination_fee_in_store, invoice_registration_number, enable_drop_off, rounding_unit, rounding_type, receipt_default_proviso, receipt_proviso_presets, created_at, updated_at')
        .eq('id', tid)
        .single()
      if (error) throw new Error(error.message)
      if (data) {
        const s = data as StoreRow
        setStore(s)
        setForm({
          name: s.name,
          address: s.address || '',
          phone: s.phone || '',
          service_rate: String(Math.round(s.service_rate * 100)),
          tax_rate: String(Math.round(s.tax_rate * 100)),
          douhan_fee: String(s.douhan_fee),
          nomination_fee_main: String(s.nomination_fee_main),
          nomination_fee_in_store: String(s.nomination_fee_in_store),
          invoice_registration_number: s.invoice_registration_number || '',
          enable_drop_off: s.enable_drop_off ?? true,
          rounding_unit: s.rounding_unit ?? 1,
          rounding_type: s.rounding_type ?? 'none',
          receipt_default_proviso: s.receipt_default_proviso || '',
          receipt_proviso_presets: s.receipt_proviso_presets ?? [],
        })
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'データの取得に失敗しました。ページを再読み込みしてください。')
    }
    setLoading(false)
  }

  async function fetchDevices() {
    try {
      const tid = requireTenantId()
      const { data, error } = await supabase.from('devices')
        .select('id, device_name, device_token')
        .eq('tenant_id', tid)
        .order('created_at')
      if (error) throw new Error(error.message)
      if (data) setDevices(data as DeviceRow[])
    } catch (e) {
      console.error('デバイス取得失敗:', e)
    }
  }

  function copyToken(token: string) {
    navigator.clipboard.writeText(token)
    showToast('コピーしました')
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2000) }

  // インボイス番号バリデーション（T + 13桁数字）
  function validateInvoiceNumber(num: string): boolean {
    if (!num) return true // 空はOK
    return /^T\d{13}$/.test(num)
  }

  async function handleSave() {
    if (!form.name.trim()) return

    // インボイス番号チェック
    if (form.invoice_registration_number && !validateInvoiceNumber(form.invoice_registration_number)) {
      showToast('インボイス番号はT+13桁数字の形式で入力してください')
      return
    }

    setConfirmOpen(false)
    setSaving(true)
    try {
      const tid = requireTenantId()
      const { error } = await supabase.from('stores').update({
        name: form.name.trim(),
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        service_rate: (parseFloat(form.service_rate) || 0) / 100,
        tax_rate: (parseFloat(form.tax_rate) || 0) / 100,
        douhan_fee: parseInt(form.douhan_fee) || 0,
        nomination_fee_main: parseInt(form.nomination_fee_main) || 0,
        nomination_fee_in_store: parseInt(form.nomination_fee_in_store) || 0,
        invoice_registration_number: form.invoice_registration_number || null,
        enable_drop_off: form.enable_drop_off,
        rounding_unit: form.rounding_unit,
        rounding_type: form.rounding_type,
        receipt_default_proviso: form.receipt_default_proviso.trim() || null,
        receipt_proviso_presets: form.receipt_proviso_presets.filter(p => p.trim()),
        updated_at: new Date().toISOString(),
      }).eq('id', tid)
      if (error) throw new Error(error.message)
      showToast('店舗設定を保存しました')
      fetchStore()
    } catch (e) {
      alert(e instanceof Error ? e.message : '保存に失敗しました')
    }
    setSaving(false)
  }

  if (loading) return <div className="text-center py-10 text-[#9090bb]">読み込み中...</div>
  if (fetchError) return <div className="bg-red-900/40 border border-red-500/50 rounded-xl px-4 py-3 text-red-300 text-sm">{fetchError}</div>
  if (!store) return <div className="text-center py-10 text-[#9090bb]">店舗データが見つかりません</div>

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold text-white">店舗設定</h1>

      <div className="bg-[#141430] rounded-xl border border-[#2e2e50] p-6 space-y-5">
        {/* 店舗名 */}
        <div>
          <label className="text-xs text-[#9090bb] tracking-widest uppercase block mb-2">店舗名</label>
          <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-4 py-3 text-white outline-none focus:border-[#d4b870]/50" />
        </div>

        {/* 料率 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-[#9090bb] tracking-widest uppercase block mb-2">消費税率 (%)</label>
            <input type="number" value={form.tax_rate} onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))}
              className="w-full bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-4 py-3 text-white outline-none focus:border-[#d4b870]/50" min="0" max="100" />
          </div>
          <div>
            <label className="text-xs text-[#9090bb] tracking-widest uppercase block mb-2">サービス料率 (%)</label>
            <input type="number" value={form.service_rate} onChange={e => setForm(f => ({ ...f, service_rate: e.target.value }))}
              className="w-full bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-4 py-3 text-white outline-none focus:border-[#d4b870]/50" min="0" max="100" />
          </div>
        </div>

        {/* 指名料・同伴料 */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-[#9090bb] tracking-widest uppercase block mb-2">本指名料（税込）</label>
            <input type="number" value={form.nomination_fee_main} onChange={e => setForm(f => ({ ...f, nomination_fee_main: e.target.value }))}
              className="w-full bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-4 py-3 text-white outline-none focus:border-[#d4b870]/50" min="0" />
          </div>
          <div>
            <label className="text-xs text-[#9090bb] tracking-widest uppercase block mb-2">場内指名料（税込）</label>
            <input type="number" value={form.nomination_fee_in_store} onChange={e => setForm(f => ({ ...f, nomination_fee_in_store: e.target.value }))}
              className="w-full bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-4 py-3 text-white outline-none focus:border-[#d4b870]/50" min="0" />
          </div>
          <div>
            <label className="text-xs text-[#9090bb] tracking-widest uppercase block mb-2">同伴料（税込）</label>
            <input type="number" value={form.douhan_fee} onChange={e => setForm(f => ({ ...f, douhan_fee: e.target.value }))}
              className="w-full bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-4 py-3 text-white outline-none focus:border-[#d4b870]/50" min="0" />
          </div>
        </div>

        {/* 端数処理 */}
        <div>
          <label className="text-xs text-[#9090bb] tracking-widest uppercase block mb-3">端数処理（合計金額）</label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[#9090bb] block mb-2">単位</label>
              <div className="flex gap-2">
                {([1, 10, 100] as const).map(unit => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, rounding_unit: unit, rounding_type: unit === 1 ? 'none' : f.rounding_type === 'none' ? 'floor' : f.rounding_type }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${form.rounding_unit === unit ? 'bg-[#d4b870] text-black' : 'bg-[#0f0f28] border border-[#2e2e50] text-[#9090bb]'}`}
                  >
                    {unit === 1 ? 'なし' : `${unit}円`}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-[#9090bb] block mb-2">方式</label>
              <div className="flex gap-2">
                {([['floor', '切り捨て'], ['ceil', '切り上げ'], ['round', '四捨五入']] as [RoundingType, string][]).map(([type, label]) => (
                  <button
                    key={type}
                    type="button"
                    disabled={form.rounding_unit === 1}
                    onClick={() => setForm(f => ({ ...f, rounding_type: type }))}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-30 ${form.rounding_type === type && form.rounding_unit !== 1 ? 'bg-[#d4b870] text-black' : 'bg-[#0f0f28] border border-[#2e2e50] text-[#9090bb]'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {form.rounding_unit !== 1 && (
            <p className="text-xs text-[#9090bb] mt-2">
              例: ¥15,234 → {
                form.rounding_type === 'floor' ? `¥${(Math.floor(15234 / form.rounding_unit) * form.rounding_unit).toLocaleString()}` :
                form.rounding_type === 'ceil' ? `¥${(Math.ceil(15234 / form.rounding_unit) * form.rounding_unit).toLocaleString()}` :
                `¥${(Math.round(15234 / form.rounding_unit) * form.rounding_unit).toLocaleString()}`
              }（税込）
            </p>
          )}
        </div>

        {/* インボイス */}
        <div>
          <label className="text-xs text-[#9090bb] tracking-widest uppercase block mb-2">インボイス登録番号</label>
          <input type="text" value={form.invoice_registration_number} onChange={e => setForm(f => ({ ...f, invoice_registration_number: e.target.value }))}
            placeholder="T1234567890123"
            className={`w-full bg-[#0f0f28] border rounded-xl px-4 py-3 text-white placeholder-[#3a3a5e] outline-none focus:border-[#d4b870]/50 ${
              form.invoice_registration_number && !validateInvoiceNumber(form.invoice_registration_number)
                ? 'border-red-500' : 'border-[#2e2e50]'
            }`} />
          <p className="text-xs text-[#9090bb] mt-1">T + 13桁数字。未設定の場合はレシートにインボイス情報を印字しません。</p>
        </div>

        {/* 領収書 */}
        <div className="pt-2 border-t border-[#2e2e50]">
          <label className="text-xs text-[#9090bb] tracking-widest uppercase block mb-3">領収書</label>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-[#9090bb] block mb-2">住所</label>
              <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="東京都新宿区..."
                className="w-full bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-4 py-3 text-white placeholder-[#3a3a5e] outline-none focus:border-[#d4b870]/50" />
            </div>
            <div>
              <label className="text-xs text-[#9090bb] block mb-2">電話番号</label>
              <input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="03-1234-5678"
                className="w-full bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-4 py-3 text-white placeholder-[#3a3a5e] outline-none focus:border-[#d4b870]/50" />
            </div>
          </div>
          <p className="text-xs text-[#9090bb] mb-4 -mt-2">領収書・レシートの発行者欄に印字します。</p>

          <div className="mb-4">
            <label className="text-xs text-[#9090bb] block mb-2">但し書きの初期値</label>
            <input type="text" value={form.receipt_default_proviso} onChange={e => setForm(f => ({ ...f, receipt_default_proviso: e.target.value }))}
              placeholder="お品代として"
              className="w-full bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-4 py-3 text-white placeholder-[#3a3a5e] outline-none focus:border-[#d4b870]/50" />
            <p className="text-xs text-[#9090bb] mt-1">POSの領収書発行画面に最初から入っている但し書きです。空にすると但し書きは印字されず、手書き用の罫線が出ます。</p>
          </div>

          <div>
            <label className="text-xs text-[#9090bb] block mb-2">但し書きの選択肢</label>
            <div className="space-y-2">
              {form.receipt_proviso_presets.map((preset, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="text" value={preset}
                    onChange={e => setForm(f => ({
                      ...f,
                      receipt_proviso_presets: f.receipt_proviso_presets.map((p, j) => j === i ? e.target.value : p),
                    }))}
                    className="flex-1 bg-[#0f0f28] border border-[#2e2e50] rounded-xl px-4 py-2.5 text-white outline-none focus:border-[#d4b870]/50" />
                  <button type="button"
                    onClick={() => setForm(f => ({
                      ...f,
                      receipt_proviso_presets: f.receipt_proviso_presets.filter((_, j) => j !== i),
                    }))}
                    className="px-3 py-2.5 text-[#9090bb] hover:text-red-400 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button"
              onClick={() => setForm(f => ({ ...f, receipt_proviso_presets: [...f.receipt_proviso_presets, ''] }))}
              className="mt-2 text-sm text-[#d4b870] hover:text-[#e5c98a] transition-colors">
              + 選択肢を追加
            </button>
            <p className="text-xs text-[#9090bb] mt-2">POSの領収書発行画面で、但し書きをここから選べるようになります。空欄のまま保存した行は削除されます。</p>
          </div>
        </div>

        {/* キャスト向け機能 */}
        <div>
          <label className="text-xs text-[#9090bb] tracking-widest uppercase block mb-3">キャスト向け機能</label>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm text-white">送り先機能</p>
              <p className="text-xs text-[#9090bb] mt-0.5">キャスト画面のマイページに送り先入力欄を表示する</p>
            </div>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, enable_drop_off: !f.enable_drop_off }))}
              className={`relative w-12 h-6 rounded-full transition-colors ${form.enable_drop_off ? 'bg-[#d4b870]' : 'bg-[#2e2e50]'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${form.enable_drop_off ? 'translate-x-6' : ''}`} />
            </button>
          </label>
        </div>

        {/* 保存ボタン */}
        <div className="flex items-center gap-4 pt-4 border-t border-[#2e2e50]">
          <button onClick={() => setConfirmOpen(true)} disabled={saving || !form.name.trim()}
            className="px-6 py-3 rounded-xl bg-[#d4b870] text-black font-bold disabled:opacity-30">
            {saving ? '保存中...' : '設定を保存'}
          </button>
        </div>
      </div>

      {/* デバイストークン（表示・コピーのみ） */}
      {devices.length > 0 && (
        <div className="bg-[#141430] rounded-xl border border-[#2e2e50] p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">iPadデバイストークン</h2>
          <p className="text-xs text-[#9090bb]">iPadのLunaPOSアプリでこのトークンを入力するとPOSが使えます。</p>
          <div className="space-y-2">
            {devices.map(d => (
              <div key={d.id} className="flex items-center gap-3 bg-[#0f0f28] border border-[#2e2e50] rounded-lg px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#9090bb]">{d.device_name}</p>
                  <p className="font-mono text-[#d4b870] tracking-wider">{d.device_token}</p>
                </div>
                <button onClick={() => copyToken(d.device_token)}
                  className="p-2 rounded-lg hover:bg-[#2e2e50] text-[#9090bb] hover:text-white shrink-0" title="コピー">
                  <Copy size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 確認ダイアログ */}
      {confirmOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setConfirmOpen(false)}>
          <div className="bg-[#141430] border border-[#2e2e50] rounded-xl p-6 max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle size={20} className="text-amber-400" />
              <h3 className="text-white font-semibold">設定を変更しますか？</h3>
            </div>
            <p className="text-sm text-[#9090bb] mb-6">
              料金設定の変更は、今後の新規来店に適用されます。既存の来店・会計データには影響しません。
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmOpen(false)} className="px-4 py-2 rounded-lg text-sm text-[#9090bb] bg-[#0f0f28]">キャンセル</button>
              <button onClick={handleSave} className="px-4 py-2 rounded-lg text-sm font-bold bg-[#d4b870] text-black">保存する</button>
            </div>
          </div>
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
