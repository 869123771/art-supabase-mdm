import type { MasterGroupDomain, MasterGroupInput } from '@mdm/api'

export interface MasterGroupFormModel {
  tenantId: string
  domain: MasterGroupDomain
  parentId: string | null
  code: string
  name: string
  sort: number
  enabled: boolean
  remark: string
}

interface MasterGroupWriteContext {
  editing: boolean
  isPlatformScope: boolean
}

/**
 * Ordinary tenant writes derive tenant ownership at the database boundary. Platform-super creates
 * retain their explicit target tenant, while updates stay bound to the existing row's tenant.
 */
export function buildMasterGroupWriteInput(
  model: MasterGroupFormModel,
  context: MasterGroupWriteContext
): MasterGroupInput {
  const { tenantId, ...fields } = model
  const payload: MasterGroupInput = {
    ...fields,
    parentId: fields.parentId || null,
    code: fields.code.trim().toUpperCase(),
    name: fields.name.trim(),
    remark: fields.remark.trim()
  }

  if (!context.editing && context.isPlatformScope) {
    payload.tenantId = tenantId.trim()
  }

  return payload
}
