# Implemented research decisions

Authority: the user's current request and `claude_instructions/IMPLEMENTATION.md`.
The live product's spread engine is the TypeScript `packages/sim-core` (hard rule 3);
this `engine/sim_core` is a **separate, standalone causal backtest/validation tool**
(CLI `hippo-backtest`). It does not compute visible runs and is not wired into
SpacetimeDB or the browser; it exists to backtest a plan against the real campaign.

## Causality before calibration

`Scenario` holds inventory, rights, dependencies and available levers. `Campaign`
holds attacker knowledge, target intent, dated events and alternate doors. `Plan`
contains only listed levers. They are distinct strict Pydantic contracts.
`load_cuh` cannot read campaigns or ground truth; it rejects unknown inventory
fields rather than stripping embedded answers. BL's embedded `campaign` and
`expected` cannot pass through the planner boundary as a scenario.

Every inferred CUH domain assignment, functional port class, representative
workflow consumer and mail-client assignment is recorded as an [S] assumption.
No rule consults a hospital name, public service outcome, or calibration target.

## Two necessary repairs to the draft rules

**An executing foothold can originate credentialed movement.** The literal draft
requires a controlled source for R4, but R1 produces footholded, R2 cred_holder,
and R3 only an account flag. Nothing bootstraps controlled. Requiring local admin
also misstates remote credential use. R4 therefore accepts active footholded,
cred_holder or controlled sources. Administrative control of the target still
requires a usable account grant AND an allowed network path. This does not
silently promote an entry host to controlled.

**Credential usefulness is not a scalar hierarchy.** R3 makes all possessed
accounts with explicit administrative grants usable. Same-tier or lower-tier
accounts can confer distinct rights in another department/domain. Tier still
classifies privileged-account metrics; it does not erase useful grants. No R3
transition exploits anything or invents a credential.

R2 harvests only from eligible Windows IT profiles with active execution; the
external HSE/NHN anchor represents prior campaign context, not a Windows machine
whose memory can be harvested. Both original and plan-mutated inventories are
copied so replay never mutates a planner's snapshot.

## Reachability, identity and trust

`Topology.graph` is one namespaced `networkx.MultiDiGraph`. Host, account, domain
and service vertices cannot collide. Edges carry `network`, `identity`, `trust`
or `dependency` layers. `reach()` traverses network edges only. Identity and
dependency edges can never become physical shortcuts.

Zone policy is directed and checked on the original communicating endpoints,
before checking the physical path. Switches remain transit. Permitting rad→dc
imaging cannot accidentally permit rad→rt administration by routing via a dc
switch. Unlisted departments are isolated singleton zones. An allow-flow is a
functional port class, not a grant of administrative authority. Replies to a
permitted request are implicit; reverse initiation needs a reverse allow-flow.
The `unlisted:` zone namespace is reserved so an explicit name cannot silently
merge an omitted department into a permitted zone.

`*` is restricted to domain-joined hosts of the account's own domain.
`*@Y` requires a domain-joined Y host, an explicit cross-domain entitlement,
direct authority from the account's domain to Y, and a successful reachable R5
hop. Explicit named grants to non-domain hosts do not borrow domain membership.
Trust direction means principal domain → resource domain. Transitive trust is
not assumed. Trust never creates accounts, cached sessions, or wildcard grants.

The legacy lever name `cut_hse_trust` removes external↔internal domain authority
edges. Its implementation uses domain roles, not the string HSE. It does not cut
the clinical network connection; D3 is a separate operation.

## Adaptive attacker and authored time

One tick is R2 across active eligible sources, R3, one R4 candidate, then R5,
then the service roll-up. Goals are explicit campaign hosts, or service
`requires_all` IT hosts plus DCs. Candidate ordering is the total order
`(distance_to_goal, domain, dept, node_id)`.

The ranking projection contains cached-credential paths, administrative grants,
dependencies, and possible network pivots using already-usable rights. Without
pivot edges, an authorized jump host needed to cross two zone boundaries would
be wrongly pruned. Unfiltered physical connectivity would instead collapse all
distances on a flat network. Ranking is optimistic; it never authorizes a rule.
Infinite-distance candidates are not pursued solely because they are reachable.

