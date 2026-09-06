<template>
  <ArtPermissionGuard permission="MdmBomStructure:View" resource-name="BOM 结构查询">
    <div class="bom-structure-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="BOM EXPLORER"
        title="BOM 结构查询"
        description="从任一生效或受控版本向下展开多层物料结构，快速识别层级、用量与可继续展开的组件。"
        icon="ri:organization-chart"
        :tags="[
          { label: '单层 / 多层', type: 'primary' },
          { label: '循环防护', type: 'success' },
          { label: '只读分析', type: 'info' }
        ]"
        :metrics="metrics"
      />

      <section class="bom-structure-page__toolbar">
        <div class="bom-structure-page__selector">
          <label>BOM 版本</label>
          <ArtTableSingleSelect
            v-model="selectedBomId"
            :selected-data="selectedBom ? [selectedBom] : []"
            :api-fn="fetchBomOptions"
            :columns="bomColumns"
            label-key="bomCode"
            :description-key="
              (row) => `${row.material?.materialName || '未关联父项'} · ${row.version}`
            "
            title="选择要展开的 BOM"
            subtitle="可查询设计、审核、生效与历史归档版本"
            show-pagination
            @change="handleBomChange"
          />
        </div>
        <div class="bom-structure-page__mode">
          <label>展开方式</label>
          <ElRadioGroup v-model="mode" @change="loadStructure">
            <ElRadioButton value="single">单层</ElRadioButton>
            <ElRadioButton value="multi">多层</ElRadioButton>
          </ElRadioGroup>
        </div>
        <div v-if="mode === 'multi'" class="bom-structure-page__depth">
          <label>最大层级</label>
          <ElInputNumber
            v-model="maxDepth"
            :min="2"
            :max="20"
            controls-position="right"
            @change="loadStructure"
          />
        </div>
      </section>

      <section class="bom-structure-page__canvas" v-loading="loading">
        <template v-if="selectedBom">
          <header class="bom-structure-page__root">
            <span class="bom-structure-page__root-icon"><ArtSvgIcon icon="ri:box-3-line" /></span>
            <div
              ><small>ROOT MATERIAL · {{ selectedBom.bomCode }} · {{ selectedBom.version }}</small
              ><strong>{{ selectedBom.material?.materialName || '父项物料' }}</strong
              ><p>{{
                [selectedBom.material?.materialCode, selectedBom.material?.specificationModel]
                  .filter(Boolean)
                  .join(' · ')
              }}</p></div
            >
            <ArtDictDisplay dict-code="mdmBomStatus" :value="selectedBom.status" display="tag" />
          </header>
          <div class="bom-structure-page__column-head"
            ><span>组件层级</span><span>需求用量</span><span>结构状态</span></div
          >
          <ElTree
            v-if="tree.length"
            ref="treeRef"
            :data="tree"
            node-key="nodeId"
            :props="{ children: 'children', label: 'materialName' }"
            default-expand-all
            :expand-on-click-node="false"
            class="bom-structure-page__tree"
          >
            <template #default="{ data }">
              <div class="bom-structure-page__node">
                <span class="bom-structure-page__node-icon"
                  ><ArtSvgIcon :icon="data.hasChildren ? 'ri:node-tree' : 'ri:box-3-line'"
                /></span>
                <div class="bom-structure-page__node-main"
                  ><strong>{{ data.materialName }}</strong
                  ><small>{{
                    [data.materialCode, data.specificationModel].filter(Boolean).join(' · ')
                  }}</small></div
                >
                <div class="bom-structure-page__quantity"
                  ><strong>{{ data.quantity }}</strong
                  ><small>{{ data.unitName }}</small></div
                >
                <ElTag :type="data.hasChildren ? 'primary' : 'info'" effect="plain" size="small">{{
                  data.hasChildren ? '可展开' : '末级件'
                }}</ElTag>
              </div>
            </template>
          </ElTree>
          <ArtEmptyState
            v-else
            title="当前 BOM 暂无组件明细"
            description="返回 BOM 维护添加组件后，即可在这里查看层级结构。"
            :visual-size="96"
          />
        </template>
        <ArtEmptyState
          v-else
          title="选择一个 BOM 版本"
          description="选定父项及版本后，系统会在这里展开单层或多层结构。"
          :visual-size="112"
        />
      </section>
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="ts">
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import ArtTableSingleSelect from '@/components/core/forms/art-data-select/table-single.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import type {
    DataSelectColumn,
    DataSelectFetchParams,
    DataSelectRecord
  } from '@/components/core/forms/art-data-select/types'
  import { useTenantScopeStore } from '@/store/modules/tenantScope'
  import { fetchBoms, fetchBomStructure, type BomRecord, type BomStructureNode } from '@mdm/api'

  defineOptions({ name: 'MdmBomStructure' })
  const userStore = useUserStore()
  const { effectiveTenantId } = storeToRefs(useTenantScopeStore())
  const tenantId = computed(() => effectiveTenantId.value ?? '')
  const selectedBomId = ref<string | number>()
  const selectedBom = ref<BomRecord>()
  const mode = ref<'single' | 'multi'>('multi')
  const maxDepth = ref(8)
  const loading = ref(false)
  const tree = ref<BomStructureNode[]>([])
  const bomColumns: DataSelectColumn[] = [
    { prop: 'bomCode', label: 'BOM 编码', minWidth: 150 },
    { prop: 'version', label: '版本', width: 90 },
    {
      prop: 'purpose',
      label: '用途',
      minWidth: 110,
      dict: { code: 'mdmBomPurpose', display: 'text' }
    },
    {
      prop: 'status',
      label: '状态',
      minWidth: 100,
      dict: { code: 'mdmBomStatus', display: 'tag' }
    }
  ]
  const flatNodes = computed(() => flattenTree(tree.value))
  void Promise.all([
    userStore.ensureDictLoaded('mdmBomPurpose'),
    userStore.ensureDictLoaded('mdmBomStatus')
  ])
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '当前版本',
      value: selectedBom.value?.version || '—',
      description: selectedBom.value?.bomCode || '尚未选择 BOM',
      icon: 'ri:git-branch-line'
    },
    {
      label: '结构层级',
      value: flatNodes.value.length ? Math.max(...flatNodes.value.map((item) => item.depth)) : 0,
      description: mode.value === 'single' ? '单层展开' : `最多 ${maxDepth.value} 层`,
      icon: 'ri:stack-line',
      tone: 'primary'
    },
    {
      label: '组件节点',
      value: flatNodes.value.length,
      description: '当前展开结果',
      icon: 'ri:box-3-line',
      tone: 'success'
    },
    {
      label: '可继续展开',
      value: flatNodes.value.filter((item) => item.hasChildren).length,
      description: '存在下级生效 BOM',
      icon: 'ri:node-tree',
      tone: 'info'
    }
  ])
  const fetchBomOptions = (params: DataSelectFetchParams) =>
    fetchBoms({
      current: params.page,
      size: params.pageSize,
      tenantId: tenantId.value,
      keyword: params.keyword
    })
  const handleBomChange = (_value: unknown, rows: DataSelectRecord[]) => {
    selectedBom.value = rows[0] as BomRecord | undefined
    void loadStructure()
  }
  const buildTree = (rows: BomStructureNode[]): BomStructureNode[] => {
    const map = new Map(
      rows.map((row) => [row.nodeId, { ...row, children: [] as BomStructureNode[] }])
    )
    const roots: BomStructureNode[] = []
    map.forEach((node) => {
      const parent = node.parentNodeId ? map.get(node.parentNodeId) : undefined
      if (parent) parent.children!.push(node)
      else roots.push(node)
    })
    return roots
  }
  const flattenTree = (nodes: BomStructureNode[]): BomStructureNode[] =>
    nodes.flatMap((node) => [node, ...flattenTree(node.children || [])])
  async function loadStructure() {
    if (!selectedBom.value) {
      tree.value = []
      return
    }
    loading.value = true
    try {
      tree.value = buildTree(
        await fetchBomStructure(selectedBom.value.id, mode.value === 'single' ? 1 : maxDepth.value)
      )
    } finally {
      loading.value = false
    }
  }
