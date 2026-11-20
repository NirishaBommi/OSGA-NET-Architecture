from __future__ import annotations
from fastapi import APIRouter
from osga.landmarks import NUM_NODES, NODE_NAMES, EDGES
from ..services.inference_service import inference_service
from ..schemas.model_info import ModelStatusResponse, ModelArchitectureResponse, GraphEdge

router = APIRouter(prefix="/model", tags=["Model"])


@router.get("/status", response_model=ModelStatusResponse)
def get_model_status():
    return inference_service.get_status()


@router.get("/architecture", response_model=ModelArchitectureResponse)
def get_model_architecture():
    status = inference_service.get_status()
    S = status["img_size"]

    edge_list = [
        GraphEdge(
            source=i,
            target=j,
            name_source=NODE_NAMES[i],
            name_target=NODE_NAMES[j],
        )
        for i, j in EDGES
    ]

    nodes_metadata = []
    for i, name in enumerate(NODE_NAMES):
        region_type = "Forearm" if i < 2 else ("Carpal" if i < 6 else ("Metacarpal" if i < 11 else "Phalanx"))
        nodes_metadata.append({
            "id": i,
            "name": name,
            "display_name": name.replace("_", " ").title(),
            "region_type": region_type,
        })

    layers = [
        {
            "id": "backbone",
            "name": "EfficientNetV2-S Backbone",
            "type": "CNN Feature Extractor",
            "input_shape": f"[B, 3, {S}, {S}]",
            "output_shape": f"[B, 1280, {S // 32}, {S // 32}]",
            "description": "Shared convolutional trunk pre-trained on ImageNet. Downsamples spatial dimensions by stride 32.",
            "source_file": "osga/model.py:effnet_features",
            "equation": "feat = Backbone(X)",
        },
        {
            "id": "landmark_head",
            "name": "Auxiliary Landmark Head & Soft-Argmax",
            "type": "Heatmap Regression",
            "input_shape": f"[B, 1280, {S // 32}, {S // 32}]",
            "output_shape": f"[B, 13, {S // 8}, {S // 8}]",
            "description": "Two transposed upsampling stages yielding 13 Gaussian heatmaps. Differentiable soft-argmax yields normalized (x,y) coordinates.",
            "source_file": "osga/model.py:heat_head",
            "equation": "Coords = \\operatorname{SoftArgmax}(\\operatorname{ConvTranspose}(feat))",
        },
        {
            "id": "roi_align",
            "name": "Heatmap-Guided RoIAlign Pooling",
            "type": "Anatomical Node Extractor",
            "input_shape": f"[B, 1280, {S // 32}, {S // 32}] + Coords",
            "output_shape": f"[B, 13, 1280]",
            "description": "Extracts 2x2 regional feature patches centered on predicted landmark coordinates, averaged and fused with coordinate embeddings.",
            "source_file": "osga/model.py:node_features",
            "equation": "v_i = \\operatorname{RoIAlign}(feat, \\text{box}_i) + \\operatorname{Embed}(c_i)",
        },
        {
            "id": "film",
            "name": "Per-Node FiLM Metadata Conditioning",
            "type": "Feature-wise Linear Modulation",
            "input_shape": "[B, 13, 1280] + [Sex, ChronAge, Mask]",
            "output_shape": "[B, 13, 1280]",
            "description": "Modulates node features per anatomical site using affine scale gamma and shift beta derived from patient clinical metadata.",
            "source_file": "osga/model.py:meta_mlp, film",
            "equation": "v'_i = (1 + \\gamma_i) \\odot v_i + \\beta_i",
        },
        {
            "id": "gat",
            "name": "2-Layer Structural GAT",
            "type": "Graph Attention Network",
            "input_shape": "[B, 13, 1280] over 20 Adjacency Edges",
            "output_shape": "[B, 13, 1024]",
            "description": "Two dense GAT layers with 4 attention heads each (dim=256) reasoning along biological ossification paths with LayerNorm and residual connections.",
            "source_file": "osga/model.py:GATLayer",
            "equation": "h_i^{(l+1)} = \\operatorname{LayerNorm}(\\sigma(\\sum_{j \\in \\mathcal{N}_i} \\alpha_{ij} W h_j + h_i))",
        },
        {
            "id": "ordinal_head",
            "name": "Readout & Ordinal Age Distribution Head",
            "type": "Ordinal Softmax Density Head",
            "input_shape": "[B, 13, 1024]",
            "output_shape": "[B, 228]",
            "description": "Softmax attention readout pools 13 nodes into a patient summary, followed by a 228-bin ordinal probability distribution over months 1..228.",
            "source_file": "osga/model.py:readout, head",
            "equation": "\\hat{y} = \\sum_{k=1}^{228} k \\cdot p(k), \\quad \\sigma = \\sqrt{\\sum_{k=1}^{228} p(k)(k - \\hat{y})^2}",
        },
    ]

    return ModelArchitectureResponse(
        model_name="OSGA-Net",
        img_size=S,
        backbone="EfficientNetV2-S",
        num_nodes=NUM_NODES,
        num_edges=len(EDGES),
        nodes=nodes_metadata,
        edges=edge_list,
        num_bins=228,
        layers=layers,
    )