`tick` events explicitly budget microsteps. Historical named-rule events apply
that rule only, without free ticks to make an outcome fit. An idle interval runs
no attacker rule; a date-only end includes the whole final day. On a day with
timed events, an ambiguous date-only event is rejected until its sub-day ordering
is authored. Same-time events require a distinct `order`. In particular, the
BL date-only R6 must not be silently sorted before its 01:30 exfiltration event.

Alternate entry routes are ordered, explicit campaign inputs and share an attempt
budget, including failed attempts. A trust alternative can activate a declared
already-compromised external source only when attempted. That context grants no
new credentials or rights. A vendor-named node is not automatically exposed or
compromised. Ordinary legal R5 actions remain available during ticks; route
attempts are needed to introduce additional external execution context.

The snapshot date records inventory provenance, not the replay origin. The
initial service frame is marked `pre_attack` at the first event's clock time.
Same-time microsteps retain array order; adapters must not deduplicate them.

## Service availability and defenses

Controlled is not encrypted. Services continue operating under control and fail
only on encrypted requirements or lost required connections. A monotone fixed
point propagates failures through arbitrary dependency chains. Healthy cycles
remain healthy; a failed member propagates through its cycle. Causes identify
encryption, disconnection or a consumer→provider functional-flow cut.

`requires_all` says which assets are necessary, not which pairs communicate.
Canonical node dependencies therefore include a provider and port class. A
service can additionally name required consumers. The CUH adapter explicitly
declares representative LINAC/scanner/analyzer consumers for server-only service
requirements; this is [S] workflow reconstruction. It does not derive a complete
mesh from `requires_all`. Clinical labels imaging/oncology are assigned explicitly
by the CUH adapter, because those labels do not exist in the raw host classes.

Medical-device identity overrides OS and kind. The supplied inventory includes
Windows medical devices and a `srv` pharmacy robot flagged medical. All remain
exempt from encryption; they may lose their dependencies. External SaaS/national
nodes also cannot be locally encrypted. If a national node loses all internal
physical access, its dependents fail even under a successful local defense.

D1 resets an organization and invalidates its credentials even if copied onto
another organization's host. Account ownership must be explicit for a shared
domain; an exclusive domain permits a disclosed unambiguous org inference.
Unrelated foreign credentials remain held. Inbound connectivity is fenced.
D2 covers `ceil(coverage × eligible hosts)` in sorted node-ID order. It prevents
later encryption/harvest; it is not restoration and does not lower encrypted
levels. A one-node aggregate cannot substantiate 90% real-host protection.
D3 accepts actual network links only, validates the full cut atomically, and
changes reachability/dependencies without undoing encryption.

Patch levers cannot repair EOL gateways. MFA blocks stolen-credential login;
unauthenticated edge exploitation is not credited as an MFA success. Tiering
removes Tier-0 sessions from non-DC hosts, not arbitrary existing rights. Server
EDR excludes medical devices. Offline backup changes attack access/corruption,
without inventing a recovery duration or changing live clinical dependencies.

## Counterfactuals and scoring

Local trace blockers identify the failing precondition, and name a lever only
when that local fact was actually changed by it. Missing credentials are not
automatically called a tiering success. `compare_plan` reruns the same campaign
under baseline, full plan, and each leave-one-lever-out plan. It attributes
avoided encryption to levers necessary in that plan's context. Redundant or
interacting defenses may have no individual necessity credit; this is not a
Shapley allocation. Matched event-index effect diagnostics expose earlier lost
credentials and later changed effects. They are time-local counterfactual
diagnostics, not proof that an already-completed effect was prevented forever.
Preexisting EDR/MFA receives no plan credit; a later independent historical EDR
deployment supersedes local EDR lever credit for the covered hosts.

