from swarm.selector import TopologyRegistry


def test_topology_registry_contains_required_templates():
    names = set(TopologyRegistry.names())

    assert {"serial_chain", "parallel_fusion", "supervisor_tree", "high_risk_review"} <= names
    assert TopologyRegistry.get("serial_chain").edges == [
        ("TaskRouter", "Monitor"),
        ("Monitor", "Schedule"),
        ("Schedule", "Constraint"),
        ("Constraint", "Report"),
    ]
    assert ["Diagnosis", "Order", "Resource"] in TopologyRegistry.get("parallel_fusion").parallel_groups


def test_topology_templates_are_acyclic():
    for template in TopologyRegistry.all().values():
        assert template.topological_order()[0] == "TaskRouter"
        assert len(template.topological_order()) == len(template.nodes)
