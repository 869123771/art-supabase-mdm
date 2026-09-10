<template>
  <ArtDialog ref="dialogRef" size="lg"
    ><ArtSectionCard
      title="设备列表"
      :subtitle="center ? `${center.code} · ${center.name}` : ''"
      :loading="state.loading"
      :error="state.error"
      retryable
      @retry="load"
      ><template #actions
        ><ElButton v-auth="'MdmWorkCenter:Devices'" type="primary" @click="openDevice()"
          >添加设备</ElButton
        ></template
      ><ArtTable
        :data="state.rows"
        :columns="columns"
        :height="300"
        :show-pagination="false"
        empty-text="暂无设备"
        empty-description="添加设备并选择主设备，用于工作中心的生产执行。" /></ArtSectionCard
  ></ArtDialog>
  <ArtDialog ref="editDialog" size="md"
    ><ArtForm
      ref="formRef"
      v-model="form"
      :items="items"
      :rules="rules"
      :span="24"
      :show-reset="false"
      :show-submit="false"
      ><template #equipmentId
        ><ArtTableSingleSelect
          v-model="form.equipmentId"
          :selected-data="selection"
          :api-fn="fetchEquipment"
          :columns="[
            { prop: 'equipmentCode', label: '设备编号', minWidth: 140 },
            { prop: 'equipmentName', label: '设备名称', minWidth: 180 }
          ]"
          label-key="equipmentName"
          title="选择设备" /></template></ArtForm
  ></ArtDialog>
</template>
<script setup lang="tsx">
  import ArtTableSingleSelect from '@/components/core/forms/art-data-select/table-single.vue'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  const { confirmAction } = useArtFeedback()
  import { ref, reactive, shallowRef } from 'vue'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import type { ColumnOption } from '@/types'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import type { DataSelectFetchParams } from '@/components/core/forms/art-data-select/types'
  import { useUserStore } from '@/store/modules/user'
  import {
    fetchCenterDevices,
    saveCenterDevice,
    deleteCenterDevice,
    fetchProductionReferences,
    type WorkCenter,
    type CenterDevice
  } from '@mdm/api'
  const user = useUserStore()
  const dialogRef = ref<ArtDialogExpose>()
  const editDialog = ref<ArtDialogExpose>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const center = shallowRef<WorkCenter>()
  const selection = ref<{ id: string; equipmentCode: string; equipmentName: string }[]>([])
  const state = reactive({ rows: [] as CenterDevice[], loading: false, error: '' })
  const form = reactive({ equipmentId: '', isMain: false, point: '无' })
  const items: FormItem[] = [
    { key: 'equipmentId', label: '设备' },
    { key: 'isMain', label: '主设备', type: 'switch' },
    {
      key: 'point',
      label: '投入 / 产出点',
      type: 'select',
      options: ['无', '投入点', '产出点'].map((value) => ({ label: value, value }))
    }
  ]
  const rules = { equipmentId: [{ required: true, message: '请选择设备', trigger: 'change' }] }
  const fetchEquipment = (p: DataSelectFetchParams) =>
    fetchProductionReferences('equipment', user.info.tenantId || '', p.keyword, p.page, p.pageSize)
  const columns: ColumnOption<CenterDevice>[] = [
    {
      prop: 'equipmentCode',
      label: '设备编号',
      minWidth: 160,
      formatter: (r) => r.equipment?.equipmentCode || '—'
    },
    {
      prop: 'equipmentName',
      label: '设备名称',
      minWidth: 180,
      formatter: (r) => r.equipment?.equipmentName || '—'
    },
    { prop: 'isMain', label: '主设备', width: 100, formatter: (r) => (r.isMain ? '是' : '否') },
    { prop: 'point', label: '投入 / 产出点', width: 130 },
    {
      prop: 'operation',
      label: '操作',
      width: 100,
      formatter: (r) => (
        <div class="center-device-actions">
          <ArtButtonTable
            type="edit"
            permission="MdmWorkCenter:Devices"
            onClick={() => void openDevice(r)}
          />
          <ArtButtonTable
            type="delete"
            permission="MdmWorkCenter:Devices"
            onClick={() => void remove(r)}
          />
        </div>
      )
    }
  ]
  async function load() {
    if (!center.value) return
    state.loading = true
    state.error = ''
    try {
      state.rows = await fetchCenterDevices(center.value.id)
    } catch {
      state.error = '设备加载失败，请重试'
    } finally {
      state.loading = false
    }
  }
  async function remove(row: CenterDevice) {
    try {
      await confirmAction('确认从工作中心移除该设备？', '移除设备', { type: 'warning' })
      await deleteCenterDevice(row.id)
      await load()
    } catch {
      /* API owns feedback. */
    }
  }
  async function openDevice(row?: CenterDevice) {
    Object.assign(form, {
      equipmentId: row?.equipmentId || '',
      isMain: row?.isMain ?? !state.rows.length,
      point: row?.point || '无'
    })
    selection.value = row?.equipment ? [row.equipment] : []
    await editDialog.value?.handleOpen(undefined, {
      title: row ? '编辑设备' : '添加设备',
      confirmText: '保存设备',
      onConfirm: async () => {
        try {
          await formRef.value?.validate()
          if (!center.value) return false
          await saveCenterDevice({ ...form, workCenterId: center.value.id }, row?.id)
          await load()
        } catch {
          return false
        }
      }
    })
  }
  async function handleOpen(row: WorkCenter) {
    center.value = row
    await dialogRef.value?.handleOpen(undefined, {
      title: '工作中心设备',
      showConfirmButton: false,
      cancelText: '关闭',
      onOpen: load
    })
  }
  defineExpose({ handleOpen })
</script>
