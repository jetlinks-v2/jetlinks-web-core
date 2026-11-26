<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { createReusableTemplate } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { ArrowLeftOutlined, CloseOutlined, LoadingOutlined } from '@ant-design/icons-vue'
import ObjectTypeIcon from '../IconValue/ObjectTypeIcon.vue'
import type { ObjectRelationChange, ObjectRelationContext } from '../../types/object-relation'
import type { AssetBindingDraft, AssetBindingPopupKind } from './types'
import AssetBindingActions from './AssetBindingActions.vue'
import { useAssetRelationEditor } from './useAssetRelationEditor'
const props = defineProps<{ context: ObjectRelationContext }>()
const emit = defineEmits<{ changed: [change?: ObjectRelationChange]; close: []; busy: [value: boolean] }>()
const { t } = useI18n()
const key = 'assetRelation.'
const editor = useAssetRelationEditor(() => props.context, {
  changed: (change) => emit('changed', change),
  close: () => emit('close'),
  busy: (value) => emit('busy', value)
})
const {
  settings,
  selector,
  selectorOptions,
  drafts,
  ids,
  labels,
  known,
  changes,
  dirty,
  loading,
  saving,
  error,
  select,
  save,
  retry
} = editor
const [DefineActions, BindingActions] = createReusableTemplate<{ row: AssetBindingDraft }>()
const inline = computed(() => !!selector.value?.component && selector.value.supportsOptionExtra === true)
const selectedOnly = ref(false)
const draftById = computed(() => new Map(drafts.value.map((row) => [row.id, row])))
const panel = ref<HTMLElement>(),
  returnFocus = ref<HTMLElement>()
const popup = ref<{ id: string; kind: AssetBindingPopupKind }>()
const getPopupContainer = (trigger: HTMLElement) => panel.value || trigger.ownerDocument.body
function popupChange(id: string, kind: AssetBindingPopupKind, open: boolean) {
  if (open) popup.value = { id, kind }
  else if (popup.value?.id === id && popup.value.kind === kind) popup.value = undefined
}
function targetAction(row: AssetBindingDraft, action: string | number) {
  popup.value = undefined
  if (action === 'undo') editor.undo(row)
  else if (action === 'copy') editor.applyPermissions(row)
  else if (action === 'remove') editor.remove(row)
  else if (action === 'deselect') select(ids.value.filter((id) => id !== row.id))
}
const pendingState = (row: AssetBindingDraft) =>
  row.removed
    ? 'pendingRemoved'
    : changes.value.added.includes(row)
      ? 'pendingAdded'
      : changes.value.updated.includes(row)
        ? 'pendingUpdated'
        : undefined
const changeSummary = computed(() =>
  t(key + 'changes', {
    added: changes.value.added.length,
    updated: changes.value.updated.length,
    removed: changes.value.removed.length
  })
)
const removeNames = computed(() => changes.value.removed.map((row) => labels.value.get(row.id) || row.id).join('、'))
function escape() {
  if (popup.value) {
    popup.value = undefined
    returnFocus.value?.focus()
  } else if (!saving.value) emit('close')
}
// 浮层只属于当前草稿；切换主体或开始读取/保存时清理，避免操作迟到的目标。
watch([() => props.context, loading, saving, selectedOnly], () => {
  popup.value = undefined
  returnFocus.value = undefined
})
watch(
  () => props.context,
  () => {
    selectedOnly.value = false
  }
)
</script>

