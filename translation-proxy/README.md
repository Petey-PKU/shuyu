# 书语翻译网关

这个可选的无依赖 Node.js Web 服务为书语保存正式翻译供应商密钥，并统一提供。未部署它时，App 仍可使用客户端直连的必应实验性兼容模式和 MyMemory 兜底。

```http
POST /translate
Content-Type: application/json

{"text":"A complete English sentence.","source":"en","target":"zh-CN"}
```

成功响应：

```json
{"translation":"一条完整的英语句子。","provider":"azure","cached":false}
```

默认顺序是 Azure Translator → 腾讯云机器翻译。两者都不可用时返回 `502`，App 会继续尝试必应实验性兼容模式和 MyMemory。网关只接受英译简体中文，并自带单次长度限制、按客户端地址限速、超时控制和内存缓存；应用代码不会记录请求原文或译文。

## 环境变量

至少完整配置一组供应商密钥：

| 变量 | 说明 |
| --- | --- |
| `AZURE_TRANSLATOR_KEY` | Azure Translator 资源密钥 |
| `AZURE_TRANSLATOR_REGION` | 资源区域；单服务全局资源可以留空 |
| `AZURE_TRANSLATOR_ENDPOINT` | 全球版默认 `https://api.cognitive.microsofttranslator.com`；世纪互联中国版使用 `https://api.translator.azure.cn` |
| `TENCENT_SECRET_ID` | 腾讯云 API SecretId |
| `TENCENT_SECRET_KEY` | 腾讯云 API SecretKey |
| `TENCENT_REGION` | 默认 `ap-guangzhou` |
| `TENCENT_SESSION_TOKEN` | 仅使用腾讯云临时密钥时填写 |

运行保护参数见 [.env.example](./.env.example)。`.env.example` 只用于说明，真实密钥必须配置在托管平台的加密环境变量中，不能提交到 Git，也不能写进 App 的 `EXPO_PUBLIC_*` 变量。

## 本地测试

需要 Node.js 18 或更高版本。先运行不需要真实密钥的自动测试：

```powershell
npm run test:translation-proxy
```

需要调用真实 Azure 资源时，在当前 PowerShell 会话临时设置环境变量：

```powershell
$env:AZURE_TRANSLATOR_KEY = '你的密钥'
$env:AZURE_TRANSLATOR_REGION = '你的资源区域'
node .\translation-proxy\server.mjs
```

另开一个终端验证：

```powershell
Invoke-RestMethod -Method Post `
  -Uri 'http://127.0.0.1:9000/translate' `
  -ContentType 'application/json' `
  -Body '{"text":"Reading changes the way we see the world.","source":"en","target":"zh-CN"}'
```

## 部署到腾讯云 Web 函数

1. 在 Azure 创建 Translator F0 资源并取得密钥；需要中国境内资源时使用由世纪互联运营的 Azure 中国账号与 `.azure.cn` 端点。
2. 如需备用源，在腾讯云开通机器翻译，创建权限最小化的调用凭据，并关闭后付费或设置额度告警。
3. 将本目录内容打包。`scf_bootstrap` 必须位于压缩包根目录并具有可执行权限；在 Linux/WSL 中可运行 `chmod +x translation-proxy/scf_bootstrap`。
4. 在腾讯云云函数创建 Web 函数，选择支持 Node.js 18 或更高版本的运行环境并上传代码包。Web 函数会由 `scf_bootstrap` 启动，并监听固定端口 `9000`。
5. 在函数环境变量中配置供应商密钥和保护参数。不要把密钥写入源码或 App 仓库变量。
6. 为公开入口配置 HTTPS、上游请求频率限制和费用告警。网关内存限流只是最后一道保护，在多实例扩容时不能代替 API 网关级限流。
7. 访问 `<函数基础地址>/health` 检查已配置供应商，再请求 `<函数基础地址>/translate` 验证翻译。

部署完成后，在书语仓库 **Settings → Secrets and variables → Actions → Variables** 添加：

```text
SHUYU_TRANSLATION_ENDPOINT=https://你的网关地址/translate
SHUYU_TRANSLATION_PROVIDER_NAME=Azure Translator → 腾讯云 TMT
```

这两个仓库变量会进入 APK，因此只能保存公开网关地址和显示名称，不能保存供应商密钥。

## 隐私与费用边界

- 网关只在用户主动点词时接收未收录单词或当前句子，不接收整本书。
- 缓存键是原文的 SHA-256 摘要，内存缓存只保存译文和供应商名称，进程重启后消失。
- Azure 成功后不会再请求腾讯；只有前一供应商失败时才顺序回退。
- 腾讯云函数和各翻译 API 的免费额度彼此独立；必须同时设置调用限额、账单告警，并定期检查厂商计费规则。
