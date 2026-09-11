import { onBeforeUnmount } from 'vue'
import './useElementFlight.css'

const flightDuration = 1150
const flightFrameCount = 40

function flightTransform(x: number, y: number, scale: number) {
  return `translate(-50%, -50%) translate3d(${x}px, ${y}px, 0) scale(${scale})`
}

function createParabolicKeyframes(deltaX: number, deltaY: number, arcLift: number) {
  const controlX = deltaX * 0.62
  const controlY = Math.min(deltaY, 0) - arcLift * 3

  // 单一二次贝塞尔曲线可保持方向连续，避免手工中间点造成可见折线。
  return Array.from({ length: flightFrameCount + 1 }, (_, index) => {
    const progress = index / flightFrameCount
    const remaining = 1 - progress
    const x = 2 * remaining * progress * controlX + progress * progress * deltaX
    const y = 2 * remaining * progress * controlY + progress * progress * deltaY
    const fadeIn = Math.min(1, progress / 0.08)
    const fadeOut = Math.min(1, (1 - progress) / 0.12)
    const shrinkProgress = Math.max(0, (progress - 0.82) / 0.18)
    const scale = progress < 0.08
      ? 0.45 + 0.55 * fadeIn
      : 1 - 0.75 * shrinkProgress * shrinkProgress

    return {
      offset: progress,
      transform: flightTransform(x, y, scale),
      opacity: Math.min(fadeIn, fadeOut),
    }
  })
}

function playTargetPulse(target: HTMLElement) {
  const baseShadow = getComputedStyle(target).boxShadow
  const highlightShadow = [
    baseShadow === 'none' ? '' : baseShadow,
    '0 0 0 0.1875rem var(--accent-soft)',
  ].filter(Boolean).join(', ')

  // 目标元素可能用 transform 做自身定位，反馈动画不能覆盖它的定位 transform。
  target.animate([
    { boxShadow: baseShadow },
    { boxShadow: highlightShadow },
    { boxShadow: baseShadow },
  ], { duration: 260, easing: 'ease-out' })
}

/**
 * 在调用方提供的两个可见元素之间播放飞行动画。
 *
 * Hook 不查找业务节点；调用方负责元素挂载时序，卸载时未完成的动画会被取消并清理。
 */
export function useElementFlight() {
  const activeAnimations = new Map<HTMLElement, Animation>()

  function playElementFlight(source?: HTMLElement, target?: HTMLElement) {
    if (!source || !target || typeof window === 'undefined' || typeof document === 'undefined') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    const sourceRect = source.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const startX = sourceRect.left + sourceRect.width / 2
    const startY = sourceRect.top + sourceRect.height / 2
    const deltaX = targetRect.left + targetRect.width / 2 - startX
    const deltaY = targetRect.top + targetRect.height / 2 - startY
    const distance = Math.hypot(deltaX, deltaY)
    const arcLift = Math.min(88, Math.max(56, distance * 0.075))

    const dot = document.createElement('span')
    dot.className = 'element-flight-dot'
    dot.style.left = `${startX}px`
    dot.style.top = `${startY}px`
    document.body.appendChild(dot)

    const animation = dot.animate(createParabolicKeyframes(deltaX, deltaY, arcLift), {
      duration: flightDuration,
      easing: 'linear',
    })
    activeAnimations.set(dot, animation)

    const cleanup = () => {
      activeAnimations.delete(dot)
      dot.remove()
    }
    animation.onfinish = () => {
      playTargetPulse(target)
      cleanup()
    }
    animation.oncancel = cleanup
  }

  onBeforeUnmount(() => {
    activeAnimations.forEach(animation => animation.cancel())
    activeAnimations.clear()
  })

  return { playElementFlight }
}
