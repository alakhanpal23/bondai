import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import './Hero.css'

const COUNT = 3000
const DURATION = 7.4 // seconds — full hero sequence

// --- math ---------------------------------------------------------------
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const easeInOutQuint = (t: number) =>
  t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

// Round-brilliant diamond silhouette: crown above girdle, pavilion below.
function diamondTarget(s1: number, s2: number, scale: number): [number, number, number] {
  let y: number, r: number
  if (s1 < 0.32) {
    const k = s1 / 0.32
    y = lerp(0, 0.42, k)
    r = lerp(1.0, 0.55, k)
  } else {
    const k = (s1 - 0.32) / 0.68
    y = lerp(0, -0.95, k)
    r = lerp(1.0, 0.0, k)
  }
  const theta = s2 * Math.PI * 2
  return [Math.cos(theta) * r * scale, y * scale, Math.sin(theta) * r * scale]
}

function makeSpriteTexture(): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.22, 'rgba(220,235,255,0.62)')
  g.addColorStop(0.55, 'rgba(80,140,255,0.14)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

const SCALE = 1.8

type Phase = 'idle' | 'flow' | 'forming' | 'locked'

function ParticleSystem({ onPhase }: { onPhase: (p: Phase) => void }) {
  const ref = useRef<THREE.Points>(null!)
  const yRef = useRef<THREE.Group>(null!)
  const t0 = useRef<number | null>(null)
  const phase = useRef<Phase>('idle')

  const { positions, scatter, target, mid, seed } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    const scatter = new Float32Array(COUNT * 3)
    const target = new Float32Array(COUNT * 3)
    const mid = new Float32Array(COUNT * 3)
    const seed = new Float32Array(COUNT)

    for (let i = 0; i < COUNT; i++) {
      const r = 6 + Math.random() * 8
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const sx = r * Math.sin(phi) * Math.cos(theta)
      const sy = r * Math.sin(phi) * Math.sin(theta)
      const sz = r * Math.cos(phi)
      scatter[i * 3] = sx
      scatter[i * 3 + 1] = sy
      scatter[i * 3 + 2] = sz
      positions[i * 3] = sx
      positions[i * 3 + 1] = sy
      positions[i * 3 + 2] = sz

      // Bias a portion of particles onto key structural rings so the
      // silhouette reads as a diamond, not a particle cloud:
      //   table edge ring (top), girdle ring (widest), pavilion just
      //   below girdle. Rest distributed randomly across surfaces.
      const ring = Math.random()
      let s1: number
      if (ring < 0.07) {
        // table-edge ring (top of crown) — defines the flat top
        s1 = 0.295 + Math.random() * 0.025
      } else if (ring < 0.15) {
        // girdle ring on crown side
        s1 = 0 + Math.random() * 0.022
      } else if (ring < 0.20) {
        // girdle ring on pavilion side (band thickening at widest point)
        s1 = 0.32 + Math.random() * 0.022
      } else {
        s1 = Math.random()
      }
      const [tx, ty, tz] = diamondTarget(s1, Math.random(), SCALE)
      target[i * 3] = tx
      target[i * 3 + 1] = ty
      target[i * 3 + 2] = tz

      // Bezier midpoint pulled toward origin → curved sweeping path,
      // never collapses to a single bright point in the middle.
      mid[i * 3] = (sx + tx) * 0.3 + (Math.random() - 0.5) * 0.6
      mid[i * 3 + 1] = (sy + ty) * 0.5 + (Math.random() - 0.5) * 0.6
      mid[i * 3 + 2] = (sz + tz) * 0.3 + (Math.random() - 0.5) * 0.6

      seed[i] = Math.random()
    }
    return { positions, scatter, target, mid, seed }
  }, [])

  const sprite = useMemo(makeSpriteTexture, [])

  const setPhase = (p: Phase) => {
    if (phase.current !== p) {
      phase.current = p
      onPhase(p)
    }
  }

  useFrame((state) => {
    if (t0.current === null) t0.current = state.clock.elapsedTime
    const elapsed = state.clock.elapsedTime - t0.current
    const t = clamp01(elapsed / DURATION)

    if (t < 0.12) setPhase('idle')
    else if (t < 0.55) setPhase('flow')
    else if (t < 0.9) setPhase('forming')
    else setPhase('locked')

    const arr = ref.current.geometry.attributes.position.array as Float32Array

    for (let i = 0; i < COUNT; i++) {
      const sx = scatter[i * 3],
        sy = scatter[i * 3 + 1],
        sz = scatter[i * 3 + 2]
      const tx = target[i * 3],
        ty = target[i * 3 + 1],
        tz = target[i * 3 + 2]
      const mx = mid[i * 3],
        my = mid[i * 3 + 1],
        mz = mid[i * 3 + 2]
      const r = seed[i]

      // per-particle staggered timing — small variance so arrival is organic
      const startDelay = 0.10 + r * 0.08
      const moveDur = 0.66 + (1 - r) * 0.07
      const localT = clamp01((t - startDelay) / moveDur)
      const e = easeInOutQuint(localT)

      // Quadratic Bezier sweep: scatter → midpoint (pulled toward center) → target
      const u = 1 - e
      let x = u * u * sx + 2 * u * e * mx + e * e * tx
      let y = u * u * sy + 2 * u * e * my + e * e * ty
      let z = u * u * sz + 2 * u * e * mz + e * e * tz

      // ambient drift dampens as particle approaches its target
      const driftScale = 1 - localT
      const driftAmt = driftScale * 0.16
      const phaseR = elapsed * 0.5 + r * 6.2832
      x += Math.sin(phaseR) * driftAmt
      y += Math.cos(phaseR * 0.92) * driftAmt
      z += Math.sin(phaseR * 1.07) * driftAmt

      // imperceptible breathing once locked
      if (localT >= 1) {
        const breathe = Math.sin(elapsed * 1.0 + r * 6.2832) * 0.0028
        x = tx * (1 + breathe)
        y = ty * (1 + breathe)
        z = tz * (1 + breathe)
      }

      arr[i * 3] = x
      arr[i * 3 + 1] = y
      arr[i * 3 + 2] = z
    }

    ref.current.geometry.attributes.position.needsUpdate = true

    // Rotation: 90° decelerating during formation, then a slow constant
    // continuous spin once locked — like an art object on a turntable.
    const FORM_TURN = Math.PI * 0.5 // 90°
    const POST_LOCK_RATE = 0.045 // rad/s — slow & dignified
    const lockAt = DURATION * 0.92
    const rotY =
      elapsed < lockAt
        ? easeOutCubic(elapsed / lockAt) * FORM_TURN
        : FORM_TURN + (elapsed - lockAt) * POST_LOCK_RATE
    yRef.current.rotation.y = rotY
  })

  return (
    <group ref={yRef} position={[0, 0.45, 0]}>
      <group rotation={[-0.06, 0, 0]}>
        <points ref={ref}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={COUNT}
              array={positions}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial
            size={0.07}
            map={sprite}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            color="#cfe0ff"
            sizeAttenuation
          />
        </points>
      </group>
    </group>
  )
}

export default function Hero() {
  const [phase, setPhase] = useState<Phase>('idle')
  const locked = phase === 'locked'

  return (
    <div className="hero">
      <Canvas
        camera={{ position: [0, 0, 7], fov: 45 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#000000']} />
        <ParticleSystem onPhase={setPhase} />
      </Canvas>

      <div className="overlay">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark" />
            <span className="brand-text">BOUND</span>
          </div>
          <nav className="nav" aria-label="Primary">
            <span className="nav-link">Our Reach</span>
            <span className="nav-link">What We Do</span>
          </nav>
        </header>

        <div className={`reveal ${locked ? 'on' : ''}`}>
          <h1 className="wordmark">BOUND</h1>
          <span className="rule" />
          <p className="tagline">
            Precision intelligence for the future of diamond grading
          </p>
        </div>
      </div>
    </div>
  )
}
