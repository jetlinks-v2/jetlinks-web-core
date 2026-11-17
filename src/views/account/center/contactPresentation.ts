/** 联系方式只在展示层脱敏；空值和非法邮箱不回退展示原文。 */
export function maskContactValue(value: string | undefined | null, provider: 'mobile' | 'email'): string {
  const contact = value?.trim() || ''
  if (!contact) return ''
  if (provider === 'mobile') {
    return contact.length >= 8 ? `${contact.slice(0, 3)}****${contact.slice(-4)}` : '****'
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return '****'
  const [local, domain] = contact.split('@')
  // 再次展示已脱敏邮箱时保留已有遮罩，不从星号后恢复任何字符。
  const prefix = [...local.split('*')[0]].slice(0, 2).join('')
  return `${prefix}****@${domain}`
}
