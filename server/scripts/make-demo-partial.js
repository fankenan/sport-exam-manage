/**
 * 生成一个「部分行有错」的七年级成绩表，用来验证
 * 管理员「跳过错误行、只导入正确数据」的流程。
 * 列结构与系统自己的模板一致（含「学校」「年级」）。
 * 输出：dist/demo-partial.xlsx
 */
const path = require('path')
const XLSX = require('xlsx')

const SCHOOL = '实验第一中学'
const headers = ['学校', '姓名', '身份证', '毕业年份', '年级', '出勤率成绩', '体育考试成绩', '体测成绩', '合计', '备注']
const rows = [
  [SCHOOL, '正确学生A', '310101201001019011', '2026', '七年级', 90, 88, 92, 270, ''],
  [SCHOOL, '正确学生B', '310101201001019022', '2026', '七年级', 85, 80, 90, 255, ''],
  [SCHOOL, '身份证写错', '123', '2026', '七年级', 90, 88, 92, 270, ''],
  [SCHOOL, '分数超范围', '310101201001019033', '2026', '七年级', 999, 88, 92, 270, ''],
]

const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
ws['!cols'] = headers.map(() => ({ wch: 16 }))
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, '七年级成绩')
XLSX.writeFile(wb, path.join(__dirname, '..', '..', 'dist', 'demo-partial.xlsx'))
console.log('已生成 dist/demo-partial.xlsx（2 条正确 / 2 条错误）')
