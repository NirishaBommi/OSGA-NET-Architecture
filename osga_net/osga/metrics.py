from __future__ import annotations
import json
import numpy as np
import pandas as pd


def basic(y, p):
    ae = np.abs(np.asarray(y) - np.asarray(p))
    if len(ae) == 0:
        return {"n": 0}
    return {"n": int(len(ae)), "mae": float(ae.mean()), "rmse": float(np.sqrt((ae ** 2).mean())),
            "acc_6mo": float((ae <= 6).mean() * 100), "acc_12mo": float((ae <= 12).mean() * 100)}


def stratified(df: pd.DataFrame):
    """df columns: true, pred, male. Bands follow the paper: female <=11y vs >11y, male <=13y vs >13y."""
    out = {}
    for name, m in (("female", df.male == 0), ("male", df.male == 1)):
        out[name] = basic(df.true[m], df.pred[m])
    cut = np.where(df.male == 1, 156, 132)
    out["younger_band"] = basic(df.true[df.true <= cut], df.pred[df.true <= cut])
    out["older_band"] = basic(df.true[df.true > cut], df.pred[df.true > cut])
    return out


def calibration(df: pd.DataFrame, bins=5):
    """Pearson r between predicted std and |error| + a reliability table (needs df.std > 0)."""
    ae = np.abs(df.true - df.pred).to_numpy()
    s = df["std"].to_numpy()
    if len(ae) < 5 or np.allclose(s, 0) or np.std(s) == 0:
        return {"pearson_std_vs_abs_err": None, "reliability": []}
    r = float(np.corrcoef(s, ae)[0, 1])
    q = pd.qcut(pd.Series(s), min(bins, len(s)), duplicates="drop", labels=False)
    rel = [{"bin": int(b), "mean_std": float(s[q == b].mean()), "mean_abs_err": float(ae[q == b].mean()),
            "n": int((q == b).sum())} for b in sorted(q.unique())]
    return {"pearson_std_vs_abs_err": r, "reliability": rel}


def bootstrap_ci(values, n=1000, seed=0, alpha=0.05):
    v = np.asarray(values, float)
    rng = np.random.default_rng(seed)
    means = np.array([v[rng.integers(0, len(v), len(v))].mean() for _ in range(n)])
    return float(v.mean()), float(np.quantile(means, alpha / 2)), float(np.quantile(means, 1 - alpha / 2))


def paired_bootstrap(ae_a, ae_b, n=1000, seed=0):
    """Difference in MAE (a - b) on the SAME cases; negative favours model a."""
    d = np.asarray(ae_a, float) - np.asarray(ae_b, float)
    rng = np.random.default_rng(seed)
    means = np.array([d[rng.integers(0, len(d), len(d))].mean() for _ in range(n)])
    lo, hi = np.quantile(means, [0.025, 0.975])
    return {"mean_diff": float(d.mean()), "ci95": [float(lo), float(hi)], "significant": bool(lo > 0 or hi < 0)}


def full_report(df: pd.DataFrame):
    rep = {"overall": basic(df.true, df.pred), "stratified": stratified(df), "calibration": calibration(df)}
    m, lo, hi = bootstrap_ci(np.abs(df.true - df.pred))
    rep["overall"].update(mae_ci95=[lo, hi])
    return rep


def save_json(obj, path):
    with open(path, "w") as f:
        json.dump(obj, f, indent=2)
