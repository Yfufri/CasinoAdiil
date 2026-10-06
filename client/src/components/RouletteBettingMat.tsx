import React from 'react'

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36])

interface Bet {
  betType: string
  betValue: string
  amount: number
}

interface Props {
  onBet: (betType: string, betValue: string, amount: number) => void
  currentBets: Bet[]
  disabled: boolean
  chipAmount: number
}

function numColor(n: number) {
  if (n === 0) return 'bg-green-700 hover:bg-green-600'
  return RED_NUMBERS.has(n) ? 'bg-red-700 hover:bg-red-600' : 'bg-gray-800 hover:bg-gray-700'
}

function betTotal(bets: Bet[], type: string, value: string) {
  return bets.filter(b => b.betType === type && b.betValue === value).reduce((s, b) => s + b.amount, 0)
}

function BetOverlay({ amount }: { amount: number }) {
  if (!amount) return null
  return (
    <span className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
      <span className="bg-casino-gold text-black text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-lg">
        {amount >= 1000 ? `${Math.floor(amount/1000)}k` : amount}
      </span>
    </span>
  )
}

export default function RouletteBettingMat({ onBet, currentBets, disabled, chipAmount }: Props) {
  const handleBet = (type: string, value: string) => {
    if (!disabled) onBet(type, value, chipAmount)
  }

  // Layout du tapis: 3 colonnes x 12 rangées
  const layout = [
    [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
    [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
    [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
  ]

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-max">
        <table className="border-collapse select-none">
          <tbody>
            {/* Rangée 0 */}
            <tr>
              <td
                colSpan={13}
                className={`relative border border-white/20 text-center font-bold text-white cursor-pointer transition-all py-3 px-8 ${disabled ? 'opacity-50 cursor-not-allowed' : 'bg-green-800 hover:bg-green-700'}`}
                onClick={() => handleBet('straight', '0')}
              >
                0
                <BetOverlay amount={betTotal(currentBets, 'straight', '0')} />
              </td>
            </tr>

            {/* Grille principale */}
            {layout.map((row, ri) => (
              <tr key={ri}>
                {row.map((num) => {
                  const total = betTotal(currentBets, 'straight', String(num))
                  return (
                    <td
                      key={num}
                      className={`relative border border-white/20 text-center text-white font-bold cursor-pointer transition-all w-10 h-10 text-sm ${numColor(num)} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={() => handleBet('straight', String(num))}
                    >
                      {num}
                      <BetOverlay amount={total} />
                    </td>
                  )
                })}
                {/* Colonne */}
                <td
                  className={`relative border border-white/20 text-center text-xs text-white cursor-pointer transition-all w-8 h-10 ${disabled ? 'opacity-50 cursor-not-allowed bg-casino-green/50' : 'bg-casino-green hover:bg-green-600'}`}
                  onClick={() => handleBet('column', String(3 - ri))}
                >
                  2:1
                  <BetOverlay amount={betTotal(currentBets, 'column', String(3 - ri))} />
                </td>
              </tr>
            ))}

            {/* Douzaines */}
            <tr>
              <td colSpan={4} className={`relative border border-white/20 text-center text-sm text-white cursor-pointer py-2 transition-all ${disabled ? 'opacity-50 cursor-not-allowed bg-casino-green/50' : 'bg-casino-green hover:bg-green-600'}`}
                onClick={() => handleBet('dozen', '1')}>
                1 à 12
                <BetOverlay amount={betTotal(currentBets, 'dozen', '1')} />
              </td>
              <td colSpan={4} className={`relative border border-white/20 text-center text-sm text-white cursor-pointer py-2 transition-all ${disabled ? 'opacity-50 cursor-not-allowed bg-casino-green/50' : 'bg-casino-green hover:bg-green-600'}`}
                onClick={() => handleBet('dozen', '2')}>
                13 à 24
                <BetOverlay amount={betTotal(currentBets, 'dozen', '2')} />
              </td>
              <td colSpan={4} className={`relative border border-white/20 text-center text-sm text-white cursor-pointer py-2 transition-all ${disabled ? 'opacity-50 cursor-not-allowed bg-casino-green/50' : 'bg-casino-green hover:bg-green-600'}`}
                onClick={() => handleBet('dozen', '3')}>
                25 à 36
                <BetOverlay amount={betTotal(currentBets, 'dozen', '3')} />
              </td>
              <td />
            </tr>

            {/* Mises simples */}
            <tr>
              {[
                { label: '1-18', type: 'lowhigh', value: 'low', color: 'green' },
                { label: 'Pair', type: 'evenodd', value: 'even', color: 'green' },
                { label: 'Rouge', type: 'color', value: 'red', color: 'red' },
                { label: 'Noir', type: 'color', value: 'black', color: 'black' },
                { label: 'Impair', type: 'evenodd', value: 'odd', color: 'green' },
                { label: '19-36', type: 'lowhigh', value: 'high', color: 'green' },
              ].map(({ label, type, value, color }, i) => {
                const bg = color === 'red'
                  ? (disabled ? 'bg-red-900/60 opacity-50 cursor-not-allowed' : 'bg-red-700 hover:bg-red-600')
                  : color === 'black'
                  ? (disabled ? 'bg-gray-950/60 opacity-50 cursor-not-allowed' : 'bg-gray-900 hover:bg-gray-800 border-gray-600')
                  : (disabled ? 'bg-casino-green/50 opacity-50 cursor-not-allowed' : 'bg-casino-green hover:bg-green-600')
                return (
                  <td
                    key={i}
                    colSpan={2}
                    className={`relative border border-white/20 text-center text-sm text-white cursor-pointer py-2 transition-all font-semibold ${bg}`}
                    onClick={() => handleBet(type, value)}
                  >
                    {label}
                    <BetOverlay amount={betTotal(currentBets, type, value)} />
                  </td>
                )
              })}
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