</script>

<style scoped lang="scss">
  .bom-structure-page {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
    min-width: 0;
  }

  .bom-structure-page__toolbar {
    flex: none;
    display: grid;
    grid-template-columns: minmax(320px, 1fr) auto auto;
    gap: 18px;
    align-items: end;
    padding: 14px 16px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--el-border-radius-base);
  }

  .bom-structure-page__toolbar label {
    display: block;
    margin-bottom: 7px;
    font-size: 11px;
    font-weight: 600;
    color: var(--el-text-color-secondary);
  }

  .bom-structure-page__canvas {
    flex: 1;
    min-height: 0;
    padding: 16px;
    overflow: auto;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--el-border-radius-base);
  }

  .bom-structure-page__root {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 14px 16px;
    background: color-mix(in srgb, var(--theme-color) 7%, var(--el-bg-color));
    border: 1px solid color-mix(in srgb, var(--theme-color) 15%, var(--el-border-color-lighter));
    border-radius: 12px;
  }

  .bom-structure-page__root-icon {
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    font-size: 21px;
    color: var(--theme-color);
    background: var(--el-bg-color);
    border-radius: 11px;
  }

  @media (width <= 900px) {
    .bom-structure-page {
      height: auto;
    }

    .bom-structure-page__canvas {
      min-height: 420px;
    }
  }

  .bom-structure-page__root small,
  .bom-structure-page__root strong,
  .bom-structure-page__root p {
    display: block;
    margin: 0;
  }

  .bom-structure-page__root small {
    font-size: 9px;
    font-weight: 700;
    color: var(--theme-color);
    letter-spacing: 0.08em;
  }

  .bom-structure-page__root p {
    margin-top: 3px;
    font-family: var(--art-font-family-mono, Consolas, monospace);
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }

  .bom-structure-page__column-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 140px 110px;
    gap: 12px;
    padding: 12px 14px 8px 58px;
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }

  .bom-structure-page__tree {
    --el-tree-node-content-height: 54px;

    background: transparent;
  }

  .bom-structure-page__tree :deep(.el-tree-node__content) {
    height: auto;
    min-height: 54px;
    margin-bottom: 4px;
    background: var(--el-fill-color-lighter);
    border: 1px solid transparent;
    border-radius: 9px;
    transition:
      border-color 0.16s ease,
      background-color 0.16s ease;
  }

  .bom-structure-page__tree :deep(.el-tree-node__content:hover) {
    background: color-mix(in srgb, var(--theme-color) 5%, var(--el-fill-color-lighter));
    border-color: color-mix(in srgb, var(--theme-color) 18%, var(--el-border-color-lighter));
  }

  .bom-structure-page__tree :deep(.el-tree-node__expand-icon) {
    margin-left: 8px;
  }

  .bom-structure-page__node {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) 140px 110px;
    gap: 10px;
    align-items: center;
    width: 100%;
    min-width: 0;
    padding: 7px 12px 7px 2px;
  }

  .bom-structure-page__node-icon {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    color: var(--theme-color);
    background: var(--el-bg-color);
    border-radius: 8px;
  }

  .bom-structure-page__node-main,
  .bom-structure-page__quantity {
    min-width: 0;
  }

  .bom-structure-page__node-main strong,
  .bom-structure-page__node-main small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .bom-structure-page__node-main small {
    margin-top: 2px;
    font-family: var(--art-font-family-mono, Consolas, monospace);
    font-size: 10px;
    color: var(--el-text-color-secondary);
  }

  .bom-structure-page__quantity strong {
    font-variant-numeric: tabular-nums;
  }

  .bom-structure-page__quantity small {
    margin-left: 5px;
    color: var(--el-text-color-secondary);
  }

  @media (width <= 860px) {
    .bom-structure-page__toolbar {
      grid-template-columns: 1fr 1fr;
    }

    .bom-structure-page__selector {
      grid-column: 1 / -1;
    }

    .bom-structure-page__column-head {
      display: none;
    }

    .bom-structure-page__node {
      grid-template-columns: 32px minmax(0, 1fr) auto;
    }

    .bom-structure-page__quantity {
      grid-column: 2;
    }

    .bom-structure-page__node .el-tag {
      grid-row: 1 / span 2;
      grid-column: 3;
    }
  }
</style>
