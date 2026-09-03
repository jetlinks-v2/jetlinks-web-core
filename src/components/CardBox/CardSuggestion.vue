<template>
  <CardShell
    :active="active"
    :disabled="disabled"
    :aria-label="data.title"
    @click="handleClick"
  >
    <article class="card-suggestion">
      <header class="card-suggestion__header">
        <h3 class="card-suggestion__title">
          <slot name="title" :data="data">{{ data.title }}</slot>
        </h3>
        <span class="card-suggestion__action" aria-hidden="true">
          <slot name="action" :data="data">
            <AIcon :type="data.actionIcon || 'ArrowRightOutlined'" />
          </slot>
        </span>
      </header>
      <p v-if="$slots.description || data.description" class="card-suggestion__description">
        <slot name="description" :data="data">{{ data.description }}</slot>
      </p>
    </article>
  </CardShell>
</template>

<script setup lang="ts" name="CardSuggestion">
import type { PropType } from 'vue'
import CardShell from './CardShell.vue'
import type { CardSuggestionData } from './types'

const props = defineProps({
  data: {
    type: Object as PropType<CardSuggestionData>,
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
  (event: 'click', data: CardSuggestionData, nativeEvent: MouseEvent | KeyboardEvent): void
}>()

const handleClick = (event: MouseEvent | KeyboardEvent) => {
  emit('click', props.data, event)
}
</script>

<style scoped>
.card-suggestion {
  min-height: var(--card-shell-suggestion-min-height);
  padding: var(--space-4);
}

.card-suggestion__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.card-suggestion__title {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--ink-1);
  font-size: var(--fs-h4);
  font-weight: 600;
  line-height: var(--lh-snug);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-suggestion__action {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  color: var(--ink-3);
  font-size: var(--fs-16);
}

.card-suggestion__description {
  display: -webkit-box;
  margin: var(--space-2) 0 0;
  overflow: hidden;
  color: var(--ink-2);
  font-size: var(--fs-body);
  line-height: var(--lh-normal);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
</style>
