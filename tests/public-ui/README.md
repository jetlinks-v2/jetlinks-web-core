# 公共阅读与编辑组件验收

使用真实 Vue、Ant Design Vue、AIcon、平台样式及公共组件，不访问后端。它是隔离宿主，不代表完整生产 Provider 和业务权限已验证。

从仓库根目录运行：

```sh
node --test tests/inlineEditForm.test.mjs
node tests/check-workspace-panels.mjs tests/tsconfig.public-ui.json
node_modules/.bin/vite build --config tests/public-ui/vite.config.mjs --configLoader runner
node_modules/.bin/vite --config tests/public-ui/vite.config.mjs --configLoader runner
```

访问 `http://127.0.0.1:9521/`。保持宽窗口并切换内容容器，核对详情动作及录入列数随容器重排；数组与 slot 字段应具有一致样式。详情编辑分别选择成功、返回字段错误、抛出异常，检查错误只显示一次、输入保留、Esc 取消及重试；用键盘选择负责人，核对实际 combobox 的标签。候选含说明，收起标签保持短名称。折叠入口优先融入主区头部，左区搜索独立；收起后左列归零，入口、焦点及输入保留遵循公共布局契约。

两区之间的真实分割线已启用调宽：拖动、方向键和点击操作共用边界，Esc 回滚拖动，双击恢复初始宽度。调整后折叠再展开应保留宽度与搜索值；无业务页 CSS 或模拟拖动代码。
