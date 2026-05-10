import type { AiReport } from "../services/browserAiService";

type AiReportPanelProps = {
    title: string;
    report: AiReport;
    onClose?: () => void;
};

export function AiReportPanel({ title, report, onClose }: AiReportPanelProps) {
    const content = (
        <article className={onClose ? "panel ai-report-panel ai-report-modal" : "panel ai-report-panel"}>
            <div className="panel-header ai-report-modal-header">
                <div>
                    <h2>{title}</h2>
                </div>

                <div className="ai-report-header-actions">
                    <span className="ai-provider-pill">{report.provider}</span>

                    {onClose && (
                        <button
                            type="button"
                            className="ai-report-close-button"
                            onClick={onClose}
                            aria-label="Закрыть AI-отчёт"
                        >
                            ×
                        </button>
                    )}
                </div>
            </div>

            <div className="ai-report-hero">
                <div className="ai-verdict-card">
                    <span>Вердикт</span>
                    <strong>{report.verdict}</strong>
                    <p>{report.summary}</p>
                </div>

                <div className="ai-score-card">
                    <strong>{report.riskScore}</strong>
                    <span>{translateRiskLevel(report.riskLevel)}</span>
                </div>
            </div>

            <div className="ai-report-grid ai-report-grid-two">
                <AiList title="Сильные стороны" items={report.positiveFactors} />
                <AiList title="Слабые места" items={report.negativeFactors} />
            </div>

            <div className="ai-report-footer">
                <span>{report.disclaimer}</span>
            </div>
        </article>
    );

    if (!onClose) {
        return content;
    }

    return (
        <div
            className="ai-report-modal-backdrop"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            {content}
        </div>
    );
}

type AiListProps = {
    title: string;
    items: string[];
};

function AiList({ title, items }: AiListProps) {
    return (
        <div className="ai-list-card">
            <span>{title}</span>

            <ul>
                {items.map((item) => (
                    <li key={item}>{item}</li>
                ))}
            </ul>
        </div>
    );
}

function translateRiskLevel(riskLevel: AiReport["riskLevel"]): string {
    if (riskLevel === "LOW") return "Низкий";
    if (riskLevel === "MEDIUM") return "Средний";
    if (riskLevel === "HIGH") return "Высокий";

    return "Критический";
}