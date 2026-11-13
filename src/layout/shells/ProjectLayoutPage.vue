<template>
  <BasicLayoutShell
    class="project-layout-page"
    variant="project"
    layout="mix"
    :expandSecondaryMenu="true"
  />
</template>

<script setup lang="ts">
import BasicLayoutShell from './BasicLayoutShell.vue'

defineOptions({ name: 'ProjectLayoutPage' })
</script>

<style scoped lang="less" src="./ProjectLayoutPage.less"></style>
