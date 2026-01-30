// src/components/ui/PageTransition.tsx
// Smooth page transitions using framer-motion

'use client'

import { motion } from 'framer-motion'

interface PageTransitionProps {
  children: React.ReactNode
}

export function PageTransition({ children }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1]
      }}
    >
      {children}
    </motion.div>
  )
}