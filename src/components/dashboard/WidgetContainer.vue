<template>
  <div class="widget-container" :class="{ collapsed: isCollapsed }">
    <div class="widget-header" @click="toggleCollapse">
      <span class="widget-title">{{ title }}</span>
      <el-icon class="collapse-icon" :class="{ rotated: isCollapsed }">
        <ArrowDown />
      </el-icon>
    </div>
    <div v-show="!isCollapsed" class="widget-body">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ArrowDown } from '@element-plus/icons-vue'

defineProps<{ title: string }>()

const isCollapsed = ref(false)
const toggleCollapse = () => { isCollapsed.value = !isCollapsed.value }
</script>

<style scoped lang="scss">
.widget-container {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;

  .widget-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    cursor: pointer;
    user-select: none;
    border-bottom: 1px solid var(--border-light);
    transition: background 0.15s;
    &:hover { background: var(--bg-hover); }
  }
  .widget-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }
  .collapse-icon {
    color: var(--text-muted);
    transition: transform 0.2s;
    &.rotated { transform: rotate(-90deg); }
  }
  .widget-body { padding: 16px; }

  &.collapsed .widget-header { border-bottom: none; }
}
</style>
