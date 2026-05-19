<template>
  <div class="radio-button" :style="styles">
    <div v-for="item in options" @click="onClick(item)"  class="radio-button-item" :class="{'active': myValue === item.value }">
      {{ item.label }}
    </div>
  </div>
</template>

<script setup>
defineOptions({
  name: 'RadioButton',
})

const props = defineProps({
  value: {
    type: [String, Number],
    default: undefined
  },
  options: {
    type: Array,
    default: () => []
  },
  columns: {
    type: Number,
    default: 3
  }
})

const emit = defineEmits(['update:value'])

const myValue = ref(props.value)

const styles = computed(() => {
  return {
    'grid-template-columns': `repeat(${props.columns}, 1fr)`
  }
})

const onClick = (record) => {
  if (myValue.value !== record.value) {
    myValue.value = record.value
    emit('update:value', record.value)
    emit('select', record.value)
  }
}

watch(() => props.value, () => {
 myValue.value = props.value
})

</script>

<style scoped>
.radio-button {
  display: grid;
  gap: var(--space-4);
}
.radio-button .radio-button-item {
  padding: 0.375rem 0.75rem;
  text-align: center;
  height: 100%;
  border-radius: 0.125rem;
  background-color: var(--canvas);
  cursor: pointer;
}
.radio-button .radio-button-item.active {
  color: var(--accent-ink);
  background-color: var(--jet-theme-primary, var(--accent));
}</style>
