import { YANDEX_GPT_CONFIG } from "../config/yandexGptConfig";
import type { AnalyticsSummary, PortfolioSimulator } from "../types/domain";

export type AiRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type AiReport = {
    provider: "MOCK" | "YANDEX_GPT";
    verdict: string;
    summary: string;
    positiveFactors: string[];
    negativeFactors: string[];
    actionItems: string[];
    riskScore: number;
    riskLevel: AiRiskLevel;
    disclaimer: string;
};

type YandexCompletionResponse = {
    result?: {
        alternatives?: Array<{
            message?: {
                role?: string;
                text?: string;
            };
            status?: string;
        }>;
        usage?: unknown;
        modelVersion?: string;
    };
};

type ParsedAiReport = {
    verdict: string;
    summary: string;
    positiveFactors: string[];
    negativeFactors: string[];
    actionItems: string[];
    riskScore: number;
    riskLevel: AiRiskLevel;
};

export async function generateAssetReport(summary: AnalyticsSummary): Promise<AiReport> {
    if (YANDEX_GPT_CONFIG.enabled && YANDEX_GPT_CONFIG.apiKey) {
        try {
            const text = await requestYandexGpt(buildAssetPrompt(summary));
            const parsed = parseAiJson(text, summary.riskScore);

            return {
                provider: "YANDEX_GPT",
                ...parsed,
                disclaimer: "Не инвестиционная рекомендация."
            };
        } catch {
            return generateLocalAssetReport(summary);
        }
    }

    return generateLocalAssetReport(summary);
}

export async function generatePortfolioReport(portfolio: PortfolioSimulator): Promise<AiReport> {
    const fallbackRiskScore = calculatePortfolioRiskScore(portfolio);

    if (YANDEX_GPT_CONFIG.enabled && YANDEX_GPT_CONFIG.apiKey) {
        try {
            const text = await requestYandexGpt(buildPortfolioPrompt(portfolio));
            const parsed = parseAiJson(text, fallbackRiskScore);

            return {
                provider: "YANDEX_GPT",
                ...parsed,
                disclaimer: "Не инвестиционная рекомендация."
            };
        } catch {
            return generateLocalPortfolioReport(portfolio);
        }
    }

    return generateLocalPortfolioReport(portfolio);
}

