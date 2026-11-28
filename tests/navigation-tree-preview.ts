import { createApp, h, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import NavigationTree from '../src/components/NavigationTree'
import type { NavigationTreeKey, NavigationTreeNode } from '../src/components/NavigationTree'
import zh from '../src/locales/lang/zh.json'
import 'ant-design-vue/dist/reset.css'
import '../src/style/components.less'

// Deterministic layout fixture: no account, API or saved business data.
const branch = (depth: number): NavigationTreeNode => ({
  key: `depth-${depth}`, title: `第 ${depth} 层 · 很长的目录名称用于检查名称省略与计数空间`, count: depth,
  children: depth < 9 ? [branch(depth + 1), { key: `sibling-${depth}`, title: `第 ${depth} 层末尾叶子`, count: 12 }] : undefined,
})
const nodes = [{ key: 0, title: '全部目录', count: 30, children: [branch(1), ...Array.from({ length: 20 }, (_, i) => ({ key: `tail-${i}`, title: `普通目录 ${i}`, count: i }))] }]
createApp({ setup() {
  const expanded = ref<NavigationTreeKey[]>(), width = ref(220), selected = ref<NavigationTreeKey[]>(['depth-9'])
  return () => h('main', { style: { padding: '24px', '--space-1': '4px', '--space-8': '32px', '--line-strong': '#d9d9d9', '--bg': '#fff' } }, [
    h('button', { onClick: () => { width.value = width.value === 220 ? 440 : 220 } }, '切换宽度'),
    h('section', { style: { width: `${width.value}px`, height: '520px', display: 'flex', flexDirection: 'column', border: '1px solid #ddd' } }, [
      h('header', '目录'),
      h(NavigationTree, {
        treeData: nodes, searchable: true, searchNodeKey: 0, expandedKeys: expanded.value, selectedKeys: selected.value,
        'onUpdate:expandedKeys': keys => { expanded.value = keys }, onSelect: keys => { selected.value = keys },
      }, { 'node-meta': (node: NavigationTreeNode) => h('span', { 'data-count': '', style: { fontSize: '12px', padding: '0 4px', background: '#f5f5f5' } }, String(node.count)) }),
      h('footer', '固定底部动作'),
    ]),
  ])
} }).use(createI18n({ legacy: false, locale: 'zh', flatJson: true, messages: { zh } })).mount('#app')
