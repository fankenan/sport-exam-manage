/**
 * 生成一个「备注有内容但又填了项目」的报名表，用来在浏览器里验证拦截效果。
 * 输出：dist/demo-reg-bad.xlsx
 */
const path = require('path')
const XLSX = require('xlsx')

const SCHOOL = '实验第二中学'
const headers = ['学校', '姓名', '性别', '身份证', '报名序号', '毕业年份', '年级',
  '项目1', '项目2', '项目3', '项目4', '项目5', '备注']

const rows = [
  // 正常：备注空，项目齐全
  [SCHOOL, '正常甲', '男', '310101201101088011', '882001', '2026', '九年级', '1000米', '跳绳', '跳远', '足球', '武术', ''],
  // 正常：备注有内容，项目全空
  [SCHOOL, '免考乙', '女', '310101201101088022', '882002', '2026', '九年级', '', '', '', '', '', '病免'],
  // 错误：备注有内容，却还填了项目
  [SCHOOL, '冲突丙', '男', '310101201101088033', '882003', '2026', '九年级', '1000米', '跳绳', '跳远', '篮球', '武术', '残免'],
]

const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
ws['!cols'] = headers.map(() => ({ wch: 16 }))
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, '九年级报名表')
XLSX.writeFile(wb, path.join(__dirname, '..', '..', 'dist', 'demo-reg-bad.xlsx'))
console.log('已生成 dist/demo-reg-bad.xlsx（1 条正常 / 1 条免考 / 1 条冲突）')
