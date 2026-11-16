<template>
  <component
    :is="shellComponent"
    v-if="shellComponent"
    class="jl-app-scope"
    :data-jl-app="applicationId"
  />
  <ApplicationLayoutPage v-else />
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, type Component } from 'vue'
import { getApplicationRuntimeEntry } from '@jetlinks-web-core/utils/project-runtime'
import { useMenuStore } from '@jetlinks-web-core/store/menu'
import { resolveApplicationShell, type ResolvedApplicationShell } from '../runtime/applicationShell'
import ApplicationLayoutPage from './ApplicationLayoutPage.vue'

defineOptions({ name: 'ApplicationHostPage' })

/**
 * 应用端外壳分派。
 *
 * 应用自带外壳由模块在 `getApplicationShell()` 里声明并按菜单标识命中；未命中任何
 * 声明时回落到默认 `ApplicationLayoutPage`。外壳组件复用同一棵组件树，因此菜单、
 * 权限、路由、`contentPanelOverrides` 与默认布局完全一致。
 */
const menuStore = useMenuStore()

const resolvedShell = computed<ResolvedApplicationShell | undefined>(() => {
  const entry = getApplicationRuntimeEntry()
  if (entry.type !== 'application') return undefined

  // 菜单先于布局路由完成加载（`ensureMenuRoutes` 在 `next()` 之前执行），首帧即可求值。
  const hasMenu = (code: string) => !!code && menuStore.hasMenu(code)

  return resolveApplicationShell({ applicationId: entry.applicationId, hasMenu })
})

const applicationId = computed(() => getApplicationRuntimeEntry().applicationId)

// 同一模块只创建一次异步组件，避免菜单变化时重复实例化外壳。
const shellComponents = new Map<string, Component>()

const shellComponent = computed<Component | undefined>(() => {
  const resolved = resolvedShell.value
  if (!resolved) return undefined

  const cached = shellComponents.get(resolved.moduleName)
  if (cached) return cached

  const component = defineAsyncComponent(resolved.declaration.component)
  shellComponents.set(resolved.moduleName, component)
  return component
})
</script>
