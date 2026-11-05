/**
 * 生成浏览器验收用的样例文件：
 *   docs/示例-九年级报名表.xlsx     （学校上传）
 *   docs/示例-九年级成绩表.xlsx     （管理员导入成绩）
 *
 * 注意：身份证第 17 位奇偶决定性别，样例数据必须自洽，
 * 否则会被「性别 ↔ 身份证号」校验拦下。
 */
const path = require('path')
const XLSX = require('xlsx')

const outDir = path.join(__dirname, '..', '..', 'docs')
const SCHOOL = '实验第二中学'

// ---------- 报名表 ----------
const regHeaders = ['学校', '姓名', '性别', '身份证', '报名序号', '毕业年份', '年级',
  '项目1', '项目2', '项目3', '项目4', '项目5', '备注']
const regRows = [
  // 17 位为奇数 → 男；偶数 → 女
  [SCHOOL, '陈一', '男', '310101201101066011', '880001', '2026', '九年级', '1000米', '跳绳', '跳远', '足球', '武术', ''],
  [SCHOOL, '陈二', '女', '310101201101066022', '880002', '2026', '九年级', '800米', '跳绳', '跳远', '篮球', '武术', ''],
  [SCHOOL, '陈三', '男', '310101201101066033', '880003', '2026', '九年级', '', '', '', '', '', '病免'],
]
const ws1 = XLSX.utils.aoa_to_sheet([regHeaders, ...regRows])
ws1['!cols'] = regHeaders.map(() => ({ wch: 16 }))
const wb1 = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb1, ws1, '九年级报名表')
XLSX.writeFile(wb1, path.join(outDir, '示例-九年级报名表.xlsx'))

// ---------- 成绩表（管理员）----------
const scoreHeaders = ['学校', '姓名', '身份证', '长跑项目', '长跑', '跳绳', '跳远', '球类项目', '足(篮)球', '武术', '备注']
const scoreRows = [
  [SCHOOL, '陈一', '310101201101066011', '1000米', 18, 19, 16, '足球', 17, 18, ''],
  [SCHOOL, '陈二', '310101201101066022', '800米', 16, 18, 15, '篮球', 16, 17, ''],
]
const ws2 = XLSX.utils.aoa_to_sheet([scoreHeaders, ...scoreRows])
ws2['!cols'] = scoreHeaders.map(() => ({ wch: 16 }))
const wb2 = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb2, ws2, '九年级成绩')
XLSX.writeFile(wb2, path.join(outDir, '示例-九年级成绩表.xlsx'))

console.log('已生成（学校：' + SCHOOL + '）')
console.log('  docs/示例-九年级报名表.xlsx')
console.log('  docs/示例-九年级成绩表.xlsx')
