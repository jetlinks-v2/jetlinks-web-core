<template>
  <div
    class="mp-card"
    :class="{ 'mp-card--picked': selectable && selected }"
    @click="$emit('click')"
  >
    <div v-if="selectable && selected" class="mp-card__pick" aria-hidden="true">
      <CheckOutlined />
    </div>
    <div class="mp-card__glow" />
    <div class="mp-card__head">
      <div class="mp-card__icon" aria-hidden="true">
        <IconValueView
          :value="record?.icon"
          :size="48"
          :border-radius="14"
          :fallback-text="record?.name || record?.code"
        />
      </div>
      <div class="mp-card__head-text">
        <div class="mp-card__title-row">
          <div class="mp-card__name-wrap">
            <j-ellipsis class="mp-card__title">{{ record.name || '--' }}</j-ellipsis>
          </div>
          <div class="mp-card__state mp-card__state--inline" aria-label="state">
            <span class="mp-card__dot" :class="enabled ? 'on' : 'off'" />
            <span>{{ stateLabel }}</span>
          </div>
          <span v-if="record.code" class="mp-card__code">{{ record.code }}</span>
        </div>
      </div>
    </div>
    <p v-if="descriptionText" class="mp-card__desc">{{ descriptionText }}</p>
    <div class="mp-card__tags">
      <span
        v-for="(t, i) in visibleTags"
        :key="t.id || i"
        class="mp-pill"
        :style="{ '--pill': tagPillColor(t, i) }"
      >
        {{ t.name }}
      </span>
      <a-popover
        v-if="extraTagCount > 0"
        trigger="click"
        placement="bottomLeft"
        :overlay-inner-style="{ padding: '8px', maxWidth: '320px' }"
        destroy-tooltip-on-hide
      >
        <template #content>
          <div class="mp-card__tags-popover">
            <span
              v-for="(t, i) in hiddenTags"
              :key="t.id || `extra-${i}`"
              class="mp-pill"
              :style="{ '--pill': tagPillColor(t, visibleTags.length + i) }"
            >
              {{ t.name }}
            </span>
          </div>
        </template>
        <span class="mp-pill mp-pill--more" @click.stop>+{{ extraTagCount }}</span>
      </a-popover>
    </div>
    <div v-if="showVersionSelect || $slots.actions" class="mp-card__footer">
      <div v-if="showVersionSelect" class="mp-card__footer-left" @click.stop>
        <div class="mp-card__version-line">
          <span class="mp-card__version-label">{{ versionLabel }}</span>
          <a-dropdown
            v-if="canOpenVersionDropdown"
            v-model:open="versionDropdownOpen"
            trigger="click"
            placement="bottomLeft"
          >
            <button
              type="button"
              class="mp-card__version-link"
              :title="currentVersionSummary || undefined"
              @click.stop
            >
              <span class="mp-card__version-link-text">{{ currentVersionText }}</span>
              <DownOutlined
                class="mp-card__version-link-caret"
                :class="{ 'mp-card__version-link-caret--open': versionDropdownOpen }"
              />
            </button>
            <template #overlay>
              <div class="mp-card__version-menu" @click.stop>
                <button
                  v-for="opt in versionOptions"
                  :key="opt.value"
                  type="button"
                  class="mp-card__version-option"
                  :class="{ 'mp-card__version-option--active': String(opt.value) === currentVersionValue }"
                  @click.stop="selectVersion(String(opt.value))"
                >
                  <span class="mp-card__version-option-main">
                    <span class="mp-card__version-option-label">{{ opt.label || opt.value }}</span>
                    <CheckOutlined v-if="String(opt.value) === currentVersionValue" class="mp-card__version-option-check" />
                  </span>
                  <span v-if="opt.summary" class="mp-card__version-option-summary">
                    {{ opt.summary }}
                  </span>
                </button>
              </div>
            </template>
          </a-dropdown>
          <span
            v-else
            class="mp-card__version-link"
            :class="{
              'mp-card__version-link--static': hasVersionOptions || hasDisplayedVersion,
              'mp-card__version-link--placeholder': !hasVersionOptions && !hasDisplayedVersion,
            }"
            :title="currentVersionSummary || undefined"
          >
            <span class="mp-card__version-link-text">
              {{ versionsLoading ? versionLoadingText : currentVersionText }}
            </span>
            <LoadingOutlined v-if="versionsLoading" spin class="mp-card__version-link-loading" />
          </span>
          <template v-if="currentVersionMeta?.releaseNotes">
            <span class="mp-card__version-divider">·</span>
            <a-button
              type="link"
              size="small"
              class="mp-card__version-notes-btn"
              @click.stop="releaseNotesDrawerOpen = true"
            >
              {{ viewReleaseNotes }}
            </a-button>
          </template>
        </div>
      </div>
      <div v-if="$slots.actions" class="mp-card__actions" @click.stop>
        <slot name="actions" :record="record" />
      </div>
    </div>
    <a-drawer
      v-if="showVersionSelect"
      v-model:open="releaseNotesDrawerOpen"
      :title="releaseNotesDrawerTitle"
      :width="560"
      placement="right"
      destroy-on-close
      :z-index="1100"
      @click.stop
    >
      <div class="mp-card__release-md" v-html="releaseNotesHtml" />
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { CheckOutlined, DownOutlined, LoadingOutlined } from '@ant-design/icons-vue'
import { computed, ref, watch } from 'vue'
import type { CapabilityVersionOption } from './types'
import { renderCapabilityMarkdown } from './markdownRender'
import { IconValueView } from '@jetlinks-web-core/components/IconValue'
import { parseTagColorFromIcon } from './tagIcon'

