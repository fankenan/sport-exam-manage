<template>
  <div class="change-pwd-page">
    <el-card style="max-width: 480px; margin: 40px auto">
      <template #header>
        <span>修改密码</span>
      </template>

      <el-alert
        v-if="authStore.user?.username"
        type="info"
        :closable="false"
        show-icon
        :title="`当前账号：${authStore.user.username}${authStore.userSchoolName ? '（' + authStore.userSchoolName + '）' : '（管理员）'}`"
        description="修改成功后当前账号的所有登录令牌都会失效，需要重新登录。"
        style="margin-bottom: 20px"
      />

      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="原密码" prop="oldPassword">
          <el-input v-model="form.oldPassword" type="password" show-password placeholder="请输入原密码" />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="form.newPassword" type="password" show-password placeholder="请输入新密码（至少 8 位）" />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input v-model="form.confirmPassword" type="password" show-password placeholder="请再次输入新密码" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">确认修改</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/api'

const router = useRouter()
const authStore = useAuthStore()

const formRef = ref()
const submitting = ref(false)
const form = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })

const validateConfirm = (_rule: any, value: string, callback: any) => {
  if (value !== form.newPassword) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const rules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 8, max: 20, message: '密码长度8-20个字符', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    { validator: validateConfirm, trigger: 'blur' }
  ]
}

const handleSubmit = async () => {
  if (!formRef.value) return

  // Element Plus 的 validate 需要用 Promise 形式等待结果
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const res = await authApi.changePassword(form.oldPassword, form.newPassword)
    // 服务端改密后会吊销该账号已签发的所有令牌（requireRelogin），必须重新登录
    if (res?.requireRelogin !== false) {
      authStore.logout()
      ElMessage.success('密码修改成功，请重新登录')
      router.push('/login')
    } else {
      ElMessage.success('密码修改成功')
      form.oldPassword = ''
      form.newPassword = ''
      form.confirmPassword = ''
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '修改失败')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.change-pwd-page {
  @include page-container;
}
</style>
