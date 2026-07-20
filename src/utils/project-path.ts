const normalizeSegment = (value: unknown) => {
  if (typeof value !== 'string') return ''
  return decodeURIComponent(value).trim()
}

export const getProjectCodeFromPathname = (pathname = window.location.pathname) => {
  const [first] = pathname.split('/').filter(Boolean)
  return normalizeSegment(first)
}

export const getProjectIdFromPathname = getProjectCodeFromPathname

export const getProjectCodeFromLocation = () => getProjectCodeFromPathname()

export const getProjectIdFromLocation = getProjectCodeFromLocation
