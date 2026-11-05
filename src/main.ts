import { createApp } from 'vue'
import { createPinia } from 'pinia'

// Element Plus 采用「按需引入」：
//   - unplugin-vue-components  自动引入模板中用到的组件及其样式
//   - unplugin-auto-import      自动引入 ElMessage / ElMessageBox 等 API
// 因此这里不再 app.use(ElementPlus) 全量引入，也不再整包 import CSS。
import App from './App.vue'
import router from './router'
import { useAuthStore } from '@/stores/auth'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.mount('#app')

// 初始化：先验证登录状态；成绩数据改为「按需加载」，
// 不再在启动时拉取全量数据（详见 stores/grade.ts）
const authStore = useAuthStore()
authStore.init()
