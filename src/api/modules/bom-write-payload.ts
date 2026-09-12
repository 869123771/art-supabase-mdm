import type { BomInput } from './bom.types'

export interface BomWritePayload {
  header: Omit<BomInput, 'items'>
  items: BomInput['items']
}

export const buildBomWritePayload = (payload: BomInput): BomWritePayload => ({
  header: {
    id: payload.id,
    tenantId: payload.tenantId,
    bomCode: payload.bomCode,
    materialId: payload.materialId,
    groupId: payload.groupId,
    version: payload.version,
    purpose: payload.purpose,
    baseQuantity: payload.baseQuantity,
    baseUnitId: payload.baseUnitId,
    effectiveFrom: payload.effectiveFrom,
    effectiveTo: payload.effectiveTo,
    description: payload.description,
    sort: payload.sort
  },
  items: payload.items.map((item) => ({
    componentMaterialId: item.componentMaterialId,
    sequenceNo: item.sequenceNo,
    quantity: item.quantity,
    unitId: item.unitId,
    scrapRate: item.scrapRate,
    mrpEnabled: item.mrpEnabled,
    defaultIssueWarehouseId: item.defaultIssueWarehouseId,
    issueMethod: item.issueMethod,
    backflushMethod: item.backflushMethod,
    overIssueControlMethod: item.overIssueControlMethod,
    projectText: item.projectText,
    positionNo: item.positionNo,
    operationName: item.operationName,
    effectiveFrom: item.effectiveFrom,
    effectiveTo: item.effectiveTo,
    remark: item.remark
  }))
})
