import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getSocket } from '../socket'
import api from '../api'

interface ExchangeRequest {
  id: number
  direction: 'to_physical' | 'to_virtual'
  amount: number
  status: 'pending' | 'approved' | 'rejected'
  note?: string
  created_at: string
  processed_at?: string
}

const MAX_TO_PHYSICAL = 250

export default function ExchangeTable() {
  const { user } = useAuth()
  const [requests, setRequests] = useState<ExchangeRequest[]>([])
  const [direction, setDirection] = useState<'to_physical' | 'to_virtual'>('to_physical')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadRequests()
    const socket = getSocket()
    socket.on('exchange:mine', (req: ExchangeRequest) => {
      setRequests(prev => prev.map(r => r.id === req.id ? req : r))
    })
    return () => { socket.off('exchange:mine') }
  }, [])

  async function loadRequests() {
    const { data } = await api.get('/exchange/my')
    setRequests(data)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    const amt = parseInt(amount)
    if (!amt || amt <= 0) { setError('Montant invalide'); return }
    setLoading(true)
    try {
      await api.post('/exchange/request', { direction, amount: amt })
      setSuccess(direction === 'to_physical'
        ? `Demande envoyée ! L'admin va vous remettre ${amt} jeton(s) physique(s).`
        : `Demande envoyée ! L'admin va valider votre retour de ${amt} jeton(s) physique(s).`)
      setAmount('')
      loadRequests()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel(id: number) {
    try {
      await api.delete(`/exchange/${id}`)
      loadRequests()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur')
    }
  }

  const pendingRequests = requests.filter(r => r.status === 'pending')

  return (
    <div className="max-w-2xl mx-auto space-y-6 fade-in-up">
      <h1 className="font-casino text-2xl text-casino-gold">Table des échanges</h1>

      {/* Solde */}
      <div className="card flex items-center justify-between">
        <span className="text-gray-400">Votre solde virtuel</span>
        <span className="font-casino text-2xl text-casino-gold">{user?.credits.toLocaleString()} jetons</span>
      </div>

      {/* Formulaire */}
      <div className="card">
        <h2 className="font-semibold mb-4">Nouvelle demande</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Direction */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDirection('to_physical')}
              className={`py-3 rounded-lg border text-sm font-medium transition-all ${
                direction === 'to_physical'
                  ? 'border-casino-gold bg-casino-gold/10 text-casino-gold'
                  : 'border-casino-border text-gray-400 hover:border-gray-400'
              }`}
            >
              Virtuel → Physique
              <p className="text-xs font-normal mt-0.5 opacity-70">max {MAX_TO_PHYSICAL} par échange</p>
            </button>
            <button
              type="button"
              onClick={() => setDirection('to_virtual')}
              className={`py-3 rounded-lg border text-sm font-medium transition-all ${
                direction === 'to_virtual'
                  ? 'border-casino-gold bg-casino-gold/10 text-casino-gold'
                  : 'border-casino-border text-gray-400 hover:border-gray-400'
              }`}
            >
              Physique → Virtuel
              <p className="text-xs font-normal mt-0.5 opacity-70">sans limite</p>
            </button>
          </div>

          {/* Montant */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Montant de jetons
              {direction === 'to_physical' && (
                <span className="ml-2 text-xs text-casino-gold">max {MAX_TO_PHYSICAL}</span>
              )}
            </label>
            <input
              className="input"
              type="number"
              min="1"
              max={direction === 'to_physical' ? MAX_TO_PHYSICAL : undefined}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Ex: 100"
            />
          </div>

          {error && <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-sm">{error}</div>}
          {success && <div className="bg-green-900/30 border border-green-700 rounded-lg px-3 py-2 text-green-300 text-sm">{success}</div>}

          <button
            type="submit"
            className="btn-primary w-full py-3"
            disabled={loading || !amount}
          >
            {loading ? 'Envoi...' : 'Envoyer la demande'}
          </button>
        </form>
      </div>

      {/* En attente */}
      {pendingRequests.length > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-3 text-yellow-400">⏳ En attente de validation ({pendingRequests.length})</h2>
          <div className="space-y-2">
            {pendingRequests.map(req => (
              <div key={req.id} className="flex items-center justify-between py-2 border border-yellow-800/40 rounded-lg px-3 bg-yellow-900/10">
                <div>
                  <p className="text-sm font-medium">
                    {req.direction === 'to_physical' ? '→ Physique' : '← Virtuel'} — {req.amount} jetons
                  </p>
                  <p className="text-xs text-gray-500">{new Date(req.created_at).toLocaleTimeString('fr-FR')}</p>
                </div>
                <button
                  onClick={() => handleCancel(req.id)}
                  className="text-xs text-red-400 hover:text-red-300 border border-red-800 rounded px-2 py-1"
                >
                  Annuler
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historique */}
      <div className="card">
        <h2 className="font-semibold mb-3">Historique de mes échanges</h2>
        {requests.filter(r => r.status !== 'pending').length === 0 ? (
          <p className="text-gray-500 text-sm">Aucun échange effectué</p>
        ) : (
          <div className="space-y-2">
            {requests.filter(r => r.status !== 'pending').map(req => (
              <div key={req.id} className="flex items-center justify-between py-2 border-b border-casino-border last:border-0">
                <div>
                  <p className="text-sm">
                    {req.direction === 'to_physical' ? '→ Physique' : '← Virtuel'} — {req.amount} jetons
                  </p>
                  {req.note && <p className="text-xs text-gray-500 italic">{req.note}</p>}
                  <p className="text-xs text-gray-600">{new Date(req.created_at).toLocaleString('fr-FR')}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  req.status === 'approved' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                }`}>
                  {req.status === 'approved' ? 'Validé' : 'Refusé'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
