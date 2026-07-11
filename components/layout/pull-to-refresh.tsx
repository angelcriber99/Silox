"use client"

import { useState, useRef, useEffect, useCallback, ReactNode } from "react"
import { animate, motion, useMotionValue } from "framer-motion"
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
  const startX = useRef(0)
  const currentY = useRef(0)
  const isPulling = useRef(false)
  const isHorizontalScroll = useRef(false)
  const isRefreshingRef = useRef(false)
  const pullProgressRef = useRef(0)
  const progressFrame = useRef<number | null>(null)
  
  const y = useMotionValue(0)

  useEffect(() => {
    isRefreshingRef.current = isRefreshing
  }, [isRefreshing])

  const updatePullProgress = useCallback((nextProgress: number) => {
    const quantized = Math.round(nextProgress * 20) / 20
    if (quantized === pullProgressRef.current) return

    pullProgressRef.current = quantized

    if (progressFrame.current !== null) return

    progressFrame.current = window.requestAnimationFrame(() => {
      progressFrame.current = null
      setPullProgress(pullProgressRef.current)
    })
  }, [])

  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Check if we are at the top of the actual scroll container
    const mainEl = document.querySelector('main')
    const scrollTop = mainEl ? mainEl.scrollTop : window.scrollY
    
    if (scrollTop <= 0) {
      startY.current = e.touches[0].clientY
      startX.current = e.touches[0].clientX
      isPulling.current = true
      isHorizontalScroll.current = false
    }
  }, [])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling.current || isRefreshingRef.current) return
    
    currentY.current = e.touches[0].clientY
    const currentX = e.touches[0].clientX
    
    const deltaY = currentY.current - startY.current
    const deltaX = currentX - startX.current
    
    // If user is swiping horizontally more than vertically, ignore pull to refresh
    if (!isHorizontalScroll.current && Math.abs(deltaX) > Math.abs(deltaY)) {
      isHorizontalScroll.current = true
      isPulling.current = false
      return
    }
    
    if (isHorizontalScroll.current) return

    const mainEl = document.querySelector('main')
    const scrollTop = mainEl ? mainEl.scrollTop : window.scrollY
    
    // Only pull down
    if (deltaY > 0 && scrollTop <= 0) {
      // Prevent default scrolling when pulling
      e.preventDefault()
      
      const pull = Math.min(deltaY * 0.5, MAX_PULL) // Add friction
      y.set(pull)
      
      const progress = Math.min(pull / PULL_THRESHOLD, 1)
      const previousProgress = pullProgressRef.current
      updatePullProgress(progress)
      
      if (progress === 1 && previousProgress < 1) {
        hapticFeedback.light()
      }
    }
  }, [updatePullProgress, y])

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current || isRefreshingRef.current) return
    isPulling.current = false
    
    const currentPull = y.get()
    
    if (currentPull >= PULL_THRESHOLD) {
      hapticFeedback.medium()
      isRefreshingRef.current = true
      setIsRefreshing(true)
      y.set(0)
      
      try {
        await onRefresh()
        hapticFeedback.success()
      } catch (error) {
        hapticFeedback.error()
      } finally {
        isRefreshingRef.current = false
        setIsRefreshing(false)
        updatePullProgress(0)
      }
    } else {
      await animate(y, 0, { type: "spring", stiffness: 300, damping: 30 })
      updatePullProgress(0)
    }
  }, [onRefresh, updatePullProgress, y])

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
      if (progressFrame.current !== null) {
        window.cancelAnimationFrame(progressFrame.current)
        progressFrame.current = null
      }
    }
  }, [handleTouchEnd, handleTouchMove, handleTouchStart])

  return (
    <div ref={containerRef} className="relative min-h-full w-full bg-background">
      {/* Indicator (Behind content) */}
      <div 
        className="absolute top-0 left-0 right-0 flex justify-center items-center z-30 pointer-events-none"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 30px)" }}
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
        style={{ y }}
        className="min-h-full w-full bg-background relative z-10"
      >
        {children}
      </motion.div>
    </div>
  )
}
