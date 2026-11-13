<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { SearchOutlined } from '@ant-design/icons-vue'
import { RelationSelector } from '../../../components/RelationSelector'
import ObjectTypeIcon from '../../../components/IconValue/ObjectTypeIcon.vue'
import { useRelationSelectorLab } from './useRelationSelectorLab'
import { labMessages } from './messages'

const { t, locale } = useI18n({ useScope: 'local', messages: labMessages })
const { typeOptions, typeLoading, typeFailed, sourceType, targetType, value, options, sampleId, sampleOptions,
  sampleLoading, sampleFailed, queryState, queryError, data, results, limited, resultKeyword, canQuery, typeName, nameOf,
  loadTypes, loadSamples, searchSamples, moreSamples, selectSample, query, cancel } = useRelationSelectorLab(locale)
</script>

<template>
  <main class="relation-lab">
    <h1>{{ t('title') }}</h1>
    <a-alert v-if="typeFailed" :message="t('loadFailed')" type="error" show-icon>
      <template #action><a-button size="small" @click="loadTypes">{{ t('retry') }}</a-button></template>
    </a-alert>
    <section class="relation-lab__configuration">
      <a-form layout="vertical">
        <div class="relation-lab__types">
          <a-form-item :label="t('sourceType')">
            <a-select v-model:value="sourceType" :options="typeOptions" :loading="typeLoading" show-search option-filter-prop="label" />
          </a-form-item>
          <a-form-item :label="t('targetType')">
            <a-select v-model:value="targetType" :options="[{ value: '', label: t('anyType') }, ...typeOptions]" :loading="typeLoading" show-search option-filter-prop="label" />
          </a-form-item>
        </div>
        <a-form-item :label="t('path')"><RelationSelector v-model:value="value" :options="options" /></a-form-item>
      </a-form>
      <a-collapse ghost>
        <a-collapse-panel key="config" :header="t('config')"><pre class="relation-lab__config">{{ JSON.stringify(value || {}, null, 2) }}</pre></a-collapse-panel>
      </a-collapse>
    </section>
    <section class="relation-lab__trial">
      <a-form layout="vertical">
        <a-form-item :label="t('sample')" :help="t('sampleOnly')">
          <div class="relation-lab__sample">
            <a-select
              :value="sampleId" :options="sampleOptions" :loading="sampleLoading" :disabled="!sourceType"
              show-search allow-clear :filter-option="false" :placeholder="t('samplePlaceholder')"
              @search="searchSamples" @change="(id: unknown) => selectSample(id ? String(id) : undefined)" @popup-scroll="moreSamples"
            />
            <a-button v-if="queryState === 'loading'" @click="cancel">{{ t('cancel') }}</a-button>
            <a-button v-else type="primary" :disabled="!canQuery" @click="query"><SearchOutlined />{{ t('query') }}</a-button>
          </div>
        </a-form-item>
      </a-form>
      <a-alert v-if="sampleFailed" :message="t('sampleFailed')" type="warning" show-icon>
        <template #action><a-button size="small" @click="loadSamples()">{{ t('retry') }}</a-button></template>
      </a-alert>
      <div class="relation-lab__result-heading">
        <h2>{{ t('results') }}</h2>
        <span v-if="queryState === 'loaded'">{{ t('returned', { count: data.length }) }}</span>
      </div>
      <a-alert v-if="limited" type="info" show-icon :message="t('limited')" />
      <div class="relation-lab__results" aria-live="polite" :aria-busy="queryState === 'loading'">
        <a-skeleton v-if="queryState === 'loading'" active :paragraph="{ rows: 3 }" />
        <a-alert v-else-if="queryState === 'error'" type="error" show-icon :message="t('queryFailed')" :description="queryError">
          <template #action><a-button size="small" @click="query">{{ t('retry') }}</a-button></template>
        </a-alert>
        <template v-else-if="queryState === 'loaded' && data.length">
          <a-input-search v-model:value="resultKeyword" :placeholder="t('filter')" allow-clear />
          <a-list :data-source="results" :locale="{ emptyText: t('noMatch') }">
            <template #renderItem="{ item }">
              <a-list-item>
                <div class="relation-lab__object"><ObjectTypeIcon :type-id="item.type" :size="20" /><span><strong>{{ nameOf(item) }}</strong><small>{{ typeName(item.type) }} · {{ item.id }}</small></span></div>
              </a-list-item>
            </template>
          </a-list>
        </template>
        <a-empty v-else :description="t(queryState === 'loaded' ? 'empty' : queryState === 'cancelled' ? 'queryCancelled' : 'idle')" />
      </div>
    </section>
  </main>
</template>

<style scoped>
.relation-lab { max-width: 820px; margin: 0 auto; padding: 32px 24px; color: var(--color-jet-text, #262626); }
.relation-lab h1 { margin: 0 0 24px; font-size: 22px; font-weight: 600; }
.relation-lab h2 { margin: 0; font-size: 15px; font-weight: 500; }
.relation-lab__configuration, .relation-lab__trial { background: var(--color-jet-bg-container, #fff); padding: 24px; border: 1px solid var(--color-jet-border-secondary, #f0f0f0); border-radius: 8px; }
.relation-lab__trial { margin-top: 20px; }
.relation-lab__types { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.relation-lab__types .ant-select { width: 100%; }
.relation-lab__config { margin: 0; padding: 12px; background: var(--color-jet-bg-layout, #fafafa); border-radius: 4px; font-size: 12px; overflow: auto; }
.relation-lab__configuration :deep(.ant-collapse-header) { padding: 0 !important; color: var(--color-jet-text-secondary, #8c8c8c) !important; font-size: 12px; }
.relation-lab__sample { display: flex; gap: 12px; }
.relation-lab__sample .ant-select { flex: 1; min-width: 0; }
.relation-lab__sample .ant-btn { flex: none; }
.relation-lab__result-heading { display: flex; align-items: center; gap: 12px; margin: 28px 0 12px; }
.relation-lab__result-heading > span { font-size: 12px; color: var(--color-jet-text-description, #8c8c8c); }
.relation-lab__results { min-height: 180px; padding-top: 12px; }
.relation-lab__object { display: flex; align-items: center; gap: 12px; min-width: 0; }
.relation-lab__object > span { min-width: 0; display: grid; gap: 3px; }
.relation-lab__object strong { font-weight: 500; overflow-wrap: anywhere; }
.relation-lab__object small { color: var(--color-jet-text-description, #8c8c8c); font-size: 12px; overflow-wrap: anywhere; }
@media (max-width: 540px) { .relation-lab { padding: 20px 12px; } .relation-lab__types { grid-template-columns: 1fr; gap: 0; } .relation-lab__configuration, .relation-lab__trial { padding: 16px; } .relation-lab__sample { flex-wrap: wrap; } }
</style>
