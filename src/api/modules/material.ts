import { omit } from 'lodash-es'
import { useSupabase } from '@/hooks'
import { buildOrIlikeFilter } from '@/utils/supabase/search'
import type {
  MaterialArchive,
  MaterialArchiveInput,
  MaterialCategory,
  MaterialReferenceKind,
  MaterialReferenceQuery,
  MaterialReferenceRecord
} from './material.types'

export * from './material.types'

const { supabase, responseHandle, keysToSnakeDeep } = useSupabase()
const readOptions = {
  breakReturn: true,
  showErrorMessage: false,
  errorMessage: '物料主数据加载失败，请重试'
}
const writeOptions = {
  breakReturn: true,
  showErrorMessage: true,
  showMessage: true,
  requireAffected: true,
  message: '保存成功',
  errorMessage: '操作失败，请检查数据后重试'
}

const referenceTables = {
  'unit-of-measure': 'mdm_unit_of_measure',
  'material-type': 'mdm_material_type',
  'attribute-group': 'mdm_material_attribute_group',
  'code-rule': 'mdm_material_code_rule'
} as const

const referenceSearchFields: Record<MaterialReferenceKind, string[]> = {
  'unit-of-measure': ['unit_code', 'unit_name', 'symbol', 'dimension'],
  'material-type': ['type_code', 'type_name', 'code_prefix'],
  'attribute-group': ['group_code', 'group_name'],
  'code-rule': ['rule_code', 'rule_name', 'prefix']
}

export async function fetchMaterialReferences<T extends MaterialReferenceRecord>(
  kind: MaterialReferenceKind,
  params: MaterialReferenceQuery,
  options?: { signal?: AbortSignal }
) {
  const table = referenceTables[kind]
  let query = supabase
    .from(table)
    .select('*', { count: 'exact' })
    .eq('tenant_id', params.tenantId)
    .order('sort')
    .order(
      kind === 'unit-of-measure'
        ? 'unit_code'
        : kind === 'material-type'
          ? 'type_code'
          : kind === 'attribute-group'
            ? 'group_code'
            : 'rule_code'
    )
  if (params.keyword)
    query = query.or(buildOrIlikeFilter(referenceSearchFields[kind], params.keyword))
  if (params.status) query = query.eq('status', params.status)
  query = query.range((params.current - 1) * params.size, params.current * params.size - 1)
  const { data, total } = await responseHandle<T[]>(
    () => (options?.signal ? query.abortSignal(options.signal) : query),
    readOptions
  )
  return { data: data ?? [], total: total ?? 0, current: params.current, size: params.size }
}

export async function fetchMaterialReferenceOptions<T extends MaterialReferenceRecord>(
  kind: MaterialReferenceKind,
  tenantId: string
) {
  const table = referenceTables[kind]
  const { data } = await responseHandle<T[]>(
    () =>
      supabase
        .from(table)
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'enabled')
        .order('sort'),
    readOptions
  )
  return data ?? []
}

export async function saveMaterialReference(
  kind: MaterialReferenceKind,
  payload: Partial<MaterialReferenceRecord>,
  id?: string
) {
  const table = referenceTables[kind]
  const data = keysToSnakeDeep(
    omit(payload, ['id', 'createBy', 'createTime', 'updateBy', 'updateTime'])
  )
  await responseHandle(
    () =>
      id
        ? supabase.from(table).update(data, { count: 'exact' }).eq('id', id).select('id')
        : supabase.from(table).insert(data, { count: 'exact' }).select('id'),
    writeOptions
  )
}

export async function deleteMaterialReferences(kind: MaterialReferenceKind, ids: string[]) {
  await responseHandle(
    () =>
      supabase.from(referenceTables[kind]).delete({ count: 'exact' }).in('id', ids).select('id'),
    { ...writeOptions, message: '删除成功', errorMessage: '删除失败，请先解除关联数据' }
  )
}

export async function setMaterialReferencesEnabled(
  kind: MaterialReferenceKind,
  ids: string[],
  enabled: boolean
) {
  await responseHandle(
    () =>
      supabase
        .from(referenceTables[kind])
        .update({ status: enabled ? 'enabled' : 'disabled' }, { count: 'exact' })
        .in('id', ids)
        .select('id'),
    { ...writeOptions, message: enabled ? '已启用' : '已停用' }
  )
}

export async function fetchMaterialCategories(tenantId: string): Promise<MaterialCategory[]> {
  const { data } = await responseHandle<MaterialCategory[]>(
    () =>
      supabase
        .from('mdm_material_category')
        .select('*,materialType:mdm_material_type(id,type_code,type_name)')
        .eq('tenant_id', tenantId)
        .order('sort')
        .order('category_name'),
    readOptions
  )
  return data ?? []
}

export async function saveMaterialCategory(payload: Partial<MaterialCategory>, id?: string) {
  const data = keysToSnakeDeep(
    omit(payload, [
      'id',
      'materialType',
      'children',
      'createBy',
      'createTime',
      'updateBy',
      'updateTime'
    ])
  )
  await responseHandle(
    () =>
      id
        ? supabase
            .from('mdm_material_category')
            .update(data, { count: 'exact' })
            .eq('id', id)
            .select('id')
        : supabase.from('mdm_material_category').insert(data, { count: 'exact' }).select('id'),
    writeOptions
  )
}

