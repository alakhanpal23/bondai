import {
  motion,
  useInView,
  useScroll,
  useTransform,
} from 'framer-motion'
import { useRef } from 'react'
import './Closer.css'

export default function Closer() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-18%' })

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })

  const ctaY = useTransform(scrollYProgress, [0, 1], ['12%', '-12%'])
  const gridY = useTransform(scrollYProgress, [0, 1], ['12%', '-22%'])

  return (
    <section ref={ref} className="closer" id="closer">
      <motion.div className="closer-bg-grid" style={{ y: gridY }} aria-hidden />

      <div className="closer-inner">
        <motion.div className="closer-cta" style={{ y: ctaY }}>
          <motion.h2
            className="closer-headline"
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{
              duration: 1.1,
              delay: 0.25,
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
              delay: 0.45,
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
              delay: 0.65,
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
            transition={{ duration: 1, delay: 0.95 }}
          >
            Deploying across manufacturers, trading hubs, and certification
            labs.
          </motion.p>
        </motion.div>
      </div>
    </section>
  )
}
