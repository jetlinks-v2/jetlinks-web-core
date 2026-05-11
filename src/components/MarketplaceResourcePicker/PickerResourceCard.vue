<template>
  <div
    class="mp-card"
    :class="{ 'mp-card--picked': selectable && selected }"
    @click="$emit('click')"
  >
    <div
      v-if="selectable && selected"
      class="mp-card__pick"
      aria-hidden="true"
    >
      <CheckOutlined />
    </div>
    <div class="mp-card__glow" />
    <div class="mp-card__head">
      <div
        class="mp-card__icon"
        aria-hidden="true"
      >
        <IconValueView
          :value="record?.icon"
          :size="48"
          :border-radius="14"
          :fallback-text="record?.name || record?.code"
        />
      </div>
      <div
        class="mp-card__head-text"
        :class="{ 'mp-card__head-text--selectable': selectable }"
      >
        <div class="mp-card__title-row">
          <div class="mp-card__name-wrap">
            <button
              v-if="documentText"
              type="button"
              class="mp-card__title-link"
              :title="record.name || viewDocumentText"
              @click.stop="openDocumentDrawer"
            >
              <j-ellipsis class="mp-card__title mp-card__title--link">{{ record.name || '--' }}</j-ellipsis>
              <span class="mp-card__title-link-affordance">
                <FileTextOutlined />
                <span>{{ viewDocumentText }}</span>
              </span>
            </button>
            <j-ellipsis
              v-else
              class="mp-card__title"
            >
              {{ record.name || '--' }}
            </j-ellipsis>
          </div>
          <span
            v-if="record.code"
            class="mp-card__code"
          >
            {{ record.code }}
          </span>
        </div>
        <div class="mp-card__state-row">
          <div
            class="mp-card__state"
            :aria-label="$t('components.MarketplaceResourcePicker.stateLabel')"
          >
            <span
              class="mp-card__dot"
              :class="enabled ? 'on' : 'off'"
            />
            <span>{{ stateLabel }}</span>
          </div>
        </div>
      </div>
    </div>
    <p
      v-if="descriptionText"
      class="mp-card__desc"
    >
      {{ descriptionText }}
    </p>
    <div class="mp-card__tags">
      <span
        v-for="(t, i) in visibleTags"
        :key="t.id || i"
        class="mp-pill"
        :title="t.name"
      >
        <IconValueView
          v-if="t.icon"
          class="mp-pill__icon"
          :value="t.icon"
          :size="16"
          :border-radius="4"
          :fallback-text="t.name"
        />
        <span class="mp-pill__text">{{ t.name }}</span>
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
              :title="t.name"
            >
              <IconValueView
                v-if="t.icon"
                class="mp-pill__icon"
                :value="t.icon"
                :size="16"
                :border-radius="4"
                :fallback-text="t.name"
              />
              <span class="mp-pill__text">{{ t.name }}</span>
            </span>
          </div>
        </template>
        <span
          class="mp-pill mp-pill--more"
          @click.stop
        >
          +{{ extraTagCount }}
        </span>
      </a-popover>
    </div>
    <div
      v-if="showVersionSelect || $slots.actions"
      class="mp-card__footer"
    >
      <div
        v-if="showVersionSelect"
        class="mp-card__footer-left"
        @click.stop
      >
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
              <div
                class="mp-card__version-menu"
                @click.stop
              >
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
                    <CheckOutlined
                      v-if="String(opt.value) === currentVersionValue"
                      class="mp-card__version-option-check"
                    />
                  </span>
                  <span
                    v-if="opt.summary"
                    class="mp-card__version-option-summary"
                  >
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
              'mp-card__version-link--placeholder': !hasVersionOptions && !hasDisplayedVersion
            }"
            :title="currentVersionSummary || undefined"
          >
            <span class="mp-card__version-link-text">
              {{ versionsLoading ? versionLoadingText : currentVersionText }}
            </span>
            <LoadingOutlined
              v-if="versionsLoading"
              spin
              class="mp-card__version-link-loading"
            />
          </span>
          <a-popover
            v-if="currentVersionSummary"
            trigger="hover"
            placement="topLeft"
            :overlay-inner-style="{ maxWidth: '320px' }"
          >
            <template #content>
              <div class="mp-card__version-summary-popover">
                <div class="mp-card__version-summary-popover-title">{{ versionSummaryLabelText }}</div>
                <div class="mp-card__version-summary-popover-text">{{ currentVersionSummary }}</div>
              </div>
            </template>
            <span
              class="mp-card__version-summary-chip"
              @click.stop
            >
              <InfoCircleOutlined />
              <span class="mp-card__version-summary-chip-text">{{ currentVersionSummary }}</span>
            </span>
          </a-popover>
          <template v-if="currentVersionMeta?.releaseNotes">
            <span class="mp-card__version-divider">·</span>
            <a-button
              type="link"
              size="small"
              class="mp-card__version-notes-btn"
              @click.stop="releaseNotesDrawerOpen = true"
            >
              {{ viewReleaseNotesText }}
            </a-button>
          </template>
        </div>
      </div>
      <div
        v-if="$slots.actions"
        class="mp-card__actions"
        @click.stop
      >
        <slot
          name="actions"
          :record="record"
        />
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
      <div
        class="mp-card__release-md"
        v-html="releaseNotesHtml"
      />
    </a-drawer>
    <a-drawer
      v-if="documentText"
      v-model:open="documentDrawerOpen"
      :title="documentDrawerTitle"
      :width="640"
      placement="right"
      destroy-on-close
      :z-index="1100"
      @click.stop
    >
      <div
        class="mp-card__release-md"
        v-html="documentHtml"
      />
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import {
  CheckOutlined,
  DownOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  LoadingOutlined
} from '@ant-design/icons-vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CapabilityVersionOption } from './types'
import { renderCapabilityMarkdown } from './markdownRender'
import { IconValueView } from '@jetlinks-web-core/components/IconValue'

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
    /** 资源文档入口 */
    viewDocument?: string
    /** 资源文档标题前缀 */
    resourceDocumentTitle?: string
    /** 当前版本摘要标题 */
    versionSummaryLabel?: string
  }>(),
  {
    selectable: false,
    selected: false,
    showVersionSelect: false,
    versionOptions: () => [],
    versionsLoading: false
  }
)

