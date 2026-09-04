<template>
  <CardShell
    :active="active"
    :disabled="disabled"
    :bordered="bordered"
    :background-opacity="backgroundOpacity"
    :aria-label="data.title"
    @click="handleClick"
  >
    <article class="card-status">
      <header class="card-status__header">
        <slot name="avatar" :data="data">
          <CardAvatar v-if="data.avatar" :avatar="data.avatar" />
        </slot>
        <slot name="status" :data="data">
          <StatusTag
            v-if="data.status"
            :status="data.status.tone ?? 'default'"
            :text="data.status.text"
            :bordered="false"
          />
        </slot>
      </header>

      <h3 class="card-status__title">
        <slot name="title" :data="data">{{ data.title }}</slot>
      </h3>
      <p v-if="$slots.description || data.description" class="card-status__description">
        <slot name="description" :data="data">{{ data.description }}</slot>
      </p>

      <footer v-if="$slots.footer || data.footer?.length" class="card-status__footer">
        <slot name="footer" :data="data">
          <span
            v-for="(item, index) in data.footer"
            :key="item.key ?? index"
            class="card-status__footer-item"
          >
            <AIcon v-if="item.icon" :type="item.icon" />
            <span v-if="item.label">{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </span>
        </slot>
      </footer>
    </article>
  </CardShell>
</template>

<script setup lang="ts" name="CardStatus">
import type { PropType } from 'vue'
import StatusTag from '../StatusTag/index.vue'
import { cardAppearanceProps } from './appearance'
import CardAvatar from './CardAvatar.vue'
import CardShell from './CardShell.vue'
import type { CardStatusData } from './types'

const props = defineProps({
  ...cardAppearanceProps,
  data: {
    type: Object as PropType<CardStatusData>,
    required: true,
  },
  active: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits<{
  (event: 'click', data: CardStatusData, nativeEvent: MouseEvent | KeyboardEvent): void
}>()

const handleClick = (event: MouseEvent | KeyboardEvent) => {
  emit('click', props.data, event)
}
</script>

<style scoped>
.card-status {
  display: flex;
  box-sizing: border-box;
  height: 100%;
  flex-direction: column;
  padding: var(--space-5);
}

.card-status__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.card-status__title {
  margin: var(--space-4) 0 0;
  overflow: hidden;
  color: var(--ink-1);
  font-size: var(--fs-h3);
  font-weight: 600;
  line-height: var(--lh-snug);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-status__description {
  display: -webkit-box;
  margin: var(--space-2) 0 0;
  overflow: hidden;
  color: var(--ink-2);
  font-size: var(--fs-body);
  line-height: var(--lh-normal);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.card-status__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin-top: auto;
  padding-top: var(--space-4);
  border-top: var(--jet-theme-stroke-width) solid var(--line);
  gap: var(--space-5);
}

.card-status__footer-item {
  display: inline-flex;
  align-items: center;
  color: var(--ink-3);
  font-size: var(--fs-body);
  gap: var(--space-1);
}

.card-status__footer-item strong {
  color: var(--ink-1);
  font-weight: 600;
}
</style>
