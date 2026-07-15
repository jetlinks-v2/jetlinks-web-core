import proMenu from './baseMenu';
import {getModulesMenu} from '@jetlinks-web-core/utils/modules'
import { omit } from 'lodash-es'
/**
 * 合并菜单数据
 * @param tree1 基础菜单数据
 * @param tree2 云端菜单数据
 * @returns 合并后的菜单数据
 */
export const mergeTrees = (tree1: any[], tree2: any[]) => {
  const map = new Map();
  const aliasMap = new Map<string, string>();

  const getNodeKeys = (node: any) => {
    return [
      node?.code,
      node?.id,
      node?.options?.routeName,
      node?.url,
    ].filter(Boolean);
  };

  const resolvePrimaryKey = (node: any) => {
    const keys = getNodeKeys(node);
    for (const key of keys) {
      const matched = aliasMap.get(String(key));
      if (matched) {
        return matched;
      }
    }
    return String(keys[0] || '');
  };

  function addToMap(nodes: any[]) {
    for (const node of nodes) {
      const primaryKey = resolvePrimaryKey(node);
      if (!primaryKey) {
        continue;
      }

      if (!map.has(primaryKey)) {
        map.set(primaryKey, { ...node, children: [] });
      } else {
        const oldValue = map.get(primaryKey);
        map.set(primaryKey, { ...oldValue, ...omit(node, ['children']) });
      }
      getNodeKeys(node).forEach((key) => aliasMap.set(String(key), primaryKey));
      const existing = map.get(primaryKey);

      existing.children = mergeTrees(existing.children || [], node.children || []);
    }
  }

  addToMap(tree1);
  addToMap(tree2);

  return Array.from(map.values());
}

export const handleMenuOptions = (menus: any[], p: { id: string, name: string}): any[] => menus.map(item => ({
  ...item,
  children: item.children ? handleMenuOptions(item.children, p) : undefined,
  options: { appName: p.id || p.name, ...item.options }
}))

const BaseMenuFn = () => {
  const modules = getModulesMenu()
  let baseModuleMenu: any = [...proMenu]
  baseModuleMenu = mergeTrees(baseModuleMenu, modules)
  console.log(baseModuleMenu)
  return baseModuleMenu
}

export default BaseMenuFn
