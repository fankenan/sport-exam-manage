/**
 * 安全与功能冒烟测试
 *
 * 用法：node scripts/smoke-test.js
 * 前置：后端已启动（默认 http://127.0.0.1:4000）
 */
const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:4000/api'

let pass = 0
let fail = 0
const failures = []

function check(name, condition, detail = '') {
  if (condition) {
    pass++
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}`)
  } else {
    fail++
    failures.push(name + (detail ? ` — ${detail}` : ''))
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? ' — ' + detail : ''}`)
  }
}

async function call(path, { method = 'GET', body, token } = {}) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  let json = null
  try { json = await res.json() } catch { /* ignore */ }
  return { status: res.status, json }
}

async function login(username, password) {
  const res = await call('/auth/login', { method: 'POST', body: { username, password } })
  return res.json?.data?.token || null
}

async function main() {
  console.log('\n=== 体育成绩管理系统 · 安全与功能冒烟测试 ===\n')

  // ---------- 0. 准备自用的学校账号 ----------
  // 不依赖演示账号（管理员可能会改密码），测试自建一个专用账号并在结束时清理
  const TEST_SCHOOL = '冒烟测试中学'
  const TEST_USER = 'smoke_school'
  const TEST_PASS = 'smoke123456'

  const adminToken0 = await login('admin', 'admin123')
  if (!adminToken0) {
    console.log('\n管理员登录失败，终止测试')
    process.exit(1)
  }

  const schoolList = await call('/schools', { token: adminToken0 })
  let testSchoolId = (schoolList.json?.data || []).find(s => s.name === TEST_SCHOOL)?.id
  if (!testSchoolId) {
    const created = await call('/schools', { method: 'POST', token: adminToken0, body: { name: TEST_SCHOOL } })
    testSchoolId = created.json?.data?.id
  }
  // 重置测试账号的密码，保证可重复执行
  const existingUser = await call('/admins', { token: adminToken0 })
  const existing = (existingUser.json?.data || []).find(a => a.username === TEST_USER)
  if (existing) {
    await call(`/admins/${existing.id}`, {
      method: 'PUT', token: adminToken0,
      body: { password: TEST_PASS, schoolId: testSchoolId, role: 'school' },
    })
  } else {
    await call('/admins', {
      method: 'POST', token: adminToken0,
      body: { username: TEST_USER, password: TEST_PASS, schoolId: testSchoolId, role: 'school' },
    })
  }
  console.log(`[0] 已准备测试账号 ${TEST_USER}（学校：${TEST_SCHOOL}）\n`)

  // ---------- 0b. 造两条基线数据（不依赖演示数据，可重复执行） ----------
  // 一条属于测试学校，一条属于另一所学校，用于验证「多校隔离」与「未被清空」
  const SEED_IDS = ['310101201101077001', '310101201101077002']
  const seedRows = SEED_IDS.map((id, i) => ({
    id: 'smoke_seed_' + i,
    school: i === 0 ? TEST_SCHOOL : '种子数据中学',
    name: '种子学生' + i,
    id_card: id,
    identity_id: id,
    graduation_year: '2026',
    grade: '七年级',
    attendance_score: 90, exam_score: 88, fitness_score: 92,
    total: 270, total_verify: 270, verify_result: 1,
  }))
  // 「种子数据中学」需要真实存在，否则成绩表里存的是自由文本，仍可用于隔离校验
  const seedSchools = await call('/schools', { token: adminToken0 })
  if (!(seedSchools.json?.data || []).find(s => s.name === '种子数据中学')) {
    await call('/schools', { method: 'POST', token: adminToken0, body: { name: '种子数据中学' } })
  }
  await call('/data/import', { method: 'POST', token: adminToken0, body: { table: 'grade_seven', rows: seedRows } })
  console.log('[0b] 已写入 2 条基线测试数据\n')

  // ---------- 1. 登录 ----------
  console.log('[1] 认证')
  const adminToken = adminToken0
  const schoolToken = await login(TEST_USER, TEST_PASS)
  check('管理员登录成功', !!adminToken)
  check('学校账号登录成功', !!schoolToken)

  const badLogin = await call('/auth/login', { method: 'POST', body: { username: 'admin', password: 'wrong' } })
  check('错误口令被拒绝', badLogin.json?.code === 400 || badLogin.status === 400)

  const noAuth = await call('/data/page/grade_seven')
  check('未带令牌访问被拒绝', noAuth.status === 401)

  const badToken = await call('/data/page/grade_seven', { token: 'not-a-real-token' })
  check('伪造令牌被拒绝', badToken.status === 401)

  if (!adminToken || !schoolToken) {
    console.log('\n登录失败，终止测试')
    process.exit(1)
  }

  // ---------- 2. SQL 注入 ----------
  console.log('\n[2] SQL 注入防护')
  const inject = await call('/data/grade_seven/anything', {
    method: 'PUT', token: adminToken,
    body: { 'total = 1, name': 'x', 'x` = (SELECT 1), y': 'z' },
  })
  check('注入型字段名被拒绝或忽略（不进入 SET 子句）',
    inject.json?.code !== 200 || inject.status >= 400,
    `status=${inject.status} body=${JSON.stringify(inject.json).slice(0, 120)}`)

  const injectDup = await call('/data/duplicates/1', {
    method: 'PUT', token: adminToken,
    body: { 'status = 1, processed_by': 'x' },
  })
  check('重复数据接口的注入型字段名同样被拦截',
    injectDup.json?.code !== 200 || injectDup.status >= 400,
    `status=${injectDup.status}`)

  // ---------- 3. RBAC ----------
  console.log('\n[3] 越权访问防护')
  const clearBySchool = await call('/data/clear', { method: 'POST', token: schoolToken })
  check('学校账号不能清空数据', clearBySchool.status === 403 || clearBySchool.json?.code === 403,
    `status=${clearBySchool.status}`)

  const syncBySchool = await call('/data/sync', {
    method: 'POST', token: schoolToken,
    body: { gradeSevenList: [], gradeEightList: [], gradeNineList: [], admissionList: [] },
  })
  check('学校账号不能全量覆盖数据', syncBySchool.status === 403 || syncBySchool.json?.code === 403,
    `status=${syncBySchool.status}`)

  const reconBySchool = await call('/reconsiderations', { token: schoolToken })
  check('学校账号不能读取全部复核申请', reconBySchool.status === 403 || reconBySchool.json?.code === 403,
    `status=${reconBySchool.status}`)

  const adminsBySchool = await call('/admins', { token: schoolToken })
  check('学校账号不能读取管理员列表', adminsBySchool.status === 403 || adminsBySchool.json?.code === 403,
    `status=${adminsBySchool.status}`)

  const logsBySchool = await call('/logs', { token: schoolToken })
  check('学校账号不能读取操作日志', logsBySchool.status === 403 || logsBySchool.json?.code === 403,
    `status=${logsBySchool.status}`)

  const checkIdBySchool = await call('/reconsiderations/check/310101200801011234', { token: schoolToken })
  check('学校账号按身份证号查询被限制在本校范围',
    checkIdBySchool.status === 200 &&
    (checkIdBySchool.json?.data?.results || []).every(r => (r.records || []).every(x => x.school === TEST_SCHOOL)),
    `status=${checkIdBySchool.status}`)

  // 关键不变量：学校账号不能绕过审核直接写正式成绩表
  const importBySchool = await call('/data/import', {
    method: 'POST', token: schoolToken,
    body: {
      table: 'grade_seven',
      rows: [{
        id: 'smoke_bypass', school: TEST_SCHOOL, name: '绕过审核测试',
        id_card: '310101201101088001', identity_id: '310101201101088001',
        graduation_year: '2026', grade: '七年级',
        attendance_score: 90, exam_score: 88, fitness_score: 92,
        total: 270, total_verify: 270, verify_result: 1,
      }],
    },
  })
  check('学校账号不能绕过审核直接写成绩表', importBySchool.status === 403 || importBySchool.json?.code === 403,
    `status=${importBySchool.status}`)

  const submitByAdmin = await call('/submissions', {
    method: 'POST', token: adminToken,
    body: { year: '2026', gradeLevel: 'seven', fileName: 'x.xlsx', rows: [{ name: 'x', id_card: '310101201101088002', graduation_year: '2026' }] },
  })
  check('管理员不能走「提交上报」通道（管理员一律直接导入）',
    submitByAdmin.status === 403 || submitByAdmin.json?.code === 403,
    `status=${submitByAdmin.status}`)

  // 验证数据确实没被清空
  const afterClear = await call('/data/page/grade_seven', { token: adminToken })
  check('数据仍然完好（未被清空）', (afterClear.json?.data?.total || 0) > 0,
    `total=${afterClear.json?.data?.total}`)

  // ---------- 4. 学校数据隔离 ----------
  console.log('\n[4] 学校数据隔离')
  const schoolPage = await call('/data/page/grade_seven', { token: schoolToken })
  const schools = new Set((schoolPage.json?.data?.list || []).map(r => r.school))
  check('学校账号只能看到本校数据', schools.size <= 1 && (!schools.size || schools.has(TEST_SCHOOL)),
    [...schools].join(','))

  const adminPage = await call('/data/page/grade_seven', { token: adminToken })
  const adminSchools = new Set((adminPage.json?.data?.list || []).map(r => r.school))
  check('管理员可以看到多所学校', adminSchools.size > 1, `${adminSchools.size} 所`)

  // ---------- 5. 新接口 ----------
  console.log('\n[5] 新增接口')
  const overview = await call('/data/stats/overview?year=2026', { token: adminToken })
  check('看板聚合接口可用', overview.status === 200 && overview.json?.data?.counts?.gradeSeven > 0,
    JSON.stringify(overview.json?.data?.counts))

  const dupCheck = await call('/data/check-duplicates', {
    method: 'POST', token: adminToken,
    body: { table: 'grade_seven', identities: ['310101200801011234', 'NOT_EXIST_123'] },
  })
  check('批量查重接口可用', dupCheck.status === 200 && Array.isArray(dupCheck.json?.data?.existing),
    JSON.stringify(dupCheck.json?.data))

  const match = await call('/data/match-admission', {
    method: 'POST', token: adminToken,
    body: { rows: [{ name: '测试', id_card: '310101200801011234' }], year: '2026' },
  })
  check('中招成绩匹配接口可用', match.status === 200 && Array.isArray(match.json?.data?.matched),
    `matched=${match.json?.data?.matchedCount}`)

  // ---------- 6. 上报流程 ----------
  console.log('\n[6] 学校上报流程')
  const template = await fetch(BASE + '/submissions/template/seven', {
    headers: { Authorization: `Bearer ${schoolToken}` },
  })
  check('上报模板可下载', template.status === 200)

  const preview = await call('/submissions/preview', {
    method: 'POST', token: schoolToken,
    body: {
      year: '2026', gradeLevel: 'seven',
      rows: [
        { name: '新增学生A', id_card: '310101200901019001', graduation_year: '2026', attendance_score: 90, exam_score: 88, fitness_score: 92, total: 270 },
        { name: '非法身份证', id_card: '123', graduation_year: '2026', attendance_score: 90, exam_score: 88, fitness_score: 92, total: 270 },
        { name: '合计不符', id_card: '310101200901019002', graduation_year: '2026', attendance_score: 90, exam_score: 88, fitness_score: 92, total: 100 },
      ],
    },
  })
  const previewData = preview.json?.data
  // 3 行里：1 行身份证号非法（硬错误）、1 行合计不符（不拦截，只计入校对异常）
  check('预检能识别非法数据', preview.status === 200 && previewData?.valid === false && previewData.errorCount === 1,
    `errorCount=${previewData?.errorCount}`)

  // ----- 管理员「跳过错误行、只导入正确数据」-----
  const mixed = [
    { name: '新增学生A', id_card: '310101200901019001', graduation_year: '2026', attendance_score: 90, exam_score: 88, fitness_score: 92, total: 270 },
    { name: '非法身份证', id_card: '123', graduation_year: '2026', attendance_score: 90, exam_score: 88, fitness_score: 92, total: 270 },
  ]
  const partialPreview = await call('/submissions/preview', {
    method: 'POST', token: adminToken,
    body: { year: '2026', gradeLevel: 'seven', rows: mixed, allowPartial: true },
  })
  const pp = partialPreview.json?.data
  check('管理员预检：有错误也返回可导入行',
    partialPreview.status === 200 && pp?.valid === false && pp?.validCount === 1
      && pp?.skippedCount === 1 && (pp?.newCount + pp?.updateCount) === 1
      && JSON.stringify(pp?.validIndexes) === '[0]',
    JSON.stringify(pp)?.slice(0, 240))

  const schoolPartial = await call('/submissions/preview', {
    method: 'POST', token: schoolToken,
    body: { year: '2026', gradeLevel: 'seven', rows: mixed, allowPartial: true },
  })
  const sp = schoolPartial.json?.data
  check('学校账号不能用「只导入正确数据」',
    schoolPartial.status === 200 && sp?.valid === false && sp?.newCount === 0,
    JSON.stringify(sp)?.slice(0, 200))

  const goodPreview = await call('/submissions/preview', {
    method: 'POST', token: schoolToken,
    body: {
      year: '2026', gradeLevel: 'seven',
      rows: [{ name: '新增学生A', id_card: '310101200901019001', graduation_year: '2026', attendance_score: 90, exam_score: 88, fitness_score: 92, total: 270 }],
    },
  })
  check('预检通过并给出差异', goodPreview.status === 200 && goodPreview.json?.data?.valid === true,
    JSON.stringify(goodPreview.json?.data)?.slice(0, 160))

  // 合计与三项之和不符：不是校验错误，必须放行并计入「校对异常」
  const mismatchPreview = await call('/submissions/preview', {
    method: 'POST', token: schoolToken,
    body: {
      year: '2026', gradeLevel: 'seven',
      rows: [{ name: '合计不符', id_card: '310101200901019003', graduation_year: '2026', attendance_score: 90, exam_score: 88, fitness_score: 92, total: 100 }],
    },
  })
  check('合计不符的记录不被拦截，只是计入校对异常',
    mismatchPreview.status === 200 &&
    mismatchPreview.json?.data?.valid === true &&
    mismatchPreview.json?.data?.mismatchCount === 1,
    `valid=${mismatchPreview.json?.data?.valid} mismatchCount=${mismatchPreview.json?.data?.mismatchCount}`)

  const submit = await call('/submissions', {
    method: 'POST', token: schoolToken,
    body: {
      year: '2026', gradeLevel: 'seven', fileName: 'smoke.xlsx',
      rows: [{ name: '新增学生A', id_card: '310101200901019001', graduation_year: '2026', attendance_score: 90, exam_score: 88, fitness_score: 92, total: 270 }],
    },
  })
  check('上报提交成功', submit.status === 200 && submit.json?.data?.id > 0,
    `id=${submit.json?.data?.id}`)
  const submissionId = submit.json?.data?.id

  const mySubs = await call('/submissions', { token: schoolToken })
  check('学校账号能看到自己的上报表', mySubs.status === 200 && (mySubs.json?.data?.list || []).some(s => s.id === submissionId))

  // 提交后成绩表里还不应有这条数据（未发布）
  const beforePublish = await call('/data/page/grade_seven?keyword=310101200901019001', { token: adminToken })
  check('未审核通过的数据不会写入成绩表', (beforePublish.json?.data?.total || 0) === 0,
    `total=${beforePublish.json?.data?.total}`)

  let publishedRecords = []
  if (submissionId) {
    const approve = await call(`/submissions/${submissionId}/approve`, { method: 'POST', token: adminToken })
    check('管理员审核通过并发布', approve.status === 200 && approve.json?.data?.published > 0,
      JSON.stringify(approve.json?.data))

    const afterPublish = await call('/data/page/grade_seven?keyword=310101200901019001', { token: adminToken })
    publishedRecords = afterPublish.json?.data?.list || []
    check('发布后数据写入成绩表', (afterPublish.json?.data?.total || 0) === 1,
      `total=${afterPublish.json?.data?.total}`)

    const published = publishedRecords[0]
    check('发布后的记录标记为 published', published?.reviewStatus === 'published',
      `reviewStatus=${published?.reviewStatus}`)
  }

  // ---------- 7. 导入 ----------
  console.log('\n[7] 批量导入')
  const imp = await call('/data/import', {
    method: 'POST', token: adminToken,
    body: {
      table: 'grade_seven',
      rows: [{
        id: 'smoke_test_1', school: TEST_SCHOOL, name: '导入测试',
        id_card: '310101201001019099', identity_id: '310101201001019099',
        graduation_year: '2026', grade: '七年级',
        attendance_score: 90, exam_score: 88, fitness_score: 92,
        total: 270, total_verify: 270, verify_result: 1,
      }],
    },
  })
  check('批量导入成功', imp.status === 200 && imp.json?.data?.importCount === 1,
    JSON.stringify(imp.json)?.slice(0, 160))

  // 重复导入同一自然键应更新而非重复插入
  const imp2 = await call('/data/import', {
    method: 'POST', token: adminToken,
    body: {
      table: 'grade_seven',
      rows: [{
        id: 'smoke_test_1_different', school: TEST_SCHOOL, name: '导入测试改',
        id_card: '310101201001019099', identity_id: '310101201001019099',
        graduation_year: '2026', grade: '七年级',
        attendance_score: 91, exam_score: 88, fitness_score: 92,
        total: 271, total_verify: 271, verify_result: 1,
      }],
    },
  })
  check('重复导入按自然键更新而非新增', imp2.status === 200, JSON.stringify(imp2.json)?.slice(0, 120))

  const afterImport = await call('/data/page/grade_seven?keyword=310101201001019099', { token: adminToken })
  check('自然键去重生效（只保留一条）', (afterImport.json?.data?.total || 0) === 1,
    `total=${afterImport.json?.data?.total}`)

  // ---------- 7b. 合计校对（服务端统一计算） ----------
  console.log('\n[7b] 合计校对自动计算')
  const imported = (afterImport.json?.data?.list || [])[0]
  check('导入后自动算出合计校对值',
    imported?.totalVerify !== null && imported?.totalVerify !== undefined,
    `totalVerify=${imported?.totalVerify}`)
  check('导入后自动算出校对结果',
    imported?.verifyResult === 1 || imported?.verifyResult === 0,
    `verifyResult=${imported?.verifyResult}`)

  // 合计填错时必须标记为异常（用 100：三项之和是 270，合计却填了 100）
  const badTotalId = '310101201001099088'
  await call('/data/import', {
    method: 'POST', token: adminToken,
    body: {
      table: 'grade_seven',
      rows: [{
        id: 'smoke_badtotal', school: TEST_SCHOOL, name: '合计错误学生',
        id_card: badTotalId, identity_id: badTotalId,
        graduation_year: '2026', grade: '七年级',
        attendance_score: 90, exam_score: 88, fitness_score: 92,
        total: 100,
      }],
    },
  })
  const badTotal = await call('/data/page/grade_seven?keyword=' + badTotalId, { token: adminToken })
  const badRow = (badTotal.json?.data?.list || [])[0]
  check('合计与三项之和不符时标记为校对异常',
    badRow?.verifyResult === 0 && Number(badRow?.totalVerify) === 270,
    `verifyResult=${badRow?.verifyResult} totalVerify=${badRow?.totalVerify}`)

  // 不填合计时用三项之和补齐并视为通过
  const noTotalId = '310101201001099099'
  await call('/data/import', {
    method: 'POST', token: adminToken,
    body: {
      table: 'grade_seven',
      rows: [{
        id: 'smoke_nototal', school: TEST_SCHOOL, name: '未填合计学生',
        id_card: noTotalId, identity_id: noTotalId,
        graduation_year: '2026', grade: '七年级',
        attendance_score: 90, exam_score: 88, fitness_score: 92,
      }],
    },
  })
  const noTotal = await call('/data/page/grade_seven?keyword=' + noTotalId, { token: adminToken })
  const noTotalRow = (noTotal.json?.data?.list || [])[0]
  check('未填合计时用三项之和补齐并视为通过',
    Number(noTotalRow?.total) === 270 && noTotalRow?.verifyResult === 1,
    `total=${noTotalRow?.total} verifyResult=${noTotalRow?.verifyResult}`)

  // 单条修改也要重算
  await call(`/data/grade_seven/${noTotalRow.id}`, {
    method: 'PUT', token: adminToken,
    body: { attendanceScore: 80, examScore: 88, fitnessScore: 92 },
  })
  const edited = await call('/data/page/grade_seven?keyword=' + noTotalId, { token: adminToken })
  const editedRow = (edited.json?.data?.list || [])[0]
  check('单条修改分项后重算合计校对',
    Number(editedRow?.totalVerify) === 260 && editedRow?.verifyResult === 0,
    `totalVerify=${editedRow?.totalVerify} verifyResult=${editedRow?.verifyResult}`)

  // ---------- 8. 清理 ----------
  console.log('\n[8] 清理测试数据')
  for (const r of (afterImport.json?.data?.list || [])) {
    await call(`/data/grade_seven/${r.id}`, { method: 'DELETE', token: adminToken })
  }
  for (const r of publishedRecords) {
    await call(`/data/grade_seven/${r.id}`, { method: 'DELETE', token: adminToken })
  }
  for (const r of (badTotal.json?.data?.list || [])) {
    await call(`/data/grade_seven/${r.id}`, { method: 'DELETE', token: adminToken })
  }
  for (const r of (noTotal.json?.data?.list || [])) {
    await call(`/data/grade_seven/${r.id}`, { method: 'DELETE', token: adminToken })
  }
  for (const r of (edited.json?.data?.list || [])) {
    await call(`/data/grade_seven/${r.id}`, { method: 'DELETE', token: adminToken })
  }
  // 删除本次测试创建的上报表与重复数据暂存
  // 注意路径是 /submissions/:id（不是 /data/grade_submissions/:id）
  const subList = await call('/submissions?page=1&pageSize=100', { token: adminToken })
  for (const s of (subList.json?.data?.list || [])) {
    if (s.school === TEST_SCHOOL) {
      await call(`/submissions/${s.id}`, { method: 'DELETE', token: adminToken }).catch(() => {})
    }
  }
  const dupList = await call('/data/duplicates', { token: adminToken })
  for (const d of (dupList.json?.data || [])) {
    if (d.school === TEST_SCHOOL) {
      await call(`/data/duplicates/${d.id}`, { method: 'DELETE', token: adminToken }).catch(() => {})
    }
  }
  // 删除自建的测试账号与测试学校
  const userList = await call('/admins', { token: adminToken })
  const testUser = (userList.json?.data || []).find(a => a.username === TEST_USER)
  if (testUser) await call(`/admins/${testUser.id}`, { method: 'DELETE', token: adminToken })
  if (testSchoolId) await call(`/schools/${testSchoolId}`, { method: 'DELETE', token: adminToken })
  // 删除基线种子学校
  const finalSchools = await call('/schools', { token: adminToken })
  const seedSchool = (finalSchools.json?.data || []).find(s => s.name === '种子数据中学')
  if (seedSchool) await call(`/schools/${seedSchool.id}`, { method: 'DELETE', token: adminToken })
  console.log('  （测试数据与测试账号已清理）')

  // ---------- 汇总 ----------
  console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`)
  if (fail > 0) {
    console.log('\n失败项：')
    failures.forEach(f => console.log('  - ' + f))
    process.exit(1)
  }
  console.log('全部通过 ✅\n')
}

main().catch(err => {
  console.error('测试执行异常:', err)
  process.exit(1)
})
