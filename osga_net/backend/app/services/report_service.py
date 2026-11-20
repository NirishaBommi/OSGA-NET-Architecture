from __future__ import annotations
import io
import os
from datetime import datetime, timezone
from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage, KeepTogether, HRFlowable
)

from ..db.models import Assessment, AssessmentResult
from ..core.config import settings


def generate_pdf_report(assessment: Assessment, result: AssessmentResult | None) -> io.BytesIO:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()
    
    # Custom Palette
    c_primary = colors.HexColor("#0f172a")     # Deep navy
    c_accent = colors.HexColor("#0284c7")      # Medical cyan
    c_subtle = colors.HexColor("#64748b")      # Slate grey
    c_alert = colors.HexColor("#d97706")       # Amber
    c_bg_card = colors.HexColor("#f8fafc")     # Light background
    c_border = colors.HexColor("#e2e8f0")

    # Typography Styles
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=c_primary,
    )
    subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=c_subtle,
    )
    section_h2 = ParagraphStyle(
        "SectionH2",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=c_primary,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=c_primary,
    )
    disclaimer_style = ParagraphStyle(
        "Disclaimer",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=7.5,
        leading=10,
        textColor=c_subtle,
    )
    banner_demo = ParagraphStyle(
        "DemoBanner",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=12,
        textColor=colors.HexColor("#b91c1c"),
        alignment=1,
    )

    elements = []

    # 1. Header Banner
    header_data = [
        [
            Paragraph("<b>OSGA-Net</b> | Clinical Bone Age Workstation", title_style),
            Paragraph(f"<b>Study ID:</b> {assessment.id}<br/><b>Date:</b> {assessment.created_at.strftime('%Y-%m-%d %H:%M UTC')}", subtitle_style),
        ]
    ]
    t_header = Table(header_data, colWidths=[360, 180])
    t_header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
    ]))
    elements.append(t_header)
    elements.append(Spacer(1, 10))
    elements.append(HRFlowable(width="100%", thickness=1, color=c_border, spaceAfter=10))

    # 2. Operational Mode & Disclaimer Banner
    is_demo = result is not None and result.result_source == "demonstration"
    if is_demo:
        banner_text = "⚠️ DEMONSTRATION MODE ONLY — FICTIONAL / NON-CLINICAL OUTPUT"
        t_demo = Table([[Paragraph(banner_text, banner_demo)]], colWidths=[540])
        t_demo.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fef2f2")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#f87171")),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(t_demo)
        elements.append(Spacer(1, 10))

    # 3. Patient & Study Profile
    sex_str = assessment.patient_sex.capitalize()
    chron_str = f"{assessment.chronological_age_months:.1f} months" if assessment.chronological_age_months else "Not provided"
    ref_str = f"{assessment.reference_bone_age_months:.1f} months" if assessment.reference_bone_age_months else "Not provided"
    
    meta_table_data = [
        [Paragraph("<b>Patient Biological Sex:</b>", body_style), Paragraph(sex_str, body_style),
         Paragraph("<b>Chronological Age:</b>", body_style), Paragraph(chron_str, body_style)],
        [Paragraph("<b>Reference Bone Age:</b>", body_style), Paragraph(ref_str, body_style),
         Paragraph("<b>Assessment Status:</b>", body_style), Paragraph(assessment.status.upper(), body_style)],
    ]
    t_meta = Table(meta_table_data, colWidths=[135, 135, 135, 135])
    t_meta.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), c_bg_card),
        ("BOX", (0, 0), (-1, -1), 0.5, c_border),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, c_border),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    elements.append(t_meta)
    elements.append(Spacer(1, 14))

    # 4. Prediction Assessment Card (if evaluated)
    if result:
        res_source_label = "Real PyTorch Inference" if result.result_source == "real_inference" else "Demonstration Sample"
        review_badge = "NEEDS REVIEW" if result.needs_review else "NORMAL OPERATING RANGE"
        review_color = colors.HexColor("#b45309") if result.needs_review else colors.HexColor("#15803d")

        result_summary = [
            [
                Paragraph("<b>PREDICTED SKELETAL MATURITY (BONE AGE)</b>", section_h2),
                Paragraph(f"<b>Data Source:</b> {res_source_label}", subtitle_style)
            ],
            [
                Paragraph(f"<font size='22' color='#0284c7'><b>{result.bone_age_formatted}</b></font><br/>"
                          f"<font size='9' color='#64748b'>({result.bone_age_months:.1f} months)</font>", body_style),
                Paragraph(f"<b>Distribution Mode:</b> {result.most_probable_age_months:.1f} mo.<br/>"
                          f"<b>Model Uncertainty (σ):</b> ±{result.uncertainty_std_months:.2f} mo.<br/>"
                          f"<b>Central 95% Mass Range:</b> {result.interval_95_min:.1f} – {result.interval_95_max:.1f} mo.<br/>"
                          f"<b>Triage Flag:</b> <font color='{review_color}'><b>{review_badge}</b></font>", body_style)
            ]
        ]
        t_res = Table(result_summary, colWidths=[240, 300])
        t_res.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f0f9ff")),
            ("BOX", (0, 0), (-1, -1), 1, c_accent),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ]))
        elements.append(t_res)
        elements.append(Spacer(1, 14))

    # 5. Radiograph Image (if uploaded)
    if assessment.image_filename:
        img_path = settings.UPLOAD_DIR / assessment.image_filename
        if img_path.is_file():
            try:
                elements.append(Paragraph("Radiograph Overview & Anatomical Grounding", section_h2))
                rl_img = RLImage(str(img_path), width=220, height=260)
                elements.append(rl_img)
                elements.append(Spacer(1, 10))
            except Exception:
                pass

    # 6. Anatomical Node Attention Weights Table
    if result and result.node_weights_json:
        elements.append(Paragraph("13-Region Ossification Readout Weights", section_h2))
        node_rows = [["Anatomical Center", "Readout Attention Weight", "Anatomical Center", "Readout Attention Weight"]]
        items = list(result.node_weights_json.items())
        for i in range(0, len(items), 2):
            k1, v1 = items[i]
            k2, v2 = items[i+1] if i+1 < len(items) else ("", "")
            v1_str = f"{v1:.4f}" if isinstance(v1, (int, float)) else str(v1)
            v2_str = f"{v2:.4f}" if isinstance(v2, (int, float)) else str(v2)
            node_rows.append([
                Paragraph(k1.replace("_", " ").title(), body_style), Paragraph(v1_str, body_style),
                Paragraph(k2.replace("_", " ").title() if k2 else "", body_style), Paragraph(v2_str, body_style),
            ])
        t_nodes = Table(node_rows, colWidths=[160, 110, 160, 110])
        t_nodes.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), c_primary),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, c_border),
            ("BOX", (0, 0), (-1, -1), 0.5, c_border),
        ]))
        elements.append(t_nodes)
        elements.append(Spacer(1, 14))

    # 7. Regulatory & Technical Disclaimers
    elements.append(HRFlowable(width="100%", thickness=0.5, color=c_border, spaceAfter=8))
    disclaimer_text = (
        "<b>RESEARCH PROTOTYPE NOTICE:</b> This system is an investigational software-as-a-medical-device (SaMD) "
        "prototype developed for academic and scientific evaluation. It is NOT FDA-cleared, CE-marked, or validated for "
        "autonomous clinical decision-making. All skeletal age estimations, region heatmaps, and uncertainty intervals must "
        "be reviewed by a licensed pediatric radiologist alongside patient clinical history."
    )
    elements.append(Paragraph(disclaimer_text, disclaimer_style))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(f"Generated by OSGA-Net Medical Workstation v2.0 • Page 1 of 1 • Server Time: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}", subtitle_style))

    doc.build(elements)
    buffer.seek(0)
    return buffer
