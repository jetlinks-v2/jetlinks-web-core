<template>
  <main class="fixture">
    <PageHeader title="公共组件交互示例" variant="plain">
      <template #actions>
        <label for="fixture-width" class="sr-only">示例最大宽度</label>
        <a-select id="fixture-width" v-model:value="width" class="fixture-width" :options="[{ value:'auto',label:'跟随窗口' },{ value:390,label:'最大 390px' },{ value:700,label:'最大 700px' },{ value:1000,label:'最大 1000px' }]" />
      </template>
    </PageHeader>
    <p class="fixture-notice">本地模拟数据，刷新后恢复；未接入真实上传与鉴权。</p>
    <ContentPanel fill :padding="0" class="fixture-panel" :style="{ width: contentWidth }">
      <a-tabs v-model:active-key="scene" class="fixture-tabs" :class="{ 'fixture-tabs--layout': scene === 'layouts' || scene === 'monitoring' }"
        :tab-bar-style="{ padding: '0 var(--space-4)', margin: 0 }" :animated="false" :destroy-inactive-tab-pane="false">
        <template #moreIcon><span role="img" aria-label="更多场景"><AIcon type="EllipsisOutlined" /></span></template>
        <a-tab-pane key="fields" tab="字段与选择">
          <div class="fixture-scene"><InlineEditCases section="values" /></div>
        </a-tab-pane>
        <a-tab-pane key="detail" tab="单字段保存">
          <div class="fixture-scene">
            <section class="fixture-section">
              <h2>资料名称与负责人</h2>
              <div class="fixture-options"><span>模拟响应</span><a-radio-group v-model:value="outcome" aria-label="模拟提交结果" :options="[{label:'成功',value:'success'},{label:'字段失败',value:'rejected'},{label:'请求异常',value:'thrown'}]" /></div>
              <InlineEditForm :groups="groups" :messages="messages" :submit="save" @change="change">
                <template #editor="scope">
                  <a-select :id="scope.inputId" :value="String(scope.value)" :disabled="scope.disabled" :loading="scope.loading"
                    :options="people" :status="scope.error ? 'error' : undefined" :aria-describedby="scope.describedBy"
                    option-label-prop="label" @update:value="scope.update" @change="scope.commit">
                    <template #option="option"><SelectOption :label="option.label" :description="option.description" icon="UserOutlined" /></template>
                  </a-select>
                </template>
              </InlineEditForm>
              <p class="fixture-counter">模拟字段请求 {{ submissions }} 次（含失败）</p>
            </section>
            <InlineEditCases section="fields" />
          </div>
        </a-tab-pane>
        <a-tab-pane key="form" tab="整表保存">
          <div class="fixture-scene"><InlineEditCases section="form" /></div>
        </a-tab-pane>
        <a-tab-pane key="create" tab="首次录入">
          <section class="fixture-section fixture-scene">
            <h2>新建资料</h2>
            <p class="fixture-hint">字段只修改草稿，保存时接受整组值。</p>
            <InlineEditForm :groups="creationGroups" mode="form" :messages="messages" @change="changeCreation" />
            <div class="fixture-actions"><a-button @click="resetCreation">清空草稿</a-button><a-button type="primary" @click="saveCreation">保存新资料</a-button></div>
            <p class="fixture-counter" role="status">整表模拟保存 {{ creations }} 次；最近接受：<template v-if="created">{{ created.name || '未命名' }} / {{ people.find(person => person.value === created?.person)?.label || '未配置负责人' }}</template><template v-else>尚未保存</template></p>
          </section>
        </a-tab-pane>
        <a-tab-pane key="i18n" tab="多语言">
          <div class="fixture-scene">
            <section class="fixture-section"><h2>点位名称</h2><I18nTextEditable v-model:value="localizedName" v-model:i18n-messages="nameTranslations" field="name" label="点位名称" :text-style="{fontSize:'18px',fontWeight:600}" style="--inline-edit-max-width:20rem" /></section>
            <section class="fixture-section"><h2>内容说明</h2><I18nTextEditable v-model:value="description" v-model:i18n-messages="descriptionTranslations" field="description" label="内容说明" textarea /></section>
            <section class="fixture-section"><h2>表单多语言输入</h2><I18nTextField v-model:value="formDescription" v-model:i18n-messages="formTranslations" field="description" label="表单说明" textarea :auto-size="{ minRows: 3, maxRows: 8 }" aria-label="表单说明" /></section>
          </div>
        </a-tab-pane>
        <a-tab-pane key="async" tab="异步与失败">
          <div class="fixture-scene"><AsyncInlineEditCase /></div>
        </a-tab-pane>
        <a-tab-pane key="layouts" tab="分区布局" style="height:100%">
          <div class="fixture-layouts">
            <div class="fixture-layout-choice"><a-segmented v-model:value="layoutKind" aria-label="分区组件示例" :options="[{value:'adaptive',label:'自适应分区'},{value:'columns',label:'带头部分栏'}]" /><code>{{ layoutKind === 'adaptive' ? 'ResponsiveSplitter' : 'EqualHeightColumns' }}</code></div>
            <KeepAlive><component :is="layoutKind === 'adaptive' ? SplitterPreview : ColumnsPreview" /></KeepAlive>
          </div>
        </a-tab-pane>
        <a-tab-pane key="monitoring" tab="分区数据列表" style="height:100%"><MonitoringPreview /></a-tab-pane>
      </a-tabs>
    </ContentPanel>
  </main>
