<!-- 第三方账户绑定 -->
<template>
  <div class="page-container">
    <div class="content-bind">
      <div class="title">{{ $t("bind.index.350992-0") }}</div>
      <!-- 已登录-绑定三方账号 -->
      <template v-if="!!token">
        <div class="info">
          <div class="info-body">
            <a-avatar
              :size="72"
              :src="user?.avatar || jetlinksLogoImg"
              class="info-body-avatar"
            />
            <div class="info-body-item">
              <span>{{ $t("bind.index.350992-1") }}</span>
              <j-ellipsis :lineClamp="2">{{
                user?.username || "-"
              }}</j-ellipsis>
            </div>
            <div class="info-body-item">
              <span>{{ $t("bind.index.350992-2") }}</span>
              <j-ellipsis :lineClamp="2">{{ user?.name || "-" }}</j-ellipsis>
            </div>
          </div>
          <AIcon type="SwapOutlined" class="info-connector" aria-hidden="true" />
          <div class="info-body">
            <a-avatar
              :size="72"
              :src="
                bindUser.result?.avatar ||
                iconMap.get(bindUser?.applicationProvider) ||
                internalStandaloneImg
              "
              class="info-body-avatar"
            />
            <div class="info-body-item">
              <span>{{ $t("bind.index.350992-1") }}</span>
              <j-ellipsis :lineClamp="2">{{
                bindUser?.result?.userId || ""
              }}</j-ellipsis>
            </div>
            <div class="info-body-item">
              <span>{{ $t("bind.index.350992-2") }}</span>
              <j-ellipsis :lineClamp="2">{{
                bindUser?.result?.name || ""
              }}</j-ellipsis>
            </div>
          </div>
        </div>
        <div class="bind-action">
          <a-button type="primary" @click="handleBind"
            >{{ $t("bind.index.350992-3") }}
          </a-button>
        </div>
      </template>
      <!-- 未登录-绑定三方账号 -->
      <template v-else>
        <div class="not-login">
          <div class="logo">
            <img :src="jetlinksLogoImg" />
            <AIcon type="SwapOutlined" class="arrow" aria-hidden="true" />
            <img
              :src="
                bindUser?.avatar || iconMap.get(bindUser?.applicationProvider)
              "
            />
          </div>
          <div class="desc">
            {{ $t("bind.index.350992-4") }}
            {{ bindUser?.appName }}
            {{ $t("bind.index.350992-5") }}
          </div>
          <div class="login-form">
            <a-form layout="vertical">
              <a-form-item
                :label="$t('bind.index.350992-6')"
                v-bind="validateInfos.username"
              >
                <a-input
                  v-model:value="formData.username"
                  :placeholder="$t('bind.index.350992-7')"
                />
              </a-form-item>
              <a-form-item
                :label="$t('bind.index.350992-8')"
                v-bind="validateInfos.password"
              >
                <a-input-password
                  v-model:value="formData.password"
                  :placeholder="$t('bind.index.350992-9')"
                />
              </a-form-item>
              <template v-if="captcha.base64">
                <a-form-item
                  :rules="[
                    {
                      required: true,
                      message: $t('bind.index.350992-10'),
                    },
                  ]"
                  :label="$t('bind.index.350992-11')"
                  v-bind="validateInfos.verifyCode"
                >
                  <a-input
                    v-model:value="formData.verifyCode"
                    :placeholder="$t('bind.index.350992-10')"
                  >
                    <template #addonAfter>
                      <img
                        :src="captcha.base64"
                        style="cursor: pointer"
                        @click="getCode"
                      />
                    </template>
                  </a-input>
                </a-form-item>
              </template>
              <a-form-item>
                <a-button
                  style="width: 100%"
                  type="primary"
                  @click="handleLoginBind"
                >
                  {{ $t("bind.index.350992-12") }}
                </a-button>
              </a-form-item>
            </a-form>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script lang="ts" name="AccountBind" setup>
import { onlyMessage, LocalStore, encrypt } from "@jetlinks-web/utils";
import { TOKEN_KEY } from "@jetlinks-web/constants";
import { Form } from "ant-design-vue";

