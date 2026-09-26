"""Knowledge-base seed records (spec §10).

Every chunk is an ORIGINAL plain-language summary of publicly-available,
reputable general post-discharge guidance — not copied from copyrighted
sources, not patient-specific. Chunk texts target 200-500 words (spec §10).

Categories align with what retrieval filtering and the main ARIA risk engine
use: medication, diet, activity, wound, red_flags, process, faq.
"""

from __future__ import annotations

from app.kb_store import KBRecord


def chunk(source_title: str, source_type: str, category: str, text: str, tags: list[str]) -> KBRecord:
    return KBRecord(
        source_title=source_title,
        source_type=source_type,  # guideline | drug_info | faq | discharge_template
        category=category,
        text=" ".join(text.split()),
        tags=tags,
    )


def all_chunks() -> list[KBRecord]:
    from seed import diet_activity, faq, medication_adherence, red_flags, risk_tiers, wound_care

    modules = (wound_care, medication_adherence, diet_activity, red_flags, risk_tiers, faq)
    records: list[KBRecord] = []
    for module in modules:
        records.extend(module.CHUNKS)
    return records
