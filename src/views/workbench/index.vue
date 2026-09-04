<template>
  <div class="mdm-workbench business-workspace-page art-full-height">
    <BusinessWorkspaceHeader
      eyebrow="MASTER DATA GOVERNANCE"
      title="主数据治理工作台"
      description="把跨业务系统的标准主档汇聚为统一目录，提供一致身份、覆盖洞察与安全的只读查询。"
      icon="ri:database-2-line"
      :tags="[
        { label: '统一目录', type: 'primary' },
        { label: '租户隔离', type: 'success' },
        { label: '只读治理', type: 'info' }
      ]"
      :metrics="metrics"
      refreshable
      refresh-label="刷新主数据概览"
      :refresh-loading="loading"
      @refresh="loadOverview"
    />

    <ElAlert v-if="errorMessage" type="error" show-icon :closable="false" :title="errorMessage" />

    <div class="mdm-workbench__content">
      <ArtSectionCard
        class="mdm-workbench__directory"
        title="治理域目录"
        subtitle="按业务语义进入统一主档；记录维护仍在数据来源系统完成。"
        :loading="loading && !domains.length"
        :empty="!loading && !domains.length && !errorMessage"
        empty-title="当前租户暂无可查看的主数据"
        preserve-content-structure
      >
        <template #actions
          ><ElTag effect="plain" round>{{ domains.length }} 个治理域</ElTag></template
        >
        <div class="domain-list">
          <button
            v-for="(domain, index) in domains"
            :key="domain.key"
            type="button"
            @click="openDomain(domain.key)"
          >
            <span class="domain-list__index">{{ String(index + 1).padStart(2, '0') }}</span>
            <span class="domain-list__icon"><ArtSvgIcon :icon="domain.icon" /></span>
            <span class="domain-list__copy"
              ><strong>{{ domain.label }}</strong
              ><small>{{ domain.description }}</small></span
            >
            <span class="domain-list__count"
              ><strong>{{ domain.recordCount.toLocaleString() }}</strong
              ><small>{{ domain.sourceCount }} 类主档</small></span
            >
            <ArtSvgIcon class="domain-list__arrow" icon="ri:arrow-right-line" />
          </button>
        </div>
      </ArtSectionCard>

      <div class="mdm-workbench__aside">
        <ArtSectionCard
          title="治理健康度"
          subtitle="当前目录的接入覆盖。"
          preserve-content-structure
        >
          <div class="coverage-ring" :style="{ '--coverage': `${coveragePercent}%` }">
            <div
              ><strong>{{ coveragePercent }}%</strong><small>目录覆盖</small></div
            >
          </div>
          <div class="coverage-legend">
            <div
              ><span></span><strong>{{ totalSources }} 类</strong><small>已纳入标准主档</small></div
            >
            <div
              ><span></span><strong>{{ domains.length }} 个</strong><small>已定义治理域</small></div
            >
          </div>
        </ArtSectionCard>

        <ArtSectionCard
          title="治理边界"
          subtitle="单一事实来源的职责约定。"
          preserve-content-structure
        >
          <div class="governance-rules">
            <article
              ><span><ArtSvgIcon icon="ri:search-eye-line" /></span
              ><div
                ><strong>MDM 统一查询</strong><p>汇聚标准编码、名称、状态与更新时间。</p></div
              ></article
            >
            <article
              ><span><ArtSvgIcon icon="ri:edit-2-line" /></span
              ><div
                ><strong>来源系统维护</strong><p>新增、修改、停用由业务系统承担。</p></div
              ></article
            >
            <article
              ><span><ArtSvgIcon icon="ri:shield-check-line" /></span
              ><div
                ><strong>平台安全约束</strong><p>租户隔离与必要字段最小化输出。</p></div
              ></article
            >
          </div>
        </ArtSectionCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { fetchMdmOverview, mdmDomainDefinitions, type MdmDomainSummary } from '@mdm/api'

  defineOptions({ name: 'MdmWorkbench' })

  const router = useRouter()
  const domains = ref<MdmDomainSummary[]>(
    mdmDomainDefinitions.map((domain) => ({ ...domain, recordCount: 0 }))
  )
  const loading = ref(false)
  const errorMessage = ref('')

  const totalRecords = computed(() =>
    domains.value.reduce((total, domain) => total + domain.recordCount, 0)
  )
  const totalSources = computed(() =>
    domains.value.reduce((total, domain) => total + domain.sourceCount, 0)
  )
  const coveragePercent = computed(() => Math.min(100, Math.round((totalSources.value / 14) * 100)))
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '主数据记录',
      value: totalRecords.value.toLocaleString(),
      description: '当前租户可见记录',
      icon: 'ri:file-list-3-line',
      tone: 'primary',
      loading: loading.value
    },
    {
      label: '治理域',
      value: domains.value.length,
      description: '按业务语义归类',
      icon: 'ri:layout-grid-line',
      tone: 'success',
      loading: loading.value
    },
    {
      label: '标准主档',
      value: totalSources.value,
      description: '已纳入统一目录',
      icon: 'ri:stack-line',
      tone: 'success',
      loading: loading.value
    },
    {
      label: '治理模式',
      value: '只读',
      description: '写入仍由来源系统负责',
      icon: 'ri:shield-check-line',
      tone: 'info'
    }
  ])

  const defaultDomainPath: Record<MdmDomainSummary['key'], string> = {
    organization: '/mdm/organization/organization-directory',
    partner: '/mdm/partner/business-partner-directory',
    logistics: '/mdm/logistics/logistics-directory',
    asset: '/mdm/asset/vehicle-directory',
    material: '/mdm/material/material-directory'
  }

  async function loadOverview(): Promise<void> {
    loading.value = true
    errorMessage.value = ''
    try {
      domains.value = await fetchMdmOverview()
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '主数据概览加载失败'
    } finally {
      loading.value = false
    }
  }

  function openDomain(domain: MdmDomainSummary['key']): void {
    void router.push(defaultDomainPath[domain])
  }

  onMounted(() => void loadOverview())
