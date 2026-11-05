/**
 * 表结构常量与字段白名单
 *
 * 安全约束：任何把用户输入拼进 SQL 字符串的地方（列名、表名），
 * 都必须先经过本文件的��名单校验，禁止直接把请求体的 key 拼进 SQL。
 */

// 成绩表可写字段白名单（用于 INSERT / UPDATE 的列名）
// 注意：包含 'id' —— 导入时由服务端按自然键回填已有 id，缺列会导致 INSERT 失败
const GRADE_TABLE_FIELDS = {
  grade_seven: [
    'id', 'school', 'name', 'id_card', 'identity_id', 'student_number',
    'graduation_year', 'grade', 'attendance_score', 'exam_score', 'fitness_score',
    'total', 'total_verify', 'verify_result', 'remark', 'review_status', 'review_remark',
  ],
  grade_eight: [
    'id', 'school', 'name', 'id_card', 'identity_id', 'student_number',
    'graduation_year', 'grade', 'attendance_score', 'exam_score', 'fitness_score',
    'total', 'total_verify', 'verify_result', 'remark', 'review_status', 'review_remark',
  ],
  grade_nine: [
    'id', 'school', 'name', 'id_card', 'identity_id', 'student_number',
    'graduation_year', 'grade', 'long_run', 'rope_skipping', 'long_jump',
    'ball_sports', 'martial_arts', 'remark', 'review_status', 'review_remark',
  ],
  admission: [
    'id', 'identity_id', 'school', 'name', 'id_card', 'registration_number', 'graduation_year',
    'grade', 'grade_seven', 'grade_eight', 'long_run', 'rope_skipping', 'long_jump',
    'ball_sports', 'martial_arts', 'remark', 'total_score', 'review_status', 'review_remark',
  ],
}

// 单条更新时不允许改动的列（主键 / 自然键由服务端维护）
const IMMUTABLE_FIELDS = ['id', 'created_at']

// 所有受管��表（可作为 SQL 表名使用）
const GRADE_TABLES = Object.keys(GRADE_TABLE_FIELDS)

// 重复数据暂存表字段白名单
const DUPLICATE_FIELDS = [
  'school', 'name', 'id_card', 'identity_id', 'graduation_year', 'grade', 'grade_level',
  'attendance_score', 'exam_score', 'fitness_score', 'total', 'total_verify', 'verify_result',
  'long_run', 'rope_skipping', 'long_jump', 'ball_sports', 'martial_arts', 'remark',
  'status', 'processed_by',
]

// 审核状态机
const REVIEW_STATUS = {
  DRAFT: 'draft',         // 草稿（学校已解析未提交）
  SUBMITTED: 'submitted', // 已提交，等待管理员审核
  APPROVED: 'approved',   // 审核通过
  REJECTED: 'rejected',   // 已驳回（可重新提交）
  PUBLISHED: 'published', // 已发布（已写入成绩表）
}

const REVIEW_STATUS_VALUES = Object.values(REVIEW_STATUS)

// 上传文件白名单
const UPLOAD_ALLOWED_EXT = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip', '.jpg', '.jpeg', '.png']
const UPLOAD_MIME_PREFIXES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument',
  'application/vnd.ms-excel',
  'application/octet-stream',
  'application/zip',
  'image/',
]

module.exports = {
  GRADE_TABLE_FIELDS,
  GRADE_TABLES,
  IMMUTABLE_FIELDS,
  DUPLICATE_FIELDS,
  REVIEW_STATUS,
  REVIEW_STATUS_VALUES,
  UPLOAD_ALLOWED_EXT,
  UPLOAD_MIME_PREFIXES,
}
