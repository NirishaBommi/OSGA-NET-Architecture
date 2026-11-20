"""Train OSGA-Net / baselines / ablations. Checkpoint+resume safe (Kaggle/Colab session limits).

  python train.py --splits data/splits.csv --out runs/osga --model osga
  python train.py --splits data/splits.csv --out runs/osga --resume          # continue after a timeout
"""
import argparse, json, math, os, random, time
import numpy as np
import pandas as pd
import torch
from torch.utils.data import DataLoader

from osga.dataset import BoneAgeDataset
from osga.model import build_model
from osga.losses import total_loss
from osga.engine import to_device, forward, predict_loader
from osga import metrics


def get_args(argv=None):
    p = argparse.ArgumentParser()
    p.add_argument("--splits", required=True); p.add_argument("--out", required=True)
    p.add_argument("--model", default="osga", choices=["osga", "resnet18", "effnet_concat", "effnet_xattn"])
    p.add_argument("--no_gat", action="store_true"); p.add_argument("--no_film", action="store_true")
    p.add_argument("--no_ordinal", action="store_true"); p.add_argument("--no_landmark", action="store_true")
    p.add_argument("--use_chron", action="store_true", help="feed chronological age to FiLM (needs chron_months column)")
    p.add_argument("--landmark_source", default="template", choices=["template", "csv", "none"])
    p.add_argument("--landmark_csv")
    p.add_argument("--fold", type=int, default=-1, help=">=0: 5-fold CV on the train split; that fold is the val set")
    p.add_argument("--img_size", type=int, default=384); p.add_argument("--batch_size", type=int, default=32)
    p.add_argument("--epochs1", type=int, default=20); p.add_argument("--epochs2", type=int, default=50)
    p.add_argument("--lr", type=float, default=3e-4); p.add_argument("--backbone_lr_mult", type=float, default=0.1)
    p.add_argument("--weight_decay", type=float, default=1e-4); p.add_argument("--lam", type=float, default=0.3)
    p.add_argument("--sigma", type=float, default=6.0); p.add_argument("--patience", type=int, default=10)
    p.add_argument("--workers", type=int, default=2); p.add_argument("--amp", action="store_true")
    p.add_argument("--no_pretrained", action="store_true"); p.add_argument("--seed", type=int, default=42)
    p.add_argument("--max_samples", type=int, default=0, help="debug: cap samples per split")
    p.add_argument("--resume", action="store_true")
    return p.parse_args(argv)


def cosine(base, t, T, warm=0):
    if t < warm:
        return base * (t + 1) / (warm + 1)
    return base * 0.5 * (1 + math.cos(math.pi * (t - warm) / max(1, T - warm)))


def make_loaders(a):
    df = pd.read_csv(a.splits)
    if a.fold >= 0:
        trn = df[(df.split == "train") & (df.fold != a.fold)]
        val = df[(df.split == "train") & (df.fold == a.fold)]
    else:
        trn, val = df[df.split == "train"], df[df.split == "val"]
    if a.max_samples:
        trn, val = trn.head(a.max_samples), val.head(a.max_samples)
    src = "none" if (a.model != "osga" or a.no_landmark) else a.landmark_source
    kw = dict(img_size=a.img_size, landmark_source=src, landmark_csv=a.landmark_csv)
    tl = DataLoader(BoneAgeDataset(trn, train=True, **kw), a.batch_size, shuffle=True, num_workers=a.workers, drop_last=len(trn) > a.batch_size, pin_memory=True)
    vl = DataLoader(BoneAgeDataset(val, train=False, **kw), a.batch_size, shuffle=False, num_workers=a.workers)
    return tl, vl, src


def main(argv=None):
    a = get_args(argv)
    os.makedirs(a.out, exist_ok=True)
    random.seed(a.seed); np.random.seed(a.seed); torch.manual_seed(a.seed)
    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    tl, vl, src = make_loaders(a)
    mkw = dict(pretrained=not a.no_pretrained)
    if a.model == "osga":
        mkw.update(use_landmark=not a.no_landmark, use_film=not a.no_film, use_gat=not a.no_gat,
                   ordinal=not a.no_ordinal, use_chron=a.use_chron)
    model = build_model(a.model, **mkw).to(dev)
    has_lm = a.model == "osga" and not a.no_landmark and src != "none"
    e1 = a.epochs1 if has_lm else 0
    E = e1 + a.epochs2
    groups = [{"params": model.backbone_params(), "base_lr": a.lr * a.backbone_lr_mult},
              {"params": model.other_params(), "base_lr": a.lr}]
    opt = torch.optim.AdamW(groups, lr=a.lr, weight_decay=a.weight_decay)
    scaler = torch.amp.GradScaler("cuda", enabled=a.amp and dev.type == "cuda")
    st = {"epoch": 0, "best_mae": float("inf"), "bad": 0, "history": []}
    last, best = os.path.join(a.out, "last.pt"), os.path.join(a.out, "best.pt")
    if a.resume and os.path.exists(last):
        ck = torch.load(last, map_location=dev, weights_only=False)
        model.load_state_dict(ck["model"]); opt.load_state_dict(ck["opt"]); scaler.load_state_dict(ck["scaler"])
        st = ck["state"]; print(f"resumed at epoch {st['epoch']}/{E}")
    json.dump({**vars(a), "landmark_source_effective": src}, open(os.path.join(a.out, "args.json"), "w"), indent=2)

    for ep in range(st["epoch"], E):
        stage = 1 if ep < e1 else 2
        t0 = time.time(); model.train()
        T, t = (e1, ep) if stage == 1 else (a.epochs2, ep - e1)
        for g in opt.param_groups:
            g["lr"] = cosine(g["base_lr"], t, T, warm=1 if stage == 2 else 0)
        run, n = 0.0, 0
        for b in tl:
            b = to_device(b, dev)
            with torch.autocast(device_type=dev.type, enabled=a.amp and dev.type == "cuda"):
                out = forward(model, b)
                loss, parts = total_loss(out, b, model, a.lam, a.sigma, stage)
            opt.zero_grad(set_to_none=True)
            scaler.scale(loss).backward()
            scaler.unscale_(opt); torch.nn.utils.clip_grad_norm_(model.parameters(), 5.0)
            scaler.step(opt); scaler.update()
            run += loss.item() * len(b["id"]); n += len(b["id"])
        rec = {"epoch": ep + 1, "stage": stage, "train_loss": run / max(1, n)}
        if stage == 2:
            df = predict_loader(model, vl, dev, a.amp)
            m = metrics.basic(df.true, df.pred); rec.update(val_mae=m["mae"], val_rmse=m["rmse"])
            if m["mae"] < st["best_mae"]:
                st["best_mae"], st["bad"] = m["mae"], 0
                torch.save({"model": model.state_dict(), "model_name": a.model, "model_kwargs": {**mkw, "pretrained": False},
                            "img_size": a.img_size, "epoch": ep + 1, "val_mae": m["mae"]}, best)
            else:
                st["bad"] += 1
        rec["sec"] = round(time.time() - t0, 1)
        st["history"].append(rec); st["epoch"] = ep + 1
        print(json.dumps(rec), flush=True)
        torch.save({"model": model.state_dict(), "opt": opt.state_dict(), "scaler": scaler.state_dict(), "state": st}, last + ".tmp")
        os.replace(last + ".tmp", last)
        if stage == 2 and st["bad"] >= a.patience:
            print("early stopping"); break
    json.dump(st["history"], open(os.path.join(a.out, "history.json"), "w"), indent=2)
    print("best val MAE (months):", st["best_mae"])


if __name__ == "__main__":
    main()
