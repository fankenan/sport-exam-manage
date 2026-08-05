<template>
  <div class="login-page">
    <!-- 背景动态网格 -->
    <div class="bg-grid"></div>
    <!-- 背景光晕 -->
    <div class="bg-glow bg-glow-1"></div>
    <div class="bg-glow bg-glow-2"></div>

    <!-- 装饰性数字 -->
    <div class="deco-nums">
      <span class="num num-1">2026</span>
      <span class="num num-2">SPORT</span>
    </div>

    <!-- 登录卡片 -->
    <div class="login-card" :class="{ loading: logging }">
      <div class="card-header">
        <div class="card-title">
          <h1>体育成绩管理系统</h1>
          <p>SPORT GRADE MANAGEMENT</p>
        </div>
      </div>

      <!-- 表单 -->
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        class="login-form"
        @submit.prevent="handleLogin"
      >
        <div class="field-group">
          <div class="field-label">用户名</div>
          <el-form-item prop="username" no-status>
            <el-input
              v-model="form.username"
              placeholder="请输入用户名"
              size="large"
              :prefix-icon="UserIcon"
              autocomplete="username"
              @keyup.enter="handleLogin"
            />
          </el-form-item>
        </div>

        <div class="field-group">
          <div class="field-label">密码</div>
          <el-form-item prop="password" no-status>
            <el-input
              v-model="form.password"
              type="password"
              placeholder="请输入密码"
              size="large"
              :prefix-icon="LockIcon"
              show-password
              autocomplete="current-password"
              @keyup.enter="handleLogin"
            />
          </el-form-item>
        </div>

        <el-button
          type="primary"
          size="large"
          class="login-btn"
          :loading="logging"
          @click="handleLogin"
        >
          <span v-if="!logging">登 录 系 统</span>
          <span v-else>登录中...</span>
        </el-button>
      </el-form>

      <div v-if="errorMsg" class="error-msg">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="6" stroke="#f43f5e" stroke-width="1.5"/>
          <path d="M7 4v3.5M7 9.5v.5" stroke="#f43f5e" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        {{ errorMsg }}
      </div>
    </div>

    <!-- 底部信息 -->
    <div class="login-footer">
      <span>SPORT GRADE MANAGEMENT · 2026</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, h } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ElMessage } from 'element-plus'

const router = useRouter()
const authStore = useAuthStore()
const logging = ref(false)
const errorMsg = ref('')
const formRef = ref()

const form = reactive({ username: '', password: '' })

// SVG 图标组件
const UserIcon = h('svg', {
  width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', style: 'display:block'
}, [
  h('circle', { cx: 8, cy: 6, r:3, stroke: 'currentColor', 'stroke-width': 1.5 }),
  h('path', { d: 'M2 14c0-3.314 2.686-6 6-6s6 2.686 6 6', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round' })
])
const LockIcon = h('svg', {
  width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', style: 'display:block'
}, [
  h('rect', { x: 2, y: 7, width: 12, height: 8, rx: 1.5, stroke: 'currentColor', 'stroke-width': 1.5 }),
  h('path', { d: 'M5 7V5a3 3 0 016 0v2', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round' })
])

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

const handleLogin = async () => {
  if (!formRef.value) return
  await formRef.value.validate().catch(() => {})
  if (logging.value) return

  logging.value = true
  errorMsg.value = ''

  try {
    const ok = await authStore.login(form.username, form.password)
    if (ok) {
      ElMessage.success('登录成功，欢迎回来！')
      router.push('/grade-import')
    }
  } catch (e: any) {
    errorMsg.value = e.message || '用户名或密码错误'
  } finally {
    logging.value = false
  }
}
</script>

<style scoped lang="scss">
.login-page {
  min-height: 100vh;
  background: var(--bg-base);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  padding: 24px;
}

/* 动态网格背景 */
.bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(0, 198, 255, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 198, 255, 0.04) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%);
}

/* 光晕 */
.bg-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  pointer-events: none;
}
.bg-glow-1 {
  width: 500px; height: 500px;
  background: rgba(0, 198, 255, 0.07);
  top: -150px; left: -100px;
}
.bg-glow-2 {
  width: 400px; height: 400px;
  background: rgba(139, 92, 246, 0.07);
  bottom: -100px; right: -80px;
}

/* 装饰数字 */
.deco-nums {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;

  .num {
    position: absolute;
    font-family: var(--font-mono);
    font-weight: 900;
    color: rgba(0, 198, 255, 0.03);
    letter-spacing: 0.05em;
    user-select: none;
  }
  .num-1 { font-size: 120px; top: 10%; left: 5%; }
  .num-2 { font-size: 80px; bottom: 8%; right: 5%; }
}

/* 登录卡片 */
.login-card {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 420px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 40px 36px;
  box-shadow:
    0 0 0 1px rgba(0, 198, 255, 0.05),
    0 24px 60px rgba(0, 0, 0, 0.7),
    0 0 80px rgba(0, 198, 255, 0.04);
  backdrop-filter: blur(20px);

  // 顶部渐变边框
  &::before {
    content: '';
    position: absolute;
    top: 0; left: 20%; right: 20%;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--primary), transparent);
    opacity: 0.5;
  }
}

/* 卡片头部 */
.card-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  margin-bottom: 36px;
}

.logo-icon {
  width: 64px; height: 64px;
  background: rgba(0, 198, 255, 0.06);
  border: 1px solid rgba(0, 198, 255, 0.15);
  border-radius: 18px;
  display: flex; align-items: center; justify-content: center;
}

.card-title {
  text-align: center;

  h1 {
    font-size: 22px;
    font-weight: 800;
    color: var(--text-primary);
    letter-spacing: 0.05em;
    margin-bottom: 4px;
  }

  p {
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--primary);
    letter-spacing: 0.25em;
    font-weight: 600;
  }
}

/* 表单 */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-group {
  margin-bottom: 4px;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 6px;
  font-family: var(--font-mono);
}

/* 登录按钮 */
.login-btn {
  width: 100% !important;
  height: 46px !important;
  font-size: 15px !important;
  letter-spacing: 0.2em !important;
  margin-top: 12px;
  border-radius: var(--radius-md) !important;
}

/* 错误提示 */
.error-msg {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 10px 14px;
  background: rgba(244, 63, 94, 0.08);
  border: 1px solid rgba(244, 63, 94, 0.2);
  border-radius: var(--radius-md);
  color: var(--danger);
  font-size: 13px;
}

/* 底部 */
.login-footer {
  position: relative;
  z-index: 10;
  margin-top: 28px;
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  letter-spacing: 0.1em;
}
</style>
