import { useEffect, useState } from 'react'
import api from '../api'

interface Stats {
  leaderboard: { id: number; username: string; credits: number }[]
  casino: {
    roulettePnl: number
    physicalCirculation: number
    totalCredits: number
    rouletteGames: number
  }
  hotColdNumbers: Record<number, number>
  lastResults: { result_number: number; created_at: string }[]
}

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36])
function getColor(n: number) {
  if (n === 0) return 'green'
  return RED_NUMBERS.has(n) ? 'red' : 'black'
}

function NumberBadge({ n, size = 'md' }: { n: number; size?: 'sm' | 'md' | 'lg' }) {
  const color = getColor(n)
  const sizeClass = size === 'sm' ? 'w-7 h-7 text-xs' : size === 'lg' ? 'w-10 h-10 text-base' : 'w-8 h-8 text-sm'
  const bg = color === 'red' ? 'bg-red-600' : color === 'black' ? 'bg-gray-800 border border-gray-600' : 'bg-green-700'
  return (
    <span className={`inline-flex items-center justify-center rounded-full font-bold ${sizeClass} ${bg}`}>
      {n}
    </span>
  )
}

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get('/stats')
        setStats(data)
      } finally {
        setLoading(false)
      }
    }
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <div className="text-casino-gold text-xl animate-pulse font-casino">Chargement...</div>
    </div>
  )

  if (!stats) return null

  // Hot/cold numbers — top 5 hot, top 5 cold (excluant 0 appearances)
  const numberEntries = Object.entries(stats.hotColdNumbers)
    .map(([n, c]) => ({ n: parseInt(n), c }))
    .filter(x => x.n >= 0)

  const sorted = [...numberEntries].sort((a, b) => b.c - a.c)
  const hotNumbers = sorted.filter(x => x.c > 0).slice(0, 5)
  const coldNumbers = sorted.filter(x => x.c >= 0).reverse().slice(0, 5)

  return (
    <div className="space-y-6 fade-in-up">
      {/* Header */}
      <div className="text-center py-6">
        <h1 className="font-casino text-4xl text-casino-gold mb-2">Casino Adiil</h1>
        <p className="text-gray-400">Soirée Casino — Bienvenue !</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaderboard */}
        <div className="lg:col-span-2 card">
          <h2 className="font-casino text-xl text-casino-gold mb-4">Classement</h2>
          {stats.leaderboard.length === 0 ? (
            <p className="text-gray-500 text-sm">Aucun participant pour le moment</p>
          ) : (
            <div className="space-y-2">
              {stats.leaderboard.map((p, i) => (
                <div key={p.id}
                  className={`flex items-center gap-3 py-2 px-3 rounded-lg ${i === 0 ? 'bg-casino-gold/10 border border-casino-gold/30' : 'border border-casino-border'}`}
                >
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                    i === 0 ? 'bg-casino-gold text-black' :
                    i === 1 ? 'bg-gray-400 text-black' :
                    i === 2 ? 'bg-amber-700 text-white' :
                    'bg-casino-border text-gray-400'
                  }`}>
                    {i + 1}
                  </span>
                  <span className="flex-1 font-medium">{p.username}</span>
                  <span className={`font-semibold tabular-nums ${i === 0 ? 'text-casino-gold' : 'text-gray-300'}`}>
                    {p.credits.toLocaleString()} <span className="text-gray-500 font-normal text-xs">jetons</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats casino */}
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-casino text-lg text-casino-gold mb-3">Stats Casino</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">P&L Roulette</span>
                <span className={`font-semibold ${stats.casino.roulettePnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {stats.casino.roulettePnl >= 0 ? '+' : ''}{stats.casino.roulettePnl.toLocaleString()}
                </span>
              </div>
              <div className="border-t border-casino-border pt-3 flex justify-between items-center">
                <span className="text-gray-400">Jetons physiques</span>
                <span className="text-yellow-400 font-semibold">{stats.casino.physicalCirculation.toLocaleString()}</span>
              </div>
              <p className="text-xs text-gray-600 italic">
                ⚠ Le P&L total ne peut être calculé qu'en fin d'event (retour des jetons physiques)
              </p>
              <div className="border-t border-casino-border pt-3 flex justify-between items-center">
                <span className="text-gray-400">Parties roulette</span>
                <span className="text-gray-300">{stats.casino.rouletteGames}</span>
              </div>
            </div>
          </div>

          {/* Hot/Cold */}
          <div className="card">
            <h2 className="font-casino text-lg text-casino-gold mb-3">Numéros chauds 🔥</h2>
            <div className="flex flex-wrap gap-2">
              {hotNumbers.length === 0 ? (
                <p className="text-gray-500 text-xs">Aucune partie jouée</p>
              ) : hotNumbers.map(({ n, c }) => (
                <div key={n} className="flex flex-col items-center gap-1">
                  <NumberBadge n={n} size="md" />
                  <span className="text-xs text-gray-500">{c}x</span>
                </div>
              ))}
            </div>
            <h2 className="font-casino text-lg text-casino-gold mt-4 mb-3">Numéros froids ❄️</h2>
            <div className="flex flex-wrap gap-2">
              {coldNumbers.map(({ n, c }) => (
                <div key={n} className="flex flex-col items-center gap-1">
                  <NumberBadge n={n} size="md" />
                  <span className="text-xs text-gray-500">{c}x</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Derniers résultats roulette */}
      {stats.lastResults.length > 0 && (
        <div className="card">
          <h2 className="font-casino text-lg text-casino-gold mb-4">Derniers résultats</h2>
          <div className="flex flex-wrap gap-2">
            {stats.lastResults.map((r, i) => (
              <NumberBadge key={i} n={r.result_number} size="md" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
