import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // tsconfig keeps jsx: preserve for Next; tests need a real JSX transform.
  oxc: { jsx: { runtime: 'automatic' }, tsconfigRaw: { compilerOptions: { jsx: 'react-jsx' } } },
})
