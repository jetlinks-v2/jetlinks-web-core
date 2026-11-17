<template>
  <Button
    type="text"
    size="small"
    class="i18n-input-trigger-wrapper"
    :aria-label="$t('I18n.configure')"
    :title="$t('I18n.configure')"
    @mousedown.stop
    @click.stop="emit('configure')"
  >
    <GlobalOutlined class="i18n-input-trigger" />
  </Button>
</template>

<script setup lang="ts">
import { Button } from 'ant-design-vue'
import { GlobalOutlined } from '@ant-design/icons-vue'
const emit = defineEmits<{
  (event: 'configure'): void
}>()
</script>

<style scoped lang="less">
.i18n-input-trigger-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 5px;
}
@media (pointer: coarse) { .i18n-input-trigger-wrapper::before { content: ''; position: absolute; inset: -10px; display: block; } }

.i18n-input-trigger {
  color: var(--jet-theme-primary);
  cursor: pointer;
}
</style>
