"""OSGA-Net: Ossification-Structure Graph Attention Network (pure-PyTorch, no PyG needed)."""
from __future__ import annotations
import math
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision.models import efficientnet_v2_s, EfficientNet_V2_S_Weights
from torchvision.ops import roi_align

from .landmarks import NUM_NODES, build_adjacency

NUM_BINS = 228                     # 1..228 months
SOFTARGMAX_BETA = 30.0


def effnet_features(pretrained: bool) -> nn.Module:
    w = EfficientNet_V2_S_Weights.IMAGENET1K_V1 if pretrained else None
    return efficientnet_v2_s(weights=w).features          # 1280 x H/32 x W/32


class GATLayer(nn.Module):
    """Dense multi-head graph attention over a fixed adjacency (13 nodes -> dense is cheapest)."""

    def __init__(self, din, dout, heads=4, dropout=0.1):
        super().__init__()
        self.H, self.F = heads, dout
        self.W = nn.Linear(din, heads * dout, bias=False)
        self.a_src = nn.Parameter(torch.empty(1, heads, 1, dout))
        self.a_dst = nn.Parameter(torch.empty(1, heads, 1, dout))
        nn.init.xavier_uniform_(self.a_src); nn.init.xavier_uniform_(self.a_dst)
        self.res = nn.Identity() if din == heads * dout else nn.Linear(din, heads * dout, bias=False)
        self.norm = nn.LayerNorm(heads * dout)
        self.drop = nn.Dropout(dropout)

    def forward(self, x, adj):                              # x (B,N,din), adj (N,N)
        B, N, _ = x.shape
        h = self.W(x).view(B, N, self.H, self.F).transpose(1, 2)          # B,H,N,F
        e = (h * self.a_src).sum(-1).unsqueeze(-1) + (h * self.a_dst).sum(-1).unsqueeze(-2)
        e = F.leaky_relu(e, 0.2).masked_fill(adj.unsqueeze(0).unsqueeze(0) == 0, float("-inf"))
        a = self.drop(torch.softmax(e, -1))
        out = (a @ h).transpose(1, 2).reshape(B, N, self.H * self.F)
        return self.norm(F.elu(out + self.res(x))), a


