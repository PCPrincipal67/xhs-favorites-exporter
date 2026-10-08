# 小红书收藏导出器

一个在真实登录页面中整理小红书首页、关注和默认收藏列表的 Chrome 扩展。它只观察页面已经发出的 XHR，不重放私有 API，也不保存密码。

## 0.1.1

- 按路由、Tab、profile ID 和 generation 隔离 collection，切换列表后清空并要求显式重新开始。
- 只接收已识别的 SSR、XHR 和活动列表 DOM 来源，详情浮层打开时暂停扫描和滚动。
- 保留合并 token，使用 canonical explore URL，并把缺失 continuation 导出为 `null`。
- 验证 HTTP、业务状态和响应结构后再更新分页；失败会停止自动滚动并保留已有记录。

## 支持范围

插件只在这些明确识别的上下文中采集：

- 首页 `/`
- 关注页 `/following`
- 带有明确“收藏”Tab 和 profile ID 的个人主页收藏列表

个人主页的笔记或赞过 Tab、笔记详情页、相关推荐区域和无法确认归属的列表会停用采集。当前仓库没有可用的登录 Chrome 会话，因此站点专属的活动 Tab 属性、SSR 键名和列表选择器以显式 fixture 合约表示；未验证的形态会被跳过，而不是猜测。

## 安装和使用

1. 打开 Chrome 的 `chrome://extensions`，启用开发者模式。
2. 选择“加载已解压的扩展程序”，选中本项目目录。
3. 打开小红书并登录，进入支持的列表页面后刷新一次。
4. 确认面板显示正确模式，点击“开始采集”。
5. 详情浮层打开时扫描和滚动会暂停，关闭浮层后继续。
6. 切换首页、关注页、profile ID 或个人主页 Tab 时，旧结果和分页状态会自动清空；必须再次点击“开始采集”。
7. 点击“导出 JSON”保存结果。

分页响应只有在 HTTP 成功、JSON 结构有效且业务状态成功时才会进入结果。`page_info.has_more` 的值为 `true`、`false` 或 `null`：缺少继续标志时保持 `null`。滚到底部但无法确认耗尽时，插件会以“状态未知”停止，不会宣称导出完成；分页错误会停止自动滚动并保留已有记录。

## 导出格式

导出保留 `feed`、`total_items`、`missing_token_count`、`page_info` 和 `items` 等现有字段。`page_url` 始终指向记录所属的列表，即使导出时详情浮层处于打开状态。

```json
{
  "exported_at": "2026-09-30T00:00:00.000Z",
  "page_url": "https://www.xiaohongshu.com/user/profile/profile-42",
  "feed": "favorites",
  "total_items": 1,
  "missing_token_count": 0,
  "page_info": { "cursor": null, "has_more": null, "num": null, "page": null },
  "items": [
    {
      "note_id": "note-1",
      "xsec_token": "ABCD1234",
      "url": "https://www.xiaohongshu.com/explore/note-1?xsec_token=ABCD1234",
      "title": "示例标题",
      "author": "示例作者",
      "cover": "https://example.invalid/cover.jpg",
      "liked_count": "12",
      "note_type": "normal",
      "source": "ssr,xhr",
      "sources": ["ssr", "xhr"],
      "first_seen_at": "2026-09-30T00:00:00.000Z",
      "last_seen_at": "2026-09-30T00:01:00.000Z"
    }
  ]
}
```

记录按 `note_id` 合并。空字段不会覆盖已有值，来源会去重合并，首次发现时间保持不变，后续观察只刷新最后发现时间。URL 始终由合并后的 ID 和 token 重新生成，因此 tokenless DOM 观察不会抹掉先前得到的 token。

## 技术边界

`exporter-core.js` 是无 bundler 的纯适配和合并模块，由隔离世界和页面 bridge 各加载一份。`page-bridge.js` 读取带显式身份的 SSR、观察页面 XHR，并向 `content-script.js` 发送带 collection generation 的消息。content script 负责列表范围内的 DOM 扫描、滚动、状态面板和导出。

当前已验证的自动化范围由 `test/fixtures/source-contracts.json` 和 `test/regression.js` 覆盖，包括路由模式、profile/Tab 隔离、SSR 重排、请求类别、token URL、失败响应、未知 continuation、DOM 列表边界和导出上下文。fixture provenance 标明了当前没有现场登录会话的部分；fetch 观察保持关闭，直到有现场证据表明分页使用 fetch。

运行检查：

```sh
make check
```

## 已知限制

- 启用插件后需要刷新页面，确保 document-start bridge 能观察首批请求。
- 站点更换活动 Tab 或列表 DOM 属性时，未识别的来源会被跳过并显示提示。
- DOM-only 记录可能缺少 `xsec_token`，但仍会导出 canonical tokenless explore URL。
- 小红书会话级风控可能要求先在同一浏览器中打开一个小红书页面，再打开导出的链接。
- 仓库当前没有可用的登录 Chrome 会话，因此手工现场检查仍待执行。

## 文件

| 文件 | 作用 |
| --- | --- |
| `manifest.json` | Chrome Manifest V3 配置 |
| `exporter-core.js` | 纯上下文、来源、响应、记录和导出适配器 |
| `content-script.js` | 生命周期、面板、DOM 扫描、滚动和导出 |
| `page-bridge.js` | 页面上下文 SSR 读取、XHR 观察和 generation 消息 |
| `test/fixtures/source-contracts.json` | 脱敏来源合约和未验证边界 |
| `test/regression.js` | 无 bundler 的 Node 回归检查 |

## License

MIT
