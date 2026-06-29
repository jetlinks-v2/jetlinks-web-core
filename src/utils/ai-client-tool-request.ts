let silentRequestDepth = 0

export const isAiClientToolSilentRequest = () => silentRequestDepth > 0

export const withAiClientToolSilentRequest = async <T>(
  runner: () => Promise<T> | T,
): Promise<T> => {
  silentRequestDepth += 1
  try {
    return await runner()
  } finally {
    silentRequestDepth = Math.max(0, silentRequestDepth - 1)
  }
}
