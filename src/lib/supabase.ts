import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mkzhepsntwnbtgfazflw.supabase.co'
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ログインユーザー本来のテナントID（JWTのtenant_id = 書き込み権限を持つ自店舗）
let homeTenantId: string | null = null

// 現在閲覧中の店舗ID（系列店舗を切り替えて閲覧する場合に変わる）
// 初期値は homeTenantId と同じ
let activeStoreId: string | null = null

// ログイン時に呼ばれる。自店舗を確定し、閲覧先も自店舗にリセットする
// （別ユーザーで再ログインした場合に前回の閲覧先が残らないようにする）
export function setTenantId(id: string) {
  homeTenantId = id
  activeStoreId = id
}

// ログインユーザー本来のテナントID（書き込みはこの店舗に対して行う）
export function getHomeTenantId(): string | null {
  return homeTenantId
}

// 閲覧中の店舗を切り替える（系列店舗ビュー用）
export function setActiveStoreId(id: string) {
  activeStoreId = id
}

export function getTenantId(): string | null {
  return activeStoreId
}

// テナントID必須の関数（未設定時はthrow）。閲覧中の店舗IDを返す。
export function requireTenantId(): string {
  if (!activeStoreId) throw new Error('テナントIDが未設定です')
  return activeStoreId
}
