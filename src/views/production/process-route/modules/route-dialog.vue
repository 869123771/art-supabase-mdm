<template>
  <ArtDialog ref="dialogRef" size="md">
    <ElAlert
      title="每个产品可维护多条工艺路线；路线中的具体工序在保存后继续配置。"
      type="info"
      :closable="false"
      show-icon
    />
    <ArtForm
      ref="formRef"
      v-model="form"
      :items="items"
      :rules="rules"
      :span="24"
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
        />
      </template>
    </ArtForm>
  </ArtDialog>
</template>
<script setup lang="ts">
  import ArtTableSingleSelect from '@/components/core/forms/art-data-select/table-single.vue'
  import { ref, reactive } from 'vue'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import type { DataSelectFetchParams } from '@/components/core/forms/art-data-select/types'
  import { useUserStore } from '@/store/modules/user'
  import { saveProcessRoute, fetchProductionReferences, type ProcessRoute } from '@mdm/api'
  const emit = defineEmits<{ success: [] }>()
  const user = useUserStore()
  const dialogRef = ref<ArtDialogExpose>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const form = reactive({ materialId: '', name: '' })
  const selection = ref<NonNullable<ProcessRoute['material']>[]>([])
  const items: FormItem[] = [
    { key: 'basic', label: '路线资料', type: 'divider', span: 24 },
    { key: 'materialId', label: '产品' },
    {
      key: 'name',
      label: '路线名称',
      type: 'input',
      props: { maxlength: 120, placeholder: '例如：标准装配路线' }
    }
  ]
  const rules = {
    materialId: [{ required: true, message: '请选择产品', trigger: 'change' }],
    name: [{ required: true, message: '请输入路线名称', trigger: 'blur' }]
  }
  const fetchMaterials = (p: DataSelectFetchParams) =>
    fetchProductionReferences('material', user.info.tenantId || '', p.keyword, p.page, p.pageSize)
  async function handleOpen(row?: ProcessRoute) {
    Object.assign(form, { materialId: row?.materialId || '', name: row?.name || '' })
    selection.value = row?.material ? [row.material] : []
    await dialogRef.value?.handleOpen(undefined, {
      title: row ? '编辑工艺路线' : '新增工艺路线',
      subtitle: row ? '调整产品与路线名称' : '先建立路线，再继续维护工序步骤',
      confirmText: row ? '保存更改' : '创建路线',
      contentMaxHeight: '58vh',
      onConfirm: async () => {
        try {
          await formRef.value?.validate()
          await saveProcessRoute({ ...form, name: form.name.trim() }, row?.id)
          emit('success')
        } catch {
          return false
        }
      }
    })
  }
  defineExpose({ handleOpen })
</script>
