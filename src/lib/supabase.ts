import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mkzhepsntwnbtgfazflw.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// テナントID（認証後に設定される）
let tenantId: string | null = null

export function setTenantId(id: string) {
  tenantId = id
}

export function getTenantId(): string | null {
  return tenantId
}