const props = withDefaults(
  defineProps<{
    record: any
    /** 是否展示选中态（资源选择场景） */
    selectable?: boolean
    selected?: boolean
    /** 启用/禁用文案，默认中英文由业务传入 labels */
    enabledLabel?: string
    disabledLabel?: string
    /** 选中且开启能力市场版本选择时，在底部页脚区（原时间 `--` 位置）展示 */
    showVersionSelect?: boolean
    version?: string | null
    versionOptions?: CapabilityVersionOption[]
    versionsLoading?: boolean
    versionLabel?: string
    versionPlaceholder?: string
    /** 查看发布说明 */
    viewReleaseNotes?: string
    /** 抽屉标题前缀 */
    releaseNotesTitle?: string
  }>(),
  {
    selectable: false,
    selected: false,
    showVersionSelect: false,
    versionOptions: () => [],
    versionsLoading: false,
    viewReleaseNotes: '查看发布说明',
    releaseNotesTitle: '发布说明',
  },
)

const emit = defineEmits<{
  click: []
  'update:version': [v: string | undefined]
}>()

const versionBinding = computed({
  get: () => (props.version == null || props.version === '' ? undefined : String(props.version)),
  set: (v: string | undefined) => emit('update:version', v),
})

const releaseNotesDrawerOpen = ref(false)
const versionDropdownOpen = ref(false)

const currentVersionMeta = computed<CapabilityVersionOption | null>(() => {
  const v = props.version == null || props.version === '' ? undefined : String(props.version)
  if (!v || !props.versionOptions?.length) return null
  return props.versionOptions.find((o) => o.value === v) ?? null
})

const currentVersionValue = computed(() => versionBinding.value)
const currentVersionSummary = computed(() => {
  const summary = currentVersionMeta.value?.summary
  return typeof summary === 'string' ? summary.trim() : ''
})
const hasVersionOptions = computed(() => (props.versionOptions?.length ?? 0) > 0)
const hasDisplayedVersion = computed(() => !!currentVersionMeta.value?.label || !!currentVersionValue.value)
const canOpenVersionDropdown = computed(() => (props.versionOptions?.length ?? 0) > 1 && !props.versionsLoading)
const currentVersionText = computed(() => {
  if (currentVersionMeta.value?.label) return currentVersionMeta.value.label
  if (currentVersionValue.value) return currentVersionValue.value
  return props.versionPlaceholder ?? '请选择版本'
})
const versionLoadingText = computed(() => {
  if (currentVersionValue.value) return currentVersionValue.value
  return props.versionPlaceholder ?? '请选择版本'
})

