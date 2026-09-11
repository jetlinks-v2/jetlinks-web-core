<template>
  <component :is="layoutComponent" />
</template>

<script setup name="BasicLayoutPage" lang="ts">
import { computed, type Component } from 'vue'
import { provideBasicLayoutController } from './hooks/basicLayoutContext'
import { useBasicLayoutController } from './hooks/useBasicLayoutController'
import { useBasicLayoutVariant } from './hooks/useBasicLayoutVariant'
import type { BasicLayoutVariant } from './runtime/layoutVariant'
import ApplicationLayoutPage from './shells/ApplicationLayoutPage.vue'
import ProjectLayoutPage from './shells/ProjectLayoutPage.vue'
import TenantLayoutPage from './shells/TenantLayoutPage.vue'

const layoutComponents = {
  tenant: TenantLayoutPage, // 租户端
  project: ProjectLayoutPage, // 项目端
  application: ApplicationLayoutPage, // 应用端
} satisfies Record<BasicLayoutVariant, Component>

const layoutVariant = useBasicLayoutVariant()
const controller = useBasicLayoutController(layoutVariant)
const layoutComponent = computed(() => layoutComponents[layoutVariant.value])

provideBasicLayoutController(controller)
</script>
