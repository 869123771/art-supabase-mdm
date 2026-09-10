<template>
  <ArtDialog ref="dialogRef" size="xl">
    <div class="route-maintenance">
      <div class="route-maintenance__summary">
        <span
          ><strong>{{ route?.code }}</strong
          ><small>路线编码</small></span
        >
        <span
          ><strong>{{ route?.material?.materialName }}</strong
          ><small>产品物料</small></span
        >
        <span
          ><strong>{{ route?.version || '默认版本' }}</strong
          ><small>工艺版本</small></span
        >
        <span
          ><strong>{{ route?.productionUnit?.unitName || '多单位共用' }}</strong
          ><small>生产单位</small></span
        >
      </div>

      <div class="route-maintenance__workspace">
        <ArtSectionCard
          title="工序序列"
          subtitle="主干、并行与返工路径"
          :loading="sequenceState.loading"
          :empty="!sequenceState.loading && !sequenceState.rows.length"
          empty-title="暂无工序序列"
          empty-description="新增序列后再配置工序明细。"
          body-class="route-maintenance__sequence-body"
        >
          <template v-if="!readonly" #actions>
            <ArtIconButton
              v-auth="'MdmProcessRoute:Edit'"
              icon="ri:add-line"
              label="新增工序序列"
              @click="openSequence()"
            />
          </template>
          <ElScrollbar class="route-maintenance__sequence-scroll">
            <div
              v-for="item in sequenceState.rows"
              :key="item.id"
              class="route-maintenance__sequence"
              :class="{ 'is-current': sequenceState.selectedId === item.id }"
            >
              <button
                type="button"
                class="route-maintenance__sequence-select"
                :aria-current="sequenceState.selectedId === item.id ? 'true' : undefined"
                @click="selectSequence(item.id)"
                ><strong>{{ item.sequenceNo }} · {{ sequenceTypeLabel(item.sequenceType) }}</strong
                ><small>{{ item.remark || '未填写序列备注' }}</small></button
              >
              <span v-if="!readonly" class="route-maintenance__sequence-actions">
                <ArtIconButton
                  v-auth="'MdmProcessRoute:Edit'"
                  icon="ri:edit-line"
                  label="编辑序列"
                  @click.stop="openSequence(item)"
                />
                <ArtIconButton
                  v-auth="'MdmProcessRoute:Edit'"
                  icon="ri:delete-bin-6-line"
                  label="删除序列"
                  tone="danger"
                  @click.stop="removeSequence(item)"
                />
              </span>
            </div>
          </ElScrollbar>
        </ArtSectionCard>

        <ArtSectionCard
          class="route-maintenance__steps"
          title="工序与工艺配置"
          :subtitle="currentSequenceSubtitle"
          body-class="route-maintenance__steps-body"
        >
          <ArtTableQuery
            ref="tableRef"
            v-model="search"
            :api-fn="fetchRows"
            :columns-factory="columns"
            :header-actions="actions"
            :search-items="[
              {
                key: 'keyword',
                label: '工序',
                type: 'input',
                props: { clearable: true, placeholder: '编号 / 名称 / 说明' }
              }
            ]"
            :enable-cache="false"
            :table-props="{
              rowKey: 'id',
              emptyText: '暂无工序明细',
              emptyDescription: '选择序列并新增工序。',
              height: 360
            }"
          />
        </ArtSectionCard>
      </div>
    </div>
  </ArtDialog>

  <ArtDialog ref="sequenceDialog" size="sm">
    <ArtForm
      ref="sequenceFormRef"
      v-model="sequenceForm"
      :items="sequenceItems"
      :rules="sequenceRules"
      :span="24"
      label-position="top"
      :show-reset="false"
      :show-submit="false"
    />
  </ArtDialog>

  <ArtDialog ref="editDialog" size="xl">
    <ElTabs v-model="activeTab" class="route-maintenance__tabs">
      <ElTabPane label="工序明细" name="basic">
        <ArtForm
          ref="formRef"
          v-model="stepForm"
          :items="stepItems"
          :rules="stepRules"
          :span="12"
          :gutter="24"
          label-position="top"
          :show-reset="false"
          :show-submit="false"
        />
      </ElTabPane>
      <ElTabPane label="单位换算" name="unit">
        <ElAlert
          title="生产单位换算系数 × 生产单位 = 工序单位换算系数 × 工序单位"
          type="info"
          :closable="false"
          show-icon
        />
        <ArtForm
          v-model="unitForm"
          :items="unitItems"
          :span="12"
          :gutter="24"
          label-position="top"
          :show-reset="false"
          :show-submit="false"
        />
      </ElTabPane>
      <ElTabPane label="活动信息" name="activity">
        <div class="route-maintenance__tab-toolbar">
          <span>活动公式会自动带入计划与汇报表达式，仍可按工序调整。</span>
          <ElButton
            v-if="!readonly"
            v-auth="'MdmProcessRoute:Edit'"
            type="primary"
            plain
            @click="addActivity"
            >新增活动</ElButton
          >
        </div>
        <ElScrollbar class="route-maintenance__activity-scroll">
          <div v-if="!activityRows.length" class="route-maintenance__tab-empty">暂无活动配置</div>
          <div
            v-for="(activity, index) in activityRows"
            :key="activity.key"
            class="route-maintenance__activity-row"
          >
            <span class="route-maintenance__activity-index">{{ index + 1 }}</span>
            <ElSelect
              v-model="activity.formulaId"
              :aria-label="`第 ${index + 1} 行活动公式`"
              filterable
              clearable
              placeholder="活动公式"
              @change="applyFormula(activity)"
            >
              <ElOption
                v-for="item in references.activityFormulas"
                :key="item.id"
                :label="`${item.name} · ${item.code}`"
                :value="item.id"
              />
            </ElSelect>
            <ElInput
              v-model="activity.name"
              :aria-label="`第 ${index + 1} 行活动名称`"
              maxlength="100"
              placeholder="活动名称"
            />
            <ElInputNumber
              v-model="activity.basicQuantity"
              :aria-label="`第 ${index + 1} 行基本数量`"
              :min="0"
              :precision="6"
              controls-position="right"
            />
            <ElSelect
              v-model="activity.unitId"
              :aria-label="`第 ${index + 1} 行活动单位`"
              filterable
              clearable
              placeholder="活动单位"
            >
              <ElOption
                v-for="item in references.units"
                :key="item.id"
                :label="`${item.name} · ${item.code}`"
                :value="item.id"
              />
            </ElSelect>
            <ElInput
              v-model="activity.resource"
              :aria-label="`第 ${index + 1} 行资源`"
              maxlength="200"
              placeholder="资源"
            />
            <ElInput
              v-model="activity.planExpression"
              :aria-label="`第 ${index + 1} 行计划活动量公式`"
              placeholder="计划活动量公式"
            />
            <ElInput
              v-model="activity.reportExpression"
              :aria-label="`第 ${index + 1} 行汇报活动量公式`"
              placeholder="汇报活动量公式"
            />
            <div class="route-maintenance__activity-actions">
              <ArtIconButton
                v-if="!readonly"
                icon="ri:arrow-up-line"
                label="上移活动"
                :disabled="index === 0"
                @click="moveActivity(index, -1)"
              />
              <ArtIconButton
                v-if="!readonly"
                icon="ri:arrow-down-line"
                label="下移活动"
                :disabled="index === activityRows.length - 1"
                @click="moveActivity(index, 1)"
              />
              <ArtIconButton
                v-if="!readonly"
                icon="ri:delete-bin-6-line"
                label="删除活动"
                tone="danger"
                @click="activityRows.splice(index, 1)"
              />
            </div>
          </div>
        </ElScrollbar>
      </ElTabPane>
      <ElTabPane label="委外信息" name="outsourcing">
        <ArtForm
          v-model="outsourcingForm"
          :items="outsourcingItems"
          :span="24"
          label-position="top"
          :show-reset="false"
          :show-submit="false"
        />
      </ElTabPane>
      <ElTabPane label="检验信息" name="inspection">
        <ArtForm
          v-model="inspectionForm"
          :items="inspectionItems"
          :span="12"
          :gutter="24"
          label-position="top"
          :show-reset="false"
          :show-submit="false"
        />
      </ElTabPane>
      <ElTabPane label="作业指导书" name="sop">
        <ArtForm
          v-model="sopForm"
          :items="sopItems"
          :span="24"
          label-position="top"
          :show-reset="false"
          :show-submit="false"
        >
          <template #attachments>
            <ArtUploadFile
              v-model="sopForm.attachments"
              multiple
              :limit="10"
              title="上传作业指导书"
              tip="支持上传附件，也可选择工程主数据中的 ESOP 文档。"
            />
          </template>
        </ArtForm>
      </ElTabPane>
    </ElTabs>
  </ArtDialog>
