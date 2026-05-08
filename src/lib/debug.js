const PREFIX = '[ZIARA-ADMIN]'
const COLORS = {
  component: '#0891b2',
  action: '#059669',
  api: '#d97706',
  auth: '#dc2626',
  navigation: '#9333ea',
  error: '#e11d48',
  lifecycle: '#475569',
}

function getTimestamp() {
  return new Date().toISOString().split('T')[1].split('.')[0]
}

function log(level, category, message, data) {
  const ts = getTimestamp()
  const color = COLORS[category] || COLORS.component
  const header = `%c${PREFIX} [${category}] ${ts}`
  const style = `color: ${color}; font-weight: bold; font-size: 12px;`

  if (data !== undefined) {
    console[level](header, style, message, data)
  } else {
    console[level](header, style, message)
  }
}

export const debug = {
  component: (name, message, data) => log('log', 'component', `[${name}] ${message}`, data),
  action: (name, message, data) => log('log', 'action', `[${name}] ${message}`, data),
  api: (collection, message, data) => log('log', 'api', `[${collection}] ${message}`, data),
  auth: (provider, message, data) => log('log', 'auth', `[${provider}] ${message}`, data),
  navigation: (from, to, data) => log('log', 'navigation', `${from} -> ${to}`, data),
  lifecycle: (name, message, data) => log('log', 'lifecycle', `[${name}] ${message}`, data),
  error: (source, error, data) => {
    const err = error instanceof Error ? error.message : String(error)
    log('error', 'error', `[${source}] ${err}`, data)
  },

  group: (label) => console.groupCollapsed(`${PREFIX} ${label}`),
  groupEnd: () => console.groupEnd(),

  table: (category, rows) => {
    if (!rows?.length) return
    const color = COLORS[category] || COLORS.component
    console.log(`%c${PREFIX} [${category}] ${getTimestamp()}`, `color: ${color}; font-weight: bold;`)
    console.table(rows)
  },
}

export default debug
