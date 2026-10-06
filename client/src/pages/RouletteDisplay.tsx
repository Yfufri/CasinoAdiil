import { useEffect, useState, useRef } from 'react'
import { getSocket } from '../socket'
import api from '../api'
import RouletteWheel from '../components/RouletteWheel'

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36])
function getColor(n: number) {
  if (n === 0) return 'green'
  return RED_NUMBERS.has(n) ? 'red' : 'black'
}
function colorClass(c: string) {
  if (c === 'red') return 'text-red-500'
  if (c === 'black') return 'text-gray-100'
  return 'text-green-400'
}

interface Game {
  id: number
  status: 'betting' | 'spinning' | 'result' | 'closed'
  mode: 'emulated' | 'physical'
  result_number: number | null
  bets: any[]
}

interface Stats {
  hotColdNumbers: Record<number, number>
  lastResults: { result_number: number }[]
}

function NumberBall({ n, size = 'md' }: { n: number; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const c = getColor(n)
  const sizeClass = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-base',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-24 h-24 text-4xl font-casino',
  }[size]
  const bg = c === 'red' ? 'bg-red-600 shadow-red-900' : c === 'black' ? 'bg-gray-800 border border-gray-500 shadow-gray-900' : 'bg-green-700 shadow-green-900'
  return (
    <span className={`inline-flex items-center justify-center rounded-full font-bold shadow-lg ${sizeClass} ${bg}`}>
      {n}
    </span>
  )
}

