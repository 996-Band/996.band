<template>
  <BandSection class="photos" style="height: auto;">
    <h2>乐队回忆</h2>
    <div ref="preview" class="preview">
      <div v-if="preview" :style="preview.boxStyle">
        <img
          v-if="preview.type === 'photo'"
          :style="preview.style" :src="preview.src" :alt="preview.alt"
        />
        <video
          v-if="preview.type === 'video'"
          :style="preview.style" :src="preview.src" :title="preview.alt" autoplay loop
        />
      </div>
    </div>
    <template v-for="(event, eventIndex) in data">
      <h3>
        {{ event.title }}
        <span>{{ event.date }}</span>
      </h3>
      <div class="event">
        <div
          v-for="(photo, photoIndex) in event.photos"
          :class="type(photo)"
          @click="open(photo)"
        >
          <img :alt="alt(photo, event.title)" :src="thumbnail(photo)" />
        </div>
      </div>
    </template>
  </BandSection>
</template>

<script>
import BandSection from './section'

// todo
// http://v.youku.com/v_show/id_XMzIyNzM1NTk4OA==.html
// https://vthumb.ykimg.com/054104085A30A95B00000171540BA94F
// http://v.youku.com/v_show/id_XMjg4Mzk0MTUwMA==.html
// https://vthumb.ykimg.com/05410408595D1D220000016D610DD8BE
const data = [
  { title: '乐队花絮', date: '',
    photos: ['sideshow-2.jpg', '20180412-4.jpg', 'sideshow-3.jpg', 'sideshow-4.jpg', 'sideshow-5.jpg'] },
  { title: '新歌发表会', date: '2017-01-22',
    photos: ['20170122-1.jpg', '20170122-2.jpg'] },
  { title: 'ATA 年会', date: '2017-02-22',
    photos: ['20170222-1.jpg', '20170222-2.jpg'] },
  { title: '淘宝武林大会', date: '2017-05-10',
    photos: ['20170510-1.jpg', '20170510-2.jpg'] },
  { title: 'Fun 码过来', date: '2017-06-19',
    photos: ['20170619-1.jpg', '20170619-2.jpg', '20170619-3.jpg', '20170619-4.jpg', '20170619-5.jpg'] },
  { title: '新新歌发表会', date: '2017-12-12',
    photos: ['20171212-1.jpg', '20171212-2.jpg', '20171212-3.jpg', '20171212-5.jpg'] },
  { title: '第十二届 D2 前端论坛', date: '2017-12-16',
    photos: ['20171216-1.jpg', '20171216-2.jpg'] },
  { title: '第一届 SEEConf 支付宝体验科技大会', date: '2018-01-06',
    photos: ['20180106-1.jpg', '20180106-2.jpg'] },
  { title: '阿里云年会', date: '2018-04-12',
    photos: ['20180412-1.mp4', '20180412-2.mp4', '20180412-3.jpg'] },
  { title: '蚂蚁 Hackthon', date: '2018-04-20',
    photos: ['20180420-1.jpg', '20180420-2.jpg', '20180420-3.jpg'] },
  { title: '仲夏之夜', date: '2018-09-06',
    photos: ['20180906-1.jpg', '20180906-2.jpg', '20180906-3.jpg', '20180906-4.jpg', '20180906-6.jpg', '20180906-7.jpg'] },
  { title: 'VueConf', date: '2018-11-24',
    photos: ['20181124-1.jpg', '20181124-2.jpg', '20181124-3.jpg'] },
  { title: '第十三届 D2 前端技术论坛', date: '2019-01-06',
    photos: ['20190106-1.jpg', '20190106-2.jpg', '20190106-3.jpg', '20190106-4.jpg', '20190106-5.jpg', '20190106-6.jpg', '20190106-7.jpg', '20190106-8.jpg'] },
  { title: '送别勾股', date: '2019-5-17',
    photos: ['20190517.jpg'] },
  { title: '第十四届 D2 前端技术论坛', date: '2019-12-14',
    photos: ['20191214-1.jpg', '20191214-2.jpg', '20191214-3.jpg', '20191214-4.jpg'] },
  { title: '第十五届 D2 前端技术论坛', date: '2020-12-20',
    photos: ['20201220-1.jpg', '20201220-2.jpg'] },
  { title: 'SEE Conf 2021', date: '2021-01-09',
    photos: ['20210109-1.jpg', '20210109-2.jpg', '20210109-3.jpg', '20210109-4.jpg', '20210109-5.jpg'] },
  { title: '第十六届 D2 前端技术论坛', date: '2021-12-18',
    photos: ['20211218-1.jpg', '20211218-2.jpg', '20211218-3.jpg', '20211218-4.jpg', '20211218-5.jpg', '20211218-6.jpg', '20211218-7.jpg', '20211218-8.jpg', '20211218-9.jpg', '20211218-10.jpg', '20211218-11.jpg'] },
  { title: '第十七届 D2 终端技术大会', date: '2022-12-17',
    photos: ['20221217-1.jpg', '20221217-2.jpg', '20221217-3.jpg', '20221217-4.jpg', '20221217-5.jpg', '20221217-6.jpg', '20221217-7.jpg', '20221217-8.jpg', '20221217-9.jpg', '20221217-10.jpg', '20221217-11.jpg', '20221217-12.jpg', '20221217-13.jpg', '20221217-14.jpg', '20221217-15.jpg', '20221217-16.jpg'] },
].reverse()

