import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getT } from './timeline'

const MAIN_COUNT = 700
const BURST_COUNT = 120
const TOTAL = MAIN_COUNT + BURST_COUNT

type Streak = {
  startTime: number
  duration: number
  p0: [number, number, number]
  p1: [number, number, number]
  p2: [number, number, number]
}

function bezier(
  p0: [number, number, number],
  p1: [number, number, number],
  p2: [number, number, number],
  t: number,
  out: [number, number, number],
): void {
  const u = 1 - t
  out[0] = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0]
  out[1] = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]
  out[2] = u * u * p0[2] + 2 * u * t * p1[2] + t * t * p2[2]
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export function Streaks() {
  const ref = useRef<THREE.LineSegments>(null!)

  const streaks = useMemo<Streak[]>(() => {
    const arr: Streak[] = []

    // Main signal (Phase 2 → 5): 700 streaks distributed 2.0s → 12.0s,
    // density and speed both ramping up over time.
    for (let i = 0; i < MAIN_COUNT; i++) {
      const k = i / MAIN_COUNT
      const startTime = 2.0 + k * 10.0 + (Math.random() - 0.5) * 0.45

      let duration: number
      if (startTime < 3.5) duration = rand(1.2, 1.5)
      else if (startTime < 6.5) duration = rand(0.85, 1.15)
      else if (startTime < 9.5) duration = rand(0.6, 0.85)
      else duration = rand(0.5, 0.7)

      // Source: far LEFT, scattered y/z
      const sx = rand(-14, -9)
      const sy = rand(-3, 3)
      const sz = rand(-3, 3)

      // Target: center with small scatter (will be absorbed by diamond)
      const ang = rand(0, Math.PI * 2)
      const r = rand(0.0, 0.45)
      const ex = Math.cos(ang) * r
      const ey = rand(-0.4, 0.6)
      const ez = Math.sin(ang) * r

      // Curved control point: pulled toward center but offset for organic curve
      const mx = (sx + ex) * 0.42 + rand(-1.2, 1.2)
      const my = (sy + ey) * 0.5 + rand(-1.2, 1.5)
      const mz = (sz + ez) * 0.5 + rand(-1.2, 1.2)

      arr.push({
        startTime,
        duration,
        p0: [sx, sy, sz],
        p1: [mx, my, mz],
        p2: [ex, ey, ez],
      })
    }

    // Phase 7 final convergence burst: from ALL directions, 13.0s → 13.6s,
    // very fast, dense, all converging on center.
    for (let i = 0; i < BURST_COUNT; i++) {
      const startTime = 13.0 + (i / BURST_COUNT) * 0.55
      const duration = rand(0.35, 0.55)

      const ang = Math.random() * Math.PI * 2
      const dist = rand(7.5, 11)
      const sx = Math.cos(ang) * dist
      const sy = rand(-3, 3)
      const sz = Math.sin(ang) * dist - 1.5

      const ex = rand(-0.18, 0.18)
      const ey = rand(-0.18, 0.18)
      const ez = rand(-0.18, 0.18)

      const mx = (sx + ex) * 0.32
      const my = (sy + ey) * 0.5 + rand(-1, 1)
      const mz = (sz + ez) * 0.32

      arr.push({
        startTime,
        duration,
        p0: [sx, sy, sz],
        p1: [mx, my, mz],
        p2: [ex, ey, ez],
      })
    }

    return arr
  }, [])

  const positions = useMemo(() => {
    const arr = new Float32Array(TOTAL * 2 * 3)
    // park everything off-screen until activated
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] = 0
      arr[i + 1] = 9999
      arr[i + 2] = 0
    }
    return arr
  }, [])

  const colors = useMemo(() => new Float32Array(TOTAL * 2 * 3), [])

  // reusable scratch
  const head: [number, number, number] = [0, 0, 0]
  const tail: [number, number, number] = [0, 0, 0]

  useFrame((state) => {
    const t = getT(state.clock.elapsedTime)

    for (let i = 0; i < TOTAL; i++) {
      const s = streaks[i]
      const localT = (t - s.startTime) / s.duration
      const idx = i * 6

      if (localT < 0 || localT > 1.05) {
        positions[idx] = 0
        positions[idx + 1] = 9999
        positions[idx + 2] = 0
        positions[idx + 3] = 0
        positions[idx + 4] = 9999
        positions[idx + 5] = 0
        colors[idx] = 0
        colors[idx + 1] = 0
        colors[idx + 2] = 0
        colors[idx + 3] = 0
        colors[idx + 4] = 0
        colors[idx + 5] = 0
        continue
      }

      const eHead = Math.min(1, localT)
      const eTail = Math.max(0, eHead - 0.11)

      bezier(s.p0, s.p1, s.p2, eHead, head)
      bezier(s.p0, s.p1, s.p2, eTail, tail)

      positions[idx] = tail[0]
      positions[idx + 1] = tail[1]
      positions[idx + 2] = tail[2]
      positions[idx + 3] = head[0]
      positions[idx + 4] = head[1]
      positions[idx + 5] = head[2]

      // intensity envelope: snap on, hold, soft fade at arrival
      const env =
        Math.min(1, localT * 18) * (1 - Math.max(0, localT - 0.88) * 7.5)
      const intensity = Math.max(0, env)

      // tail = dim electric blue, head = bright white-blue
      colors[idx] = 0.05 * intensity
      colors[idx + 1] = 0.12 * intensity
      colors[idx + 2] = 0.32 * intensity
      colors[idx + 3] = 0.85 * intensity
      colors[idx + 4] = 0.95 * intensity
      colors[idx + 5] = 1.0 * intensity
    }

    const geom = ref.current.geometry
    geom.attributes.position.needsUpdate = true
    geom.attributes.color.needsUpdate = true
  })

  return (
    <lineSegments ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={TOTAL * 2}
          array={positions}
          itemSize={3}
          usage={THREE.DynamicDrawUsage}
        />
        <bufferAttribute
          attach="attributes-color"
          count={TOTAL * 2}
          array={colors}
          itemSize={3}
          usage={THREE.DynamicDrawUsage}
        />
      </bufferGeometry>
      <lineBasicMaterial
        vertexColors
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  )
}
