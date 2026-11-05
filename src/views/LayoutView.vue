<template>
  <div class="layout-container">
    <!-- ========== 侧边栏 ========== -->
    <aside class="sidebar" :class="{ collapsed: isCollapsed, 'mobile-open': mobileOpen }">
      <div class="sidebar-header">
        <div class="logo">
          <div class="logo-icon">
            <img src="@/assets/logo_run.svg" width="26" height="26" alt="logo" />
          </div>
          <div class="logo-text" v-show="!isCollapsed">
            <span class="title">体育成绩管理系统</span>
            <span class="sub">SPORT GRADE</span>
          </div>
        </div>
        <button class="collapse-btn" @click="toggleSidebar" :title="isCollapsed ? '展开菜单' : '收起菜单'">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path v-if="!isCollapsed" d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path v-else d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>

      <!-- 用户信息 -->
      <div class="user-info" v-show="!isCollapsed">
        <div class="avatar">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="7" r="3.5" stroke="currentColor" stroke-width="1.5"/>
            <path d="M3 17c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="user-detail">
          <div class="username">{{ username }}</div>
          <div class="role">{{ roleDisplay }}</div>
        </div>
      </div>

      <!-- 导航菜单 -->
      <nav class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-label" v-show="!isCollapsed">数据管理</div>
          <router-link
            v-for="item in visibleMenuItems"
            :key="item.path"
            :to="item.path"
            class="nav-item"
            :class="{ active: isActive(item.path) }"
            @click="mobileOpen = false"
          >
            <span class="nav-icon" v-html="item.icon"></span>
            <span class="nav-text" v-show="!isCollapsed">{{ item.label }}</span>
            <span class="active-dot" v-if="isActive(item.path)"></span>
          </router-link>
        </div>

        <div class="nav-section">
          <div class="nav-label" v-show="!isCollapsed">系统</div>
          <router-link
            v-if="!authStore.isSchoolUser"
            to="/submission-review"
            class="nav-item"
            :class="{ active: isActive('/submission-review') }"
            @click="mobileOpen = false"
          >
            <span class="nav-icon" v-html="icons.review"></span>
            <span class="nav-text" v-show="!isCollapsed">上报审核</span>
            <span v-if="pendingCount > 0" class="nav-badge">{{ pendingCount }}</span>
            <span class="active-dot" v-if="isActive('/submission-review')"></span>
          </router-link>
          <router-link
            v-if="!authStore.isSchoolUser"
            to="/registration-review"
            class="nav-item"
            :class="{ active: isActive('/registration-review') }"
            @click="mobileOpen = false"
          >
            <span class="nav-icon" v-html="icons.registration"></span>
            <span class="nav-text" v-show="!isCollapsed">报名审核</span>
            <span v-if="pendingRegistrations > 0" class="nav-badge">{{ pendingRegistrations }}</span>
            <span class="active-dot" v-if="isActive('/registration-review')"></span>
          </router-link>
          <router-link
            v-if="!authStore.isSchoolUser"
            to="/school-manage"
            class="nav-item"
            :class="{ active: isActive('/school-manage') }"
            @click="mobileOpen = false"
          >
            <span class="nav-icon" v-html="icons.school"></span>
            <span class="nav-text" v-show="!isCollapsed">学校管理</span>
            <span class="active-dot" v-if="isActive('/school-manage')"></span>
          </router-link>
          <router-link
            v-if="!authStore.isSchoolUser"
            to="/operation-logs"
            class="nav-item"
            :class="{ active: isActive('/operation-logs') }"
            @click="mobileOpen = false"
          >
            <span class="nav-icon" v-html="icons.log"></span>
            <span class="nav-text" v-show="!isCollapsed">操作日志</span>
            <span class="active-dot" v-if="isActive('/operation-logs')"></span>
          </router-link>
          <router-link
            v-if="!authStore.isSchoolUser"
            to="/system-manage"
            class="nav-item"
            :class="{ active: isActive('/system-manage') }"
            @click="mobileOpen = false"
          >
            <span class="nav-icon" v-html="icons.settings"></span>
            <span class="nav-text" v-show="!isCollapsed">系统管理</span>
            <span class="active-dot" v-if="isActive('/system-manage')"></span>
          </router-link>
          <router-link
            to="/change-password"
            class="nav-item"
            :class="{ active: isActive('/change-password') }"
            @click="mobileOpen = false"
          >
            <span class="nav-icon" v-html="icons.lock"></span>
            <span class="nav-text" v-show="!isCollapsed">修改密码</span>
            <span class="active-dot" v-if="isActive('/change-password')"></span>
          </router-link>
          <div class="nav-item logout" @click="handleLogout">
            <span class="nav-icon" v-html="icons.logout"></span>
            <span class="nav-text" v-show="!isCollapsed">退出登录</span>
          </div>
        </div>
      </nav>

      <div class="sidebar-footer" v-show="!isCollapsed">
        <div class="version">
          <span class="ver-dot"></span>
          v3.0.0 · 2026
        </div>
      </div>
    </aside>

    <!-- 移动端遮罩 -->
    <div v-if="mobileOpen" class="mobile-mask" @click="mobileOpen = false"></div>

    <!-- ========== 主内容区 ========== -->
    <div class="main-wrapper">
      <header class="topbar">
        <div class="topbar-left">
          <button class="mobile-toggle" @click="mobileOpen = !mobileOpen" title="菜单">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
          </button>
          <div class="page-breadcrumb">
            <span class="breadcrumb-item">{{ currentPageName }}</span>
          </div>
        </div>
        <div class="topbar-right">
          <button class="icon-btn" :title="isDark ? '切换到浅色模式' : '切换到深色模式'" @click="toggleTheme">
            <svg v-if="isDark" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="3.2" stroke="currentColor" stroke-width="1.4"/>
              <path d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.95 3.05l-1.13 1.13M4.18 11.82l-1.13 1.13M12.95 12.95l-1.13-1.13M4.18 4.18L3.05 3.05"
                stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M13.5 9.6A5.8 5.8 0 016.4 2.5a5.8 5.8 0 107.1 7.1z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
            </svg>
          </button>
          <div class="time-display">
            <span class="time-text">{{ currentTime }}</span>
          </div>
        </div>
      </header>

      <main class="main-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { submissionApi, registrationApi } from '@/api'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const isCollapsed = ref(false)
