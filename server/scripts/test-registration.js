/**
 * 九年级报名流程端到端测试
 * 学校上传报名名单 → 管理员审核 → 写入两张成绩表 → 导入成绩 → 校验
 */
const BASE = 'http://127.0.0.1:4000/api'

async function call(path, { method = 'GET', body, token } = {}) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = 'Bearer ' + token
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const json = await res.json().catch(() => null)
  return { status: res.status, json }
}

async function login(u, p) {
  const r = await call('/auth/login', { method: 'POST', body: { username: u, password: p } })
  return r.json?.data?.token
}

let pass = 0, fail = 0
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log('  PASS  ' + name) }
  else { fail++; console.log('  FAIL  ' + name + (detail ? ' — ' + detail : '')) }
}

// 注意：身份证第 17 位奇偶决定性别，测试数据必须自洽，否则会被校验拦下
const ROWS = [
  // 男生（17位=1 奇）1000米 + 足球
  { school: '实验第二中学', name: '报名甲', gender: '男', id_card: '310101201101055011', registration_number: '990001', graduation_year: '2026', grade: '九年级', long_run_event: '1000米', rope_skipping_event: '跳绳', long_jump_event: '跳远', ball_event: '足球', martial_arts_event: '武术', remark: '' },
  // 女生（17位=2 偶）800米 + 篮球
  { school: '实验第二中学', name: '报名乙', gender: '女', id_card: '310101201101055022', registration_number: '990002', graduation_year: '2026', grade: '九年级', long_run_event: '800米', rope_skipping_event: '跳绳', long_jump_event: '跳远', ball_event: '篮球', martial_arts_event: '武术', remark: '' },
  // 病免
  { school: '实验第二中学', name: '报名丙', gender: '男', id_card: '310101201101055033', registration_number: '990003', graduation_year: '2026', grade: '九年级', long_run_event: '', rope_skipping_event: '', long_jump_event: '', ball_event: '', martial_arts_event: '', remark: '病免' },
]

