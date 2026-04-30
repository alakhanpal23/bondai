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

const COUNT = 1800

// ─────────────────────────────────────────────────────────────────────────
// MATH
// ─────────────────────────────────────────────────────────────────────────
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const easeInOutQuint = (t: number) =>
  t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2

const DIAMOND_SCALE = 1.32
const FORM_DURATION = 4.4
// Scene-space shift so the diamond sits clearly in the LEFT portion
// of the visual frame, leaving the right side for readouts.
const SCENE_X = -0.6

// Round-brilliant silhouette — same as Hero
function diamondShape(
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

// ─────────────────────────────────────────────────────────────────────────
// PARTICLE SYSTEM — single diamond, slow controlled rotation
// ─────────────────────────────────────────────────────────────────────────
function ParticleSystem() {
  const ref = useRef<THREE.Points>(null!)
  const yRef = useRef<THREE.Group>(null!)
  const t0 = useRef<number | null>(null)

  const { positions, scatter, target, mid, seed } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    const scatter = new Float32Array(COUNT * 3)
    const target = new Float32Array(COUNT * 3)
    const mid = new Float32Array(COUNT * 3)
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

      // Bias 20 % onto structural rings so the diamond reads as a
      // diamond, same trick Hero uses.
      const ring = Math.random()
      let s1: number
      if (ring < 0.07) s1 = 0.295 + Math.random() * 0.025
      else if (ring < 0.15) s1 = Math.random() * 0.022
      else if (ring < 0.2) s1 = 0.32 + Math.random() * 0.022
      else s1 = Math.random()

      const [tx, ty, tz] = diamondShape(s1, Math.random(), DIAMOND_SCALE)
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

    if (t < 0.86) {
      // Formation
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

        arr[i * 3] = u * u * sx + 2 * u * e * mx + e * e * tx
        arr[i * 3 + 1] = u * u * sy + 2 * u * e * my + e * e * ty
        arr[i * 3 + 2] = u * u * sz + 2 * u * e * mz + e * e * tz
      }
    } else {
      // Settled — particles dead-still relative to target. Group rotation
      // gives the slow turn. No drift, no breathing — investor calm.
      for (let i = 0; i < COUNT; i++) {
        arr[i * 3] = target[i * 3]
        arr[i * 3 + 1] = target[i * 3 + 1]
        arr[i * 3 + 2] = target[i * 3 + 2]
      }
    }

    ref.current.geometry.attributes.position.needsUpdate = true

    // Slow controlled rotation post-formation: ~0.10 rad/s, full revolution
    // every 63 s. Same easeOutCubic ramp used in Hero so there's no jolt
    // at the lock moment.
    const lockAt = FORM_DURATION * 0.86
    if (elapsed < lockAt) {
      const ramp = 1 - Math.pow(1 - elapsed / lockAt, 3)
      yRef.current.rotation.y = ramp * 0.18
    } else {
      yRef.current.rotation.y = 0.18 + (elapsed - lockAt) * 0.10
    }
  })

  return (
    <group ref={yRef} rotation={[-0.06, 0, 0]}>
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
  )
}

// Slow horizontal scan beam — sweeps top→bottom across the diamond every
// 6 s. Subtle, controlled, no flash.
function ScanBeam() {
  const ref = useRef<THREE.Mesh>(null!)
  const TOP = 1.2
  const BOTTOM = -1.3
  const CYCLE = 6

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime
    const cyc = (elapsed % CYCLE) / CYCLE
    ref.current.position.y = TOP - cyc * (TOP - BOTTOM)

    let alpha: number
    if (cyc < 0.05) alpha = cyc / 0.05
    else if (cyc > 0.95) alpha = (1 - cyc) / 0.05
    else alpha = 1
    ;(ref.current.material as THREE.MeshBasicMaterial).opacity = alpha * 0.4
  })

  return (
    <mesh ref={ref}>
      <planeGeometry args={[2.6, 0.02]} />
      <meshBasicMaterial
        color="#a8c5ff"
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

  // Minimal scroll parallax — only the grid backdrop and header drift.
  // Visual + text stay locked in place; the section reads as solid.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const headerY = useTransform(scrollYProgress, [0, 1], ['-3%', '4%'])
  const gridY = useTransform(scrollYProgress, [0, 1], ['6%', '-12%'])

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
            Active scan · 5 measurements
          </span>
        </motion.header>

        <div className="wwd-grid">
          <div className="wwd-visual-col">
            <div className="wwd-visual-frame">
              <Canvas
                camera={{ position: [0, 0, 4.5], fov: 45 }}
                gl={{ antialias: true, alpha: true }}
                dpr={[1, 2]}
              >
                <group position={[SCENE_X, 0, 0]}>
                  <ParticleSystem />
                  <ScanBeam />
                </group>
              </Canvas>

              {/* CAD-inspection overlay */}
              <InspectionOverlay inView={inView} />
            </div>
          </div>

          <motion.div
            className="wwd-text-col"
            initial="hidden"
            animate={inView ? 'show' : 'hidden'}
            transition={{ staggerChildren: 0.18, delayChildren: 0.4 }}
          >
            <motion.div className="wwd-eyebrow" variants={fadeUp}>
              <span className="wwd-eyebrow-mark" aria-hidden />
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
              Kara Labs replaces subjective judgment with audited,
              repeatable measurements — across every diamond, every
              station of the pipeline.
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
// CAD-style inspection overlay
//
// 4 corner fiducials, a faint coordinate axis, and 5 measurement
// readouts that point to specific zones of the diamond via a thin
// leader line ending in a small anchor dot.
// ─────────────────────────────────────────────────────────────────────────
const READOUTS = [
  { k: 'DEPTH',    v: '61.8 %',     top: '32%', delay: 0.0 },
  { k: 'TABLE',    v: '57.0 %',     top: '41%', delay: 0.16 },
  { k: 'SYMMETRY', v: 'EXCELLENT',  top: '50%', delay: 0.32 },
  { k: 'CLARITY',  v: 'VS1',        top: '59%', delay: 0.48 },
  { k: 'COLOR',    v: 'D',          top: '68%', delay: 0.64 },
]

function InspectionOverlay({ inView }: { inView: boolean }) {
  return (
    <div className="wwd-overlay" aria-hidden>
      {/* corner fiducials */}
      <span className="wwd-fid wwd-fid-tl" />
      <span className="wwd-fid wwd-fid-tr" />
      <span className="wwd-fid wwd-fid-bl" />
      <span className="wwd-fid wwd-fid-br" />

      {/* faint coordinate axis (vertical centerline behind the diamond) */}
      <span className="wwd-axis-v" />

      {/* readouts with leader lines */}
      <div className={`wwd-readouts ${inView ? 'on' : ''}`}>
        {READOUTS.map((r) => (
          <div
            key={r.k}
            className="wwd-readout"
            style={{
              top: r.top,
              ['--d' as string]: `${1.6 + r.delay}s`,
            }}
          >
            <span className="wwd-readout-anchor" />
            <span className="wwd-readout-line" />
            <span className="wwd-readout-label">
              <span className="k">{r.k}</span>
              <span className="v">{r.v}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
