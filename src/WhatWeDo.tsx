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

const COUNT = 2000
const FORM_DURATION = 4.4

// ─────────────────────────────────────────────────────────────────────────
// MATH
// ─────────────────────────────────────────────────────────────────────────
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const easeInOutQuint = (t: number) =>
  t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2

// Smaller round-brilliant diamond (same function as Hero, just scale)
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

// Composition anchors
const FIG_X = -1.45 // figure horizontal centre
const FIG_HEAD_Y = 0.95
const HEAD_R = 0.24
const TORSO_TOP = 0.55
const TORSO_BOTTOM = -0.55
const TORSO_W = 0.28
const TORSO_DEPTH = 0.18

const SHOULDER_X = FIG_X + 0.05
const SHOULDER_Y = 0.42
const HAND_X = 0.55
const HAND_Y = 0.05
const ELBOW_X = -0.42
const ELBOW_Y = 0.18

const DIAMOND_X = 1.05
const DIAMOND_Y = 0.05
const DIAMOND_SCALE = 0.46

type PartCode = 0 | 1 | 2 | 3 // 0 head, 1 torso, 2 arm, 3 diamond

function targetForParticle(): {
  pos: [number, number, number]
  part: PartCode
} {
  const r = Math.random()
  // 12 % head, 26 % torso, 14 % arm, 48 % diamond
  if (r < 0.12) {
    // Head — uniformly distributed inside a sphere (slight bias to surface)
    const a = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const rr = HEAD_R * Math.pow(Math.random(), 1 / 3)
    return {
      pos: [
        FIG_X + rr * Math.sin(phi) * Math.cos(a),
        FIG_HEAD_Y + rr * Math.sin(phi) * Math.sin(a),
        rr * Math.cos(phi),
      ],
      part: 0,
    }
  }
  if (r < 0.38) {
    // Torso — vertical capsule (oval cross-section, narrower top)
    const yT = Math.random()
    const y = lerp(TORSO_TOP, TORSO_BOTTOM, yT)
    // taper: narrower at top (shoulders) and bottom
    const taper = 1 - Math.abs(yT - 0.55) * 0.6
    const a = Math.random() * Math.PI * 2
    const rad = Math.pow(Math.random(), 0.55) // bias to outer for silhouette
    return {
      pos: [
        FIG_X + Math.cos(a) * TORSO_W * taper * rad,
        y,
        Math.sin(a) * TORSO_DEPTH * taper * rad,
      ],
      part: 1,
    }
  }
  if (r < 0.52) {
    // Arm — quadratic Bezier from shoulder to hand, with slight thickness
    const t = Math.random()
    const u = 1 - t
    const baseX = u * u * SHOULDER_X + 2 * u * t * ELBOW_X + t * t * HAND_X
    const baseY = u * u * SHOULDER_Y + 2 * u * t * ELBOW_Y + t * t * HAND_Y
    return {
      pos: [
        baseX + (Math.random() - 0.5) * 0.06,
        baseY + (Math.random() - 0.5) * 0.06,
        (Math.random() - 0.5) * 0.06,
      ],
      part: 2,
    }
  }
  // Diamond floating just past the hand — being inspected
  const [dx, dy, dz] = diamondTarget(
    Math.random(),
    Math.random(),
    DIAMOND_SCALE,
  )
  return { pos: [dx + DIAMOND_X, dy + DIAMOND_Y, dz], part: 3 }
}

