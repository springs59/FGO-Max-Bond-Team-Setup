# Battle Spec

The battle planner is a structured strategy template. It is not a full FGO combat AI.

## What it does

- Walks waves and emits skill / NP actions
- Default target is the first living enemy
- Falls back when NP is not ready
- Scores farming plans with `theoreticalClear`, `failRate`, turns, and bond

## What the simulator omits

Break Bar, Buff/Debuff, Defense, Invincible, Evade, Sure Hit, Invul Pierce, NP Gain, Card / Card Chain, OC, Buff Removal, Cleanse, Stun, Charm, Skill Seal, NP Seal, Enemy AI, Master Skill, Order Change, Special Resist, Death / Revive, complex targeting, Trait Damage.

## Claims

`failRate = 0` means: current simplified model + current sample produced no failure.

`theoreticalClear` means: one static (non-random card/target) path cleared in this model.

UI copy must not say the team is guaranteed to clear in game.
