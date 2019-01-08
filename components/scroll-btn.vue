<template>
  <div class="scroll-btn" @click="scrollDown"></div>
</template>

<script>
export default {
  methods: {
    scrollDown(event) {
      window.scroll({
        top: window.innerHeight,
        left: 0,
        behavior: 'smooth'
      });
    }
  }
}
</script>

<style>
.scroll-btn {
  width: 40px; height: 40px; transform: translateX(-50%) rotate(45deg); transform-origin: center center;
  border: 2px solid white; border-left: none; border-top: none;
  animation: breath 2s infinite;
}
@keyframes breath {
  0% { opacity: 0; }
  50% { opacity: 0.5; }
  100% { opacity: 0; }
}
</style>
