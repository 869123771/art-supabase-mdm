<template>
  <ArtDialog ref="dialogRef" size="xl">
    <div class="process-route-dialog">
      <ArtEntitySummary
        icon="ri:route-line"
        eyebrow="PROCESS ROUTE DESIGN"
        :title="routeIdentityTitle"
        :description="routeIdentityDescription"
      >
        <template #aside>
          <ArtDictDisplay dict-code="commonBoolean" :value="String(form.enabled)" display="tag" />
        </template>
      </ArtEntitySummary>

      <div class="process-route-dialog__form-panel">
        <ArtForm
          ref="formRef"
          v-model="form"
          :items="items"
          :rules="rules"
          :span="12"
          :gutter="24"
          label-position="top"
          :show-reset="false"
          :show-submit="false"
        >
          <template #materialId>
            <ArtTableSingleSelect
              v-model="form.materialId"
              :selected-data="selection"
              :api-fn="fetchMaterials"
              :columns="[
                { prop: 'materialCode', label: '产品编码', minWidth: 140 },
                { prop: 'materialName', label: '产品名称', minWidth: 160 },
                { prop: 'specificationModel', label: '规格型号', minWidth: 150 }
              ]"
              label-key="materialName"
              title="选择产品"
              subtitle="从当前租户的产品物料中选择路线适用对象"
              search-placeholder="搜索产品编码、名称或规格"
              empty-text="暂无可选产品"
              empty-description="请先维护产品物料后再创建工艺路线。"
              @change="handleMaterialChange"
            />
          </template>
        </ArtForm>
      </div>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import dayjs from 'dayjs'
  import { cloneDeep } from 'lodash-es'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtTableSingleSelect from '@/components/core/forms/art-data-select/table-single.vue'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import type {
    DataSelectFetchParams,
    DataSelectKey,
    DataSelectRecord
  } from '@/components/core/forms/art-data-select/types'
  import { useUserStore } from '@/store/modules/user'
  import {
    saveProcessRoute,
    fetchProductionReferences,
    fetchProcessRouteReferences,
    type ProcessRoute,
    type ProcessRouteInput,
    type ProcessRouteReferences
  } from '@mdm/api'

  const emit = defineEmits<{ success: [] }>()
  const user = useUserStore()
  const { getDictMap } = storeToRefs(user)
  const dialogRef = ref<ArtDialogExpose>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const selection = ref<NonNullable<ProcessRoute['material']>[]>([])
  const references = ref<ProcessRouteReferences>({
    groups: [],
    operations: [],
    controlCodes: [],
    units: [],
    departments: [],
    workCenters: [],
    activityFormulas: [],
    suppliers: [],
    esopDocuments: []
  })
  const initialForm = (): ProcessRouteInput => ({
    tenantId: '',
    materialId: '',
    code: '',
    name: '',
    routeType: 'standard',
    allocationMode: 'quantity',
    groupId: null,
    version: '',
    batchFrom: null,
    batchTo: 9999999999,
    productionUnitId: null,
    departmentId: null,
    effectiveDate: dayjs().format('YYYY-MM-DD'),
    expiryDate: '9999-12-31',
    isDefault: false,
    source: 'manual',
    customUnitConversion: false,
    enabled: true,
    path: '',
    remark: ''
  })
  const form = reactive<ProcessRouteInput>(initialForm())
  const booleanOptions = computed(() =>
    (getDictMap.value.commonBoolean ?? []).map((item) => ({
      label: item.label || item.value,
      value: item.value === 'true' || item.value === '1'
    }))
  )
  const routeIdentityTitle = computed(() => form.name.trim() || '新工艺路线')
  const routeIdentityDescription = computed(() => {
    if (form.code.trim()) return `路线编码：${form.code.trim()}`
    const materialName = selection.value[0]?.materialName
    return materialName
      ? `适用产品：${materialName}`
      : '定义产品版本、批量范围与生效规则；保存后可继续维护工序序列。'
  })
  const option = (rows: Array<{ id: string; code: string; name: string }>) =>
    rows.map((row) => ({ label: `${row.name} · ${row.code}`, value: row.id }))
  const items = computed<FormItem[]>(() => [
    { key: 'identity', label: '路线识别', type: 'divider', span: 24 },
    {
      key: 'code',
      label: '路线编码',
      props: { disabled: true, placeholder: '保存时自动生成 4 位流水码' }
    },
    { key: 'name', label: '路线名称', props: { maxlength: 120 } },
    { key: 'materialId', label: '产品物料', type: 'slot' },
    {
      key: 'groupId',
      label: '路线分组',
      type: 'select',
      options: option(references.value.groups),
      props: { clearable: true, filterable: true }
    },
    {
      key: 'routeType',
      label: '路线类型',
      type: 'select',
      options: getDictMap.value.mdmProcessRouteType ?? []
    },
    {
      key: 'allocationMode',
      label: '分配方式',
      type: 'select',
      options: getDictMap.value.mdmProcessRouteAllocationMode ?? []
    },
    { key: 'version', label: '工艺版本', props: { maxlength: 40 } },
    {
      key: 'departmentId',
      label: '生产车间',
      type: 'select',
      options: option(references.value.departments),
      props: { clearable: true, filterable: true }
    },
    { key: 'scope', label: '批量与有效期', type: 'divider', span: 24 },
    {
      key: 'batchFrom',
      label: '批量从',
      type: 'number',
      props: { min: 0, precision: 6, class: '!w-full' }
    },
    {
      key: 'batchTo',
      label: '批量至',
      type: 'number',
      props: { min: 0, precision: 6, class: '!w-full' }
    },
    {
      key: 'productionUnitId',
      label: '生产单位',
      type: 'select',
      options: option(references.value.units),
      props: { clearable: true, filterable: true }
    },
    {
      key: 'effectiveDate',
      label: '生效日期',
      type: 'date',
      props: { valueFormat: 'YYYY-MM-DD', class: '!w-full' }
    },
    {
      key: 'expiryDate',
      label: '失效日期',
      type: 'date',
      props: { valueFormat: 'YYYY-MM-DD', class: '!w-full' }
    },
    {
      key: 'strategy',
      label: '策略与状态',
      type: 'divider',
      span: 24
    },
    {
      key: 'source',
      label: '来源',
      type: 'select',
      options: getDictMap.value.mdmProcessRouteSource ?? []
    },
    {
      key: 'isDefault',
      label: '默认路线',
      type: 'segment',
      options: booleanOptions.value
    },
    {
      key: 'customUnitConversion',
      label: '自定义单位换算',
      type: 'segment',
      options: booleanOptions.value
    },
    {
      key: 'enabled',
      label: '启用状态',
      type: 'segment',
      options: booleanOptions.value
    },
    { key: 'path', label: '工艺路径', type: 'input', span: 24, props: { maxlength: 500 } },
    {
      key: 'remark',
      label: '备注',
      type: 'textarea',
      span: 24,
      props: { rows: 3, maxlength: 1000, showWordLimit: true, resize: 'none' }
    }
  ])
  const rules = {
    materialId: [{ required: true, message: '请选择产品', trigger: 'change' }],
    name: [{ required: true, message: '请输入路线名称', trigger: 'blur' }],
    batchTo: [
      {
        validator: (_rule: unknown, value: number, callback: (error?: Error) => void) =>
          value >= (form.batchFrom ?? 0) ? callback() : callback(new Error('批量至不能小于批量从')),
        trigger: 'blur'
      }
    ],
    effectiveDate: [{ required: true, message: '请选择生效日期', trigger: 'change' }],
    expiryDate: [
      {
        validator: (_rule: unknown, value: string, callback: (error?: Error) => void) =>
          !value || !form.effectiveDate || value >= form.effectiveDate
            ? callback()
            : callback(new Error('失效日期不能早于生效日期')),
        trigger: 'change'
      }
    ]
  }
  const fetchMaterials = (p: DataSelectFetchParams) =>
    fetchProductionReferences('material', user.info.tenantId || '', p.keyword, p.page, p.pageSize)
  const handleMaterialChange = (
    _value: DataSelectKey | DataSelectKey[] | undefined,
    rows: DataSelectRecord[]
  ) => {
    selection.value = rows as NonNullable<ProcessRoute['material']>[]
    const material = selection.value[0]
    if (material?.productionUnitId && !form.productionUnitId)
      form.productionUnitId = material.productionUnitId
  }

  async function handleOpen(row?: ProcessRoute, tenantId?: string, copy = false) {
    Object.assign(form, row ? cloneDeep(row) : initialForm())
    form.tenantId = row?.tenantId || tenantId || user.info.tenantId || ''
    if (copy) Object.assign(form, { code: '', name: `${row?.name || ''} - 副本`, isDefault: false })
    selection.value = row?.material ? [row.material] : []
    await Promise.all(
      [
        'mdmProcessRouteType',
        'mdmProcessRouteAllocationMode',
        'mdmProcessRouteSource',
        'commonBoolean'
      ].map((code) => user.ensureDictLoaded(code))
    )
    await dialogRef.value?.handleOpen(undefined, {
      title: copy ? '复制工艺路线' : row ? '编辑工艺路线' : '新增工艺路线',
      subtitle: row ? `${row.code} · ${row.name}` : '定义产品版本、批量范围与生效规则',
      confirmText: copy || !row ? '创建路线' : '保存更改',
      contentMaxHeight: '72vh',
      loading: true,
      onOpen: async (_data, api) => {
        try {
          references.value = await fetchProcessRouteReferences(tenantId || row?.tenantId)
          formRef.value?.clearValidate()
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: async () => {
        try {
          await formRef.value?.validate()
          await saveProcessRoute(
            {
              ...form,
              code: form.code.trim().toUpperCase(),
              name: form.name.trim(),
              version: form.version.trim(),
              path: form.path.trim(),
              remark: form.remark.trim()
            },
            copy ? undefined : row?.id
          )
          emit('success')
          return true
        } catch {
          return false
        }
      }
    })
  }
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .process-route-dialog {
    display: grid;
    gap: var(--art-space-4);

    &__form-panel {
      min-width: 0;
      padding-bottom: var(--art-space-2);
      background: color-mix(
        in srgb,
        var(--el-fill-color-extra-light) 45%,
        var(--default-box-color)
      );
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--art-control-radius);
    }

    @media (width <= 720px) {
      gap: var(--art-space-3);

      &__form-panel {
        padding-bottom: var(--art-space-1);
      }
    }
  }
</style>
