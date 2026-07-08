<template>
  <div class="park-switch-redirect"></div>
</template>

<script setup name="ParkSwitchRedirect" lang="ts">
import { nextTick, onMounted } from 'vue'

const route = useRoute()
const router = useRouter()

onMounted(async () => {
  const target = Array.isArray(route.query.redirect)
    ? route.query.redirect[0]
    : route.query.redirect

  // 先完整进入中转页，再回到目标页，避免在同一轮 patch 里直接拆挂业务内容区。
  await nextTick()

  if (target && target !== route.fullPath) {
    await router.replace(target)
    return
  }

  await router.replace('/')
})
</script>

<style scoped>
.park-switch-redirect {
  min-height: 100%;
}
</style>
