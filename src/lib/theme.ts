const THEME_STORAGE_KEY = 'shinx-theme'
const THEME_CHANGE_EVENT = 'shinx-theme-change'

export function subscribeToTheme(listener: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, listener)
  window.addEventListener('storage', listener)

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, listener)
    window.removeEventListener('storage', listener)
  }
}

export function getThemeSnapshot() {
  return document.documentElement.classList.contains('dark')
}

export function getServerThemeSnapshot() {
  return false
}

export function setDarkTheme(enabled: boolean, trigger?: HTMLElement) {
  const updateTheme = () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, enabled ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', enabled)
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (prefersReducedMotion || typeof document.startViewTransition !== 'function') {
    updateTheme()
    return
  }

  if (trigger) {
    const rect = trigger.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const radius = Math.ceil(Math.max(
      Math.hypot(x, y),
      Math.hypot(window.innerWidth - x, y),
      Math.hypot(x, window.innerHeight - y),
      Math.hypot(window.innerWidth - x, window.innerHeight - y),
    ))

    document.documentElement.style.setProperty('--theme-reveal-x', `${x}px`)
    document.documentElement.style.setProperty('--theme-reveal-y', `${y}px`)
    document.documentElement.style.setProperty('--theme-reveal-radius', `${radius}px`)
  }

  document.startViewTransition(updateTheme)
}
