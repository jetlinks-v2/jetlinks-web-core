<template>
  <div
    class="card-shell"
    :class="{
      'card-shell--active': active,
      'card-shell--disabled': disabled,
      'card-shell--interactive': interactive,
    }"
    :role="interactive ? 'button' : undefined"
    :tabindex="interactive && !disabled ? 0 : undefined"
    :aria-label="ariaLabel"
    :aria-pressed="interactive ? active : undefined"
    :aria-disabled="disabled || undefined"
    @click="handleClick"
    @keydown.enter.prevent="handleClick"
    @keydown.space.prevent="handleClick"
  >
    <slot />
  </div>
</template>

<script setup lang="ts" name="CardShell">
const props = defineProps({
  active: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  interactive: {
    type: Boolean,
    default: true,
  },
  ariaLabel: {
    type: String,
    default: undefined,
  },
})

const emit = defineEmits<{
  (event: 'click', nativeEvent: MouseEvent | KeyboardEvent): void
}>()

const handleClick = (event: MouseEvent | KeyboardEvent) => {
  if (props.disabled || !props.interactive) return
  emit('click', event)
}
</script>

<style scoped>
.card-shell {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border: var(--jet-theme-stroke-width) solid var(--card-shell-border);
  border-radius: var(--card-shell-radius);
  background: var(--card-shell-bg);
  box-shadow: var(--card-shell-shadow);
  color: var(--ink-1);
  transition: var(--card-shell-transition);
}

.card-shell--interactive {
  cursor: pointer;
}

.card-shell--interactive:hover {
  border-color: var(--card-shell-border-hover);
  box-shadow: var(--card-shell-shadow-hover);
}

.card-shell--interactive:focus-visible {
  border-color: var(--card-shell-border-active);
  box-shadow: var(--ring-focus);
  outline: none;
}

.card-shell--active {
  border-color: var(--card-shell-border-active);
  background: var(--card-shell-bg-active);
  box-shadow: var(--card-shell-shadow-active);
}

.card-shell--disabled {
  cursor: not-allowed;
  opacity: var(--card-shell-disabled-opacity);
}
</style>
