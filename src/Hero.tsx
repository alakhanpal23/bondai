import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import './Hero.css'

const COUNT = 2400
const DURATION = 6.8 // seconds, full hero sequence

// --- easing -------------------------------------------------------------
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}
const easeInQuart = (t: number) => t * t * t * t
const easeOutBack = (t: number) => {
  const c = 1.70158
  const c3 = c + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2)
}

// Round-brilliant diamond silhouette: crown above girdle, pavilion below.
function diamondTarget(s1: number, s2: number, scale = 2.4): [number, number, number] {
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
  g.addColorStop(0.22, 'rgba(220,235,255,0.6)')
  g.addColorStop(0.55, 'rgba(80,140,255,0.14)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

type ParticleProps = {
  onPhase: (phase: 'drift' | 'converge' | 'snap' | 'settled') => void
}

function ParticleSystem({ onPhase }: ParticleProps) {
  const ref = useRef<THREE.Points>(null!)
  const groupRef = useRef<THREE.Group>(null!)
  const t0 = useRef<number | null>(null)
  const phase = useRef<'drift' | 'converge' | 'snap' | 'settled'>('drift')

  const { positions, scatter, target, seed } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    const scatter = new Float32Array(COUNT * 3)
    const target = new Float32Array(COUNT * 3)
    const seed = new Float32Array(COUNT)

    for (let i = 0; i < COUNT; i++) {
      // scattered shell
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

      const [tx, ty, tz] = diamondTarget(Math.random(), Math.random())
      target[i * 3] = tx
      target[i * 3 + 1] = ty
      target[i * 3 + 2] = tz

      seed[i] = Math.random()
    }
    return { positions, scatter, target, seed }
  }, [])

  const sprite = useMemo(makeSpriteTexture, [])

  const setPhase = (p: typeof phase.current) => {
    if (phase.current !== p) {
      phase.current = p
      onPhase(p)
    }
  }

  useFrame((state) => {
    if (t0.current === null) t0.current = state.clock.elapsedTime
    const elapsed = state.clock.elapsedTime - t0.current
    const t = Math.min(1, elapsed / DURATION)

    if (t < 0.18) setPhase('drift')
    else if (t < 0.62) setPhase('converge')
    else if (t < 0.82) setPhase('snap')
    else setPhase('settled')

    const arr = ref.current.geometry.attributes.position.array as Float32Array

    for (let i = 0; i < COUNT; i++) {
      const sx = scatter[i * 3],
        sy = scatter[i * 3 + 1],
        sz = scatter[i * 3 + 2]
      const tx = target[i * 3],
        ty = target[i * 3 + 1],
        tz = target[i * 3 + 2]
      const r = seed[i]

      let x: number, y: number, z: number

      if (t < 0.62) {
        // drift → converge: slow start, accelerating in
        const k = smoothstep(0.0, 0.62, t)
        const e = easeInQuart(k)
        x = lerp(sx, 0, e)
        y = lerp(sy, 0, e)
        z = lerp(sz, 0, e)
        // organic drift, fades as we converge
        const driftAmt = (1 - smoothstep(0, 0.45, t)) * 0.18
        const phaseR = elapsed * 0.55 + r * 6.2832
        x += Math.sin(phaseR) * driftAmt
        y += Math.cos(phaseR * 0.92) * driftAmt
        z += Math.sin(phaseR * 1.07) * driftAmt
      } else if (t < 0.82) {
        // SNAP: explode out from center to diamond target with overshoot
        const k = smoothstep(0.62, 0.82, t)
        const e = easeOutBack(k)
        x = lerp(0, tx, e)
        y = lerp(0, ty, e)
        z = lerp(0, tz, e)
      } else {
        // settled: still, with imperceptible breath
        const breathe = Math.sin(elapsed * 1.1 + r * 6.2832) * 0.0035
        x = tx * (1 + breathe)
        y = ty * (1 + breathe)
        z = tz * (1 + breathe)
      }

      arr[i * 3] = x
      arr[i * 3 + 1] = y
      arr[i * 3 + 2] = z
    }

    ref.current.geometry.attributes.position.needsUpdate = true

    // gentle continuous rotation; slows as we settle
    const rotSpeed = t < 0.62 ? 0.04 : t < 0.82 ? 0.18 : 0.06
    groupRef.current.rotation.y += rotSpeed * (1 / 60)
  })

  return (
    <group ref={groupRef}>
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
          size={0.075}
          map={sprite}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          color={'#cfe0ff'}
          sizeAttenuation
        />
      </points>
    </group>
  )
}

export default function Hero() {
  const [phase, setPhase] = useState<'drift' | 'converge' | 'snap' | 'settled'>(
    'drift',
  )
  const [flash, setFlash] = useState(false)

  // brief white-blue flash at the snap moment
  useEffect(() => {
    if (phase === 'snap') {
      setFlash(true)
      const id = window.setTimeout(() => setFlash(false), 320)
      return () => window.clearTimeout(id)
    }
  }, [phase])

  const settled = phase === 'settled'

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

      <div className={`flash ${flash ? 'on' : ''}`} />

      <div className="overlay">
        <div className="brand">BOND</div>
        <div className="status">
          <span className="dot" />
          <span>SYS · {phase.toUpperCase()}</span>
        </div>

        <div className={`reveal ${settled ? 'on' : ''}`}>
          <h1 className="wordmark">BOND</h1>
          <p className="tagline">Precision diamond intelligence.</p>
        </div>
      </div>
    </div>
  )
}