</script>

<style scoped lang="scss">
  .mdm-workbench {
    overflow: auto;

    &__content {
      display: grid;
      flex: 1;
      grid-template-columns: minmax(0, 1.7fr) minmax(310px, 0.8fr);
      gap: 12px;
      min-height: 0;
    }

    &__directory {
      padding: 18px;
    }

    &__aside {
      display: grid;
      grid-template-rows: auto 1fr;
      gap: 12px;
      min-width: 0;
    }

    &__aside > :deep(.art-section-card) {
      padding: 18px;
    }
  }

  .domain-list {
    display: grid;
    overflow: hidden;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--el-border-radius-base);

    button {
      display: grid;
      grid-template-columns: auto auto minmax(0, 1fr) auto auto;
      gap: 12px;
      align-items: center;
      min-width: 0;
      padding: 14px 16px;
      color: inherit;
      text-align: left;
      cursor: pointer;
      background: transparent;
      border: 0;
      transition: background-color 0.16s ease;

      + button {
        border-top: 1px solid var(--el-border-color-lighter);
      }

      &:hover {
        background: var(--el-fill-color-lighter);
      }

      &:focus-visible {
        outline: 2px solid var(--el-color-primary-light-5);
        outline-offset: -2px;
      }
    }

    &__index {
      font-size: 10px;
      font-weight: 700;
      color: var(--el-text-color-placeholder);
      letter-spacing: 0.08em;
    }

    &__icon {
      display: grid;
      place-items: center;
      width: 38px;
      height: 38px;
      font-size: 18px;
      color: var(--el-color-primary);
      background: var(--el-color-primary-light-9);
      border-radius: 10px;
    }

    &__copy,
    &__count {
      display: grid;
      gap: 3px;
      min-width: 0;
    }

    &__copy strong {
      font-size: 13px;
    }

    &__copy small {
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 11px;
      color: var(--el-text-color-secondary);
      white-space: nowrap;
    }

    &__count {
      justify-items: end;
      min-width: 76px;
    }

    &__count strong {
      font-size: 17px;
      font-variant-numeric: tabular-nums;
    }

    &__count small {
      font-size: 10px;
      color: var(--el-text-color-secondary);
    }

    &__arrow {
      color: var(--el-text-color-placeholder);
    }
  }

  .coverage-ring {
    display: grid;
    place-items: center;
    width: 126px;
    height: 126px;
    margin: 4px auto 16px;
    background: conic-gradient(var(--el-color-primary) var(--coverage), var(--el-fill-color) 0);
    border-radius: 50%;

    &::before {
      position: absolute;
      width: 94px;
      height: 94px;
      content: '';
      background: var(--el-bg-color);
      border-radius: 50%;
    }

    > div {
      z-index: 1;
      display: grid;
      justify-items: center;
    }

    strong {
      font-size: 25px;
      font-variant-numeric: tabular-nums;
    }

    small {
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }
  }

  .coverage-legend {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    overflow: hidden;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--el-border-radius-base);

    div {
      position: relative;
      display: grid;
      padding: 11px 12px 11px 21px;
    }

    div + div {
      border-left: 1px solid var(--el-border-color-lighter);
    }

    span {
      position: absolute;
      top: 16px;
      left: 10px;
      width: 5px;
      height: 5px;
      background: var(--el-color-primary);
      border-radius: 50%;
    }

    strong {
      font-size: 13px;
    }

    small {
      margin-top: 2px;
      font-size: 10px;
      color: var(--el-text-color-secondary);
    }
  }

  .governance-rules {
    display: grid;

    article {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 11px;
      padding: 10px 0;
    }

    article + article {
      border-top: 1px solid var(--el-border-color-lighter);
    }

    article > span {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      color: var(--el-color-primary);
      background: var(--el-color-primary-light-9);
      border-radius: 9px;
    }

    strong {
      font-size: 12px;
    }

    p {
      margin: 3px 0 0;
      font-size: 11px;
      line-height: 1.55;
      color: var(--el-text-color-secondary);
    }
  }

  @media (width <= 980px) {
    .mdm-workbench__content {
      grid-template-columns: 1fr;
    }

    .mdm-workbench__aside {
      grid-template-rows: auto;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (width <= 640px) {
    .mdm-workbench__aside {
      grid-template-columns: 1fr;
    }

    .domain-list button {
      grid-template-columns: auto auto minmax(0, 1fr) auto;
    }

    .domain-list__index {
      display: none;
    }

    .domain-list__count {
      display: none;
    }
  }
</style>
