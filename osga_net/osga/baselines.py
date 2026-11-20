"""Baselines that are actually re-implemented here (all output months via the same dict API).
Published methods (Chen, Mao, Pan, Lou, ...) are NOT re-implemented; compare to their published numbers."""
from __future__ import annotations
import torch
import torch.nn as nn
from torchvision.models import resnet18, ResNet18_Weights
from .model import effnet_features


def _out(raw, male):
    return {"pred": 120.0 + 50.0 * raw.squeeze(-1), "std": torch.zeros_like(male), "heat": None, "coords": None}


class ResNet18Reg(nn.Module):
    """Image-only regression (no sex)."""
    def __init__(self, pretrained=True, **_):
        super().__init__()
        m = resnet18(weights=ResNet18_Weights.IMAGENET1K_V1 if pretrained else None)
        m.fc = nn.Linear(512, 1)
        self.m = m
        self.cfg = dict(pretrained=pretrained)

    def backbone_params(self): return [p for n, p in self.m.named_parameters() if not n.startswith("fc")]
    def other_params(self): return list(self.m.fc.parameters())
    def forward(self, img, male, chron=None, chron_mask=None): return _out(self.m(img), male)


class EffNetConcat(nn.Module):
    """EfficientNetV2-S + concatenation fusion of sex (Kim et al.-style)."""
    def __init__(self, pretrained=True, **_):
        super().__init__()
        self.backbone = effnet_features(pretrained)
        self.sex = nn.Sequential(nn.Linear(1, 32), nn.ReLU(True))
        self.head = nn.Sequential(nn.Linear(1280 + 32, 512), nn.ReLU(True), nn.Dropout(0.2), nn.Linear(512, 1))
        self.cfg = dict(pretrained=pretrained)

    def backbone_params(self): return list(self.backbone.parameters())
    def other_params(self): return list(self.sex.parameters()) + list(self.head.parameters())

    def forward(self, img, male, chron=None, chron_mask=None):
        f = self.backbone(img).mean((2, 3))
        return _out(self.head(torch.cat([f, self.sex(male.unsqueeze(-1))], -1)), male)


class EffNetXAttn(nn.Module):
    """Cross-attention fusion: a sex-derived query attends over image tokens."""
    def __init__(self, pretrained=True, dim=512, **_):
        super().__init__()
        self.backbone = effnet_features(pretrained)
        self.proj = nn.Conv2d(1280, dim, 1)
        self.q = nn.Sequential(nn.Linear(1, dim), nn.ReLU(True), nn.Linear(dim, dim))
        self.attn = nn.MultiheadAttention(dim, 8, batch_first=True)
        self.head = nn.Sequential(nn.Linear(dim, 256), nn.ReLU(True), nn.Dropout(0.2), nn.Linear(256, 1))
        self.cfg = dict(pretrained=pretrained)

    def backbone_params(self): return list(self.backbone.parameters())
    def other_params(self):
        ids = {id(p) for p in self.backbone.parameters()}
        return [p for p in self.parameters() if id(p) not in ids]

    def forward(self, img, male, chron=None, chron_mask=None):
        tok = self.proj(self.backbone(img)).flatten(2).transpose(1, 2)
        o, _ = self.attn(self.q(male.unsqueeze(-1)).unsqueeze(1), tok, tok)
        return _out(self.head(o.squeeze(1)), male)
