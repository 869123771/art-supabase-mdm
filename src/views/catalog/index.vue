<template>
  <div class="mdm-catalog-page business-workspace-page art-full-height">
    <BusinessWorkspaceHeader
      class="mdm-catalog-page__overview"
      density="compact"
      eyebrow="MASTER DATA GOVERNANCE"
      :title="pageMeta.title"
      :description="pageMeta.description"
      :icon="pageMeta.icon"
      :tags="[
        { label: '统一治理视图', type: 'primary', effect: 'plain' },
        { label: '租户安全隔离', type: 'success', effect: 'light' }
      ]"
      :metrics="workspaceMetrics"
    />

    <div class="mdm-catalog-page__notice" role="note">
      <span aria-hidden="true"><ArtSvgIcon icon="ri:information-line" /></span>
      <p>
        <strong>权威来源约定</strong>
        当前集中提供查询、质量识别与来源追溯；业务字段仍在对应来源系统维护，避免形成重复主档。
      </p>
    </div>

    <ArtTableQuery
      ref="tableQueryRef"
      v-model="searchQuery"
      :search-items="searchItems"
      :api-fn="fetchTableData"
      :columns-factory="columnsFactory"
      :search-bar-props="{ span: 6, labelWidth: 76 }"
      :table-props="tableProps"
      :on-success="handleTableSuccess"
      :on-cache-hit="handleTableSuccess"
      show-table-toolbar
      focusable
    />

    <CatalogDetailDrawer ref="detailDrawerRef" />
  </div>
</template>

