<template>
  <ArtDialog ref="dialogRef" size="xl">
    <div class="bom-dialog">
      <ArtEntitySummary
        icon="ri:git-merge-line"
        eyebrow="BILL OF MATERIALS"
        :title="formatBomMaterialDescription(selectedParent[0]) || '选择父项物料建立 BOM'"
        :description="[form.bomCode || '待定义编码', form.version].filter(Boolean).join(' · ')"
      >
        <template #aside>
          <ArtDictDisplay dict-code="mdmBomStatus" :value="form.status" display="tag" />
        </template>
      </ArtEntitySummary>

      <ArtForm
        ref="formRef"
        v-model="form"
        :items="formItems"
        :rules="rules"
        :span="8"
        :gutter="18"
        label-position="top"
        :show-reset="false"
        :show-submit="false"
        root-class="bom-dialog__form"
      >
        <template #materialId>
          <ArtTableSingleSelect
            v-model="form.materialId"
            :selected-data="selectedParent"
            :api-fn="fetchMaterials"
            :columns="materialColumns"
            :label-key="(row) => formatBomMaterialDescription(row as MaterialArchive)"
            description-key="materialCode"
            title="选择 BOM 父项物料"
            subtitle="父项物料决定 BOM 的基本计量口径"
            show-pagination
            @change="handleParentChange"
          />
        </template>
      </ArtForm>

      <section class="bom-dialog__components">
        <header>
          <div><strong>组件明细</strong><small>按装配顺序维护用量、损耗率和工序位置</small></div>
          <div class="bom-dialog__component-actions">
            <ArtTableMultipleSelect
              v-model="selectedComponentIds"
              :selected-data="selectedComponents"
              :api-fn="fetchMaterials"
              :columns="materialColumns"
              :label-key="(row) => formatBomMaterialDescription(row as MaterialArchive)"
              description-key="materialCode"
              title="批量添加组件物料"
              subtitle="父项物料不可作为自身组件；已存在组件不会重复加入"
              show-pagination
              :show-selected-panel="true"
              :disabled-key="isComponentMaterialDisabled"
              @confirm="handleComponentsConfirm"
            >
              <template #trigger="{ open }">
                <ElButton type="primary" plain @click="open"
                  ><ArtSvgIcon icon="ri:add-line" />添加组件</ElButton
                >
              </template>
            </ArtTableMultipleSelect>
          </div>
        </header>
        <ArtTable
          ref="componentTableRef"
          class="bom-dialog__component-table"
          :data="form.items"
          :columns="componentColumns"
          row-key="componentMaterialId"
          :pagination="false"
          table-layout="fixed"
          max-height="360"
          empty-text="暂无 BOM 组件"
          empty-description="点击“添加组件”建立父项与子项的装配关系。"
        />
        <footer
          ><span>共 {{ form.items.length }} 项组件</span
          ><span>有效用量已包含损耗率口径</span></footer
        >
      </section>
    </div>
  </ArtDialog>
</template>

