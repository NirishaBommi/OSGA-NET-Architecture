"""Run the paper's ablations + baselines sequentially and tabulate REAL results from metrics files.
  python ablation.py --splits data/splits.csv --root runs --epochs1 10 --epochs2 30
Each variant is trained with train.py then evaluated on --eval_split. Nothing is hard-coded."""
import argparse, json, os, subprocess, sys
VARIANTS = {
    "osga_full": [], "no_gat": ["--no_gat"], "no_film": ["--no_film"],
    "no_ordinal": ["--no_ordinal"], "no_landmark": ["--no_landmark"],
    "base_resnet18": ["--model", "resnet18"], "base_effnet_concat": ["--model", "effnet_concat"],
    "base_effnet_xattn": ["--model", "effnet_xattn"],
}
ap = argparse.ArgumentParser()
ap.add_argument("--splits", required=True); ap.add_argument("--root", default="runs")
ap.add_argument("--eval_split", default="val"); ap.add_argument("--only", nargs="*")
a, extra = ap.parse_known_args()
rows = []
for name, flags in VARIANTS.items():
    if a.only and name not in a.only: continue
    out = os.path.join(a.root, name)
    resume = ["--resume"] if os.path.exists(os.path.join(out, "last.pt")) else []
    subprocess.run([sys.executable, "train.py", "--splits", a.splits, "--out", out, *flags, *resume, *extra], check=True)
    subprocess.run([sys.executable, "evaluate.py", "--ckpt", f"{out}/best.pt", "--splits", a.splits, "--split", a.eval_split], check=True)
    m = json.load(open(f"{out}/metrics_{a.eval_split}.json"))["overall"]
    rows.append((name, m["mae"], m["rmse"], m["acc_12mo"]))
print("\nvariant               MAE(mo)  RMSE(mo)  Acc<=12mo(%)")
for r in rows: print(f"{r[0]:<20} {r[1]:8.2f} {r[2]:9.2f} {r[3]:12.1f}")
