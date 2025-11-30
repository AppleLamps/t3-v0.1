import { defineConfig } from 'vite'

export default defineConfig({
    // Build output directory (standard for Vercel)
    build: {
        outDir: 'dist',
    },
    // Development server settings
    server: {
        port: 3000,
        open: true,
        // Proxy API requests to Vercel dev server during development
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
        },
    },
})
