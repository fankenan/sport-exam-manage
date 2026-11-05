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

  /**
   * 登录
   * @throws 失败时抛出原始错误（由调用方展示），不再静默吞掉
   */
  const login = async (username: string, password: string): Promise<boolean> => {
    const res = await authApi.login(username, password)
    if (!res?.token) throw new Error('登录失败：服务端未返回令牌')

    const userData: User = {
      id: res.user?.id ?? 0,
      username: res.user?.username || username,
      role: res.user?.role || 'admin',
      schoolId: res.user?.schoolId ?? null,
      schoolName: res.user?.schoolName ?? null,
    }
    user.value = userData
    token.value = res.token
    localStorage.setItem('token', res.token)
    localStorage.setItem('user', JSON.stringify(userData))
    return true
  }

  const logout = () => {
    user.value = null
    token.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  /** 应用启动时校验登录态 */
  const init = async () => {
    const savedUser = localStorage.getItem('user')
    const savedToken = localStorage.getItem('token')
    if (savedUser && savedToken) {
      try {
        const verified = await authApi.verify()
        user.value = {
          id: verified.id,
          username: verified.username,
          role: verified.role,
          schoolId: verified.schoolId ?? null,
          schoolName: verified.schoolName ?? null,
        }
        token.value = savedToken
      } catch {
        // token 无效，清除登录状态
        logout()
      }
    }
    setAppReady(true)
  }

  // ========== 管理员管理（后端 API） ==========

  /** 注意：不再吞掉异常，调用方需要能区分「加载失败」与「空列表」 */
  const getAdmins = () => authApi.getAdmins()

  const addAdmin = (username: string, password: string, schoolId?: number | null, role?: string) =>
    authApi.addAdmin({ username, password, schoolId: schoolId ?? null, role })

  const updateAdmin = (id: number, data: { password?: string; schoolId?: number | null; role?: string; status?: number; username?: string }) =>
    authApi.updateAdmin(id, data)

  const deleteAdmin = (id: number) => authApi.deleteAdmin(id)

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
    deleteAdmin,
  }
})
