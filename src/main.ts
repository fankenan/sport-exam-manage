import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'

import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import { useGradeStore } from './stores/grade'

const app = createApp(App)
const pinia = createPinia()

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(pinia)
app.use(router)
app.use(ElementPlus, { locale: zhCn })
app.mount('#app')

// 初始化：先验证登录状态，登录成功后再加载成绩数据
const authStore = useAuthStore()
const gradeStore = useGradeStore()

authStore.init().then(() => {
  if (authStore.isAuthenticated) {
    gradeStore.loadFromStorage()
  }
})
