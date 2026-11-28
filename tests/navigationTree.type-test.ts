import NavigationTree from '../src/components/NavigationTree'
import type { NavigationTreeProps } from '../src/components/NavigationTree'

type Props = InstanceType<typeof NavigationTree>['$props']
const publicProps: NavigationTreeProps = {
  treeData: [{ key: 0, title: 'All', count: 7 }], searchNodeKey: 0, defaultExpandDepth: 2,
  fieldNames: { title: 'label', key: 'id', children: 'nodes' }, selectedKeys: [0], expandedKeys: [],
  checkable: true, onSelect: keys => keys.map(String), getSearchText: node => String(node.title),
}
const props: Props = publicProps
const events: Props = {
  'onUpdate:searchValue': value => value.trim(), 'onUpdate:expandedKeys': keys => keys.map(String),
  onExpand: (keys, info) => { keys.map(String); info.expanded.valueOf() },
}
const wrong: Props = {
  // @ts-expect-error Keep native Tree selection types.
  selectedKeys: 'root',
}
void [props, events, wrong]
