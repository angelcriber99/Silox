"use client"

import { motion } from "framer-motion"

export default function MainTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ 
        type: "spring",
        stiffness: 260,
        damping: 20,
        mass: 1 
      }}
      className="flex-1 flex flex-col w-full max-w-full overflow-x-hidden"
    >
      {children}
    </motion.div>
  )
}
