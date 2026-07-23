"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export function GlobalSwipeBack() {
  const router = useRouter()

  useEffect(() => {
    let touchStartX = 0
    let touchEndX = 0
    let isSwipe = false
    let isNavigating = false

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.changedTouches[0].screenX
      isSwipe = true
    }

    const handleTouchMove = (e: TouchEvent) => {
      touchEndX = e.changedTouches[0].screenX
    }

    const handleTouchEnd = () => {
      if (!isSwipe || isNavigating) return
      
      // Swipe right with distance > 80px and starting near the left edge
      if (touchEndX > touchStartX && touchEndX - touchStartX > 80) {
        if (touchStartX < 50) {
          isNavigating = true
          document.body.style.transition = "transform 0.25s ease-out, opacity 0.25s ease-out"
          document.body.style.transform = "translateX(30%)"
          document.body.style.opacity = "0"
          
          setTimeout(() => {
            router.back()
            setTimeout(() => {
              document.body.style.transition = "none"
              document.body.style.transform = "translateX(0)"
              document.body.style.opacity = "1"
              isNavigating = false
            }, 100)
          }, 150)
        }
      }
    }

    const handleWheel = (e: WheelEvent) => {
      if (isNavigating) return
      
      // Horizontal swipe to the right on trackpad
      if (e.deltaX < -30 && Math.abs(e.deltaY) < 15) {
        let el = e.target as HTMLElement | null
        let canScrollLeft = false
        
        while (el && el !== document.body && el !== document.documentElement) {
           if (el.scrollWidth > el.clientWidth && el.scrollLeft > 0) {
              canScrollLeft = true
              break
           }
           el = el.parentElement
        }

        if (!canScrollLeft) {
          isNavigating = true
          document.body.style.transition = "transform 0.25s ease-out, opacity 0.25s ease-out"
          document.body.style.transform = "translateX(30%)"
          document.body.style.opacity = "0"
          
          setTimeout(() => {
            router.back()
            setTimeout(() => {
              document.body.style.transition = "none"
              document.body.style.transform = "translateX(0)"
              document.body.style.opacity = "1"
              isNavigating = false
            }, 100)
          }, 150)
        }
      }
    }

    window.addEventListener("touchstart", handleTouchStart, { passive: true })
    window.addEventListener("touchmove", handleTouchMove, { passive: true })
    window.addEventListener("touchend", handleTouchEnd)
    window.addEventListener("wheel", handleWheel, { passive: true })

    return () => {
      window.removeEventListener("touchstart", handleTouchStart)
      window.removeEventListener("touchmove", handleTouchMove)
      window.removeEventListener("touchend", handleTouchEnd)
      window.removeEventListener("wheel", handleWheel)
    }
  }, [router])

  return null
}
