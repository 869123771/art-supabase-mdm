import { omit } from 'lodash-es'
import { useSupabase } from '@/hooks'
import { buildOrIlikeFilter } from '@/utils/supabase/search'
import type { BomInput, BomQuery, BomRecord, BomStatus, BomStructureNode } from './bom.types'

export * from './bom.types'

const { supabase, responseHandle, keysToSnakeDeep } = useSupabase()
const readOptions = {
  breakReturn: true,
  showErrorMessage: false,
  errorMessage: 'BOM 数据加载失败，请重试'
}
const writeOptions = {
  breakReturn: true,
  showErrorMessage: true,
  showMessage: true,
  requireAffected: false,
  message: '保存成功',
  errorMessage: 'BOM 操作失败，请检查数据后重试'
}

export async function fetchBoms(params: BomQuery, options?: { signal?: AbortSignal }) {
  let query = supabase
    .from('mdm_bom')
    .select(
      '*,material:mdm_material!mdm_bom_material_fkey(id,material_code,material_name,specification_model,base_unit_id),baseUnit:mdm_unit_of_measure!mdm_bom_unit_fkey(id,unit_code,unit_name,symbol),items:mdm_bom_item(id,tenant_id,bom_id,component_material_id,sequence_no,quantity,unit_id,scrap_rate,position_no,operation_name,effective_from,effective_to,remark,component:mdm_material!mdm_bom_item_material_fkey(id,material_code,material_name,specification_model,base_unit_id),unit:mdm_unit_of_measure!mdm_bom_item_unit_fkey(id,unit_code,unit_name,symbol))',
      { count: 'exact' }
    )
    .eq('tenant_id', params.tenantId)
    .order('sort')
    .order('update_time', { ascending: false })
  if (params.keyword)
    query = query.or(buildOrIlikeFilter(['bom_code', 'version', 'description'], params.keyword))
  if (params.purpose) query = query.eq('purpose', params.purpose)
  if (params.status) query = query.eq('status', params.status)
  query = query.range((params.current - 1) * params.size, params.current * params.size - 1)
  const { data, total } = await responseHandle<BomRecord[]>(
    () => (options?.signal ? query.abortSignal(options.signal) : query),
    readOptions
  )
  const rows = (data ?? []).map((row) => ({
    ...row,
    items: [...(row.items ?? [])].sort((a, b) => a.sequenceNo - b.sequenceNo)
  }))
  return { data: rows, total: total ?? 0, current: params.current, size: params.size }
}

export async function saveBom(payload: BomInput): Promise<string> {
  const header = keysToSnakeDeep(omit(payload, ['items']))
  const items = keysToSnakeDeep(payload.items)
  const { data } = await responseHandle<string>(
    () => supabase.rpc('mdm_save_bom', { p_header: header, p_items: items }),
    writeOptions
  )
  return data ?? ''
}

export async function transitionBom(id: string, status: BomStatus): Promise<void> {
  await responseHandle(
    () => supabase.rpc('mdm_transition_bom', { p_bom_id: id, p_target_status: status }),
    { ...writeOptions, message: 'BOM 状态已更新' }
  )
}

export async function deleteBom(id: string): Promise<void> {
  await responseHandle(() => supabase.rpc('mdm_delete_bom', { p_bom_id: id }), {
    ...writeOptions,
    message: 'BOM 已删除'
  })
}

export async function fetchBomStructure(id: string, maxDepth = 8): Promise<BomStructureNode[]> {
  const { data } = await responseHandle<BomStructureNode[]>(
    () => supabase.rpc('mdm_bom_structure', { p_bom_id: id, p_max_depth: maxDepth }),
    readOptions
  )
  return data ?? []
}
