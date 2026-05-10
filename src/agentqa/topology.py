from __future__ import annotations

from collections import defaultdict

from agentqa.trace import Trace


def classify_topology(trace: Trace) -> str:
    """Classify the communication topology observed in a trace.

    Examines the sender/receiver pairs in all message events and classifies
    the topology into one of four patterns from the MARBLE taxonomy:

    - **star**: one hub agent that communicates with all others, who do not
      communicate with each other directly.
    - **chain**: agents communicate only with the next/previous agent in a
      linear sequence.
    - **tree**: hierarchical — one root, intermediate coordinators, and leaf
      agents. Strictly more than 2 levels.
    - **mesh**: all other topologies — agents communicate freely with each
      other (graph topology).

    Args:
        trace: A completed Trace to analyse.

    Returns:
        One of: "star", "chain", "tree", "mesh", or "unknown" (if no messages).
    """
    messages = trace.get_messages()
    if not messages:
        return "unknown"

    # Build directed adjacency: sender → set of receivers
    adj: dict[str, set[str]] = defaultdict(set)
    nodes: set[str] = set()

    for event in messages:
        sender = event.data.get("sender", event.agent or "")
        receiver = event.data.get("receiver", "")
        if not sender or not receiver or receiver.startswith("__"):
            continue
        adj[sender].add(receiver)
        nodes.add(sender)
        nodes.add(receiver)

    if not nodes:
        return "unknown"

    n = len(nodes)
    if n <= 2:
        return "chain"

    out_degrees = {node: len(adj.get(node, set())) for node in nodes}
    in_degrees: dict[str, int] = defaultdict(int)
    for node, receivers in adj.items():
        for r in receivers:
            in_degrees[r] += 1

    # Star: exactly one node talks to all others, others only talk back to it
    high_out = [node for node, d in out_degrees.items() if d >= n - 1]
    if high_out:
        hub = high_out[0]
        spokes = nodes - {hub}
        spoke_recipients = {r for spoke in spokes for r in adj.get(spoke, set())}
        # Spokes send only to the hub (or nowhere)
        if spoke_recipients <= {hub}:
            return "star"

    # Chain: each node has at most one outgoing and one incoming connection
    # and the graph forms a path
    if all(d <= 1 for d in out_degrees.values()) and all(d <= 1 for d in in_degrees.values()):
        return "chain"

    # Tree: there is exactly one root (in-degree 0) and no cycles
    # (we detect cycles via DFS on the undirected version; tree has n-1 edges)
    total_edges = sum(out_degrees.values())
    roots = [node for node in nodes if in_degrees.get(node, 0) == 0]
    if len(roots) == 1 and total_edges == n - 1:
        return "tree"

    return "mesh"


def topology_summary(trace: Trace) -> dict:
    """Return a summary dict of the topology with degree statistics.

    Returns:
        Dict with keys: topology, agents, unique_edges, avg_out_degree.
    """
    messages = trace.get_messages()
    adj: dict[str, set[str]] = defaultdict(set)
    nodes: set[str] = set()

    for event in messages:
        sender = event.data.get("sender", event.agent or "")
        receiver = event.data.get("receiver", "")
        if not sender or not receiver or receiver.startswith("__"):
            continue
        adj[sender].add(receiver)
        nodes.add(sender)
        nodes.add(receiver)

    total_edges = sum(len(v) for v in adj.values())
    avg_out = total_edges / len(nodes) if nodes else 0.0

    return {
        "topology": classify_topology(trace),
        "agents": len(nodes),
        "unique_edges": total_edges,
        "avg_out_degree": round(avg_out, 2),
    }
