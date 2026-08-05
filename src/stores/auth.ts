import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api'
import { setAppReady } from '@/router'

interface User {
  id: number
  username: string
  role: 'admin' | 'user' | 'school'
  schoolId: number | null
  schoolName: string | null
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('token'))

  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin' && !user.value?.schoolId)
  const isSchoolUser = computed(() => !!user.value?.schoolId)
  const userSchoolName = computed(() => user.value?.schoolName || '')

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const res = await authApi.login(username, password)
      if (res.token) {
        const userData: User = {
          id: res.user?.id || 1,
          username: res.user?.username || username,
          role: res.user?.role || 'admin',
          schoolId: res.user?.schoolId || null,
          schoolName: res.user?.schoolName || null
        }
        user.value = userData
        token.value = res.token
        localStorage.setItem('token', token.value || '')
        localStorage.setItem('user', JSON.stringify(userData))
        return true
      }
      return false
    } catch (error) {
      console.error('登录失败:', error)
      return false
    }
  }

  const logout = () => {
    user.value = null
    token.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  const init = async () => {
    const savedUser = localStorage.getItem('user')
    const savedToken = localStorage.getItem('token')
    if (savedUser && savedToken) {
      try {
        // 向后端验证 token 是否有效
        const verified = await authApi.verify()
        user.value = {
          id: verified.id,
          username: verified.username,
          role: verified.role,
          schoolId: verified.schoolId || null,
          schoolName: verified.schoolName || null
        }
        token.value = savedToken
      } catch {
        // token 无效，清除登录状态
        logout()
      }
    }
    // 初始化完成，通知路由守卫可以开始检查认证状态
    setAppReady(true)
  }

  // ========== 管理员管理（后端 API） ==========

  const getAdmins = async () => {
    try {
      return await authApi.getAdmins()
    } catch {
      return []
    }
  }

  const addAdmin = async (username: string, password: string, schoolId?: number | null) => {
    return await authApi.addAdmin({ username, password, schoolId: schoolId || null })
  }

  const updateAdmin = async (id: number, data: { password?: string; schoolId?: number | null }) => {
    return await authApi.updateAdmin(id, data)
  }

  const deleteAdmin = async (id: number) => {
    return await authApi.deleteAdmin(id)
  }

  return {
    user,
    token,
    isAuthenticated,
    isAdmin,
    isSchoolUser,
    userSchoolName,
    login,
    logout,
    init,
    getAdmins,
    addAdmin,
    updateAdmin,
    deleteAdmin
  }
})
