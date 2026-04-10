export type TagChipItem = { id: string; name: string; icon?: string }

export type SidebarSection = {
  id: string
  name: string
  depth: number
  parentId?: string
  tags: TagChipItem[]
}

export type SidebarBlock =
  | { kind: 'classifier'; id: string; name: string; depth: number }
  | { kind: 'tag-row'; depth: number; tags: TagChipItem[] }

export function normalizeTagClassifiersResponse(res: any): any[] {
  if (Array.isArray(res)) return res
  if (res?.success === false) return []
  return res?.result ?? res?.data ?? []
}

function normalizeTagNode(node: any): TagChipItem | null {
  if (!node?.id) return null
  return {
    id: String(node.id),
    name: String(node.name ?? node.id),
    icon: node.icon != null && node.icon !== '' ? String(node.icon) : undefined,
  }
}

function collectTags(nodes: any, acc: TagChipItem[] = []): TagChipItem[] {
  if (!Array.isArray(nodes) || !nodes.length) return acc
  for (const node of nodes) {
    const item = normalizeTagNode(node)
    if (item) acc.push(item)
    if (node?.children?.length) collectTags(node.children, acc)
  }
  return acc
}

export function buildSidebarSections(roots: any[]): SidebarSection[] {
  const sections: SidebarSection[] = []

  function walkClassifier(classifier: any, depth: number, parentId?: string) {
    if (!classifier?.id) return
    const sectionId = String(classifier.id)
    sections.push({
      id: sectionId,
      name: String(classifier.name ?? classifier.id),
      depth,
      parentId,
      tags: collectTags(classifier.tags),
    })

    if (Array.isArray(classifier.children) && classifier.children.length) {
      for (const child of classifier.children) {
        walkClassifier(child, depth + 1, sectionId)
      }
    }
  }

  if (!Array.isArray(roots)) return sections
  for (const root of roots) walkClassifier(root, 0)
  return sections
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
      const item = normalizeTagNode(n)
      if (item) tags.push(item)
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