</template>

<script setup lang="tsx">
  import { cloneDeep } from 'lodash-es'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import ArtUploadFile from '@/components/core/forms/art-upload-file/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { useUserStore } from '@/store/modules/user'
  import {
    deleteProcessSequence,
    deleteProcessStep,
    fetchProcessRouteReferences,
    fetchProcessSequences,
    fetchProcessSteps,
    saveProcessSequence,
    saveProcessStep,
    type ProcessRoute,
    type ProcessRouteReferences,
    type ProcessSequence,
    type ProcessStep,
    type ProcessStepInput,
    type WorkspaceQuery
  } from '@mdm/api'

  interface ActivityRow {
    key: string
    formulaId: string
    name: string
    basicQuantity: number
    unitId: string
    resource: string
    planExpression: string
    reportExpression: string
  }

  const user = useUserStore()
  const { getDictMap } = storeToRefs(user)
  const { confirmAction } = useArtFeedback()
  const dialogRef = ref<ArtDialogExpose>()
  const sequenceDialog = ref<ArtDialogExpose>()
  const editDialog = ref<ArtDialogExpose>()
  const tableRef = ref<ArtTableQueryExpose>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const sequenceFormRef = ref<InstanceType<typeof ArtForm>>()
  const route = shallowRef<ProcessRoute>()
  const readonly = ref(false)
  const search = reactive({ keyword: '' })
  const activeTab = ref('basic')
  const references = reactive<ProcessRouteReferences>({
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
  const sequenceState = reactive({ loading: false, selectedId: '', rows: [] as ProcessSequence[] })
  const initialSequence = () => ({
    sequenceNo: 1,
    sequenceType: 'main',
    transferInStepId: null as string | null,
    transferOutStepId: null as string | null,
    remark: ''
  })
  const sequenceForm = reactive(initialSequence())
  const sequenceEditId = ref('')
  const initialStep = (): Omit<ProcessStepInput, 'routeId'> => ({
    sequenceId: null,
    code: '10',
    name: '',
    operationId: null,
    description: '',
    unitId: null,
    basicBatch: 1,
    workCenterId: null,
    departmentId: null,
    operationMode: 'individual',
    controlCodeId: null,
    needInspection: false,
    firstInspection: false,
    firstInspectionControl: 'none',
    isFirst: false,
    isLast: false,
    critical: false,
    unitConversion: {},
    activities: [],
    outsourcing: {},
    inspection: {},
    sopDocuments: [],
    sort: 10
  })
  const stepForm = reactive(initialStep())
  const stepEditId = ref('')
  const unitForm = reactive({ productionFactor: 1, operationFactor: 1, operationUnitId: '' })
  const outsourcingForm = reactive({ enabled: false, supplierId: '', remark: '' })
  const inspectionForm = reactive({ method: '', standard: '', samplingRule: '', remark: '' })
  const sopForm = reactive({ documentIds: [] as string[], attachments: [] as string[] })
  const activityRows = ref<ActivityRow[]>([])
  const sequenceTypeLabel = (value: string) =>
    getDictMap.value.mdmProcessRouteSequenceType?.find((item) => item.value === value)?.label ||
    value
  const currentSequence = computed(() =>
    sequenceState.rows.find((item) => item.id === sequenceState.selectedId)
  )
  const currentSequenceSubtitle = computed(() =>
    currentSequence.value
      ? `${currentSequence.value.sequenceNo} · ${sequenceTypeLabel(currentSequence.value.sequenceType)}`
      : '请选择左侧工序序列'
  )
  const option = (rows: Array<{ id: string; code: string; name: string }>) =>
    rows.map((item) => ({ label: `${item.name} · ${item.code}`, value: item.id }))

  const sequenceItems = computed<FormItem[]>(() => [
    {
      key: 'sequenceNo',
      label: '工序序列',
      type: 'number',
      props: { min: 1, precision: 0, class: '!w-full' }
    },
    {
      key: 'sequenceType',
      label: '序列类型',
      type: 'select',
      options: getDictMap.value.mdmProcessRouteSequenceType ?? []
    },
    {
      key: 'transferInStepId',
      label: '转入工序',
      type: 'select',
      options: stepOptions.value,
      props: { clearable: true, filterable: true }
    },
    {
      key: 'transferOutStepId',
      label: '转出工序',
      type: 'select',
      options: stepOptions.value,
      props: { clearable: true, filterable: true }
    },
    { key: 'remark', label: '备注', type: 'textarea', props: { rows: 3, maxlength: 500 } }
  ])
  const stepRows = ref<ProcessStep[]>([])
  const stepOptions = computed(() =>
    stepRows.value.map((item) => ({ label: `${item.code}｜${item.name}`, value: item.id }))
  )
  const sequenceRules = {
    sequenceNo: [{ required: true, message: '请输入工序序列号', trigger: 'blur' }],
    sequenceType: [{ required: true, message: '请选择序列类型', trigger: 'change' }]
  }
  const stepItems = computed<FormItem[]>(() => [
    {
      key: 'sequenceId',
      label: '工序序列',
      type: 'select',
      options: sequenceState.rows.map((item) => ({
        label: `${item.sequenceNo} · ${sequenceTypeLabel(item.sequenceType)}`,
        value: item.id
      }))
    },
    { key: 'code', label: '工序号', props: { maxlength: 40 } },
    {
      key: 'operationId',
      label: '工序集',
      type: 'select',
      options: option(references.operations),
      props: { clearable: true, filterable: true, onChange: applyOperation }
    },
    { key: 'name', label: '工序名称', props: { maxlength: 120 } },
    {
      key: 'description',
      label: '工序说明',
      type: 'textarea',
      span: 24,
      props: { rows: 2, maxlength: 500 }
    },
    {
      key: 'unitId',
      label: '工序单位',
      type: 'select',
      options: option(references.units),
      props: { clearable: true, filterable: true }
    },
    {
      key: 'basicBatch',
      label: '基本批量',
      type: 'number',
      props: { min: 0.000001, precision: 6, class: '!w-full' }
    },
    {
      key: 'workCenterId',
      label: '工作中心',
      type: 'select',
      options: option(references.workCenters),
      props: { clearable: true, filterable: true }
    },
    {
      key: 'departmentId',
      label: '加工车间',
      type: 'select',
      options: option(references.departments),
      props: { clearable: true, filterable: true }
    },
    {
      key: 'operationMode',
      label: '作业类型',
      type: 'select',
      options: getDictMap.value.mdmProcessOperationMode ?? []
    },
    {
      key: 'controlCodeId',
      label: '工序控制码',
      type: 'select',
      options: option(references.controlCodes),
      props: { clearable: true, filterable: true }
    },
    { key: 'needInspection', label: '工序质检', type: 'switch' },
    { key: 'firstInspection', label: '首检', type: 'switch' },
    {
      key: 'firstInspectionControl',
      label: '首检控制',
      type: 'select',
      options: getDictMap.value.mdmProcessSequenceControlMode ?? []
    },
    { key: 'isFirst', label: '首序', type: 'switch' },
    { key: 'isLast', label: '末序', type: 'switch' },
    { key: 'critical', label: '关键工序', type: 'switch' },
    {
      key: 'sort',
      label: '排序',
      type: 'number',
      props: { min: 0, precision: 0, class: '!w-full' }
    }
  ])
  const unitItems = computed<FormItem[]>(() => [
    {
      key: 'productionFactor',
      label: '生产单位换算系数',
      type: 'number',
      props: { min: 0.000001, precision: 6, class: '!w-full' }
    },
    {
      key: 'operationFactor',
      label: '工序单位换算系数',
      type: 'number',
      props: { min: 0.000001, precision: 6, class: '!w-full' }
    },
    {
      key: 'operationUnitId',
      label: '工序单位',
      type: 'select',
      options: option(references.units),
      props: { clearable: true, filterable: true }
    }
  ])
  const outsourcingItems = computed<FormItem[]>(() => [
    { key: 'enabled', label: '启用委外', type: 'switch' },
    {
      key: 'supplierId',
      label: '供应商',
      type: 'select',
      options: option(references.suppliers),
      props: { clearable: true, filterable: true, disabled: !outsourcingForm.enabled }
    },
    { key: 'remark', label: '委外说明', type: 'textarea', props: { rows: 4, maxlength: 1000 } }
  ])
  const inspectionItems = computed<FormItem[]>(() => [
    {
      key: 'method',
      label: '检验方式',
      type: 'select',
      options: getDictMap.value.mdmProcessStepInspectionMode ?? []
    },
    { key: 'samplingRule', label: '抽样规则', type: 'input' },
    {
      key: 'standard',
      label: '检验标准',
      type: 'textarea',
      span: 24,
      props: { rows: 3, maxlength: 1000 }
    },
    {
      key: 'remark',
      label: '检验备注',
      type: 'textarea',
      span: 24,
      props: { rows: 3, maxlength: 1000 }
    }
  ])
  const sopItems = computed<FormItem[]>(() => [
    {
      key: 'documentIds',
      label: '工程主数据 ESOP',
      type: 'select',
      props: { multiple: true, filterable: true, clearable: true },
      options: option(references.esopDocuments)
    },
    { key: 'attachments', label: '上传附件', type: 'slot' }
  ])
  const stepRules = {
    sequenceId: [{ required: true, message: '请选择工序序列', trigger: 'change' }],
    code: [{ required: true, message: '请输入工序号', trigger: 'blur' }],
    name: [{ required: true, message: '请输入工序名称', trigger: 'blur' }]
  }
  const fetchRows = async (p: WorkspaceQuery, o?: { signal?: AbortSignal }) => {
    const result = await fetchProcessSteps(
      {
        ...p,
        tenantId: route.value?.tenantId || user.info.tenantId || '',
        routeId: route.value?.id,
        sequenceId: sequenceState.selectedId || undefined
      },
      o
    )
    stepRows.value = result.data
    return result
  }
  const columns = (): ColumnOption<ProcessStep>[] => [
    { prop: 'code', label: '工序号', width: 100 },
    { prop: 'name', label: '工序名称', minWidth: 150, showOverflowTooltip: true },
    {
      prop: 'operation',
      label: '工序集',
      minWidth: 140,
      formatter: (row) => row.operation?.name || '自定义工序'
    },
    {
      prop: 'workCenter',
      label: '工作中心',
      minWidth: 140,
      formatter: (row) => row.workCenter?.name || '未指定'
    },
    {
      prop: 'department',
      label: '加工车间',
      minWidth: 130,
      formatter: (row) => row.department?.name || '未指定'
    },
    { prop: 'basicBatch', label: '基本批量', width: 100, align: 'right' },
    {
      prop: 'critical',
      label: '关键',
      width: 80,
      align: 'center',
      formatter: (row) => (row.critical ? '是' : '否')
    },
    ...(!readonly.value
      ? [
          {
            prop: 'operation',
            label: '操作',
            width: 112,
            fixed: 'right' as const,
            formatter: (row: ProcessStep) => (
              <BusinessTableRowActions>
                <ArtButtonTable
                  type="edit"
                  permission="MdmProcessRoute:Edit"
                  onClick={() => void openStep(row)}
                />
                <ArtButtonTable
                  type="delete"
                  permission="MdmProcessRoute:Edit"
                  onClick={() => void removeStep(row)}
                />
              </BusinessTableRowActions>
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
            label: '新增工序',
            permission: 'MdmProcessRoute:Edit',
            disabled: !sequenceState.selectedId,
            onClick: () => void openStep()
          }
        ]
  )

  async function loadSequences() {
    if (!route.value) return
    sequenceState.loading = true
    try {
      sequenceState.rows = await fetchProcessSequences(route.value.id)
      if (!sequenceState.rows.some((item) => item.id === sequenceState.selectedId))
        sequenceState.selectedId = sequenceState.rows[0]?.id || ''
    } finally {
      sequenceState.loading = false
    }
  }
  async function selectSequence(id: string) {
    sequenceState.selectedId = id
    await tableRef.value?.refreshData()
  }
  async function openSequence(row?: ProcessSequence) {
    if (!route.value) return
    sequenceEditId.value = row?.id || ''
    Object.assign(
      sequenceForm,
      row
        ? cloneDeep(row)
        : {
            ...initialSequence(),
            sequenceNo: (sequenceState.rows.at(-1)?.sequenceNo || 0) + 1,
            sequenceType: sequenceState.rows.length ? 'parallel' : 'main'
          }
    )
    await sequenceDialog.value?.handleOpen(undefined, {
      title: row ? '编辑工序序列' : '新增工序序列',
      confirmText: row ? '保存更改' : '创建序列',
      onOpen: () => sequenceFormRef.value?.clearValidate(),
      onConfirm: async () => {
        try {
          await sequenceFormRef.value?.validate()
          await saveProcessSequence(
            { routeId: route.value!.id, ...sequenceForm },
            sequenceEditId.value || undefined
          )
          await loadSequences()
          await tableRef.value?.refreshData()
          return true
        } catch {
          return false
        }
      }
    })
  }
  async function removeSequence(row: ProcessSequence) {
    try {
      await confirmAction(
        `确认删除序列“${row.sequenceNo} · ${sequenceTypeLabel(row.sequenceType)}”？`,
        '删除工序序列',
        { type: 'warning' }
      )
      await deleteProcessSequence(row.id)
      await loadSequences()
      await tableRef.value?.refreshData()
    } catch {
      /* API owns feedback. */
    }
  }
  function applyOperation(value: string) {
    const operation = references.operations.find((item) => item.id === value)
    if (!operation) return
    stepForm.name = operation.name
    if (!stepForm.description) stepForm.description = operation.name
  }
  function applyFormula(row: ActivityRow) {
    const formula = references.activityFormulas.find((item) => item.id === row.formulaId)
    if (!formula) return
    row.name ||= formula.name
    row.planExpression = formula.planExpression || ''
    row.reportExpression = formula.reportExpression || ''
  }
  function addActivity() {
    activityRows.value.push({
      key: crypto.randomUUID(),
      formulaId: '',
      name: '',
      basicQuantity: 1,
      unitId: '',
      resource: '',
      planExpression: '',
      reportExpression: ''
    })
  }
  function moveActivity(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= activityRows.value.length) return
    const rows = activityRows.value
    ;[rows[index], rows[target]] = [rows[target], rows[index]]
  }
  async function openStep(row?: ProcessStep) {
    if (!route.value || !sequenceState.selectedId) return
    stepEditId.value = row?.id || ''
    Object.assign(
      stepForm,
      row
        ? cloneDeep(row)
        : {
            ...initialStep(),
            sequenceId: sequenceState.selectedId,
            code: String((stepRows.value.at(-1)?.sort || 0) + 10),
            sort: (stepRows.value.at(-1)?.sort || 0) + 10
          }
    )
    Object.assign(unitForm, {
      productionFactor: 1,
      operationFactor: 1,
      operationUnitId: '',
      ...(row?.unitConversion || {})
    })
    Object.assign(outsourcingForm, {
      enabled: false,
      supplierId: '',
      remark: '',
      ...(row?.outsourcing || {})
    })
    Object.assign(inspectionForm, {
      method: '',
      standard: '',
      samplingRule: '',
      remark: '',
      ...(row?.inspection || {})
    })
    activityRows.value = (row?.activities || []).map((item) => ({
      key: crypto.randomUUID(),
      formulaId: '',
      name: '',
      basicQuantity: 1,
      unitId: '',
      resource: '',
      planExpression: '',
      reportExpression: '',
      ...item
    })) as ActivityRow[]
    const sop = row?.sopDocuments || []
    sopForm.documentIds = sop.filter((item) => item.type === 'esop').map((item) => String(item.id))
    sopForm.attachments = sop
      .filter((item) => item.type === 'upload')
      .map((item) => String(item.url))
    activeTab.value = 'basic'
    await editDialog.value?.handleOpen(undefined, {
      title: row ? '编辑工序与工艺配置' : '新增工序与工艺配置',
      subtitle: currentSequenceSubtitle.value,
      confirmText: row ? '保存更改' : '创建工序',
      contentMaxHeight: '72vh',
      onOpen: () => formRef.value?.clearValidate(),
      onConfirm: async () => {
        try {
          await formRef.value?.validate()
          await saveProcessStep(
            {
              routeId: route.value!.id,
              ...stepForm,
              unitConversion: cloneDeep(unitForm),
              activities: activityRows.value.map((item) => ({
                formulaId: item.formulaId,
                name: item.name,
                basicQuantity: item.basicQuantity,
                unitId: item.unitId,
                resource: item.resource,
                planExpression: item.planExpression,
                reportExpression: item.reportExpression
              })),
              outsourcing: cloneDeep(outsourcingForm),
              inspection: cloneDeep(inspectionForm),
              sopDocuments: [
                ...sopForm.documentIds.map((id) => ({ type: 'esop', id })),
                ...sopForm.attachments.map((url) => ({ type: 'upload', url }))
              ]
            },
            stepEditId.value || undefined
          )
          await tableRef.value?.refreshData()
          return true
        } catch {
          return false
        }
      }
    })
  }
  async function removeStep(row: ProcessStep) {
    try {
      await confirmAction(`确认删除工序“${row.code}｜${row.name}”？`, '删除工序', {
        type: 'warning'
      })
      await deleteProcessStep(row.id)
      await tableRef.value?.refreshData()
    } catch {
      /* API owns feedback. */
    }
  }
  async function handleOpen(row: ProcessRoute, viewOnly = false) {
    route.value = row
    readonly.value = viewOnly
    search.keyword = ''
    sequenceState.selectedId = ''
    await Promise.all(
      [
        'mdmProcessRouteSequenceType',
        'mdmProcessOperationMode',
        'mdmProcessSequenceControlMode',
        'mdmProcessStepInspectionMode'
      ].map((code) => user.ensureDictLoaded(code))
    )
    await dialogRef.value?.handleOpen(undefined, {
      title: `工艺维护 · ${row.name}`,
      subtitle: `${row.material?.materialCode || '—'} · ${row.material?.materialName || '未关联产品'}`,
      showConfirmButton: false,
      cancelText: '关闭',
      contentHeight: '72vh',
      loading: true,
      onOpen: async (_data, api) => {
        try {
          Object.assign(references, await fetchProcessRouteReferences(row.tenantId))
          await loadSequences()
          await nextTick()
          await tableRef.value?.getData()
        } finally {
          api.setLoading(false)
        }
      }
    })
  }
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .route-maintenance {
    display: flex;
    flex-direction: column;
    gap: 14px;
    height: 100%;
    min-height: 0;

    &__summary {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 1px;
      overflow: hidden;
      background: var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);

      > span {
        display: grid;
        gap: 3px;
        min-width: 0;
        padding: 12px 14px;
        background: var(--art-gray-100);
      }

      strong {
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--el-text-color-primary);
        white-space: nowrap;
      }

      small {
        color: var(--el-text-color-secondary);
      }
    }

    &__workspace {
      display: grid;
      flex: 1;
      grid-template-columns: minmax(220px, 0.28fr) minmax(0, 1fr);
      gap: 14px;
      min-height: 0;
    }

    :deep(.route-maintenance__sequence-body),
    :deep(.route-maintenance__steps-body) {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
    }

    &__sequence-scroll {
      flex: 1;
      min-height: 0;
    }

    &__sequence {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      min-height: 58px;
      padding: 8px 10px;
      color: var(--el-text-color-regular);
      text-align: left;
      background: transparent;
      border-radius: var(--el-border-radius-base);
      transition:
        background-color var(--art-motion-duration-fast),
        box-shadow var(--art-motion-duration-fast);

      &:hover,
      &.is-current {
        background: color-mix(in srgb, var(--theme-color) 9%, var(--default-box-color));
      }

      &.is-current {
        box-shadow: inset 3px 0 0 var(--theme-color);
      }

      &-select {
        display: grid;
        flex: 1;
        min-width: 0;
        padding: 4px;
        font: inherit;
        color: inherit;
        text-align: left;
        cursor: pointer;
        background: transparent;
        border: 0;
        border-radius: var(--el-border-radius-small);

        &:focus-visible {
          outline: 2px solid var(--theme-color);
          outline-offset: 1px;
        }
      }

      strong,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        margin-top: 3px;
        color: var(--el-text-color-secondary);
      }
    }

    &__sequence-actions,
    &__activity-actions {
      display: flex;
      gap: 2px;
      align-items: center;
    }

    &__steps {
      min-width: 0;
      min-height: 0;
    }

    &__tabs {
      min-height: 520px;
    }

    &__tab-toolbar {
      display: flex;
      gap: 16px;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      color: var(--el-text-color-secondary);
    }

    &__activity-scroll {
      height: 430px;
    }

    &__activity-row {
      display: grid;
      grid-template-columns:
        28px minmax(150px, 1fr) minmax(140px, 1fr) 130px minmax(130px, 0.8fr)
        minmax(140px, 1fr) minmax(180px, 1fr) minmax(180px, 1fr) auto;
      gap: 8px;
      align-items: center;
      min-width: 1280px;
      padding: 8px 4px;
      border-bottom: 1px solid var(--el-border-color-lighter);
    }

    &__activity-index {
      font-variant-numeric: tabular-nums;
      color: var(--el-text-color-secondary);
      text-align: center;
    }

    &__tab-empty {
      display: grid;
      place-items: center;
      min-height: 220px;
      color: var(--el-text-color-secondary);
    }
  }

  @media (width <= 1180px) {
    .route-maintenance {
      &__summary {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      &__workspace {
        grid-template-columns: minmax(190px, 0.34fr) minmax(0, 1fr);
      }
    }
  }
</style>
