<template>
  <ArtDialog ref="dialogRef" size="sm">
    <div class="esop-category-dialog">
      <div class="esop-category-dialog__context">
        <span><ArtSvgIcon icon="ri:folder-settings-line" /></span>
        <div>
          <strong>文档分类</strong>
          <p>建立稳定的层级导航，分类编码在当前租户内保持唯一。</p>
        </div>
      </div>
      <ArtForm
        ref="formRef"
        v-model="form"
        :items="items"
        :rules="rules"
        :span="24"
        :gutter="16"
        label-position="top"
        :show-reset="false"
        :show-submit="false"
      >
        <template #parentId>
          <ElTreeSelect
            v-model="form.parentId"
            :data="availableCategories"
            :props="treeProps"
            node-key="id"
            value-key="id"
            check-strictly
            clearable
            default-expand-all
            placeholder="作为一级分类"
            class="w-full"
          />
        </template>
      </ArtForm>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import type { FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import { saveEsopCategory, type EsopCategory, type EsopCategoryInput } from '@mdm/api'

  export interface EsopCategoryDialogOpenData {
    row?: EsopCategory
    parentId?: string
    categories: EsopCategory[]
    tenantId: string
    tenantOptions: Array<{ label: string; value: string }>
  }

  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const dialogRef = ref<ArtDialogExpose<EsopCategoryDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const categories = shallowRef<EsopCategory[]>([])
  const tenantOptions = ref<Array<{ label: string; value: string }>>([])
  const treeProps = { label: 'categoryName', children: 'children' }
  const initial = (): EsopCategoryInput => ({
    tenantId: '',
    parentId: null,
    categoryCode: '',
    categoryName: '',
    description: '',
    status: 'enabled',
    sort: 10
  })
  const form = reactive<EsopCategoryInput>(initial())
  const availableCategories = computed(() => {
    const excluded = new Set<string>()
    const collect = (nodes: EsopCategory[], targetId?: string, belowTarget = false): void => {
      nodes.forEach((node) => {
        const excludedBranch = belowTarget || node.id === targetId
        if (excludedBranch) excluded.add(node.id)
        if (node.children?.length) collect(node.children, targetId, excludedBranch)
      })
    }
    collect(categories.value, form.id)
    const clone = (nodes: EsopCategory[]): EsopCategory[] =>
      nodes
        .filter((node) => node.tenantId === form.tenantId && !excluded.has(node.id))
        .map((node) => ({ ...node, children: node.children ? clone(node.children) : [] }))
    return clone(categories.value)
  })
  const items = computed<FormItem[]>(() => [
    {
      label: '目标租户',
      key: 'tenantId',
      type: 'select',
      span: 24,
      options: tenantOptions.value,
      props: {
        disabled: Boolean(form.id),
        filterable: true,
        placeholder: '请选择本次维护的数据归属租户'
      }
    },
    { label: '上级分类', key: 'parentId', type: 'text', span: 24 },
    {
      label: '分类编码',
      key: 'categoryCode',
      type: 'input',
      span: 12,
      props: { maxlength: 40, placeholder: '如 ASSEMBLY' }
    },
    {
      label: '分类名称',
      key: 'categoryName',
      type: 'input',
      span: 12,
      props: { maxlength: 80, placeholder: '如 装配作业指导书' }
    },
    {
      label: '状态',
      key: 'status',
      type: 'radioGroup',
      span: 12,
      options: getDictMap.value.commonEnabledStatus ?? [],
      props: { optionType: 'button' }
    },
    {
      label: '排序',
      key: 'sort',
      type: 'number',
      span: 12,
      props: { min: 0, max: 999999, controlsPosition: 'right', class: '!w-full' }
    },
    {
      label: '分类说明',
      key: 'description',
      type: 'textarea',
      span: 24,
      props: { rows: 3, maxlength: 500, showWordLimit: true, resize: 'none' }
    }
  ])
  void userStore.ensureDictLoaded('commonEnabledStatus')
  const rules: FormRules<EsopCategoryInput> = {
    tenantId: [{ required: true, message: '请选择目标租户', trigger: 'change' }],
    categoryCode: [
      { required: true, message: '请输入分类编码', trigger: 'blur' },
      {
        pattern: /^[A-Z0-9][A-Z0-9._-]{1,39}$/,
        message: '请输入 2–40 位大写字母、数字、点、横线或下划线',
        trigger: 'blur'
      }
    ],
    categoryName: [{ required: true, message: '请输入分类名称', trigger: 'blur' }]
  }
  const submit = async (): Promise<boolean> => {
    try {
      await formRef.value?.validate()
      await saveEsopCategory({ ...form, categoryCode: form.categoryCode.trim().toUpperCase() })
      emit('success')
      return true
    } catch {
      return false
    }
  }
  const handleOpen = async (data: EsopCategoryDialogOpenData): Promise<void> => {
    Object.assign(form, initial())
    categories.value = data.categories
    tenantOptions.value = data.tenantOptions
    if (data.row) Object.assign(form, data.row)
    form.tenantId = data.row?.tenantId || data.tenantId
    if (!data.row) form.parentId = data.parentId || null
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑文档分类' : '新增文档分类',
      subtitle: '分类将用于 ESOP 左侧导航和文档范围筛选',
      confirmText: data.row ? '保存分类' : '新增分类',
      onConfirm: submit
    })
  }
  watch(
    () => form.tenantId,
    (value, previous) => {
      if (value === previous || !previous) return
      form.parentId = null
    }
  )
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .esop-category-dialog__context {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr);
    gap: 12px;
    align-items: center;
    padding: 13px 14px;
    margin-bottom: 16px;
    background: color-mix(in srgb, var(--theme-color) 7%, var(--el-bg-color));
    border: 1px solid color-mix(in srgb, var(--theme-color) 14%, var(--el-border-color-lighter));
    border-radius: var(--el-border-radius-base);
  }

  .esop-category-dialog__context > span {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    color: var(--theme-color);
    background: var(--el-bg-color);
    border-radius: 10px;
  }

  .esop-category-dialog__context strong,
  .esop-category-dialog__context p {
    display: block;
    margin: 0;
  }

  .esop-category-dialog__context p {
    margin-top: 3px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .esop-category-dialog :deep(.el-radio-group) {
    display: flex;
    width: 100%;
  }

  .esop-category-dialog :deep(.el-radio-button) {
    flex: 1;
  }

  .esop-category-dialog :deep(.el-radio-button__inner) {
    width: 100%;
  }
</style>
