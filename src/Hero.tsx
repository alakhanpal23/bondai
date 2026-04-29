import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { Diamond } from './scene/Diamond'
import { MeasurementPlane, RadialTicks } from './scene/Stage'
import { Streaks } from './scene/Streaks'
import { getT, resetTimeline } from './scene/timeline'
import './Hero.css'

type Phase = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

const PHASE_LABEL: Record<Phase, string> = {
  1: 'INIT',
  2: 'SIGNAL',
  3: 'ACCEL',
  4: 'COMPUTE',
  5: 'STABILIZE',
  6: 'ANALYZE',
  7: 'CONVERGE',
  8: 'COMPLETE',
  9: 'LOCKED',
  10: 'READY',
}

function phaseFromT(t: number): Phase {
  if (t < 2) return 1
  if (t < 5) return 2
  if (t < 7) return 3
  if (t < 9) return 4
  if (t < 11) return 5
  if (t < 13) return 6
  if (t < 14) return 7
  if (t < 16) return 8
  if (t < 18.5) return 9
  return 10
}

function PhaseDriver({ onPhase }: { onPhase: (p: Phase) => void }) {
  const cur = useRef<Phase>(1)
  useFrame((state) => {
    const p = phaseFromT(getT(state.clock.elapsedTime))
    if (p !== cur.current) {
      cur.current = p
      onPhase(p)
    }
  })
  return null
}

export default function Hero() {
  const [phase, setPhase] = useState<Phase>(1)

  useEffect(() => {
    resetTimeline()
  }, [])

  return (
    <div className="hero">
      {/* lab grid backdrop, fades in during accel phase */}
      <div className={`scene-grid ${phase >= 3 && phase < 8 ? 'on' : ''}`} />

      <Canvas
        camera={{ position: [0, 0, 7], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        <PhaseDriver onPhase={setPhase} />
        <MeasurementPlane />
        <Streaks />
        <RadialTicks />
        <Diamond />
      </Canvas>

      {/* white flash burst at end of phase 7 */}
      {phase >= 7 && phase < 9 && <div className="white-flash" />}

      <div className="overlay">
        {/* PHASE 1 — dark entry */}
        <div className={`p1 ${phase === 1 ? 'on' : ''}`}>
          <div className="p1-brand">BOND</div>
          <div className="p1-tag">PRECISION INTELLIGENCE FOR GEMSTONES</div>
        </div>

        {/* persistent meta strip during scan/compute/analyze */}
        <header className={`meta ${phase >= 2 && phase < 8 ? 'on' : ''}`}>
          <div className="meta-l">
            <span className="meta-mark" />
            <span>BOND</span>
          </div>
          <div className="meta-r">
            <span className="meta-dot" />
            <span>SYS · {PHASE_LABEL[phase]}</span>
          </div>
        </header>

        {/* PHASE 6 — CV / intelligence overlay */}
        <div className={`cv ${phase === 6 ? 'on' : ''}`}>
          <div className="cv-headline">MULTI-SPECTRAL ANALYSIS ACTIVE</div>
          <div className="bbox">
            <span className="bb tl" />
            <span className="bb tr" />
            <span className="bb bl" />
            <span className="bb br" />
          </div>
          <div className="cv-data d1">
            <span className="cv-k">DEPTH</span>
            <span className="cv-v">61.8%</span>
          </div>
          <div className="cv-data d2">
            <span className="cv-k">TABLE</span>
            <span className="cv-v">57%</span>
          </div>
          <div className="cv-data d3">
            <span className="cv-k">SYMMETRY</span>
            <span className="cv-v">EXCELLENT</span>
          </div>
          <div className="cv-data d4">
            <span className="cv-k">CLARITY</span>
            <span className="cv-v">VS1</span>
          </div>
          <div className="cv-data d5">
            <span className="cv-k">COLOR</span>
            <span className="cv-v">D</span>
          </div>
        </div>

        {/* PHASE 8 — analysis complete */}
        <div className={`p8 ${phase === 8 ? 'on' : ''}`}>
          <div className="p8-line p8-1">ANALYSIS COMPLETE</div>
          <div className="p8-line p8-2">
            <span className="p8-k">CONFIDENCE</span>
            <span className="p8-sep">·</span>
            <span className="p8-v">99.3%</span>
          </div>
        </div>

        {/* PHASE 9 — brand lock-in */}
        <div className={`p9 ${phase >= 9 ? 'on' : ''}`}>
          <h1 className="p9-mark">B O N D</h1>
          <div className="p9-rule" />
          <div className="p9-line p9-1">A NEW STANDARD FOR DIAMOND GRADING</div>
          <div className="p9-line p9-2">
            Autonomous precision for the world&rsquo;s most valuable stones.
          </div>
        </div>

        {/* PHASE 10 — CTA */}
        <div className={`p10 ${phase >= 10 ? 'on' : ''}`}>
          <button className="cta">Request Early Access</button>
          <div className="cta-sub">Private preview opening soon.</div>
        </div>
      </div>
    </div>
  )
}
