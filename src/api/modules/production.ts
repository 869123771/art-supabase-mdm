import type { EmployeeSelectorContractParams } from '@/api/integration/employees'
import { useSupabase } from '@/hooks'
import { buildOrIlikeFilter } from '@/utils/supabase/search'
import { parseProductionShifts } from './production-shifts'
import { fetchAllRangePages } from '@/utils/supabase/pagination'
import type {
  ProductionDepartment,
  ProductionDepartmentInput,
  ProductionPerson,
  ProductionPersonInput,
  ProductionPeopleQuery,
  ShiftPattern,
  ShiftPatternInput,
  ProductionCalendarDay,
  CalendarReminder,
  ProductionEmployeeReference
} from './production.types'
export * from './production.types'
const { supabase, responseHandle, keysToSnakeDeep } = useSupabase()
const readOptions = {
  breakReturn: true,
  showErrorMessage: false,
  errorMessage: '生产主数据加载失败，请重试'
}
const writeOptions = {
  breakReturn: true,
  showErrorMessage: true,
  requireAffected: true,
  showMessage: true,
  message: '保存成功',
  errorMessage: '操作失败，请检查数据后重试'
}

export async function fetchProductionDepartments(
  tenantId: string
): Promise<ProductionDepartment[]> {
  const { data } = await fetchAllRangePages<ProductionDepartment>(({ from, to }) =>
    responseHandle<ProductionDepartment[]>(
      () =>
        supabase
          .from('mdm_production_department')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('sort')
          .order('code')
          .range(from, to),
      readOptions
    )
  )
  return data ?? []
}
export async function saveProductionDepartment(data: ProductionDepartmentInput, id?: string) {
  const payload = keysToSnakeDeep(data)
  await responseHandle(
    () =>
      id
        ? supabase
            .from('mdm_production_department')
            .update(payload, { count: 'exact' })
            .eq('id', id)
            .select('id')
        : supabase
            .from('mdm_production_department')
            .insert(payload, { count: 'exact' })
            .select('id'),
    writeOptions
  )
}
export async function importProductionDepartments(rows: ProductionDepartmentInput[]) {
  await responseHandle(
    () =>
      supabase
        .from('mdm_production_department')
        .insert(keysToSnakeDeep(rows), { count: 'exact' })
        .select('id'),
    writeOptions
  )
}
export async function deleteProductionDepartment(id: string) {
  await responseHandle(
    () =>
      supabase
        .from('mdm_production_department')
        .delete({ count: 'exact' })
        .eq('id', id)
        .select('id'),
    {
      ...writeOptions,
      message: '部门已删除',
      errorMessage: '删除失败，请先移除下级部门、人员和日历等关联数据'
    }
  )
}
export async function setProductionDepartmentEnabled(id: string, enabled: boolean) {
  await responseHandle(
    () =>
      supabase
        .from('mdm_production_department')
        .update({ enabled }, { count: 'exact' })
        .eq('id', id)
        .select('id'),
    writeOptions
  )
}
export async function fetchProductionPeople(
  params: ProductionPeopleQuery,
  options?: { signal?: AbortSignal }
) {
  const { current, size, tenantId, departmentIds, keyword, phone, enabled } = params
  let query = supabase
    .from('mdm_production_personnel')
    .select('*,department:mdm_production_department(id,name,code)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('sort')
    .order('employee_no')
  if (departmentIds) query = query.in('department_id', departmentIds)
  if (keyword) query = query.or(buildOrIlikeFilter(['name', 'employee_no', 'barcode'], keyword))
  if (phone) query = query.ilike('phone', `%${phone}%`)
  if (typeof enabled === 'boolean') query = query.eq('enabled', enabled)
  query = query.range((current - 1) * size, current * size - 1)
  const { data, total } = await responseHandle<ProductionPerson[]>(
    () => (options?.signal ? query.abortSignal(options.signal) : query),
    readOptions
  )
  return { data: data ?? [], total: total ?? 0, current, size }
}
export async function saveProductionPerson(data: ProductionPersonInput, id?: string) {
  const payload = keysToSnakeDeep(data)
  await responseHandle(
    () =>
      id
        ? supabase
            .from('mdm_production_personnel')
            .update(payload, { count: 'exact' })
            .eq('id', id)
            .select('id')
        : supabase
            .from('mdm_production_personnel')
            .insert(payload, { count: 'exact' })
            .select('id'),
    writeOptions
  )
}
export async function importProductionPeople(rows: ProductionPersonInput[]) {
  await responseHandle(
    () =>
      supabase
        .from('mdm_production_personnel')
        .insert(keysToSnakeDeep(rows), { count: 'exact' })
        .select('id'),
    writeOptions
  )
}
export async function deleteProductionPeople(ids: string[]) {
  await responseHandle(
    () =>
      supabase
        .from('mdm_production_personnel')
        .delete({ count: 'exact' })
        .in('id', ids)
        .select('id'),
    { ...writeOptions, message: '人员配置已删除' }
  )
}
export async function setProductionPeopleEnabled(ids: string[], enabled: boolean) {
  await responseHandle(
    () =>
      supabase
        .from('mdm_production_personnel')
        .update({ enabled }, { count: 'exact' })
        .in('id', ids)
        .select('id'),
    writeOptions
  )
}
interface ProductionEmployeePayload {
  records: ProductionEmployeeReference[]
  total: number
  fieldAccess: Record<string, boolean>
}
export async function fetchProductionEmployeeOptions(params: EmployeeSelectorContractParams = {}) {
  const { data, error } = await responseHandle<ProductionEmployeePayload>(
    () =>
      supabase.rpc('mdm_list_production_employees', {
        p_from: params.from ?? 0,
        p_to: params.to ?? 9,
        p_keyword: params.keyword || null
      }),
    { ...readOptions, showErrorMessage: true }
  )
  return {
    data: data?.records ?? [],
    total: data?.total ?? 0,
    fieldAccess: data?.fieldAccess ?? {},
    error
  }
}
export async function fetchProductionEmployeeReference(id: string) {
  const { data } = await responseHandle<ProductionEmployeePayload>(
    () => supabase.rpc('mdm_list_production_employees', { p_id: id }),
    readOptions
  )
  const employee = data?.records[0]
  if (!employee) throw new Error('员工资料不可访问，请重新选择')
  return employee
}
export async function fetchShiftPatterns(
  tenantId: string,
  departmentId: string
): Promise<ShiftPattern[]> {
  const { data } = await responseHandle<ShiftPattern[]>(
    () =>
      supabase
        .from('mdm_production_shift_pattern')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('department_id', departmentId)
        .order('sort')
        .order('name'),
    readOptions
  )
  return (data ?? []).map((pattern) => ({
    ...pattern,
    shifts: parseProductionShifts(pattern.shifts)
  }))
}
export async function saveShiftPattern(data: ShiftPatternInput, id?: string) {
  // Preserve the versioned JSON shift keys while converting table columns.
  const { shifts, ...fields } = data
  const payload = { ...keysToSnakeDeep(fields), shifts }
  await responseHandle(
    () =>
      id
        ? supabase
            .from('mdm_production_shift_pattern')
            .update(payload, { count: 'exact' })
            .eq('id', id)
            .select('id')
        : supabase
            .from('mdm_production_shift_pattern')
            .insert(payload, { count: 'exact' })
            .select('id'),
    writeOptions
  )
}
export async function deleteShiftPattern(id: string) {
  await responseHandle(
    () =>
      supabase
        .from('mdm_production_shift_pattern')
        .delete({ count: 'exact' })
        .eq('id', id)
        .select('id'),
    { ...writeOptions, message: '轮班模式及对应日历已清除' }
  )
}
export async function referenceShiftPatterns(
  sourceDepartmentId: string,
  targetDepartmentId: string
) {
  await responseHandle(
    () =>
      supabase.rpc('mdm_reference_shift_patterns', {
        p_source_department_id: sourceDepartmentId,
        p_target_department_id: targetDepartmentId
      }),
    { ...writeOptions, requireAffected: false }
  )
}
export async function fetchProductionCalendar(
  tenantId: string,
  departmentId: string,
  start: string,
  end: string
): Promise<ProductionCalendarDay[]> {
  const { data } = await responseHandle<ProductionCalendarDay[]>(
    () =>
      supabase
        .from('mdm_production_calendar')
        .select('id,department_id,work_date,pattern_id')
        .eq('tenant_id', tenantId)
        .eq('department_id', departmentId)
        .gte('work_date', start)
        .lte('work_date', end),
    readOptions
  )
  return data ?? []
}
export async function setProductionCalendar(
  departmentId: string,
  patternId: string,
  dates: string[]
) {
  await responseHandle(
    () =>
      supabase.rpc('mdm_set_production_calendar', {
        p_department_id: departmentId,
        p_pattern_id: patternId,
        p_dates: dates
      }),
    { ...writeOptions, requireAffected: false }
  )
}
export async function fetchCalendarReminder(
  tenantId: string,
  departmentId: string
): Promise<CalendarReminder | null> {
  const { data } = await responseHandle<CalendarReminder>(
    () =>
      supabase
        .from('mdm_production_calendar_reminder')
        .select('id,department_id,enabled,lead_days')
        .eq('tenant_id', tenantId)
        .eq('department_id', departmentId)
        .maybeSingle(),
    readOptions
  )
  return data
}
export async function saveCalendarReminder(data: CalendarReminder) {
  const { id, ...fields } = data
  await responseHandle(
    () =>
      id
        ? supabase
            .from('mdm_production_calendar_reminder')
            .update(keysToSnakeDeep(fields), { count: 'exact' })
            .eq('id', id)
            .select('id')
        : supabase
            .from('mdm_production_calendar_reminder')
            .insert(keysToSnakeDeep(fields), { count: 'exact' })
            .select('id'),
    writeOptions
  )
}
