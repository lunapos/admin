// ========================================
// Luna Admin 型定義（Supabase DB対応）
// ========================================

export type TableStatus = 'empty' | 'occupied' | 'waiting_checkout'
export type MenuCategory = 'drink' | 'whisky' | 'shochu' | 'champagne' | 'red_wine' | 'white_wine' | 'food' | 'ladies_drink' | 'other'
export type NominationType = 'none' | 'in_store' | 'main'
export type PaymentMethod = 'cash' | 'credit' | 'electronic' | 'tab'
export type CustomerRank = 'new' | 'repeat' | 'vip'
export type RoundingType = 'none' | 'floor' | 'ceil' | 'round'

// --- Supabase Row型 ---

export interface StoreRow {
  id: string
  name: string
  /** 領収書・レシートの発行者欄に印字する */
  address: string | null
  phone: string | null
  service_rate: number
  tax_rate: number
  douhan_fee: number
  nomination_fee_main: number
  nomination_fee_in_store: number
  invoice_registration_number: string | null
  enable_drop_off: boolean
  rounding_unit: number
  rounding_type: RoundingType
  /** 領収書の但し書き。空なら印字せず手書き用の罫線を出す */
  receipt_default_proviso: string | null
  /** 領収書の但し書きの選択肢 */
  receipt_proviso_presets: string[]
  created_at: string
  updated_at: string
}

export interface RoomRow {
  id: string
  tenant_id: string
  name: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CastRow {
  id: string
  tenant_id: string
  stage_name: string
  real_name: string
  photo_url: string | null
  drop_off_location: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface MenuItemRow {
  id: string
  tenant_id: string
  name: string
  price: number
  category: MenuCategory
  is_active: boolean
  sort_order: number
  /** バック率（0〜1）。back_amount が設定されていればそちらが優先される */
  back_rate: number | null
  /** 1点あたりのバック額（円）。設定されていれば back_rate より優先 */
  back_amount: number | null
  created_at: string
  updated_at: string
}

export interface SetPlanRow {
  id: string
  tenant_id: string
  name: string
  duration_minutes: number
  price: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface FloorTableRow {
  id: string
  tenant_id: string
  room_id: string
  name: string
  capacity: number
  status: TableStatus
  position_x: number
  position_y: number
  sort_order: number
  visit_id: string | null
  created_at: string
  updated_at: string
}

export interface VisitRow {
  id: string
  tenant_id: string
  table_id: string
  customer_id: string | null
  customer_name: string | null
  guest_count: number
  douhan_cast_id: string | null
  douhan_qty: number
  check_in_time: string
  check_out_time: string | null
  set_minutes: number
  extension_minutes: number
  set_price_override: number | null
  douhan_fee_override: number | null
  is_checked_out: boolean
  created_at: string
  updated_at: string
}

export interface NominationRow {
  id: string
  tenant_id: string
  visit_id: string
  cast_id: string
  nomination_type: NominationType
  qty: number
  fee_override: number | null
  created_at: string
  updated_at: string
}

// キャスト売上の配分。会計時に自動生成され、必要なときだけ手動調整する。
// 1会計に紐づく amount の合計は payments.subtotal と一致する。
export interface CastSaleRow {
  id: string
  tenant_id: string
  visit_id: string
  payment_id: string | null
  cast_id: string
  amount: number
  is_adjusted: boolean
  adjusted_by: string | null
  adjusted_at: string | null
  note: string | null
  created_at: string
  updated_at: string
}

// キャストバック（店がキャストに支払う歩合）。
// 会計時にメニューのバック設定から自動生成され、本指名のキャストに按分される。
// cast_sales（誰の売上か）とは別で、合計が subtotal と一致する制約はない。
export interface CastBackRow {
  id: string
  tenant_id: string
  visit_id: string
  payment_id: string | null
  cast_id: string
  order_item_id: string | null
  menu_item_name: string
  amount: number
  is_adjusted: boolean
  adjusted_by: string | null
  adjusted_at: string | null
  note: string | null
  created_at: string
  updated_at: string
}

export interface PaymentRow {
  id: string
  tenant_id: string
  visit_id: string
  table_id: string
  customer_name: string | null
  subtotal: number
  expense_total: number
  nomination_fee: number
  service_fee: number
  tax: number
  discount: number
  total: number
  payment_method: PaymentMethod
  paid_at: string
  created_at: string
  updated_at: string
}

export interface CastShiftRow {
  id: string
  tenant_id: string
  cast_id: string
  clock_in: string
  clock_out: string | null
  scheduled_clock_in: string | null
  scheduled_clock_out: string | null
  created_at: string
  updated_at: string
}

export interface CustomerRow {
  id: string
  tenant_id: string
  name: string
  phone: string | null
  visit_count: number
  total_spend: number
  notes: string | null
  rank: CustomerRank
  favorite_cast_id: string | null
  created_at: string
  updated_at: string
}

export interface OrderItemRow {
  id: string
  tenant_id: string
  visit_id: string
  menu_item_id: string
  menu_item_name: string
  price: number
  quantity: number
  is_expense: boolean
  cast_id: string | null
  note: string | null
  created_at: string
  updated_at: string
}

/** 入出金区分: deposit=入金 / withdrawal=出金 */
export type CashEntryType = 'deposit' | 'withdrawal'

export interface CashWithdrawalRow {
  id: string
  tenant_id: string
  amount: number
  /** 金額は常に正の数。入出金の向きは entry_type で表現する */
  entry_type: CashEntryType
  category: string | null
  note: string | null
  /** 論理削除日時。null = 有効な記録 */
  deleted_at: string | null
  deleted_by: string | null
  delete_reason: string | null
  created_at: string
  updated_at: string
}

export interface RegisterSessionRow {
  id: string
  tenant_id: string
  business_date: string
  start_amount: number
  created_at: string
  updated_at: string
}

// --- UI表示用型 ---

export interface DailySummary {
  date: string
  totalSales: number
  visitCount: number
  guestCount: number
  avgSpend: number
  cashTotal: number
  cardTotal: number
  electronicTotal: number
  tabTotal: number
  nominationCount: number
}

export interface CastRanking {
  castId: string
  stageName: string
  photoUrl: string | null
  nominations: number
  sales: number
  drinkCount: number
}

export interface HourlyData {
  hour: number
  count: number
}

export interface AuditLogRow {
  id: string
  tenant_id: string
  user_id: string | null
  action: string
  target_table: string
  target_id: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}