<script setup lang="tsx">
  import { cloneDeep } from 'lodash-es'
  import dayjs from 'dayjs'
  import {
    ElDatePicker,
    ElInput,
    ElInputNumber,
    ElMessage,
    ElOption,
    ElSelect,
    ElSwitch,
    type FormRules
  } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtTableSingleSelect from '@/components/core/forms/art-data-select/table-single.vue'
  import ArtTableMultipleSelect from '@/components/core/forms/art-data-select/table-multiple.vue'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import type { ArtTableExpose } from '@/components/core/tables/art-table/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import type { ColumnOption } from '@/types'
  import type {
    DataSelectFetchParams,
    DataSelectRecord
  } from '@/components/core/forms/art-data-select/types'
  import {
    fetchMaterialArchives,
    saveBom,
    type BomGroup,
    type BomInput,
    type BomRecord,
    type MaterialArchive,
    type UnitOfMeasure
  } from '@mdm/api'
  import { formatBomMaterialDescription } from '../../modules/material-description'
  import {
    mergeBomComponentSelection,
    removeBomComponentSelection
  } from './bom-component-selection'

  export interface BomDialogOpenData {
    row?: BomRecord
    copy?: boolean
    tenantId: string
    tenantOptions: Array<{ label: string; value: string }>
    units: UnitOfMeasure[]
    groups: BomGroup[]
  }
  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }
  type BomComponentInput = BomInput['items'][number]

  const emit = defineEmits<{ success: [] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const dialogRef = ref<ArtDialogExpose<BomDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const componentTableRef = ref<ArtTableExpose>()
  const tenantOptions = ref<Array<{ label: string; value: string }>>([])
  const units = ref<UnitOfMeasure[]>([])
  const groups = ref<BomGroup[]>([])
  const selectedParent = ref<MaterialArchive[]>([])
  const selectedComponents = ref<MaterialArchive[]>([])
  const selectedComponentIds = ref<Array<string | number>>([])
  const initialForm = (): BomInput & { status: BomRecord['status'] } => ({
    id: undefined,
    tenantId: '',
    bomCode: '',
    materialId: '',
    version: '',
    purpose: 'production',
    status: 'design',
    baseQuantity: 1,
    baseUnitId: '',
    groupId: null,
    effectiveFrom: dayjs().format('YYYY-MM-DD'),
    effectiveTo: '9999-12-31',
    description: '',
    sort: 10,
    items: []
  })
  const form = reactive(initialForm())
  const tenantId = computed(() => form.tenantId)
  const scopedUnits = computed(() => units.value.filter((unit) => unit.tenantId === form.tenantId))
  const inheritedParentUnitId = computed(() => {
    const parent = selectedParent.value[0]
    return parent?.productionUnitId || parent?.baseUnitId || ''
  })
  const materialColumns = [
    { prop: 'materialCode', label: '物料编码', minWidth: 150 },
    { prop: 'materialName', label: '物料名称', minWidth: 180 },
    { prop: 'specificationModel', label: '规格型号', minWidth: 150 },
    { prop: 'drawingNo', label: '图号', minWidth: 130 }
  ]
  const formItems = computed<FormItem[]>(() => [
    {
      key: 'tenantId',
      label: '目标租户',
      type: 'select',
      options: tenantOptions.value,
      props: {
        disabled: Boolean(form.id),
        filterable: true,
        placeholder: '请选择本次维护的数据归属租户'
      }
    },
    { key: 'identity', label: 'BOM 身份', type: 'divider', span: 24 },
    { key: 'materialId', label: '父项物料', type: 'slot', span: 16 },
    {
      key: 'bomCode',
      label: 'BOM 编码',
      type: 'input',
      props: { disabled: true, placeholder: '保存后按月度 3 位流水规则自动生成' }
    },
    {
      key: 'version',
      label: '版本',
      type: 'input',
      props: { maxlength: 30, placeholder: '例如 V1.0' }
    },
    {
      key: 'groupId',
      label: 'BOM 分组',
      type: 'select',
      options: groups.value.map((group) => ({ label: group.name, value: group.id })),
      props: { clearable: true, placeholder: '请选择 BOM 分组' }
    },
    {
      key: 'purpose',
      label: 'BOM 用途',
      type: 'select',
      options: getDictMap.value.mdmBomPurpose ?? []
    },
    {
      key: 'sort',
      label: '显示顺序',
      type: 'number',
      props: { min: 0, max: 999999, precision: 0, class: '!w-full' }
    },
    { key: 'validity', label: '数量与有效期', type: 'divider', span: 24 },
    {
      key: 'baseQuantity',
      label: '基准数量',
      type: 'number',
      props: { min: 1, precision: 0, class: '!w-full' }
    },
    {
      key: 'baseUnitId',
      label: '生产单位',
      type: 'select',
      options: scopedUnits.value.map((unit) => ({
        label: `${unit.unitName} · ${unit.unitCode}`,
        value: unit.id
      })),
      props: {
        disabled: Boolean(inheritedParentUnitId.value),
        clearable: !inheritedParentUnitId.value,
        placeholder: inheritedParentUnitId.value
          ? '已由父项物料自动带入'
          : form.materialId
            ? '父项未维护单位，请在此补充'
            : '请先选择父项物料'
      }
    },
    {
      key: 'effectiveFrom',
      label: '生效日期',
      type: 'date',
      props: { valueFormat: 'YYYY-MM-DD', class: '!w-full' }
    },
    {
      key: 'effectiveTo',
      label: '失效日期',
      type: 'date',
      props: { valueFormat: 'YYYY-MM-DD', class: '!w-full' }
    },
    {
      key: 'description',
      label: '版本说明',
      type: 'input',
      span: 16,
      props: { type: 'textarea', rows: 2, maxlength: 500, showWordLimit: true, resize: 'none' }
    }
  ])
  const rules: FormRules<Record<string, unknown>> = {
    tenantId: [{ required: true, message: '请选择目标租户', trigger: 'change' }],
    materialId: [{ required: true, message: '请选择父项物料', trigger: 'change' }],
    baseUnitId: [
      {
        required: true,
        message: '请选择生产单位；父项物料未维护单位时可在此补充',
        trigger: 'change'
      }
    ]
  }
  void Promise.all([
    userStore.ensureDictLoaded('mdmBomPurpose'),
    userStore.ensureDictLoaded('mdmBomStatus'),
    userStore.ensureDictLoaded('mdmMaterialSource'),
    userStore.ensureDictLoaded('mdmMaterialIssueMethod'),
    userStore.ensureDictLoaded('mdmMaterialBackflushMethod'),
    userStore.ensureDictLoaded('mdmMaterialOverIssueControl')
  ])
  const fetchMaterials = (params: DataSelectFetchParams) =>
    fetchMaterialArchives({
      current: params.page,
      size: params.pageSize,
      tenantId: tenantId.value,
      keyword: params.keyword,
      status: 'enabled'
    })
  const materialById = (id: string) =>
    [...selectedParent.value, ...selectedComponents.value].find((item) => item.id === id)
  const componentRowLabel = (row: BomComponentInput, rowIndex: number): string => {
    const materialName = formatBomMaterialDescription(materialById(row.componentMaterialId))
    return `第 ${rowIndex + 1} 行${materialName ? `“${materialName}”` : '组件'}`
  }
  const componentColumns = computed<ColumnOption<BomComponentInput>[]>(() => [
    { type: 'index', label: '#', width: 48, align: 'center' },
    {
      prop: 'componentMaterialId',
      label: '组件物料',
      width: 260,
      formatter: (row) => {
        const material = materialById(row.componentMaterialId)
        const materialName = formatBomMaterialDescription(material) || '未识别物料'
        const materialDetail =
          [material?.materialCode, material?.specificationModel].filter(Boolean).join(' · ') || '—'
        return (
          <div class="bom-dialog__material-cell">
            <span class="bom-dialog__material-icon" aria-hidden="true">
              <ArtSvgIcon icon="ri:box-3-line" />
            </span>
            <div class="bom-dialog__material-copy">
              <strong title={materialName}>{materialName}</strong>
              <small title={materialDetail}>{materialDetail}</small>
            </div>
          </div>
        )
      }
    },
    {
      prop: 'sequenceNo',
      label: '行号',
      width: 84,
      align: 'center',
      formatter: (row) => (
        <ElInputNumber
          v-model={row.sequenceNo}
          min={1}
          max={999999}
          controls={false}
          aria-label="组件顺序"
          class="bom-dialog__number-input"
        />
      )
    },
    {
      prop: 'mrpEnabled',
      label: 'MRP 运算',
      width: 94,
      align: 'center',
      formatter: (row) => <ElSwitch v-model={row.mrpEnabled} aria-label="MRP 运算" />
    },
    {
      prop: 'materialCode',
      label: '物料编码',
      width: 150,
      formatter: (row) => materialById(row.componentMaterialId)?.materialCode || '—'
    },
    {
      prop: 'specificationModel',
      label: '规格型号',
      width: 140,
      formatter: (row) => materialById(row.componentMaterialId)?.specificationModel || '—'
    },
    {
      prop: 'materialSource',
      label: '物料来源',
      width: 110,
      formatter: (row) => (
        <ArtDictDisplay
          dictCode="mdmMaterialSource"
          value={materialById(row.componentMaterialId)?.materialSource || ''}
        />
      )
    },
    {
      prop: 'quantity',
      label: '用量',
      required: true,
      requiredMessage: ({ row, rowIndex }) => `${componentRowLabel(row, rowIndex)}的用量不能为空`,
      rules: {
        validator: ({ value }) => Number.isFinite(Number(value)) && Number(value) > 0,
        message: ({ row, rowIndex }) => `${componentRowLabel(row, rowIndex)}的用量必须大于 0`
      },
      width: 118,
      align: 'center',
      formatter: (row) => (
        <ElInputNumber
          v-model={row.quantity}
          min={0.00000001}
          precision={6}
          controlsPosition="right"
          aria-label="组件用量"
          class="bom-dialog__number-input"
        />
      )
    },
    {
      prop: 'unitId',
      label: '计量单位',
      required: true,
      requiredMessage: ({ row, rowIndex }) => `${componentRowLabel(row, rowIndex)}未选择单位`,
      width: 110,
      formatter: (row) => (
        <ElSelect v-model={row.unitId} filterable clearable aria-label="组件单位" class="w-full!">
          {scopedUnits.value.map((unit) => (
            <ElOption key={unit.id} label={unit.unitName} value={unit.id} />
          ))}
        </ElSelect>
      )
    },
    {
      prop: 'defaultIssueWarehouseId',
      label: '默认发料仓库',
      width: 150,
      formatter: (row) =>
        materialById(row.componentMaterialId)?.defaultWarehouse?.warehouseName || '—'
    },
    {
      prop: 'issueMethod',
      label: '领送料方式',
      width: 140,
      formatter: (row) => (
        <ElSelect v-model={row.issueMethod}>
          {(getDictMap.value.mdmMaterialIssueMethod ?? []).map((item) => (
            <ElOption key={item.value} label={item.label} value={item.value} />
          ))}
        </ElSelect>
      )
    },
    {
      prop: 'backflushMethod',
      label: '倒冲',
      width: 120,
      formatter: (row) => (
        <ElSelect v-model={row.backflushMethod}>
          {(getDictMap.value.mdmMaterialBackflushMethod ?? []).map((item) => (
            <ElOption key={item.value} label={item.label} value={item.value} />
          ))}
        </ElSelect>
      )
    },
    {
      prop: 'overIssueControlMethod',
      label: '超发控制方式',
      width: 160,
      formatter: (row) => (
        <ElSelect v-model={row.overIssueControlMethod} clearable>
          {(getDictMap.value.mdmMaterialOverIssueControl ?? []).map((item) => (
            <ElOption key={item.value} label={item.label} value={item.value} />
          ))}
        </ElSelect>
      )
    },
    {
      prop: 'effectiveFrom',
      label: '生效日期',
      width: 140,
      formatter: (row) => <ElDatePicker v-model={row.effectiveFrom} value-format="YYYY-MM-DD" />
    },
    {
      prop: 'effectiveTo',
      label: '失效日期',
      width: 140,
      formatter: (row) => <ElDatePicker v-model={row.effectiveTo} value-format="YYYY-MM-DD" />
    },
    {
      prop: 'projectText',
      label: '项目文本',
      width: 180,
      formatter: (row) => (
        <ElInput v-model={row.projectText} maxlength={200} placeholder="填写项目文本" />
      )
    },
    {
      prop: 'scrapRate',
      label: '损耗率 %',
      width: 112,
      align: 'center',
      formatter: (row) => (
        <ElInputNumber
          v-model={row.scrapRate}
          min={0}
          max={100}
          precision={2}
          controls={false}
          aria-label="组件损耗率"
          class="bom-dialog__number-input"
        />
      )
    },
    {
      prop: 'operationName',
      label: '工序',
      formatter: (row) => (
        <ElInput
          v-model={row.operationName}
          clearable
          maxlength={120}
          placeholder="填写工序"
          aria-label="组件工序"
        />
      )
    },
    {
      prop: 'positionNo',
      label: '位号',
      formatter: (row) => (
        <ElInput
          v-model={row.positionNo}
          clearable
          maxlength={60}
          placeholder="填写位号"
          aria-label="组件位号"
        />
      )
    },
    {
      prop: 'operation',
      label: '操作',
      width: 64,
      fixed: 'right',
      align: 'center',
      formatter: (row) => (
        <ArtIconButton
          icon="ri:delete-bin-line"
          label="移除组件"
          tone="danger"
          onClick={() => handleRemoveComponent(row)}
        />
      )
    }
  ])
  const handleParentChange = (_value: unknown, rows: DataSelectRecord[]) => {
    const row = rows[0] as MaterialArchive | undefined
    selectedParent.value = row ? [row] : []
    form.baseUnitId = row?.productionUnitId || row?.baseUnitId || ''
    if (row && !form.baseUnitId) {
      ElMessage.warning('该父项物料未维护生产单位，请在“生产单位”字段补充后保存')
    }
    if (!row || !form.items.some((item) => item.componentMaterialId === row.id)) return
    handleRemoveComponentById(row.id)
    ElMessage.info('父项物料不能同时作为组件，已从组件明细中移除')
  }
  const isComponentMaterialDisabled = (row: DataSelectRecord) => row.id === form.materialId
  const syncComponentSelection = (materials: MaterialArchive[]) => {
    selectedComponents.value = materials
    selectedComponentIds.value = materials.map((item) => item.id)
  }
  const handleRemoveComponentById = (componentMaterialId: string) => {
    const result = removeBomComponentSelection(
      form.items,
      selectedComponents.value,
      componentMaterialId
    )
    form.items = result.items
    syncComponentSelection(result.materials)
  }
  const handleRemoveComponent = (row: BomComponentInput) =>
    handleRemoveComponentById(row.componentMaterialId)
  const handleComponentsConfirm = (_value: unknown, rows: DataSelectRecord[]) => {
    const result = mergeBomComponentSelection(
      form.items,
      selectedComponents.value,
      rows as MaterialArchive[],
      form.materialId,
      dayjs().format('YYYY-MM-DD')
    )
    form.items = result.items
    syncComponentSelection(result.materials)
  }
  const validateComponents = async (): Promise<boolean> => {
    if (!form.items.length) {
      ElMessage.warning('请至少添加一项 BOM 组件')
      return false
    }
    const result = await componentTableRef.value?.validate()
    if (result?.valid !== false) return true
    ElMessage.warning(
      `${result.firstError?.message || '组件明细填写不完整'}，请完善红色标记项后再保存`
    )
    return false
  }
  const handleSubmit = async (): Promise<boolean> => {
    try {
      await formRef.value?.validate()
    } catch {
      ElMessage.warning('请先完善 BOM 基本信息中的必填项')
      dialogRef.value?.scrollTo({ top: 0 })
      return false
    }

    if (!(await validateComponents())) return false

    try {
      await saveBom(form)
      emit('success')
      return true
    } catch {
      return false
    }
  }
  const handleOpen = async (data: BomDialogOpenData): Promise<void> => {
    Object.assign(form, initialForm())
    tenantOptions.value = data.tenantOptions
    units.value = data.units
    groups.value = data.groups
    selectedParent.value = data.row?.material ? [data.row.material as MaterialArchive] : []
    selectedComponents.value = (data.row?.items.map((item) => item.component).filter(Boolean) ||
      []) as MaterialArchive[]
    selectedComponentIds.value = selectedComponents.value.map((item) => item.id)
    if (data.row) Object.assign(form, cloneDeep(data.row))
    form.tenantId = data.row?.tenantId || data.tenantId
    form.effectiveFrom ||= dayjs().format('YYYY-MM-DD')
    form.effectiveTo ||= '9999-12-31'
    form.items.forEach((item) => {
      item.effectiveFrom ||= form.effectiveFrom
      item.effectiveTo ||= form.effectiveTo
    })
    if (data.copy) {
      form.id = undefined
      form.bomCode = ''
      form.version = ''
      form.status = 'design'
    }
    await dialogRef.value?.handleOpen(data, {
      title: data.copy ? '复制 BOM' : data.row ? '编辑 BOM' : '新增 BOM',
      subtitle: '版本化维护父项与组件的工程关系',
      confirmText: '保存 BOM',
      contentMaxHeight: '76vh',
      onConfirm: handleSubmit,
      onOpen: () => {
        formRef.value?.clearValidate()
        componentTableRef.value?.clearValidate()
      }
    })
  }
  watch(
    () => form.tenantId,
    (value, previous) => {
      if (value === previous || !previous) return
      form.materialId = ''
      form.baseUnitId = ''
      form.items = []
      selectedParent.value = []
      selectedComponents.value = []
      selectedComponentIds.value = []
    }
  )
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .bom-dialog {
    display: grid;
    gap: 12px;
  }

  :deep(.bom-dialog__form) {
    padding-top: 0;
  }

  .bom-dialog__components {
    overflow: hidden;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--el-border-radius-base);
  }

  .bom-dialog__components > header,
  .bom-dialog__components > footer {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    padding: 11px 14px;
    background: var(--el-fill-color-lighter);
  }

  .bom-dialog__components > footer {
    position: sticky;
    bottom: 0;
    z-index: 4;
    border-top: 1px solid var(--el-border-color-lighter);
  }

  .bom-dialog__components header strong,
  .bom-dialog__components header small {
    display: block;
  }

  .bom-dialog__components header small,
  .bom-dialog__components footer {
    margin-top: 2px;
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }

  .bom-dialog__component-actions {
    min-width: 112px;
  }

  :deep(.bom-dialog__material-cell) {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    min-width: 0;
  }

  :deep(.bom-dialog__material-icon) {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    color: var(--theme-color);
    background: color-mix(in srgb, var(--theme-color) 8%, var(--el-bg-color));
    border: 1px solid color-mix(in srgb, var(--theme-color) 12%, transparent);
    border-radius: 9px;
  }

  :deep(.bom-dialog__material-copy) {
    min-width: 0;
  }

  :deep(.bom-dialog__material-copy strong),
  :deep(.bom-dialog__material-copy small) {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :deep(.bom-dialog__material-copy strong) {
    line-height: 20px;
    color: var(--el-text-color-primary);
  }

  :deep(.bom-dialog__material-copy small) {
    margin-top: 2px;
    font-family: var(--art-font-family-mono, Consolas, monospace);
    font-size: 11px;
    line-height: 16px;
    color: var(--el-text-color-secondary);
  }

  :deep(.art-table__cell-value),
  :deep(.art-table__cell-content),
  :deep(.el-input-number),
  :deep(.el-select) {
    width: 100%;
  }

  :deep(.bom-dialog__number-input .el-input__inner) {
    font-variant-numeric: tabular-nums;
    text-align: center;
  }

  .bom-dialog__component-table {
    width: 100%;
    min-width: 0;
  }

  @media (width <= 820px) {
    .bom-dialog__components > header {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
