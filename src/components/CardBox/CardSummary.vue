<template>
  <CardShell
    :active="active"
    :disabled="disabled"
    :bordered="bordered"
    :background-opacity="backgroundOpacity"
    :aria-label="data.title"
    @click="handleClick"
  >
    <article class="card-summary">
      <header class="card-summary__header">
        <slot name="avatar" :data="data">
          <CardAvatar v-if="data.avatar" :avatar="data.avatar" />
        </slot>
        <div class="card-summary__identity">
          <div class="card-summary__title-row">
            <h3 class="card-summary__title">
              <slot name="title" :data="data">{{ data.title }}</slot>
            </h3>
            <slot name="status" :data="data">
              <StatusTag
                v-if="data.status"
                :status="data.status.tone ?? 'default'"
                :text="data.status.text"
                :bordered="false"
              />
            </slot>
          </div>
          <p v-if="$slots.subtitle || data.subtitle" class="card-summary__subtitle">
            <slot name="subtitle" :data="data">{{ data.subtitle }}</slot>
          </p>
        </div>
      </header>

      <p v-if="$slots.description || data.description" class="card-summary__description">
        <slot name="description" :data="data">{{ data.description }}</slot>
      </p>

      <div v-if="$slots.tags || data.tags?.length" class="card-summary__tags">
        <slot name="tags" :data="data">
          <span
            v-for="(tag, index) in data.tags"
            :key="tag.key ?? index"
            class="card-summary__tag"
            :class="`card-summary__tag--${tag.tone ?? 'info'}`"
          >
            {{ tag.label }}
          </span>
        </slot>
      </div>

      <div v-if="$slots.meta || data.meta?.length" class="card-summary__meta">
        <slot name="meta" :data="data">
          <span
            v-for="(item, index) in data.meta"
            :key="item.key ?? index"
            class="card-summary__meta-item"
          >
            <AIcon v-if="item.icon" :type="item.icon" />
            <span v-if="item.label">{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </span>
        </slot>
      </div>

      <footer
        v-if="$slots.footer || data.footer?.length || data.footerActionIcon"
        class="card-summary__footer"
      >
        <slot name="footer" :data="data">
          <div
            v-for="(item, index) in data.footer"
            :key="item.key ?? index"
            class="card-summary__footer-item"
          >
            <span v-if="item.label">{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
          <span v-if="data.footerActionIcon" class="card-summary__footer-action" aria-hidden="true">
            <AIcon :type="data.footerActionIcon" />
          </span>
        </slot>
      </footer>
    </article>
  </CardShell>
</template>

<script setup lang="ts" name="CardSummary">
import type { PropType } from 'vue'
import StatusTag from '../StatusTag/index.vue'
import { cardAppearanceProps } from './appearance'
import CardAvatar from './CardAvatar.vue'
import CardShell from './CardShell.vue'
import type { CardSummaryData } from './types'

const props = defineProps({
  ...cardAppearanceProps,
  data: {
    type: Object as PropType<CardSummaryData>,
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
  (event: 'click', data: CardSummaryData, nativeEvent: MouseEvent | KeyboardEvent): void
}>()

const handleClick = (event: MouseEvent | KeyboardEvent) => {
  emit('click', props.data, event)
}
</script>

<style scoped>
.card-summary {
  display: flex;
  box-sizing: border-box;
  height: 100%;
  flex-direction: column;
  padding: var(--space-5) var(--space-5) 0;
}

.card-summary__header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
}

.card-summary__identity {
  min-width: 0;
  flex: 1;
}

.card-summary__title-row {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.card-summary__title {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--ink-1);
  font-size: var(--fs-h3);
  font-weight: 600;
  line-height: var(--lh-snug);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-summary__subtitle,
.card-summary__description {
  color: var(--ink-2);
  font-size: var(--fs-body);
  line-height: var(--lh-normal);
}

.card-summary__subtitle {
  margin: var(--space-1) 0 0;
}

.card-summary__description {
  display: -webkit-box;
  margin: var(--space-3) 0 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.card-summary__tags,
.card-summary__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.card-summary__tag {
  --card-summary-tag-color: var(--card-tone-info);
  --card-summary-tag-bg: var(--card-tone-info-soft);

  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--r-2);
  background: var(--card-summary-tag-bg);
  color: var(--card-summary-tag-color);
  font-size: var(--fs-pill);
  line-height: var(--lh-normal);
}

.card-summary__tag--default {
  --card-summary-tag-color: var(--card-tone-default);
  --card-summary-tag-bg: var(--card-tone-default-soft);
}

.card-summary__tag--success {
  --card-summary-tag-color: var(--card-tone-success);
  --card-summary-tag-bg: var(--card-tone-success-soft);
}

.card-summary__tag--warning {
  --card-summary-tag-color: var(--card-tone-warning);
  --card-summary-tag-bg: var(--card-tone-warning-soft);
}

.card-summary__tag--error {
  --card-summary-tag-color: var(--card-tone-error);
  --card-summary-tag-bg: var(--card-tone-error-soft);
}

.card-summary__meta-item {
  display: inline-flex;
  align-items: center;
  color: var(--ink-2);
  font-size: var(--fs-body);
  gap: var(--space-1);
}

.card-summary__meta-item strong {
  color: var(--ink-1);
  font-weight: 600;
}

.card-summary__footer {
  display: flex;
  align-items: center;
  margin: auto calc(var(--space-5) * -1) 0;
  padding: var(--space-4) var(--space-5);
  border-top: var(--jet-theme-stroke-width) solid var(--line);
  gap: var(--space-5);
}

.card-summary__footer-item {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: var(--space-1);
}

.card-summary__footer-item span {
  overflow: hidden;
  color: var(--ink-3);
  font-size: var(--fs-meta);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-summary__footer-item strong {
  overflow: hidden;
  color: var(--ink-1);
  font-size: var(--fs-h4);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-summary__footer-action {
  display: inline-flex;
  flex: none;
  color: var(--ink-3);
  font-size: var(--fs-16);
}
</style>
