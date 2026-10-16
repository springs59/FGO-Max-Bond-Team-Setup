# 2.1.1：模型单独更新与训练复现

本次仍在 `test/ai-2.1` 支线，不合入 main、不发布正式 Pages、不恢复全范围预计算。2.1.1 保留之前选定的 3、16–20、22、26、28；A1–A8 缓存改造继续暂存。

## 模型与方法

离线训练完成并保存到 [`research/ai-training-diverse`](https://github.com/springs59/FGO-Max-Bond-Team-Setup/tree/research/ai-training-diverse)。新标签页先读该分支 [`experiments/ai-diverse/REPRODUCE.md`](https://github.com/springs59/FGO-Max-Bond-Team-Setup/blob/research/ai-training-diverse/experiments/ai-diverse/REPRODUCE.md)。其中列出了数据来源、24 类合成条件、固定种子、独立教师工作树、Python/NumPy/Node 环境、16 维特征、两个独立 MLP 头、16/32/64 隐层、损失与优化器、标签制作、验证门槛、复现命令和新会话接续说明。

只发布模型、方法和汇总证据；训练/验证/封存标签、逐次原始测量文件均不上传。忽略规则防止生成数据进入正常 git 提交。摘要只用于核对本轮产物；并行写入顺序、CPU 超时、计时与数值库差异意味着重跑不保证字节一致。

本轮 16,800 条条件、24 类，10,510 个可行训练查询。32 单元模型验证排序最好，但三种模型均未通过含推理、候选核实与完整搜索的性能门槛：总耗时观测分别 +3.77%、+3.44%、+2.08%，置信区间均包含 1。因此模型保留为离线候选，不加入软件可用更新清单，也不宣称加速。封存测试没有用于调参或性能评估。

## 软件中的使用

页面底部展开“软件 2.1.1 · AI 模型更新”，点击“通过 GitHub 更新 AI”。只请求本仓库 `test/ai-2.1/ai/` 中的 JSON 清单与权重，不上传账号、库存或查询。该通道随测试支线保持；正式安装包更新通道保持现状。

流程为清单检查 → 软件与特征版本兼容检查 → 下载限额与 15 秒超时 → SHA-256/字节数 → 网络结构与有限值推理 → 单次原子本地保存 → 后续新查询使用。更新需要联网，已保存模型可离线复用。重启重新校验；断网、坏文件、持久化失败均保留当前可用模型，已保存模型损坏则回退内置模型。可用“恢复内置模型”清除下载模型。

只接受既有内置基线，或发布清单中声明已通过验证和封存测试的模型。清单声明是仓库发布资格记录，不是密码学上的性能证明；校验摘要用于完整性，信任边界仍为本仓库的维护权限。只解析 JSON 数值权重，不下载执行脚本。当前清单仅发布原有内置基线，因此检查更新不会偷偷启用未达标候选。

查询开始时捕获模型，运行中的精确搜索不中断。恢复/更新模型作用于后续新查询；已有精确结果缓存可以继续命中，因此模型更换不意味着每次都会重新搜索。静态模型随图鉴初始化发送到 Worker，模型更换后重新同步。模型只影响候选建议与遍历，合法性、结算、数学界限和完整搜索仍由精确算法负责。

## 发布与验证

根包版本 2.1.1；安装包默认版本 2.1.1，Android versionCode 21，保留 sequence 20 的 2.1.0 历史映射，后续递增版本。独立支线的 CI 生成可安装测试 APK、Windows EXE，不改变正式版 latest 更新源。测试 APK 使用本次构建的 debug 签名，不能保证覆盖正式版或其他构建的测试版；升级检查验证的是同一次构建中相同签名的版本对。

本次验证入口：`npm test`、`python3 scripts/test-native-version.py`、`node scripts/check-ai-update-ui.mjs`，以及既有界面/原生构建检查。模型更新测试覆盖下载来源、摘要/格式/特征/兼容版本、候选拒绝、断网和写入失败保留旧模型、重启、损坏回退、恢复内置、实际 Worker 模型传递、精确结果一致性、移动端布局。此版本不重跑三版本性能比较，不改变本轮“尚无稳定 AI 加速”结论。

## 本次已完成的验证记录

2026-10-16，源代码提交 `d83fe256f5fc379bebeef40b97ab8e3db447043a` 的[云端验证 38870814905](https://github.com/springs59/FGO-Max-Bond-Team-Setup/actions/runs/38870814905) 全部成功：完整回归、数据与曲线索引、浏览器模型更新与原有界面、Windows 安装/后台/升级、Android WebView/后台/暂停/渲染恢复/同签名升级检查。版本输出为 2.1.1，Android versionCode 21。

- [Windows EXE 构建产物](https://github.com/springs59/FGO-Max-Bond-Team-Setup/actions/runs/38870814905/artifacts/12033143857)
- [可安装 Android 测试 APK 构建产物](https://github.com/springs59/FGO-Max-Bond-Team-Setup/actions/runs/38870814905/artifacts/12033607085)
- [浏览器检查截图](https://github.com/springs59/FGO-Max-Bond-Team-Setup/actions/runs/38870814905/artifacts/12033202069)

构建产物保留期为 90 天，需要登录 GitHub 下载；未将测试版加入正式 latest 更新源。本地完整 `npm test` 与 8 项版本策略检查也通过。复现方法额外试跑了 72 条条件（每个拆分各 24 类）：无生成错误，封存拆分一个教师条件超过 5 秒，保留 timeout 状态且没有选择标签；未打开封存集的模型质量/性能评估。远端目录检查确认训练数据目录没有上传。
