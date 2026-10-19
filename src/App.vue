<template>
  <router-view />
</template>

<style>
/* ============================================
   Shadcn Admin Style - Light Clean Theme
   ============================================ */

:root {
  --bg-base:        #ffffff;
  --bg-page:        #f8fafc;
  --bg-card:        #ffffff;
  --bg-surface:     #f1f5f9;
  --bg-hover:       #f1f5f9;
  --bg-active:      #e2e8f0;
  --border:         #e2e8f0;
  --border-light:   #f1f5f9;
  --primary:        #0f172a;
  --primary-light:  #334155;
  --primary-dark:   #020617;
  --accent:         #3b82f6;
  --accent-light:   #60a5fa;
  --success:        #22c55e;
  --warning:        #f59e0b;
  --danger:         #ef4444;
  --text-primary:   #0f172a;
  --text-secondary: #475569;
  --text-muted:     #94a3b8;
  --font-mono:      'SF Mono', 'Cascadia Code', 'Consolas', 'Monaco', 'Menlo', monospace;
  --radius-sm:      4px;
  --radius-md:      8px;
  --radius-lg:      12px;
  --radius-xl:      16px;

  /* Element Plus overrides — light slate theme */
  --el-color-primary:           #0f172a;
  --el-color-primary-light-3:   #334155;
  --el-color-primary-light-5:   #64748b;
  --el-color-primary-light-7:   #94a3b8;
  --el-color-primary-light-8:   #cbd5e1;
  --el-color-primary-light-9:   #e2e8f0;
  --el-color-primary-dark-2:    #020617;
  --el-text-color-primary:      #0f172a;
  --el-text-color-regular:     #475569;
  --el-text-color-secondary:    #94a3b8;
  --el-text-color-placeholder: #cbd5e1;
  --el-text-color-disabled:    #cbd5e1;
  --el-border-color:           #e2e8f0;
  --el-border-color-light:     #f1f5f9;
  --el-border-color-lighter:   #f8fafc;
  --el-border-color-extra-light:#f8fafc;
  --el-fill-color:             #f8fafc;
  --el-fill-color-light:       #f1f5f9;
  --el-fill-color-lighter:     #f8fafc;
  --el-fill-color-blank:       #ffffff;
  --el-bg-color:               #f8fafc;
  --el-bg-color-overlay:       #ffffff;
  --el-mask-color:             rgba(15, 23, 42, 0.5);
  --el-box-shadow:             0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.06);
  --el-box-shadow-light:       0 1px 2px rgba(15, 23, 42, 0.05);
  --el-box-shadow-lighter:     0 0 0 1px rgba(15, 23, 42, 0.04);
  --el-border-radius-base:     8px;

  /* Component overrides */
  --el-component-size:         36px;
  --el-font-size-base:         14px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background: var(--bg-page);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--bg-page); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

/* Focus ring */
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Override Element Plus components */
.el-card {
  border: 1px solid var(--border) !important;
  border-radius: var(--radius-lg) !important;
  background: var(--bg-card) !important;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06) !important;
}

.el-card__header {
  border-bottom: 1px solid var(--border);
  padding: 16px 20px;
  font-weight: 600;
  font-size: 15px;
  color: var(--text-primary);
}

.el-card__body {
  padding: 20px;
}

.el-button {
  border-radius: 6px !important;
  font-weight: 500;
  font-size: 13px;
  border-color: var(--border) !important;
  color: var(--text-primary) !important;
  background: var(--bg-card) !important;
  transition: all 0.15s ease;
}

.el-button--primary {
  background: var(--primary) !important;
  border-color: var(--primary) !important;
  color: #ffffff !important;
  font-weight: 600;
}

.el-button--primary:hover {
  background: var(--primary-light) !important;
  border-color: var(--primary-light) !important;
}

.el-button--danger {
  background: var(--danger) !important;
  border-color: var(--danger) !important;
  color: #ffffff !important;
}

.el-button:hover {
  border-color: #cbd5e1 !important;
  color: var(--primary) !important;
}

.el-input__wrapper {
  border-radius: 6px !important;
  border: 1px solid var(--border) !important;
  background: var(--bg-card) !important;
  box-shadow: none !important;
  transition: border-color 0.15s ease;
}

.el-input__wrapper:hover {
  border-color: #cbd5e1 !important;
}

.el-input__wrapper.is-focus {
  border-color: var(--primary) !important;
  box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.06) !important;
}

.el-input__inner {
  color: var(--text-primary) !important;
  font-size: 13px;
}

.el-input__inner::placeholder {
  color: var(--text-muted) !important;
}

.el-select__wrapper {
  border-radius: 6px !important;
  border: 1px solid var(--border) !important;
  background: var(--bg-card) !important;
  box-shadow: none !important;
  min-height: 32px !important;
}

.el-select__wrapper:hover {
  border-color: #cbd5e1 !important;
}

.el-select__wrapper.is-focused {
  border-color: var(--primary) !important;
  box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.06) !important;
}

.el-table {
  border-radius: var(--radius-md) !important;
  overflow: hidden;
  border: 1px solid var(--border) !important;
  font-size: 13px;
}

.el-table th.el-table__cell {
  background: var(--bg-surface) !important;
  color: var(--text-secondary) !important;
  font-weight: 600 !important;
  font-size: 11px !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
  border-bottom: 1px solid var(--border) !important;
  padding: 10px 12px !important;
}

.el-table td.el-table__cell {
  color: var(--text-primary) !important;
  border-bottom: 1px solid var(--border-light) !important;
  padding: 12px !important;
}

.el-table tr:hover > td.el-table__cell {
  background: var(--bg-hover) !important;
}

.el-pagination {
  font-size: 13px;
}

.el-pagination button {
  border-radius: 6px !important;
}

.el-pagination .el-pager li {
  border-radius: 6px !important;
  font-weight: 500;
}

.el-pagination .el-pager li.is-active {
  background: var(--primary) !important;
  color: #ffffff !important;
}

.el-dialog {
  border-radius: var(--radius-lg) !important;
  border: 1px solid var(--border) !important;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.15) !important;
}

.el-dialog__header {
  border-bottom: 1px solid var(--border);
  padding: 16px 20px;
  font-weight: 600;
  font-size: 15px;
}

.el-dialog__body {
  padding: 20px;
  color: var(--text-primary);
}

.el-form-item__label {
  font-weight: 500;
  color: var(--text-primary) !important;
  font-size: 13px;
}

.el-tag {
  border-radius: 4px !important;
  font-weight: 500;
  font-size: 12px;
}

.el-loading-mask {
  background: rgba(255, 255, 255, 0.8) !important;
}

.el-message-box {
  border-radius: var(--radius-lg) !important;
  border: 1px solid var(--border) !important;
}
</style>