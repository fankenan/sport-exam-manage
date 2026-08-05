<template>
  <div class="layout-container">
    <!-- ========== 侧边栏 ========== -->
    <aside class="sidebar" :class="{ collapsed: isCollapsed }">
      <!-- Logo 区 -->
      <div class="sidebar-header">
        <div class="logo">
          <div class="logo-icon">
            <img src="@/assets/logo_run.png" width="28" height="28" alt="logo" />
          </div>
          <div class="logo-text" v-show="!isCollapsed">
            <span class="title">体育成绩管理系统</span>
            <span class="sub">SPORT GRADE</span>
          </div>
        </div>
        <button class="collapse-btn" @click="toggleSidebar">
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
            <circle cx="10" cy="7" r="3.5" stroke="#00c6ff" stroke-width="1.5"/>
            <path d="M3 17c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="#00c6ff" stroke-width="1.5" stroke-linecap="round"/>
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
            to="/school-manage"
            class="nav-item"
            :class="{ active: isActive('/school-manage') }"
          >
            <span class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 6l6-4 6 4v7a1 1 0 01-1 1H3a1 1 0 01-1-1V6z" stroke="currentColor" stroke-width="1.5"/>
                <path d="M6 14V9h4v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            <span class="nav-text" v-show="!isCollapsed">学校管理</span>
            <span class="active-dot" v-if="isActive('/school-manage')"></span>
          </router-link>
          <router-link
            v-if="!authStore.isSchoolUser"
            to="/operation-logs"
            class="nav-item"
            :class="{ active: isActive('/operation-logs') }"
          >
            <span class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 3v10h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M3 9h4l1.5-3 2 3H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            <span class="nav-text" v-show="!isCollapsed">操作日志</span>
            <span class="active-dot" v-if="isActive('/operation-logs')"></span>
          </router-link>
          <router-link
            v-if="!authStore.isSchoolUser"
            to="/system-manage"
            class="nav-item"
            :class="{ active: isActive('/system-manage') }"
          >
            <span class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>
                <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </span>
            <span class="nav-text" v-show="!isCollapsed">系统管理</span>
            <span class="active-dot" v-if="isActive('/system-manage')"></span>
          </router-link>
          <router-link
            v-if="authStore.isSchoolUser"
            to="/change-password"
            class="nav-item"
            :class="{ active: isActive('/change-password') }"
          >
            <span class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="3" y="7" width="10" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/>
                <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </span>
            <span class="nav-text" v-show="!isCollapsed">修改密码</span>
            <span class="active-dot" v-if="isActive('/change-password')"></span>
          </router-link>
          <div class="nav-item logout" @click="handleLogout">
            <span class="nav-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M11 11l3-3-3-3M14 8H6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            <span class="nav-text" v-show="!isCollapsed">退出登录</span>
          </div>
        </div>
      </nav>

      <!-- 底部版本 -->
      <div class="sidebar-footer" v-show="!isCollapsed">
        <div class="version">
          <span class="ver-dot"></span>
          v2.0.0 · 2026
        </div>
      </div>
    </aside>

    <!-- ========== 主内容区 ========== -->
    <div class="main-wrapper">
      <!-- 顶部条 -->
      <header class="topbar">
        <div class="topbar-left">
          <div class="page-breadcrumb">
            <span class="breadcrumb-item">{{ currentPageName }}</span>
          </div>
        </div>
        <div class="topbar-right">
          <div class="time-display">
            <span class="time-text">{{ currentTime }}</span>
          </div>
        </div>
      </header>

      <!-- 页面内容 -->
      <main class="main-content">
        <router-view />
      </main>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const isCollapsed = ref(false)
const currentTime = ref('')

const username = computed(() => authStore.user?.username || 'admin')

const roleDisplay = computed(() => {
  if (authStore.isSchoolUser) return authStore.userSchoolName
  return '管理员'
})

