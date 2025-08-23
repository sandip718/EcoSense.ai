// Comprehensive error suppression for development

// Store original console methods
const originalMethods = {
  error: console.error,
  warn: console.warn,
  log: console.log,
  info: console.info,
}

// Patterns to suppress
const SUPPRESSED_PATTERNS = [
  // API errors when backend is down
  'GET http://localhost:3001/api/',
  'Request failed with status code 500',
  'Internal Server Error',
  'ECONNREFUSED',
  'dispatchXhrRequest',
  'xhr @',
  'dispatchRequest @',
  
  // Browser extension noise
  'Download the React DevTools',
  'Could not establish connection',
  'Teflon Content Script',
  'Receiving end does not exist',
  
  // Development warnings we can't fix
  'contentscript.bundle.js',
  'chunk-V5LT2MCF.js',
]

// Function to check if a message should be suppressed
const shouldSuppress = (args: any[]): boolean => {
  const message = args.join(' ')
  return SUPPRESSED_PATTERNS.some(pattern => message.includes(pattern))
}

// Override console methods
console.error = (...args: any[]) => {
  if (!shouldSuppress(args)) {
    originalMethods.error.apply(console, args)
  }
}

console.warn = (...args: any[]) => {
  if (!shouldSuppress(args)) {
    originalMethods.warn.apply(console, args)
  }
}

console.log = (...args: any[]) => {
  if (!shouldSuppress(args)) {
    originalMethods.log.apply(console, args)
  }
}

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  const message = event.reason?.message || event.reason?.toString() || ''
  
  if (SUPPRESSED_PATTERNS.some(pattern => message.includes(pattern))) {
    event.preventDefault()
  }
})

// Export original methods for explicit use
export const originalConsole = originalMethods