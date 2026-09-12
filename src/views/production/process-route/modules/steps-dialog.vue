<template>
  <ArtDialog ref="dialogRef" size="xl">
    <div class="route-maintenance">
      <ArtEntitySummary
        icon="ri:route-line"
        eyebrow="PROCESS ROUTE"
        :title="route?.material?.materialName || '未关联产品'"
        :description="routeSummaryDescription"
      >
        <template #aside>
          <dl class="route-maintenance__readiness" aria-label="工艺路线配置概览">
            <div>
              <dt>工序序列</dt>
              <dd>{{ sequenceState.rows.length }}</dd>
            </div>
            <div>
              <dt>{{ search.keyword ? '匹配工序' : '当前序列工序' }}</dt>
              <dd>{{ stepRows.length }}</dd>
            </div>
          </dl>
          <ElTag :type="readonly ? 'info' : stepRows.length ? 'success' : 'warning'" effect="plain">
            {{ readonly ? '只读查看' : stepRows.length ? '已配置工序' : '待配置工序' }}
          </ElTag>
        </template>
      </ArtEntitySummary>

      <div class="route-maintenance__workspace">
        <ArtSectionCard
          class="route-maintenance__sequences"
          title="标准工序与并行序列"
          :subtitle="`${sequenceState.rows.length} 条路径；标准工序为主路径，并行序列用于部装等分支路线。`"
          :loading="sequenceState.loading"
          :empty="!sequenceState.loading && !sequenceState.rows.length"
          empty-title="暂无工序序列"
          empty-description="先创建一条标准工序序列，再添加路线中的工序节点。"
          body-class="route-maintenance__sequence-body"
          :min-height="320"
        >
          <template v-if="!readonly" #actions>
            <ElButton
              v-auth="'MdmProcessRoute:Edit'"
              type="primary"
              plain
              size="small"
              @click="openSequence()"
            >
              <ArtSvgIcon icon="ri:add-line" />
              新增序列
            </ElButton>
          </template>
          <template v-if="!readonly" #empty-action>
            <ElButton v-auth="'MdmProcessRoute:Edit'" type="primary" @click="openSequence()">
              创建标准工序
            </ElButton>
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
              >
                <span class="route-maintenance__sequence-index">{{ item.sequenceNo }}</span>
                <span class="route-maintenance__sequence-copy">
                  <strong>{{ sequenceTypeLabel(item.sequenceType) }}</strong>
                  <small>{{ item.remark || '未填写序列说明' }}</small>
                </span>
              </button>
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

        <ArtTableQuery
          ref="tableRef"
          v-model="search"
          class="route-maintenance__steps"
          :api-fn="fetchRows"
          :columns-factory="columns"
          :header-actions="actions"
          :search-items="stepSearchItems"
          :enable-cache="false"
          :table-props="{
            rowKey: 'id',
            emptyText: sequenceState.selectedId ? '当前序列还没有工序' : '请先选择工序序列',
            emptyDescription: stepEmptyDescription,
            height: 360
          }"
        >
          <template #table-header-top>
            <div class="route-maintenance__sequence-context">
              <span class="route-maintenance__sequence-context-icon" aria-hidden="true">
                <ArtSvgIcon icon="ri:git-commit-line" />
              </span>
              <div>
                <small>当前工艺路径</small>
                <strong>{{ currentSequenceTitle }}</strong>
                <p>{{ currentSequenceDescription }}</p>
              </div>
            </div>
          </template>
        </ArtTableQuery>
      </div>

      <ArtTableMultipleSelect
        ref="operationSelectRef"
        v-model="selectedOperationIds"
        :selected-data="selectedOperations"
        :api-fn="fetchOperationOptions"
        :columns="operationColumns"
        label-key="name"
        description-key="code"
        title="批量选择工序"
        subtitle="选择工序集条目后，将按 10、20、30… 自动生成工序号"
        search-placeholder="搜索工序编码、名称或助记码"
        empty-text="暂无可选工序"
        empty-description="请先在工序集中维护启用的标准工序。"
        :show-selected-panel="true"
        @confirm="handleOperationsConfirm"
      >
        <template #trigger></template>
      </ArtTableMultipleSelect>
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
    <div class="step-editor">
      <ArtEntitySummary
        class="step-editor__identity"
        icon="ri:settings-3-line"
        eyebrow="PROCESS STEP"
        :title="stepForm.name || '新工序'"
        :description="stepEditorDescription"
      >
        <template #aside>
          <div class="step-editor__identity-aside">
            <span>工序号</span>
            <strong>{{ stepForm.code || '待填写' }}</strong>
          </div>
          <ElTag :type="stepForm.critical ? 'danger' : 'info'" effect="plain">
            {{ stepForm.critical ? '关键工序' : '普通工序' }}
          </ElTag>
        </template>
      </ArtEntitySummary>

      <ElTabs v-model="activeTab" class="step-editor__tabs">
        <ElTabPane v-for="tab in stepTabs" :key="tab.name" :name="tab.name">
          <template #label>
            <span class="step-editor__tab-label">
              <ArtSvgIcon :icon="tab.icon" />
              {{ tab.label }}
              <i v-if="tab.count">{{ tab.count }}</i>
            </span>
          </template>
        </ElTabPane>
      </ElTabs>

      <section class="step-editor__panel">
        <div class="step-editor__section-heading">
          <div>
            <strong>{{ activeStepPanel.title }}</strong>
            <p>{{ activeStepPanel.description }}</p>
          </div>
          <span>{{ activeStepPanel.status }}</span>
        </div>

        <ArtForm
          v-show="activeTab === 'basic'"
          ref="formRef"
          v-model="stepForm"
          :items="lockEditorItems(stepItems)"
          :rules="stepRules"
          :span="12"
          :gutter="24"
          label-position="top"
          :show-reset="false"
          :show-submit="false"
        />
        <div v-show="activeTab === 'unit'" class="step-editor__content">
          <ElAlert
            title="生产单位换算系数 × 生产单位 = 工序单位换算系数 × 工序单位"
            type="info"
            :closable="false"
            show-icon
          />
          <ArtForm
            v-model="unitForm"
            :items="lockEditorItems(unitItems)"
            :span="12"
            :gutter="24"
            label-position="top"
            :show-reset="false"
            :show-submit="false"
          />
          <div class="step-editor__equation" role="status">
            <span>相当于</span>
            <strong>1 {{ route?.productionUnit?.unitName || '生产单位' }}</strong>
            <ArtSvgIcon icon="ri:arrow-right-line" />
            <strong>{{ unitConversionPreview }} {{ operationUnitName }}</strong>
          </div>
        </div>

        <div v-show="activeTab === 'activity'" class="step-editor__content">
          <div class="route-maintenance__tab-toolbar">
            <span>活动公式会自动带入计划与汇报表达式，仍可按工序调整。</span>
            <ElButton
              v-if="!editorReadonly && activityRows.length"
              v-auth="'MdmProcessRoute:Edit'"
              type="primary"
              plain
              @click="addActivity"
              >新增活动</ElButton
            >
          </div>
          <ElScrollbar class="route-maintenance__activity-scroll">
            <ArtEmptyState
              v-if="!activityRows.length"
              class="route-maintenance__tab-empty"
              title="暂无活动配置"
              description="活动用于计算计划与汇报数量，可按需引用活动公式。"
            >
              <template v-if="!editorReadonly" #default>
                <ElButton v-auth="'MdmProcessRoute:Edit'" type="primary" plain @click="addActivity"
                  >新增活动</ElButton
                >
              </template>
            </ArtEmptyState>
            <div v-if="activityRows.length" class="route-maintenance__activity-row is-header">
              <span>#</span><span>活动公式</span><span>活动名称</span><span>活动类型</span
              ><span>基本数量</span><span>活动单位</span><span>资源</span><span>计划活动量公式</span
              ><span>汇报活动量公式</span><span>操作</span>
            </div>
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
                :disabled="editorReadonly"
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
                :disabled="editorReadonly"
              />
              <ElInput
                :model-value="dictLabel('mdmActivityType', activity.activityType)"
                :aria-label="`第 ${index + 1} 行活动类型`"
                readonly
                placeholder="由活动公式带入"
              />
              <ElInputNumber
                v-model="activity.basicQuantity"
                :aria-label="`第 ${index + 1} 行基本数量`"
                :min="0"
                :precision="6"
                controls-position="right"
                :disabled="editorReadonly"
              />
              <ElSelect
                v-model="activity.unitId"
                :aria-label="`第 ${index + 1} 行活动单位`"
                filterable
                clearable
                placeholder="活动单位"
                :disabled="editorReadonly"
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
                :disabled="editorReadonly"
              />
              <ElInput
                v-model="activity.planExpression"
                :aria-label="`第 ${index + 1} 行计划活动量公式`"
                placeholder="计划活动量公式"
                :disabled="editorReadonly"
              />
              <ElInput
                v-model="activity.reportExpression"
                :aria-label="`第 ${index + 1} 行汇报活动量公式`"
                placeholder="汇报活动量公式"
                :disabled="editorReadonly"
              />
              <div class="route-maintenance__activity-actions">
                <ArtIconButton
                  v-if="!editorReadonly"
                  icon="ri:arrow-up-line"
                  label="上移活动"
                  :disabled="index === 0"
                  @click="moveActivity(index, -1)"
                />
                <ArtIconButton
                  v-if="!editorReadonly"
                  icon="ri:arrow-down-line"
                  label="下移活动"
                  :disabled="index === activityRows.length - 1"
                  @click="moveActivity(index, 1)"
                />
                <ArtIconButton
                  v-if="!editorReadonly"
                  icon="ri:delete-bin-6-line"
                  label="删除活动"
                  tone="danger"
                  @click="activityRows.splice(index, 1)"
                />
              </div>
            </div>
          </ElScrollbar>
        </div>

        <div v-show="activeTab === 'outsourcing'" class="step-editor__content">
          <ArtForm
            v-model="outsourcingForm"
            :items="lockEditorItems(outsourcingItems)"
            :span="24"
            label-position="top"
            :show-reset="false"
            :show-submit="false"
          />
        </div>

        <div v-show="activeTab === 'inspection'" class="step-editor__content">
          <ArtForm
            v-model="inspectionForm"
            :items="lockEditorItems(inspectionItems)"
            :span="12"
            :gutter="24"
            label-position="top"
            :show-reset="false"
            :show-submit="false"
          />
        </div>

        <div v-show="activeTab === 'sop'" class="step-editor__content">
          <ArtForm
            v-model="sopForm"
            :items="lockEditorItems(sopItems)"
            :span="24"
            label-position="top"
            :show-reset="false"
            :show-submit="false"
          >
            <template #attachments>
              <div class="step-editor__upload">
                <ArtUploadFile
                  v-model="sopForm.attachments"
                  multiple
                  :limit="10"
                  :disabled="editorReadonly"
                  title="上传作业指导书"
                  tip="支持上传附件，也可选择工程主数据中的 ESOP 文档。"
                />
              </div>
            </template>
          </ArtForm>
        </div>
      </section>
    </div>
  </ArtDialog>
