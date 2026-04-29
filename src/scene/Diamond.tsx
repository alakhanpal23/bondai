import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { clamp01, getT, smoothstep } from './timeline'

const N = 16
const SCALE = 1.95

type Edge = { ai: number; bi: number; revealTime: number }

function buildDiamond() {
  const verts: number[] = []

  // 0 — table center
  verts.push(0, 0.42 * SCALE, 0)
  // 1..N — table ring
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2
    verts.push(Math.cos(a) * 0.55 * SCALE, 0.42 * SCALE, Math.sin(a) * 0.55 * SCALE)
  }
  // N+1..2N — girdle ring (offset by half-segment)
  for (let i = 0; i < N; i++) {
    const a = ((i + 0.5) / N) * Math.PI * 2
    verts.push(Math.cos(a) * 1.0 * SCALE, 0, Math.sin(a) * 1.0 * SCALE)
  }
  // 2N+1 — culet
  verts.push(0, -0.95 * SCALE, 0)

  const tCenter = 0
  const tRing = (i: number) => 1 + (i % N)
  const gRing = (i: number) => 1 + N + (i % N)
  const culet = 1 + 2 * N

  // Solid mesh triangles
  const tris: number[] = []
  // table top (fan)
  for (let i = 0; i < N; i++) tris.push(tCenter, tRing(i), tRing(i + 1))
  // crown (table → girdle)
  for (let i = 0; i < N; i++) {
    tris.push(tRing(i), gRing(i), tRing(i + 1))
    tris.push(gRing(i), gRing(i + 1), tRing(i + 1))
  }
  // pavilion (girdle → culet)
  for (let i = 0; i < N; i++) tris.push(gRing(i), gRing(i + 1), culet)

  // Edges, grouped by reveal phase to feel "computed"
  const edges: Edge[] = []
  // 7.20-7.45: girdle ring (defines silhouette)
  for (let i = 0; i < N; i++) {
    edges.push({ ai: gRing(i), bi: gRing(i + 1), revealTime: 7.2 + Math.random() * 0.25 })
  }
  // 7.40-7.75: pavilion (girdle → culet)
  for (let i = 0; i < N; i++) {
    edges.push({ ai: gRing(i), bi: culet, revealTime: 7.4 + Math.random() * 0.35 })
  }
  // 7.65-7.95: crown diagonals (table ↔ girdle)
  for (let i = 0; i < N; i++) {
    edges.push({ ai: tRing(i), bi: gRing(i), revealTime: 7.65 + Math.random() * 0.3 })
    edges.push({ ai: tRing(i + 1), bi: gRing(i), revealTime: 7.65 + Math.random() * 0.3 })
  }
  // 7.85-8.05: table ring perimeter
  for (let i = 0; i < N; i++) {
    edges.push({ ai: tRing(i), bi: tRing(i + 1), revealTime: 7.85 + Math.random() * 0.2 })
  }

  return {
    positions: new Float32Array(verts),
    indices: new Uint16Array(tris),
    edges,
  }
}

