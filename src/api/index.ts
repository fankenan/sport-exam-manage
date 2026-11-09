const API_BASE = import.meta.env.VITE_API_BASE || '/api'

/** 请求超时（毫秒） */
const REQUEST_TIMEOUT = 30000

/** 从后端统一响应体中提取错误信息 */
function extractError(payload: any, fallback: string): Error {
  const err: any = new Error(payload?.message || fallback)
  if (payload?.data?.errors) err.errors = payload.data.errors
  if (payload?.data?.errorCount) err.errorCount = payload.data.errorCount
  if (payload?.code) err.code = payload.code
  return err
}

/**
 * 通用请求封装
 * - 自动附带 Authorization
 * - 自动解包 { code, data, message }
 * - 超时控制
 */
async function request(url: string, options: RequestInit = {}): Promise<any> {
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  let res: Response
  try {
    res = await fetch(`${API_BASE}${url}`, { ...options, headers, signal: controller.signal })
  } catch (e: any) {
    clearTimeout(timer)
    if (e?.name === 'AbortError') throw new Error('请求超时，请检查网络或稍后重试')
    throw new Error('网络异常，请检查后端服务是否已启动')
  }
  clearTimeout(timer)

  let json: any = null
  try {
    json = await res.json()
  } catch {
    json = null
  }

  if (!res.ok) {
    // 后端已统一使用真实 HTTP 状态码
    throw extractError(json, `请求失败 (HTTP ${res.status})`)
  }

  if (json && typeof json === 'object' && 'code' in json && 'data' in json) {
    if (json.code !== 200) throw extractError(json, '请求失败')
    return json.data
  }
  return json
}

/** 构造查询串 */
function buildQuery(params: Record<string, any>): string {
  const query = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') query.set(k, String(v))
  }
  const s = query.toString()
  return s ? `?${s}` : ''
}

/** 带鉴权下载文件 */
export async function downloadFile(url: string, fallbackName: string) {
  const token = localStorage.getItem('token')
  const res = await fetch(`${API_BASE}${url}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    let msg = `下载失败 (HTTP ${res.status})`
    try {
      const j = await res.json()
      msg = j.message || msg
    } catch { /* ignore */ }
    throw new Error(msg)
  }

  // 优先使用服务端指定的文件名
  let filename = fallbackName
  const disposition = res.headers.get('Content-Disposition')
  if (disposition) {
    const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
    const plain = /filename="([^"]+)"/i.exec(disposition)
    if (star) filename = decodeURIComponent(star[1])
    else if (plain) filename = decodeURIComponent(plain[1])
  }

  const blob = await res.blob()
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(href)
}

/** POST 方式下载文件（导出等） */
async function downloadFilePost(url: string, body: any, fallbackName: string) {
  const token = localStorage.getItem('token')
  const res = await fetch(`${API_BASE}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    let msg = `导出失败 (HTTP ${res.status})`
    try {
      const j = await res.json()
      msg = j.message || msg
    } catch { /* ignore */ }
    throw new Error(msg)
  }

  let filename = fallbackName
  const disposition = res.headers.get('Content-Disposition')
  if (disposition) {
    const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
    const plain = /filename="([^"]+)"/i.exec(disposition)
    if (star) filename = decodeURIComponent(star[1])
    else if (plain) filename = decodeURIComponent(plain[1])
  }

  const blob = await res.blob()
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(href)
}

// ========== 认证 API ==========
export const authApi = {
  login: (username: string, password: string) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  verify: () => request('/auth/verify'),

  getAdmins: () => request('/admins'),

  addAdmin: (data: { username: string; password: string; schoolId?: number | null; role?: string }) =>
    request('/admins', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAdmin: (id: number, data: { password?: string; schoolId?: number | null; role?: string; status?: number; username?: string }) =>
    request(`/admins/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteAdmin: (id: number) =>
    request(`/admins/${id}`, {
      method: 'DELETE',
    }),

  changePassword: (oldPassword: string, newPassword: string) =>
    request('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ oldPassword, newPassword }),
    }),

  toggleAllSchools: (enable: boolean) =>
    request('/admins/toggle-schools', {
      method: 'PUT',
      body: JSON.stringify({ enable }),
    }),

  getSchoolsStatus: () => request('/admins/schools-status'),
}

// ========== 学校管理 API ==========
export const schoolApi = {
  getList: () => request('/schools'),

  add: (name: string) =>
    request('/schools', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  update: (id: number, name: string) =>
    request(`/schools/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    }),

  delete: (id: number) =>
    request(`/schools/${id}`, {
      method: 'DELETE',
    }),
}

