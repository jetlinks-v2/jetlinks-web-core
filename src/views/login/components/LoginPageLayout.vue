<template>
  <div class="login-container" :class="{ 'login-container--preview': preview }">
    <section class="login-side">
      <header class="login-brand"><slot name="brand" /></header>
      <div class="login-page-actions"><slot name="actions" /></div>
      <main class="login-content"><slot /></main>
      <slot name="record" />
    </section>
    <div class="login-scene" :aria-hidden="$slots.scene ? undefined : true"><slot name="scene" /></div>
  </div>
</template>
<script setup lang="ts">
// The same desktop layout can be scaled in settings without applying the host page's mobile breakpoints.
withDefaults(defineProps<{ preview?: boolean }>(), { preview: false })
</script>
<style lang="less">
.login-container {
  input:-webkit-autofill,
  input:-webkit-autofill:hover,
  input:-webkit-autofill:focus,
  input:-webkit-autofill:active {
    -webkit-text-fill-color: var(--jet-theme-text) !important;
    transition: background-color 5000s ease-in-out 0s;
  }

  * {
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
  }

  button,
  a,
  .ant-btn {
    touch-action: manipulation;
  }

  .modern-input,
  .modern-input.ant-input-affix-wrapper,
  .submit-button.ant-btn {
    font-size: var(--fs-16) !important;
  }

  .modern-input .ant-input {
    font-size: var(--fs-16) !important;
  }

  .modern-input,
  .modern-input.ant-input-affix-wrapper {
    height: 3rem !important;
    min-height: 3rem !important;
  }

  .submit-button.ant-btn {
    height: 2.75rem !important;
    min-height: 2.75rem !important;
    border: 0;
    border-radius: var(--r-2);
    background: linear-gradient(90deg, var(--jet-theme-primary-hover), var(--jet-theme-primary));
    box-shadow: none;
  }
}
</style>

<style scoped lang="less">
.login-container {
  /* 模块通过 --jet-login-bg-image 设置默认图，私有化基础配置由行内样式优先覆盖。 */
  --login-bg-image: var(--jet-login-bg-image, url('@jetlinks-web-core/assets/login/login-bg.png'));

  position: relative;
  display: grid;
  grid-template-columns: minmax(28.5rem, 38.9%) minmax(0, 1fr);
  width: var(--login-viewport-width, 100vw);
  min-height: var(--login-viewport-height, 100vh);
  overflow: hidden;
  background: var(--login-bg-image) no-repeat center center;
  background-size: cover;
  color: var(--jet-theme-text);
}

.login-page-actions {
  position: absolute;
  z-index: 2;
  top: var(--space-5);
  right: var(--space-5);
}

.login-side {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: var(--login-viewport-height, 100vh);
  overflow-y: auto;
  background: color-mix(in srgb, var(--jet-theme-bg-container) 50%, transparent);
  backdrop-filter: blur(0.125rem);
}

.login-brand {
  position: absolute;
  top: var(--space-5);
  left: var(--space-5);
  display: flex;
  align-items: center;
  gap: var(--space-4);
  max-width: calc(100% - 2 * var(--space-5));

  :deep(.login-brand__logo) {
    width: 2.0625rem;
    height: 2.125rem;
    flex: none;
    object-fit: contain;
  }

  :deep(.login-brand__title) {
    min-width: 0;
    overflow: hidden;
    color: var(--jet-theme-text-title);
    font-size: var(--fs-20);
    font-weight: 700;
    line-height: 1.75rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.login-content {
  display: flex;
  flex: 1;
  justify-content: center;
  width: min(71.43%, 25rem);
  min-width: 20rem;
  min-height: auto;
  margin: 0 auto;
  padding: clamp(7.5rem, calc(var(--login-viewport-height, 100vh) * 0.205), 14rem) 0 var(--space-10);
}

.login-scene {
  min-width: 0;
  min-height: var(--login-viewport-height, 100vh);
}

/* 备案号走正常流，跟随 .login-side 的 flex 列排在表单之后，不会与表单重叠。 */
:slotted(.login-record) {
  flex: none;
  margin: 0 auto var(--space-4);
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
  text-align: center;
  text-decoration: none;

  &:hover {
    color: var(--jet-theme-primary);
  }
}

@media (min-width: 120rem) {
  .login-container:not(.login-container--preview) .login-content {
    width: min(71.43%, 25rem);
  }
}

@media (max-width: 62rem) {
  .login-container:not(.login-container--preview) {
    grid-template-columns: minmax(24rem, 46%) minmax(0, 1fr);
  }

  .login-container:not(.login-container--preview) .login-content {
    width: calc(100% - 4rem);
  }
}

@media (max-width: 48rem) {
  .login-container:not(.login-container--preview) {
    display: block;
    min-height: 100dvh;
    overflow-x: hidden;
    overflow-y: auto;
    background:
      linear-gradient(
        color-mix(in srgb, var(--jet-theme-bg-container) 88%, transparent),
        color-mix(in srgb, var(--jet-theme-bg-container) 95%, transparent)
      ),
      var(--login-bg-image) no-repeat 62% center;
    background-size: cover;
  }

  .login-container:not(.login-container--preview) .login-side {
    min-height: 100dvh;
    background: color-mix(in srgb, var(--jet-theme-bg-container) 78%, transparent);
    backdrop-filter: blur(0.125rem);
  }

  .login-container:not(.login-container--preview) .login-brand {
    top: var(--space-4);
    left: var(--space-4);
    max-width: calc(100% - 2 * var(--space-4));
  }

  .login-container:not(.login-container--preview) .login-page-actions {
    top: var(--space-4);
    right: var(--space-4);
  }

  .login-container:not(.login-container--preview) .login-content {
    align-items: center;
    width: 100%;
    min-width: 0;
    /* 高度交给 .login-side 的 flex 列分配，避免 min-height:100dvh 把备案号挤出首屏。 */
    padding: 5.5rem var(--space-5) var(--space-8);
  }

  .login-container:not(.login-container--preview) :slotted(.login-record) {
    margin-bottom: var(--space-3);
  }

  .login-container:not(.login-container--preview) .login-scene {
    display: none;
  }
}

@media (max-height: 43.75rem) and (min-width: 48.01rem) {
  .login-container:not(.login-container--preview) .login-content {
    padding-top: 6.5rem;
  }
}
</style>
