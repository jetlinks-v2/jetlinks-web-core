<template>
    <j-scrollbar :height="`calc(100% - 3.1875rem)`">
        <div class="box">
        <div class="content">
            <template v-if="bindList.length">
                <div
                    class="content-item"
                    v-for="item in bindList"
                    :key="item.id"
                >
                    <div class="content-item-left">
                        <img
                            :src="
                                item.logoUrl ||
                                bindIcon[item.provider]
                            "
                            style="height: 1.5rem; width: 1.5rem"
                            alt=""
                        />
                        <j-ellipsis style="max-width: 12.5rem; color: #333; margin: 0 0.5rem 0 0.375rem">{{
                            item?.name
                        }}</j-ellipsis>
                        <div>
                            <span v-if="item.bound" style="color: #2BA245">{{ $t('BindThirdAccount.index.483756-0') }}</span>
                            <span v-else style="color: #999">{{ $t('BindThirdAccount.index.483756-1') }}</span>
                        </div>
                        <div v-if="item.others?.name" style="color: #666666">
                            {{ item.others?.name }}{{ $t('BindThirdAccount.index.483756-2') }}
                        </div>
                    </div>
                    <div class="content-item-right">
                        <a-popconfirm
                            v-if="item.bound"
                            :title="$t('BindThirdAccount.index.483756-3')"
                            @confirm="() => unBind(item.id)"
                        >
                            <a-button>{{ $t('BindThirdAccount.index.483756-4') }}</a-button>
                        </a-popconfirm>
                        <a-button
                            v-else
                            ghost
                            type="primary"
                            @click="clickBind(item.id)"
                            >{{ $t('BindThirdAccount.index.483756-5') }}</a-button
                        >
                    </div>
                </div>
            </template>
          <div v-else style="margin: 12.5rem 0">
            <CloudEmpty />
          </div>
        </div>
        </div>
    </j-scrollbar>
</template>

<script setup lang="ts">
import { BASE_API } from '@jetlinks-web/constants'
import { getSsoBinds_api , unBind_api} from '@jetlinks-web-core/api/account/center';
import { onlyMessage } from "@jetlinks-web/utils";
import { DingTalk, WeixinCorp } from '@jetlinks-web-core/assets/notice'
import { InternalStandalone, ThirdParty } from '@jetlinks-web-core/assets/apply'
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n();
const bindList = ref<any[]>([]);
const bindIcon = {
    'dingtalk-ent-app': DingTalk,
    'wechat-webapp': WeixinCorp,
    'internal-standalone': InternalStandalone,
    'third-party': ThirdParty,
};
const unBind = (id: string) => {
    unBind_api(id).then((resp) => {
        if (resp.status === 200) {
            onlyMessage($t('BindThirdAccount.index.483756-6'), 'success');
            getSsoBinds();
        }
    });
};
const clickBind = (id: string) => {
    window.open(
        `${BASE_API}/application/sso/${id}/login?autoCreateUser=false`,
    );
    localStorage.setItem('onBind', 'false');
    localStorage.setItem('onLogin', 'yes');
    window.onstorage = (e) => {
        if (e.newValue) {
            getSsoBinds();
        }
    };
};

/**
 * 获取绑定第三方账号
 */
function getSsoBinds() {
    getSsoBinds_api().then((resp: any) => {
        if (resp.status === 200) {
            bindList.value = resp.result.filter((item: any) => {
                return !item.features.includes('ssoUnsupportedRedirect')
            })
        }
    });
}

onMounted(() => {
    getSsoBinds();
});
</script>

<style lang="less" scoped>
.box {
    display: flex;
    justify-content: center;
    width: 100%;
    .content {
        width: 100%;
        .content-item {
            width: 100%;
            margin-bottom: var(--space-4);
            padding: 0.9375rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            height: 3.75rem;
            border-radius: var(--r-2);
            background: #f7f8fa;

            .content-item-left {
                display: flex;
                gap: var(--space-6);
                align-items: center;
            }
        }

        .content-item-right {
            :deep(button) {
                &:hover {
                    background-color: var(--jet-theme-primary);
                    color: #fff;
                }
            }

        }
    }
}</style>
