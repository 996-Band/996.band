<template>
  <BandSection class="notice">
    <h3><a href="https://music.163.com/#/album?id=155113162" target="_blank">2022《996 乐队同名专辑》网易云音乐首发！</a></h3>
  </BandSection>
</template>

<script>
import BandSection from './section'

export default {
  components: { BandSection }
}
</script>

<style scoped>
.notice { height: 80px; min-height: 80px; background-color: black; font-size: 1.6vw; }
.notice h3 { height: 80px; text-align: center; }
.notice a { display: inline-block; height: 80px; line-height: 80px; padding-left: 80px; background-image: url(/images/notice-cover.png); background-repeat: no-repeat; background-position: 0 center;}
</style>
