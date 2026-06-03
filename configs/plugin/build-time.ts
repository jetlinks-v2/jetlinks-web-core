import type { Plugin } from 'vite'

export function buildTimePlugin(): Plugin {
  return {
    name: 'build-time-plugin',
    config() {
      return {
        define: {
          __BUILD_TIME__: JSON.stringify(new Date().toISOString())
        }
      }
    }
  }
}
