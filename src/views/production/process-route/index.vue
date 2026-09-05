<template>
  <div class="process-route-page business-workspace-page art-full-height"
    ><ProductionWorkspaceHeader
      title="工艺路线"
      description="维护产品的工艺路径和工序明细，关联工作中心与标准作业模板。"
      icon="ri:route-line"
      capability="工艺路径治理"
      :metrics="workspaceMetrics"
      ><template #actions
        ><BusinessTableWorkspaceActions :table="tableRef" /></template></ProductionWorkspaceHeader
    ><ArtTableQuery
      ref="tableRef"
      v-model="search"
      :api-fn="fetchRows"
      :columns-factory="columns"
      :header-actions="actions"
      header-actions-placement="workspace"
      :search-bar-props="{ span: 8, labelWidth: 82, showExpand: false }"
      :on-success="handleTableSuccess"
      :search-items="[
        {
          key: 'keyword',
          label: '路线名称',
          type: 'input',
          props: { clearable: true, placeholder: '搜索工艺路线' }
        }
      ]"
      :enable-cache="false"
      focusable
      :table-props="{
        rowKey: 'id',
        tableLayout: 'fixed',
        emptyText: '暂无工艺路线',
        emptyDescription: '先创建产品路线，再添加工序和工作中心。'
      }" /><RouteDialog ref="routeDialog" @success="refresh" /><StepsDialog ref="stepsDialog"
  /></div>
