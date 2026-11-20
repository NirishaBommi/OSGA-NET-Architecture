"""OSGA-Net web front-end (research prototype).

  python app/gradio_app.py --ckpt runs/osga_full/best.pt          # full app
  python app/gradio_app.py --demo_results_only                     # results/tables tabs without a checkpoint

Tabs: 1) Assess  - upload radiograph + sex -> bone age, 95% interval, uncertainty, review flag, region overlay
      2) Results - Tables IV/V filled from YOUR runs (results/results.json written by scripts/collect_results.py)
      3) Method  - architecture and honest-scope notes
"""
import argparse, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import numpy as np
import pandas as pd
import gradio as gr

DISCLAIMER = ("Research prototype - NOT a medical device and not validated for clinical use. "
              "Any estimate must be reviewed by a qualified radiologist.")

# Published numbers, copied from Table IV of the paper (each from its cited source). Not produced by this code.
LITERATURE = [("BoNet (Spampinato et al.)", 2017, 9.60), ("ResNet-50 (Larson et al.)", 2018, 6.24),
              ("Two-stage network (Chu et al.)", 2018, 5.98), ("Cascaded critical-region CNN (Liu et al.)", 2023, 5.45),
              ("YOLOv5 + Swin (Mao et al.)", 2023, 4.59), ("EffNetV2-S concat. (Kim et al.)", 2024, 4.92),
              ("Two-stream global-local (Lou et al.)", 2025, 3.81)]

# ---- look & feel: deep-teal "light-box" gradient + faint hand-radiograph line art, glass cards ----
HAND_SVG = ("<svg xmlns='http://www.w3.org/2000/svg' width='520' height='640' viewBox='0 0 520 640' fill='none' "
            "stroke='%23ffffff' stroke-opacity='0.07' stroke-width='3' stroke-linecap='round'>"
            "<path d='M260 620V430M200 430V250M260 430V200M320 430V240M370 430V310M150 430L90 330'/>"
            "<g stroke-width='2'><circle cx='200' cy='240' r='10'/><circle cx='260' cy='190' r='10'/>"
            "<circle cx='320' cy='230' r='10'/><circle cx='370' cy='300' r='10'/><circle cx='88' cy='322' r='10'/>"
            "<circle cx='200' cy='330' r='8'/><circle cx='260' cy='320' r='8'/><circle cx='320' cy='335' r='8'/>"
            "<rect x='205' y='440' width='110' height='70' rx='30'/><circle cx='230' cy='590' r='18'/>"
            "<circle cx='290' cy='590' r='18'/></g></svg>")
CSS = """
:root { --ink:#0b1f2a; --teal:#0f766e; --mint:#5eead4; --paper:rgba(255,255,255,.94); }
.gradio-container { background:
   url("data:image/svg+xml;utf8,%s") no-repeat right 4%% bottom 0 / 38vw,
   radial-gradient(1200px 600px at 12%% -10%%, #134e4a 0%%, transparent 60%%),
   linear-gradient(160deg, #06141b 0%%, #0b2a35 55%%, #0f3d3e 100%%) fixed !important; max-width: 1180px !important; }
#hero h1 { color:#ecfeff; font-size:1.9rem; margin:.2rem 0 0; letter-spacing:-.01em; }
#hero p  { color:#a5f3fc; margin:.2rem 0 1rem; }
#warn { background:#3b2a05; color:#fde68a; border:1px solid #92400e; border-radius:10px; padding:.55rem .9rem; font-size:.9rem; }
.gradio-container .block { background: var(--paper) !important; border-radius: 14px !important; }
.block:has(#hero) { background: transparent !important; border: none !important; box-shadow: none !important; }
[role=tablist] button { color:#cffafe !important; font-weight:600; }
[role=tablist] button.selected { color:#5eead4 !important; border-color:#5eead4 !important; }
body { background:#06141b !important; }
#result-md { border-left:5px solid var(--teal); padding-left:1rem; }
footer { opacity:.5 }
""" % HAND_SVG.replace("<", "%3C").replace(">", "%3E").replace("#", "%23").replace('"', "'")


