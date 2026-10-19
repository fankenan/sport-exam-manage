/**
 * 操作审计日志工具
 * 将所有数据修改操作记录到 operation_logs 表
 */

/**
 * @param {object} pool - MySQL 连接池
 * @param {object} params
 * @param {string} params.operator
 * @param {'create'|'update'|'delete'} params.operationType
 * @param {string} params.targetTable
 * @param {string|null} params.targetId
 * @param {object} params.details
 * @param {string} params.ipAddress
 * @param {string} params.userAgent
 */
async function logOperation(pool, { operator, operationType, targetTable, targetId, details, ipAddress, userAgent }) {
  try {
    await pool.query(
      `INSERT INTO operation_logs (operator, operation_type, target_table, target_id, details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        operator || 'unknown',
        operationType,
        targetTable,
        targetId || null,
        JSON.stringify(details || {}),
        ipAddress || null,
        userAgent || null
      ]
    );
  } catch (err) {
    // 审计日志写入失败不应阻断主业务
    console.error('[AuditLog Error]', err.message);
  }
}

module.exports = { logOperation };
