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
                        :refresh="refreshObj[item.key]"
                        :tab="item?.tab"
                        :type="item.type"
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
                                    @refresh="onRefresh(item.key)"
                                />
                            </template>
                            <div
                                v-if="list.length < 12"
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
import { getList_api } from '@jetlinks-web-core/api/account/notificationRecord';
import { useMenuStore } from '@jetlinks-web-core/store/menu';
import { useUserStore } from '@jetlinks-web-core/store/user';
import { cloneDeep } from 'lodash-es';
import NoticeItem from './NoticeItem.vue';
import NoticeTab from './NoticeTab.vue';
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n();
const emits = defineEmits(['action']);

type DataType = 'alarm' | 'system-monitor' | 'system-business' | 'workflow-notification';

const refreshObj = ref({
    'alarm': true,
    'system-monitor': true,
    'system-business': true,
    'workflow-notification': true
});

const props = defineProps({
    tabs: {
        type: Array,
        default: () => []
    }
})

const loading = ref(false);
const total = ref(0);
const list = ref<any[]>([]);
const activeKey = ref<DataType>(props.tabs?.[0]?.key || 'alarm');
const menuStory = useMenuStore();
const route = useRoute();

const type = ref();
const userInfo = useUserStore();

const getData = (type: string[]) => {
    loading.value = true;
    const params = {
        sorts: [
            {
                name: 'notifyTime',
                order: 'desc',
            },
        ],
        pageSize: 12,
        terms: [
            {
                terms: [
                    {
                        type: 'or',
                        value: type,
                        termType: 'in',
                        column: 'topicProvider',
                    },
                    {
                        type: 'and',
                        value: 'unread',
                        termType: 'eq',
                        column: 'state',
                    },
                ],
            },
        ],
    };
    getList_api(params)
        .then((resp: any) => {
            total.value = resp.result.total;
            list.value = resp.result?.data || [];
        })
        .finally(() => (loading.value = false));
};

const onChange = (_key: string) => {
    type.value = props.tabs.find((item: any) => item.key === _key)?.type || [];
    getData(type.value);
};



const onRefresh = (id: string) => {
    const flag = cloneDeep(refreshObj.value[id]);
    refreshObj.value = {
        ...refreshObj.value,
        [id]: !flag,
    };
    getData(type.value)
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
