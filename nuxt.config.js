export default {
  target: 'static',
  head: {
    title: '996 乐队',
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'user-scalable=no, width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1' },
    ],
    link: [
      { rel: 'dns-prefetch', href: 'https://www.getrevue.co/' },
      { rel: 'preconnect', href: 'https://www.getrevue.co/' },
      { rel: 'prefetch', href: 'https://www.getrevue.co/profile/996-band', as: 'document' },
      { rel: 'prerender', href: 'https://www.getrevue.co/profile/996-band' }
    ],
    script: [
      { src: '/smoothscroll-polyfill.js' }
    ]
  }
}
