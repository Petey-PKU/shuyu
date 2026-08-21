# 参与贡献

感谢你帮助改进书中语（Shuzhongyu）。

1. Fork 项目并从 `main` 创建功能分支。
2. 保持功能小而清晰，不提交版权不明的书籍文件、密钥或构建产物。
3. 提交前运行 `npm run typecheck`、`npm test` 和 `npm run export:android`。
4. Pull Request 请说明用户价值、主要改动、验证方式；视觉改动请附 Android 手机尺寸截图。

## 测试数据与密钥

- 可公开的小型合成测试文件放入 `tests/fixtures/public/`，并注明来源或生成方式。
- 私人电子书、真实阅读记录和非公开数据只放入 `local-test-data/`；该目录内容默认不被 Git 跟踪。
- 本地 APK/AAB 放入 `local-builds/`，不要提交到源码仓库。
- 本地配置使用 `.env.local`；只提交不含真实值的 `.env.example`。
- Android keystore、证书、密码和第三方 API Secret 不得提交。移动端的 `EXPO_PUBLIC_*` 变量不是秘密存储。
- 提交前检查 `git status` 和 `git diff --cached --name-only`，确认没有私人或版权不明的文件。

优先方向：更稳健的 EPUB 兼容、离线词典、可替换翻译供应商、无障碍、真实 Android/iOS 设备测试。
