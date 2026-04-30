import { Canvas, useFrame } from '@react-three/fiber'
import {
  motion,
  useInView,
  useScroll,
  useTransform,
} from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import './WhatWeDo.css'

const COUNT = 2200

// ─────────────────────────────────────────────────────────────────────────
// MATH
// ─────────────────────────────────────────────────────────────────────────
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const easeInOutQuint = (t: number) =>
  t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2

const DIAMOND_SCALE = 1.05
const FORM_DURATION = 1.7
// Diamond sits centred horizontally and slightly up so the bottom
// of the frame is free for the matrix data grid.
const SCENE_X = 0
const SCENE_Y = 0.32

// Hexagonal crystal silhouette — quartz-style bipyramid: pointed
// terminator at top, hexagonal prism body, pointed apex at bottom.
// Taller-than-wide; sits inside the same horizontal envelope as the
// princess so it doesn't overlap the side telemetry.
function diamondShape(
  s1: number,
  s2: number,
  scale: number,
): [number, number, number] {
  // Proportions: short symmetric pyramidal caps + long hex prism body
  // (body ≈ 64% of total height) — the iconic quartz silhouette.
  let y: number, r: number
  if (s1 < 0.18) {
    // top pyramidal terminator
    const k = s1 / 0.18
    y = lerp(1.1, 0.7, k)
    r = lerp(0.0, 1.0, k)
  } else if (s1 < 0.82) {
    // hex prism body
    const k = (s1 - 0.18) / 0.64
    y = lerp(0.7, -0.7, k)
    r = 1.0
  } else {
    // bottom pyramidal apex
    const k = (s1 - 0.82) / 0.18
    y = lerp(-0.7, -1.1, k)
    r = lerp(1.0, 0.0, k)
  }

  // Regular hexagonal cross-section, inscribed in unit circle.
  // Vertices at θ = 0°, 60°, 120°, ... (radius 1), edge midpoints
  // at θ = 30°, 90°, ... (radius √3/2).
  const theta = s2 * Math.PI * 2
  const sectorAngle = Math.PI / 3
  const sectorMid =
    Math.round((theta - Math.PI / 6) / sectorAngle) * sectorAngle +
    Math.PI / 6
  const localAngle = theta - sectorMid
  const APOTHEM = Math.cos(Math.PI / 6)
  const hexR = APOTHEM / Math.cos(localAngle)
  const xUnit = hexR * Math.cos(theta)
  const zUnit = hexR * Math.sin(theta)

  return [xUnit * r * scale, y * scale, zUnit * r * scale]
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
function ParticleSystem({ inView }: { inView: boolean }) {
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

      // Wireframe-style biases — most particles snap to one of the 6
      // structural edges (vertical prism + slant pyramid edges), with
      // bright concentrations at the four "node" positions: top apex,
      // bottom apex, top hex termination, bottom hex termination. This
      // mirrors the logo's constellation wireframe aesthetic.
      const ring = Math.random()
      let s1: number
      let s2: number = Math.random()
      if (ring < 0.06) {
        // top termination hex perimeter
        s1 = 0.165 + Math.random() * 0.025
      } else if (ring < 0.12) {
        // bottom termination hex perimeter
        s1 = 0.81 + Math.random() * 0.025
      } else if (ring < 0.16) {
        // top apex node
        s1 = Math.random() * 0.02
      } else if (ring < 0.20) {
        // bottom apex node
        s1 = 0.98 + Math.random() * 0.02
      } else if (ring < 0.86) {
        // structural edge — anywhere along s1, but s2 snapped to one
        // of the 6 vertex angles so the particle lands on a vertical
        // prism edge or a pyramidal slant edge.
        s1 = Math.random()
        const vertexIdx = Math.floor(Math.random() * 6)
        const jitter = (Math.random() - 0.5) * 0.012
        s2 = vertexIdx / 6 + jitter
      } else {
        // sparse interior glow
        s1 = Math.random()
      }

      const [tx, ty, tz] = diamondShape(s1, s2, DIAMOND_SCALE)
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
    // Hold particles at scatter until the section enters viewport
    if (!inView) return
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
    // Cushion has a clear "front face" — keep rotation gentle so the
    // shape stays recognisable. Subtle continuous spin, not a fast turn.
    const lockAt = FORM_DURATION * 0.86
    if (elapsed < lockAt) {
      const ramp = 1 - Math.pow(1 - elapsed / lockAt, 3)
      yRef.current.rotation.y = ramp * 0.12
    } else {
      yRef.current.rotation.y = 0.12 + (elapsed - lockAt) * 0.05
    }
  })

  // Composition: outer group holds fixed forward TILT (in world space),
  // inner group does the Y rotation around the cushion's own vertical
  // axis. This way the tilt direction doesn't precess — top stays
  // tilted toward camera while only the cushion's facets spin.
  return (
    <group rotation={[-0.12, 0, 0]}>
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

// Scan beam — does NOT start until after the diamond has formed.
// Sweeps top→bottom every 2.6 s once active.
const SCAN_START_DELAY = FORM_DURATION + 0.05 // start essentially at lock

function ScanBeam({ inView }: { inView: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const t0 = useRef<number | null>(null)
  const TOP = 1.2
  const BOTTOM = -1.3
  const CYCLE = 2.6

  useFrame((state) => {
    const mat = ref.current.material as THREE.MeshBasicMaterial
    if (!inView) {
      mat.opacity = 0
      return
    }
    if (t0.current === null) t0.current = state.clock.elapsedTime
    const elapsed = state.clock.elapsedTime - t0.current

    if (elapsed < SCAN_START_DELAY) {
      mat.opacity = 0
      return
    }

    const sinceScan = elapsed - SCAN_START_DELAY
    const cyc = (sinceScan % CYCLE) / CYCLE
    ref.current.position.y = TOP - cyc * (TOP - BOTTOM)

    let alpha: number
    if (cyc < 0.06) alpha = cyc / 0.06
    else if (cyc > 0.94) alpha = (1 - cyc) / 0.06
    else alpha = 1

    // ramp the FIRST scan in over 0.25s so it doesn't pop
    const firstCycleRamp = Math.min(1, sinceScan / 0.25)
    mat.opacity = alpha * 0.45 * firstCycleRamp
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
  const gridY = useTransform(scrollYProgress, [0, 1], ['6%', '-12%'])

  return (
    <section ref={ref} className="wwd" id="what-we-do">
      <motion.div className="wwd-bg-grid" style={{ y: gridY }} aria-hidden />

      <div className="wwd-inner">
        <div className="wwd-grid">
          <div className="wwd-visual-col">
            <div className="wwd-visual-frame">
              <Canvas
                camera={{ position: [0, 0, 4.5], fov: 45 }}
                gl={{ antialias: true, alpha: true }}
                dpr={[1, 2]}
              >
                <group position={[SCENE_X, SCENE_Y, 0]}>
                  <ParticleSystem inView={inView} />
                  <ScanBeam inView={inView} />
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
// CAD / matrix-terminal inspection overlay
//
// LEFT  — streaming hex/decimal log column (telemetry / matrix code)
// RIGHT — monospace measurement readouts (DEPTH / TABLE / etc.)
// BOTTOM — multi-column matrix grid of hex codes (background data feel)
// ─────────────────────────────────────────────────────────────────────────

const LEFT_STREAM = [
  '0xC2D8 · E1F4',
  '0x91A2 · B4F5',
  'SCAN_INIT  ▸ ok',
  '63.2841',
  '0x52F1 · 88AB',
  'FACET  24/57',
  '57.0214',
  '0x9F4A · 2B3D',
  'GIRDLE_LOCK ok',
  '61.8348',
  'CALIB_PASS  ▸',
  '0x847C · E92A',
]

const READOUTS = [
  { k: 'DEPTH',    v: '61.8 %' },
  { k: 'TABLE',    v: '57.0 %' },
  { k: 'SYMM',     v: 'EX' },
  { k: 'CLARITY',  v: 'VS1' },
  { k: 'COLOR',    v: 'D' },
]

// Decryption / matrix-style text reveal. Each character cycles through
// random glyphs; locked positions reveal progressively left → right
// over the given duration.
const SCRAMBLE_CHARS =
  '0123456789ABCDEFアカサタナハマヤラワイキシチニヒミリ#$%&'
const PRESERVED = ' ·.,/:[]()<>+-=▸/'

function ScrambleText({
  text,
  delay,
  duration = 900,
  inView,
}: {
  text: string
  delay: number
  duration?: number
  inView: boolean
}) {
  const [display, setDisplay] = useState('')

  useEffect(() => {
    if (!inView) {
      setDisplay('')
      return
    }

    let timer: ReturnType<typeof setTimeout> | null = null
    let interval: ReturnType<typeof setInterval> | null = null

    timer = setTimeout(() => {
      const totalFrames = Math.max(2, Math.floor(duration / 40))
      let frame = 0

      interval = setInterval(() => {
        frame++
        const progress = frame / totalFrames

        if (frame >= totalFrames) {
          setDisplay(text)
          if (interval) clearInterval(interval)
          return
        }

        const lockedCount = Math.floor(progress * text.length)
        let result = ''
        for (let i = 0; i < text.length; i++) {
          const ch = text[i]
          if (i < lockedCount || PRESERVED.includes(ch)) {
            result += ch
          } else {
            result +=
              SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]
          }
        }
        setDisplay(result)
      }, 40)
    }, delay)

    return () => {
      if (timer) clearTimeout(timer)
      if (interval) clearInterval(interval)
    }
  }, [text, delay, duration, inView])

  return <>{display}</>
}

// Sequence anchor for HTML overlays — scramble + opacity reveal start
// just after diamond locks. Scan beam runs in parallel.
const REVEAL_BASE_MS = (FORM_DURATION + 0.2) * 1000 // ~1.9 s

function InspectionOverlay({ inView }: { inView: boolean }) {
  return (
    <div className="wwd-overlay" aria-hidden>
      {/* corner fiducials */}
      <span className="wwd-fid wwd-fid-tl" />
      <span className="wwd-fid wwd-fid-tr" />
      <span className="wwd-fid wwd-fid-bl" />
      <span className="wwd-fid wwd-fid-br" />

      {/* faint vertical axis */}
      <span className="wwd-axis-v" />

      {/* LEFT — streaming hex / decimal / status log (matrix-decrypts in) */}
      <div className={`wwd-stream wwd-stream-left ${inView ? 'on' : ''}`}>
        {LEFT_STREAM.map((line, i) => {
          const startMs = REVEAL_BASE_MS + i * 22
          return (
            <div
              key={i}
              className="wwd-stream-line"
              style={{ ['--d' as string]: `${startMs / 1000}s` }}
            >
              <ScrambleText
                text={line}
                delay={startMs}
                duration={260}
                inView={inView}
              />
            </div>
          )
        })}
      </div>

      {/* RIGHT — monospace measurement readouts (values decrypt in) */}
      <div className={`wwd-readouts ${inView ? 'on' : ''}`}>
        {READOUTS.map((r, i) => {
          const startMs = REVEAL_BASE_MS + 60 + i * 50
          return (
            <div
              key={r.k}
              className="wwd-readout"
              style={{ ['--d' as string]: `${startMs / 1000}s` }}
            >
              <span className="wwd-readout-prefix">▸</span>
              <span className="wwd-readout-k">{r.k}</span>
              <span className="wwd-readout-v">
                <ScrambleText
                  text={r.v}
                  delay={startMs + 40}
                  duration={360}
                  inView={inView}
                />
              </span>
            </div>
          )
        })}
      </div>

    </div>
  )
}

