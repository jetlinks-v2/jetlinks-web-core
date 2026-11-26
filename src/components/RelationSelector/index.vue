<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { Form } from 'ant-design-vue'
import { ArrowLeftOutlined, CheckOutlined, CloseCircleFilled, DownOutlined, EllipsisOutlined, RightOutlined, SearchOutlined, WarningOutlined } from '@ant-design/icons-vue'
import ObjectTypeIcon from '../IconValue/ObjectTypeIcon.vue'
import { relationSelectorMessages } from './messages'
import { useRelationSelector } from './useRelationSelector'
import type { RelationSelectorOptions, VariableObjectSpec } from './types'

const props = defineProps({
  value: { type: Object as PropType<VariableObjectSpec>, default: undefined },
  options: { type: Object as PropType<RelationSelectorOptions>, required: true },
  disabled: Boolean,
  readonly: Boolean,
})
const emit = defineEmits<{
  (event: 'update:value', value?: VariableObjectSpec): void
  (event: 'change', value?: VariableObjectSpec): void
}>()
const { t, locale } = useI18n({ useScope: 'local', messages: relationSelectorMessages })
const formItem = Form.useInjectFormItemContext()
const state = useRelationSelector(props, value => {
  emit('update:value', value)
  emit('change', value)
  formItem.onFieldChange()
}, locale)
const { open, loading, failed, displayFailed, invalid, searchOpen, keyword, originKey, origin, prefix, rows,
  labels, breadcrumbs, selectedKey, canContinue, canUseSelf, selfSelected, setOpen, navigate, changeOrigin, select,
  continueFromSaved, useSelf, clear, retry } = state
const popupId = `relation-selector-${getCurrentInstance()?.uid}`
const listRef = ref<HTMLElement>()
const searchRef = ref<{ focus(): void }>()
const scrollPositions = new Map<string, number>()
const summary = computed(() => labels.value.join(' › '))
const visibleCrumbs = computed(() => breadcrumbs.value.map((label, depth) => ({ label, depth }))
  .filter(item => breadcrumbs.value.length <= 4 || item.depth === 0 || item.depth >= breadcrumbs.value.length - 2))
const hiddenCrumbs = computed(() => breadcrumbs.value.map((label, depth) => ({ label, key: depth }))
  .slice(1, -2))

/** 搜索只在需要时展开，焦点保持在当前浮层内。 */
async function toggleSearch() {
  searchOpen.value = !searchOpen.value
  if (searchOpen.value) { await nextTick(); searchRef.value?.focus() }
  else keyword.value = ''
}
function onRight(event: KeyboardEvent) {
  const key = (event.target as HTMLElement).closest<HTMLElement>('[data-relation-key]')?.dataset.relationKey
  if (key && rows.value.find(row => row.key === key)?.more) { event.preventDefault(); select(key) }
}
// 导航保留每条已访问路径的滚动位置；异步读取后只聚焦菜单，不滚动画布或页面。
watch(() => breadcrumbs.value.join('\0'), async (next, previous) => {
  scrollPositions.set(previous, listRef.value?.scrollTop || 0)
  await nextTick()
  if (listRef.value) listRef.value.scrollTop = scrollPositions.get(next) || 0
})
watch(loading, async value => {
  if (value || !open.value || searchOpen.value) return
  await nextTick()
  listRef.value?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true })
})
watch(open, value => { if (!value) scrollPositions.clear() })
</script>

