<template>
    <a-badge :count="total" :offset="[3, -3]">
        {{ tab }}
    </a-badge>
</template>

<script setup lang="ts">
import { getList_api } from '@jetlinks-web-core/api/account/notificationRecord';

const props = defineProps({
    tab: {
        type: String,
        default: '',
    },
    type: {
        type: Array as PropType<string[]>,
        default: () => [],
    },
    refresh: {
        type: Boolean
    }
});

const total = ref<number>(0);

const getData = (type: string[] = []) => {
    if (!type.length) {
        total.value = 0;
        return;
    }
    const params = {
        pageIndex: 0,
        pageSize: 1,
        sorts: [
            {
                name: 'notifyTime',
                order: 'desc',
            },
        ],
        terms: [
            {
                type: 'and',
                terms: [
                    {
                        type: 'and',
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
    getList_api(params).then((resp: any) => {
        total.value = resp.result?.total || 0;
    });
};

watch(
    () => props.refresh,
    () => {
        getData(props.type);
    },
    {
        immediate: true,
        deep: true
    }
);
</script>
