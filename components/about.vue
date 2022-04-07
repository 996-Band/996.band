<template>
  <BandSection class="about">
    <div class="photo" style="background-image: url(/images/99666.jpg);"></div>
    <div class="intro">
      <h2>乐队介绍</h2>
      <p>996 乐队由五位前端工程师组成，核心团员最早于 2013 年在手机淘宝共事并相互结识，之后于 2016 年组团成功。乐队坚持为国内广大的程序员和上班族创作歌曲。坚持 Live 表演。</p>
      <p>
        乐队现成员：鼓-渚薰、吉他-完颜、吉他-天可、贝斯-郁结、键盘-帽匠 <br/>
        乐队前成员：鼓-渚薰、吉他-完颜、吉他-天可、贝斯-晓田、键盘-勾股
      </p>
    </div>
  </BandSection>
</template>

<script>
import BandSection from './section'

export default {
  components: { BandSection }
}
</script>

<style scoped>
.about { overflow: hidden; }
.photo { height: 75vw; background-size: contain; background-position: center center; background-repeat: no-repeat; }
.intro { position: absolute; left: 5vw; right: 10vw; bottom: 10vh; text-shadow: 3px 3px 3px #333; }
h2 { font-size: 4vw; margin: 0 0 1em; }
p { font-size: 2vw; margin: 0 0 1.5em; }
@media (max-width: 450px) {
  .about { max-height: none; display: block; }
  .intro { position: static; padding: 2em; }
  h2 { font-size: 2em; }
  p { font-size: 1em; }
}
</style>
