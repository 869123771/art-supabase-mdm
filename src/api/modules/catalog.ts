import { useSupabase } from '@/hooks'

export type MdmCatalogScope =
  | 'organization'
  | 'position'
  | 'employee'
  | 'partner'
  | 'logistics'
  | 'vehicle'
  | 'equipment'
  | 'material'

export type MdmCatalogState = 'active' | 'inactive'
export type MdmCatalogQuality = 'complete' | 'attention'

export interface MdmCatalogAttribute {
  label: string
  value: string | number | boolean | null
}

export interface MdmCatalogRecord {
  id: string
  code: string
  name: string
  status: string
  isActive: boolean
  subtitle: string
  sourceType: string
  sourceLabel: string
  sourceApp: string
  qualityScore: number
  qualityIssues: string[]
  attributes: MdmCatalogAttribute[]
  createTime: string | null
  updateTime: string | null
}

export interface MdmCatalogSourceSummary {
  type: string
  label: string
  app: string
  count: number
  attentionCount: number
}

export interface MdmCatalogSummary {
  total: number
  active: number
  inactive: number
  complete: number
  attention: number
  averageScore: number
}

export interface MdmCatalogQuery {
  current: number
  size: number
  keyword?: string
  sourceType?: string
  state?: MdmCatalogState
  quality?: MdmCatalogQuality
}

export interface MdmCatalogPageResponse {
  data: MdmCatalogRecord[]
  total: number
  current: number
  size: number
  sources: MdmCatalogSourceSummary[]
  summary: MdmCatalogSummary
}

export interface MdmCatalogSourceDefinition {
  type: string
  label: string
  app: string
}

export interface MdmDomainSummary {
  key: 'organization' | 'partner' | 'logistics' | 'asset' | 'material'
  label: string
  description: string
  icon: string
  recordCount: number
  sourceCount: number
}

interface MdmOverviewDomainPayload {
  key: MdmDomainSummary['key']
  recordCount: number
}

interface RequestOptions {
  signal?: AbortSignal
}

const { supabase, responseHandle } = useSupabase()

export const mdmCatalogSourceDefinitions: Record<MdmCatalogScope, MdmCatalogSourceDefinition[]> = {
  organization: [{ type: 'organization', label: '组织机构', app: 'platform' }],
  position: [
    { type: 'job_family', label: '职族', app: 'hr' },
    { type: 'grade', label: '职级', app: 'hr' },
    { type: 'job_profile', label: '职务', app: 'hr' },
    { type: 'position', label: '岗位', app: 'hr' }
  ],
  employee: [{ type: 'employee', label: '员工', app: 'hr' }],
  partner: [
    { type: 'business_partner', label: '往来主体', app: 'platform' },
    { type: 'customer', label: '客户', app: 'tms' },
    { type: 'carrier', label: '承运商', app: 'tms' },
    { type: 'supplier', label: '供应商', app: 'vms' },
    { type: 'insurance_company', label: '保险公司', app: 'vms' },
    { type: 'external_vendor', label: '外部服务商', app: 'smis' }
  ],
  logistics: [
    { type: 'station', label: '站点', app: 'tms' },
    { type: 'cargo', label: '货物', app: 'tms' },
    { type: 'driver', label: '司机', app: 'tms' }
  ],
  vehicle: [{ type: 'vehicle', label: '车辆', app: 'vms' }],
  equipment: [
    { type: 'equipment_category', label: '设备分类', app: 'smis' },
    { type: 'equipment', label: '设备', app: 'smis' },
    { type: 'part_category', label: '备件分类', app: 'smis' },
    { type: 'part', label: '备件', app: 'smis' }
  ],
  material: [
    { type: 'material_category', label: '物料分类', app: 'smis' },
    { type: 'material', label: '物料', app: 'smis' },
    { type: 'site', label: '场所', app: 'smis' },
    { type: 'storage_location', label: '存放位置', app: 'smis' }
  ]
}

export const mdmDomainDefinitions: Omit<MdmDomainSummary, 'recordCount'>[] = [
  {
    key: 'organization',
    label: '组织与人员',
    description: '组织、岗位、职务与员工身份',
    icon: 'ri:organization-chart',
    sourceCount: 6
  },
  {
    key: 'partner',
    label: '往来主体',
    description: '客户、承运商、供应商等统一身份',
    icon: 'ri:building-4-line',
    sourceCount: 6
  },
  {
    key: 'logistics',
    label: '物流基础',
    description: '站点、货物与司机基础资料',
    icon: 'ri:route-line',
    sourceCount: 3
  },
  {
    key: 'asset',
    label: '资产设备',
    description: '车辆、设备与备件主档',
    icon: 'ri:tools-line',
    sourceCount: 5
  },
  {
    key: 'material',
    label: '物料与场所',
    description: '物料、场所与存放位置',
    icon: 'ri:archive-stack-line',
    sourceCount: 4
  }
]