// ─────────────────────────────────────────────────────────────────────────
// PARTICLE SYSTEM
// ─────────────────────────────────────────────────────────────────────────
function ParticleSystem() {
  const ref = useRef<THREE.Points>(null!)
  const rotRef = useRef<THREE.Group>(null!)
  const t0 = useRef<number | null>(null)

  const { positions, scatter, target, mid, parts, seed } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    const scatter = new Float32Array(COUNT * 3)
    const target = new Float32Array(COUNT * 3)
    const mid = new Float32Array(COUNT * 3)
    const parts = new Uint8Array(COUNT)
    const seed = new Float32Array(COUNT)

    for (let i = 0; i < COUNT; i++) {
      const r = 5 + Math.random() * 6
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

      const { pos, part } = targetForParticle()
      target[i * 3] = pos[0]
      target[i * 3 + 1] = pos[1]
      target[i * 3 + 2] = pos[2]
      parts[i] = part

      mid[i * 3] = (sx + pos[0]) * 0.32 + (Math.random() - 0.5) * 0.4
      mid[i * 3 + 1] = (sy + pos[1]) * 0.5 + (Math.random() - 0.5) * 0.4
      mid[i * 3 + 2] = (sz + pos[2]) * 0.32 + (Math.random() - 0.5) * 0.4

      seed[i] = Math.random()
    }
    return { positions, scatter, target, mid, parts, seed }
  }, [])

  const sprite = useMemo(makeSpriteTexture, [])

  useFrame((state) => {
    if (t0.current === null) t0.current = state.clock.elapsedTime
    const elapsed = state.clock.elapsedTime - t0.current
    const t = clamp01(elapsed / FORM_DURATION)

    const arr = ref.current.geometry.attributes.position.array as Float32Array

    if (t < 0.86) {
      // Formation — Bezier sweep with stagger
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
        const moveDur = 0.7 + (1 - r) * 0.07
        const localT = clamp01((t - startDelay) / moveDur)
        const e = easeInOutQuint(localT)

        const u = 1 - e
        const x = u * u * sx + 2 * u * e * mx + e * e * tx
        const y = u * u * sy + 2 * u * e * my + e * e * ty
        const z = u * u * sz + 2 * u * e * mz + e * e * tz

        arr[i * 3] = x
        arr[i * 3 + 1] = y
        arr[i * 3 + 2] = z
      }
    } else {
      // Settled — diamond breathes (post-rotation), figure holds steady
      // with imperceptible drift. Precision feel, not chaos.
      const breath = Math.sin(elapsed * 1.0) * 0.0028 + 1
      for (let i = 0; i < COUNT; i++) {
        const tx = target[i * 3]
        const ty = target[i * 3 + 1]
        const tz = target[i * 3 + 2]
        const r = seed[i]
        const isDiamond = parts[i] === 3

        if (isDiamond) {
          // Breathe around diamond centre (DIAMOND_X, DIAMOND_Y)
          const dxLocal = tx - DIAMOND_X
          const dyLocal = ty - DIAMOND_Y
          arr[i * 3] = DIAMOND_X + dxLocal * breath
          arr[i * 3 + 1] = DIAMOND_Y + dyLocal * breath
          arr[i * 3 + 2] = tz * breath
        } else {
          // Figure: sub-pixel drift only — alive but precise
          const j = Math.sin(elapsed * 0.9 + r * 6.2832) * 0.004
          arr[i * 3] = tx + j
          arr[i * 3 + 1] = ty + Math.cos(elapsed * 0.85 + r * 6.2832) * 0.003
          arr[i * 3 + 2] = tz + j * 0.5
        }
      }
    }

    ref.current.geometry.attributes.position.needsUpdate = true

    // Rotation: only the diamond rotates around its own centre — the
    // figure stays still. We achieve this by NOT rotating the parent
    // group; instead each diamond particle's xz get rotated around
    // (DIAMOND_X, *, 0) inside the settled-phase loop. But for simplicity
    // and keeping the figure dead-still, we do the rotation in the loop.
    if (t >= 0.86) {
      const omega = 0.32 // rad/s — diamond rotation speed
      const angle = (elapsed - FORM_DURATION * 0.86) * omega
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      for (let i = 0; i < COUNT; i++) {
        if (parts[i] !== 3) continue
        const tx = target[i * 3]
        const tz = target[i * 3 + 2]
        const localX = tx - DIAMOND_X
        const localZ = tz
        const breath =
          Math.sin(elapsed * 1.0 + seed[i] * 6.2832) * 0.0028 + 1
        arr[i * 3] = DIAMOND_X + (localX * cos - localZ * sin) * breath
        arr[i * 3 + 2] = (localX * sin + localZ * cos) * breath
        // y untouched — keep diamond's vertical structure intact
      }
      ref.current.geometry.attributes.position.needsUpdate = true
    }
  })

  return (
    <group ref={rotRef} rotation={[-0.05, 0, 0]}>
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

      <ScanBeam />
    </group>
  )
}

