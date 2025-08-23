// Silent axios wrapper that suppresses console errors for expected failures

import axios, { AxiosInstance, AxiosError } from 'axios'

// Create a silent axios instance
export const createSilentAxios = (baseURL: string, timeout: number = 10000): AxiosInstance => {
  const instance = axios.create({
    baseURL,
    timeout,
  })

  // Intercept requests to suppress console output
  instance.interceptors.request.use(
    (config) => {
      // Store original console methods
      const originalError = console.error
      const originalWarn = console.warn
      
      // Temporarily suppress console during request
      console.error = () => {}
      console.warn = () => {}
      
      // Restore console after a short delay
      setTimeout(() => {
        console.error = originalError
        console.warn = originalWarn
      }, 100)
      
      return config
    },
    (error) => {
      return Promise.reject(error)
    }
  )

  // Intercept responses to handle errors silently
  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      // For 500 errors (backend unavailable), create a clean error
      if (error.response?.status === 500) {
        const cleanError = new Error('Backend service unavailable')
        cleanError.name = 'ServiceUnavailableError'
        return Promise.reject(cleanError)
      }
      
      // For other errors, pass them through but don't log
      return Promise.reject(error)
    }
  )

  return instance
}