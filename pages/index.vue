<!--
  <meta name="viewport" content="user-scalable=no, width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1">
  <link rel="dns-prefetch" href="https://www.getrevue.co/">
  <link rel="preconnect" href="https://www.getrevue.co/">
  <link rel="prefetch" href="https://www.getrevue.co/profile/996-band" as="document">
  <link rel="prerender" href="https://www.getrevue.co/profile/996-band">
  <script src="/smoothscroll-polyfill.js"></script>
  // import smoothscroll from 'smoothscroll-polyfill'
  // smoothscroll.polyfill()
-->

<template>
  <div>
    <BandCover />
    <BandAbout />
    <BandNotice />
    <BandVideos />
    <BandPhotos />
    <BandContact />
  </div>
</template>

<script>
import BandCover from '~/components/cover'
import BandAbout from '~/components/about'
import BandNotice from '~/components/notice'
import BandVideos from '~/components/videos'
import BandPhotos from '~/components/photos'
import BandContact from '~/components/contact'

export default {
  components: {
    BandCover,
    BandAbout,
    BandNotice,
    BandVideos,
    BandPhotos,
    BandContact
  }
}
</script>

<style>
body { margin: 0; background: #333; color: #ccc; font-family: "PingFang SC"; scroll-behavior: smooth; }
a { color: white; }
</style>