const { t: $t } = useI18n()

const emit = defineEmits<{
  click: []
  'update:version': [v: string | undefined]
}>()

const versionBinding = computed({
  get: () => (props.version == null || props.version === '' ? undefined : String(props.version)),
  set: (v: string | undefined) => emit('update:version', v)
})

const releaseNotesDrawerOpen = ref(false)
const documentDrawerOpen = ref(false)
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
const versionPlaceholderText = computed(
  () => props.versionPlaceholder ?? $t('components.MarketplaceResourcePicker.versionPlaceholder')
)
const viewReleaseNotesText = computed(
  () => props.viewReleaseNotes ?? $t('components.MarketplaceResourcePicker.viewReleaseNotes')
)
const viewDocumentText = computed(() => props.viewDocument ?? $t('components.MarketplaceResourcePicker.viewDocument'))
const releaseNotesTitleText = computed(
  () => props.releaseNotesTitle ?? $t('components.MarketplaceResourcePicker.releaseNotesTitle')
)
const resourceDocumentTitleText = computed(
  () => props.resourceDocumentTitle ?? $t('components.MarketplaceResourcePicker.resourceDocumentTitle')
)
const versionSummaryLabelText = computed(
  () => props.versionSummaryLabel ?? $t('components.MarketplaceResourcePicker.versionSummary')
)
const currentVersionText = computed(() => {
  if (currentVersionMeta.value?.label) return currentVersionMeta.value.label
  if (currentVersionValue.value) return currentVersionValue.value
  return versionPlaceholderText.value
})
const versionLoadingText = computed(() => {
  if (currentVersionValue.value) return currentVersionValue.value
  return versionPlaceholderText.value
})

const releaseNotesHtml = computed(() => {
  const md = currentVersionMeta.value?.releaseNotes ?? ''
  return md ? renderCapabilityMarkdown(md) : ''
})

function optionalText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()
}

const documentText = computed(() =>
  optionalText(
    props.record?.document ??
      props.record?.info?.document ??
      props.record?.metadata?.document ??
      props.record?.metadata?.info?.document ??
      props.record?.capabilityPackage?.info?.document ??
      props.record?.packageInfo?.document
  )
)

const documentHtml = computed(() => (documentText.value ? renderCapabilityMarkdown(documentText.value) : ''))

