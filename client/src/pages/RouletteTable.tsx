import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getSocket } from '../socket'
import api from '../api'
import RouletteBettingMat from '../components/RouletteBettingMat'

const CHIPS = [
  { value: 5,  bg: 'bg-red-600',   ring: 'ring-red-300'   },
  { value: 10, bg: 'bg-blue-600',  ring: 'ring-blue-300'  },
  { value: 25, bg: 'bg-green-600', ring: 'ring-green-300' },
  { value: 50, bg: 'bg-gray-600',  ring: 'ring-gray-300'  },
]

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36])

interface Game {
  id: number
  status: 'betting' | 'spinning' | 'result' | 'closed'
  result_number: number | null
  bets: any[]
}

interface MyBet {
  id: number
  bet_type: string
  bet_value: string
  amount: number
  payout: number | null
  won: number | null
}

function formatBetLabel(betType: string, betValue: string): string {
  switch (betType) {
    case 'straight': return `Plein ${betValue}`
    case 'color':    return betValue === 'red' ? 'Rouge' : 'Noir'
    case 'evenodd':  return betValue === 'even' ? 'Pair' : 'Impair'
    case 'lowhigh':  return betValue === 'low' ? '1-18' : '19-36'
    case 'dozen':    return `${betValue}ème douzaine`
    case 'column':   return `Colonne ${betValue}`
    case 'split':    return `Cheval ${betValue}`
    case 'street':   return `Transversale ${betValue}`
    case 'corner':   return `Carré ${betValue}`
    case 'line':     return `Sixain ${betValue}`
    default:         return `${betType} ${betValue}`
  }
}

