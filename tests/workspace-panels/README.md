# 工作区公共组件验收

使用真实 Vue、Ant Design Vue、平台 AIcon、`src/style.css` 和两个公共组件，不访问后端。它是隔离的交互验收页，未包含正式平台的 Provider、路由和业务权限。

从仓库根目录运行（依赖使用当前工作区已有安装）：

```sh
node --test tests/workspacePanels.test.mjs
node tests/check-workspace-panels.mjs
node_modules/.bin/vite build --config tests/workspace-panels/vite.config.mjs --configLoader runner
node_modules/.bin/vite --config tests/workspace-panels/vite.config.mjs --configLoader runner
```

浏览器访问 `http://127.0.0.1:9498/`。三种入口可直接切换；取消“接受点击请求”验证受控拒绝，外部展开/收起验证无事件反射。导航草稿在折叠时保留，导航焦点在被外部收起时回到入口；主区焦点不应移动。调宽支持分界线拖动、方向键、Home/End、双击和常驻按钮打开的点击操作。拖动时 Esc 应回滚。

缩小窗口后，示例宿主转为单栏并使用标准 Drawer。折叠偏好与输入由宿主持有，恢复宽屏时保留。断点和抽屉属于示例，不固化到公共组件。

Node 行为测试替换 DOM 和 Ant 渲染边界，用于状态、事件与焦点路径；它不代替浏览器中的布局、真实指针和辅助技术验收。