const mobileOpen = ref(false)
const currentTime = ref('')
const isDark = ref(localStorage.getItem('theme') === 'dark')

const username = computed(() => authStore.user?.username || 'admin')

const roleDisplay = computed(() => {
  if (authStore.isSchoolUser) return authStore.userSchoolName
  return '管理员'
})

// ========== 图标 ==========
const icons = {
  review: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M6 8l1.5 1.5L10 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  registration: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 2h8v12l-4-2-4 2V2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M6.5 6.5l1 1 2-2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  school: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 6l6-4 6 4v7a1 1 0 01-1 1H3a1 1 0 01-1-1V6z" stroke="currentColor" stroke-width="1.5"/><path d="M6 14V9h4v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  log: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3v10h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M3 9h4l1.5-3 2 3H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  settings: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  lock: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="3" y="7" width="10" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  logout: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 11l3-3-3-3M14 8H6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
}

const menuItems = [
  {
    path: '/dashboard',
    label: '数据看板',
    icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="1.5" width="5.5" height="6" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="9" y="1.5" width="5.5" height="4" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="1.5" y="9.5" width="5.5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="9" y="7.5" width="5.5" height="7" rx="1" stroke="currentColor" stroke-width="1.3"/></svg>`,
  },
  {
    path: '/grade-import',
    label: '成绩导入',
    icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1v8M4 5l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  },
  {
    path: '/grade-seven',
    label: '七年级成绩',
    icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M5 7h6M5 10h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  },
  {
    path: '/grade-eight',
    label: '八年级成绩',
    icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M5 7h6M5 10h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  },
  {
    path: '/grade-nine',
    label: '九年级成绩',
    icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M5 7h6M5 10h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  },
  {
    path: '/admission-grades',
    label: '中招体育成绩',
    icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13 10l-2 2-2-2M3 10l2-2 2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 10V6a2 2 0 012-2h6a2 2 0 012 2v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  },
  {
    path: '/reconsideration',
    label: '成绩复核',
    icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12v8H2z" stroke="currentColor" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    path: '/grade-review',
    label: '成绩审核',
    icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M6 8l1.5 1.5L10 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    path: '/grade-verify',
    label: '成绩校对',
    icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 12l2-3 2 2 3-4 3 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    path: '/material-upload',
    label: '过程性材料',
    icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13 11v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2M8 2v7M5 5l3-3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
]

// 学校用户隐藏管理员专属页面，管理员隐藏学校专属页面
const schoolHiddenPaths = ['/grade-review', '/grade-verify']
const adminHiddenPaths = ['/reconsideration']
const visibleMenuItems = computed(() => {
  if (authStore.isSchoolUser) {
    return menuItems.filter(m => !schoolHiddenPaths.includes(m.path))
  }
  return menuItems.filter(m => !adminHiddenPaths.includes(m.path))
})

const currentPageName = computed(() => {
  const item = menuItems.find(m => route.path.startsWith(m.path))
  if (item) return item.label
  const sysPages: Record<string, string> = {
    '/submission-review': '上报审核',
    '/registration-review': '报名审核',
    '/school-manage': '学校管理',
    '/operation-logs': '操作日志',
    '/reconsideration': '成绩复核',
    '/change-password': '修改密码',
    '/system-manage': '系统管理',
  }
  for (const [p, label] of Object.entries(sysPages)) {
    if (route.path.startsWith(p)) return label
  }
  return '控制台'
})

const isActive = (path: string) => route.path.startsWith(path)

const toggleSidebar = () => { isCollapsed.value = !isCollapsed }

// ========== 待审核角标 ==========
// 管理员侧边栏显示待审核上报 / 报名数量，避免被淹没在历史记录里
const pendingCount = ref(0)
const pendingRegistrations = ref(0)

const loadPendingCount = async () => {
  if (!authStore.isAuthenticated || authStore.isSchoolUser) {
    pendingCount.value = 0
    pendingRegistrations.value = 0
    return
  }
  try {
    const res = await submissionApi.getPendingCount()
    pendingCount.value = res.count || 0
  } catch {
    pendingCount.value = 0
  }
  try {
    const res = await registrationApi.getPendingCount()
    pendingRegistrations.value = res.count || 0
  } catch {
    pendingRegistrations.value = 0
  }
}

watch(() => authStore.isAuthenticated, loadPendingCount)
watch(() => route.path, loadPendingCount)

// ========== 主题 ==========
const applyTheme = () => {
  document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}
const toggleTheme = () => {
  isDark.value = !isDark.value
  applyTheme()
}
watch(isDark, applyTheme)

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}

