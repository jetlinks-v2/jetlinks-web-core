<script setup name="TimePicker">

import { watch } from 'vue'
import dayjs from 'dayjs'

const props = defineProps({
  value: {
    type: [String, Number],
    default: undefined,
  },
  format: {
    type: String,
    default: 'HH:mm:ss',
  },
});

const emit = defineEmits(['update:value', 'change'])

const dropdownTimePickerRef = ref()
const myValue = ref(props.value)

const getPopupContainer = () => {
  return dropdownTimePickerRef.value
}

const change = (e) => {
  const timestamp = dayjs(e).valueOf()
  myValue.value = e
  emit('update:value', timestamp)
  emit('change', timestamp)
}

watch(() => props.value, () => {
  myValue.value = props.value
}, { immediate: true })

</script>

<template>
<div class="dropdown-time-picker" ref="dropdownTimePickerRef">
  <a-date-picker
    :value="myValue"
    :format="props.format"
    :open="true"
    :get-popup-container="getPopupContainer"
    showTime
    class='manual-time-picker'
    popupClassName='manual-time-picker-popup'
    @change='change'
    @ok='change'
  />
</div>
</template>

<style scoped lang="less">
.dropdown-time-picker {
  .manual-time-picker {
    display: none;
  }
}
</style>