export function Diamond() {
  const groupRef = useRef<THREE.Group>(null!)
  const wireRef = useRef<THREE.LineSegments>(null!)
  const meshRef = useRef<THREE.Mesh>(null!)
  const nodeRef = useRef<THREE.Points>(null!)

  const geom = useMemo(buildDiamond, [])
  const edgePositions = useMemo(
    () => new Float32Array(geom.edges.length * 6),
    [geom.edges],
  )

  useFrame((state) => {
    const t = getT(state.clock.elapsedTime)

    // ---- wireframe edge reveal ----
    for (let i = 0; i < geom.edges.length; i++) {
      const e = geom.edges[i]
      const idx = i * 6
      if (t >= e.revealTime) {
        edgePositions[idx] = geom.positions[e.ai * 3]
        edgePositions[idx + 1] = geom.positions[e.ai * 3 + 1]
        edgePositions[idx + 2] = geom.positions[e.ai * 3 + 2]
        edgePositions[idx + 3] = geom.positions[e.bi * 3]
        edgePositions[idx + 4] = geom.positions[e.bi * 3 + 1]
        edgePositions[idx + 5] = geom.positions[e.bi * 3 + 2]
      } else {
        edgePositions[idx] = 0
        edgePositions[idx + 1] = 0
        edgePositions[idx + 2] = 0
        edgePositions[idx + 3] = 0
        edgePositions[idx + 4] = 0
        edgePositions[idx + 5] = 0
      }
    }
    wireRef.current.geometry.attributes.position.needsUpdate = true

    // ---- wire opacity & color ----
    const wireMat = wireRef.current.material as THREE.LineBasicMaterial
    let wireOp = 0
    if (t >= 7.2 && t < 13.6) wireOp = clamp01((t - 7.2) * 6)
    else if (t >= 13.6 && t < 13.85) wireOp = 1 - (t - 13.6) * 4 // dim before flash
    else if (t >= 13.85 && t < 14.6) wireOp = clamp01((t - 13.85) * 1.6) // restore
    else if (t >= 14.6) wireOp = 0.85
    wireMat.opacity = wireOp
    // turn pure white briefly during convergence burst
    if (t > 13.5 && t < 13.9) wireMat.color.setHex(0xffffff)
    else wireMat.color.setHex(0xb8d0ff)

    // ---- mesh (facet fill) ----
    const meshMat = meshRef.current.material as THREE.MeshBasicMaterial
    let facetOp = 0
    if (t >= 8.2 && t < 13.5) facetOp = smoothstep(8.2, 9.0, t) * 0.32
    else if (t >= 13.5 && t < 13.85) facetOp = 0.32 + (t - 13.5) * 0.6 // flare
    else if (t >= 13.85) facetOp = 0.34 + Math.sin((t - 13.85) * 0.8) * 0.04
    meshMat.opacity = Math.max(0, Math.min(0.55, facetOp))

    // ---- bright seed node (pre-wireframe) ----
    const nodeMat = nodeRef.current.material as THREE.PointsMaterial
    let nodeOp = 0
    if (t >= 7.0 && t < 7.2) nodeOp = (t - 7.0) * 5 // fade in
    else if (t >= 7.2 && t < 7.55) nodeOp = 1 - (t - 7.2) / 0.35 // fade out
    nodeMat.opacity = Math.max(0, nodeOp)

    // ---- rotation ----
    let rotY = 0
    if (t >= 7.2 && t < 9) rotY = (t - 7.2) * 0.12
    else if (t >= 9 && t < 14) rotY = 1.8 * 0.12 + (t - 9) * 0.16
    else if (t >= 14) rotY = 1.8 * 0.12 + 5 * 0.16 + (t - 14) * 0.06 // slow drift
    groupRef.current.rotation.y = rotY

    // ---- subtle scintillation breathing ----
    const breathe =
      t > 9 ? 1 + Math.sin((t - 9) * 1.4) * 0.012 : 1
    groupRef.current.scale.setScalar(breathe)
  })

  return (
    <group ref={groupRef} position={[0, 0.45, 0]}>
      {/* tilt for cinematic three-quarter view */}
      <group rotation={[-0.13, 0, 0]}>
        {/* seed node */}
        <points ref={nodeRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={1}
              array={new Float32Array([0, 0, 0])}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial
            color="#ffffff"
            size={0.45}
            sizeAttenuation
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>

        {/* solid translucent facets */}
        <mesh ref={meshRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={geom.positions.length / 3}
              array={geom.positions}
              itemSize={3}
            />
            <bufferAttribute
              attach="index"
              array={geom.indices}
              count={geom.indices.length}
              itemSize={1}
            />
          </bufferGeometry>
          <meshBasicMaterial
            color="#3a6cd2"
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* wireframe edges */}
        <lineSegments ref={wireRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={geom.edges.length * 2}
              array={edgePositions}
              itemSize={3}
              usage={THREE.DynamicDrawUsage}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color="#b8d0ff"
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </lineSegments>
      </group>
    </group>
  )
}
