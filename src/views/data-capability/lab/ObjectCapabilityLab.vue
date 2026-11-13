<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ObjectOverview } from '../../../components/ObjectOverview'
import { useRelationSelectorLab } from '../../relation-selector/lab/useRelationSelectorLab'
import { labMessages } from '../../relation-selector/lab/messages'
const { t, locale } = useI18n({ useScope: 'local', messages: labMessages })
const { typeOptions, typeLoading, sourceType, sampleId, sampleOptions, sampleLoading, sampleFailed,
  searchSamples, moreSamples, selectSample, loadSamples } = useRelationSelectorLab(locale)
const object = computed(() => sourceType.value && sampleId.value ? { type: sourceType.value, id: sampleId.value,
  name: sampleOptions.value.find(item => item.value === sampleId.value)?.label } : undefined)
const changeSample = (value: unknown) => selectSample(value ? String(value) : undefined)
</script>
<template>
  <a-card :title="t('results')" :bordered="false">
    <a-space wrap>
      <a-select v-model:value="sourceType" :options="typeOptions" :loading="typeLoading" style="min-width: 140px" show-search option-filter-prop="label" />
      <a-select :value="sampleId" :options="sampleOptions" :loading="sampleLoading" :disabled="!sourceType" show-search :filter-option="false" :placeholder="t('samplePlaceholder')" style="min-width: 220px" @search="searchSamples" @change="changeSample" @popup-scroll="moreSamples" />
    </a-space>
    <a-alert v-if="sampleFailed" type="warning" :message="t('sampleFailed')"><template #action><a-button @click="loadSamples()">{{ t('retry') }}</a-button></template></a-alert>
    <ObjectOverview v-if="object" :object="object" class="object-capability-lab__preview" />
  </a-card>
</template>
<style scoped>.object-capability-lab__preview { margin-top: 20px; }</style>
