<template>
  <main class="fixture">
    <h1>公共组件交互验收</h1>
    <a-radio-group v-model:value="width" aria-label="内容容器宽度" :options="[390, 700, 1000]" option-type="button" />
    <div class="fixture-container" :style="{ width: `${width}px` }">
      <DetailHeader title="服务资料与负责人" variant="summary">
        <template #icon><AIcon type="ProfileOutlined" /></template>
        <template #description>用于核对长名称、辅助说明与实际容器重排。</template>
        <template #actions><a-button>执行记录</a-button><a-button type="primary">查看资料</a-button></template>
      </DetailHeader>
      <section class="fixture-section">
        <h2>字段阅读</h2>
        <div class="kv-examples">
          <KvGrid :items="[{ label: '负责人', value: '陈工' }]" :cols="1" cell-layout="inline" data-testid="kv-array" />
          <KvGrid :cols="1" cell-layout="inline" data-testid="kv-slot"><div class="kv-cell"><dt>负责人</dt><dd>陈工</dd></div></KvGrid>
        </div>
      </section>
      <section class="fixture-section">
        <h2>原位编辑</h2>
        <a-radio-group v-model:value="outcome" aria-label="模拟提交结果" :options="[{label:'成功',value:'success'},{label:'字段失败',value:'rejected'},{label:'请求异常',value:'thrown'}]" />
        <InlineEditForm :groups="groups" :messages="messages" :submit="save" @change="change">
          <template #editor="scope">
            <a-select :id="scope.inputId" :value="String(scope.value)" :disabled="scope.disabled" :loading="scope.loading"
              :options="people" :status="scope.error ? 'error' : undefined" :aria-describedby="scope.describedBy"
              option-label-prop="label" @update:value="scope.update" @change="scope.commit">
              <template #option="option"><SelectOption :label="option.label" :description="option.description" icon="UserOutlined" /></template>
            </a-select>
          </template>
        </InlineEditForm>
        <p class="fixture-counter">实际提交 {{ submissions }} 次</p>
      </section>
      <section class="fixture-section">
        <h2>首次录入</h2>
        <InlineEditForm :groups="groups" mode="form" :messages="messages" @change="change">
          <template #editor="scope">
            <a-select :id="scope.inputId" :value="String(scope.value)" :disabled="scope.disabled" :options="people"
              :status="scope.error ? 'error' : undefined" :aria-describedby="scope.describedBy" option-label-prop="label" @update:value="scope.update">
              <template #option="option"><SelectOption :label="option.label" :description="option.description" icon="UserOutlined" /></template>
            </a-select>
          </template>
        </InlineEditForm>
      </section>
      <section class="fixture-section">
        <h2>分区头部与折叠</h2>
        <EqualHeightColumns height="15rem" left-width="10rem" gap="var(--space-3)">
          <template #left-header><a-input v-model:value="search" aria-label="导航搜索" placeholder="搜索分类" /></template>
          <template #left><p>分类与范围内容</p></template>
          <template #right-header><strong>主区内容</strong></template>
          <template #right><p>当前范围下的内容</p></template>
        </EqualHeightColumns>
      </section>
    </div>
  </main>
</template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import DetailHeader from '../../src/components/DetailHeader/index.vue'
import KvGrid from '../../src/components/KvGrid/index.vue'
import EqualHeightColumns from '../../src/components/EqualHeightColumns/index.vue'
import SelectOption from '../../src/components/SelectOption/index.vue'
import { InlineEditForm, type InlineEditGroup, type InlineEditSubmit } from '../../src/components/InlineEditForm'
const width = ref(700)
const outcome = ref('success')
const search = ref('')
const submissions = ref(0)
const draft = reactive({ name: '服务资料', person: 'one' })
const saved = reactive({ ...draft })
const people = [{ value: 'one', label: '陈工', description: '运行保障组' }, { value: 'two', label: '林工', description: '技术服务组' }]
const messages = { save: '保存', cancel: '取消', empty: '未配置', saving: '保存中', failed: '保存失败，请重试' }
const groups = computed<InlineEditGroup[]>(() => [{ key: 'record', fields: [
  { key: 'name', label: '资料名称', value: draft.name, initialValue: saved.name, hint: '用于辨认这份资料' },
  { key: 'person', label: '负责人', value: draft.person, initialValue: saved.person, editor: 'custom', displayValue: people.find(item => item.value === saved.person)?.label },
] }])
function change(key: string, value: unknown) { draft[key as keyof typeof draft] = String(value) }
const save: InlineEditSubmit = async (key, value) => {
  submissions.value++
  if (outcome.value === 'thrown') throw new Error('simulated transport failure')
  if (outcome.value === 'rejected') return { ok: false, error: '该值暂不可用，请修改后重试' }
  saved[key as keyof typeof saved] = String(value)
  return { ok: true }
}
</script>
<style scoped>
.fixture { padding: 1rem; background: var(--canvas); min-height: 100vh; }
h1 { font-size: var(--fs-20); }
h2 { font-size: var(--fs-16); margin: 0 0 var(--space-4); }
.fixture-container { max-width: 100%; margin-top: var(--space-4); padding: var(--space-4); background: var(--bg); }
.fixture-section { margin-top: var(--space-6); }
.fixture-section > .ant-radio-group { margin-bottom: var(--space-4); }
.kv-examples { display: grid; gap: var(--space-4); }
.fixture-counter { color: var(--jet-theme-text-secondary); }
</style>
