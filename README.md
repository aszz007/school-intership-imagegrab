# 图提取 ImageGrab

**维护状态：2026年11月1日完成最终开源归档，后续不再更新或提供维护。可按 MIT 许可证自行 fork。**

Chrome Manifest V3 图片整理扩展，配套 HTML/CSS/JavaScript 官网。最终版本 **1.1.3**；本次仅补充许可证、安装包和源码说明，功能沿用 1.1.2。

[官网](https://aszz007.github.io/school-intership-imagegrab/) · [下载 1.1.3](docs/downloads/ImageGrab-v1.1.3.zip) · [示例画廊](https://aszz007.github.io/school-intership-imagegrab/demo/index.html?demo=1)

## 安装与使用

解压安装包，在 Chrome 打开 `chrome://extensions`，启用开发者模式，点击“加载已解压的扩展程序”，选择包含 `manifest.json` 的文件夹。打开商品页，等待图片加载，再点击“获取图片”或工具栏扩展按钮。

在画廊设置最小宽度、高度，点击“应用筛选”；重置恢复 100px。支持逐张选择、全选、反选和取消选择。下载仅处理当前匹配的选中图片，下载前按所选来源申请权限；可停止后续任务，并查看完成、失败或中断状态。

## 图片处理

候选图来自已加载的图片、懒加载属性、srcset 和背景图，经过地址去重。图片在本机解码并转换为 PNG；动态图片保存为静态帧。每次最多 500 张，每张至少 100×100 像素、不超过 3200 万像素，原图和 PNG 各不超过 12MB；两个任务并行，网络超时 15 秒，画廊会话保留两小时。

页面结构、未加载内容、登录限制和图片源重定向可能导致缺图或读取失败，画廊会显示原因。

## 从源码检查

```text
node --test test/core.test.mjs test/gallery.test.mjs
python -m http.server 4230 --bind 127.0.0.1
```

打开 http://127.0.0.1:4230/docs/。官网示例使用三张自编商品图；测试和真实扩展检查范围见 [TESTING.md](TESTING.md)。历史 ZIP 保留；1.1.3 安装包包含许可证。

## 许可

本项目原创代码、图标及自有示例素材采用 [MIT](LICENSE)。下载的第三方商品图片权利由原权利人保留。
