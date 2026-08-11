import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase, getHomeTenantId, setActiveStoreId, getTenantId } from '../lib/supabase'
import { useAuth } from './AuthContext'

export interface StoreOption {
  id: string
  name: string
}

interface StoreContextValue {
  stores: StoreOption[]        // 自分が閲覧できる店舗一覧（系列店含む）
  activeStoreId: string | null // 現在閲覧中の店舗ID
  switchStore: (id: string) => void
  loading: boolean
}

const StoreContext = createContext<StoreContextValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [stores, setStores] = useState<StoreOption[]>([])
  const [activeStoreId, setActiveStoreIdState] = useState<string | null>(getTenantId())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setStores([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    // RLSにより、自店舗 + 同一グループの系列店のみが返る
    supabase
      .from('stores')
      .select('id, name')
      .order('name')
      .then(({ data, error }) => {
        if (cancelled) return
        // ログイン直後の閲覧先（=自店舗）をローカル状態に反映
        setActiveStoreIdState(getTenantId())
        if (error || !data) {
          // 取得失敗時は自店舗のみのフォールバック
          const home = getHomeTenantId()
          setStores(home ? [{ id: home, name: '自店舗' }] : [])
          setLoading(false)
          return
        }
        setStores(data)
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [user])

  const switchStore = (id: string) => {
    setActiveStoreId(id)
    setActiveStoreIdState(id)
  }

  return (
    <StoreContext.Provider value={{ stores, activeStoreId, switchStore, loading }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
