import {
  motion,
  useInView,
  useScroll,
  useTransform,
} from 'framer-motion'
import { useRef } from 'react'
import './Closer.css'

const HEADLINE_WORDS = ['Precision', 'becomes', 'the', 'standard.']

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
          <h2 className="closer-headline" aria-label="Precision becomes the standard.">
            {HEADLINE_WORDS.map((word, i) => (
              <motion.span
                key={`${word}-${i}`}
                className="closer-word"
                initial={{ opacity: 0, y: 28, filter: 'blur(8px)' }}
                animate={
                  inView
                    ? { opacity: 1, y: 0, filter: 'blur(0px)' }
                    : {}
                }
                transition={{
                  duration: 1,
                  delay: 0.25 + i * 0.13,
                  ease: [0.22, 0.61, 0.36, 1],
                }}
              >
                {word}
              </motion.span>
            ))}
          </h2>

          <motion.p
            className="closer-sub"
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{
              duration: 1,
              delay: 0.95,
              ease: [0.22, 0.61, 0.36, 1],
            }}
          >
            Kara Labs delivers consistent, machine-verified grading across the
            global diamond pipeline.
          </motion.p>

          <motion.div
            className="closer-buttons"
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{
              duration: 1,
              delay: 1.15,
              ease: [0.22, 0.61, 0.36, 1],
            }}
          >
            <a
              href="https://calendly.com/alakhanpal-berkeley/30min?month=2026-05"
              target="_blank"
              rel="noopener noreferrer"
              className="closer-btn closer-btn-primary"
            >
              Book a Demo
            </a>
          </motion.div>

          <motion.p
            className="closer-footer"
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 1, delay: 1.45 }}
          >
            Deploying across manufacturers, trading hubs, and certification
            labs.
          </motion.p>
        </motion.div>
      </div>
    </section>
  )
}
