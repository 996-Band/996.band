<template>
  <BandSection class="contact">
    <h2>关注我们</h2>
    <p><a href="https://www.getrevue.co/profile/996-band" target="_blank">点击这里订阅 996 乐队的邮件新闻，第一时间获得乐队资讯和演出信息。</a></p>
    <img class="logo" src="/images/996-white.png">
  </BandSection>
</template>

<script>
import BandSection from './section'

export default {
  components: { BandSection }
}
</script>

<style scoped>
.contact { display: flex; flex-direction: column; max-height: 150vw; }
h2 { font-size: 4vw; margin: 5vh 5vw 1em; text-shadow: 3px 3px 3px #333; }
p { font-size: 2vw; margin: 0 5vw 1.5em; }
.logo { width: 20vw; position: absolute; bottom: 10vh; left: 50%; transform: translateX(-50%); }
a { text-decoration: none; position: relative; display: inline-block; }
a::after { position: absolute; left: 0; right: 0.5em; bottom: -8px; background-color: white; height: 2px; content: ""; }
mark { background-color: yellow; color: #333; padding: 0 0.5em; }
a.hot { padding-right: 0.5em; }
a.hot:hover { background-color: yellow; color: #333; }

@media (max-width: 450px) {
  h2 { font-size: 2em; }
  p { font-size: 1em; }
  .logo { width: 40vw; height: 40vw; }
}
@media (min-width: 451px) and (max-width: 800px) {
}
@media (min-width: 801px) {
}
</style>
