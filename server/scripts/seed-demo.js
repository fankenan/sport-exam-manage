/**
 * 演示数据生成脚本
 *
 * 用法：node scripts/seed-demo.js [每校七年级人数]
 * 默认每校 300 人（共 8 校 ≈ 9600 条七年级成绩，另生成八/九/中招）
 */
require('dotenv').config()
const mysql = require('mysql2/promise')
const bcrypt = require('bcryptjs')

const PER_SCHOOL = parseInt(process.argv[2] || '300', 10)
const YEAR = '2026'

const SCHOOLS = [
  '实验第一中学', '实验第二中学', '第三中学', '第四中学',
  '第五中学', '第六中学', '第七中学', '第八中学',
]

const SURNAMES = '王李张刘陈杨黄赵周吴徐孙马朱胡林郭何高罗郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹孟熊秦邱江尹薛闫段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤'
const GIVEN = '伟芳娜敏静丽强磊洋艳勇军杰娟涛明超秀霞平刚桂英华玉萍红娥玲芬燕彬鹏浩宇轩然子豪思远梦琪雨欣佳琪泽楷睿哲晨曦嘉宁'

const rnd = (n) => Math.floor(Math.random() * n)
const pick = (arr) => arr[rnd(arr.length)]

function makeName() {
  return pick(SURNAMES.split('')) + pick(GIVEN.split('')) + (Math.random() < 0.6 ? pick(GIVEN.split('')) : '')
}

function makeIdCard(seedIdx, i) {
  // 构造合法的 18 位校验码
  const area = '310101'
  const birth = `20${String(8 + (i % 4)).padStart(2, '0')}${String((i % 12) + 1).padStart(2, '0')}${String((i % 28) + 1).padStart(2, '0')}`
  const seq = String(((seedIdx * 1000 + i) % 900) + 100)
  const body = area + birth + seq
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  const codes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
  let sum = 0
  for (let k = 0; k < 17; k++) sum += Number(body[k]) * weights[k]
  return body + codes[sum % 11]
}

