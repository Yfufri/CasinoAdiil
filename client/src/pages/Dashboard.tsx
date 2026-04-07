import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'
import api from '../api'

interface Log {
  id: number
  delta: number
  reason: string
  created_at: string
}

export default function Dashboard() {
  const { user } = useAuth()
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/users/me/logs').then(r => {
      setLogs(r.data)
      setLoading(false)
    })
  }, [])

  return (
    <div className="max-w-2xl mx-auto space-y-6 fade-in-up">
      {/* Solde */}
      <div className="card text-center py-8">
        <p className="text-gray-400 text-sm mb-2">Votre solde</p>
        <p className="font-casino text-5xl text-casino-gold mb-1">{user?.credits.toLocaleString()}</p>
        <p className="text-gray-500 text-sm">jetons virtuels</p>
        <div className="flex justify-center gap-3 mt-6">
          <Link to="/exchange" className="btn-primary">Table d'échange</Link>
          <Link to="/roulette" className="btn-green">Table Roulette</Link>
        </div>
      </div>

      {/* Historique */}
      <div className="card">
        <h2 className="text-lg font-casino text-casino-gold mb-4">Historique des transactions</h2>
        {loading ? (
          <p className="text-gray-500 text-sm">Chargement...</p>
        ) : logs.length === 0 ? (
          <p className="text-gray-500 text-sm">Aucune transaction pour le moment</p>
        ) : (
          <div className="space-y-2">
            {logs.map(log => (
              <div key={log.id} className="flex items-center justify-between py-2 border-b border-casino-border last:border-0">
                <div>
                  <p className="text-sm text-gray-300">{log.reason}</p>
                  <p className="text-xs text-gray-600">
                    {new Date(log.created_at).toLocaleString('fr-FR')}
                  </p>
                </div>
                <span className={`font-semibold text-sm ${log.delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {log.delta >= 0 ? '+' : ''}{log.delta.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
