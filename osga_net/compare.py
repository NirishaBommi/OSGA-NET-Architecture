"""Paired bootstrap between two prediction CSVs (same cases):  python compare.py runs/a/preds_test.csv runs/b/preds_test.csv"""
import sys, json, pandas as pd, numpy as np
from osga import metrics
a, b = pd.read_csv(sys.argv[1]).set_index("id"), pd.read_csv(sys.argv[2]).set_index("id")
ids = a.index.intersection(b.index)
ea, eb = (a.loc[ids].true - a.loc[ids].pred).abs(), (b.loc[ids].true - b.loc[ids].pred).abs()
print(json.dumps({"n": len(ids), "mae_a": float(ea.mean()), "mae_b": float(eb.mean()), **metrics.paired_bootstrap(ea, eb)}, indent=2))
