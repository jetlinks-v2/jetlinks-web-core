export type TagChipItem = { id: string; name: string; icon?: string }

export type SidebarBlock =
  | { kind: 'classifier'; id: string; name: string; depth: number }
  | { kind: 'tag-row'; depth: number; tags: TagChipItem[] }

export function normalizeTagClassifiersResponse(res: any): any[] {
  if (Array.isArray(res)) return res
  if (res?.success === false) return []
  return res?.result ?? res?.data ?? []
}

/** 分类标题 → 同级标签同一行 → 子标签树下一行（缩进更深） */
export function buildSidebarBlocks(roots: any[]): SidebarBlock[] {
  const blocks: SidebarBlock[] = []
  function walkClassifier(c: any, depth: number) {
    if (!c?.id) return
    blocks.push({
      kind: 'classifier',
      id: String(c.id),
      name: String(c.name ?? c.id),
      depth,
    })
    walkTagSiblingRow(c.tags, depth + 1)
    if (Array.isArray(c.children) && c.children.length) {
      for (const ch of c.children) walkClassifier(ch, depth + 1)
    }
  }
  function walkTagSiblingRow(nodes: any, depth: number) {
    if (!Array.isArray(nodes) || !nodes.length) return
    const tags: TagChipItem[] = []
    for (const n of nodes) {
      if (n?.id) {
        tags.push({
          id: String(n.id),
          name: String(n.name ?? n.id),
          icon: n.icon != null && n.icon !== '' ? String(n.icon) : undefined,
        })
      }
    }
    if (tags.length) blocks.push({ kind: 'tag-row', depth, tags })
    for (const n of nodes) {
      if (n?.children?.length) walkTagSiblingRow(n.children, depth + 1)
    }
  }
  if (!Array.isArray(roots)) return blocks
  for (const root of roots) walkClassifier(root, 0)
  return blocks
}
