# 根据当前条件提出接近最优配置：离线条件化 AI v2

本支线为 `research/ai-conditioned-config`，来自训练方法提交 `60f7ec0a0e05735ee638d6f42b6c4da6792d7c45`。只发布模型、方法和汇总报告；训练数据、修复标签和逐次验收记录保留在忽略目录中，不上传。软件仍为 `test/ai-2.1` 中的 2.1.1，本轮不改默认模型、不改 main/Pages、不恢复预计算。

## 搜索时间限制

软件库存与通用精确搜索原本没有按时长自动停止，本轮取消的是教师标签生成、离线验收和三版本基准脚本中的默认 5 秒/15 秒搜索截止时间。现在默认 `timeoutMs=0` 表示不限时，等待完成、明确错误或用户手动停止；保留显式设置环境变量作为单独诊断选项。下载、浏览器启动、模拟战斗回合数和平台作业限制不属于精确搜索时限，不混作搜索终止条件。

此前 3 个超时条件已由 `repair-ai-teacher-labels.mjs` 无截止时间地重算，并与独立原始 2.0.0 对照通过；两个训练条件可用于标签，一个旧封存条件只补齐教师标签，不作新模型训练或质量评估。训练与验证的待完成标签为 0。长任务用心跳和已完成记录观察进度，不以超时冒充不可行或最优。

## 模型做什么

旧模型使用 16 维单个候选汇总特征，主要输出独立排序偏好。v2 使用 75 维查询和已选前缀特征，逐类预测礼装数量 0–6：

1. 表达当前库存、形态与 COST、满羁绊状态、本人/全队活动加成、助战位置、必选成员、前后排/固定位置、空位和最低自有成员数。
2. 同时观察已选组合的效果、剩余容量与 COST、同类库存、特性覆盖重叠、其他效果组的竞争，以及从者在当前条件下的可负担性。
3. 每一步按容量、库存和必须预留的最低从者 COST 屏蔽不可能的数量，使用条件化概率保留多条组合路径。
4. 用模型排名靠前的完整礼装数量组合调用原来的身份/形态/COST/位置/光环 DP，补全并核实从者、礼装和站位，返回分数最高的合法完整队伍。可额外尝试零自有礼装组合，避免候选都不可行时没有结果。

这是 **神经网络提出组合 + 精确约束补全** 的混合方法，不是单次神经网络直接输出全部成员，也没有在候选路径中执行全礼装域完整搜索。候选得分独立重算，候选证书固定 `complete:false, approximate:true`；不能冒充已证明全局最优。完整原求解器仍可不限时运行，用于教师和最终证明。

每个网络为 `75 → H(ReLU) → H/2(ReLU) → 7 logits`，H=64/128，对合法数量做 softmax。训练目标为精确教师选中数量的交叉熵，每个查询的各步骤权重归一；标准化只拟合训练集，折叠进导出首层。Adam、batch=512、初始学习率 0.0015、每 epoch ×0.985、β=(0.9,0.999)、ε=1e-8、权重梯度附加 0.00002×权重、梯度截断 [-5,5]。最多 100 epoch，验证损失连续 15 epoch 无 1e-5 改善即停止。种子分别 87264/87328。按验证交叉熵选择 H=128；模型质量以完整配置验收为准，不以单步分类准确率代替。

## 数据范围与限制

使用上一轮冻结的公开 CN/JP 目录和合成条件，训练 8,512 个可行库存查询、37,678 个条件化步骤；验证 1,688 个可行库存查询、7,564 个步骤。来源集合仍是训练 12,000/验证 2,400 个条件，不可行不产生选中标签。20 类库存场景包含小/中/大/全目录、紧 COST、重复持有/满破、形态、活动自体/全队加成、满羁绊光环、锁位/空位、无助战/六自有、舍入和特性重叠。

**四类通用求解场景（通用特殊锁定、冠位、指定目标活动、系统 NPC）没有训练这个数量策略**，验证中 400 个、独立验收中 200 个按不适用单列；软件依然使用原精确路径，不将这些计入 AI 成功率。目录很大的库存也主要只有 3–7 种礼装目录，不能据此声称覆盖礼装规模无上限或未来全部活动规则。

