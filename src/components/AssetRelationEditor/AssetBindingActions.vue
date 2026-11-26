<script setup lang="ts">
import { computed, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  CloseOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  EllipsisOutlined,
  EyeOutlined,
  KeyOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  ShareAltOutlined,
  UndoOutlined
} from '@ant-design/icons-vue'
import type { AssetBindingDraft, AssetBindingPopupKind, AssetBindingSettings } from './types'
import { assetBindingPermissions } from './permissions'

const props = defineProps<{
  row: AssetBindingDraft
  presentation: {
    name: string
    settings?: AssetBindingSettings
    compact?: boolean
    pending?: 'pendingAdded' | 'pendingUpdated' | 'pendingRemoved'
    disabled: boolean
    canCopy: boolean
  }
  popup?: AssetBindingPopupKind
  getPopupContainer: (trigger: HTMLElement) => HTMLElement
}>()
const emit = defineEmits<{
  'popup-change': [kind: AssetBindingPopupKind, open: boolean]
  trigger: [element: HTMLElement]
  permissions: [ids: string[]]
  action: [action: 'copy' | 'remove' | 'deselect' | 'undo']
}>()
const { t } = useI18n()
const key = 'assetRelation.'
const requiredPermissions = computed(() => assetBindingPermissions(props.presentation.settings))
// 摘要与菜单共用装饰图标；自定义权限仍以来源名称为准，不推导授权语义。
const permissionIcons = new Map<string, Component>([
  ['read', EyeOutlined],
  ['save', EditOutlined],
  ['delete', DeleteOutlined],
  ['share', ShareAltOutlined]
])
const selectedPermissions = computed(() => {
  const labels = new Map(props.presentation.settings?.permissions.map((item) => [item.id, item.name]))
  return props.row.permissions.map((id) => ({
    id,
    name: labels.get(id) || id,
    icon: permissionIcons.get(id) || KeyOutlined
  }))
})
const summary = computed(
  () => selectedPermissions.value.map((item) => item.name).join(' · ') || t(key + 'noPermissions')
)
</script>

<template>
  <span
    class="binding-actions"
    :class="{ 'binding-actions--compact': presentation.compact }"
  >
    <span
      v-if="row.original?.relation === 'owner'"
      class="owner"
      :title="t(key + 'owner')"
      :aria-label="t(key + 'owner')"
    >
      <LockOutlined />
    </span>
    <a-popover
      v-else-if="presentation.settings?.permissionSupported && !row.removed"
      :open="popup === 'permissions'"
      trigger="click"
      placement="topRight"
      :get-popup-container="getPopupContainer"
      @open-change="emit('popup-change', 'permissions', $event)"
    >
      <template #content>
        <div
          class="target-permissions"
          :aria-label="t(key + 'permissionsFor', { name: presentation.name })"
        >
          <div class="permission-heading">
            <SafetyCertificateOutlined aria-hidden="true" />
            <strong :title="presentation.name">{{ presentation.name }}</strong>
          </div>
          <a-checkbox-group
            :value="row.permissions"
            :disabled="presentation.disabled"
            @update:value="emit('permissions', $event as string[])"
          >
            <a-checkbox
              v-for="permission in presentation.settings?.permissions"
              :key="permission.id"
              :value="permission.id"
              :disabled="
                requiredPermissions.includes(permission.id) &&
                (!row.original || row.permissions.includes(permission.id))
              "
              class="permission-option"
              :class="{ 'permission-option--checked': row.permissions.includes(permission.id) }"
            >
              <span class="permission-option-label">
                <component
                  :is="permissionIcons.get(permission.id) || KeyOutlined"
                  aria-hidden="true"
                />
                <span>{{ permission.name }}</span>
              </span>
            </a-checkbox>
          </a-checkbox-group>
          <p class="permission-hint">{{ t(key + 'permissionHint') }}</p>
        </div>
      </template>
      <a-button
        class="permission-summary"
        type="text"
        size="small"
        :disabled="presentation.disabled"
        :title="summary"
        :aria-label="t(key + 'permissionsFor', { name: presentation.name })"
        :aria-expanded="popup === 'permissions'"
        @click="emit('trigger', $event.currentTarget as HTMLElement)"
      >
        <span class="permission-summary-label">
          <span
            v-for="permission in presentation.compact ? selectedPermissions.slice(0, 2) : selectedPermissions"
            :key="permission.id"
            class="permission-summary-item"
          >
            <component
              :is="permission.icon"
              aria-hidden="true"
            />
            <span v-if="!presentation.compact">{{ permission.name }}</span>
          </span>
          <small
            v-if="presentation.compact && selectedPermissions.length > 2"
            class="permission-summary-more"
          >
            +{{ selectedPermissions.length - 2 }}
          </small>
          <template v-if="!selectedPermissions.length">
            <KeyOutlined
              v-if="presentation.compact"
              aria-hidden="true"
            />
            <template v-else>{{ summary }}</template>
          </template>
        </span>
        <DownOutlined />
      </a-button>
    </a-popover>
    <small
      v-if="
        presentation.pending && (!presentation.compact || row.removed || !presentation.settings?.permissionSupported)
      "
      class="binding-role"
      :title="t(key + presentation.pending)"
    >
      {{ t(key + presentation.pending) }}
    </small>
    <a-button
      v-if="presentation.pending"
      type="text"
      size="small"
      class="binding-undo"
      :title="t(key + presentation.pending) + ' · ' + t(key + 'undo')"
      :aria-label="t(key + 'undo')"
      :disabled="presentation.disabled"
      @click="emit('action', 'undo')"
    >
      <UndoOutlined />
    </a-button>
    <a-dropdown
      v-if="row.original?.relation !== 'owner' && !row.removed"
      :open="popup === 'actions'"
      :trigger="['click']"
      placement="topRight"
      :get-popup-container="getPopupContainer"
      @open-change="emit('popup-change', 'actions', $event)"
    >
      <template #overlay>
        <a-menu :selectable="false">
          <a-menu-item
            v-if="presentation.settings?.permissionSupported && presentation.canCopy"
            key="copy"
            @click="emit('action', 'copy')"
          >
            <CopyOutlined />
            {{ t(key + 'applyToAll') }}
          </a-menu-item>
          <a-menu-item
            v-if="row.original"
            key="remove"
            danger
            @click="emit('action', 'remove')"
          >
            <DeleteOutlined />
            {{ t(key + 'remove') }}
          </a-menu-item>
          <a-menu-item
            v-else
            key="deselect"
            @click="emit('action', 'deselect')"
          >
            <CloseOutlined />
            {{ t(key + 'deselect') }}
          </a-menu-item>
        </a-menu>
      </template>
      <a-button
        class="target-actions"
        type="text"
        size="small"
        :disabled="presentation.disabled"
        :aria-label="t(key + 'moreFor', { name: presentation.name })"
        :aria-expanded="popup === 'actions'"
        aria-haspopup="menu"
        @click="emit('trigger', $event.currentTarget as HTMLElement)"
      >
        <EllipsisOutlined />
      </a-button>
    </a-dropdown>
    <span
      v-else
      class="target-actions-placeholder"
      aria-hidden="true"
    />
  </span>
</template>

<style scoped src="./AssetBindingActions.css" />
