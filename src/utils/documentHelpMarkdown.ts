import DOMPurify from 'dompurify'

/** 管理员配置的 Markdown 也按不可信 HTML 清洗，链接使用独立且隔离的窗口。 */
export function sanitizeHelpMarkdown(html: string): string {
  const fragment = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true }, RETURN_DOM_FRAGMENT: true,
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select'], FORBID_ATTR: ['style'],
  })
  fragment.querySelectorAll('a').forEach(link => {
    const href = link.getAttribute('href')
    try {
      if (href && !['http:', 'https:'].includes(new URL(href, window.location.href).protocol)) link.removeAttribute('href')
    } catch {
      link.removeAttribute('href')
    }
    link.setAttribute('target', '_blank')
    link.setAttribute('rel', 'noopener noreferrer')
  })
  const container = document.createElement('div')
  container.append(fragment)
  return container.innerHTML
}
