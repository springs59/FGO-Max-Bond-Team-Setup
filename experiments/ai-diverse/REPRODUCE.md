# 新标签页复现入口

本目录只发布候选模型、方法和汇总证据，不发布训练集、验证集、封存标签或逐次测量文件。候选尚未通过加速门槛，不要替换软件默认模型。实验源代码基于 `cb2fd451bc234c2a6904c8a91f85454d0375de35`，完整实验保存在 `research/ai-training-diverse` 分支。

## 从干净目录开始

以下在 Linux/Ubuntu、Python 3.12、Node 24 下执行。先检出该实验分支并记录当前提交，之后的复现固定使用这个提交，避免目录自动更新改变输入。

```sh
git clone --branch research/ai-training-diverse https://github.com/springs59/FGO-Max-Bond-Team-Setup.git fgo-training
cd fgo-training
git rev-parse HEAD
git worktree add --detach ../teacher-200 native-v2.0.0
python3 -m venv .venv
.venv/bin/python -m pip install -r experiments/ai-diverse/requirements.txt
npm ci
export FGO_AI_TEACHER_BASELINE="$(realpath ../teacher-200)"
node scripts/build-ai-diverse-data.mjs
.venv/bin/python scripts/verify-ai-diverse-data.py
OPENBLAS_NUM_THREADS=2 OMP_NUM_THREADS=2 .venv/bin/python scripts/train-ai-diverse.py
node scripts/evaluate-ai-diverse.mjs
FGO_EVAL_MODEL=experiments/ai-diverse/models/candidate-16.json node scripts/evaluate-ai-diverse.mjs
FGO_EVAL_MODEL=experiments/ai-diverse/models/candidate-64.json node scripts/evaluate-ai-diverse.mjs
node src/solver/ai-search.test.js
```

生成器会写入本地被 git 忽略的 `experiments/ai-diverse/data/`；重跑会覆盖本地同名数据、模型和报告。先备份需要比较的本地实验。不要把不同规模的试跑报告混作正式结果。数据生成默认 4 个 Worker，各自最多 768 MiB V8 老生代，建议至少 8 GiB 可用内存；资源不足时设置 `FGO_LABEL_WORKERS=1`。5 秒教师时限会受 CPU、负载影响；失败与超时必须保留，不能当最优标签。

## 数据制作与监督目标

- `scripts/ai-diverse-cases.mjs`：24 类规则，公开 CN/JP 冻结目录和合成库存，种子为 train=12000000、validation=22000000、test=32000000 加查询索引。完整条件生成逻辑在代码中，不依赖私人账号文件。
- `scripts/build-ai-diverse-data.mjs`、`ai-diverse-worker.mjs`：默认生成 12000/2400/2400 个条件，教师关闭 AI。每个拆分前 240 条与独立原始 2.0.0 库存路径或未插桩通用求解路径核对。只对已完成且可行的条件生成选择标签。
- 从者监督目标：一个最优解中是否选择，合并相同特征正例。礼装监督目标：效果组选中份数/可用容量。每条查询的标签权重归一，减少大库存查询对训练的支配。
- `verify-ai-diverse-data.py`：校验 gzip、条数、索引、摘要和跨拆分完整输入重复；只读取封存标签作完整性检查，不评估模型质量。

先小规模验证环境可设置 `FGO_TRAIN_QUERIES=240 FGO_VALIDATION_QUERIES=240 FGO_TEST_QUERIES=240`。正式生成前取消这些变量。计时、并行写入顺序与超时不确定，因此不承诺压缩文件或权重逐字节复现。生成器记录本次摘要，训练重新校验本次文件，不能强行沿用历史摘要。

## 网络构建与训练

`src/solver/ai-search.js` 定义 16 维输入的顺序、缩放和推理；`scripts/train-ai-diverse.py` 完整实现训练。模型包含礼装、从者两个独立 MLP 头：每头 `16 → H(tanh) → 1(sigmoid)`，H 分别为 16、32、64，参数量每头 `18H+1`，合计 `36H+2`。没有 embedding 或注意力层。

输入按训练集均值和标准差标准化（标准差下限 0.1），导出时将标准化折叠进首层，推理无需额外标准化。初始化使用 NumPy `default_rng`；礼装/从者种子分别为 `63000+H`、`63001+H`。训练为查询平衡 soft BCE、Adam β=(0.9,0.999)、ε=1e-8、batch=512、初始学习率 0.003、每 epoch ×0.98；权重梯度附加 0.00005×权重并截断到 [-5,5]。最多 120 epoch，验证损失连续 18 epoch 未改善即停止；最小改善 1e-5，保留验证最优权重。`FGO_TRAIN_EPOCHS` 可调整上限。

按两头验证 BCE 之和选模。模型输出只是候选偏好，真实合法性、羁绊、COST 和完整精确搜索由求解器负责；预测分数不能作为剪枝上界或返回答案。

## 验收与继续工作的规则

先看 `RESULTS.md`、`reports/training.json` 和三个 `validation-solver-gate-*.json`。本轮 32 单元验证损失最好，但三个候选均未通过性能门槛；不能宣称 AI 已加速，也不要为了展示结果打开封存测试。

验收：相同 240 个验证条件、3 轮交替开/关、无结果缓存；总耗时包含推理、候选核实与完整搜索。要求精确分数/COST 一致、无未完成项、可行条件总中位耗时至少减少 10%、bootstrap 95% 上界 <1、库存建议可行率 ≥95%、达到最优分数率 ≥60%、各类别 P95 退步不超过 5%。这些是本次工程初筛门槛。验证通过后才允许 `FGO_EVAL_SPLIT=test FGO_OPEN_SEALED_TEST=1 node scripts/evaluate-ai-diverse.mjs`，再做设备与三版本对比。

可以给新标签页直接发送：

> 继续 springs59/FGO-Max-Bond-Team-Setup 的离线 AI 实验。检出 research/ai-training-diverse，先读 experiments/ai-diverse/REPRODUCE.md、README.md、RESULTS.md 和报告。不要上传数据集，不要合入 main；缓存 A1–A8 暂存。候选 16/32/64 已训练，但未通过加速验收。先复核已有成果，再改进队伍相互作用/约束表达与候选生成。只有离线门槛和封存测试通过后，才考虑产品接入与 2.0.0/2.0.9/2.1 对比。
