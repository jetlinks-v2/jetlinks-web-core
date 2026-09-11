<template>
    <div class="list-item" :class="{ 'list-item--unread': state === 'unread' }" @click="detail">
        <span class="list-item__dot" />
        <div class="list-item__content">
            <div class="list-item__header">
                <j-ellipsis class="list-item__title">{{ props.data?.topicName }}</j-ellipsis>
                <span class="list-item__time">{{ formattedTime }}</span>
            </div>
            <j-ellipsis v-if="displayMessage" class="list-item__summary">
                {{ displayMessage }}
            </j-ellipsis>
        </div>
        <div class="list-item__actions">
            <a-tooltip v-if="state === 'unread'" :title="$t('components.NoticeItem.265390-3')">
                <a
                    class="list-item__action"
                    role="button"
                    tabindex="0"
                    :aria-label="$t('components.NoticeItem.265390-3')"
                    @click.stop="markRead()"
                    @keydown.enter.stop.prevent="markRead()"
                    @keydown.space.stop.prevent="markRead()"
                >
                    <AIcon type="CheckCircleOutlined" />
                </a>
            </a-tooltip>
            <a-tooltip :title="$t('components.NoticeItem.265390-2')">
                <a
                    class="list-item__action"
                    role="button"
                    tabindex="0"
                    :aria-label="$t('components.NoticeItem.265390-2')"
                    @click.stop="detail"
                    @keydown.enter.stop.prevent="detail"
                    @keydown.space.stop.prevent="detail"
                >
                    <AIcon type="EyeOutlined" />
                </a>
            </a-tooltip>
        </div>
    </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { getCurrentInstance } from 'vue';
import { changeStatus_api } from '@jetlinks-web-core/api/account/notificationRecord';
import { useMenuStore } from '@jetlinks-web-core/store/menu';
import { useUserStore } from '@jetlinks-web-core/store/user';
import { onlyMessage } from '@jetlinks-web/utils';
import { useI18n } from 'vue-i18n';
import { handleRegisteredRealtimeNotice } from './noticeRealtimeHandler';

const { t: $t } = useI18n();
const menuStory = useMenuStore();
const route = useRoute();
const appContext = getCurrentInstance()?.appContext;

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

const state = ref(props.data.state?.value)

const normalizedTitle = computed(() => String(props.data?.topicName || '').trim())
const normalizedMessage = computed(() => String(props.data?.message || '').trim())
const displayMessage = computed(() => normalizedMessage.value && normalizedMessage.value !== normalizedTitle.value
    ? normalizedMessage.value
    : '')
const formattedTime = computed(() => dayjs(props.data?.notifyTime).format('YYYY-MM-DD HH:mm:ss'))

watchEffect(() => {
    state.value = props.data.state?.value
})

const detail = async () => {
    const handled = await handleRegisteredRealtimeNotice(props.data, {
        markRead: () => markRead(false),
        refresh: () => emits('refresh'),
        appContext,
    });
    if (handled) {
        emits('action');
        return;
    }
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

/** 将当前通知标记为已读，并同步刷新铃铛数量和当前列表。 */
const markRead = async (feedback = true) => {
    if (!props.data?.id) return;
    const resp = await changeStatus_api('_read', [props.data.id]);
    if (resp.status !== 200) return;
    // 未读数量以后端有效状态为准，避免 read marker 与本地加减计数漂移。
    userInfo.updateAlarm();
    state.value = 'read'
    if (feedback) onlyMessage($t('components.NoticeItem.265390-5'));
    emits('refresh')
};
</script>

<style lang="less" scoped>
.list-item {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    padding: 0.875rem 1rem;
    border-bottom: 1px solid color-mix(in srgb, var(--line-strong) 30%, transparent);
    cursor: pointer;
    transition: background-color 0.2s ease;

    &:hover {
        background: var(--jet-theme-primary-soft);
    }

    &__dot {
        width: 0.375rem;
        height: 0.375rem;
        margin-top: 0.5rem;
        border-radius: 50%;
        background: transparent;
        flex: none;
    }

    &--unread &__dot {
        background: var(--jet-theme-primary);
    }

    &__content {
        min-width: 0;
        flex: 1;
    }

    &__header {
        display: flex;
        align-items: center;
        gap: var(--space-2);
    }

    &__title {
        min-width: 0;
        flex: 1;
        color: var(--jet-theme-text-title);
        font-size: var(--fs-14);
    }

    &--unread &__title {
        font-weight: 600;
    }

    &__time {
        flex: none;
        color: var(--jet-theme-text-disabled);
        font-size: var(--fs-12);
    }

    &__summary {
        margin-top: var(--space-1);
        color: var(--jet-theme-text-disabled);
        font-size: var(--fs-13);
    }

    &__action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.75rem;
        height: 1.75rem;
        color: var(--jet-theme-text-secondary);
        font-size: var(--fs-16);
        border-radius: var(--r-1);

        &:hover,
        &:focus-visible {
            color: var(--jet-theme-primary);
            background: var(--jet-theme-primary-soft);
        }
    }

    &__actions {
        display: flex;
        flex: none;
        align-items: center;
        gap: var(--space-1);
    }
}</style>
