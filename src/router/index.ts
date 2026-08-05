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
          meta: { title: '成绩审核', icon: 'CircleCheck', adminOnly: true }
        },
        {
          path: '/reconsideration',
          name: 'reconsideration',
          component: () => import('@/views/ReconsiderationView.vue'),
          meta: { title: '成绩复核', icon: 'Edit' }
        },
        {
          path: '/grade-verify',
          name: 'grade-verify',
          component: () => import('@/views/GradeVerifyView.vue'),
          meta: { title: '成绩校对', icon: 'Edit', adminOnly: true }
        },
        {
          path: '/material-upload',
          name: 'material-upload',
          component: () => import('@/views/MaterialUploadView.vue'),
          meta: { title: '过程性材料上传', icon: 'FolderOpened' }
        },
        {
          path: '/school-manage',
          name: 'school-manage',
          component: () => import('@/views/SchoolManageView.vue'),
          meta: { title: '学校管理', icon: 'School', adminOnly: true }
        },
        {
          path: '/system-manage',
          name: 'system-manage',
          component: () => import('@/views/SystemManageView.vue'),
          meta: { title: '系统管理', icon: 'Setting', adminOnly: true }
        },
        {
          path: '/change-password',
          name: 'change-password',
          component: () => import('@/views/ChangePasswordView.vue'),
          meta: { title: '修改密码', icon: 'Lock' }
        },
        {
          path: '/operation-logs',
          name: 'operation-logs',
          component: () => import('@/views/OperationLogsView.vue'),
          meta: { title: '操作日志', icon: 'Document', adminOnly: true }
        }
      ]
    }
  ]
})

// 标记初始化是否完成
let appReady = false

export function setAppReady(ready: boolean) {
  appReady = ready
}

router.beforeEach((to, from, next) => {
  // 初始化未完成时，放行所有路由
  if (!appReady) {
    next()
    return
  }

  const authStore = useAuthStore()

  // 公开页面
  if (to.meta.public) {
    if (to.path === '/login' && authStore.isAuthenticated) {
      next('/')
    } else {
      next()
    }
    return
  }

  // 未登录 → 登录页
  if (!authStore.isAuthenticated) {
    next('/login')
    return
  }

  // 学校用户不能访问管理员页面
  if (to.meta.adminOnly && authStore.isSchoolUser) {
    next('/dashboard')
    return
  }

  next()
})

export default router
