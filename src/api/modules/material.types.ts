export type MdmMaterialStatus = 'enabled' | 'disabled'

export interface MaterialReferenceBase {
  id: string
  tenantId: string
  status: MdmMaterialStatus
  sort: number
  remark?: string | null
  createBy?: string | null
  createTime?: string
  updateBy?: string | null
  updateTime?: string
}

export interface UnitOfMeasure extends MaterialReferenceBase {
  unitCode: string
  unitName: string
  symbol?: string | null
  dimension: string
  decimalPlaces: number
  isBaseUnit: boolean
  baseUnitId?: string | null
  conversionFactor: number
}

export interface MaterialType extends MaterialReferenceBase {
  typeCode: string
  typeName: string
  codePrefix: string
  textColor: string
  tagType: string
}

export interface MaterialAttributeDefinition {
  key: string
  name: string
  values: string[]
  required: boolean
  enabled: boolean
}

export interface MaterialAttributeGroup extends MaterialReferenceBase {
  groupCode: string
  groupName: string
  attributes: MaterialAttributeDefinition[]
  textColor: string
  tagType: string
}

export type MaterialCodeSegmentSource = 'fixed' | 'material_type' | 'material_category' | 'date'

export interface MaterialCodeSegment {
  source: MaterialCodeSegmentSource
  value?: string
  format?: 'YYYY' | 'YYYYMM' | 'YYYYMMDD'
}

export interface MaterialCodeRule extends MaterialReferenceBase {
  ruleCode: string
  ruleName: string
  strategy: 'material_type' | 'material_category'
  prefix: string
  segments: MaterialCodeSegment[]
  sequenceDigits: number
  codeLength: number
  nextValue: number
  exampleCode: string
}

export type MaterialReferenceRecord =
  UnitOfMeasure | MaterialType | MaterialAttributeGroup | MaterialCodeRule

export type MaterialReferenceKind =
  'unit-of-measure' | 'material-type' | 'attribute-group' | 'code-rule'

export interface MaterialReferenceQuery {
  current: number
  size: number
  tenantId: string
  keyword?: string
  status?: MdmMaterialStatus
}

export interface MaterialCategory extends MaterialReferenceBase {
  parentId?: string | null
  categoryCode: string
  categoryName: string
  materialTypeId?: string | null
  materialType?: Pick<MaterialType, 'id' | 'typeCode' | 'typeName'> | null
  printName?: string | null
  compositionColumns: string[]
  compositionSeparator: string
  overPurchasePercent: number
  overPurchaseQuantity: number
  maxReceiptQuantity?: number | null
  autoReceive: boolean
  purchaserId?: string | null
  purchaseOrganization?: string | null
  requiresInspection: boolean
  createDeliveryNotice: boolean
  defaultSiteId?: string | null
  overReceiptPercent: number
  overReceiptQuantity: number
  batchManaged: boolean
  valuationMethod: string
  description?: string | null
  children?: MaterialCategory[]
}

export interface MaterialArchive extends MaterialReferenceBase {
  categoryId: string
  category?: Pick<MaterialCategory, 'id' | 'categoryCode' | 'categoryName'> | null
  materialCode: string
  materialName: string
  specificationModel?: string | null
  drawingNo?: string | null
  basicUnit: string
  materialType: string
  materialSource: 'purchase' | 'self_made' | 'outsourcing'
  materialTypeId?: string | null
  materialTypeRef?: Pick<MaterialType, 'id' | 'typeCode' | 'typeName'> | null
  baseUnitId?: string | null
  baseUnit?: Pick<UnitOfMeasure, 'id' | 'unitCode' | 'unitName' | 'symbol'> | null
  auxiliaryUnitId?: string | null
  auxiliaryUnit2Id?: string | null
  attributeGroupId?: string | null
  attributeValues: Record<string, string>
  brand?: string | null
  manufacturer?: string | null
  materialComposition?: string | null
  placeOfOrigin?: string | null
  color?: string | null
  imageUrls: string[]
  description?: string | null
  purchaseUnitId?: string | null
  purchaserId?: string | null
  plannerId?: string | null
  batchPolicy?: string | null
  minBatch?: number | null
  maxBatch?: number | null
  salesUnitId?: string | null
  salespersonId?: string | null
  salesOrganization?: string | null
  inventoryUnitId?: string | null
  storageLocationId?: string | null
  custodianId?: string | null
  productionUnitId?: string | null
  mrpType?: string | null
  dispatcherId?: string | null
  costUnitId?: string | null
  valuationMethod?: string | null
  currencyCode: string
  unitConversions: Array<{
    sourceUnitId: string
    baseFactor: number
    sourceFactor: number
    remark?: string
  }>
}

export type MaterialArchiveInput = Omit<
  MaterialArchive,
  | 'id'
  | 'category'
  | 'materialTypeRef'
  | 'baseUnit'
  | 'createBy'
  | 'createTime'
  | 'updateBy'
  | 'updateTime'
>
