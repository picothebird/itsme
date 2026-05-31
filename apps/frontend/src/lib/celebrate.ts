import confetti from 'canvas-confetti'

const BRAND = ['#5645d4', '#7b6cf0', '#22c55e', '#f5d75e', '#ff64c8']

/** Celebratory burst for reward / hatch / level-up moments. */
export function celebrate(options?: { intensity?: 'small' | 'big' }) {
  const prefersReduced =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const userOptedOut =
    typeof localStorage !== 'undefined' && localStorage.getItem('pm-reduce-motion') === '1'
  if (prefersReduced || userOptedOut) return

  const big = options?.intensity === 'big'
  confetti({
    particleCount: big ? 120 : 60,
    spread: big ? 90 : 60,
    startVelocity: big ? 45 : 32,
    origin: { y: 0.6 },
    colors: BRAND,
    scalar: 0.9,
    disableForReducedMotion: true,
  })
  if (big) {
    setTimeout(
      () =>
        confetti({
          particleCount: 60,
          angle: 60,
          spread: 70,
          origin: { x: 0, y: 0.65 },
          colors: BRAND,
          disableForReducedMotion: true,
        }),
      180,
    )
    setTimeout(
      () =>
        confetti({
          particleCount: 60,
          angle: 120,
          spread: 70,
          origin: { x: 1, y: 0.65 },
          colors: BRAND,
          disableForReducedMotion: true,
        }),
      320,
    )
  }
}