<script setup lang="tsx">
  import type { ComputedRef } from 'vue'
  import { ElProgress, ElTag } from 'element-plus'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryProps,
    ArtTableQueryTableProps
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import {
    fetchMdmCatalogPage,
    mdmCatalogSourceDefinitions,
    type MdmCatalogPageResponse,
    type MdmCatalogQuality,
    type MdmCatalogRecord,
    type MdmCatalogScope,
    type MdmCatalogState,
    type MdmCatalogSummary
  } from '@mdm/api'
  import CatalogDetailDrawer from './modules/catalog-detail-drawer.vue'

  defineOptions({ name: 'MdmCatalog' })

  interface CatalogPageMeta {
    scope: MdmCatalogScope
    title: string
    description: string
    searchHint: string
    icon: string
  }

  interface CatalogSearchParams {
    keyword: string
    sourceType?: string
    state?: MdmCatalogState
    quality?: MdmCatalogQuality
  }

  type TableParams = CatalogSearchParams & Pick<Api.Common.PaginationParams, 'current' | 'size'>

  interface CatalogDetailDrawerExpose {
    handleOpen: (row: MdmCatalogRecord) => Promise<void>
  }

  const route = useRoute()
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const detailDrawerRef = ref<CatalogDetailDrawerExpose>()
  const emptySummary = (): MdmCatalogSummary => ({
    total: 0,
    active: 0,
    inactive: 0,
    complete: 0,
    attention: 0,
    averageScore: 0
  })
  const summary = ref<MdmCatalogSummary>(emptySummary())
  const resultTotal = ref(0)

  const routeCatalog: Record<string, CatalogPageMeta> = {
    'organization-directory': {
      scope: 'organization',
      title: '组织机构主数据',
      description: '统一核对组织编码、层级身份、启停状态及权威来源。',
      searchHint: '组织编码或名称',
      icon: 'ri:organization-chart'
    },
    'position-directory': {
      scope: 'position',
      title: '岗位与职务主数据',
      description: '聚合职族、职级、职务与岗位，形成一致的人岗语义。',
      searchHint: '职族、职级、职务或岗位',
      icon: 'ri:briefcase-4-line'
    },
    'employee-directory': {
      scope: 'employee',
      title: '员工身份主数据',
      description: '以最小必要字段核对员工编号、姓名与任职状态。',
      searchHint: '员工编号或姓名',
      icon: 'ri:contacts-book-3-line'
    },
    'business-partner-directory': {
      scope: 'partner',
      title: '统一往来主体',
      description: '贯通客户、承运商、供应商和服务商的外部主体身份。',
      searchHint: '主体编码或名称',
      icon: 'ri:building-4-line'
    },
    'logistics-directory': {
      scope: 'logistics',
      title: '物流基础主数据',
      description: '集中治理站点、货物与司机等运输基础身份。',
      searchHint: '站点、货物或司机',
      icon: 'ri:route-line'
    },
    'vehicle-directory': {
      scope: 'vehicle',
      title: '车辆主数据',
      description: '跨业务域统一识别车辆档案、运营状态与归属信息。',
      searchHint: '车牌号或车辆信息',
      icon: 'ri:truck-line'
    },
    'equipment-directory': {
      scope: 'equipment',
      title: '设备与备件主数据',
      description: '统一查看设备、备件及分类编码，识别资料完整度。',
      searchHint: '设备、备件或分类',
      icon: 'ri:tools-line'
    },
    'material-directory': {
      scope: 'material',
      title: '物料与场所主数据',
      description: '集中治理物料、分类、场所和存放位置的标准目录。',
      searchHint: '物料、场所或位置',
      icon: 'ri:archive-stack-line'
    }
  }

  const pageKey = computed(() => String(route.path.split('/').filter(Boolean).at(-1) ?? ''))
  const pageMeta = computed(
    () => routeCatalog[pageKey.value] ?? routeCatalog['business-partner-directory']
  )

  const searchQuery = ref<CatalogSearchParams>({ keyword: '' })

  const searchItems: ComputedRef<SearchFormItem[]> = computed(() => [
    {
      label: '关键字',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: pageMeta.value.searchHint }
    },
    {
      label: '主档类型',
      key: 'sourceType',
      type: 'select',
      props: {
        clearable: true,
        placeholder: '全部类型',
        options: mdmCatalogSourceDefinitions[pageMeta.value.scope].map((source) => ({
          label: source.label,
          value: source.type
        }))
      }
    },
    {
      label: '生命周期',
      key: 'state',
      type: 'select',
      props: {
        clearable: true,
        placeholder: '全部状态',
        options: [
          { label: '有效', value: 'active' },
          { label: '停用', value: 'inactive' }
        ]
      }
    },
    {
      label: '资料质量度',
      key: 'quality',
      type: 'select',
      props: {
        clearable: true,
        placeholder: '全部质量',
        options: [
          { label: '资料完整', value: 'complete' },
          { label: '待完善', value: 'attention' }
        ]
      }
    }
  ])

  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '当前结果',
      value: resultTotal.value,
      description: '随查询条件实时更新',
      icon: 'ri:database-2-line'
    },
    {
      label: '有效主档',
      value: summary.value.active,
      description: `本目录另有 ${summary.value.inactive} 条停用`,
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    },
    {
      label: '平均完整度',
      value: `${summary.value.averageScore}%`,
      description: `${summary.value.attention} 条资料待完善`,
      icon: 'ri:shield-check-line',
      tone: summary.value.attention ? 'warning' : 'success'
    }
  ])

  const tableProps: ArtTableQueryTableProps = {
    rowKey: 'id',
    tableLayout: 'fixed',
    emptyText: '暂无符合条件的主数据',
    emptyDescription: '可调整关键字、主档类型、生命周期或资料完整度后重新查询。'
  }

  const fetchTableData = async (params: TableParams): Promise<MdmCatalogPageResponse> => {
    const result = await fetchMdmCatalogPage(pageMeta.value.scope, params)
    summary.value = result.summary
    resultTotal.value = result.total
    return result
  }

  const sourceAppLabel = (value: string): string => {
    const labels: Record<string, string> = {
      platform: '平台',
      hr: 'HR',
      tms: 'TMS',
      vms: 'VMS',
      smis: 'SMIS'
    }
    return labels[value] ?? value.toUpperCase()
  }

  const formatDateTime = (value: string | null): string => {
    if (!value) return '—'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', { hour12: false })
  }

  const renderSource = (row: MdmCatalogRecord) => (
    <div class="mdm-source-cell">
      <span class="mdm-source-cell__icon">
        <ArtSvgIcon icon="ri:database-2-line" />
      </span>
      <div>
        <strong>{row.sourceLabel}</strong>
        <small>{sourceAppLabel(row.sourceApp)} 权威来源</small>
      </div>
    </div>
  )

  const renderIdentity = (row: MdmCatalogRecord) => (
    <div class="mdm-identity-cell">
      <strong title={row.name}>{row.name}</strong>
      <span title={row.code}>{row.code}</span>
      {row.subtitle ? <small title={row.subtitle}>{row.subtitle}</small> : null}
    </div>
  )

  const renderLifecycle = (row: MdmCatalogRecord) => (
    <ElTag type={row.isActive ? 'success' : 'info'} effect="light" round>
      {row.isActive ? '有效' : '停用'}
    </ElTag>
  )

  const renderQuality = (row: MdmCatalogRecord) => (
    <div class="mdm-quality-cell">
      <ElProgress
        percentage={row.qualityScore}
        stroke-width={5}
        show-text={false}
        status={row.qualityScore >= 90 ? 'success' : 'warning'}
      />
      <span>{row.qualityScore}%</span>
      <small>{row.qualityIssues.length ? `${row.qualityIssues.length} 项待补` : '资料完整'}</small>
    </div>
  )

  const columnsFactory = (): ColumnOption<MdmCatalogRecord>[] => [
    { type: 'globalIndex', label: '序号', width: 68 },
    { prop: 'sourceLabel', label: '主档来源', minWidth: 170, formatter: renderSource },
    { prop: 'name', label: '主数据身份', minWidth: 260, formatter: renderIdentity },
    { prop: 'status', label: '生命周期', width: 112, formatter: renderLifecycle },
    { prop: 'qualityScore', label: '资料完整度', minWidth: 190, formatter: renderQuality },
    {
      prop: 'updateTime',
      label: '最近更新',
      width: 174,
      formatter: (row) => <span class="mdm-time-cell">{formatDateTime(row.updateTime)}</span>
    },
    {
      prop: 'operation',
      label: '操作',
      width: 88,
      fixed: 'right',
      formatter: (row) => (
        <ArtButtonTable
          type="view"
          label="查看详情"
          onClick={() => detailDrawerRef.value?.handleOpen(row)}
        />
      )
    }
  ]

  const handleTableSuccess: NonNullable<ArtTableQueryProps['onSuccess']> = (_rows, response) => {
    if (response.summary) summary.value = response.summary as MdmCatalogSummary
    resultTotal.value = Number(response.total ?? 0)
  }

  watch(
    () => pageMeta.value.scope,
    async () => {
      searchQuery.value = { keyword: '' }
      summary.value = emptySummary()
      resultTotal.value = 0
      await nextTick()
      await tableQueryRef.value?.getData()
    }
  )
