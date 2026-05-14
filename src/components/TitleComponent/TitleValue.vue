<template>
  <div class="title-value">
    <div class="title">
      <slot name="title">
        <template v-if="title">
          {{ title }}
        </template>
        <template v-else>
          <AIcon class="icon" type="icon-ID"/>
        </template>
      </slot>
    </div>
    <div class="value">
      <j-ellipsis v-if="ellipsis !== false">
        <slot/>
      </j-ellipsis>
      <template v-else>
        <slot/>
      </template>
    </div>
  </div>
</template>

<script setup>
defineOptions({
  name: 'TitleValue'
})

defineProps({
  title: {
    type: String
  },
  ellipsis: {
    type: Boolean,
    default: true
  }
})
</script>

<style scoped>
.title-value {
  display: flex;
  gap: 0.5rem;
}
.title-value .title {
  color: var(--jet-theme-text-secondary, var(--ink-3));
  white-space: nowrap;
}
.title-value .title .icon {
  color: var(--jet-theme-primary, var(--accent));
}
.title-value .value {
  flex: 1 1 0;
  color: var(--jet-theme-text, var(--ink-3));
}</style>
