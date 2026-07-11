"use client"

import { motion } from "framer-motion"

export default function MainTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0.96 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.08, ease: "easeOut" }}
      className="flex-1 flex flex-col w-full max-w-full overflow-x-hidden"
    >
      {children}
    </motion.div>
  )
}
