<template>
  <BandSection class="cover">
    <div class="content">
      <BandTitle class="title" content="996 BAND" />
      <img class="logo" alt="Logo" src="/images/996-white.png">
    </div>
    <BandOcean class="ocean" />
    <BandScrollBtn class="scroll-btn" />
  </BandSection>
</template>

<script>
import BandSection from './section'
import BandTitle from './title'
import BandOcean from './ocean'
import BandScrollBtn from './scroll-btn'

export default {
  components: { BandSection, BandTitle, BandOcean, BandScrollBtn }
}
</script>

<style scoped>
  .cover { background: radial-gradient(ellipse at center, #333 0%, #333 30%, #000 100%); overflow: hidden; }
  .content { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; }
  .title { margin: 0; font-size: 5em; }
  .ocean { position: absolute; left: 0; right: 0; bottom: 0; height: 5%; }
  .logo { display: block; width: 240px; margin: -20% auto; }
  .scroll-btn { position: absolute; z-index: 10; left: 50%; bottom: 10vh; }
  .adv { position: absolute; bottom: 20vh; right: -5px; font-size: 2vw; }
  @media (max-width: 450px) {
    .cover { min-height: 75vw; }
    .logo { width: 320px; }
    .adv { font-size: 1.25em; right: 50%; transform: translateX(50%); }
  }
  @media (min-width: 451px) and (max-width: 800px) {
    .cover { min-height: 75vw; }
    .title { margin-bottom: 2rem; }
    .logo { width: 320px; }
  }
  @media (min-width: 801px) {
    .title { margin-bottom: 2rem; }
    .logo { width: 480px; }
  }
</style>
