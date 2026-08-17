import { useState } from 'react'

/** Pantalla de entrada. Sin sesión, es lo único que se ve. */
export default function Login({ onLogged }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [entrando, setEntrando] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setEntrando(true)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No pude entrar')
      onLogged(data.user)
    } catch (err) {
      setError(err.message)
      setEntrando(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo" aria-hidden="true">🥭</div>
        <h1>Manguito</h1>
        <p className="login-sub">Entrá para ver tus gastos</p>

        <label className="field">
          <span className="field-label">Usuario</span>
          <input
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">Contraseña</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <div className="login-error" role="alert">{error}</div>}

        <button className="primary" type="submit" disabled={entrando}>
          {entrando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
