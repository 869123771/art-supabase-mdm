<template>
  <ArtPermissionGuard permission="MdmBomStructure:View" resource-name="BOM 结构查询">
    <div class="bom-structure-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="BOM EXPLORER"
        title="BOM 结构查询"
        description="按物料描述定位 BOM，以单层或多层方式追溯完整产品结构。"
        icon="ri:organization-chart"
        :tags="[
          { label: '物料联查', type: 'primary' },
          { label: '循环防护', type: 'success' },
          { label: '只读分析', type: 'info' }
        ]"
        :metrics="metrics"
      />

      <div class="bom-structure-page__workspace">
        <ArtSectionCard
          class="bom-structure-page__navigator"
          title="树形 BOM"
          subtitle="先选择物料，再控制展开层级"
        >
          <div class="bom-structure-page__controls">
            <label
              ><span>物料描述</span>
              <ArtTableSingleSelect
                v-model="selectedMaterialId"
                :selected-data="selectedMaterial ? [selectedMaterial] : []"
                :api-fn="fetchMaterialOptions"
                :columns="materialColumns"
                :label-key="(row) => formatBomMaterialDescription(row as MaterialArchive)"
                description-key="materialCode"
                title="选择父项物料"
                subtitle="支持物料编码、名称、规格型号和图号综合查询"
                show-pagination
                @change="handleMaterialChange"
              />
            </label>
            <label
              ><span>展开方式</span
              ><ElSegmented v-model="mode" :options="modeOptions" @change="loadStructure"
            /></label>
            <label
              ><span>最大层级</span
              ><ElInputNumber
                v-model="maxDepth"
                :min="2"
                :max="20"
                :disabled="mode === 'single'"
                controls-position="right"
                @change="loadStructure"
            /></label>
          </div>
          <ElScrollbar class="bom-structure-page__tree-scroll">
            <ArtAsyncState
              :loading="loading"
              :empty="!tree.length"
              :error="loadError"
              empty-text="暂无可展示的 BOM 层级"
              empty-description="请选择已建立 BOM 的父项物料。"
              @retry="loadStructure"
            >
              <ElTree
                :data="tree"
                node-key="nodeId"
                :props="{ children: 'children', label: 'materialName' }"
                default-expand-all
                :expand-on-click-node="false"
              >
                <template #default="{ data }">
                  <span class="bom-structure-page__tree-node"
                    ><ArtSvgIcon
                      :icon="data.hasChildren ? 'ri:git-branch-line' : 'ri:box-3-line'"
                    /><span
                      ><strong>{{ data.materialName }}</strong
                      ><small
                        >{{ data.materialCode }} · {{ data.specificationModel || '无规格' }}</small
                      ></span
                    ></span
                  >
                </template>
              </ElTree>
            </ArtAsyncState>
          </ElScrollbar>
        </ArtSectionCard>

        <ArtSectionCard
          class="bom-structure-page__detail"
          title="BOM 数据列表"
          :subtitle="resultSubtitle"
          :empty="!selectedBom"
          empty-title="选择物料查询 BOM"
          empty-description="系统会通过物料 ID 定位 BOM，并在左侧完整展开结构。"
        >
          <template v-if="selectedBom" #actions>
            <ArtDictDisplay dict-code="mdmBomStatus" :value="selectedBom.status" display="tag" />
          </template>
          <div v-if="selectedBom" class="bom-structure-page__root">
            <span><ArtSvgIcon icon="ri:box-3-line" /></span>
            <div
              ><small
                >{{ selectedBom.bomCode
                }}{{ selectedBom.version ? ` · ${selectedBom.version}` : '' }}</small
              ><strong>{{ formatBomMaterialDescription(selectedBom.material) }}</strong
              ><p
                >生产单位：{{ selectedBom.baseUnit?.unitName || '—' }} · 基准数量
                {{ selectedBom.baseQuantity }}</p
              ></div
            >
          </div>
          <ArtTable
            v-if="selectedBom"
            :data="flatNodes"
            :columns="columns"
            row-key="nodeId"
            :pagination="false"
            scrollbar-always-on
            empty-text="当前 BOM 暂无组件"
          />
        </ArtSectionCard>
      </div>
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtAsyncState from '@/components/core/feedback/art-async-state/index.vue'
  import ArtTableSingleSelect from '@/components/core/forms/art-data-select/table-single.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import TreeUtils from '@/utils/tree'
  import type { ColumnOption } from '@/types'
  import type {
    DataSelectFetchParams,
    DataSelectRecord
  } from '@/components/core/forms/art-data-select/types'
  import { useTenantScopeStore } from '@/store/modules/tenantScope'
  import {
    fetchBoms,
    fetchBomStructure,
    fetchMaterialArchives,
    type BomRecord,
    type BomStructureNode,
    type MaterialArchive
  } from '@mdm/api'
  import { formatBomMaterialDescription } from '../modules/material-description'

  defineOptions({ name: 'MdmBomStructure' })
  const { effectiveTenantId } = storeToRefs(useTenantScopeStore())
  const tenantId = computed(() => effectiveTenantId.value ?? '')
  const selectedMaterialId = ref<string | number>()
  const selectedMaterial = ref<MaterialArchive>()
  const selectedBom = ref<BomRecord>()
  const mode = ref<'single' | 'multi'>('multi')
  const modeOptions = [
    { label: '单层', value: 'single' },
    { label: '多层', value: 'multi' }
  ]
  const maxDepth = ref(8)
  const loading = ref(false)
  const loadError = ref<Error | null>(null)
  const tree = ref<BomStructureNode[]>([])
  const treeUtils = new TreeUtils({
    idKey: 'nodeId',
    parentKey: 'parentNodeId',
    childrenKey: 'children',
    deepClone: false
  })
  const flatNodes = computed(() => treeUtils.treeToList(tree.value))
  const materialColumns = [
    { prop: 'materialCode', label: '物料编码', minWidth: 150 },
    { prop: 'materialName', label: '物料名称', minWidth: 180 },
    { prop: 'specificationModel', label: '规格型号', minWidth: 140 },
    { prop: 'drawingNo', label: '图号', minWidth: 120 }
  ]
  const columns: ColumnOption<BomStructureNode>[] = [
    { type: 'index', label: '序号', width: 70 },
    { prop: 'depth', label: '层级', width: 76, formatter: (row) => `第 ${row.depth} 层` },
    { prop: 'materialCode', label: '物料编码', minWidth: 150 },
    { prop: 'materialName', label: '物料名称', minWidth: 180 },
    { prop: 'specificationModel', label: '规格型号', minWidth: 140 },
    { prop: 'quantity', label: '需求数量', width: 110, align: 'right' },
    { prop: 'unitName', label: '计量单位', width: 100 },
    {
      prop: 'hasChildren',
      label: '结构状态',
      width: 100,
      formatter: (row) => (row.hasChildren ? '含下级' : '末级件')
    }
  ]
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '当前层级',
      value: flatNodes.value.length ? Math.max(...flatNodes.value.map((node) => node.depth)) : 0,
      description: '已展开最大深度',
      icon: 'ri:stack-line'
    },
    {
      label: '结构节点',
      value: flatNodes.value.length,
      description: '当前 BOM 组件',
      icon: 'ri:node-tree'
    },
    {
      label: '分支节点',
      value: flatNodes.value.filter((node) => node.hasChildren).length,
      description: '仍含下级组件',
      icon: 'ri:git-branch-line'
    }
  ])
  const resultSubtitle = computed(() =>
    selectedBom.value
      ? `${selectedBom.value.bomCode} · ${flatNodes.value.length} 个结构节点`
      : '通过物料描述查询并展开 BOM'
  )
  const fetchMaterialOptions = (params: DataSelectFetchParams) =>
    fetchMaterialArchives({
      current: params.page,
      size: params.pageSize,
      tenantId: tenantId.value,
      keyword: params.keyword,
      status: 'enabled'
    })
  const handleMaterialChange = async (_value: unknown, rows: DataSelectRecord[]) => {
    selectedMaterial.value = rows[0] as MaterialArchive | undefined
    selectedMaterialId.value = selectedMaterial.value?.id
    await locateBom()
  }
  const locateBom = async () => {
    tree.value = []
    selectedBom.value = undefined
    loadError.value = null
    if (!selectedMaterial.value) return
    loading.value = true
    try {
      const result = await fetchBoms({
        current: 1,
        size: 50,
        tenantId: tenantId.value,
        materialId: selectedMaterial.value.id
      })
      selectedBom.value =
        result.data.find((row) => row.status === 'effective') ||
        result.data.find((row) => row.status === 'review') ||
        result.data[0]
      if (selectedBom.value) await loadStructure()
    } catch (error) {
      loadError.value = error instanceof Error ? error : new Error('BOM 查询失败')
    } finally {
      loading.value = false
    }
  }
  const loadStructure = async () => {
    if (!selectedBom.value) return
    const requestBomId = selectedBom.value.id
    loading.value = true
    loadError.value = null
    try {
      const nodes = await fetchBomStructure(
        requestBomId,
        mode.value === 'single' ? 1 : maxDepth.value
      )
      if (requestBomId === selectedBom.value?.id)
        tree.value = treeUtils.listToTree(nodes) as BomStructureNode[]
    } catch (error) {
      loadError.value = error instanceof Error ? error : new Error('BOM 结构加载失败')
    } finally {
      loading.value = false
    }
  }
  watch(tenantId, () => {
    selectedMaterial.value = undefined
    selectedMaterialId.value = undefined
    selectedBom.value = undefined
    tree.value = []
  })
