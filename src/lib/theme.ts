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

export function setDarkTheme(enabled: boolean) {
  window.localStorage.setItem(THEME_STORAGE_KEY, enabled ? 'dark' : 'light')
  document.documentElement.classList.toggle('dark', enabled)
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
}
