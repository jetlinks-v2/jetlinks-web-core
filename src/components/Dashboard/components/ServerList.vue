<template>

 <div class="server-list-warp">
   <j-scrollbar>
     <div class="server-list-items">
       <div
           v-for="(item, index) in options" :key="item" :class="['server-item', myValue.includes(item) ? 'active' : '']"
           @click="() => change(item)"
       >
         <j-badge :color="myValue.includes(item) ? (Array.isArray(color) ? color[index % 5] : color) : '#a3a3a3'" :text="item" />
       </div>
     </div>
   </j-scrollbar>
 </div>
</template>

<script lang="ts" name="ServerList" setup>

const props = defineProps({
 options: {
   type: Array,
   default: () => []
 },
 value: {
   type: Array,
   default: () => []
 },
 color: {
   type: [String, Array],
   default: '#979AFF'
 }
})

const emit = defineEmits(['update:value'])

const myValue = ref<any[]>([])
const change = (id: string) => {
 const ids = new Set<string>(myValue.value)
 console.log(ids)
 if (ids.has(id)) {
   ids.delete(id)
 } else {
   ids.add(id)
 }
 myValue.value = [...ids.values()]
 emit('update:value', myValue.value)
}

watch(() => JSON.stringify(props.value), () => {
 myValue.value = props.value
}, { immediate: true })

</script>

<style scoped>
.server-list-warp {
  padding: 0 0.75rem;
  margin-top: var(--space-3);
}
.server-list-warp .server-list-items {
  display: flex;
  gap: var(--space-6);
}
.server-list-warp .server-list-items .server-item {
  cursor: pointer;
}
.server-list-warp .server-list-items .server-item :deep(.ant-badge-status-text) {
  color: var(--ink-4);
  transition: color 0.3s;
}
.server-list-warp .server-list-items .server-item.active :deep(.ant-badge-status-text) {
  color: var(--ink-1);
}</style>