async function requestYandexGpt(prompt: string): Promise<string> {
    const response = await fetch(YANDEX_GPT_CONFIG.completionUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Api-Key ${YANDEX_GPT_CONFIG.apiKey}`,
            "x-folder-id": YANDEX_GPT_CONFIG.folderId
        },
        body: JSON.stringify({
            modelUri: YANDEX_GPT_CONFIG.modelUri,
            completionOptions: {
                stream: false,
                temperature: 0.25,
                maxTokens: Math.max(YANDEX_GPT_CONFIG.maxTokens, 900)
            },
            messages: [
                {
                    role: "system",
                    text: [
                        "Ты аналитический движок в инвестиционном демо-приложении.",
                        "Отвечай только валидным JSON без markdown.",
                        "Стиль: коротко, жёстко, продуктово, без воды.",
                        "Не используй фразы: может быть, стоит обратить внимание, важно понимать, в целом.",
                        "Не давай прямых команд купить или продать.",
                        "Не пиши юридические длинные дисклеймеры.",
                        "Каждый пункт должен быть конкретным и связанным с числами."
                    ].join(" ")
                },
                {
                    role: "user",
                    text: prompt
                }
            ]
        })
    });

    if (!response.ok) {
        throw new Error(`YandexGPT failed with status ${response.status}`);
    }

    const data = await response.json() as YandexCompletionResponse;
    const text = data.result?.alternatives?.[0]?.message?.text;

    if (!text) {
        throw new Error("YandexGPT returned empty text");
    }

    return text;
}

function buildAssetPrompt(summary: AnalyticsSummary): string {
    return JSON.stringify({
        task: "Собери короткий AI-отчёт по активу.",
        output: {
            verdict: "короткая фраза до 64 символов",
            summary: "одно плотное предложение",
            positiveFactors: ["3 коротких пункта"],
            negativeFactors: ["3 коротких пункта"],
            actionItems: ["3 проверки без команд купить/продать"],
            riskScore: "число 0-100",
            riskLevel: "LOW | MEDIUM | HIGH | CRITICAL"
        },
        constraints: [
            "Не пиши общие фразы.",
            "Не пиши длинные объяснения.",
            "Каждый фактор должен опираться на цену, движение, риск, объём, источник или волатильность.",
            "actionItems должны звучать как проверки: сравнить, проверить, оценить, дождаться данных."
        ],
        data: {
            ticker: summary.ticker,
            name: summary.name,
            currentPrice: summary.currentPrice,
            firstClose: summary.firstClose,
            lastClose: summary.lastClose,
            priceChange: summary.priceChange,
            priceChangePercent: summary.priceChangePercent,
            averageVolume: summary.averageVolume,
            volatilityPercent: summary.volatilityPercent,
            riskScore: summary.riskScore,
            riskLevel: summary.riskLevel,
            dataPoints: summary.dataPoints,
            source: summary.source
        }
    });
}

function buildPortfolioPrompt(portfolio: PortfolioSimulator): string {
    return JSON.stringify({
        task: "Собери короткий AI-отчёт по портфелю.",
        output: {
            verdict: "короткая фраза до 64 символов",
            summary: "одно плотное предложение",
            positiveFactors: ["3 коротких пункта"],
            negativeFactors: ["3 коротких пункта"],
            actionItems: ["3 проверки без команд купить/продать"],
            riskScore: "число 0-100",
            riskLevel: "LOW | MEDIUM | HIGH | CRITICAL"
        },
        constraints: [
            "Не пиши общие фразы.",
            "Не пиши длинные объяснения.",
            "Опирайся на позиции, лоты, PnL, валюты и концентрацию.",
            "Не советуй купить или продать."
        ],
        data: {
            account: portfolio.account,
            assetsCount: portfolio.assetsCount,
            lotsCount: portfolio.lotsCount,
            rub: {
                invested: portfolio.totalRubInvested,
                currentValue: portfolio.totalRubCurrentValue,
                pnl: portfolio.totalRubProfitLoss,
                pnlPercent: calculatePercent(portfolio.totalRubProfitLoss, portfolio.totalRubInvested)
            },
            usd: {
                invested: portfolio.totalUsdInvested,
                currentValue: portfolio.totalUsdCurrentValue,
                pnl: portfolio.totalUsdProfitLoss,
                pnlPercent: calculatePercent(portfolio.totalUsdProfitLoss, portfolio.totalUsdInvested)
            },
            holdings: portfolio.holdings.map((holding) => ({
                ticker: holding.ticker,
                name: holding.name,
                currency: holding.currency,
                quantity: holding.totalQuantity,
                averageBuyPrice: holding.averageBuyPrice,
                currentPrice: holding.currentPrice,
                investedAmount: holding.investedAmount,
                currentValue: holding.currentValue,
                profitLoss: holding.profitLoss,
                profitLossPercent: holding.profitLossPercent,
                lotsCount: holding.lots.length
            }))
        }
    });
}

function parseAiJson(text: string, fallbackRiskScore: number): ParsedAiReport {
    const cleanedText = extractJsonText(text);
    const parsed = JSON.parse(cleanedText) as Partial<ParsedAiReport>;
    const riskScore = normalizeRiskScore(parsed.riskScore, fallbackRiskScore);

    return {
        verdict: normalizeString(parsed.verdict, buildVerdictByRisk(riskScore)),
        summary: normalizeString(parsed.summary, buildSummaryByRisk(riskScore)),
        positiveFactors: normalizeStringArray(parsed.positiveFactors, [
            "Данные обработаны.",
            "Есть расчёт движения.",
            "Есть базовая оценка риска."
        ]),
        negativeFactors: normalizeStringArray(parsed.negativeFactors, [
            "Данных мало для глубокого вывода.",
            "Новостной фон не учитывается.",
            "Исторический контекст ограничен."
        ]),
        actionItems: normalizeStringArray(parsed.actionItems, [
            "Сравнить с похожими активами.",
            "Проверить график на разных периодах.",
            "Оценить размер позиции."
        ]),
        riskScore,
        riskLevel: normalizeRiskLevel(parsed.riskLevel, toAiRiskLevel(riskScore))
    };
}

function extractJsonText(text: string): string {
    const cleaned = text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace >= 0 && lastBrace > firstBrace) {
        return cleaned.slice(firstBrace, lastBrace + 1);
    }

    return cleaned;
}

function generateLocalAssetReport(summary: AnalyticsSummary): AiReport {
    const riskScore = summary.riskScore;
    const riskLevel = toAiRiskLevel(riskScore);
    const direction = summary.priceChangePercent >= 0 ? "рост" : "падение";
    const absMove = Math.abs(summary.priceChangePercent);
    const isRealSource = summary.source !== "DEMO";

    return {
        provider: "MOCK",
        verdict: buildAssetVerdict(summary),
        summary: `${summary.ticker}: ${direction} ${formatPercent(absMove)}, риск ${riskScore}/100, волатильность ${formatPercent(summary.volatilityPercent)}, источник ${summary.source}.`,
        positiveFactors: [
            summary.priceChangePercent >= 0
                ? `Импульс вверх: ${formatPercent(summary.priceChangePercent)}.`
                : `Снижение уже отражено в цене: ${formatPercent(summary.priceChangePercent)}.`,
            summary.averageVolume > 0
                ? `Объём есть: ${formatCompactNumber(summary.averageVolume)}.`
                : "Объём слабый или недоступен.",
            isRealSource
                ? `Источник живой: ${summary.source}.`
                : "DEMO fallback сохраняет анализ без backend."
        ],
        negativeFactors: [
            riskScore >= 60
                ? `Риск высокий: ${riskScore}/100.`
                : `Риск не нулевой: ${riskScore}/100.`,
            summary.volatilityPercent >= 3
                ? `Волатильность давит: ${formatPercent(summary.volatilityPercent)}.`
                : `Волатильность низкая: ${formatPercent(summary.volatilityPercent)}.`,
            isRealSource
                ? "Новости и отчётность не входят в расчёт."
                : "DEMO-источник снижает точность."
        ],
        actionItems: [
            `Сравнить ${summary.ticker} с активами из той же категории.`,
            "Проверить день, неделю и месяц на графике.",
            "Оценить размер позиции через портфельный симулятор."
        ],
        riskScore,
        riskLevel,
        disclaimer: "Не инвестиционная рекомендация."
    };
}

function generateLocalPortfolioReport(portfolio: PortfolioSimulator): AiReport {
    const riskScore = calculatePortfolioRiskScore(portfolio);
    const riskLevel = toAiRiskLevel(riskScore);
    const largest = getLargestHolding(portfolio);
    const best = getBestHolding(portfolio);
    const worst = getWorstHolding(portfolio);

    return {
        provider: "MOCK",
        verdict: buildPortfolioVerdict(portfolio, riskScore),
        summary: buildPortfolioSummary(portfolio, riskScore),
        positiveFactors: [
            portfolio.assetsCount > 1
                ? `Активов несколько: ${portfolio.assetsCount}.`
                : `Активов мало: ${portfolio.assetsCount}.`,
            best
                ? `Лучший открытый PnL: ${best.ticker} ${formatPercent(best.profitLossPercent)}.`
                : "Открытых позиций нет.",
            portfolio.lotsCount > portfolio.assetsCount
                ? `Есть разнесённые входы: ${portfolio.lotsCount} лотов.`
                : `Структура простая: ${portfolio.lotsCount} лотов.`
        ],
        negativeFactors: [
            largest
                ? `Крупнейшая позиция: ${largest.ticker}, ${formatMoney(largest.currentValue, largest.currency)}.`
                : "Нет крупнейшей позиции.",
            worst
                ? `Слабая позиция: ${worst.ticker} ${formatPercent(worst.profitLossPercent)}.`
                : "Нет слабой открытой позиции.",
            `Портфельный риск: ${riskScore}/100.`
        ],
        actionItems: [
            "Проверить концентрацию крупнейшей позиции.",
            "Сравнить лучший и худший открытый PnL.",
            "Оценить, нужен ли новый вход отдельным лотом."
        ],
        riskScore,
        riskLevel,
        disclaimer: "Не инвестиционная рекомендация."
    };
}

function buildAssetVerdict(summary: AnalyticsSummary): string {
    if (summary.riskScore >= 80) return `${summary.ticker}: риск перегрет`;
    if (summary.riskScore >= 60) return `${summary.ticker}: высокая турбулентность`;
    if (summary.priceChangePercent >= 5) return `${summary.ticker}: сильный импульс`;
    if (summary.priceChangePercent <= -5) return `${summary.ticker}: сильная просадка`;
    if (summary.volatilityPercent >= 3) return `${summary.ticker}: движение нервное`;

    return `${summary.ticker}: спокойный режим`;
}

function buildPortfolioVerdict(portfolio: PortfolioSimulator, riskScore: number): string {
    if (portfolio.assetsCount === 0) return "Портфель пуст";
    if (riskScore >= 75) return "Портфель перегрет по риску";
    if (riskScore >= 55) return "Портфель требует контроля";
    if (portfolio.totalRubProfitLoss >= 0 && portfolio.totalUsdProfitLoss >= 0) return "Портфель держится уверенно";

    return "Портфель смешанный";
}

function buildPortfolioSummary(portfolio: PortfolioSimulator, riskScore: number): string {
    const rubPnl = formatMoney(portfolio.totalRubProfitLoss, "RUB");
    const usdPnl = formatMoney(portfolio.totalUsdProfitLoss, "USD");

    return `${portfolio.assetsCount} активов, ${portfolio.lotsCount} лотов, риск ${riskScore}/100, RUB PnL ${rubPnl}, USD PnL ${usdPnl}.`;
}

function calculatePortfolioRiskScore(portfolio: PortfolioSimulator): number {
    if (portfolio.holdings.length === 0) {
        return 0;
    }

    const totalValue = portfolio.holdings.reduce((sum, holding) => sum + Math.max(holding.currentValue, 0), 0);

    if (totalValue <= 0) {
        return 0;
    }

    const largestShare = Math.max(...portfolio.holdings.map((holding) => holding.currentValue / totalValue));
    const averagePnlPressure = portfolio.holdings.reduce((sum, holding) => {
        return sum + Math.min(Math.abs(holding.profitLossPercent), 60);
    }, 0) / portfolio.holdings.length;

    const concentrationRisk = largestShare * 38;
    const lossRisk = averagePnlPressure * 0.55;
    const lotRisk = Math.min(20, portfolio.lotsCount * 2.2);
    const diversificationPenalty = portfolio.assetsCount < 3 ? (3 - portfolio.assetsCount) * 8 : 0;

    return clamp(Math.round(concentrationRisk + lossRisk + lotRisk + diversificationPenalty), 0, 100);
}

function getLargestHolding(portfolio: PortfolioSimulator) {
    if (portfolio.holdings.length === 0) return null;

    return [...portfolio.holdings].sort((first, second) => second.currentValue - first.currentValue)[0];
}

function getBestHolding(portfolio: PortfolioSimulator) {
    if (portfolio.holdings.length === 0) return null;

    return [...portfolio.holdings].sort((first, second) => second.profitLossPercent - first.profitLossPercent)[0];
}

function getWorstHolding(portfolio: PortfolioSimulator) {
    if (portfolio.holdings.length === 0) return null;

    return [...portfolio.holdings].sort((first, second) => first.profitLossPercent - second.profitLossPercent)[0];
}

function normalizeString(value: unknown, fallback: string): string {
    if (typeof value !== "string") {
        return fallback;
    }

    const normalized = value.trim();

    return normalized.length > 0 ? normalized : fallback;
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
    if (!Array.isArray(value)) {
        return fallback;
    }

    const items = value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 3);

    return items.length > 0 ? items : fallback;
}

function normalizeRiskScore(value: unknown, fallback: number): number {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        return fallback;
    }

    return clamp(Math.round(numericValue), 0, 100);
}

function normalizeRiskLevel(value: unknown, fallback: AiRiskLevel): AiRiskLevel {
    if (value === "LOW" || value === "MEDIUM" || value === "HIGH" || value === "CRITICAL") {
        return value;
    }

    return fallback;
}

function buildVerdictByRisk(riskScore: number): string {
    if (riskScore >= 80) return "Критический риск";
    if (riskScore >= 60) return "Высокий риск";
    if (riskScore >= 35) return "Средний риск";

    return "Низкий риск";
}

function buildSummaryByRisk(riskScore: number): string {
    return `AI оценил риск на ${riskScore}/100.`;
}

function toAiRiskLevel(score: number): AiRiskLevel {
    if (score >= 80) return "CRITICAL";
    if (score >= 60) return "HIGH";
    if (score >= 35) return "MEDIUM";

    return "LOW";
}

function calculatePercent(value: number, base: number): number {
    if (base === 0) {
        return 0;
    }

    return (value / base) * 100;
}

function formatMoney(value: number, currency: string): string {
    return `${new Intl.NumberFormat("ru-RU", {
        maximumFractionDigits: 4
    }).format(value)} ${currency}`;
}

function formatPercent(value: number): string {
    return `${new Intl.NumberFormat("ru-RU", {
        maximumFractionDigits: 2
    }).format(value)}%`;
}

function formatCompactNumber(value: number): string {
    return new Intl.NumberFormat("ru-RU", {
        notation: "compact",
        maximumFractionDigits: 2
    }).format(value);
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}