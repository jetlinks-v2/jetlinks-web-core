<template>
  <div ref='fullPage' :style="styles" :class="{ 'full-page-warp': true, 'scroll': showScroll }" >
    <slot></slot>
  </div>
</template>

<script setup name='FullPage'>

const props = defineProps({
  extraHeight: {
    type: Number,
    default: 0
  },
  showScroll: {
    type: Boolean,
    default: false
  },
  padding: {
    type: Number,
    default: 24
  },
  fixed: {
    type: Boolean,
    default: true
  },
  margin: {
    type: String,
    default: undefined
  },
  transparentBackground: {
    type: Boolean,
    default: false
  }
})

const fullPage = ref(null)
const MinHeight = ref(`0`)

const styles = computed(() => {
  let _style = { height: '100%'}

  if (props.fixed !== false) {
    _style = {
      height: MinHeight.value || '100%'
    }
  } else {
    _style = {
      minHeight: MinHeight.value,
      margin: props.margin || '0 0 1.5rem 0'
    }
  }

  if(props.transparentBackground){
    _style.background = 'transparent'
  } else {
    _style.background = '#fff'
  }

  return _style
})

onMounted(() => {
  setTimeout(() => {
    const top = fullPage.value.getBoundingClientRect().top
    const _y = top < 0 ? 0 : top
    const height = _y + props.extraHeight + props.padding

    MinHeight.value = `calc(100vh - ${height}px)`
  }, 10)
})

</script>

<style scoped lang="less">
.full-page-warp {
  &.scroll {
    overflow-y: auto;
  }
}
</style>
