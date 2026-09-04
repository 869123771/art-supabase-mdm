<template>
  <div class="catalog-page business-workspace-page art-full-height">
    <BusinessWorkspaceHeader
      density="compact"
      eyebrow="MDM UNIFIED CATALOG"
      :title="pageMeta.title"
      :description="pageMeta.description"
      :icon="pageMeta.icon"
      :tags="[
        { label: '只读目录', type: 'primary' },
        { label: '租户隔离', type: 'success' }
      ]"
    />

    <ArtSectionCard
      class="catalog-card"
      title="目录记录"
      :subtitle="`统一检索${pageMeta.searchHint}，当前共 ${records.length} 条记录。`"
      preserve-content-structure
    >
      <div class="catalog-toolbar">
        <el-input
          v-model="keyword"
          clearable
          class="keyword-input"
          :placeholder="`搜索${pageMeta.searchHint}`"
          @keyup.enter="loadRecords"
          @clear="loadRecords"
        >
          <template #prefix><ArtSvgIcon icon="ri:search-line" /></template>
        </el-input>
        <el-button type="primary" :loading="loading" @click="loadRecords">查询</el-button>
        <el-button :disabled="loading" @click="resetSearch">重置</el-button>
        <span class="result-count">共 {{ records.length }} 条目录记录</span>
      </div>

      <el-alert
        v-if="errorMessage"
        class="state-alert"
        type="error"
        show-icon
        :closable="false"
        :title="errorMessage"
      />

      <div class="table-shell">
        <el-table v-loading="loading" :data="records" stripe height="100%">
          <el-table-column label="主数据类型" prop="sourceLabel" width="132">
            <template #default="{ row }">
              <span class="source-cell">
                <i></i>
                {{ row.sourceLabel }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="编码" prop="code" min-width="150" show-overflow-tooltip />
          <el-table-column label="名称" prop="name" min-width="220" show-overflow-tooltip>
            <template #default="{ row }"
              ><strong>{{ row.name }}</strong></template
            >
          </el-table-column>
          <el-table-column label="状态" prop="status" width="112">
            <template #default="{ row }">
              <el-tag :type="statusType(row.status)" effect="light" round>{{ row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="最近更新" prop="updateTime" width="178">
            <template #default="{ row }">{{ formatDateTime(row.updateTime) }}</template>
          </el-table-column>
          <template #empty>
            <el-empty :description="keyword ? '没有匹配的主数据' : '当前目录暂无数据'" />
          </template>
        </el-table>
      </div>

      <footer class="catalog-footer">
        <ArtSvgIcon icon="ri:information-line" />
        此页面用于跨系统查询与治理核对；主数据维护请在对应来源业务系统中完成。
      </footer>
    </ArtSectionCard>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import BusinessWorkspaceHeader from '@/components/business/business-workspace-header/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { fetchMdmCatalog, type MdmCatalogRecord, type MdmCatalogScope } from '@mdm/api'

  interface CatalogPageMeta {
    scope: MdmCatalogScope
    title: string
    description: string
    searchHint: string
    icon: string
  }

  const route = useRoute()
  const keyword = ref('')
  const records = ref<MdmCatalogRecord[]>([])
  const loading = ref(false)
  const errorMessage = ref('')

  const routeCatalog: Record<string, CatalogPageMeta> = {
    'organization-directory': {
      scope: 'organization',
      title: '组织机构主数据',
      description: '统一核对组织编码、组织名称与启停状态。',
      searchHint: '组织编码或名称',
      icon: 'ri:organization-chart'
    },
    'position-directory': {
      scope: 'position',
      title: '岗位与职务主数据',
      description: '汇总岗位和标准职务，形成统一的人岗语义目录。',
      searchHint: '岗位、职务编码或名称',
      icon: 'ri:briefcase-4-line'
    },
    'employee-directory': {
      scope: 'employee',
      title: '员工身份主数据',
      description: '仅展示员工编号、姓名和任职状态等治理必要字段。',
      searchHint: '员工编号或姓名',
      icon: 'ri:contacts-book-3-line'
    },
    'business-partner-directory': {
      scope: 'partner',
      title: '统一往来主体',
      description: '统一查看客户、承运商、供应商等外部主体身份。',
      searchHint: '主体编码或名称',
      icon: 'ri:building-4-line'
    },
    'logistics-directory': {
      scope: 'logistics',
      title: '物流基础主数据',
      description: '集中查询站点、货物与司机的基础身份信息。',
      searchHint: '站点、货物或司机',
      icon: 'ri:route-line'
    },
    'vehicle-directory': {
      scope: 'vehicle',
      title: '车辆主数据',
      description: '跨业务域统一识别车辆牌照与运营状态。',
      searchHint: '车牌号',
      icon: 'ri:truck-line'
    },
    'equipment-directory': {
      scope: 'equipment',
      title: '设备与备件主数据',
      description: '统一查看设备及备件编码、名称与资产状态。',
      searchHint: '设备或备件编码、名称',
      icon: 'ri:tools-line'
    },
    'material-directory': {
      scope: 'material',
      title: '物料与场所主数据',
      description: '集中查看物料、场所和存放位置的治理目录。',
      searchHint: '物料、场所或位置',
      icon: 'ri:archive-stack-line'
    }
  }

  const pageKey = computed(() => String(route.path.split('/').filter(Boolean).at(-1) ?? ''))
  const pageMeta = computed(
    () => routeCatalog[pageKey.value] ?? routeCatalog['business-partner-directory']
  )

  const loadRecords = async () => {
    loading.value = true
    errorMessage.value = ''
    try {
      records.value = await fetchMdmCatalog(pageMeta.value.scope, keyword.value)
    } catch (error) {
      records.value = []
      errorMessage.value = error instanceof Error ? error.message : '主数据目录加载失败'
    } finally {
      loading.value = false
    }
  }

  const resetSearch = () => {
    keyword.value = ''
    void loadRecords()
  }

  const formatDateTime = (value: string | null) => {
    if (!value) return '—'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', { hour12: false })
  }

  const statusType = (status: string): 'success' | 'info' | 'warning' => {
    const normalized = status.toLocaleLowerCase()
    if (['启用', 'active', 'enabled', '在职', 'normal'].includes(normalized)) return 'success'
    if (['停用', 'disabled', 'inactive', '离职'].includes(normalized)) return 'info'
    return 'warning'
  }

  watch(() => route.path, loadRecords)
  onMounted(loadRecords)
</script>

<style scoped lang="scss">
  .catalog-page {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .catalog-card {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    padding: 18px;
  }

  .catalog-toolbar {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 14px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--el-border-radius-base) var(--el-border-radius-base) 0 0;
  }

  .keyword-input {
    width: min(360px, 100%);
  }

  .result-count {
    margin-left: auto;
    font-size: 13px;
    color: var(--art-text-gray-600, #667085);
  }

  .state-alert {
    margin: 12px 0;
  }

  .table-shell {
    flex: 1;
    min-height: 320px;
    padding: 0 14px 14px;
    overflow: hidden;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-top: 0;
    border-radius: 0 0 var(--el-border-radius-base) var(--el-border-radius-base);
  }

  .source-cell {
    display: inline-flex;
    gap: 8px;
    align-items: center;

    i {
      width: 6px;
      height: 6px;
      background: var(--el-color-primary);
      border-radius: 50%;
    }
  }

  .catalog-footer {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 12px;
    font-size: 12px;
    color: var(--art-text-gray-600, #667085);
  }

  @media (width <= 700px) {
    .catalog-page {
      overflow: auto;
    }

    .catalog-toolbar {
      flex-wrap: wrap;
    }

    .keyword-input {
      flex: 1 0 100%;
    }

    .result-count {
      flex: 1 0 100%;
      margin-left: 0;
    }

    .table-shell {
      flex: none;
      height: 520px;
    }
  }
</style>
