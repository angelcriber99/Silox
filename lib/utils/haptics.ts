export const hapticFeedback = {
  // Light tap, suitable for button clicks
  light: () => {
    if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(10)
    }
  },
  // Medium tap, suitable for tab changes or important actions
  medium: () => {
    if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(20)
    }
  },
  // Heavy tap, suitable for destructive actions or major state changes
  heavy: () => {
    if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(30)
    }
  },
  // Success pattern (two quick taps)
  success: () => {
    if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate([15, 50, 15])
    }
  },
  // Error pattern (three quick taps)
  error: () => {
    if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate([20, 40, 20, 40, 20])
    }
  }
}
