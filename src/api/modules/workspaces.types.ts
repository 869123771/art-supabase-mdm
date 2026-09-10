import type { ProductionTag, ProductionPerson } from './production.types'

export interface WorkspaceAudit {
  id: string
  tenantId: string
  createBy: string
  createTime: string
  updateTime: string
}
export interface WorkspaceQuery {
  tenantId: string
  current: number
  size: number
  keyword?: string
  enabled?: boolean
  departmentIds?: string[]
  groupId?: string
}
export interface OperationTask {
  inputMode: string
  category: string
  name: string
  requirement: string
  score: number
  choices: string[]
}
export interface OperationTemplateInput {
  name: string
  items: OperationTask[]
  sort: number
  textColor: string
  tagType: ProductionTag
  enabled: boolean
}
export interface OperationTemplate extends OperationTemplateInput, WorkspaceAudit {
  totalScore: number
}
export type CenterPolicyValue = string | number | boolean | string[]
export type CenterPolicy = Record<string, CenterPolicyValue>
export interface WorkCenterInput {
  code: string
  name: string
  departmentId: string
  mainCenterId: string | null
  personnelMode: string
  headcount: number
  personIds: string[]
  policy: CenterPolicy
  sort: number
  remark: string
}
export interface WorkCenter extends WorkCenterInput, WorkspaceAudit {
  qrToken: string
  department: { id: string; name: string; code: string } | null
  mainCenter: { id: string; code: string; name: string } | null
}
export interface CommonWorkCenter {
  id: string
  code: string
  name: string
  departmentId: string
  departmentName: string
}
export interface PersonnelWorkCenterConfig {
  id: string
  tenantId: string
  departmentId: string
  department: { id: string; name: string; code: string }
  name: string
  employeeNo: string
  phone: string
  jobTitle: string
  avatarUrl: string
  commonWorkCenters: CommonWorkCenter[]
}
export interface PersonnelWorkCenterQuery extends WorkspaceQuery {
  onlyUnconfigured?: boolean
}
export interface CenterAdjustmentInput {
  workCenterId: string
  personId: string
  kind: string
  startTime: string
  endTime: string
}
export interface CenterAdjustment extends CenterAdjustmentInput, WorkspaceAudit {
  person: Pick<ProductionPerson, 'id' | 'name' | 'employeeNo'> | null
}
export interface CenterDeviceInput {
  workCenterId: string
  equipmentId: string
  isMain: boolean
  point: string
}
export interface CenterDevice extends CenterDeviceInput, WorkspaceAudit {
  equipment: { id: string; equipmentCode: string; equipmentName: string } | null
}
export interface ProcessRouteInput {
  tenantId: string
  materialId: string
  code: string
  name: string
  routeType: string
  allocationMode: string
  groupId: string | null
  version: string
  batchFrom: number | null
  batchTo: number
  productionUnitId: string | null
  departmentId: string | null
  effectiveDate: string
  expiryDate: string
  isDefault: boolean
  source: string
  customUnitConversion: boolean
  enabled: boolean
  path: string
  remark: string
}
export interface ProcessRoute extends ProcessRouteInput, WorkspaceAudit {
  material: {
    id: string
    materialCode: string
    materialName: string
    specificationModel: string
    productionUnitId?: string | null
  } | null
  group: { id: string; code: string; name: string } | null
  productionUnit: { id: string; unitCode: string; unitName: string; symbol: string } | null
  department: { id: string; code: string; name: string } | null
}
export interface ProcessSequenceInput {
  routeId: string
  sequenceNo: number
  sequenceType: string
  transferInStepId: string | null
  transferOutStepId: string | null
  remark: string
}
export interface ProcessSequence extends ProcessSequenceInput, WorkspaceAudit {
  stepCount?: number
}
export interface ProcessStepInput {
  routeId: string
  sequenceId: string | null
  code: string
  name: string
  operationId: string | null
  description: string
  unitId: string | null
  basicBatch: number
  workCenterId: string | null
  departmentId: string | null
  operationMode: string
  controlCodeId: string | null
  needInspection: boolean
  firstInspection: boolean
  firstInspectionControl: string
  isFirst: boolean
  isLast: boolean
  critical: boolean
  unitConversion: Record<string, unknown>
  activities: Array<Record<string, unknown>>
  outsourcing: Record<string, unknown>
  inspection: Record<string, unknown>
  sopDocuments: Array<Record<string, unknown>>
  sort: number
}
export interface ProcessStep extends ProcessStepInput, WorkspaceAudit {
  templateId: string | null
  route: ProcessRoute | null
  template: { id: string; name: string; totalScore: number } | null
  workCenter: { id: string; code: string; name: string } | null
  sequence: Pick<ProcessSequence, 'id' | 'sequenceNo' | 'sequenceType' | 'remark'> | null
  operation: { id: string; code: string; name: string } | null
  controlCode: { id: string; controlCode: string; controlCodeName: string } | null
  unit: { id: string; unitCode: string; unitName: string; symbol: string } | null
  department: { id: string; code: string; name: string } | null
  configUpdatedAt: string | null
}

export interface ProcessRouteReference {
  id: string
  code: string
  name: string
  tenantId?: string
  specification?: string
  unitId?: string | null
  unit?: string
  planExpression?: string
  reportExpression?: string
}

export interface ProcessRouteReferences {
  groups: ProcessRouteReference[]
  operations: ProcessRouteReference[]
  controlCodes: ProcessRouteReference[]
  units: ProcessRouteReference[]
  departments: ProcessRouteReference[]
  workCenters: ProcessRouteReference[]
  activityFormulas: ProcessRouteReference[]
  suppliers: ProcessRouteReference[]
  esopDocuments: ProcessRouteReference[]
}
