# Formation conditions and anonymous activity effects

The formation review is built by scripts/formation-curves/build-review.mjs from
the authoritative packed review plus its scene/meta catalog. It does not expose
a quest selector. Templates describe physical seats, mandatory roles, ownership
limits, support conditions and Grand slots. Special support catalogs remain
distinct when their fixed equipment or qualification backgrounds differ.

formation-effects.js validates joint own/helper/front counts and derives the
minimum own front seats needed to cover mandatory roles. The role DP chooses at
most one form per identity and accounts for already satisfied guest roles and
guest-specific banned identities. Special own counts also respect the actual
number of allowed identities. A role constraint does not introduce a fixed party
into the anonymous effect generator.

Activity profiles are mutually exclusive tuples of self, campaign and party
bonuses with independently constrained own/helper counts. Every recipient keeps
the joint CE hit vector and activity profile. Capped recipients consume member
counts and may provide party bonuses, but do not receive self gains. Helper party
provision follows its applicability flag. Only permutations of identical joint
vectors in the same front/back band are removed. Duplicate activity definitions
share a canonical display key.

When mandatory front roles add a feasibility constraint, the CE frontier is
recomputed with that constraint before dominance pruning. Filtering a frontier
computed without the roles could lose a valid capped front carrier or retain
an unavailable rear reward slot. Literal tests exercise this interaction.

For the envelope, all-hit CE configurations remain sufficient by pointwise
dominance even after independent additive activity effects. Activity assignments
are enumerated exactly. The worker builds an exact residue envelope, retains its
ever-winning functions, and rebuilds the same envelope for display; the complete
streaming generator separately exposes partial CE hits and non-optimal activity
assignments. Graph sampling only renders curves.

The three tabs share one state. Invalid conditions clear previous curves; async
responses are guarded and cancellation terminates the worker. Activity editing
does not name servants. The optional actual-data verification reprojects selected
identities and remaps supports before solving, independent of custom anonymous
activity count hypotheses. Long interval lists are nested closed details.

Run formation-effects.test.js and scripts/formation-curves/check-review-ui.mjs.
The latter runs the entire deliverable with real workers in a DOM fixture,
including automatic activity mixes, a selected identity, capacity restrictions,
paging and cancellation. It is not browser visual QA.
