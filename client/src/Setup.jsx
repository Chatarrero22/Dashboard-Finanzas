import { useState } from 'react'

/**
 * Primer arranque: no hay ningún usuario todavía.
 * Se ve una sola vez, cuando la app está recién instalada (o recién desplegada
 * en el servidor). Quien la completa queda como administrador.
 */
export default function Setup({ onReady }) {
  const [form, setForm] = useState({ username: '', display_name: '', password: '' })
  const [error, setError] = useState('')
  const [creando, setCreando] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!form.username.trim()) return setError('Elegí un nombre de usuario')
    if (form.password.length < 6) return setError('La contraseña necesita al menos 6 caracteres')

    setCreando(true)
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No pude crear la cuenta')
      onReady(data.user)
    } catch (err) {
      setError(err.message)
      setCreando(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo" aria-hidden="true">🥭</div>
        <h1>Hola, soy Manguito</h1>
        <p className="login-sub">
          Es la primera vez que se abre. Creá tu cuenta y quedás como administrador.
        </p>

        <label className="field">
          <span className="field-label">Usuario (para entrar)</span>
          <input
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="emanuel"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
        </label>

        <label className="field">
          <span className="field-label">Tu nombre</span>
          <input
            placeholder="Emanuel"
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
          />
        </label>

        <label className="field">
          <span className="field-label">Contraseña</span>
          <input
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>

        {error && <div className="login-error" role="alert">{error}</div>}

        <button className="primary" type="submit" disabled={creando}>
          {creando ? 'Creando…' : 'Crear mi cuenta'}
        </button>
        <p className="hint" style={{ textAlign: 'center' }}>
          Después vas a poder sumar más personas desde Ajustes.
        </p>
      </form>
    </div>
  )
}