import { applicationInfo, bindAccount } from "@jetlinks-web-core/api/system/bind";
import { codeUrl, authLogin, userDetail, encryptionConfig } from "@jetlinks-web-core/api/login";
import { useSystemStore } from "@jetlinks-web-core/store/system";
import { useI18n } from "vue-i18n";
import jetlinksLogoImg from "@jetlinks-web-core/assets/bindPage/jetlinksLogo.png";
import internalStandaloneImg from "@jetlinks-web-core/assets/apply/internal-standalone.png";
import wechatImg from "@jetlinks-web-core/assets/bindPage/wechat-webapp.png";
import dingtalkImg from "@jetlinks-web-core/assets/bindPage/dingtalk.png";
import thirdPartyImg from "@jetlinks-web-core/assets/apply/third-party.png";

const { t: $t } = useI18n();

const useForm = Form.useForm;
const systemStore = useSystemStore();

interface formData {
  username: string;
  password: string;
  verifyCode: string;
}

const iconMap = new Map();
iconMap.set("dingtalk-ent-app", dingtalkImg);
iconMap.set("wechat-webapp", wechatImg);
iconMap.set("internal-standalone", internalStandaloneImg);
iconMap.set("third-party", thirdPartyImg);

const token = computed(() => LocalStore.get(TOKEN_KEY));

/**
 * 用户信息
 */
const user = ref();
const getDetail = () => {
  if (!token.value) return;
  userDetail().then((res: any) => {
    user.value = res?.result;
  });
};

/**
 * 获取url参数
 */
const getUrlCode = () => {
  const url = new URLSearchParams(window.location.href);
  return url.get("code") as string;
};

/**
 * 三方应用信息
 */
const bindUser = ref<any>({ appName: "" });
const getAppInfo = async () => {
  const code = getUrlCode();
  const { result, success } = await applicationInfo(code);
  bindUser.value = result || {};

  if (success) {
    if (result?.applicationProvider === "dingtalk-ent-app") {
      bindUser.value.appName = $t("bind.index.350992-13");
    } else if (result?.applicationProvider === "wechat-webapp") {
      bindUser.value.appName = $t("bind.index.350992-14");
    } else {
      bindUser.value.appName = result?.applicationName;
    }
  }
};

/**
 * 立即绑定
 */
const handleBind = async () => {
  const code = getUrlCode();
  const res = await bindAccount(code);
  console.log("bindAccount: ", res);
  onlyMessage($t("bind.index.350992-15"));
  goRedirect();
  setTimeout(() => window.close(), 1000);
};

// 未登录-先登录再绑定
const formData = ref<formData>({
  username: "",
  password: "",
  verifyCode: "",
});
const formRules = ref({
  username: [
    {
      required: true,
      message: $t("bind.index.350992-7"),
    },
  ],
  password: [
    {
      required: true,
      message: $t("bind.index.350992-9"),
    },
  ],
});

const { resetFields, validate, validateInfos } = useForm(
  formData.value,
  formRules.value,
);

/**
 * 获取图形验证码
 */
const captcha = ref({
  base64: "",
  key: "",
});
const getCode = async () => {
  const res: any = await codeUrl();
  captcha.value.base64 = res.result?.base64;
  captcha.value.key = res.result?.key;
};

const RsaConfig = reactive<any>({
  enabled: false, //是否加密
  publicKey: "", //rsa公钥,使用此公钥对密码进行加密
  id: "", //密钥ID
});
/**
 * 登录并绑定账户
 */
const handleLoginBind = () => {
  validate()
    .then(async () => {
      const code = getUrlCode();
      const params: any = {
        ...formData.value,
        bindCode: code,
        expires: 3600000,
      };
      const resq: any = await encryptionConfig();
      if (resq.status === 200) {
        if (resq.result?.encrypt) {
          RsaConfig.enabled = resq.result?.encrypt.enabled;
          RsaConfig.publicKey = resq.result?.encrypt.publicKey;
          RsaConfig.id = resq.result?.encrypt.id;
        }
      }
      if (captcha.value.base64) {
        params.verifyKey = captcha.value.key;
      } else {
        delete params.verifyCode;
      }
      const data = {
        ...params,
        password: RsaConfig.enabled
          ? encrypt(params.password, RsaConfig.publicKey)
          : params.password,
        encryptId: RsaConfig.enabled ? RsaConfig.id : undefined,
      };
      const res = await authLogin(data);
      console.log("res: ", res);
      if (res.success) {
        onlyMessage($t("bind.index.350992-16"));
        LocalStore.set(TOKEN_KEY, res.result!.token as string);
        goRedirect();
      }
    })
    .catch((err) => {
      console.log(err);
      getCode();
    });
};

