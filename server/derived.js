/**
 * 派生字段计算
 *
 * 七/八年级由「出勤率 + 体育考试 + 体测」算出合计校对值，
 * 再与填写的合计比对得出校对结果（一致=通过，不一致=异常）。
 *
 * 这条规则必须只有一份实现：所有写入路径（导入 / 全量同步 / 单条更新 /
 * 报名审核写表）都必须过这里，否则会出现「导入后合计校对是空的」这类脏数据。
 */

/**
 * 就地计算一批行的派生字段
 * @param {string} table 表名（只有 grade_seven / grade_eight 参与计算）
 * @param {object[]} rows 待计算的行（snake_case 字段）
 */
function applyDerivedFields(table, rows) {
  if (table !== 'grade_seven' && table !== 'grade_eight') return
  for (const row of rows) {
    const att = parseFloat(row.attendance_score)
    const exam = parseFloat(row.exam_score)
    const fit = parseFloat(row.fitness_score)
    if ([att, exam, fit].some(v => Number.isNaN(v))) continue

    const totalVerify = Math.round((att + exam + fit) * 10) / 10
    row.total_verify = totalVerify

    const hasTotal = row.total !== null && row.total !== undefined && row.total !== ''
    if (!hasTotal) {
      // 没填合计：用三项之和补齐，并视为校对通过
      row.total = totalVerify
      row.verify_result = 1
    } else {
      const total = parseFloat(row.total)
      row.verify_result = Math.abs(totalVerify - (Number.isNaN(total) ? 0 : total)) < 0.1 ? 1 : 0
    }
  }
}

module.exports = { applyDerivedFields }
