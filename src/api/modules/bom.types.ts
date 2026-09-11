import type { MaterialArchive, UnitOfMeasure } from './material.types'

export type BomPurpose = 'production' | 'design' | 'process' | 'sales' | 'spare_part'
export type BomStatus = 'design' | 'review' | 'effective' | 'changing' | 'archived' | 'void'

export type BomMaterialReference = Pick<
  MaterialArchive,
  | 'id'
  | 'tenantId'
  | 'materialCode'
  | 'materialName'
  | 'specificationModel'
  | 'drawingNo'
  | 'description'
  | 'materialSource'
  | 'baseUnitId'
  | 'productionUnitId'
  | 'defaultWarehouseId'
  | 'materialIssueMethod'
  | 'backflushMethod'
  | 'overIssueControlMethod'
  | 'baseUnit'
  | 'productionUnit'
  | 'defaultWarehouse'
>

export interface BomGroup {
  id: string
  tenantId: string
  code: string
  name: string
  parentId?: string | null
  sort: number
  enabled: boolean
  description?: string | null
  children?: BomGroup[]
}

export interface BomItem {
  id: string
  tenantId: string
  bomId: string
  componentMaterialId: string
  component?: BomMaterialReference | null
  sequenceNo: number
  quantity: number
  unitId: string
  unit?: Pick<UnitOfMeasure, 'id' | 'unitCode' | 'unitName' | 'symbol'> | null
  scrapRate: number
  mrpEnabled: boolean
  defaultIssueWarehouseId?: string | null
  defaultIssueWarehouse?: { id: string; warehouseCode: string; warehouseName: string } | null
  issueMethod: string
  backflushMethod: string
  overIssueControlMethod?: string | null
  projectText?: string | null
  positionNo?: string | null
  operationName?: string | null
  effectiveFrom?: string | null
  effectiveTo?: string | null
  remark?: string | null
}

export interface BomRecord {
  id: string
  tenantId: string
  bomCode: string
  materialId: string
  material?: BomMaterialReference | null
  groupId?: string | null
  group?: Pick<BomGroup, 'id' | 'code' | 'name'> | null
  version: string
  purpose: BomPurpose
  status: BomStatus
  baseQuantity: number
  baseUnitId: string
  baseUnit?: Pick<UnitOfMeasure, 'id' | 'unitCode' | 'unitName' | 'symbol'> | null
  effectiveFrom?: string | null
  effectiveTo?: string | null
  description?: string | null
  sort: number
  createBy?: string | null
  createTime?: string
  updateBy?: string | null
  updateTime?: string
  items: BomItem[]
}

export interface BomQuery {
  current: number
  size: number
  tenantId?: string | null
  keyword?: string
  materialId?: string
  groupIds?: string[]
  purpose?: BomPurpose
  status?: BomStatus
}

export interface BomInput {
  id?: string
  tenantId: string
  bomCode?: string
  materialId: string
  groupId?: string | null
  version: string
  purpose: BomPurpose
  baseQuantity: number
  baseUnitId: string
  effectiveFrom?: string | null
  effectiveTo?: string | null
  description?: string | null
  sort: number
  items: Array<
    Pick<
      BomItem,
      | 'componentMaterialId'
      | 'sequenceNo'
      | 'quantity'
      | 'unitId'
      | 'scrapRate'
      | 'mrpEnabled'
      | 'defaultIssueWarehouseId'
      | 'issueMethod'
      | 'backflushMethod'
      | 'overIssueControlMethod'
      | 'projectText'
      | 'positionNo'
      | 'operationName'
      | 'effectiveFrom'
      | 'effectiveTo'
      | 'remark'
    >
  >
}

export interface BomStructureNode {
  nodeId: string
  parentNodeId?: string | null
  bomId: string
  materialId: string
  materialCode: string
  materialName: string
  specificationModel?: string | null
  quantity: number
  unitName: string
  depth: number
  path: string[]
  hasChildren: boolean
  children?: BomStructureNode[]
}