class OSGANet(nn.Module):
    def __init__(self, pretrained=True, use_landmark=True, use_film=True, use_gat=True,
                 ordinal=True, use_chron=False, feat_dim=1280, gat_dim=256, heads=4,
                 num_bins=NUM_BINS, roi_frac=0.17, dropout=0.2):
        super().__init__()
        self.cfg = dict(pretrained=pretrained, use_landmark=use_landmark, use_film=use_film, use_gat=use_gat,
                        ordinal=ordinal, use_chron=use_chron)
        self.use_landmark, self.use_film, self.use_gat = use_landmark, use_film, use_gat
        self.ordinal, self.use_chron, self.roi_frac = ordinal, use_chron, roi_frac
        self.backbone = effnet_features(pretrained)
        D = feat_dim
        if use_landmark:
            self.heat_head = nn.Sequential(
                nn.Conv2d(D, 256, 3, padding=1), nn.BatchNorm2d(256), nn.ReLU(True), nn.Upsample(scale_factor=2),
                nn.Conv2d(256, 128, 3, padding=1), nn.BatchNorm2d(128), nn.ReLU(True), nn.Upsample(scale_factor=2),
                nn.Conv2d(128, NUM_NODES, 1))                       # heat size = input/8
            self.coord_embed = nn.Linear(2, D)
        else:                                                       # ablation: 13 learned queries
            self.queries = nn.Parameter(torch.randn(NUM_NODES, D) * 0.02)
            self.q_attn = nn.MultiheadAttention(D, 8, batch_first=True)
        # metadata encoder is shared by FiLM (full model) and by the "-FiLM" ablation, which injects the
        # SAME metadata by concatenation so the ablation isolates the fusion operator (paper Table V).
        self.meta_mlp = nn.Sequential(nn.Linear(3, 64), nn.ReLU(True), nn.Linear(64, 128), nn.ReLU(True))
        if not use_film:
            self.concat_proj = nn.Sequential(nn.Linear(D + 128, D), nn.ReLU(True), nn.LayerNorm(D))
        if use_film:
            self.node_emb = nn.Parameter(torch.randn(NUM_NODES, 128) * 0.02)
            self.film = nn.Linear(128, 2 * D)
            nn.init.zeros_(self.film.weight); nn.init.zeros_(self.film.bias)      # identity at init
        gd = gat_dim * heads
        if use_gat:
            self.gat1 = GATLayer(D, gat_dim, heads)
            self.gat2 = GATLayer(gd, gat_dim, heads)
            self.register_buffer("adj", torch.from_numpy(build_adjacency()))
        else:
            self.node_mlp = nn.Sequential(nn.Linear(D, gd), nn.ReLU(True), nn.LayerNorm(gd))
        self.readout = nn.Linear(gd, 1)
        self.head = nn.Sequential(nn.Linear(gd, 512), nn.ReLU(True), nn.Dropout(dropout),
                                  nn.Linear(512, num_bins if ordinal else 1))
        self.register_buffer("bins", torch.arange(1, num_bins + 1, dtype=torch.float32))

    # ---- parameter groups (backbone gets a lower LR) ----
    def backbone_params(self):
        return list(self.backbone.parameters())

    def other_params(self):
        ids = {id(p) for p in self.backbone.parameters()}
        return [p for p in self.parameters() if id(p) not in ids]

    @staticmethod
    def soft_argmax(heat):
        B, K, H, W = heat.shape
        p = torch.softmax(heat.float().flatten(2) * SOFTARGMAX_BETA, -1).view(B, K, H, W)
        xs = (torch.arange(W, device=heat.device, dtype=torch.float32) + 0.5) / W
        ys = (torch.arange(H, device=heat.device, dtype=torch.float32) + 0.5) / H
        return torch.stack([(p.sum(2) * xs).sum(-1), (p.sum(3) * ys).sum(-1)], -1)     # B,K,2

    def node_features(self, feat, return_aux: bool = False):
        B, D, Hf, Wf = feat.shape
        if self.use_landmark:
            heat = self.heat_head(feat)
            coords = self.soft_argmax(heat)
            half = self.roi_frac * Wf
            cx, cy = coords[..., 0].detach() * Wf, coords[..., 1].detach() * Hf
            bidx = torch.arange(B, device=feat.device, dtype=torch.float32).view(B, 1).expand(B, NUM_NODES)
            boxes = torch.stack([bidx, cx - half, cy - half, cx + half, cy + half], -1).reshape(-1, 5)
            r = roi_align(feat.float(), boxes, output_size=2, spatial_scale=1.0, sampling_ratio=2, aligned=True)
            nodes = r.mean((2, 3)).view(B, NUM_NODES, D) + self.coord_embed(coords)
            aux_boxes = None
            if return_aux:
                aux_boxes = torch.stack([
                    (cx - half) / Wf, (cy - half) / Hf,
                    (cx + half) / Wf, (cy + half) / Hf
                ], -1)  # B, NUM_NODES, 4
            return nodes, heat, coords, aux_boxes
        tok = feat.flatten(2).transpose(1, 2)
        q = self.queries.unsqueeze(0).expand(B, -1, -1)
        nodes, _ = self.q_attn(q, tok, tok)
        return nodes, None, None, None

    def forward(self, img, male, chron=None, chron_mask=None, return_aux: bool = False):
        feat = self.backbone(img)
        nodes, heat, coords, aux_boxes = self.node_features(feat, return_aux=return_aux)
        if chron is None or not self.use_chron:
            chron_n, cm = torch.zeros_like(male), torch.zeros_like(male)
        else:
            chron_n, cm = chron / 120.0 * chron_mask, chron_mask
        meta = self.meta_mlp(torch.stack([male, chron_n, cm], -1))                   # B,128
        film_gamma, film_beta = None, None
        pre_film_norm, post_film_norm = None, None
        if self.use_film:
            if return_aux:
                pre_film_norm = nodes.norm(dim=-1)
            cond = meta.unsqueeze(1) + self.node_emb.unsqueeze(0)
            g, b = self.film(cond).chunk(2, -1)
            nodes = (1 + g) * nodes + b
            if return_aux:
                film_gamma, film_beta = g, b
                post_film_norm = nodes.norm(dim=-1)
        else:                                                                         # ablation: concatenation
            if return_aux:
                pre_film_norm = nodes.norm(dim=-1)
            nodes = self.concat_proj(torch.cat([nodes, meta.unsqueeze(1).expand(-1, nodes.shape[1], -1)], -1))
            if return_aux:
                post_film_norm = nodes.norm(dim=-1)
        gat_attns = []
        if self.use_gat:
            x, a1 = self.gat1(nodes.float(), self.adj)
            x, a2 = self.gat2(x, self.adj)
            if return_aux:
                gat_attns = [a1, a2]
        else:
            x = self.node_mlp(nodes.float())
        w = torch.softmax(self.readout(x), 1)
        z = (w * x).sum(1)
        out = self.head(z)
        res = {"heat": heat, "coords": coords, "node_weights": w.squeeze(-1)}
        if return_aux:
            res["roi_boxes"] = aux_boxes
            res["gat_attention"] = gat_attns
            res["film_gamma"] = film_gamma
            res["film_beta"] = film_beta
            res["pre_film_norm"] = pre_film_norm
            res["post_film_norm"] = post_film_norm
        if self.ordinal:
            p = torch.softmax(out.float(), -1)
            mean = (p * self.bins).sum(-1)
            var = (p * (self.bins - mean.unsqueeze(-1)) ** 2).sum(-1)
            res.update(logits=out, probs=p, pred=mean, std=var.clamp_min(1e-8).sqrt())
        else:
            res.update(pred=120.0 + 50.0 * out.squeeze(-1), std=torch.zeros_like(male))
        return res


def build_model(name: str, **kw) -> nn.Module:
    from .baselines import ResNet18Reg, EffNetConcat, EffNetXAttn
    if name == "osga":
        return OSGANet(**kw)
    table = {"resnet18": ResNet18Reg, "effnet_concat": EffNetConcat, "effnet_xattn": EffNetXAttn}
    if name not in table:
        raise ValueError(f"unknown model {name}; choose osga|{'|'.join(table)}")
    return table[name](pretrained=kw.get("pretrained", True))
