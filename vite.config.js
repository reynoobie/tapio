import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({oxc:{jsx:{runtime:'automatic'}},plugins:[tailwindcss()]})
