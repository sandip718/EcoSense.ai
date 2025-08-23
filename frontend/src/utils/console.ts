// Console utilities for cleaner development experience

// Store original console methods
const originalWarn = console.warn
const originalError = console.error
const originalLog = console.log

// List of warning patterns to suppress
const SUPPRESSED_WARNINGS = [
  'Download the React DevTools',
  'Could not establish connection',
  'Teflon Content Script',
]

// List of error patterns to suppress in development
const SUPPRESSED_DEV_ERRORS = [
  'Request failed with status code 500', // Expected when backend is down
  'GET http://localhost:3001/api/', // API request errors
  'Internal Server Error', // Server errors
  'ECONNREFUSED', // Connection refused errors
]

// Override console.warn
console.warn = (...args: any[]) => {
  const message = args.join(' ')
  
  // Check if this warning should be suppressed
  const shouldSuppress = SUPPRESSED_WARNINGS.some(pattern => 
    message.includes(pattern)
  )
  
  if (!shouldSuppress) {
    originalWarn.apply(console, args)
  }
}

// Override console.error
console.error = (...args: any[]) => {
  const message = args.join(' ')
  
  // In development, suppress expected errors
  const shouldSuppress = SUPPRESSED_DEV_ERRORS.some(pattern => 
    message.includes(pattern)
  )
  
  if (shouldSuppress) {
    return // Silently ignore
  }
  
  originalError.apply(console, args)
}

// Override console.log to catch axios logs
const originalConsoleLog = console.log
console.log = (...args: any[]) => {
  const message = args.join(' ')
  
  // Suppress axios-related logs that contain API errors
  const shouldSuppress = SUPPRESSED_DEV_ERRORS.some(pattern => 
    message.includes(pattern)
  )
  
  if (shouldSuppress) {
    return // Silently ignore
  }
  
  originalConsoleLog.apply(console, args)
}

// Also override the global error handler for unhandled promise rejections
const originalUnhandledRejection = window.onunhandledrejection
window.onunhandledrejection = (event) => {
  const message = event.reason?.message || event.reason?.toString() || ''
  
  // Suppress API-related unhandled rejections
  const shouldSuppress = SUPPRESSED_DEV_ERRORS.some(pattern => 
    message.includes(pattern)
  )
  
  if (shouldSuppress) {
    event.preventDefault()
    return
  }
  
  // Call original handler if it exists
  if (originalUnhandledRejection) {
    originalUnhandledRejection.call(window, event)
  }
}

// Export clean console for explicit use
export const cleanConsole = {
  log: originalLog,
  info: console.info,
  warn: originalWarn,
  error: originalError,
}