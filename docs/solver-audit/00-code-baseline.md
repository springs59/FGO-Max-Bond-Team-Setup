# 00 Code Baseline

> **historical** 本文件已归档。现行验证状态见 `docs/CORRECTNESS_REPORT.md`。

- Date: 2026-09-20
- Commit: `bb3066f` `fix: keep IME composition and match reference solver`
- Branch: `main` (matches `origin/main` at audit start)
- Dirty: untracked `FGO_配队计算器_AI_Agent实施说明书.docx`, `FGO项目_AI_Agent_全项目审计与改进执行书.md` (not in git)

## npm test

`package.json` `test` runs:

bond, atlas, account, recommend, quest, filter, user-data, priority, game-data, solver, reference-solver, data-layer, farming, battle

This audit adds:

- `src/bond-oracle.test.js`
- `src/compare-plans.test.js`
 - `src/solver-audit.test.js` (1000 small random + UB gap + mutation)

## CI

Before this audit:

- `.github/workflows/pages.yml` deployed `index.html` + `src/` on push to `main` with no test gate
- `.github/workflows/snapshot-game-data.yml` runs `validate-data` + `npm test` only on the daily Atlas snapshot job

After this audit:

- `pages.yml` job `test` (`npm test` + `validate-data`) must pass before `deploy`
- `.github/workflows/ci.yml` runs the same gate on `push` / `pull_request`

## Truth layers

1. Independent Bond Oracle — `src/bond-oracle.js` (no import from `bond.js`)
2. Reference Solver — `src/reference-solver.js` (no prune / UB / memo / compression; still calls `assemblePlan` / `calcParty`)
3. Optimized Solver — `src/recommend.js` + `src/solver-pruner.js`

Production numeric truth remains `assemblePlan()` → `calcParty()` → `comparePlans()`.

## Online vs workspace

GitHub Pages deploys from `main`. After `bb3066f` the public site should match that commit once the Pages workflow finishes. Cache query is `src/app.js?v=ime1`.
