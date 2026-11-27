<template>
  <div
    class="container"
    :class="{ 'container--small': size === 'small', 'container--disabled': disabled || saving }"
    role="button"
    :tabindex="disabled || saving ? -1 : 0"
    :aria-disabled="disabled || saving || undefined"
    :aria-label="label"
    @click.stop="onClick"
    @mousedown.stop
    @mouseup.stop
    @keydown.enter.stop.prevent="onClick"
    @keydown.space.stop.prevent="onClick"
  >
    <div
      v-if="_type"
      class="icon-display"
    >
      <AIcon :type="_type" />
    </div>
    <div
      v-else
      class="no-icon"
    >
      <AIcon type="PlusOutlined" />
    </div>
  </div>
  <SelectModal
    v-if="visible"
    :zIndex="props.zIndex"
    :value="type"
    :loading="saving"
    :error="error"
    @close="setVisible(false)"
    @save="onChange"
  />
</template>

<script setup lang="ts">
import { ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import SelectModal from './SelectModal.vue'
const props = defineProps({
  label: String,
  size: { type: String as PropType<'default' | 'small'>, default: 'default' },
  disabled: Boolean,
  save: Function as PropType<(value: string) => boolean | Promise<boolean>>,
  type: {
    type: String,
    default: ''
  },
  zIndex: {
    type: Number,
    default: 200000
  }
})

const emits = defineEmits(['change', 'update:type', 'visibleChange'])

const _type = ref()
const visible = ref(false)
const saving = ref(false)
const error = ref('')
const { t } = useI18n()

const setVisible = (value: boolean) => {
  if (!value && saving.value) return
  visible.value = value
  emits('visibleChange', value)
}

const onClick = () => {
  if (props.disabled || saving.value) return
  error.value = ''
  setVisible(true)
}

const onChange = async (val: string) => {
  if (props.disabled || saving.value) return
  saving.value = true
  error.value = ''
  try {
    if (props.save && !await props.save(val)) { error.value = t('Editable.saveFailed'); return }
    _type.value = val
    emits('update:type', val)
    emits('change', val)
    saving.value = false
    setVisible(false)
  } catch { error.value = t('Editable.saveFailed') }
  finally { saving.value = false }
}

watch(
  () => props.type,
  (newVal) => {
    _type.value = newVal
  },
  { deep: true, immediate: true }
)
</script>

<style scoped>
.container {
  width: 4.375rem;
  height: 4.375rem;
  border: 1px dashed var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-2);
  cursor: pointer;
  transition: all 0.3s;
}
.container:hover {
  border-color: var(--accent);
  background-color: var(--accent-soft);
}
.container .icon-display {
  font-size: var(--fs-32);
  color: var(--accent);
}
.container .no-icon {
  color: color-mix(in srgb, var(--ink-1) 47%, transparent);
  font-size: var(--fs-22);
}
.container--small { width:32px; height:32px; border-style:solid; }
.container--small .icon-display, .container--small .no-icon { font-size:16px; }
.container--disabled { cursor:default; opacity:.5; }
</style>