</template>
<script setup lang="ts">
import { computed, defineAsyncComponent, reactive, ref } from 'vue'
import SelectOption from '../../src/components/SelectOption/index.vue'
import SplitterPreview from './SplitterPreview.vue'
import ColumnsPreview from './ColumnsPreview.vue'
const MonitoringPreview = defineAsyncComponent(() => import('./MonitoringPreview.vue'))
import PageHeader from '../../src/components/PageHeader/index.vue'
import ContentPanel from '../../src/components/ContentPanel/index.vue'
import InlineEditCases from './InlineEditCases.vue'
import AsyncInlineEditCase from './AsyncInlineEditCase.vue'
import I18nTextEditable from '../../src/components/I18n/I18nTextEditable.vue'
import I18nTextField from '../../src/components/I18n/I18nTextField.vue'
import { InlineEditForm, type InlineEditGroup, type InlineEditSubmit } from '../../src/components/InlineEditForm'
const width = ref<number | 'auto'>('auto')
const scene = ref('fields')
const layoutKind = ref('adaptive')
const contentWidth = computed(() => width.value === 'auto' ? '100%' : `${width.value}px`)
const outcome = ref('success')
const localizedName = ref('回水温度')
const nameTranslations = ref({ name: { zh: '回水温度', en: 'Return water temperature' } })
const description = ref('记录现场设备的运行情况。\n异常时先核对供电与网络，再记录处理结果。')
const descriptionTranslations = ref({ description: { zh: description.value, en: 'Record the operating conditions on site.\nCheck power and networking before recording the result.' } })
const formDescription = ref('填写处理过程。\n记录需要继续跟进的事项。')
const formTranslations = ref({ description: { zh: formDescription.value } })
const submissions = ref(0)
const draft = reactive({ name: '服务资料', person: 'one' })
const saved = reactive({ ...draft })
const creation = reactive({ name: '', person: '' })
const created = ref<{ name: string; person: string }>()
const creations = ref(0)
const people = [{ value: 'one', label: '陈工', description: '运行保障组' }, { value: 'two', label: '林工', description: '技术服务组' }]
const messages = { save: '保存', cancel: '取消', empty: '未配置', saving: '保存中', failed: '保存失败，请重试' }
const groups = computed<InlineEditGroup[]>(() => [{ key: 'record', fields: [
  { key: 'name', label: '资料名称', value: draft.name, initialValue: saved.name, hint: '用于辨认这份资料' },
  { key: 'person', label: '负责人', value: draft.person, initialValue: saved.person, editor: 'custom', displayValue: people.find(item => item.value === saved.person)?.label },
] }])
const creationGroups = computed<InlineEditGroup[]>(() => [{ key: 'new-record', fields: [
  { key: 'name', label: '新资料名称', value: creation.name, initialValue: '' },
  { key: 'person', label: '新负责人', editor: 'select', options: people, value: creation.person || undefined, initialValue: undefined },
] }])
function changeCreation(key: string, value: unknown) { creation[key as keyof typeof creation] = value == null ? '' : String(value) }
function saveCreation() { created.value = { ...creation }; creations.value++ }
function resetCreation() { creation.name = ''; creation.person = '' }
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
.fixture { box-sizing:border-box; height:100dvh; display:flex; flex-direction:column; gap:var(--space-3); padding:var(--space-4); background:var(--canvas); overflow:hidden; }
.fixture > :deep(.cloud-page-header) { flex:none; margin:0; }
.fixture-width { width:132px; }
.fixture-notice { flex:none; margin:0; font-size:var(--fs-12); color:var(--jet-theme-text-secondary); }
.fixture-panel { min-width:0; min-height:0; max-width:100%; overflow:hidden; border:1px solid var(--line); }
.fixture-tabs { flex:1; min-height:0; }
.fixture-tabs :deep(> .ant-tabs-content-holder) { min-height:0; overflow:auto; }
.fixture-tabs :deep(> .ant-tabs-nav) { flex:none; }
.fixture-tabs--layout :deep(> .ant-tabs-content-holder) { overflow:hidden; }
.fixture-tabs--layout :deep(> .ant-tabs-content-holder > .ant-tabs-content) { height:100%; }
.fixture-scene { box-sizing:border-box; max-width:100%; padding:var(--space-4); }
.fixture-layouts { display:flex; flex-direction:column; height:100%; min-height:0; }
.fixture-scene :deep(.fixture-section) { margin-top:var(--space-6); }
.fixture-scene > :deep(.fixture-section:first-child),.fixture-section.fixture-scene { margin-top:0; }
.fixture :deep(.fixture-section > h2) { margin:0 0 var(--space-4); font-size:var(--fs-16); font-weight:600; }
.fixture-options,.fixture-actions,.fixture-layout-choice { display:flex; flex-wrap:wrap; align-items:center; gap:var(--space-3); }
.fixture-options { margin-bottom:var(--space-4); }
.fixture-options > span,.fixture-hint { color:var(--jet-theme-text-secondary); font-size:var(--fs-12); }
.fixture-actions { margin-top:var(--space-4); }
.fixture :deep(.fixture-counter) { margin:var(--space-3) 0 0; color:var(--jet-theme-text-secondary); font-size:var(--fs-12); }
.fixture-layout-choice { flex:none; justify-content:space-between; padding:var(--space-3) var(--space-4); border-bottom:1px solid var(--line); }
.fixture-layout-choice code { color:var(--jet-theme-text-secondary); font-size:var(--fs-12); }
@media (max-width:600px) { .fixture { padding:var(--space-3); } .fixture-actions :deep(.ant-btn) { min-height:44px; } }
</style>
