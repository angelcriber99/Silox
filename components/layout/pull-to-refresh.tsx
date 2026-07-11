"use client"

import { useState, useRef, useEffect, ReactNode } from "react"
import { motion, useAnimation, useMotionValue } from "framer-motion"
import { Loader2, ArrowDown } from "lucide-react"
import { hapticFeedback } from "@/lib/utils/haptics"

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: ReactNode
}

const PULL_THRESHOLD = 80
const MAX_PULL = 120

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullProgress, setPullProgress] = useState(0)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const currentY = useRef(0)
  const isPulling = useRef(false)
  
  const y = useMotionValue(0)
  const controls = useAnimation()

  const handleTouchStart = (e: TouchEvent) => {
    // Only allow pull-to-refresh if we are at the top of the container
    if (window.scrollY === 0 || document.documentElement.scrollTop === 0) {
      startY.current = e.touches[0].clientY
      isPulling.current = true
    }
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isPulling.current || isRefreshing) return
    
    currentY.current = e.touches[0].clientY
    const deltaY = currentY.current - startY.current
    
    // Only pull down
    if (deltaY > 0 && (window.scrollY === 0 || document.documentElement.scrollTop === 0)) {
      // Prevent default scrolling when pulling
      e.preventDefault()
      
      const pull = Math.min(deltaY * 0.5, MAX_PULL) // Add friction
      y.set(pull)
      
      const progress = Math.min(pull / PULL_THRESHOLD, 1)
      setPullProgress(progress)
      
      if (progress === 1 && pullProgress < 1) {
        hapticFeedback.light()
      }
    }
  }

  const handleTouchEnd = async () => {
    if (!isPulling.current || isRefreshing) return
    isPulling.current = false
    
    const currentPull = y.get()
    
    if (currentPull >= PULL_THRESHOLD) {
      hapticFeedback.medium()
      setIsRefreshing(true)
      controls.start({ y: 50, transition: { type: "spring", stiffness: 400, damping: 25 } })
      
      try {
        await onRefresh()
        hapticFeedback.success()
      } catch (error) {
        hapticFeedback.error()
      } finally {
        setIsRefreshing(false)
        setPullProgress(0)
        controls.start({ y: 0, transition: { type: "spring", stiffness: 300, damping: 30 } })
        y.set(0)
      }
    } else {
      controls.start({ y: 0, transition: { type: "spring", stiffness: 300, damping: 30 } })
      y.set(0)
      setPullProgress(0)
    }
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    
    // Use passive: false to allow e.preventDefault()
    el.addEventListener("touchstart", handleTouchStart, { passive: true })
    el.addEventListener("touchmove", handleTouchMove, { passive: false })
    el.addEventListener("touchend", handleTouchEnd, { passive: true })
    
    return () => {
      el.removeEventListener("touchstart", handleTouchStart)
      el.removeEventListener("touchmove", handleTouchMove)
      el.removeEventListener("touchend", handleTouchEnd)
    }
  }, [isRefreshing, pullProgress])

  return (
    <div ref={containerRef} className="relative min-h-full w-full">
      {/* Indicator */}
      <div 
        className="absolute top-0 left-0 right-0 flex justify-center items-center h-[50px] -mt-[50px]"
      >
        <motion.div
          animate={{
            scale: isRefreshing ? 1 : Math.max(0.5, pullProgress),
            opacity: pullProgress > 0 || isRefreshing ? 1 : 0
          }}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-card border border-border shadow-lg"
        >
          {isRefreshing ? (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          ) : (
            <motion.div
              animate={{ rotate: pullProgress === 1 ? 180 : 0 }}
            >
              <ArrowDown className="w-5 h-5 text-primary" />
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Content */}
      <motion.div 
        animate={controls}
        style={{ y }}
        className="min-h-full w-full bg-background"
      >
        {children}
      </motion.div>
    </div>
  )
}