Pre-attack service loss is exported separately. Initial paper/down states must
not be presented as an attack reduction. Every authored event has an index and
an outcome, including no-change events. Counts distinguish currently usable,
ever-used and ever-harvested privileged accounts; D1 does not erase history.

Only campaign-targeted organizations enter the score. Authored R5 targets remain
targeted even when the plan prevents the hop. Unknown predictions remain in the
labelled-target denominator and are reported. Untouched organizations are not
successful negatives. Organization encryption is a declared share threshold,
separate from host-level counts. `protocols.py` fixes the press/service aliasing,
neighboring-hospital exclusion, majority threshold and missing-cohort behavior.
Insufficient privileged-account inventory is reported, not supplemented from the
expected ≥33. Baselines intentionally discard identity and effective defenses:
one encrypts everything reached, and deterministic SIR uses beta=gamma=1 and
ever-infected as its prediction. Neither is an epidemiological estimate.

## Sensitivity and leakage

Only `generator.py` uses an RNG, locally seeded once per trial. It changes
workstation OS/EOL assignment and cached-session placement, preserving medical
flags, hardware, domain membership, rights and account tiers. Additional sampled
clinical allow-flows are optional; no wildcard/admin exception is synthesized.
The denominator is nonmedical Windows ws/cow/console nodes. The default 45–55%
range is a disclosed experimental choice over that cohort, not a measured CUH
estimate: the supplied 48/95 EOL count and 46/75 Windows-7 count have different
denominators. Session placement and OS shares need an independently justified
distribution before any probabilistic claim about real hospitals.

Robustness reports counts and shares of supplied seeds, not validated incident
probabilities. Freeze manifests hash code, generator, normalization, campaigns,
data and scoring protocol selected by the runner. A one-use atomic ledger claims
each hold-out before evaluation, consumes failed attempts, and detects changed
frozen content. Re-freezing under the same study ID does not reset the attempt.
This is an honesty guard, not tamperproof research infrastructure.

The supplied hold-out descriptions and some outcomes were inspected during
implementation. No incident hold-out evaluation was run. Any study using those
labels must declare prior exposure and run as exploratory. A genuine unseen
claim requires new held-out evidence and a committed freeze before inspection;
neither a manifest nor a passing invented-network test retroactively creates it.

## Evidence ledger and deliberate limits

| Input | Usable now | Missing or unidentifiable |
|---|---|---|
| CUH inventory | 95 nodes, 97 links, accounts, supplied rights/sessions, dependencies | Domain/flow/consumer assignments are explicit [S]; local intrusion timing/entry is not reported. The example campaign is [S]/[I], not ground truth. |
| National HSE | Organization labels, directed trust data, narrative posture and dated campaign | No host/account/session inventory. ≥33 credentials cannot emerge without a separate declared reconstruction. DoH survivor classification does not imply zero encrypted hosts. |
| British Library | Limited nodes, one account, services, broad campaign dates | No links/domains/sessions/profiles or account grants to DC/LMS/backup; no explicit initial credential boundary. Completing these from desired outcomes would leak labels. |

The national and BL adapters must report missing inputs instead of guessing.
The handoff does not require a weaker model to resolve these research questions.
It implements strict input/error plumbing and accepts separately authored causal
reconstructions when supplied. No rule tuning to make the provided hold-outs
pass, no mapping redacted letters to real hospitals, no real attack code, and no
patient injury or mortality computation belongs in this model.

## Adapter decisions (handoff implementation)

These adapters wrap the frozen core; none of them computes a transition. No rule,
threshold or mapping changed to make any hold-out pass.

**One canonical serialized form.** Every transport reproduces exactly
`ReplayResult.model_dump_json()` (`serialize.result_bytes`). Pydantic emits fields
in declared order and the core only lets a set reach output after `sorted()`, so
the bytes are stable within a process and across interpreters with different
`PYTHONHASHSEED`; a cross-transport + cross-process identity test proves it. The
HTTP body is returned as those exact bytes (a `Response`, not FastAPI's own
re-encoder) so it cannot drift from the CLI/cache bytes. `compare_plan` bundles
hold nested models, so `serialize.comparison_bytes` recurses into `model_dump` and
key-sorts; `json.dumps` on the raw bundle would raise.

