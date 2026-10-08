# 使用 GitHub 构建书语 APK

项目以 GitHub Actions 作为主要 Android 构建方式。工作流位于 `.github/workflows/android-apk.yml`，可以手动运行，也会在推送 `v*` 标签时运行。

## 第一次：生成个人测试 APK

1. 在 GitHub 新建一个空仓库。项目计划开源时选择 **Public**；暂不公开时选择 **Private**。
2. 将本项目提交并推送到仓库。
3. 打开仓库的 **Actions** 页面。
4. 选择 **Build installable Android APK**，点击 **Run workflow**。
5. 构建完成后，在运行详情底部下载 `Shuyu-APK`。
6. 解压后安装 `Shuyu-v<版本号>-test.apk`。

测试 APK 使用测试密钥签名，可以直接安装，但不要把它作为正式版本公开分发。

## 正式分发前：配置永久签名

Android 后续版本必须继续使用同一个签名，否则无法覆盖安装。请先生成并离线备份唯一的 release keystore，然后在仓库 **Settings → Secrets and variables → Actions** 中创建以下 Repository secrets：

| Secret | 内容 |
| --- | --- |
| `SHUYU_ANDROID_KEYSTORE_BASE64` | release keystore 文件的 Base64 文本 |
| `SHUYU_ANDROID_KEYSTORE_PASSWORD` | keystore 密码 |
| `SHUYU_ANDROID_KEY_ALIAS` | 密钥别名 |
| `SHUYU_ANDROID_KEY_PASSWORD` | 密钥密码 |

四项齐全后，同一个工作流会自动生成 `Shuyu-v<版本号>-release.apk`。发布 APK 只打包 `armeabi-v7a` 和 `arm64-v8a`，适用于实体 Android 手机，不包含 x86 模拟器库；R8 和 Android 资源压缩也会在发布构建中启用。Amy 离线音色不随 APK 分发，工作流会检查 Android 资源中没有模型文件；用户安装后可在设置页按需下载。缺少任意密码时构建会主动失败，避免产生签名状态不明确的安装包。

## 可选：下载离线 Amy 音色

基础 APK 不携带约 77 MiB 的 Piper Amy 解压模型，因此首次安装包更小。安装后进入“设置 → 英语发音音色”，选择“书语 · Amy”并点“下载离线音色”。应用会从 sherpa-onnx 官方 Release 下载固定的约 67 MB 归档，完成 SHA-256 校验后解压到应用私有目录；设置页显示下载和解压进度，并提供重试和删除。下载完成后单词、句子和当前页朗读都可完全离线，未下载时会自动使用系统 TTS。

## 可选：启用正式翻译代理

在仓库 **Settings → Secrets and variables → Actions → Variables** 中可添加：

| Variable | 内容 |
| --- | --- |
| `SHUYU_TRANSLATION_ENDPOINT` | 接收 `POST { text, source, target }` 并返回 `{ translation }` 的 HTTPS 代理地址 |
| `SHUYU_TRANSLATION_PROVIDER_NAME` | 设置页显示的服务名称，建议填 `Azure Translator → 腾讯云 TMT` |

仓库已经提供可选部署的 [Azure 主源、腾讯备用翻译网关](./translation-proxy/README.md)。翻译供应商 API 密钥必须只保存在网关环境变量中，不要添加到 Repository variables、`EXPO_PUBLIC_*` 或应用源码中。未配置代理时，构建仍会成功，App 默认由手机直连必应实验性兼容模式，并在失败时使用 MyMemory 兜底。

### Windows 生成 keystore

安装 JDK 17 后，在安全目录执行：

```powershell
keytool -genkeypair -v -storetype PKCS12 -keystore shuyu-release.jks -alias shuyu -keyalg RSA -keysize 2048 -validity 10000
```

根据提示设置密码，并妥善记录。然后把文件转换成 Base64 并复制到剪贴板：

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path '.\shuyu-release.jks'))) | Set-Clipboard
```

不要把 `.jks`、密码或 Base64 内容提交到 Git。建议至少保存两份离线备份；丢失签名密钥可能导致后续版本无法更新现有安装。
