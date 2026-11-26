<template>
  <a-popover
    v-if="$slots.content || !configuredPoint || configured.visible.value" v-model:open="open"
    :trigger="['hover', 'focus', 'click']" :placement="placement" :z-index="2147483647"
    overlay-class-name="document-help-popover" transition-name="document-help-fade"
    :overlay-style="{ paddingInline: 'var(--space-3, 12px)' }"
  >
    <template #content>
      <div ref="content" class="document-help__content" :style="contentStyle" @click.stop @keydown.stop @keyup.stop @keydown.esc="open = false">
        <div v-if="$slots.content" class="document-help__body"><slot name="content" :openDocument="openDocument" :close="close" /></div>
        <div v-else-if="configuredPoint" class="document-help__body" aria-live="polite">
          <MarkdownPreview :content="configured.content.value" />
        </div>
        <span v-else>{{ description }}</span>
        <div v-if="!configuredPoint && document?.trim()" :class="{ 'document-help__footer': $slots.content }" class="document-help__action">
          <a-button type="link" size="small" class="document-help__link" @click.stop="openHelp">
            {{ t('components.DocumentHelp.document') }}
          </a-button>
        </div>
      </div>
    </template>
    <a-button
      ref="trigger"
      :type="$slots.default ? 'link' : 'text'" size="small" class="document-help__trigger" :class="{ 'document-help__trigger--custom': $slots.default }"
      :aria-label="t('components.DocumentHelp.help')" :aria-expanded="open"
      @click.stop @keydown.stop @keyup.stop @keydown.esc="open = false"
    >
      <slot><AIcon :type="icon" :style="{ color: iconColor }" /></slot>
    </a-button>
  </a-popover>
</template>

<script setup lang="ts">
import { computed, provide, useSlots } from 'vue'
import type { PopoverProps } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import { closeDocumentHelpKey, useDocumentHelp, useDocumentHelpArrow } from '@jetlinks-web-core/hooks/useDocumentHelp'
import { useConfiguredDocumentHelp } from '@jetlinks-web-core/hooks/useConfiguredDocumentHelp'
import MarkdownPreview from './MarkdownPreview.vue'

const props = withDefaults(defineProps<{
  description?: string
  document?: string
  code?: string
  helpKey?: string
  icon?: string
  iconColor?: string
  placement?: PopoverProps['placement']
  width?: number | string
}>(), { description: '', icon: 'QuestionCircleOutlined', placement: 'top' })
const { t } = useI18n()
const slots = useSlots()
const { open, openHelp, openDocument, close } = useDocumentHelp(() => props.document)
const { trigger, content } = useDocumentHelpArrow(open)
provide(closeDocumentHelpKey, close)
const configuredPoint = computed(() => props.code && props.helpKey ? { code: props.code, key: props.helpKey } : undefined)
const configured = useConfiguredDocumentHelp(open, () => slots.content ? undefined : configuredPoint.value)
const contentStyle = computed(() => {
  const width = props.width ?? (configuredPoint.value ? 420 : 320)
  return { width: typeof width === 'number' ? `${width}px` : width }
})
</script>

<style scoped lang="less">
.document-help {
  &__trigger { display: inline-flex; align-items: center; justify-content: center; width: var(--space-6); height: var(--space-6); padding: 0; vertical-align: middle; color: var(--jet-theme-text-secondary); }
  &__trigger--custom { width: auto; color: var(--jet-theme-primary); &:hover, &:focus-visible { color: var(--jet-theme-primary-hover); } }
  &__content { max-width: calc(100vw - 64px); max-height: min(60vh, 28rem); overflow: auto; overflow-wrap: anywhere; }
  &__body { overflow-x: auto; :deep(table), :deep(th), :deep(td) { font-size: inherit; } }
  &__action { display: inline; }
  &__footer { display: block; margin-top: var(--space-3); padding-top: var(--space-2); border-top: 1px solid var(--jet-theme-border-secondary); }
  &__link { height: auto; padding: 0; margin-left: var(--space-1); font-size: inherit; }
}

:global(.document-help-fade-enter-active),
:global(.document-help-fade-appear-active) {
  animation: document-help-fade-in 120ms ease-out both;
}
:global(.document-help-fade-leave-active) {
  animation: document-help-fade-out 120ms ease-in both;
}
@keyframes document-help-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes document-help-fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  :global(.document-help-fade-enter-active),
  :global(.document-help-fade-appear-active),
  :global(.document-help-fade-leave-active) {
    animation: none;
  }
}
</style>

<style lang="less">
.document-help-popover {
  &[class*='-placement-top'] .ant-popover-arrow,
  &[class*='-placement-bottom'] .ant-popover-arrow {
    left: clamp(0%, var(--help-arrow-x, 50%), 100%);
    right: auto;
  }
  &[class*='-placement-left'] .ant-popover-arrow,
  &[class*='-placement-right'] .ant-popover-arrow {
    top: clamp(0%, var(--help-arrow-y, 50%), 100%);
    bottom: auto;
  }
  &[class*='-placement-top'] .ant-popover-arrow { transform: translate(-50%, 100%) rotate(180deg); }
  &[class*='-placement-bottom'] .ant-popover-arrow { transform: translate(-50%, -100%); }
  &[class*='-placement-left'] .ant-popover-arrow { transform: translate(100%, -50%) rotate(90deg); }
  &[class*='-placement-right'] .ant-popover-arrow { transform: translate(-100%, -50%) rotate(-90deg); }
}

// The popover is teleported. Scope the card surface to Markdown help and its previews.
.document-help-popover:has(.document-help-article) {
  .ant-popover-inner {
    padding: 0;
    border: 1px solid color-mix(in srgb, var(--jet-theme-primary) 20%, var(--jet-theme-bg-container));
    border-radius: var(--r-5);
    background: var(--jet-theme-bg-container);
  }
  .ant-popover-arrow::before {
    background: var(--jet-theme-bg-container);
  }
  .document-help__content {
    max-width: calc(100vw - 2 * var(--space-4));
  }
}
</style>
