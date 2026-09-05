<template>
  <ArtDialog ref="dialogRef" size="xl"
    ><ArtTableQuery
      ref="tableRef"
      v-model="search"
      :api-fn="fetchRows"
      :columns-factory="columns"
      :header-actions="actions"
      :search-items="[
        { key: 'keyword', label: '工序', type: 'input', props: { placeholder: '编号 / 名称' } }
      ]"
      :enable-cache="false"
      :table-props="{ rowKey: 'id', emptyText: '暂无工序明细', height: 320 }"
  /></ArtDialog>
  <ArtDialog ref="editDialog" size="md"
    ><ArtForm
      ref="formRef"
      v-model="form"
      :items="items"
      :rules="rules"
      :span="24"
      :show-reset="false"
      :show-submit="false"
      ><template #workCenterId
        ><ArtTableSingleSelect
          :model-value="form.workCenterId || undefined"
          @update:model-value="form.workCenterId = $event == null ? null : String($event)"
          :selected-data="selection"
          :api-fn="fetchCenters"
          :columns="[
            { prop: 'code', label: '工作中心', minWidth: 150 },
            { prop: 'name', label: '名称', minWidth: 170 }
          ]"
          label-key="name"
          title="选择工作中心" /></template></ArtForm
  ></ArtDialog>
</template>
<script setup lang="tsx">
  import ArtTableSingleSelect from '@/components/core/forms/art-data-select/table-single.vue'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  const { confirmAction } = useArtFeedback()
  import { ref, reactive, computed, shallowRef } from 'vue'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { DataSelectFetchParams } from '@/components/core/forms/art-data-select/types'
  import type { ColumnOption } from '@/types'
  import { useUserStore } from '@/store/modules/user'
  import {
    fetchProcessSteps,
    saveProcessStep,
    deleteProcessStep,
    fetchWorkCenters,
    type WorkspaceQuery,
    type ProcessRoute,
    type ProcessStep
  } from '@mdm/api'
  const user = useUserStore()
  const dialogRef = ref<ArtDialogExpose>()
  const editDialog = ref<ArtDialogExpose>()
  const tableRef = ref<ArtTableQueryExpose>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const route = shallowRef<ProcessRoute>()
  const readonly = ref(false)
  const search = reactive({ keyword: '' })
  const selection = ref<NonNullable<ProcessStep['workCenter']>[]>([])
  const form = reactive({ code: '', name: '', workCenterId: null as string | null, sort: 0 })
  const items: FormItem[] = [
    { key: 'code', label: '工序编号', type: 'input' },
    { key: 'name', label: '工序名称', type: 'input' },
    { key: 'workCenterId', label: '工作中心' },
    { key: 'sort', label: '排序', type: 'number', props: { min: 0, precision: 0 } }
  ]
  const rules = {
    code: [{ required: true, message: '请输入工序编号', trigger: 'blur' }],
    name: [{ required: true, message: '请输入工序名称', trigger: 'blur' }]
  }
  const fetchCenters = (p: DataSelectFetchParams) =>
    fetchWorkCenters({
      tenantId: user.info.tenantId || '',
      keyword: p.keyword,
      current: p.page,
      size: p.pageSize
    })
  const fetchRows = (p: WorkspaceQuery, o?: { signal?: AbortSignal }) =>
    fetchProcessSteps({ ...p, tenantId: user.info.tenantId || '', routeId: route.value?.id }, o)
  const columns = (): ColumnOption<ProcessStep>[] => [
    { prop: 'code', label: '工序编号', width: 120 },
    { prop: 'name', label: '工序名称', minWidth: 160 },
    {
      prop: 'workCenter',
      label: '工作中心',
      minWidth: 160,
      formatter: (r) => r.workCenter?.name || '未指定'
    },
    {
      prop: 'template',
      label: '作业模板',
      minWidth: 160,
      formatter: (r) => r.template?.name || '未绑定'
    },
    { prop: 'configUpdatedAt', label: '工艺规则更新时间', minWidth: 180 },
    ...(!readonly.value
      ? [
          {
            prop: 'operation',
            label: '操作',
            width: 100,
            formatter: (r: ProcessStep) => (
              <div>
                <ArtButtonTable
                  type="edit"
                  permission="MdmProcessRoute:Edit"
                  onClick={() => void openStep(r)}
                />
                <ArtButtonTable
                  type="delete"
                  permission="MdmProcessRoute:Edit"
                  onClick={() => void remove(r)}
                />
              </div>
            )
          }
        ]
      : [])
  ]
  const actions = computed<ArtTableQueryHeaderAction[]>(() =>
    readonly.value
      ? []
      : [
          {
            type: 'add',
            label: '添加工序',
            permission: 'MdmProcessRoute:Edit',
            onClick: () => void openStep()
          }
        ]
  )
  async function remove(row: ProcessStep) {
    try {
      await confirmAction('删除该工序及其模板绑定？', '删除工序', { type: 'warning' })
      await deleteProcessStep(row.id)
      await tableRef.value?.refreshData()
    } catch {
      /* API owns feedback. */
    }
  }
  async function openStep(row?: ProcessStep) {
    Object.assign(form, {
      code: row?.code || '',
      name: row?.name || '',
      workCenterId: row?.workCenterId || null,
      sort: row?.sort || 0
    })
    selection.value = row?.workCenter ? [row.workCenter] : []
    await editDialog.value?.handleOpen(undefined, {
      title: row ? '编辑工序' : '添加工序',
      confirmText: '保存工序',
      onConfirm: async () => {
        try {
          await formRef.value?.validate()
          if (!route.value) return false
          await saveProcessStep(
            { ...form, routeId: route.value.id, workCenterId: form.workCenterId || null },
            row?.id
          )
          await tableRef.value?.refreshData()
        } catch {
          return false
        }
      }
    })
  }
  async function handleOpen(row: ProcessRoute, viewOnly = false) {
    route.value = row
    readonly.value = viewOnly
    search.keyword = ''
    await dialogRef.value?.handleOpen(undefined, {
      title: `工序明细 · ${row.name}`,
      showConfirmButton: false,
      cancelText: '关闭'
    })
  }
  defineExpose({ handleOpen })
</script>
