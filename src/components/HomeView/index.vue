<template>
    <div class="view-content">
        <div
            class="select-item"
            v-for="item in list"
            :key="item.id"
            @click="onChange(item.id)"
            :class="{
                active: currentView === item.id,
            }"
        >
            <img :src="ImageMap[`${item.id}${currentView === item.id ? '-active' : ''}`]" alt="" />
        </div>
    </div>
</template>

<script lang="ts" setup>
import { Device, DeviceActive, Comprehensive,ComprehensiveActive, OpsActive, Ops} from '@jetlinks-web-core/assets'

const ImageMap = {
  'device': Device,
  'device-active': DeviceActive,
  'comprehensive': Comprehensive,
  'comprehensive-active': ComprehensiveActive,
  'ops': Ops,
  'ops-active': OpsActive,
}
// import { useI18n } from 'vue-i18n';

// const { t: $t } = useI18n();
const list = [
    {
        id: 'device',
        // name: $t('HomeView.index.817508-0'),
    },
    {
        id: 'ops',
        // name: $t('HomeView.index.817508-1'),
    },
    {
        id: 'comprehensive',
        // name: $t('HomeView.index.817508-2'),
    },
];

const props = defineProps({
    value: {
        type: String,
        default: ''
    },
})

const emits = defineEmits(['update:value', 'change'])

const currentView = ref<string>('');

const onChange = (id: string) => {
    emits('change', id);
    emits('update:value', id)
}

watchEffect(() => {
    currentView.value = (props.value || '') as string
})
</script>

<style scoped>
.view-content {
  display: flex;
  justify-content: space-between;
}
.view-content .select-item {
  cursor: pointer;
  width: 30%;
  border-radius: 0.875rem;
  color: var(--ink-1);
  overflow: hidden;
}
.view-content .select-item img {
  width: 100%;
  height: 100%;
  background-size: cover;
}
.view-content .select-item:hover {
  box-shadow: var(--shadow-1);
}</style>
