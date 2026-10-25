"""Causal state transitions. No clocks, random draws, network calls, or I/O.

Two deliberate corrections to the draft are essential:
* remote credential use requires an executing foothold, not prior local admin;
* same/lower-tier credentials with different grants remain usable.
See RESEARCH_DECISIONS.md for the causal rationale and evidence boundaries.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import ceil

from .schema import Blocker, Campaign, Level, Plan, Scenario, ServiceFrame, TraceEntry
from .topology import Topology


@dataclass
class NodeState:
    level: Level = Level.clean
    has_edr: bool = False
    av_blocking: bool = False
    patched: bool = False
    evicted: bool = False


TECHNIQUES = {"R1": "T1566 / T1190 / T1078", "R2": "T1003", "R3": "T1078", "R4": "T1021", "R5": "T1199", "R6": "T1486"}
PRIVILEGED_TIERS = {"vendor", "service", "service_desk_admin", "administrator", "admin", "privileged", "domain_admin", "enterprise_admin"}
SERVER_KINDS = {"srv", "dc", "terminal_server", "server"}
DC_TIERS = {"domain_admin", "enterprise_admin"}


class Engine:
    def __init__(self, scenario: Scenario, plan: Plan | None = None, campaign: Campaign | None = None):
        self.original = scenario.model_copy(deep=True)
        self.scenario = scenario.model_copy(deep=True)
        self.plan = (plan or Plan()).model_copy(deep=True)
        self.campaign = (campaign or Campaign(campaign_id="interactive", events=[])).model_copy(deep=True)
        self.trace: list[TraceEntry] = []
        self.frames: list[ServiceFrame] = []
        self.creds: set[str] = set()
        self.privileges: set[str] = set()
        self.domains_held: set[str] = set()
        self.invalidated: set[str] = set()
        self.harvested_hosts: set[str] = set()
        self.corrupted_backups: set[str] = set()
        self.attempted_routes: set[str] = set()
        self.detours_used = 0
        self.removed_sessions: dict[str, set[str]] = {}
        self.offline_backups: set[str] = set()
        self.active_levers = {lever.id for lever in self.plan.levers}
        self.endpoint_plan_changes: set[str] = set()
        self.edr_plan_changes: set[str] = set()
        self.mfa_by_plan = "mfa_remote" in self.active_levers and not self.original.mfa_remote_access
        self.nodes = {n.id: n for n in self.scenario.nodes}
        self.accounts = {a.id: a for a in self.scenario.accounts}
        self.states = {n.id: NodeState(has_edr=n.host.endpoint_protection == "edr", av_blocking=n.host.endpoint_protection in {"av_block_commodity", "edr"}, patched=n.host.patch_state.get("remote_access") == "patched") for n in self.scenario.nodes}
        self._apply_host_levers()
        self.topology = Topology(self.scenario, self.plan)
        self._initialize_campaign()

    def _apply_host_levers(self) -> None:
        for lever in self.plan.levers:
            if lever.id not in self.scenario.levers:
                raise ValueError(f"unavailable lever: {lever.id}")
            if lever.id == "tier_admin_accounts":
                dcs = {h for domain in self.scenario.domains for h in domain.dcs}
                for account in self.scenario.accounts:
                    if account.tier in DC_TIERS:
                        removed = set(account.sessions_on) - dcs
                        self.removed_sessions[account.id] = removed
                        account.sessions_on = [h for h in account.sessions_on if h in dcs]
            if lever.id == "patch_gateway":
                for node in self.scenario.nodes:
                    if node.internet_exposed and "remote_access" in node.host.service_classes and not node.host.end_of_life:
                        self.states[node.id].patched = True
            if lever.id == "edr_servers":
                for node in self.scenario.nodes:
                    if node.kind in SERVER_KINDS and node.encryptable:
                        if not (self.states[node.id].has_edr or self.states[node.id].av_blocking):
                            self.endpoint_plan_changes.add(node.id)
                        if not self.states[node.id].has_edr:
                            self.edr_plan_changes.add(node.id)
                        self.states[node.id].has_edr = True
                        self.states[node.id].av_blocking = True
            if lever.id == "mfa_remote":
                self.scenario.mfa_remote_access = True
            if lever.id == "offline_backup":
                self.offline_backups.update(n.id for n in self.scenario.nodes if n.backup)

    def _initialize_campaign(self) -> None:
        ids = set(self.accounts)
        for key in self.campaign.initial_creds + self.campaign.initial_privileges:
            if key not in ids:
                raise ValueError(f"campaign names unknown initial account: {key}")
        if not set(self.campaign.initial_privileges) <= set(self.campaign.initial_creds):
            raise ValueError("initial privileges must also be possessed credentials")
        if not set(self.campaign.initial_domains) <= {d.id for d in self.scenario.domains}:
            raise ValueError("unknown initial domain")
        for host in self.campaign.initial_footholds:
            if host not in self.nodes:
                raise ValueError(f"unknown initial foothold: {host}")
            self.states[host].level = Level.footholded
        if not set(self.campaign.goal_hosts) <= set(self.nodes):
            raise ValueError("unknown campaign goal host")
        if not set(self.campaign.targeted_orgs) <= {n.org for n in self.scenario.nodes}:
            raise ValueError("unknown targeted org")
        for route in self.campaign.entry_routes:
            if route.target not in self.nodes or (route.credential and route.credential not in self.accounts):
                raise ValueError(f"invalid entry route: {route.id}")
            if route.mode == "trust" and (not route.source_domain or not route.target_domain):
                raise ValueError("trust entry route requires source and target domains")
            if route.mode == "trust" and self.nodes[route.target].domain != route.target_domain:
                raise ValueError("trust route target must belong to its target domain")
            if route.source_foothold is not None:
                source = self.nodes.get(route.source_foothold)
                if route.mode != "trust" or source is None or not source.external or source.domain != route.source_domain:
                    raise ValueError("alternate trust source must name an external host in its source domain")
        for event in self.campaign.events:
            if event.rule in {"R1", "R2", "R4"} and event.target is not None and event.target not in self.nodes:
                raise ValueError(f"unknown campaign event target: {event.target}")
        self.creds.update(self.campaign.initial_creds)
        self.privileges.update(self.campaign.initial_privileges)
        self.domains_held.update(self.campaign.initial_domains)

    def _log(self, t: str, rule: str, target: str | None, reason: str, *, before: Level | None = None, after: Level | None = None, blockers: list[Blocker] | None = None, changed: bool = True, source: str | None = None, account: str | None = None) -> bool:
        self.trace.append(TraceEntry(t=t, rule=rule, technique_label=TECHNIQUES.get(rule, rule), node=target, from_level=before.name if before is not None else None, to_level=after.name if after is not None else None, reason=reason, status="blocked" if blockers else "applied" if changed else "no_change", blockers=blockers or [], source=source, account=account))
        return changed and not blockers

    def _endpoint_blockers(self, host: str) -> list[Blocker]:
        state = self.states[host]
        if not (state.av_blocking or state.has_edr):
            return []
        edr_by_plan = host in self.endpoint_plan_changes
        return [Blocker(code="endpoint_protection", detail=f"endpoint protection blocks execution/harvest on {host}", levers=["edr_servers"] if edr_by_plan else [])]

    def initial_access(self, target: str, mode: str, t: str, credential: str | None = None) -> bool:
        node, state = self.nodes[target], self.states[target]
        before = state.level
        blockers = self._endpoint_blockers(target)
        if state.evicted:
            blockers.append(Blocker(code="evicted", detail="entry host was evicted and fenced"))
        if node.external or node.medical_device or node.host.os_family not in {"windows", "appliance"}:
            blockers.append(Blocker(code="ineligible_entry", detail="not an eligible execution endpoint"))
        if mode == "phishing":
            if not node.mail_client:
                blockers.append(Blocker(code="no_mail_client", detail="phishing requires a declared mail-using workstation"))
        elif mode == "edge":
            if not node.internet_exposed:
                blockers.append(Blocker(code="not_exposed", detail="edge access requires an internet-exposed host"))
            vulnerable = node.host.patch_state.get("remote_access") == "unpatched_critical"
            if not vulnerable or state.patched:
                changed_by_patch = state.patched and vulnerable and "patch_gateway" in self.active_levers
                blockers.append(Blocker(code="patched_edge", detail="no unpatched critical remote-access service", levers=["patch_gateway"] if changed_by_patch else []))
            # An unauthenticated exploit does not require credentials: MFA is
            # deliberately NOT credited for blocking this mode.
        elif mode == "credential":
            if not node.internet_exposed:
                blockers.append(Blocker(code="not_exposed", detail="remote login requires declared internet exposure"))
            if credential not in self.creds or credential in self.invalidated:
                blockers.append(Blocker(code="missing_credential", detail="remote entry needs a valid possessed credential"))
            elif not self.topology.authorized(self.accounts[credential], target, self.domains_held):
                blockers.append(Blocker(code="no_admin_right", detail="credential has no declared authority on entry host"))
            if self.scenario.mfa_remote_access:
                blockers.append(Blocker(code="mfa", detail="stolen credential alone cannot satisfy remote MFA", levers=["mfa_remote"] if self.mfa_by_plan else []))
        else:
            raise ValueError(f"unknown entry mode: {mode}")
        if blockers:
            return self._log(t, "R1", target, "initial-access preconditions failed", before=before, after=before, blockers=blockers, changed=False)
        state.level = max(state.level, Level.footholded)
        return self._log(t, "R1", target, f"declared {mode} entry established execution", before=before, after=state.level, changed=state.level != before, account=credential)

    def harvest(self, target: str, t: str) -> bool:
        state = self.states[target]
        before = state.level
        blockers = self._endpoint_blockers(target)
        if self.nodes[target].external or self.nodes[target].medical_device or self.nodes[target].host.os_family != "windows":
            blockers.append(Blocker(code="ineligible_harvest", detail="cached Windows account harvest does not apply to this profile"))
        if not Level.footholded <= before < Level.encrypted:
            blockers.append(Blocker(code="no_execution", detail="credential harvest requires active execution"))
        if state.evicted:
            blockers.append(Blocker(code="evicted", detail="credentials invalidated by eviction"))
        if blockers:
            return self._log(t, "R2", target, "credential-harvest preconditions failed", before=before, after=before, blockers=blockers, changed=False)
        found = {a.id for a in self.accounts.values() if target in a.sessions_on and a.id not in self.invalidated}
        new = found - self.creds
        self.creds.update(found)
        self.harvested_hosts.add(target)
        state.level = max(before, Level.cred_holder)
        removed = sorted(a for a, hosts in self.removed_sessions.items() if target in hosts)
        reason = f"cached credentials acquired: {', '.join(sorted(new)) or 'none'}"
        if removed:
            reason += f"; tier_admin_accounts removed cached sessions: {', '.join(removed)}"
        return self._log(t, "R2", target, reason, before=before, after=state.level, changed=bool(new) or state.level != before)

    def adopt_credentials(self, t: str) -> bool:
        candidates = sorted(a for a in self.creds - self.privileges - self.invalidated if self.accounts[a].admin_to)
        for account in candidates:
            self.privileges.add(account)
            self._log(t, "R3", None, "use an already-harvested account with distinct administrative grants", account=account)
        return bool(candidates)

    def execution_sources(self) -> list[str]:
        # A foothold can originate authenticated remote use without being a local
        # administrator. Requiring controlled here makes R1→R2→R3 deadlock.
        return sorted(h for h, s in self.states.items() if Level.footholded <= s.level < Level.encrypted and not s.evicted)

    def lateral(self, target: str, t: str) -> bool:
        node, state = self.nodes[target], self.states[target]
        before = state.level
        blockers: list[Blocker] = []
        if before >= Level.controlled:
            return self._log(t, "R4", target, "target already controlled or encrypted", before=before, after=before, changed=False)
        if state.evicted:
            blockers.append(Blocker(code="evicted", detail="target evicted and fenced"))
        if node.external or node.medical_device or node.host.os_family != "windows":
            blockers.append(Blocker(code="ineligible_target", detail="lateral administrative control models internal Windows IT hosts"))
        if target in self.offline_backups:
            blockers.append(Blocker(code="offline_backup", detail="backup store isolated from attack traffic", levers=["offline_backup"]))
        sources = self.execution_sources()
        grants = sorted(a for a in self.privileges - self.invalidated if self.topology.authorized(self.accounts[a], target, self.domains_held))
        if not grants:
            # Missing rights may follow an earlier removed session. A local rule
            # cannot establish that counterfactual; paired replay handles it.
            blockers.append(Blocker(code="no_admin_right", detail="no valid possessed account authorizes target"))
        reachable = [s for s in sources if self.topology.reach(s, target, "admin")]
        if not sources:
            blockers.append(Blocker(code="no_execution_source", detail="no active foothold can originate movement"))
        elif not reachable:
            for source in sources:
                blockers.extend(self.topology.reach_blockers(source, target, "admin"))
        if self.scenario.mfa_remote_access and "remote_access" in node.host.service_classes:
            blockers.append(Blocker(code="mfa", detail="remote-access authentication requires another factor", levers=["mfa_remote"] if self.mfa_by_plan else []))
        if blockers:
            return self._log(t, "R4", target, "movement requires network reachability AND valid identity", before=before, after=before, blockers=blockers, changed=False)
        state.level = Level.controlled
        return self._log(t, "R4", target, "reachable execution source and explicit administrative grant both hold", before=before, after=state.level, source=reachable[0], account=grants[0])

    def trust_hop(self, source_domain: str, target_domain: str, t: str) -> bool:
        domains = {d.id for d in self.scenario.domains}
        if source_domain not in domains or target_domain not in domains:
            raise ValueError("trust hop names an unknown domain")
        blockers: list[Blocker] = []
        if not self.topology.has_trust(source_domain, target_domain):
            lever = ["cut_hse_trust"] if (source_domain, target_domain) in self.topology.removed_trusts else []
            blockers.append(Blocker(code="no_trust", detail=f"no directed authority {source_domain} → {target_domain}", levers=lever))
        accounts = [self.accounts[a] for a in sorted(self.privileges - self.invalidated) if self.accounts[a].domain == source_domain and self.accounts[a].tier in PRIVILEGED_TIERS]
        # Trust does not mint credentials or expand wildcard '*' to another domain.
        targets = [n.id for n in self.scenario.nodes if n.domain == target_domain and n.host.domain_joined and any(self.topology.declared_grant(a, n.id) for a in accounts)]
        if not targets:
            blockers.append(Blocker(code="no_cross_domain_grant", detail="a possessed source-domain account needs an explicit target-domain entitlement"))
        if not any(self.topology.reach(source, host, "admin") for source in self.execution_sources() for host in targets):
            blockers.append(Blocker(code="unreachable_domain", detail="no executing source reaches an explicitly administrable target-domain host"))
        if blockers:
            return self._log(t, "R5", target_domain, "trust-hop preconditions failed", blockers=blockers, changed=False)
        changed = target_domain not in self.domains_held
        self.domains_held.add(target_domain)
        return self._log(t, "R5", target_domain, f"existing {source_domain} credentials may exercise declared cross-domain grants", changed=changed)

    def detonate(self, t: str) -> bool:
        changed = False
        for host in sorted(self.nodes):
            node, state = self.nodes[host], self.states[host]
            if state.level != Level.controlled or not node.encryptable:
                continue
            if state.has_edr:
                lever = ["edr_servers"] if host in self.edr_plan_changes else []
                self._log(t, "R6", host, "endpoint protection prevents detonation", before=state.level, after=state.level, blockers=[Blocker(code="edr", detail="EDR blocks encryption", levers=lever)], changed=False)
                continue
            state.level = Level.encrypted
            if node.backup and host not in self.offline_backups:
                self.corrupted_backups.add(host)
            changed = self._log(t, "R6", host, "campaign trigger encrypts controlled, unprotected IT host", before=Level.controlled, after=state.level) or changed
        return changed

    def evict(self, org: str, t: str) -> bool:
        hosts = sorted(n.id for n in self.scenario.nodes if n.org == org and not n.external)
        if not hosts:
            raise ValueError(f"unknown or external-only org to evict: {org}")
        org_domains = {self.nodes[h].domain for h in hosts if self.nodes[h].domain}
        domain_orgs = {domain: {n.org for n in self.scenario.nodes if n.domain == domain and not n.external} for domain in org_domains}
        if any(a.org is None and a.domain in org_domains and len(domain_orgs[a.domain]) > 1 for a in self.accounts.values()):
            raise ValueError("D1 account ownership is ambiguous in a shared domain; specify account.org")
        invalid = {a.id for a in self.accounts.values() if a.org == org or (a.org is None and a.domain in org_domains and domain_orgs[a.domain] == {org})}
        self.invalidated.update(invalid)
        self.creds.difference_update(invalid)
        self.privileges.difference_update(invalid)
        for host in hosts:
            state = self.states[host]
            before = state.level
            state.level, state.evicted = Level.clean, True
            self._log(t, "D1", host, "evicted, org credentials invalidated globally, inbound network fenced", before=before, after=state.level)
        self.topology.evict_org(org)
        return True

    def protect(self, org: str, t: str, coverage: float = 0.9) -> bool:
        if not 0 <= coverage <= 1:
            raise ValueError("coverage must be between zero and one")
        hosts = sorted(n.id for n in self.scenario.nodes if n.org == org and n.encryptable)
        if not hosts:
            raise ValueError(f"no eligible IT hosts in org: {org}")
        # Coverage is a deterministic cohort, not a probability of cure. Existing
        # encrypted hosts stay encrypted; D2 prevents future execution/encryption.
        covered = hosts[:ceil(len(hosts) * coverage)]
        for host in covered:
            self.states[host].has_edr = True
            self.states[host].av_blocking = True
            self.edr_plan_changes.discard(host)
            self.endpoint_plan_changes.discard(host)
        return self._log(t, "D2", org, f"EDR covers {len(covered)}/{len(hosts)} eligible hosts (requested coverage {coverage:g}); existing levels retained", changed=bool(covered))

    def disconnect(self, cut_links: list[tuple[str, str]], t: str) -> bool:
        self.topology.cut(cut_links)
        return self._log(t, "D3", None, f"explicit network cuts applied: {cut_links}", changed=bool(cut_links))

    def goals(self) -> set[str]:
        if self.campaign.goal_hosts:
            return set(self.campaign.goal_hosts)
        return {h for service in self.scenario.services for h in service.requires_all if self.nodes[h].encryptable} | {h for domain in self.scenario.domains for h in domain.dcs if self.nodes[h].encryptable}

    def next_target(self) -> str | None:
        unmet = {h for h in self.goals() if self.states[h].level < Level.controlled}
        if not unmet and not self.campaign.opportunistic:
            return None
        distances = self.topology.goal_distances(unmet, self.privileges - self.invalidated, self.domains_held)
        sources = self.execution_sources()
        candidates = [n.id for n in self.scenario.nodes if n.encryptable and not self.states[n.id].evicted and self.states[n.id].level < Level.controlled and n.id not in self.offline_backups and any(self.topology.reach(u, n.id, "admin") for u in sources) and any(self.topology.authorized(self.accounts[a], n.id, self.domains_held) for a in self.privileges - self.invalidated) and not (self.scenario.mfa_remote_access and "remote_access" in n.host.service_classes)]
        # Infinite-distance detours cannot lead to an unmet goal: don't perform
        # gratuitous encryption/spread simply because a flat graph permits it.
        if not self.campaign.opportunistic:
            candidates = [h for h in candidates if distances[h] < 10**9]
        return min(candidates, key=lambda h: (distances[h], self.nodes[h].domain or "", self.nodes[h].dept, h), default=None)

    def tick(self, t: str) -> bool:
        """Exactly one R2→R3→R4→R5 microstep, then clinical roll-up."""
        changed = False
        for host in self.execution_sources():
            if host not in self.harvested_hosts and not self._endpoint_blockers(host) and not self.nodes[host].external and not self.nodes[host].medical_device and self.nodes[host].host.os_family == "windows":
                changed = self.harvest(host, t) or changed
        changed = self.adopt_credentials(t) or changed
        target = self.next_target()
        if target is not None:
            changed = self.lateral(target, t) or changed
        for source in sorted({self.accounts[a].domain for a in self.privileges - self.invalidated}):
            for domain in sorted(d.id for d in self.scenario.domains if d.id != source and d.id not in self.domains_held):
                if self.topology.has_trust(source, domain):
                    # Only actionable hops fire during ticks; explicit historical
                    # R5 events still log every failed precondition.
                    accounts = [self.accounts[a] for a in self.privileges - self.invalidated if self.accounts[a].domain == source]
                    targets = [n.id for n in self.scenario.nodes if n.domain == domain and any(self.topology.declared_grant(a, n.id) for a in accounts)]
                    if any(self.topology.reach(u, v, "admin") for u in self.execution_sources() for v in targets):
                        changed = self.trust_hop(source, domain, t) or changed
        self.rollup(t)
        return changed

    def try_next_route(self, t: str) -> bool:
        """Attempt only declared alternative doors, at most the authored budget."""
        if self.detours_used >= self.campaign.detour_budget:
            return False
        for route in self.campaign.entry_routes:
            if route.id in self.attempted_routes:
                continue
            self.attempted_routes.add(route.id)
            self.detours_used += 1
            if route.mode == "trust":
                if route.source_foothold is not None:
                    state = self.states[route.source_foothold]
                    before = state.level
                    state.level = max(state.level, Level.footholded)
                    self._log(t, "context", route.source_foothold, f"activate declared prior external campaign context for alternate route {route.id}; no credentials created", before=before, after=state.level, changed=before != state.level)
                return self.trust_hop(route.source_domain, route.target_domain, t)  # validated in constructor
            return self.initial_access(route.target, route.mode, t, route.credential)
        return False

    def rollup(self, t: str) -> ServiceFrame:
        """Monotone dependency failure fixed point; clean cycles remain healthy."""
        causes: dict[str, set[str]] = {h: set() for h in self.nodes}
        internal = [n.id for n in self.scenario.nodes if not n.external and n.host.os_family == "windows"]
        for host, node in self.nodes.items():
            if self.states[host].level == Level.encrypted:
                causes[host].add(f"encrypted:{host}")
            # External services aren't encrypted by this local model. Loss of all
            # physical internal access makes them unavailable after a national cut.
            if node.external and internal and not any(self.topology.network_reach(u, host, "app") for u in internal):
                causes[host].add(f"disconnected:{host}")
            for dep in node.requires:
                if not self.topology.reach(host, dep.provider, dep.port_class):
                    causes[host].add(f"flow_cut:{host}->{dep.provider}:{dep.port_class}")
        for _ in range(len(self.nodes)):
            changed = False
            for host in sorted(self.nodes):
                inherited = set().union(*(causes[d.provider] for d in self.nodes[host].requires)) if self.nodes[host].requires else set()
                if not inherited <= causes[host]:
                    causes[host].update(inherited)
                    changed = True
            if not changed:
                break
        services, service_causes = {}, {}
        for service in self.scenario.services:
            failures = set().union(*(causes[h] for h in service.requires_all + service.consumers))
            services[service.name] = ("paper" if service.paper_fallback else "down") if failures else "up"
            service_causes[service.name] = sorted(failures)
        devices = {n.id: "dependency_outage" if causes[n.id] else "operational" for n in self.scenario.nodes if n.medical_device}
        frame = ServiceFrame(t=t, services=services, devices=devices, causes=service_causes)
        self.frames.append(frame)
        return frame
