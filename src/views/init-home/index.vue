<!-- 系统初始化 -->
<template>
  <div class="page-container">
    <div class="container-text">
      <div class="container-title">{{ $t('init-home.index.011430-0') }}</div>
    </div>
    <div class="container-box">
      <div class="container-main">
        <div class="container-right">
          <a-spin :spinning="spinning">
            <a-collapse v-model:activeKey="activeKey" accordion>
              <a-collapse-panel key="1">
                <template #header>
                  <span class="title">{{ $t('init-home.index.011430-1') }}</span>
                  <span class="sub-title"
                  >{{ $t('init-home.index.011430-2') }}</span
                  >
                </template>
                <Basic ref="basicRef"/>
              </a-collapse-panel>
              <a-collapse-panel key="2" forceRender>
                <template #header>
                  <span class="title">{{ $t('init-home.index.011430-3') }}</span>
                  <span class="sub-title"
                  >{{ $t('init-home.index.011430-4') }}</span
                  >
                </template>
                <Menu ref="menuRef"></Menu>
              </a-collapse-panel>
              <a-collapse-panel key="3" forceRender>
                <template #header>
                  <span class="title">{{ $t('init-home.index.011072-0') }}</span>
                  <span class="sub-title"
                  >{{ $t('init-home.index.011072-1') }}</span
                  >
                </template>
                <Role ref="roleRef"></Role>
              </a-collapse-panel>
              <a-collapse-panel key="initData" forceRender>
                <template #header>
                  <span class="title">{{ $t('init-home.index.011072-23') }}</span>
                  <span class="sub-title">{{ $t('init-home.index.011072-24') }}</span>
                </template>
                <InitData ref="initDataRef"/>
              </a-collapse-panel>
            </a-collapse>
          </a-spin>
          <a-button
              type="primary"
              class="btn-style"
              @click="submitData"
              :loading="loading"
          >{{ $t('init-home.index.011430-5') }}
          </a-button
          >
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import Basic from './Basic/index.vue';
import Menu from './Menu/index.vue';
import Role from './Role/index.vue';
import InitData from './initData/index.vue';
import {getInit, saveInit} from '@jetlinks-web-core/api/initHome';
import {onlyMessage} from '@jetlinks-web/utils';
import {useI18n} from 'vue-i18n';

const {t: $t} = useI18n();
const basicRef = ref();
const roleRef = ref();
const initDataRef = ref();
const menuRef = ref();
const loading = ref(false);
/**
 * 默认打开第一个初始菜单
 */
const activeKey = ref<string>('1');
const spinning = ref<boolean>(false);

/**
 * 提交基础表单
 */
/**
 * 跳转首页
 */
const jump = () => {
  window.location.href = '/';
};
/**
 * 提交所有数据
 */
const submitData = async () => {
  loading.value = true;
  const basicRes = await basicRef.value.submitBasic().catch(() => {
    loading.value = false;
  });
  if (!basicRes) {
    return;
  }
  const menuRes = await menuRef.value.updateMenu();
  if (!menuRes) {
    loading.value = false;
    return;
  }
  const roleRes = await roleRef.value.submitRole();
  if (!roleRes) {
    loading.value = false;
    return;
  }
  const roleGroupRes = await roleRef.value.submitRoleGroup();
  if (!roleGroupRes) {
    loading.value = false;
    return;
  }
  const initDataRes = await initDataRef.value.save();
  if (!initDataRes) {
    loading.value = false;
    return;
  }
  // const initDataRes = await Promise.all(initDataRef.value.map((item: any) => item?.save?.()))
  // if (!initDataRes?.every(i => i)) {
  //   loading.value = false;
  //   return;
  // }
  // 保存ai初始化数据
  onlyMessage($t('init-home.index.011430-6'));
  // 记录初始化数据，跳转首页
  const res = await saveInit();
  if (res.success) {
    jump();
  }
};
/**
 * 判断是否已有配置
 */
const judgeInitSet = async () => {
  const resp: any = await getInit();
  if (resp.status === 200 && resp.result.length) {
    window.location.href = '/';
  }
};

