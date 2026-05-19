<template>
    <a-badge :count="badgeCount" :overflow-count="BADGE_OVERFLOW_COUNT" :offset="[3, -3]">
        {{ tab }}
    </a-badge>
</template>

<script setup lang="ts">
import {
    BADGE_OVERFLOW_COUNT,
    BADGE_OVERFLOW_VALUE,
} from './noticeUtils';

const props = defineProps({
    tab: {
        type: String,
        default: '',
    },
    count: {
        type: Number,
        default: 0,
    },
    overflow: {
        type: Boolean,
        default: false,
    },
});

const badgeCount = computed(() => props.overflow ? BADGE_OVERFLOW_VALUE : props.count);
</script>
