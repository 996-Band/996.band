# 996 Band Official Website

> Songs for Front-End Engineers and All Brick Movers. We Advocate Anti-996.

这是 996 Band 的官方网站与数字舞台。网站用黑白 LED、舞台 VJ、滚动视差和轻量互动，
记录乐队的作品、现场、文章与成员故事。

[访问官网](https://996.band) ·
[网站更新记录](HISTORY.md) ·
[内容后台使用手册](docs/CONTENT-MANAGEMENT.md)

## 关于 996 Band

996 乐队由 6 位前端出身的工程师组成。核心团员最早于 2013 年在手机淘宝共事并结识，
之后于 2016 年组团成功。目前乐队成员分散各地，依然坚持为国内广大程序员和上班族
创作歌曲，坚持 Live 表演。

乐队现成员：

- 完颜（吉他 / 主唱）
- 郁结（贝斯 / 主唱）
- 天可（吉他）
- 缨缨（键盘）
- 大音（管乐）
- 渚薰 / 可璇（鼓）

致敬并想念所有的乐队前成员们：勾股（键盘 / 主唱）、晓田（贝斯）、帽匠（键盘）。

## 网站里有什么

- **NOTICE**：演出、发布和网站公告。
- **ARTICLES**：歌曲故事、成员动态与乐队文字。
- **PHOTOS**：历年演出、技术大会和乐队活动相册。
- **ALBUMS**：专辑与单曲入口。
- **NOW PLAYING**：网易云音乐站外播放器。
- **MEDIA & CONTACT**：音乐平台、视频号与乐队联系方式。

首页采用单页锚点结构，文章和完整相册保留独立页面。相册也可以从首页直接进入沉浸式
图片浏览器，支持缩放、移动、上一张 / 下一张以及跨相册浏览。

## 你可以从这里开始

### 普通访客

直接访问 [996.band](https://996.band)。网站支持桌面和手机浏览器；播放器默认不会自动
播放，请按需点击播放。

### 乐队成员

无需手写 JSON 或 Markdown。运行本地内容后台，就可以可视化维护相册、公告、文章、
专辑和单曲：

```bash
pnpm content:manage
```

第一次参与维护、日常更新、图片上传和 GitHub 协作方式，请阅读
[《内容后台使用手册》](docs/CONTENT-MANAGEMENT.md)。

### 开发者

继续阅读下面的本地开发、架构和发布说明。网站的重要演进记录见
[HISTORY.md](HISTORY.md)。

## 本地开发

### 环境要求

- Node.js `>= 22.12.0`（仓库 `.nvmrc` 使用 Node 22）
- pnpm `11.7.0`

安装依赖：

```bash
pnpm install
```

启动网站：

```bash
pnpm dev
```

网站默认运行在 [http://127.0.0.1:4321](http://127.0.0.1:4321)。

启动内容后台：

```bash
pnpm content:manage
```

后台默认运行在 [http://127.0.0.1:4310](http://127.0.0.1:4310)。网站预览和内容后台
是两个独立服务；维护内容时建议分别开两个终端窗口。

## 技术架构

| 层级 | 方案 | 作用 |
| --- | --- | --- |
| 网站框架 | Astro 7 + TypeScript | 构建纯静态页面，减少客户端负担 |
| 内容模型 | Astro Content Collections + Zod | 校验文章、公告、相册和专辑配置 |
| 内容后台 | 本地 Node.js 管理工具 | 用可视化表单完成内容增删改查 |
| 图片处理 | Sharp + WebP | 自动生成大图、缩略图和专辑封面 |
| 视频处理 | FFmpeg | 转换相册视频并生成封面与缩略图 |
| 媒体分发 | 阿里云 OSS + `oss.996.band` | 用内容哈希路径和 CDN 加速图片 |
| 本地缓存 | Service Worker | 首次访问后缓存关键图片，并支持版本更新 |
| 部署 | GitHub Actions + GitHub Pages | `master` 分支通过检查后自动发布 |

内容和页面代码分离保存在 `src/content/` 中。图片在内容里仍使用 `/assets/...` 逻辑路径，
构建时由媒体清单决定使用本地资源还是 `https://oss.996.band`，因此可以随时回退。

## 常用命令

```bash
pnpm dev              # 启动网站开发服务
pnpm content:manage   # 启动本地内容后台
pnpm check            # 检查 Astro 与 TypeScript
pnpm build            # 构建静态网站
pnpm release:check    # 发布前完整检查
pnpm preview          # 预览 dist 构建结果
pnpm media:check      # 检查媒体清单与 OSS 状态
```

完整 OSS/CDN 工作流见
[`scripts/media/README.md`](scripts/media/README.md)。

## 内容与排序规则

- 首页 ARTICLES：按发布日期倒序展示最新 3 篇，草稿不展示。
- 首页 PHOTOS：按相册日期倒序展示最新 9 组。
- 首页 ALBUMS：只展示已启用内容，按优先级从高到低取前 4 项。
- 首页 NOTICE：只展示已启用且在有效日期内的公告，优先级越高越靠前。
- 手机端 NOTICE：优先保证第一条公告完整，第二条仅使用剩余空间。

这些规则已经内置在页面中，日常维护只需要填写后台表单。

## 发布

GitHub Actions 监听 `master` 分支。内容合并到该分支后会自动执行检查、构建并部署到
GitHub Pages。

推荐所有成员通过独立内容分支和 Pull Request 协作，不要多人同时直接修改
`master`。内容后台只会修改本地文件，不会自动提交、推送或发布。

发布前至少运行：

```bash
pnpm release:check
```

## 主要目录

```text
docs/                    面向成员的维护文档
public/assets/           图片、视频和品牌源文件
scripts/content-manager/ 本地内容管理后台
scripts/media/           OSS/CDN 清单、迁移和清理工具
src/components/          页面组件
src/content/             文章、公告、相册和专辑配置
src/pages/               首页、文章和相册页面
src/styles/              全站样式与动效
HISTORY.md               网站版本与更新记录
```

## 更多文档

- [网站更新记录](HISTORY.md)
- [内容后台使用手册](docs/CONTENT-MANAGEMENT.md)
- [内容后台技术说明](scripts/content-manager/README.md)
- [OSS / CDN 媒体工作流](scripts/media/README.md)

---

© 2015-NOW 996 BAND. ALL RIGHTS RESERVED. THE ENTIRE WEB CONTENT IS POWERED BY CODEX.
