import { useEffect, useState } from 'react'
import { getSocket } from '../../socket'
import api from '../../api'

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36])
function getColor(n: number) {
  if (n === 0) return 'green'
  return RED_NUMBERS.has(n) ? 'red' : 'black'
}

interface Game {
  id: number
  status: 'betting' | 'spinning' | 'result' | 'closed'
  mode: 'emulated' | 'physical'
  result_number: number | null
  casino_delta: number
  bets: any[]
}

const BET_LABELS: Record<string, (v: string) => string> = {
  straight: v => `Plein ${v}`,
  color: v => v === 'red' ? 'Rouge' : 'Noir',
  evenodd: v => v === 'even' ? 'Pair' : 'Impair',
  lowhigh: v => v === 'low' ? '1-18' : '19-36',
  dozen: v => `${v}ème douzaine`,
  column: v => `${v}ème colonne`,
}

export default function AdminRoulette() {
  const [game, setGame] = useState<Game | null>(null)
  const [mode, setMode] = useState<'emulated' | 'physical'>('emulated')
  const [physicalNumber, setPhysicalNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<any[]>([])

  useEffect(() => {
    loadGame()
    loadHistory()
    const socket = getSocket()
    socket.on('roulette:state', (g: Game) => setGame(g))
    socket.on('roulette:bet', () => loadGame())
    socket.on('roulette:result', (data: any) => { setGame({ ...data.game, bets: data.bets }); loadHistory() })
    socket.on('roulette:closed', () => { setGame(null); loadHistory() })
    return () => {
      socket.off('roulette:state')
      socket.off('roulette:bet')
      socket.off('roulette:result')
      socket.off('roulette:closed')
    }
  }, [])

  async function loadGame() {
    try {
      const { data } = await api.get('/roulette/current')
      setGame(data)
    } catch {}
  }

  async function loadHistory() {
    try {
      const { data } = await api.get('/roulette/history')
      setHistory(data)
    } catch {}
  }

  async function startGame() {
    setLoading(true)
    try {
      const { data } = await api.post('/roulette/game', { mode })
      setGame({ ...data, bets: [] })
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  async function changeMode(newMode: 'emulated' | 'physical') {
    if (!game) return
    setLoading(true)
    try {
      await api.patch(`/roulette/game/${game.id}/mode`, { mode: newMode })
      setMode(newMode)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  async function spin() {
    if (!game) return
    setLoading(true)
    try {
      await api.post(`/roulette/game/${game.id}/spin`)
      loadGame()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  async function submitResult() {
    if (!game) return
    const n = parseInt(physicalNumber)
    if (isNaN(n) || n < 0 || n > 36) { alert('Numéro invalide (0-36)'); return }
    setLoading(true)
    try {
      await api.post(`/roulette/game/${game.id}/result`, { resultNumber: n })
      setPhysicalNumber('')
      loadGame()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  async function closeGame() {
    if (!game) return
    setLoading(true)
    try {
      await api.post(`/roulette/game/${game.id}/close`)
      setGame(null)
      loadHistory()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  const totalBets = game?.bets?.reduce((s: number, b: any) => s + b.amount, 0) ?? 0
  const totalPlayers = game ? new Set(game.bets.map((b: any) => b.participant_id)).size : 0
  const isBetting = game?.status === 'betting'
  const isSpinning = game?.status === 'spinning'
  const isResult = game?.status === 'result'

  return (
    <div className="space-y-6 fade-in-up max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-casino text-2xl text-casino-gold">Contrôle Roulette — Admin</h1>
        <a
          href="/roulette/display"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost text-sm"
        >
          📺 Ouvrir l'écran spectateur ↗
        </a>
      </div>

      {/* Pas de partie en cours */}
      {!game && (
        <div className="card">
          <h2 className="font-semibold mb-4">Démarrer une nouvelle partie</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-400 mb-2">Mode de jeu</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMode('emulated')}
                  className={`py-4 rounded-lg border text-sm font-medium transition-all ${mode === 'emulated' ? 'border-casino-gold bg-casino-gold/10 text-casino-gold' : 'border-casino-border text-gray-400 hover:border-gray-400'}`}
                >
                  🎰 Roulette virtuelle
                  <p className="text-xs font-normal mt-1 opacity-70">Résultat aléatoire généré par l'app</p>
                </button>
                <button
                  onClick={() => setMode('physical')}
                  className={`py-4 rounded-lg border text-sm font-medium transition-all ${mode === 'physical' ? 'border-casino-gold bg-casino-gold/10 text-casino-gold' : 'border-casino-border text-gray-400 hover:border-gray-400'}`}
                >
                  🎡 Roulette physique
                  <p className="text-xs font-normal mt-1 opacity-70">Vous entrez le résultat manuellement</p>
                </button>
              </div>
            </div>
            <button
              className="btn-primary w-full py-3 text-base"
              onClick={startGame}
              disabled={loading}
            >
              {loading ? 'Démarrage...' : '▶ Ouvrir les mises'}
            </button>
          </div>
        </div>
      )}

      {/* Partie en cours */}
      {game && (
        <>
          {/* Statut */}
          <div className={`card border-l-4 ${
            isBetting ? 'border-l-green-500' :
            isSpinning ? 'border-l-yellow-500' :
            'border-l-blue-500'
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Partie #{game.id} · {game.mode === 'emulated' ? 'Roulette virtuelle' : 'Roulette physique'}</p>
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-bold ${isBetting ? 'text-green-400' : isSpinning ? 'text-yellow-400 animate-pulse' : 'text-blue-400'}`}>
                    {isBetting && '🟢 Mises ouvertes'}
                    {isSpinning && '🔄 En cours de tirage'}
                    {isResult && `✅ Résultat : ${game.result_number} (${getColor(game.result_number!).toUpperCase()})`}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  {totalPlayers} joueur(s) · {totalBets.toLocaleString()} jetons misés
                  {isResult && ` · Casino : ${game.casino_delta >= 0 ? '+' : ''}${game.casino_delta.toLocaleString()}`}
                </p>
              </div>

              {/* Changer le mode si encore en mises */}
              {isBetting && (
                <div className="flex gap-2">
                  <button
                    onClick={() => changeMode('emulated')}
                    className={`text-xs px-3 py-1.5 rounded border transition-all ${game.mode === 'emulated' ? 'border-casino-gold text-casino-gold' : 'border-casino-border text-gray-400'}`}
                    disabled={loading}
                  >
                    Virtuelle
                  </button>
                  <button
                    onClick={() => changeMode('physical')}
                    className={`text-xs px-3 py-1.5 rounded border transition-all ${game.mode === 'physical' ? 'border-casino-gold text-casino-gold' : 'border-casino-border text-gray-400'}`}
                    disabled={loading}
                  >
                    Physique
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="card">
            <h2 className="font-semibold mb-4">Actions</h2>

            {isBetting && (
              <div className="space-y-3">
                {game.mode === 'emulated' ? (
                  <button
                    className="btn-primary w-full py-4 text-lg"
                    onClick={spin}
                    disabled={loading}
                  >
                    🎰 Lancer la roue
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-400">Entrez le numéro sorti sur la roulette physique</p>
                    <div className="flex gap-3">
                      <input
                        className="input text-2xl text-center font-bold"
                        type="number"
                        min="0"
                        max="36"
                        value={physicalNumber}
                        onChange={e => setPhysicalNumber(e.target.value)}
                        placeholder="0 — 36"
                      />
                      <button
                        className="btn-primary px-8 py-2 text-lg"
                        onClick={submitResult}
                        disabled={loading || !physicalNumber}
                      >
                        Valider
                      </button>
                    </div>
                    <div className="grid grid-cols-9 gap-1 mt-2">
                      {Array.from({ length: 37 }, (_, i) => i).map(n => {
                        const c = getColor(n)
                        return (
                          <button
                            key={n}
                            onClick={() => setPhysicalNumber(String(n))}
                            className={`w-full aspect-square rounded text-xs font-bold text-white transition-all hover:scale-110 ${
                              c === 'red' ? 'bg-red-700 hover:bg-red-600' :
                              c === 'black' ? 'bg-gray-700 hover:bg-gray-600' :
                              'bg-green-700 hover:bg-green-600'
                            } ${physicalNumber === String(n) ? 'ring-2 ring-casino-gold scale-110' : ''}`}
                          >
                            {n}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {isSpinning && game.mode === 'emulated' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">
                  Numéro tiré : <span className="text-casino-gold font-bold text-2xl">{game.result_number}</span>
                  <span className={`ml-3 font-semibold ${game.result_number === 0 ? 'text-green-400' : RED_NUMBERS.has(game.result_number!) ? 'text-red-400' : 'text-gray-300'}`}>
                    ({getColor(game.result_number!)})
                  </span>
                </p>
                <button
                  className="btn-primary w-full py-4 text-lg"
                  onClick={async () => {
                    setLoading(true)
                    try {
                      await api.post(`/roulette/game/${game.id}/result`, { resultNumber: game.result_number })
                      loadGame()
                    } catch (err: any) {
                      alert(err.response?.data?.error || 'Erreur')
                    } finally {
                      setLoading(false)
                    }
                  }}
                  disabled={loading}
                >
                  {loading ? 'Validation...' : `✓ Valider le résultat (${game.result_number})`}
                </button>
              </div>
            )}

            {isSpinning && game.mode === 'physical' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-400 animate-pulse">En attente du résultat physique...</p>
                <div className="flex gap-3">
                  <input
                    className="input text-2xl text-center font-bold"
                    type="number"
                    min="0"
                    max="36"
                    value={physicalNumber}
                    onChange={e => setPhysicalNumber(e.target.value)}
                    placeholder="0 — 36"
                  />
                  <button
                    className="btn-primary px-8 py-2 text-lg"
                    onClick={submitResult}
                    disabled={loading || !physicalNumber}
                  >
                    Valider
                  </button>
                </div>
                <div className="grid grid-cols-9 gap-1">
                  {Array.from({ length: 37 }, (_, i) => i).map(n => {
                    const c = getColor(n)
                    return (
                      <button
                        key={n}
                        onClick={() => setPhysicalNumber(String(n))}
                        className={`w-full aspect-square rounded text-xs font-bold text-white transition-all hover:scale-110 ${
                          c === 'red' ? 'bg-red-700 hover:bg-red-600' :
                          c === 'black' ? 'bg-gray-700 hover:bg-gray-600' :
                          'bg-green-700 hover:bg-green-600'
                        } ${physicalNumber === String(n) ? 'ring-2 ring-casino-gold scale-110' : ''}`}
                      >
                        {n}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {isResult && (
              <button
                className="btn-green w-full py-3 text-base"
                onClick={closeGame}
                disabled={loading}
              >
                ✓ Fermer la partie et ouvrir les mises suivantes
              </button>
            )}
          </div>

          {/* Liste des mises */}
          {game.bets && game.bets.length > 0 && (
            <div className="card">
              <h2 className="font-semibold mb-3">Mises ({game.bets.length})</h2>
              <div className="max-h-80 overflow-y-auto space-y-1">
                {game.bets.map((b: any) => {
                  const label = BET_LABELS[b.bet_type]?.(b.bet_value) ?? `${b.bet_type} ${b.bet_value}`
                  return (
                    <div key={b.id} className={`flex items-center justify-between text-sm py-1.5 px-2 rounded ${
                      b.won === 1 ? 'bg-green-900/30' : b.won === 0 ? 'bg-red-900/20' : 'bg-casino-border/20'
                    }`}>
                      <span className="font-medium w-28 truncate">{b.username}</span>
                      <span className="text-gray-400 flex-1 mx-2">{label}</span>
                      <span className="text-casino-gold w-16 text-right">{b.amount}</span>
                      {b.won !== null && (
                        <span className={`w-20 text-right font-semibold ${b.won ? 'text-green-400' : 'text-red-400'}`}>
                          {b.won ? `+${b.payout - b.amount}` : `-${b.amount}`}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Historique */}
      {history.length > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-3 text-gray-400">Historique des parties</h2>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {history.map((g: any) => {
              const c = getColor(g.result_number)
              return (
                <div key={g.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-casino-border last:border-0">
                  <span className="text-gray-500 w-6">#{g.id}</span>
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                    c === 'red' ? 'bg-red-700' : c === 'black' ? 'bg-gray-700' : 'bg-green-700'
                  }`}>{g.result_number}</span>
                  <span className="text-gray-400 capitalize">{g.mode}</span>
                  <span className={`ml-auto font-semibold ${g.casino_delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {g.casino_delta >= 0 ? '+' : ''}{g.casino_delta.toLocaleString()}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