</template>

<script setup lang="tsx">
  import { cloneDeep } from 'lodash-es'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import ArtUploadFile from '@/components/core/forms/art-upload-file/index.vue'
  import ArtTableMultipleSelect from '@/components/core/forms/art-data-select/table-multiple.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    DataSelectFetchParams,
    DataSelectKey,
    DataSelectRecord
  } from '@/components/core/forms/art-data-select/types'
  import { useUserStore } from '@/store/modules/user'
  import {
    deleteProcessSequence,
    deleteProcessStep,
    deleteProcessSteps,
    fetchOperationalMaster,
    fetchProcessRouteReferences,
    fetchProcessSequences,
    fetchProcessSteps,
    fetchWorkCenterActivities,
    saveProcessSequence,
    saveProcessStep,
    saveProcessSteps,
    type ProcessRoute,
    type ProcessRouteReferences,
    type ProcessSequence,
    type ProcessStep,
    type ProcessStepInput,
    type OperationalMasterRecord,
    type WorkspaceQuery
  } from '@mdm/api'
  import { buildProcessSequencePayload, buildProcessStepPayload } from './process-route-payload'

  interface ActivityRow {
    key: string
    formulaId: string
    activityType: string
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
  const operationSelectRef = ref<InstanceType<typeof ArtTableMultipleSelect>>()
  const route = shallowRef<ProcessRoute>()
  const readonly = ref(false)
  const editorReadonly = ref(false)
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
  const stepRows = ref<ProcessStep[]>([])
  const mainStepRows = ref<ProcessStep[]>([])
  const selectedOperationIds = ref<DataSelectKey[]>([])
  const selectedOperations = ref<OperationalMasterRecord[]>([])
  const operationColumns = [
    { prop: 'code', label: '工序编码', minWidth: 140 },
    { prop: 'name', label: '工序名称', minWidth: 180 },
    { prop: 'mnemonic', label: '助记码', minWidth: 120 },
    { prop: 'remark', label: '工序说明', minWidth: 220 }
  ]
  const initialSequence = () => ({
    sequenceNo: 1,
    sequenceType: 'main',
    transferInStepId: null as string | null,
    transferOutStepId: null as string | null,
    remark: '标准工序'
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
    processingMode: '',
    reportMode: '',
    inspectionMode: '',
    sequenceControl: '',
    reworkMode: '',
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
  const outsourcingForm = reactive({
    enabled: false,
    purchaseOrganization: '',
    supplierId: '',
    unitPrice: null as number | null,
    remark: ''
  })
  const inspectionForm = reactive({ method: '', standard: '', samplingRule: '', remark: '' })
  const sopForm = reactive({ documentIds: [] as string[], attachments: [] as string[] })
  const activityRows = ref<ActivityRow[]>([])
  const sequenceTypeLabel = (value: string) =>
    value === 'main'
      ? '标准工序'
      : getDictMap.value.mdmProcessRouteSequenceType?.find((item) => item.value === value)?.label ||
        value
  const currentSequence = computed(() =>
    sequenceState.rows.find((item) => item.id === sequenceState.selectedId)
  )
  const routeSummaryDescription = computed(() =>
    [
      route.value?.code,
      route.value?.name,
      route.value?.version || '默认版本',
      route.value?.productionUnit?.unitName || '多单位共用'
    ]
      .filter(Boolean)
      .join(' · ')
  )
  const currentSequenceSubtitle = computed(() =>
    currentSequence.value
      ? `${currentSequence.value.sequenceNo} · ${sequenceTypeLabel(currentSequence.value.sequenceType)}`
      : '请选择左侧工序序列'
  )
  const stepEditorDescription = computed(
    () => `${route.value?.name || '工艺路线'} · ${currentSequenceSubtitle.value}`
  )
  const stepTabs = computed(() => [
    { name: 'basic', label: '工序明细', icon: 'ri:file-list-3-line', count: 0 },
    { name: 'unit', label: '单位换算', icon: 'ri:exchange-line', count: 0 },
    {
      name: 'activity',
      label: '活动信息',
      icon: 'ri:function-line',
      count: activityRows.value.length
    },
    {
      name: 'outsourcing',
      label: '委外信息',
      icon: 'ri:truck-line',
      count: outsourcingForm.enabled ? 1 : 0
    },
    {
      name: 'inspection',
      label: '检验信息',
      icon: 'ri:shield-check-line',
      count: stepForm.needInspection ? 1 : 0
    },
    {
      name: 'sop',
      label: '作业指导书',
      icon: 'ri:file-shield-2-line',
      count: sopForm.documentIds.length + sopForm.attachments.length
    }
  ])
  const operationUnitName = computed(
    () =>
      references.units.find((item) => item.id === unitForm.operationUnitId)?.name ||
      references.units.find((item) => item.id === stepForm.unitId)?.name ||
      '工序单位'
  )
  const unitConversionPreview = computed(() => {
    const productionFactor = Number(unitForm.productionFactor) || 1
    const operationFactor = Number(unitForm.operationFactor) || 1
    return (productionFactor / operationFactor).toLocaleString('zh-CN', {
      maximumFractionDigits: 6
    })
  })
  const activeStepPanel = computed(() => {
    const count = sopForm.documentIds.length + sopForm.attachments.length
    return (
      {
        basic: {
          title: '工序执行基础',
          description: '定义工序身份、执行组织、批量与控制属性。',
          status: '工序序列与名称为必填项'
        },
        unit: {
          title: '生产与工序单位换算',
          description: '维护生产单位和工序执行单位之间的数量关系。',
          status: '默认按 1 : 1 换算'
        },
        activity: {
          title: '活动量与资源消耗',
          description: '按执行顺序维护计划、汇报表达式与资源。',
          status: `已配置 ${activityRows.value.length} 项`
        },
        outsourcing: {
          title: '委外加工约束',
          description: '启用委外时，指定供应商并记录业务说明。',
          status: outsourcingForm.enabled ? '已启用委外' : '未启用委外'
        },
        inspection: {
          title: '质量检验要求',
          description: '维护检验方式、标准、抽样规则与首检控制。',
          status: stepForm.needInspection ? '需要检验' : '无需检验'
        },
        sop: {
          title: '受控作业指导资料',
          description: '关联工程主数据中的 ESOP，或上传工序专用附件。',
          status: `已关联 ${count} 份`
        }
      } as const
    )[activeTab.value as 'basic' | 'unit' | 'activity' | 'outsourcing' | 'inspection' | 'sop']
  })
  const currentSequenceTitle = computed(() =>
    currentSequence.value
      ? `${currentSequence.value.sequenceNo} · ${sequenceTypeLabel(currentSequence.value.sequenceType)}`
      : '尚未选择序列'
  )
  const currentSequenceDescription = computed(() =>
    currentSequence.value
      ? currentSequence.value.remark || '维护该路径下的工序、工作中心与工艺参数。'
      : '从左侧选择现有序列，或创建一条新的工艺路径。'
  )
  const stepEmptyDescription = computed(() =>
    sequenceState.selectedId
      ? readonly.value
        ? '该路径尚未配置工序。'
        : '新增首道工序后，可继续维护单位换算、活动、委外、检验和作业指导书。'
      : '请先在左侧选择或新增一条工序序列。'
  )
  const stepSearchItems = computed<SearchFormItem[]>(() =>
    stepRows.value.length || search.keyword
      ? [
          {
            key: 'keyword',
            label: '工序',
            type: 'input',
            props: { clearable: true, placeholder: '搜索工序号、名称或说明' }
          }
        ]
      : []
  )
  const option = (rows: Array<{ id: string; code: string; name: string }>) =>
    rows.map((item) => ({ label: `${item.name} · ${item.code}`, value: item.id }))
  const dictLabel = (code: string, value: string): string =>
    getDictMap.value[code]?.find((item) => item.value === value)?.label || value || '—'
  const lockEditorItems = (items: FormItem[]): FormItem[] =>
    editorReadonly.value
      ? items.map((item) => ({ ...item, props: { ...item.props, disabled: true } }))
      : items
  const fetchOperationOptions = (params: DataSelectFetchParams) =>
    fetchOperationalMaster('operation', {
      tenantId: route.value?.tenantId || user.info.tenantId || '',
      current: params.page,
      size: params.pageSize,
      keyword: params.keyword,
      enabled: true
    })

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
      options: transferInStepOptions.value,
      props: {
        clearable: true,
        filterable: true,
        disabled: sequenceForm.sequenceType !== 'parallel',
        placeholder: '选择标准工序中的前置工序'
      },
      help: '仅并行序列可设置，不能选择标准工序的末序。'
    },
    {
      key: 'transferOutStepId',
      label: '转出工序',
      type: 'select',
      options: transferOutStepOptions.value,
      props: {
        clearable: true,
        filterable: true,
        disabled: sequenceForm.sequenceType !== 'parallel',
        placeholder: '选择返回标准工序的位置'
      },
      help: '仅并行序列可设置，不能选择标准工序的首序。'
    },
    { key: 'remark', label: '备注', type: 'textarea', props: { rows: 3, maxlength: 500 } }
  ])
  const transferInStepOptions = computed(() =>
    mainStepRows.value
      .filter((item) => !item.isLast)
      .map((item) => ({ label: `${item.code}｜${item.name}`, value: item.id }))
  )
  const transferOutStepOptions = computed(() =>
    mainStepRows.value
      .filter((item) => !item.isFirst)
      .map((item) => ({ label: `${item.code}｜${item.name}`, value: item.id }))
  )
  const sequenceRules = {
    sequenceNo: [{ required: true, message: '请输入工序序列号', trigger: 'blur' }],
    sequenceType: [{ required: true, message: '请选择序列类型', trigger: 'change' }],
    transferOutStepId: [
      {
        validator: (_rule: unknown, value: string | null, callback: (error?: Error) => void) =>
          sequenceForm.sequenceType !== 'parallel' || sequenceForm.transferInStepId || value
            ? callback()
            : callback(new Error('并行序列的转入工序和转出工序不能同时为空')),
        trigger: 'change'
      }
    ]
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
      props: { clearable: true, filterable: true, onChange: applyWorkCenter }
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
      props: { clearable: true, filterable: true, onChange: applyControlCode }
    },
    {
      key: 'processingMode',
      label: '加工类型',
      type: 'select',
      options: getDictMap.value.mdmProcessingMode ?? [],
      props: { disabled: true, placeholder: '由工序控制码带入' }
    },
    {
      key: 'reportMode',
      label: '汇报方式',
      type: 'select',
      options: getDictMap.value.mdmReportMode ?? [],
      props: { disabled: true, placeholder: '由工序控制码带入' }
    },
    {
      key: 'inspectionMode',
      label: '检验方式',
      type: 'select',
      options: getDictMap.value.mdmInspectionMode ?? [],
      props: { disabled: true, placeholder: '由工序控制码带入' }
    },
    {
      key: 'sequenceControl',
      label: '汇报顺序控制',
      type: 'select',
      options: getDictMap.value.mdmSequenceControl ?? [],
      props: { disabled: true, placeholder: '由工序控制码带入' }
    },
    {
      key: 'reworkMode',
      label: '返工方式',
      type: 'select',
      options: getDictMap.value.mdmReworkMode ?? [],
      props: { disabled: true, placeholder: '由工序控制码带入' }
    },
    { key: 'needInspection', label: '工序质检', type: 'switch' },
    { key: 'firstInspection', label: '首检', type: 'switch' },
    {
      key: 'firstInspectionControl',
      label: '首检控制',
      type: 'select',
      options: getDictMap.value.mdmProcessSequenceControlMode ?? []
    },
    {
      key: 'isFirst',
      label: '首序',
      type: 'switch',
      props: { disabled: true },
      help: '由当前序列中的工序顺序自动识别'
    },
    {
      key: 'isLast',
      label: '末序',
      type: 'switch',
      props: { disabled: true },
      help: '由当前序列中的工序顺序自动识别'
    },
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
      key: 'purchaseOrganization',
      label: '采购组织',
      type: 'select',
      options: getDictMap.value.mdmMaterialPurchaseOrganization ?? [],
      props: { clearable: true, disabled: !outsourcingForm.enabled }
    },
    {
      key: 'supplierId',
      label: '供应商',
      type: 'select',
      options: option(references.suppliers),
      props: { clearable: true, filterable: true, disabled: !outsourcingForm.enabled }
    },
    {
      key: 'unitPrice',
      label: '委外单价（元）',
      type: 'number',
      props: {
        min: 0,
        precision: 4,
        class: '!w-full',
        disabled: !outsourcingForm.enabled
      }
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
    ...(!readonly.value ? [{ type: 'selection' as const, width: 48, reserveSelection: true }] : []),
    {
      prop: 'sequence',
      label: '工序序列',
      width: 96,
      formatter: (row) => row.sequence?.sequenceNo ?? '—'
    },
    {
      prop: 'sequenceType',
      label: '序列类型',
      width: 110,
      formatter: (row) => sequenceTypeLabel(row.sequence?.sequenceType || '')
    },
    { prop: 'code', label: '工序号', width: 100 },
    { prop: 'name', label: '工序名称', minWidth: 150, showOverflowTooltip: true },
    {
      prop: 'operation',
      label: '工序编码',
      minWidth: 140,
      formatter: (row) => row.operation?.code || '自定义'
    },
    { prop: 'description', label: '工序说明', minWidth: 180, showOverflowTooltip: true },
    {
      prop: 'unit',
      label: '工序单位',
      width: 110,
      formatter: (row) => row.unit?.unitName || '未指定'
    },
    { prop: 'basicBatch', label: '基本批量', width: 100, align: 'right' },
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
    {
      prop: 'operationMode',
      label: '作业类型',
      width: 110,
      formatter: (row) => dictLabel('mdmProcessOperationMode', row.operationMode)
    },
    {
      prop: 'controlCode',
      label: '工序控制码',
      minWidth: 140,
      formatter: (row) => row.controlCode?.controlCodeName || '未指定'
    },
    {
      prop: 'processingMode',
      label: '加工类型',
      width: 110,
      formatter: (row) => dictLabel('mdmProcessingMode', row.processingMode)
    },
    {
      prop: 'reportMode',
      label: '汇报方式',
      width: 110,
      formatter: (row) => dictLabel('mdmReportMode', row.reportMode)
    },
    {
      prop: 'inspectionMode',
      label: '检验方式',
      width: 110,
      formatter: (row) => dictLabel('mdmInspectionMode', row.inspectionMode)
    },
    {
      prop: 'sequenceControl',
      label: '汇报顺序控制',
      width: 130,
      formatter: (row) => dictLabel('mdmSequenceControl', row.sequenceControl)
    },
    {
      prop: 'reworkMode',
      label: '返工方式',
      width: 110,
      formatter: (row) => dictLabel('mdmReworkMode', row.reworkMode)
    },
    {
      prop: 'needInspection',
      label: '工序质检',
      width: 92,
      align: 'center',
      formatter: (row) => (row.needInspection ? '是' : '否')
    },
    {
      prop: 'firstInspection',
      label: '首检',
      width: 72,
      align: 'center',
      formatter: (row) => (row.firstInspection ? '是' : '否')
    },
    {
      prop: 'firstInspectionControl',
      label: '首检控制方式',
      width: 130,
      formatter: (row) => dictLabel('mdmProcessSequenceControlMode', row.firstInspectionControl)
    },
    {
      prop: 'isFirst',
      label: '首序',
      width: 72,
      align: 'center',
      formatter: (row) => (row.isFirst ? '是' : '否')
    },
    {
      prop: 'isLast',
      label: '末序',
      width: 72,
      align: 'center',
      formatter: (row) => (row.isLast ? '是' : '否')
    },
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
            prop: '__actions',
            label: '操作',
            width: 176,
            fixed: 'right' as const,
            formatter: (row: ProcessStep) => (
              <BusinessTableRowActions>
                <ArtButtonTable
                  type="view"
                  permission="MdmProcessRoute:View"
                  onClick={() => void openStep(row, 'view')}
                />
                <ArtButtonTable
                  type="edit"
                  permission="MdmProcessRoute:Edit"
                  onClick={() => void openStep(row)}
                />
                <ArtButtonTable
                  icon="ri:file-copy-line"
                  label="复制工序"
                  permission="MdmProcessRoute:Edit"
                  onClick={() => void openStep(row, 'copy')}
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
            label: stepRows.value.length ? '新增' : '新增首道工序',
            permission: 'MdmProcessRoute:Edit',
            disabled: !sequenceState.selectedId,
            onClick: () => void openOperationSelector()
          },
          {
            key: 'insert',
            label: '插入行',
            icon: 'ri:insert-row-bottom',
            permission: 'MdmProcessRoute:Edit',
            selectionRequired: true,
            disabled: ({ selectedCount }: ArtTableQueryHeaderActionContext) => selectedCount !== 1,
            onClick: ({ selectedRows }) => void openStep(selectedRows[0] as ProcessStep, 'insert')
          },
          {
            key: 'copy',
            label: '复制',
            icon: 'ri:file-copy-line',
            permission: 'MdmProcessRoute:Edit',
            selectionRequired: true,
            disabled: ({ selectedCount }: ArtTableQueryHeaderActionContext) => selectedCount !== 1,
            onClick: ({ selectedRows }) => void openStep(selectedRows[0] as ProcessStep, 'copy')
          },
          {
            key: 'view',
            label: '查看',
            icon: 'ri:eye-line',
            selectionRequired: true,
            disabled: ({ selectedCount }: ArtTableQueryHeaderActionContext) => selectedCount !== 1,
            onClick: ({ selectedRows }) => void openStep(selectedRows[0] as ProcessStep, 'view')
          },
          {
            key: 'edit',
            label: '编辑',
            icon: 'ri:edit-line',
            permission: 'MdmProcessRoute:Edit',
            selectionRequired: true,
            disabled: ({ selectedCount }: ArtTableQueryHeaderActionContext) => selectedCount !== 1,
            onClick: ({ selectedRows }) => void openStep(selectedRows[0] as ProcessStep, 'edit')
          },
          {
            type: 'delete',
            label: '删除',
            permission: 'MdmProcessRoute:Edit',
            content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
              `确认删除选中的 ${selectedCount} 道工序？`,
            onClick: async ({ selectedRows, api }) => {
              await deleteProcessSteps((selectedRows as ProcessStep[]).map((item) => item.id))
              await Promise.all([api.refreshRemove(), loadSequences()])
            }
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
      const mainSequenceId = sequenceState.rows.find((item) => item.sequenceType === 'main')?.id
      if (mainSequenceId) {
        const mainSteps = await fetchProcessSteps({
          tenantId: route.value.tenantId,
          routeId: route.value.id,
          sequenceId: mainSequenceId,
          current: 1,
          size: 1000
        })
        mainStepRows.value = mainSteps.data
      } else {
        mainStepRows.value = []
      }
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
          if (sequenceForm.sequenceType !== 'parallel') {
            sequenceForm.transferInStepId = null
            sequenceForm.transferOutStepId = null
          }
          await saveProcessSequence(
            buildProcessSequencePayload({ routeId: route.value!.id, ...sequenceForm }),
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
  async function applyWorkCenter(value: string) {
    const center = references.workCenters.find((item) => item.id === value)
    if (!center) return
    if (center.departmentId) stepForm.departmentId = center.departmentId
    const activities = await fetchWorkCenterActivities(value)
    activityRows.value = activities.map((item) => ({
      key: crypto.randomUUID(),
      formulaId: item.planFormulaId || item.reportFormulaId || '',
      activityType: item.activityType,
      name: item.activityName,
      basicQuantity: item.baseQuantity,
      unitId:
        references.units.find(
          (unit) => unit.id === item.activityUnit || unit.code === item.activityUnit
        )?.id || '',
      resource: '',
      planExpression: item.planFormula?.expression || '',
      reportExpression: item.reportFormula?.expression || ''
    }))
  }
  function applyControlCode(value: string) {
    const controlCode = references.controlCodes.find((item) => item.id === value)
    Object.assign(stepForm, {
      processingMode: controlCode?.processingMode || '',
      reportMode: controlCode?.reportMode || '',
      inspectionMode: controlCode?.inspectionMode || '',
      sequenceControl: controlCode?.sequenceControl || '',
      reworkMode: controlCode?.reworkMode || '',
      needInspection: Boolean(controlCode?.inspectionMode && controlCode.inspectionMode !== 'none')
    })
  }
  function applyFormula(row: ActivityRow) {
    const formula = references.activityFormulas.find((item) => item.id === row.formulaId)
    if (!formula) return
    row.activityType = formula.activityType || ''
    row.name ||= formula.name
    row.planExpression = formula.planExpression || ''
    row.reportExpression = formula.reportExpression || ''
  }
  function addActivity() {
    activityRows.value.push({
      key: crypto.randomUUID(),
      formulaId: '',
      activityType: '',
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
  async function openOperationSelector() {
    if (!sequenceState.selectedId) return
    selectedOperationIds.value = []
    selectedOperations.value = []
    await operationSelectRef.value?.open()
  }
  async function handleOperationsConfirm(_value: unknown, rows: DataSelectRecord[]) {
    if (!route.value || !sequenceState.selectedId || !rows.length) return
    const operations = rows as OperationalMasterRecord[]
    const baseSort = Math.max(0, ...stepRows.value.map((item) => item.sort))
    const inputs = operations.map((operation, index) => {
      const sort = baseSort + (index + 1) * 10
      return buildProcessStepPayload({
        routeId: route.value!.id,
        ...initialStep(),
        sequenceId: sequenceState.selectedId,
        code: String(sort),
        sort,
        operationId: operation.id,
        name: operation.name || operation.code || `工序 ${sort}`,
        description: operation.remark || operation.name || '',
        unitId: route.value!.productionUnitId,
        workCenterId: operation.workCenterIds?.[0] || null,
        departmentId: operation.departmentId || route.value!.departmentId,
        isFirst: stepRows.value.length === 0 && index === 0,
        isLast: index === operations.length - 1
      })
    })
    await saveProcessSteps(inputs)
    selectedOperationIds.value = []
    selectedOperations.value = []
    await Promise.all([tableRef.value?.refreshData(), loadSequences()])
  }
  type StepOpenMode = 'add' | 'insert' | 'copy' | 'view' | 'edit'
  const insertionSort = (anchor?: ProcessStep): number => {
    if (!anchor) return Math.max(0, ...stepRows.value.map((item) => item.sort)) + 10
    const rows = [...stepRows.value].sort((left, right) => left.sort - right.sort)
    const index = rows.findIndex((item) => item.id === anchor.id)
    const nextSort = rows[index + 1]?.sort
    return nextSort && nextSort - anchor.sort > 1
      ? Math.floor((anchor.sort + nextSort) / 2)
      : anchor.sort + 1
  }
  async function openStep(row?: ProcessStep, mode: StepOpenMode = row ? 'edit' : 'add') {
    if (!route.value || !sequenceState.selectedId) return
    const editing = mode === 'edit'
    const viewing = mode === 'view'
    const cloning = mode === 'copy'
    const inserting = mode === 'insert'
    editorReadonly.value = viewing || readonly.value
    stepEditId.value = editing ? row?.id || '' : ''
    const nextSort = insertionSort(inserting ? row : undefined)
    Object.assign(
      stepForm,
      row && !inserting
        ? {
            ...cloneDeep(row),
            ...(cloning
              ? { code: String(nextSort), sort: nextSort, isFirst: false, isLast: false }
              : {})
          }
        : {
            ...initialStep(),
            sequenceId: sequenceState.selectedId,
            code: String(nextSort),
            sort: nextSort,
            unitId: route.value.productionUnitId,
            departmentId: route.value.departmentId,
            isFirst: stepRows.value.length === 0,
            isLast: true
          }
    )
    Object.assign(unitForm, {
      productionFactor: 1,
      operationFactor: 1,
      operationUnitId: stepForm.unitId || '',
      ...(!inserting && row?.unitConversion ? row.unitConversion : {})
    })
    Object.assign(outsourcingForm, {
      enabled: false,
      purchaseOrganization: '',
      supplierId: '',
      unitPrice: null,
      remark: '',
      ...(!inserting && row?.outsourcing ? row.outsourcing : {})
    })
    Object.assign(inspectionForm, {
      method: '',
      standard: '',
      samplingRule: '',
      remark: '',
      ...(!inserting && row?.inspection ? row.inspection : {})
    })
    activityRows.value = (!inserting ? row?.activities || [] : []).map((item) => ({
      key: crypto.randomUUID(),
      formulaId: '',
      activityType: '',
      name: '',
      basicQuantity: 1,
      unitId: '',
      resource: '',
      planExpression: '',
      reportExpression: '',
      ...item
    })) as ActivityRow[]
    const sop = !inserting ? row?.sopDocuments || [] : []
    sopForm.documentIds = sop.filter((item) => item.type === 'esop').map((item) => String(item.id))
    sopForm.attachments = sop
      .filter((item) => item.type === 'upload')
      .map((item) => String(item.url))
    activeTab.value = 'basic'
    await editDialog.value?.handleOpen(undefined, {
      title: viewing
        ? '查看工序明细'
        : editing
          ? '编辑工序明细'
          : cloning
            ? '复制工序明细'
            : inserting
              ? '插入工序明细'
              : '新增工序明细',
      subtitle: currentSequenceSubtitle.value,
      confirmText: editing ? '保存更改' : '创建工序',
      showConfirmButton: !editorReadonly.value,
      cancelText: editorReadonly.value ? '关闭' : '取消',
      contentMaxHeight: '72vh',
      onOpen: () => formRef.value?.clearValidate(),
      onConfirm: async () => {
        if (editorReadonly.value) return true
        try {
          await formRef.value?.validate()
          await saveProcessStep(
            buildProcessStepPayload({
              routeId: route.value!.id,
              ...stepForm,
              unitConversion: cloneDeep(unitForm),
              activities: activityRows.value.map((item) => ({
                formulaId: item.formulaId,
                activityType: item.activityType,
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
            }),
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
      await Promise.all([tableRef.value?.refreshData(), loadSequences()])
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
        'mdmProcessStepInspectionMode',
        'mdmProcessingMode',
        'mdmReportMode',
        'mdmInspectionMode',
        'mdmSequenceControl',
        'mdmReworkMode',
        'mdmMaterialPurchaseOrganization',
        'mdmActivityType'
      ].map((code) => user.ensureDictLoaded(code))
    )
    await dialogRef.value?.handleOpen(undefined, {
      title: `工艺维护 · ${row.name}`,
      subtitle: `${row.material?.materialCode || '—'} · ${row.material?.materialName || '未关联产品'}`,
      showConfirmButton: false,
      cancelText: '关闭',
      contentMaxHeight: '72vh',
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
    gap: var(--art-space-4);
    min-height: 0;

    &__readiness {
      display: flex;
      gap: var(--art-space-4);
      align-items: center;
      margin: 0 var(--art-space-3) 0 0;

      > div {
        display: grid;
        gap: 1px;
        min-width: 72px;
      }

      dt {
        font-size: var(--art-font-size-caption);
        color: var(--el-text-color-secondary);
      }

      dd {
        margin: 0;
        font-size: 18px;
        font-weight: 650;
        font-variant-numeric: tabular-nums;
        line-height: 22px;
        color: var(--el-text-color-primary);
      }
    }

    &__workspace {
      display: grid;
      grid-template-columns: minmax(272px, 0.32fr) minmax(0, 1fr);
      gap: var(--art-space-4);
      min-height: 0;
    }

    &__sequences {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    :deep(.route-maintenance__sequence-body) {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
    }

    &__sequence-scroll {
      flex: 1;
      height: 100%;
      min-height: 0;
    }

    &__sequence {
      display: flex;
      gap: var(--art-space-2);
      align-items: center;
      justify-content: space-between;
      width: 100%;
      min-height: 64px;
      padding: var(--art-space-2);
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
        grid-template-columns: 34px minmax(0, 1fr);
        gap: var(--art-space-2);
        align-items: center;
        min-width: 0;
        min-height: 44px;
        padding: var(--art-space-1);
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
        color: var(--el-text-color-secondary);
      }
    }

    &__sequence-index {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      font-size: 12px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 9%, var(--default-box-color));
      border: 1px solid color-mix(in srgb, var(--theme-color) 18%, var(--art-card-border));
      border-radius: var(--art-control-radius);
    }

    &__sequence-copy {
      display: grid;
      gap: 2px;
      min-width: 0;
    }

    &__sequence-actions,
    &__activity-actions {
      display: flex;
      gap: 2px;
      align-items: center;
    }

    &__steps {
      min-width: 0;
      height: 100%;
      min-height: 0;
    }

    &__sequence-context {
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr);
      gap: var(--art-space-3);
      align-items: center;
      padding: var(--art-space-3);
      background: color-mix(in srgb, var(--theme-color) 6%, var(--default-box-color));
      border-radius: var(--art-control-radius);

      &-icon {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        font-size: 18px;
        color: var(--theme-color);
        background: var(--default-box-color);
        border: 1px solid color-mix(in srgb, var(--theme-color) 14%, var(--art-card-border));
        border-radius: var(--art-control-radius);
      }

      > div {
        min-width: 0;
      }

      small,
      strong,
      p {
        display: block;
        margin: 0;
      }

      small {
        font-size: 10px;
        font-weight: 700;
        line-height: 16px;
        color: var(--theme-color);
        letter-spacing: 0.08em;
      }

      strong {
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: var(--art-font-size-body);
        line-height: 22px;
        color: var(--el-text-color-primary);
        white-space: nowrap;
      }

      p {
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: var(--art-font-size-caption);
        line-height: 19px;
        color: var(--el-text-color-secondary);
        white-space: nowrap;
      }
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
        28px minmax(150px, 1fr) minmax(140px, 1fr) minmax(120px, 0.8fr) 130px
        minmax(130px, 0.8fr)
        minmax(140px, 1fr) minmax(180px, 1fr) minmax(180px, 1fr) auto;
      gap: 8px;
      align-items: center;
      min-width: 1420px;
      padding: 8px 4px;
      border-bottom: 1px solid var(--el-border-color-lighter);

      &.is-header {
        position: sticky;
        top: 0;
        z-index: 2;
        min-height: 40px;
        padding-block: 10px;
        font-size: var(--art-font-size-caption);
        font-weight: 600;
        color: var(--el-text-color-secondary);
        background: var(--el-fill-color-light);
        border-radius: var(--art-control-radius) var(--art-control-radius) 0 0;
      }
    }

    &__activity-index {
      font-variant-numeric: tabular-nums;
      color: var(--el-text-color-secondary);
      text-align: center;
    }

    &__tab-empty {
      min-height: 220px;
    }
  }

  .step-editor {
    display: grid;
    gap: 0;

    &__identity {
      margin-bottom: var(--art-space-2);
    }

    &__identity-aside {
      display: grid;
      gap: 1px;
      min-width: 72px;

      span {
        font-size: var(--art-font-size-caption);
        color: var(--el-text-color-secondary);
      }

      strong {
        font-size: var(--art-font-size-body);
        font-variant-numeric: tabular-nums;
        color: var(--el-text-color-primary);
      }
    }

    &__tabs {
      :deep(.el-tabs__header) {
        margin: 0;
      }

      :deep(.el-tabs__nav-wrap::after) {
        height: 1px;
        background: var(--el-border-color-lighter);
      }

      :deep(.el-tabs__item) {
        min-width: 128px;
        height: 40px;
        padding: 0 var(--art-space-4);
      }

      :deep(.el-tabs__content) {
        display: none;
      }
    }

    &__tab-label {
      display: inline-flex;
      gap: var(--art-space-2);
      align-items: center;

      i {
        display: inline-grid;
        place-items: center;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        font-size: 10px;
        font-style: normal;
        color: var(--theme-color);
        background: color-mix(in srgb, var(--theme-color) 10%, transparent);
        border-radius: 999px;
      }
    }

    &__panel {
      min-height: 470px;
      padding: var(--art-space-4);
      background: color-mix(in srgb, var(--el-fill-color-extra-light) 45%, var(--el-bg-color));
      border: 1px solid var(--el-border-color-lighter);
      border-top: 0;
      border-radius: 0 0 var(--el-border-radius-base) var(--el-border-radius-base);
    }

    &__section-heading {
      display: flex;
      gap: var(--art-space-3);
      align-items: center;
      justify-content: space-between;
      padding-bottom: var(--art-space-3);
      margin-bottom: var(--art-space-3);
      border-bottom: 1px solid var(--el-border-color-extra-light);

      strong,
      p {
        display: block;
        margin: 0;
      }

      p,
      > span {
        margin-top: 3px;
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }

      > span {
        flex: none;
        padding: 4px 8px;
        background: var(--el-fill-color-lighter);
        border-radius: 999px;
      }
    }

    &__content {
      display: grid;
      gap: var(--art-space-3);
    }

    &__equation {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1fr);
      gap: var(--art-space-3);
      align-items: center;
      padding: var(--art-space-3) var(--art-space-4);
      color: var(--el-text-color-secondary);
      background: color-mix(in srgb, var(--theme-color) 5%, var(--el-bg-color));
      border: 1px solid color-mix(in srgb, var(--theme-color) 14%, var(--art-card-border));
      border-radius: var(--art-control-radius);

      strong {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--el-text-color-primary);
        white-space: nowrap;
      }

      svg {
        color: var(--theme-color);
      }
    }

    &__upload {
      padding: var(--art-space-3);
      background: var(--el-bg-color);
      border: 1px dashed var(--el-border-color);
      border-radius: var(--el-border-radius-base);
      transition: border-color var(--art-motion-duration-fast) ease;

      &:focus-within,
      &:hover {
        border-color: var(--theme-color);
      }
    }
  }

  @media (width <= 1180px) {
    .route-maintenance {
      &__readiness {
        gap: var(--art-space-3);
      }

      &__workspace {
        grid-template-columns: minmax(236px, 0.34fr) minmax(0, 1fr);
      }
    }
  }

  @media (width <= 900px) {
    .route-maintenance {
      &__workspace {
        grid-template-columns: minmax(0, 1fr);
      }

      &__sequence-scroll {
        height: 200px;
      }
    }

    .step-editor {
      &__tabs {
        :deep(.el-tabs__item) {
          min-width: auto;
          padding: 0 var(--art-space-3);
        }
      }

      &__panel {
        padding: var(--art-space-3);
      }

      &__section-heading {
        align-items: flex-start;

        > span {
          display: none;
        }
      }
    }
  }
</style>
