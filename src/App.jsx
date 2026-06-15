import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowDownWideShort,
  faArrowUpRightFromSquare,
  faBell,
  faBookmark,
  faBookOpen,
  faBuildingColumns,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faCircleCheck,
  faCircleInfo,
  faCircleQuestion,
  faClock,
  faCodeCompare,
  faDatabase,
  faDownload,
  faFilePdf,
  faLayerGroup,
  faLink,
  faLock,
  faMagnifyingGlass,
  faNetworkWired,
  faPlus,
  faRobot,
  faRotateLeft,
  faScaleBalanced,
  faShieldHalved,
  faTableCellsLarge,
  faTableColumns,
  faTriangleExclamation,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import payload from "./catalogue.json";

const PAPERS = payload.papers;
const META = payload.metadata;
const PAGE_SIZES = [10, 25, 50, 100];
const PRIORITY_METHODS = [
  "Knowledge graphs & graph learning",
  "Time series & temporal modeling",
  "Tabular & structured data",
  "Agents, reasoning & tool use",
  "Causal & counterfactual learning",
  "Anomaly, OOD & rare events",
  "Privacy, federated learning & security",
  "Robustness, uncertainty & reliability",
  "Interpretability & explainability",
  "LLMs, retrieval & language",
];
const BANKING_ORDER = [
  "Payments, fraud & scams",
  "AML, KYC & illicit-network risk",
  "Credit, lending & customer risk",
  "Markets, trading & treasury",
  "Regulatory & document intelligence",
  "Model risk, governance & responsible AI",
  "Operational, cyber & resilience risk",
  "Entity resolution & customer identity",
  "Banking intelligence & workflow agents",
  "Insurance & actuarial risk",
];
const METHOD_SHORT_LABELS = {
  "Knowledge graphs & graph learning": "Graph & knowledge graphs",
  "Time series & temporal modeling": "Temporal & time series",
  "Tabular & structured data": "Tabular foundation models",
  "Agents, reasoning & tool use": "Agents & decision systems",
  "Causal & counterfactual learning": "Causal & counterfactual",
  "Anomaly, OOD & rare events": "Anomaly detection",
  "Privacy, federated learning & security": "Privacy & federated",
  "Robustness, uncertainty & reliability": "Robustness & OOD",
  "Interpretability & explainability": "Interpretability",
  "LLMs, retrieval & language": "LLMs & retrieval",
};
const BANKING_SHORT_LABELS = {
  "Payments, fraud & scams": "Payments & transfers",
  "AML, KYC & illicit-network risk": "AML / money-mule detection",
  "Credit, lending & customer risk": "Credit risk",
  "Markets, trading & treasury": "Markets & treasury",
  "Regulatory & document intelligence": "Regulatory intelligence",
  "Model risk, governance & responsible AI": "Model risk management",
  "Operational, cyber & resilience risk": "Operational risk",
  "Entity resolution & customer identity": "Entity resolution",
  "Banking intelligence & workflow agents": "Banking workflow agents",
  "Insurance & actuarial risk": "Insurance risk",
};

const METHOD_ICONS = {
  "Knowledge graphs & graph learning": faNetworkWired,
  "Time series & temporal modeling": faClock,
  "Tabular & structured data": faTableCellsLarge,
  "Agents, reasoning & tool use": faRobot,
  "Causal & counterfactual learning": faScaleBalanced,
  "Anomaly, OOD & rare events": faTriangleExclamation,
  "Privacy, federated learning & security": faLock,
  "Robustness, uncertainty & reliability": faShieldHalved,
  "Interpretability & explainability": faCircleInfo,
  "LLMs, retrieval & language": faBookOpen,
};

function loadStored(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function toggleArray(setter, value) {
  setter((current) =>
    current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value],
  );
}

function authorLine(paper, limit = 4) {
  const names = paper.authors.slice(0, limit).map((author) => author.name);
  return `${names.join(", ")}${paper.authors.length > limit ? ", et al." : ""}`;
}

function sourceType(paper) {
  const url = paper.manuscript_url || "";
  if (url.includes("openreview.net")) return "OpenReview";
  if (url.includes("arxiv.org")) return "arXiv";
  if (url.includes("jmlr.org")) return "JMLR";
  if (url.includes("proceedings.mlr")) return "PMLR";
  return "Manuscript";
}

function scoreClass(score) {
  if (score >= 75) return "score-high";
  if (score >= 50) return "score-medium";
  if (score >= 30) return "score-low";
  return "score-muted";
}

function confidenceValue(confidence) {
  return { high: 3, medium: 2, low: 1 }[confidence] || 0;
}

function tierLabel(paper) {
  if (paper.relevance_tier.startsWith("A -")) {
    return paper.banking_tags_direct.length
      ? "direct / highest priority"
      : "highest-priority transfer";
  }
  return paper.relevance_tier.replace(/^[A-D]\s-\s/, "");
}

