<template>
  <ArtPermissionGuard permission="MdmBomStructure:View" resource-name="BOM 结构查询">
    <div
      class="bom-structure-page business-workspace-page art-full-height"
      :class="{ 'is-focus-mode': focusMode }"
    >
      <BusinessWorkspaceHeader
        v-show="!focusMode"
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
      >
        <template #actions>
          <BusinessWorkspaceFocusToggle
            v-model="focusMode"
            title="隐藏页面概览，只保留 BOM 树与数据列表；按 Esc 可退出"
          />
        </template>
      </BusinessWorkspaceHeader>

      <div class="bom-structure-page__workspace">
        <ArtWorkspaceSplitter
          primary-size="380px"
          primary-min="320px"
          primary-max="520px"
          :breakpoint="980"
          stacked-primary-size="440px"
        >
          <template #primary>
            <ArtSectionCard
              class="bom-structure-page__navigator"
              body-class="bom-structure-page__navigator-body"
              title="树形 BOM"
              subtitle="选择父项物料并控制展开层级"
            >
              <div class="bom-structure-page__controls">
                <label class="bom-structure-page__material-control"
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
                <div class="bom-structure-page__view-controls">
                  <label
                    ><span>展开方式</span
                    ><ElSegmented
                      v-model="mode"
                      :options="modeOptions"
                      block
                      @change="loadStructure"
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
                    :indent="18"
                    default-expand-all
                    highlight-current
                    :expand-on-click-node="false"
                  >
                    <template #default="{ data }">
                      <span class="bom-structure-page__tree-node"
                        ><span class="bom-structure-page__tree-icon"
                          ><ArtSvgIcon
                            :icon="data.hasChildren ? 'ri:git-branch-line' : 'ri:box-3-line'"
                        /></span>
                        <span class="bom-structure-page__tree-identity"
                          ><strong>{{ data.materialName }}</strong
                          ><small
                            >{{ data.materialCode }} ·
                            {{ data.specificationModel || '无规格' }}</small
                          ></span
                        ></span
                      >
                    </template>
                  </ElTree>
                </ArtAsyncState>
              </ElScrollbar>
            </ArtSectionCard>
          </template>

          <ArtSectionCard
            class="bom-structure-page__detail"
            body-class="bom-structure-page__detail-body"
            title="BOM 数据列表"
            :subtitle="resultSubtitle"
            :empty="!selectedBom"
            empty-title="选择物料查询 BOM"
            empty-description="系统会通过物料 ID 定位 BOM，并在左侧完整展开结构。"
          >
            <template v-if="selectedBom || focusMode" #actions>
              <ArtDictDisplay
                v-if="selectedBom"
                dict-code="mdmBomStatus"
                :value="selectedBom.status"
                display="tag"
              />
              <BusinessWorkspaceFocusToggle v-if="focusMode" v-model="focusMode" />
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
              table-layout="fixed"
              :pagination="false"
              scrollbar-always-on
              empty-text="当前 BOM 暂无组件"
              empty-description="当前父项尚未维护下级组件。"
            />
          </ArtSectionCard>
        </ArtWorkspaceSplitter>
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
  import BusinessWorkspaceFocusToggle from '@/components/business/business-workspace-focus-toggle/index.vue'
  import { useWorkspaceFocus } from '@/hooks/core/useWorkspaceFocus'
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
  const { focusMode } = useWorkspaceFocus()
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
    {
      prop: 'depth',
      label: '层级',
      width: 76,
      formatter: (row) => (row.depth === 0 ? '根级' : `第 ${row.depth} 层`)
    },
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
    gap: var(--art-space-3);
    min-width: 0;
    overflow: hidden;

    &.is-focus-mode {
      gap: 0;
    }

    &__workspace {
      display: flex;
      flex: 1;
      min-width: 0;
      min-height: 0;
    }

    &__navigator,
    &__detail {
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }

    :deep(.bom-structure-page__navigator-body),
    :deep(.bom-structure-page__detail-body) {
      flex: 1;
      min-height: 0;
    }

    :deep(.bom-structure-page__navigator-body) {
      display: flex;
      flex-direction: column;
    }

    :deep(.bom-structure-page__detail-body) {
      display: flex;
      flex-direction: column;

      > .art-table {
        flex: 1;
        min-height: 0;
      }
    }

    &__controls {
      display: grid;
      flex: none;
      gap: var(--art-space-3);

      label {
        display: grid;
        gap: var(--art-space-1);
        min-width: 0;

        > span {
          font-size: var(--art-font-size-caption);
          font-weight: 600;
          color: var(--el-text-color-regular);
        }
      }
    }

    &__view-controls {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 104px;
      gap: var(--art-space-3);
      align-items: end;

      :deep(.el-input-number) {
        width: 100%;
      }
    }

    &__tree-scroll {
      flex: 1;
      min-height: 0;
      padding-top: var(--art-space-2);
      margin-top: var(--art-space-3);
      border-top: 1px solid var(--el-border-color-lighter);
    }

    :deep(.el-tree) {
      min-width: 0;
      background: transparent;
    }

    :deep(.el-tree-node__content) {
      height: auto;
      min-height: 52px;
      padding: 5px var(--art-space-2) 5px 0;
      margin-bottom: 2px;
      border-radius: var(--el-border-radius-base);
    }

    :deep(.el-tree-node__content:hover),
    :deep(.el-tree-node:focus > .el-tree-node__content) {
      background: color-mix(in srgb, var(--theme-color) 5%, var(--el-fill-color-light));
    }

    :deep(.el-tree-node.is-current > .el-tree-node__content) {
      background: color-mix(in srgb, var(--theme-color) 10%, var(--el-fill-color-light));
    }

    &__tree-node {
      display: grid;
      flex: 1;
      grid-template-columns: 30px minmax(0, 1fr);
      gap: var(--art-space-2);
      align-items: center;
      min-width: 0;
    }

    &__tree-icon {
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 8%, var(--default-box-color));
      border-radius: var(--el-border-radius-base);
    }

    &__tree-identity,
    &__tree-identity strong,
    &__tree-identity small {
      display: block;
      min-width: 0;
    }

    &__tree-identity strong,
    &__tree-identity small {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__tree-identity strong {
      font-size: var(--art-font-size-body);
      font-weight: 650;
      line-height: 20px;
      color: var(--el-text-color-primary);
    }

    &__tree-identity small {
      margin-top: 1px;
      font-family: var(--art-font-family-mono, Consolas, monospace);
      font-size: 11px;
      line-height: 17px;
      color: var(--el-text-color-secondary);
    }

    &__root {
      display: grid;
      flex: none;
      grid-template-columns: 46px minmax(0, 1fr);
      gap: var(--art-space-3);
      align-items: center;
      padding: var(--art-space-3);
      margin-bottom: var(--art-space-3);
      background: color-mix(in srgb, var(--theme-color) 6%, var(--el-bg-color));
      border: 1px solid color-mix(in srgb, var(--theme-color) 14%, var(--el-border-color-lighter));
      border-radius: var(--el-border-radius-base);

      > span {
        display: grid;
        place-items: center;
        width: 46px;
        height: 46px;
        color: var(--theme-color);
        background: var(--el-bg-color);
        border-radius: var(--el-border-radius-base);
      }

      small,
      strong,
      p {
        display: block;
        margin: 0;
      }

      small,
      p {
        font-size: var(--art-font-size-caption);
        color: var(--el-text-color-secondary);
      }

      strong {
        margin: 3px 0;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: var(--art-font-size-subtitle);
        color: var(--el-text-color-primary);
        white-space: nowrap;
      }
    }

    @media (width <= 980px) {
      height: auto;
      overflow: visible;

      &__workspace {
        flex: none;
      }

      &__navigator {
        height: 440px;
      }

      &__detail {
        min-height: 520px;
      }
    }
  }
</style>
