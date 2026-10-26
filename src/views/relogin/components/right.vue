<template>
  <div class="content">
    <div class="top">
      <div class="header">
        <img alt="logo" class="logo" :src="logo || logoImage" />
        <p class="desc">{{ title }}</p>
      </div>
      <div class="main">
        <Form
          layout="vertical"
          :model="formData"
          :rules="rules"
          @finish="submit"
        >
          <form-item :label="$t('login.right.419974-0')" name="username">
            <Input
              v-model:value="formData.username"
              :placeholder="$t('login.right.419974-1')"
              :maxlength="64"
              autocomplete="off"
            />
          </form-item>
          <form-item :label="$t('login.right.419974-2')" name="password">
            <input-password
              v-model:value="formData.password"
              :placeholder="$t('login.right.419974-3')"
              :maxlength="64"
              autocomplete="off"
            />
          </form-item>
          <form-item
            v-if="showCode"
            :label="$t('login.right.419974-4')"
            name="verifyCode"
          >
            <Input
              v-model:value="formData.verifyCode"
              autocomplete="off"
              :maxlength="64"
              :placeholder="$t('login.right.419974-5')"
            >
              <template #addonAfter>
                <img :src="url.base64" @click="getVerifyCode()" />
              </template>
            </Input>
          </form-item>
          <form-item>
            <Remember
              v-model:value="formData.remember"
              v-model:expires="formData.expires"
            />
          </form-item>
          <form-item>
            <Button
              :loading="loading"
              type="primary"
              html-type="submit"
              class="login-form-button"
              block
            >
              {{ $t("login.right.419974-6") }}
            </Button>
          </form-item>
        </Form>
        <div class="other" v-if="bindings.length">
          <Divider plain>
            <div class="other-text">
              {{ $t("login.right.419974-7") }}
            </div>
          </Divider>
          <div class="other-button">
            <div
              class="other-button-item"
              v-for="(item, index) in bindings.slice(0, 4)"
              :key="index"
              @click="handleClickOther(item)"
            >
              <img
                style="width: 2rem; height: 2rem"
                :alt="item.name"
                :src="item.logoUrl || iconMap.get(item.provider) || defaultImg"
              />
            </div>
            <Popover
              trigger="click"
              v-model:open="moreVisible"
              placement="bottomRight"
            >
              <template #content>
                <j-scrollbar :max-height="120">
                  <div class="more-button">
                    <div
                      class="more-button-item"
                      v-for="(item, index) in bindings.slice(
                        4,
                        bindings.length - 1,
                      )"
                      :key="index"
                      @click="handleClickOther(item)"
                    >
                      <img
                        style="width: 2rem; height: 2rem"
                        :alt="item.name"
                        :src="
                          item.logoUrl ||
                          iconMap.get(item.provider) ||
                          defaultImg
                        "
                      />
                      <j-ellipsis style="width: calc(100%); margin: 0.3125rem auto">
                        {{ item.name }}
                      </j-ellipsis>
                    </div>
                  </div>
                </j-scrollbar>
              </template>
              <div v-if="bindings.length > 4" class="more">
                <AIcon
                  class="moreIcon"
                  type="MoreOutlined"
                  style="font-size: var(--fs-20)"
                ></AIcon>
              </div>
            </Popover>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts" name="LoginRight">
import { Form, FormItem, Button, Divider, Popover, Input, InputPassword } from 'ant-design-vue'
import Remember from './remember.vue'
import { rules } from './util'
import { resolvePublicAssetUrl } from '@jetlinks-web-core/utils/public-asset'
import { ssoIconMap as iconMap, defaultSsoIcon as defaultImg } from '@jetlinks-web-core/utils/sso-icon'
import { useReloginForm } from './useReloginForm'

type SsoBinding = { id: string; name?: string; provider: string; logoUrl?: string }
const props = withDefaults(defineProps<{
  loading?: boolean; logo?: string; title?: string; bindings?: SsoBinding[]; type?: string
}>(), { loading: false, logo: '', title: '', bindings: () => [], type: 'login' })
const emit = defineEmits<{ submit: []; 'update:loading': [loading: boolean] }>()
const logoImage = resolvePublicAssetUrl('images/login/logo.png')
const { moreVisible, formData, loading, url, showCode, getVerifyCode, submit, handleClickOther } = useReloginForm(props, emit)
</script>
<style lang="less" scoped>
.content {
  padding: 0 4.375rem;

  .top {
    //padding-top: 30%;

    .header {
      text-align: center;

      .desc {
        margin-top: var(--space-6);
        margin-bottom: var(--space-10);
        color: #000000b3;
        font-weight: 600;
        font-size: var(--fs-22);
        text-align: center;
      }
    }
  }

  .logo {
    display: block;
    height: 2.75rem;
    margin: 0 auto;
    vertical-align: top;
  }
}
.other {
  margin-top: var(--space-5);

  .other-text {
    color: #807676d9;
    font-size: var(--fs-12);
  }

  .other-button {
    position: relative;
    bottom: 0.625rem;
    text-align: center;
    display: flex;
    gap: var(--space-6);
    justify-content: center;
    flex-wrap: wrap;

    .other-button-item {
      cursor: pointer;
      padding: var(--space-1);
    }
  }

  .more {
    cursor: pointer;

    .moreIcon {
      transform: translateY(50%);
    }
  }
  .more {
    text-align: center;
    cursor: pointer;
  }
}

.more-button {
  display: flex;
  flex-wrap: wrap;
  cursor: pointer;
  overflow: auto;
  width: 18.75rem;

  .more-button-item {
    width: 3.875rem;
    text-align: center;
    margin-bottom: 0.625rem;
    margin-left: var(--space-3);
  }
}</style>
