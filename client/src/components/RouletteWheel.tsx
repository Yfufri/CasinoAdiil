import { useEffect, useRef, useState } from 'react'

// Ordre des numéros sur une roulette européenne
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36,
  11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9,
  22, 18, 29, 7, 28, 12, 35, 3, 26
]

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36])

function getColor(n: number) {
  if (n === 0) return '#16a34a'
  return RED_NUMBERS.has(n) ? '#dc2626' : '#1f2937'
}

interface Props {
  spinning: boolean
  resultNumber: number | null
  onSpinComplete?: () => void
  size?: number
}

export default function RouletteWheel({ spinning, resultNumber, onSpinComplete, size = 380 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>()
  const startTimeRef = useRef<number>(0)
  const [currentAngle, setCurrentAngle] = useState(0)
  const [ballAngle, setBallAngle] = useState(0)
  const [done, setDone] = useState(false)
  const DURATION = 4000
  const SEGMENTS = WHEEL_ORDER.length
  const SEG_ANGLE = (Math.PI * 2) / SEGMENTS

  useEffect(() => {
    if (!spinning || resultNumber === null) return
    setDone(false)

    // Trouver la position du numéro résultat dans la roue
    const targetIdx = WHEEL_ORDER.indexOf(resultNumber)

    // Position finale variable selon le numéro : la bille ne tombe pas toujours au même endroit
    const finalPosition = (resultNumber / 37) * Math.PI * 2

    // Roue : tourner pour que le centre du slot gagnant arrive à finalPosition
    // Centre du slot gagnant = wheelAngle + targetIdx * SEG_ANGLE + SEG_ANGLE/2 - π/2 = finalPosition
    const wheelTarget = finalPosition - targetIdx * SEG_ANGLE - SEG_ANGLE / 2 + Math.PI / 2
    const currentMod = ((currentAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    const targetMod = ((wheelTarget % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    let wheelDiff = targetMod - currentMod
    if (wheelDiff < 0) wheelDiff += Math.PI * 2
    const totalRotation = wheelDiff + Math.PI * 2 * 8

    // Balle : arrive exactement au centre du slot gagnant (= finalPosition)
    const startBallAngle = ballAngle
    let ballResidue = (finalPosition - startBallAngle) % (Math.PI * 2)
    if (ballResidue > 0) ballResidue -= Math.PI * 2
    const ballTotalRotation = ballResidue - Math.PI * 2 * 8

    startTimeRef.current = performance.now()
    const startAngle = currentAngle

    function animate(now: number) {
      const elapsed = now - startTimeRef.current
      const t = Math.min(elapsed / DURATION, 1)
      const eased = 1 - Math.pow(1 - t, 4) // ease-out quartic

      const angle = startAngle + totalRotation * eased
      setCurrentAngle(angle)
      setBallAngle(startBallAngle + ballTotalRotation * eased)

      if (t < 1) {
        animRef.current = requestAnimationFrame(animate)
      } else {
        setDone(true)
        onSpinComplete?.()
      }
    }

    animRef.current = requestAnimationFrame(animate)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [spinning, resultNumber])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const size = canvas.width
    const cx = size / 2
    const cy = size / 2
    const outerR = cx - 4
    const innerR = outerR * 0.55
    const numR = (outerR + innerR) / 2

    ctx.clearRect(0, 0, size, size)

    // Fond externe
    ctx.beginPath()
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2)
    ctx.fillStyle = '#1a0a00'
    ctx.fill()
    ctx.strokeStyle = '#c9a84c'
    ctx.lineWidth = 3
    ctx.stroke()

    // Segments
    WHEEL_ORDER.forEach((num, i) => {
      const startA = currentAngle + i * SEG_ANGLE - Math.PI / 2
      const endA = startA + SEG_ANGLE

      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, outerR - 2, startA, endA)
      ctx.closePath()
      ctx.fillStyle = getColor(num)
      ctx.fill()
      ctx.strokeStyle = '#c9a84c'
      ctx.lineWidth = 0.5
      ctx.stroke()

      // Numéro
      const midA = startA + SEG_ANGLE / 2
      ctx.save()
      ctx.translate(cx + Math.cos(midA) * numR, cy + Math.sin(midA) * numR)
      ctx.rotate(midA + Math.PI / 2)
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${size < 300 ? 9 : 11}px Inter`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(num), 0, 0)
      ctx.restore()
    })

    // Centre
    ctx.beginPath()
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2)
    ctx.fillStyle = '#0a0a0f'
    ctx.fill()
    ctx.strokeStyle = '#c9a84c'
    ctx.lineWidth = 2
    ctx.stroke()

    // Logo centre
    ctx.fillStyle = '#c9a84c'
    ctx.font = `bold ${size < 300 ? 14 : 18}px Playfair Display`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('🎰', cx, cy)

    // Balle
    if (spinning || done) {
      const ballR = outerR * 0.88
      const bx = cx + Math.cos(ballAngle) * ballR
      const by = cy + Math.sin(ballAngle) * ballR
      ctx.beginPath()
      ctx.arc(bx, by, 7, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'
      ctx.shadowBlur = 8
      ctx.shadowColor = '#fff'
      ctx.fill()
      ctx.shadowBlur = 0
    }

  }, [currentAngle, ballAngle, spinning, done])

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="mx-auto"
      style={{ maxWidth: '100%' }}
    />
  )
}