const releaseNotesDrawerTitle = computed(() => {
  const v = props.version == null || props.version === '' ? '' : String(props.version)
  const prefix = releaseNotesTitleText.value
  return v ? `${prefix} · ${v}` : prefix
})

const documentDrawerTitle = computed(() => {
  const name = optionalText(props.record?.name ?? props.record?.code)
  const prefix = resourceDocumentTitleText.value
  return name ? `${prefix} · ${name}` : prefix
})

watch(
  () => props.version,
  () => {
    releaseNotesDrawerOpen.value = false
    versionDropdownOpen.value = false
  }
)

const enabled = computed(() => {
  const st = props.record?.state
  const v = typeof st === 'object' ? st?.value : st
  return v === 'enabled'
})

const stateLabel = computed(() => {
  if (enabled.value) return props.enabledLabel ?? $t('components.MarketplaceResourcePicker.enabled')
  return props.disabledLabel ?? $t('components.MarketplaceResourcePicker.disabled')
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

function openDocumentDrawer() {
  if (!documentText.value) return
  documentDrawerOpen.value = true
}

function selectVersion(v: string) {
  versionBinding.value = v
  versionDropdownOpen.value = false
}
</script>

<style scoped>
.mp-card {
  position: relative;
  border-radius: 12px;
  padding: 12px 14px;
  background: linear-gradient(145deg, color-mix(in srgb, var(--bg) 92%, transparent), color-mix(in srgb, var(--bg) 85%, transparent));
  border: 1px solid color-mix(in srgb, var(--ink-2) 6%, transparent);
  box-shadow: var(--shadow-1);
  cursor: pointer;
  overflow: hidden;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease;
}
.mp-card--picked {
  border-color: color-mix(in srgb, var(--accent) 55%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--bg) 96%, transparent) inset,
    0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent),
    0 10px 28px color-mix(in srgb, var(--accent) 16%, transparent);
  background: linear-gradient(145deg, color-mix(in srgb, var(--bg) 98%, transparent), color-mix(in srgb, var(--bg-hover) 92%, transparent));
}
.mp-card:not(.mp-card--picked):hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-1);
  border-color: color-mix(in srgb, var(--accent) 35%, transparent);
}
.mp-card--picked:hover {
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--bg) 98%, transparent) inset,
    0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent),
    0 12px 30px color-mix(in srgb, var(--accent) 18%, transparent);
  border-color: color-mix(in srgb, var(--accent) 72%, transparent);
}
.mp-card__pick {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--accent-ink);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-14);
  box-shadow: var(--shadow-1);
  pointer-events: none;
}
.mp-card__glow {
  position: absolute;
  inset: -40% -20% auto auto;
  width: 220px;
  height: 220px;
  background: radial-gradient(circle at center, color-mix(in srgb, var(--accent) 35%, transparent), transparent 70%);
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
  border: 1px solid color-mix(in srgb, var(--accent) 15%, transparent);
}
.mp-card__head-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.mp-card__head-text--selectable {
  padding-right: 34px;
}
.mp-card__title-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
}
.mp-card__name-wrap {
  flex: 1;
  min-width: 0;
}
.mp-card__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--ink-1);
}
.mp-card__title-link {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  max-width: 100%;
  padding: 0;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.mp-card__title-link :deep(.j-ellipsis) {
  flex: 1;
  min-width: 0;
}
.mp-card__title--link {
  color: var(--accent);
  transition: color 0.15s ease;
}
.mp-card__title-link:hover .mp-card__title--link {
  color: var(--jet-theme-primary-active);
  text-decoration: underline;
}
.mp-card__title-link-affordance {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  color: var(--jet-theme-primary-active);
  font-size: var(--fs-12);
  line-height: 18px;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}
.mp-card__title-link:hover .mp-card__title-link-affordance {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent);
}
.mp-card__code {
  font-size: var(--fs-12);
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ink-2) 6%, transparent);
  color: var(--ink-3);
  flex-shrink: 0;
}
.mp-card__state-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.mp-card__state {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-12);
  color: var(--ink-4);
}
.mp-card__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.mp-card__dot.on {
  background: var(--ok);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--ok) 15%, transparent);
}
.mp-card__dot.off {
  background: var(--err);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--err) 12%, transparent);
}
.mp-card__desc {
  margin: 0;
  font-size: var(--fs-13);
  line-height: 1.45;
  color: var(--ink-3);
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
  gap: 6px;
  min-height: 22px;
  max-width: 180px;
  box-sizing: border-box;
  font-size: var(--fs-12);
  line-height: 18px;
  padding: 2px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ink-2) 4%, transparent);
  border: 1px solid color-mix(in srgb, var(--ink-2) 8%, transparent);
  color: var(--ink-1);
}
.mp-pill__icon {
  flex-shrink: 0;
}
.mp-pill__text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mp-pill--more {
  background: color-mix(in srgb, var(--ink-2) 6%, transparent);
  border-color: transparent;
  color: var(--ink-4);
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
  font-size: var(--fs-12);
  color: var(--ink-4);
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
  color: var(--accent);
  cursor: pointer;
  font-size: var(--fs-13);
  line-height: 1.4;
}
.mp-card__version-link:hover {
  color: var(--jet-theme-primary-active);
}
.mp-card__version-link--static {
  color: var(--ink-1);
  cursor: default;
}
.mp-card__version-link--placeholder {
  color: var(--ink-4);
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
  font-size: var(--fs-12);
}
.mp-card__version-link-caret {
  transition: transform 0.15s ease;
}
.mp-card__version-link-caret--open {
  transform: rotate(180deg);
}
.mp-card__version-divider {
  color: var(--ink-4);
}
.mp-card__version-notes-btn {
  padding: 0;
  height: auto;
  font-size: var(--fs-12);
}
.mp-card__version-summary-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: min(42%, 180px);
  padding: 1px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--jet-theme-primary-active);
  cursor: help;
  font-size: var(--fs-12);
  line-height: 18px;
}
.mp-card__version-summary-chip-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mp-card__version-summary-popover {
  max-width: 300px;
}
.mp-card__version-summary-popover-title {
  margin-bottom: 4px;
  color: var(--ink-1);
  font-size: var(--fs-13);
  line-height: 1.4;
  font-weight: 600;
}
.mp-card__version-summary-popover-text {
  color: var(--ink-2);
  font-size: var(--fs-12);
  line-height: 1.6;
  word-break: break-word;
}
.mp-card__version-menu {
  width: 340px;
  max-width: min(420px, calc(100vw - 32px));
  max-height: 280px;
  overflow: auto;
  padding: 6px;
  border-radius: 12px;
  background: var(--bg);
  box-shadow: var(--shadow-1);
}
.mp-card__version-option {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: var(--r-3);
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}
.mp-card__version-option:hover {
  border-color: color-mix(in srgb, var(--accent) 18%, transparent);
  background: color-mix(in srgb, var(--accent) 5%, transparent);
}
.mp-card__version-option--active {
  border-color: color-mix(in srgb, var(--accent) 32%, transparent);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
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
  font-size: var(--fs-13);
  line-height: 1.4;
  color: var(--ink-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mp-card__version-option-check {
  color: var(--accent);
  font-size: var(--fs-13);
}
.mp-card__version-option-summary {
  font-size: var(--fs-12);
  line-height: 1.45;
  color: var(--ink-3);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.mp-card__release-md {
  font-size: var(--fs-14);
  line-height: 1.65;
  color: var(--ink-1);
  word-break: break-word;
}
.mp-card__release-md :deep(h1),
.mp-card__release-md :deep(h2),
.mp-card__release-md :deep(h3) {
  margin: 0 0 10px;
  font-weight: 600;
  color: var(--ink-1);
}
.mp-card__release-md :deep(h1) {
  font-size: 18px;
}
.mp-card__release-md :deep(h2) {
  font-size: 16px;
}
.mp-card__release-md :deep(h3) {
  font-size: var(--fs-15);
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
  border-radius: var(--r-1);
  background: color-mix(in srgb, var(--ink-2) 6%, transparent);
  font-size: 0.9em;
}
.mp-card__release-md :deep(pre) {
  padding: 10px 12px;
  border-radius: var(--r-3);
  background: color-mix(in srgb, var(--ink-2) 6%, transparent);
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
  border-left: 3px solid color-mix(in srgb, var(--accent) 35%, transparent);
  color: var(--ink-2);
}
.mp-card__footer {
  margin-top: 2px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding-top: 6px;
  border-top: 1px solid color-mix(in srgb, var(--ink-2) 6%, transparent);
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
