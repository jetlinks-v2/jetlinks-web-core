<template>
  <a-spin
    :spinning="loading"
    :delay="300"
  >
    <div class="container">
      <div class="header">
        <img alt="logo" class="logo" :src="systemInfo?.front?.logo || logoImage" />
        <div>
          <div class="title">{{ layout?.title }}</div>
          <div class="desc">
            Detana Smart Campus Management Platform
          </div>
        </div>
      </div>
      <div class="left">
        <img
          :src="systemInfo?.front?.background || bgImage"
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
        <Right v-model:loading="loading" />
      </div>
    </div>
  </a-spin>
</template>
<script setup name="Login" lang="ts">
import { getImage, LocalStore } from '@jetlinks-web/utils'
import { useSystemStore } from '@jetlinks-web-core/store/system'
import { storeToRefs } from 'pinia'
import Right from './right.vue'
import { bindInfo } from '@jetlinks-web-core/api/login'
import { useI18n } from 'vue-i18n'

const { t: $t } = useI18n()
const systemStore = useSystemStore()
const { systemInfo, layout } = storeToRefs(systemStore)
const loading = ref(false)

const logoImage = getImage('/login/logo.png')
const bgImage = getImage('/login/login.png')

// const bindings = ref([])

const basis: any = computed(() => {
  return systemInfo.value.front || {}
})

const getOpen = async () => {
  await systemStore.queryVersion()
  const version = LocalStore.get('system_edition')
  // if (version !== 'community') {
  //   bindInfo().then((res: any) => {
  //     if (res.success) {
  //       bindings.value = res.result
  //     }
  //   })
  // }
  await systemStore.querySingleInfo('front')
}

getOpen()
</script>

<style scoped lang="less">
.container {
  display: flex;
  height: 100vh;
  background-color: #fff;

  .header {
    position: absolute;
    display: flex;
    left: 24px;
    top: 24px;
    gap: 6px;
    align-items: center;

    img {
      width: 40px;
      height: 40px;
    }

    .title {
      color: #111B27;
      font-size: 24px;
      font-weight: 500;
    }

    .desc {
      color: #5B7697;
      font-size: 13px;
      font-weight: 500;
    }
  }

  .left {
    width: 100%;
    height: 100%;

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
    position: absolute;
    right: 72px;
    border-radius: 16px;
    border: 2px solid #FFF;
    background: rgba(255, 255, 255, 0.60);
    backdrop-filter: blur(7px);
    width: 397px;
    //height: 474px;
    top: calc((100% - 474px) / 2);
  }
}</style>
