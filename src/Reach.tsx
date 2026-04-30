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
import { geoEqualEarth, geoGraticule, geoPath } from 'd3-geo'
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

// Major centres along the global rough → polished → trade → market chain
// plus the Kara Labs HQ in San Francisco.
const CITIES: City[] = [
  { name: 'San Francisco', coords: [-122.4194, 37.7749], align: 'bottom', role: 'HQ' },
  { name: 'Gaborone',      coords: [25.9077,  -24.6282], align: 'left',   role: 'Mining' },
  { name: 'Johannesburg',  coords: [28.0473,  -26.2041], align: 'right',  role: 'Refining' },
  { name: 'Surat',         coords: [72.8311,   21.1702], align: 'bottom', role: 'Cutting' },
  { name: 'Mumbai',        coords: [72.8777,   19.0760], align: 'left',   role: 'Trade' },
  { name: 'Tel Aviv',      coords: [34.7818,   32.0853], align: 'left',   role: 'Cutting · Trade' },
  { name: 'Dubai',         coords: [55.2708,   25.2048], align: 'right',  role: 'Trade' },
  { name: 'Antwerp',       coords: [4.4025,    51.2194], align: 'top',    role: 'Trade' },
  { name: 'New York',      coords: [-74.006,   40.7128], align: 'left',   role: 'Market' },
  { name: 'Hong Kong',     coords: [114.1694,  22.3193], align: 'right',  role: 'Trade' },
  { name: 'Shenzhen',      coords: [114.0579,  22.5431], align: 'top',    role: 'Manufacturing' },
]

// Logical flow of rough → cut → traded → market, plus SF HQ feeding
// intelligence outward to the major hubs.
const ARCS: Arc[] = [
  { from: [25.9077, -24.6282],   to: [28.0473, -26.2041] }, // Gaborone → JoBurg
  { from: [25.9077, -24.6282],   to: [4.4025,   51.2194] }, // Gaborone → Antwerp
  { from: [28.0473, -26.2041],   to: [72.8311,  21.1702] }, // JoBurg → Surat
  { from: [72.8311,  21.1702],   to: [4.4025,   51.2194] }, // Surat → Antwerp
  { from: [72.8311,  21.1702],   to: [114.1694, 22.3193] }, // Surat → Hong Kong
  { from: [72.8777,  19.0760],   to: [34.7818,  32.0853] }, // Mumbai → Tel Aviv
  { from: [34.7818,  32.0853],   to: [4.4025,   51.2194] }, // Tel Aviv → Antwerp
  { from: [4.4025,   51.2194],   to: [55.2708,  25.2048] }, // Antwerp → Dubai
  { from: [4.4025,   51.2194],   to: [-74.006,  40.7128] }, // Antwerp → NY
  { from: [55.2708,  25.2048],   to: [114.1694, 22.3193] }, // Dubai → Hong Kong
  { from: [114.0579, 22.5431],   to: [114.1694, 22.3193] }, // Shenzhen → Hong Kong
  { from: [114.1694, 22.3193],   to: [-74.006,  40.7128] }, // Hong Kong → NY
  { from: [-122.4194, 37.7749],  to: [-74.006,  40.7128] }, // SF → NY
  { from: [-122.4194, 37.7749],  to: [114.1694, 22.3193] }, // SF → Hong Kong
  { from: [-122.4194, 37.7749],  to: [4.4025,   51.2194] }, // SF → Antwerp
]

