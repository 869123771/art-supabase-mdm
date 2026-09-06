<template>
  <ArtDialog ref="dialogRef" size="xl">
    <div class="equipment-dialog">
      <div class="equipment-dialog__identity">
        <span><ArtSvgIcon icon="ri:tools-line" /></span>
        <div>
          <small>PRODUCTION EQUIPMENT</small>
          <strong>{{ form.equipmentName || '新生产设备' }}</strong>
          <p>{{ form.equipmentCode || '保存时自动生成企业设备编码' }}</p>
        </div>
        <ElTag :type="form.status === 'enabled' ? 'success' : 'info'" effect="plain" round>
          {{ form.status === 'enabled' ? '启用' : '停用' }}
        </ElTag>
      </div>

      <ElTabs v-model="activeTab" class="equipment-dialog__tabs">
        <ElTabPane v-for="tab in tabs" :key="tab.name" :name="tab.name">
          <template #label>
            <span class="equipment-dialog__tab-label">
              <ArtSvgIcon :icon="tab.icon" />{{ tab.label }}
            </span>
          </template>
        </ElTabPane>
      </ElTabs>

      <ArtForm
        ref="formRef"
        v-model="form"
        :items="formItems"
        :rules="rules"
        :span="12"
        :gutter="24"
        label-position="top"
        :show-reset="false"
        :show-submit="false"
        root-class="equipment-dialog__form"
      >
        <template #responsibleEmployeeId>
          <ArtEmployeeSelect
            :model-value="form.responsibleEmployeeId ?? undefined"
            :tenant-id="form.tenantId"
            :selected-data="selectedEmployee"
            placeholder="选择设备管理员"
            @update:model-value="form.responsibleEmployeeId = $event ?? null"
          />
        </template>
      </ArtForm>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import type { FormRules } from 'element-plus'
  import { cloneDeep } from 'lodash-es'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtEmployeeSelect from '@/components/business/art-employee-select/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    saveProductionEquipment,
    type EquipmentReference,
    type ProductionEquipment,
    type ProductionEquipmentInput,
    type ProductionEquipmentReferences
  } from '@mdm/api'

  type EquipmentTab = 'identity' | 'assignment' | 'technical' | 'connection' | 'governance'
  export interface EquipmentDialogOpenData {
    row?: ProductionEquipment
    copy?: boolean
    targetTenantId?: string
    tenantOptions: Array<{ label: string; value: string }>
    references: ProductionEquipmentReferences
  }

  interface EquipmentForm extends ProductionEquipmentInput {
    id?: string
  }

  const emit = defineEmits<{ success: [] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const dialogRef = ref<ArtDialogExpose<EquipmentDialogOpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const activeTab = ref<EquipmentTab>('identity')
  const references = ref<ProductionEquipmentReferences>({
    categories: [],
    departments: [],
    locations: [],
    workCenters: [],
    suppliers: []
  })
  const tenantOptions = ref<Array<{ label: string; value: string }>>([])
  const editingRow = shallowRef<ProductionEquipment>()

  const tabs = [
    { name: 'identity', label: '基础资料', icon: 'ri:fingerprint-line' },
    { name: 'assignment', label: '生产归属', icon: 'ri:node-tree' },
    { name: 'technical', label: '技术信息', icon: 'ri:settings-5-line' },
    { name: 'connection', label: '设备接入', icon: 'ri:radar-line' },
    { name: 'governance', label: '治理设置', icon: 'ri:shield-check-line' }
  ] as const

  const initialForm = (): EquipmentForm => ({
    id: undefined,
    tenantId: '',
    categoryId: '',
    productionDepartmentId: '',
    locationId: null,
    workCenterId: null,
    responsibleEmployeeId: null,
    supplierId: null,
    equipmentCode: '',
    equipmentName: '',
    equipmentBrand: '',
    model: '',
    manufacturer: '',
    factoryNo: '',
    fixedAssetNo: '',
    manufactureDate: null,
    installationDate: null,
    acceptanceDate: null,
    enableDate: null,
    trafficLightCardNo: '',
    andonBoxNo: '',
    pulseIntervalSeconds: 60,
    standardUtilization: null,
    syncWorkCenter: false,
    operationStatus: 'normal',
    status: 'enabled',
    remark: '',
    sort: 10
  })
  const form = reactive<EquipmentForm>(initialForm())

  const inTenant = (items: EquipmentReference[]): EquipmentReference[] =>
    form.tenantId ? items.filter((item) => item.tenantId === form.tenantId) : []
  const options = (items: EquipmentReference[]) =>
    inTenant(items).map((item) => ({ label: `${item.name} · ${item.code}`, value: item.id }))
  const departmentOptions = computed(() => options(references.value.departments))
  const workCenterOptions = computed(() =>
    options(
      references.value.workCenters.filter(
        (item) => item.departmentId === form.productionDepartmentId
      )
    )
  )
  const selectedEmployee = computed<EmployeeIntegrationItem[]>(() => {
    if (!editingRow.value?.responsibleEmployeeId || !editingRow.value.responsibleName) return []
    return [
      {
        id: editingRow.value.responsibleEmployeeId,
        tenantId: editingRow.value.tenantId,
        employeeNo: '',
        employeeName: editingRow.value.responsibleName,
        employmentStatus: 'active'
      }
    ]
  })

  const formItems = computed<FormItem[]>(() => {
    if (activeTab.value === 'identity')
      return [
        ...(tenantOptions.value.length > 1
          ? [
              {
                label: '目标租户',
                key: 'tenantId',
                type: 'select',
                options: tenantOptions.value,
                props: { disabled: Boolean(form.id), filterable: true }
              } as FormItem
            ]
          : []),
        {
          label: '设备编号',
          key: 'equipmentCode',
          type: 'input',
          help: '可留空，由企业编码规则自动生成。',
          props: { maxlength: 60, placeholder: '留空自动生成' }
        },
        { label: '设备名称', key: 'equipmentName', type: 'input', props: { maxlength: 120 } },
        {
          label: '设备分类',
          key: 'categoryId',
          type: 'select',
          options: options(references.value.categories),
          props: { filterable: true }
        },
        {
          label: '启用状态',
          key: 'status',
          type: 'select',
          options: getDictMap.value.commonEnabledStatus ?? []
        }
      ]
    if (activeTab.value === 'assignment')
      return [
        {
          label: '部门 / 产线',
          key: 'productionDepartmentId',
          type: 'select',
          options: departmentOptions.value,
          props: { filterable: true }
        },
        {
          label: '工作中心',
          key: 'workCenterId',
          type: 'select',
          options: workCenterOptions.value,
          props: { clearable: true, filterable: true }
        },
        {
          label: '放置地点',
          key: 'locationId',
          type: 'select',
          options: options(references.value.locations),
          props: { clearable: true, filterable: true }
        },
        { label: '设备管理员', key: 'responsibleEmployeeId', type: 'slot' },
        {
          label: '供应商',
          key: 'supplierId',
          type: 'select',
          options: options(references.value.suppliers),
          props: { clearable: true, filterable: true }
        },
        {
          label: '同步更新工作中心',
          key: 'syncWorkCenter',
          type: 'switch',
          help: '启用后由后续生产配置流程同步设备与工作中心关系。'
        }
      ]
    if (activeTab.value === 'technical')
      return [
        { label: '设备品牌', key: 'equipmentBrand', type: 'input', props: { maxlength: 100 } },
        { label: '设备型号', key: 'model', type: 'input', props: { maxlength: 120 } },
        { label: '制造商', key: 'manufacturer', type: 'input', props: { maxlength: 160 } },
        { label: '出厂序列号', key: 'factoryNo', type: 'input', props: { maxlength: 120 } },
        { label: '固定资产编码', key: 'fixedAssetNo', type: 'input', props: { maxlength: 100 } },
        {
          label: '出厂日期',
          key: 'manufactureDate',
          type: 'date',
          props: { valueFormat: 'YYYY-MM-DD' }
        },
        {
          label: '安装日期',
          key: 'installationDate',
          type: 'date',
          props: { valueFormat: 'YYYY-MM-DD' }
        },
        {
          label: '安装验收日期',
          key: 'acceptanceDate',
          type: 'date',
          props: { valueFormat: 'YYYY-MM-DD' }
        },
        { label: '启用日期', key: 'enableDate', type: 'date', props: { valueFormat: 'YYYY-MM-DD' } }
      ]
    if (activeTab.value === 'connection')
      return [
        {
          label: '智能三色灯卡号',
          key: 'trafficLightCardNo',
          type: 'input',
          props: { maxlength: 100 }
        },
        { label: '安灯盒子', key: 'andonBoxNo', type: 'input', props: { maxlength: 100 } },
        {
          label: '脉冲间隔（秒）',
          key: 'pulseIntervalSeconds',
          type: 'number',
          props: { min: 1, max: 86400, precision: 0, class: '!w-full' }
        },
        {
          label: '标准利用率（%）',
          key: 'standardUtilization',
          type: 'number',
          props: { min: 0, max: 100, precision: 2, class: '!w-full' }
        }
      ]
    return [
      {
        label: '运行状态',
        key: 'operationStatus',
        type: 'select',
        options: getDictMap.value.mdmEquipmentOperationStatus ?? []
      },
      {
        label: '显示顺序',
        key: 'sort',
        type: 'number',
        props: { min: 0, max: 999999, precision: 0, class: '!w-full' }
      },
      {
        label: '设备概要',
        key: 'remark',
        type: 'input',
        span: 24,
        props: { type: 'textarea', rows: 4, maxlength: 1000, showWordLimit: true, resize: 'none' }
      }
    ]
  })
  void Promise.all(
    ['commonEnabledStatus', 'mdmEquipmentOperationStatus'].map((code) =>
      userStore.ensureDictLoaded(code)
    )
  )

  const rules: FormRules<Record<string, unknown>> = {
    tenantId: [{ required: true, message: '请选择目标租户', trigger: 'change' }],
    equipmentName: [{ required: true, message: '请输入设备名称', trigger: 'blur' }],
    categoryId: [{ required: true, message: '请选择设备分类', trigger: 'change' }],
    productionDepartmentId: [{ required: true, message: '请选择部门或产线', trigger: 'change' }]
  }

  const handleSubmit = async (): Promise<boolean> => {
    try {
      activeTab.value = 'identity'
      await nextTick()
      await formRef.value?.validate()
      if (!form.productionDepartmentId) return false
      await saveProductionEquipment(cloneDeep(form), form.id)
      emit('success')
      return true
    } catch {
      return false
    }
  }

  const handleOpen = async (data: EquipmentDialogOpenData): Promise<void> => {
    Object.assign(form, initialForm())
    references.value = data.references
    tenantOptions.value = data.tenantOptions
    editingRow.value = data.row
    activeTab.value = 'identity'
    if (data.row) Object.assign(form, cloneDeep(data.row))
    else
      form.tenantId =
        data.targetTenantId || (data.tenantOptions.length === 1 ? data.tenantOptions[0].value : '')
    if (data.copy) {
      form.id = undefined
      form.equipmentCode = ''
      form.equipmentName = `${form.equipmentName}（副本）`
    }
    await dialogRef.value?.handleOpen(data, {
      title: `${data.copy ? '复制' : data.row ? '编辑' : '新增'}生产设备`,
      subtitle: '统一生产归属、技术身份与现场接入信息',
      confirmText: '保存设备',
      contentMaxHeight: '74vh',
      onConfirm: handleSubmit,
      onOpen: () => formRef.value?.clearValidate()
    })
  }

  watch(
    () => form.productionDepartmentId,
    () => {
      if (!workCenterOptions.value.some((item) => item.value === form.workCenterId))
        form.workCenterId = null
    }
  )
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .equipment-dialog {
    display: grid;
    gap: 12px;
    min-width: 0;

    &__identity {
      display: grid;
      grid-template-columns: 46px minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      padding: 12px 14px;
      background: color-mix(in srgb, var(--theme-color) 7%, var(--el-bg-color));
      border: 1px solid color-mix(in srgb, var(--theme-color) 15%, var(--el-border-color-lighter));
      border-radius: var(--el-border-radius-base);

      > span {
        display: grid;
        place-items: center;
        width: 46px;
        height: 46px;
        font-size: 21px;
        color: var(--theme-color);
        background: var(--el-bg-color);
        border-radius: var(--el-border-radius-base);
      }

      small,
      strong,
      p {
        display: block;
        margin: 0;
      }

      small {
        font-size: 9px;
        color: var(--theme-color);
        letter-spacing: 0.1em;
      }

      strong {
        margin-top: 2px;
        font-size: 15px;
      }

      p {
        margin-top: 2px;
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }
    }

    &__tabs :deep(.el-tabs__content) {
      display: none;
    }

    &__tabs :deep(.el-tabs__header) {
      margin: 0;
    }

    &__tab-label {
      display: inline-flex;
      gap: 6px;
      align-items: center;
    }

    :deep(.equipment-dialog__form) {
      padding-top: 2px;
    }
  }

  @media (width <= 620px) {
    .equipment-dialog__identity {
      grid-template-columns: 42px minmax(0, 1fr);
    }

    .equipment-dialog__identity .el-tag {
      grid-column: 1 / -1;
      justify-self: start;
    }
  }
</style>
