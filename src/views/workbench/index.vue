<template>
  <div class="mdm-workbench art-full-height">
    <header class="page-heading">
      <div>
        <div class="eyebrow">MASTER DATA MANAGEMENT</div>
        <h1>主数据治理工作台</h1>
        <p>统一查看跨业务域主数据的覆盖规模与目录入口，业务维护仍由来源系统负责。</p>
      </div>
      <div class="heading-status" aria-label="当前治理模式">
        <span class="status-dot"></span>
        <div>
          <strong>统一目录已接入</strong>
          <span>只读治理模式</span>
        </div>
      </div>
    </header>

    <section v-loading="loading" class="coverage-panel" aria-labelledby="coverage-title">
      <div class="coverage-copy">
        <span class="section-kicker">覆盖概览</span>
        <h2 id="coverage-title">{{ totalRecords.toLocaleString() }} 条主数据</h2>
        <p>来自 {{ totalSources }} 类标准主档，统一遵循租户隔离和 MDM 表命名。</p>
      </div>
      <div class="coverage-track" aria-label="主数据域覆盖分布">
        <span
          v-for="domain in domains"
          :key="domain.key"
          :style="{ flexGrow: Math.max(domain.recordCount, 1) }"
          :title="`${domain.label}：${domain.recordCount} 条`"
        ></span>
      </div>
      <el-button :loading="loading" @click="loadOverview">
        <ArtSvgIcon icon="ri:refresh-line" />
        刷新
      </el-button>
    </section>

    <el-alert
      v-if="errorMessage"
      class="state-alert"
      type="error"
      show-icon
      :closable="false"
      :title="errorMessage"
    />

    <section class="domain-section" aria-labelledby="domain-title">
      <div class="section-heading">
        <div>
          <span class="section-kicker">治理域</span>
          <h2 id="domain-title">按业务语义进入主数据目录</h2>
        </div>
        <span>当前共 {{ domains.length }} 个治理域</span>
      </div>

      <div v-if="domains.length" class="domain-grid">
        <button
          v-for="domain in domains"
          :key="domain.key"
          class="domain-card"
          type="button"
          @click="openDomain(domain.key)"
        >
          <span class="domain-icon"><ArtSvgIcon :icon="domain.icon" /></span>
          <span class="domain-content">
            <span class="domain-name">{{ domain.label }}</span>
            <span class="domain-description">{{ domain.description }}</span>
            <span class="domain-meta">
              <strong>{{ domain.recordCount.toLocaleString() }}</strong> 条记录
              <i></i>
              {{ domain.sourceCount }} 类主档
            </span>
          </span>
          <ArtSvgIcon class="domain-arrow" icon="ri:arrow-right-line" />
        </button>
      </div>

      <el-empty v-else-if="!loading && !errorMessage" description="当前租户暂无可查看的主数据" />
    </section>

    <section class="governance-note" aria-label="MDM 边界说明">
      <ArtSvgIcon icon="ri:shield-check-line" />
      <div>
        <strong>单一事实来源</strong>
        <span>MDM 负责统一身份与只读治理视图；新增、修改、停用等操作仍在来源业务系统完成。</span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { fetchMdmOverview, type MdmDomainSummary } from '@mdm/api'

  const router = useRouter()
  const domains = ref<MdmDomainSummary[]>([])
  const loading = ref(false)
  const errorMessage = ref('')

  const totalRecords = computed(() =>
    domains.value.reduce((total, domain) => total + domain.recordCount, 0)
  )
  const totalSources = computed(() =>
    domains.value.reduce((total, domain) => total + domain.sourceCount, 0)
  )

  const defaultDomainPath: Record<MdmDomainSummary['key'], string> = {
    organization: '/mdm/organization/organization-directory',
    partner: '/mdm/partner/business-partner-directory',
    logistics: '/mdm/logistics/logistics-directory',
    asset: '/mdm/asset/vehicle-directory',
    material: '/mdm/material/material-directory'
  }

  const loadOverview = async () => {
    loading.value = true
    errorMessage.value = ''
    try {
      domains.value = await fetchMdmOverview()
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '主数据概览加载失败'
    } finally {
      loading.value = false
    }
  }

  const openDomain = (domain: MdmDomainSummary['key']) => router.push(defaultDomainPath[domain])

  onMounted(loadOverview)
</script>