const menuItems = [
  {
    path: '/dashboard',
    label: '数据看板',
    icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="1.5" width="5.5" height="6" rx="1" stroke="currentColor" stroke-width="1.3"/>
      <rect x="9" y="1.5" width="5.5" height="4" rx="1" stroke="currentColor" stroke-width="1.3"/>
      <rect x="1.5" y="9.5" width="5.5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/>
      <rect x="9" y="7.5" width="5.5" height="7" rx="1" stroke="currentColor" stroke-width="1.3"/>
    </svg>`,
  },
  {
    path: '/grade-import',
    label: '成绩导入',
    icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1v8M4 5l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M2 12v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
  },
  {
    path: '/grade-seven',
    label: '七年级成绩',
    icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M5 7h6M5 10h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
  },
  {
    path: '/grade-eight',
    label: '八年级成绩',
    icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M5 7h6M5 10h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
  },
  {
    path: '/grade-nine',
    label: '九年级成绩',
    icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M5 7h6M5 10h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
  },
  {
    path: '/admission-grades',
    label: '中招体育成绩',
    icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M13 10l-2 2-2-2M3 10l2-2 2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M3 10V6a2 2 0 012-2h6a2 2 0 012 2v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    schoolOnly: true
  },
  {
    path: '/reconsideration',
    label: '成绩复核',
    icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 4h12v8H2z" stroke="currentColor" stroke-width="1.5"/>
      <path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    adminOnly: true
  },
  {
    path: '/grade-review',
    label: '成绩审核',
    icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/>
      <path d="M6 8l1.5 1.5L10 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  },
  {
    path: '/grade-verify',
    label: '成绩校对',
    icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 12l2-3 2 2 3-4 3 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  },
  {
    path: '/material-upload',
    label: '过程性材料',
    icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M13 11v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2M8 2v7M5 5l3-3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
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
  // 系统分区菜单
  const sysPages: Record<string, string> = {
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

const toggleSidebar = () => { isCollapsed.value = !isCollapsed.value }

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}

let timeTimer: ReturnType<typeof setInterval>
const updateTime = () => {
  const now = new Date()
  currentTime.value = now.toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  })
}
onMounted(() => {
  updateTime()
  timeTimer = setInterval(updateTime, 1000)
})
onUnmounted(() => clearInterval(timeTimer))
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
  width: 240px;
  height: 100vh;
  background: var(--bg-card);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;

  // 左侧发光线条
  &::before {
    content: '';
    position: absolute;
    left: 0; top: 0;
    width: 2px; height: 100%;
    background: linear-gradient(180deg, var(--primary) 0%, var(--accent) 100%);
    opacity: 0.6;
  }

  &.collapsed {
    width: 68px;
    &::before { opacity: 0.3; }
  }
}

/* Logo */
.sidebar-header {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;

  .logo {
    display: flex;
    align-items: center;
    gap: 10px;
    overflow: hidden;

    .logo-icon {
      width: 36px; height: 36px;
      background: linear-gradient(135deg, rgba(0, 198, 255, 0.1), rgba(139, 92, 246, 0.1));
      border: 1px solid rgba(0, 198, 255, 0.2);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }

    .logo-text {
      display: flex;
      flex-direction: column;
      gap: 1px;
      overflow: hidden;

      .title {
        font-size: 14px;
        font-weight: 700;
        color: var(--text-primary);
        white-space: nowrap;
        letter-spacing: 0.02em;
      }
      .sub {
        font-size: 9px;
        font-weight: 600;
        color: var(--primary);
        letter-spacing: 0.15em;
        font-family: var(--font-mono);
        text-transform: uppercase;
      }
    }
  }

  .collapse-btn {
    width: 28px; height: 28px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    color: var(--text-muted);
    display: flex; align-items: center; justify-content: center;
    transition: all 0.2s;
    flex-shrink: 0;
    &:hover {
      border-color: var(--primary);
      color: var(--primary);
      background: var(--bg-hover);
    }
  }
}

/* 用户信息 */
.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  margin: 8px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);

  .avatar {
    width: 32px; height: 32px;
    background: rgba(0, 198, 255, 0.08);
    border: 1px solid rgba(0, 198, 255, 0.2);
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  .user-detail {
    overflow: hidden;
    .username {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap;
    }
    .role {
      font-size: 11px;
      color: var(--primary);
      font-weight: 500;
    }
  }
}

/* 导航 */
.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px 0;
}

.nav-section {
  padding: 0 8px;
  margin-bottom: 4px;
}

.nav-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  padding: 8px 10px 4px;
  font-family: var(--font-mono);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
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
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    opacity: 0.7;
    transition: opacity 0.15s;
  }

  .nav-text { flex: 1; overflow: hidden; }

  .active-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: var(--primary);
    box-shadow: 0 0 6px var(--primary);
    flex-shrink: 0;
  }

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
    border-color: var(--border);
    .nav-icon { opacity: 1; }
  }

  &.active {
    background: linear-gradient(135deg, rgba(0, 198, 255, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%);
    color: var(--primary);
    border-color: rgba(0, 198, 255, 0.2);
    font-weight: 600;
    .nav-icon { opacity: 1; color: var(--primary); }
  }

  &.logout {
    color: var(--text-muted);
    &:hover {
      background: rgba(244, 63, 94, 0.08);
      color: var(--danger);
      border-color: rgba(244, 63, 94, 0.2);
    }
  }
}

/* 版本信息 */
.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;

  .version {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text-muted);
    font-family: var(--font-mono);

    .ver-dot {
      width: 5px; height: 5px;
      border-radius: 50%;
      background: var(--success);
      box-shadow: 0 0 5px var(--success);
    }
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

/* 顶部条 */
.topbar {
  height: 56px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  flex-shrink: 0;

  // 底部细发光线
  box-shadow: 0 1px 0 rgba(0, 198, 255, 0.08);

  .topbar-left {
    display: flex;
    align-items: center;
    gap: 12px;

    .page-breadcrumb {
      display: flex;
      align-items: center;
      gap: 8px;

      .breadcrumb-item {
        font-size: 15px;
        font-weight: 700;
        color: var(--text-primary);
        letter-spacing: 0.02em;
      }
    }
  }

  .topbar-right {
    display: flex;
    align-items: center;
    gap: 16px;

    .time-display {
      .time-text {
        font-size: 13px;
        color: var(--text-muted);
        font-family: var(--font-mono);
        letter-spacing: 0.05em;
      }
    }
  }
}

/* 内容 */
.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: var(--bg-page);
}
</style>

<!-- 全局表格样式：不换行 -->
<style lang="scss">
.el-table .cell {
  white-space: nowrap !important;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
