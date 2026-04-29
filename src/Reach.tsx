import {
  motion,
  useInView,
  useScroll,
  useTransform,
} from 'framer-motion'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { geoEqualEarth, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import './Reach.css'

const WORLD_URL =
  'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

type City = {
  name: string
  coords: [number, number]
  align?: 'left' | 'right' | 'top' | 'bottom'
  role?: string
}

type Arc = {
  from: [number, number]
  to: [number, number]
}

// Major centres along the global rough → polished → trade → market chain.
const CITIES: City[] = [
  { name: 'Gaborone',     coords: [25.9077,  -24.6282], align: 'left',   role: 'Mining' },
  { name: 'Johannesburg', coords: [28.0473,  -26.2041], align: 'right',  role: 'Refining' },
  { name: 'Surat',        coords: [72.8311,   21.1702], align: 'bottom', role: 'Cutting' },
  { name: 'Mumbai',       coords: [72.8777,   19.0760], align: 'left',   role: 'Trade' },
  { name: 'Tel Aviv',     coords: [34.7818,   32.0853], align: 'left',   role: 'Cutting · Trade' },
  { name: 'Dubai',        coords: [55.2708,   25.2048], align: 'right',  role: 'Trade' },
  { name: 'Antwerp',      coords: [4.4025,    51.2194], align: 'top',    role: 'Trade' },
  { name: 'New York',     coords: [-74.006,   40.7128], align: 'left',   role: 'Market' },
  { name: 'Hong Kong',    coords: [114.1694,  22.3193], align: 'right',  role: 'Trade' },
  { name: 'Shenzhen',     coords: [114.0579,  22.5431], align: 'top',    role: 'Manufacturing' },
]

// Logical flow of rough → cut → traded → market.
const ARCS: Arc[] = [
  { from: [25.9077, -24.6282], to: [28.0473, -26.2041] }, // Gaborone → JoBurg
  { from: [25.9077, -24.6282], to: [4.4025,   51.2194] }, // Gaborone → Antwerp
  { from: [28.0473, -26.2041], to: [72.8311,  21.1702] }, // JoBurg → Surat
  { from: [72.8311,  21.1702], to: [4.4025,   51.2194] }, // Surat → Antwerp
  { from: [72.8311,  21.1702], to: [114.1694, 22.3193] }, // Surat → Hong Kong
  { from: [72.8777,  19.0760], to: [34.7818,  32.0853] }, // Mumbai → Tel Aviv
  { from: [34.7818,  32.0853], to: [4.4025,   51.2194] }, // Tel Aviv → Antwerp
  { from: [4.4025,   51.2194], to: [55.2708,  25.2048] }, // Antwerp → Dubai
  { from: [4.4025,   51.2194], to: [-74.006,  40.7128] }, // Antwerp → NY
  { from: [55.2708,  25.2048], to: [114.1694, 22.3193] }, // Dubai → Hong Kong
  { from: [114.0579, 22.5431], to: [114.1694, 22.3193] }, // Shenzhen → Hong Kong
  { from: [114.1694, 22.3193], to: [-74.006,  40.7128] }, // Hong Kong → NY
]

const MAP_W = 1200
const MAP_H = 720

// Stagger constants — tuned for "live network" feel
const ARC_BASE_DELAY = 1.4
const ARC_STAGGER = 0.16
const ARC_DURATION = 1.7
const PLANE_DURATION = 6.4

export default function Reach() {
  const sectionRef = useRef<HTMLElement>(null)
  const inView = useInView(sectionRef, { once: true, margin: '-22%' })

  // Scroll-bound parallax: map scales subtly, text floats, grid drifts
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  })
  const mapScale = useTransform(
    scrollYProgress,
    [0, 0.45, 1],
    [0.86, 1, 1.16],
  )
  const mapY = useTransform(scrollYProgress, [0, 1], ['9%', '-12%'])
  const mapOpacity = useTransform(
    scrollYProgress,
    [0, 0.18, 0.82, 1],
    [0.25, 1, 1, 0.55],
  )
  const textY = useTransform(scrollYProgress, [0, 1], ['16%', '-16%'])
  const textOpacity = useTransform(
    scrollYProgress,
    [0, 0.2, 0.8, 1],
    [0.2, 1, 1, 0.55],
  )
  const gridY = useTransform(scrollYProgress, [0, 1], ['16%', '-32%'])
  const headerY = useTransform(scrollYProgress, [0, 1], ['-7%', '10%'])

  return (
    <section ref={sectionRef} className="reach" id="our-reach">
      <motion.div
        className="reach-bg-grid"
        style={{ y: gridY }}
        aria-hidden
      />

      <div className="reach-inner">
        <ReachHeader inView={inView} headerY={headerY} />

        <div className="reach-grid">
          <motion.div
            className="reach-map-col"
            style={{ y: mapY, opacity: mapOpacity }}
          >
            <motion.div
              className="reach-map-frame"
              style={{ scale: mapScale }}
            >
              <ReachMap inView={inView} />
            </motion.div>
          </motion.div>

          <motion.div
            className="reach-text-col"
            style={{ y: textY, opacity: textOpacity }}
          >
            <ReachText inView={inView} />
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// HEADER (above the grid — frames the section)
// ─────────────────────────────────────────────────────────────────────────

function ReachHeader({
  inView,
  headerY,
}: {
  inView: boolean
  headerY: ReturnType<typeof useTransform<number, string>>
}) {
  return (
    <motion.header
      className="reach-header"
      style={{ y: headerY }}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 1, ease: [0.22, 0.61, 0.36, 1] }}
    >
      <div className="reach-header-l">
        <span className="reach-section-no">02 — Our Reach</span>
      </div>
      <div className="reach-header-r">
        <span className="reach-status">
          <span className="reach-status-dot" />
          Live network · {CITIES.length} hubs
        </span>
      </div>
    </motion.header>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// MAP
// ─────────────────────────────────────────────────────────────────────────

function ReachMap({ inView }: { inView: boolean }) {
  const [land, setLand] = useState<Feature[]>([])
  const [countries, setCountries] = useState<Feature[]>([])

  useEffect(() => {
    let cancelled = false
    fetch(WORLD_URL)
      .then((r) => r.json())
      .then((topo) => {
        if (cancelled) return
        const landGeo = feature(
          topo,
          topo.objects.land,
        ) as unknown as FeatureCollection<Geometry>
        const countriesGeo = feature(
          topo,
          topo.objects.countries,
        ) as unknown as FeatureCollection<Geometry>
        setLand(landGeo.features)
        setCountries(countriesGeo.features)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const projection = useMemo(
    () =>
      geoEqualEarth()
        .scale(MAP_W / 5.4)
        .translate([MAP_W / 2, MAP_H / 2 + 24]),
    [],
  )
  const path = useMemo(() => geoPath(projection), [projection])

  const cityXY = useMemo(
    () =>
      CITIES.map((c) => {
        const xy = projection(c.coords)
        return { ...c, xy: xy ?? [0, 0] }
      }),
    [projection],
  )

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
        const cx = (x1 + x2) / 2
        // bow toward smaller y (upward) for flight-path feel
        const cy = (y1 + y2) / 2 - dist * 0.24
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
            <stop offset="55%" stopColor="#6ea0ff" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#6ea0ff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="arc-grad" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6ea0ff" stopOpacity="0.12" />
            <stop offset="50%" stopColor="#a3c2ff" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#6ea0ff" stopOpacity="0.12" />
          </linearGradient>
          <linearGradient
            id="map-fade"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#000" stopOpacity="0.6" />
            <stop offset="22%" stopColor="#000" stopOpacity="0" />
            <stop offset="78%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.6" />
          </linearGradient>
          <radialGradient id="land-fill" cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor="#243652" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#1a2a44" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#0f1a2e" stopOpacity="0.88" />
          </radialGradient>

          <mask id="map-mask">
            <rect width={MAP_W} height={MAP_H} fill="white" />
          </mask>
        </defs>

        {/* longitude grid lines (very faint, lab-grid feel) */}
        <g opacity="0.18">
          {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map((lon) => {
            const start = projection([lon, -85])
            const end = projection([lon, 85])
            if (!start || !end) return null
            return (
              <line
                key={lon}
                x1={start[0]}
                y1={start[1]}
                x2={end[0]}
                y2={end[1]}
                stroke="#3a5a8a"
                strokeWidth="0.4"
                strokeDasharray="2 4"
              />
            )
          })}
        </g>

        {/* Land mass — solid base */}
        <motion.g
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 1.8, ease: [0.22, 0.61, 0.36, 1] }}
        >
          {land.map((f, i) => (
            <path
              key={`land-${i}`}
              d={path(f) || undefined}
              fill="url(#land-fill)"
              stroke="rgba(140, 180, 240, 0.45)"
              strokeWidth={0.55}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </motion.g>

        {/* Country borders — overlay */}
        <motion.g
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 2, ease: [0.22, 0.61, 0.36, 1], delay: 0.4 }}
        >
          {countries.map((f, i) => (
            <path
              key={`country-${i}`}
              d={path(f) || undefined}
              fill="none"
              stroke="rgba(110, 155, 220, 0.16)"
              strokeWidth={0.35}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </motion.g>

        {/* Arcs */}
        <g>
          {arcGeo.map((a, i) => (
            <ArcLine
              key={i}
              d={a.d}
              inView={inView}
              delay={ARC_BASE_DELAY + i * ARC_STAGGER}
              planeDelay={ARC_BASE_DELAY + i * ARC_STAGGER + ARC_DURATION + 0.2}
            />
          ))}
        </g>

        {/* City nodes */}
        <g>
          {cityXY.map((c, i) => (
            <CityNode
              key={c.name}
              x={c.xy[0]}
              y={c.xy[1]}
              name={c.name}
              role={c.role}
              align={c.align}
              inView={inView}
              delay={0.85 + i * 0.13}
            />
          ))}
        </g>

        {/* edge fade so the map dissolves into black at top/bottom */}
        <rect
          width={MAP_W}
          height={MAP_H}
          fill="url(#map-fade)"
          pointerEvents="none"
        />
      </svg>
    </div>
  )
}

function ArcLine({
  d,
  inView,
  delay,
  planeDelay,
}: {
  d: string
  inView: boolean
  delay: number
  planeDelay: number
}) {
  return (
    <g>
      {/* lit arc */}
      <motion.path
        d={d}
        fill="none"
        stroke="url(#arc-grad)"
        strokeWidth={1.2}
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={inView ? { pathLength: 1, opacity: 0.85 } : {}}
        transition={{
          pathLength: {
            duration: ARC_DURATION,
            delay,
            ease: [0.22, 0.61, 0.36, 1],
          },
          opacity: { duration: 0.45, delay },
        }}
      />
      {/* travelling planes — bidirectional traffic on each route.
          Forward plane rides 0→100%, reverse plane rides 100→0%
          (offset by half the cycle so they cross mid-arc). */}
      <motion.g
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 0.4, delay: planeDelay }}
        style={
          {
            offsetPath: `path('${d}')`,
            offsetRotate: 'auto',
            offsetDistance: '0%',
            animation: inView
              ? `plane-travel ${PLANE_DURATION}s ${planeDelay}s linear infinite`
              : 'none',
          } as CSSProperties
        }
      >
        <PlaneIcon />
      </motion.g>
      <motion.g
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{
          duration: 0.4,
          delay: planeDelay + PLANE_DURATION * 0.5,
        }}
        style={
          {
            offsetPath: `path('${d}')`,
            offsetRotate: 'auto 180deg',
            offsetDistance: '100%',
            animation: inView
              ? `plane-travel-reverse ${PLANE_DURATION}s ${
                  planeDelay + PLANE_DURATION * 0.5
                }s linear infinite`
              : 'none',
          } as CSSProperties
        }
      >
        <PlaneIcon />
      </motion.g>
    </g>
  )
}

function PlaneIcon() {
  // Top-down aircraft silhouette built from clean strokes.
  // Centred at origin so motion-path animates the aircraft's centre.
  return (
    <g>
      <circle r={9} fill="url(#node-glow)" opacity={0.85} />
      <path
        d="M -7 0
           L 9 0
           M -2 0
           L -2 -5
           M -2 0
           L -2 5
           M 6 0
           L 6 -2.6
           M 6 0
           L 6 2.6"
        stroke="#f5faff"
        strokeWidth={1.7}
        strokeLinecap="round"
        fill="none"
      />
      <circle cx={9} cy={0} r={1.1} fill="#ffffff" />
    </g>
  )
}

function CityNode({
  x,
  y,
  name,
  role,
  align = 'right',
  inView,
  delay,
}: {
  x: number
  y: number
  name: string
  role?: string
  align?: 'left' | 'right' | 'top' | 'bottom'
  inView: boolean
  delay: number
}) {
  const labelDx = align === 'left' ? -12 : align === 'right' ? 12 : 0
  const labelDy = align === 'top' ? -16 : align === 'bottom' ? 22 : 4
  const anchor =
    align === 'left' ? 'end' : align === 'right' ? 'start' : 'middle'

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={inView ? { opacity: 1 } : {}}
      transition={{ duration: 0.5, delay }}
    >
      {/* halo */}
      <circle cx={x} cy={y} r={20} fill="url(#node-glow)" opacity={0.7} />
      {/* pulsing ring */}
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
            ? { scale: [1, 3.2, 3.2], opacity: [0.65, 0, 0] }
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
      <circle cx={x} cy={y} r={3.4} fill="#eaf2ff" />
      <circle cx={x} cy={y} r={1.5} fill="#fff" />

      {/* label */}
      <motion.g
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 0.6, delay: delay + 0.3 }}
      >
        <text
          x={x + labelDx}
          y={y + labelDy}
          fontSize={11}
          fontFamily="Geist, Inter, sans-serif"
          fontWeight={600}
          letterSpacing="0.04em"
          fill="rgba(232, 240, 255, 0.95)"
          textAnchor={anchor}
        >
          {name}
        </text>
        {role && (
          <text
            x={x + labelDx}
            y={y + labelDy + 12}
            fontSize={9}
            fontFamily="Geist, Inter, sans-serif"
            fontWeight={400}
            letterSpacing="0.18em"
            fill="rgba(170, 200, 245, 0.62)"
            textAnchor={anchor}
          >
            {role.toUpperCase()}
          </text>
        )}
      </motion.g>
    </motion.g>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// TEXT PANEL
// ─────────────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

function ReachText({ inView }: { inView: boolean }) {
  return (
    <motion.div
      className="reach-text"
      initial="hidden"
      animate={inView ? 'show' : 'hidden'}
      transition={{ staggerChildren: 0.16, delayChildren: 0.5 }}
    >
      <motion.h2
        variants={fadeUp}
        transition={{ duration: 1.05, ease: [0.22, 0.61, 0.36, 1] }}
        className="reach-headline"
      >
        Operational
        <br />
        reach.
      </motion.h2>

      <motion.p
        variants={fadeUp}
        transition={{ duration: 1, ease: [0.22, 0.61, 0.36, 1] }}
        className="reach-sub"
      >
        Deployed across the corridors of global diamond trade.
      </motion.p>

      <motion.div
        variants={fadeUp}
        transition={{ duration: 1, ease: [0.22, 0.61, 0.36, 1] }}
        className="reach-block"
      >
        <h3 className="reach-block-title">Network coverage</h3>
        <p>
          Bound integrates with the centres that route the majority of
          the world&rsquo;s diamond volume.
        </p>
        <p>
          Each deployment compounds the system&rsquo;s grading
          intelligence and operational footprint.
        </p>
        <p>
          Built for institutional scale — mines, manufacturers, trading
          houses, laboratories.
        </p>
      </motion.div>

      <motion.div
        className="reach-stats"
        initial="hidden"
        animate={inView ? 'show' : 'hidden'}
        transition={{ staggerChildren: 0.18, delayChildren: 4.2 }}
      >
        <Stat value="10" label="Active hubs" />
        <Stat value="04" label="Continents" />
        <Stat
          value="—"
          label="Mining · Cutting · Trade · Certification"
          tags
        />
      </motion.div>
    </motion.div>
  )
}

function Stat({
  value,
  label,
  tags = false,
}: {
  value: string
  label: string
  tags?: boolean
}) {
  return (
    <motion.div
      variants={fadeUp}
      transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1] }}
      className={`reach-stat ${tags ? 'reach-stat-tags' : ''}`}
    >
      <span className="reach-stat-value">{value}</span>
      <span className="reach-stat-label">{label}</span>
    </motion.div>
  )
}
