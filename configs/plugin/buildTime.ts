import type { HtmlTagDescriptor, Plugin } from 'vite'

const pad = (value: number) => String(value).padStart(2, '0')

const formatBuildTime = (date: Date) => {
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  const seconds = pad(date.getSeconds())

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

export const buildTimePlugin = (): Plugin => {
  const buildTime = formatBuildTime(new Date())

  return {
    name: 'jetlinks-build-time',
    apply: 'build',
    transformIndexHtml() {
      const descriptor: HtmlTagDescriptor = {
        tag: 'script',
        children: `console.info('[Cloud] build time: ${buildTime}')`,
        injectTo: 'body'
      }

      return [descriptor]
    }
  }
}
