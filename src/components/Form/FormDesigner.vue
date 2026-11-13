<template>
  <div ref="root" class="fw-designer" :class="{ 'fw-dragging': designer.dragging.value }" @pointermove="designer.pointerMove" @pointerup="designer.pointerUp" @pointercancel="designer.clearPointer" @lostpointercapture="designer.clearPointer" @keydown.esc="designer.clearPointer(); designer.selected.value = undefined">
    <div class="fw-designer-toolbar">
      <Popover v-if="!designer.preview.value" v-model:open="designer.libraryOpen.value" trigger="click" placement="bottomLeft">
        <template #content><div class="fw-library" @pointermove="designer.pointerMove" @pointerup="designer.pointerUp" @pointercancel="designer.clearPointer" @lostpointercapture="designer.clearPointer"><div v-if="!designer.available.value.length" class="fw-library-empty">{{ t('noFields') }}</div><div v-for="field in designer.available.value" :key="field.key" class="fw-library-item" role="button" tabindex="0" @click="designer.addField(field.key)" @keydown.enter="designer.addField(field.key)" @pointerdown="designer.pointerDown($event, field.key)"><span>{{ text(field) }}</span><small>{{ t(field.multiple && field.type === 'enum' ? 'type_multiple' : `type_${field.type}`) }}</small><Button type="text" class="fw-drag-handle" :aria-label="t('drag', { label: text(field) })" @click.stop>⠿</Button></div></div></template>
        <Button type="text" class="fw-add-field">＋ {{ t('addField') }}</Button>
      </Popover>
      <Button v-if="!designer.preview.value" type="text" @click="designer.addSection">＋ {{ t('addSection') }}</Button>
      <Button v-if="!designer.preview.value" type="text" :disabled="!designer.history.value.length" :aria-label="t('undoLayout')" @click="designer.undo">↶</Button>
      <span class="fw-toolbar-spacer" />
      <Button type="text" @click="designer.togglePreview">{{ t(designer.preview.value ? 'design' : 'preview') }} →</Button>
    </div>
    <div class="fw-designer-scroll" @click="designer.canvasClick">
      <slot name="header" />
      <FormRenderer v-if="designer.preview.value" :fields="fields" :layout="layout" :values="designer.previewValues.value" @change="emit('sample-change', $event)">
        <template v-for="name in Object.keys($slots).filter(name => name.startsWith('value-') || name.startsWith('editor-'))" #[name]="scope"><slot :name="name" v-bind="scope || {}" /></template>
      </FormRenderer>
      <FormCanvas v-else :fields="fields" :layout="layout" :values="sampleValues" :selected-key="designer.selected.value" design @select-field="designer.select">
        <template #section-title="{ section }"><div class="fw-section-title"><span class="fw-section-name-wrap"><span aria-hidden="true">{{ designer.editingSection.value === section.id ? designer.sectionDraft.value : text(section) }}</span><Input class="fw-section-name" :value="designer.editingSection.value === section.id ? designer.sectionDraft.value : text(section)" :aria-label="t('section')" :bordered="false" @focus="designer.editSection(section)" @update:value="designer.sectionDraft.value = $event" @blur="designer.finishSection" @keydown.enter="!$event.isComposing && $event.keyCode !== 229 && ($event.target as HTMLInputElement).blur()" /></span><I18nInputTrigger :aria-label="`${text(section)} · ${$t('I18n.configure')}`" @configure="designer.editTranslations('section', section.id)" /></div></template>
        <template #section-actions="{ section }"><Button v-if="!section.items.length" type="text" :aria-label="t('removeSection')" @click="designer.removeSection(section.id)">×</Button></template>
        <template #label="{ field, item }">
          <span class="fw-design-label" @pointerdown.stop>
            <span v-if="designer.titleKey.value === field.key" class="fw-title-size"><span aria-hidden="true">{{ designer.titleDraft.value || ' ' }}</span><Input v-model:value="designer.titleDraft.value" class="fw-title-input" :aria-label="t('label')" @keydown="designer.titleKeydown" @blur="designer.finishTitle" /></span>
            <span v-else class="fw-name-display" role="button" tabindex="0" :title="label(field, item)" @click.stop="designer.editTitle(field.key)" @keydown.enter.stop="designer.editTitle(field.key)" @keydown.space.prevent.stop="designer.editTitle(field.key)">{{ label(field, item) }}</span>
            <I18nInputTrigger :aria-label="`${label(field, item)} · ${$t('I18n.configure')}`" @configure="designer.editTranslations('field', field.key)" />
          </span>
        </template>
        <template #value="{ field, item, value }">
          <div class="fw-design-target" role="button" tabindex="0" :aria-label="t('edit', { label: label(field, item) })" :data-drop="designer.drop.value?.target === field.key ? designer.drop.value.after ? 'after' : 'before' : undefined" @pointerdown="designer.pointerDown($event, field.key)" @click.stop="designer.select(field.key)" @keydown="designer.keydown($event, field.key)">
            <slot :name="`value-${field.renderer || field.key}`" :field="field" :item="item" :value="value"><FormValue :field="field" :item="item" :value="value" /></slot>
          </div>
        </template>
        <template #field-actions="{ field, item }">
          <Button type="text" class="fw-field-tool fw-drag-handle" :aria-label="t('drag', { label: label(field, item) })" :title="t('move')" @pointerdown="designer.pointerDown($event, field.key)" @click.stop @keydown="designer.keydown($event, field.key)"><HolderOutlined /></Button>
          <Button type="text" class="fw-field-tool" :aria-label="`${t('settings')} · ${label(field, item)}`" :title="t('settings')" @click.stop="designer.select(field.key)"><SettingOutlined /></Button>
          <Button v-if="designer.selected.value === field.key" type="text" class="fw-field-tool fw-remove-field" :aria-label="t('remove')" :title="t('remove')" @click.stop="designer.remove"><CloseOutlined /></Button>
        </template>
        <template #empty-section="{ section }"><div class="fw-drop-empty" :class="{ 'fw-drop-active': designer.drop.value?.section === section.id }" @click="designer.sectionId.value = section.id; designer.libraryOpen.value = true">{{ t('emptySection') }}</div></template>
      </FormCanvas>
    </div>
    <FormSettings v-if="!designer.preview.value && designer.selectedField.value && designer.selectedItem.value" :key="designer.selected.value" :class="{ 'fw-settings-left': designer.settingsSide.value === 'left' }" :field="designer.selectedField.value" :item="designer.selectedItem.value" :value="sampleValues[designer.selected.value!]" :section-id="designer.sectionId.value" :sections="layout.sections" @update="designer.patchItem" @rename="designer.editTitle(designer.selected.value!)" @close="designer.closeSettings" @shift="designer.shift" @move="designer.moveToSection" />
    <I18nTextDialog v-if="designer.translationTarget.value && designer.translationSource.value" visible :title="designer.translationLabel.value" :data="designer.translationSource.value.i18nMessages?.label" :display-value="designer.translationDefault.value" :fallback-messages="designer.translationFallback.value" @update:visible="!$event && (designer.translationTarget.value = undefined)" @confirm="designer.saveTranslations" />
  </div>
