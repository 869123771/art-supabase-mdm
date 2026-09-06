<template>
  <ArtDialog ref="dialogRef" size="xl">
    <div class="material-reference-dialog">
      <div class="material-reference-dialog__context" role="note">
        <span aria-hidden="true"><ArtSvgIcon :icon="config.icon" /></span>
        <div>
          <strong>{{ config.dialogTitle }}</strong>
          <p>{{ config.dialogDescription }}</p>
        </div>
      </div>

      <ArtForm
        ref="formRef"
        v-model="form.model"
        :items="form.items"
        :rules="form.rules"
        :span="12"
        :gutter="24"
        label-position="top"
        :show-reset="false"
        :show-submit="false"
      >
        <template #attributes>
          <div class="material-reference-dialog__builder">
            <div
              v-for="(attribute, index) in formModel.attributes"
              :key="attribute.key"
              class="material-reference-dialog__builder-row"
            >
              <ElInput v-model="attribute.name" maxlength="40" placeholder="属性名称，如颜色" />
              <ElInput
                :model-value="attribute.values.join('、')"
                placeholder="候选值，以顿号分隔"
                @update:model-value="
                  attribute.values = String($event)
                    .split(/[、,，]/)
                    .map((item) => item.trim())
                    .filter(Boolean)
                "
              />
              <ElCheckbox v-model="attribute.required">必填</ElCheckbox>
              <ElSwitch
                v-model="attribute.enabled"
                inline-prompt
                active-text="启"
                inactive-text="停"
              />
              <div class="material-reference-dialog__row-actions">
                <ArtIconButton
                  icon="ri:arrow-up-line"
                  label="上移属性"
                  :disabled="index === 0"
                  @click="moveItem(formModel.attributes, Number(index), -1)"
                />
                <ArtIconButton
                  icon="ri:arrow-down-line"
                  label="下移属性"
                  :disabled="index === formModel.attributes.length - 1"
                  @click="moveItem(formModel.attributes, Number(index), 1)"
                />
                <ArtIconButton
                  icon="ri:delete-bin-line"
                  label="删除属性"
                  @click="formModel.attributes.splice(Number(index), 1)"
                />
              </div>
            </div>
            <ElButton plain @click="addAttribute"
              ><ArtSvgIcon icon="ri:add-line" />添加属性</ElButton
            >
          </div>
        </template>

        <template #segments>
          <div class="material-reference-dialog__builder">
            <div
              v-for="(segment, index) in formModel.segments"
              :key="`${index}-${segment.source}`"
              class="material-reference-dialog__builder-row is-segment"
            >
              <ElSelect v-model="segment.source" aria-label="号段来源">
                <ElOption label="物料类型" value="material_type" />
                <ElOption label="物料分类" value="material_category" />
                <ElOption label="固定字符" value="fixed" />
                <ElOption label="日期" value="date" />
              </ElSelect>
              <ElInput
                v-if="segment.source === 'fixed'"
                v-model="segment.value"
                maxlength="12"
                placeholder="固定字符"
              />
              <ElSelect
                v-else-if="segment.source === 'date'"
                v-model="segment.format"
                aria-label="日期格式"
              >
                <ElOption label="YYYY" value="YYYY" />
                <ElOption label="YYYYMM" value="YYYYMM" />
                <ElOption label="YYYYMMDD" value="YYYYMMDD" />
              </ElSelect>
              <span v-else class="material-reference-dialog__segment-note">保存时取业务编码</span>
              <div class="material-reference-dialog__row-actions">
                <ArtIconButton
                  icon="ri:arrow-up-line"
                  label="上移号段"
                  :disabled="index === 0"
                  @click="moveItem(formModel.segments, Number(index), -1)"
                />
                <ArtIconButton
                  icon="ri:arrow-down-line"
                  label="下移号段"
                  :disabled="index === formModel.segments.length - 1"
                  @click="moveItem(formModel.segments, Number(index), 1)"
                />
                <ArtIconButton
                  icon="ri:delete-bin-line"
                  label="删除号段"
                  @click="formModel.segments.splice(Number(index), 1)"
                />
              </div>
            </div>
            <ElButton plain :disabled="formModel.segments.length >= 5" @click="addSegment"
              ><ArtSvgIcon icon="ri:add-line" />添加号段</ElButton
            >
            <div class="material-reference-dialog__preview">
              <span>编码预览</span><strong translate="no">{{ rulePreview }}</strong>
            </div>
          </div>
        </template>
      </ArtForm>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import type { FormRules } from 'element-plus'
  import { cloneDeep } from 'lodash-es'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    fetchMaterialReferenceOptions,
    saveMaterialReference,
    type MaterialAttributeDefinition,
    type MaterialCodeSegment,
    type MaterialReferenceKind,
    type MaterialReferenceRecord,
    type UnitOfMeasure
  } from '@mdm/api'

  interface ReferenceFormModel {
    id?: string
    tenantId: string
    unitCode: string
    unitName: string
    symbol: string
    dimension: string
    decimalPlaces: number
    isBaseUnit: boolean
    baseUnitId: string | null
    conversionFactor: number
    typeCode: string
    typeName: string
    codePrefix: string
    groupCode: string
    groupName: string
    attributes: MaterialAttributeDefinition[]
    textColor: string
    tagType: string
    ruleCode: string
    ruleName: string
    strategy: 'material_type' | 'material_category'
    prefix: string
    segments: MaterialCodeSegment[]
    sequenceDigits: number
    codeLength: number
    exampleCode: string
    nextValue: number
    status: 'enabled' | 'disabled'
    sort: number
    remark: string
  }

  export interface ReferenceDialogOpenData {
    kind: MaterialReferenceKind
    row?: MaterialReferenceRecord
    copy?: boolean
    tenantId: string
    tenantOptions: Array<{ label: string; value: string }>
  }
  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [mode: 'add' | 'edit'] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const dialogRef = ref<ArtDialogExpose<ReferenceDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const currentKind = ref<MaterialReferenceKind>('unit-of-measure')
  const tenantOptions = ref<Array<{ label: string; value: string }>>([])
  const unitOptions = ref<UnitOfMeasure[]>([])
  const initialForm = (): ReferenceFormModel => ({
    id: undefined,
    tenantId: '',
    unitCode: '',
    unitName: '',
    symbol: '',
    dimension: '通用',
    decimalPlaces: 2,
    isBaseUnit: true,
    baseUnitId: null,
    conversionFactor: 1,
    typeCode: '',
    typeName: '',
    codePrefix: '',
    groupCode: '',
    groupName: '',
    attributes: [],
    textColor: '',
    tagType: 'primary',
    ruleCode: '',
    ruleName: '',
    strategy: 'material_type',
    prefix: '',
    segments: [{ source: 'material_type' }],
    sequenceDigits: 5,
    codeLength: 20,
    exampleCode: '',
    nextValue: 1,
    status: 'enabled',
    sort: 10,
    remark: ''
  })
  const formModel = reactive<ReferenceFormModel>(initialForm())
  const configs = {
    'unit-of-measure': {
      icon: 'ri:ruler-line',
      dialogTitle: '建立统一计量口径',
      dialogDescription: '一个单位只定义一次，换算关系在物料档案中按业务需要维护。'
    },
    'material-type': {
      icon: 'ri:price-tag-3-line',
      dialogTitle: '维护物料类型',
      dialogDescription: '类型承担顶层业务语义，并为物料编码提供稳定前缀。'
    },
    'attribute-group': {
      icon: 'ri:list-settings-line',
      dialogTitle: '配置物料属性组',
      dialogDescription: '用结构化属性和值域替代自由文本，保证检索和编码描述一致。'
    },
    'code-rule': {
      icon: 'ri:barcode-line',
      dialogTitle: '编排物料编码规则',
      dialogDescription: '最多五个语义号段，最后由服务端追加受控流水号。'
    }
  } as const
  const config = computed(() => configs[currentKind.value])
  const baseUnitOptions = computed(() =>
    unitOptions.value
      .filter(
        (unit) =>
          unit.isBaseUnit && unit.id !== formModel.id && unit.dimension === formModel.dimension
      )
      .map((unit) => ({ label: `${unit.unitName} · ${unit.unitCode}`, value: unit.id }))
  )
  const statusOptions = computed(() => getDictMap.value.commonEnabledStatus ?? [])
  const tenantItems = (): FormItem[] => [
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
    }
  ]
  const baseItems = (): FormItem[] => [
    {
      label: '启用状态',
      key: 'status',
      type: 'select',
      options: statusOptions.value,
      props: { clearable: false }
    },
    {
      label: '显示顺序',
      key: 'sort',
      type: 'number',
      props: { min: 0, max: 999999, precision: 0, class: '!w-full' }
    },
    {
      label: '备注',
      key: 'remark',
      type: 'input',
      span: 24,
      props: { type: 'textarea', rows: 3, maxlength: 500, showWordLimit: true, resize: 'none' }
    }
  ]
  const form = reactive<{
    model: ReferenceFormModel
    items: ComputedRef<FormItem[]>
    rules: FormRules<ReferenceFormModel>
  }>({
    model: formModel,
    items: computed(() => {
      if (currentKind.value === 'unit-of-measure')
        return [
          ...tenantItems(),
          {
            label: '单位编码',
            key: 'unitCode',
            type: 'input',
            props: { maxlength: 20, placeholder: '如 KG' }
          },
          {
            label: '单位名称',
            key: 'unitName',
            type: 'input',
            props: { maxlength: 60, placeholder: '如 千克' }
          },
          {
            label: '单位符号',
            key: 'symbol',
            type: 'input',
            props: { maxlength: 20, placeholder: '如 kg' }
          },
          {
            label: '计量维度',
            key: 'dimension',
            type: 'input',
            props: { maxlength: 40, placeholder: '质量、长度、数量…' }
          },
          {
            label: '小数位数',
            key: 'decimalPlaces',
            type: 'number',
            props: { min: 0, max: 8, precision: 0, class: '!w-full' }
          },
          {
            label: '维度基准单位',
            key: 'isBaseUnit',
            type: 'switch',
            props: { activeText: '是', inactiveText: '否' }
          },
          {
            label: '换算基准单位',
            key: 'baseUnitId',
            type: 'select',
            options: baseUnitOptions.value,
            props: {
              clearable: true,
              filterable: true,
              disabled: formModel.isBaseUnit,
              placeholder: formModel.isBaseUnit ? '基准单位无需选择' : '选择同维度基准单位'
            }
          },
          {
            label: '基准换算系数',
            key: 'conversionFactor',
            type: 'number',
            props: {
              min: 0.00000001,
              precision: 8,
              class: '!w-full',
              disabled: formModel.isBaseUnit
            }
          },
          ...baseItems()
        ]
      if (currentKind.value === 'material-type')
        return [
          ...tenantItems(),
          {
            label: '类型编码',
            key: 'typeCode',
            type: 'input',
            props: { maxlength: 40, placeholder: '如 RAW' }
          },
          {
            label: '类型名称',
            key: 'typeName',
            type: 'input',
            props: { maxlength: 80, placeholder: '如 原材料' }
          },
          {
            label: '编码前缀',
            key: 'codePrefix',
            type: 'input',
            props: { maxlength: 20, placeholder: '如 RM' }
          },
          {
            label: '标签样式',
            key: 'tagType',
            type: 'select',
            options: ['primary', 'success', 'warning', 'danger', 'info'].map((value) => ({
              label: value,
              value
            }))
          },
          ...baseItems()
        ]
      if (currentKind.value === 'attribute-group')
        return [
          ...tenantItems(),
          {
            label: '属性组编码',
            key: 'groupCode',
            type: 'input',
            props: { maxlength: 40, placeholder: '如 APPEARANCE' }
          },
          {
            label: '属性组名称',
            key: 'groupName',
            type: 'input',
            props: { maxlength: 80, placeholder: '如 外观属性' }
          },
          { label: '属性明细', key: 'attributes', type: 'slot', span: 24 },
          ...baseItems()
        ]
      return [
        ...tenantItems(),
        {
          label: '规则编码',
          key: 'ruleCode',
          type: 'input',
          props: { maxlength: 40, placeholder: '如 RAW_MATERIAL' }
        },
        {
          label: '规则名称',
          key: 'ruleName',
          type: 'input',
          props: { maxlength: 100, placeholder: '如 原材料编码规则' }
        },
        {
          label: '归类策略',
          key: 'strategy',
          type: 'select',
          options: getDictMap.value.mdmMaterialCodeStrategy ?? []
        },
        {
          label: '固定前缀',
          key: 'prefix',
          type: 'input',
          props: { maxlength: 20, placeholder: '可选' }
        },
        {
          label: '流水位数',
          key: 'sequenceDigits',
          type: 'number',
          props: { min: 2, max: 12, precision: 0, class: '!w-full' }
        },
        {
          label: '编码总长度',
          key: 'codeLength',
          type: 'number',
          props: { min: 4, max: 60, precision: 0, class: '!w-full' }
        },
        { label: '号段配置', key: 'segments', type: 'slot', span: 24 },
        ...baseItems()
      ]
    }),
    rules: {
      tenantId: [{ required: true, message: '请选择目标租户', trigger: 'change' }],
      unitCode: [{ required: true, message: '请输入单位编码', trigger: 'blur' }],
      unitName: [{ required: true, message: '请输入单位名称', trigger: 'blur' }],
      baseUnitId: [
        {
          validator: (_rule, value, callback) =>
            formModel.isBaseUnit || value
              ? callback()
              : callback(new Error('请选择同维度基准单位')),
          trigger: 'change'
        }
      ],
      typeCode: [{ required: true, message: '请输入类型编码', trigger: 'blur' }],
      typeName: [{ required: true, message: '请输入类型名称', trigger: 'blur' }],
      groupCode: [{ required: true, message: '请输入属性组编码', trigger: 'blur' }],
      groupName: [{ required: true, message: '请输入属性组名称', trigger: 'blur' }],
      ruleCode: [{ required: true, message: '请输入规则编码', trigger: 'blur' }],
      ruleName: [{ required: true, message: '请输入规则名称', trigger: 'blur' }]
    }
  })
  void Promise.all(
    ['commonEnabledStatus', 'mdmMaterialCodeStrategy'].map((code) =>
      userStore.ensureDictLoaded(code)
    )
  )
  const rulePreview = computed(() => {
    const values = form.model.segments.map((segment) =>
      segment.source === 'fixed'
        ? segment.value || 'FIX'
        : segment.source === 'date'
          ? segment.format || 'YYYYMMDD'
          : segment.source === 'material_type'
            ? 'TYPE'
            : 'CATEGORY'
    )
    return `${form.model.prefix}${values.join('')}${'0'.repeat(Math.max(2, form.model.sequenceDigits - 1))}1`.slice(
      0,
      form.model.codeLength
    )
  })
  function moveItem<T>(items: T[], index: number, offset: number): void {
    const target = index + offset
    if (target < 0 || target >= items.length) return
    ;[items[index], items[target]] = [items[target], items[index]]
  }
  const addAttribute = (): void => {
    form.model.attributes.push({
      key: crypto.randomUUID(),
      name: '',
      values: [],
      required: false,
      enabled: true
    })
  }
  const addSegment = (): void => {
    if (form.model.segments.length < 5) form.model.segments.push({ source: 'fixed', value: '' })
  }
  const payloadForKind = (): Partial<MaterialReferenceRecord> => {
    const shared = {
      tenantId: form.model.tenantId,
      status: form.model.status,
      sort: Number(form.model.sort),
      remark: form.model.remark.trim()
    }
    if (currentKind.value === 'unit-of-measure')
      return {
        ...shared,
        unitCode: form.model.unitCode.trim().toUpperCase(),
        unitName: form.model.unitName.trim(),
        symbol: form.model.symbol.trim() || null,
        dimension: form.model.dimension.trim(),
        decimalPlaces: form.model.decimalPlaces,
        isBaseUnit: form.model.isBaseUnit,
        baseUnitId: form.model.isBaseUnit ? null : form.model.baseUnitId,
        conversionFactor: form.model.isBaseUnit ? 1 : form.model.conversionFactor
      }
    if (currentKind.value === 'material-type')
      return {
        ...shared,
        typeCode: form.model.typeCode.trim().toUpperCase(),
        typeName: form.model.typeName.trim(),
        codePrefix: form.model.codePrefix.trim().toUpperCase(),
        textColor: form.model.textColor,
        tagType: form.model.tagType
      }
    if (currentKind.value === 'attribute-group')
      return {
        ...shared,
        groupCode: form.model.groupCode.trim().toUpperCase(),
        groupName: form.model.groupName.trim(),
        attributes: form.model.attributes
          .filter((item) => item.name.trim())
          .map((item) => ({ ...item, name: item.name.trim() })),
        textColor: form.model.textColor,
        tagType: form.model.tagType
      }
    return {
      ...shared,
      ruleCode: form.model.ruleCode.trim().toUpperCase(),
      ruleName: form.model.ruleName.trim(),
      strategy: form.model.strategy,
      prefix: form.model.prefix.trim().toUpperCase(),
      segments: form.model.segments,
      sequenceDigits: form.model.sequenceDigits,
      codeLength: form.model.codeLength,
      nextValue: form.model.nextValue,
      exampleCode: rulePreview.value
    }
  }
  const handleSubmit = async (): Promise<boolean> => {
    try {
      await formRef.value?.validate()
      await saveMaterialReference(currentKind.value, payloadForKind(), form.model.id)
      emit('success', form.model.id ? 'edit' : 'add')
      return true
    } catch {
      return false
    }
  }
  const handleOpen = async (data: ReferenceDialogOpenData): Promise<void> => {
    Object.assign(form.model, initialForm())
    currentKind.value = data.kind
    tenantOptions.value = data.tenantOptions
    form.model.tenantId = data.row?.tenantId || data.tenantId
    unitOptions.value =
      data.kind === 'unit-of-measure' && form.model.tenantId
        ? await fetchMaterialReferenceOptions<UnitOfMeasure>('unit-of-measure', form.model.tenantId)
        : []
    if (data.row) Object.assign(form.model, cloneDeep(data.row))
    if (data.copy) {
      form.model.id = undefined
      form.model.nextValue = 1
    }
    await dialogRef.value?.handleOpen(data, {
      title: `${data.copy ? '复制' : data.row ? '编辑' : '新增'}${config.value.dialogTitle.replace(/^维护|建立|配置|编排/, '')}`,
      subtitle: config.value.dialogDescription,
      confirmText: '保存',
      contentMaxHeight: '72vh',
      onConfirm: handleSubmit,
      onOpen: () => formRef.value?.clearValidate()
    })
  }
  watch(
    () => form.model.tenantId,
    async (value, previous) => {
      if (value === previous || currentKind.value !== 'unit-of-measure') return
      unitOptions.value = value
        ? await fetchMaterialReferenceOptions<UnitOfMeasure>('unit-of-measure', value)
        : []
      if (!unitOptions.value.some((unit) => unit.id === form.model.baseUnitId)) {
        form.model.baseUnitId = null
      }
    }
  )
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .material-reference-dialog {
    &__context {
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr);
      gap: 12px;
      align-items: center;
      padding: 12px 14px;
      margin-bottom: 18px;
      background: color-mix(in srgb, var(--theme-color) 7%, var(--default-box-color));
      border-left: 3px solid var(--theme-color);
      border-radius: var(--el-border-radius-base);

      > span {
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        color: var(--theme-color);
        background: var(--default-box-color);
        border-radius: var(--el-border-radius-base);
      }

      strong {
        color: var(--el-text-color-primary);
      }

      p {
        margin: 3px 0 0;
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }

    &__builder {
      display: grid;
      gap: 10px;
      width: 100%;
    }

    &__builder-row {
      display: grid;
      grid-template-columns: minmax(140px, 0.7fr) minmax(220px, 1.4fr) auto auto auto;
      gap: 10px;
      align-items: center;
      padding: 10px;
      background: var(--art-gray-100);
      border-radius: var(--el-border-radius-base);

      &.is-segment {
        grid-template-columns: 180px minmax(180px, 1fr) auto;
      }
    }

    &__row-actions {
      display: flex;
      gap: 4px;
    }

    &__segment-note {
      color: var(--el-text-color-secondary);
    }

    &__preview {
      display: flex;
      gap: 14px;
      align-items: center;
      padding: 12px 14px;
      color: var(--el-text-color-secondary);
      background: color-mix(in srgb, var(--theme-color) 6%, var(--default-box-color));
      border-radius: var(--el-border-radius-base);

      strong {
        color: var(--theme-color);
        letter-spacing: 0.08em;
      }
    }

    @media (width <= 760px) {
      &__builder-row,
      &__builder-row.is-segment {
        grid-template-columns: 1fr;
      }

      &__row-actions {
        justify-content: flex-end;
      }
    }
  }
</style>