async function main() {
  console.log('\n=== 九年级报名流程测试 ===\n')

  const admin = await login('admin', 'admin123')
  const school = await login('school2', 'school123')

  // ---------- 1. 预检：正常数据 ----------
  console.log('[1] 报名预检')
  const ok = await call('/registrations/preview', { method: 'POST', token: school, body: { year: '2026', rows: ROWS } })
  check('正常报名名单预检通过', ok.status === 200 && ok.json?.data?.valid === true,
    `status=${ok.status} ${JSON.stringify(ok.json?.data?.errors)?.slice(0, 200)}`)

  // ---------- 2. 预检：性别与长跑项目不符 ----------
  const bad = ROWS.map(r => ({ ...r }))
  bad[0].long_run_event = '800米'          // 男生填 800米
  bad[1].ball_event = '排球'               // 球类项目非法
  const badRes = await call('/registrations/preview', { method: 'POST', token: school, body: { year: '2026', rows: bad } })
  const badErrs = badRes.json?.data?.errors || []
  check('男生报 800米被拦截', badErrs.some(e => e.field === 'long_run_event' && e.message.includes('1000米')),
    JSON.stringify(badErrs).slice(0, 200))
  check('非法球类项目被拦截', badErrs.some(e => e.field === 'ball_event'),
    JSON.stringify(badErrs).slice(0, 200))

  // ---------- 2b. 预检：病免 / 残免 / 弃考 都不要求填项目 ----------
  const exempt = [
    { school: '实验第二中学', name: '残免甲', gender: '女', id_card: '310101201101077024', registration_number: '881001', graduation_year: '2026', grade: '九年级', long_run_event: '', ball_event: '', remark: '残免' },
    { school: '实验第二中学', name: '弃考乙', gender: '男', id_card: '310101201101077035', registration_number: '881002', graduation_year: '2026', grade: '九年级', long_run_event: '', ball_event: '', remark: '弃考' },
    { school: '实验第二中学', name: '病免丙', gender: '女', id_card: '310101201101077046', registration_number: '881003', graduation_year: '2026', grade: '九年级', long_run_event: '', ball_event: '', remark: '病免' },
  ]
  const exRes = await call('/registrations/preview', { method: 'POST', token: school, body: { year: '2026', rows: exempt } })
  check('病免/残免/弃考 免填项目也能通过预检',
    exRes.status === 200 && exRes.json?.data?.valid === true && exRes.json?.data?.totalRows === 3,
    `status=${exRes.status} ${JSON.stringify(exRes.json?.data?.errors || []).slice(0, 200)}`)

  const noRemark = [{ ...exempt[0], name: '无备注丁', id_card: '310101201101077058', registration_number: '881004', remark: '' }]
  const nrRes = await call('/registrations/preview', { method: 'POST', token: school, body: { year: '2026', rows: noRemark } })
  check('没写免考理由且缺长跑项目仍被拦截',
    nrRes.status === 200 && nrRes.json?.data?.valid === false,
    JSON.stringify(nrRes.json?.data?.errors || []).slice(0, 200))

  // 备注有内容时不允许再填项目
  const both = [{
    ...exempt[2], name: '既免又填', registration_number: '881005',
    long_run_event: '800米', ball_event: '篮球',
  }]
  const bothRes = await call('/registrations/preview', { method: 'POST', token: school, body: { year: '2026', rows: both } })
  const bothErrs = bothRes.json?.data?.errors || []
  check('备注有内容又填项目被拦下',
    bothRes.status === 200 && bothRes.json?.data?.valid === false
      && bothErrs.some(e => e.field === 'remark' && e.message.includes('就不能再填项目')),
    JSON.stringify(bothErrs).slice(0, 300))

  // 备注有任意内容（非免考关键词）同样不能填项目
  const otherRemark = [{
    ...exempt[0], name: '其它备注', id_card: '310101201101077067', registration_number: '881006',
    remark: '转学待定', long_run_event: '800米',
  }]
  const orRes = await call('/registrations/preview', { method: 'POST', token: school, body: { year: '2026', rows: otherRemark } })
  check('非免考类备注填了项目同样被拦下',
    orRes.status === 200 && orRes.json?.data?.valid === false,
    JSON.stringify(orRes.json?.data?.errors || []).slice(0, 300))

  // ---------- 3. 学校提交 ----------
  console.log('\n[2] 学校提交报名名单')
  const submit = await call('/registrations', { method: 'POST', token: school, body: { year: '2026', rows: ROWS } })
  check('提交成功', submit.status === 200 && submit.json?.data?.count === 3,
    `status=${submit.status} ${JSON.stringify(submit.json).slice(0, 200)}`)

  // ---------- 4. 审核前成绩表应为空 ----------
  console.log('\n[3] 审核前不应写入成绩表')
  const nineBefore = await call('/data/page/grade_nine?keyword=310101201101055011', { token: admin })
  const admBefore = await call('/data/page/admission?keyword=310101201101055011', { token: admin })
  check('九年级成绩表审核前无该学生', (nineBefore.json?.data?.total || 0) === 0, `total=${nineBefore.json?.data?.total}`)
  check('中招成绩表审核前无该学生', (admBefore.json?.data?.total || 0) === 0, `total=${admBefore.json?.data?.total}`)

  // ---------- 5. 管理员列表 ----------
  console.log('\n[4] 管理员查看报名名单')
  const list = await call('/registrations?page=1&pageSize=20', { token: admin })
  const reg = (list.json?.data?.list || []).find(r => r.identityId === '310101201101055011')
  check('管理员能看到待审核报名', !!reg, JSON.stringify(list.json?.data?.list?.slice(0, 2)).slice(0, 200))
  check('报名记录保留了长跑项目与球类项目', reg?.longRunEvent === '1000米' && reg?.ballEvent === '足球',
    `${reg?.longRunEvent} / ${reg?.ballEvent}`)

  // ---------- 6. 审核通过 ----------
  console.log('\n[5] 管理员审核通过')
  const approve = await call(`/registrations/${reg.id}/approve`, { method: 'POST', token: admin })
  check('审核通过', approve.status === 200, `status=${approve.status} ${JSON.stringify(approve.json).slice(0, 200)}`)

  const nineAfter = await call('/data/page/grade_nine?keyword=310101201101055011', { token: admin })
  const nineRow = (nineAfter.json?.data?.list || [])[0]
  check('已写入九年级成绩表', (nineAfter.json?.data?.total || 0) === 1, `total=${nineAfter.json?.data?.total}`)
  check('九年级表带出学校/姓名/报名序号/年份', nineRow?.school === '实验第二中学' && nineRow?.name === '报名甲' && nineRow?.studentNumber === '990001' && nineRow?.graduationYear === '2026',
    JSON.stringify(nineRow).slice(0, 220))
  check('九年级表带出性别', nineRow?.gender === '男', JSON.stringify(nineRow).slice(0, 200))

  const admAfter = await call('/data/page/admission?keyword=310101201101055011', { token: admin })
  const admRow = (admAfter.json?.data?.list || [])[0]
  check('已写入中招体育成绩表', (admAfter.json?.data?.total || 0) === 1, `total=${admAfter.json?.data?.total}`)
  check('中招表带出报名序号', admRow?.registrationNumber === '990001', JSON.stringify(admRow).slice(0, 200))
  check('中招表带出性别', admRow?.gender === '男', JSON.stringify(admRow).slice(0, 200))

  // ---------- 7. 导入成绩（性别/项目校验） ----------
  console.log('\n[6] 管理员导入成绩')
  const wrongEvent = [
    { id_card: '310101201101055011', long_run_event: '800米', long_run: 16, rope_skipping: 18, long_jump: 15, ball_event: '足球', ball_sports: 17, martial_arts: 18 },
  ]
  const wrongRes = await call('/registrations/import-scores', { method: 'POST', token: admin, body: { year: '2026', rows: wrongEvent } })
  check('男生成绩填 800米被拒绝', wrongRes.status === 400,
    `status=${wrongRes.status} ${JSON.stringify(wrongRes.json?.data?.errors).slice(0, 200)}`)

  const notReg = await call('/registrations/import-scores', { method: 'POST', token: admin, body: { year: '2026', rows: [{ id_card: '310101999999999999', long_run: 10 }] } })
  check('未报名的身份证不能导入成绩', notReg.status === 400, `status=${notReg.status}`)

  const good = [
    { id_card: '310101201101055011', long_run_event: '1000米', long_run: 18, rope_skipping: 19, long_jump: 16, ball_event: '足球', ball_sports: 17, martial_arts: 18 },
    { id_card: '310101201101055022', long_run_event: '800米', long_run: 16, rope_skipping: 18, long_jump: 15, ball_event: '篮球', ball_sports: 16, martial_arts: 17 },
  ]
  // 预检（dryRun）不能落库
  const dryRes = await call('/registrations/import-scores', { method: 'POST', token: admin, body: { year: '2026', rows: good, dryRun: true } })
  check('dryRun 预检返回可导入清单', dryRes.status === 200 && dryRes.json?.data?.count === 2 && dryRes.json?.data?.preview?.length === 2,
    `status=${dryRes.status} ${JSON.stringify(dryRes.json?.data).slice(0, 200)}`)
  const afterDry = await call('/data/page/grade_nine?keyword=310101201101055011', { token: admin })
  check('dryRun 不写入成绩表', Number((afterDry.json?.data?.list || [])[0]?.longRun ?? 0) === 0,
    JSON.stringify((afterDry.json?.data?.list || [])[0]).slice(0, 200))

  const goodRes = await call('/registrations/import-scores', { method: 'POST', token: admin, body: { year: '2026', rows: good } })
  check('成绩导入成功', goodRes.status === 200 && goodRes.json?.data?.count === 2,
    `status=${goodRes.status} ${JSON.stringify(goodRes.json).slice(0, 200)}`)

  const nineFinal = await call('/data/page/grade_nine?keyword=310101201101055011', { token: admin })
  const nf = (nineFinal.json?.data?.list || [])[0]
  check('九年级表已写入成绩', Number(nf?.longRun) === 18 && Number(nf?.ropeSkipping) === 19 && Number(nf?.ballSports) === 17,
    JSON.stringify(nf).slice(0, 200))

  const admFinal = await call('/data/page/admission?keyword=310101201101055011', { token: admin })
  const af = (admFinal.json?.data?.list || [])[0]
  check('中招表已写入成绩', Number(af?.longRun) === 18 && Number(af?.ballSports) === 17, JSON.stringify(af).slice(0, 200))

  // 已导入成绩的学生，学校不能再改报名信息（否则项目变了、分数还是旧的）
  const reSubmit = await call('/registrations', { method: 'POST', token: school, body: { year: '2026', rows: ROWS } })
  check('已导入成绩的学生重传报名会被拒绝',
    reSubmit.status === 400 && /已导入成绩/.test(reSubmit.json?.message || ''),
    `status=${reSubmit.status} ${reSubmit.json?.message}`)

  // ---------- 7b. 管理员直接导入报名名单 ----------
  console.log('\n[7b] 管理员直接导入报名名单')
  const adminRows = [
    { school: '实验第二中学', name: '教局导入甲', gender: '男', id_card: '310101201101066051', registration_number: '883001', graduation_year: '2026', grade: '九年级', long_run_event: '1000米', rope_skipping_event: '跳绳', long_jump_event: '跳远', ball_event: '足球', martial_arts_event: '武术', remark: '' },
    { school: '实验第二中学', name: '教局导入乙', gender: '女', id_card: '310101201101066062', registration_number: '883002', graduation_year: '2026', grade: '九年级', long_run_event: '', ball_event: '', remark: '弃考' },
  ]
  const adminImport = await call('/registrations/admin-import', { method: 'POST', token: admin, body: { rows: adminRows } })
  check('管理员导入报名名单成功', adminImport.status === 200 && adminImport.json?.data?.count === 2,
    `status=${adminImport.status} ${JSON.stringify(adminImport.json).slice(0, 200)}`)

  const importedNine = await call('/data/page/grade_nine?keyword=310101201101066051', { token: admin })
  const impNine = (importedNine.json?.data?.list || [])[0]
  check('管理员导入后九年级表已有基本信息',
    impNine?.studentNumber === '883001' && impNine?.graduationYear === '2026',
    JSON.stringify(impNine).slice(0, 200))

  const importedAdm = await call('/data/page/admission?keyword=310101201101066051', { token: admin })
  const impAdm = (importedAdm.json?.data?.list || [])[0]
  check('管理员导入后中招表已有报名序号', impAdm?.registrationNumber === '883001',
    JSON.stringify(impAdm).slice(0, 200))

  const impList = await call('/registrations?page=1&pageSize=50&keyword=3101012011010660', { token: admin })
  const impRegs = (impList.json?.data?.list || [])
    .filter(r => ['310101201101066051', '310101201101066062'].includes(r.identityId))
  check('管理员导入的名单状态为「待导入成绩」且审核人为管理员',
    impRegs.length === 2 && impRegs.every(r => r.status === 'approved' && r.reviewedBy === 'admin'),
    JSON.stringify(impRegs.map(r => ({ n: r.name, s: r.status, b: r.reviewedBy }))).slice(0, 200))

  const noSchool = await call('/registrations/admin-import', {
    method: 'POST', token: admin,
    body: { rows: [{ name: '无学校', gender: '男', id_card: '310101201101066073', registration_number: '883003', graduation_year: '2026', grade: '九年级', long_run_event: '1000米' }] },
  })
  check('管理员导入缺学校被拦下',
    noSchool.status === 400 && (noSchool.json?.data?.errors || []).some(e => e.field === 'school'),
    `status=${noSchool.status} ${JSON.stringify(noSchool.json?.data?.errors || []).slice(0, 200)}`)

  // ---------- 8. 导出权限 ----------
  console.log('\n[7] 导出授权')
  // 先复位成默认配置，避免上一次运行中断留下的空授权干扰断言
  await call('/settings/school-export-tables', { method: 'PUT', token: admin, body: { tables: ['grade_nine', 'admission'] } })
  const perm = await call('/settings/export-tables', { token: school })
  check('学校账号默认可导出九年级与中招', (perm.json?.data?.tables || []).includes('grade_nine') && (perm.json?.data?.tables || []).includes('admission'),
    JSON.stringify(perm.json?.data))

  const expOk = await call('/data/export', { method: 'POST', token: school, body: { table: 'grade_nine', filters: {} } })
  check('学校账号可导出九年级（授权内）', expOk.status === 200, `status=${expOk.status}`)

  const setRes = await call('/settings/school-export-tables', { method: 'PUT', token: admin, body: { tables: [] } })
  check('管理员关闭导出授权', setRes.status === 200, `status=${setRes.status}`)

  const expDenied = await call('/data/export', { method: 'POST', token: school, body: { table: 'grade_nine', filters: {} } })
  check('关闭后学校账号导出被拒绝', expDenied.status === 403, `status=${expDenied.status}`)

  const perm2 = await call('/settings/export-tables', { token: school })
  check('关闭后学校账号看不到可导出表', (perm2.json?.data?.tables || []).length === 0,
    JSON.stringify(perm2.json?.data))

  const expAdmin = await call('/data/export', { method: 'POST', token: admin, body: { table: 'grade_nine', filters: {} } })
  check('管理员不受导出授权限制', expAdmin.status === 200, `status=${expAdmin.status}`)

  // 恢复
  await call('/settings/school-export-tables', { method: 'PUT', token: admin, body: { tables: ['grade_nine', 'admission'] } })

  // ---------- 9. 清理 ----------
  console.log('\n[8] 清理')
  const CLEAN_IDS = [
    '310101201101055011', '310101201101055022', '310101201101055033',
    '310101201101066051', '310101201101066062', '310101201101066073',
  ]
  for (const id of CLEAN_IDS) {
    const n = await call(`/data/page/grade_nine?keyword=${id}`, { token: admin })
    for (const r of (n.json?.data?.list || [])) await call(`/data/grade_nine/${r.id}`, { method: 'DELETE', token: admin })
    const a = await call(`/data/page/admission?keyword=${id}`, { token: admin })
    for (const r of (a.json?.data?.list || [])) await call(`/data/admission/${r.id}`, { method: 'DELETE', token: admin })
    // 报名名单本身也要删，否则每跑一次就多留几条待审
    const reg = await call(`/registrations?page=1&pageSize=100&keyword=${id}`, { token: admin })
    for (const r of (reg.json?.data?.list || [])) {
      await call(`/registrations/${r.id}`, { method: 'DELETE', token: admin })
    }
  }
  // 逐个身份ID核对，避免用前缀匹配时误伤演示数据（陈一/陈二/陈三）
  let leftCount = 0
  for (const id of CLEAN_IDS) {
    const l = await call(`/registrations?page=1&pageSize=100&keyword=${id}`, { token: admin })
    leftCount += (l.json?.data?.list || []).filter(r => r.identityId === id).length
  }
  check('测试报名名单已清理干净', leftCount === 0, `剩余 ${leftCount} 条`)
  console.log('  （测试数据已清理）')

  console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`)
  if (fail > 0) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
