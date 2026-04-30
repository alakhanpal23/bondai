import { Canvas, useFrame } from '@react-three/fiber'
import {
  motion,
  useInView,
  useScroll,
  useTransform,
} from 'framer-motion'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import './WhatWeDo.css'

const COUNT = 2400
const FORM_DURATION = 4.6 // seconds — slightly slower than hero, the formation never fully "locks"

// ─────────────────────────────────────────────────────────────────────────
// MATH
// ─────────────────────────────────────────────────────────────────────────
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const easeInOutQuint = (t: number) =>
  t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2

// Hero's diamond, smaller — sits on top of the cradle
function diamondTarget(
  s1: number,
  s2: number,
  scale: number,
): [number, number, number] {
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

// Parabolic cradle/palm beneath — implies "held by hand" without literal
// finger anatomy. Wide at top edges, dipping in the middle.
function cradleTarget(
  s1: number,
  s2: number,
  scale: number,
): [number, number, number] {
  const x = (s1 - 0.5) * 3.2
  // parabolic dip: shallow at edges, deepest in middle
  const y = -0.55 - (1 - 4 * (s1 - 0.5) ** 2) * 0.42
  const z = (s2 - 0.5) * 0.55
  return [x * scale, y * scale, z * scale]
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

// ─────────────────────────────────────────────────────────────────────────
// PARTICLE SYSTEM — same engine as Hero, target is hand+diamond,
// behaviour stays imperfect / never fully settles.
// ─────────────────────────────────────────────────────────────────────────

function ParticleSystem() {
  const ref = useRef<THREE.Points>(null!)
  const groupRef = useRef<THREE.Group>(null!)
  const t0 = useRef<number | null>(null)

  const { positions, scatter, target, mid, seed } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    const scatter = new Float32Array(COUNT * 3)
    const target = new Float32Array(COUNT * 3)
    const mid = new Float32Array(COUNT * 3)
    const seed = new Float32Array(COUNT)

    for (let i = 0; i < COUNT; i++) {
      const r = 5 + Math.random() * 7
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

      // 70 % diamond on top, 30 % cradle beneath
      const choice = Math.random()
      let tx: number, ty: number, tz: number
      if (choice < 0.7) {
        const [dx, dy, dz] = diamondTarget(
          Math.random(),
          Math.random(),
          0.95,
        )
        tx = dx
        ty = dy + 1.0 // lift diamond up so cradle sits below
        tz = dz
      } else {
        const [cx, cy, cz] = cradleTarget(
          Math.random(),
          Math.random(),
          1.0,
        )
        tx = cx
        ty = cy
        tz = cz
      }

      target[i * 3] = tx
      target[i * 3 + 1] = ty
      target[i * 3 + 2] = tz

      mid[i * 3] = (sx + tx) * 0.3 + (Math.random() - 0.5) * 0.4
      mid[i * 3 + 1] = (sy + ty) * 0.5 + (Math.random() - 0.5) * 0.4
      mid[i * 3 + 2] = (sz + tz) * 0.3 + (Math.random() - 0.5) * 0.4

      seed[i] = Math.random()
    }
    return { positions, scatter, target, mid, seed }
  }, [])

  const sprite = useMemo(makeSpriteTexture, [])

  useFrame((state) => {
    if (t0.current === null) t0.current = state.clock.elapsedTime
    const elapsed = state.clock.elapsedTime - t0.current
    const t = clamp01(elapsed / FORM_DURATION)

    const arr = ref.current.geometry.attributes.position.array as Float32Array

    // Ghost-opinion pulse — every ~6.4s, briefly displace particles by a
    // larger random offset, simulating "second opinion / disagreement".
    const ghostCycle = (elapsed % 6.4) / 6.4
    const ghostStrength =
      ghostCycle < 0.08
        ? Math.sin((ghostCycle / 0.08) * Math.PI) // 0→1→0 over 0.5s
        : 0

    if (t < 0.86) {
      // Formation phase — Bezier sweep + jitter
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
        const moveDur = 0.7 + (1 - r) * 0.08
        const localT = clamp01((t - startDelay) / moveDur)
        const e = easeInOutQuint(localT)

        const u = 1 - e
        let x = u * u * sx + 2 * u * e * mx + e * e * tx
        let y = u * u * sy + 2 * u * e * my + e * e * ty
        let z = u * u * sz + 2 * u * e * mz + e * e * tz

        // jitter ramps up as we approach target — manual instability builds
        const jitterRamp = localT * 0.06
        const phaseR = elapsed * (1.6 + r * 2.2) + r * 6.2832
        x += Math.sin(phaseR) * jitterRamp
        y += Math.cos(phaseR * 0.92) * jitterRamp
        z += Math.sin(phaseR * 1.07) * jitterRamp * 0.6

        arr[i * 3] = x
        arr[i * 3 + 1] = y
        arr[i * 3 + 2] = z
      }
    } else {
      // Settled phase — perpetual instability + ghost-opinion pulses.
      // Particles never lock — this IS the manual-grading metaphor.
      for (let i = 0; i < COUNT; i++) {
        const tx = target[i * 3]
        const ty = target[i * 3 + 1]
        const tz = target[i * 3 + 2]
        const r = seed[i]

        // base wobble — 30× the magnitude of hero's settled breath
        const wobbleFreq = 1.6 + r * 2.2
        const wobbleAmp = 0.045 + r * 0.05
        const phaseR = elapsed * wobbleFreq + r * 6.2832
        let dx = Math.sin(phaseR) * wobbleAmp
        let dy = Math.cos(phaseR * 0.93) * wobbleAmp
        let dz = Math.sin(phaseR * 1.08) * wobbleAmp * 0.6

        // ghost-opinion offset — brief larger deviation in clusters
        if (ghostStrength > 0) {
          const cluster = Math.floor(r * 3) // 3 ghost clusters
          const ghostX = (cluster - 1) * 0.18
          const ghostY = (((cluster + 1) % 3) - 1) * 0.12
          dx += ghostX * ghostStrength
          dy += ghostY * ghostStrength
        }

        arr[i * 3] = tx + dx
        arr[i * 3 + 1] = ty + dy
        arr[i * 3 + 2] = tz + dz
      }
    }

    ref.current.geometry.attributes.position.needsUpdate = true

    // Slow continuous rotation — diamond is being "examined" / inspected
    groupRef.current.rotation.y = elapsed * 0.18
  })

  return (
    <group position={[0, -0.2, 0]} rotation={[-0.06, 0, 0]}>
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

// ─────────────────────────────────────────────────────────────────────────
// SECTION
// ─────────────────────────────────────────────────────────────────────────

export default function WhatWeDo() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-22%' })

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })

  const visualY = useTransform(scrollYProgress, [0, 1], ['10%', '-10%'])
  const visualScale = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    [0.92, 1, 1.06],
  )
  const textY = useTransform(scrollYProgress, [0, 1], ['14%', '-14%'])
  const headerY = useTransform(scrollYProgress, [0, 1], ['-6%', '8%'])
  const gridY = useTransform(scrollYProgress, [0, 1], ['12%', '-26%'])

  return (
    <section ref={ref} className="wwd" id="what-we-do">
      <motion.div className="wwd-bg-grid" style={{ y: gridY }} aria-hidden />

      <div className="wwd-inner">
        <motion.header
          className="wwd-header"
          style={{ y: headerY }}
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, ease: [0.22, 0.61, 0.36, 1] }}
        >
          <span className="wwd-section-no">01 — What We Do</span>
          <span className="wwd-status">
            <span className="wwd-status-dot" />
            Replacing the manual standard
          </span>
        </motion.header>

        <div className="wwd-grid">
          <motion.div
            className="wwd-visual-col"
            style={{ y: visualY, scale: visualScale }}
          >
            <div className="wwd-visual-frame">
              <Canvas
                camera={{ position: [0, 0, 6.5], fov: 45 }}
                gl={{ antialias: true, alpha: true }}
                dpr={[1, 2]}
              >
                <ParticleSystem />
              </Canvas>
            </div>
          </motion.div>

          <motion.div
            className="wwd-text-col"
            style={{ y: textY }}
            initial="hidden"
            animate={inView ? 'show' : 'hidden'}
            transition={{ staggerChildren: 0.16, delayChildren: 0.4 }}
          >
            <motion.h2
              className="wwd-headline"
              variants={fadeUp}
              transition={{ duration: 1.05, ease: [0.22, 0.61, 0.36, 1] }}
            >
              Manual grading
              <br />
              breaks at scale.
            </motion.h2>

            <motion.ul
              className="wwd-points"
              variants={fadeUp}
              transition={{ duration: 1, ease: [0.22, 0.61, 0.36, 1] }}
            >
              <li>Inconsistent outcomes.</li>
              <li>Dependent on the operator.</li>
              <li>Impossible to standardize globally.</li>
            </motion.ul>

            <motion.div
              className="wwd-divider"
              variants={fadeUp}
              transition={{ duration: 0.8 }}
            />

            <motion.p
              className="wwd-positioning"
              variants={fadeUp}
              transition={{ duration: 1, ease: [0.22, 0.61, 0.36, 1] }}
            >
              Kara Labs replaces manual grading
              <br />
              with a consistent, repeatable standard
              <br />
              across every diamond, every location.
            </motion.p>

            <motion.p
              className="wwd-footer"
              variants={fadeUp}
              transition={{ duration: 0.9 }}
            >
              Built for manufacturers, traders, and labs.
            </motion.p>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
}
