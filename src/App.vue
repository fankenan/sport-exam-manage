<template>
  <el-config-provider :locale="zhCn">
    <router-view />
  </el-config-provider>
</template>

<script setup lang="ts">
import zhCn from 'element-plus/es/locale/lang/zh-cn'
</script>

<style>
/* ============================================
   设计令牌 —— 全站唯一的颜色 / 圆角 / 阴影来源
   浅色为默认，<html data-theme="dark"> 切换暗色
   ============================================ */

:root {
  /* 背景层级 */
  --bg-base:        #ffffff;
  --bg-page:        #f6f8fb;
  --bg-card:        #ffffff;
  --bg-surface:     #f1f5f9;
  --bg-hover:       #f1f5f9;
  --bg-active:      #e2e8f0;

  /* 描边 */
  --border:         #e4e9f0;
  --border-light:   #eef2f7;

  /* 主色（中性深色，shadcn 风格） */
  --primary:        #0f172a;
  --primary-light:  #334155;
  --primary-dark:   #020617;

  /* 品牌强调色 —— 原先散落在各页面里的 #00c6ff / #8b5cf6 / #6366f1 统一到此处 */
  --brand-cyan:     #00b8e6;
  --brand-violet:   #8b5cf6;
  --brand-indigo:   #6366f1;
  --accent:         #3b82f6;
  --accent-light:   #60a5fa;

  /* 语义色 */
  --success:        #22c55e;
  --success-soft:   #dcfce7;
  --warning:        #f59e0b;
  --warning-soft:   #fef3c7;
  --danger:         #ef4444;
  --danger-soft:    #fee2e2;

  /* 文本 */
  --text-primary:   #0f172a;
  --text-secondary: #475569;
  --text-muted:     #94a3b8;
  --text-inverse:   #ffffff;

  --font-mono:      'SF Mono', 'Cascadia Code', 'Consolas', 'Monaco', 'Menlo', monospace;
  --radius-sm:      4px;
  --radius-md:      8px;
  --radius-lg:      12px;
  --radius-xl:      16px;

  --shadow-sm:      0 1px 2px rgba(15, 23, 42, 0.05);
  --shadow-md:      0 2px 8px rgba(15, 23, 42, 0.07);
  --shadow-lg:      0 12px 32px rgba(15, 23, 42, 0.10);

  /* Element Plus 变量覆盖 */
  --el-color-primary:           #0f172a;
  --el-color-primary-light-3:   #334155;
  --el-color-primary-light-5:   #64748b;
  --el-color-primary-light-7:   #94a3b8;
  --el-color-primary-light-8:   #cbd5e1;
  --el-color-primary-light-9:   #e2e8f0;
  --el-color-primary-dark-2:    #020617;
  --el-text-color-primary:      #0f172a;
  --el-text-color-regular:      #475569;
  --el-text-color-secondary:    #94a3b8;
  --el-text-color-placeholder:  #cbd5e1;
  --el-text-color-disabled:     #cbd5e1;
  --el-border-color:            #e4e9f0;
  --el-border-color-light:      #eef2f7;
  --el-border-color-lighter:    #f8fafc;
  --el-border-color-extra-light:#f8fafc;
  --el-fill-color:              #f6f8fb;
  --el-fill-color-light:        #f1f5f9;
  --el-fill-color-lighter:      #f8fafc;
  --el-fill-color-blank:        #ffffff;
  --el-bg-color:                #f6f8fb;
  --el-bg-color-page:           #f6f8fb;
  --el-bg-color-overlay:        #ffffff;
  --el-mask-color:              rgba(15, 23, 42, 0.5);
  --el-box-shadow:              0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.06);
  --el-box-shadow-light:        0 1px 2px rgba(15, 23, 42, 0.05);
  --el-box-shadow-lighter:      0 0 0 1px rgba(15, 23, 42, 0.04);
  --el-border-radius-base:      8px;
  --el-component-size:          34px;
  --el-font-size-base:          14px;
}

/* ============================================
   暗色模式
   ============================================ */
