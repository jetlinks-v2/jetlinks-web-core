# 校验（Verify）绑定逻辑 — 安全审查

## 一、当前绑定逻辑简述

1. **触发**：接口返回 403 且 `code === 'verify.required'`（或 `message === 'error.verify.requred'）时，弹出校验弹窗（验证码 / 身份校验）。
2. **成功后**：
   - 重试原请求时在请求头中附带 `x-verify-key`、`x-verify-token`。
   - 若服务端返回 `disposable: false`，将 key/token 写入 Pinia store 并同步到 `localStorage`（key: `jetlinks_verify_cache`）。
3. **后续请求**：请求拦截器从内存变量或 `localStorage` 读取缓存的 key/token，为**所有请求**统一附加上述两个 header。

---

## 二、安全性评估

### 1. 已修复：登出未清理校验缓存（中风险）

- **问题**：用户 A 通过校验后登出，用户 B 在同一浏览器登录。若未清理，内存或 `localStorage` 中仍保留 A 的 verify key/token，B 的请求会继续携带，存在被误用或绕过校验的可能。
- **修复**：
  - 在 `package.ts` 中新增并导出 `clearVerifyCache()`，用于清空内存中的 `verifyHeadersCache` 并调用 `useVerifyStore().clearCache()`（含 `localStorage`）。
  - 在所有「跳转登录/登出」路径前调用 `clearVerifyCache()`：
    - 主动登出：`User.vue` 中 `logout` 成功回调；
    - Token 失效：`package.ts` 中 `tokenExpiration`、`relogin/index.vue` 取消、`layout/Iframe.vue` 与 `views/mirco/iframe/index.vue` 中 token LOSE 消息处理。

### 2. 前端存储与传输

- **localStorage**：同源脚本或 XSS 可读取。校验 token 的实质安全依赖**服务端**：服务端应对 key+token 做会话/用户绑定、有效期与一次性校验，即使 token 被窃取，也应在服务端拒绝非法或过期使用。
- **请求头**：在 HTTPS 下传输加密，key/token 不会明文暴露于网络；仅对需要校验的接口在服务端校验，其它接口应忽略这两个 header。

### 3. 非一次性 vs 一次性

- 仅当服务端返回 `disposable: false` 时才写入缓存并复用于后续请求，符合「可复用校验」的设计；一次性校验不落盘、不复用，行为正确。

### 4. 403 判断与错误码

- 当前以 `code === 'verify.required'` 或 `message === 'error.verify.requred'` 判定（注意后端若拼写为 `required` 需与前端一致），避免误把其它 403 当作校验要求。建议服务端统一错误码与拼写。

### 5. 身份校验接口

- `/user/identity/_me`、`/verify/identity/*` 等接口应由服务端做鉴权与参数校验（key、requestId、token、用户身份一致性），前端仅负责展示与重试时带 header。

---

## 三、结论与建议

- **前端**：在「登出 / 跳转登录」前统一清理 verify 缓存后，当前绑定逻辑在约定（服务端严格校验 key+token 与用户/会话）下**可接受**。
- **建议**：
  1. **服务端**：对 verify key+token 做用户/会话绑定与 TTL；一次性 token 仅允许使用一次。
  2. **服务端**：仅对需要校验的接口校验 `x-verify-key` / `x-verify-token`，其它接口忽略，避免逻辑混乱。
  3. **前端**：继续做好 XSS 防护与 CSP，降低 localStorage 被滥用的概率。
