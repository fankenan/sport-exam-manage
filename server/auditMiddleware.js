const { logOperation } = require('./audit');

function maskSensitive(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const masked = { ...obj };
  if (masked.password) masked.password = '******';
  if (masked.newPassword) masked.newPassword = '******';
  return masked;
}

/**
 * Express 审计中间件工厂
 * 拦截 res.json 响应，自动记录成功的 CUD 操作
 * 路由可通过 res body.data._audit 传入结构化审计详情
 */
function auditMiddleware(options) {
  const { operationType, targetTable } = options;

  return function (req, res, next) {
    const originalJson = res.json.bind(res);

    res.json = function (body) {
      if (body && body.code === 200) {
        const table = typeof targetTable === 'function'
          ? targetTable(req)
          : targetTable;

        const operator = req.user && req.user.username || 'unknown';
        const targetId = (req.params && req.params.id) || (body.data && body.data.id) || null;
        const audit = (body.data && body.data._audit) || {};

        var details = {};

        // 优先使用 _audit 中的结构化信息
        if (audit.summary || audit.changes) {
          Object.assign(details, audit);
        }

        // 如果有 changes，构建可读摘要
        if (audit.changes && audit.changes.length > 0) {
          var changeTexts = audit.changes.map(function (c) {
            return c.field + '：' + (c.from || '(空)') + ' → ' + (c.to || '(空)');
          });
          details.summary = '修改' + (audit.record ? '【' + audit.record + '】的' : '') + '：' + changeTexts.join('；');
        }

        // 兜底：如果路由没有提供 _audit，自动构建
        if (!details.summary && !details.changes) {
          if (operationType === 'create') {
            details.payload = maskSensitive(req.body);
          } else if (operationType === 'update') {
            details.fields = Object.keys(req.body).filter(function (k) {
              return k !== 'password' && k !== '_audit';
            });
            details.updated = maskSensitive(req.body);
          } else if (operationType === 'delete') {
            details.targetId = targetId;
          }
        }

        // 限制 details 大小，防止超大日志
        var detailsStr = JSON.stringify(details);
        if (detailsStr.length > 5000) {
          details = { summary: details.summary || '操作数据过大已截断', _truncated: true, _originalSize: detailsStr.length };
        }

        logOperation(req.app.locals.pool || req.app.get('pool'), {
          operator: operator,
          operationType: operationType,
          targetTable: table,
          targetId: targetId,
          details: details,
          ipAddress: req.ip || (req.headers['x-forwarded-for'] || '').split(',')[0].trim(),
          userAgent: req.headers['user-agent'],
        });
      }

      return originalJson(body);
    };

    next();
  };
}

module.exports = { auditMiddleware };
