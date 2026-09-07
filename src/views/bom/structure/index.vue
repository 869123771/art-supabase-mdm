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

      <ArtSectionCard
        class="bom-structure-page__filters"
        title="分析条件"
        subtitle="选择一个 BOM 版本，并设置需要展开的结构范围。"
        preserve-content-structure
      >
        <div class="bom-structure-page__filter-grid">
          <label class="bom-structure-page__field bom-structure-page__field--bom">
            <span><ArtSvgIcon icon="ri:git-branch-line" />BOM 版本</span>
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
              aria-label="选择 BOM 版本"
              @change="handleBomChange"
            />
          </label>
          <label class="bom-structure-page__field">
            <span><ArtSvgIcon icon="ri:node-tree" />展开方式</span>
            <ElSegmented
              v-model="mode"
              :options="modeOptions"
              aria-label="选择 BOM 展开方式"
              @change="loadStructure"
            />
          </label>
          <label class="bom-structure-page__field">
            <span><ArtSvgIcon icon="ri:stack-line" />最大层级</span>
            <ElInputNumber
              v-model="maxDepth"
              :min="2"
              :max="20"
              :disabled="mode === 'single'"
              controls-position="right"
              aria-label="BOM 最大展开层级"
              @change="loadStructure"
            />
            <small>{{ mode === 'single' ? '单层模式固定展开 1 层' : '支持展开 2–20 层' }}</small>
          </label>
        </div>
      </ArtSectionCard>

      <ArtSectionCard
        class="bom-structure-page__result"
        title="结构视图"
        :subtitle="resultSubtitle"
        :loading="loading"
        :error="loadError"
        error-title="BOM 结构加载失败"
        :empty="!selectedBom"
        empty-title="选择一个 BOM 版本"
        empty-description="选定父项及版本后，系统会在这里展开单层或多层结构。"
        :empty-visual-size="112"
        :min-height="320"
        @retry="loadStructure"
      >
        <template #actions>
          <div class="bom-structure-page__legend" aria-label="结构状态图例">
            <span><i class="is-branch"></i>含下级</span>
            <span><i></i>末级件</span>
          </div>
        </template>

        <ElScrollbar v-if="selectedBom" class="bom-structure-page__scrollbar">
          <div class="bom-structure-page__content">
            <header class="bom-structure-page__root">
              <span class="bom-structure-page__root-icon"><ArtSvgIcon icon="ri:box-3-line" /></span>
              <div class="bom-structure-page__root-main">
                <small>根节点 · {{ selectedBom.bomCode }} · {{ selectedBom.version }}</small>
                <strong>{{ selectedBom.material?.materialName || '父项物料' }}</strong>
                <p>{{ rootMaterialDescription }}</p>
              </div>
              <div class="bom-structure-page__root-tags">
                <ArtDictDisplay
                  dict-code="mdmBomPurpose"
                  :value="selectedBom.purpose"
                  display="tag"
                />
                <ArtDictDisplay
                  dict-code="mdmBomStatus"
                  :value="selectedBom.status"
                  display="tag"
                />
              </div>
            </header>

            <ArtAsyncState
              :empty="!tree.length"
              empty-text="当前 BOM 暂无组件明细"
              empty-description="返回 BOM 维护添加组件后，即可在这里查看层级结构。"
              :empty-image-size="88"
              :min-height="220"
            >
              <div class="bom-structure-page__column-head">
                <span>组件层级</span><span>需求用量</span><span>结构状态</span>
              </div>
              <ElTree
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
                    <span class="bom-structure-page__node-icon">
                      <ArtSvgIcon :icon="data.hasChildren ? 'ri:node-tree' : 'ri:box-3-line'" />
                    </span>
                    <div class="bom-structure-page__node-main">
                      <small>第 {{ data.depth }} 层</small>
                      <strong>{{ data.materialName }}</strong>
                      <p>{{ nodeDescription(data) }}</p>
                    </div>
                    <div class="bom-structure-page__quantity">
                      <strong>{{ formatQuantity(data.quantity) }}</strong>
                      <small>{{ data.unitName || '—' }}</small>
                    </div>
                    <ElTag
                      :type="data.hasChildren ? 'primary' : 'info'"
                      effect="plain"
                      size="small"
                    >
                      {{ data.hasChildren ? '含下级' : '末级件' }}
                    </ElTag>
                  </div>
                </template>
              </ElTree>
            </ArtAsyncState>
          </div>
        </ElScrollbar>
      </ArtSectionCard>
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="ts">
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtAsyncState from '@/components/core/feedback/art-async-state/index.vue'
  import ArtTableSingleSelect from '@/components/core/forms/art-data-select/table-single.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import TreeUtils from '@/utils/tree'
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
  let loadRequestId = 0
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
  const flatNodes = computed(() => treeUtils.treeToList(tree.value))
  const resultSubtitle = computed(() => {
    if (!selectedBom.value) return '选择版本后查看父项、层级、需求用量与可继续展开节点。'
    const scope = mode.value === 'single' ? '单层结构' : `最多 ${maxDepth.value} 层`
    return `${selectedBom.value.bomCode} · ${scope} · ${flatNodes.value.length} 个组件节点`
  })
  const rootMaterialDescription = computed(() =>
    [selectedBom.value?.material?.materialCode, selectedBom.value?.material?.specificationModel]
      .filter(Boolean)
      .join(' · ')
  )
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
  const nodeDescription = (node: BomStructureNode): string =>
    [node.materialCode, node.specificationModel].filter(Boolean).join(' · ') || '未维护物料说明'
  const formatQuantity = (value: number): string =>
    Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 6 })

  async function loadStructure() {
    const currentRequestId = ++loadRequestId
    if (!selectedBom.value) {
      tree.value = []
      loadError.value = null
      return
    }
    loading.value = true
    loadError.value = null
    try {
      const rows = await fetchBomStructure(
        selectedBom.value.id,
        mode.value === 'single' ? 1 : maxDepth.value
      )
      if (currentRequestId === loadRequestId) tree.value = treeUtils.listToTree(rows)
    } catch (error) {
      if (currentRequestId === loadRequestId) {
        tree.value = []
        loadError.value = error instanceof Error ? error : new Error('BOM 结构加载失败')
      }
    } finally {
      if (currentRequestId === loadRequestId) loading.value = false
    }
  }