function countTags(papers, accessor) {
  const counts = new Map();
  papers.forEach((paper) => {
    accessor(paper).forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
  });
  return counts;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function FilterCheck({ checked, label, count, onChange, icon }) {
  return (
    <label className="filter-check">
      <span className="filter-check-main">
        <input type="checkbox" checked={checked} onChange={onChange} />
        {icon ? <FontAwesomeIcon icon={icon} /> : null}
        <span>{label}</span>
      </span>
      <span className="filter-count">{count.toLocaleString()}</span>
    </label>
  );
}

function ScoreBar({ value, compact = false }) {
  return (
    <span className={`score-bar ${compact ? "compact" : ""}`} aria-hidden="true">
      <span style={{ width: `${Math.max(3, value)}%` }} />
    </span>
  );
}

function FlowMap({ papers, onMethod, onBanking }) {
  const canvasRef = useRef(null);
  const research = useMemo(() => {
    const counts = countTags(papers, (paper) => paper.research_tags);
    return PRIORITY_METHODS.map((label) => ({
      label,
      count: counts.get(label) || 0,
    }))
      .filter((item) => item.count)
      .slice(0, 7);
  }, [papers]);
  const banking = useMemo(() => {
    const counts = countTags(papers, (paper) => [
      ...paper.banking_tags_direct,
      ...paper.banking_tags_inferred,
    ]);
    return BANKING_ORDER.map((label) => ({
      label,
      count: counts.get(label) || 0,
    }))
      .filter((item) => item.count)
      .slice(0, 7);
  }, [papers]);
  const pairs = useMemo(() => {
    const researchLabels = new Set(research.map((item) => item.label));
    const bankingLabels = new Set(banking.map((item) => item.label));
    const counts = new Map();
    papers.forEach((paper) => {
      paper.research_tags
        .filter((tag) => researchLabels.has(tag))
        .forEach((researchTag) => {
          [
            ...new Set([
              ...paper.banking_tags_direct,
              ...paper.banking_tags_inferred,
            ]),
          ]
            .filter((tag) => bankingLabels.has(tag))
            .forEach((bankingTag) => {
              const key = `${researchTag}|||${bankingTag}`;
              counts.set(key, (counts.get(key) || 0) + 1);
            });
        });
    });
    return [...counts.entries()]
      .map(([key, count]) => ({ tags: key.split("|||"), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 22);
  }, [papers, research, banking]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      canvas.width = rect.width * scale;
      canvas.height = rect.height * scale;
      const ctx = canvas.getContext("2d");
      ctx.scale(scale, scale);
      ctx.clearRect(0, 0, rect.width, rect.height);
      const leftIndex = new Map(research.map((item, index) => [item.label, index]));
      const rightIndex = new Map(banking.map((item, index) => [item.label, index]));
      const leftStep = rect.height / Math.max(1, research.length);
      const rightStep = rect.height / Math.max(1, banking.length);
      const maxPair = Math.max(1, ...pairs.map((pair) => pair.count));
      pairs.forEach(({ tags, count }) => {
        const leftY = leftStep * (leftIndex.get(tags[0]) + 0.5);
        const rightY = rightStep * (rightIndex.get(tags[1]) + 0.5);
        ctx.beginPath();
        ctx.moveTo(0, leftY);
        ctx.bezierCurveTo(
          rect.width * 0.38,
          leftY,
          rect.width * 0.62,
          rightY,
          rect.width,
          rightY,
        );
        ctx.lineWidth = 0.5 + (count / maxPair) * 2.5;
        ctx.strokeStyle = `rgba(172, 86, 34, ${0.12 + (count / maxPair) * 0.35})`;
        ctx.stroke();
      });
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [research, banking, pairs]);

  return (
    <section className="flow-panel">
      <div className="section-label">
        Topic flow <span>(methods → banking applications)</span>
      </div>
      <div className="flow-grid">
        <div className="flow-list methods">
          {research.map((item) => (
            <button key={item.label} type="button" onClick={() => onMethod(item.label)}>
              <span>{item.label}</span>
              <strong>{item.count.toLocaleString()}</strong>
            </button>
          ))}
        </div>
        <div className="flow-canvas-wrap">
          <canvas ref={canvasRef} />
        </div>
        <div className="flow-list banking">
          {banking.map((item) => (
            <button key={item.label} type="button" onClick={() => onBanking(item.label)}>
              <span>{item.label}</span>
              <strong>{item.count.toLocaleString()}</strong>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function SummaryPanel({ papers }) {
  const stats = useMemo(
    () => ({
      high: papers.filter((paper) => paper.banking_relevance_score >= 75).length,
      direct: papers.filter((paper) => paper.banking_tags_direct.length).length,
      spotlight: papers.filter((paper) => paper.decision === "Accept (spotlight)")
        .length,
      openreview: papers.filter((paper) => paper.openreview_url).length,
      methods: new Set(papers.flatMap((paper) => paper.research_tags)).size,
      confidence: papers.length
        ? (
            papers.reduce(
              (sum, paper) => sum + confidenceValue(paper.classification_confidence),
              0,
            ) /
            papers.length /
            3
          ).toFixed(2)
        : "0.00",
    }),
    [papers],
  );
  const items = [
    ["High-priority papers", stats.high, faBookmark],
    ["Direct banking signal", stats.direct, faBuildingColumns],
    ["ICML spotlights", stats.spotlight, faLayerGroup],
    ["OpenReview sources", stats.openreview, faCircleCheck],
    ["Methods covered", stats.methods, faDatabase],
    ["Avg. evidence strength", stats.confidence, faShieldHalved],
  ];
  return (
    <section className="summary-panel">
      <div className="section-label">Ledger summary</div>
      <div className="summary-grid">
        {items.map(([label, value, icon]) => (
          <div className="summary-item" key={label}>
            <FontAwesomeIcon icon={icon} />
            <span>{label}</span>
            <strong>{typeof value === "number" ? value.toLocaleString() : value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function SourceLinks({ paper, compact = false }) {
  return (
    <div className={`source-links ${compact ? "compact" : ""}`}>
      <a href={paper.icml_url} target="_blank" rel="noreferrer">
        <FontAwesomeIcon icon={faBookOpen} />
        ICML
      </a>
      {paper.openreview_url ? (
        <a href={paper.openreview_url} target="_blank" rel="noreferrer">
          <FontAwesomeIcon icon={faCircleCheck} />
          OpenReview
        </a>
      ) : (
        <a href={paper.manuscript_url} target="_blank" rel="noreferrer">
          <FontAwesomeIcon icon={faLink} />
          {sourceType(paper)}
        </a>
      )}
      {!compact && paper.openreview_pdf_url ? (
        <a href={paper.openreview_pdf_url} target="_blank" rel="noreferrer">
          <FontAwesomeIcon icon={faFilePdf} />
          PDF
        </a>
      ) : null}
    </div>
  );
}

function EvidenceLineage({ paper }) {
  const researchEvidence = Object.entries(
    paper.classification_evidence.research || {},
  );
  return (
    <div className="lineage">
      <div className="lineage-title">Evidence lineage</div>
      <div className="lineage-steps">
        <div className="lineage-step">
          <span className="step-number">1. Paper</span>
          <strong>{paper.title}</strong>
          <p>{paper.abstract.slice(0, 250)}{paper.abstract.length > 250 ? "…" : ""}</p>
        </div>
        <div className="lineage-arrow">→</div>
        <div className="lineage-step">
          <span className="step-number">2. Method evidence</span>
          <strong>{paper.research_tags.slice(0, 3).join(" · ") || "Unclassified"}</strong>
          <p>
            {researchEvidence.length
              ? researchEvidence
                  .slice(0, 3)
                  .map(([tag, hits]) => `${tag}: ${hits.join(", ")}`)
                  .join(" | ")
              : "No configured method phrase exceeded the classification threshold."}
          </p>
        </div>
        <div className="lineage-arrow">→</div>
        <div className="lineage-step">
          <span className="step-number">3. Banking interpretation</span>
          <strong>
            {paper.banking_tags_direct.length
              ? "Direct source-text signal"
              : "Inferred transfer hypothesis"}
          </strong>
          <p>{paper.relevance_rationale}</p>
        </div>
        <div className="lineage-arrow">→</div>
        <div className="lineage-step provenance-step">
          <span className="step-number">4. Source provenance</span>
          <strong>{sourceType(paper)} manuscript</strong>
          <p>
            ICML event {paper.id}; {paper.presentations.join(" + ")}; classification
            confidence {paper.classification_confidence}.
          </p>
          <SourceLinks paper={paper} />
        </div>
      </div>
      <div className="lineage-footer">
        <span>
          Confidence (automated)
          <strong>{paper.classification_confidence}</strong>
        </span>
        <span>
          Banking score
          <strong>{paper.banking_relevance_score}/100</strong>
        </span>
        <span>
          Relevance tier
          <strong>{paper.relevance_tier.slice(0, 1)}</strong>
        </span>
        <span>
          Interpretation
          <strong>{paper.banking_tags_direct.length ? "direct" : "transfer"}</strong>
        </span>
      </div>
    </div>
  );
}

function PaperRow({
  paper,
  index,
  expanded,
  compared,
  saved,
  onExpand,
  onDetail,
  onCompare,
  onSave,
}) {
  const bankingTags = [
    ...paper.banking_tags_direct,
    ...paper.banking_tags_inferred,
  ].slice(0, 2);
  return (
    <>
      <tr
        className={[
          "paper-row",
          expanded ? "expanded" : "",
          compared ? "compared" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <td className="select-cell">
          <input
            type="checkbox"
            checked={compared}
            onChange={() => onCompare(paper.id)}
            aria-label={`Compare ${paper.title}`}
          />
        </td>
        <td className="rank-cell">{index}</td>
        <td className="paper-cell">
          <button type="button" className="paper-title" onClick={() => onDetail(paper.id)}>
            {paper.title}
          </button>
          <div className="authors">{authorLine(paper)}</div>
          <div className="paper-meta">
            <span>{paper.presentations.join(" + ")}</span>
            {paper.decision === "Accept (spotlight)" ? (
              <span className="spotlight">Spotlight</span>
            ) : null}
            <button type="button" className="inline-action" onClick={() => onSave(paper.id)}>
              <FontAwesomeIcon icon={faBookmark} />
              {saved ? "Saved" : "Save"}
            </button>
          </div>
          <p>{paper.abstract.slice(0, 170)}{paper.abstract.length > 170 ? "…" : ""}</p>
        </td>
        <td>
          <strong className="method-primary">
            {paper.research_tags[0] || "General ML"}
          </strong>
          <span className="secondary-cell">
            {paper.research_tags.slice(1, 3).join(", ")}
          </span>
        </td>
        <td>
          {bankingTags.length ? (
            bankingTags.map((tag, tagIndex) => (
              <span
                className={`banking-label ${
                  tagIndex < paper.banking_tags_direct.length ? "direct" : "inferred"
                }`}
                key={tag}
              >
                {tag}
              </span>
            ))
          ) : (
            <span className="secondary-cell">No material banking signal</span>
          )}
        </td>
        <td className="confidence-cell">
          <strong>{paper.classification_confidence}</strong>
          <span>{paper.classification_confidence === "high" ? "Strong" : "Review"}</span>
          <div className={`confidence-bars ${paper.classification_confidence}`}>
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </td>
        <td className="relevance-cell">
          <strong>{(paper.banking_relevance_score / 100).toFixed(2)}</strong>
          <ScoreBar value={paper.banking_relevance_score} compact />
          <span>{tierLabel(paper)}</span>
        </td>
        <td>
          <SourceLinks paper={paper} compact />
        </td>
        <td className="updated-cell">
          <span>{paper.session || "Main conference"}</span>
          <button
            type="button"
            className="expand-button"
            onClick={() => onExpand(paper.id)}
            aria-label={`${expanded ? "Collapse" : "Expand"} evidence for ${paper.title}`}
          >
            <FontAwesomeIcon icon={expanded ? faChevronDown : faChevronRight} />
          </button>
        </td>
      </tr>
      {expanded ? (
        <tr className="lineage-row">
          <td colSpan="9">
            <EvidenceLineage paper={paper} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function DetailDrawer({ paper, saved, onClose, onSave }) {
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (paper) setNotes(loadStored(`icml-note-${paper.id}`, ""));
  }, [paper]);
  if (!paper) return null;
  const saveNotes = (value) => {
    setNotes(value);
    localStorage.setItem(`icml-note-${paper.id}`, JSON.stringify(value));
  };
  return (
    <aside className="detail-drawer" aria-label="Paper detail">
      <div className="drawer-header">
        <span>Paper evidence</span>
        <button type="button" onClick={onClose} aria-label="Close paper detail">
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>
      <div className="drawer-body">
        <div className="drawer-kicker">
          ICML {paper.id} · {paper.presentations.join(" + ")}
        </div>
        <h2>{paper.title}</h2>
        <p className="drawer-authors">{authorLine(paper, 8)}</p>
        <div className="drawer-score-row">
          <div>
            <span>Banking relevance</span>
            <strong>{paper.banking_relevance_score}/100</strong>
          </div>
          <div>
            <span>Evidence confidence</span>
            <strong>{paper.classification_confidence}</strong>
          </div>
          <div>
            <span>Interpretation</span>
            <strong>{paper.banking_tags_direct.length ? "Direct" : "Transfer"}</strong>
          </div>
        </div>
        <section>
          <h3>Abstract</h3>
          <p>{paper.abstract}</p>
        </section>
        <section>
          <h3>Banking relevance rationale</h3>
          <p>{paper.relevance_rationale}</p>
          <div className="tag-stack">
            {paper.banking_tags_direct.map((tag) => (
              <span className="banking-label direct" key={tag}>
                Direct · {tag}
              </span>
            ))}
            {paper.banking_tags_inferred.slice(0, 5).map((tag) => (
              <span className="banking-label inferred" key={tag}>
                Transfer · {tag}
              </span>
            ))}
          </div>
        </section>
        <section>
          <h3>Method classification</h3>
          <div className="tag-stack">
            {paper.research_tags.map((tag) => (
              <span className="method-chip" key={tag}>
                {tag}
              </span>
            ))}
          </div>
          <dl className="evidence-terms">
            {Object.entries(paper.classification_evidence.research || {}).map(
              ([tag, terms]) => (
                <React.Fragment key={tag}>
                  <dt>{tag}</dt>
                  <dd>{terms.join(", ")}</dd>
                </React.Fragment>
              ),
            )}
          </dl>
        </section>
        <section>
          <h3>Source provenance</h3>
          <SourceLinks paper={paper} />
          <p className="provenance-note">
            Official ICML catalogue record joined to the official abstract file.
            Classification is deterministic and reviewable; inferred banking use cases
            are not author claims.
          </p>
        </section>
        <section>
          <div className="notes-heading">
            <h3>Research notes</h3>
            <button type="button" onClick={() => onSave(paper.id)}>
              <FontAwesomeIcon icon={faBookmark} />
              {saved ? "Remove from queue" : "Add to queue"}
            </button>
          </div>
          <textarea
            value={notes}
            onChange={(event) => saveNotes(event.target.value)}
            placeholder="Capture validation questions, banking analogies, datasets, or follow-up actions…"
          />
        </section>
      </div>
    </aside>
  );
}

function ComparisonTray({
  papers,
  onRemove,
  onOpen,
  collapsed,
  onToggle,
  sectionRef,
}) {
  if (!papers.length) return null;
  const questions = [
    "How do the methods differ in assumptions, supervision, and computational cost?",
    "Which evaluation settings are closest to transaction, customer, or control data?",
    "What evidence is still missing before a banking pilot or model-risk review?",
  ];
  return (
    <section
      ref={sectionRef}
      className={`comparison-tray ${collapsed ? "collapsed" : ""}`}
      tabIndex="-1"
      aria-label="Paper comparison workspace"
    >
      <div className="comparison-header">
        <span>
          Comparison tray <strong>({papers.length} papers)</strong>
        </span>
        <button type="button" onClick={onToggle}>
          {collapsed ? "Expand" : "Collapse"}
          <FontAwesomeIcon icon={collapsed ? faChevronDown : faChevronRight} />
        </button>
      </div>
      {!collapsed ? (
        <div className="comparison-content">
          <div className="compare-cards">
            {papers.map((paper, index) => (
              <article className="compare-card" key={paper.id}>
                <span className="compare-number">{index + 1}</span>
                <button
                  type="button"
                  className="compare-remove"
                  onClick={() => onRemove(paper.id)}
                  aria-label={`Remove ${paper.title} from comparison`}
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
                <h3>{paper.title}</h3>
                <dl>
                  <dt>Method</dt>
                  <dd>{paper.research_tags[0] || "General ML"}</dd>
                  <dt>Banking fit</dt>
                  <dd>
                    {paper.banking_tags_direct[0] ||
                      paper.banking_tags_inferred[0] ||
                      "No material signal"}
                  </dd>
                  <dt>Evidence</dt>
                  <dd>{paper.classification_confidence}</dd>
                  <dt>Relevance</dt>
                  <dd>{paper.banking_relevance_score}/100</dd>
                </dl>
                <button type="button" className="text-button" onClick={() => onOpen(paper.id)}>
                  View full evidence
                </button>
              </article>
            ))}
          </div>
          <div className="research-questions">
            <h3>Research questions</h3>
            {questions.map((question, index) => (
              <div key={question}>
                <span>{index + 1}</span>
                <p>{question}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AboutModal({ onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="about-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Close methodology"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
        <div className="modal-kicker">Research methodology</div>
        <h2 id="about-title">How to read the Evidence Ledger</h2>
        <p>
          The catalogue contains {PAPERS.length.toLocaleString()} unique ICML 2026
          papers after merging 168 oral schedule duplicates into their canonical
          records. Every record has an official abstract and a public manuscript link.
        </p>
        <div className="about-grid">
          <section>
            <h3>Direct evidence</h3>
            <p>
              Explicit finance or banking terminology appears in the title or abstract.
              These papers may still need domain and dataset validation.
            </p>
          </section>
          <section>
            <h3>Transfer hypothesis</h3>
            <p>
              A method is plausibly useful for banking, but the paper may have been
              evaluated in another domain. The interface never presents this as an
              author claim.
            </p>
          </section>
          <section>
            <h3>Confidence</h3>
            <p>
              Confidence reflects the strength and number of matched method/domain
              phrases, not the scientific validity or production readiness of a paper.
            </p>
          </section>
          <section>
            <h3>Recommended use</h3>
            <p>
              Use the ledger for triage. Deep research should inspect the manuscript,
              datasets, baselines, limitations, code, and external validity.
            </p>
          </section>
        </div>
        <div className="modal-source">
          <strong>Official sources</strong>
          <a href={META.source_catalogue_url} target="_blank" rel="noreferrer">
            ICML structured catalogue <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
          </a>
          <a href={META.source_abstract_url} target="_blank" rel="noreferrer">
            ICML abstracts <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
          </a>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const comparisonRef = useRef(null);
  const [mode, setMode] = useState("banking");
  const [query, setQuery] = useState("");
  const [searchFields, setSearchFields] = useState({
    title: true,
    authors: true,
    abstract: true,
  });
  const [researchFilters, setResearchFilters] = useState([]);
  const [bankingFilters, setBankingFilters] = useState([]);
  const [directOnly, setDirectOnly] = useState(false);
  const [minScore, setMinScore] = useState(45);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [presentationFilter, setPresentationFilter] = useState("all");
  const [sortBy, setSortBy] = useState("relevance");
  const [sortDirection, setSortDirection] = useState("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [expandedId, setExpandedId] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [comparedIds, setComparedIds] = useState(() =>
    loadStored(
      "icml-evidence-ledger-compared",
      PAPERS.slice(0, 2).map((paper) => paper.id),
    ),
  );
  const [savedIds, setSavedIds] = useState(() =>
    loadStored("icml-evidence-ledger-saved", []),
  );
  const [comparisonCollapsed, setComparisonCollapsed] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(
    () =>
      typeof window === "undefined" ||
      !window.matchMedia("(max-width: 860px)").matches,
  );
  const [compareHint, setCompareHint] = useState(false);
  const [showAllMethods, setShowAllMethods] = useState(false);
  const [showAllBanking, setShowAllBanking] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const researchCounts = useMemo(
    () => countTags(PAPERS, (paper) => paper.research_tags),
    [],
  );
  const bankingCounts = useMemo(
    () =>
      countTags(PAPERS, (paper) => [
        ...paper.banking_tags_direct,
        ...paper.banking_tags_inferred,
      ]),
    [],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const result = PAPERS.filter((paper) => {
      if (mode === "banking" && paper.banking_relevance_score < minScore) return false;
      if (mode === "catalogue" && minScore > 0 && paper.banking_relevance_score < minScore)
        return false;
      if (
        needle &&
        ![
          searchFields.title ? paper.title : "",
          searchFields.authors
            ? paper.authors.map((author) => author.name).join(" ")
            : "",
          searchFields.abstract ? paper.abstract : "",
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(needle)
      )
        return false;
      if (
        researchFilters.length &&
        !researchFilters.some((tag) => paper.research_tags.includes(tag))
      )
        return false;
      const allBankingTags = [
        ...paper.banking_tags_direct,
        ...paper.banking_tags_inferred,
      ];
      if (
        bankingFilters.length &&
        !bankingFilters.some((tag) => allBankingTags.includes(tag))
      )
        return false;
      if (directOnly && !paper.banking_tags_direct.length) return false;
      if (sourceFilter !== "all" && sourceType(paper) !== sourceFilter) return false;
      if (
        presentationFilter !== "all" &&
        !paper.presentations.includes(presentationFilter)
      )
        return false;
      return true;
    });
    return result.sort((a, b) => {
      if (sortBy === "title") {
        const comparison = a.title.localeCompare(b.title);
        return sortDirection === "asc" ? comparison : -comparison;
      }
      let comparison;
      if (sortBy === "spotlight") {
        const spotlight =
          Number(b.decision === "Accept (spotlight)") -
          Number(a.decision === "Accept (spotlight)");
        comparison =
          spotlight || b.banking_relevance_score - a.banking_relevance_score;
      } else if (sortBy === "confidence") {
        comparison =
          confidenceValue(b.classification_confidence) -
            confidenceValue(a.classification_confidence) ||
          b.banking_relevance_score - a.banking_relevance_score;
      } else {
        comparison =
          b.banking_relevance_score - a.banking_relevance_score ||
          b.banking_direct_score - a.banking_direct_score ||
          a.title.localeCompare(b.title);
      }
      return sortDirection === "desc" ? comparison : -comparison;
    });
  }, [
    mode,
    minScore,
    query,
    searchFields,
    researchFilters,
    bankingFilters,
    directOnly,
    sourceFilter,
    presentationFilter,
    sortBy,
    sortDirection,
  ]);

  useEffect(() => {
    setPage(1);
  }, [
    mode,
    minScore,
    query,
    researchFilters,
    bankingFilters,
    directOnly,
    sourceFilter,
    presentationFilter,
    pageSize,
  ]);

  useEffect(() => {
    localStorage.setItem("icml-evidence-ledger-saved", JSON.stringify(savedIds));
  }, [savedIds]);

  useEffect(() => {
    localStorage.setItem(
      "icml-evidence-ledger-compared",
      JSON.stringify(comparedIds),
    );
  }, [comparedIds]);

  useEffect(() => {
    const compact = window.matchMedia("(max-width: 860px)");
    const handleViewportChange = (event) => {
      setFiltersOpen(!event.matches);
      setComparisonCollapsed(event.matches);
    };
    handleViewportChange(compact);
    compact.addEventListener("change", handleViewportChange);
    return () => compact.removeEventListener("change", handleViewportChange);
  }, []);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visiblePapers = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const comparedPapers = comparedIds
    .map((id) => PAPERS.find((paper) => paper.id === id))
    .filter(Boolean);
  const savedPapers = savedIds
    .map((id) => PAPERS.find((paper) => paper.id === id))
    .filter(Boolean);
  const detailPaper = detailId
    ? PAPERS.find((paper) => paper.id === detailId)
    : null;

  const setModeWithDefaults = (nextMode) => {
    startTransition(() => {
      setMode(nextMode);
      setMinScore(nextMode === "banking" ? 45 : 0);
      setPage(1);
    });
  };

  const resetView = () => {
    setQuery("");
    setResearchFilters([]);
    setBankingFilters([]);
    setDirectOnly(false);
    setSourceFilter("all");
    setPresentationFilter("all");
    setSortBy("relevance");
    setSortDirection("desc");
    setModeWithDefaults("banking");
  };

  const toggleCompare = (id) => {
    setCompareHint(false);
    setComparedIds((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id);
      if (current.length >= 3) return [...current.slice(1), id];
      return [...current, id];
    });
  };

  const openComparison = () => {
    if (!comparedIds.length) {
      setCompareHint(true);
      return;
    }
    setCompareHint(false);
    setComparisonCollapsed((current) => {
      const next = !current;
      if (!next) {
        window.requestAnimationFrame(() => {
          comparisonRef.current?.focus({ preventScroll: true });
        });
      }
      return next;
    });
  };

  const toggleSaved = (id) => {
    setSavedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  };

  const exportFiltered = () => {
    const header = [
      "ICML ID",
      "Title",
      "Authors",
      "Research tags",
      "Direct banking tags",
      "Inferred banking tags",
      "Banking relevance score",
      "Confidence",
      "ICML URL",
      "Manuscript URL",
    ];
    const rows = filtered.map((paper) => [
      paper.id,
      paper.title,
      authorLine(paper, paper.authors.length),
      paper.research_tags.join("; "),
      paper.banking_tags_direct.join("; "),
      paper.banking_tags_inferred.join("; "),
      paper.banking_relevance_score,
      paper.classification_confidence,
      paper.icml_url,
      paper.manuscript_url,
    ]);
    downloadFile(
      "icml-2026-evidence-ledger-filtered.csv",
      [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n"),
      "text/csv;charset=utf-8",
    );
  };

  const exportQueue = () => {
    downloadFile(
      "icml-2026-saved-research-queue.json",
      JSON.stringify(savedPapers, null, 2),
      "application/json",
    );
  };

  return (
    <div
      className={[
        "app-shell",
        comparedPapers.length ? "has-comparison" : "",
        comparedPapers.length && comparisonCollapsed
          ? "comparison-collapsed"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="topbar">
        <div className="brand">
          <strong>Evidence Ledger</strong>
          <span>ICML 2026 literature workbench</span>
        </div>
        <div className="topbar-mode">
          <FontAwesomeIcon icon={faBuildingColumns} />
          <select
            value={mode}
            onChange={(event) => setModeWithDefaults(event.target.value)}
            aria-label="Research mode"
          >
            <option value="banking">Banking transfer</option>
            <option value="catalogue">Full catalogue</option>
          </select>
          <FontAwesomeIcon icon={faChevronDown} />
        </div>
        <div className="global-search">
          <FontAwesomeIcon icon={faMagnifyingGlass} />
          <input
            value={query}
            onChange={(event) => startTransition(() => setQuery(event.target.value))}
            placeholder="Search titles, authors, abstracts, keywords…"
            aria-label="Search papers"
          />
          {isPending ? <span className="search-status">Filtering…</span> : null}
        </div>
        <div className="freshness">
          <span>Data freshness</span>
          <strong>Jun 15, 2026 18:00 CST</strong>
          <i />
        </div>
        <button
          type="button"
          className={`topbar-action filter-button ${filtersOpen ? "active" : ""}`}
          onClick={() => setFiltersOpen((current) => !current)}
          aria-expanded={filtersOpen}
          aria-controls="catalogue-filters"
        >
          <FontAwesomeIcon icon={faTableColumns} />
          Filters
        </button>
        <button type="button" className="topbar-action saved-button" onClick={exportQueue}>
          <FontAwesomeIcon icon={faBookmark} />
          Saved queue
          <b>{savedIds.length}</b>
        </button>
        <button
          type="button"
          className="icon-button alerts-button"
          title="No alerts configured"
          aria-label="No alerts configured"
          disabled
        >
          <FontAwesomeIcon icon={faBell} />
        </button>
        <button
          type="button"
          className="icon-button about-button"
          title="About this research ledger"
          aria-label="About this research ledger"
          onClick={() => setAboutOpen(true)}
        >
          <FontAwesomeIcon icon={faCircleQuestion} />
        </button>
      </header>

      <div className={`workspace ${filtersOpen ? "" : "filters-collapsed"}`}>
        {filtersOpen ? (
          <button
            type="button"
            className="filter-scrim"
            onClick={() => setFiltersOpen(false)}
            aria-label="Close filters"
          />
        ) : null}
        <aside
          id="catalogue-filters"
          className={`filter-rail ${filtersOpen ? "open" : ""}`}
        >
          <div className="rail-title">
            <span>ICML 2026 catalogue</span>
            <strong>{PAPERS.length.toLocaleString()} papers</strong>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              aria-label="Close filters"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
          <div className="rail-section search-options">
            <div className="rail-heading">
              Text search <FontAwesomeIcon icon={faCircleQuestion} title="Choose fields" />
            </div>
            {Object.entries(searchFields).map(([field, checked]) => (
              <label key={field}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setSearchFields((current) => ({
                      ...current,
                      [field]: !current[field],
                    }))
                  }
                />
                Search in {field}
              </label>
            ))}
          </div>
          <div className="rail-section">
            <div className="rail-heading">
              Method <button onClick={() => setResearchFilters([])}>Clear</button>
            </div>
            {(showAllMethods ? PRIORITY_METHODS : PRIORITY_METHODS.slice(0, 8)).map((tag) => (
              <FilterCheck
                key={tag}
                label={METHOD_SHORT_LABELS[tag] || tag}
                count={researchCounts.get(tag) || 0}
                checked={researchFilters.includes(tag)}
                onChange={() => toggleArray(setResearchFilters, tag)}
                icon={METHOD_ICONS[tag]}
              />
            ))}
            <button
              type="button"
              className="rail-list-toggle"
              onClick={() => setShowAllMethods((current) => !current)}
            >
              {showAllMethods
                ? "Show fewer"
                : `Show ${PRIORITY_METHODS.length - 8} more`}
            </button>
          </div>
          <div className="rail-section">
            <div className="rail-heading">
              Banking application <button onClick={() => setBankingFilters([])}>Clear</button>
            </div>
            {(showAllBanking ? BANKING_ORDER : BANKING_ORDER.slice(0, 7)).map((tag) => (
              <FilterCheck
                key={tag}
                label={BANKING_SHORT_LABELS[tag] || tag}
                count={bankingCounts.get(tag) || 0}
                checked={bankingFilters.includes(tag)}
                onChange={() => toggleArray(setBankingFilters, tag)}
                icon={faBuildingColumns}
              />
            ))}
            <button
              type="button"
              className="rail-list-toggle"
              onClick={() => setShowAllBanking((current) => !current)}
            >
              {showAllBanking
                ? "Show fewer"
                : `Show ${BANKING_ORDER.length - 7} more`}
            </button>
            <label className="direct-only">
              <input
                type="checkbox"
                checked={directOnly}
                onChange={(event) => setDirectOnly(event.target.checked)}
              />
              Direct source-text signal only
            </label>
          </div>
          <div className="rail-section">
            <div className="rail-heading">
              Minimum banking score
              <strong>{minScore}</strong>
            </div>
            <input
              className="score-range"
              type="range"
              min="0"
              max="100"
              step="5"
              value={minScore}
              onChange={(event) => setMinScore(Number(event.target.value))}
            />
            <div className="range-labels">
              <span>0</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>
          <div className="rail-section collapsible-filter">
            <label>
              Source type
              <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
                <option value="all">All manuscript sources</option>
                <option value="OpenReview">OpenReview</option>
                <option value="arXiv">arXiv</option>
                <option value="JMLR">JMLR</option>
                <option value="PMLR">PMLR</option>
              </select>
            </label>
            <label>
              Presentation
              <select
                value={presentationFilter}
                onChange={(event) => setPresentationFilter(event.target.value)}
              >
                <option value="all">All presentations</option>
                <option value="Oral">Oral / spotlight</option>
                <option value="Poster">Poster</option>
              </select>
            </label>
          </div>
          <div className="saved-queue">
            <div className="rail-heading">
              Saved queue
              <button type="button" onClick={exportQueue}>Export</button>
            </div>
            {savedPapers.length ? (
              savedPapers.slice(0, 6).map((paper) => (
                <button key={paper.id} type="button" onClick={() => setDetailId(paper.id)}>
                  <FontAwesomeIcon icon={faBookmark} />
                  <span>{paper.title}</span>
                </button>
              ))
            ) : (
              <p>Save papers from the ledger to build a persistent deep-research queue.</p>
            )}
          </div>
        </aside>

        <main className="ledger-main">
          <div className="overview">
            <FlowMap
              papers={filtered}
              onMethod={(tag) => toggleArray(setResearchFilters, tag)}
              onBanking={(tag) => toggleArray(setBankingFilters, tag)}
            />
            <SummaryPanel papers={filtered} />
          </div>

          <section className="ledger-section">
            <div className="ledger-toolbar">
              <div>
                <strong>{filtered.length.toLocaleString()} results</strong>
                <span>
                  {mode === "banking"
                    ? `banking score ≥ ${minScore}`
                    : "full ICML catalogue"}
                </span>
              </div>
              <label>
                Sort by
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                  <option value="relevance">Banking relevance</option>
                  <option value="confidence">Evidence confidence</option>
                  <option value="spotlight">Spotlight first</option>
                  <option value="title">Paper title</option>
                </select>
              </label>
              <button
                type="button"
                className="toolbar-button"
                onClick={() =>
                  setSortDirection((current) => (current === "desc" ? "asc" : "desc"))
                }
                aria-label={`Sort ${sortDirection === "desc" ? "ascending" : "descending"}`}
              >
                <FontAwesomeIcon
                  icon={faArrowDownWideShort}
                  className={sortDirection === "asc" ? "sort-icon ascending" : "sort-icon"}
                />
                {sortDirection === "desc" ? "Descending" : "Ascending"}
              </button>
              <button type="button" className="toolbar-button" onClick={exportFiltered}>
                <FontAwesomeIcon icon={faDownload} />
                Export
              </button>
              <button
                type="button"
                className={`toolbar-button compare-button ${
                  comparedIds.length ? "active" : ""
                }`}
                onClick={openComparison}
                aria-expanded={Boolean(comparedIds.length) && !comparisonCollapsed}
              >
                <FontAwesomeIcon icon={faCodeCompare} />
                Compare ({comparedIds.length})
              </button>
              <button type="button" className="toolbar-button" onClick={resetView}>
                <FontAwesomeIcon icon={faRotateLeft} />
                Reset view
              </button>
            </div>
            {compareHint ? (
              <div className="compare-hint" role="status">
                <FontAwesomeIcon icon={faCodeCompare} />
                Select one to three papers using the first table column.
                <button type="button" onClick={() => setCompareHint(false)}>
                  Dismiss
                </button>
              </div>
            ) : null}

            <div className="table-wrap">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th aria-label="Compare" />
                    <th>#</th>
                    <th>Paper</th>
                    <th>Method (primary)</th>
                    <th>Banking use case</th>
                    <th>Evidence strength</th>
                    <th>Relevance</th>
                    <th>Key sources</th>
                    <th>Schedule / evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePapers.map((paper, rowIndex) => (
                    <PaperRow
                      key={paper.id}
                      paper={paper}
                      index={(safePage - 1) * pageSize + rowIndex + 1}
                      expanded={expandedId === paper.id}
                      compared={comparedIds.includes(paper.id)}
                      saved={savedIds.includes(paper.id)}
                      onExpand={(id) =>
                        setExpandedId((current) => (current === id ? null : id))
                      }
                      onDetail={setDetailId}
                      onCompare={toggleCompare}
                      onSave={toggleSaved}
                    />
                  ))}
                  {!visiblePapers.length ? (
                    <tr>
                      <td colSpan="9" className="empty-state">
                        <FontAwesomeIcon icon={faMagnifyingGlass} />
                        <strong>No papers match this evidence view.</strong>
                        <span>Reduce the score threshold or clear one of the filters.</span>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <span>
                Showing {filtered.length ? (safePage - 1) * pageSize + 1 : 0}–
                {Math.min(safePage * pageSize, filtered.length)} of{" "}
                {filtered.length.toLocaleString()}
              </span>
              <div>
                <button
                  type="button"
                  disabled={safePage === 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <FontAwesomeIcon icon={faChevronLeft} />
                </button>
                {[...Array(Math.min(5, pageCount))].map((_, index) => {
                  const candidate =
                    pageCount <= 5
                      ? index + 1
                      : Math.min(Math.max(1, safePage - 2), pageCount - 4) + index;
                  return (
                    <button
                      type="button"
                      className={candidate === safePage ? "active" : ""}
                      onClick={() => setPage(candidate)}
                      key={candidate}
                    >
                      {candidate}
                    </button>
                  );
                })}
                <button
                  type="button"
                  disabled={safePage === pageCount}
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                >
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
              </div>
              <label>
                Rows per page
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                >
                  {PAGE_SIZES.map((size) => (
                    <option value={size} key={size}>{size}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <ComparisonTray
            papers={comparedPapers}
            onRemove={toggleCompare}
            onOpen={setDetailId}
            collapsed={comparisonCollapsed}
            onToggle={() => setComparisonCollapsed((current) => !current)}
            sectionRef={comparisonRef}
          />

          <footer>
            <span>
              Sources: official ICML 2026 catalogue and abstracts ·{" "}
              {PAPERS.length.toLocaleString()} unique papers · public manuscript
              coverage 100%
            </span>
            <span>
              Classification generated Jun 15, 2026 · Direct evidence and transfer
              hypotheses are visibly separated
            </span>
          </footer>
        </main>
      </div>

      <DetailDrawer
        paper={detailPaper}
        saved={detailPaper ? savedIds.includes(detailPaper.id) : false}
        onClose={() => setDetailId(null)}
        onSave={toggleSaved}
      />
      {aboutOpen ? <AboutModal onClose={() => setAboutOpen(false)} /> : null}
    </div>
  );
}
