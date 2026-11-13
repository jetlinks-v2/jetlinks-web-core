<template>
  <div class="expression-functions" :class="{'is-compact':compact}">
    <div class="expression-functions__search"><a-input ref="searchInput" v-model:value="query" :bordered="false" allow-clear :placeholder="placeholder" :aria-label="placeholder" @keydown="searchKeydown"><template #prefix><AIcon type="SearchOutlined" /></template></a-input></div>
    <a-menu class="expression-functions__list" :selected-keys="selectedId ? [selectedId] : []" @click="emit('choose',{key:$event.key})">
      <a-menu-item-group v-for="group in groups" :key="group.id" :title="group.label">
        <a-menu-item v-for="item in group.items" class="expression-functions__option" :key="item.id" :disabled="item.disabled" :title="[item.name,item.description].filter(Boolean).join(' · ')" @pointerenter="!item.disabled && emit('preview',{key:item.id})" @focus="!item.disabled && emit('preview',{key:item.id})">
          <SelectOption :label="item.name" :description="item.description">
            <template #icon>
              <span class="expression-functions__symbol" :title="item.name" aria-hidden="true">
                <span v-if="item.icon?.startsWith('text:')" class="expression-functions__notation" :class="{'is-long':Array.from(item.icon.slice(5)).length > 4}">{{ item.icon.slice(5) }}</span>
                <AIcon v-else :type="item.icon || group.icon" />
              </span>
            </template>
          </SelectOption>
        </a-menu-item>
      </a-menu-item-group>
      <a-menu-item v-if="error" key="retry" @click.stop="emit('retry')"><slot name="error" /></a-menu-item>
    </a-menu>
    <p v-if="!groups.length && !error" class="expression-functions__empty">{{ emptyText }}</p>
  </div>
</template>
<script setup lang="ts">
import SelectOption from '../SelectOption/index.vue'
import { onMounted,ref } from 'vue'
import { useExpressionCandidateMenu,type CandidateGroup } from './useExpressionCandidateMenu'
const props=defineProps<{groups:CandidateGroup[];placeholder:string;emptyText:string;selectedId?:string|number;error?:boolean;compact?:boolean}>()
const emit=defineEmits<{(event:'choose',value:{key:string|number}):void;(event:'preview',value:{key:string|number}):void;(event:'retry'):void;(event:'close'):void}>()
const {query,groups,first}=useExpressionCandidateMenu(props)
const searchInput=ref<{focus(options?:FocusOptions):void}>()
onMounted(()=>searchInput.value?.focus({preventScroll:true}))
function searchKeydown(event: KeyboardEvent) {
  event.stopPropagation()
  if (event.key === 'Enter') { event.preventDefault(); if (first.value) emit('choose',{key:first.value.id}) }
  else if (event.key === 'Escape') { event.preventDefault(); emit('close') }
}
</script>
<style scoped>
.expression-functions { display:flex; flex-direction:column; box-sizing:border-box; width:min(320px,calc(100vw - 32px)); height:min(320px,calc(50dvh - 32px)); padding:6px; border:1px solid var(--line); border-radius:8px; background:var(--bg,#fff); box-shadow:0 6px 20px rgb(0 0 0 / 10%) }
.expression-functions.is-compact { width:min(296px,calc(100vw - 32px)); height:min(280px,calc(50dvh - 32px)) }
.expression-functions__search { flex:none; padding:2px 12px 6px; border-bottom:1px solid var(--line) }
.expression-functions__search:focus-within { border-bottom-color:var(--accent,#1677ff) }
/* Search keeps its own input metrics inside inline rule editors and native dialogs. */
.expression-functions .expression-functions__search :deep(.ant-input-affix-wrapper) { display:flex; align-items:center; height:32px; padding:0; border:0; border-radius:0; background:transparent; box-shadow:none }
.expression-functions .expression-functions__search :deep(input.ant-input) { flex:1; width:0; min-width:0; height:24px; padding:0; border:0; border-radius:0; background:transparent; box-shadow:none; font-size:14px; line-height:24px }
.expression-functions__search :deep(.ant-input-prefix) { display:inline-flex; flex:0 0 40px; justify-content:center; margin-inline-end:12px; color:var(--ink-2,#595959); font-size:16px }
.expression-functions__search :deep(.ant-input-suffix) { flex:none; margin-inline-start:8px }
.expression-functions__list { flex:1; min-height:0; max-height:320px; margin:0; padding:4px 0 0; overflow:auto; border:0; box-shadow:none; background:transparent }
/* Dropdown normalizes Menu's prefix; own row classes keep both hosts consistent. */
.expression-functions__list :deep(:is(.ant-menu-item-group-title,.ant-dropdown-menu-item-group-title)) { padding:8px 12px 4px; color:var(--jet-theme-text-secondary,#666); font-size:12px; font-weight:500; line-height:18px }
.expression-functions__list :deep(:is(.ant-menu-item-group-title,.ant-dropdown-menu-item-group-title):empty) { display:none }
.expression-functions__list :deep(:is(.ant-menu-item-group-list,.ant-dropdown-menu-item-group-list)) { margin:0 }
.expression-functions__list :deep(:is(.ant-menu-item-group,.ant-dropdown-menu-item-group) + :is(.ant-menu-item-group,.ant-dropdown-menu-item-group)) { margin-top:4px; border-top:1px solid var(--line) }
.expression-functions__list :deep(.expression-functions__option) { height:auto; min-height:52px; margin:0; padding:6px 12px; border-radius:4px; line-height:20px; white-space:normal }
.expression-functions__list :deep(.select-option) { display:grid; grid-template-columns:40px minmax(0,1fr); align-items:center; min-width:0; max-width:none; width:100%; padding:0; gap:12px }
.expression-functions__list :deep(.select-option__text) { gap:2px; font-size:14px; font-weight:500; line-height:20px }
.expression-functions__list :deep(.select-option__text small) { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; color:var(--jet-theme-text-secondary,#666); font-size:12px; font-weight:400; line-height:18px }
.expression-functions__symbol { display:inline-flex; align-items:center; justify-content:center; width:40px; height:40px; color:var(--ink-2,#595959); font-family:inherit; font-size:18px; font-weight:500; line-height:1; white-space:nowrap }
.expression-functions__symbol :deep(.anticon) { font-size:20px }
.expression-functions__notation.is-long { font-size:14px }
.expression-functions__empty { margin:14px 12px; font-size:13px; color:var(--jet-theme-text-secondary,#666) }
.is-compact .expression-functions__search { padding:0 8px 4px }
.is-compact .expression-functions__search :deep(.ant-input-affix-wrapper) { height:28px }
.is-compact .expression-functions__search :deep(input.ant-input) { font-size:13px }
.is-compact .expression-functions__search :deep(.ant-input-prefix) { flex-basis:28px; margin-inline-end:8px }
.is-compact .expression-functions__list :deep(.expression-functions__option) { min-height:44px; padding:4px 8px }
.is-compact .expression-functions__list :deep(.select-option) { grid-template-columns:28px minmax(0,1fr); gap:8px }
.is-compact .expression-functions__list :deep(.select-option__text) { gap:1px; font-size:13px; line-height:18px }
.is-compact .expression-functions__list :deep(.select-option__text small) { line-height:17px }
.is-compact .expression-functions__symbol { width:28px; height:28px; font-size:17px }
.is-compact .expression-functions__symbol :deep(.anticon) { font-size:18px }
.is-compact .expression-functions__notation.is-long { font-size:12px }
</style>
