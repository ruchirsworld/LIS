import { registerSW } from 'virtual:pwa-register'

const HALF_HOUR = 30 * 60 * 1000

/** Keeps the installed app current. The app already swaps itself for a new version, but only when a page loads, so a
 * tab left open for hours kept running the old copy. This asks for a new version every half hour and whenever you
 * come back to the tab. */
export function keepAppUpToDate() {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => {
        if (navigator.onLine) void registration.update().catch(() => {})
      }
      setInterval(check, HALF_HOUR)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    },
  })
}