html[data-theme='dark'] {
  --bg-base:        #0b1120;
  --bg-page:        #0f172a;
  --bg-card:        #16203a;
  --bg-surface:     #1e293b;
  --bg-hover:       #22304d;
  --bg-active:      #2b3b5c;

  --border:         #26324d;
  --border-light:   #1e293b;

  --primary:        #e2e8f0;
  --primary-light:  #cbd5e1;
  --primary-dark:   #f8fafc;

  --brand-cyan:     #22d3ee;
  --brand-violet:   #a78bfa;
  --brand-indigo:   #818cf8;

  --success-soft:   rgba(34, 197, 94, 0.16);
  --warning-soft:   rgba(245, 158, 11, 0.16);
  --danger-soft:    rgba(239, 68, 68, 0.16);

  --text-primary:   #e8eefb;
  --text-secondary: #a8b6cf;
  --text-muted:     #6b7a94;

  --shadow-sm:      0 1px 2px rgba(0, 0, 0, 0.30);
  --shadow-md:      0 2px 10px rgba(0, 0, 0, 0.35);
  --shadow-lg:      0 16px 40px rgba(0, 0, 0, 0.45);

  --el-text-color-primary:      #e8eefb;
  --el-text-color-regular:      #a8b6cf;
  --el-text-color-secondary:    #6b7a94;
  --el-text-color-placeholder:  #4a5872;
  --el-text-color-disabled:     #4a5872;
  /* 暗色下主色必须提亮，否则 text 按钮在深底上几乎不可见 */
  --el-color-primary:           #e2e8f0;
  --el-color-primary-light-3:   #cbd5e1;
  --el-color-primary-light-5:   #94a3b8;
  --el-color-primary-light-7:   #64748b;
  --el-color-primary-light-8:   #475569;
  --el-color-primary-light-9:   #334155;
  --el-color-primary-dark-2:    #f8fafc;
  --el-border-color:            #26324d;
  --el-border-color-light:      #1e293b;
  --el-border-color-lighter:    #1a2438;
  --el-border-color-extra-light:#16203a;
  --el-fill-color:              #16203a;
  --el-fill-color-light:        #1e293b;
  --el-fill-color-lighter:      #1a2438;
  --el-fill-color-blank:        #16203a;
  --el-bg-color:                #0f172a;
  --el-bg-color-page:           #0f172a;
  --el-bg-color-overlay:        #16203a;
  --el-mask-color:              rgba(2, 6, 23, 0.6);
  --el-box-shadow:              0 1px 3px rgba(0, 0, 0, 0.35);
  --el-box-shadow-light:        0 1px 2px rgba(0, 0, 0, 0.25);
  --el-box-shadow-lighter:      0 0 0 1px rgba(255, 255, 255, 0.04);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
}

body {
  background: var(--bg-page);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  transition: background-color 0.2s ease, color 0.2s ease;
}

::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* ============================================
   Element Plus 组件统一风格
   ============================================ */

.el-card {
  border: 1px solid var(--border) !important;
  border-radius: var(--radius-lg) !important;
  background: var(--bg-card) !important;
  box-shadow: var(--shadow-sm) !important;
}

.el-card__header {
  border-bottom: 1px solid var(--border);
  padding: 14px 18px;
  font-weight: 600;
  font-size: 15px;
  color: var(--text-primary);
}

.el-card__body { padding: 18px; }

/* ============================================
   按钮
   注意：Element Plus 的 text / link / plain 变体通过
   --el-button-text-color 变量控制颜色，这里必须按变体分别处理，
   否则统一覆盖 color 会让文字型按钮在深色模式下不可见。
   ============================================ */
.el-button {
  border-radius: var(--radius-md) !important;
  font-weight: 500;
  font-size: 13px;
  border-color: var(--border) !important;
  color: var(--text-primary) !important;
  background: var(--bg-card) !important;
  transition: all 0.15s ease;
}

/* 实心主按钮 */
.el-button--primary:not(.is-text):not(.is-link):not(.is-plain) {
  background: var(--primary) !important;
  border-color: var(--primary) !important;
  color: var(--text-inverse) !important;
  font-weight: 600;
}
html[data-theme='dark'] .el-button--primary:not(.is-text):not(.is-link):not(.is-plain) {
  color: #0f172a !important;
}
.el-button--primary:not(.is-text):not(.is-link):not(.is-plain):hover {
  background: var(--primary-light) !important;
  border-color: var(--primary-light) !important;
  color: var(--text-inverse) !important;
}

/* 文字 / 链接型按钮：使用品牌色，深浅模式都清晰 */
.el-button--primary.is-text,
.el-button--primary.is-link {
  color: var(--brand-cyan) !important;
  background: transparent !important;
  border-color: transparent !important;
}
.el-button--primary.is-text:hover,
.el-button--primary.is-link:hover {
  color: var(--accent) !important;
  background: var(--bg-hover) !important;
}

/* 浅底主按钮 */
.el-button--primary.is-plain {
  color: var(--brand-cyan) !important;
  background: var(--bg-surface) !important;
  border-color: var(--brand-cyan) !important;
}
.el-button--primary.is-plain:hover {
  color: #fff !important;
  background: var(--brand-cyan) !important;
  border-color: var(--brand-cyan) !important;
}

/* 危险按钮 */
.el-button--danger:not(.is-text):not(.is-link) {
  background: var(--danger) !important;
  border-color: var(--danger) !important;
  color: #fff !important;
}
.el-button--danger.is-text,
.el-button--danger.is-link {
  color: var(--danger) !important;
  background: transparent !important;
  border-color: transparent !important;
}