</script>

<style scoped lang="scss">
  .bom-structure-page {
    display: flex;
    flex-direction: column;
    gap: var(--art-space-3);
    min-width: 0;
    min-height: 0;

    &__filters {
      flex: none;
    }

    &__filter-grid {
      display: grid;
      grid-template-columns: minmax(320px, 1fr) minmax(190px, auto) 184px;
      gap: var(--art-space-4);
      align-items: start;
    }

    &__field {
      display: grid;
      gap: var(--art-space-2);
      min-width: 0;

      > span {
        display: inline-flex;
        gap: var(--art-space-2);
        align-items: center;
        font-size: var(--art-font-size-caption);
        font-weight: 600;
        color: var(--el-text-color-regular);

        svg {
          color: var(--theme-color);
        }
      }

      > small {
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }

      :deep(.el-segmented),
      :deep(.el-input-number) {
        width: 100%;
      }
    }

    &__result {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 320px;
      overflow: hidden;

      :deep(.art-section-card__body) {
        flex: 1;
        min-height: 0;
      }
    }

    &__legend {
      display: inline-flex;
      gap: var(--art-space-3);
      align-items: center;
      font-size: var(--art-font-size-caption);
      color: var(--el-text-color-secondary);

      span {
        display: inline-flex;
        gap: var(--art-space-1);
        align-items: center;
      }

      i {
        width: 7px;
        height: 7px;
        background: var(--el-color-info-light-5);
        border-radius: 50%;

        &.is-branch {
          background: var(--theme-color);
        }
      }
    }

    &__scrollbar {
      height: 100%;
    }

    &__content {
      min-width: 660px;
      padding-right: var(--art-space-1);
    }

    &__root {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: var(--art-space-3);
      align-items: center;
      padding: var(--art-space-4);
      background: color-mix(in srgb, var(--theme-color) 7%, var(--el-bg-color));
      border: 1px solid color-mix(in srgb, var(--theme-color) 18%, var(--el-border-color-lighter));
      border-radius: var(--el-border-radius-base);
    }

    &__root-icon,
    &__node-icon {
      display: grid;
      place-items: center;
      color: var(--theme-color);
      background: var(--el-bg-color);
      border-radius: var(--el-border-radius-base);
    }

    &__root-icon {
      width: 46px;
      height: 46px;
      font-size: 21px;
    }

    &__root-main {
      min-width: 0;

      small,
      strong,
      p {
        display: block;
        margin: 0;
      }

      small {
        font-size: 10px;
        font-weight: 700;
        color: var(--theme-color);
        letter-spacing: 0.05em;
      }

      strong {
        margin-top: 2px;
        font-size: 16px;
      }

      p {
        margin-top: 3px;
        overflow: hidden;
        text-overflow: ellipsis;
        font-family: var(--art-font-family-mono, Consolas, monospace);
        font-size: 11px;
        color: var(--el-text-color-secondary);
        white-space: nowrap;
      }
    }

    &__root-tags {
      display: flex;
      flex-wrap: wrap;
      gap: var(--art-space-2);
      justify-content: flex-end;
    }

    &__column-head {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 150px 104px;
      gap: var(--art-space-3);
      padding: var(--art-space-3) var(--art-space-4) var(--art-space-2) 58px;
      font-size: var(--art-font-size-caption);
      font-weight: 600;
      color: var(--el-text-color-secondary);
    }

    &__tree {
      --el-tree-node-content-height: 62px;

      background: transparent;

      :deep(.el-tree-node__content) {
        height: auto;
        min-height: 62px;
        margin-bottom: var(--art-space-1);
        background: var(--el-fill-color-lighter);
        border: 1px solid transparent;
        border-radius: var(--el-border-radius-base);
        transition:
          border-color 0.16s ease,
          background-color 0.16s ease;

        &:hover {
          background: color-mix(in srgb, var(--theme-color) 5%, var(--el-fill-color-lighter));
          border-color: color-mix(in srgb, var(--theme-color) 20%, var(--el-border-color-lighter));
        }
      }

      :deep(.el-tree-node__expand-icon) {
        margin-left: var(--art-space-2);
      }
    }

    &__node {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr) 150px 104px;
      gap: var(--art-space-3);
      align-items: center;
      width: 100%;
      min-width: 0;
      padding: var(--art-space-2) var(--art-space-3) var(--art-space-2) 2px;
    }

    &__node-icon {
      width: 32px;
      height: 32px;
    }

    &__node-main,
    &__quantity {
      min-width: 0;
    }

    &__node-main {
      small,
      strong,
      p {
        display: block;
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        font-size: 9px;
        font-weight: 700;
        color: var(--theme-color);
      }

      p {
        margin-top: 2px;
        font-family: var(--art-font-family-mono, Consolas, monospace);
        font-size: 10px;
        color: var(--el-text-color-secondary);
      }
    }

    &__quantity {
      strong {
        font-variant-numeric: tabular-nums;
      }

      small {
        margin-left: var(--art-space-1);
        color: var(--el-text-color-secondary);
      }
    }

    @media (width <= 1000px) {
      &__filter-grid {
        grid-template-columns: 1fr 1fr;
      }

      &__field--bom {
        grid-column: 1 / -1;
      }
    }

    @media (width <= 760px) {
      height: auto;

      &__filter-grid {
        grid-template-columns: 1fr;
      }

      &__field--bom {
        grid-column: auto;
      }

      &__result {
        min-height: 440px;
      }
    }
  }
</style>