// onBeforeMount(() => {
//   judgeInitSet();
// });
</script>
<style scoped lang="less">
.page-container {
  width: 100%;
  height: 100vh;
  padding: 2rem 8rem 4rem;
  overflow: hidden;
  background-image: url('@jetlinks-web-core/assets/init-home/background.png');
  background-repeat: no-repeat;
  background-size: 100% 100%;

  .container-text {
    font-weight: 700;
    font-size: var(--fs-16);

    .container-title {
      position: relative;
      padding-left: 0.625rem;
      color: var(--jet-theme-text-title);
      font-weight: 600;
      line-height: 1;

      &:before {
        position: absolute;
        top: 0;
        left: 0;
        width: 0.25rem;
        height: 100%;
        background-color: var(--jet-theme-primary);
        border-radius: 0 0.1875rem 0.1875rem 0;
        content: '';
      }
    }
  }

  .container-box {
    width: 100%;
    height: 100%;
    padding: var(--space-6);
    background: #fff;

    .container-main {
      display: flex;
      justify-content: space-between;
      width: 100%;
      height: 100%;
      overflow-y: auto;

      .container-right {
        width: calc(100% - 4.375rem);

        .title {
          font-size: var(--fs-15);
        }

        .sub-title {
          margin-top: 0.125rem;
          margin-left: var(--space-2);
          color: #666;
          font-size: var(--fs-12);
          opacity: 0.85;
        }

        .img-style {
          width: 1rem;
          height: 1rem;
          margin-left: 0.3125rem;
        }

        .upload-image-warp-logo {
          display: flex;
          justify-content: flex-start;

          .upload-image-border-logo {
            position: relative;
            overflow: hidden;
            border: 1px dashed var(--line);
            transition: all 0.3s;
            width: 10rem;
            height: 9.375rem;

            &:hover {
              border: 1px dashed var(--jet-theme-primary);
              display: flex;
            }

            .upload-image-content-logo {
              align-items: center;
              justify-content: center;
              position: relative;
              display: flex;
              flex-direction: column;
              width: 10rem;
              height: 9.375rem;
              padding: var(--space-2);
              background-color: var(--jet-theme-border-secondary);
              cursor: pointer;

              .loading-logo {
                position: absolute;
                top: 50%;
              }

              .loading-icon {
                position: absolute;
              }

              .upload-image {
                width: 100%;
                height: 100%;
                background-repeat: no-repeat;
                background-position: 50%;
                background-size: cover;
              }

              .upload-image-icon {
                width: 100%;
                height: 100%;
                background-repeat: no-repeat;
                background-position: 50%;
                background-size: inherit;
              }

              .upload-image-mask {
                align-items: center;
                justify-content: center;
                position: absolute;
                top: 0;
                left: 0;
                display: none;
                width: 100%;
                height: 100%;
                color: #fff;
                font-size: var(--fs-16);
                background-color: var(--jet-theme-text-disabled);
              }

              &:hover .upload-image-mask {
                display: flex;
              }
            }
          }
        }

        .upload-image-warp-back {
          display: flex;
          justify-content: flex-start;

          .upload-image-border-back {
            position: relative;
            overflow: hidden;
            border: 1px dashed var(--line);
            transition: all 0.3s;
            width: 35.625rem;
            height: 25.9375rem;

            &:hover {
              border: 1px dashed var(--jet-theme-primary);
              display: flex;
            }

            .upload-image-content-back {
              align-items: center;
              justify-content: center;
              position: relative;
              display: flex;
              flex-direction: column;
              width: 35.625rem;
              height: 25.9375rem;
              padding: var(--space-2);
              background-color: var(--jet-theme-border-secondary);
              cursor: pointer;

              .loading-back {
                position: absolute;
              }

              .upload-image {
                width: 100%;
                height: 100%;
                background-repeat: no-repeat;
                background-position: 50%;
                background-size: cover;
              }

              .upload-image-mask {
                align-items: center;
                justify-content: center;
                position: absolute;
                top: 0;
                left: 0;
                display: none;
                width: 100%;
                height: 100%;
                color: #fff;
                font-size: var(--fs-16);
                background-color: var(--jet-theme-text-disabled);
              }

              &:hover .upload-image-mask {
                display: flex;
              }
            }
          }
        }

        .upload-tips {
          color: var(--jet-theme-text-secondary);
          font-size: var(--fs-14);
          line-height: 1.5715;
        }

        // .uplod-style {
        //     :deep(.ant-upload.ant-upload-select-picture-card) {
        //         width: 11.25rem;
        //         height: 11.25rem;
        //     }
        // }
        .btn-style {
          margin-top: var(--space-5);
          color: #fff;
          border-color: var(--jet-theme-primary);
          background: var(--jet-theme-primary);
        }
      }
    }
  }

  ::-webkit-scrollbar {
    width: 0.75rem;
  }

  /* 滚动槽 */

  ::-webkit-scrollbar-track {
    background: #f2f2f2;
    border-radius: var(--r-3);
  }

  /* 滚动条滑块 */

  ::-webkit-scrollbar-thumb {
    background: #cecece;
    border-radius: var(--r-3);
  }
}</style>
