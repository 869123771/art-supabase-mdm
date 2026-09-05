<template>
  <ArtDrawer ref="drawerRef" size="560px"
    ><ArtDescriptions :data="record" :items="items" :columns="2"
  /></ArtDrawer>
</template>
<script setup lang="ts">
  import { ref } from 'vue'
  import type { ArtDrawerExpose } from '@/components/core/drawers/art-drawer/types'
  import type { ArtDescriptionItem } from '@/components/core/base/art-descriptions/types'
  const drawerRef = ref<ArtDrawerExpose>()
  const record = ref<Record<string, unknown>>({})
  const items = ref<ArtDescriptionItem[]>([])
  async function handleOpen(
    title: string,
    data: Record<string, unknown>,
    labels: Record<string, string>
  ) {
    record.value = data
    items.value = Object.entries(labels).map(([key, label]) => ({
      key,
      field: key,
      label,
      dictCode: (
        {
          workType: 'mdmProductionWorkType',
          gender: 'sex',
          tagType: 'mdmProductionTagStyle'
        } as Record<string, string>
      )[key],
      span: key === 'remark' ? 2 : 1
    }))
    await drawerRef.value?.handleOpen(undefined, {
      title,
      showConfirmButton: false,
      cancelText: '关闭'
    })
  }
  defineExpose({ handleOpen })
</script>