const emptySummary = (): MdmCatalogSummary => ({
  total: 0,
  active: 0,
  inactive: 0,
  complete: 0,
  attention: 0,
  averageScore: 0
})

const asObject = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback

const asNullableString = (value: unknown): string | null =>
  typeof value === 'string' && value ? value : null

const asNumber = (value: unknown, fallback = 0): number => {
  const numberValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

const normalizeAttribute = (value: unknown): MdmCatalogAttribute | null => {
  const item = asObject(value)
  const label = asString(item.label).trim()
  const rawValue = item.value
  if (!label) return null
  if (
    rawValue !== null &&
    typeof rawValue !== 'string' &&
    typeof rawValue !== 'number' &&
    typeof rawValue !== 'boolean'
  ) {
    return null
  }
  return { label, value: rawValue ?? null }
}

const normalizeRecord = (value: unknown): MdmCatalogRecord => {
  const item = asObject(value)
  return {
    id: asString(item.id),
    code: asString(item.code, '—'),
    name: asString(item.name, '未命名主数据'),
    status: asString(item.status, '未知'),
    isActive: item.isActive === true,
    subtitle: asString(item.subtitle),
    sourceType: asString(item.sourceType),
    sourceLabel: asString(item.sourceLabel, '未识别来源'),
    sourceApp: asString(item.sourceApp, 'platform'),
    qualityScore: Math.min(100, Math.max(0, asNumber(item.qualityScore))),
    qualityIssues: Array.isArray(item.qualityIssues)
      ? item.qualityIssues.map((issue) => asString(issue)).filter(Boolean)
      : [],
    attributes: Array.isArray(item.attributes)
      ? item.attributes
          .map(normalizeAttribute)
          .filter((entry): entry is MdmCatalogAttribute => !!entry)
      : [],
    createTime: asNullableString(item.createTime),
    updateTime: asNullableString(item.updateTime)
  }
}

const normalizeSource = (value: unknown): MdmCatalogSourceSummary => {
  const item = asObject(value)
  return {
    type: asString(item.type),
    label: asString(item.label),
    app: asString(item.app),
    count: asNumber(item.count),
    attentionCount: asNumber(item.attentionCount)
  }
}

const normalizeSummary = (value: unknown): MdmCatalogSummary => {
  const item = asObject(value)
  return {
    total: asNumber(item.total),
    active: asNumber(item.active),
    inactive: asNumber(item.inactive),
    complete: asNumber(item.complete),
    attention: asNumber(item.attention),
    averageScore: asNumber(item.averageScore)
  }
}

export async function fetchMdmCatalogPage(
  scope: MdmCatalogScope,
  query: MdmCatalogQuery,
  options?: RequestOptions
): Promise<MdmCatalogPageResponse> {
  const current = Math.max(1, Math.trunc(query.current || 1))
  const size = Math.min(100, Math.max(1, Math.trunc(query.size || 20)))
  const from = (current - 1) * size
  const rpcQuery = supabase.rpc('mdm_list_catalog_secure', {
    p_scope: scope,
    p_keyword: query.keyword?.trim() || null,
    p_source_type: query.sourceType || null,
    p_state: query.state || null,
    p_quality: query.quality || null,
    p_from: from,
    p_to: from + size - 1
  })
  const { data } = await responseHandle<unknown>(
    () => (options?.signal ? rpcQuery.abortSignal(options.signal) : rpcQuery),
    { breakReturn: true, showErrorMessage: true }
  )
  const payload = asObject(data)

  return {
    data: Array.isArray(payload.records) ? payload.records.map(normalizeRecord) : [],
    total: asNumber(payload.total),
    current,
    size,
    sources: Array.isArray(payload.sources) ? payload.sources.map(normalizeSource) : [],
    summary: payload.summary ? normalizeSummary(payload.summary) : emptySummary()
  }
}

export async function fetchMdmCatalog(
  scope: MdmCatalogScope,
  keyword = ''
): Promise<MdmCatalogRecord[]> {
  return (await fetchMdmCatalogPage(scope, { current: 1, size: 100, keyword })).data
}

export async function fetchMdmOverview(): Promise<MdmDomainSummary[]> {
  const { data } = await responseHandle<unknown>(
    () => supabase.rpc('mdm_get_governance_overview_secure'),
    { breakReturn: true, showErrorMessage: true }
  )
  const payload = asObject(data)
  const overviewDomains: MdmOverviewDomainPayload[] = Array.isArray(payload.domains)
    ? payload.domains
        .map((value): MdmOverviewDomainPayload | null => {
          const item = asObject(value)
          const key = asString(item.key) as MdmDomainSummary['key']
          if (!mdmDomainDefinitions.some((domain) => domain.key === key)) return null
          return { key, recordCount: asNumber(item.recordCount) }
        })
        .filter((item): item is MdmOverviewDomainPayload => !!item)
    : []

  return mdmDomainDefinitions.map((domain) => ({
    ...domain,
    recordCount: overviewDomains.find((item) => item.key === domain.key)?.recordCount ?? 0
  }))
}
