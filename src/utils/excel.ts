/**
 * Excel 解析工具
 *
 * 成绩导入与学校上报共用同一套解析逻辑，避免两处实现漂移。
 * xlsx 体积较大（约 420KB），统一走动态加载。
 */

export type GradeLevel = 'seven' | 'eight' | 'nine'
export type FormatType = 'seven-eight' | 'nine'

export interface ParsedSheet {
  headers: string[]
  rows: any[][]
  sheet: any
  colMap: Record<string, number>
  formatType: FormatType
  detectedGrade: GradeLevel | 'mixed' | 'unknown'
}

let xlsxModule: any = null

/** 按需加载 xlsx */
export async function loadXLSX(): Promise<any> {
  if (!xlsxModule) xlsxModule = await import('xlsx')
  return xlsxModule
}

/** 规范化表头：去空格、统一括号 */
function normalizeHeader(s: string): string {
  return String(s || '').replace(/\s/g, '').replace(/（/g, '(').replace(/）/g, ')')
}

/**
 * 从表头构建列索引映射
 */
export function buildColMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {}
  headers.forEach((h, i) => {
    const s = normalizeHeader(h)
    if (s.includes('学校') && !s.includes('毕业')) map.school = i
    else if (s === '姓名' || s === '名字') map.name = i
    else if (s.includes('身份证') || s.includes('身份号码')) map.idCard = i
    else if (s.includes('学籍号') || s === '学号' || s.includes('报名序号') || s.includes('报名号')) map.studentNumber = i
    else if (s.includes('毕业')) map.graduationYear = i
    else if (s.includes('年级')) map.grade = i
    else if (s.includes('出勤')) map.attendanceScore = i
    else if (s.includes('体育考试') || s.includes('考试成绩')) map.examScore = i
    else if (s.includes('体测') || s.includes('体质')) map.fitnessScore = i
    else if (s === '合计' || s === '总分') map.total = i
    else if (s.includes('长跑') || s.includes('1000米') || s.includes('800米')) map.longRun = i
    else if (s.includes('跳绳')) map.ropeSkipping = i
    else if (s.includes('跳远')) map.longJump = i
    else if (s.includes('足球') || s.includes('篮球') || s.includes('球')) map.ballSports = i
    else if (s.includes('武术')) map.martialArts = i
    else if (s.includes('备注')) map.remark = i
  })
  return map
}

/**
 * 判断文件是七/八年级格式还是九年级格式
 */
export function detectFormatType(headers: string[]): FormatType | 'unknown' {
  const s = headers.map(normalizeHeader).join(',')
  const hasAttendance = s.includes('出勤率') || s.includes('出勤')
  const hasExam = s.includes('体育考试') || s.includes('考试成绩')
  const hasFitness = s.includes('体测') || s.includes('体质')
  const hasNine = s.includes('长跑') || s.includes('跳绳') || s.includes('跳远') ||
    s.includes('武术') || s.includes('1000米') || s.includes('800米')

  if (hasNine) return 'nine'
  if (hasAttendance && hasExam && hasFitness) return 'seven-eight'
  if (s.includes('合计')) return 'seven-eight'
  return 'unknown'
}

/**
 * 依据数据行的年级列确定实际年级
 */
export function detectGradeFromRows(rows: any[][], colMap: Record<string, number>): GradeLevel | 'mixed' | 'unknown' {
  const gradeCol = colMap.grade !== undefined ? colMap.grade : 4
  const counts: Record<GradeLevel, number> = { seven: 0, eight: 0, nine: 0 }
  let total = 0
  for (const row of rows) {
    if (!row || !row[0]) continue
    total++
    const g = String(row[gradeCol] ?? '').replace(/\s/g, '')
    if (!g) continue
    if (g.includes('七') || g.includes('7') || g.includes('初一')) counts.seven++
    else if (g.includes('八') || g.includes('8') || g.includes('初二')) counts.eight++
    else if (g.includes('九') || g.includes('9') || g.includes('初三')) counts.nine++
  }
  if (total === 0) return 'unknown'
  if (counts.eight / total > 0.5) return 'eight'
  if (counts.seven / total > 0.5) return 'seven'
  if (counts.eight > 0 && counts.seven > 0) return 'mixed'
  return 'unknown'
}

/**
 * 把年级列内容标准化
 */
