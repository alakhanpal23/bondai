import { motion, useInView } from 'framer-motion'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { geoEqualEarth, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import './Reach.css'

const WORLD_URL =
  'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

type City = {
  name: string
  coords: [number, number] // [lon, lat]
  align?: 'left' | 'right' | 'top' | 'bottom'
}

type Arc = {
  from: [number, number]
  to: [number, number]
}

const CITIES: City[] = [
  { name: 'Surat',     coords: [72.8311,  21.1702], align: 'bottom' },
  { name: 'Mumbai',    coords: [72.8777,  19.0760], align: 'left' },
  { name: 'Antwerp',   coords: [4.4025,   51.2194], align: 'top' },
  { name: 'New York',  coords: [-74.006,  40.7128], align: 'left' },
  { name: 'Hong Kong', coords: [114.1694, 22.3193], align: 'right' },
  { name: 'Shenzhen',  coords: [114.0579, 22.5431], align: 'top' },
  { name: 'Botswana',  coords: [25.9231, -22.3285], align: 'right' },
]

const ARCS: Arc[] = [
  { from: [72.8311, 21.1702],  to: [114.1694, 22.3193] },  // Surat → HK
  { from: [72.8777, 19.0760],  to: [4.4025, 51.2194]   },  // Mumbai → Antwerp
  { from: [114.0579, 22.5431], to: [114.1694, 22.3193] },  // Shenzhen → HK
  { from: [4.4025, 51.2194],   to: [-74.006, 40.7128]  },  // Antwerp → NY
  { from: [25.9231, -22.3285], to: [72.8311, 21.1702]  },  // Botswana → Surat
  { from: [114.1694, 22.3193], to: [-74.006, 40.7128]  },  // HK → NY
  { from: [25.9231, -22.3285], to: [4.4025, 51.2194]   },  // Botswana → Antwerp
]

const MAP_W = 1200
const MAP_H = 620

export default function Reach() {
  const sectionRef = useRef<HTMLElement>(null)
  const inView = useInView(sectionRef, { once: true, margin: '-25%' })

  return (
    <section ref={sectionRef} className="reach" id="our-reach">
      <div className="reach-bg-grid" aria-hidden />

      <div className="reach-inner">
        <ReachMap inView={inView} />
        <ReachText inView={inView} />
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// MAP
// ─────────────────────────────────────────────────────────────────────────

function ReachMap({ inView }: { inView: boolean }) {
  const [features, setFeatures] = useState<Feature[]>([])

  useEffect(() => {
    let cancelled = false
    fetch(WORLD_URL)
      .then((r) => r.json())
      .then((topo) => {
        if (cancelled) return
        const geo = feature(
          topo,
          topo.objects.countries,
        ) as unknown as FeatureCollection<Geometry>
        setFeatures(geo.features)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const projection = useMemo(
    () =>
      geoEqualEarth()
        .scale(MAP_W / 5.6)
        .translate([MAP_W / 2, MAP_H / 2 + 20]),
    [],
  )
  const path = useMemo(() => geoPath(projection), [projection])

  // pre-project cities
  const cityXY = useMemo(
    () =>
      CITIES.map((c) => {
        const xy = projection(c.coords)
        return { ...c, xy: xy ?? [0, 0] }
      }),
    [projection],
  )

  // pre-project & build curved bezier arcs
  const arcGeo = useMemo(
    () =>
      ARCS.map((a) => {
        const p0 = projection(a.from) ?? [0, 0]
        const p1 = projection(a.to) ?? [0, 0]
        const [x1, y1] = p0
        const [x2, y2] = p1
        const dx = x2 - x1
        const dy = y2 - y1
        const dist = Math.hypot(dx, dy)
        // curve bows upward (toward smaller y) — flight-path feel
        const cx = (x1 + x2) / 2
        const cy = (y1 + y2) / 2 - dist * 0.22
        return {
          d: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`,
          length: dist,
        }
      }),
    [projection],
  )

  return (
    <div className="reach-map-wrap">
      <svg
        className="reach-map"
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="node-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#cfe0ff" stopOpacity="0.85" />
            <stop offset="60%" stopColor="#6ea0ff" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#6ea0ff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="arc-grad" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6ea0ff" stopOpacity="0.15" />
            <stop offset="50%" stopColor="#a3c2ff" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#6ea0ff" stopOpacity="0.15" />
          </linearGradient>
          <filter id="node-blur">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
        </defs>

        {/* Continents — fade in slowly */}
        <motion.g
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 2, ease: [0.22, 0.61, 0.36, 1] }}
        >
          {features.map((f, i) => (
            <path
              key={i}
              d={path(f) || undefined}
              fill="rgba(18, 30, 56, 0.55)"
              stroke="rgba(110, 160, 255, 0.32)"
              strokeWidth={0.45}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </motion.g>

        {/* Arcs — draw in sequentially after continents */}
        <g>
          {arcGeo.map((a, i) => (
            <ArcLine
              key={i}
              d={a.d}
              inView={inView}
              delay={1.6 + i * 0.32}
            />
          ))}
        </g>

        {/* Cities */}
        <g>
          {cityXY.map((c, i) => (
            <CityNode
              key={c.name}
              x={c.xy[0]}
              y={c.xy[1]}
              name={c.name}
              align={c.align}
              inView={inView}
              delay={0.9 + i * 0.18}
            />
          ))}
        </g>
      </svg>

      <div className="reach-map-caption" aria-hidden>
        <span>LIVE DEPLOYMENT NETWORK</span>
        <span className="reach-map-coords">12.0 / SYS · ONLINE</span>
      </div>
    </div>
  )
}

function ArcLine({
  d,
  inView,
  delay,
}: {
  d: string
  inView: boolean
  delay: number
}) {
  return (
    <g>
      <motion.path
        d={d}
        fill="none"
        stroke="url(#arc-grad)"
        strokeWidth={1.1}
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={inView ? { pathLength: 1, opacity: 0.85 } : {}}
        transition={{
          pathLength: { duration: 2.2, delay, ease: [0.22, 0.61, 0.36, 1] },
          opacity: { duration: 0.6, delay },
        }}
      />
      {/* travelling data packet */}
      <motion.circle
        r={2}
        fill="#eaf2ff"
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: [0, 1, 1, 0] } : {}}
        transition={{
          duration: 3.2,
          delay: delay + 1.6,
          repeat: Infinity,
          repeatDelay: 1.4,
          ease: 'linear',
          times: [0, 0.06, 0.94, 1],
        }}
        style={
          {
            offsetPath: `path('${d}')`,
            offsetDistance: '0%',
            offsetRotate: '0deg',
            animation: inView
              ? `packet-travel 3.2s ${delay + 1.6}s linear infinite`
              : 'none',
          } as CSSProperties
        }
      />
    </g>
  )
}

function CityNode({
  x,
  y,
  name,
  align = 'right',
  inView,
  delay,
}: {
  x: number
  y: number
  name: string
  align?: 'left' | 'right' | 'top' | 'bottom'
  inView: boolean
  delay: number
}) {
  const labelDx = align === 'left' ? -12 : align === 'right' ? 12 : 0
  const labelDy =
    align === 'top' ? -14 : align === 'bottom' ? 18 : 4
  const anchor =
    align === 'left' ? 'end' : align === 'right' ? 'start' : 'middle'

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={inView ? { opacity: 1 } : {}}
      transition={{ duration: 0.5, delay }}
    >
      {/* outer pulsing halo */}
      <circle
        cx={x}
        cy={y}
        r={18}
        fill="url(#node-glow)"
        opacity={0.65}
      />
      <motion.circle
        cx={x}
        cy={y}
        r={5}
        fill="none"
        stroke="#9bb8ff"
        strokeWidth={1}
        initial={{ scale: 1, opacity: 0 }}
        animate={
          inView
            ? { scale: [1, 3.4, 3.4], opacity: [0.7, 0, 0] }
            : {}
        }
        transition={{
          duration: 2.6,
          delay: delay + 0.2,
          repeat: Infinity,
          repeatDelay: 0.4,
          ease: 'easeOut',
          times: [0, 0.7, 1],
        }}
        style={{ transformOrigin: `${x}px ${y}px` }}
      />
      {/* solid centre */}
      <circle cx={x} cy={y} r={3.2} fill="#eaf2ff" />
      <circle cx={x} cy={y} r={1.4} fill="#fff" />

      {/* label */}
      <motion.text
        x={x + labelDx}
        y={y + labelDy}
        fontSize={10.5}
        fontFamily="Geist, Inter, sans-serif"
        fontWeight={500}
        letterSpacing="0.16em"
        fill="rgba(220, 235, 255, 0.92)"
        textAnchor={anchor}
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 0.6, delay: delay + 0.35 }}
      >
        {name.toUpperCase()}
      </motion.text>
    </motion.g>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// TEXT PANEL
// ─────────────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
}

function ReachText({ inView }: { inView: boolean }) {
  return (
    <motion.div
      className="reach-text"
      initial="hidden"
      animate={inView ? 'show' : 'hidden'}
      transition={{ staggerChildren: 0.18, delayChildren: 0.4 }}
    >
      <motion.div
        variants={fadeUp}
        transition={{ duration: 0.9, ease: [0.22, 0.61, 0.36, 1] }}
        className="reach-eyebrow"
      >
        <span className="reach-eyebrow-mark" />
        Our Reach
      </motion.div>

      <motion.h2
        variants={fadeUp}
        transition={{ duration: 1.1, ease: [0.22, 0.61, 0.36, 1] }}
        className="reach-headline"
      >
        Live deployment<br />network.
      </motion.h2>

      <motion.p
        variants={fadeUp}
        transition={{ duration: 1, ease: [0.22, 0.61, 0.36, 1] }}
        className="reach-sub"
      >
        Precision intelligence deployed across the world&rsquo;s
        highest-volume diamond corridors.
      </motion.p>

      <motion.div
        variants={fadeUp}
        transition={{ duration: 0.9, ease: [0.22, 0.61, 0.36, 1] }}
        className="reach-divider"
      />

      <motion.div
        variants={fadeUp}
        transition={{ duration: 1, ease: [0.22, 0.61, 0.36, 1] }}
        className="reach-block"
      >
        <h3 className="reach-block-title">Global target network</h3>
        <p>
          Bound is being positioned across the centers where diamonds are
          cut, traded, certified, and moved at scale.
        </p>
        <p>
          From Surat and Mumbai to Hong Kong, Shenzhen, Antwerp, and New
          York, Bound is building the precision layer for the global diamond
          supply chain.
        </p>
        <p>
          Every deployment expands the system&rsquo;s grading intelligence,
          imaging database, and operational reach.
        </p>
      </motion.div>

      <motion.div
        className="reach-stats"
        initial="hidden"
        animate={inView ? 'show' : 'hidden'}
        transition={{ staggerChildren: 0.18, delayChildren: 3.6 }}
      >
        <motion.div variants={fadeUp} transition={{ duration: 0.8 }} className="reach-stat">
          <span className="reach-stat-value">7+</span>
          <span className="reach-stat-label">Target hubs</span>
        </motion.div>
        <motion.div variants={fadeUp} transition={{ duration: 0.8 }} className="reach-stat">
          <span className="reach-stat-value">3</span>
          <span className="reach-stat-label">Continents</span>
        </motion.div>
        <motion.div variants={fadeUp} transition={{ duration: 0.8 }} className="reach-stat reach-stat-tags">
          <span>Manufacturing</span>
          <span className="reach-stat-sep">·</span>
          <span>Grading</span>
          <span className="reach-stat-sep">·</span>
          <span>Trade</span>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