// Horizontal scanning beam that sweeps vertically across the diamond.
function ScanBeam() {
  const ref = useRef<THREE.Mesh>(null!)
  const TOP = 0.7
  const BOTTOM = -0.7
  const CYCLE = 3.6

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime
    const cyc = (elapsed % CYCLE) / CYCLE
    // sweep top → bottom, then snap back invisibly (fade out at end)
    const y = TOP - cyc * (TOP - BOTTOM)
    ref.current.position.y = y
    ref.current.position.x = DIAMOND_X
    ref.current.position.z = 0

    // fade in at start of cycle, hold, fade out at end
    let alpha: number
    if (cyc < 0.06) alpha = cyc / 0.06
    else if (cyc > 0.94) alpha = (1 - cyc) / 0.06
    else alpha = 1
    ;(ref.current.material as THREE.MeshBasicMaterial).opacity = alpha * 0.55
  })

  return (
    <mesh ref={ref}>
      <planeGeometry args={[1.65, 0.025]} />
      <meshBasicMaterial
        color="#9bb8ff"
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
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

  const visualY = useTransform(scrollYProgress, [0, 1], ['8%', '-8%'])
  const visualScale = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    [0.94, 1, 1.05],
  )
  const textY = useTransform(scrollYProgress, [0, 1], ['12%', '-12%'])
  const headerY = useTransform(scrollYProgress, [0, 1], ['-6%', '8%'])
  const gridY = useTransform(scrollYProgress, [0, 1], ['10%', '-22%'])

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
          <span className="wwd-section-no">01 — What we do</span>
          <span className="wwd-status">
            <span className="wwd-status-dot" />
            Active scan
          </span>
        </motion.header>

        <div className="wwd-grid">
          {/* visual — left, smaller */}
          <motion.div
            className="wwd-visual-col"
            style={{ y: visualY, scale: visualScale }}
          >
            <div className="wwd-visual-frame">
              <Canvas
                camera={{ position: [0, 0, 5.4], fov: 45 }}
                gl={{ antialias: true, alpha: true }}
                dpr={[1, 2]}
              >
                <ParticleSystem />
              </Canvas>

              {/* CV-style data ticks layered on top of the canvas */}
              <DataOverlay inView={inView} />
            </div>
          </motion.div>

          {/* text — right, dominant */}
          <motion.div
            className="wwd-text-col"
            style={{ y: textY }}
            initial="hidden"
            animate={inView ? 'show' : 'hidden'}
            transition={{ staggerChildren: 0.16, delayChildren: 0.4 }}
          >
            <motion.div className="wwd-eyebrow" variants={fadeUp}>
              The intelligence layer
            </motion.div>

            <motion.h2
              className="wwd-headline"
              variants={fadeUp}
              transition={{ duration: 1.05, ease: [0.22, 0.61, 0.36, 1] }}
            >
              Where we
              <br />
              come in.
            </motion.h2>

            <motion.p
              className="wwd-sub"
              variants={fadeUp}
              transition={{ duration: 1, ease: [0.22, 0.61, 0.36, 1] }}
            >
              Precision intelligence, applied to every diamond — at every
              station.
            </motion.p>

            <motion.ul
              className="wwd-points"
              variants={fadeUp}
              transition={{ duration: 1, ease: [0.22, 0.61, 0.36, 1] }}
            >
              <li>Consistent results, every diamond.</li>
              <li>Machine-verified. Operator-agnostic.</li>
              <li>One standard, every location.</li>
            </motion.ul>

            <motion.div className="wwd-divider" variants={fadeUp} />

            <motion.p
              className="wwd-positioning"
              variants={fadeUp}
              transition={{ duration: 1, ease: [0.22, 0.61, 0.36, 1] }}
            >
              Kara Labs replaces subjective judgment with audited,
              repeatable measurements — across the entire diamond pipeline.
            </motion.p>

            <motion.p className="wwd-footer" variants={fadeUp}>
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

// ─────────────────────────────────────────────────────────────────────────
// DATA OVERLAY — flickering CV-style readouts around the diamond
// ─────────────────────────────────────────────────────────────────────────
const READOUTS = [
  { k: 'DEPTH',    v: '61.8 %',     d: 1.6 },
  { k: 'TABLE',    v: '57.0 %',     d: 1.9 },
  { k: 'SYMMETRY', v: 'EXCELLENT',  d: 2.2 },
  { k: 'CLARITY',  v: 'VS1',        d: 2.5 },
  { k: 'COLOR',    v: 'D',          d: 2.8 },
]

function DataOverlay({ inView }: { inView: boolean }) {
  return (
    <div
      className={`wwd-data-overlay ${inView ? 'on' : ''}`}
      aria-hidden
    >
      {READOUTS.map((r, i) => (
        <div
          key={r.k}
          className={`wwd-data wwd-data-${i + 1}`}
          style={{ ['--d' as string]: `${r.d}s` }}
        >
          <span className="wwd-data-k">{r.k}</span>
          <span className="wwd-data-v">{r.v}</span>
        </div>
      ))}
    </div>
  )
}
