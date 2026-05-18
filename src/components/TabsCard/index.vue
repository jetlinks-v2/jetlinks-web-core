<template>
  <div class="tab-select">
    <div
        class="tab-select-item"
        v-for="item in options"
        :key="item.value"
        :style="{
          'grid-template-columns': `repeat(${options.length}, 1fr)`
        }"
        :class="activeKey === item.value ? 'active' : ''"
        @click="onClick(item.value)"
    >
      <div>
        <img :src="item.img" />
      </div>
      <div>
        <div>{{item.label}}</div>
        <div>{{ item.desc}}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  options: {
    type: Array,
    default: () => [],
  },
  activeKey: {
    type: String,
    default: undefined,
  },
})

const emits = defineEmits(['change', 'update:activeKey'])

const onClick = (key) => {
  emits('update:activeKey', key)
  emits('change', key)
}
</script>

<style scoped>
.tab-select {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
}
.tab-select-item {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  background: var(--bg-hover);
  border-radius: var(--r-2);
  padding: 0.75rem 1.5rem;
  cursor: pointer;
}
.tab-select-item.active {
  border: 1px solid var(--accent);
}</style>
