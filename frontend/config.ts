// API Configuration
const API_CONFIG = {
    development: {
        baseURL: 'http://127.0.0.1:8000',
    },
    production: {
        baseURL: process.env.NUXT_PUBLIC_API_URL || 'https://api.yourdomain.com', // This will be overridden in production
    }
}

// Get current environment
const environment = process.env.NODE_ENV || 'development'

// Export the configuration for the current environment
export const config = {
    api: API_CONFIG[environment as keyof typeof API_CONFIG]
} 