export default function RouletteDisplay() {
  const [game, setGame] = useState<Game | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [spinResult, setSpinResult] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [winnerMessages, setWinnerMessages] = useState<{ username: string; payout: number; bet_type: string }[]>([])
  const [lastResults, setLastResults] = useState<number[]>([])
  const spinCompleteRef = useRef(false)

  useEffect(() => {
    api.get('/roulette/current').then(r => { if (r.data) setGame(r.data) })
    api.get('/stats').then(r => {
      setStats(r.data)
      setLastResults(r.data.lastResults.map((x: any) => x.result_number))
    })

    const socket = getSocket()

    socket.on('roulette:state', (g: Game) => {
      setGame(g)
      setSpinning(false)
      setSpinResult(null)
      setShowResult(false)
      setWinnerMessages([])
      spinCompleteRef.current = false
    })

    socket.on('roulette:spinning', (data: { gameId: number; resultNumber: number | null; mode: string }) => {
      setShowResult(false)
      setSpinning(true)
      spinCompleteRef.current = false
      if (data.resultNumber !== null) {
        setSpinResult(data.resultNumber)
      }
    })

    socket.on('roulette:result', (data: { game: Game; bets: any[]; resultNumber: number }) => {
      setSpinResult(data.resultNumber)
      setGame({ ...data.game, bets: data.bets })
      setLastResults(prev => [data.resultNumber, ...prev].slice(0, 20))
      const winners = data.bets
        .filter(b => b.won === 1)
        .map(b => ({ username: b.username, payout: b.payout, bet_type: b.bet_type }))
      setWinnerMessages(winners)
      if (!spinning) {
        setSpinning(false)
        setShowResult(true)
      }
    })

    socket.on('roulette:closed', () => {
      setGame(null)
      setSpinning(false)
      setSpinResult(null)
      setShowResult(false)
      setWinnerMessages([])
    })

    return () => {
      socket.off('roulette:state')
      socket.off('roulette:spinning')
      socket.off('roulette:result')
      socket.off('roulette:closed')
    }
  }, [])

  function handleSpinComplete() {
    setSpinning(false)
    setShowResult(true)
    spinCompleteRef.current = true
  }

  const hotCold = stats ? Object.entries(stats.hotColdNumbers)
    .map(([n, c]) => ({ n: parseInt(n), c }))
    .filter(x => x.c > 0)
    .sort((a, b) => b.c - a.c) : []

  const hotNumbers = hotCold.slice(0, 6)
  const coldNumbers = [...hotCold].reverse().slice(0, 6)

  const isBetting = game?.status === 'betting'
  const isSpinning = game?.status === 'spinning' || spinning
  const totalPlayers = game ? new Set(game.bets.map((b: any) => b.participant_id)).size : 0
  const totalBets = game ? game.bets.reduce((s: number, b: any) => s + b.amount, 0) : 0

  return (
    <div className="min-h-screen bg-casino-dark text-white overflow-hidden select-none" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* Header */}
      <div className="bg-casino-surface border-b border-casino-border px-8 py-3 flex items-center justify-between">
        <h1 className="font-casino text-3xl text-casino-gold tracking-wide">🎰 Casino Adiil — Roulette</h1>
        <div className={`px-4 py-1 rounded-full text-sm font-semibold ${
          isBetting ? 'bg-green-800 text-green-300' :
          isSpinning ? 'bg-yellow-800 text-yellow-300 animate-pulse' :
          showResult ? 'bg-blue-800 text-blue-300' :
          'bg-gray-800 text-gray-400'
        }`}>
          {isBetting && '🟢 MISES OUVERTES'}
          {isSpinning && '🔄 EN TRAIN DE TOURNER...'}
          {showResult && '✅ RÉSULTAT'}
          {!game && '⏸ EN ATTENTE'}
        </div>
      </div>

      {/* === PARTIE EN COURS : roue plein écran === */}
      {game && (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] gap-6">
          <RouletteWheel
            spinning={isSpinning}
            resultNumber={spinResult}
            onSpinComplete={handleSpinComplete}
            size={650}
          />

          {showResult && spinResult !== null && (
            <div className="text-center fade-in-up">
              <NumberBall n={spinResult} size="xl" />
              <p className={`mt-3 text-2xl font-bold ${colorClass(getColor(spinResult))}`}>
                {getColor(spinResult).toUpperCase()}
                {spinResult !== 0 && ` — ${spinResult % 2 === 0 ? 'PAIR' : 'IMPAIR'}`}
                {spinResult !== 0 && ` — ${spinResult <= 18 ? '1-18' : '19-36'}`}
              </p>
              {winnerMessages.length > 0 && (
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  {winnerMessages.slice(0, 6).map((w, i) => (
                    <span key={i} className="bg-casino-gold/20 border border-casino-gold/50 text-casino-gold px-4 py-1 rounded-full font-semibold">
                      🏆 {w.username} +{w.payout.toLocaleString()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {isBetting && (
            <div className="text-center space-y-1">
              <p className="text-gray-400 text-sm">Placez vos mises !</p>
              <p className="text-casino-gold font-bold">{totalPlayers} joueur(s) · {totalBets.toLocaleString()} jetons misés</p>
            </div>
          )}

          {isSpinning && (
            <p className="text-yellow-400 text-xl font-bold animate-pulse">Rien ne va plus !</p>
          )}
        </div>
      )}

      {/* === EN ATTENTE : stats + hot/cold === */}
      {!game && (
        <div className="grid grid-cols-12 gap-4 p-6 h-[calc(100vh-64px)]">

          {/* Colonne gauche : roue */}
          <div className="col-span-5 flex flex-col items-center justify-center">
            <RouletteWheel
              spinning={false}
              resultNumber={null}
              onSpinComplete={handleSpinComplete}
            />
          </div>

          {/* Colonne centre : historique */}
          <div className="col-span-4 flex flex-col gap-4">
            <div className="card flex-1">
              <h3 className="font-casino text-casino-gold text-lg mb-3">Derniers numéros</h3>
              <div className="flex flex-wrap gap-2">
                {lastResults.map((n, i) => (
                  <NumberBall key={i} n={n} size={i === 0 ? 'md' : 'sm'} />
                ))}
                {lastResults.length === 0 && (
                  <p className="text-gray-500 text-sm">Aucune partie terminée</p>
                )}
              </div>
            </div>
          </div>

          {/* Colonne droite : hot/cold */}
          <div className="col-span-3 flex flex-col gap-4">
            <div className="card flex-1">
              <h3 className="font-casino text-red-400 text-lg mb-3">🔥 Numéros chauds</h3>
              <div className="space-y-2">
                {hotNumbers.map(({ n, c }) => (
                  <div key={n} className="flex items-center justify-between">
                    <NumberBall n={n} size="sm" />
                    <div className="flex-1 mx-2 bg-casino-border rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-red-600 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (c / (hotNumbers[0]?.c || 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-gray-400 text-xs w-6 text-right">{c}x</span>
                  </div>
                ))}
                {hotNumbers.length === 0 && <p className="text-gray-500 text-sm">—</p>}
              </div>
            </div>

            <div className="card flex-1">
              <h3 className="font-casino text-blue-400 text-lg mb-3">❄️ Numéros froids</h3>
              <div className="space-y-2">
                {coldNumbers.map(({ n, c }) => (
                  <div key={n} className="flex items-center justify-between">
                    <NumberBall n={n} size="sm" />
                    <div className="flex-1 mx-2 bg-casino-border rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (c / (hotNumbers[0]?.c || 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-gray-400 text-xs w-6 text-right">{c}x</span>
                  </div>
                ))}
                {coldNumbers.length === 0 && <p className="text-gray-500 text-sm">—</p>}
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  )
}
