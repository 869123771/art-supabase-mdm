export type OperationalMasterKind =
  | 'customer'
  | 'project'
  | 'document-type'
  | 'activity-formula'
  | 'operation-control-code'
  | 'operation'
  | 'workstation'

export type MasterGroupDomain = 'customer' | 'project' | 'operation' | 'process-route'

export interface MasterGroup {
  id: string
  tenantId: string
  domain: MasterGroupDomain
  parentId: string | null
  code: string
  name: string
  sort: number
  enabled: boolean
  remark: string
}

export interface MasterGroupInput {
  tenantId?: string
  domain: MasterGroupDomain
  parentId: string | null
  code: string
  name: string
  sort: number
  enabled: boolean
  remark: string
}

export interface OperationalMasterRecord {
  id: string
  tenantId: string
  code?: string
  name?: string
  customerCode?: string
  customerName?: string
  projectCode?: string
  projectName?: string
  documentTypeCode?: string
  documentTypeName?: string
  controlCode?: string
  controlCodeName?: string
  workstationCode?: string
  workstationName?: string
  groupId?: string | null
  customerId?: string | null
  menuId?: string | null
  industry?: string | null
  customerLevel?: string | null
  region?: string | null
  addressDetail?: string | null
  contactName?: string | null
  contactPhone?: string | null
  projectMode?: string | null
  projectStage?: string | null
  projectStatus?: string | null
  ownerId?: string | null
  salespersonId?: string | null
  source?: string | null
  purpose?: string | null
  activityType?: string | null
  isDefault?: boolean
  planExpression?: string | null
  reportExpression?: string | null
  description?: string | null
  participatesScheduling?: boolean
  processingMode?: string | null
  reportMode?: string | null
  timeUnitId?: string | null
  inspectionMode?: string | null
  sequenceControl?: string | null
  reworkMode?: string | null
  mnemonic?: string | null
  pricingType?: string | null
  departmentId?: string | null
  workCenterIds?: string[]
  price?: number | null
  pricingUnitId?: string | null
  processingDefectReasons?: string[]
  materialDefectReasons?: string[]
  workCenterId?: string | null
  responsiblePersonId?: string | null
  andonSimNo?: string | null
  enabled: boolean
  remark?: string | null
  createTime?: string
  updateTime?: string
}

export type OperationalMasterInput = Omit<
  OperationalMasterRecord,
  'id' | 'createTime' | 'updateTime'
>

export interface OperationalMasterQuery {
  tenantId?: string | null
  current: number
  size: number
  keyword?: string
  groupId?: string
  enabled?: boolean
}

export interface MasterReferenceOption {
  id: string
  code: string
  name: string
  tenantId: string
}

export interface OperationalMasterReferences {
  customers: MasterReferenceOption[]
  employees: MasterReferenceOption[]
  departments: MasterReferenceOption[]
  workCenters: MasterReferenceOption[]
  personnel: MasterReferenceOption[]
  units: MasterReferenceOption[]
  menus: MasterReferenceOption[]
}
