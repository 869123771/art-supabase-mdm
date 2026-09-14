<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="document-type-dialog">
      <ArtEntitySummary
        :icon="modeIcon"
        eyebrow="DOCUMENT TYPE"
        :title="summaryTitle"
        :description="summaryDescription"
      >
        <template #aside>
          <ElTag
            :type="form.data.tagStyle || 'primary'"
            effect="light"
            round
            :style="tagPreviewStyle"
          >
            {{ form.data.documentTypeName || '类型预览' }}
          </ElTag>
        </template>
      </ArtEntitySummary>

      <ArtForm
        ref="formRef"
        v-model="form.data"
        :items="form.items"
        :rules="form.rules"
        :span="12"
        :gutter="20"
        label-position="top"
        label-width="auto"
        :show-reset="false"
        :show-submit="false"
        :validate-on-rule-change="false"
        scroll-to-error
      >
        <template #textColor>
          <div class="document-type-dialog__color-field">
            <ElColorPicker
              v-model="form.data.textColor"
              :predefine="presetColors"
              aria-label="选择单据类型文字颜色"
            />
            <span>{{ form.data.textColor || '跟随标签默认颜色' }}</span>
          </div>
        </template>
      </ArtForm>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import type { CSSProperties, ComputedRef, UnwrapNestedRefs } from 'vue'
  import { ElMessage, type FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import { useTenantScopeFormPolicy } from '@/hooks/core/useTenantScopeFormPolicy'
  import { useUserStore } from '@/store/modules/user'
  import TreeUtils from '@/utils/tree'
  import type { DocumentTypeMenuNode, DocumentTypeRecord } from '@mdm/api'
  import {
    copyDocumentType,
    createDocumentType,
    fetchNextDocumentTypeSort,
    updateDocumentType
  } from '@mdm/api'
  import {
    buildDocumentTypeInput,
    buildDocumentTypeUpdateInput,
    createDocumentTypeCopyModel,
    createDocumentTypeFormModel,
    type DocumentTypeFormModel
  } from './document-type-model'

  type DialogMode = 'add' | 'copy' | 'edit'

  interface SelectableMenuNode extends DocumentTypeMenuNode {
    disabled?: boolean
    children?: SelectableMenuNode[]
  }

  export interface DocumentTypeDialogOpenData {
    mode: DialogMode
    record?: DocumentTypeRecord
    selectedMenuId?: string
    menuTree: DocumentTypeMenuNode[]
    tenantOptions: Array<{ label: string; value: string }>
    effectiveTenantId?: string | null
  }

  interface FormExpose {
    validate: () => Promise<boolean | void>
    clearValidate: () => void
  }

  interface FormGroup {
    data: DocumentTypeFormModel
    mode: DialogMode
    menuTree: SelectableMenuNode[]
    tenantOptions: Array<{ label: string; value: string }>
    items: ComputedRef<FormItem[]>
    rules: ComputedRef<FormRules<DocumentTypeFormModel>>
  }

  const emit = defineEmits<{ success: [mode: 'add' | 'edit'] }>()
  const dialogRef = ref<ArtDialogExpose<DocumentTypeDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const { shouldExposeTenantField } = useTenantScopeFormPolicy()
  const presetColors = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399']

  const booleanOptions = computed(() =>
    (getDictMap.value.commonBoolean ?? []).map((item) => ({
      label: item.label,
      value: String(item.value) === 'true' || String(item.value) === '1'
    }))
  )

  const form: UnwrapNestedRefs<FormGroup> = reactive<FormGroup>({
    data: createDocumentTypeFormModel(),
    mode: 'add',
    menuTree: [],
    tenantOptions: [],
    items: computed<FormItem[]>(() => {
      const tenantItems: FormItem[] = shouldExposeTenantField.value
        ? [
            { label: '数据归属', key: 'tenantSection', type: 'divider', span: 24 },
            {
              label: '所属租户',
              key: 'tenantId',
              type: 'select',
              span: 24,
              props: {
                options: form.tenantOptions,
                filterable: true,
                disabled: form.mode !== 'add',
                placeholder: '请选择本条单据类型所属租户',
                onChange: () => void refreshSuggestedSort()
              },
              description:
                form.mode === 'add'
                  ? '在全部租户工作区新增时，必须明确数据归属。'
                  : '编辑或复制时沿用原记录租户，避免跨租户复制主数据。'
            }
          ]
        : []

      return [
        ...tenantItems,
        { label: '归属与类型标识', key: 'identitySection', type: 'divider', span: 24 },
        {
          label: '所属菜单功能',
          key: 'menuId',
          type: 'treeSelect',
          span: 12,
          props: {
            data: form.menuTree,
            clearable: true,
            filterable: true,
            checkStrictly: true,
            defaultExpandAll: false,
            placeholder: '请选择具体菜单功能',
            onChange: () => void refreshSuggestedSort(),
            props: {
              label: (node: SelectableMenuNode) =>
                String(node.meta?.title || node.name || '未命名菜单'),
              value: 'id',
              disabled: 'disabled'
            }
          },
          description: '目录节点仅用于导航；单据类型必须归属到具体功能页面。'
        },
        {
          label: '单据类型编号',
          key: 'documentTypeCode',
          type: 'input',
          span: 12,
          props: {
            maxlength: 64,
            clearable: true,
            placeholder: '例如：PRODUCTION_ORDER'
          },
          description: '租户内唯一，保存时自动转换为大写。'
        },
        {
          label: '单据类型名称',
          key: 'documentTypeName',
          type: 'input',
          span: 24,
          props: { maxlength: 100, clearable: true, placeholder: '请输入业务可识别的类型名称' }
        },
        { label: '显示、排序与状态', key: 'presentationSection', type: 'divider', span: 24 },
        {
          label: '默认单据类型',
          key: 'isDefault',
          type: 'segment',
          span: 8,
          props: { options: booleanOptions.value, onChange: handleDefaultChange },
          description: '同一菜单功能只能设置一个默认项。'
        },
        {
          label: '排序',
          key: 'sortOrder',
          type: 'number',
          span: 8,
          props: {
            min: 0,
            max: 999999,
            step: 10,
            controlsPosition: 'right',
            style: { width: '100%' }
          },
          description: '默认从 10 开始，按当前菜单每次增加 10。'
        },
        {
          label: '状态',
          key: 'enabled',
          type: 'switch',
          span: 8,
          props: {
            inlinePrompt: true,
            activeText: '启用',
            inactiveText: '禁用',
            onChange: handleEnabledChange
          },
          description: '禁用后不再提供给新业务单据选择。'
        },
        {
          label: '标签样式',
          key: 'tagStyle',
          type: 'tagStyleSelect',
          span: 12,
          props: { clearable: true, placeholder: '请选择标签样式' }
        },
        { label: '文字颜色', key: 'textColor', type: 'input', span: 12 },
        { label: '补充说明', key: 'remarkSection', type: 'divider', span: 24 },
        {
          label: '备注',
          key: 'remark',
          type: 'input',
          span: 24,
          props: {
            type: 'textarea',
            rows: 3,
            maxlength: 500,
            showWordLimit: true,
            placeholder: '说明该单据类型的适用范围或维护约定'
          }
        }
      ]
    }),
    rules: computed<FormRules<DocumentTypeFormModel>>(() => ({
      tenantId: [
        { required: shouldExposeTenantField.value, message: '请选择所属租户', trigger: 'change' }
      ],
      menuId: [{ required: true, message: '请选择所属菜单功能', trigger: 'change' }],
      documentTypeCode: [
        { required: true, message: '请输入单据类型编号', trigger: 'blur' },
        {
          pattern: /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/,
          message: '编号仅支持字母、数字、下划线和短横线，并需以字母或数字开头',
          trigger: 'blur'
        }
      ],
      documentTypeName: [{ required: true, message: '请输入单据类型名称', trigger: 'blur' }],
      sortOrder: [{ required: true, message: '请输入排序值', trigger: 'blur' }],
      textColor: [
        {
          pattern: /^$|^#[0-9A-Fa-f]{6}$/,
          message: '文字颜色必须是 6 位十六进制颜色值',
          trigger: 'change'
        }
      ]
    }))
  })

  const summaryTitle = computed(() => form.data.documentTypeName || '新单据类型')
  const selectedMenuPath = computed(() =>
    form.data.menuId
      ? treeUtils
          .getAncestors(form.menuTree, form.data.menuId)
          .map((menu) => String(menu.meta?.title || menu.name || '未命名菜单'))
          .join(' / ')
      : ''
  )
  const summaryDescription = computed(() => {
    const code = form.data.documentTypeCode || '编号待填写'
    return selectedMenuPath.value ? `${code} · ${selectedMenuPath.value}` : code
  })
  const modeIcon = computed(() =>
    form.mode === 'copy'
      ? 'ri:file-copy-line'
      : form.mode === 'edit'
        ? 'ri:edit-line'
        : 'ri:add-line'
  )
  const tagPreviewStyle = computed<CSSProperties>(() => ({
    color: form.data.textColor || undefined
  }))

  const buildSelectableMenuTree = (menuTree: DocumentTypeMenuNode[]): SelectableMenuNode[] =>
    treeUtils.mapTree(menuTree, (menu) => ({
      ...menu,
      disabled: menu.type !== 'menu'
    })) as SelectableMenuNode[]

  const refreshSuggestedSort = async (): Promise<void> => {
    if (form.mode === 'edit' || !form.data.menuId || !form.data.tenantId) return
    form.data.sortOrder = await fetchNextDocumentTypeSort(form.data.menuId, form.data.tenantId)
  }

  const handleDefaultChange = (isDefault: boolean): void => {
    if (isDefault) form.data.enabled = true
  }

  const handleEnabledChange = (enabled: boolean): void => {
    if (enabled || !form.data.isDefault) return
    form.data.enabled = true
    ElMessage.warning('默认单据类型必须保持启用，请先取消默认或设置其他默认项')
  }

  const initializeForm = (data: DocumentTypeDialogOpenData): void => {
    form.mode = data.mode
    form.menuTree = buildSelectableMenuTree(data.menuTree)
    form.tenantOptions = data.tenantOptions

    if (data.mode === 'edit' && data.record) {
      form.data = createDocumentTypeFormModel({ ...data.record })
      return
    }
    if (data.mode === 'copy' && data.record) {
      form.data = createDocumentTypeCopyModel(data.record)
      return
    }

    const selectedMenu = data.selectedMenuId
      ? treeUtils.findNode(form.menuTree, data.selectedMenuId)
      : undefined
    form.data = createDocumentTypeFormModel({
      tenantId: data.effectiveTenantId ?? undefined,
      menuId: selectedMenu?.type === 'menu' ? selectedMenu.id : ''
    })
  }

  const handleSubmit = async (): Promise<boolean> => {
    try {
      await formRef.value?.validate()
    } catch {
      return false
    }

    try {
      if (form.mode === 'edit' && form.data.id) {
        await updateDocumentType(form.data.id, buildDocumentTypeUpdateInput(form.data))
        emit('success', 'edit')
      } else if (form.mode === 'copy' && form.data.sourceId) {
        await copyDocumentType(form.data.sourceId, buildDocumentTypeUpdateInput(form.data))
        emit('success', 'add')
      } else {
        await createDocumentType(buildDocumentTypeInput(form.data, shouldExposeTenantField.value))
        emit('success', 'add')
      }
      return true
    } catch {
      return false
    }
  }

  const handleOpen = async (data: DocumentTypeDialogOpenData): Promise<void> => {
    initializeForm(data)
    await userStore.ensureDictLoaded('commonBoolean')
    const titleMap: Record<DialogMode, string> = {
      add: '新增单据类型',
      copy: '复制单据类型',
      edit: '编辑单据类型'
    }
    const confirmMap: Record<DialogMode, string> = {
      add: '创建单据类型',
      copy: '创建副本',
      edit: '保存更改'
    }

    await dialogRef.value?.handleOpen(data, {
      title: titleMap[data.mode],
      subtitle:
        data.mode === 'copy'
          ? '已继承原记录的显示配置，请重新填写唯一编号。'
          : '维护菜单归属、稳定编号与业务展示规则。',
      confirmText: confirmMap[data.mode],
      contentMaxHeight: '74vh',
      loading: true,
      onOpen: async (_openData, api) => {
        try {
          await refreshSuggestedSort()
          await nextTick()
          formRef.value?.clearValidate()
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: handleSubmit
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .document-type-dialog {
    display: grid;
    gap: var(--art-space-4);

    :deep(.art-form) {
      padding: 0 !important;
    }

    &__color-field {
      display: flex;
      gap: var(--art-space-3);
      align-items: center;
      min-height: 32px;

      span {
        overflow: hidden;
        text-overflow: ellipsis;
        font-family: var(--art-font-family-mono, Consolas, monospace);
        color: var(--el-text-color-secondary);
        white-space: nowrap;
      }
    }
  }
</style>
