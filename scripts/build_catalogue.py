#!/usr/bin/env python3
"""Normalize and classify the official ICML 2026 paper catalogue.

The source fields remain unchanged in meaning. Research and banking relevance
fields are deterministic, explainable inferences derived from title/abstract
text and are explicitly labelled as such in the output.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


CATALOGUE_SOURCE_URL = (
    "https://icml.cc/static/virtual/data/icml-2026-orals-posters.json"
)
ABSTRACT_SOURCE_URL = "https://icml.cc/static/virtual/data/icml-2026-abstracts.json"


@dataclass(frozen=True)
class TaxonomyRule:
    label: str
    patterns: tuple[str, ...]
    banking_weight: int = 0


RESEARCH_RULES = (
    TaxonomyRule(
        "Knowledge graphs & graph learning",
        (
            r"\bknowledge graphs?\b",
            r"\bgraph neural networks?\b",
            r"\bgnns?\b",
            r"\bgraph transformers?\b",
            r"\bgraph representation",
            r"\blink prediction\b",
            r"\bnode classification\b",
            r"\bheterogeneous graphs?\b",
            r"\brelational graphs?\b",
            r"\bsubgraphs?\b",
            r"\bgraph foundation models?\b",
            r"\bgraph learning\b",
        ),
        banking_weight=18,
    ),
    TaxonomyRule(
        "Time series & temporal modeling",
        (
            r"\btime[- ]series\b",
            r"\btemporal point processes?\b",
            r"\btemporal modeling\b",
            r"\btemporal graphs?\b",
            r"\bforecast(?:ing|s|ed)?\b",
            r"\blongitudinal\b",
            r"\bevent sequences?\b",
            r"\birregularly sampled\b",
            r"\bstate space models?\b",
            r"\bspatio[- ]?temporal\b",
            r"\bchange[- ]?point\b",
            r"\bnon[- ]?stationar",
            r"\bsurvival analysis\b",
            r"\bdynamical systems?\b",
        ),
        banking_weight=20,
    ),
    TaxonomyRule(
        "Tabular & structured data",
        (
            r"\btabular\b",
            r"\btabpfn\b",
            r"\btabicl\b",
            r"\btable foundation models?\b",
            r"\btabular foundation models?\b",
            r"\bstructured data\b",
            r"\bdataframes?\b",
            r"\bspreadsheets?\b",
            r"\brelational tables?\b",
            r"\brow[- ]column\b",
            r"\bgradient[- ]boost(?:ed|ing)? trees?\b",
            r"\bclassification tables?\b",
        ),
        banking_weight=22,
    ),
    TaxonomyRule(
        "Agents, reasoning & tool use",
        (
            r"\bagentic\b",
            r"\bai agents?\b",
            r"\bllm agents?\b",
            r"\bdata science agents?\b",
            r"\bmulti[- ]agent\b",
            r"\btool use\b",
            r"\btool[- ]augmented\b",
            r"\bweb agents?\b",
            r"\bworkflow automation\b",
            r"\bcomputer use\b",
            r"\bplanning agents?\b",
        ),
        banking_weight=14,
    ),
    TaxonomyRule(
        "Causal & counterfactual learning",
        (
            r"\bcausal\b",
            r"\bcounterfactual",
            r"\btreatment effects?\b",
            r"\binstrumental variables?\b",
            r"\bconfound(?:er|ing|ed)?\b",
            r"\bcausal discovery\b",
            r"\bstructural causal models?\b",
        ),
        banking_weight=13,
    ),
    TaxonomyRule(
        "Anomaly, OOD & rare events",
        (
            r"\banomal(?:y|ies|ous)\b",
            r"\boutliers?\b",
            r"\bout[- ]of[- ]distribution\b",
            r"\bood detection\b",
            r"\brare events?\b",
            r"\bnovelty detection\b",
            r"\bdistribution shifts?\b",
            r"\bconcept drifts?\b",
        ),
        banking_weight=16,
    ),
    TaxonomyRule(
        "Privacy, federated learning & security",
        (
            r"\bdifferential privacy\b",
            r"\bprivate learning\b",
            r"\bfederated learning\b",
            r"\bsecure aggregation\b",
            r"\bprivacy[- ]preserving\b",
            r"\bmachine unlearning\b",
            r"\bdata poisoning\b",
            r"\badversarial attacks?\b",
            r"\bcybersecurity\b",
        ),
        banking_weight=12,
    ),
    TaxonomyRule(
        "Robustness, uncertainty & reliability",
        (
            r"\brobust(?:ness)?\b",
            r"\buncertaint(?:y|ies)\b",
            r"\bcalibrat(?:ion|ed|ing)\b",
            r"\breliab(?:ility|le)\b",
            r"\bconformal prediction\b",
            r"\bselective prediction\b",
            r"\brisk[- ]sensitive\b",
            r"\bsafety guarantees?\b",
        ),
        banking_weight=11,
    ),
    TaxonomyRule(
        "Interpretability & explainability",
        (
            r"\binterpret(?:ability|able|ing)\b",
            r"\bexplain(?:ability|able|ing)\b",
            r"\bfeature attribution\b",
            r"\bmechanistic interpretability\b",
            r"\bconcept[- ]based\b",
            r"\bmodel explanations?\b",
        ),
        banking_weight=12,
    ),
    TaxonomyRule(
        "Foundation models & representation learning",
        (
            r"\bfoundation models?\b",
            r"\bpre[- ]?train(?:ing|ed)?\b",
            r"\bself[- ]supervised\b",
            r"\brepresentation learning\b",
            r"\bin[- ]context learning\b",
            r"\btransfer learning\b",
        ),
        banking_weight=8,
    ),
    TaxonomyRule(
        "LLMs, retrieval & language",
        (
            r"\blarge language models?\b",
            r"\bllms?\b",
            r"\bretrieval[- ]augmented\b",
            r"\brag\b",
            r"\blanguage models?\b",
            r"\bquestion answering\b",
            r"\btext generation\b",
        ),
        banking_weight=7,
    ),
    TaxonomyRule(
        "Multimodal & document intelligence",
        (
            r"\bmultimodal\b",
            r"\bvision[- ]language\b",
            r"\bdocument understanding\b",
            r"\bdocument intelligence\b",
            r"\bocr\b",
            r"\bpdf\b",
            r"\bvisual question answering\b",
            r"\bcharts?\b",
        ),
        banking_weight=9,
    ),
    TaxonomyRule(
        "Optimization, decisions & reinforcement learning",
        (
            r"\breinforcement learning\b",
            r"\bcontextual bandits?\b",
            r"\bdecision making\b",
            r"\boperations research\b",
            r"\bportfolio optimization\b",
            r"\bstochastic optimization\b",
            r"\bpolicy learning\b",
        ),
        banking_weight=7,
    ),
    TaxonomyRule(
        "Data quality, evaluation & synthetic data",
        (
            r"\bdata quality\b",
            r"\bdata valuation\b",
            r"\bdata attribution\b",
            r"\bbenchmark(?:ing|s)?\b",
            r"\bevaluation framework\b",
            r"\bsynthetic data\b",
            r"\bdata augmentation\b",
            r"\blabel noise\b",
        ),
        banking_weight=7,
    ),
    TaxonomyRule(
        "Efficient ML & systems",
        (
            r"\befficient inference\b",
            r"\bmodel compression\b",
            r"\bquantization\b",
            r"\bpruning\b",
            r"\bdistillation\b",
            r"\bdistributed training\b",
            r"\bscalab(?:ility|le)\b",
            r"\blow[- ]rank adaptation\b",
        ),
        banking_weight=4,
    ),
    TaxonomyRule(
        "AI for science & healthcare",
        (
            r"\bprotein",
            r"\bmolecul",
            r"\bgenom",
            r"\bdrug discovery\b",
            r"\bclinical\b",
            r"\bmedical\b",
            r"\bscientific discovery\b",
            r"\bweather\b",
            r"\bclimate\b",
        ),
        banking_weight=0,
    ),
)


BANKING_RULES = (
    TaxonomyRule(
        "Payments, fraud & scams",
        (
            r"\bpayments?\b",
            r"\bpayment fraud\b",
            r"\btransaction fraud\b",
            r"\bfinancial fraud\b",
            r"\bcard fraud\b",
            r"\bmerchant fraud\b",
            r"\bscams?\b",
            r"\bchargebacks?\b",
            r"\bcredit cards?\b",
            r"\bmerchants?\b",
            r"\bpoint[- ]of[- ]sale\b",
        ),
    ),
    TaxonomyRule(
        "AML, KYC & illicit-network risk",
        (
            r"\banti[- ]money laundering\b",
            r"\baml\b",
            r"\bknow your customer\b",
            r"\bkyc\b",
            r"\bmoney laundering\b",
            r"\bmoney mules?\b",
            r"\bsuspicious transactions?\b",
            r"\billicit finance\b",
            r"\bsanctions screening\b",
            r"\bbeneficial ownership\b",
        ),
    ),
    TaxonomyRule(
        "Credit, lending & customer risk",
        (
            r"\bcredit risk\b",
            r"\bcredit scoring\b",
            r"\bloan defaults?\b",
            r"\bloan approval\b",
            r"\bmortgages?\b",
            r"\bborrowers?\b",
            r"\bunderwriting\b",
            r"\bdelinquen",
            r"\blending\b",
        ),
    ),
    TaxonomyRule(
        "Markets, trading & treasury",
        (
            r"\basset pricing\b",
            r"\bstock markets?\b",
            r"\bstock price",
            r"\bportfolio optimization\b",
            r"\bportfolio allocation\b",
            r"\basset allocation\b",
            r"\balgorithmic trading\b",
            r"\bfinancial trading\b",
            r"\btrading strateg(?:y|ies)\b",
            r"\btrading agents?\b",
            r"\border books?\b",
            r"\bmarket microstructure\b",
            r"\bvolatility\b",
            r"\byield curves?\b",
            r"\boption pricing\b",
            r"\bliquidity risk\b",
            r"\btreasury\b",
            r"\bmerger[- ]arbitrage\b",
            r"\bequities\b",
        ),
    ),
    TaxonomyRule(
        "Insurance & actuarial risk",
        (
            r"\binsurance\b",
            r"\bactuarial\b",
            r"\binsurance claims?\b",
            r"\bclaim severity\b",
            r"\bclaim frequency\b",
            r"\bpolicyholders?\b",
        ),
    ),
    TaxonomyRule(
        "Regulatory & document intelligence",
        (
            r"\bregulatory\b",
            r"\bregulation\b",
            r"\bcompliance\b",
            r"\blegal documents?\b",
            r"\bfinancial disclosures?\b",
            r"\baudit reports?\b",
            r"\bpolicy documents?\b",
        ),
    ),
    TaxonomyRule(
        "Model risk, governance & responsible AI",
        (
            r"\bmodel risk\b",
            r"\bai governance\b",
            r"\bresponsible ai\b",
            r"\bfair lending\b",
            r"\balgorithmic fairness\b",
            r"\bmodel validation\b",
            r"\bmodel monitoring\b",
        ),
    ),
    TaxonomyRule(
        "Operational, cyber & resilience risk",
        (
            r"\boperational risk\b",
            r"\bcyber risk\b",
            r"\bintrusion detection\b",
            r"\bsecurity incidents?\b",
            r"\bsystem failures?\b",
            r"\bservice outages?\b",
        ),
    ),
    TaxonomyRule(
        "Entity resolution & customer identity",
        (
            r"\bentity resolution\b",
            r"\brecord linkage\b",
            r"\bdeduplication\b",
            r"\bidentity verification\b",
            r"\bname matching\b",
            r"\baddress matching\b",
        ),
    ),
    TaxonomyRule(
        "Banking intelligence & workflow agents",
        (
            r"\bfinancial agents?\b",
            r"\bbanking agents?\b",
            r"\bfinancial question answering\b",
            r"\bfinancial documents?\b",
            r"\bfinancial reports?\b",
            r"\bfinancial reasoning\b",
            r"\bfintech customer support\b",
            r"\bbanking customer support\b",
            r"\bbanking workflows?\b",
        ),
    ),
)


DIRECT_FINANCE_SIGNALS = (
    (r"\bbanking\b", 38),
    (r"\bbanks\b", 38),
    (r"\bfinance\b", 24),
    (r"\bfinancial\b", 24),
    (r"\bfintech\b", 30),
    (r"\bpayment fraud\b", 40),
    (r"\btransaction fraud\b", 38),
    (r"\bcredit risk\b", 38),
    (r"\bstock markets?\b", 32),
    (r"\bequities\b", 26),
    (r"\bportfolio optimization\b", 32),
    (r"\bportfolio allocation\b", 28),
    (r"\basset allocation\b", 28),
    (r"\basset pricing\b", 28),
    (r"\bmerger[- ]arbitrage\b", 32),
    (r"\balgorithmic trading\b", 28),
    (r"\bfinancial trading\b", 28),
    (r"\btrading strateg(?:y|ies)\b", 26),
    (r"\btrading agents?\b", 26),
    (r"\boption pricing\b", 28),
    (r"\byield curves?\b", 28),
    (r"\binsurance\b", 22),
    (r"\bactuarial\b", 24),
    (r"\bmoney laundering\b", 42),
    (r"\banti[- ]money laundering\b", 42),
    (r"\baml\b", 42),
    (r"\bkyc\b", 42),
    (r"\besg\b", 22),
)


TRANSFER_MAP = {
    "Knowledge graphs & graph learning": (
        "AML, KYC & illicit-network risk",
        "Payments, fraud & scams",
        "Entity resolution & customer identity",
    ),
    "Time series & temporal modeling": (
        "Payments, fraud & scams",
        "Markets, trading & treasury",
        "Operational, cyber & resilience risk",
    ),
    "Tabular & structured data": (
        "Credit, lending & customer risk",
        "Payments, fraud & scams",
        "Model risk, governance & responsible AI",
    ),
    "Agents, reasoning & tool use": (
        "Banking intelligence & workflow agents",
        "Regulatory & document intelligence",
    ),
    "Causal & counterfactual learning": (
        "Credit, lending & customer risk",
        "Model risk, governance & responsible AI",
    ),
    "Anomaly, OOD & rare events": (
        "Payments, fraud & scams",
        "AML, KYC & illicit-network risk",
        "Operational, cyber & resilience risk",
    ),
    "Privacy, federated learning & security": (
        "Model risk, governance & responsible AI",
        "Operational, cyber & resilience risk",
    ),
    "Robustness, uncertainty & reliability": (
        "Model risk, governance & responsible AI",
        "Credit, lending & customer risk",
    ),
    "Interpretability & explainability": (
        "Model risk, governance & responsible AI",
        "Credit, lending & customer risk",
    ),
    "LLMs, retrieval & language": (
        "Regulatory & document intelligence",
        "Banking intelligence & workflow agents",
    ),
    "Multimodal & document intelligence": (
        "Regulatory & document intelligence",
        "Entity resolution & customer identity",
    ),
    "Data quality, evaluation & synthetic data": (
        "Model risk, governance & responsible AI",
    ),
}


def normalize_text(value: str | None) -> str:
    text = value or ""
    text = text.replace("\u2013", "-").replace("\u2014", "-")
    return re.sub(r"\s+", " ", text).strip()


def pattern_hits(text: str, patterns: Iterable[str]) -> list[str]:
    hits = []
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            hits.append(match.group(0))
    return hits


def classify_research(title: str, abstract: str) -> tuple[list[str], dict[str, list[str]]]:
    combined = f"{title}. {abstract}"
    tags = []
    evidence: dict[str, list[str]] = {}
    for rule in RESEARCH_RULES:
        title_hits = pattern_hits(title, rule.patterns)
        abstract_hits = pattern_hits(abstract, rule.patterns)
        if title_hits or abstract_hits:
            tags.append(rule.label)
            evidence[rule.label] = list(dict.fromkeys(title_hits + abstract_hits))[:4]
    return tags, evidence


def classify_banking(
    title: str, abstract: str, research_tags: list[str]
) -> tuple[list[str], list[str], dict[str, list[str]]]:
    combined = f"{title}. {abstract}"
    direct_tags = []
    evidence: dict[str, list[str]] = {}
    for rule in BANKING_RULES:
        hits = pattern_hits(combined, rule.patterns)
        if hits:
            direct_tags.append(rule.label)
            evidence[rule.label] = list(dict.fromkeys(hits))[:4]

    inferred_tags = []
    for research_tag in research_tags:
        for banking_tag in TRANSFER_MAP.get(research_tag, ()):
            if banking_tag not in direct_tags and banking_tag not in inferred_tags:
                inferred_tags.append(banking_tag)

    return direct_tags, inferred_tags, evidence


def relevance_score(
    title: str,
    abstract: str,
    research_tags: list[str],
    direct_banking_tags: list[str],
    research_evidence: dict[str, list[str]],
) -> tuple[int, int]:
    direct_score = 0
    for pattern, weight in DIRECT_FINANCE_SIGNALS:
        if re.search(pattern, title, flags=re.IGNORECASE):
            direct_score += weight + 8
        elif re.search(pattern, abstract, flags=re.IGNORECASE):
            direct_score += max(8, round(weight * 0.35))
    direct_score = min(70, direct_score)

    weight_by_tag = {rule.label: rule.banking_weight for rule in RESEARCH_RULES}
    method_score = sum(weight_by_tag.get(tag, 0) for tag in research_tags[:4])

    title_boost = 0
    for tag, hits in research_evidence.items():
        if any(re.search(re.escape(hit), title, flags=re.IGNORECASE) for hit in hits):
            title_boost += min(5, weight_by_tag.get(tag, 0) // 3)

    synergy = 0
    tag_set = set(research_tags)
    if {
        "Knowledge graphs & graph learning",
        "Time series & temporal modeling",
    }.issubset(tag_set):
        synergy += 9
    if {
        "Knowledge graphs & graph learning",
        "Anomaly, OOD & rare events",
    }.issubset(tag_set):
        synergy += 8
    if {
        "Tabular & structured data",
        "Foundation models & representation learning",
    }.issubset(tag_set):
        synergy += 9
    if {
        "Agents, reasoning & tool use",
        "LLMs, retrieval & language",
    }.issubset(tag_set):
        synergy += 5
    if (
        "Foundation models & representation learning" in tag_set
        and (
            "Time series & temporal modeling" in tag_set
            or "Tabular & structured data" in tag_set
            or "Knowledge graphs & graph learning" in tag_set
        )
        and re.search(r"\bfoundation models?\b", title, flags=re.IGNORECASE)
    ):
        synergy += 18
    if {
        "Knowledge graphs & graph learning",
        "Time series & temporal modeling",
        "Interpretability & explainability",
    }.issubset(tag_set):
        synergy += 12

    domain_penalty = 0
    if "AI for science & healthcare" in tag_set and direct_score < 24:
        domain_penalty = 24

    total = min(
        100,
        max(
            0,
            direct_score
            + min(46, method_score)
            + title_boost
            + synergy
            - domain_penalty,
        ),
    )
    return total, direct_score


def relevance_tier(score: int, direct_score: int) -> str:
    if direct_score >= 22 or score >= 75:
        return "A - highest priority"
    if score >= 50:
        return "B - strong transfer potential"
    if score >= 30:
        return "C - useful research enabler"
    return "D - general ICML catalogue"


def classification_confidence(
    abstract: str,
    direct_score: int,
    research_evidence: dict[str, list[str]],
) -> str:
    evidence_count = sum(len(hits) for hits in research_evidence.values())
    if direct_score >= 22 or evidence_count >= 5:
        return "high"
    if abstract and evidence_count >= 2:
        return "medium"
    return "low"


def build_rationale(
    research_tags: list[str],
    direct_banking_tags: list[str],
    inferred_banking_tags: list[str],
    direct_score: int,
) -> str:
    method_text = ", ".join(research_tags[:3]) or "general machine learning"
    if direct_banking_tags:
        use_text = ", ".join(direct_banking_tags[:3])
        return (
            f"Direct domain signal for {use_text}; primary method signals: {method_text}. "
            "Banking relevance is supported by explicit title/abstract terminology."
        )
    if inferred_banking_tags:
        use_text = ", ".join(inferred_banking_tags[:3])
        return (
            f"Transfer hypothesis: {method_text} may support {use_text}. "
            "This is an inferred method-to-use-case fit; the paper is not claimed to "
            "have evaluated a banking application."
        )
    if direct_score:
        return (
            f"Financial terminology was detected alongside {method_text}, but no "
            "specific banking use case met the classification threshold."
        )
    return (
        f"Catalogue classification: {method_text}. No material banking-domain signal "
        "was detected from the title and abstract."
    )


def compact_author(author: dict) -> dict:
    return {
        "name": normalize_text(author.get("fullname")),
        "institution": normalize_text(author.get("institution")),
    }


def source_links(event: dict) -> list[dict]:
    links: list[dict] = []
    paper_url = normalize_text(event.get("paper_url"))
    if paper_url:
        links.append({"label": "Paper", "url": paper_url})
    for media in event.get("eventmedia", []):
        uri = normalize_text(media.get("uri"))
        if not uri.startswith(("https://", "http://")):
            continue
        links.append(
            {
                "label": normalize_text(media.get("name")) or "External source",
                "url": uri,
            }
        )

    deduplicated = []
    seen = set()
    for link in links:
        clean_url = link["url"].split("&referrer=")[0]
        if clean_url in seen:
            continue
        seen.add(clean_url)
        deduplicated.append({"label": link["label"], "url": clean_url})
    return deduplicated


def build_record(event: dict, abstract: str) -> dict:
    title = normalize_text(event.get("name"))
    abstract = normalize_text(abstract)
    research_tags, research_evidence = classify_research(title, abstract)
    direct_banking_tags, inferred_banking_tags, banking_evidence = classify_banking(
        title, abstract, research_tags
    )
    score, direct_score = relevance_score(
        title, abstract, research_tags, direct_banking_tags, research_evidence
    )
    tier = relevance_tier(score, direct_score)
    confidence = classification_confidence(
        abstract, direct_score, research_evidence
    )
    links = source_links(event)
    manuscript_url = next(
        (
            link["url"]
            for link in links
            if any(
                host in link["url"]
                for host in ("openreview.net", "arxiv.org", "jmlr.org", "proceedings.mlr")
            )
        ),
        links[0]["url"] if links else None,
    )
    paper_url = next(
        (link["url"] for link in links if "openreview.net" in link["url"]),
        None,
    )
    pdf_url = None
    if paper_url and "openreview.net/forum?id=" in paper_url:
        pdf_url = paper_url.replace("/forum?id=", "/pdf?id=")
    elif paper_url and "openreview.net/pdf?id=" in paper_url:
        pdf_url = paper_url

    return {
        "id": event["id"],
        "event_ids": event.get("_event_ids", [event["id"]]),
        "title": title,
        "authors": [compact_author(author) for author in event.get("authors", [])],
        "abstract": abstract,
        "decision": event.get("decision"),
        "presentation": event.get("eventtype") or event.get("event_type"),
        "presentations": event.get(
            "_presentation_types",
            [event.get("eventtype") or event.get("event_type")],
        ),
        "session": normalize_text(event.get("session")),
        "oral_sessions": event.get("_oral_sessions", []),
        "room": normalize_text(event.get("room_name")),
        "start_time": event.get("starttime"),
        "oral_start_times": event.get("_oral_start_times", []),
        "icml_url": f"https://icml.cc{event.get('virtualsite_url')}",
        "manuscript_url": manuscript_url,
        "openreview_url": paper_url,
        "openreview_pdf_url": pdf_url,
        "source_links": links,
        "research_tags": research_tags,
        "banking_tags_direct": direct_banking_tags,
        "banking_tags_inferred": inferred_banking_tags,
        "banking_relevance_score": score,
        "banking_direct_score": direct_score,
        "relevance_tier": tier,
        "classification_confidence": confidence,
        "relevance_rationale": build_rationale(
            research_tags,
            direct_banking_tags,
            inferred_banking_tags,
            direct_score,
        ),
        "classification_evidence": {
            "research": research_evidence,
            "banking_direct": banking_evidence,
        },
    }


def merge_duplicate_events(
    events: list[dict], abstracts: dict[str, str]
) -> tuple[list[dict], int]:
    """Collapse oral schedule duplicates into their canonical paper record."""

    grouped: dict[str, list[dict]] = {}
    for event in events:
        grouped.setdefault(normalize_text(event.get("name")).casefold(), []).append(event)

    merged = []
    duplicate_count = 0
    for group in grouped.values():
        duplicate_count += max(0, len(group) - 1)
        base = next(
            (
                event
                for event in group
                if (event.get("eventtype") or event.get("event_type")) == "Poster"
                and event.get("paper_url")
            ),
            next(
                (
                    event
                    for event in group
                    if (event.get("eventtype") or event.get("event_type")) == "Poster"
                ),
                group[0],
            ),
        ).copy()
        base["_event_ids"] = [event["id"] for event in group]
        base["_presentation_types"] = list(
            dict.fromkeys(
                event.get("eventtype") or event.get("event_type") for event in group
            )
        )
        base["_oral_sessions"] = [
            normalize_text(event.get("session"))
            for event in group
            if (event.get("eventtype") or event.get("event_type")) == "Oral"
        ]
        base["_oral_start_times"] = [
            event.get("starttime")
            for event in group
            if (event.get("eventtype") or event.get("event_type")) == "Oral"
        ]
        base["_abstract"] = max(
            (normalize_text(abstracts.get(str(event["id"]), "")) for event in group),
            key=len,
            default="",
        )
        merged.append(base)
    return merged, duplicate_count


def summarize(records: list[dict], source_entry_count: int, duplicate_count: int) -> dict:
    research_counts = Counter(
        tag for record in records for tag in record["research_tags"]
    )
    direct_banking_counts = Counter(
        tag for record in records for tag in record["banking_tags_direct"]
    )
    inferred_banking_counts = Counter(
        tag for record in records for tag in record["banking_tags_inferred"]
    )
    tier_counts = Counter(record["relevance_tier"] for record in records)
    confidence_counts = Counter(
        record["classification_confidence"] for record in records
    )
    return {
        "paper_count": len(records),
        "source_entry_count": source_entry_count,
        "oral_duplicate_count": duplicate_count,
        "with_abstract": sum(bool(record["abstract"]) for record in records),
        "with_manuscript_link": sum(
            bool(record["manuscript_url"]) for record in records
        ),
        "with_openreview": sum(bool(record["openreview_url"]) for record in records),
        "research_tag_counts": dict(research_counts.most_common()),
        "direct_banking_tag_counts": dict(direct_banking_counts.most_common()),
        "inferred_banking_tag_counts": dict(inferred_banking_counts.most_common()),
        "tier_counts": dict(tier_counts),
        "confidence_counts": dict(confidence_counts),
        "top_banking_relevant": [
            {
                "id": record["id"],
                "title": record["title"],
                "score": record["banking_relevance_score"],
                "tier": record["relevance_tier"],
                "direct_tags": record["banking_tags_direct"],
                "research_tags": record["research_tags"],
            }
            for record in sorted(
                records,
                key=lambda item: (
                    item["banking_relevance_score"],
                    item["banking_direct_score"],
                    item["decision"] == "Accept (spotlight)",
                ),
                reverse=True,
            )[:50]
        ],
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalogue", type=Path, required=True)
    parser.add_argument("--abstracts", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--audit", type=Path, required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    catalogue = json.loads(args.catalogue.read_text(encoding="utf-8"))
    abstracts = json.loads(args.abstracts.read_text(encoding="utf-8"))

    events = catalogue["results"]
    events, duplicate_count = merge_duplicate_events(events, abstracts)
    records = [
        build_record(event, event.get("_abstract", abstracts.get(str(event["id"]), "")))
        for event in events
    ]
    records.sort(
        key=lambda item: (
            item["banking_relevance_score"],
            item["banking_direct_score"],
            item["decision"] == "Accept (spotlight)",
            item["title"].lower(),
        ),
        reverse=True,
    )

    payload = {
        "metadata": {
            "conference": "ICML 2026",
            "generated_on": "2026-06-15",
            "source_catalogue_url": CATALOGUE_SOURCE_URL,
            "source_abstract_url": ABSTRACT_SOURCE_URL,
            "source_scope": (
                "Official ICML 2026 orals/posters catalogue and official abstract file."
            ),
            "source_entry_count": catalogue.get("count", len(catalogue["results"])),
            "unique_paper_count": len(records),
            "oral_duplicate_count": duplicate_count,
            "classification_method": (
                "Deterministic keyword and method-to-banking transfer rules. "
                "Direct tags are source-text observations; inferred tags are labelled "
                "transfer hypotheses and are not claims made by the paper authors."
            ),
        },
        "papers": records,
    }
    audit = summarize(
        records,
        source_entry_count=catalogue.get("count", len(catalogue["results"])),
        duplicate_count=duplicate_count,
    )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.audit.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    args.audit.write_text(
        json.dumps(audit, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(
        json.dumps(
            {
                "paper_count": audit["paper_count"],
                "with_abstract": audit["with_abstract"],
                "with_openreview": audit["with_openreview"],
                "with_manuscript_link": audit["with_manuscript_link"],
                "tier_counts": audit["tier_counts"],
                "output": str(args.output),
                "audit": str(args.audit),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