</template>

<script setup lang="ts">
import { ref, type PropType } from 'vue'
import { Button, Input, Popover } from 'ant-design-vue'
import { CloseOutlined, HolderOutlined, SettingOutlined } from '@ant-design/icons-vue'
import FormCanvas from './FormCanvas.vue'
import FormValue from './FormValue.vue'
import FormRenderer from './FormRenderer.vue'
import FormSettings from './FormSettings.vue'
import { useFormDesigner } from './useFormDesigner'
import { useFormLocale } from './locale'
import I18nInputTrigger from '../I18n/I18nInputTrigger.vue'
import I18nTextDialog from '../I18n/I18nTextDialog.vue'
import type { FormField, FormLayout, FormValues } from './types'
import './form.css'
const props = defineProps({
  fields: { type: Array as PropType<FormField[]>, required: true },
  layout: { type: Object as PropType<FormLayout>, required: true },
  sampleValues: { type: Object as PropType<FormValues>, default: () => ({}) },
})
const emit = defineEmits<{
  (event: 'update:layout', layout: FormLayout): void
  (event: 'sample-change', changes: FormValues): void
}>()
const root = ref<HTMLElement>()
const { t, locale, text, label } = useFormLocale()
const designer = useFormDesigner({ fields: () => props.fields, layout: () => props.layout, sampleValues: () => props.sampleValues, update: layout => emit('update:layout', layout), locale: () => locale.value, sectionLabel: () => ({ label: t('newSection'), i18nMessages: { label: { zh: t('newSection', {}, { locale: 'zh' }), en: t('newSection', {}, { locale: 'en' }) } } }) }, root)
</script>

