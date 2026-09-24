import { computed, ref, watch } from 'vue'
import type { FileDirectorySource, ModelFile, TreeNode } from './modelFileDirectory'

export function useModelFileDirectory(source: FileDirectorySource) {
  const searchValue = ref('')
  const keyword = computed(() => searchValue.value.trim().toLowerCase())
  const isSearching = computed(() => !!keyword.value)
  const visibleTree = computed(() => keyword.value
    ? filterFileTree(source.treeData, keyword.value)
    : source.treeData)

  // 搜索展开状态独立保存，清空关键字后恢复用户原来的目录折叠状态。
  const directoryExpandedKeys = ref<Array<string | number>>([])
  const searchExpandedKeys = ref<Array<string | number>>([])
  const folderKeys = computed(() => collectFolderKeys(source.treeData))
  const expandedKeys = computed(() => isSearching.value
    ? searchExpandedKeys.value
    : directoryExpandedKeys.value)

  watch(folderKeys, (keys, previousKeys = []) => {
    const availableKeys = new Set<string | number>(keys)
    const previousKeySet = new Set(previousKeys)
    directoryExpandedKeys.value = [
      ...directoryExpandedKeys.value.filter(key => availableKeys.has(key)),
      ...keys.filter(key => !previousKeySet.has(key))
    ]
  }, { immediate: true })

  watch(visibleTree, (nodes) => {
    searchExpandedKeys.value = collectFolderKeys(nodes)
  }, { immediate: true })

  function setExpandedKeys(keys: Array<string | number>) {
    if (isSearching.value) {
      searchExpandedKeys.value = keys
    } else {
      directoryExpandedKeys.value = keys
    }
  }

  function getTreeNodeIcon(isFile?: boolean, shared?: boolean, file?: ModelFile) {
    if (!isFile) return 'FolderOutlined'
    if (file?.extract) return 'FileZipOutlined'
    return shared ? 'FileOutlined' : 'FileProtectOutlined'
  }

  function hasFileTreeTags(file?: ModelFile) {
    return !!file && (file.extract || !!file.format?.filter(Boolean).length)
  }

  function getFileTreeTags(file?: ModelFile) {
    if (!file) return []
    const formats = file.format?.filter(Boolean) || []
    const formatLabel = formats.map(format => source.formatNames.get(format) || format).join(',')
    if (file.extract && formatLabel) {
      return [{
        key: 'extract-format',
        label: source.locale.extractFile + ' · ' + formatLabel,
        title: source.locale.extractFile + ' / ' + formatLabel,
        type: 'extract' as const
      }]
    }

    const tags: Array<{ key: string; label: string | undefined; title: string | undefined; type: 'extract' | 'format' }> = []
    if (file.extract) {
      tags.push({
        key: 'extract',
        label: source.locale.extractFile,
        title: source.locale.extractFile,
        type: 'extract'
      })
    }
    if (formatLabel) {
      tags.push({
        key: 'format',
        label: formatLabel,
        title: formatLabel,
        type: 'format'
      })
    }
    return tags
  }

  return {
    searchValue,
    isSearching,
    visibleTree,
    expandedKeys,
    setExpandedKeys,
    getTreeNodeIcon,
    hasFileTreeTags,
    getFileTreeTags
  }
}

function filterFileTree(nodes: TreeNode[], keyword: string): TreeNode[] {
  return nodes.flatMap((node) => {
    if (node.isFile) {
      const fullPath = [node.file?.path, node.title].filter(Boolean).join('/')
      return fullPath.toLowerCase().includes(keyword) ? [node] : []
    }
    const children = filterFileTree(node.children || [], keyword)
    // 只裁剪展示树；保留文件对象与原 key，不触碰选择、草稿或提交数据。
    return children.length ? [{ ...node, children }] : []
  })
}

function collectFolderKeys(nodes: TreeNode[]): string[] {
  return nodes.flatMap(node => node.isFile
    ? []
    : [node.key, ...collectFolderKeys(node.children || [])])
}
