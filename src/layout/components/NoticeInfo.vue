<template>
    <div class="notice-info-container">
        <a-tabs
            v-model:activeKey="activeKey"
            :destroyInactiveTabPane="true"
            @change="onChange"
            v-if="tabs.length"
        >
            <a-tab-pane v-for="item in tabs" :key="item.key">
                <template #tab>
                    <NoticeTab
                        :tab="item?.tab"
                        :count="tabCountMap[item.key]?.count"
                        :overflow="tabCountMap[item.key]?.overflow"
                    />
                </template>
                <a-spin :spinning="loading">
                    <div class="content">
                        <div class="list" v-if="list.length">
                            <template v-for="(i,index) in list" :key="i.id">
                                <NoticeItem
                                    :data="i"
                                    :type="item.key"
                                    @action="emits('action')"
                                    @refresh="onRefresh"
                                />
                            </template>
                            <div
                                v-if="list.length < DROPDOWN_PAGE_SIZE"
                                style="
                                    color: #666666;
                                    text-align: center;
                                    padding: 0.5rem;
                                "
                            >
                                {{ $t('components.NoticeInfo.811677-0') }}
                            </div>
                        </div>
                        <div class="no-data" v-else>
                            <CloudEmpty />
                        </div>
                        <div class="btns">
                            <a-button type="link" @click="onMore(item.key)"
                                >{{ $t('components.NoticeInfo.811677-1') }}</a-button
                            >
                        </div>
                    </div>
                </a-spin>
            </a-tab-pane>
        </a-tabs>
        <div class="no-data" v-else>
            <CloudEmpty />
        </div>
    </div>
</template>

<script setup lang="ts">
import { getUnreadNoPagingList_api, getUnreadSummary_api } from '@jetlinks-web-core/api/account/notificationRecord';
import { useMenuStore } from '@jetlinks-web-core/store/menu';
import { useUserStore } from '@jetlinks-web-core/store/user';
import NoticeItem from './NoticeItem.vue';
import NoticeTab from './NoticeTab.vue';
import { useI18n } from 'vue-i18n';
import {
    BADGE_OVERFLOW_COUNT,
    type CappedUnreadCount,
    createTabCountMap,
    createUnreadQueryParams,
    type NoticeTabItem,
} from './noticeUtils';

const { t: $t } = useI18n();
const emits = defineEmits(['action']);
const DROPDOWN_PAGE_SIZE = 12;

const props = defineProps({
    tabs: {
        type: Array as PropType<NoticeTabItem[]>,
        default: () => []
    }
})

const loading = ref(false);
const list = ref<any[]>([]);
const activeKey = ref<string>(props.tabs?.[0]?.key || 'alarm');
const tabCountMap = ref<Record<string, CappedUnreadCount>>({});
const menuStory = useMenuStore();
const route = useRoute();

const type = ref<string[]>([]);
const userInfo = useUserStore();
let listRequestId = 0;

const getData = (providers: string[] = []) => {
    if (!providers.length) {
        list.value = [];
        return;
    }
    loading.value = true;
    const currentRequestId = ++listRequestId;
    const params = createUnreadQueryParams(providers, DROPDOWN_PAGE_SIZE);
    getUnreadNoPagingList_api(params)
        .then((resp: any) => {
            // 只接收最新 Tab 的响应，避免快速切换时旧请求覆盖当前列表。
            if (currentRequestId === listRequestId) {
                list.value = Array.isArray(resp.result) ? resp.result : (resp.result?.data || []);
            }
        })
        .finally(() => {
            if (currentRequestId === listRequestId) {
                loading.value = false;
            }
        });
};

const refreshSummary = () => {
    const providers = props.tabs.reduce<string[]>((result, item) => {
        return result.concat(item.type || []);
    }, []);
    if (!providers.length) {
        tabCountMap.value = {};
        return;
    }
    getUnreadSummary_api(createUnreadQueryParams(providers, BADGE_OVERFLOW_COUNT)).then((resp: any) => {
        tabCountMap.value = createTabCountMap(props.tabs, resp.result);
    });
};

const onChange = (_key: string | number) => {
    activeKey.value = String(_key);
    type.value = props.tabs.find((item) => item.key === activeKey.value)?.type || [];
    getData(type.value);
};



const onRefresh = () => {
    refreshSummary();
    getData(type.value.length ? type.value : props.tabs.find((item) => item.key === activeKey.value)?.type || [])
};

const onMore = (key: string) => {
    // 判断当前是否为/account/center
    if (route.path === '/account/center') {
        userInfo.tabKey = 'StationMessage';
        userInfo.other.tabKey = key;
    } else {
        menuStory.routerPush('account/center', {
            params:{
                tabKey: 'StationMessage',
                other: {
                    tabKey: key,
                },
            }
        });
    }

    emits('action');
};

onMounted(async () => {
    refreshSummary();
    onChange(props.tabs?.[0]?.key || "alarm");
});
</script>

<style lang="less" scoped>
.notice-info-container {
    width: 21rem;
    background-color: #fff;
    border-radius: var(--r-1);
    box-shadow: 0 0.375rem 1rem -0.5rem rgb(0 0 0 / 8%), 0 0.5625rem 1.75rem 0 rgb(0 0 0 / 5%),
        0 0.75rem 3rem 1rem rgb(0 0 0 / 3%);

    :deep(.ant-tabs-nav-wrap) {
        display: flex;
        justify-content: center;
    }

    .no-data {
        width: 100%;
        padding: 4.5625rem 0 5.5rem;
        color: var(--jet-theme-text-disabled);
        text-align: center;

        img {
            height: 4.75rem;
        }
    }

    .content {
        .list {
            max-height: 28.125rem;
            overflow: auto;
            padding: 0;
            margin: 0;
            &::-webkit-scrollbar {
                //隐藏或取消滚动条
                display: none;
            }
        }
        .btns {
            display: flex;
            height: 2.875rem;
            justify-content: center;
            align-items: center;
        }
    }
}</style>
