/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./main.js",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['DM Sans', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            colors: {
                lamp: {
                    bg: '#FAFAF8',
                    sidebar: '#F3F2EF',
                    card: '#FFFFFF',
                    border: '#E8E6E1',
                    text: '#1A1A1A',
                    muted: '#6B6B6B',
                    accent: '#1A1A1A',
                    hover: '#2A2A2A',
                    input: '#F7F7F5',
                }
            }
        }
    },
    plugins: [],
}
