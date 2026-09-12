import type { ProcessRouteInput, ProcessSequenceInput, ProcessStepInput } from '@mdm/api'

const optionalId = (value: string | null): string | null => value?.trim() || null

export function buildProcessRoutePayload(input: ProcessRouteInput): ProcessRouteInput {
  return {
    tenantId: input.tenantId.trim(),
    materialId: input.materialId.trim(),
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    routeType: input.routeType,
    allocationMode: input.allocationMode,
    groupId: optionalId(input.groupId),
    version: input.version.trim(),
    batchFrom: input.batchFrom,
    batchTo: input.batchTo,
    productionUnitId: optionalId(input.productionUnitId),
    departmentId: optionalId(input.departmentId),
    effectiveDate: input.effectiveDate.trim(),
    expiryDate: input.expiryDate.trim(),
    isDefault: input.isDefault,
    source: input.source,
    customUnitConversion: input.customUnitConversion,
    enabled: input.enabled,
    path: input.path.trim(),
    remark: input.remark.trim()
  }
}

export function buildProcessSequencePayload(input: ProcessSequenceInput): ProcessSequenceInput {
  return {
    routeId: input.routeId.trim(),
    sequenceNo: input.sequenceNo,
    sequenceType: input.sequenceType,
    transferInStepId: optionalId(input.transferInStepId),
    transferOutStepId: optionalId(input.transferOutStepId),
    remark: input.remark.trim()
  }
}

export function buildProcessStepPayload(input: ProcessStepInput): ProcessStepInput {
  return {
    routeId: input.routeId.trim(),
    sequenceId: optionalId(input.sequenceId),
    code: input.code.trim(),
    name: input.name.trim(),
    operationId: optionalId(input.operationId),
    description: input.description.trim(),
    unitId: optionalId(input.unitId),
    basicBatch: input.basicBatch,
    workCenterId: optionalId(input.workCenterId),
    departmentId: optionalId(input.departmentId),
    operationMode: input.operationMode,
    controlCodeId: optionalId(input.controlCodeId),
    processingMode: input.processingMode,
    reportMode: input.reportMode,
    inspectionMode: input.inspectionMode,
    sequenceControl: input.sequenceControl,
    reworkMode: input.reworkMode,
    needInspection: input.needInspection,
    firstInspection: input.firstInspection,
    firstInspectionControl: input.firstInspectionControl,
    isFirst: input.isFirst,
    isLast: input.isLast,
    critical: input.critical,
    unitConversion: input.unitConversion,
    activities: input.activities,
    outsourcing: input.outsourcing,
    inspection: input.inspection,
    sopDocuments: input.sopDocuments,
    sort: input.sort
  }
}
