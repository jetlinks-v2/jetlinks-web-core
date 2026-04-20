import { marked } from 'marked'

let configured = false

function ensureMarked() {
  if (configured) return
  marked.setOptions({ gfm: true, breaks: true })
  configured = true
}

/** 将 Markdown 转为 HTML（用于能力版本发布说明等受控内容） */
export function renderCapabilityMarkdown(md: string): string {
  ensureMarked()
  const s = typeof md === 'string' ? md : ''
  return marked.parse(s) as string
}