export function normalizeGradeValue(grade: string, fallback: string): GradeLevel {
  if (!grade) {
    if (fallback === 'eight') return 'eight'
    if (fallback === 'nine') return 'nine'
    return 'seven'
  }
  const s = grade.replace(/\s/g, '')
  if (s.includes('七') || s.includes('7') || s.includes('初一')) return 'seven'
  if (s.includes('八') || s.includes('8') || s.includes('初二')) return 'eight'
  if (s.includes('九') || s.includes('9') || s.includes('初三')) return 'nine'
  if (fallback === 'eight') return 'eight'
  if (fallback === 'nine') return 'nine'
  return 'seven'
}

/**
 * 解析 Excel 文件
 */
export async function parseGradeFile(file: File): Promise<ParsedSheet> {
  const xlsx = await loadXLSX()
  const buffer = await file.arrayBuffer()
  const workbook = xlsx.read(new Uint8Array(buffer), { type: 'array' })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!firstSheet) throw new Error('文件中没有可读取的工作表')

  const jsonData = xlsx.utils.sheet_to_json(firstSheet, { header: 1, raw: true }) as any[][]
  if (jsonData.length < 2) throw new Error('文件数据为空')

  const headers = (jsonData[0] ?? []).map((h: any) => String(h || ''))
  const rows = jsonData.slice(1)
  const colMap = buildColMap(headers)
  const formatType = detectFormatType(headers)

  if (formatType === 'unknown') {
    throw new Error('无法识别文件格式，请检查表头是否包含「出勤率/体育考试/体测」或「长跑/跳绳/跳远/武术」')
  }

  const detectedGrade = formatType === 'nine'
    ? 'nine'
    : detectGradeFromRows(rows, colMap)

  return { headers, rows, sheet: firstSheet, colMap, formatType, detectedGrade }
}

/** 安全读取文本单元格 */
export function cellVal(row: any[], colMap: Record<string, number>, key: string, fallbackIdx: number): string {
  const idx = colMap[key] !== undefined ? colMap[key] : fallbackIdx
  return idx >= 0 ? String(row[idx] ?? '').trim() : ''
}

/** 安全读取数值单元格 */
export function cellNum(row: any[], colMap: Record<string, number>, key: string, fallbackIdx: number): number {
  const idx = colMap[key] !== undefined ? colMap[key] : fallbackIdx
  return idx >= 0 ? (parseFloat(row[idx]) || 0) : 0
}

/**
 * 读取身份证号：优先取单元格的格式化文本，避免 Excel 数字精度丢失
 */
export function readIdCard(row: any[], index: number, colMap: Record<string, number>, sheet: any, xlsx: any): string {
  const idCardCol = colMap.idCard !== undefined ? colMap.idCard : 2
  if (sheet && xlsx) {
    const cell = sheet[xlsx.utils.encode_cell({ r: index + 1, c: idCardCol })]
    if (cell && cell.w) {
      const text = String(cell.w).trim()
      if (text) return text
    }
  }
  return String(row[idCardCol] ?? '').trim()
}

