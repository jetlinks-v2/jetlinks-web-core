/** getRandomValues also works on HTTP deployments where randomUUID is unavailable. */
export function createDashboardId() {
  return Array.from(crypto.getRandomValues(new Uint32Array(4)), value => value.toString(16)).join('-')
}
