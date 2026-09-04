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

export interface MdmCatalogRecord {
  id: string
  code: string
  name: string
  status: string
  sourceType: string
  sourceLabel: string
  updateTime: string | null
}

export interface MdmDomainSummary {
  key: 'organization' | 'partner' | 'logistics' | 'asset' | 'material'
  label: string
  description: string
  icon: string
  recordCount: number
  sourceCount: number
}

interface CatalogSource {
  table: string
  type: string
  label: string
  domain: MdmDomainSummary['key']
  scopes: MdmCatalogScope[]
  select: string
}

interface CatalogRow {
  id?: unknown
  code?: unknown
  name?: unknown
  status?: unknown
  update_time?: unknown
}

const { supabase } = useSupabase()

const sources: CatalogSource[] = [
  {
    table: 'mdm_organization',
    type: 'organization',
    label: '组织机构',
    domain: 'organization',
    scopes: ['organization'],
    select: 'id,code:organization_code,name:organization_name,status,update_time'
  },
  {
    table: 'mdm_position',
    type: 'position',
    label: '岗位',
    domain: 'organization',
    scopes: ['position'],
    select: 'id,code:position_code,name:position_name,status:enabled,update_time'
  },
  {
    table: 'mdm_job_profile',
    type: 'job_profile',
    label: '标准职务',
    domain: 'organization',
    scopes: ['position'],
    select: 'id,code:job_code,name:job_name,status:enabled,update_time'
  },
  {
    table: 'mdm_employee',
    type: 'employee',
    label: '员工',
    domain: 'organization',
    scopes: ['employee'],
    select: 'id,code:employee_no,name:employee_name,status:employment_status,update_time'
  },
  {
    table: 'mdm_business_partner',
    type: 'business_partner',
    label: '往来主体',
    domain: 'partner',
    scopes: ['partner'],
    select: 'id,code:source_code,name:partner_name,status,update_time'
  },
  {
    table: 'mdm_station',
    type: 'station',
    label: '站点',
    domain: 'logistics',
    scopes: ['logistics'],
    select: 'id,code:station_code,name:station_name,status:enabled,update_time'
  },
  {
    table: 'mdm_cargo',
    type: 'cargo',
    label: '货物',
    domain: 'logistics',
    scopes: ['logistics'],
    select: 'id,code:cargo_code,name:cargo_name,status:enabled,update_time'
  },
  {
    table: 'mdm_driver',
    type: 'driver',
    label: '司机',
    domain: 'logistics',
    scopes: ['logistics'],
    select: 'id,code:phone,name:driver_name,status:enabled,update_time'
  },
  {
    table: 'mdm_vehicle',
    type: 'vehicle',
    label: '车辆',
    domain: 'asset',
    scopes: ['vehicle'],
    select: 'id,code:plate_no,name:plate_no,status:operation_status,update_time'
  },
  {
    table: 'mdm_equipment',
    type: 'equipment',
    label: '设备',
    domain: 'asset',
    scopes: ['equipment'],
    select: 'id,code:equipment_code,name:equipment_name,status,update_time'
  },
  {
    table: 'mdm_part',
    type: 'part',
    label: '备件',
    domain: 'asset',
    scopes: ['equipment'],
    select: 'id,code:part_code,name:part_name,status,update_time'
  },
  {
    table: 'mdm_material',
    type: 'material',
    label: '物料',
    domain: 'material',
    scopes: ['material'],
    select: 'id,code:material_code,name:material_name,status,update_time'
  },
  {
    table: 'mdm_site',
    type: 'site',
    label: '场所',
    domain: 'material',
    scopes: ['material'],
    select: 'id,code:id,name:site_name,status:category_code,update_time'
  },
  {
    table: 'mdm_storage_location',
    type: 'storage_location',
    label: '存放位置',
    domain: 'material',
    scopes: ['material'],
    select: 'id,code:location_code,name:location_name,status,update_time'
  }
]

const domainMeta: Omit<MdmDomainSummary, 'recordCount' | 'sourceCount'>[] = [
  {
    key: 'organization',
    label: '组织与人员',
    description: '组织、岗位、职务与员工身份',
    icon: 'ri:organization-chart'
  },
  {
    key: 'partner',
    label: '往来主体',
    description: '客户、承运商、供应商等统一身份',
    icon: 'ri:building-4-line'
  },
  {
    key: 'logistics',
    label: '物流基础',
    description: '站点、货物与司机基础资料',
    icon: 'ri:route-line'
  },
  {
    key: 'asset',
    label: '资产设备',
    description: '车辆、设备与备件主档',
    icon: 'ri:tools-line'
  },
  {
    key: 'material',
    label: '物料与场所',
    description: '物料、场所与存放位置',
    icon: 'ri:archive-stack-line'
  }
]

function normalizeStatus(value: unknown): string {
  if (value === true) return '启用'
  if (value === false) return '停用'
  const text = String(value ?? '').trim()
  return text || '未标记'
}

async function fetchSourceCount(source: CatalogSource): Promise<number> {
  const { count, error } = await supabase
    .from(source.table)
    .select('id', { count: 'exact', head: true })
  if (error) throw new Error(`${source.label}统计失败：${error.message}`)
  return count ?? 0
}

export async function fetchMdmOverview(): Promise<MdmDomainSummary[]> {
  const counts = await Promise.all(sources.map(fetchSourceCount))
  return domainMeta.map((domain) => {
    const domainSources = sources.filter((source) => source.domain === domain.key)
    return {
      ...domain,
      recordCount: domainSources.reduce(
        (total, source) => total + counts[sources.indexOf(source)],
        0
      ),
      sourceCount: domainSources.length
    }
  })
}

export async function fetchMdmCatalog(
  scope: MdmCatalogScope,
  keyword = ''
): Promise<MdmCatalogRecord[]> {
  const scopedSources = sources.filter((source) => source.scopes.includes(scope))
  const results = await Promise.all(
    scopedSources.map(async (source) => {
      const { data, error } = await supabase
        .from(source.table)
        .select(source.select)
        .order('update_time', { ascending: false })
        .limit(200)
      if (error) throw new Error(`${source.label}读取失败：${error.message}`)
      return ((data ?? []) as unknown as CatalogRow[]).map((row) => ({
        id: String(row.id ?? ''),
        code: String(row.code ?? '—'),
        name: String(row.name ?? '未命名记录'),
        status: normalizeStatus(row.status),
        sourceType: source.type,
        sourceLabel: source.label,
        updateTime: row.update_time ? String(row.update_time) : null
      }))
    })
  )
  const normalizedKeyword = keyword.trim().toLocaleLowerCase()
  return results
    .flat()
    .filter((record) => {
      if (!normalizedKeyword) return true
      return `${record.code} ${record.name} ${record.sourceLabel}`
        .toLocaleLowerCase()
        .includes(normalizedKeyword)
    })
    .sort((left, right) => String(right.updateTime).localeCompare(String(left.updateTime)))
}