const getQueryVariable = (): Map<string, string> => {
  const index = window.location.href.indexOf("?");
  const paramsUrl = window.location.href.substr(index + 1);
  const paramsArr = paramsUrl.split("#")?.[0] || "";

  const vars = paramsArr.split("&");
  const maps = new Map();
  for (let i = 0; i < vars.length; i++) {
    const pair = vars[i].split("=");
    const [key, value] = pair;
    maps.set(key, value);
  }
  return maps;
};
/**
 * 绑定成功跳转至页面url的: redirect
 */
const goRedirect = () => {
  const urlParams = getQueryVariable();
  const redirectUrl =
    urlParams.get("redirect") || window.location.href.split("redirect=")?.[1];
  console.log("redirectUrl: ", redirectUrl);
  //内部集成需要跳回它们页面
  if (redirectUrl && redirectUrl.indexOf("account/center/bind") === -1) {
    window.location.href = decodeURIComponent(redirectUrl);
  } else {
    window.location.href = "/";
    setTimeout(() => window.close(), 1000);
  }
};

onMounted(() => {
  getAppInfo();
  getCode();
  getDetail();
  // systemStore.getFront()
});
</script>

<style lang="less" scoped>
:deep(
  .ant-form-item-label
    > label.ant-form-item-required:not(
      .ant-form-item-required-mark-optional
    )::before
) {
  display: none;
}

:deep(.ant-form-item-label > label) {
  font-weight: 500;
}

.page-container {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  padding: var(--space-6);
  background: var(--jet-theme-bg-layout) url('@jetlinks-web-core/assets/bindPage/bindPage.png') center bottom / cover no-repeat;

  .content-bind {
    box-sizing: border-box;
    width: min(100%, 48rem);
    padding: var(--space-10);
    border: 1px solid var(--jet-theme-border-secondary);
    border-radius: var(--r-5);
    background: var(--jet-theme-bg-container);
    box-shadow: var(--shadow-pop);

    .title {
      margin-bottom: var(--space-8);
      color: var(--jet-theme-text-title);
      font-size: var(--fs-20);
      font-weight: 600;
      line-height: var(--lh-normal);
      text-align: center;
    }

    .info {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 2rem minmax(0, 1fr);
      align-items: stretch;
      gap: var(--space-5);

      &-connector {
        align-self: start;
        justify-self: center;
        margin-top: calc(var(--space-4) + 1.625rem);
        color: var(--jet-theme-primary);
        font-size: var(--fs-20);
      }

      &-body {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-2);
        min-width: 0;
        padding: var(--space-4) var(--space-2);

        &-avatar {
          flex: none;
          margin-bottom: var(--space-2);
        }

        &-item {
          display: flex;
          align-items: baseline;
          justify-content: center;
          width: 100%;
          min-width: 0;
          color: var(--jet-theme-text);
          font-size: var(--fs-14);
          line-height: var(--lh-normal);

          > span:first-child {
            flex: none;
            color: var(--jet-theme-text-secondary);
            white-space: nowrap;
          }

          :deep(.j-ellipsis) {
            min-width: 0;
            overflow-wrap: anywhere;
          }
        }
      }
    }

    .bind-action {
      display: flex;
      justify-content: center;
      margin-top: var(--space-8);

      :deep(.ant-btn) {
        min-width: 10rem;
        height: 2.5rem;
      }
    }

    .not-login {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 0;

      .logo {
        display: flex;
        align-items: center;
        gap: var(--space-5);

        img {
          width: 3rem;
          height: 3rem;
          object-fit: contain;
        }

        .arrow {
          color: var(--jet-theme-primary);
          font-size: var(--fs-20);
        }
      }

      .desc {
        margin: var(--space-6) 0;
        color: var(--jet-theme-text-secondary);
        font-size: var(--fs-14);
        line-height: var(--lh-relaxed);
        text-align: center;
        overflow-wrap: anywhere;
      }

      .login-form {
        width: min(100%, 24rem);
      }
    }
  }
}

@media (max-width: 36rem) {
  .page-container {
    padding: var(--space-4);

    .content-bind {
      padding: var(--space-6);

      .title { margin-bottom: var(--space-6); }
      .info { grid-template-columns: minmax(0, 1fr); gap: var(--space-2); }
      .info-connector { margin-top: 0; transform: rotate(90deg); }
      .bind-action { margin-top: var(--space-6); }
      .bind-action :deep(.ant-btn) { width: 100%; }
    }
  }
}
</style>
