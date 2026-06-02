<template>
    <div class="list-items">
        <div
            class="list-item"
            @click="onMove"
            :style="{
                transform: `translate(${num}px, 0)`,
            }"
        >
            <div class="list-item-left">
                <div class="header">
                    <div class="title">
                        <div>
                            {{ props.data?.topicName }}
                        </div>
                        <span :style="{color: state === 'unread' ? 'red' : '#AAAAAA'}">{{ state === 'unread' ? $t('components.NoticeItem.265390-0') : $t('components.NoticeItem.265390-1') }}</span>
                    </div>
                    <div class="time">
                        {{
                            dayjs(props.data?.notifyTime).format(
                                'YYYY-MM-DD HH:mm:ss',
                            )
                        }}
                    </div>
                </div>
                <j-ellipsis :lineClamp="2">
                    {{ props.data?.message }}
                </j-ellipsis>
            </div>
            <div class="list-item-right">
                <a-button style="margin-bottom: 0.3125rem;" class="btn" @click.stop="detail">{{ $t('components.NoticeItem.265390-2') }}</a-button>
                <a-button class="btn" v-if="state === 'unread'" @click.stop="read('_read')">{{ $t('components.NoticeItem.265390-3') }}</a-button>
                <a-button class="btn" v-else @click.stop="read('_unread')">{{ $t('components.NoticeItem.265390-4') }}</a-button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { changeStatus_api } from '@jetlinks-web-core/api/account/notificationRecord';
import { useMenuStore } from '@jetlinks-web-core/store/menu';
import { useUserStore } from '@jetlinks-web-core/store/user';
import { onlyMessage } from '@jetlinks-web/utils';
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n();
const menuStory = useMenuStore();
const route = useRoute();

const userInfo = useUserStore();

const emits = defineEmits(['action', 'refresh']);

const props = defineProps({
    data: {
        type: Object,
        default: () => {},
    },
    type: {
        type: String,
        default: "alarm"
    }
});

const num = ref<-120 | 0>(0);

const state = ref(props.data.state?.value)

watchEffect(() => {
    state.value = props.data.state?.value
})

const onMove = () => {
    num.value = num.value === 0 ? -120 : 0;
};

const detail = () => {
    // 判断当前是否为/account/center
    if (route.path === '/account/center') {
        userInfo.tabKey = 'StationMessage';
        userInfo.messageInfo = props.data;
        userInfo.other.tabKey = props.type;
    } else {
        menuStory.routerPush('account/center', {
           params:{
            row: props.data,
            tabKey: 'StationMessage',
            other: {
                tabKey: props.type
            }
           }
        });
    }
    emits('action');
};

const read = (type: '_read' | '_unread') => {
    if (!props.data?.id) return;
    changeStatus_api(type, [props.data.id]).then((resp: any) => {
        if (resp.status === 200) {
            // 未读数量以后端有效状态为准，避免 read marker 与本地加减计数漂移。
            userInfo.updateAlarm();
            num.value = 0;
            state.value = type === '_read' ? 'read' : 'unread'
            onlyMessage($t('components.NoticeItem.265390-5'));
            emits('refresh')
        }
    });
};
</script>

<style lang="less" scoped>
.list-items {
    width: 19.5rem;
    overflow: hidden;
    border-bottom: 1px solid var(--line-strong);
    margin: 0 1.5rem;
    box-sizing: content-box;

    // &:hover {
    //     background-color: #F9FAFF;
    // }
}
.list-item {
    list-style: none;
    cursor: pointer;
    display: flex;
    width: 27rem;
    transition: all 0.3s;
    gap: var(--space-6);

    .list-item-left {
        padding: 0.75rem 0;
        width: 19.5rem;
        // height: 6.25rem;
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            .title {
                display: flex;
                align-items: center;
                width: calc(100% - 7.5rem);

                div {
                    color: var(--jet-theme-text-title);
                    font-size: var(--fs-14);
                    font-weight: bold;
                    margin-right: 0.625rem;
                    max-width: calc(100% - 2.5rem);
                    white-space: nowrap;
                    text-overflow: ellipsis;
                    overflow: hidden;
                }
                span {
                    color: red;
                    font-size: var(--fs-13);
                    width: 1.875rem;
                }
            }
            .time {
                font-size: var(--fs-12);
                color: var(--jet-theme-text-disabled);
                width: 7.5rem;
            }
        }
    }

    .list-item-right {
        width: 7.5rem;
        padding: 0.3125rem 0.75rem 0.3125rem 0;
        display: flex;
        flex-direction: column;
        justify-content: center;

        .btn {
            border: none;
            background-color: var(--jet-theme-primary-soft);
            color: var(--jet-theme-primary);
            padding: 0;
        }
    }
}</style>
