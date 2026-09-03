<template>
  <CardSelect
    class="card-toggle-select"
    :value="selectedValue"
    :options="options"
    :column="1"
    :disabled="disabled"
    @select="handleSelect"
  >
    <template #itemRender>
      <article
        class="card-toggle"
        :aria-label="data.title"
        :aria-disabled="disabled || undefined"
      >
        <header
          class="card-toggle__header"
          role="button"
          :tabindex="disabled ? undefined : 0"
          :aria-pressed="active"
          @keydown.enter.stop.prevent="handleKeyboardSelect"
          @keydown.space.stop.prevent="handleKeyboardSelect"
        >
          <slot name="avatar" :data="data">
            <CardAvatar v-if="data.avatar" :avatar="data.avatar" size="small" />
          </slot>
          <div class="card-toggle__identity">
            <div class="card-toggle__title-row">
              <h3 class="card-toggle__title">
                <slot name="title" :data="data">{{ data.title }}</slot>
              </h3>
              <span v-if="$slots.extra || data.extra" class="card-toggle__extra">
                <slot name="extra" :data="data">{{ data.extra }}</slot>
              </span>
            </div>
            <p v-if="$slots.subtitle || data.subtitle" class="card-toggle__subtitle">
              <slot name="subtitle" :data="data">{{ data.subtitle }}</slot>
            </p>
          </div>
        </header>

        <footer class="card-toggle__footer" @click.stop>
          <span class="card-toggle__footer-leading">
            <slot name="footer-leading" :data="data">
              <AIcon v-if="data.actionIcon" :type="data.actionIcon" />
            </slot>
          </span>
          <slot name="toggle" :data="data" :checked="checked">
            <a-switch
              :checked="checked"
              :disabled="disabled"
              @click.stop
              @update:checked="handleCheckedChange"
            />
          </slot>
        </footer>
      </article>
    </template>
  </CardSelect>
</template>

<script setup lang="ts" name="CardToggle">
import { CardSelect } from '@jetlinks-web/components'
import { computed, type PropType } from 'vue'
import CardAvatar from './CardAvatar.vue'
import type { CardToggleData } from './types'

const props = defineProps({
  data: {
    type: Object as PropType<CardToggleData>,
    required: true,
  },
  active: {
    type: Boolean,
    default: false,
  },
  checked: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits<{
  (event: 'click', data: CardToggleData): void
  (event: 'update:checked', checked: boolean): void
  (event: 'checkedChange', checked: boolean, data: CardToggleData): void
}>()

const options = computed(() => [{
  value: props.data.value,
  label: props.data.title,
  describe: props.data.subtitle,
  disabled: props.disabled,
}])

// CardSelect 负责卡片 active，尾部 checked 是独立业务状态，不能互相推导。
const selectedValue = computed(() => props.active ? props.data.value : undefined)

const handleSelect = () => {
  if (props.disabled) return
  emit('click', props.data)
}

const handleKeyboardSelect = () => {
  handleSelect()
}

const handleCheckedChange = (checked: boolean | string | number) => {
  if (props.disabled) return
  const normalizedChecked = checked === true
  emit('update:checked', normalizedChecked)
  emit('checkedChange', normalizedChecked, props.data)
}
</script>

<style scoped>
.card-toggle-select {
  display: block;
}

.card-toggle-select :deep(.j-card-select-item) {
  overflow: hidden;
  padding: 0;
  border: var(--jet-theme-stroke-width) solid var(--card-shell-border);
  border-radius: var(--card-shell-radius);
  background: var(--card-shell-bg);
  box-shadow: var(--card-shell-shadow);
  transition: var(--card-shell-transition);
}

.card-toggle-select :deep(.j-card-select-item:hover) {
  border-color: var(--card-shell-border-hover);
  box-shadow: var(--card-shell-shadow-hover);
}

.card-toggle-select :deep(.j-card-select-item.active) {
  border-color: var(--card-shell-border-active);
  background: var(--card-shell-bg-active);
  box-shadow: var(--card-shell-shadow-active);
}

.card-toggle-select :deep(.j-card-select-item.disabled) {
  opacity: var(--card-shell-disabled-opacity);
}

.card-toggle {
  min-height: var(--card-shell-toggle-min-height);
  color: var(--ink-1);
  outline: none;
}

.card-toggle__header:focus-visible {
  box-shadow: var(--ring-focus);
  outline: none;
}

.card-toggle__header {
  display: flex;
  align-items: flex-start;
  padding: var(--space-5);
  gap: var(--space-3);
  outline: none;
}

.card-toggle__identity {
  min-width: 0;
  flex: 1;
}

.card-toggle__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.card-toggle__title {
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

.card-toggle__extra,
.card-toggle__subtitle {
  color: var(--ink-3);
  font-size: var(--fs-body);
  line-height: var(--lh-normal);
}

.card-toggle__extra {
  flex: none;
}

.card-toggle__subtitle {
  margin: var(--space-1) 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-toggle__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-top: var(--jet-theme-stroke-width) solid var(--line);
}

.card-toggle__footer-leading {
  display: inline-flex;
  align-items: center;
  min-height: var(--space-6);
  color: var(--ink-3);
  font-size: var(--fs-16);
}
</style>
