<!-- https://codepen.io/tedmcdo/pen/PqxKXg -->

<template>
  <div class="ocean">
    <div class="wave"></div>
    <div class="wave"></div>
  </div>
</template>

<style scoped>
.ocean { background: #333; }

.wave {
  position: absolute; top: -150px; width: 6400px; height: 150px; background: url(/images/wave.svg) repeat-x; transform: translate3d(0,0,0);
  animation:
    wave 7s cubic-bezier(.36,.45,.63,.53) infinite;
}
.wave:nth-of-type(2) {
  top: -125px;
  animation:
    wave 10s cubic-bezier(.36,.45,.63,.53) -3s infinite,
    swell 7s ease -3s infinite;
}

@keyframes wave {
  0% { margin-left: 0; }
  100% { margin-left: -1600px; }
}
@keyframes swell {
  0%, 100% { transform: translate3d(0,-25px,0); }
  50% { transform: translate3d(0,5px,0); }
}
</style>
