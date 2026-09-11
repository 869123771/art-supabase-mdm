export const MATERIAL_DESCRIPTION_FIELD_OPTIONS = [
  { label: '物料名称', value: 'material_name' },
  { label: '规格型号', value: 'specification_model' },
  { label: '品牌', value: 'brand' },
  { label: '制造商', value: 'manufacturer' },
  { label: '颜色', value: 'color' },
  { label: '图号', value: 'drawing_no' },
  { label: '材质', value: 'material_composition' },
  { label: '产地', value: 'place_of_origin' },
  { label: '属性组', value: 'attribute_group' }
] as const

export const MATERIAL_DESCRIPTION_FIELD_LABELS = Object.fromEntries(
  MATERIAL_DESCRIPTION_FIELD_OPTIONS.map((item) => [item.value, item.label])
) as Record<string, string>
