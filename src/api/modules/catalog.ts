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

interface MdmWorkspacePayload {
  domains: Array<{ key: MdmDomainSummary['key']; recordCount: number }>
  records: MdmCatalogRecord[]
}

const { supabase, responseHandle } = useSupabase()

export const mdmDomainDefinitions: Omit<MdmDomainSummary, 'recordCount'>[] = [
  {
    key: 'organization',
    label: '组织与人员',
    description: '组织、岗位、职务与员工身份',
    icon: 'ri:organization-chart',
    sourceCount: 4
  },
  {
    key: 'partner',
    label: '往来主体',
    description: '客户、承运商、供应商等统一身份',
    icon: 'ri:building-4-line',
    sourceCount: 1
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
    sourceCount: 3
  },
  {
    key: 'material',
    label: '物料与场所',
    description: '物料、场所与存放位置',
    icon: 'ri:archive-stack-line',
    sourceCount: 3
  }
]

async function fetchWorkspace(
  scope: MdmCatalogScope | 'overview',
  keyword: string | null
): Promise<MdmWorkspacePayload> {
  const { data } = await responseHandle<MdmWorkspacePayload>(
    () =>
      supabase.rpc('mdm_get_governance_workspace_secure', {
        p_scope: scope,
        p_keyword: keyword
      }),
    { breakReturn: true, showErrorMessage: true }
  )
  return data ?? { domains: [], records: [] }
}

export async function fetchMdmOverview(): Promise<MdmDomainSummary[]> {
  const workspace = await fetchWorkspace('overview', null)
  return mdmDomainDefinitions.map((domain) => {
    return {
      ...domain,
      recordCount: workspace.domains.find((summary) => summary.key === domain.key)?.recordCount ?? 0
    }
  })
}

export async function fetchMdmCatalog(
  scope: MdmCatalogScope,
  keyword = ''
): Promise<MdmCatalogRecord[]> {
  const workspace = await fetchWorkspace(scope, keyword.trim() || null)
  return workspace.records
}
