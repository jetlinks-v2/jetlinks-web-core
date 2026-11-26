<template>
  <section class="legacy-columns-example" aria-label="正文自带头部分栏示例">
    <header class="legacy-columns-example__options">
      <label>分栏间距 <a-select v-model:value="gap" aria-label="分栏间距" :options="[0,16,24,32].map(value => ({value,label:`${value}px`}))" /></label>
      <a-checkbox v-model:checked="resizable">允许调宽</a-checkbox>
    </header>
    <EqualHeightColumns class="legacy-columns-example__workspace" left-width="200px" :gap="gap" :resizable="resizable" :resize-limits="{ min:160,max:280,contentMin:200 }">
      <template #left>
        <section class="legacy-columns-example__navigation">
          <h2>资料分类</h2>
          <a-input v-model:value="search" aria-label="搜索正文分类" placeholder="搜索分类" allow-clear />
          <a-button v-for="name in categories.filter(value => value.includes(search))" :key="name" type="text" :aria-pressed="selected === name" @click="selected = name">{{ name }}</a-button>
        </section>
      </template>
      <template #right>
        <section class="legacy-columns-example__detail">
          <h2>{{ selected }}</h2>
          <label>备注<a-textarea v-model:value="note" aria-label="分类备注" :rows="4" /></label>
        </section>
      </template>
    </EqualHeightColumns>
  </section>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import EqualHeightColumns from '../../src/components/EqualHeightColumns/index.vue'
const gap = ref(24), resizable = ref(false)
const search = ref(''), selected = ref('运行保障'), note = ref('')
const categories = ['运行保障', '资料管理', '技术服务']
</script>
<style scoped>
.legacy-columns-example { display:flex; flex:1; flex-direction:column; min-width:0; min-height:0; padding:var(--space-4); }
.legacy-columns-example__options { display:flex; flex:none; align-items:center; flex-wrap:wrap; gap:var(--space-4); padding-bottom:var(--space-4); }
.legacy-columns-example__options label { display:flex; align-items:center; gap:var(--space-2); }
.legacy-columns-example__options .ant-select { width:5rem; }
.legacy-columns-example__workspace { flex:1; min-height:0; }
.legacy-columns-example__navigation,.legacy-columns-example__detail { display:flex; flex-direction:column; gap:var(--space-4); height:100%; min-height:0; overflow:auto; }
.legacy-columns-example h2 { margin:0; font-size:var(--fs-18); line-height:var(--lh-24); }
.legacy-columns-example__navigation > .ant-btn { flex:none; height:auto; min-height:44px; white-space:normal; text-align:start; }
.legacy-columns-example__navigation > [aria-pressed="true"] { color:var(--accent); background:var(--accent-soft); }
</style>
