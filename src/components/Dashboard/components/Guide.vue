<template>
 <div class="home-title">
     <div v-if="title">{{ title }}</div>
     <div v-else>
         <slot name="title"></slot>
     </div>
     <div class="extra-text">
         <slot name="extra"></slot>
     </div>
     <div class="home-title-english">{{ english }}</div>
 </div>
</template>

<script setup lang="ts" name="Guide">
interface guideProps {
 title?: string;
 english?: string;
}

const props = defineProps<guideProps>();
</script>

<style scoped>
.home-title {
  position: relative;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--space-3);
  padding-left: 1.125rem;
  font-weight: 700;
  font-size: var(--fs-18);
}
.home-title::after {
  position: absolute;
  top: 50%;
  left: 0;
  width: 0.5rem;
  height: 0.5rem;
  background-color: var(--jet-theme-primary, var(--accent));
  border: 1px solid var(--accent);
  transform: translateY(-50%);
  content: ' ';
}
.home-title .extra-text {
  font-size: var(--fs-14);
  font-weight: 400;
}
.home-title .home-title-english {
  position: absolute;
  top: 1.875rem;
  color: var(--ink-4);
  font-size: var(--fs-12);
}</style>
