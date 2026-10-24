"""Network paths, endpoint zone policy, and directed identity authority.

Switches are transit, not authentication principals. A rad→dc imaging exception
must not accidentally permit rad→rt admin traffic through a dc switch. Policy is
therefore checked on the original source/destination, then on the physical path.
"""

from __future__ import annotations

from collections import deque

import networkx as nx

from .schema import Account, Blocker, Plan, Scenario


class Topology:
    def __init__(self, scenario: Scenario, plan: Plan):
        self.scenario = scenario
        self.nodes = {n.id: n for n in scenario.nodes}
        self.plan = plan
        self.graph = nx.MultiDiGraph()
        self.cut_links: set[tuple[str, str]] = set()
        self.inbound_cuts: set[str] = set()
        self._paths: dict[tuple[str, str, str], bool] = {}
        self.zone_for: dict[str, str] = {}
        self.allow: set[tuple[str, str, str]] = set()
        self.segmented = False
        self.removed_trusts: set[tuple[str, str]] = set()
        for n in scenario.nodes:
            self.graph.add_node(("host", n.id), kind="host")
        for domain in scenario.domains:
            self.graph.add_node(("domain", domain.id), kind="domain")
        for account in scenario.accounts:
            principal = ("account", account.id)
            self.graph.add_node(principal, kind="account")
            self.graph.add_edge(principal, ("domain", account.domain), layer="identity", relation="member_of")
            for host in account.sessions_on:
                self.graph.add_edge(("host", host), principal, layer="identity", relation="cached_session")
            for host in scenario.nodes:
                if self.declared_grant(account, host.id):
                    self.graph.add_edge(principal, ("host", host.id), layer="identity", relation="admin_to")
        for link in scenario.links:
            self.graph.add_edge(("host", link.a), ("host", link.b), layer="network", port_classes=tuple(link.port_classes))
            if link.bidirectional:
                self.graph.add_edge(("host", link.b), ("host", link.a), layer="network", port_classes=tuple(link.port_classes))
        for trust in scenario.trusts:
            if trust.direction in {"bidirectional", "a_to_b"}:
                self.graph.add_edge(("domain", trust.a), ("domain", trust.b), layer="trust")
            if trust.direction in {"bidirectional", "b_to_a"}:
                self.graph.add_edge(("domain", trust.b), ("domain", trust.a), layer="trust")
        for node in scenario.nodes:
            for dep in node.requires:
                self.graph.add_edge(("host", node.id), ("host", dep.provider), layer="dependency", port_class=dep.port_class)
        for service in scenario.services:
            sid = ("service", service.name)
            self.graph.add_node(sid, kind="service")
            for host in service.requires_all + service.consumers:
                self.graph.add_edge(sid, ("host", host), layer="dependency")
        self._apply_policy()

    def _apply_policy(self) -> None:
        departments = {n.dept for n in self.scenario.nodes}
        classes = {"*", "admin", "remote_access", "file_share", "remote_desktop", "directory", "app", "vendor"}
        classes.update(dep.port_class for n in self.scenario.nodes for dep in n.requires)
        classes.update(c for n in self.scenario.nodes for c in n.host.service_classes)
        for lever in self.plan.levers:
            if lever.id not in self.scenario.levers:
                raise ValueError(f"lever {lever.id} is not available in this scenario")
            if lever.id == "segment_departments":
                self.segmented = True
                for zone, members in lever.zones.items():
                    if not zone or not members or not set(members) <= departments:
                        raise ValueError(f"invalid zone {zone}: unknown or empty department list")
                    for dept in members:
                        self.zone_for[dept] = zone
                # Unlisted departments remain singleton zones, never a shared bypass.
                # Prefixing also prevents collision with an explicitly named zone.
                for dept in departments:
                    self.zone_for.setdefault(dept, f"unlisted:{dept}")
                zones = set(self.zone_for.values())
                for src, dst, cls in lever.allow:
                    if src not in zones or dst not in zones or cls not in classes:
                        raise ValueError(f"unknown zone or port class in allow-flow {(src, dst, cls)}")
                    self.allow.add((src, dst, cls))
            if lever.id == "cut_hse_trust":
                external = {d.id for d in self.scenario.domains if d.external}
                for u, v, key, edge in list(self.graph.edges(keys=True, data=True)):
                    if edge.get("layer") == "trust" and ((u[1] in external) != (v[1] in external)):
                        self.removed_trusts.add((u[1], v[1]))
                        self.graph.remove_edge(u, v, key)

    def zone_allows(self, u: str, v: str, port_class: str) -> bool:
        if not self.segmented:
            return True
        a, b = self.zone_for[self.nodes[u].dept], self.zone_for[self.nodes[v].dept]
        return a == b or (a, b, port_class) in self.allow or (a, b, "*") in self.allow

    def network_reach(self, u: str, v: str, port_class: str) -> bool:
        """Physical/logical network only; no identity or clinical edges allowed."""
        if u not in self.nodes or v not in self.nodes:
            return False
        if u == v:
            return True
        if v in self.inbound_cuts and self.nodes[u].org != self.nodes[v].org:
            return False
        key = (u, v, port_class)
        if key not in self._paths:
            seen, queue = {u}, deque([u])
            found = False
            while queue and not found:
                current = queue.popleft()
                for _, target, edge in self.graph.out_edges(("host", current), data=True):
                    if edge.get("layer") != "network":
                        continue
                    nxt = target[1]
                    if (current, nxt) in self.cut_links:
                        continue
                    if nxt in self.inbound_cuts and self.nodes[current].org != self.nodes[nxt].org:
                        continue
                    if "*" not in edge["port_classes"] and port_class not in edge["port_classes"]:
                        continue
                    if nxt == v:
                        found = True
                        break
                    if nxt not in seen:
                        seen.add(nxt)
                        queue.append(nxt)
            self._paths[key] = found
        return self._paths[key]

    def reach(self, u: str, v: str, port_class: str = "admin") -> bool:
        return self.zone_allows(u, v, port_class) and self.network_reach(u, v, port_class)

    def reach_blockers(self, u: str, v: str, port_class: str = "admin") -> list[Blocker]:
        result = []
        if not self.zone_allows(u, v, port_class):
            result.append(Blocker(code="zone_wall", detail=f"{u} → {v} denied for {port_class}", levers=["segment_departments"]))
        if not self.network_reach(u, v, port_class):
            result.append(Blocker(code="network_path", detail=f"no uncut {port_class} path from {u} to {v}"))
        return result

    def cut(self, links: list[tuple[str, str]]) -> None:
        pending = set()
        for a, b in links:
            if a not in self.nodes or b not in self.nodes:
                raise ValueError(f"unknown cut endpoint: {a}, {b}")
            edges = list(self.graph.get_edge_data(("host", a), ("host", b), default={}).values()) + list(self.graph.get_edge_data(("host", b), ("host", a), default={}).values())
            if not any(edge.get("layer") == "network" for edge in edges):
                raise ValueError(f"cut must name a network link: {a}, {b}")
            pending.update({(a, b), (b, a)})
        self.cut_links.update(pending)
        self._paths.clear()

    def evict_org(self, org: str) -> None:
        self.inbound_cuts.update(n.id for n in self.scenario.nodes if n.org == org)
        self._paths.clear()

    def has_trust(self, source: str, target: str) -> bool:
        # Direct trust only. Do not silently assume transitivity for AD trusts.
        return any(edge.get("layer") == "trust" for edge in self.graph.get_edge_data(("domain", source), ("domain", target), default={}).values())

    def declared_grant(self, account: Account, host: str) -> bool:
        """Static entitlement; cross-domain authority is checked separately."""
        node = self.nodes[host]
        if host in account.admin_to:
            return True
        if not node.host.domain_joined:
            return False
        return (account.domain == node.domain and "*" in account.admin_to) or f"*@{node.domain}" in account.admin_to

    def authorized(self, account: Account, host: str, domains_held: set[str]) -> bool:
        node = self.nodes[host]
        if not self.declared_grant(account, host):
            return False
        # Explicit local/non-domain grants need no trust. A foreign domain grant does.
        if not node.host.domain_joined or node.domain == account.domain:
            return True
        return node.domain in domains_held and self.has_trust(account.domain, node.domain)

    def goal_distances(self, goals: set[str], usable_accounts: set[str] | None = None, domains_held: set[str] | None = None) -> dict[str, int]:
        """Optimistic identity/dependency distance, used ONLY to rank legal actions.

        An unrestricted network projection makes every host distance one on a flat
        network and erases credential detours. Instead model host→cached account→
        administrable host, plus dependencies and network pivots allowed by
        currently usable grants. Actual movement still checks both predicates.
        """
        heuristic = nx.DiGraph()
        heuristic.add_nodes_from(self.graph.nodes)
        for u, v, edge in self.graph.edges(data=True):
            if edge.get("layer") in {"identity", "dependency"}:
                heuristic.add_edge(u, v)
        accounts = [a for a in self.scenario.accounts if a.id in (usable_accounts or set())]
        targets = [n.id for n in self.scenario.nodes if n.encryptable and any(self.authorized(a, n.id, domains_held or set()) for a in accounts)]
        for source in self.nodes:
            for target in targets:
                if source != target and self.reach(source, target, "admin"):
                    heuristic.add_edge(("host", source), ("host", target))
        distances: dict[tuple[str, str], int] = {}
        reverse = heuristic.reverse(copy=False)
        for goal in sorted(goals):
            for vertex, distance in nx.single_source_shortest_path_length(reverse, ("host", goal)).items():
                distances[vertex] = min(distance, distances.get(vertex, distance))
        return {host: distances.get(("host", host), 10**9) for host in self.nodes}
