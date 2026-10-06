import { useEffect, useState } from 'react'
import { getSocket } from '../../socket'
import api from '../../api'

interface ExchangeRequest {
  id: number
  participant_id: number
  username: string
  user_credits: number
  direction: 'to_physical' | 'to_virtual'
  amount: number
  status: 'pending' | 'approved' | 'rejected'
  note?: string
  created_at: string
}

export default function AdminExchange() {
  const [pending, setPending] = useState<ExchangeRequest[]>([])
  const [history, setHistory] = useState<ExchangeRequest[]>([])
  const [loading, setLoading] = useState<Record<number, boolean>>({})
  const [note, setNote] = useState<Record<number, string>>({})
  const [tab, setTab] = useState<'pending' | 'history'>('pending')

  useEffect(() => {
    loadPending()
    loadHistory()
    const socket = getSocket()
    socket.on('exchange:update', () => { loadPending(); loadHistory() })
    return () => { socket.off('exchange:update') }
  }, [])

  async function loadPending() {
    const { data } = await api.get('/exchange/pending')
    setPending(data)
  }

  async function loadHistory() {
    const { data } = await api.get('/exchange/all')
    setHistory(data.filter((r: ExchangeRequest) => r.status !== 'pending'))
  }

  async function process(id: number, status: 'approved' | 'rejected') {
    setLoading(l => ({ ...l, [id]: true }))
    try {
      await api.patch(`/exchange/${id}`, { status, note: note[id] || null })
      loadPending()
      loadHistory()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur')
    } finally {
      setLoading(l => ({ ...l, [id]: false }))
    }
  }

  return (
    <div className="space-y-6 fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="font-casino text-2xl text-casino-gold">Table des échanges — Admin</h1>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
          pending.length > 0 ? 'bg-yellow-500/20 text-yellow-400 pulse-gold' : 'bg-casino-border text-gray-400'
        }`}>
          {pending.length} en attente
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-casino-border pb-2">
        <button onClick={() => setTab('pending')} className={`pb-2 text-sm font-medium border-b-2 transition-colors ${tab === 'pending' ? 'border-casino-gold text-casino-gold' : 'border-transparent text-gray-400'}`}>
          En attente {pending.length > 0 && <span className="ml-1 bg-yellow-500 text-black text-xs px-1.5 rounded-full">{pending.length}</span>}
        </button>
        <button onClick={() => setTab('history')} className={`pb-2 text-sm font-medium border-b-2 transition-colors ${tab === 'history' ? 'border-casino-gold text-casino-gold' : 'border-transparent text-gray-400'}`}>
          Historique
        </button>
      </div>

      {tab === 'pending' && (
        <div className="space-y-3">
          {pending.length === 0 ? (
            <div className="card text-center py-10 text-gray-500">
              Aucune demande en attente ✓
            </div>
          ) : pending.map(req => (
            <div key={req.id} className="card border-l-4 border-l-yellow-500">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{req.username}</span>
                    <span className="text-xs text-gray-500">({req.user_credits.toLocaleString()} jetons après)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium px-2 py-0.5 rounded ${
                      req.direction === 'to_physical'
                        ? 'bg-blue-900/40 text-blue-400'
                        : 'bg-purple-900/40 text-purple-400'
                    }`}>
                      {req.direction === 'to_physical' ? 'Virtuel → Physique' : 'Physique → Virtuel'}
                    </span>
                    <span className="text-casino-gold font-bold text-lg">{req.amount} jetons</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{new Date(req.created_at).toLocaleTimeString('fr-FR')}</p>
                </div>

                <div className="flex flex-col gap-2 min-w-[180px]">
                  <input
                    className="input text-xs py-1"
                    placeholder="Note (optionnel)"
                    value={note[req.id] || ''}
                    onChange={e => setNote(n => ({ ...n, [req.id]: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <button
                      className="btn-green flex-1 text-sm py-2"
                      disabled={loading[req.id]}
                      onClick={() => process(req.id, 'approved')}
                    >
                      ✓ Valider
                    </button>
                    <button
                      className="btn-red flex-1 text-sm py-2"
                      disabled={loading[req.id]}
                      onClick={() => process(req.id, 'rejected')}
                    >
                      ✗ Refuser
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div className="card">
          {history.length === 0 ? (
            <p className="text-gray-500 text-sm">Aucun échange traité</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-casino-border">
                  <th className="text-left py-2">Joueur</th>
                  <th className="text-left py-2">Type</th>
                  <th className="text-right py-2">Montant</th>
                  <th className="text-center py-2">Statut</th>
                  <th className="text-left py-2">Note</th>
                  <th className="text-right py-2">Heure</th>
                </tr>
              </thead>
              <tbody>
                {history.map(req => (
                  <tr key={req.id} className="border-b border-casino-border/50 hover:bg-white/5">
                    <td className="py-2 font-medium">{req.username}</td>
                    <td className="py-2 text-gray-400">
                      {req.direction === 'to_physical' ? 'V→P' : 'P→V'}
                    </td>
                    <td className="py-2 text-right text-casino-gold">{req.amount}</td>
                    <td className="py-2 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        req.status === 'approved' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                      }`}>
                        {req.status === 'approved' ? 'Validé' : 'Refusé'}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-gray-500 italic">{req.note || '—'}</td>
                    <td className="py-2 text-right text-gray-500 text-xs">
                      {new Date(req.created_at).toLocaleTimeString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