const releaseNotesHtml = computed(() => {
  const md = currentVersionMeta.value?.releaseNotes ?? ''
  return md ? renderCapabilityMarkdown(md) : ''
})

const releaseNotesDrawerTitle = computed(() => {
  const v = props.version == null || props.version === '' ? '' : String(props.version)
  const prefix = props.releaseNotesTitle ?? '发布说明'
  return v ? `${prefix} · ${v}` : prefix
})

watch(
  () => props.version,
  () => {
    releaseNotesDrawerOpen.value = false
    versionDropdownOpen.value = false
  },
)

const enabled = computed(() => {
  const st = props.record?.state
  const v = typeof st === 'object' ? st?.value : st
  return v === 'enabled'
})

const stateLabel = computed(() => {
  if (enabled.value) return props.enabledLabel ?? '启用'
  return props.disabledLabel ?? '禁用'
})

const descriptionText = computed(() => {
  const description = props.record?.description
  return typeof description === 'string' ? description.trim() : ''
})

const tags = computed<any[]>(() => {
  const t = props.record?.tags
  return Array.isArray(t) ? t : []
})

const visibleTags = computed(() => tags.value.slice(0, 3))
const hiddenTags = computed(() => tags.value.slice(3))
const extraTagCount = computed(() => Math.max(0, tags.value.length - 3))

const palette = ['#6366f1', '#0ea5e9', '#22c55e', '#f97316', '#a855f7', '#ec4899']
const tagPillColor = (tag: any, i: number) => parseTagColorFromIcon(tag?.icon) || palette[i % palette.length]

function selectVersion(v: string) {
  versionBinding.value = v
  versionDropdownOpen.value = false
}
</script>

<style scoped lang="less">
.mp-card {
  position: relative;
  border-radius: 12px;
  padding: 12px 14px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.92), rgba(248, 250, 252, 0.85));
  border: 1px solid rgba(15, 23, 42, 0.06);
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.05);
  cursor: pointer;
  overflow: hidden;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}
