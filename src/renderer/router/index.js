import Vue from 'vue'
import Router from 'vue-router'

Vue.use(Router)

export default new Router({
  routes: [
    {
      path: '/',
      name: 'index-page',
      component: require('@/components/IndexPage').default
    },
    {
      path: '/index',
      name: 'index-page#full',
      component: require('@/components/IndexPage').default
    },
    {
      path: '/settings',
      name: 'setting-page',
      component: require('@/components/SettingPage').default
    },
    {
      path: '*',
      redirect: '/'
    }
  ]
})
