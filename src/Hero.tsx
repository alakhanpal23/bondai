import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState, type MouseEvent } from 'react'
import * as THREE from 'three'
import { useLenis } from 'lenis/react'
import './Hero.css'

const COUNT = 3000
const DURATION = 3.9 // seconds — full hero sequence

// --- math ---------------------------------------------------------------
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const easeInOutQuint = (t: number) =>
  t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2

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

    if (t < 0.05) setPhase('idle')
    else if (t < 0.5) setPhase('flow')
    else if (t < 0.88) setPhase('forming')
    else setPhase('locked')

    const arr = ref.current.geometry.attributes.position.array as Float32Array

    // After every particle has reached its target (max startDelay 0.09 +
    // max moveDur 0.75 = 0.84 of timeline), all 3000 are at target with
    // only breathing left. Skip the heavy bezier+drift math entirely —
    // saves ~25k ops per frame and clears the freeze when the reveal
    // text triggers React re-renders + CSS transitions.
    if (t >= 0.86) {
      const breathSpeed = elapsed * 1.0
      for (let i = 0; i < COUNT; i++) {
        const tx = target[i * 3]
        const ty = target[i * 3 + 1]
        const tz = target[i * 3 + 2]
        const r = seed[i]
        const m = 1 + Math.sin(breathSpeed + r * 6.2832) * 0.0028
        arr[i * 3] = tx * m
        arr[i * 3 + 1] = ty * m
        arr[i * 3 + 2] = tz * m
      }
    } else {
      // formation phase — full bezier sweep + ambient drift
      for (let i = 0; i < COUNT; i++) {
        const sx = scatter[i * 3]
        const sy = scatter[i * 3 + 1]
        const sz = scatter[i * 3 + 2]
        const tx = target[i * 3]
        const ty = target[i * 3 + 1]
        const tz = target[i * 3 + 2]
        const mx = mid[i * 3]
        const my = mid[i * 3 + 1]
        const mz = mid[i * 3 + 2]
        const r = seed[i]

        const startDelay = 0.04 + r * 0.05
        const moveDur = 0.68 + (1 - r) * 0.07
        const localT = clamp01((t - startDelay) / moveDur)
        const e = easeInOutQuint(localT)

        const u = 1 - e
        let x = u * u * sx + 2 * u * e * mx + e * e * tx
        let y = u * u * sy + 2 * u * e * my + e * e * ty
        let z = u * u * sz + 2 * u * e * mz + e * e * tz

        const driftScale = 1 - localT
        if (driftScale > 0) {
          const driftAmt = driftScale * 0.16
          const phaseR = elapsed * 0.5 + r * 6.2832
          x += Math.sin(phaseR) * driftAmt
          y += Math.cos(phaseR * 0.92) * driftAmt
          z += Math.sin(phaseR * 1.07) * driftAmt
        }

        arr[i * 3] = x
        arr[i * 3 + 1] = y
        arr[i * 3 + 2] = z
      }
    }

    ref.current.geometry.attributes.position.needsUpdate = true

    // Rotation: one smooth velocity ramp from 0 → STEADY_RATE over
    // RAMP seconds, then continuous spin forever. No deceleration to
    // zero, no lock pause — the diamond keeps revolving while the
    // reveal text fades in over it.
    const STEADY_RATE = 0.22 // rad/s (~28s / revolution)
    const RAMP = 1.4 // seconds — velocity build-up while particles form

    let rotY: number
    if (elapsed < RAMP) {
      // linear velocity ramp → quadratic rotation (no jerk)
      rotY = (STEADY_RATE * elapsed * elapsed) / (2 * RAMP)
    } else {
      const rampRot = (STEADY_RATE * RAMP) / 2
      rotY = rampRot + STEADY_RATE * (elapsed - RAMP)
    }
    yRef.current.rotation.y = rotY
  })

  return (
    // Outer holds fixed world-space tilt; inner does Y rotation.
    // Nesting R_x · R_y keeps the tilt direction from precessing.
    <group position={[0, 0.45, 0]} rotation={[-0.06, 0, 0]}>
      <group ref={yRef}>
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
  const lenis = useLenis()

  const scrollTo = (id: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const target = document.getElementById(id)
    if (!target) return
    if (lenis) {
      lenis.scrollTo(target, { duration: 1.6 })
    } else {
      target.scrollIntoView({ behavior: 'smooth' })
    }
  }

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
            <img
              className="brand-mark"
              src="/kara-mark.png"
              alt=""
              aria-hidden="true"
            />
            <span className="brand-text">Kara Labs</span>
          </div>
          <nav className="nav" aria-label="Primary">
            <a
              className="nav-link nav-link-active"
              href="#what-we-do"
              onClick={scrollTo('what-we-do')}
            >
              What We Do
            </a>
            <a
              className="nav-link nav-link-active"
              href="#our-reach"
              onClick={scrollTo('our-reach')}
            >
              Our Reach
            </a>
          </nav>
        </header>

        <div className={`reveal ${locked ? 'on' : ''}`}>
          <h1 className="wordmark">Kara Labs</h1>
          <p className="tagline">
            Precision intelligence for the future of diamond grading.
          </p>
        </div>
      </div>
    </div>
  )
}