export default {
  components: { BandSection },
  data() {
    return {
      data,
      currentPhoto: ''
    }
  },
  computed: {
    preview() {
      const photo = this.currentPhoto
      const boxStyle = `display: flex; background-color: #333; width: 100vw; height: 100vh; align-items: center; justify-contents: center;`
      const style = `max-width: 95vw; max-height: 95vh; border-radius: 5px; display: block; margin: auto`
      if (photo) {
        return {
          type: this.type(photo),
          alt: this.alt(photo),
          src: this.src(photo),
          style, boxStyle
        }
      }
    }
  },
  mounted() {
    document.addEventListener('webkitfullscreenchange', this.webkitfullscreenchange)
    document.addEventListener('fullscreenchange', this.fullscreenchange)
  },
  beforeDestroyed() {
    document.removeEventListener('webkitfullscreenchange', this.webkitfullscreenchange)
    document.removeEventListener('fullscreenchange', this.fullscreenchange)
  },
  methods: {
    type(photo) {
      return photo.match(/\.jpg$/) ? 'photo' : 'video'
    },
    alt(photo, title) {
      return `${title} - ${photo}`
    },
    thumbnail(photo) {
      return `/images/memory/thumbnails/${photo.replace(/[^\.]+$/, 'jpg')}`
    },
    src(photo) {
      return `/images/memory/${photo}`
    },
    open(photo) {
      const preview = this.$refs.preview
      this.currentPhoto = photo
      if (preview.requestFullscreen) {
        preview.requestFullscreen()
      } else if (preview.webkitRequestFullscreen) {
        preview.webkitRequestFullscreen()
      }
    },
    fullscreenchange() {
      // console.log('fullscreenchange')
      if (!document.fullscreenElement) {
        this.currentPhoto = ''
      }
    },
    webkitfullscreenchange() {
      // console.log('webkitfullscreenchange')
      if (!document.webkitFullscreenElement) {
        this.currentPhoto = ''
      }
    }
  }
}
</script>

<style scoped>
.photos { background-color: rgba(255,255,255,0.05); padding: 3vw; }
h2 { font-size: 4vw; text-shadow: 3px 3px 3px #333; }
h3 { font-size: 3vw; text-shadow: 3px 3px 3px #333; }
h3 > span { font-size: 2vw; margin-left: 0.5em; }
.event { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); grid-auto-flow: row dense; grid-gap: 3vw; align-items: center; }
.event img { width: 100%; cursor: pointer; border-radius: 5px; }
.event img:hover { box-shadow: 3px 3px 3px #333; }

@media (max-width: 450px) {
  .photos { padding-top: 6em; flex-direction: column; max-height: none; height: auto; }
  h2 { font-size: 2em; }
  h3 { font-size: 1.5em; }
  h3 > span { font-size: 1em; }
}
</style>
