# Art Supabase MDM

跨 HR、TMS、VMS、SMIS 等业务应用的主数据治理与统一查询应用。

本仓维护 MDM 页面、只读治理 API 与领域类型；认证、租户、权限、菜单、布局和 Supabase 公共客户端由 `art-supabase-pro` 提供。首版不制造第二套写入口，主数据变更仍在来源业务应用中完成。

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
