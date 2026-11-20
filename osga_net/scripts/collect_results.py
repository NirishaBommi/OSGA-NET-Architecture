"""Collect REAL results from your own training runs and (optionally) fill the paper's tables.

  python scripts/collect_results.py --root runs --split val
  python scripts/collect_results.py --root runs --split test --docx OSGA-Net_paper.docx --out_docx OSGA-Net_paper_filled.docx

Nothing is hard-coded: every number is read from runs/<variant>/metrics_<split>.json written by evaluate.py.
A variant that has not been trained/evaluated stays "TBD" - the script never invents or interpolates a value.
Writes results/results.json (read by the web app's Results tab) and results/tables.md.
"""
import argparse, json, os, sys

# paper row label  ->  run directory created by ablation.py
TABLE_V = [("Full OSGA-Net", "osga_full"), ("− GAT", "no_gat"), ("− FiLM", "no_film"),
           ("− Ordinal head", "no_ordinal"), ("− Landmark head", "no_landmark")]
BASELINES = [("ResNet-18 (image only)", "base_resnet18"), ("EffNetV2-S + concatenation", "base_effnet_concat"),
             ("EffNetV2-S + cross-attention", "base_effnet_xattn")]


def load(root, name, split):
    p = os.path.join(root, name, f"metrics_{split}.json")
    if not os.path.exists(p):
        return None
    return json.load(open(p))


def row(rep):
    if rep is None:
        return None
    o = rep["overall"]; s = rep.get("stratified", {}); c = rep.get("calibration", {})
    return {"mae": o["mae"], "rmse": o["rmse"], "acc6": o["acc_6mo"], "acc12": o["acc_12mo"], "n": o["n"],
            "ci95": o.get("mae_ci95"), "female_mae": s.get("female", {}).get("mae"), "male_mae": s.get("male", {}).get("mae"),
            "younger_mae": s.get("younger_band", {}).get("mae"), "older_mae": s.get("older_band", {}).get("mae"),
            "calib_r": c.get("pearson_std_vs_abs_err"), "reliability": c.get("reliability", [])}


def collect(root, split):
    res = {"split": split, "ablation": {}, "baselines": {}}
    for label, d in TABLE_V:
        res["ablation"][label] = row(load(root, d, split))
    for label, d in BASELINES:
        res["baselines"][label] = row(load(root, d, split))
    res["complete"] = all(v is not None for v in res["ablation"].values())
    return res


def fmt(x, nd=2):
    return "TBD" if x is None else f"{x:.{nd}f}"


def markdown(res):
    L = [f"### Table V - ablation (MAE in months, {res['split']} split)", "", "| Configuration | MAE (mo.) | 95% CI | RMSE | Acc≤12 mo (%) |", "|---|---|---|---|---|"]
    for k, v in res["ablation"].items():
        ci = "TBD" if not v or not v["ci95"] else f"[{v['ci95'][0]:.2f}, {v['ci95'][1]:.2f}]"
        L.append(f"| {k} | {fmt(v and v['mae'])} | {ci} | {fmt(v and v['rmse'])} | {fmt(v and v['acc12'], 1)} |")
    L += ["", "### Controlled baselines re-implemented in this repo", "", "| Model | MAE (mo.) | RMSE | Acc≤12 mo (%) |", "|---|---|---|---|"]
    for k, v in res["baselines"].items():
        L.append(f"| {k} | {fmt(v and v['mae'])} | {fmt(v and v['rmse'])} | {fmt(v and v['acc12'], 1)} |")
    return "\n".join(L) + "\n"


def fill_docx(src, dst, res):
    from docx import Document
    d = Document(src)
    n = 0

    def put(cell, text):
        p = cell.paragraphs[0]
        if p.runs:
            p.runs[0].text = text
            for r in p.runs[1:]:
                r.text = ""
        else:
            p.add_run(text)

    for t in d.tables:
        head = t.rows[0].cells[0].text.strip()
        if head == "Configuration":                                    # Table V
            for r in t.rows[1:]:
                label = r.cells[0].text.strip()
                for k, v in res["ablation"].items():
                    if label.replace("−", "-").startswith(k.replace("−", "-")) and v:
                        put(r.cells[1], f"{v['mae']:.2f}"); n += 1
        if head == "Method":                                           # Table IV: only the OSGA-Net row
            full = res["ablation"].get("Full OSGA-Net")
            for r in t.rows[1:]:
                if "OSGA-Net" in r.cells[0].text and full:
                    put(r.cells[2], f"{full['mae']:.2f}"); n += 1
    d.save(dst)
    return n


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="runs"); ap.add_argument("--split", default="val", choices=["val", "test"])
    ap.add_argument("--docx"); ap.add_argument("--out_docx"); ap.add_argument("--results_dir", default="results")
    a = ap.parse_args()
    res = collect(a.root, a.split)
    os.makedirs(a.results_dir, exist_ok=True)
    json.dump(res, open(os.path.join(a.results_dir, "results.json"), "w"), indent=2)
    md = markdown(res); open(os.path.join(a.results_dir, "tables.md"), "w").write(md); print(md)
    if a.docx:
        out = a.out_docx or a.docx.replace(".docx", "_filled.docx")
        print(f"filled {fill_docx(a.docx, out, res)} cells ->", out)
    if not res["complete"]:
        print("NOTE: some ablation rows are still TBD - train/evaluate those variants (ablation.py).", file=sys.stderr)