export async function deleteMaterialCategories(ids: string[]) {
  await responseHandle(
    () =>
      supabase.from('mdm_material_category').delete({ count: 'exact' }).in('id', ids).select('id'),
    {
      ...writeOptions,
      message: '物料分类已删除',
      errorMessage: '删除失败，请先移除下级分类或关联物料'
    }
  )
}

export async function setMaterialCategoriesEnabled(ids: string[], enabled: boolean) {
  await responseHandle(
    () =>
      supabase
        .from('mdm_material_category')
        .update({ status: enabled ? 'enabled' : 'disabled' }, { count: 'exact' })
        .in('id', ids)
        .select('id'),
    { ...writeOptions, message: enabled ? '分类已启用' : '分类已停用' }
  )
}

export interface MaterialArchiveQuery {
  current: number
  size: number
  tenantId: string
  keyword?: string
  categoryId?: string
  status?: 'enabled' | 'disabled'
  materialTypeId?: string
}

export async function fetchMaterialArchives(
  params: MaterialArchiveQuery,
  options?: { signal?: AbortSignal }
) {
  let query = supabase
    .from('mdm_material')
    .select(
      '*,category:mdm_material_category(id,category_code,category_name),materialTypeRef:mdm_material_type(id,type_code,type_name),baseUnit:mdm_unit_of_measure!mdm_material_base_unit_fkey(id,unit_code,unit_name,symbol)',
      { count: 'exact' }
    )
    .eq('tenant_id', params.tenantId)
    .order('sort')
    .order('material_code')
  if (params.keyword)
    query = query.or(
      buildOrIlikeFilter(
        ['material_code', 'material_name', 'specification_model', 'description'],
        params.keyword
      )
    )
  if (params.categoryId) query = query.eq('category_id', params.categoryId)
  if (params.materialTypeId) query = query.eq('material_type_id', params.materialTypeId)
  if (params.status) query = query.eq('status', params.status)
  query = query.range((params.current - 1) * params.size, params.current * params.size - 1)
  const { data, total } = await responseHandle<MaterialArchive[]>(
    () => (options?.signal ? query.abortSignal(options.signal) : query),
    readOptions
  )
  return { data: data ?? [], total: total ?? 0, current: params.current, size: params.size }
}

export async function saveMaterialArchive(payload: MaterialArchiveInput, id?: string) {
  const data = keysToSnakeDeep(payload)
  await responseHandle(
    () =>
      id
        ? supabase.from('mdm_material').update(data, { count: 'exact' }).eq('id', id).select('id')
        : supabase.from('mdm_material').insert(data, { count: 'exact' }).select('id'),
    writeOptions
  )
}

export async function deleteMaterialArchives(ids: string[]) {
  await responseHandle(
    () => supabase.from('mdm_material').delete({ count: 'exact' }).in('id', ids).select('id'),
    {
      ...writeOptions,
      message: '物料档案已删除',
      errorMessage: '删除失败，物料可能已被业务单据引用'
    }
  )
}

export async function setMaterialArchivesEnabled(ids: string[], enabled: boolean) {
  await responseHandle(
    () =>
      supabase
        .from('mdm_material')
        .update({ status: enabled ? 'enabled' : 'disabled' }, { count: 'exact' })
        .in('id', ids)
        .select('id'),
    { ...writeOptions, message: enabled ? '物料已启用' : '物料已停用' }
  )
}

export async function generateMaterialCode(params: {
  ruleId: string
  materialTypeId?: string
  categoryId?: string
}) {
  const { data } = await responseHandle<string>(
    () =>
      supabase.rpc('mdm_generate_material_code', {
        p_rule_id: params.ruleId,
        p_material_type_id: params.materialTypeId ?? null,
        p_category_id: params.categoryId ?? null
      }),
    { ...writeOptions, showMessage: false, message: '' }
  )
  return data ?? ''
}

export interface MaterialContextOption {
  id: string
  tenantId: string
  code?: string
  name: string
}

export async function fetchMaterialSiteOptions(tenantId: string): Promise<MaterialContextOption[]> {
  const { data } = await responseHandle<Array<{ id: string; tenantId: string; siteName: string }>>(
    () =>
      supabase
        .from('mdm_site')
        .select('id,tenant_id,site_name')
        .eq('tenant_id', tenantId)
        .order('sort'),
    readOptions
  )
  return (data ?? []).map((item) => ({
    id: item.id,
    tenantId: item.tenantId,
    name: item.siteName
  }))
}

export async function fetchMaterialStorageOptions(
  tenantId: string
): Promise<MaterialContextOption[]> {
  const { data } = await responseHandle<
    Array<{ id: string; tenantId: string; locationCode: string; locationName: string }>
  >(
    () =>
      supabase
        .from('mdm_storage_location')
        .select('id,tenant_id,location_code,location_name')
        .eq('tenant_id', tenantId)
        .eq('status', 'enabled')
        .order('location_code'),
    readOptions
  )
  return (data ?? []).map((item) => ({
    id: item.id,
    tenantId: item.tenantId,
    code: item.locationCode,
    name: item.locationName
  }))
}