.mp-card--picked {
  border-color: rgba(22, 119, 255, 0.55);
  box-shadow: 0 10px 28px rgba(22, 119, 255, 0.18);
}
.mp-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgba(79, 70, 229, 0.1);
  border-color: rgba(99, 102, 241, 0.35);
}
.mp-card__pick {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #1677ff;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(22, 119, 255, 0.45);
  pointer-events: none;
}
.mp-card__glow {
  position: absolute;
  inset: -40% -20% auto auto;
  width: 220px;
  height: 220px;
  background: radial-gradient(circle at center, rgba(99, 102, 241, 0.35), transparent 70%);
  pointer-events: none;
  opacity: 0.6;
}
.mp-card__head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.mp-card__icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid rgba(99, 102, 241, 0.15);
}
.mp-card__head-text {
  flex: 1;
  min-width: 0;
}
.mp-card__title-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  align-items: center;
}
.mp-card__name-wrap {
  flex: 0 1 auto;
  min-width: 0;
  max-width: min(280px, calc(100% - 24px));
}
.mp-card__title {
  font-size: 16px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
}
.mp-card__code {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.06);
  color: rgba(0, 0, 0, 0.55);
  flex-shrink: 0;
}
.mp-card__state {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}
.mp-card__state--inline {
  flex-shrink: 0;
  margin-top: 0;
}
.mp-card__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.mp-card__dot.on {
  background: #22c55e;
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.15);
}
.mp-card__dot.off {
  background: #ef4444;
  box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.12);
}
.mp-card__desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: rgba(0, 0, 0, 0.55);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.mp-card__tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.mp-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 22px;
  box-sizing: border-box;
  font-size: 12px;
  line-height: 18px;
  padding: 2px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--pill, #6366f1) 12%, white);
  border: 1px solid color-mix(in srgb, var(--pill, #6366f1) 35%, white);
  color: #0f172a;
}
.mp-pill--more {
  background: rgba(15, 23, 42, 0.06);
  border-color: transparent;
  color: rgba(0, 0, 0, 0.45);
  cursor: pointer;
}
.mp-card__tags-popover {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  max-width: 304px;
}
.mp-card__version-label {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  line-height: 1.2;
  flex-shrink: 0;
}
.mp-card__version-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
  min-width: 0;
}
.mp-card__version-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: min(100%, 240px);
  padding: 0;
  border: none;
  background: transparent;
  color: #1677ff;
  cursor: pointer;
  font-size: 13px;
  line-height: 1.4;
}
.mp-card__version-link:hover {
  color: #0958d9;
}
.mp-card__version-link--static {
  color: rgba(0, 0, 0, 0.88);
  cursor: default;
}
.mp-card__version-link--placeholder {
  color: rgba(0, 0, 0, 0.45);
  cursor: default;
}
.mp-card__version-link-text {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mp-card__version-link-caret,
.mp-card__version-link-loading {
  flex-shrink: 0;
  font-size: 12px;
}
.mp-card__version-link-caret {
  transition: transform 0.15s ease;
}
.mp-card__version-link-caret--open {
  transform: rotate(180deg);
}
.mp-card__version-divider {
  color: rgba(0, 0, 0, 0.3);
}
.mp-card__version-notes-btn {
  padding: 0;
  height: auto;
  font-size: 12px;
}
.mp-card__version-menu {
  width: 280px;
  max-width: min(320px, calc(100vw - 32px));
  max-height: 280px;
  overflow: auto;
  padding: 6px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
}
.mp-card__version-option {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.mp-card__version-option:hover {
  border-color: rgba(22, 119, 255, 0.18);
  background: rgba(22, 119, 255, 0.05);
}
.mp-card__version-option--active {
  border-color: rgba(22, 119, 255, 0.32);
  background: rgba(22, 119, 255, 0.08);
}
.mp-card__version-option-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.mp-card__version-option-label {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  line-height: 1.4;
  color: rgba(0, 0, 0, 0.88);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mp-card__version-option-check {
  color: #1677ff;
  font-size: 13px;
}
.mp-card__version-option-summary {
  font-size: 12px;
  line-height: 1.45;
  color: rgba(0, 0, 0, 0.55);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.mp-card__release-md {
  font-size: 14px;
  line-height: 1.65;
  color: rgba(0, 0, 0, 0.88);
  word-break: break-word;
}
.mp-card__release-md :deep(h1),
.mp-card__release-md :deep(h2),
.mp-card__release-md :deep(h3) {
  margin: 0 0 10px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
}
.mp-card__release-md :deep(h1) {
  font-size: 18px;
}
.mp-card__release-md :deep(h2) {
  font-size: 16px;
}
.mp-card__release-md :deep(h3) {
  font-size: 15px;
}
.mp-card__release-md :deep(p) {
  margin: 0 0 10px;
}
.mp-card__release-md :deep(ul),
.mp-card__release-md :deep(ol) {
  margin: 0 0 10px;
  padding-left: 1.25em;
}
.mp-card__release-md :deep(li) {
  margin-bottom: 4px;
}
.mp-card__release-md :deep(code) {
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.06);
  font-size: 0.9em;
}
.mp-card__release-md :deep(pre) {
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.06);
  overflow: auto;
  margin: 0 0 10px;
}
.mp-card__release-md :deep(pre code) {
  padding: 0;
  background: none;
}
.mp-card__release-md :deep(blockquote) {
  margin: 0 0 10px;
  padding-left: 10px;
  border-left: 3px solid rgba(22, 119, 255, 0.35);
  color: rgba(0, 0, 0, 0.65);
}
.mp-card__footer {
  margin-top: 2px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding-top: 6px;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
}
.mp-card__footer-left {
  flex: 1;
  min-width: 0;
}
.mp-card__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}
</style>
