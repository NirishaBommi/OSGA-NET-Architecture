"""Build the split CSV from the RSNA Bone Age files you downloaded.

Example (Kaggle layout):
  python scripts/prepare_data.py --img_dir /kaggle/input/<ds>/boneage-training-dataset/boneage-training-dataset \
      --csv /kaggle/input/<ds>/boneage-training-dataset.csv --out data/splits.csv
Column names are auto-detected; override with --id_col/--age_col/--sex_col. The script PRINTS what it
detected - check it. If you also have the official 1,425-image validation set and/or the 200-image
test set (with labels), pass --val_img_dir/--val_csv and --test_img_dir/--test_csv; otherwise a
stratified val split is carved out of the training images (--val_frac) and no test split exists.
"""
import argparse, os
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, StratifiedKFold

ID = ["id", "ID", "Case ID", "case_id", "image_id"]
AGE = ["boneage", "bone_age", "Ground truth bone age(months)", "Bone Age (months)", "age_months"]
SEX = ["male", "Sex", "sex", "gender", "Male"]


def pick(df, cands, override, what):
    if override:
        return override
    for c in cands:
        if c in df.columns:
            return c
    raise SystemExit(f"cannot detect {what} column in {list(df.columns)}; pass --{what[:3]}_col")


def strata(df, need):
    """sex x age-bin labels; coarsen bins until every stratum has >= need members (else None)."""
    for nb in (8, 6, 4, 3, 2, 1):
        lab = df.male.astype(str) + "_" + pd.qcut(df.boneage, nb, labels=False, duplicates="drop").astype(str)
        if lab.value_counts().min() >= need:
            return lab
    return None


def to_male(s):
    if s.dtype == bool:
        return s.astype(int)
    m = s.astype(str).str.strip().str.lower().map({"true": 1, "false": 0, "m": 1, "f": 0, "male": 1, "female": 0, "1": 1, "0": 0})
    if m.isna().any():
        raise SystemExit(f"unrecognised sex values: {s[m.isna()].unique()[:5]}")
    return m.astype(int)


def load(csv, img_dir, args, split):
    df = pd.read_csv(csv)
    ic, ac, sc = pick(df, ID, args.id_col, "id"), pick(df, AGE, args.age_col, "age"), pick(df, SEX, args.sex_col, "sex")
    print(f"[{split}] {csv}: id='{ic}' age='{ac}' sex='{sc}' rows={len(df)}")
    out = pd.DataFrame({"id": df[ic].astype(str), "boneage": df[ac].astype(float), "male": to_male(df[sc])})
    if args.chron_col and args.chron_col in df.columns:
        out["chron_months"] = df[args.chron_col].astype(float)
    def find(i):
        for ext in (".png", ".jpg", ".jpeg", ".PNG", ".JPG"):
            p = os.path.join(img_dir, f"{i}{ext}")
            if os.path.exists(p):
                return p
        return ""
    out["path"] = out["id"].map(find)
    miss = (out.path == "").sum()
    if miss:
        print(f"  WARNING: {miss} rows have no image file in {img_dir}; dropping them")
    out = out[out.path != ""].copy()
    out["split"] = split
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--img_dir", required=True); ap.add_argument("--csv", required=True)
    ap.add_argument("--val_img_dir"); ap.add_argument("--val_csv")
    ap.add_argument("--test_img_dir"); ap.add_argument("--test_csv")
    ap.add_argument("--id_col"); ap.add_argument("--age_col"); ap.add_argument("--sex_col"); ap.add_argument("--chron_col")
    ap.add_argument("--val_frac", type=float, default=0.1)
    ap.add_argument("--test_frac", type=float, default=0.0, help="if no --test_csv: carve this fraction of train as a held-out TEST split (recommended 0.1); report it as a held-out split, NOT the official 200-image test set")
    ap.add_argument("--folds", type=int, default=5)
    ap.add_argument("--seed", type=int, default=42); ap.add_argument("--out", default="data/splits.csv")
    a = ap.parse_args()

    tr = load(a.csv, a.img_dir, a, "train")
    parts = []
    if a.val_csv:
        parts.append(load(a.val_csv, a.val_img_dir or a.img_dir, a, "val"))
    else:
        try:
            tr_idx, va_idx = train_test_split(np.arange(len(tr)), test_size=a.val_frac, random_state=a.seed, stratify=strata(tr, 2))
        except ValueError:      # tiny datasets only
            print("  note: too few images to stratify the val split; using a random split")
            tr_idx, va_idx = train_test_split(np.arange(len(tr)), test_size=a.val_frac, random_state=a.seed)
        va = tr.iloc[va_idx].copy(); va["split"] = "val"
        tr = tr.iloc[tr_idx].copy()
        parts.append(va)
    if a.test_frac > 0 and not a.test_csv:
        ti, te = train_test_split(np.arange(len(tr)), test_size=a.test_frac, random_state=a.seed + 1, stratify=strata(tr, 2))
        te_df = tr.iloc[te].copy(); te_df["split"] = "test"; te_df["fold"] = -1
        tr = tr.iloc[ti].copy(); parts.append(te_df)
    tr = tr.reset_index(drop=True)
    skf = StratifiedKFold(a.folds, shuffle=True, random_state=a.seed)
    strat = strata(tr, a.folds)
    tr["fold"] = -1
    for k, (_, v) in enumerate(skf.split(tr, strat if strat is not None else np.zeros(len(tr)))):
        tr.loc[v, "fold"] = k
    parts.append(tr)
    if a.test_csv:
        parts.append(load(a.test_csv, a.test_img_dir or a.img_dir, a, "test"))
    full = pd.concat(parts, ignore_index=True)
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    full.to_csv(a.out, index=False)
    print(full.groupby("split").agg(n=("id", "size"), male_pct=("male", lambda s: round(100 * s.mean(), 1)),
                                    age_min=("boneage", "min"), age_max=("boneage", "max")))
    print("wrote", a.out)


if __name__ == "__main__":
    main()
