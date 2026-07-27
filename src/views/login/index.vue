<template>
  <a-spin
    :spinning="loading"
    :delay="300"
  >
    <div class="container">
      <div class="left">
        <img
          :src="frontConfig.background || bgImage"
          alt=""
        />
        <a
          v-if="basis?.showRecordNumber"
          href="https://beian.miit.gov.cn/#/Integrated/index"
          target="_blank"
          rel="noopener noreferrer"
          class="records"
        >
          {{ $t('login.index.102238-0') }}{{ basis?.recordNumber }}
        </a>
      </div>
      <div class="right">
        <Right
          :logo="frontConfig.logo"
          :title="layout?.title"
          :bindings="bindings"
          v-model:loading="loading"
        />
      </div>
    </div>
  </a-spin>
</template>
<script setup name="Login" lang="ts">
import { LocalStore } from '@jetlinks-web/utils'
import { resolvePublicAssetUrl } from '@jetlinks-web-core/utils/public-asset'
import { useSystemStore } from '@jetlinks-web-core/store/system'
import { storeToRefs } from 'pinia'
import Right from './right.vue'
import { bindInfo } from '@jetlinks-web-core/api/login'
import { useI18n } from 'vue-i18n'

const { t: $t } = useI18n()
const systemStore = useSystemStore()
const { systemInfo, layout } = storeToRefs(systemStore)
const loading = ref(false)

const bgImage = resolvePublicAssetUrl('images/login/login.png')
const bindings = ref([])

const frontConfig = computed(() => ({
  ...(systemInfo.value.front || {}),
  logo: resolvePublicAssetUrl(systemInfo.value.front?.logo),
  background: resolvePublicAssetUrl(systemInfo.value.front?.background),
}))

const basis: any = computed(() => frontConfig.value)

const getOpen = async () => {
  await systemStore.queryVersion()
  const version = LocalStore.get('system_edition')
  if (version !== 'community') {
    bindInfo().then((res: any) => {
      if (res.success) {
        bindings.value = res.result
      }
    })
  }
  await systemStore.querySingleInfo('front')
}

getOpen()
</script>

<style scoped lang="less">
.container {
  display: flex;
  height: 100vh;
  background-color: #fff;
  > div {
    height: 100%;
  }

  .left {
    flex: 1;
    img {
      height: 100%;
      width: 100%;
      object-fit: cover;
      display: block;
    }
    .records {
      position: absolute;
      top: 96%;
      left: 35%;
      color: var(--jet-theme-text-disabled);
      font-size: var(--fs-14);
    }
  }

  .right {
    min-width: 25rem;
    width: 27%;
    display: flex;
    padding-top: 10%;
    flex-direction: column;
    justify-content: space-between;
  }
}</style>
