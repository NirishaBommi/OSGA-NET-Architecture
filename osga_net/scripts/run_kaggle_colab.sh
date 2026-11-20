#!/usr/bin/env bash
# Colab/Kaggle: upload/unzip this folder first, enable a GPU, then:  bash scripts/run_kaggle_colab.sh
set -e
pip -q install -r requirements.txt
python tests/smoke_test.py
# Kaggle notebook: attach the RSNA dataset (Add data) and set RAW to its /kaggle/input/... path.
RAW=${RAW:-data/raw}
python scripts/prepare_data.py --img_dir $RAW/boneage-training-dataset/boneage-training-dataset \
   --csv $RAW/boneage-training-dataset.csv --out data/splits.csv
python train.py --splits data/splits.csv --out runs/osga --amp --resume
python evaluate.py --ckpt runs/osga/best.pt --splits data/splits.csv --split val