原始输入种子：训练 12000000、验证 22000000，均加查询索引。独立资格集在模型、beam=128、top=32 确定后生成，种子 42000000，1,200 个条件；不参与训练或调参。旧 32000000 封存集没有用于本轮模型训练或质量验收。原始标签的完整输入去重检查见上轮完整性报告。

## 复现

Linux/Ubuntu、Python 3.12、NumPy 2.3.5、Node 24。先固定本支线的提交，记录 `git rev-parse HEAD`。数据目录被 git 忽略；新机器需要重新生成标签，不需要下载私人账号文件。

```sh
git clone --branch research/ai-conditioned-config https://github.com/springs59/FGO-Max-Bond-Team-Setup.git fgo-training
cd fgo-training
git rev-parse HEAD
git worktree add --detach ../teacher-200 native-v2.0.0
python3 -m venv .venv
.venv/bin/python -m pip install -r experiments/ai-conditioned/requirements.txt
npm ci
export FGO_AI_TEACHER_BASELINE="$(realpath ../teacher-200)"
# 默认不限时；不要继承旧会话中的 5000ms 诊断变量。
unset FGO_LABEL_TIMEOUT_MS FGO_EVAL_TIMEOUT_MS FGO_BENCH_TIMEOUT_MS
node scripts/build-ai-diverse-data.mjs
node scripts/repair-ai-teacher-labels.mjs
node scripts/build-conditioned-data.mjs
OPENBLAS_NUM_THREADS=2 OMP_NUM_THREADS=2 .venv/bin/python scripts/train-conditioned-config.py
FGO_CONFIG_EVAL_QUERIES=2400 FGO_CONFIG_BEAM=128 FGO_CONFIG_TOP=32 node scripts/evaluate-conditioned-config.mjs
# 只有同一模型的质量验证通过才会允许打开新资格集。
FGO_CONFIG_SPLIT=qualification FGO_OPEN_CONFIG_QUALIFICATION=1 FGO_CONFIG_EVAL_QUERIES=1200 FGO_CONFIG_BEAM=128 FGO_CONFIG_TOP=32 FGO_CONFIG_COMPARE_BASELINE=1 node scripts/evaluate-conditioned-config.mjs
node scripts/conditioned-config.test.mjs
```

各阶段会覆盖同名本地产物；需要比较旧结果时先备份。生成默认 4 个教师 Worker，每个 768 MiB 老生代上限，资源不足可设置 `FGO_LABEL_WORKERS=1`。不限制运行时长不代表内存无限。硬件、数值库、并发完成顺序和历史超时会影响字节摘要与计时，不承诺跨平台权重逐字节相同。

验收每个查询串行做模型提案、候选补全和独立评分/COST/库存/身份/形态/位置核验，再对照完整精确搜索。新旧模型对照采用同一合法性屏蔽、同一 beam=128、最多 32 个候选和相同补全流程。很多小域的全部数量组合不足 32 个，报告单列完整覆盖和只检查部分组合的条件，避免将完整枚举收益误称为神经网络能力。

逐次记录采用同步写入与 fsync，汇总前校验条数和唯一索引。初次验收日志持久化不完整，初始汇总保留并标为不能用于最终结论；最终独立验收重新运行，不改变模型或参数。耗时只作观察，本轮不是设备或三版本性能基准，不用它证明提速。

## 接续任务

新标签页可以直接发送：

> 继续 springs59/FGO-Max-Bond-Team-Setup 的 research/ai-conditioned-config 支线。先读 experiments/ai-conditioned/README.md、RESULTS.md 和 reports。不要上传数据集；模型 v2 已训练并完成不限时教师补齐与独立资格验收。它用条件化网络选择礼装组合，再通过精确 DP 补全整队；20 类库存规则适用，四类通用特殊规则尚未接入。先复核质量和极端样本，继续扩展规则表达与降低推理/补全开销。产品仍是 2.1.1，A1–A8 缓存想法暂存；达到产品性能门槛之前不要替换默认模型或并入 main。
