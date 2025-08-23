// Environment configuration
export const isDevelopment = process.env.NODE_ENV === 'development'
export const isProduction = process.env.NODE_ENV === 'production'

// API configuration
export const API_BASE_URL = isDevelopment ? '/api' : '/api'

// Feature flags
export const FEATURES = {
  MOCK_DATA_FALLBACK: true,
  VERBOSE_LOGGING: isDevelopment,
  SHOW_DEBUG_INFO: isDevelopment,
}

// Console logging helper
export const logger = {
  info: (...args: any[]) => {
    if (FEATURES.VERBOSE_LOGGING) {
      console.info(...args)
    }
  },
  warn: (...args: any[]) => {
    if (FEATURES.VERBOSE_LOGGING) {
      console.warn(...args)
    }
  },
  error: (...args: any[]) => {
    if (FEATURES.VERBOSE_LOGGING) {
      console.error(...args)
    }
  },
}