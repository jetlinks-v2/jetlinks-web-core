<template>
  <div class="remote-component-wrapper">
    <!-- 加载中状态 -->
    <div v-if="loading" class="loading-state">
      <slot name="loading">
        <div class="default-loading">
          <a-spin size="small" />
          <span>正在加载远程组件...</span>
        </div>
      </slot>
    </div>

    <!-- 远程组件 -->
    <component
      v-else-if="component"
      :is="component"
      v-bind="componentProps"
      v-on="componentEvents"
    >
      <template v-for="(_, key) in slots" :key="key" #[key]="slotProps">
        <slot :name="key" v-bind="slotProps"></slot>
      </template>
    </component>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <slot name="empty">
        <CloudEmpty description="远程组件未找到" />
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'

interface Props {
  /** 远程应用名称 */
  remoteName: string
  /** 组件名称 */
  componentName: string
  /** 远程组件地址 */
  remotePath?: string
  /** 传递给远程组件的props */
  componentProps?: Record<string, any>
  /** 传递给远程组件的事件 */
  componentEvents?: Record<string, (...args: any[]) => void>
  /** 超时时间 */
  timeout?: number
}
const slots = useSlots()
const props = withDefaults(defineProps<Props>(), {
  componentProps: () => ({}),
  componentEvents: () => ({}),
  cache: true,
  timeout: 10000
})

const component = ref()
const loading = ref(true)

onMounted(async () => {
  // 默认是从注册中心获取远程或者本地组件
  if (!moduleRegistry.hasModule(props.remoteName) && props.remotePath) {
    await moduleRegistry.loadRemoteComponent(props.remoteName, props.remotePath, props.componentName)
  }

  component.value = await moduleRegistry.getResourceItem(props.remoteName, 'components', props.componentName)
  loading.value = false
})

</script>

<style scoped>
.remote-component-wrapper .loading-state {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--space-10);
}
.remote-component-wrapper .loading-state .default-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  color: var(--ink-3);
}
.remote-component-wrapper .loading-state .default-loading span {
  font-size: var(--fs-14);
}
.remote-component-wrapper .error-state {
  padding: var(--space-5);
}
.remote-component-wrapper .empty-state {
  padding: var(--space-10);
  text-align: center;
}
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}</style>
