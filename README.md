# Art Supabase MDM

跨 HR、TMS、VMS、SMIS 等业务应用的主数据治理与统一查询应用。

本仓维护 MDM 页面、安全治理 API 与领域类型；认证、租户、权限、菜单、布局和 Supabase 公共客户端由 `art-supabase-pro` 提供。统一目录支持服务端分页、组合筛选、完整度识别、来源追溯和详情核对。统一目录不制造第二套写入口，既有主数据仍在来源业务应用中维护；新增生产工作区则维护自身的生产扩展、工艺与资源配置，不能将其等同于 HR 员工等权威主档。

## 接入边界核查（2026-09-05）

当前实库 `public` 有 39 张 `mdm_` 物理表；统一目录前端定义有 26 类来源。另有 `app_private` 下两张仅由数据库维护的生产数组引用索引，不是可独立维护的主档。生产扩展、关系、配置和时段事实不能按表数直接算成已完成治理的主档。

本次检查 SMIS 的 131 张物理表及重点 API，并继续扫描全库业务表中名称具有主数据语义的 UUID 引用。这里的“候选”不是已经完成迁移，也不是授权自动合并现存业务记录。

| 对象 | 当前证据 | 接入结论 |
| --- | --- | --- |
| 组织、员工、岗位、设备、物料、场所、存放位置 | SMIS 对这七类 MDM 表已有 121 条物理外键；劳保、工器具发放引用 `mdm_material` 与 `mdm_storage_location` | 已有统一身份引用，继续核查具体写入口与生命周期，不另建同名主档 |
| 危废仓库 `smis_hazardous_waste_warehouse` | 独立编号、名称、地址与负责人；没有指向 `mdm_site` / `mdm_storage_location` 的身份关联，当前统一目录也未包含它 | 明确的待接入对象。WMS 落地前先确定仓库与场所/存放位置的身份关系；不得仅按名称或编号自动合并。危废业务职责仍留在 SMIS |
| 危废名录、分类 | 独立监管代码、危险特性、安全措施和单位；当前没有 `mdm_material` 映射 | 领域参考数据候选，不等同于普通物料。先明确监管名录版本与业务物料的映射，再决定是否进入统一治理目录 |
| 检验类别、检查标准、危害因素、特殊作业类型 | 拥有安全业务规则及下游配置/作业消费 | 保留领域语义；跨域共享时接入只读治理，不直接拆成通用字典或并入物料 |
| 锅炉扩展、设备关系 | 按 `equipment_id` 或源/目标设备引用 `mdm_equipment` | 属于设备主档的领域扩展/关系，不是第二套设备身份 |
| 法定节假日 `smis_statutory_holiday` | 按组织维护日期范围；本次源码搜索未发现 HR 或 MDM 生产日历直接消费该 API | 是跨域日历参考数据候选；未证明日历已经打通，不能直接用安全节假日覆盖生产班次安排 |
| 事故人员、培训参与人员、试卷题目快照 | 表注释明确说明事故/培训发生时或组卷时的历史快照 | 保留历史事实；不能为消除重复字段而改成实时主档显示 |

全库实时组织引用扫描另发现 3 个已存储 MDM 标识、但缺少租户复合外键的字段：`fms_fixed_asset.department_id`、`hr_personnel_change.from_organization_id` 和 `hr_personnel_change.to_organization_id`。迁移 `20260905141033_connect_live_business_organization_references_to_mdm.sql` 已将它们约束到同租户 `mdm_organization`，并为引用检查建立部分索引。安全培训与应急演练参与人员中的 `organization_id` 连同组织名称、岗位、电话属于发布或实施时快照，继续保留为历史事实，不接成实时组织关系。

`supabase/tests/mdm_business_organization_references_test.sql` 使用回滚数据验证这 3 个实时引用的有效写入、跨租户拒绝、约束定义与 `ON DELETE RESTRICT` 语义；不会修改现存主数据。`supabase/tests/mdm_reference_coverage_test.sql` 继续扫描常见主档 UUID 字段：除明确列入历史快照白名单的字段外，出现新的无外键引用会直接失败，防止后续模块再次绕开统一身份。

121 条外键中 65 条携带 `tenant_id`，56 条仅引用 ID。单 ID 外键不是漏洞结论，必须继续检查 RPC、触发器和客户端有效写权限。危废仓库已在根仓 `supabase/tests/smis_hazardous_waste_management_test.sql` 补充普通用户实库回滚验证：本租户人员新增/编辑成功、四种跨租户人员引用拒绝、直接写权限受限、仅 View 角色新增/编辑拒绝，回滚后测试角色与仓库残留均为零。

上述验证只覆盖仓库人员引用，不证明其余引用、全部角色矩阵、停用/删除/并发行为均已完成。治理目录接入、身份映射、来源权威和历史版本是不同验收项，不能以 RLS 已开启或表名以 `mdm_` 开头代替验收。

## 独立运行

```powershell
pnpm install
pnpm dev
```

默认端口 `3017`，生产公共路径 `/art-supabase-mdm/`。

## 质量检查

```powershell
pnpm check
pnpm build
```
