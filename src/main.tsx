import React from 'react'
import ReactDOM from 'react-dom/client'
import { ReactLenis } from 'lenis/react'
import { Analytics } from '@vercel/analytics/react'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ReactLenis
      root
      options={{
        duration: 1.4,
        smoothWheel: true,
        wheelMultiplier: 0.85,
        touchMultiplier: 1.6,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      }}
    >
      <App />
      <Analytics />
    </ReactLenis>
  </React.StrictMode>,
)
