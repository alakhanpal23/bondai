import {
  motion,
  useInView,
  useScroll,
  useTransform,
} from 'framer-motion'
import { useRef } from 'react'
import './Closer.css'

const AUDIENCES = [
  {
    no: '01',
    title: 'For Manufacturers',
    body: 'Real-time grading at production scale.',
  },
  {
    no: '02',
    title: 'For Labs',
    body: 'Machine-verified consistency across batches.',
  },
  {
    no: '03',
    title: 'For Traders',
    body: 'Universal certification with transparent provenance.',
  },
]

export default function Closer() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-18%' })

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })

  const cardsY = useTransform(scrollYProgress, [0, 1], ['8%', '-8%'])
  const ctaY = useTransform(scrollYProgress, [0, 1], ['12%', '-12%'])
  const headerY = useTransform(scrollYProgress, [0, 1], ['-6%', '8%'])
  const gridY = useTransform(scrollYProgress, [0, 1], ['12%', '-22%'])

  return (
    <section ref={ref} className="closer" id="audience">
      <motion.div className="closer-bg-grid" style={{ y: gridY }} aria-hidden />

      <div className="closer-inner">
        <motion.header
          className="closer-header"
          style={{ y: headerY }}
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, ease: [0.22, 0.61, 0.36, 1] }}
        >
          <span className="closer-section-no">03 — Audience</span>
          <span className="closer-status">
            <span className="closer-status-dot" />
            Three deployment paths
          </span>
        </motion.header>

        {/* Audience — editorial row list (no boxes) */}
        <motion.div className="audience-list" style={{ y: cardsY }}>
          {AUDIENCES.map((a, i) => (
            <motion.button
              key={a.no}
              type="button"
              className="audience-row"
              initial={{ opacity: 0, y: 18 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.85,
                delay: 0.2 + i * 0.12,
                ease: [0.22, 0.61, 0.36, 1],
              }}
            >
              <span className="audience-no">{a.no}</span>
              <span className="audience-title">{a.title}</span>
              <span className="audience-body">{a.body}</span>
              <span className="audience-arrow" aria-hidden>
                ↗
              </span>
            </motion.button>
          ))}
        </motion.div>

        {/* Final CTA */}
        <motion.div className="closer-cta" style={{ y: ctaY }}>
          <motion.h2
            className="closer-headline"
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{
              duration: 1.1,
              delay: 0.85,
              ease: [0.22, 0.61, 0.36, 1],
            }}
          >
            Precision becomes the standard.
          </motion.h2>

          <motion.p
            className="closer-sub"
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{
              duration: 1,
              delay: 1.05,
              ease: [0.22, 0.61, 0.36, 1],
            }}
          >
            Bound delivers consistent, machine-verified grading across the
            global diamond pipeline.
          </motion.p>

          <motion.div
            className="closer-buttons"
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{
              duration: 1,
              delay: 1.25,
              ease: [0.22, 0.61, 0.36, 1],
            }}
          >
            <button type="button" className="closer-btn closer-btn-secondary">
              See a Live Scan
            </button>
            <button type="button" className="closer-btn closer-btn-primary">
              Book a Demo
            </button>
          </motion.div>

          <motion.p
            className="closer-footer"
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 1, delay: 1.6 }}
          >
            Deploying across manufacturers, trading hubs, and certification
            labs.
          </motion.p>
        </motion.div>
      </div>
    </section>
  )
}