/** 身份证号 → 规范身份标识 */
export function normalizeIdCard(idCard: string): string {
  return String(idCard || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

/**
 * 解析「九年级报名表」
 *
 * 列：学校 | 姓名 | 性别 | 身份证 | 报名序号 | 毕业年份 | 年级
 *     | 项目1(长跑) | 项目2(跳绳) | 项目3(跳远) | 项目4(球类) | 项目5(武术) | 备注
 */
export async function parseRegistrationFile(file: File): Promise<{ rows: any[] }> {
  const xlsx = await loadXLSX()
  const buffer = await file.arrayBuffer()
  const workbook = xlsx.read(new Uint8Array(buffer), { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) throw new Error('文件中没有可读取的工作表')
  const raw = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false }) as any[][]

  if (raw.length < 2) throw new Error('文件数据为空')
  const headers = (raw[0] ?? []).map((h: any) => String(h || '').replace(/\s/g, ''))

  // 按表头定位列，容忍列顺序调整
  const idx = (names: string[], fallback: number) => {
    // 先找完全相等的表头，再退回模糊匹配。
    // 否则「长跑」会先命中「长跑项目」，把项目名当成成绩读出来。
    for (const n of names) {
      const exact = headers.findIndex(h => h === n)
      if (exact >= 0) return exact
    }
    for (const n of names) {
      const i = headers.findIndex(h => h.includes(n))
      if (i >= 0) return i
    }
    return fallback
  }
  const iSchool = idx(['学校'], 0)
  const iName = idx(['姓名'], 1)
  const iGender = idx(['性别'], 2)
  const iIdCard = idx(['身份证'], 3)
  const iRegNo = idx(['报名序号', '报名号', '序号'], 4)
  const iYear = idx(['毕业年份', '毕业年'], 5)
  const iGrade = idx(['年级'], 6)
  const iP1 = idx(['项目1'], 7)
  const iP2 = idx(['项目2'], 8)
  const iP3 = idx(['项目3'], 9)
  const iP4 = idx(['项目4'], 10)
  const iP5 = idx(['项目5'], 11)
  const iRemark = idx(['备注'], 12)

  const rows: any[] = []
  for (const r of raw.slice(1)) {
    if (!r) continue
    const pick = (i: number) => String(r[i] ?? '').trim()
    const name = pick(iName)
    const idCard = pick(iIdCard)
    if (!name && !idCard) continue
    rows.push({
      school: pick(iSchool),
      name,
      gender: pick(iGender),
      id_card: idCard,
      registration_number: pick(iRegNo),
      graduation_year: pick(iYear),
      grade: pick(iGrade) || '九年级',
      long_run_event: pick(iP1),
      rope_skipping_event: pick(iP2),
      long_jump_event: pick(iP3),
      ball_event: pick(iP4),
      martial_arts_event: pick(iP5),
      remark: pick(iRemark),
    })
  }
  return { rows }
}

/**
 * 解析「九年级成绩表」（管理员用）
 *
 * 列：学校 | 姓名 | 身份证 | 长跑项目 | 长跑 | 跳绳 | 跳远 | 球类项目 | 足(篮)球 | 武术 | 备注
 * 带「长跑项目」「球类项目」两列，是为了和报名信息逐项核对。
 */
export async function parseNineScoreFile(file: File): Promise<{ rows: any[] }> {
  const xlsx = await loadXLSX()
  const buffer = await file.arrayBuffer()
  const workbook = xlsx.read(new Uint8Array(buffer), { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) throw new Error('文件中没有可读取的工作表')
  const raw = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false }) as any[][]

  if (raw.length < 2) throw new Error('文件数据为空')
  const headers = (raw[0] ?? []).map((h: any) => String(h || '').replace(/\s/g, ''))

  const idx = (names: string[], fallback: number) => {
    // 先找完全相等的表头，再退回模糊匹配。
    // 否则「长跑」会先命中「长跑项目」，把项目名当成成绩读出来。
    for (const n of names) {
      const exact = headers.findIndex(h => h === n)
      if (exact >= 0) return exact
    }
    for (const n of names) {
      const i = headers.findIndex(h => h.includes(n))
      if (i >= 0) return i
    }
    return fallback
  }
  const iSchool = idx(['学校'], 0)
  const iName = idx(['姓名'], 1)
  const iIdCard = idx(['身份证'], 2)
  const iLongRunEvent = idx(['长跑项目', '长跑项目1'], 3)
  const iLongRun = idx(['长跑'], 4)
  const iRope = idx(['跳绳'], 5)
  const iJump = idx(['跳远'], 6)
  const iBallEvent = idx(['球类项目', '足篮球项目'], 7)
  const iBall = idx(['足(篮)球', '足篮球', '足球篮'], 8)
  const iMartial = idx(['武术'], 9)
  const iRemark = idx(['备注'], 10)

  const rows: any[] = []
  for (const r of raw.slice(1)) {
    if (!r) continue
    const pick = (i: number) => String(r[i] ?? '').trim()
    const idCard = pick(iIdCard)
    if (!pick(iName) && !idCard) continue
    rows.push({
      school: pick(iSchool),
      name: pick(iName),
      id_card: idCard,
      long_run_event: pick(iLongRunEvent),
      long_run: pick(iLongRun),
      rope_skipping: pick(iRope),
      long_jump: pick(iJump),
      ball_event: pick(iBallEvent),
      ball_sports: pick(iBall),
      martial_arts: pick(iMartial),
      remark: pick(iRemark),
    })
  }
  return { rows }
}

/**
 * 在浏览器中生成并下载 Excel
 */
export async function downloadWorkbook(
  sheetName: string,
  headers: string[],
  rows: any[][],
  filename: string,
): Promise<void> {
  const xlsx = await loadXLSX()
  const aoa = [headers, ...rows]
  const ws = xlsx.utils.aoa_to_sheet(aoa)
  const wb = xlsx.utils.book_new()
  xlsx.utils.book_append_sheet(wb, ws, sheetName)
  const out = xlsx.write(wb, { type: 'array', bookType: 'xlsx' })
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(href)
}