<style scoped lang="scss">
  .mdm-workbench {
    --mdm-ink: var(--art-text-gray-900, #172033);
    --mdm-muted: var(--art-text-gray-600, #667085);
    padding: 24px;
    overflow: auto;
    color: var(--mdm-ink);
    background: var(--art-bg-color, #f5f7fa);
  }

  .page-heading,
  .coverage-panel,
  .section-heading,
  .governance-note {
    display: flex;
    align-items: center;
  }

  .page-heading {
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 20px;

    h1 {
      margin: 5px 0 8px;
      font-size: clamp(24px, 2.4vw, 34px);
      line-height: 1.2;
    }

    p {
      max-width: 720px;
      margin: 0;
      color: var(--mdm-muted);
      line-height: 1.65;
    }
  }

  .eyebrow,
  .section-kicker {
    color: var(--el-color-primary);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
  }

  .heading-status {
    display: flex;
    flex: 0 0 auto;
    gap: 10px;
    align-items: center;
    min-width: 190px;
    padding: 12px 14px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-light);
    border-radius: 10px;

    div,
    span {
      display: block;
    }

    span {
      margin-top: 2px;
      color: var(--mdm-muted);
      font-size: 12px;
    }
  }

  .status-dot {
    width: 9px;
    height: 9px;
    margin: 0 !important;
    background: var(--el-color-success);
    border-radius: 50%;
    box-shadow: 0 0 0 5px var(--el-color-success-light-8);
  }

  .coverage-panel {
    gap: 24px;
    padding: 22px 24px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-left: 4px solid var(--el-color-primary);
    border-radius: 12px;
    box-shadow: 0 8px 24px rgb(15 23 42 / 5%);
  }

  .coverage-copy {
    flex: 0 0 auto;

    h2 {
      margin: 4px 0;
      font-size: 24px;
    }

    p {
      margin: 0;
      color: var(--mdm-muted);
      font-size: 13px;
    }
  }

  .coverage-track {
    display: flex;
    flex: 1;
    gap: 4px;
    min-width: 180px;
    height: 8px;
    overflow: hidden;
    background: var(--el-fill-color-light);
    border-radius: 99px;

    span {
      min-width: 10px;
      background: var(--el-color-primary);

      &:nth-child(2) {
        opacity: 0.82;
      }

      &:nth-child(3) {
        opacity: 0.68;
      }

      &:nth-child(4) {
        opacity: 0.54;
      }

      &:nth-child(5) {
        opacity: 0.4;
      }
    }
  }

  .state-alert {
    margin-top: 16px;
  }

  .domain-section {
    margin-top: 28px;
  }

  .section-heading {
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 14px;

    h2 {
      margin: 4px 0 0;
      font-size: 18px;
    }

    > span {
      color: var(--mdm-muted);
      font-size: 13px;
    }
  }

  .domain-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
  }

  .domain-card {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    min-height: 148px;
    padding: 20px;
    color: inherit;
    text-align: left;
    cursor: pointer;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 12px;
    transition:
      border-color 160ms ease,
      box-shadow 160ms ease,
      transform 160ms ease;

    &:hover,
    &:focus-visible {
      border-color: var(--el-color-primary-light-5);
      box-shadow: 0 10px 26px rgb(15 23 42 / 8%);
      transform: translateY(-2px);
    }

    &:focus-visible {
      outline: 2px solid var(--el-color-primary-light-5);
      outline-offset: 2px;
    }
  }

  .domain-icon {
    display: grid;
    flex: 0 0 42px;
    width: 42px;
    height: 42px;
    color: var(--el-color-primary);
    font-size: 22px;
    background: var(--el-color-primary-light-9);
    border-radius: 10px;
    place-items: center;
  }

  .domain-content {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  .domain-name {
    font-weight: 700;
  }

  .domain-description {
    min-height: 42px;
    margin-top: 5px;
    color: var(--mdm-muted);
    font-size: 13px;
    line-height: 1.55;
  }

  .domain-meta {
    display: flex;
    gap: 7px;
    align-items: center;
    margin-top: 12px;
    color: var(--mdm-muted);
    font-size: 12px;

    strong {
      color: var(--mdm-ink);
      font-size: 18px;
    }

    i {
      width: 1px;
      height: 12px;
      background: var(--el-border-color);
    }
  }

  .domain-arrow {
    flex: 0 0 auto;
    margin-top: 3px;
    color: var(--mdm-muted);
  }

  .governance-note {
    gap: 12px;
    margin-top: 18px;
    padding: 15px 18px;
    color: var(--mdm-muted);
    font-size: 13px;
    background: var(--el-fill-color-light);
    border-radius: 10px;

    > :first-child {
      flex: 0 0 auto;
      color: var(--el-color-success);
      font-size: 22px;
    }

    strong,
    span {
      display: block;
    }

    strong {
      margin-bottom: 2px;
      color: var(--mdm-ink);
    }
  }

  @media (max-width: 980px) {
    .domain-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 700px) {
    .mdm-workbench {
      padding: 16px;
    }

    .page-heading,
    .coverage-panel,
    .section-heading {
      align-items: stretch;
      flex-direction: column;
    }

    .heading-status {
      width: 100%;
    }

    .coverage-track {
      flex: auto;
      min-height: 8px;
    }

    .domain-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
