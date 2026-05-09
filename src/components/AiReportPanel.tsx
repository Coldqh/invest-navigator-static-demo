import type { AiReport } from "../services/browserAiService";

type AiReportPanelProps = {
    title: string;
    report: AiReport;
};

export function AiReportPanel({ title, report }: AiReportPanelProps) {
    return (
        <article className="panel ai-report-panel">
            <div className="panel-header">
                <div>
                    <h2>{title}</h2>
                </div>

                <span className="ai-provider-pill">{report.provider}</span>
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

            <div className="ai-report-grid">
                <AiList title="Сильные стороны" items={report.positiveFactors} />
                <AiList title="Слабые места" items={report.negativeFactors} />
                <AiList title="Проверить" items={report.actionItems} />
            </div>

            <div className="ai-report-footer">
                <span>{report.disclaimer}</span>
            </div>
        </article>
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