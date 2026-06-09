from swarm.optimizer.edge_optimizer.candidate_graph_store import CandidateGraph, CandidateGraphStore


def test_candidate_graph_store_keeps_top_k_and_round_trips(tmp_path):
    store = CandidateGraphStore(top_k=2)
    store.add(CandidateGraph("g1", ["A"], [["A", "B"]], 1.0, "task"))
    store.add(CandidateGraph("g2", ["A"], [["A", "C"]], 3.0, "task"))
    store.add(CandidateGraph("g3", ["A"], [["A", "D"]], 2.0, "task"))
    path = tmp_path / "graphs.json"
    store.save(str(path))

    loaded = CandidateGraphStore.load(str(path), top_k=2)

    assert [graph.graph_id for graph in loaded.top()] == ["g2", "g3"]
