/** Fixed summary rows plus one measured expansion; off-screen details need no DOM nodes. */
export function virtualRowOffset(index: number, height: number, expandedIndex = -1, extra = 0) {
  return index * height + (expandedIndex >= 0 && index > expandedIndex ? extra : 0)
}

export function virtualRange(
  length: number,
  height: number,
  top: number,
  viewport: number,
  expandedIndex = -1,
  extra = 0
) {
  const indexAt = (position: number) => {
    const start = expandedIndex * height
    if (expandedIndex < 0 || position < start) return Math.floor(position / height)
    if (position < start + height + extra) return expandedIndex
    return Math.floor((position - extra) / height)
  }
  const start = Math.max(0, Math.min(indexAt(top), length - 1))
  return {
    start,
    end: Math.min(length, indexAt(top + viewport) + 2),
    offset: virtualRowOffset(start, height, expandedIndex, extra),
    total: length * height + (expandedIndex >= 0 ? extra : 0)
  }
}