// ========== 时钟 ==========
let timeTimer: ReturnType<typeof setInterval>
const updateTime = () => {
  const now = new Date()
  currentTime.value = now.toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
}

const handleResize = () => {
  if (window.innerWidth >= 1024) mobileOpen.value = false
}

onMounted(() => {
  applyTheme()
  updateTime()
  timeTimer = setInterval(updateTime, 1000)
  window.addEventListener('resize', handleResize)
  if (window.innerWidth < 1024) isCollapsed.value = true
  loadPendingCount()
})

onUnmounted(() => {
  clearInterval(timeTimer)
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped lang="scss">
.layout-container {
  display: flex;
  width: 100%;
  height: 100vh;
  background: var(--bg-page);
  overflow: hidden;
}

/* ==============================================
   侧边栏
   ============================================== */
.sidebar {
  width: 232px;
  height: 100vh;
  background: var(--bg-card);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s ease;
  position: relative;
  overflow: hidden;
  z-index: 30;

  // 左侧发光线条
  &::before {
    content: '';
    position: absolute;
    left: 0; top: 0;
    width: 2px; height: 100%;
    background: linear-gradient(180deg, var(--primary) 0%, var(--brand-cyan) 100%);
    opacity: 0.55;
    pointer-events: none;
  }

  &.collapsed { width: 66px; }
  &.collapsed &::before { opacity: 0.3; }
}

/* Logo */
.sidebar-header {
  height: 62px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;

  .logo {
    display: flex;
    align-items: center;
    gap: 10px;
    overflow: hidden;
  }

  .logo-icon {
    width: 34px; height: 34px;
    background: linear-gradient(135deg, rgba(0, 184, 230, 0.10), rgba(139, 92, 246, 0.10));
    border: 1px solid rgba(0, 184, 230, 0.20);
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  .logo-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    overflow: hidden;
  }

  .logo-text .title {
    font-size: 13.5px;
    font-weight: 700;
    color: var(--text-primary);
    white-space: nowrap;
    letter-spacing: 0.01em;
  }

  .logo-text .sub {
    font-size: 9px;
    font-weight: 600;
    color: var(--brand-cyan);
    letter-spacing: 0.15em;
    font-family: var(--font-mono);
    text-transform: uppercase;
  }

  .collapse-btn {
    width: 26px; height: 26px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    color: var(--text-muted);
    display: flex; align-items: center; justify-content: center;
    transition: all 0.18s;
    flex-shrink: 0;

    &:hover {
      border-color: var(--brand-cyan);
      color: var(--brand-cyan);
      background: var(--bg-hover);
    }
  }
}

/* 用户信息 */
.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 13px;
  margin: 8px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);

  .avatar {
    width: 30px; height: 30px;
    background: rgba(0, 184, 230, 0.08);
    border: 1px solid rgba(0, 184, 230, 0.20);
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    color: var(--brand-cyan);
    flex-shrink: 0;
  }

  .user-detail {
    overflow: hidden;
    min-width: 0;
  }

  .username {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .role {
    font-size: 11px;
    color: var(--brand-cyan);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

/* 导航 */
.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 6px 0;
}

.nav-section {
  padding: 0 8px;
  margin-bottom: 4px;
}

.nav-label {
  @include mono-label;
  padding: 10px 10px 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--text-muted);
  text-decoration: none;
  font-size: 13.5px;
  font-weight: 500;
  transition: all 0.15s ease;
  position: relative;
  margin-bottom: 2px;
  white-space: nowrap;
  border: 1px solid transparent;

  .nav-icon {
    width: 20px; height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    opacity: 0.75;
    transition: opacity 0.15s;
  }

  .nav-text { flex: 1; overflow: hidden; }

  .active-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: var(--brand-cyan);
    box-shadow: 0 0 6px var(--brand-cyan);
    flex-shrink: 0;
  }

  /* 待审核角标 */
  .nav-badge {
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: var(--danger);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    line-height: 18px;
    text-align: center;
    flex-shrink: 0;
    box-shadow: 0 0 0 2px var(--bg-card);
  }

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
    border-color: var(--border);
    .nav-icon { opacity: 1; }
  }

  &.active {
    background: linear-gradient(135deg, rgba(0, 184, 230, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%);
    color: var(--text-primary);
    border-color: rgba(0, 184, 230, 0.22);
    font-weight: 600;
    .nav-icon { opacity: 1; color: var(--brand-cyan); }
  }

  &.logout {
    color: var(--text-muted);
    &:hover {
      background: rgba(239, 68, 68, 0.08);
      color: var(--danger);
      border-color: rgba(239, 68, 68, 0.18);
    }
  }
}

