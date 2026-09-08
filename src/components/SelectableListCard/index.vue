<template>
  <div
    class="selectable-list-card"
    :class="{
      'selectable-list-card--active': active,
      'selectable-list-card--disabled': disabled,
    }"
    :role="disabled ? undefined : 'button'"
    :tabindex="disabled ? undefined : 0"
    :aria-pressed="active"
    :aria-disabled="disabled || undefined"
    @click="handleClick"
    @keydown.enter.prevent="handleClick"
    @keydown.space.prevent="handleClick"
  >
    <slot />
  </div>
</template>

<script setup lang="ts" name="SelectableListCard">
const props = defineProps({
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
  (event: 'click', nativeEvent: MouseEvent | KeyboardEvent): void
}>()

const handleClick = (event: MouseEvent | KeyboardEvent) => {
  if (!props.disabled) {
    emit('click', event)
  }
}
</script>

<style scoped>
.selectable-list-card {
  box-sizing: border-box;
  width: 100%;
  padding: var(--space-3);
  border: var(--jet-theme-stroke-width) solid transparent;
  border-radius: var(--r-3);
  background: transparent;
  cursor: pointer;
  transition: var(--card-shell-transition);
}

.selectable-list-card--active {
  border-color: color-mix(in srgb, var(--jet-theme-primary, var(--accent)) 20%, transparent);
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--jet-theme-primary, var(--accent)) 20%, transparent),
    var(--bg)
  );
}

.selectable-list-card:focus-visible {
  box-shadow:var(--ring-focus);
  outline: none;
}

.selectable-list-card--disabled {
  cursor: not-allowed;
  opacity: var(--card-shell-disabled-opacity);
}
</style>
