<template>
  <section class="splitter-pane" :style="{ '--splitter-pane-padding': typeof padding === 'number' ? `${padding}px` : padding }">
    <header v-if="$slots.header || headerHeight" class="splitter-pane__row" :style="{ minHeight: `${headerHeight}px` }">
      <div v-if="$slots.header" ref="headerContent" class="splitter-pane__row-content"><slot name="header" /></div>
    </header>
    <div v-if="$slots.toolbar || toolbarHeight" class="splitter-pane__row" :style="{ minHeight: `${toolbarHeight}px` }">
      <div v-if="$slots.toolbar" ref="toolbarContent" class="splitter-pane__row-content"><slot name="toolbar" /></div>
    </div>
    <div ref="body" class="splitter-pane__body" :class="{ 'splitter-pane__body--contained': !scroll }" @scroll="$emit('scroll', $event)"><slot /></div>
  </section>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { usePaneRow } from './usePaneRows'
withDefaults(defineProps<{
  /** 正文内边距；表格、虚拟列表等全幅内容可设为 0。 */
  padding?: number | string
  /** 已有滚动 owner 的正文设为 false，保留完整的可收缩高度链。 */
  scroll?: boolean
}>(), { padding: 'var(--space-4, 16px)', scroll: true })
defineEmits<{ scroll: [event: Event] }>()
const headerContent = ref<HTMLElement>(), toolbarContent = ref<HTMLElement>(), body = ref<HTMLElement>()
const headerHeight = usePaneRow('header', headerContent)
const toolbarHeight = usePaneRow('toolbar', toolbarContent)
defineExpose({ body })
</script>
<style scoped src="./pane.css" />
