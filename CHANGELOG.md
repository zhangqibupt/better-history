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
