<template>
  <section class="fixture-section" aria-label="异步文字编辑示例">
    <h2>等待、失败与重试</h2>
    <p>修改点位别名后按 Enter 或离开字段发起模拟请求；等待期间锁定编辑。点击“返回模拟结果”结束请求，失败时保留输入。</p>
    <a-radio-group v-model:value="outcome" :disabled="!!finish" aria-label="别名模拟响应" :options="[{ label:'成功',value:'success' },{ label:'返回失败',value:'rejected' },{ label:'抛出异常',value:'thrown' }]" />
    <div class="async-case__field"><span>点位别名</span><InputEditable v-model:value="alias" label="编辑点位别名" :save="save" save-feedback /></div>
    <a-button :disabled="!finish" @click="finish?.()">返回模拟结果</a-button>
    <p role="status">{{ finish ? '模拟请求等待返回，编辑已锁定。' : `模拟请求 ${attempts} 次，成功 ${accepted} 次；已接受值：${alias}` }}</p>
    <div class="async-case__field"><span>处理说明草稿（仅本页）</span><InputEditable v-model:value="notes" label="处理说明草稿" trigger="text" textarea /></div>
    <div class="async-case__field"><span>不可编辑的来源名称</span><InputEditable value="系统同步" label="来源名称" disabled /></div>
  </section>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import InputEditable from '../../src/components/Editable/InputEditable.vue'
const alias = ref('北侧机房')
const notes = ref('核对供电与网络。\n记录本次处理过程。')
const outcome = ref('success')
const attempts = ref(0), accepted = ref(0)
const finish = ref<() => void>()
async function save() {
  attempts.value++
  const response = outcome.value
  await new Promise<void>(resolve => { finish.value = resolve })
  finish.value = undefined
  if (response === 'thrown') throw new Error('simulated response failure')
  if (response === 'rejected') return false
  accepted.value++
  return true
}
onBeforeUnmount(() => finish.value?.())
</script>
<style scoped>
.async-case__field { display:grid; gap:var(--space-2); margin-block:var(--space-4); min-width:0; }
.async-case__field > span { color:var(--ink-2); font-size:var(--fs-12); }
</style>
