<template>
  <section class="template-publication">
    <p class="template-publication__flow"><AIcon type="BranchesOutlined" />{{ template.name || template.id }}<span>v{{ template.version }}</span><AIcon type="ArrowRightOutlined" /><span>{{ template.outputs.map(item => item.label || item.metricId).join(' · ') }}</span></p>
    <p class="template-publication__hint">{{ t('revisionPublishHint') }}</p>
    <a-button v-if="editable && (!entity?.released || pending)" type="primary" :loading="saving" :disabled="updates.applying.value" @click="emit('release')"><AIcon type="CloudUploadOutlined" />{{ t(entity?.released ? 'publishUpdate' : 'release') }}</a-button>
    <template v-if="entity?.released">
      <div class="template-publication__tools"><h4>{{ t('templateUses') }}</h4><a-button type="text" size="small" :loading="updates.loading.value" :disabled="updates.applying.value" @click="updates.load"><AIcon type="ReloadOutlined" />{{ t('refresh') }}</a-button></div>
      <a-alert v-if="updates.error.value" type="error" show-icon :message="updates.error.value" />
      <p class="template-publication__hint">{{ t('revisionApplyHint') }}</p>
      <div v-if="editable" class="template-publication__tools">
        <a-select v-model:value="updates.targetRevision.value" :disabled="updates.applying.value" :aria-label="t('targetRevision')" :options="revisionOptions" :dropdown-match-select-width="false"><template #option="option"><SelectOption :label="option.label" :icon="option.icon" :description="option.description" /></template></a-select>
        <a-button :loading="updates.applying.value" :disabled="!updates.selectedIds.value.length || saving" @click="updates.apply(false)">{{ t('applySelected') }}</a-button>
        <a-popconfirm :title="t('applyAllConfirm')" :ok-text="t('applyAll')" :cancel-text="t('cancel')" @confirm="updates.apply(true)"><a-button :disabled="updates.applying.value || saving || !updates.references.value.length">{{ t('applyAll') }}</a-button></a-popconfirm>
      </div>
      <small v-if="updates.summary.value.saved || updates.summary.value.failed">{{ t('applySummary', updates.summary.value) }}</small>
      <a-spin :spinning="updates.loading.value">
        <a-empty v-if="updates.referencesLoaded.value && !updates.references.value.length && !updates.loading.value" :description="t('noTemplateUses')" />
        <div v-for="config in updates.references.value" :key="config.id" class="template-publication__reference">
          <a-checkbox v-if="editable" :checked="updates.selectedIds.value.includes(config.id!)" :disabled="updates.applying.value" :aria-label="config.name || config.id" @update:checked="select(config.id!, $event)" />
          <div><b>{{ config.name || config.slot }}</b><small>{{ config.ownerType }} · {{ config.ownerId }}</small></div>
          <a-tag>r{{ config.templateRevision || 1 }}</a-tag><a-tag v-if="(config.templateRevision || 1) !== entity.revision" color="orange">{{ t('updateAvailable') }}</a-tag>
          <small v-if="updates.outcomes.value[config.id!]?.error" role="alert" class="template-publication__failure">{{ updates.outcomes.value[config.id!].error }}</small>
          <small v-else-if="updates.outcomes.value[config.id!]?.state">{{ t('applyState_' + updates.outcomes.value[config.id!].state) }}</small>
        </div>
      </a-spin>
      <a-button v-if="updates.hasMore.value" type="text" :loading="updates.loading.value" :disabled="updates.applying.value" @click="updates.loadMore">{{ t('loadMore') }}</a-button>
      <details><summary>{{ t('revisionHistory') }}</summary><div v-for="revision in updates.revisions.value" :key="revision.revision" class="template-publication__history"><AIcon type="HistoryOutlined" /><b>r{{ revision.revision }}</b><time>{{ new Date(revision.publishedAt).toLocaleString() }}</time></div><a-button v-if="updates.hasMoreRevisions.value" type="text" :loading="updates.loadingRevisions.value" :disabled="updates.applying.value" @click="updates.loadRevisions">{{ t('loadMore') }}</a-button></details>
    </template>
    <slot />
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { metricMessages } from '../messages'
import SelectOption from '../../SelectOption/index.vue'
import type { MetricTemplate, MetricTemplateEntity } from '../types'
import type { useTemplateUpdates } from './useTemplateUpdates'
const props = defineProps<{ template: MetricTemplate; entity?: MetricTemplateEntity; editable: boolean; pending: boolean; saving: boolean; updates: ReturnType<typeof useTemplateUpdates> }>()
const emit = defineEmits<{ (event: 'release'): void }>()
const { t } = useI18n({ useScope: 'local', messages: metricMessages })
const revisionOptions = computed(() => [...new Set([props.entity?.revision || 1, ...props.updates.revisions.value.map(item => item.revision)])].map(value => ({ value, label:`r${value}`, icon:'HistoryOutlined', description:t(value === props.entity?.revision ? 'currentRevision' : 'historicalRevision') })))
function select(id: string, checked: boolean) { props.updates.selectedIds.value = checked ? [...props.updates.selectedIds.value, id] : props.updates.selectedIds.value.filter(value => value !== id) }
</script>
<style scoped>
.template-publication { display:grid; gap:var(--space-3,12px) }
.template-publication__flow,.template-publication__tools,.template-publication__history { display:flex; align-items:center; flex-wrap:wrap; gap:var(--space-3,12px); margin:0 }
.template-publication__hint { margin:0; color:var(--ink-3); line-height:1.8 }
.template-publication>.ant-btn { justify-self:start }
.template-publication__tools h4 { margin:0; flex:1 }
.template-publication__reference { display:flex; align-items:center; flex-wrap:wrap; gap:var(--space-3,12px); padding:var(--space-3,12px) 0; border-bottom:1px solid var(--line) }
.template-publication__reference>div { flex:1; min-width:160px }
.template-publication__reference small { display:block; color:var(--ink-3); overflow-wrap:anywhere }
.template-publication__reference .template-publication__failure { color:var(--danger) }
.template-publication__history { padding:var(--space-2,8px) 0; color:var(--ink-3) }
</style>
