# XStatus 原生主题

SketchProbe 和 Win2000 的 XStatus 原生移植。直接使用 XStatus 自己的公开
API、WebSocket 和主题清单协议，不需要极简探针兼容层，也不替换全局
fetch/WebSocket。切回内置主题或删除主题即可恢复宿主前台。

后台 → 主题设置 → 安装主题 → GitHub，输入 `yqhui/xstatus-themes`。
latest release 提供两个独立 `.tar.gz`，主题中心会逐项安装。
没有 release 时，仓库 `themes/<short>` 也包含可安装产物。

要求 XStatus 支持 `type:"spa"`、合集安装及 `docs/10-themes.md` 所列原生
接口。主题包包含 21:9 的高清封面，主题设置页可直接预览。

页面：

- 节点首页只显示节点卡片，不显示 KPI、地图、地区分类；节点名称打开详情。
- 卡片严格使用原生快照的延迟配置，单目标/聚合保持一行，多个目标按节点
  `network_display_targets` 顺序显示最多三行。网络质量页独立显示所有公开探测目标。
- 网络质量支持 1h/24h/7d/30d、节点搜索、延迟/丢包切换、样本数据、刷新。
  最新数据超过 180 秒时从在线矩阵移除；图表无数据处断开，空值不当成 0。
- 服务监控使用原生分组与公开状态汇总，保留四态、30 天可用率、响应时间、
  运行天数及可通过鼠标/触屏/键盘查看的每天数据。
- 实时节点 WS 断开会重连，并回退 HTTP 轮询；公开开关、隐私和服务可见性由
  宿主 API 执行。后台仍为宿主页面。
- 支持浅色/深色，后台配置站点标题、纸张笔触或桌面风格；配置保存在宿主数据库。

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

源码在 `src/`；构建产物在 `themes/`；发布包和 SHA256 校验表在 `packages/`。
CI 对 main 和 tag 构建，`v*` tag 自动发布两个包。

上游与版权：

- SketchProbe: https://github.com/moxuun/monitor-theme-sketchprobe，
  `c8827de813f1a67927154d32e7a711ceefb286dc`；复用手绘引擎、纸张样式与 Excalifont。
- Win2000: https://github.com/guboysky/win2000，
  `095b09cde01c22000a494c1b5bde8d076a29dad3`；该仓库仅发布构建产物，
  复用公开 CSS，功能组件重新用原生 XStatus 数据实现。
- 两者 MIT 许可、字体 OFL 与第三方通知在 `public/licenses/`，
  也随主题打包到 `dist/licenses/`。原主题其他协议/旧后端设置不继承。