<template>
  <div class="relation-selector" :class="{ 'is-disabled': disabled, 'is-invalid': invalid }">
    <a-popover :open="open" trigger="click" placement="bottomLeft" :destroy-tooltip-on-hide="true" @open-change="setOpen">
      <template #content>
        <section :id="popupId" class="relation-selector__popup" :aria-label="t('placeholder')" @keydown.esc.stop="setOpen(false)">
          <a-select
            v-if="options.origins.length > 1" :value="originKey" :aria-label="t('chooseOrigin')"
            :options="options.origins.map(item => ({ value: item.key, label: item.label }))"
            class="relation-selector__origins" @change="(value: unknown) => changeOrigin(String(value))"
          />
          <div class="relation-selector__navigation">
            <a-button v-if="prefix.length" type="text" size="small" :title="t('back')" :aria-label="t('back')" @click="navigate(prefix.length - 1)">
              <ArrowLeftOutlined />
            </a-button>
            <nav class="relation-selector__crumbs" :aria-label="summary || t('placeholder')">
              <template v-for="(crumb, index) in visibleCrumbs" :key="crumb.depth">
                <span v-if="index" class="relation-selector__separator">/</span>
                <template v-if="index === 1 && breadcrumbs.length > 4">
                  <a-dropdown :trigger="['click']">
                    <a-button type="text" size="small" :title="t('morePath')" :aria-label="t('morePath')"><EllipsisOutlined /></a-button>
                    <template #overlay><a-menu :items="hiddenCrumbs" @click="(item: { key: string | number }) => navigate(Number(item.key))" /></template>
                  </a-dropdown>
                  <span class="relation-selector__separator">/</span>
                </template>
                <a-button v-if="crumb.depth < prefix.length" type="link" size="small" :title="crumb.label" @click="navigate(crumb.depth)">{{ crumb.label }}</a-button>
                <span v-else class="relation-selector__current" :title="crumb.label">{{ crumb.label }}</span>
              </template>
            </nav>
            <a-button type="text" size="small" :title="t('search')" :aria-label="t('search')" :aria-pressed="searchOpen" @click="toggleSearch"><SearchOutlined /></a-button>
          </div>
          <a-input v-if="searchOpen" ref="searchRef" v-model:value="keyword" allow-clear :placeholder="t('search')" class="relation-selector__search" />
          <div ref="listRef" class="relation-selector__list" :aria-busy="loading">
            <div v-if="loading" class="relation-selector__state"><a-spin size="small" /></div>
            <a-alert v-else-if="failed" type="warning" :message="t('failed')" show-icon>
              <template #action><a-button size="small" @click="retry">{{ t('retry') }}</a-button></template>
            </a-alert>
            <a-menu v-else :selected-keys="selectedKey ? [selectedKey] : []" @click="(item: { key: string | number }) => item.key === '$self' ? useSelf() : select(String(item.key))" @keydown.left.prevent="prefix.length && navigate(prefix.length - 1)" @keydown.right="onRight">
              <a-menu-item v-if="canUseSelf && !keyword" key="$self">
                <div class="relation-selector__option"><ObjectTypeIcon :type-id="origin?.root.objectType" /><span class="relation-selector__label">{{ t('self', { name: origin?.label }) }}</span><CheckOutlined v-if="selfSelected" /></div>
              </a-menu-item>
                <a-menu-item v-for="(row, index) in rows" :key="row.key" :data-relation-key="row.key" :class="{ 'relation-selector__section-start': index && row.more && !rows[index - 1].more }">
                  <div class="relation-selector__option">
                    <ObjectTypeIcon :type-id="row.info.targetType" />
                    <span class="relation-selector__label" :title="row.label">{{ row.label }}</span>
                    <span class="relation-selector__type">{{ row.typeLabel }}</span>
                    <span class="relation-selector__indicator"><RightOutlined v-if="row.more" /><CheckOutlined v-else-if="selectedKey === row.key" /></span>
                  </div>
                </a-menu-item>
            </a-menu>
            <a-empty v-if="!loading && !failed && !rows.length && !(canUseSelf && !keyword)" :description="t(keyword ? 'noMatch' : 'empty')" class="relation-selector__empty" />
          </div>
          <a-button v-if="canContinue && !loading && !failed" type="text" class="relation-selector__continue" @click="continueFromSaved">
            {{ t('continueFrom', { name: labels.at(-1) }) }} <RightOutlined />
          </a-button>
        </section>
      </template>
      <a-button class="relation-selector__trigger" :disabled="disabled || readonly || !options.origins.length" role="combobox" :aria-expanded="open" :aria-controls="popupId" aria-haspopup="menu" :title="summary" @keydown.down.prevent="setOpen(true)">
        <span class="relation-selector__summary" :class="{ 'is-placeholder': !value }">{{ summary || t(options.origins.length ? 'placeholder' : 'noOrigin') }}</span>
        <WarningOutlined v-if="invalid || displayFailed" :title="t(invalid ? 'invalid' : 'failed')" class="relation-selector__warning" />
        <DownOutlined class="relation-selector__down" />
      </a-button>
    </a-popover>
    <a-button v-if="value && !disabled && !readonly" type="text" size="small" class="relation-selector__clear" :title="t('clear')" :aria-label="t('clear')" @click.stop="clear"><CloseCircleFilled /></a-button>
  </div>
