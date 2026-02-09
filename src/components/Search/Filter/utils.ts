
export const buildIdToTitle = (tree: any[], filedNames: Record<string, string> = {key: 'id', title: 'name'})=> {
  const map = new Map()

  const walk = (nodes: any[]) => {
    nodes.forEach(n => {
      const id = n[filedNames.key]
      const title = n[filedNames.title]
      map.set(id, title)
      if (n.children?.length) walk(n.children)
    })
  }

  walk(tree)
  return map
}