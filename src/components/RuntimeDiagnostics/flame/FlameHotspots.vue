<template>
  <div class="flame-hotspots">
    <article v-for="row in rows" :key="row.key" class="flame-hotspot">
      <div class="flame-hotspot-main">
        <div class="flame-hotspot-name">
          <a-button type="link" class="flame-symbol" :title="row.name" @click="emit('focus', row.key)"><strong><span v-if="row.platform" class="flame-platform">◆ </span>{{ flameSymbol(row).primary }}</strong><small v-if="flameSymbol(row).secondary">{{ flameSymbol(row).secondary }}</small></a-button>
          <a-tag v-if="category === 'all'" class="flame-category">{{ t(`runtimeDiagnostics.flameCategory.${row.category}`) }}</a-tag>
        </div>
        <div class="flame-counts"><strong>{{ count(row).toLocaleString() }} / {{ analysis.total.toLocaleString() }}</strong><small>{{ flameSampleShare(count(row), analysis.total) }} · {{ own(row) ? labels.selfSamples : labels.inclusiveSamples }}</small></div>
      </div>
      <div class="flame-hotspot-actions">
        <a-button type="link" size="small" :aria-expanded="expanded === row.key" @click="expanded = expanded === row.key ? undefined : row.key">{{ labels.evidence }} <span aria-hidden="true">{{ expanded === row.key ? '▴' : '▾' }}</span></a-button>
        <small v-if="row.members.length > 1">{{ formatFlameMessage(labels.compressed, { count: row.members.length }) }}</small>
        <a-typography-text class="flame-copy" :aria-label="labels.copy" :copyable="{ text: row.name }" />
      </div>
      <div v-if="expanded === row.key && evidence" class="flame-evidence">
        <div class="flame-original"><span>{{ labels.rawName }}</span><code>{{ row.name }}</code></div>
        <p>{{ labels.inclusiveSamples }}: {{ row.samples.toLocaleString() }} / {{ analysis.total.toLocaleString() }} · {{ row.selfSamples === undefined ? labels.selfUnavailable : `${labels.selfSamples}: ${row.selfSamples.toLocaleString()} / ${analysis.total.toLocaleString()}` }}</p>
        <p class="flame-boundary">{{ labels.selfBoundary }}</p>
        <section v-for="group in evidenceGroups" :key="group.title"><strong>{{ group.title }}</strong><component :is="group.ordered ? 'ol' : 'ul'"><li v-for="frame in group.frames" :key="frame.key" :aria-current="frame.key === row.key || undefined"><a-button type="link" class="flame-symbol" :title="frame.name" @click="emit('focus', frame.key)"><strong><span v-if="frame.platform" class="flame-platform">◆ </span>{{ flameSymbol(frame).primary }}</strong><small v-if="flameSymbol(frame).secondary">{{ flameSymbol(frame).secondary }}</small></a-button><small>{{ frame.samples.toLocaleString() }} / {{ analysis.total.toLocaleString() }}</small></li></component></section>
      </div>
    </article>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FlameCategory } from '../flameGraph'
import { flameEvidence, type FlameAnalysis, type FlameHotspot } from './analysis'
import { flameSampleShare, flameSymbol, formatFlameMessage, localizedFlameLabels } from './presentation'
const props = defineProps<{ analysis: FlameAnalysis; rows: FlameHotspot[]; category: FlameCategory }>()
const emit = defineEmits<{ (event: 'focus', key: string): void }>()
const { t } = useI18n(), labels = computed(() => localizedFlameLabels(t))
const expanded = ref<string>()
const evidence = computed(() => { const row = props.rows.find(item => item.key === expanded.value); return row ? flameEvidence(props.analysis, row) : undefined })
const evidenceGroups = computed(() => evidence.value ? [{ title: labels.value.path, ordered: true, frames: evidence.value.path }, ...(evidence.value.downstream.length ? [{ title: labels.value.downstream, ordered: false, frames: evidence.value.downstream }] : [])] : [])
const own = (row: FlameHotspot) => row.selfSamples !== undefined && row.selfSamples > 0
const count = (row: FlameHotspot) => own(row) ? row.selfSamples! : row.samples
// 只清除已经不在当前结果内的展开项，累计快照与普通重新渲染不折叠阅读现场。
watch(() => props.rows, rows => { if (expanded.value && !rows.some(row => row.key === expanded.value)) expanded.value = undefined })
</script>
<style scoped>
.flame-hotspots { min-width:0; }
.flame-hotspot { padding-block:10px; border-top:1px solid var(--line); min-width:0; }
.flame-hotspot-main { display:flex; flex-wrap:wrap; gap:6px 16px; align-items:flex-start; }
.flame-hotspot-name { flex:1 1 240px; min-width:0; }
.flame-symbol { display:block; padding:0; height:auto; max-width:100%; white-space:normal; text-align:start; overflow-wrap:anywhere; line-height:1.5; }
.flame-symbol strong { display:block; font-weight:500; font-size:var(--fs-body,14px); }
.flame-symbol small { display:block; font-size:var(--fs-caption,12px); color:var(--ink-3); font-weight:400; }
.flame-platform { color:var(--success); }
.flame-category { margin-block-start:3px; font-size:var(--fs-caption,12px); line-height:17px; }
.flame-counts { display:flex; flex:0 0 auto; flex-direction:column; align-items:flex-end; font-variant-numeric:tabular-nums; font-size:var(--fs-sm,13px); }
.flame-counts small,.flame-hotspot-actions > small { color:var(--ink-3); font-size:var(--fs-caption,12px); }
.flame-hotspot-actions { display:flex; flex-wrap:wrap; align-items:center; gap:4px 8px; margin-top:3px; }
.flame-hotspot-actions > .ant-btn { padding:0; height:auto; }
.flame-copy { margin-inline-start:auto; }
.flame-evidence { min-width:0; margin-block-start:8px; padding:8px 10px; background:var(--bg-sunken); font-size:var(--fs-caption,12px); overflow-wrap:anywhere; }
.flame-original { display:flex; flex-direction:column; gap:2px; }
.flame-original > span,.flame-boundary { color:var(--ink-3); }
.flame-evidence p { margin-block:6px; }
.flame-evidence ol,.flame-evidence ul { padding-inline-start:20px; margin-block:4px; max-height:260px; overflow:auto; }
.flame-evidence li { padding:3px 0; }
.flame-evidence li[aria-current=true] { border-inline-start:2px solid var(--accent); padding-inline-start:6px; }
.flame-evidence li > small { color:var(--ink-3); font-variant-numeric:tabular-nums; }
.flame-evidence .flame-symbol { font-size:var(--fs-caption,12px); }
</style>
