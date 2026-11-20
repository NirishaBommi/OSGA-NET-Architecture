# OSGA-Net Workstation — Presentation & Defense Guide

**A step-by-step presentation script and defense manual for project reviews and committee evaluations.**

---

## 1. Executive Summary & Opening Statement

> *"Good morning/afternoon, committee members. Today I am presenting **OSGA-Net**, an Ossification-Structure Graph Attention Network for pediatric bone age assessment.
> 
> Standard deep learning approaches for bone age treat pediatric hand radiographs as black-box image classification or global regression problems. In contrast, pediatric radiologists evaluate skeletal maturity by examining specific ossification centers—the carpal bones, metacarpal heads, and phalangeal epiphyses—and tracking their fusion relative to biological sex.
> 
> OSGA-Net bridges this gap by explicitly decomposing hand radiographs into 13 anatomical ossification landmarks, modulating local features using demographic FiLM layers, reasoning across skeletal dependencies via Graph Attention Networks, and predicting a calibrated 228-bin ordinal age distribution."*

---

## 2. Walkthrough of the 11 Presentation Stages

The Workstation features an interactive **11-Stage Presentation Tour** accessible at `/presentation` or using the left navigation sidebar. Use the following narrative for each stage:

```
[1. Clinical Context] ──> [2. Pipeline] ──> [3. 13 Landmarks] ──> [4. RoI Extraction]
         │
         ▼
[5. FiLM Modulation] ──> [6. Graph GAT] ──> [7. Ordinal Distribution] ──> [8. Uncertainty]
         │
         ▼
[9. Ablation Matrix] ──> [10. Literature] ──> [11. Research Transparency]
```

### Stage 1: Clinical Context & Problem Framing
- **Slide Message:** Bone age assessment is crucial for diagnosing endocrine and growth disorders (precocious puberty, growth hormone deficiency).
- **Key Talking Point:** Current clinical methods (Greulich-Pyle atlas, Tanner-Whitehouse scoring) suffer from high intra- and inter-observer variability (~0.5 to 1.2 years). Black-box CNNs cannot explain *why* a particular age was assigned.

### Stage 2: The OSGA-Net Architecture
- **Slide Message:** End-to-end differentiable pipeline marrying computer vision with graph representation learning.
- **Key Talking Point:** Point out the progression: EfficientNetV2-S backbone $\to$ Landmark Head $\to$ RoIAlign $\to$ FiLM Conditioning $\to$ 2-layer GAT $\to$ Ordinal Head.

### Stage 3: 13 Anatomical Landmarks & Heatmaps
- **Slide Message:** Anatomical anchoring on the biological growth centers.
- **Key Talking Point:** Explain the 13 nodes: Distal radius and ulna, 4 carpal bones (scaphoid/lunate, capitate, hamate, triquetrum), 5 metacarpal heads (MC1–MC5), and proximal thumb/middle phalanges. Mention that heatmaps are computed at stride 8 ($48 \times 48$) with soft-argmax coordinate extraction.

### Stage 4: Regional RoIAlign Pooling
- **Slide Message:** Localized feature extraction without global background distraction.
- **Key Talking Point:** RoIAlign extracts $2 \times 2$ feature grids centered on each landmark, concatenated with spatial coordinate embeddings. This isolates the epiphyseal plates from soft tissue or background noise.

### Stage 5: Per-Node FiLM Demographic Conditioning
- **Slide Message:** Bone maturation rates diverge significantly between biological sexes.
- **Key Talking Point:** Feature-wise Linear Modulation ($x' = (1 + \gamma) \odot x + \beta$) adapts each node's representations using patient metadata without perturbing the topological graph structure.

### Stage 6: Graph Attention Network (GAT) Over Skeletal Topology
- **Slide Message:** Modeling maturation dependencies across bone groups.
- **Key Talking Point:** Hand bones do not mature in isolation. The capitate and hamate ossify first in infancy, followed by the triquetrum, metacarpals, and radius/ulna fusion in adolescence. Our 2-layer 4-head GAT computes dynamic attention across 20 anatomical edges to capture these relational patterns.

### Stage 7: Ordinal Distribution Regression
- **Slide Message:** Age is an ordered continuum, not arbitrary discrete classes.
- **Key Talking Point:** Instead of L1 regression (which provides no uncertainty) or cross-entropy (which penalizes an error of 1 month identically to an error of 50 months), we use a 228-month ordinal distribution with KL divergence against unimodal soft Gaussian ground truth.

### Stage 8: Uncertainty Quantification & Radiologist Triage
- **Slide Message:** Knowing when the model does not know.
- **Key Talking Point:** The standard deviation $\hat{\sigma}$ of the ordinal distribution measures predictive uncertainty. If $\hat{\sigma}$ exceeds the 90th percentile threshold derived from validation calibration, the case is flagged for manual radiologist audit.

### Stage 9: Ablation Study Matrix (Table V)
- **Slide Message:** Proving every design choice contributes to performance.
- **Key Talking Point:** Walk through the 5 ablations ($-GAT$, $-FiLM$, $-Ordinal$, $-Landmark$) alongside the 3 baselines (ResNet-18, EffNet Concat, EffNet Cross-Attn).

### Stage 10: Literature Comparison (Table IV)
- **Slide Message:** Benchmarking against published state-of-the-art.
- **Key Talking Point:** Transparently distinguish published peer-reviewed numbers from newly trained experimental results.

### Stage 11: Academic Integrity & Research Transparency
- **Slide Message:** Strict honesty in scientific reporting.
- **Key Talking Point:** State clearly that no unverified or simulated numbers are passed off as real; the workstation features persistent badges identifying real inference, demonstration, and pending states.

---

## 3. Defense Q&A: Handling Tough Examiner Questions

#### Q1: "How did you obtain landmark labels for RSNA if RSNA doesn't provide them?"
**Answer:**
> *"RSNA indeed does not provide landmark annotations. Our architecture supports three modes: weak supervision via a classical computer vision heuristic template, real manual annotations via CSV, or unsupervised joint training. The Escobar et al. hand-pose prior model cited in preliminary work is external and not bundled. When reporting final numbers, we clearly document which landmark source was used."*

#### Q2: "Why didn't you use chronological age in the FiLM layers?"
**Answer:**
> *"The public RSNA dataset omits chronological age and only provides radiological bone age and sex. Therefore, in standard RSNA experiments, our FiLM vector conditions purely on biological sex $[male, 0, 0]$. If an external dataset with chronological age is integrated, the full 3D conditioning vector is enabled via the `--use_chron` flag."*

#### Q3: "What is the difference between the GAT edge attention and the node weights?"
**Answer:**
> *"The GAT attention matrices represent edge-level relational importance between pairs of adjacent bones across the 20 biological edges. The node weights represent the global read-out attention that pools the 13 node embeddings into the final clinical age prediction. Both are exposed in our interpretability workspace."*

#### Q4: "Can this model be deployed in a pediatric clinic today?"
**Answer:**
> *"No. As prominently stated on every screen and PDF report in our workstation, OSGA-Net is a research prototype. It has not undergone clinical trials, lacks FDA/CE clearance, and is strictly intended for educational exploration and decision-support research."*
