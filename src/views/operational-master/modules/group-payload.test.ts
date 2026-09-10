import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMasterGroupWriteInput, type MasterGroupFormModel } from './group-payload'

const model: MasterGroupFormModel = {
  tenantId: '3d3e7b51-0177-4467-92b8-97cad3c93474',
  domain: 'customer',
  parentId: null,
  code: ' huawei ',
  name: ' 华为 ',
  sort: 10,
  enabled: true,
  remark: ' 重点客户 '
}

test('ordinary tenant create omits tenantId so the database derives it from the session', () => {
  const payload = buildMasterGroupWriteInput(
    { ...model, tenantId: '' },
    {
      editing: false,
      isPlatformScope: false
    }
  )

  assert.equal('tenantId' in payload, false)
  assert.equal(payload.code, 'HUAWEI')
  assert.equal(payload.name, '华为')
  assert.equal(payload.remark, '重点客户')
})

test('root group converts an empty tree selection to a null parent UUID', () => {
  const payload = buildMasterGroupWriteInput(
    { ...model, parentId: '' },
    {
      editing: false,
      isPlatformScope: false
    }
  )

  assert.equal(payload.parentId, null)
})

test('platform-super create preserves the explicit target tenant', () => {
  const payload = buildMasterGroupWriteInput(model, {
    editing: false,
    isPlatformScope: true
  })

  assert.equal(payload.tenantId, model.tenantId)
})

test('editing never allows tenant ownership to move', () => {
  const payload = buildMasterGroupWriteInput(model, {
    editing: true,
    isPlatformScope: true
  })

  assert.equal('tenantId' in payload, false)
})
