import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { signIn, resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) setError(error)
    setLoading(false)
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    setError('')
    const { error } = await resetPassword(email)
    if (error) {
      setError(error)
    } else {
      setResetSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0a0a18] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* ロゴ */}
        <div className="text-center mb-8">
          <p className="text-2xl text-[#9090bb] mb-2">&#9789;</p>
          <h1 className="text-2xl font-bold tracking-[0.3em] text-[#d4b870] uppercase">LUNA ADMIN</h1>
          <p className="text-xs text-[#9090bb] mt-2 tracking-wider">管理画面ログイン</p>
        </div>

        {resetMode ? (
          // パスワードリセット
          <form onSubmit={handleReset} className="space-y-4">
            {resetSent ? (
              <div className="bg-emerald-900/20 border border-emerald-800/50 rounded-xl p-4 text-sm text-emerald-400">
                パスワードリセット用のメールを送信しました。メールをご確認ください。
              </div>
            ) : (
              <>
                <p className="text-sm text-[#9090bb] text-center">
                  登録済みのメールアドレスを入力してください
                </p>
                <input
                  type="email"
                  placeholder="メールアドレス"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-[#141430] border border-[#2e2e50] rounded-xl px-4 py-3 text-white placeholder-[#3a3a5e] outline-none focus:border-[#d4b870]/50"
                  autoFocus
                />
                {error && (
                  <p className="text-xs text-red-400">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full py-3 rounded-xl bg-[#d4b870] text-black font-bold tracking-wider disabled:opacity-30"
                >
                  {loading ? '送信中...' : 'リセットメールを送信'}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => { setResetMode(false); setResetSent(false); setError('') }}
              className="w-full text-sm text-[#9090bb] hover:text-[#d4b870]"
            >
              ログインに戻る
            </button>
          </form>
        ) : (
          // ログイン
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              placeholder="メールアドレス"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-[#141430] border border-[#2e2e50] rounded-xl px-4 py-3 text-white placeholder-[#3a3a5e] outline-none focus:border-[#d4b870]/50"
              autoFocus
            />
            <input
              type="password"
              placeholder="パスワード"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#141430] border border-[#2e2e50] rounded-xl px-4 py-3 text-white placeholder-[#3a3a5e] outline-none focus:border-[#d4b870]/50"
            />
            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-3 rounded-xl bg-[#d4b870] text-black font-bold tracking-wider disabled:opacity-30"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
            <button
              type="button"
              onClick={() => { setResetMode(true); setError('') }}
              className="w-full text-sm text-[#9090bb] hover:text-[#d4b870]"
            >
              パスワードを忘れた場合
            </button>
            <Link
              to="/signup"
              className="block w-full text-sm text-center text-[#9090bb] hover:text-[#d4b870]"
            >
              新規登録はこちら
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
