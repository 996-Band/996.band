# OSS / CDN 媒体工作流

网站内容继续保存 `/assets/...` 形式的逻辑路径，构建时通过
`src/data/media-assets.json` 映射到 `https://oss.996.band` 下带内容哈希的对象。
图片更新会得到新的对象名，因此可以安全使用一年期不可变缓存，不需要手动刷新同名文件。

## 1. 本机配置

复制 `.env.example` 为 `.env`，然后填写 OSS 区域、Bucket 和 AccessKey。
`.env` 已被 Git 忽略，禁止把凭证写入代码、文档或聊天记录。

建议先保持：

```dotenv
PUBLIC_ASSET_BASE_URL=
OSS_UPLOAD_ENABLED=false
```

此时网站仍使用本地图片。

## 2. 首次全量迁移

先生成和检查媒体清单：

```bash
pnpm media:manifest
pnpm media:check
pnpm media:migrate
```

最后一个命令默认只演练，不会上传。确认目标路径和文件数量后再执行：

```bash
pnpm media:migrate -- --upload
```

上传命令可重复执行：已存在且哈希、大小一致的对象会跳过。

## 3. 切换网站到 CDN

全量上传和抽样访问通过后，在本机 `.env` 中设置：

```dotenv
PUBLIC_ASSET_BASE_URL=https://oss.996.band
OSS_UPLOAD_ENABLED=true
```

然后运行：

```bash
pnpm release:check
```

线上 GitHub Pages 使用仓库变量 `PUBLIC_ASSET_BASE_URL`。首次迁移验证完成前不要设置；
需要紧急回退时清空该变量，重新发布后网站会恢复使用仓库内的本地资源。

## 4. 日常内容维护

```bash
pnpm content:manage
```

管理页处于 CDN 模式且 `OSS_UPLOAD_ENABLED=true` 时：

1. 相册图片、视频和专辑封面先在本机生成 WebP/MP4；
2. 新资源按内容哈希上传 OSS，并通过 CDN 地址校验；
3. 上传成功后才写入正式内容和媒体清单；
4. Git 提交继续保存内容配置、媒体清单和本地资源，作为可恢复的源文件。

删除或替换内容时不会立即删除旧 OSS 对象。旧对象不再被清单引用，可在发布稳定后按
30 天保留期统一清理，避免缓存或旧页面短暂访问失败。清理也默认只演练：

```bash
pnpm media:gc
```

确认待清理列表后，在 `.env` 临时设置 `OSS_DELETE_ENABLED=true`，再执行：

```bash
pnpm media:gc -- --delete
```

## oss-browser2 的定位

oss-browser2 适合查看 Bucket、抽查文件、下载备份和处理紧急问题，但不作为日常发布入口。
它不能同步更新网站内容配置与媒体清单，也容易产生同名覆盖。正常新增和更新应通过管理页
或 `pnpm media:migrate -- --upload` 完成。
