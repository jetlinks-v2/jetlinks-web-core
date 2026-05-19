<template>
  <div
    class="container"
    @click.stop="onClick"
    @mousedown.stop
    @mouseup.stop
  >
    <div
      v-if="_type"
      class="icon-display"
    >
      <AIcon :type="_type" />
    </div>
    <div
      v-else
      class="no-icon"
    >
      <AIcon type="PlusOutlined" />
    </div>
  </div>
  <SelectModal
    v-if="visible"
    :zIndex="props.zIndex"
    @close="setVisible(false)"
    @save="onChange"
  />
</template>

<script setup lang="ts">
import SelectModal from './SelectModal.vue'
const props = defineProps({
  type: {
    type: String,
    default: ''
  },
  zIndex: {
    type: Number,
    default: 200000
  }
})

const emits = defineEmits(['change', 'update:type', 'visibleChange'])

const _type = ref()
const visible = ref(false)

const setVisible = (value: boolean) => {
  visible.value = value
  emits('visibleChange', value)
}

const onClick = () => {
  setVisible(true)
}

const onChange = (val: string) => {
  _type.value = val
  emits('update:type', val)
  emits('change', val)
  setVisible(false)
}

watch(
  () => props.type,
  (newVal) => {
    _type.value = newVal
  },
  { deep: true, immediate: true }
)
</script>

<style scoped>
.container {
  width: 4.375rem;
  height: 4.375rem;
  border: 1px dashed var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-2);
  cursor: pointer;
  transition: all 0.3s;
}
.container:hover {
  border-color: var(--accent);
  background-color: var(--accent-soft);
}
.container .icon-display {
  font-size: var(--fs-32);
  color: var(--accent);
}
.container .no-icon {
  color: color-mix(in srgb, var(--ink-1) 47%, transparent);
  font-size: var(--fs-22);
}</style>
