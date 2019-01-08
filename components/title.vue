<!-- https://www.webdesignerdepot.com/2014/06/how-to-get-started-with-layer-fonts-in-css/ -->

<template>
  <h1 class="title" :text="content">{{ content }}</h1>
</template>

<script>
export default {
  props: ['content']
}
</script>

<style>
/* http://fontm.com/scratch-font/ */
@font-face {
  font-family: "Scratch";
  src: url("/scratch/basic/Scratch Basic.ttf");
}
@font-face {
  font-family: "Scratch-Detail";
  src: url("/scratch/detail/Scratch Detail.ttf");
}
.title {
  position: relative; font-weight: bold; font-family: 'Scratch', Helvetica; color: #DDDDDD;
}
.title::before {
  content: attr(text); position: absolute; top: 0; left: 0; right: 0;
  font-family: 'Scratch-Detail', Helvetica; color: #39CCCC;
}
</style>
