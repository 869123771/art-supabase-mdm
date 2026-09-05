<template>
  <div class="mdm-production-entry art-full-height">
    <ElScrollbar class="mdm-production-entry__scrollbar">
      <div class="business-workspace-page">
        <ProductionWorkspaceHeader
          :title="title"
          :description="description"
          :icon="icon"
          capability="人员关系配置"
          :metrics="workspaceMetrics"
        />
        <ArtSectionCard
          title="配置流程"
          subtitle="人员与工作中心的关系统一从工作中心维护，避免出现重复配置入口。"
          preserve-content-structure
        >
          <template #actions
            ><ElButton
              v-if="router.hasRoute('MdmWorkCenter')"
              type="primary"
              @click="router.push({ name: 'MdmWorkCenter' })"
              >进入工作中心</ElButton
            ></template
          >
          <ol class="mdm-production-entry__steps">
            <li>
              <span>01</span>
              <div><strong>选择工作中心</strong><p>按部门或产线定位需要配置的生产资源。</p></div>
            </li>
            <li>
              <span>02</span>
              <div><strong>维护人员安排</strong><p>选择指定人员，或按岗位设置计划人数。</p></div>
            </li>
            <li>
              <span>03</span>
              <div><strong>设置临时调整</strong><p>为替班、支援等情况维护生效起止时间。</p></div>
            </li>
          </ol>
        </ArtSectionCard>
      </div>
    </ElScrollbar>
  </div>
</template>

<script setup lang="ts">
  import { useRouter } from 'vue-router'
  import type { BusinessWorkspaceMetric } from '@/components/business/business-workspace-header/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ProductionWorkspaceHeader from './production-workspace-header.vue'

  const router = useRouter()

  defineProps<{
    title: string
    description: string
    icon: string
  }>()

  const workspaceMetrics: BusinessWorkspaceMetric[] = [
    {
      label: '配置入口',
      value: '工作中心',
      description: '统一维护人员关系',
      icon: 'ri:dashboard-3-line'
    },
    {
      label: '支持模式',
      value: '2 种',
      description: '指定人员或指定人数',
      icon: 'ri:user-settings-line',
      tone: 'success'
    },
    {
      label: '临时调整',
      value: '生效区间',
      description: '支援与替班按时间管理',
      icon: 'ri:calendar-event-line'
    }
  ]
</script>

<style scoped lang="scss">
  .mdm-production-entry {
    min-width: 0;

    &__scrollbar {
      height: 100%;
      min-height: 0;
    }

    &__steps {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
      padding: 0;
      margin: 0;
      list-style: none;

      li {
        display: grid;
        grid-template-columns: 36px minmax(0, 1fr);
        gap: 12px;
        align-items: start;
        padding: 16px;
        background: var(--el-fill-color-light);
        border-radius: var(--el-border-radius-base);
      }

      li > span {
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        font-size: 12px;
        font-weight: 700;
        color: var(--theme-color);
        background: color-mix(in srgb, var(--theme-color) 9%, var(--el-bg-color));
        border-radius: var(--el-border-radius-base);
      }

      strong {
        color: var(--el-text-color-primary);
      }

      p {
        margin: 4px 0 0;
        font-size: 12px;
        line-height: 1.7;
        color: var(--el-text-color-secondary);
      }
    }

    @media (width <= 800px) {
      &__steps {
        grid-template-columns: 1fr;
      }
    }
  }
</style>
