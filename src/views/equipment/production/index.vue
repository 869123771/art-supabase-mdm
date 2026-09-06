<template>
  <ArtPermissionGuard permission="MdmProductionEquipment:View" resource-name="生产设备">
    <div class="production-equipment-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="PRODUCTION EQUIPMENT"
        title="生产设备"
        description="统一维护设备身份、产线归属、工作中心、现场接入与利用率基线，为 PMIS 点检巡检提供可信设备主档。"
        icon="ri:tools-line"
        :tags="[
          { label: 'MDM 统一设备身份', type: 'primary' },
          { label: 'PMIS 数据源', type: 'success' },
          { label: '产线级联', type: 'info' }
        ]"
        :metrics="metrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableRef" /></template>
      </BusinessWorkspaceHeader>

      <div class="production-equipment-page__workspace">
        <aside class="production-equipment-page__navigator art-card-xs">
          <header>
            <div><strong>设备范围</strong><small>按生产组织或存放位置级联筛选</small></div>
            <ElButton text aria-label="清除设备范围" title="清除设备范围" @click="clearScope">
              <ArtSvgIcon icon="ri:filter-off-line" />
            </ElButton>
          </header>
          <ElTabs v-model="scopeMode" stretch>
            <ElTabPane label="部门 / 产线" name="department" />
            <ElTabPane label="存放位置" name="location" />
          </ElTabs>
          <div class="production-equipment-page__all" :class="{ 'is-active': !activeScopeId }">
            <button type="button" @click="clearScope">
              <span><ArtSvgIcon icon="ri:apps-2-line" />全部设备</span>
              <strong>{{ overview.total }}</strong>
            </button>
          </div>
          <ElTree
            v-if="scopeMode === 'department'"
            :data="departmentTree"
            node-key="id"
            :props="{ label: 'name', children: 'children' }"
            :expand-on-click-node="false"
            highlight-current
            default-expand-all
            @node-click="selectDepartment"
          >
            <template #default="{ data }">
              <span class="production-equipment-page__tree-node">
                <ArtSvgIcon
                  :icon="data.kind === 'line' ? 'ri:git-branch-line' : 'ri:building-2-line'"
                />
                <span :title="data.name">{{ data.name }}</span>
              </span>
            </template>
          </ElTree>
          <ElTree
            v-else
            :data="locationTree"
            node-key="id"
            :props="{ label: 'name', children: 'children' }"
            :expand-on-click-node="false"
            highlight-current
            default-expand-all
            @node-click="selectLocation"
          >
            <template #default="{ data }">
              <span class="production-equipment-page__tree-node">
                <ArtSvgIcon icon="ri:map-pin-line" /><span :title="data.name">{{ data.name }}</span>
              </span>
            </template>
          </ElTree>
        </aside>

        <div class="production-equipment-page__results">
          <div class="production-equipment-page__scope-bar">
            <div>
              <span
                ><ArtSvgIcon
                  :icon="scopeMode === 'department' ? 'ri:node-tree' : 'ri:map-pin-range-line'"
              /></span>
              <div
                ><small>当前设备范围</small><strong>{{ activeScopeLabel }}</strong></div
              >
            </div>
            <ElTag effect="plain" round>{{
              scopeMode === 'department' ? '上级包含下级产线' : '上级包含下级位置'
            }}</ElTag>
          </div>
          <ArtTableQuery
            ref="tableRef"
            v-model="search"
            :api-fn="fetchData"
            :search-items="searchItems"
            :columns-factory="columnsFactory"
            :header-actions="headerActions"
            header-actions-placement="workspace"
            :search-bar-props="{ span: 8, labelWidth: 76, showExpand: false, isExpand: true }"
            :table-props="{
              rowKey: 'id',
              tableLayout: 'fixed',
              emptyText: '暂无生产设备',
              emptyDescription: '点击新增设备，建立可供 PMIS 与生产执行共享的设备主档。'
            }"
            focusable
            focus-scope-selector=".production-equipment-page__workspace"
          />
        </div>
      </div>

      <EquipmentDialog ref="dialogRef" @success="refresh" />
      <ArtDrawer
        ref="drawerRef"
        title="生产设备档案"
        subtitle="主身份、生产归属与现场接入"
        size="lg"
        :show-footer="false"
      >
        <div v-if="detailRow" class="equipment-detail">
          <div class="equipment-detail__hero">
            <span><ArtSvgIcon icon="ri:tools-line" /></span>
            <div
              ><small>{{ detailRow.equipmentCode }}</small
              ><h2>{{ detailRow.equipmentName }}</h2
              ><p>{{
                [detailRow.equipmentBrand, detailRow.model].filter(Boolean).join(' · ') ||
                '未维护品牌型号'
              }}</p></div
            >
            <ElTag
              :type="detailRow.status === 'enabled' ? 'success' : 'info'"
              effect="plain"
              round
              >{{ detailRow.status === 'enabled' ? '启用' : '停用' }}</ElTag
            >
          </div>
          <div class="equipment-detail__summary">
            <div
              ><small>部门 / 产线</small
              ><strong>{{ detailRow.departmentName || '待分配' }}</strong></div
            >
            <div
              ><small>工作中心</small
              ><strong>{{ detailRow.workCenterName || '未绑定' }}</strong></div
            >
            <div
              ><small>标准利用率</small
              ><strong>{{
                detailRow.standardUtilization == null ? '—' : `${detailRow.standardUtilization}%`
              }}</strong></div
            >
          </div>
          <ArtSectionCard
            title="设备身份"
            subtitle="跨生产与设备运维共享的识别信息"
            preserve-content-structure
          >
            <ArtDescriptions
              :data="detailRow"
              :columns="2"
              :items="identityDetails"
              empty-text="—"
            />
          </ArtSectionCard>
          <ArtSectionCard
            title="现场接入"
            subtitle="三色灯、安灯与数据采集基线"
            preserve-content-structure
          >
            <ArtDescriptions
              :data="detailRow"
              :columns="2"
              :items="connectionDetails"
              empty-text="—"
            />
          </ArtSectionCard>
          <ArtSectionCard
            title="审计信息"
            subtitle="最近一次主档维护记录"
            preserve-content-structure
          >
            <ArtDescriptions :data="detailRow" :columns="2" :items="auditDetails" empty-text="—" />
          </ArtSectionCard>
        </div>
      </ArtDrawer>
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import dayjs from 'dayjs'
  import { ElTag } from 'element-plus'
  import TreeUtils from '@/utils/tree'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { useUserStore } from '@/store/modules/user'
  import { useTenantScopeStore } from '@/store/modules/tenantScope'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtButtonMore, {
    type ButtonMoreItem
  } from '@/components/core/forms/art-button-more/index.vue'
  import ArtDrawer from '@/components/core/drawers/art-drawer/index.vue'
  import type { ArtDrawerExpose } from '@/components/core/drawers/art-drawer/types'
  import ArtDescriptions from '@/components/core/base/art-descriptions/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import {
    deleteProductionEquipment,
    fetchProductionEquipment,
    saveProductionEquipment,
    setProductionEquipmentEnabled,
    type EquipmentReference,
    type ProductionEquipment,
    type ProductionEquipmentOverview,
    type ProductionEquipmentQuery,
    type ProductionEquipmentReferences
  } from '@mdm/api'
  import EquipmentDialog, { type EquipmentDialogOpenData } from './modules/equipment-dialog.vue'

  defineOptions({ name: 'MdmProductionEquipment' })
  type ScopeMode = 'department' | 'location'
  type TreeReference = EquipmentReference & { children?: TreeReference[] }
  interface DialogExpose {
    handleOpen: (data: EquipmentDialogOpenData) => Promise<void>
  }

  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const tenantScopeStore = useTenantScopeStore()
  const { confirmAction } = useArtFeedback()
  const { effectiveTenantId, tenantOptions } = storeToRefs(tenantScopeStore)
  const tableRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const drawerRef = ref<ArtDrawerExpose<ProductionEquipment>>()
  const detailRow = shallowRef<ProductionEquipment>()
  const scopeMode = ref<ScopeMode>('department')
  const activeScopeId = ref('')
  const activeScopeLabel = ref('全部设备')
  const references = reactive<ProductionEquipmentReferences>({
    categories: [],
    departments: [],
    locations: [],
    workCenters: [],
    suppliers: []
  })
  const overview = reactive<ProductionEquipmentOverview>({
    total: 0,
    enabled: 0,
    connected: 0,
    unassigned: 0
  })
  const search = reactive({ keyword: '', status: undefined as ProductionEquipmentQuery['status'] })
  const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const visibleTenantId = computed(() => effectiveTenantId.value ?? '')
  const departmentTree = computed(
    () => treeUtils.listToTree(references.departments) as TreeReference[]
  )
  const locationTree = computed(() => treeUtils.listToTree(references.locations) as TreeReference[])

  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '设备总数',
      value: overview.total,
      description: '当前可见范围',
      icon: 'ri:tools-line'
    },
    {
      label: '已启用',
      value: overview.enabled,
      description: '可供业务引用',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    },
    {
      label: '现场已接入',
      value: overview.connected,
      description: '三色灯或安灯',
      icon: 'ri:radar-line',
      tone: 'primary'
    },
    {
      label: '待分配产线',
      value: overview.unassigned,
      description: '需补齐生产归属',
      icon: 'ri:alarm-warning-line',
      tone: overview.unassigned ? 'warning' : 'info'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '关键字',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '设备编号、名称、型号或序列号' }
    },
    {
      label: '启用状态',
      key: 'status',
      type: 'select',
      props: {
        clearable: true,
        options: getDictMap.value.commonEnabledStatus ?? []
      }
    }
  ])
  void Promise.all(
    ['commonEnabledStatus', 'mdmEquipmentOperationStatus'].map((code) =>
      userStore.ensureDictLoaded(code)
    )
  )

  const fetchData = async (params: Record<string, unknown>) => {
    const result = await fetchProductionEquipment({
      current: Number(params.current || 1),
      size: Number(params.size || 20),
      keyword: String(params.keyword || ''),
      status: params.status as ProductionEquipmentQuery['status'],
      departmentId: scopeMode.value === 'department' ? activeScopeId.value || undefined : undefined,
      locationId: scopeMode.value === 'location' ? activeScopeId.value || undefined : undefined
    })
    Object.assign(references, result.references)
    Object.assign(overview, result.overview)
    return result
  }

  const dialogData = (row?: ProductionEquipment, copy = false): EquipmentDialogOpenData => ({
    row,
    copy,
    targetTenantId: row?.tenantId || visibleTenantId.value,
    tenantOptions: tenantOptions.value.map((item) => ({
      label: item.tenantName || item.tenantCode,
      value: item.id
    })),
    references
  })
  const openDialog = (row?: ProductionEquipment, copy = false): void =>
    void dialogRef.value?.handleOpen(dialogData(row, copy))
  const refresh = (): void => void tableRef.value?.refreshData()
  const clearScope = (): void => {
    activeScopeId.value = ''
    activeScopeLabel.value = '全部设备'
    void tableRef.value?.refreshContext()
  }
  const selectDepartment = (data: TreeReference): void => {
    activeScopeId.value = data.id
    activeScopeLabel.value = data.name
    void tableRef.value?.refreshContext()
  }
  const selectLocation = (data: TreeReference): void => {
    activeScopeId.value = data.id
    activeScopeLabel.value = data.name
    void tableRef.value?.refreshContext()
  }
  watch(scopeMode, clearScope)

  const showDetail = async (row: ProductionEquipment): Promise<void> => {
    detailRow.value = row
    await nextTick()
    await drawerRef.value?.handleOpen(row, {
      contentHeight: 'calc(100vh - 86px)',
      showFooter: false
    })
  }
  const moreActions = (row: ProductionEquipment): ButtonMoreItem[] => [
    {
      key: 'copy',
      label: '复制设备',
      icon: 'ri:file-copy-line',
      auth: 'MdmProductionEquipment:Copy'
    },
    {
      key: row.status === 'enabled' ? 'disable' : 'enable',
      label: row.status === 'enabled' ? '停用' : '启用',
      icon: row.status === 'enabled' ? 'ri:forbid-line' : 'ri:checkbox-circle-line',
      auth:
        row.status === 'enabled'
          ? 'MdmProductionEquipment:Disable'
          : 'MdmProductionEquipment:Enable'
    },
    {
      key: 'delete',
      label: '删除',
      icon: 'ri:delete-bin-6-line',
      color: 'var(--el-color-danger)',
      auth: 'MdmProductionEquipment:Delete'
    }
  ]
  const handleMore = async (item: ButtonMoreItem, row: ProductionEquipment): Promise<void> => {
    if (item.key === 'copy') return openDialog(row, true)
    if (item.key === 'delete') {
      await confirmAction(
        `确定删除生产设备“${row.equipmentName}”吗？已被工作中心引用的设备需先解除绑定。`,
        '删除生产设备',
        { type: 'warning' }
      )
      await deleteProductionEquipment([row.id])
      return refresh()
    }
    await setProductionEquipmentEnabled([row.id], item.key === 'enable')
    refresh()
  }
  const columnsFactory = (): ColumnOption<ProductionEquipment>[] => [
    { type: 'selection', width: 48 },
    { type: 'globalIndex', label: '序号', width: 70, fixed: 'left' },
    {
      prop: 'equipmentName',
      label: '设备身份',
      minWidth: 250,
      fixed: 'left',
      formatter: (row) => (
        <div class="production-equipment-page__identity">
          <span>
            <ArtSvgIcon icon="ri:tools-line" />
          </span>
          <span>
            <strong title={row.equipmentName}>{row.equipmentName}</strong>
            <small title={row.equipmentCode}>{row.equipmentCode}</small>
          </span>
        </div>
      )
    },
    {
      prop: 'departmentName',
      label: '部门 / 产线',
      minWidth: 160,
      formatter: (row) => row.departmentName || '待分配'
    },
    {
      prop: 'workCenterName',
      label: '工作中心',
      minWidth: 150,
      formatter: (row) => row.workCenterName || '—'
    },
    {
      prop: 'model',
      label: '品牌 / 型号',
      minWidth: 170,
      formatter: (row) => [row.equipmentBrand, row.model].filter(Boolean).join(' · ') || '—'
    },
    {
      prop: 'responsibleName',
      label: '设备管理员',
      minWidth: 130,
      formatter: (row) => row.responsibleName || '—'
    },
    {
      prop: 'operationStatus',
      label: '运行状态',
      width: 105,
      align: 'center',
      dict: { code: 'mdmEquipmentOperationStatus', display: 'tag' }
    },
    {
      prop: 'status',
      label: '启用状态',
      width: 100,
      align: 'center',
      dict: { code: 'commonEnabledStatus', display: 'tag' }
    },
    {
      prop: 'operation',
      label: '操作',
      width: 176,
      fixed: 'right',
      formatter: (row) => (
        <div class="production-equipment-page__row-actions">
          <ArtButtonTable
            permission="MdmProductionEquipment:View"
            type="view"
            onClick={() => void showDetail(row)}
          />
          <ArtButtonTable
            permission="MdmProductionEquipment:Edit"
            type="edit"
            onClick={() => openDialog(row)}
          />
          <ArtButtonMore
            list={() => moreActions(row)}
            onClick={(item) => void handleMore(item, row)}
          />
        </div>
      )
    }
  ]

  const importRows = async (rows: Record<string, unknown>[]): Promise<void> => {
    for (const [index, row] of rows.entries()) {
      const category = references.categories.find((item) =>
        [item.code, item.name].includes(String(row['设备分类'] || ''))
      )
      const department = references.departments.find((item) =>
        [item.code, item.name].includes(String(row['部门/产线'] || ''))
      )
      if (!category || !department || !row['设备名称'])
        throw new Error(`第 ${index + 2} 行缺少设备名称、有效分类或部门/产线`)
      await saveProductionEquipment({
        tenantId: department.tenantId,
        categoryId: category.id,
        productionDepartmentId: department.id,
        equipmentCode: String(row['设备编号'] || ''),
        equipmentName: String(row['设备名称']),
        equipmentBrand: String(row['设备品牌'] || ''),
        model: String(row['设备型号'] || ''),
        factoryNo: String(row['序列号'] || ''),
        fixedAssetNo: String(row['固定资产编码'] || ''),
        syncWorkCenter: false,
        operationStatus: 'normal',
        status: 'enabled',
        sort: 10
      })
    }
    refresh()
  }
  const headerActions: ArtTableQueryHeaderAction[] = [
    {
      type: 'add',
      label: '新增设备',
      permission: 'MdmProductionEquipment:Add',
      onClick: () => openDialog()
    },
    { type: 'import', permission: 'MdmProductionEquipment:Import', onImportSuccess: importRows },
    { type: 'export', permission: 'MdmProductionEquipment:Export', exportFilename: '生产设备主档' },
    {
      label: '启用',
      icon: 'ri:checkbox-circle-line',
      permission: 'MdmProductionEquipment:Enable',
      selectionRequired: true,
      onClick: async ({ selectedRows, api }: ArtTableQueryHeaderActionContext) => {
        await setProductionEquipmentEnabled(
          selectedRows.map((row) => String(row.id)),
          true
        )
        await api.refreshUpdate()
      }
    },
    {
      label: '停用',
      icon: 'ri:forbid-line',
      permission: 'MdmProductionEquipment:Disable',
      selectionRequired: true,
      onClick: async ({ selectedRows, api }: ArtTableQueryHeaderActionContext) => {
        await setProductionEquipmentEnabled(
          selectedRows.map((row) => String(row.id)),
          false
        )
        await api.refreshUpdate()
      }
    },
    {
      type: 'delete',
      permission: 'MdmProductionEquipment:Delete',
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 台生产设备吗？`,
      onClick: async ({ selectedRows, api }: ArtTableQueryHeaderActionContext) => {
        await deleteProductionEquipment(selectedRows.map((row) => String(row.id)))
        await api.refreshRemove()
      }
    }
  ]

  const formatDate = (value?: string | null) => (value ? dayjs(value).format('YYYY-MM-DD') : '—')
  const formatTime = (value?: string | null) =>
    value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '—'
  const identityDetails = computed(() =>
    detailRow.value
      ? [
          { key: 'category', label: '设备分类', value: detailRow.value.categoryName },
          { key: 'supplier', label: '供应商', value: detailRow.value.supplierName || '—' },
          { key: 'manufacturer', label: '制造商', field: 'manufacturer' },
          { key: 'factoryNo', label: '出厂序列号', field: 'factoryNo' },
          { key: 'asset', label: '固定资产编码', field: 'fixedAssetNo' },
          {
            key: 'dates',
            label: '启用 / 验收',
            value: `${formatDate(detailRow.value.enableDate)} / ${formatDate(detailRow.value.acceptanceDate)}`
          }
        ]
      : []
  )
  const connectionDetails = computed(() =>
    detailRow.value
      ? [
          { key: 'light', label: '智能三色灯', field: 'trafficLightCardNo' },
          { key: 'andon', label: '安灯盒子', field: 'andonBoxNo' },
          {
            key: 'pulse',
            label: '脉冲间隔',
            value: detailRow.value.pulseIntervalSeconds
              ? `${detailRow.value.pulseIntervalSeconds} 秒`
              : '—'
          },
          { key: 'location', label: '放置地点', value: detailRow.value.locationName || '—' }
        ]
      : []
  )
  const auditDetails = computed(() =>
    detailRow.value
      ? [
          { key: 'createBy', label: '创建人', field: 'createBy' },
          { key: 'createTime', label: '创建时间', value: formatTime(detailRow.value.createTime) },
          { key: 'updateBy', label: '最近维护人', field: 'updateBy' },
          {
            key: 'updateTime',
            label: '最近更新时间',
            value: formatTime(detailRow.value.updateTime)
          }
        ]
      : []
  )
</script>

<style scoped lang="scss">
  .production-equipment-page {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
    min-height: 0;

    &__workspace {
      display: grid;
      grid-template-columns: 248px minmax(0, 1fr);
      gap: 12px;
      align-items: start;
      min-width: 0;
    }

    &__navigator {
      display: grid;
      gap: 8px;
      align-content: start;
      min-width: 0;
      padding: 14px;
    }

    &__navigator > header,
    &__scope-bar,
    &__scope-bar > div {
      display: flex;
      gap: 10px;
      align-items: center;
      justify-content: space-between;
    }

    &__navigator header strong,
    &__navigator header small,
    &__scope-bar strong,
    &__scope-bar small {
      display: block;
    }

    &__navigator header small,
    &__scope-bar small {
      margin-top: 2px;
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }

    &__all button {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      min-height: 38px;
      padding: 0 10px;
      color: var(--el-text-color-regular);
      background: transparent;
      border: 0;
      border-radius: var(--el-border-radius-base);
    }

    &__all button:hover,
    &__all.is-active button {
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 8%, transparent);
    }

    &__all span,
    &__tree-node {
      display: inline-flex;
      gap: 7px;
      align-items: center;
      min-width: 0;
    }

    &__tree-node span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__navigator :deep(.el-tree-node__content) {
      height: 38px;
      margin-bottom: 2px;
      border-radius: var(--el-border-radius-base);
    }

    &__results {
      display: grid;
      gap: 10px;
      min-width: 0;
    }

    &__scope-bar {
      min-height: 56px;
      padding: 9px 14px;
      background: var(--el-bg-color);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);
    }

    &__scope-bar > div > span {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 8%, var(--el-bg-color));
      border-radius: var(--el-border-radius-base);
    }

    :deep(&__identity) {
      display: grid;
      grid-template-columns: 38px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      min-width: 0;
    }

    :deep(&__identity > span:first-child) {
      display: grid;
      place-items: center;
      width: 38px;
      height: 38px;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 8%, var(--el-bg-color));
      border-radius: var(--el-border-radius-base);
    }

    :deep(&__identity > span:last-child) {
      display: grid;
      min-width: 0;
    }

    :deep(&__identity strong),
    :deep(&__identity small) {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :deep(&__identity small) {
      margin-top: 3px;
      font-family: var(--art-font-family-mono, Consolas, monospace);
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }

    :deep(&__row-actions) {
      display: flex;
      gap: 4px;
      align-items: center;
    }
  }

  .equipment-detail {
    display: grid;
    gap: 14px;

    &__hero {
      display: grid;
      grid-template-columns: 52px minmax(0, 1fr) auto;
      gap: 13px;
      align-items: center;
      padding: 16px;
      background: color-mix(in srgb, var(--theme-color) 7%, var(--el-bg-color));
      border: 1px solid color-mix(in srgb, var(--theme-color) 15%, var(--el-border-color-lighter));
      border-radius: var(--el-border-radius-base);
    }

    &__hero > span {
      display: grid;
      place-items: center;
      width: 52px;
      height: 52px;
      font-size: 23px;
      color: var(--theme-color);
      background: var(--el-bg-color);
      border-radius: var(--el-border-radius-base);
    }

    &__hero small,
    &__hero h2,
    &__hero p {
      margin: 0;
    }

    &__hero small {
      font-size: 10px;
      color: var(--theme-color);
    }

    &__hero h2 {
      margin-top: 3px;
      font-size: 18px;
    }

    &__hero p {
      margin-top: 3px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    &__summary {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      overflow: hidden;
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);
    }

    &__summary > div {
      display: grid;
      gap: 4px;
      padding: 11px 13px;
    }

    &__summary > div + div {
      border-left: 1px solid var(--el-border-color-lighter);
    }

    &__summary small {
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }
  }

  @media (width <= 960px) {
    .production-equipment-page__workspace {
      grid-template-columns: 1fr;
    }
  }

  @media (width <= 620px) {
    .equipment-detail__hero {
      grid-template-columns: 46px minmax(0, 1fr);
    }

    .equipment-detail__hero .el-tag {
      grid-column: 1/-1;
      justify-self: start;
    }

    .equipment-detail__summary {
      grid-template-columns: 1fr;
    }

    .equipment-detail__summary > div + div {
      border-top: 1px solid var(--el-border-color-lighter);
      border-left: 0;
    }
  }
</style>
