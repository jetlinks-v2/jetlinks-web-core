<template>
  <main class="fixture">
    <h1>公共组件交互验收</h1>
    <a-radio-group v-model:value="width" aria-label="内容容器宽度" :options="[390, 700, 1000]" option-type="button" />
    <div class="fixture-container" :style="{ width: `${width}px` }">
      <SplitterPreview />
      <section class="fixture-section">
        <h2>名称与多语言</h2>
        <I18nTextEditable v-model:value="localizedName" v-model:i18n-messages="nameTranslations" field="name" label="点位名称" :text-style="{fontSize:'18px',fontWeight:600}" style="--inline-edit-max-width:20rem" />
      </section>
      <section class="fixture-section">
        <h2>说明与多语言</h2>
        <I18nTextEditable v-model:value="description" v-model:i18n-messages="descriptionTranslations" field="description" label="内容说明" textarea />
      </section>
      <section class="fixture-section">
        <h2>多语言表单输入</h2>
        <I18nTextField v-model:value="formDescription" v-model:i18n-messages="formTranslations" field="description" label="表单说明" textarea :auto-size="{ minRows: 3, maxRows: 8 }" aria-label="表单说明" />
      </section>
      <section class="fixture-section">
        <h2>行内片段</h2>
        <Editable v-model:value="inlineName" :component-props="{ 'aria-label': '行内名称' }" style="--inline-edit-max-width:20rem" />
      </section>
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
        <EqualHeightColumns height="15rem" left-width="10rem" gap="var(--space-3)" resizable>
          <template #left-header><a-input v-model:value="search" aria-label="导航搜索" placeholder="搜索分类" /></template>
          <template #left><p>分类与范围内容</p></template>
          <template #right-header><strong>主区内容</strong></template>
          <template #right><p>当前范围下的内容</p></template>
        </EqualHeightColumns>
      </section>
      <InlineEditCases />
    </div>
  </main>
</template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import DetailHeader from '../../src/components/DetailHeader/index.vue'
import KvGrid from '../../src/components/KvGrid/index.vue'
import EqualHeightColumns from '../../src/components/EqualHeightColumns/index.vue'
import SelectOption from '../../src/components/SelectOption/index.vue'
import SplitterPreview from './SplitterPreview.vue'
import InlineEditCases from './InlineEditCases.vue'
import I18nTextEditable from '../../src/components/I18n/I18nTextEditable.vue'
import I18nTextField from '../../src/components/I18n/I18nTextField.vue'
import Editable from '../../src/components/Editable/index.vue'
import { InlineEditForm, type InlineEditGroup, type InlineEditSubmit } from '../../src/components/InlineEditForm'
const width = ref(700)
const outcome = ref('success')
const search = ref('')
const localizedName = ref('回水温度')
const nameTranslations = ref({ name: { zh: '回水温度', en: 'Return water temperature' } })
const description = ref('记录现场设备的运行情况。\n异常时先核对供电与网络，再记录处理结果。')
const descriptionTranslations = ref({ description: { zh: description.value, en: 'Record the operating conditions on site.\nCheck power and networking before recording the result.' } })
const formDescription = ref('填写处理过程。\n记录需要继续跟进的事项。')
const formTranslations = ref({ description: { zh: formDescription.value } })
const inlineName = ref('回水温度')
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
