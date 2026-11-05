/**
 * 生成一份「管理员导入用」的报名名单：两所学校混在一个文件里。
 * 输出：dist/demo-roster-admin.xlsx
 */
const path = require('path')
const XLSX = require('xlsx')

const headers = ['学校', '姓名', '性别', '身份证', '报名序号', '毕业年份', '年级',
  '项目1', '项目2', '项目3', '项目4', '项目5', '备注']

const rows = [
  ['实验第一中学', '教局甲', '男', '310101201101099011', '890001', '2026', '九年级', '1000米', '跳绳', '跳远', '篮球', '武术', ''],
  ['实验第一中学', '教局乙', '女', '310101201101099022', '890002', '2026', '九年级', '800米', '跳绳', '跳远', '足球', '武术', ''],
  ['第三中学', '教局丙', '男', '310101201101099033', '890003', '2026', '九年级', '', '', '', '', '', '残免'],
]

const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
ws['!cols'] = headers.map(() => ({ wch: 16 }))
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, '九年级报名表')
XLSX.writeFile(wb, path.join(__dirname, '..', '..', 'dist', 'demo-roster-admin.xlsx'))
console.log('已生成 dist/demo-roster-admin.xlsx（两所学校 3 人）')