def fmt(m): return f"{int(m) // 12} y {int(m) % 12} m"


def load_results(path):
    if os.path.exists(path):
        return json.load(open(path))
    return None


def table_v(res):
    labels = ["Full OSGA-Net", "− GAT", "− FiLM", "− Ordinal head", "− Landmark head"]
    rows = []
    for k in labels:
        v = (res or {}).get("ablation", {}).get(k)
        ci = "TBD" if not v or not v.get("ci95") else f"[{v['ci95'][0]:.2f}, {v['ci95'][1]:.2f}]"
        rows.append({"Configuration": k, "MAE (mo.)": "TBD" if not v else round(v["mae"], 2), "95% CI": ci,
                     "RMSE (mo.)": "TBD" if not v else round(v["rmse"], 2),
                     "Acc ≤12 mo (%)": "TBD" if not v else round(v["acc12"], 1)})
    return pd.DataFrame(rows)


def table_iv(res):
    full = (res or {}).get("ablation", {}).get("Full OSGA-Net")
    rows = [{"Method": m, "Year": y, "MAE (mo.)": v, "Source": "published"} for m, y, v in LITERATURE]
    rows.append({"Method": "Proposed OSGA-Net", "Year": "-", "MAE (mo.)": "TBD" if not full else round(full["mae"], 2),
                 "Source": "this work (" + (res or {}).get("split", "?") + " split)" if full else "pending training"})
    return pd.DataFrame(rows)


def strata_table(res):
    full = (res or {}).get("ablation", {}).get("Full OSGA-Net")
    if not full:
        return pd.DataFrame({"Subgroup": ["Female", "Male", "Younger band", "Older band"], "MAE (mo.)": ["TBD"] * 4})
    return pd.DataFrame({"Subgroup": ["Female", "Male", "Younger band (F≤11y, M≤13y)", "Older band"],
                         "MAE (mo.)": [round(full[k], 2) if full[k] is not None else "TBD"
                                       for k in ("female_mae", "male_mae", "younger_mae", "older_mae")]})


