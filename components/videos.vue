<template>
  <BandSection class="videos" style="height: auto;">
    <h2>《码农》的故事</h2>
    <iframe class="content" src="//player.youku.com/embed/XMjQ3ODI2MDQxMg==" frameborder="0" allowfullscreen></iframe>
  </BandSection>
</template>

<script>
import BandSection from './section'

export default {
  components: { BandSection }
}
</script>

<style scoped>
.videos { padding: 3vw; }
h2 { font-size: 4vw; text-shadow: 3px 3px 3px #333; }
h3 { font-size: 3vw; text-shadow: 3px 3px 3px #333; }
.content { margin: 1em auto; display: block; width: 80vw; height: 45vw; border-radius: 5px; }
@media (max-width: 450px) {
  .videos { max-height: none; display: block; }
  h2 { font-size: 2em; }
  h3 { font-size: 1.5em; }
}
</style>
