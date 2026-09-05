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
  materialId: string
  name: string
}
export interface ProcessRoute extends ProcessRouteInput, WorkspaceAudit {
  material: {
    id: string
    materialCode: string
    materialName: string
    specificationModel: string
  } | null
}
export interface ProcessStepInput {
  routeId: string
  code: string
  name: string
  workCenterId: string | null
  sort: number
}
export interface ProcessStep extends ProcessStepInput, WorkspaceAudit {
  templateId: string | null
  route: ProcessRoute | null
  template: { id: string; name: string; totalScore: number } | null
  workCenter: { id: string; code: string; name: string } | null
  configUpdatedAt: string | null
}
