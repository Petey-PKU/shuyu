# 使用 GitHub 构建书中语 APK

项目以 GitHub Actions 作为主要 Android 构建方式。工作流位于 `.github/workflows/android-apk.yml`，可以手动运行，也会在推送 `v*` 标签时运行。

## 第一次：生成个人测试 APK

1. 在 GitHub 新建一个空仓库。项目计划开源时选择 **Public**；暂不公开时选择 **Private**。
2. 将本项目提交并推送到仓库。
3. 打开仓库的 **Actions** 页面。
4. 选择 **Build installable Android APK**，点击 **Run workflow**。
5. 构建完成后，在运行详情底部下载 `Shuzhongyu-APK`。
6. 解压后安装 `Shuzhongyu-v<版本号>-test.apk`。

测试 APK 使用测试密钥签名，可以直接安装，但不要把它作为正式版本公开分发。

## 正式分发前：配置永久签名

Android 后续版本必须继续使用同一个签名，否则无法覆盖安装。请先生成并离线备份唯一的 release keystore，然后在仓库 **Settings → Secrets and variables → Actions** 中创建以下 Repository secrets：

| Secret | 内容 |
| --- | --- |
| `SHUZHONGYU_ANDROID_KEYSTORE_BASE64` | release keystore 文件的 Base64 文本 |
| `SHUZHONGYU_ANDROID_KEYSTORE_PASSWORD` | keystore 密码 |
| `SHUZHONGYU_ANDROID_KEY_ALIAS` | 密钥别名 |
| `SHUZHONGYU_ANDROID_KEY_PASSWORD` | 密钥密码 |

四项齐全后，同一个工作流会自动生成 `Shuzhongyu-v<版本号>-release.apk`。缺少任意密码时构建会主动失败，避免产生签名状态不明确的安装包。

### Windows 生成 keystore

安装 JDK 17 后，在安全目录执行：

```powershell
keytool -genkeypair -v -storetype PKCS12 -keystore shuzhongyu-release.jks -alias shuzhongyu -keyalg RSA -keysize 2048 -validity 10000
```

根据提示设置密码，并妥善记录。然后把文件转换成 Base64 并复制到剪贴板：

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path '.\shuzhongyu-release.jks'))) | Set-Clipboard
```

不要把 `.jks`、密码或 Base64 内容提交到 Git。建议至少保存两份离线备份；丢失签名密钥可能导致后续版本无法更新现有安装。
