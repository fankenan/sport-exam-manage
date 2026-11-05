/**
 * 端到端演示：学校上报 → 管理员审核 → 发布
 *
 * 用法：node scripts/e2e-submission.js
 */
const BASE = 'http://127.0.0.1:4000/api'

async function call(path, { method = 'GET', body, token } = {}) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const json = await res.json().catch(() => null)
  return { status: res.status, json }
}

async function login(u, p) {
  const r = await call('/auth/login', { method: 'POST', body: { username: u, password: p } })
  return r.json?.data?.token
}

const ROWS = [
  { name: '测试学生甲', id_card: '310101201101011001', graduation_year: '2026', attendance_score: 92, exam_score: 88, fitness_score: 90, total: 270, remark: '' },
  { name: '测试学生乙', id_card: '310101201101011002', graduation_year: '2026', attendance_score: 95, exam_score: 91, fitness_score: 93, total: 279, remark: '' },
  { name: '测试学生丙', id_card: '310101201101011003', graduation_year: '2026', attendance_score: 88, exam_score: 85, fitness_score: 89, total: 262, remark: '免测长跑' },
]

async function main() {
  const schoolToken = await login('school1', 'school123')
  const adminToken = await login('admin', 'admin123')

  // 1. 预检（含一条合计不符，验证校验能拦住）
  const badRows = [...ROWS, { ...ROWS[0], name: '合计错误', id_card: '310101201101011009', total: 999 }]
  const bad = await call('/submissions/preview', {
    method: 'POST', token: schoolToken,
    body: { year: '2026', gradeLevel: 'seven', rows: badRows },
  })
  console.log('1) 预检（含错误数据）:', bad.json?.data?.valid === false
    ? `被拦截，${bad.json.data.errorCount} 处问题 ✓`
    : '未拦截 ✗')

  // 2. 正常预检
  const pre = await call('/submissions/preview', {
    method: 'POST', token: schoolToken,
    body: { year: '2026', gradeLevel: 'seven', rows: ROWS },
  })
  console.log('2) 预检（正常数据）: 新增', pre.json?.data?.newCount, '更新', pre.json?.data?.updateCount)

  // 3. 提交
  const sub = await call('/submissions', {
    method: 'POST', token: schoolToken,
    body: { year: '2026', gradeLevel: 'seven', fileName: '示例-七年级上报表.xlsx', rows: ROWS },
  })
  const id = sub.json?.data?.id
  console.log('3) 提交上报: id =', id, sub.json?.data?.rowCount, '条')

  // 4. 确认未进入成绩表
  const before = await call('/data/page/grade_seven?keyword=310101201101011001', { token: adminToken })
  console.log('4) 发布前成绩表命中:', before.json?.data?.total, '条（应为 0）')

  // 5. 管理员审核列表
  const list = await call('/submissions?page=1&pageSize=10&status=submitted', { token: adminToken })
  const pending = (list.json?.data?.list || []).find(s => s.id === id)
  console.log('5) 管理员待审核列表:', pending ? `包含 id=${pending.id} 状态=${pending.status}` : '未找到 ✗')

  // 6. 详情
  const detail = await call(`/submissions/${id}`, { token: adminToken })
  const payload = detail.json?.data?.payload
  console.log('6) 详情数据行数:', Array.isArray(payload) ? payload.length : '解析失败')

  // 7. 审核通过并发布
  const approve = await call(`/submissions/${id}/approve`, { method: 'POST', token: adminToken })
  console.log('7) 审核通过并发布:', approve.json?.message, `写入 ${approve.json?.data?.published} 条`)

  // 8. 确认进入成绩表
  const after = await call('/data/page/grade_seven?keyword=310101201101011001', { token: adminToken })
  const rec = (after.json?.data?.list || [])[0]
  console.log('8) 发布后成绩表命中:', after.json?.data?.total, '条',
    '| reviewStatus =', rec?.reviewStatus,
    '| total =', rec?.total)

  // 9. 学校账号能看到吗
  const schoolView = await call('/data/page/grade_seven?keyword=310101201101011001', { token: schoolToken })
  console.log('9) 学校账号可见:', schoolView.json?.data?.total, '条（应为 1）')

  console.log('\n提交 id =', id, '（可在上报审核页面查看）')
}

main().catch(e => { console.error(e); process.exit(1) })
