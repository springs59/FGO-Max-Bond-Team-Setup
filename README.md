# 2.1.2：用户选择 AI 与独立模型更新

2.1.2 将已验证的 2.1.1 求解路径并入 main。软件、网页版、Windows 和 Android 共用开关及模型协议。内置模型保持 `ai200-a14c70b2c570`，未采用未通过性能门槛的研究模型；没有上传训练数据集，也没有恢复大规模方案库预计算。

## 使用

页面下方“软件 2.1.2 · AI 辅助与模型更新”内勾选“使用 AI 辅助搜索”。首次打开默认关闭；显式选择保存在本机，重开后沿用。存储被禁用时，仅本次打开有效并显示提示。

关闭时不向推荐 Worker 发送权重，不执行神经网络推理。开启时模型只排序完整效果组、提出先经精算的可行起点，最终比较、数学上界和精确搜索仍由求解器负责；不按模型分数丢弃组合。保持求解器原有的等价代表方案及助战/位置覆盖边界，不声称枚举所有同分身份排列。开启不保证每个条件提速。

开关和完整权重身份参与精确结果缓存键。切换后独立计算；切回时可复用该状态已完成的结果。设置只影响下次新查询，正在计算的任务保持开始时的配置。模型下载、恢复内置模型或下载失败均不改变开关。

普通推荐不挂接逐候选日志或临时方案归档，不自动拟合方案库。按 2.1 的功能范围发布，保留有大小和条数限制的已完成结果缓存；这不等于浏览器完全不落盘。没有给精确搜索增加超时。下载模型的 15 秒超时只限制网络请求。

## 独立 GitHub 接口

模型分支：`ai-models`。与 main 软件发版分离，不需要重新打包 APK/EXE：

- 更新清单：<https://raw.githubusercontent.com/springs59/FGO-Max-Bond-Team-Setup/ai-models/manifest.json>
- 当前权重：<https://raw.githubusercontent.com/springs59/FGO-Max-Bond-Team-Setup/ai-models/baseline.json>
- 分支维护入口：<https://github.com/springs59/FGO-Max-Bond-Team-Setup/tree/ai-models>

清单 `format:1`、`featureVersion:1`，声明严格递增的 `sequence`、权重 `version`、兼容软件版本上下限、同目录 JSON 文件名、字节数及 SHA-256。当前网络文件为 7,155 字节，单个模型上限 256 KiB。更新请求只访问固定 GitHub 源，不接受外站地址或跳转。

内置基线必须与软件内置权重逐项一致。新模型必须声明 `qualification:"passed"` 以及 `validation.passed:true`、`validation.sealedTestPassed:true`；这些是维护者发布承诺，客户端不能代替完整离线性能验收。客户端同时校验实际摘要、大小、网络结构、特征顺序、数值和试推理。不兼容、未验收、损坏、超限或网络失败均保留旧模型。保存完整记录后才切换，重开验证失败则回退内置模型。

模型更新按钮由用户手动触发，不上传账号或训练样本。GitHub 不可达时仍可离线使用当前模型或关闭 AI。

## 维护与复刻

内置网络和特征：`src/solver/ai-model.js`、`src/solver/ai-search.js`。训练数据生成、标签、网络构建、训练命令和局限见 `docs/ai-200-hybrid.md` 及 `scripts/train-search-ai.mjs`。历史实验文档中的“独立分支、不合并”仅描述当时状态，以本说明为当前发布约定。

```sh
npm ci
npm test
python3 scripts/test-native-version.py
# 在任意小目录输出内置模型及清单，不输出训练集
node scripts/build-ai-update.mjs /tmp/ai-channel
node scripts/verify-ai-channel.mjs /tmp/ai-channel
```

发布新模型时先用隔离的训练/验证/封存测试条件完成正确性与性能验收，然后生成权重、摘要和清单；新模型版本号及 sequence 必须变化。将权重与清单作为同一个提交推送到 `ai-models`，保留 `.github/workflows/ai-model-channel.yml`。该工作流使用 main 的协议验证器检查摘要、兼容性、精确最优值和助战/位置等价覆盖。通过后用户在软件内点击更新；不会触发软件发版，也不会自动开启 AI。更新既有目录即可，不必重新训练来识别新礼装：求解器负责规则解析与精算，模型仅使用通用数值特征。

训练和离线评估需完整独立验收；在线通道的少量正确性回归不构成泛化或提速证明。更换不兼容的特征协议需先发布支持该协议的软件。

## 发布与验证边界

正式版本从 2.0.8 升级至 2.1.2；Android versionCode 按正式发布工作流第 19 次运行继续递增。先前 2.1.0/2.1.1 属于隔离测试版本，不占用正式发布序号。保留正式 2.0.0 至 2.0.8 的版本映射。

新增回归覆盖显式开关、无法保存时的会话选择、Worker 权重清除、相同条件开/关分数一致、不同权重与开关的缓存隔离；浏览器回归覆盖默认关闭、更新不启用、重开持久化、真实 Worker、损坏拒绝和移动端布局。原有求解回归、2.1 界面检查和两端安装升级流程继续执行。具体成功状态以该提交 GitHub Actions 为准。