export default function RouletteTable() {
  const navigate = useNavigate()
  const { user, updateCredits } = useAuth()
  const [game, setGame] = useState<Game | null>(null)
  const [myBets, setMyBets] = useState<MyBet[]>([])
  const [chipAmount, setChipAmount] = useState(25)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadGame()
    loadMyBets()

    const socket = getSocket()
    socket.on('roulette:state', (g: Game) => { setGame(g); setMyBets([]) })
    socket.on('roulette:bet', () => { loadGame(); loadMyBets() })
    socket.on('roulette:spinning', () => setGame(g => g ? { ...g, status: 'spinning' } : g))
    socket.on('roulette:result', (data: any) => { setGame({ ...data.game, bets: data.bets }); loadMyBets() })
    socket.on('credits:update', (data: { credits: number }) => updateCredits(data.credits))
    socket.on('roulette:closed', () => { setGame(null); setMyBets([]) })

    return () => {
      socket.off('roulette:state')
      socket.off('roulette:bet')
      socket.off('roulette:spinning')
      socket.off('roulette:result')
      socket.off('credits:update')
      socket.off('roulette:closed')
    }
  }, [])

  async function loadGame() {
    try { const { data } = await api.get('/roulette/current'); setGame(data) } catch {}
  }

  async function loadMyBets() {
    try { const { data } = await api.get('/roulette/my-bets'); setMyBets(data) } catch {}
  }

  async function placeBet(betType: string, betValue: string, amount: number) {
    if (!game || game.status !== 'betting') return
    setLoading(true)
    try {
      await api.post('/roulette/bet', { betType, betValue, amount })
      await loadMyBets()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  async function undoLastBet() {
    if (!myBets.length || loading) return
    const last = myBets[myBets.length - 1]
    setLoading(true)
    try {
      const { data } = await api.delete(`/roulette/bet/${last.id}`)
      updateCredits(data.credits)
      await loadMyBets()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  async function clearAllBets() {
    if (!myBets.length || loading) return
    setLoading(true)
    try {
      const { data } = await api.delete('/roulette/my-bets')
      updateCredits(data.credits)
      setMyBets([])
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  const isBetting  = game?.status === 'betting'
  const isSpinning = game?.status === 'spinning'
  const isResult   = game?.status === 'result'
  const hasBets    = myBets.length > 0

  // Calcul du bilan pour l'écran résultat
  const netGain = myBets.reduce((s, b) => {
    if (b.won) return s + (b.payout ?? 0) - b.amount
    return s - b.amount
  }, 0)

  const numberColor = (n: number) =>
    n === 0 ? 'bg-green-600' : RED_NUMBERS.has(n) ? 'bg-red-600' : 'bg-gray-800'

  return (
    <div className="fixed inset-0 bg-green-950 flex flex-col overflow-hidden">

      {/* ── Tapis (prend tout l'espace) ── */}
      <div className={`relative flex-1 overflow-auto flex items-center justify-center p-2 transition-opacity duration-300 ${!isBetting ? 'opacity-40 pointer-events-none' : ''}`}>
        <RouletteBettingMat
          onBet={placeBet}
          currentBets={myBets.map(b => ({ betType: b.bet_type, betValue: b.bet_value, amount: b.amount }))}
          disabled={!isBetting || loading}
          chipAmount={chipAmount}
        />
      </div>

      {/* ── Overlay : spin en cours ── */}
      {isSpinning && (
        <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
          <div className="bg-black/80 rounded-2xl px-8 py-6 flex flex-col items-center gap-3 border border-white/20">
            <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-white font-bold text-lg tracking-wide">Spin en cours…</span>
          </div>
        </div>
      )}

      {/* ── Overlay : résultat ── */}
      {isResult && game?.result_number !== null && (
        <div className="absolute inset-0 bg-black/75 flex items-center justify-center z-40 p-4">
          <div className="bg-green-900 rounded-2xl p-5 w-full max-w-sm shadow-2xl border border-white/20 flex flex-col gap-4">

            {/* Numéro gagnant */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-gray-300 text-xs uppercase tracking-widest">Numéro gagnant</span>
              <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl font-black text-white shadow-lg ${numberColor(game.result_number!)}`}>
                {game.result_number}
              </div>
            </div>

            {/* Détail des mises */}
            {hasBets ? (
              <>
                <div className="divide-y divide-white/10 max-h-48 overflow-y-auto rounded-lg overflow-hidden">
                  {myBets.map(bet => (
                    <div
                      key={bet.id}
                      className={`flex justify-between items-center px-3 py-2 text-sm ${bet.won ? 'bg-green-800/60' : 'bg-red-900/40'}`}
                    >
                      <span className="text-white/80">{formatBetLabel(bet.bet_type, bet.bet_value)}</span>
                      <span className={`font-bold ${bet.won ? 'text-green-300' : 'text-red-400'}`}>
                        {bet.won
                          ? `+${(bet.payout ?? 0) - bet.amount}`
                          : `-${bet.amount}`}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Bilan total */}
                <div className={`text-center rounded-xl py-3 font-black text-2xl ${netGain >= 0 ? 'bg-green-700/60 text-green-300' : 'bg-red-900/60 text-red-400'}`}>
                  {netGain >= 0 ? `+${netGain}` : `${netGain}`} jetons
                </div>
              </>
            ) : (
              <p className="text-center text-gray-400 text-sm">Pas de mise cette partie.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Message : aucune partie ── */}
      {!game && (
        <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
          <div className="bg-black/70 rounded-2xl px-8 py-6 text-center border border-white/10">
            <p className="text-white/60 text-base">En attente d'une partie…</p>
          </div>
        </div>
      )}

      {/* ── Barre basse ── */}
      <div className="shrink-0 bg-black/60 backdrop-blur-sm px-3 pt-2 pb-4 space-y-2">

        {/* Solde */}
        <div className="flex justify-center">
          <span className="text-yellow-400 font-bold text-base tracking-wide">
            {user?.credits ?? 0} jetons
          </span>
        </div>

        {/* Chips — taille fixe pour mobile */}
        <div className="flex justify-center gap-2.5">
          {CHIPS.map(chip => (
            <button
              key={chip.value}
              onClick={() => setChipAmount(chip.value)}
              className={`
                w-11 h-11 rounded-full font-bold text-sm text-white flex items-center justify-center shrink-0
                ${chip.bg} transition-all select-none
                ${chipAmount === chip.value ? `scale-115 ring-2 ${chip.ring} shadow-lg` : 'opacity-70'}
              `}
            >
              {chip.value >= 1000 ? `${chip.value / 1000}k` : chip.value}
            </button>
          ))}
        </div>

        {/* Boutons d'action */}
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 font-semibold text-sm transition-all"
          >
            ← Retour
          </button>
          <button
            onClick={undoLastBet}
            disabled={!isBetting || !hasBets || loading}
            className="flex-1 py-2.5 rounded-lg bg-orange-700 hover:bg-orange-600 disabled:opacity-30 disabled:cursor-not-allowed font-semibold text-sm transition-all"
          >
            ↩ Annuler
          </button>
          <button
            onClick={clearAllBets}
            disabled={!isBetting || !hasBets || loading}
            className="flex-1 py-2.5 rounded-lg bg-red-800 hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed font-semibold text-sm transition-all"
          >
            🗑 Effacer
          </button>
        </div>

      </div>
    </div>
  )
}
