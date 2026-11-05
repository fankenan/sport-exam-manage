/**
 * 生成一份「七年级上报表」示例文件，用于演示学校上报流程
 * 用法：node scripts/make-sample-xlsx.js [输出路径]
 */
const path = require('path')
const XLSX = require('xlsx')

const out = process.argv[2] || path.join(__dirname, '..', '..', 'docs', '示例-七年级上报表.xlsx')

const headers = ['姓名', '身份证号', '学号', '毕业年份', '出勤率成绩', '体育考试成绩', '体测成绩', '合计', '备注']
const rows = [
  ['测试学生甲', '310101201101011001', '20261001', '2026', 92, 88, 90, 270, ''],
  ['测试学生乙', '310101201101011002', '20261002', '2026', 95, 91, 93, 279, ''],
  ['测试学生丙', '310101201101011003', '20261003', '2026', 88, 85, 89, 262, '免测长跑'],
  // 故意留一条合计不符，用于演示预检能拦截
  ['测试学生丁', '310101201101011004', '20261004', '2026', 90, 88, 92, 999, ''],
]

const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
ws['!cols'] = headers.map(() => ({ wch: 16 }))
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, '七年级体育成绩上报表')
XLSX.writeFile(wb, out)
console.log('已生成:', out)
