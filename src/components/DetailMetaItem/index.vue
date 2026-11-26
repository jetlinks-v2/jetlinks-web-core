<template>
  <OptionalTooltip :title="mergedTitle">
    <span v-bind="$attrs" class="detail-meta-item" :class="{ 'detail-meta-item--multiline': multiline }" :data-semantic="kind">
      <OptionalTooltip :title="mergedTooltip ? undefined : label">
        <span class="detail-meta-item__icon">
          <AIcon :type="detailMetaIcons[kind]" aria-hidden="true" />
          <span class="detail-meta-item__label">{{ label }}</span>
        </span>
      </OptionalTooltip>
      <OptionalTooltip :title="mergedTooltip ? undefined : tooltip">
        <span class="detail-meta-item__value"><slot>{{ value }}</slot></span>
      </OptionalTooltip>
    </span>
  </OptionalTooltip>
</template>

<script setup lang="ts">
import { computed, h, resolveComponent, type FunctionalComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import { detailMetaIcons, type DetailMetaKind } from './semantics'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  kind: DetailMetaKind
  label: string
  value?: string | number
  tooltip?: string
  multiline?: boolean
  mergedTooltip?: boolean
}>()

const { t } = useI18n()
const mergedTitle = computed(() => {
  if (!props.mergedTooltip) return undefined
  const value = props.tooltip || (props.value ?? '')
  return value === '' ? props.label : t('DetailMetaItem.mergedTooltip', { label: props.label, value })
})

const OptionalTooltip: FunctionalComponent<{ title?: string }> = ({ title }, { slots }) =>
  title ? h(resolveComponent('a-tooltip'), { title }, slots) : slots.default?.()[0]
OptionalTooltip.props = ['title']
</script>

<style scoped>
.detail-meta-item {
  display: inline-flex;
  align-items: flex-start;
  gap: var(--space-2);
  min-width: 0;
  max-width: 100%;
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
  line-height: 1.6;
}
.detail-meta-item__icon {
  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
  height: 1.6em;
  color: var(--jet-theme-text-tertiary);
}
.detail-meta-item__label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.detail-meta-item__value {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.detail-meta-item__value :deep(.ant-typography) {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  color: inherit;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  vertical-align: top;
}
/* 行内按钮去除边框与基线留白，和普通值使用相同的行高。 */
.detail-meta-item__value :deep(> .ant-btn-link),
.detail-meta-item__value :deep(> .ant-btn-text) {
  display: inline-flex;
  align-items: center;
  height: auto;
  padding: 0;
  border: 0;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  vertical-align: top;
}
.detail-meta-item__value :deep(> .ant-input-borderless) {
  padding: 0;
  border: 0;
  font-family: inherit;
  line-height: inherit;
  vertical-align: top;
}
/* 值和复制按钮分别收缩，避免长 ID 的省略区域遮住复制入口。 */
.detail-meta-item__value :deep(.ant-typography > span:first-child) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.detail-meta-item__value :deep(.ant-typography-copy) {
  flex: none;
}
.detail-meta-item--multiline {
  display: flex;
  align-items: flex-start;
  width: 100%;
}
.detail-meta-item--multiline .detail-meta-item__value {
  flex: 1;
  overflow: visible;
  white-space: normal;
  overflow-wrap: anywhere;
}
</style>
