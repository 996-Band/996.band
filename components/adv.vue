<template>
  <a class="adv" :href="url" target="_blank"><mark>HOT</mark> {{ text }}</a>
</template>

<script>
export default {
  props: {
    url: { default: '#' },
    text: { default: 'Lorem Ipsum ...' }
  }
}
</script>

<style scoped>
.adv { border: 2px yellow solid; padding-right: 0.5em; text-decoration: none; white-space: nowrap; }
.adv:hover { background-color: yellow; color: #333; }
.adv mark { background-color: yellow; color: #333; padding: 0 0.5em; }
</style>
