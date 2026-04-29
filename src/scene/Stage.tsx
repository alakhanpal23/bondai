import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getT, smoothstep } from './timeline'

function ringSegments(radius: number, segments: number, yOffset = 0): Float32Array {
  const arr = new Float32Array(segments * 2 * 3)
  for (let i = 0; i < segments; i++) {
    const a1 = (i / segments) * Math.PI * 2
    const a2 = ((i + 1) / segments) * Math.PI * 2
    arr[i * 6] = Math.cos(a1) * radius
    arr[i * 6 + 1] = yOffset
    arr[i * 6 + 2] = Math.sin(a1) * radius
    arr[i * 6 + 3] = Math.cos(a2) * radius
    arr[i * 6 + 4] = yOffset
    arr[i * 6 + 5] = Math.sin(a2) * radius
  }
  return arr
}

export function MeasurementPlane() {
  const ref = useRef<THREE.LineSegments>(null!)

  const positions = useMemo(() => {
    const radii = [1.95, 2.55, 3.2, 3.85]
    const seg = 96
    const total = radii.length * seg * 6
    const out = new Float32Array(total)
    let idx = 0
    for (const r of radii) {
      const ring = ringSegments(r, seg)
      out.set(ring, idx)
      idx += ring.length
    }
    return out
  }, [])

  useFrame((state) => {
    const t = getT(state.clock.elapsedTime)
    let op = 0
    if (t >= 4.5 && t < 7) op = smoothstep(4.5, 6.5, t) * 0.55
    else if (t >= 7 && t < 13.5) op = 0.55
    else if (t >= 13.5 && t < 14) op = 0.55 * (1 - smoothstep(13.5, 14, t))
    ;(ref.current.material as THREE.LineBasicMaterial).opacity = op

    // gentle breathing pulse on rings during compute phases
    if (t > 7 && t < 13.5) {
      ref.current.scale.setScalar(1 + Math.sin(t * 0.9) * 0.012)
    } else {
      ref.current.scale.setScalar(1)
    }
  })

  return (
    <lineSegments ref={ref} position={[0, -1.95, 0]}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial
        color="#5e85d8"
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  )
}

export function RadialTicks() {
  const ref = useRef<THREE.LineSegments>(null!)
  const N = 72

  const positions = useMemo(() => {
    const arr = new Float32Array(N * 2 * 3)
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2
      const major = i % 6 === 0
      const r1 = 2.65
      const r2 = major ? 3.05 : 2.85
      arr[i * 6] = Math.cos(a) * r1
      arr[i * 6 + 1] = 0
      arr[i * 6 + 2] = Math.sin(a) * r1
      arr[i * 6 + 3] = Math.cos(a) * r2
      arr[i * 6 + 4] = 0
      arr[i * 6 + 5] = Math.sin(a) * r2
    }
    return arr
  }, [])

  useFrame((state) => {
    const t = getT(state.clock.elapsedTime)
    ref.current.rotation.y = t * 0.32

    let op = 0
    if (t >= 10.7 && t < 11.2) op = smoothstep(10.7, 11.2, t) * 0.85
    else if (t >= 11.2 && t < 13.4) op = 0.85
    else if (t >= 13.4 && t < 13.8) op = 0.85 * (1 - smoothstep(13.4, 13.8, t))
    ;(ref.current.material as THREE.LineBasicMaterial).opacity = op
  })

  return (
    <lineSegments ref={ref} position={[0, -1.95, 0]}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={N * 2}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial
        color="#a3c2ff"
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  )
}
