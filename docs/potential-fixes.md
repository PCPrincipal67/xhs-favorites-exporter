# 后续验证和修复边界

本文件记录仍需要现场证据的事项。运行时安全边界已经由 `exporter-core.js` 固定：无法确认来源归属、请求类别或 SSR 收藏身份时跳过数据，不使用 positional fallback。

## 需要登录会话确认的事项

- 个人主页当前活动 Tab 的真实属性和收藏 profile ID 字段。
- SSR `user.notes`、`user.noteQueries` 中收藏列表和对应 query 的真实身份字段。
- 收藏分页是否持续使用 `/api/sns/web/v2/note/collect/page` 的 XHR，以及请求 body 中的 profile ID。
- 首页和关注页 homefeed 请求的真实 category 字段。
- 活动列表容器、详情浮层和嵌套滚动容器的真实 DOM 属性。

这些字段的脱敏合约位于 `test/fixtures/source-contracts.json`。现场捕获前，适配器只启用显式 metadata 形态；没有证据时不要把“第一个列表”、固定数组下标、全页面链接或同 endpoint 的相关推荐当作收藏来源。

## 已处理的边界

- 路由、Tab、profile ID 和 collection generation 组成活动 collection identity。
- navigation、Tab 切换和 profile 切换会停止滚动、清空结果和分页，并要求显式重新开始。
- 详情浮层保留当前结果，但暂停 DOM 扫描和自动滚动。
- XHR 仅在 HTTP 2xx、有效 JSON、有效列表结构和成功业务状态下产生 page event；429、401、业务失败、解析失败、网络错误、timeout 和 abort 都会显示错误并保留已有记录。
- continuation 缺失时导出 `null`。空页本身不会推断耗尽。
- 记录按 note ID 合并，非空字段优先，source union 去重，URL 从合并后的 token 重建。
- 导出使用 collection context 的稳定 `page_url`，而不是详情浮层打开时的临时位置。

## 暂不启用的方向

不要在没有现场 transport 证据前添加 fetch hook，也不要重放私有 API。若现场确认分页改用 fetch，应复用现有 generation、membership、response validation 和 error pipeline，并验证原始 Promise 返回值保持不变。

## 验证命令

```sh
node test/regression.js
node --check exporter-core.js
node --check page-bridge.js
node --check content-script.js
make check
```

自动化回归只能证明纯逻辑和脚本语法。Chrome 现场检查需要真实登录会话，结果必须单独记录，不能用合成 fixture 代替。