const MAP_W = 1200
const MAP_H = 600

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

  return (
    <section ref={sectionRef} className="reach" id="our-reach">
      <motion.div
        className="reach-bg-grid"
        style={{ y: gridY }}
        aria-hidden
      />

      <div className="reach-inner">
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
        .scale(MAP_W / 5.2)
        .translate([MAP_W / 2, MAP_H / 2 + 12]),
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
          <radialGradient id="land-fill" cx="50%" cy="42%" r="72%">
            <stop offset="0%" stopColor="#324b73" stopOpacity="1" />
            <stop offset="55%" stopColor="#22344f" stopOpacity="0.96" />
            <stop offset="100%" stopColor="#10203c" stopOpacity="0.9" />
          </radialGradient>
          <radialGradient id="ocean-ambient" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="#0e1a36" stopOpacity="0.7" />
            <stop offset="60%" stopColor="#070d1c" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>

          <mask id="map-mask">
            <rect width={MAP_W} height={MAP_H} fill="white" />
          </mask>
        </defs>

        {/* ocean ambient — subtle warmth at centre, fades to pure black */}
        <rect width={MAP_W} height={MAP_H} fill="url(#ocean-ambient)" />

        {/* graticule — proper curved lat/lon grid (atlas-like) */}
        <motion.path
          d={path(geoGraticule().step([20, 20])()) || undefined}
          fill="none"
          stroke="#314f7d"
          strokeWidth={0.4}
          strokeDasharray="2 4"
          opacity={0}
          animate={inView ? { opacity: 0.32 } : {}}
          transition={{ duration: 1.4, ease: [0.22, 0.61, 0.36, 1] }}
          vectorEffect="non-scaling-stroke"
        />
        {/* equator + prime meridian — slightly brighter */}
        <motion.path
          d={
            path({
              type: 'MultiLineString',
              coordinates: [
                [
                  [-180, 0],
                  [-90, 0],
                  [0, 0],
                  [90, 0],
                  [180, 0],
                ],
                [
                  [0, -85],
                  [0, -45],
                  [0, 0],
                  [0, 45],
                  [0, 85],
                ],
              ],
            }) || undefined
          }
          fill="none"
          stroke="#5a7eb5"
          strokeWidth={0.55}
          strokeDasharray="0"
          opacity={0}
          animate={inView ? { opacity: 0.4 } : {}}
          transition={{ duration: 1.4, ease: [0.22, 0.61, 0.36, 1] }}
          vectorEffect="non-scaling-stroke"
        />

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
              stroke="rgba(170, 205, 245, 0.62)"
              strokeWidth={0.65}
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
      {/* travelling planes — bidirectional, infinite. Opacity is owned by
          the OUTER motion.g (one-time fade-in when section enters view).
          The INNER plain <g> owns the offset-path animation, which runs
          forever from mount and never gets reset by re-renders. */}
      <PlaneTraveller
        d={d}
        delay={planeDelay}
        inView={inView}
        reverse={false}
      />
      <PlaneTraveller
        d={d}
        delay={planeDelay + PLANE_DURATION * 0.5}
        inView={inView}
        reverse={true}
      />
    </g>
  )
}

function PlaneTraveller({
  d,
  delay,
  inView,
  reverse,
}: {
  d: string
  delay: number
  inView: boolean
  reverse: boolean
}) {
  const animName = reverse ? 'plane-travel-reverse' : 'plane-travel'
  const rotate = reverse ? 'auto 180deg' : 'auto'

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={inView ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 0.6, delay }}
    >
      <g
        style={
          {
            offsetPath: `path('${d}')`,
            offsetRotate: rotate,
            animation: `${animName} ${PLANE_DURATION}s ${delay}s linear infinite`,
            animationFillMode: 'both',
            willChange: 'offset-distance',
          } as CSSProperties
        }
      >
        <PlaneIcon />
      </g>
    </motion.g>
  )
}

function PlaneIcon() {
  // Filled swept-wing aircraft silhouette, top-down view.
  // Centred at origin, ~18px wide so motion-path animates the centre.
  return (
    <g>
      <circle r={11} fill="url(#node-glow)" opacity={0.78} />
      <path
        d="M 11 0
           L 4 -1
           L 3 -5
           L -1 -5
           L 1 -1
           L -3 -1
           L -4 -3
           L -6 -3
           L -5 -1
           L -7 0
           L -5 1
           L -6 3
           L -4 3
           L -3 1
           L 1 1
           L -1 5
           L 3 5
           L 4 1
           Z"
        fill="#f6faff"
        stroke="rgba(255, 255, 255, 0.55)"
        strokeWidth={0.4}
        strokeLinejoin="round"
      />
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
          Kara Labs integrates with the centres that route the majority of
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
        <Stat value="11" label="Active hubs" />
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