/* 次要按钮 hover */
.el-button:not(.el-button--primary):not(.el-button--danger):not(.is-text):not(.is-link):hover {
  border-color: var(--brand-cyan) !important;
  color: var(--brand-cyan) !important;
}

.el-button.is-text, .el-button.is-link {
  background: transparent !important;
  border-color: transparent !important;
}

.el-input__wrapper, .el-select__wrapper, .el-textarea__inner {
  border-radius: var(--radius-md) !important;
  border: 1px solid var(--border) !important;
  background: var(--bg-card) !important;
  box-shadow: none !important;
  transition: border-color 0.15s ease;
}

.el-input__wrapper:hover, .el-select__wrapper:hover { border-color: var(--brand-cyan) !important; }

.el-input__wrapper.is-focus, .el-select__wrapper.is-focused {
  border-color: var(--brand-cyan) !important;
  box-shadow: 0 0 0 3px rgba(0, 184, 230, 0.10) !important;
}

.el-input__inner { color: var(--text-primary) !important; font-size: 13px; }
.el-input__inner::placeholder { color: var(--text-muted) !important; }

.el-table {
  border-radius: var(--radius-md) !important;
  overflow: hidden;
  border: 1px solid var(--border) !important;
  /* Element Plus 自带 font-size:14px，且其样式是按需分块加载的（晚于本文件），
     必须 !important 才能让字号令牌真正生效（列宽测算依赖它） */
  font-size: 13px !important;
  background: var(--bg-card);
}

.el-table th.el-table__cell {
  background: var(--bg-surface) !important;
  color: var(--text-secondary) !important;
  font-weight: 600 !important;
  font-size: 11.5px !important;
  letter-spacing: 0.01em !important;
  border-bottom: 1px solid var(--border) !important;
  /* 横向内边距交给内部的 .cell（Element Plus 的 .cell 自带 padding:0 12px）。
     若 td 也保留 12px，会形成双层内边距，文字可用宽度凭空少 24px，
     列宽测算按内容算出来的宽度就会被吃掉，导致内容被省略号截断。 */
  padding: 10px 0 !important;
}

.el-table th.el-table__cell .cell {
  white-space: nowrap;
  overflow: visible;
  text-overflow: clip;
}

.el-table td.el-table__cell {
  color: var(--text-primary) !important;
  border-bottom: 1px solid var(--border-light) !important;
  padding: 10px 0 !important;
}

.el-table tr:hover > td.el-table__cell { background: var(--bg-hover) !important; }
.el-table .el-table__empty-block { background: var(--bg-card); }

/* 单元格内容永远单行显示：列宽由内容实测计算，这里兜底禁止换行。
   Element Plus 自带 .el-table .cell { white-space: normal; overflow-wrap: break-word }，
   且其样式是按需分块加载的（晚于本文件），必须用 !important 才能压住，
   否则中文会按单字断行（七 / 年 / 级 各占一行）。
   内边距收到 8px：14 列的表格能省出 100 多 px 给内容。 */
.el-table .cell {
  white-space: nowrap !important;
  overflow-wrap: normal !important;
  word-break: keep-all !important;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-left: 8px !important;
  padding-right: 8px !important;
}

.el-pagination { font-size: 13px; }
.el-pagination button { border-radius: var(--radius-md) !important; }
.el-pagination .el-pager li { border-radius: var(--radius-md) !important; font-weight: 500; }
.el-pagination .el-pager li.is-active { background: var(--primary) !important; color: var(--text-inverse) !important; }

.el-dialog {
  border-radius: var(--radius-lg) !important;
  border: 1px solid var(--border) !important;
  background: var(--bg-card) !important;
  box-shadow: var(--shadow-lg) !important;
}

.el-dialog__header {
  border-bottom: 1px solid var(--border);
  padding: 14px 18px;
  font-weight: 600;
  font-size: 15px;
  color: var(--text-primary);
}

.el-dialog__body { padding: 18px; color: var(--text-primary); }
.el-dialog__footer { border-top: 1px solid var(--border); padding: 12px 18px; }

.el-form-item__label {
  font-weight: 500;
  color: var(--text-primary) !important;
  font-size: 13px;
}

.el-tag { border-radius: var(--radius-sm) !important; font-weight: 500; font-size: 12px; }

.el-loading-mask { background: rgba(255, 255, 255, 0.8) !important; }
html[data-theme='dark'] .el-loading-mask { background: rgba(15, 23, 42, 0.8) !important; }

.el-message-box { border-radius: var(--radius-lg) !important; border: 1px solid var(--border) !important; }
.el-dropdown-menu__item:not(.is-disabled):focus { background: var(--bg-hover); color: var(--primary); }
.el-tabs__item.is-active { color: var(--primary); }
.el-tabs__active-bar { background-color: var(--brand-cyan); }
</style>
