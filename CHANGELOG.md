# Changelog

本文件用于记录 `Better History` 的面向用户可感知变化。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added
- 初始化开源仓库基础文档，包括 `README.md`、`LICENSE`、`CONTRIBUTING.md` 和 `CHANGELOG.md`
- 为 `package.json` 补齐更接近公共 npm 项目的元信息，包括 `license`、`author`、`homepage`、`repository`、`bugs` 与 `keywords`
- 新增可直接在 GitHub README 中展示的 demo 截图 `docs/demo.png`

### Changed
- 移除 `package.json` 中的 `"private": true`，使仓库配置更接近标准公共 npm 项目

### Fixed
- 避免 `chrome://newtab/`、`chrome://extensions/` 与 `chrome-extension://*` 等浏览器内部页、扩展页污染结果列表
- 在历史召回返回后立即清洗浏览器内部页与扩展页，避免旧状态继续参与分组与筛选
- 兼容过滤浏览器历史中以 `extensions`、`extensions?id=...` 等无协议形式返回的内部页记录
- 避免键盘上下选择结果时整块重绘列表，减少连续导航时的卡顿感
- 避免按住 `Ctrl` 显示快捷筛选数字提示时重复重绘整个结果区

### Changed
- 为历史召回链路增加临时调试输出，可在扩展页 Console 中查看最近一次搜索的原始项、过滤项与当前 debug build 标记
- 多词搜索默认按空格分词并使用 AND 语义匹配，同时支持逐词高亮；主召回改为优先使用最长 token
- 搜索请求不再在新结果返回前清空当前列表，减少输入过程中的闪烁
- 为相同查询结果与补召回批次增加短时缓存，降低连续输入时的重复历史查询开销
- 调试 payload 改为显式开启 `window.__BETTER_HISTORY_DEBUG_ENABLED__` 后才会生成，避免常规搜索路径持续构造调试日志

## [1.0.0] - 2026-05-09

### Added
- 提供基于 Chrome Manifest V3 的独立历史搜索页入口
- 支持浏览器工具栏点击打开搜索页
- 支持扩展级快捷键打开搜索页：macOS 默认 `Cmd + Shift + E`，Windows / Linux 默认 `Ctrl + Shift + E`
- 提供最近访问记录的默认展示模式
- 提供针对标题和 URL 的历史搜索能力
- 提供 `site:domain` / `domain:domain` 站点定向搜索
- 提供按 favicon 来源近似聚类的站点结果分组
- 提供站点快捷筛选与 `Ctrl + 数字键` 交互
- 提供键盘结果导航：`ArrowUp` / `ArrowDown`、`Enter`、`Shift+Enter`
- 提供输入框焦点保持、自动恢复焦点与更克制的自动滚动行为
- 提供扩展图标与品牌 logo 资源

### Changed
- 将产品主入口从 `omnibox` 关键字模式收敛为独立扩展页面
- 将搜索页视觉与交互逐步收敛到更接近命令面板的表达

### Fixed
- 避免 `doubao://history` 等内部历史页污染结果列表
- 避免鼠标悬浮抢占键盘选中结果

[Unreleased]: https://github.com/zhangqibupt/better-history/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/zhangqibupt/better-history/releases/tag/v1.0.0