</template>

<style scoped>
.relation-selector { display: flex; align-items: center; min-width: 0; width: 100%; border: 1px solid var(--color-jet-border, #d9d9d9); border-radius: 6px; background: var(--color-jet-bg-container, #fff); transition: border-color .15s; }
.relation-selector:focus-within, .relation-selector:hover { border-color: var(--color-jet-primary, #1677ff); }
.relation-selector.is-disabled { background: var(--color-jet-bg-layout, #f5f5f5); }
.relation-selector.is-invalid { border-color: var(--color-jet-warning, #faad14); }
.relation-selector__trigger.ant-btn { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; height: 34px; padding: 0 11px; border: 0; background: transparent; box-shadow: none; text-align: left; color: inherit; }
.relation-selector__summary { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.relation-selector__summary.is-placeholder, .relation-selector__down, .relation-selector__clear { color: var(--color-jet-text-description, #8c8c8c); }
.relation-selector__down { font-size: 11px; }
.relation-selector__warning { color: var(--color-jet-warning, #faad14); }
.relation-selector__clear { flex: none; margin-right: 4px; }
.relation-selector__popup { width: min(336px, calc(100vw - 48px)); color: var(--color-jet-text, #262626); }
.relation-selector__origins { width: 100%; margin-bottom: 8px; }
.relation-selector__navigation, .relation-selector__crumbs { display: flex; align-items: center; gap: 4px; }
.relation-selector__navigation { padding-bottom: 8px; border-bottom: 1px solid var(--color-jet-border-secondary, #f0f0f0); }
.relation-selector__crumbs { flex: 1; min-width: 0; }
.relation-selector__crumbs .ant-btn { padding-inline: 2px; max-width: 96px; overflow: hidden; text-overflow: ellipsis; }
.relation-selector__separator, .relation-selector__type { color: var(--color-jet-text-description, #8c8c8c); font-size: 12px; }
.relation-selector__current { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 500; }
.relation-selector__search { margin-top: 8px; }
.relation-selector__list { min-height: 152px; max-height: 280px; overflow-y: auto; margin-top: 4px; }
.relation-selector__state { display: grid; place-items: center; min-height: 152px; }
.relation-selector__list :deep(.ant-menu) { border-inline-end: 0; background: transparent; }
.relation-selector__list :deep(.ant-menu-item) { height: 36px; line-height: 36px; margin: 2px 0; width: 100%; padding-inline: 8px !important; border-radius: 4px; }
.relation-selector__list :deep(.ant-menu-item.relation-selector__section-start) { margin-top: 8px; border-top: 1px solid var(--color-jet-border-secondary, #f0f0f0); border-radius: 0 0 4px 4px; }
.relation-selector__option { display: flex; align-items: center; gap: 10px; width: 100%; }
.relation-selector__option > .object-type-icon { color: var(--color-jet-text-secondary, #667085); }
.relation-selector__label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.relation-selector__type { flex: none; max-width: 80px; overflow: hidden; text-overflow: ellipsis; }
.relation-selector__indicator { display: inline-flex; justify-content: center; flex: none; width: 14px; font-size: 11px; }
.relation-selector__empty { margin: 20px 0; }
.relation-selector__continue.ant-btn { display: flex; justify-content: space-between; align-items: center; width: 100%; height: auto; min-height: 32px; margin-top: 4px; padding: 6px 8px; border-top: 1px solid var(--color-jet-border-secondary, #f0f0f0); color: var(--color-jet-text-secondary, #667085); font-size: 12px; white-space: normal; text-align: left; }
</style>
