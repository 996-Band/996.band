<template>
  <BandSection class="contact">
    <h2>关注我们</h2>
    <p><a class="yuque" href="https://www.yuque.com/996band" target="_blank">996 乐队官方语雀</a> | <a href="https://www.yuque.com/996band/tuqy4c" target="_blank">官方公告</a> |  <a href="https://www.yuque.com/996band/tuqy4c/zzs567" target="_blank">相关群组</a>  <br>
    <a class="wangyi" href="https://music.163.com/#/artist?id=54708994" target="_blank">网易音乐人主页</a></p>
    <!--<p><a href="https://www.getrevue.co/profile/996-band" target="_blank">点击这里订阅 996 乐队的邮件新闻，第一时间获得乐队资讯和演出信息。</a></p>-->
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
p { font-size: 20px; margin: 0 5vw 1.5em; }
.logo { width: 20vw; position: absolute; bottom: 10vh; left: 50%; transform: translateX(-50%); }
a { height: 55px; line-height: 55px; text-decoration: none; position: relative; display: inline-block; }
a.yuque { padding-left:50px; background-image: url(/images/contact-yuque.png); background-repeat: no-repeat; background-position: 0 center; }
a.wangyi { padding-left:40px; background-image: url(/images/contact-163.png); background-repeat: no-repeat; background-position: 0 center; }
a::after { position: absolute; left: 0; right: 0; bottom: 5px; background-color: white; height: 2px; content: ""; }
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
