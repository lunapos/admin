// 管理画面からの操作を audit_logs に記録する共通ヘルパー。
//
// iOS 側の AuditLogger（lunapos-floor/.../Services/AuditLogger.swift）と
// 同じテーブルに書き込む。売上・金銭・キャスト評価に影響する操作は必ず記録する。
//
// fire-and-forget（await しても失敗で例外を投げない）。ログの失敗で
// 本来の操作を止めないため。

import { supabase, requireTenantId } from './supabase'

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'checkout'
  | 'cancel'
  | 'discount'
  | 'priceOverride'
  | 'settingsChange'

export interface AuditLogParams {
  action: AuditAction
  targetTable: string
  targetId?: string | null
  oldValue?: Record<string, unknown> | null
  newValue?: Record<string, unknown> | null
}

/** 操作者の識別子を返す。ログイン中のユーザーがいればそのメール/ID を使う */
async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser()
    const user = data?.user
    if (!user) return null
    return user.email ?? user.id
  } catch {
    return null
  }
}

export async function writeAuditLog(params: AuditLogParams): Promise<void> {
  try {
    const tid = requireTenantId()
    const userId = await currentUserId()

    // target_id は UUID カラムなので、UUID でない値は new_value に退避する
    const isUuid = params.targetId
      ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.targetId)
      : false

    const newValue = { ...(params.newValue ?? {}) }
    if (params.targetId && !isUuid) {
      newValue.target_ref = params.targetId
    }

    await supabase.from('audit_logs').insert({
      tenant_id: tid,
      user_id: userId,
      action: params.action,
      target_table: params.targetTable,
      target_id: isUuid ? params.targetId : null,
      old_value: params.oldValue ?? null,
      new_value: Object.keys(newValue).length > 0 ? newValue : null,
    })
  } catch {
    // ログ失敗で本来の操作を妨げない
  }
}
