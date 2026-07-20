# 996 Band Official Website

996 Band 官网新版，使用 Astro 构建为纯静态站点，内容由 Content Collections 管理。

## 环境要求

- Node.js `>= 22.12.0`
- pnpm `11.7.0`

## 本地开发

```bash
pnpm install
pnpm dev
```

网站默认运行在 `http://127.0.0.1:4321`。

## 内容管理

```bash
pnpm content:manage
```

管理工具默认运行在 `http://127.0.0.1:4310`，用于维护：

- PHOTOS 相册与图片
- NOTICE 公告
- ARTICLES 文章
- ALBUMS 专辑与单曲

管理工具只修改本地仓库，不会自动提交或推送 Git。

## 发布检查

```bash
pnpm release:check
```

该命令会依次执行 Astro/TypeScript 检查和静态网站构建。构建结果输出到 `dist/`。

## 部署

推送 `site-v2` 分支后，GitHub Actions 会执行发布检查并部署至 GitHub Pages。

仓库 Pages 设置需要：

- Source：GitHub Actions
- Custom domain：`996.band`
- Enforce HTTPS：开启

## 主要目录

```text
src/content/             网站内容配置
src/components/          页面组件
src/pages/               页面路由
public/assets/           图片、视频和品牌素材
scripts/content-manager/ 本地内容管理工具
```