**WebSocket streams the whole result.** The draft said "trace/frame records, then
summary", but that drops `levels`, `event_effects` and `cache_key`, so a client
could not rebuild the same `ReplayResult`. The stream therefore sends meta, every
trace entry, every service frame, every event effect, then a final message with
levels and summary — reassembly yields byte-identical JSON. The socket streams an
*already cached* result; POST `/replay` always caches, so the "cached stream is the
same result" property holds by construction.

**Cache.** Keyed only on `replay.fingerprint` (scenario+campaign+plan+rules
version), never scenario or plan alone, so a trace can never be served for another
campaign. Writes are temp-file + `os.replace`; reads validate the bytes as a whole
`ReplayResult` and check the stored key against the filename, so a truncated,
foreign or stale-schema file is a miss, not a corrupt replay. The complete result
is stored.

**CLI.** `hippo-backtest replay` prints only the result JSON to stdout; diagnostics and
validation errors go to stderr with a nonzero exit. It has no seed — replay is
deterministic — and seeds live only on the separate `sensitivity` command. A
canonical scenario is parsed by the strict models (which reject an embedded
`campaign`/`expected` as extra fields); the CUH inventory dialect is accepted only
through `load_cuh`, auto-detected by the absence of `scenario_id`.

**Planner boundary.** `planner.planner_scenario_payload` exposes only the canonical
scenario and `Plan.model_json_schema()` — never the campaign, ground truth, or a
campaign-derived key. `parse_scenario_upload` rejects (does not strip) any upload
carrying server-owned keys (`campaign`, `expected`, …); the real British Library
file, which embeds both, is refused here as well as by the strict loader.

**Research runner.** `research_runner` reads `calibration.yaml` and the CSVs and
reports each check `passed` / `failed` / `exploratory` / `unsupported` / `not_run`.
The national HSE and British Library checks (1, 2, 5, and the ≥33 privileged-account
count) are `unsupported` with the concrete `audit_raw_snapshot` gaps — never fitted.
The CUH checks (3 robustness, 4 press, 6 the national-cut limit) run against the
supplied reconstruction and are labelled `exploratory`, because their outcomes were
inspected. A service label is resolved only by an exact scenario match or a fixed
`protocols` alias; an unresolved label (e.g. calibration's `Radiology`) is reported,
never guessed. Robustness serializes every seed, the config, the disclosed
assumptions, the per-service shares and the trial keys.

**Freeze runner.** `freeze()` requires one workspace root, but code (`engine/`) and
data (`claude_instructions/data/`) are sibling trees, so the freeze is rooted at the
repository root and hashes both. The supplied CUH/BL cases are declared prior
exposure and run via `run_holdout_once(require_unseen=False)` with an explicitly
exploratory label and a one-use ledger. This is **not** a committed pre-inspection
freeze; a genuine unseen claim still needs a committed freeze and new held-out
evidence before any label is opened.

**Two additive core changes (documented here, not rule changes).** `robustness()`
now also returns the resolved `config` and the first trial's disclosed `assumptions`
(handoff item 6 asks for them "from robustness"); existing keys and tests are
unchanged. `audit_raw_snapshot()` now also advises that an embedded `expected`
block must be excluded — symmetric to its existing `campaign` advisory. Neither
touches any transition, and the hard rejection of both keys lives in the strict
models and the planner boundary.

**Console adapter.** `apps/web/lib/propagation/` mirrors `ReplayResult` in its own
types and maps level→colour (controlled→amber, encrypted→red), device
dependency_outage→violet, and service up/paper/down, keeping labels. It never
collapses the five-level state into the existing `infected`/`down` booleans, never
fabricates an event, and never ticks in the browser. The `/replay` route renders a
bundled, disclosed replay (real engine output); a live subscription adapter is left
as a marked placeholder until a backend exists. The demo session and its
`mockSession` are untouched.

