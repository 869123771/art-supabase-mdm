<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="center-dialog">
      <ElAlert v-if="form.error" :title="form.error" type="error" :closable="false" show-icon />
      <ElTabs v-model="form.tab" stretch>
        <ElTabPane label="基本资料" name="基本资料">
          <ArtSectionCard
            title="工作中心资料"
            subtitle="维护生产资源身份、所属组织与默认人员安排。"
            preserve-content-structure
          >
            <ArtDescriptions
              v-if="form.readonly"
              :data="basicDisplay"
              :items="basicDescriptions"
              :columns="2"
            />
            <ArtForm
              v-else
              ref="formRef"
              v-model="form.model"
              :items="basicItems"
              :rules="rules"
              :span="12"
              label-position="top"
              :show-reset="false"
              :show-submit="false"
            >
              <template #mainCenterId
                ><ArtTableSingleSelect
                  :model-value="form.model.mainCenterId || undefined"
                  @update:model-value="
                    form.model.mainCenterId = $event == null ? null : String($event)
                  "
                  :selected-data="form.mainSelection"
                  :api-fn="fetchCenters"
                  :columns="[
                    { prop: 'code', label: '工作中心', minWidth: 150 },
                    { prop: 'name', label: '名称', minWidth: 160 }
                  ]"
                  label-key="code"
                  placeholder="本工作中心（默认）"
                  :disabled-key="disabledCenter"
              /></template>
              <template #personIds
                ><ArtEmployeeSelect
                  multiple
                  v-model:model-values="form.model.personIds"
                  v-model:selected-data="form.people"
                  :api-fn="fetchProductionPersonSelector"
                  :display-fields="['jobTitle', 'employmentStatus']"
                  title="选择生产人员"
                  subtitle="从人员配置选择参与生产的人员"
                  search-placeholder="姓名 / 工号"
              /></template>
            </ArtForm>
          </ArtSectionCard>
        </ElTabPane>
        <ElTabPane v-for="section in sections" :key="section" :label="section" :name="section" lazy>
          <ArtSectionCard
            :title="section"
            :subtitle="sectionMeta[section].description"
            preserve-content-structure
          >
            <template v-if="section === '自动化' && !form.readonly" #actions>
              <ElButton type="primary" @click="configureAutomation">配置自动化</ElButton>
            </template>
            <div class="center-dialog__policy-intro">
              <span aria-hidden="true"><ArtSvgIcon :icon="sectionMeta[section].icon" /></span>
              <p>{{ sectionMeta[section].hint }}</p>
            </div>
            <PolicyEditor
              v-model="form.model.policy"
              :section="section"
              :readonly="form.readonly || section === '自动化'"
            />
          </ArtSectionCard>
        </ElTabPane>
      </ElTabs>
    </div>
    <template #footer-left>
      <ElButton
        v-if="form.id"
        v-auth="'MdmWorkCenter:Delete'"
        type="danger"
        plain
        :loading="deleting"
        @click="deleteCenter"
        >删除工作中心</ElButton
      >
    </template>
  </ArtDialog>
  <ArtDialog ref="automationDialog" size="md">
    <ElAlert
      title="设置班次触发的自动报工与自动开始规则；应用后仍需保存工作中心才会生效。"
      type="info"
      :closable="false"
      show-icon
    />
    <PolicyEditor v-model="automationPolicy" section="自动化" />
  </ArtDialog>
