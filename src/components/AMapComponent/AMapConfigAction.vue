<template>
    <Button v-if="canOpenConfig" type="link" @click="openConfig">{{ t('AMapComponent.AMap.openConfig') }}</Button>
    <span v-else>{{ t('AMapComponent.AMap.contactAdmin') }}</span>
</template>

<script setup lang="ts">
import { Button } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { useAMapConfigNavigation } from './useAMapConfigNavigation';

const { t } = useI18n();
const { canOpenConfig, openConfig } = useAMapConfigNavigation();
</script>
