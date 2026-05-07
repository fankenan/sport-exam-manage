const API_BASE = import.meta.env.VITE_API_BASE || '/api'

// 通用请求封装
async function request(url: string, options: RequestInit = {}): Promise<any> {
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>)
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(`${API_BASE}${url}`, { ...options, headers })
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`
    try {
      const err = await res.json()
      errMsg = err.message || errMsg
    } catch { /* ignore parse error */ }
    throw new Error(errMsg)
  }
  const json = await res.json()
  // 后端返回 { code, data, message } 格式，自动解包 data
  if (json && typeof json === 'object' && 'code' in json && 'data' in json) {
    return json.data
  }
  return json
}

// ========== 认证 API ==========
export const authApi = {
  login: (username: string, password: string) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),

  verify: () =>
    request('/auth/verify'),

  getAdmins: () =>
    request('/admins'),

  addAdmin: (data: { username: string; password: string }) =>
    request('/admins', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateAdmin: (id: number, data: { password?: string }) =>
    request(`/admins/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  deleteAdmin: (id: number) =>
    request(`/admins/${id}`, {
      method: 'DELETE'
    })
}

// ========== 数据同步 API ==========
export const dataApi = {
  // 获取所有数据（保留用于同步）
  sync: () =>
    request('/data/sync'),

  // 提交所有数据（全量覆盖）
  syncSave: (data: {
    gradeSevenList: any[]
    gradeEightList: any[]
    gradeNineList: any[]
    admissionList: any[]
  }) =>
    request('/data/sync', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // 清空所有数据
  clear: () =>
    request('/data/clear', {
      method: 'POST'
    }),

  // 分页查询
  page: (table: string, params: { page?: number; pageSize?: number; keyword?: string; graduationYear?: string; school?: string } = {}) => {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))
    if (params.keyword) query.set('keyword', params.keyword)
    if (params.graduationYear) query.set('graduationYear', params.graduationYear)
    if (params.school) query.set('school', params.school)
    return request(`/data/page/${table}?${query.toString()}`)
  },

  // 增量导入
  import: (table: string, rows: any[]) =>
    request('/data/import', {
      method: 'POST',
      body: JSON.stringify({ table, rows })
    }),

  // 获取年份列表
  getYears: () =>
    request('/data/years'),

  // 获取学校列表（可按年份筛选）
  getSchools: (year?: string) => {
    const query = year ? `?year=${encodeURIComponent(year)}` : ''
    return request(`/data/schools${query}`)
  },

  // 单条更新
  update: (table: string, id: string, data: Record<string, any>) =>
    request(`/data/${table}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
}

// ========== 材料管理 API ==========
export const materialApi = {
  // 获取某年份的材料列表
  getList: (year: string) =>
    request(`/materials?year=${encodeURIComponent(year)}`),

  // 上传材料（FormData）
  upload: (school: string, year: string, file: File) => {
    const token = localStorage.getItem('token')
    const formData = new FormData()
    formData.append('file', file)
    formData.append('school', school)
    formData.append('year', year)
    return fetch(`${API_BASE}/materials/upload`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData
    }).then(res => res.json()).then(json => {
      if (json && json.code === 200) return json.data
      throw new Error(json.message || '上传失败')
    })
  },

  // 获取下载链接
  getDownloadUrl: (id: number) => `${API_BASE}/materials/download/${id}`,

  // 删除材料
  delete: (id: number) =>
    request(`/materials/${id}`, {
      method: 'DELETE'
    })
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
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData
    }).then(res => res.json()).then(json => {
      if (json && json.code === 200) return json.data
      throw new Error(json.message || '上传失败')
    })
  },

  getInfo: (grade: string, recordId: string) =>
    request(`/credentials/info?grade=${encodeURIComponent(grade)}&recordId=${encodeURIComponent(recordId)}`),

  getDownloadUrl: (id: number) => `${API_BASE}/credentials/download/${id}`,
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
  } = {}) => {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))
    if (params.operator) query.set('operator', params.operator)
    if (params.operationType) query.set('operationType', params.operationType)
    if (params.targetTable) query.set('targetTable', params.targetTable)
    if (params.startDate) query.set('startDate', params.startDate)
    if (params.endDate) query.set('endDate', params.endDate)
    return request(`/logs?${query.toString()}`)
  },

  getOptions: () => request('/logs/options'),
}
