<template>
  <ArtDialog
    ref="dialogRef"
    size="xl"
    :show-cancel-button="false"
    confirm-text="关闭"
    content-max-height="76vh"
  >
    <div v-if="record" class="bom-detail-dialog">
      <section class="bom-detail-dialog__identity art-card-xs">
        <span class="bom-detail-dialog__identity-icon" aria-hidden="true">
          <ArtSvgIcon icon="ri:git-merge-line" />
        </span>
        <div class="bom-detail-dialog__identity-copy">
          <small>BILL OF MATERIALS</small>
          <h3>{{ record.material?.materialName || '未关联父项物料' }}</h3>
          <p>{{ materialIdentity(record) }}</p>
        </div>
        <ArtDictDisplay dict-code="mdmBomStatus" :value="record.status" display="tag" />
      </section>

      <ArtSectionCard
        title="BOM 身份"
        subtitle="父项物料、版本用途与当前生命周期。"
        preserve-content-structure
      >
        <ArtDescriptions
          :data="record"
          :items="identityItems"
          :columns="3"
          :tablet-columns="2"
          empty-text="—"
        />
      </ArtSectionCard>

      <ArtSectionCard
        title="数量与有效期"
        subtitle="基准计量口径及版本生效范围。"
        preserve-content-structure
      >
        <ArtDescriptions
          :data="record"
          :items="validityItems"
          :columns="3"
          :tablet-columns="2"
          empty-text="—"
        />
      </ArtSectionCard>

      <ArtSectionCard
        title="组件明细"
        :subtitle="`共 ${record.items.length} 项组件；用量按当前 BOM 基准口径展示。`"
        preserve-content-structure
      >
        <ArtTable
          :data="record.items"
          :columns="componentColumns"
          row-key="id"
          :pagination="false"
          table-layout="fixed"
          scrollbar-always-on
          max-height="360"
          empty-text="暂无 BOM 组件"
          empty-description="当前 BOM 尚未维护组件明细。"
        />
      </ArtSectionCard>

      <ArtSectionCard
        title="审计信息"
        subtitle="记录该版本的创建与最近维护信息。"
        preserve-content-structure
      >
        <ArtDescriptions
          :data="record"
          :items="auditItems"
          :columns="2"
          :tablet-columns="2"
          empty-text="—"
        />
      </ArtSectionCard>
    </div>
  </ArtDialog>
</template>

