<template>
  <section aria-label="带头部分栏示例">
    <h2>资料分类</h2>
    <EqualHeightColumns height="420px" left-width="160px" gap="var(--space-3)" resizable :resize-limits="{ min: 160, max: 280, contentMin: 200 }">
      <template #left-header>
        <a-input v-model:value="search" aria-label="搜索资料分类" placeholder="搜索分类" allow-clear>
          <template #prefix><AIcon type="SearchOutlined" /></template>
        </a-input>
      </template>
      <template #left>
        <a-list :data-source="filteredCategories" class="columns-categories" :locale="{ emptyText: '没有匹配的分类' }">
          <template #renderItem="{ item }">
            <a-list-item>
              <a-button type="text" class="columns-category" :class="{ 'is-selected': selected === item.id }" :aria-pressed="selected === item.id" @click="selected = item.id">{{ item.name }}</a-button>
            </a-list-item>
          </template>
        </a-list>
      </template>
      <template #right-header><strong>分类资料</strong></template>
      <template #right>
        <article class="columns-detail">
          <DetailHeader :title="activeCategory.name" variant="summary">
            <template #description>{{ activeCategory.description }}</template>
          </DetailHeader>
          <KvGrid :items="[{ label: '负责人', value: activeCategory.owner }]" :cols="1" cell-layout="inline" data-testid="kv-array" />
          <KvGrid :cols="1" cell-layout="inline" data-testid="kv-slot">
            <div class="kv-cell"><dt>资料范围</dt><dd>{{ activeCategory.scope }}</dd></div>
          </KvGrid>
        </article>
      </template>
    </EqualHeightColumns>
  </section>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import EqualHeightColumns from '../../src/components/EqualHeightColumns/index.vue'
import DetailHeader from '../../src/components/DetailHeader/index.vue'
import KvGrid from '../../src/components/KvGrid/index.vue'
const search = ref(''), selected = ref('operations')
const categories = [
  { id: 'operations', name: '运行保障', owner: '陈工', scope: '设备运行与现场排查', description: '记录连接异常、运行检查和现场处理过程。' },
  { id: 'records', name: '资料管理', owner: '李工', scope: '月度资料与核对记录', description: '归集月度资料，记录核对结果和待补充事项。' },
  { id: 'service', name: '技术服务', owner: '王工', scope: '维护指导与服务记录', description: '保存维护说明，跟进现场技术服务事项。' },
]
const filteredCategories = computed(() => categories.filter(item => item.name.includes(search.value)))
const activeCategory = computed(() => categories.find(item => item.id === selected.value) ?? categories[0])
</script>
<style scoped>
h2 { margin:0 0 var(--space-4); font-size:var(--fs-16); font-weight:600; }
.columns-categories { padding:0 var(--space-2); }
.columns-categories :deep(.ant-list-item) { padding:var(--space-1) 0; border:0; }
.columns-category.ant-btn { width:100%; height:auto; min-height:44px; text-align:start; white-space:normal; }
.columns-category.is-selected { color:var(--accent); background:var(--accent-soft); }
.columns-detail { display:flex; flex-direction:column; gap:var(--space-4); height:100%; min-width:0; overflow:auto; padding:var(--space-4); }
.columns-detail :deep(.cloud-detail-header) { margin:0; }
</style>
