import torch
import torch.nn.functional as F


def soft_labels(target, bins, sigma=6.0):
    w = torch.exp(-((bins.unsqueeze(0) - target.unsqueeze(1)) ** 2) / (2 * sigma ** 2))
    return w / w.sum(1, keepdim=True)


def heatmap_loss(heat, target, valid):
    if heat is None:
        return torch.zeros((), device=target.device)
    if heat.shape[-2:] != target.shape[-2:]:
        heat = F.interpolate(heat, size=target.shape[-2:], mode="bilinear", align_corners=False)
    per = ((heat.float() - target) ** 2).mean((2, 3))             # B,K
    return (per * valid).sum() / valid.sum().clamp_min(1.0)


def total_loss(out, batch, model, lam=0.3, sigma=6.0, stage=2):
    """Stage 1: heatmap only. Stage 2: KL(soft label || p) + lam * heatmap (ordinal),
    or L1(years) + lam * heatmap (regression baselines / -ordinal ablation)."""
    hm = heatmap_loss(out.get("heat"), batch["heat"], batch["heat_valid"])
    if stage == 1:
        return hm, {"heat": hm.item()}
    if "logits" in out:
        sl = soft_labels(batch["age"], model.bins, sigma)
        main = F.kl_div(F.log_softmax(out["logits"].float(), -1), sl, reduction="batchmean")
    else:
        main = F.l1_loss(out["pred"], batch["age"]) / 12.0
    return main + lam * hm, {"main": main.item(), "heat": hm.item()}