<script setup lang="tsx">
  import dayjs from 'dayjs'
  import ArtDescriptions from '@/components/core/base/art-descriptions/index.vue'
  import type { ArtDescriptionItem } from '@/components/core/base/art-descriptions/types'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import type { ColumnOption } from '@/types'
  import type { BomItem, BomRecord } from '@mdm/api'

  defineOptions({ name: 'MdmBomDetailDialog' })

  const dialogRef = ref<ArtDialogExpose<BomRecord>>()
  const record = shallowRef<BomRecord>()

  const formatQuantity = (value: unknown, maximumFractionDigits = 6): string => {
    const amount = Number(value)
    return Number.isFinite(amount) ? amount.toLocaleString('zh-CN', { maximumFractionDigits }) : '—'
  }

  const formatDateTime = (value?: string | null): string =>
    value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '—'

  const materialIdentity = (row: BomRecord): string =>
    [row.material?.materialCode, row.material?.specificationModel].filter(Boolean).join(' · ') ||
    '—'

  const unitIdentity = (name?: string | null, code?: string | null): string =>
    [name, code].filter(Boolean).join(' · ') || '—'

  const identityItems: ArtDescriptionItem<BomRecord>[] = [
    {
      key: 'material',
      label: '父项物料',
      value: (row: BomRecord) =>
        [row.material?.materialName, row.material?.materialCode, row.material?.specificationModel]
          .filter(Boolean)
          .join(' · ')
    },
    { key: 'bomCode', label: 'BOM 编码', field: 'bomCode', copyable: true },
    { key: 'version', label: '版本', field: 'version' },
    { key: 'purpose', label: 'BOM 用途', field: 'purpose', dictCode: 'mdmBomPurpose' },
    { key: 'status', label: '生命周期', field: 'status', dictCode: 'mdmBomStatus' },
    { key: 'sort', label: '显示顺序', field: 'sort', format: 'number' }
  ]

  const validityItems: ArtDescriptionItem<BomRecord>[] = [
    {
      key: 'baseQuantity',
      label: '基准数量',
      value: (row: BomRecord) => formatQuantity(row.baseQuantity)
    },
    {
      key: 'baseUnit',
      label: '基准单位',
      value: (row: BomRecord) => unitIdentity(row.baseUnit?.unitName, row.baseUnit?.unitCode)
    },
    { key: 'effectiveFrom', label: '生效日期', field: 'effectiveFrom', format: 'date' },
    { key: 'effectiveTo', label: '失效日期', field: 'effectiveTo', format: 'date' },
    { key: 'description', label: '版本说明', field: 'description', span: 2 }
  ]

  const auditItems: ArtDescriptionItem<BomRecord>[] = [
    { key: 'createBy', label: '创建人', field: 'createBy' },
    {
      key: 'createTime',
      label: '创建时间',
      value: (row: BomRecord) => formatDateTime(row.createTime)
    },
    { key: 'updateBy', label: '更新人', field: 'updateBy' },
    {
      key: 'updateTime',
      label: '更新时间',
      value: (row: BomRecord) => formatDateTime(row.updateTime)
    }
  ]

  const componentIdentity = (row: BomItem) => {
    const name = row.component?.materialName || '未识别物料'
    const detail =
      [row.component?.materialCode, row.component?.specificationModel]
        .filter(Boolean)
        .join(' · ') || '—'
    return (
      <div class="bom-detail-dialog__material">
        <span aria-hidden="true">
          <ArtSvgIcon icon="ri:box-3-line" />
        </span>
        <div>
          <strong title={name}>{name}</strong>
          <small title={detail}>{detail}</small>
        </div>
      </div>
    )
  }

  const componentColumns: ColumnOption<BomItem>[] = [
    { type: 'index', label: '#', width: 52, align: 'center' },
    {
      prop: 'componentMaterialId',
      label: '组件物料',
      minWidth: 260,
      formatter: componentIdentity
    },
    { prop: 'sequenceNo', label: '顺序', width: 76, align: 'center' },
    {
      prop: 'quantity',
      label: '用量',
      width: 112,
      align: 'right',
      formatter: (row) => formatQuantity(row.quantity)
    },
    {
      prop: 'unitId',
      label: '单位',
      width: 120,
      formatter: (row) => unitIdentity(row.unit?.unitName, row.unit?.unitCode)
    },
    {
      prop: 'scrapRate',
      label: '损耗率',
      width: 96,
      align: 'right',
      formatter: (row) => `${formatQuantity(row.scrapRate, 2)}%`
    },
    {
      prop: 'operationName',
      label: '工序',
      minWidth: 130,
      formatter: (row) => row.operationName || '—'
    },
    {
      prop: 'positionNo',
      label: '位号',
      minWidth: 110,
      formatter: (row) => row.positionNo || '—'
    }
  ]

  const handleOpen = async (row: BomRecord): Promise<void> => {
    record.value = row
    await dialogRef.value?.handleOpen(row, {
      title: 'BOM 结构详情',
      subtitle: `${row.bomCode} · ${row.version}`
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .bom-detail-dialog {
    display: grid;
    gap: var(--art-space-3);
    min-width: 0;

    &__identity {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: var(--art-space-3);
      align-items: center;
      padding: var(--art-space-4);
      background: color-mix(in srgb, var(--theme-color) 7%, var(--el-bg-color));
    }

    &__identity-icon,
    :deep(.bom-detail-dialog__material > span) {
      display: grid;
      flex: none;
      place-items: center;
      color: var(--theme-color);
      background: var(--el-bg-color);
      border-radius: var(--el-border-radius-base);
    }

    &__identity-icon {
      width: 44px;
      height: 44px;
      font-size: 21px;
    }

    &__identity-copy {
      min-width: 0;

      small,
      h3,
      p {
        display: block;
        margin: 0;
        overflow-wrap: anywhere;
      }

      small {
        font-size: var(--art-font-size-caption);
        font-weight: 700;
        color: var(--theme-color);
        letter-spacing: 0.08em;
      }

      h3 {
        margin-top: var(--art-space-1);
        font-size: 16px;
        color: var(--el-text-color-primary);
      }

      p {
        margin-top: var(--art-space-1);
        font-family: var(--art-font-family-mono, Consolas, monospace);
        font-size: var(--art-font-size-caption);
        color: var(--el-text-color-secondary);
      }
    }

    :deep(.bom-detail-dialog__material) {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr);
      gap: var(--art-space-2);
      align-items: center;
      min-width: 0;

      > span {
        width: 34px;
        height: 34px;
        background: color-mix(in srgb, var(--theme-color) 8%, var(--el-bg-color));
      }

      > div,
      strong,
      small {
        min-width: 0;
      }

      strong,
      small {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      strong {
        color: var(--el-text-color-primary);
      }

      small {
        margin-top: var(--art-space-1);
        font-family: var(--art-font-family-mono, Consolas, monospace);
        font-size: var(--art-font-size-caption);
        color: var(--el-text-color-secondary);
      }
    }

    :deep(.art-section-card) {
      min-width: 0;
    }

    :deep(.el-table .cell) {
      font-variant-numeric: tabular-nums;
    }

    @media (width <= 760px) {
      &__identity {
        grid-template-columns: auto minmax(0, 1fr);

        > .el-tag {
          grid-column: 1 / -1;
          justify-self: start;
        }
      }
    }
  }
</style>
