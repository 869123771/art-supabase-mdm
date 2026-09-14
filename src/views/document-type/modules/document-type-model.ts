import { pick } from 'lodash-es'
import { normalizeNonNullableText } from '@/utils/form/normalize'
import type { DocumentTypeRecord, DocumentTypeUpdateInput, DocumentTypeWriteInput } from '@mdm/api'

export interface DocumentTypeFormModel extends DocumentTypeWriteInput {
  id?: string
  sourceId?: string
}

export const createDocumentTypeFormModel = (
  patch: Partial<DocumentTypeFormModel> = {}
): DocumentTypeFormModel => ({
  id: undefined,
  sourceId: undefined,
  tenantId: undefined,
  menuId: '',
  documentTypeCode: '',
  documentTypeName: '',
  isDefault: false,
  remark: '',
  sortOrder: 10,
  textColor: '',
  tagStyle: 'primary',
  enabled: true,
  ...patch
})

export const createDocumentTypeCopyModel = (source: DocumentTypeRecord): DocumentTypeFormModel =>
  createDocumentTypeFormModel({
    sourceId: source.id,
    tenantId: source.tenantId,
    menuId: source.menuId,
    documentTypeCode: '',
    documentTypeName: `${source.documentTypeName}（副本）`,
    isDefault: false,
    remark: source.remark,
    sortOrder: source.sortOrder + 10,
    textColor: source.textColor,
    tagStyle: source.tagStyle,
    enabled: source.enabled
  })

export const buildDocumentTypeInput = (
  model: DocumentTypeFormModel,
  includeTenant: boolean
): DocumentTypeWriteInput => {
  const payload = pick(model, [
    'tenantId',
    'menuId',
    'documentTypeCode',
    'documentTypeName',
    'isDefault',
    'remark',
    'sortOrder',
    'textColor',
    'tagStyle',
    'enabled'
  ]) as DocumentTypeWriteInput

  payload.documentTypeCode = normalizeNonNullableText(payload.documentTypeCode).toUpperCase()
  payload.documentTypeName = normalizeNonNullableText(payload.documentTypeName)
  payload.remark = normalizeNonNullableText(payload.remark)
  payload.textColor = normalizeNonNullableText(payload.textColor).toUpperCase()
  payload.tagStyle = normalizeNonNullableText(
    payload.tagStyle
  ) as DocumentTypeWriteInput['tagStyle']
  if (!includeTenant) delete payload.tenantId
  return payload
}

export const buildDocumentTypeUpdateInput = (
  model: DocumentTypeFormModel
): DocumentTypeUpdateInput => {
  const payload = buildDocumentTypeInput(model, false)
  delete payload.tenantId
  return payload
}