// ========== 数据 API ==========
export const dataApi = {
  /** 看板统计（服务端聚合，不再全量拉取） */
  statsOverview: (params: { year?: string; school?: string } = {}) =>
    request(`/data/stats/overview${buildQuery(params)}`),

  /** 分页查询 */
  page: (
    table: string,
    params: {
      page?: number
      pageSize?: number
      keyword?: string
      graduationYear?: string
      school?: string
      verifyResult?: string
      remark?: string
      reviewStatus?: string
      sortField?: string
      sortOrder?: 'asc' | 'desc'
    } = {},
  ) => request(`/data/page/${table}${buildQuery(params)}`),

  /** 增量导入 */
  import: (table: string, rows: any[]) =>
    request('/data/import', {
      method: 'POST',
      body: JSON.stringify({ table, rows }),
    }),

  /** 清空全部成绩数据（仅管理员，破坏性操作） */
  clear: () =>
    request('/data/clear', {
      method: 'POST',
    }),

  /** 中招成绩匹配（服务端计算） */
  matchAdmission: (rows: any[], year?: string) =>
    request('/data/match-admission', {
      method: 'POST',
      body: JSON.stringify({ rows, year }),
    }),

  /** 批量查重（服务端查，替代前端逐行全表扫描） */
  checkDuplicates: (table: string, identities: string[]) =>
    request('/data/check-duplicates', {
      method: 'POST',
      body: JSON.stringify({ table, identities }),
    }),

  /**
   * 导出（服务端生成 Excel）
   *
   * 学校账号是否允许导出由管理员在「系统管理」里控制，
   * 服务端会强校验 —— 前端隐藏按钮只是界面表现。
   */
  export: (params: {
    table: string
    filters?: Record<string, any>
    columns?: Array<{ prop: string; label: string }>
    sheetName?: string
  }) => downloadFilePost('/data/export', params, '成绩导出.xlsx'),

  getYears: () => request('/data/years'),

  getSchools: (year?: string) => request(`/data/schools${buildQuery({ year })}`),

  getSchoolStats: (year: string) => request(`/data/school-stats${buildQuery({ year })}`),

  // 重复数据处理
  saveDuplicates: (rows: any[]) =>
    request('/data/duplicates', { method: 'POST', body: JSON.stringify({ rows }) }),
  getDuplicates: () => request('/data/duplicates'),
  updateDuplicate: (id: number, data: Record<string, any>) =>
    request(`/data/duplicates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  submitDuplicate: (id: number) => request(`/data/duplicates/${id}/submit`, { method: 'POST' }),
  deleteDuplicate: (id: number) => request(`/data/duplicates/${id}`, { method: 'DELETE' }),

  // 单条更新 / 删除
  update: (table: string, id: string, data: Record<string, any>) =>
    request(`/data/${table}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (table: string, id: string) =>
    request(`/data/${table}/${id}`, {
      method: 'DELETE',
    }),
}

// ========== 学校上报 API（新增） ==========
export const submissionApi = {
  /** 预检：校验 + 差异对比，不写库
   *  allowPartial=true（仅管理员）时，即使有校验错误也返回其余可导入行的差异 */
  preview: (data: {
    school?: string
    year: string
    gradeLevel: string
    rows: any[]
    allowPartial?: boolean
  }) =>
    request('/submissions/preview', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** 提交上报 */
  submit: (data: {
    school?: string
    year: string
    gradeLevel: string
    rows: any[]
    fileName?: string
  }) =>
    request('/submissions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** 上报列表（分页） */
  getList: (params: {
    page?: number
    pageSize?: number
    status?: string
    gradeLevel?: string
    school?: string
  } = {}) => request(`/submissions${buildQuery(params)}`),

  /** 上报详情 */
  getDetail: (id: number) => request(`/submissions/${id}`),

  /** 待审核数量 */
  getPendingCount: () => request('/submissions/pending-count'),

  /** 管理员审核通过并发布 */
  approve: (id: number) => request(`/submissions/${id}/approve`, { method: 'POST' }),

  /** 管理员驳回 */
  reject: (id: number, reason: string) =>
    request(`/submissions/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  /** 下载上报模板 */
  downloadTemplate: (gradeLevel: string, filename: string) =>
    downloadFile(`/submissions/template/${gradeLevel}`, filename),
}

// ========== 九年级报名名单 API ==========
export const registrationApi = {
  /** 预检（不写库） */
  preview: (data: { year: string; rows: any[] }) =>
    request('/registrations/preview', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** 学校提交报名名单 */
  submit: (data: { year: string; rows: any[] }) =>
    request('/registrations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** 报名名单列表（学校看自己，管理员看全部） */
  getList: (params: { page?: number; pageSize?: number; status?: string; school?: string; keyword?: string } = {}) =>
    request(`/registrations${buildQuery(params)}`),

  /** 管理员审核通过（写入九年级成绩表与中招成绩表） */
  approve: (id: number) => request(`/registrations/${id}/approve`, { method: 'POST' }),

  /** 批量审核通过 */
  batchApprove: (ids: number[]) =>
    request('/registrations/batch-approve', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  /** 管理员驳回 */
  reject: (id: number, reason: string) =>
    request(`/registrations/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  /** 管理员删除报名记录（不回滚成绩表） */
  remove: (id: number) =>
    request(`/registrations/${id}`, { method: 'DELETE' }),

  /** 管理员直接导入报名名单（多校合并，导入即视为审核通过） */
  adminImport: (data: { rows: any[] }) =>
    request('/registrations/admin-import', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** 管理员导入成绩（按身份证号匹配报名名单）；dryRun=true 只预检不写库 */
  importScores: (data: { year: string; rows: any[]; dryRun?: boolean }) =>
    request('/registrations/import-scores', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** 待审核数量 */
  getPendingCount: () => request('/registrations/pending-count'),

  /** 下载报名表模板 */
  downloadTemplate: () => downloadFile('/registrations/template', '九年级报名表.xlsx'),

  /** 下载成绩导入模板（管理员） */
  downloadScoreTemplate: () => downloadFile('/registrations/score-template', '九年级体育成绩导入模板.xlsx'),
}

// ========== 系统设置 API ==========
export const settingsApi = {
  /** 当前账号可导出的表（学校账号按管理员授权） */
  getExportTables: () => request('/settings/export-tables'),

  /** 管理员读取全部设置 */
  getAll: () => request('/settings'),

  /** 管理员设置学校可导出的表 */
  setSchoolExportTables: (tables: string[]) =>
    request('/settings/school-export-tables', {
      method: 'PUT',
      body: JSON.stringify({ tables }),
    }),
}

// ========== 材料管理 API ==========
export const materialApi = {
  getList: (year: string) => request(`/materials${buildQuery({ year })}`),

  upload: (school: string, year: string, file: File) => {
    const token = localStorage.getItem('token')
    const formData = new FormData()
    formData.append('file', file)
    formData.append('school', school)
    formData.append('year', year)
    return fetch(`${API_BASE}/materials/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async res => {
      const json = await res.json().catch(() => null)
      if (!res.ok || !json || json.code !== 200) {
        throw extractError(json, `上传失败 (HTTP ${res.status})`)
      }
      return json.data
    })
  },

  getDownloadUrl: (id: number) => `${API_BASE}/materials/download/${id}`,

  download: (id: number, filename: string) => downloadFile(`/materials/download/${id}`, filename),

  delete: (id: number) =>
    request(`/materials/${id}`, {
      method: 'DELETE',
    }),
}

// ========== 凭证管理 API ==========
export const credentialApi = {
  upload: (grade: string, recordId: string, file: File) => {
    const token = localStorage.getItem('token')
    const formData = new FormData()
    formData.append('file', file)
    formData.append('grade', grade)
    formData.append('recordId', recordId)
    return fetch(`${API_BASE}/credentials/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async res => {
      const json = await res.json().catch(() => null)
      if (!res.ok || !json || json.code !== 200) {
        throw extractError(json, `上传失败 (HTTP ${res.status})`)
      }
      return json.data
    })
  },

  getInfo: (grade: string, recordId: string) =>
    request(`/credentials/info${buildQuery({ grade, recordId })}`),

  getDownloadUrl: (id: number) => `${API_BASE}/credentials/download/${id}`,

  download: (id: number, filename: string) => downloadFile(`/credentials/download/${id}`, filename),
}

// ========== 成绩复核 API ==========
export const reconsiderationApi = {
  submit: (data: Record<string, any>) =>
    request('/reconsiderations', { method: 'POST', body: JSON.stringify(data) }),

  uploadCredential: (reconsiderationId: number, file: File) => {
    const token = localStorage.getItem('token')
    const formData = new FormData()
    formData.append('file', file)
    formData.append('reconsiderationId', String(reconsiderationId))
    return fetch(`${API_BASE}/reconsiderations/upload-credential`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async res => {
      const json = await res.json().catch(() => null)
      if (!res.ok || !json || json.code !== 200) {
        throw extractError(json, `上传失败 (HTTP ${res.status})`)
      }
      return json.data
    })
  },

  getList: (params: { page?: number; pageSize?: number; status?: string; school?: string } = {}) =>
    request(`/reconsiderations${buildQuery(params)}`),

  getMyList: () => request('/reconsiderations/my'),

  checkIdCard: (idCard: string) => request(`/reconsiderations/check/${encodeURIComponent(idCard)}`),

  approve: (id: number) => request(`/reconsiderations/${id}/approve`, { method: 'PUT' }),

  reject: (id: number, reason?: string) =>
    request(`/reconsiderations/${id}/reject`, { method: 'PUT', body: JSON.stringify({ reason }) }),
}

// ========== 操作日志 API ==========
export const logApi = {
  getList: (params: {
    page?: number
    pageSize?: number
    operator?: string
    operationType?: string
    targetTable?: string
    startDate?: string
    endDate?: string
  } = {}) => request(`/logs${buildQuery(params)}`),

  getOptions: () => request('/logs/options'),
}
