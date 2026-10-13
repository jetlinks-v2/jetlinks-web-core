<template>
	<div
		ref="fullPage"
		:style="styles"
		:class="{
      'full-page-warp': true,
      'full-page-warp--flex': flex,
      scroll: showScroll
    }"
	>
		<slot></slot>
	</div>
</template>

<script setup lang="ts" name="FullPage">
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
		default: true
	},
	flex: {
		type: Boolean,
		default: false
	}
})

const fullPage = ref<HTMLElement | null>(null)
const MinHeight = ref(`0`)

const styles = computed(() => {
	let sizeStyle
	if (props.fixed !== false) {
		sizeStyle = {
			height: MinHeight.value || '100%'
		}
	} else {
		sizeStyle = {
			minHeight: MinHeight.value,
			margin: props.margin || '0 0 1.5rem 0'
		}
	}
	
	return {
		...sizeStyle,
		background: props.transparentBackground ? 'transparent' : '#fff'
	}
})

let mountTimer = 0
let layoutFrame = 0
let resizeFrame = 0

const updateHeight = () => {
	if (!fullPage.value) return
	
	const top = fullPage.value.getBoundingClientRect().top
	const _y = top < 0 ? 0 : top
	let bottomInset = parseFloat(window.getComputedStyle(fullPage.value).marginBottom) || 0

	// 元素 top 不包含自身外边距和祖先的底部间距；按真实留白预留高度，避免多层容器撑出整页滚动条。
	for (let ancestor = fullPage.value.parentElement; ancestor; ancestor = ancestor.parentElement) {
		const style = window.getComputedStyle(ancestor)
		bottomInset += parseFloat(style.paddingBottom) || 0
		bottomInset += parseFloat(style.borderBottomWidth) || 0
	}

	const height = _y + props.extraHeight + Math.max(props.padding, bottomInset)
	
	MinHeight.value = `calc(100vh - ${height}px)`
	
	if (props.flex && props.fixed !== false) {
		layoutFrame = window.requestAnimationFrame(() => {
			const documentElement = document.documentElement
			const overflowHeight = Math.max(documentElement.scrollHeight - documentElement.clientHeight, 0)
			
			// flex 页面由自身或后代承接滚动；扣除祖先尾部间距，避免根节点出现第二条滚动条。
			if (overflowHeight > 0) {
				MinHeight.value = `calc(100vh - ${height + overflowHeight}px)`
			}
		})
	}
}

const handleResize = () => {
	window.cancelAnimationFrame(resizeFrame)
	resizeFrame = window.requestAnimationFrame(updateHeight)
}

onMounted(() => {
	mountTimer = window.setTimeout(updateHeight, 10)
	window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
	window.clearTimeout(mountTimer)
	window.cancelAnimationFrame(layoutFrame)
	window.cancelAnimationFrame(resizeFrame)
	window.removeEventListener('resize', handleResize)
})
</script>

<style scoped lang="less">
.full-page-warp {
	&--flex {
		display: flex;
		min-height: 0;
		flex: 1 1 auto;
		flex-direction: column;
		overflow-y: auto;
	}
	&.scroll {
		overflow-y: auto;
	}
}
</style>