<template>
  <DefineActions v-slot="{ row }">
    <AssetBindingActions
      :row="row"
      :presentation="{
        name: labels.get(row.id) || row.id,
        settings,
        compact: inline,
        pending: pendingState(row),
        disabled: loading || saving,
        canCopy: drafts.length > 1
      }"
      :popup="popup?.id === row.id ? popup.kind : undefined"
      :get-popup-container="getPopupContainer"
      @popup-change="(kind, open) => popupChange(row.id, kind, open)"
      @trigger="returnFocus = $event"
      @permissions="editor.setPermissions(row, $event)"
      @action="targetAction(row, $event)"
    />
  </DefineActions>
  <section
    ref="panel"
    class="asset-relation-editor"
    role="region"
    :aria-label="context.relation.name"
    @pointerdown.stop
    @wheel.stop
    @click.stop
    @keydown.esc.capture.stop.prevent="escape"
  >
    <header class="binding-heading">
      <a-avatar
        class="binding-avatar"
        shape="square"
        :size="28"
      >
        <template #icon>
          <ObjectTypeIcon
            :type-id="context.relation.targetType"
            :size="16"
          />
        </template>
      </a-avatar>
      <div class="binding-title">
        <strong>{{ context.relation.name }}</strong>
        <small>{{ context.subject.name }}</small>
      </div>
      <a-button
        type="text"
        size="small"
        :disabled="saving"
        :aria-label="t(key + 'close')"
        @click="emit('close')"
      >
        <CloseOutlined />
      </a-button>
    </header>
    <a-alert
      v-if="error"
      type="error"
      :message="error"
      show-icon
    >
      <template #action>
        <a-button
          size="small"
          @click="retry"
        >
          {{ t(key + 'retry') }}
        </a-button>
      </template>
    </a-alert>
    <a-spin :spinning="loading">
      <div
        class="asset-relation-content"
        :class="{ 'asset-relation-content--inline': inline }"
        :inert="saving || loading || undefined"
      >
        <template v-if="settings && selector">
          <div
            class="binding-selector"
            :class="{ 'binding-selector--inline': inline }"
          >
            <component
              :is="selector.component"
              v-if="selector.component"
              v-bind="selector.componentProps"
              :value="ids"
              :options="selectorOptions"
              :multiple="editor.multiple.value"
              embedded
              :selected-only="inline && selectedOnly"
              :review-values="editor.reviewIds.value"
              :focus-value="context.target"
              @update:value="select"
              @options-visible="editor.resolveTargets"
              @options-change="editor.updateOptions"
              @view-change="popup = undefined"
            >
              <template
                v-if="inline"
                #option-extra="{ option }"
              >
                <span
                  v-if="draftById.has(option.value)"
                  class="binding-inline-actions"
                  @pointerdown.stop
                  @click.stop
                  @keydown.stop
                >
                  <BindingActions :row="draftById.get(option.value)!" />
                </span>
                <LoadingOutlined
                  v-else-if="!known.has(option.value)"
                  :title="t(key + 'reading')"
                />
              </template>
            </component>
            <a-tree-select
              v-else
              :value="editor.multiple.value ? ids : ids[0]"
              :multiple="editor.multiple.value"
              :tree-data="selectorOptions"
              :field-names="{ value: 'value', label: 'label', children: 'children' }"
              show-search
              tree-node-filter-prop="label"
              :placeholder="t(key + 'choose')"
              @update:value="select(Array.isArray($event) ? $event : $event ? [$event] : [])"
            />
          </div>
          <section
            v-if="drafts.length && !inline"
            class="selected-bindings"
            :aria-label="t(key + 'targets')"
          >
            <h3>{{ t(key + 'targets') }}</h3>
            <div class="binding-targets">
              <div
                v-for="row in drafts"
                :key="row.id"
                class="binding-target"
              >
                <a-avatar
                  class="binding-avatar"
                  shape="square"
                  :size="28"
                >
                  <template #icon>
                    <ObjectTypeIcon
                      :type-id="context.relation.targetType"
                      :size="16"
                    />
                  </template>
                </a-avatar>
                <div class="target-copy">
                  <strong :title="labels.get(row.id) || row.id">{{ labels.get(row.id) || row.id }}</strong>
                </div>
                <BindingActions :row="row" />
              </div>
            </div>
          </section>
        </template>
      </div>
    </a-spin>
    <footer>
      <a-button
        v-if="inline"
        type="text"
        size="small"
        :aria-pressed="selectedOnly"
        :disabled="loading || saving || (!context.reverse && !drafts.length && !selectedOnly)"
        @click="selectedOnly = !selectedOnly"
      >
        <ArrowLeftOutlined v-if="selectedOnly" />
        {{
          selectedOnly
            ? t(key + 'backToAll')
            : context.reverse
              ? t(key + 'associatedObjects')
              : t(key + 'selected', { count: ids.length })
        }}
      </a-button>
      <span v-else>{{ t(key + 'selected', { count: ids.length }) }}</span>
      <small
        v-if="dirty"
        class="binding-changes"
        :title="changeSummary"
      >
        {{ changeSummary }}
      </small>
      <a-popconfirm
        :title="t(key + 'removeTargetsConfirm', { names: removeNames })"
        :disabled="!changes.removed.length"
        :get-popup-container="getPopupContainer"
        @confirm="save()"
      >
        <a-button
          type="primary"
          :loading="saving"
          :disabled="loading || !!error || !dirty"
          @click="!changes.removed.length && save()"
        >
          {{ t(key + 'save') }}
        </a-button>
      </a-popconfirm>
    </footer>
  </section>
</template>

<style scoped src="./index.css" />