</script>

<style scoped lang="scss">
  .bom-structure-page {
    gap: 12px;
    min-width: 0;
  }

  .bom-structure-page__workspace {
    display: grid;
    flex: 1;
    grid-template-columns: minmax(300px, 360px) minmax(0, 1fr);
    gap: 12px;
    min-height: 0;
  }

  .bom-structure-page__navigator,
  .bom-structure-page__detail {
    min-height: 0;
    overflow: hidden;
  }

  .bom-structure-page__controls {
    display: grid;
    gap: 14px;
  }

  .bom-structure-page__controls label {
    display: grid;
    gap: 6px;
  }

  .bom-structure-page__controls label > span {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .bom-structure-page__tree-scroll {
    height: calc(100% - 178px);
    padding-top: 10px;
    margin-top: 14px;
    border-top: 1px solid var(--el-border-color-lighter);
  }

  :deep(.bom-structure-page__tree-node) {
    display: flex;
    gap: 8px;
    align-items: center;
    min-width: 0;
  }

  :deep(.bom-structure-page__tree-node strong),
  :deep(.bom-structure-page__tree-node small) {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :deep(.bom-structure-page__tree-node small) {
    margin-top: 2px;
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }

  .bom-structure-page__root {
    display: grid;
    grid-template-columns: 46px minmax(0, 1fr);
    gap: 12px;
    align-items: center;
    padding: 14px;
    margin-bottom: 12px;
    background: color-mix(in srgb, var(--theme-color) 6%, var(--el-bg-color));
    border: 1px solid color-mix(in srgb, var(--theme-color) 14%, var(--el-border-color-lighter));
    border-radius: 10px;
  }

  .bom-structure-page__root > span {
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    color: var(--theme-color);
    background: var(--el-bg-color);
    border-radius: 10px;
  }

  .bom-structure-page__root small,
  .bom-structure-page__root strong,
  .bom-structure-page__root p {
    display: block;
    margin: 0;
  }

  .bom-structure-page__root small,
  .bom-structure-page__root p {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .bom-structure-page__root strong {
    margin: 3px 0;
  }

  @media (width <= 980px) {
    .bom-structure-page__workspace {
      grid-template-columns: 1fr;
    }

    .bom-structure-page__navigator {
      max-height: 420px;
    }
  }
</style>
