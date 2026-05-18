<template>
    <div class="box">
        <div class="box-btn" v-if="pageIndex > 0">
            <div class="box-item-action" @click="onLeft">
                <AIcon type="LeftOutlined" />
            </div>
        </div>
        <div class="box-item" v-for="item in getData" :key="item.id">
            <slot name="card" v-bind="item"></slot>
        </div>
        <div class="box-btn" v-if="(pageIndex + 1) * showLength < data.length">
            <div class="box-item-action" @click="onRight">
                <AIcon type="RightOutlined" />
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { PropType } from 'vue';

const props = defineProps({
    data: {
        type: Array as PropType<any[]>,
        default: () => [],
    },
    showLength: {
        type: Number,
        default: 8,
    },
});

const pageIndex = ref<number>(0);

const getData = computed(() => {
    const start = pageIndex.value >= 0 ? pageIndex.value * props.showLength : 0;
    const end =
        (pageIndex.value + 1) * props.showLength < props.data.length
            ? props.showLength * (pageIndex.value + 1)
            : props.data.length;
    return props.data.slice(start, end);
});

const onRight = () => {
    const flag = pageIndex.value + 1;
    if (flag < props.data.length) {
        pageIndex.value = flag;
    }
};

const onLeft = () => {
    const flag = pageIndex.value - 1;
    if (flag >= 0) {
        pageIndex.value -= 1;
    }
};
</script>

<style scoped>
.box {
  display: flex;
  align-items: center;
  margin: 0.5rem 0;
}
.box .box-item {
  margin: 0 0.75rem;
  max-width: 3.75rem;
}
.box .box-btn .box-item-action {
  width: 0.75rem;
  background-color: var(--bg-hover);
  padding: 0.9375rem 0;
  text-align: center;
  font-size: var(--fs-12);
  color: var(--ink-3);
  cursor: pointer;
}
.box .box-btn .box-item-action:hover {
  background-color: var(--accent-soft);
  color: var(--jet-theme-primary, var(--accent));
}</style>