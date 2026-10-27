export type DriverStyle = { helmet: string; suit: string }
export const DEFAULT_DRIVER_STYLE: DriverStyle = { helmet: '#49dce8', suit: '#49dce8' }
const KEY = 'palm-prix-driver-style-v1'
export function loadDriverStyle(): DriverStyle {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (value && /^#[\da-f]{6}$/i.test(value.helmet) && /^#[\da-f]{6}$/i.test(value.suit)) return value
  } catch { /* Storage may be disabled. */ }
  return DEFAULT_DRIVER_STYLE
}
export function saveDriverStyle(style: DriverStyle) {
  try { localStorage.setItem(KEY, JSON.stringify(style)) } catch { /* Current session still works. */ }
}
