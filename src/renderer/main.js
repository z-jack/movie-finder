import Vue from 'vue'
import axios from 'axios'
import iView from 'iview'
import AsyncComputed from 'vue-async-computed'

import App from './App'
import router from './router'
import store from './store'
import 'iview/dist/styles/iview.css';

if (!process.env.IS_WEB) Vue.use(require('vue-electron'))
Vue.http = Vue.prototype.$http = axios
Vue.config.productionTip = false
Vue.use(iView)
Vue.use(AsyncComputed)

/* eslint-disable no-new */
new Vue({
  components: { App },
  router,
  store,
  template: '<App/>'
}).$mount('#app')
