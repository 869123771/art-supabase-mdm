import dayjs, { type Dayjs } from 'dayjs'
import type { MaterialCodeSegment } from '@mdm/api'

export interface MaterialCodePreviewInput {
  fixedField: string
  segments: MaterialCodeSegment[]
  sequenceDigits: number
  codeLength: number
  sequenceValue?: number
  materialTypePrefix?: string
  materialCategoryPrefix?: string
  date?: Dayjs
}

export interface MaterialCodePreviewResult {
  code: string
  overflow: number
  padding: number
}

const normalize = (value?: string): string =>
  String(value ?? '')
    .trim()
    .toUpperCase()

export function buildMaterialCodePreview(
  input: MaterialCodePreviewInput
): MaterialCodePreviewResult {
  const date = input.date ?? dayjs()
  const segmentValue = input.segments
    .map((segment) => {
      if (segment.source === 'fixed') return normalize(segment.value)
      if (segment.source === 'material_type') return normalize(input.materialTypePrefix || 'MT')
      if (segment.source === 'material_category')
        return normalize(input.materialCategoryPrefix || 'MC')
      if (segment.format === 'YYYY') return date.format('YYYY')
      if (segment.format === 'YYYYMM') return date.format('YYYYMM')
      return date.format('YYYYMMDD')
    })
    .join('')
  const fixedField = normalize(input.fixedField)
  const sequence = String(Math.max(1, input.sequenceValue ?? 1)).padStart(
    Math.max(2, input.sequenceDigits),
    '0'
  )
  const baseLength = segmentValue.length + fixedField.length + sequence.length
  const padding = Math.max(0, input.codeLength - baseLength)
  const overflow = Math.max(0, baseLength - input.codeLength)

  return {
    code: `${segmentValue}${'0'.repeat(padding)}${fixedField}${sequence}`,
    overflow,
    padding
  }
}
