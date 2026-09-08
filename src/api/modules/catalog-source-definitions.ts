export type MdmCatalogScope =
  | 'organization'
  | 'position'
  | 'employee'
  | 'partner'
  | 'logistics'
  | 'vehicle'
  | 'equipment'
  | 'material'

export interface MdmCatalogSourceDefinition {
  type: string
  label: string
  app: string
  kind: 'master' | 'relation'
}

export const mdmCatalogSourceDefinitions: Record<MdmCatalogScope, MdmCatalogSourceDefinition[]> = {
  organization: [{ type: 'organization', label: '组织机构', app: 'platform', kind: 'master' }],
  position: [
    { type: 'job_family', label: '职族', app: 'hr', kind: 'master' },
    { type: 'grade', label: '职级', app: 'hr', kind: 'master' },
    { type: 'job_profile', label: '职务', app: 'hr', kind: 'master' },
    { type: 'position', label: '岗位', app: 'hr', kind: 'master' }
  ],
  employee: [
    { type: 'employee', label: '员工', app: 'hr', kind: 'master' },
    { type: 'employee_assignment', label: '员工任职', app: 'hr', kind: 'relation' }
  ],
  partner: [
    { type: 'business_partner', label: '往来主体', app: 'mdm', kind: 'master' },
    { type: 'customer', label: '客户', app: 'tms', kind: 'master' },
    { type: 'carrier', label: '承运商', app: 'tms', kind: 'master' },
    { type: 'supplier', label: '供应商', app: 'vms', kind: 'master' },
    { type: 'insurance_company', label: '保险公司', app: 'vms', kind: 'master' },
    { type: 'external_vendor', label: '外部服务商', app: 'hr', kind: 'master' }
  ],
  logistics: [
    { type: 'station', label: '站点', app: 'tms', kind: 'master' },
    { type: 'customer_address', label: '客户地址', app: 'tms', kind: 'relation' },
    { type: 'cargo', label: '货物', app: 'tms', kind: 'master' },
    { type: 'driver', label: '司机', app: 'tms', kind: 'master' }
  ],
  vehicle: [{ type: 'vehicle', label: '车辆', app: 'vms', kind: 'master' }],
  equipment: [
    { type: 'equipment_category', label: '设备分类', app: 'smis', kind: 'master' },
    { type: 'equipment', label: '设备', app: 'smis', kind: 'master' },
    { type: 'part_category', label: '备件分类', app: 'vms', kind: 'master' },
    { type: 'part', label: '备件', app: 'vms', kind: 'master' }
  ],
  material: [
    { type: 'material_category', label: '物料分类', app: 'smis', kind: 'master' },
    { type: 'material', label: '物料', app: 'smis', kind: 'master' },
    { type: 'site', label: '场所', app: 'smis', kind: 'master' },
    { type: 'storage_location', label: '存放位置', app: 'smis', kind: 'master' }
  ]
}

export const mdmCatalogSourceKindCounts = Object.values(mdmCatalogSourceDefinitions)
  .flat()
  .reduce(
    (counts, source) => {
      counts[source.kind] += 1
      return counts
    },
    { master: 0, relation: 0 }
  )