</template>
<script setup lang="ts">
  import ArtEmployeeSelect from '@/components/business/art-employee-select/index.vue'
  import ArtTableSingleSelect from '@/components/core/forms/art-data-select/table-single.vue'
  import { ref, reactive, computed, watch } from 'vue'
  import { cloneDeep, pick } from 'lodash-es'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import type {
    DataSelectFetchParams,
    DataSelectRecord
  } from '@/components/core/forms/art-data-select/types'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import { useUserStore } from '@/store/modules/user'
  import {
    saveWorkCenter,
    fetchAvailableMainCenters,
    fetchCenterDefaults,
    fetchProductionPersonSelector,
    fetchCenterPeople,
    type WorkCenter,
    type WorkCenterInput,
    type ProductionDepartment
  } from '@mdm/api'
  import { departmentOptions } from '../../modules/production-model'
  import { createCenterPolicy, createWorkCenter } from './center-policy'
  import PolicyEditor from './policy-editor.vue'
  interface OpenData {
    row?: WorkCenter
    mode: 'add' | 'edit' | 'copy' | 'view'
    departments: ProductionDepartment[]
    departmentId?: string
    onDelete?: () => Promise<boolean>
  }
  const emit = defineEmits<{ success: [] }>()
  const user = useUserStore()
  const dialogRef = ref<ArtDialogExpose<OpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const automationDialog = ref<ArtDialogExpose>()
  const automationPolicy = ref(createCenterPolicy())
  const deleting = ref(false)
  let currentDelete: OpenData['onDelete']
  async function deleteCenter() {
    if (!currentDelete || deleting.value) return
    deleting.value = true
    try {
      if (await currentDelete()) await dialogRef.value?.handleClose()
    } finally {
      deleting.value = false
    }
  }
  async function configureAutomation() {
    automationPolicy.value = cloneDeep(form.model.policy)
    await automationDialog.value?.handleOpen(undefined, {
      title: '自动化配置',
      subtitle: '集中维护由班次时间触发的工作中心动作',
      confirmText: '应用配置',
      contentMaxHeight: '60vh',
      onConfirm: () => {
        form.model.policy = cloneDeep(automationPolicy.value)
      }
    })
  }
  const form = reactive({
    model: createWorkCenter(),
    id: undefined as string | undefined,
    readonly: false,
    tab: '基本资料',
    error: '',
    departments: [] as ProductionDepartment[],
    people: [] as EmployeeIntegrationItem[],
    mainSelection: [] as { id: string; code: string; name: string }[]
  })
  const sections = ['报工规则', '生产控制', '人员与排程', '自动化'] as const
  const sectionMeta = {
    报工规则: {
      icon: 'ri:file-list-3-line',
      description: '控制报工方式、数量校验、时限与批次处理。',
      hint: '这些规则决定现场人员如何提交产量、批次以及超时数据。'
    },
    生产控制: {
      icon: 'ri:settings-5-line',
      description: '定义投料、检验、完工与异常场景的执行策略。',
      hint: '配置将作为该工作中心执行生产任务时的默认控制条件。'
    },
    人员与排程: {
      icon: 'ri:team-line',
      description: '约束人员参与方式、排程与跨班次处理。',
      hint: '人员名单仍在基本资料中维护，此处只设置参与生产与排程的规则。'
    },
    自动化: {
      icon: 'ri:flashlight-line',
      description: '根据班次开始或结束自动触发报工与开始动作。',
      hint: '自动化采用独立编辑，避免在查看策略时误改触发条件。'
    }
  } as const
  const rules = {
    code: [{ required: true, message: '请输入工作中心编号', trigger: 'blur' }],
    name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
    departmentId: [{ required: true, message: '请选择所属产线', trigger: 'change' }]
  }
  const basicItems = computed<FormItem[]>(() => [
    { key: 'code', label: '工作中心', type: 'input', props: { maxlength: 80 } },
    { key: 'name', label: '名称', type: 'input', props: { maxlength: 120 } },
    {
      key: 'departmentId',
      label: '所属产线',
      type: 'treeSelect',
      options: departmentOptions(form.departments),
      props: { checkStrictly: true, filterable: true }
    },
    {
      key: 'mainCenterId',
      label: '主工序位',
      help: '默认以本工作中心为核心；多设备产线可选择未被其他中心绑定的工作中心。'
    },
    {
      key: 'personnelMode',
      label: '人员安排',
      type: 'select',
      options: user.getDictMap.mdmCenter_personnelMode ?? []
    },
    {
      key: 'headcount',
      label: '指定人数',
      type: 'number',
      hidden: form.model.personnelMode !== '指定人数',
      props: { min: 1, max: 10000, precision: 0 }
    },
    {
      key: 'personIds',
      label: '指定人员',
      span: 24,
      hidden: form.model.personnelMode !== '指定人员'
    },
    { key: 'sort', label: '排序', type: 'number', props: { min: 0, precision: 0 } },
    {
      key: 'remark',
      label: '备注',
      type: 'textarea',
      span: 24,
      props: { rows: 2, maxlength: 1000 }
    }
  ])
  const basicDescriptions = [
    { key: 'code', label: '工作中心' },
    { key: 'name', label: '名称' },
    { key: 'department', label: '所属产线' },
    { key: 'main', label: '主工序位' },
    { key: 'staff', label: '人员安排' },
    { key: 'remark', label: '备注' }
  ].map((item) => ({ ...item, field: item.key }))
  const basicDisplay = computed(() => ({
    ...form.model,
    department: form.departments.find((d) => d.id === form.model.departmentId)?.name,
    main: form.mainSelection[0]?.code || form.model.code,
    staff:
      form.model.personnelMode === '指定人数'
        ? `指定人数 ${form.model.headcount} 人`
        : form.people.map((p) => `${p.employeeName} · ${p.employeeNo}`).join('、')
  }))
  const disabledCenter = (r: DataSelectRecord) => r.id === form.id
  const fetchCenters = (p: DataSelectFetchParams) =>
    fetchAvailableMainCenters(p.keyword, p.page, p.pageSize, form.id)
  async function handleOpen(data: OpenData) {
    currentDelete = data.onDelete
    Object.assign(form, {
      model: data.row
        ? (cloneDeep(pick(data.row, Object.keys(createWorkCenter()))) as WorkCenterInput)
        : createWorkCenter(),
      id: data.mode === 'edit' ? data.row?.id : undefined,
      readonly: data.mode === 'view',
      tab: '基本资料',
      error: '',
      departments: data.departments,
      people: [],
      mainSelection: data.row?.mainCenter ? [data.row.mainCenter] : []
    })
    if (data.mode === 'copy') {
      Object.assign(form.model, { code: '', name: '', mainCenterId: null })
      form.mainSelection = []
    }
    if (!data.row) form.model.departmentId = data.departmentId || ''
    await dialogRef.value?.handleOpen(data, {
      title: {
        add: '新增工作中心',
        edit: '编辑工作中心',
        copy: '复制工作中心',
        view: '工作中心详情'
      }[data.mode],
      subtitle: form.readonly
        ? '查看生产资源资料和各环节执行策略'
        : '按页签维护基础资料、报工、生产、排程与自动化规则',
      confirmText: '保存工作中心',
      cancelText: form.readonly ? '关闭' : '取消',
      showConfirmButton: !form.readonly,
      contentMaxHeight: '68vh',
      loading: true,
      onOpen: async (_data, api) => {
        try {
          if (data.mode === 'add') {
            const defaults = await fetchCenterDefaults(user.info.tenantId || '')
            if (defaults) form.model.policy = cloneDeep(defaults)
          }
          if (form.model.personIds.length)
            form.people = await fetchCenterPeople(form.model.personIds)
        } catch {
          form.error = '配置加载失败，请关闭后重试'
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: async () => {
        if (form.error) return false
        if (form.model.personnelMode === '指定人员' && !form.model.personIds.length) {
          form.error = '请至少选择一名生产人员'
          form.tab = '基本资料'
          return false
        }
        try {
          await formRef.value?.validate()
          const payload: WorkCenterInput = {
            ...cloneDeep(form.model),
            code: form.model.code.trim(),
            name: form.model.name.trim(),
            mainCenterId: form.model.mainCenterId || null,
            personIds: form.model.personnelMode === '指定人员' ? form.model.personIds : []
          }
          await saveWorkCenter(payload, form.id)
          emit('success')
        } catch {
          return false
        }
      }
    })
  }
  watch(
    () => form.model.personIds,
    () => {
      if (form.error === '请至少选择一名生产人员') form.error = ''
    },
    { deep: true }
  )
  defineExpose({ handleOpen })
</script>
<style scoped lang="scss">
  .center-dialog {
    display: grid;
    gap: 12px;
    min-width: 0;

    :deep(.el-tabs__header) {
      margin-bottom: 16px;
    }

    :deep(.art-section-card__body) {
      min-height: 0;
    }

    &__policy-intro {
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 10px 12px;
      margin-bottom: 16px;
      color: var(--el-text-color-secondary);
      background: var(--el-fill-color-light);
      border-radius: var(--el-border-radius-base);

      > span {
        display: grid;
        flex: none;
        place-items: center;
        width: 32px;
        height: 32px;
        color: var(--theme-color);
        background: color-mix(in srgb, var(--theme-color) 10%, var(--el-bg-color));
        border-radius: var(--el-border-radius-base);
      }

      p {
        margin: 0;
        font-size: 13px;
        line-height: 1.6;
      }
    }
  }
</style>