def build(pred, results_path):
    def run(image, sex, chron_years):
        if pred is None:
            raise gr.Error("No checkpoint loaded. Start the app with --ckpt runs/osga_full/best.pt")
        if image is None:
            raise gr.Error("Upload a hand radiograph (PNG/JPG).")
        chron = None if chron_years in (None, "") else float(chron_years) * 12
        r = pred.predict(np.asarray(image), sex == "Male", chron)
        lo, hi = r.get("interval95_months", (None, None))
        md = f"### Estimated bone age: **{r['bone_age']}**  ({r['bone_age_months']:.0f} months)\n"
        if lo is not None:
            md += f"- 95% interval: **{fmt(lo)} – {fmt(hi)}**  ·  uncertainty σ = {r['uncertainty_std_months']:.1f} months\n"
        if r["needs_review"] is True:
            md += "- ⚠️ **High uncertainty - manual review recommended.**\n"
        elif r["needs_review"] is False:
            md += "- ✅ Uncertainty within the calibrated operating range.\n"
        else:
            md += "- (review flag unavailable: run `evaluate.py --split val` to calibrate)\n"
        dist = {}
        if "distribution" in r:
            p = np.array(r["distribution"]); idx = np.argsort(p)[::-1][:8]
            dist = {f"{int(i) + 1} mo": float(p[i]) for i in idx}
        nodes = pd.DataFrame(sorted(r.get("node_weights", {}).items(), key=lambda kv: -kv[1]),
                             columns=["Region", "Graph-attention weight"]) if r.get("node_weights") else None
        return md, r["overlay"], dist, nodes

    def refresh():
        res = load_results(results_path)
        t5, t4 = table_v(res), table_iv(res)
        status = ("✅ Showing real results from your runs (" + res["split"] + " split)." if res and res.get("complete") else
                  "ℹ️ Some rows are **TBD**: train + evaluate the variants (`python ablation.py ...`) then run "
                  "`python scripts/collect_results.py`. No value is ever filled in automatically.")
        plot = t5[t5["MAE (mo.)"] != "TBD"].assign(MAE=lambda d: d["MAE (mo.)"].astype(float))
        return status, t5, t4, strata_table(res), (gr.update(value=plot, visible=True) if len(plot) else gr.update(visible=False))

    with gr.Blocks(title="OSGA-Net Bone Age Assessment") as demo:
        gr.HTML("<div id='hero'><h1>OSGA-Net · Bone Age Assessment</h1>"
                "<p>Ossification-Structure Graph Attention Network - 13 regions · per-node FiLM · GAT · calibrated age distribution</p>"
                f"<div id='warn'>⚠️ {DISCLAIMER}</div></div>")
        with gr.Tabs():
            with gr.Tab("Assess a radiograph"):
                with gr.Row():
                    with gr.Column(scale=5):
                        img = gr.Image(label="Left-hand radiograph (de-identified)", type="numpy", height=420)
                        sex = gr.Radio(["Male", "Female"], value="Male", label="Sex")
                        chron = gr.Number(label="Chronological age in years (optional - used only if the model was trained with it)")
                        go = gr.Button("Estimate bone age", variant="primary")
                    with gr.Column(scale=6):
                        out_md = gr.Markdown(elem_id="result-md")
                        out_img = gr.Image(label="Detected ossification regions (circle size = attention weight)", height=380)
                        with gr.Row():
                            out_dist = gr.Label(label="Top age bins", num_top_classes=8)
                            out_nodes = gr.Dataframe(label="Region contributions", interactive=False)
                go.click(run, [img, sex, chron], [out_md, out_img, out_dist, out_nodes])
            with gr.Tab("Results (Tables IV & V)"):
                status = gr.Markdown()
                gr.Markdown("#### Table V - ablation (each row removes exactly one component)")
                t5 = gr.Dataframe(interactive=False)
                plot = gr.BarPlot(x="Configuration", y="MAE", title="MAE by configuration (months, lower is better)", height=300, visible=False)
                gr.Markdown("#### Table IV - published results vs. this work")
                t4 = gr.Dataframe(interactive=False)
                gr.Markdown("#### Subgroup MAE (full model)")
                t6 = gr.Dataframe(interactive=False)
                btn = gr.Button("Reload results.json")
                outs = [status, t5, t4, t6, plot]
                btn.click(refresh, None, outs); demo.load(refresh, None, outs)
            with gr.Tab("Method & scope"):
                gr.Markdown(
                    "**Pipeline** CLAHE 384² → EfficientNetV2-S (1280×12×12) → landmark heat-map head (13 regions) → "
                    "heat-map-guided RoIAlign node vectors → per-node FiLM on sex (and age if available) → 2-layer 4-head GAT on a fixed anatomical "
                    "adjacency → attention read-out → 228-bin age distribution (KL + 0.3·heat-map MSE).\n\n"
                    "**Honest scope** RSNA has no landmark labels (the default `template` source is weak supervision) and no chronological age "
                    "(FiLM uses sex only unless you add `chron_months`). All numbers in the Results tab come from your own runs. "
                    "The review flag is an operating point at the 90th percentile of validation σ, not a validated clinical threshold.")
    return demo


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt"); ap.add_argument("--port", type=int, default=7860)
    ap.add_argument("--results", default="results/results.json")
    ap.add_argument("--demo_results_only", action="store_true")
    ap.add_argument("--share", action="store_true", help="public gradio link (needed on Colab/Kaggle)")
    a = ap.parse_args()
    pred = None
    if not a.demo_results_only:
        if not a.ckpt:
            ap.error("--ckpt is required (or use --demo_results_only)")
        from osga.predictor import BoneAgePredictor
        pred = BoneAgePredictor(a.ckpt)
    app = build(pred, a.results)
    try:
        app.launch(server_name="0.0.0.0", server_port=a.port, share=a.share, css=CSS, theme=gr.themes.Soft(primary_hue="teal"))
    except TypeError:                                   # gradio < 6: css/theme belong to Blocks()
        app.css, app.theme = CSS, gr.themes.Soft(primary_hue="teal")
        app.launch(server_name="0.0.0.0", server_port=a.port, share=a.share)
