import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase'

export default function SignupPage() {
  const navigate = useNavigate()
  const [storeName, setStoreName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<{ device_token: string } | null>(null)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!storeName.trim() || !email || !password) return
    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/store-signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          store_name: storeName.trim(),
          email: email.trim(),
          password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '登録に失敗しました')
        setLoading(false)
        return
      }

      // 登録成功 → デバイストークンを表示
      setDone({ device_token: data.device_token })
    } catch {
      setError('通信エラーが発生しました')
    }
    setLoading(false)
  }

  async function handleLogin() {
    // 自動ログインしてダッシュボードへ
    await supabase.auth.signInWithPassword({ email: email.trim(), password })
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-[#0a0a18] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* ロゴ */}
        <div className="text-center mb-8">
          <p className="text-2xl text-[#9090bb] mb-2">&#9789;</p>
          <h1 className="text-2xl font-bold tracking-[0.3em] text-[#d4b870] uppercase">LUNA ADMIN</h1>
          <p className="text-xs text-[#9090bb] mt-2 tracking-wider">新規登録</p>
        </div>

        {done ? (
          // 登録完了
          <div className="space-y-5">
            <div className="bg-emerald-900/20 border border-emerald-800/50 rounded-xl p-4 text-sm text-emerald-400">
              登録が完了しました
            </div>

            <div className="bg-[#141430] border border-[#2e2e50] rounded-xl p-5 space-y-3">
              <p className="text-xs text-[#9090bb] tracking-widest uppercase">iPad用デバイストークン</p>
              <div className="bg-[#0f0f28] border border-[#d4b870]/30 rounded-lg px-4 py-3 font-mono text-lg text-[#d4b870] text-center tracking-wider select-all">
                {done.device_token}
              </div>
              <p className="text-xs text-[#9090bb]">
                iPadのLunaPOSアプリでこのトークンを入力してください。
                管理画面の「設定」からいつでも確認できます。
              </p>
            </div>

            <button
              onClick={handleLogin}
              className="w-full py-3 rounded-xl bg-[#d4b870] text-black font-bold tracking-wider"
            >
              管理画面へ進む
            </button>
          </div>
        ) : (
          // 登録フォーム
          <form onSubmit={handleSignup} className="space-y-4">
            <input
              type="text"
              placeholder="店舗名"
              value={storeName}
              onChange={e => setStoreName(e.target.value)}
              className="w-full bg-[#141430] border border-[#2e2e50] rounded-xl px-4 py-3 text-white placeholder-[#3a3a5e] outline-none focus:border-[#d4b870]/50"
              autoFocus
            />
            <input
              type="email"
              placeholder="メールアドレス"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-[#141430] border border-[#2e2e50] rounded-xl px-4 py-3 text-white placeholder-[#3a3a5e] outline-none focus:border-[#d4b870]/50"
            />
            <input
              type="password"
              placeholder="パスワード（6文字以上）"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#141430] border border-[#2e2e50] rounded-xl px-4 py-3 text-white placeholder-[#3a3a5e] outline-none focus:border-[#d4b870]/50"
            />
            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || !storeName.trim() || !email || !password}
              className="w-full py-3 rounded-xl bg-[#d4b870] text-black font-bold tracking-wider disabled:opacity-30"
            >
              {loading ? '登録中...' : '無料で登録'}
            </button>
            <Link
              to="/login"
              className="block w-full text-sm text-center text-[#9090bb] hover:text-[#d4b870]"
            >
              アカウントをお持ちの方はログイン
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
