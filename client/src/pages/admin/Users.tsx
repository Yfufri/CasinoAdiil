import { useEffect, useState } from 'react'
import api from '../../api'

interface User {
  id: number
  username: string
  role: string
  credits: number
  created_at: string
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  // Création de compte
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')
  const [creating, setCreating] = useState(false)

  // Ajustement crédits
  const [adjustId, setAdjustId] = useState<number | null>(null)
  const [adjustDelta, setAdjustDelta] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjustLoading, setAdjustLoading] = useState(false)

  // Reset password
  const [resetId, setResetId] = useState<number | null>(null)
  const [resetPwd, setResetPwd] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    try {
      const { data } = await api.get('/users/')
      setUsers(data)
    } finally {
      setLoading(false)
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setCreateError('')
    setCreateSuccess('')
    setCreating(true)
    try {
      const { data } = await api.post('/auth/register', { username: newUsername, password: newPassword })
      setCreateSuccess(`Compte "${data.user.username}" créé avec 500 jetons.`)
      setNewUsername('')
      setNewPassword('')
      loadUsers()
    } catch (err: any) {
      setCreateError(err.response?.data?.error || 'Erreur')
    } finally {
      setCreating(false)
    }
  }

  async function adjustCredits() {
    if (!adjustId || !adjustDelta || !adjustReason) return
    setAdjustLoading(true)
    try {
      await api.patch(`/users/${adjustId}/credits`, { delta: parseInt(adjustDelta), reason: adjustReason })
      setAdjustId(null)
      setAdjustDelta('')
      setAdjustReason('')
      loadUsers()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur')
    } finally {
      setAdjustLoading(false)
    }
  }

  async function resetPassword() {
    if (!resetId || !resetPwd) return
    setResetLoading(true)
    try {
      await api.patch(`/users/${resetId}/password`, { password: resetPwd })
      alert('Mot de passe mis à jour.')
      setResetId(null)
      setResetPwd('')
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur')
    } finally {
      setResetLoading(false)
    }
  }

  const totalCredits = users.reduce((s, u) => s + u.credits, 0)

  return (
    <div className="space-y-6 fade-in-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-casino text-2xl text-casino-gold">Gestion des joueurs</h1>
        <span className="text-sm text-gray-400">{users.length} participant(s) · {totalCredits.toLocaleString()} jetons virtuels en circulation</span>
      </div>

      {/* Création de compte */}
      <div className="card">
        <h2 className="font-semibold mb-4">Créer un compte participant</h2>
        <form onSubmit={createUser} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            className="input"
            placeholder="Nom d'utilisateur"
            value={newUsername}
            onChange={e => setNewUsername(e.target.value)}
          />
          <input
            className="input"
            type="password"
            placeholder="Mot de passe"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={creating || !newUsername || !newPassword}
          >
            {creating ? 'Création...' : '+ Créer (500 jetons)'}
          </button>
        </form>
        {createError && <p className="text-red-400 text-sm mt-2">{createError}</p>}
        {createSuccess && <p className="text-green-400 text-sm mt-2">{createSuccess}</p>}
      </div>

      {/* Ajustement crédits */}
      {adjustId && (
        <div className="card border-casino-gold/30">
          <h2 className="font-semibold mb-3">Ajuster les crédits — {users.find(u => u.id === adjustId)?.username}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              className="input"
              type="number"
              placeholder="Delta (ex: -50 ou +100)"
              value={adjustDelta}
              onChange={e => setAdjustDelta(e.target.value)}
            />
            <input
              className="input"
              placeholder="Raison (ex: Bonus événement)"
              value={adjustReason}
              onChange={e => setAdjustReason(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                className="btn-primary flex-1"
                onClick={adjustCredits}
                disabled={adjustLoading || !adjustDelta || !adjustReason}
              >
                Valider
              </button>
              <button className="btn-ghost px-3" onClick={() => setAdjustId(null)}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password */}
      {resetId && (
        <div className="card border-red-700/30">
          <h2 className="font-semibold mb-3 text-red-400">Réinitialiser le mot de passe — {users.find(u => u.id === resetId)?.username}</h2>
          <div className="flex gap-3">
            <input
              className="input"
              type="password"
              placeholder="Nouveau mot de passe"
              value={resetPwd}
              onChange={e => setResetPwd(e.target.value)}
            />
            <button className="btn-red px-4" onClick={resetPassword} disabled={resetLoading || !resetPwd}>Valider</button>
            <button className="btn-ghost px-3" onClick={() => setResetId(null)}>Annuler</button>
          </div>
        </div>
      )}

      {/* Tableau */}
      <div className="card">
        {loading ? (
          <p className="text-gray-500 text-sm">Chargement...</p>
        ) : users.length === 0 ? (
          <p className="text-gray-500 text-sm">Aucun participant</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-casino-border text-left">
                <th className="py-2">#</th>
                <th className="py-2">Nom d'utilisateur</th>
                <th className="py-2 text-right">Jetons</th>
                <th className="py-2 text-center">Inscription</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} className="border-b border-casino-border/50 hover:bg-white/5">
                  <td className="py-2 text-gray-600">{i + 1}</td>
                  <td className="py-2 font-medium">{u.username}</td>
                  <td className="py-2 text-right font-casino text-casino-gold">{u.credits.toLocaleString()}</td>
                  <td className="py-2 text-center text-gray-500 text-xs">
                    {new Date(u.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        className="text-xs btn-ghost py-1 px-2"
                        onClick={() => { setAdjustId(u.id); setAdjustDelta(''); setAdjustReason('') }}
                      >
                        Crédits
                      </button>
                      <button
                        className="text-xs text-red-400 border border-red-800 rounded px-2 py-1 hover:bg-red-900/30"
                        onClick={() => { setResetId(u.id); setResetPwd('') }}
                      >
                        MDP
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