</template>
<script setup lang="tsx">
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  const { confirmAction } = useArtFeedback()
  import { computed, ref, reactive } from 'vue'
  import dayjs from 'dayjs'
  import { uniq } from 'lodash-es'
  import type { ColumnOption } from '@/types'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryProps
  } from '@/components/core/tables/art-table-query/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtButtonMore from '@/components/core/forms/art-button-more/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import type { BusinessWorkspaceMetric } from '@/components/business/business-workspace-header/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import { exportExcel } from '@/utils/file'
  import { formatWithDayjs } from '@/utils/time'
  import {
    fetchProcessRoutes,
    deleteProcessRoute,
    type ProcessRoute,
    type WorkspaceQuery
  } from '@mdm/api'
  import RouteDialog from './modules/route-dialog.vue'
  import StepsDialog from './modules/steps-dialog.vue'
  import ProductionWorkspaceHeader from '../modules/production-workspace-header.vue'
  defineOptions({ name: 'MdmProcessRoute' })
  const user = useUserStore()
  const tableRef = ref<ArtTableQueryExpose>()
  const routeDialog = ref<InstanceType<typeof RouteDialog>>()
  const stepsDialog = ref<InstanceType<typeof StepsDialog>>()
  const search = reactive({ keyword: '' })
  const overview = reactive({ total: 0, rows: [] as ProcessRoute[] })
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '路线总数',
      value: overview.total,
      description: '当前查询范围内的产品路线',
      icon: 'ri:route-line'
    },
    {
      label: '本页产品',
      value: uniq(overview.rows.map((row) => row.materialId)).length,
      description: '当前页已配置路线的产品',
      icon: 'ri:box-3-line',
      tone: 'success'
    },
    {
      label: '近 30 日更新',
      value: overview.rows.filter((row) =>
        dayjs(row.updateTime).isAfter(dayjs().subtract(30, 'day'))
      ).length,
      description: '当前页近期调整记录',
      icon: 'ri:history-line'
    }
  ])
  const fetchRows = (p: WorkspaceQuery, o?: { signal?: AbortSignal }) =>
    fetchProcessRoutes({ ...p, tenantId: user.info.tenantId || '' }, o)
  const refresh = () => tableRef.value?.refreshData()
  const handleTableSuccess: ArtTableQueryProps['onSuccess'] = (rows, response) => {
    overview.rows = rows as ProcessRoute[]
    overview.total = Number(response.total ?? rows.length)
  }
  const columns = (): ColumnOption<ProcessRoute>[] => [
    { type: 'globalIndex', label: '序号', width: 72 },
    {
      prop: 'material',
      label: '产品主数据',
      minWidth: 280,
      fixed: 'left',
      formatter: (r) => (
        <div class="process-route-page__identity">
          <span aria-hidden="true">
            <ArtSvgIcon icon="ri:box-3-line" />
          </span>
          <span>
            <strong title={r.material?.materialName || ''}>
              {r.material?.materialName || '产品待关联'}
            </strong>
            <small>
              {[r.material?.materialCode, r.material?.specificationModel]
                .filter(Boolean)
                .join(' · ') || '—'}
            </small>
          </span>
        </div>
      )
    },
    { prop: 'name', label: '路线名称', minWidth: 220, showOverflowTooltip: true },
    {
      prop: 'updateTime',
      label: '更新时间',
      width: 164,
      formatter: (row) => formatWithDayjs(row.updateTime) || '—'
    },
    {
      prop: 'operation',
      label: '操作',
      width: 164,
      fixed: 'right',
      formatter: (r) => (
        <div class="process-route-page__actions">
          <ArtButtonTable
            type="view"
            permission="MdmProcessRoute:View"
            onClick={() => void stepsDialog.value?.handleOpen(r, true)}
          />
          <ArtButtonTable
            type="edit"
            permission="MdmProcessRoute:Edit"
            onClick={() => void routeDialog.value?.handleOpen(r)}
          />
          <ArtButtonMore
            list={[
              {
                key: 'steps',
                label: '工序明细',
                icon: 'ri:git-commit-line',
                auth: 'MdmProcessRoute:Edit'
              },
              {
                key: 'delete',
                label: '删除',
                icon: 'ri:delete-bin-6-line',
                color: 'var(--el-color-danger)',
                auth: 'MdmProcessRoute:Delete'
              }
            ]}
            onClick={(item) =>
              item.key === 'steps' ? void stepsDialog.value?.handleOpen(r) : void remove(r)
            }
          />
        </div>
      )
    }
  ]
  async function remove(row: ProcessRoute) {
    try {
      await confirmAction('确认删除路线及其全部工序和模板绑定？', '删除工艺路线', {
        type: 'warning'
      })
      await deleteProcessRoute(row.id)
      await refresh()
    } catch {
      /* API owns feedback. */
    }
  }
  async function exportRows() {
    const rows: ProcessRoute[] = []
    for (let current = 1; current <= 10; current++) {
      const r = await fetchRows({ ...search, tenantId: '', current, size: 1000 })
      if (r.total > 10000) throw new Error('请缩小筛选范围')
      rows.push(...r.data)
      if (rows.length >= r.total) break
    }
    await exportExcel({
      data: rows.map((r) => ({
        code: r.material?.materialCode,
        product: r.material?.materialName,
        spec: r.material?.specificationModel,
        name: r.name
      })),
      columns: [
        { key: 'code', title: '产品编码' },
        { key: 'product', title: '产品名称' },
        { key: 'spec', title: '规格型号' },
        { key: 'name', title: '路线名称' }
      ],
      filename: '工艺路线'
    })
  }
  const actions: ArtTableQueryHeaderAction[] = [
    {
      type: 'add',
      label: '新增路线',
      permission: 'MdmProcessRoute:Add',
      onClick: () => void routeDialog.value?.handleOpen()
    },
    { type: 'export', permission: 'MdmProcessRoute:Export', onClick: exportRows }
  ]
</script>

<style scoped lang="scss">
  .process-route-page {
    gap: 12px;
    min-width: 0;

    :deep(.process-route-page__identity) {
      display: grid;
      grid-template-columns: 36px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      min-width: 0;

      > span:first-child {
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        color: var(--theme-color);
        background: color-mix(in srgb, var(--theme-color) 9%, var(--el-bg-color));
        border-radius: var(--el-border-radius-base);
      }

      > span:last-child,
      strong,
      small {
        display: block;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        margin-top: 2px;
        font-family: var(--art-font-family-mono, Consolas, monospace);
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }
    }

    :deep(.process-route-page__actions) {
      display: flex;
      gap: 4px;
      align-items: center;
      justify-content: center;
    }
  }
</style>
