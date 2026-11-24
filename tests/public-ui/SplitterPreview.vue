<template>
  <section class="splitter-example" aria-label="Splitter 面板验收">
    <div class="splitter-example__heading">
      <h2>处理工作台</h2>
      <a-segmented v-model:value="orientation" aria-label="分区方向"
        :options="[{ label: '左右分区', value: 'horizontal' }, { label: '上下分区', value: 'vertical' }]" />
    </div>
    <Splitter collapse-on-drag :orientation="orientation" :default-size="orientation === 'vertical' ? 160 : '32%'"
      :min="orientation === 'vertical' ? 100 : 160" :max="360" :end-min="orientation === 'vertical' ? 180 : 240"
      resize-label="调整任务列表尺寸" class="splitter-example__layout">
      <template #start>
        <nav class="splitter-example__navigation" aria-label="待处理任务">
          <a-input v-model:value="search" placeholder="搜索任务" aria-label="搜索任务" allow-clear>
            <template #prefix><AIcon type="SearchOutlined" /></template>
          </a-input>
          <a-list :data-source="filteredTasks">
            <template #renderItem="{ item }">
              <a-list-item>
                <a-button type="text" class="splitter-example__item" :class="{ 'is-selected': item.id === selected }" @click="selected = item.id">
                  <AIcon :type="item.icon" /><span><b>{{ item.name }}</b><small>{{ item.group }}</small></span>
                </a-button>
              </a-list-item>
            </template>
          </a-list>
        </nav>
      </template>
      <template #end="{ collapsed, toggle }">
        <article class="splitter-example__detail">
          <header>
            <a-button type="text" :aria-label="collapsed ? '展开任务列表' : '收起任务列表'" :aria-expanded="!collapsed" @click="toggle">
              <AIcon :type="collapsed ? 'MenuUnfoldOutlined' : 'MenuFoldOutlined'" />
            </a-button>
            <h3>{{ activeTask.name }}</h3><a-tag color="processing">处理中</a-tag>
          </header>
          <dl><div><dt>所属分组</dt><dd>{{ activeTask.group }}</dd></div><div><dt>负责人</dt><dd>陈工</dd></div></dl>
          <h4>处理记录</h4>
          <a-timeline><a-timeline-item>已分派 · 09:30</a-timeline-item><a-timeline-item>正在核对运行记录</a-timeline-item></a-timeline>
          <label for="splitter-note">备注</label>
          <a-textarea id="splitter-note" v-model:value="note" :rows="2" placeholder="补充处理记录" />
        </article>
      </template>
    </Splitter>
  </section>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import Splitter from '../../src/components/Splitter/index.vue'
const orientation = ref<'horizontal' | 'vertical'>('horizontal')
const search = ref(''), note = ref('已联系现场核对'), selected = ref('connection')
const tasks = [
  { id: 'connection', name: '连接异常排查', group: '运行保障', icon: 'ApiOutlined' },
  { id: 'report', name: '月度资料核对', group: '资料管理', icon: 'FileTextOutlined' },
  { id: 'inspection', name: '例行巡检', group: '运行保障', icon: 'SafetyCertificateOutlined' },
]
const filteredTasks = computed(() => tasks.filter(item => item.name.includes(search.value)))
const activeTask = computed(() => tasks.find(item => item.id === selected.value) ?? tasks[0])
</script>
<style scoped>
.splitter-example__heading { display:flex; align-items:center; justify-content:space-between; gap:var(--space-3); flex-wrap:wrap; margin-bottom:var(--space-4); }
.splitter-example__heading h2 { margin:0; font-size:var(--fs-16); }
.splitter-example__layout { height:420px; border:1px solid var(--line); border-radius:var(--r-2); }
.splitter-example__navigation { padding:var(--space-3); }
.splitter-example__navigation :deep(.ant-list-item) { padding:var(--space-1) 0; border:0; }
.splitter-example__item.ant-btn { width:100%; height:auto; display:flex; align-items:center; gap:var(--space-3); padding:var(--space-3); text-align:start; }
.splitter-example__item.is-selected { background:var(--accent-soft); color:var(--accent); }
.splitter-example__item b,.splitter-example__item small { display:block; }
.splitter-example__item small { margin-top:var(--space-1); font-weight:normal; color:var(--ink-2); }
.splitter-example__detail { padding:var(--space-4); }
.splitter-example__detail header { display:flex; flex-wrap:wrap; gap:var(--space-2); align-items:center; margin-bottom:var(--space-5); }
.splitter-example__detail h3 { margin:0; font-size:var(--fs-16); }
.splitter-example__detail dl { display:flex; flex-wrap:wrap; gap:var(--space-5); margin-bottom:var(--space-5); }
.splitter-example__detail dt { color:var(--ink-2); font-size:var(--fs-12); }
.splitter-example__detail dd { margin:var(--space-1) 0 0; }
.splitter-example__detail h4 { margin-bottom:var(--space-4); }
.splitter-example__detail label { display:block; margin-bottom:var(--space-2); }
</style>