/* 版本 */
.sidebar-footer {
  padding: 11px 14px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;

  .version {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .ver-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: var(--success);
    box-shadow: 0 0 5px var(--success);
  }
}

/* ==============================================
   主内容区
   ============================================== */
.main-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.topbar {
  height: 56px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 22px;
  flex-shrink: 0;
  box-shadow: 0 1px 0 rgba(0, 184, 230, 0.06);

  .topbar-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .breadcrumb-item {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: 0.01em;
  }

  .topbar-right {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .time-text {
    font-size: 13px;
    color: var(--text-muted);
    font-family: var(--font-mono);
    letter-spacing: 0.04em;
  }
}

.icon-btn {
  width: 30px; height: 30px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text-secondary);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: all 0.18s;

  &:hover {
    color: var(--brand-cyan);
    border-color: var(--brand-cyan);
  }
}

.mobile-toggle {
  display: none;
  width: 32px; height: 32px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text-secondary);
  align-items: center; justify-content: center;
  cursor: pointer;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 22px;
  background: var(--bg-page);
}

/* 路由切换过渡 */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}
.fade-enter-from { opacity: 0; transform: translateY(6px); }
.fade-leave-to { opacity: 0; }

.mobile-mask {
  display: none;
}

/* ==============================================
   响应式
   ============================================== */
@media (max-width: 1023px) {
  .sidebar {
    position: fixed;
    left: 0; top: 0; bottom: 0;
    transform: translateX(-100%);
    box-shadow: var(--shadow-lg);

    &.mobile-open { transform: translateX(0); }
  }

  .mobile-mask {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(2, 6, 23, 0.45);
    z-index: 20;
  }

  .mobile-toggle { display: flex; }

  .main-content { padding: 16px; }
}
</style>