</script>

<style scoped lang="scss">
  .mdm-catalog-page {
    min-height: 0;
    overflow: hidden;

    &__notice {
      display: flex;
      flex: 0 0 auto;
      gap: 10px;
      align-items: center;
      padding: 10px 14px;
      color: var(--el-text-color-secondary);
      background: color-mix(in srgb, var(--theme-color) 4%, var(--el-bg-color));
      border: 1px solid color-mix(in srgb, var(--theme-color) 15%, var(--el-border-color-lighter));
      border-radius: 9px;

      > span {
        display: grid;
        flex: 0 0 auto;
        place-items: center;
        font-size: 17px;
        color: var(--el-color-primary);
      }

      p {
        margin: 0;
        font-size: 12px;
        line-height: 1.6;
      }

      strong {
        margin-right: 8px;
        color: var(--el-text-color-primary);
      }
    }
  }

  :deep(.mdm-source-cell),
  :deep(.mdm-identity-cell) {
    min-width: 0;
  }

  :deep(.mdm-source-cell) {
    display: flex;
    gap: 10px;
    align-items: center;

    div {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    strong {
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 13px;
      color: var(--el-text-color-primary);
      white-space: nowrap;
    }

    small {
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }
  }

  :deep(.mdm-source-cell__icon) {
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    width: 30px;
    height: 30px;
    color: var(--el-color-primary);
    background: color-mix(in srgb, var(--theme-color) 9%, var(--el-bg-color));
    border-radius: 8px;
  }

  :deep(.mdm-identity-cell) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 3px 12px;
    align-items: center;

    strong,
    span,
    small {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    strong {
      font-size: 14px;
      color: var(--el-text-color-primary);
    }

    span {
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 11px;
      color: var(--el-color-primary);
    }

    small {
      grid-column: 1 / -1;
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }
  }

  :deep(.mdm-quality-cell) {
    display: grid;
    grid-template-columns: minmax(54px, 1fr) 38px;
    gap: 2px 8px;
    align-items: center;

    .el-progress {
      min-width: 0;
    }

    > span {
      font-size: 12px;
      font-weight: 650;
      color: var(--el-text-color-primary);
      text-align: right;
    }

    > small {
      grid-column: 1 / -1;
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }
  }

  :deep(.mdm-time-cell) {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  @media (width <= 700px) {
    .mdm-catalog-page {
      overflow: auto;

      &__notice {
        align-items: flex-start;
      }

      > :deep(.art-table-query) {
        flex: none;
        min-height: 620px;
      }
    }
  }
</style>
