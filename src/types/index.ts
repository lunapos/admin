export type TableStatus = 'empty' | 'occupied' | 'waiting_checkout'

export interface Room {
  id: string
  name: string
}

export interface Table {
  id: string
  name: string
  capacity: number
  status: TableStatus
  position: { x: number; y: number }
  visitId?: string
  roomId: string
}

export interface Cast {
  id: string
  stageName: string
  realName: string
  isWorking: boolean
  clockInTime?: string
  clockOutTime?: string
  photo?: string
}

export interface Customer {
  id: string
  name: string
  phone?: string
  visitCount: number
  totalSpend: number
  notes?: string
  rank: 'new' | 'repeat' | 'vip'
  favoriteCastId?: string
}

export type MenuCategory = 'drink' | 'bottle' | 'food' | 'ladies_drink' | 'other'

export interface MenuItem {
  id: string
  name: string
  price: number
  category: MenuCategory
  isActive: boolean
}

export interface OrderItem {
  id: string
  menuItemId: string
  menuItemName: string
  price: number
  quantity: number
  isExpense?: boolean  // 建て替え: サービス料・消費税なし
  castId?: string
  note?: string
}

export type NominationType = 'none' | 'in_store' | 'main'

export interface CastNomination {
  castId: string
  nominationType: NominationType
}

export interface Visit {
  id: string
  tableId: string
  customerId?: string
  customerName?: string
  guestCount: number
  nominations: CastNomination[]   // 複数指名対応
  douhanCastId?: string           // 同伴キャストのID
  checkInTime: string
  checkOutTime?: string
  orderItems: OrderItem[]
  setMinutes: number
  isCheckedOut: boolean
}

export type PaymentMethod = 'cash' | 'credit' | 'electronic' | 'tab'

export interface Payment {
  id: string
  visitId: string
  tableId: string
  customerName?: string
  subtotal: number
  expenseTotal: number    // 建て替え合計（サービス料・消費税なし）
  nominationFee: number
  serviceFee: number
  tax: number
  discount: number
  total: number
  paymentMethod: PaymentMethod
  paidAt: string
  items: OrderItem[]
}

export interface ShiftEntry {
  castId: string
  date: string      // YYYY-MM-DD
  startTime: string  // HH:mm
  endTime: string    // HH:mm
}

export interface SetPlan {
  id: string
  name: string
  durationMinutes: number
  price: number
  isActive: boolean
}

export interface AppState {
  isLoggedIn: boolean
  rooms: Room[]
  tables: Table[]
  casts: Cast[]
  customers: Customer[]
  menuItems: MenuItem[]
  visits: Visit[]
  payments: Payment[]
  setPlans: SetPlan[]
  currentVisitId?: string
}
