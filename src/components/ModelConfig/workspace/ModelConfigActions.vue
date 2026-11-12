<template>
  <a-space class="model-config__edit-actions">
    <a-button
      v-if="workspace.activeType === 'model' && workspace.configTab === 'definition'"
      :disabled="workspace.editing"
      @click="workspace.toggleDefinitionViewMode"
    >
      <AIcon :type="workspace.definitionViewMode === 'form' ? 'CodeOutlined' : 'FormOutlined'" />
      {{ workspace.definitionViewMode === 'form' ? workspace.text.jsonFormat : workspace.text.formFormat }}
    </a-button>
    <a-button v-if="!workspace.editing" type="primary" @click="workspace.startEdit">
      <AIcon type="EditOutlined" />
      {{ workspace.text.edit }}
    </a-button>
    <template v-else>
      <a-button :disabled="workspace.fileSaving" @click="workspace.cancelEdit">{{ workspace.text.exitEdit }}</a-button>
      <a-button type="primary" :loading="workspace.fileSaving" @click="workspace.saveEdit">
        {{ workspace.text.save }}
      </a-button>
    </template>
  </a-space>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import type { ModelConfigWorkspace } from './useModelConfigWorkspace'

defineProps({
  workspace: { type: Object as PropType<ModelConfigWorkspace>, required: true }
})
</script>