function score(min = 60, max = 100) {
  return Math.round((min + Math.random() * (max - min)) * 10) / 10
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function bulkInsert(conn, table, columns, rows) {
  const BATCH = 500
  let n = 0
  for (const c of chunk(rows, BATCH)) {
    const placeholders = c.map(() => `(${columns.map(() => '?').join(',')})`).join(',')
    const values = c.flatMap(r => columns.map(col => r[col] === undefined ? null : r[col]))
    await conn.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES ${placeholders}`, values)
    n += c.length
  }
  return n
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sport_manage',
  })

  console.log('清空旧演示数据...')
  await conn.query('DELETE FROM grade_seven')
  await conn.query('DELETE FROM grade_eight')
  await conn.query('DELETE FROM grade_nine')
  await conn.query('DELETE FROM admission')
  await conn.query('DELETE FROM grade_duplicates')
  await conn.query('DELETE FROM grade_submissions')
  await conn.query('DELETE FROM materials')
  await conn.query('DELETE FROM operation_logs')
  await conn.query('DELETE FROM admins WHERE role = ?', ['school'])

  // ---------- 学校 ----------
  const schoolIds = []
  for (const name of SCHOOLS) {
    await conn.query('INSERT INTO schools (name) VALUES (?) ON DUPLICATE KEY UPDATE name = name', [name])
    const [rows] = await conn.query('SELECT id FROM schools WHERE name = ?', [name])
    schoolIds.push(rows[0].id)
  }
  console.log(`学校: ${schoolIds.length} 所`)

  // ---------- 学校账号 ----------
  // 注意：已存在的账号只更新归属学校，**不覆盖密码**（避免把管理员改过的口令重置掉）
  const hash = await bcrypt.hash('school123', 10)
  let created = 0
  let kept = 0
  for (let i = 0; i < SCHOOLS.length; i++) {
    const username = 'school' + (i + 1)
    const [existed] = await conn.query('SELECT id FROM admins WHERE username = ?', [username])
    if (existed.length > 0) {
      await conn.query('UPDATE admins SET school_id = ?, role = \'school\' WHERE username = ?', [schoolIds[i], username])
      kept++
    } else {
      await conn.query(
        "INSERT INTO admins (username, password, role, school_id) VALUES (?, ?, 'school', ?)",
        [username, hash, schoolIds[i]],
      )
      created++
    }
  }
  console.log(`学校账号: ${SCHOOLS.length} 个（新建 ${created}，沿用原密码 ${kept}）`)
  console.log('  新建账号默认密码: school123；已存在账号的密码保持不变')

  // ---------- 成绩 ----------
  const sevenRows = [], eightRows = [], nineRows = [], admRows = []
  const identities = []

  for (let s = 0; s < SCHOOLS.length; s++) {
    const school = SCHOOLS[s]
    for (let i = 0; i < PER_SCHOOL; i++) {
      const name = makeName()
      const idCard = makeIdCard(s, i)
      const identityId = idCard.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
      const att = score(70, 100)
      const exam = score(60, 100)
      const fit = score(60, 100)
      const total = Math.round((att + exam + fit) * 10) / 10
      const totalVerify = Math.round((att + exam + fit) * 10) / 10

      sevenRows.push({
        id: `s7_${s}_${i}`, school, name, id_card: idCard, identity_id: identityId,
        student_number: String(20260000 + s * 10000 + i), graduation_year: YEAR, grade: '七年级',
        attendance_score: att, exam_score: exam, fitness_score: fit,
        total, total_verify: totalVerify,
        // 制造约 6% 的校对异常，方便演示"异常列表"
        verify_result: Math.random() < 0.06 ? 0 : 1,
        remark: Math.random() < 0.03 ? '免测项目' : '',
        review_status: 'published',
      })
      identities.push({ identityId, school, name, s, i })
    }
  }

  // 八年级：取七年级中的一部分接着念
  for (const it of identities) {
    if (it.i % 5 !== 0) continue
    const att = score(70, 100), exam = score(60, 100), fit = score(60, 100)
    const total = Math.round((att + exam + fit) * 10) / 10
    eightRows.push({
      id: `s8_${it.s}_${it.i}`, school: it.school, name: it.name,
      id_card: '', identity_id: it.identityId, student_number: String(20260000 + it.s * 10000 + it.i),
      graduation_year: YEAR, grade: '八年级',
      attendance_score: att, exam_score: exam, fitness_score: fit,
      total, total_verify: total,
      verify_result: Math.random() < 0.06 ? 0 : 1,
      remark: '', review_status: 'published',
    })
  }

  // 九年级 + 中招
  for (const it of identities) {
    if (it.i % 8 !== 0) continue
    const longRun = score(12, 20), ropeSkipping = score(12, 20), longJump = score(10, 18)
    const ballSports = score(10, 18), martialArts = score(10, 18)
    nineRows.push({
      id: `s9_${it.s}_${it.i}`, school: it.school, name: it.name,
      id_card: '', identity_id: it.identityId, student_number: String(20260000 + it.s * 10000 + it.i),
      graduation_year: YEAR, grade: '九年级',
      long_run: longRun, rope_skipping: ropeSkipping, long_jump: longJump,
      ball_sports: ballSports, martial_arts: martialArts,
      remark: '', review_status: 'published',
    })
    admRows.push({
      id: `ad_${it.s}_${it.i}`, school: it.school, name: it.name,
      id_card: '', identity_id: it.identityId,
      registration_number: String(it.s * 10000 + it.i + 1),
      graduation_year: YEAR,
      grade_seven: score(70, 100), grade_eight: score(70, 100),
      long_run: longRun, rope_skipping: ropeSkipping, long_jump: longJump,
      ball_sports: ballSports, martial_arts: martialArts,
      total_score: 0, review_status: 'published',
    })
  }

  // 中招总分 = 七年级 + 八年级 + 九年级各项
  const sevenMap = new Map(sevenRows.map(r => [r.identityId, r]))
  const eightMap = new Map(eightRows.map(r => [r.identityId, r]))
  for (const r of admRows) {
    const s7 = sevenMap.get(r.identityId)
    const s8 = eightMap.get(r.identityId)
    r.total_score = Math.round(
      Number(s7?.total || 0) + Number(s8?.total || 0) +
      Number(r.long_run || 0) + Number(r.rope_skipping || 0) + Number(r.long_jump || 0) +
      Number(r.ball_sports || 0) + Number(r.martial_arts || 0),
    )
  }

  const scoreCols = ['id', 'school', 'name', 'id_card', 'identity_id', 'student_number', 'graduation_year', 'grade',
    'attendance_score', 'exam_score', 'fitness_score', 'total', 'total_verify', 'verify_result', 'remark', 'review_status']
  const nineCols = ['id', 'school', 'name', 'id_card', 'identity_id', 'student_number', 'graduation_year', 'grade',
    'long_run', 'rope_skipping', 'long_jump', 'ball_sports', 'martial_arts', 'remark', 'review_status']
  const admCols = ['id', 'school', 'name', 'id_card', 'identity_id', 'registration_number', 'graduation_year',
    'grade_seven', 'grade_eight', 'long_run', 'rope_skipping', 'long_jump', 'ball_sports', 'martial_arts', 'total_score', 'review_status']

  const t0 = Date.now()
  console.log(`写入成绩 (七年级 ${sevenRows.length} / 八年级 ${eightRows.length} / 九年级 ${nineRows.length} / 中招 ${admRows.length}) ...`)
  await bulkInsert(conn, 'grade_seven', scoreCols, sevenRows)
  await bulkInsert(conn, 'grade_eight', scoreCols, eightRows)
  await bulkInsert(conn, 'grade_nine', nineCols, nineRows)
  await bulkInsert(conn, 'admission', admCols, admRows)
  console.log(`完成，耗时 ${Date.now() - t0}ms`)

  await conn.end()
  console.log('\n演示数据已就绪：')
  console.log('  管理员    admin / admin123')
  console.log(`  学校账号  school1 .. school${SCHOOLS.length} / school123`)
}

main().catch(err => {
  console.error('生成失败:', err)
  process.exit(1)
})
