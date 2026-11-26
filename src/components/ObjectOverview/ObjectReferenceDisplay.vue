<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowRightOutlined } from '@ant-design/icons-vue'
import ObjectTypeIcon from '../IconValue/ObjectTypeIcon.vue'
import { objectOverviewMessages } from './messages'
import type { ObjectReference, ObjectReferenceValue } from '../../object-capability/types'

// Presentation only: the host owns navigation and the source owns target access.
const props = defineProps<{ value: ObjectReferenceValue; disabled?: boolean }>()
defineEmits<{ open: [object: ObjectReference] }>()
const { t } = useI18n({ useScope: 'local', messages: objectOverviewMessages })
const visible = computed(() => props.value.items.slice(0, 3))
const remaining = computed(() => props.value.items.slice(3))
</script>
<template>
  <div class="object-references">
    <span
      v-if="!value.items.length"
      class="object-references__muted"
    >
      {{ t('unknown') }}
    </span>
    <a-tooltip
      v-for="item in visible"
      :key="`${item.type}:${item.id}`"
      :title="item.unavailable ? t('referenceUnavailable', { id: item.id }) : item.id"
    >
      <a-button
        type="link"
        class="object-references__item"
        :disabled="disabled || item.unavailable"
        @click="$emit('open', item)"
      >
        <ObjectTypeIcon :type-id="item.type" />
        <span class="object-references__name">{{ item.name || item.id }}</span>
        <ArrowRightOutlined
          v-if="!disabled && !item.unavailable"
          class="object-references__arrow"
        />
      </a-button>
    </a-tooltip>
    <a-popover
      v-if="remaining.length"
      trigger="click"
      placement="bottomLeft"
    >
      <a-button
        type="link"
        size="small"
        class="object-references__more"
      >
        {{ t('referenceMore', { count: remaining.length }) }}
      </a-button>
      <template #content>
        <div class="object-references__list">
          <a-tooltip
            v-for="item in remaining"
            :key="`${item.type}:${item.id}`"
            :title="item.unavailable ? t('referenceUnavailable', { id: item.id }) : item.id"
          >
            <a-button
              type="link"
              class="object-references__item"
              :disabled="disabled || item.unavailable"
              @click="$emit('open', item)"
            >
              <ObjectTypeIcon :type-id="item.type" />
              <span class="object-references__name">{{ item.name || item.id }}</span>
              <ArrowRightOutlined
                v-if="!disabled && !item.unavailable"
                class="object-references__arrow"
              />
            </a-button>
          </a-tooltip>
        </div>
      </template>
    </a-popover>
    <small
      v-if="value.limited"
      class="object-references__muted"
    >
      {{ t('limited') }}
    </small>
  </div>
</template>
<style scoped>
.object-references,
.object-references__list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  min-width: 0;
}
.object-references__list {
  flex-direction: column;
  align-items: stretch;
  max-width: min(320px, 75vw);
  max-height: 280px;
  overflow: auto;
}
.object-references__item.ant-btn {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  padding: 0;
  height: 28px;
  max-width: 100%;
  text-align: start;
}
.object-references__item.ant-btn > span + span {
  margin-inline-start: 0;
}
.object-references__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.object-references__arrow {
  flex: none;
  font-size: 12px;
  color: var(--ant-color-text-tertiary);
}
.object-references__more.ant-btn {
  padding: 0;
  height: 28px;
  font-size: 12px;
}
.object-references__muted {
  color: var(--ant-color-text-tertiary);
  overflow-wrap: anywhere;
}
</style>