<style scoped>
.fw-designer { container: fw-designer / inline-size; position: relative; height: 760px; max-height: calc(100dvh - 100px); min-height: 400px; display: flex; flex-direction: column; border: 1px solid var(--line, #e5e9ef); border-radius: 10px; background: var(--bg, #fff); }
.fw-designer-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 10px 14px; border-bottom: 1px solid var(--line, #e5e9ef); }
.fw-toolbar-spacer { flex: 1; }
.fw-designer-scroll { overflow: auto; padding: 0 28px 40px; min-height: 0; flex: 1; overscroll-behavior: contain; }
.fw-design-label { display: inline-flex; align-items: center; gap: 4px; max-width: 100%; }
/* 保留键盘与弹窗返回焦点，聚焦后再显示入口，不增加额外编辑状态。 */
.fw-design-label > :deep(.i18n-input-trigger-wrapper), .fw-section-title > :deep(.i18n-input-trigger-wrapper) { flex-shrink: 0; opacity: 0; pointer-events: none; }
.fw-design-label:focus-within > :deep(.i18n-input-trigger-wrapper), .fw-section-title:focus-within > :deep(.i18n-input-trigger-wrapper) { opacity: 1; pointer-events: auto; }
.fw-design-label :deep(.i18n-input-trigger), .fw-section-title :deep(.i18n-input-trigger) { color: var(--jet-theme-text-secondary, #697586); }
.fw-designer :deep(.i18n-input-trigger-wrapper:is(:hover, :focus-visible) .i18n-input-trigger) { color: var(--primary-color, #1677ff); }
.fw-section-title { display: flex; align-items: center; gap: 4px; min-width: 0; }
.fw-design-label > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: text; }
.fw-name-display { outline-offset: 2px; }
.fw-name-display:hover, .fw-section-name-wrap:hover .fw-section-name { box-shadow: inset 0 -1px var(--jet-theme-text-secondary, #8d9399); }
.fw-design-label:focus-within .fw-name-display { box-shadow: inset 0 -1px var(--primary-color, #1677ff); }
.fw-title-size { display: inline-block; position: relative; min-width: 24px; max-width: 100%; font: inherit; }
.fw-title-size > span { display: block; visibility: hidden; white-space: pre; padding-right: 3px; }
.fw-title-size :deep(.fw-title-input) { position: absolute; inset: 0; padding: 0; min-height: 0; height: 22px; width: 100%; min-width: 0; border: 0; border-radius: 0; background: transparent; color: var(--jet-theme-text, #1f2429); font: inherit; line-height: inherit; box-shadow: inset 0 -1px var(--primary-color, #1677ff); }
.fw-design-target { cursor: grab; position: relative; min-height: 26px; outline-offset: 4px; }
.fw-design-target[data-drop]::before { content: ''; position: absolute; top: -25px; bottom: -8px; width: 2px; background: var(--primary-color, #1677ff); }
.fw-design-target[data-drop="before"]::before { left: -14px; }
.fw-design-target[data-drop="after"]::before { right: -14px; }
.fw-drag-handle.ant-btn { cursor: grab; touch-action: none; }
.fw-remove-field.ant-btn:hover { color: var(--jet-theme-error, #cf3535); background: var(--jet-theme-error-bg, #fff2f0); }
.fw-section-name-wrap { display: inline-grid; min-width: 60px; max-width: 280px; min-height: 24px; overflow: hidden; }
.fw-section-name-wrap > span { visibility: hidden; white-space: pre; font-size: 14px; font-weight: 600; padding-right: 4px; grid-area: 1 / 1; }
.fw-section-name.ant-input { grid-area: 1 / 1; width: 0; min-width: 100%; padding: 0; border: 0; border-radius: 0; background: transparent; font-size: 14px; line-height: 24px; font-weight: 600; }
.fw-section-title:focus-within .fw-section-name { box-shadow: inset 0 -1px var(--primary-color, #1677ff); }
.fw-drop-empty { padding: 22px; border: 1px dashed var(--line, #e5e9ef); border-radius: 6px; text-align: center; color: var(--jet-theme-text-secondary, #8d9399); cursor: pointer; }
.fw-drop-active { border-color: var(--primary-color, #1677ff); }
.fw-library { display: flex; flex-direction: column; width: 260px; max-height: min(400px, 60vh); overflow: auto; }
.fw-library-item { position: relative; display: flex; gap: 10px; justify-content: space-between; align-items: center; text-align: left; min-height: 44px; padding: 8px 30px 8px 8px; cursor: pointer; border-radius: 4px; }
.fw-library-item:hover { background: var(--bg-sunken, #f5f7fa); }
.fw-library-item .fw-drag-handle { position: absolute; right: 0; top: 9px; padding: 0; width: 24px; height: 24px; color: var(--jet-theme-text-secondary, #697586); }
.fw-library small, .fw-library-empty { color: var(--jet-theme-text-secondary, #8d9399); font-size: 12px; }
.fw-dragging { user-select: none; cursor: grabbing; }
.fw-dragging :deep(.fw-settings) { pointer-events: none; opacity: .25; }
@container fw-designer (max-width: 600px) { .fw-designer-toolbar { gap: 6px; padding: 8px; } .fw-designer-toolbar :deep(.ant-btn) { min-height: 44px; } .fw-designer-scroll { padding: 0 20px 45vh; } .fw-library-item .fw-drag-handle { top: 0; width: 44px; height: 44px; } }
</style>
