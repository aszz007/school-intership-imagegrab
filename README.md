# 图提取 ImageGrab

企业实习课程作品，Chrome Manifest V3扩展与配套静态官网。将当前商品页已经加载的图片整理为画廊，按需选择后真实转换为PNG下载。

## 安装与使用

1. 下载ImageGrab-v1.0.0.zip并解压，确认文件夹中有manifest.json。
2. 在Chrome打开chrome://extensions，开启开发者模式，点击“加载已解压的扩展程序”，选择解压文件夹。
3. 打开淘宝/天猫、京东或拼多多商品页。等图片加载后，点击右下角“获取图片”；未识别到悬浮按钮时，可点击扩展工具栏的“提取当前页图片”。
4. 在画廊查看图片及尺寸，逐张勾选、全选或反选，再点击“下载选中·PNG”。确认所选图片源权限后，图片会转换并交给浏览器下载。
5. 文件默认位于下载目录的ImageGrab子文件夹，采用商品图_001.png等序号。以浏览器下载记录的完成状态为准。

仅保存有权处理的图片。插件不读取商家后台API、不自动登录、不上传图片。提取基于页面已加载内容，特殊页面结构、登录限制、防盗链、动态加载或CDN重定向可能导致缺图或失败；错误会在画廊反馈。动态图片保存为静态帧。

## 权限与范围

activeTab和scripting用于本人点击扩展按钮后，在当前支持站点进行必要的补充注入；downloads用于本人选中图片的下载；storage保存本机画廊数据。图片源访问为optional_host_permissions，只在点击下载时请求选中域名。

图片源白名单：alicdn.com、taobao.com、tmall.com、jd.com、360buyimg.com、pddpic.com、pinduoduo.com、yangkeduo.com及各自子域名，均要求HTTPS。不支持的图片域名给出明确反馈。扩展会保持用户已确认的Chrome站点权限，可在扩展设置中自行撤销。

每次最多500张候选图，每张原图与转换后的PNG均不超过12MB，尺寸至少100×100，像素数量不超过3200万；两个转换任务并行，网络15秒超时。画廊数据两小时过期，不等于长期笔记或云同步。

## 官网与开发

官网在docs/index.html，使用HTML/CSS/JavaScript，无CDN、数据库或付费服务。docs/demo为可实际转换并下载自有JPG/WebP/PNG素材的演示，明确标为“示例演示·非扩展运行”，不作为电商扩展截图。docs/downloads包含可加载的插件ZIP。

本地运行整个课设的tools/serve.py后，访问/imagegrab/docs/。单独查看时可在本目录运行python -m http.server 4230 --bind 127.0.0.1，再访问http://127.0.0.1:4230/docs/。可从GitHub Pages的main分支/docs发布，使用相对资源路径。

文件职责：manifest.json声明范围；shared/core.js校验URL、尺寸和文件名；shared/extract.js读取DOM候选；content.js提供商品页按钮；background.js管理画廊会话、受限图片请求和下载；gallery.js负责选择、实际PNG转换及进度。

核心检查：node --test test/core.test.mjs。在限制子进程的环境中可使用node --test --test-isolation=none test/core.test.mjs。test/product-fixture.html通过生产DOM提取器检查自有图片，不代表Chrome API或真实电商站点验收。

## 当前验证记录

实现、验证和发布状态以实际测试记录为准，当前阶段见TESTING.md，9组核心测试及ZIP校验通过；浏览器布局、PNG实际下载、扩展安装和实站仍待验收。尚未将扩展安装、三平台实站或正式部署标成已通过。
