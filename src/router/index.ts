import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true }
    },
    {
      path: '/',
      name: 'layout',
      component: () => import('@/views/LayoutView.vue'),
      redirect: '/dashboard',
      children: [
        {
          path: '/dashboard',
          name: 'dashboard',
          component: () => import('@/views/DashboardView.vue'),
          meta: { title: '数据看板', icon: 'DataAnalysis' }
        },
        {
          path: '/grade-import',
          name: 'grade-import',
          component: () => import('@/views/GradeImportView.vue'),
          meta: { title: '成绩导入', icon: 'Upload' }
        },
        {
          path: '/grade-seven',
          name: 'grade-seven',
          component: () => import('@/views/GradeSevenView.vue'),
          meta: { title: '七年级', icon: 'Reading' }
        },
        {
          path: '/grade-eight',
          name: 'grade-eight',
          component: () => import('@/views/GradeEightView.vue'),
          meta: { title: '八年级', icon: 'Reading' }
        },
        {
          path: '/grade-nine',
          name: 'grade-nine',
          component: () => import('@/views/GradeNineView.vue'),
          meta: { title: '九年级', icon: 'Reading' }
        },
        {
          path: '/admission-grades',
          name: 'admission-grades',
          component: () => import('@/views/AdmissionGradesView.vue'),
          meta: { title: '中招体育成绩', icon: 'DocumentChecked' }
        },
        {
          path: '/grade-review',
          name: 'grade-review',
          component: () => import('@/views/GradeReviewView.vue'),
          meta: { title: '成绩审核', icon: 'CircleCheck' }
        },
        {
          path: '/grade-verify',
          name: 'grade-verify',
          component: () => import('@/views/GradeVerifyView.vue'),
          meta: { title: '成绩校对', icon: 'Edit' }
        },
        {
          path: '/material-upload',
          name: 'material-upload',
          component: () => import('@/views/MaterialUploadView.vue'),
          meta: { title: '过程性材料上传', icon: 'FolderOpened' }
        },
        {
          path: '/system-manage',
          name: 'system-manage',
          component: () => import('@/views/SystemManageView.vue'),
          meta: { title: '系统管理', icon: 'Setting' }
        },
        {
          path: '/operation-logs',
          name: 'operation-logs',
          component: () => import('@/views/OperationLogsView.vue'),
          meta: { title: '操作日志', icon: 'Document' }
        }
      ]
    }
  ]
})

// 标记初始化是否完成，防止 init 还没完成就被路由守卫踢到登录页
let appReady = false

// 导出设置就绪的方法，供 auth store 调用
export function setAppReady(ready: boolean) {
  appReady = ready
}

router.beforeEach((to, from, next) => {
  // 初始化未完成时，放行所有路由（等待 init 完成后再判断）
  if (!appReady) {
    next()
    return
  }

  const authStore = useAuthStore()

  if (!to.meta.public && !authStore.isAuthenticated) {
    next('/login')
  } else if (to.path === '/login' && authStore.isAuthenticated) {
    next('/')
  } else {
    next()
  }
})

export default router
