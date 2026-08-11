import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  BarChart3, Users, ShoppingBag, Settings, TableProperties,
  Clock, LogOut, Menu, X, ChevronRight, Home, Wallet, TrendingUp, ScrollText, Store, Receipt,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useStore } from '../contexts/StoreContext'
import { getHomeTenantId } from '../lib/supabase'

const NAV_ITEMS = [
  { path: '/', label: 'ダッシュボード', icon: BarChart3 },
  { path: '/sales-slips', label: '売上伝票一覧', icon: Receipt },
  { path: '/cast-sales', label: 'キャスト別売上', icon: TrendingUp },
  { path: '/menu', label: 'メニュー管理', icon: ShoppingBag },
  { path: '/casts', label: 'キャスト管理', icon: Users },
  { path: '/tables', label: 'テーブル管理', icon: TableProperties },
  { path: '/plans', label: 'セットプラン', icon: Clock },
  { path: '/register', label: 'レジ金・入出金', icon: Wallet },
  { path: '/audit-logs', label: '操作ログ', icon: ScrollText },
  { path: '/settings', label: '店舗設定', icon: Settings },
]

// パンくずリスト用マッピング
const BREADCRUMB_LABELS: Record<string, string> = {
  '/': 'ダッシュボード',
  '/sales-slips': '売上伝票一覧',
  '/cast-sales': 'キャスト別売上',
  '/menu': 'メニュー管理',
  '/casts': 'キャスト管理',
  '/tables': 'テーブル管理',
  '/plans': 'セットプラン',
  '/register': 'レジ金・入出金',
  '/audit-logs': '操作ログ',
  '/settings': '店舗設定',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const { user, signOut } = useAuth()
  const { stores, activeStoreId, switchStore } = useStore()

  const currentPath = location.pathname

  // パンくずリスト生成
  const breadcrumbs = [
    { path: '/', label: 'ホーム' },
  ]
  if (currentPath !== '/') {
    breadcrumbs.push({
      path: currentPath,
      label: BREADCRUMB_LABELS[currentPath] || currentPath.split('/').pop() || '',
    })
  }

  return (
    <div className="min-h-screen bg-[#0a0a18] text-white flex">
      {/* モバイルオーバーレイ */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* サイドバー */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 w-64 bg-[#0f0f28] border-r border-[#2e2e50] flex flex-col z-50 transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* ロゴ */}
        <div className="p-6 border-b border-[#2e2e50]">
          <p className="text-xs text-[#9090bb] tracking-[0.2em] text-center mb-1">&#9789;</p>
          <h1 className="text-lg font-bold tracking-[0.3em] text-[#d4b870] uppercase text-center">
            LUNA ADMIN
          </h1>
        </div>

        {/* ナビゲーション */}
        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map(item => {
            const isActive = currentPath === item.path
            const Icon = item.icon
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#d4b870]/10 text-[#d4b870] border border-[#d4b870]/30'
                    : 'text-[#9090bb] hover:bg-[#141430] hover:text-white'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* ユーザー情報 */}
        <div className="p-4 border-t border-[#2e2e50]">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-[#d4b870]/20 flex items-center justify-center text-[#d4b870] text-xs font-bold">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white truncate">{user?.email || '---'}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-[#9090bb] hover:bg-red-900/20 hover:text-red-400 transition-colors"
          >
            <LogOut size={16} />
            ログアウト
          </button>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* ヘッダー */}
        <header className="bg-[#0a0a18] border-b border-[#2e2e50] px-4 py-3 flex items-center gap-4 sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg bg-[#141430] border border-[#2e2e50] text-[#9090bb]"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          {/* パンくずリスト */}
          <div className="flex items-center gap-2 text-sm">
            {breadcrumbs.map((bc, idx) => (
              <div key={bc.path} className="flex items-center gap-2">
                {idx > 0 && <ChevronRight size={14} className="text-[#3a3a5e]" />}
                {idx === 0 ? (
                  <Link to={bc.path} className="text-[#9090bb] hover:text-white flex items-center gap-1">
                    <Home size={14} />
                    {bc.label}
                  </Link>
                ) : (
                  <span className="text-white font-medium">{bc.label}</span>
                )}
              </div>
            ))}
          </div>

          {/* 店舗切替（系列店が複数ある場合のみ表示） */}
          {stores.length > 1 && (
            <div className="ml-auto flex items-center gap-2">
              <Store size={16} className="text-[#d4b870]" />
              <select
                value={activeStoreId ?? ''}
                onChange={e => switchStore(e.target.value)}
                className="bg-[#141430] border border-[#2e2e50] text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#d4b870]"
              >
                {stores.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
        </header>

        {/* 系列店（自店舗以外）を閲覧中は読み取り専用である旨を明示 */}
        {activeStoreId && activeStoreId !== getHomeTenantId() && (
          <div className="bg-[#d4b870]/10 border-b border-[#d4b870]/30 text-[#d4b870] text-xs px-6 py-2">
            系列店の閲覧モードです。売上・データの確認のみ可能で、設定変更や編集は各店舗のアカウントから行ってください。
          </div>
        )}

        {/* ページコンテンツ（店舗切替時は再マウントして再取得させる） */}
        <main key={activeStoreId ?? 'none'} className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
