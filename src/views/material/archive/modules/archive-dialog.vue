<template>
  <ArtDialog ref="dialogRef" size="xl">
    <div class="material-archive-dialog">
      <ElTabs v-model="activeTab" class="material-archive-dialog__tabs">
        <ElTabPane v-for="tab in tabs" :key="tab.name" :name="tab.name">
          <template #label
            ><span class="material-archive-dialog__tab-label"
              ><ArtSvgIcon :icon="tab.icon" />{{ tab.label
              }}<i v-if="isTabConfigured(tab.name)" aria-label="已配置"></i></span
          ></template>
        </ElTabPane>
      </ElTabs>

      <section class="material-archive-dialog__panel">
        <header class="material-archive-dialog__section-heading">
          <div>
            <strong>{{ activeTabMeta.title }}</strong>
            <p>{{ activeTabMeta.description }}</p>
          </div>
          <div class="material-archive-dialog__completion">
            <span>资料完整度</span><strong>{{ completion }}%</strong>
          </div>
        </header>
        <div class="material-archive-dialog__notice">
          <span><ArtSvgIcon :icon="activeTabMeta.icon" /></span>
          <p>{{ activeTabMeta.notice }}</p>
        </div>

        <ArtForm
          ref="formRef"
          v-model="formModel"
          :items="formItems"
          :rules="formRules"
          :span="12"
          :gutter="24"
          label-position="top"
          :show-reset="false"
          :show-submit="false"
          root-class="material-archive-dialog__form"
        >
          <template #materialCode>
            <ElInput
              v-model="formModel.materialCode"
              maxlength="60"
              placeholder="输入或按规则生成物料编码"
            >
              <template #prefix><ArtSvgIcon icon="ri:barcode-line" /></template>
            </ElInput>
          </template>
          <template #codeRuleId>
            <div class="material-archive-dialog__rule-field">
              <ElSelect
                v-model="formModel.codeRuleId"
                clearable
                filterable
                placeholder="选择编码规则"
              >
                <ElOption
                  v-for="item in scopedCodeRules"
                  :key="item.id"
                  :label="item.ruleName"
                  :value="item.id"
                />
              </ElSelect>
              <ElButton
                v-auth="'MdmMaterialArchive:GenerateCode'"
                type="primary"
                plain
                :loading="generating"
                :disabled="!formModel.codeRuleId"
                @click="handleGenerateCode"
                ><ArtSvgIcon icon="ri:magic-line" />生成编码</ElButton
              >
            </div>
          </template>
          <template #purchaser
            ><ArtEmployeeSelect
              :model-value="formModel.purchaserId ?? undefined"
              :tenant-id="tenantId"
              placeholder="选择采购员"
              @update:model-value="formModel.purchaserId = $event ?? null"
          /></template>
          <template #planner
            ><ArtEmployeeSelect
              :model-value="formModel.plannerId ?? undefined"
              :tenant-id="tenantId"
              placeholder="选择计划员"
              @update:model-value="formModel.plannerId = $event ?? null"
          /></template>
          <template #salesperson
            ><ArtEmployeeSelect
              :model-value="formModel.salespersonId ?? undefined"
              :tenant-id="tenantId"
              placeholder="选择销售员"
              @update:model-value="formModel.salespersonId = $event ?? null"
          /></template>
          <template #custodian
            ><ArtEmployeeSelect
              :model-value="formModel.custodianId ?? undefined"
              :tenant-id="tenantId"
              placeholder="选择保管员"
              @update:model-value="formModel.custodianId = $event ?? null"
          /></template>
          <template #dispatcher
            ><ArtEmployeeSelect
              :model-value="formModel.dispatcherId ?? undefined"
              :tenant-id="tenantId"
              placeholder="选择调度员"
              @update:model-value="formModel.dispatcherId = $event ?? null"
          /></template>
          <template #unitConversions>
            <div class="conversion-builder">
              <div
                v-for="(conversion, index) in formModel.unitConversions"
                :key="`${conversion.sourceUnitId}-${index}`"
                class="conversion-builder__row"
              >
                <ElSelect v-model="conversion.sourceUnitId" filterable placeholder="选择来源单位">
                  <ElOption
                    v-for="unit in units"
                    :key="unit.id"
                    :label="`${unit.unitName} · ${unit.unitCode}`"
                    :value="unit.id"
                  />
                </ElSelect>
                <ElInputNumber
                  v-model="conversion.sourceFactor"
                  :min="0.00000001"
                  :precision="8"
                  controls-position="right"
                />
                <span class="conversion-builder__equals">=</span>
                <ElInputNumber
                  v-model="conversion.baseFactor"
                  :min="0.00000001"
                  :precision="8"
                  controls-position="right"
                />
                <span class="conversion-builder__base">{{
                  selectedBaseUnit?.unitName || '基本单位'
                }}</span>
                <ElInput v-model="conversion.remark" maxlength="120" placeholder="换算说明" />
                <ArtIconButton
                  icon="ri:delete-bin-line"
                  label="删除换算"
                  @click="formModel.unitConversions.splice(Number(index), 1)"
                />
              </div>
              <ElButton plain @click="addConversion"
                ><ArtSvgIcon icon="ri:add-line" />添加单位换算</ElButton
              >
            </div>
          </template>
        </ArtForm>
      </section>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import type { FormRules } from 'element-plus'
  import { cloneDeep, omit } from 'lodash-es'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtEmployeeSelect from '@/components/business/art-employee-select/index.vue'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    generateMaterialCode,
    saveMaterialArchive,
    type MaterialArchive,
    type MaterialArchiveInput,
    type MaterialAttributeGroup,
    type MaterialCategory,
    type MaterialCodeRule,
    type MaterialContextOption,
    type MaterialType,
    type UnitOfMeasure
  } from '@mdm/api'

  type ArchiveTab =
    'base' | 'purchase' | 'sales' | 'inventory' | 'production' | 'finance' | 'conversion'
  interface ArchiveFormModel extends MaterialArchiveInput {
    id?: string
    codeRuleId?: string
  }
  export interface ArchiveDialogOpenData {
    row?: MaterialArchive
    copy?: boolean
    tenantId: string
    tenantOptions: Array<{ label: string; value: string }>
    categories: MaterialCategory[]
    materialTypes: MaterialType[]
    units: UnitOfMeasure[]
    attributeGroups: MaterialAttributeGroup[]
    codeRules: MaterialCodeRule[]
    storageOptions: MaterialContextOption[]
  }
  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const dialogRef = ref<ArtDialogExpose<ArchiveDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const activeTab = ref<ArchiveTab>('base')
  const tenantOptions = ref<Array<{ label: string; value: string }>>([])
  const categories = ref<MaterialCategory[]>([])
  const materialTypes = ref<MaterialType[]>([])
  const units = ref<UnitOfMeasure[]>([])
  const attributeGroups = ref<MaterialAttributeGroup[]>([])
  const codeRules = ref<MaterialCodeRule[]>([])
  const storageOptions = ref<MaterialContextOption[]>([])
  const generating = ref(false)
  const tabs = [
    { name: 'base', label: '基本信息', icon: 'ri:information-line' },
    { name: 'purchase', label: '采购', icon: 'ri:shopping-bag-3-line' },
    { name: 'sales', label: '销售', icon: 'ri:shopping-cart-line' },
    { name: 'inventory', label: '库存', icon: 'ri:stack-line' },
    { name: 'production', label: '生产', icon: 'ri:settings-5-line' },
    { name: 'finance', label: '财务', icon: 'ri:bank-card-line' },
    { name: 'conversion', label: '单位换算', icon: 'ri:exchange-2-line' }
  ] as const
  const tabMeta: Record<
    ArchiveTab,
    { title: string; description: string; notice: string; icon: string }
  > = {
    base: {
      title: '统一物料身份',
      description: '编码、分类、类型与计量单位构成跨业务系统共享的主身份。',
      notice: '优先完成带星号的核心字段；选择属性组后会自动出现该类物料的扩展属性。',
      icon: 'ri:fingerprint-line'
    },
    purchase: {
      title: '采购默认视图',
      description: '定义采购单位、责任人和补货批量边界。',
      notice: '采购单位默认继承基本单位，可按实际采购包装和补货策略调整。',
      icon: 'ri:shopping-bag-3-line'
    },
    sales: {
      title: '销售默认视图',
      description: '维护销售计量口径、责任人和归属组织。',
      notice: '销售视图只维护业务默认值，不改变物料的统一基本计量口径。',
      icon: 'ri:shopping-cart-line'
    },
    inventory: {
      title: '库存默认视图',
      description: '统一库存单位、默认库位与保管责任。',
      notice: '默认库位来自仓储主数据，后续业务单据可根据仓库规则覆盖。',
      icon: 'ri:stack-line'
    },
    production: {
      title: '生产与计划视图',
      description: '约束生产计量、MRP 策略和调度责任。',
      notice: '生产单位和 MRP 类型将作为计划运算与工单创建的默认参数。',
      icon: 'ri:settings-5-line'
    },
    finance: {
      title: '财务计价视图',
      description: '明确成本单位、存货计价方法与核算币种。',
      notice: '计价方法影响存货成本核算，物料发生业务后应通过受控变更调整。',
      icon: 'ri:bank-card-line'
    },
    conversion: {
      title: '计量单位换算',
      description: '维护业务单位到基本单位的精确换算关系。',
      notice: '每条换算都应以当前基本单位为目标，系统会在保存时校验重复和精度。',
      icon: 'ri:exchange-2-line'
    }
  }
  const initialForm = (): ArchiveFormModel => ({
    id: undefined,
    tenantId: '',
    codeRuleId: undefined,
    categoryId: '',
    materialCode: '',
    materialName: '',
    specificationModel: '',
    drawingNo: '',
    basicUnit: '',
    materialType: '',
    materialSource: 'purchase',
    materialTypeId: null,
    baseUnitId: null,
    auxiliaryUnitId: null,
    auxiliaryUnit2Id: null,
    attributeGroupId: null,
    attributeValues: {},
    brand: '',
    manufacturer: '',
    materialComposition: '',
    placeOfOrigin: '',
    color: '',
    imageUrls: [],
    description: '',
    purchaseUnitId: null,
    purchaserId: null,
    plannerId: null,
    batchPolicy: '',
    minBatch: null,
    maxBatch: null,
    salesUnitId: null,
    salespersonId: null,
    salesOrganization: '',
    inventoryUnitId: null,
    storageLocationId: null,
    custodianId: null,
    productionUnitId: null,
    mrpType: '',
    dispatcherId: null,
    costUnitId: null,
    valuationMethod: 'moving_average',
    currencyCode: 'CNY',
    unitConversions: [],
    status: 'enabled',
    sort: 10,
    remark: ''
  })
  const formModel = reactive<ArchiveFormModel>(initialForm())
  const tenantId = computed(() => formModel.tenantId)
  const scopedCategories = computed(() =>
    categories.value.filter((item) => item.tenantId === formModel.tenantId)
  )
  const scopedMaterialTypes = computed(() =>
    materialTypes.value.filter((item) => item.tenantId === formModel.tenantId)
  )
  const scopedUnits = computed(() =>
    units.value.filter((item) => item.tenantId === formModel.tenantId)
  )
  const scopedAttributeGroups = computed(() =>
    attributeGroups.value.filter((item) => item.tenantId === formModel.tenantId)
  )
  const scopedCodeRules = computed(() =>
    codeRules.value.filter((item) => item.tenantId === formModel.tenantId)
  )
  const scopedStorageOptions = computed(() =>
    storageOptions.value.filter((item) => item.tenantId === formModel.tenantId)
  )
  function option<T extends { id: string }>(items: T[], label: (item: T) => string) {
    return items.map((item) => ({ label: label(item), value: item.id }))
  }
  const unitOptions = computed(() =>
    option(scopedUnits.value, (item: UnitOfMeasure) => `${item.unitName} · ${item.unitCode}`)
  )
  const categoryOptions = computed(() =>
    option(
      scopedCategories.value,
      (item: MaterialCategory) => `${item.categoryName} · ${item.categoryCode}`
    )
  )
  const typeOptions = computed(() =>
    option(scopedMaterialTypes.value, (item: MaterialType) => `${item.typeName} · ${item.typeCode}`)
  )
  const groupOptions = computed(() =>
    option(
      scopedAttributeGroups.value,
      (item: MaterialAttributeGroup) => `${item.groupName} · ${item.groupCode}`
    )
  )
  const selectedBaseUnit = computed(() =>
    scopedUnits.value.find((item) => item.id === formModel.baseUnitId)
  )
  const activeTabMeta = computed(() => tabMeta[activeTab.value])
  const completion = computed(() => {
    const values = [
      formModel.materialCode,
      formModel.materialName,
      formModel.categoryId,
      formModel.materialTypeId,
      formModel.baseUnitId,
      formModel.specificationModel,
      formModel.attributeGroupId,
      formModel.description,
      formModel.purchaseUnitId,
      formModel.inventoryUnitId,
      formModel.productionUnitId,
      formModel.costUnitId
    ]
    return Math.round((values.filter(Boolean).length / values.length) * 100)
  })
  const selectedAttributeGroup = computed(() =>
    scopedAttributeGroups.value.find((item) => item.id === formModel.attributeGroupId)
  )
  const isTabConfigured = (tab: ArchiveTab): boolean => {
    if (tab === 'base') return Boolean(formModel.materialName && formModel.baseUnitId)
    if (tab === 'purchase') return Boolean(formModel.purchaseUnitId || formModel.purchaserId)
    if (tab === 'sales') return Boolean(formModel.salesUnitId || formModel.salespersonId)
    if (tab === 'inventory')
      return Boolean(formModel.inventoryUnitId || formModel.storageLocationId)
    if (tab === 'production') return Boolean(formModel.productionUnitId || formModel.mrpType)
    if (tab === 'finance') return Boolean(formModel.costUnitId || formModel.valuationMethod)
    return formModel.unitConversions.length > 0
  }
  const commonUnitItem = (label: string, key: keyof ArchiveFormModel): FormItem => ({
    label,
    key: String(key),
    type: 'select',
    options: unitOptions.value,
    props: { clearable: true, filterable: true }
  })
  const formItems = computed<FormItem[]>(() => {
    if (activeTab.value === 'base')
      return [
        {
          label: '目标租户',
          key: 'tenantId',
          type: 'select',
          options: tenantOptions.value,
          props: {
            disabled: Boolean(formModel.id),
            filterable: true,
            placeholder: '请选择本次维护的数据归属租户'
          }
        },
        { key: 'identity', label: '核心身份', type: 'divider', span: 24 },
        { label: '物料编码', key: 'materialCode', type: 'slot' },
        {
          label: '编码策略',
          key: 'codeRuleId',
          type: 'slot',
          help: '选择规则后可生成新编码；也可直接录入符合企业规范的编码。'
        },
        {
          label: '物料名称',
          key: 'materialName',
          type: 'input',
          props: { maxlength: 160, placeholder: '请输入标准物料名称' }
        },
        {
          label: '物料分类',
          key: 'categoryId',
          type: 'select',
          options: categoryOptions.value,
          props: { filterable: true }
        },
        {
          label: '物料类型',
          key: 'materialTypeId',
          type: 'select',
          options: typeOptions.value,
          props: { filterable: true }
        },
        {
          label: '物料来源',
          key: 'materialSource',
          type: 'select',
          options: getDictMap.value.mdmMaterialSource ?? []
        },
        commonUnitItem('基本单位', 'baseUnitId'),
        commonUnitItem('辅助单位一', 'auxiliaryUnitId'),
        commonUnitItem('辅助单位二', 'auxiliaryUnit2Id'),
        { key: 'characteristics', label: '规格与特征', type: 'divider', span: 24 },
        { label: '规格型号', key: 'specificationModel', type: 'input', props: { maxlength: 160 } },
        { label: '图号', key: 'drawingNo', type: 'input', props: { maxlength: 100 } },
        { label: '品牌', key: 'brand', type: 'input', props: { maxlength: 100 } },
        { label: '制造商', key: 'manufacturer', type: 'input', props: { maxlength: 160 } },
        { label: '材质', key: 'materialComposition', type: 'input', props: { maxlength: 160 } },
        { label: '产地', key: 'placeOfOrigin', type: 'input', props: { maxlength: 120 } },
        { label: '颜色', key: 'color', type: 'input', props: { maxlength: 80 } },
        {
          label: '属性组',
          key: 'attributeGroupId',
          type: 'select',
          options: groupOptions.value,
          props: { clearable: true, filterable: true }
        },
        ...(selectedAttributeGroup.value?.attributes
          .filter((attribute) => attribute.enabled)
          .map<FormItem>((attribute) => ({
            label: attribute.name,
            key: `attributeValues.${attribute.key}`,
            type: attribute.values.length ? 'select' : 'input',
            options: attribute.values.map((value) => ({ label: value, value })),
            props: { clearable: !attribute.required, maxlength: 120 },
            help: attribute.required ? '该属性由当前属性组设为必填' : undefined
          })) ?? []),
        { key: 'governance', label: '治理信息', type: 'divider', span: 24 },
        {
          label: '状态',
          key: 'status',
          type: 'select',
          options: getDictMap.value.commonEnabledStatus ?? []
        },
        {
          label: '显示顺序',
          key: 'sort',
          type: 'number',
          props: { min: 0, max: 999999, precision: 0, class: '!w-full' }
        },
        {
          label: '物料说明',
          key: 'description',
          type: 'input',
          span: 24,
          props: { type: 'textarea', rows: 3, maxlength: 1000, showWordLimit: true, resize: 'none' }
        }
      ]
    if (activeTab.value === 'purchase')
      return [
        { key: 'purchaseView', label: '采购执行口径', type: 'divider', span: 24 },
        commonUnitItem('采购单位', 'purchaseUnitId'),
        { label: '采购员', key: 'purchaserId', type: 'slot' },
        { label: '计划员', key: 'plannerId', type: 'slot' },
        { label: '批量策略', key: 'batchPolicy', type: 'input', props: { maxlength: 80 } },
        {
          label: '最小批量',
          key: 'minBatch',
          type: 'number',
          props: { min: 0, precision: 4, class: '!w-full' }
        },
        {
          label: '最大批量',
          key: 'maxBatch',
          type: 'number',
          props: { min: 0, precision: 4, class: '!w-full' }
        }
      ]
    if (activeTab.value === 'sales')
      return [
        { key: 'salesView', label: '销售执行口径', type: 'divider', span: 24 },
        commonUnitItem('销售单位', 'salesUnitId'),
        { label: '销售员', key: 'salespersonId', type: 'slot' },
        { label: '销售组织', key: 'salesOrganization', type: 'input', props: { maxlength: 100 } }
      ]
    if (activeTab.value === 'inventory')
      return [
        { key: 'inventoryView', label: '库存执行口径', type: 'divider', span: 24 },
        commonUnitItem('库存单位', 'inventoryUnitId'),
        {
          label: '默认库位',
          key: 'storageLocationId',
          type: 'select',
          options: scopedStorageOptions.value.map((item) => ({
            label: item.code ? `${item.name} · ${item.code}` : item.name,
            value: item.id
          })),
          props: { clearable: true, filterable: true }
        },
        { label: '保管员', key: 'custodianId', type: 'slot' }
      ]
    if (activeTab.value === 'production')
      return [
        { key: 'productionView', label: '生产计划口径', type: 'divider', span: 24 },
        commonUnitItem('生产单位', 'productionUnitId'),
        {
          label: 'MRP 类型',
          key: 'mrpType',
          type: 'select',
          options: getDictMap.value.mdmMaterialMrpType ?? []
        },
        { label: '调度员', key: 'dispatcherId', type: 'slot' }
      ]
    if (activeTab.value === 'finance')
      return [
        { key: 'financeView', label: '存货核算口径', type: 'divider', span: 24 },
        commonUnitItem('成本单位', 'costUnitId'),
        {
          label: '计价方法',
          key: 'valuationMethod',
          type: 'select',
          options: getDictMap.value.mdmMaterialValuationMethod ?? []
        },
        {
          label: '币种',
          key: 'currencyCode',
          type: 'select',
          options: getDictMap.value.mdmCurrency ?? []
        }
      ]
    return [
      { key: 'conversionView', label: '单位换算关系', type: 'divider', span: 24 },
      { label: '换算关系', key: 'unitConversions', type: 'slot', span: 24 }
    ]
  })
  void Promise.all(
    [
      'mdmMaterialSource',
      'commonEnabledStatus',
      'mdmMaterialMrpType',
      'mdmMaterialValuationMethod',
      'mdmCurrency'
    ].map((code) => userStore.ensureDictLoaded(code))
  )
  const formRules: FormRules<Record<string, unknown>> = {
    tenantId: [{ required: true, message: '请选择目标租户', trigger: 'change' }],
    materialCode: [{ required: true, message: '请输入或生成物料编码', trigger: 'blur' }],
    materialName: [{ required: true, message: '请输入物料名称', trigger: 'blur' }],
    categoryId: [{ required: true, message: '请选择物料分类', trigger: 'change' }],
    materialTypeId: [{ required: true, message: '请选择物料类型', trigger: 'change' }],
    baseUnitId: [{ required: true, message: '请选择基本单位', trigger: 'change' }]
  }
  const addConversion = (): void => {
    formModel.unitConversions.push({ sourceUnitId: '', sourceFactor: 1, baseFactor: 1, remark: '' })
  }
  const handleGenerateCode = async (): Promise<void> => {
    if (!formModel.codeRuleId) return
    generating.value = true
    try {
      formModel.materialCode = await generateMaterialCode({
        ruleId: formModel.codeRuleId,
        materialTypeId: formModel.materialTypeId || undefined,
        categoryId: formModel.categoryId || undefined
      })
    } finally {
      generating.value = false
    }
  }
  const handleSubmit = async (): Promise<boolean> => {
    try {
      activeTab.value = 'base'
      await nextTick()
      await formRef.value?.validate()
      const type = materialTypes.value.find((item) => item.id === formModel.materialTypeId)
      const baseUnit = units.value.find((item) => item.id === formModel.baseUnitId)
      if (!type || !baseUnit) return false
      formModel.materialType = type.typeCode
      formModel.basicUnit = baseUnit.unitCode
      const payload = omit(formModel, ['id', 'codeRuleId']) as MaterialArchiveInput
      await saveMaterialArchive(payload, formModel.id)
      emit('success')
      return true
    } catch {
      return false
    }
  }
  const handleOpen = async (data: ArchiveDialogOpenData): Promise<void> => {
    Object.assign(formModel, initialForm())
    activeTab.value = 'base'
    tenantOptions.value = data.tenantOptions
    categories.value = data.categories
    materialTypes.value = data.materialTypes
    units.value = data.units
    attributeGroups.value = data.attributeGroups
    codeRules.value = data.codeRules
    storageOptions.value = data.storageOptions
    if (data.row) Object.assign(formModel, cloneDeep(data.row))
    formModel.tenantId = data.row?.tenantId || data.tenantId
    if (data.copy) {
      formModel.id = undefined
      formModel.materialCode = ''
      formModel.materialName = `${formModel.materialName}（副本）`
    }
    await dialogRef.value?.handleOpen(data, {
      title: `${data.copy ? '复制' : data.row ? '编辑' : '新增'}物料档案`,
      subtitle: '统一物料身份与各业务域默认视图',
      confirmText: '保存物料',
      contentMaxHeight: '74vh',
      onConfirm: handleSubmit,
      onOpen: () => formRef.value?.clearValidate()
    })
  }
  watch(
    () => formModel.tenantId,
    (value, previous) => {
      if (value === previous || !previous) return
      formModel.categoryId = ''
      formModel.materialTypeId = null
      formModel.baseUnitId = null
      formModel.auxiliaryUnitId = null
      formModel.auxiliaryUnit2Id = null
      formModel.attributeGroupId = null
      formModel.codeRuleId = undefined
      formModel.storageLocationId = null
      formModel.unitConversions = []
      formModel.purchaserId = null
      formModel.plannerId = null
      formModel.salespersonId = null
      formModel.custodianId = null
      formModel.dispatcherId = null
    }
  )
  watch(
    () => formModel.baseUnitId,
    (unitId) => {
      if (!unitId) return
      formModel.purchaseUnitId ||= unitId
      formModel.salesUnitId ||= unitId
      formModel.inventoryUnitId ||= unitId
      formModel.productionUnitId ||= unitId
      formModel.costUnitId ||= unitId
    }
  )
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .material-archive-dialog__tabs {
    margin-top: -4px;
  }

  .material-archive-dialog__tabs :deep(.el-tabs__header) {
    margin-bottom: 10px;
  }

  .material-archive-dialog__tabs :deep(.el-tabs__content) {
    display: none;
  }

  .material-archive-dialog__tab-label {
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }

  .material-archive-dialog__tab-label i {
    width: 5px;
    height: 5px;
    background: var(--el-color-success);
    border-radius: 50%;
  }

  .material-archive-dialog__panel {
    padding: 16px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 10px;
  }

  .material-archive-dialog__section-heading {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    justify-content: space-between;
    padding: 1px 2px 14px;
  }

  .material-archive-dialog__section-heading strong,
  .material-archive-dialog__section-heading p {
    display: block;
    margin: 0;
  }

  .material-archive-dialog__section-heading strong {
    position: relative;
    padding-left: 12px;
    font-size: 15px;
  }

  .material-archive-dialog__section-heading strong::before {
    position: absolute;
    top: 2px;
    bottom: 2px;
    left: 0;
    width: 3px;
    content: '';
    background: var(--theme-color);
    border-radius: 2px;
  }

  .material-archive-dialog__section-heading p {
    padding-left: 12px;
    margin-top: 5px;
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }

  .material-archive-dialog__completion {
    display: inline-flex;
    flex: none;
    gap: 8px;
    align-items: baseline;
    padding: 5px 9px;
    background: var(--el-fill-color-lighter);
    border-radius: 8px;
  }

  .material-archive-dialog__completion span {
    font-size: 10px;
    color: var(--el-text-color-secondary);
  }

  .material-archive-dialog__completion strong {
    padding: 0;
    font-variant-numeric: tabular-nums;
    color: var(--theme-color);
  }

  .material-archive-dialog__completion strong::before {
    display: none;
  }

  .material-archive-dialog__notice {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    padding: 10px 12px;
    margin-bottom: 4px;
    background: var(--el-fill-color-lighter);
    border-radius: 8px;
  }

  .material-archive-dialog__notice > span {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    color: var(--theme-color);
    background: color-mix(in srgb, var(--theme-color) 9%, var(--el-bg-color));
    border-radius: 8px;
  }

  .material-archive-dialog__notice p {
    margin: 0;
    font-size: 11px;
    line-height: 1.6;
    color: var(--el-text-color-secondary);
  }

  :deep(.material-archive-dialog__form) {
    padding: 6px 0 0;
  }

  .material-archive-dialog__rule-field {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    width: 100%;
  }

  .conversion-builder {
    display: grid;
    gap: 10px;
    width: 100%;
  }

  .conversion-builder__row {
    display: grid;
    grid-template-columns: minmax(160px, 1fr) 150px auto 150px auto minmax(140px, 1fr) auto;
    gap: 8px;
    align-items: center;
    padding: 10px;
    background: var(--el-fill-color-lighter);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--el-border-radius-base);
  }

  .conversion-builder__equals,
  .conversion-builder__base {
    color: var(--el-text-color-secondary);
    white-space: nowrap;
  }

  @media (width <= 820px) {
    .material-archive-dialog__rule-field,
    .conversion-builder__row {
      grid-template-columns: 1fr;
    }

    .conversion-builder__equals {
      display: none;
    }

    .material-archive-dialog__section-heading {
      flex-direction: column;
      align-items: stretch;
    }

    .material-archive-dialog__completion {
      justify-content: space-between;
    }
  }
</style>
