/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			// ===== Admin-controlled brand theming =====
  			// `violet`/`purple` (primary) and `indigo` (secondary) resolve to CSS variables
  			// written at runtime by src/lib/brandTheme.js from the admin's chosen colors.
  			// Defaults live in index.css (cyan #3bf4fb / lime #caff8a). The `rgb(var(--x) /
  			// <alpha-value>)` form keeps Tailwind opacity modifiers (e.g. bg-violet-600/50) working.
  			violet:  { 50:'rgb(var(--v-50) / <alpha-value>)',100:'rgb(var(--v-100) / <alpha-value>)',200:'rgb(var(--v-200) / <alpha-value>)',300:'rgb(var(--v-300) / <alpha-value>)',400:'rgb(var(--v-400) / <alpha-value>)',500:'rgb(var(--v-500) / <alpha-value>)',600:'rgb(var(--v-600) / <alpha-value>)',700:'rgb(var(--v-700) / <alpha-value>)',800:'rgb(var(--v-800) / <alpha-value>)',900:'rgb(var(--v-900) / <alpha-value>)',950:'rgb(var(--v-950) / <alpha-value>)' },
  			purple:  { 50:'rgb(var(--v-50) / <alpha-value>)',100:'rgb(var(--v-100) / <alpha-value>)',200:'rgb(var(--v-200) / <alpha-value>)',300:'rgb(var(--v-300) / <alpha-value>)',400:'rgb(var(--v-400) / <alpha-value>)',500:'rgb(var(--v-500) / <alpha-value>)',600:'rgb(var(--v-600) / <alpha-value>)',700:'rgb(var(--v-700) / <alpha-value>)',800:'rgb(var(--v-800) / <alpha-value>)',900:'rgb(var(--v-900) / <alpha-value>)',950:'rgb(var(--v-950) / <alpha-value>)' },
  			indigo:  { 50:'rgb(var(--s-50) / <alpha-value>)',100:'rgb(var(--s-100) / <alpha-value>)',200:'rgb(var(--s-200) / <alpha-value>)',300:'rgb(var(--s-300) / <alpha-value>)',400:'rgb(var(--s-400) / <alpha-value>)',500:'rgb(var(--s-500) / <alpha-value>)',600:'rgb(var(--s-600) / <alpha-value>)',700:'rgb(var(--s-700) / <alpha-value>)',800:'rgb(var(--s-800) / <alpha-value>)',900:'rgb(var(--s-900) / <alpha-value>)',950:'rgb(var(--s-950) / <alpha-value>)' },
  			fuchsia:{ 50:'#fff0f3',100:'#ffe1e8',200:'#ffd6de',300:'#ffc0cb',400:'#ff9ab0',500:'#f06a92',600:'#db4c7a',700:'#be3a5c',800:'#9d2e4a',900:'#7d2539',950:'#4c1526' },
  			brand: { primary:'rgb(var(--v-500) / <alpha-value>)', secondary:'rgb(var(--s-500) / <alpha-value>)', yellow:'#fce883', pink:'#ffc0cb' },
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};