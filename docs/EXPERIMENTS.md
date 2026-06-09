# Experiments and Selector Training

## Selector Dataset

The selector dataset is JSONL. Each row contains:

```json
{
  "features": {
    "task_type": "high_risk_composite_incident",
    "risk_level": "critical",
    "machine_alert_count": 1,
    "urgent_order_count": 1,
    "resource_conflict_count": 2,
    "inventory_shortage_count": 1,
    "worker_conflict_count": 0,
    "requires_parallel_analysis": true,
    "requires_critic_review": true
  },
  "rewards": {
    "serial_chain": -1.0,
    "parallel_fusion": 2.0,
    "supervisor_tree": 3.0,
    "high_risk_review": 6.0
  },
  "label": "high_risk_review"
}
```

## Commands

```powershell
C:\Anaconda\python.exe scripts/generate_selector_dataset.py
C:\Anaconda\python.exe scripts/train_graph_selector.py
C:\Anaconda\python.exe scripts/evaluate_selector.py
```

The local trainer uses scikit-learn RandomForestClassifier and stores `data/selector_model.joblib`. ModelArts LoRA training is represented by an adapter and mock job submission when real ModelArts credentials are absent.

## A2C Top-K Graph Optimization

The original GPTSwarm REINFORCE optimizer remains in `swarm/optimizer/edge_optimizer/optimization.py`. The industrial extension adds `A2CEdgeOptimizer`, `CriticNetwork`, `CandidateGraphStore`, and `A2CExperimentRunner`.

Run:

```powershell
C:\Anaconda\python.exe scripts/run_a2c_experiment.py
C:\Anaconda\python.exe scripts/export_topk_graphs.py
```

Candidate graphs are saved as:

```json
{
  "graph_id": "high_risk_review-1",
  "nodes": [],
  "edges": [],
  "score": 0.0,
  "task_type": "high_risk_composite_incident",
  "metadata": {}
}
```

## Comparison Report

`scripts/run_local_demo.py` writes a compact comparison report to:

- `reports/experiments/results.csv`
- `reports/experiments/summary.json`
- `reports/experiments/figures/README.md`

Compared systems include Single Agent, Fixed Serial, Fixed Parallel, GPTSwarm REINFORCE, Dynamic without ReflAct, and Proposed.
