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
                disclaimer: "AI-отчёт не является инвестиционной рекомендацией."
            };
        } catch {
            return generateMockAssetReport(summary);
        }
    }

    return generateMockAssetReport(summary);
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
                disclaimer: "AI-отчёт не является инвестиционной рекомендацией."
            };
        } catch {
            return generateMockPortfolioReport(portfolio);
        }
    }

    return generateMockPortfolioReport(portfolio);
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
                temperature: YANDEX_GPT_CONFIG.temperature,
                maxTokens: YANDEX_GPT_CONFIG.maxTokens
            },
            messages: [
                {
                    role: "system",
                    text: [
                        "Ты AI-аналитик в демо-приложении Invest Navigator AI.",
                        "Отвечай строго валидным JSON без markdown.",
                        "Не используй текст вне JSON.",
                        "Не давай прямых советов купить или продать.",
                        "Пиши компактно, уверенно, продуктовым языком.",
                        "Фокус: риск, динамика, качество позиции, что стоит проверить вручную."
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
        task: "Сделай компактный JSON-отчёт по активу.",
        requiredJsonShape: {
            verdict: "string",
            summary: "string",
            positiveFactors: ["string"],
            negativeFactors: ["string"],
            actionItems: ["string"],
            riskScore: 0,
            riskLevel: "LOW | MEDIUM | HIGH | CRITICAL"
        },
        rules: [
            "verdict — короткая фраза до 80 символов",
            "summary — 1-2 предложения",
            "positiveFactors — 3 пункта",
            "negativeFactors — 3 пункта",
            "actionItems — 3 пункта без прямых команд купить/продать",
            "riskScore — число 0-100",
            "riskLevel — LOW, MEDIUM, HIGH или CRITICAL"
        ],
        asset: {
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
        task: "Сделай компактный JSON-отчёт по симуляторному портфелю.",
        requiredJsonShape: {
            verdict: "string",
            summary: "string",
            positiveFactors: ["string"],
            negativeFactors: ["string"],
            actionItems: ["string"],
            riskScore: 0,
            riskLevel: "LOW | MEDIUM | HIGH | CRITICAL"
        },
        rules: [
            "verdict — короткая фраза до 80 символов",
            "summary — 1-2 предложения",
            "positiveFactors — 3 пункта",
            "negativeFactors — 3 пункта",
            "actionItems — 3 пункта без прямых команд купить/продать",
            "riskScore — число 0-100",
            "riskLevel — LOW, MEDIUM, HIGH или CRITICAL"
        ],
        portfolio: {
            account: portfolio.account,
            assetsCount: portfolio.assetsCount,
            lotsCount: portfolio.lotsCount,
            totalRubInvested: portfolio.totalRubInvested,
            totalRubCurrentValue: portfolio.totalRubCurrentValue,
            totalRubProfitLoss: portfolio.totalRubProfitLoss,
            totalUsdInvested: portfolio.totalUsdInvested,
            totalUsdCurrentValue: portfolio.totalUsdCurrentValue,
            totalUsdProfitLoss: portfolio.totalUsdProfitLoss,
            holdings: portfolio.holdings.map((holding) => ({
                ticker: holding.ticker,
                name: holding.name,
                currency: holding.currency,
                totalQuantity: holding.totalQuantity,
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
    try {
        const cleanedText = text
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

        const parsed = JSON.parse(cleanedText) as Partial<ParsedAiReport>;

        const riskScore = normalizeRiskScore(parsed.riskScore, fallbackRiskScore);

        return {
            verdict: normalizeString(parsed.verdict, buildVerdictByRisk(riskScore)),
            summary: normalizeString(
                parsed.summary,
                "Данные обработаны, но AI вернул неполный ответ. Использована краткая fallback-сводка."
            ),
            positiveFactors: normalizeStringArray(parsed.positiveFactors, [
                "Данные успешно обработаны.",
                "Доступна оценка риска и движения.",
                "Инструмент можно сравнить с другими активами."
            ]),
            negativeFactors: normalizeStringArray(parsed.negativeFactors, [
                "Часть данных может приходить из fallback-источника.",
                "Статическая версия работает без серверной проверки.",
                "Оценка основана на ограниченном наборе метрик."
            ]),
            actionItems: normalizeStringArray(parsed.actionItems, [
                "Сравнить риск с похожими активами.",
                "Проверить движение на разных периодах графика.",
                "Оценить размер позиции относительно портфеля."
            ]),
            riskScore,
            riskLevel: normalizeRiskLevel(parsed.riskLevel, toAiRiskLevel(riskScore))
        };
    } catch {
        throw new Error("Failed to parse YandexGPT JSON");
    }
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
        .slice(0, 4);

    return items.length > 0 ? items : fallback;
}

function normalizeRiskScore(value: unknown, fallback: number): number {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        return fallback;
    }

    return Math.min(100, Math.max(0, Math.round(numericValue)));
}

function normalizeRiskLevel(value: unknown, fallback: AiRiskLevel): AiRiskLevel {
    if (value === "LOW" || value === "MEDIUM" || value === "HIGH" || value === "CRITICAL") {
        return value;
    }

    return fallback;
}

function generateMockAssetReport(summary: AnalyticsSummary): AiReport {
    const riskLevel = toAiRiskLevel(summary.riskScore);
    const isGrowing = summary.priceChangePercent >= 0;

    return {
        provider: "MOCK",
        verdict: buildAssetVerdict(summary),
        summary: `${summary.ticker} показывает ${isGrowing ? "положительное" : "отрицательное"} движение ${formatPercent(summary.priceChangePercent)} при риске ${summary.riskScore}/100. Основные параметры для контроля — волатильность, источник данных и сила движения на выбранном периоде.`,
        positiveFactors: buildAssetPositiveFactors(summary),
        negativeFactors: buildAssetNegativeFactors(summary),
        actionItems: [
            "Сравнить актив с ближайшими альтернативами.",
            "Проверить график на дневном, недельном и месячном периоде.",
            "Оценить размер позиции относительно общего портфеля."
        ],
        riskScore: summary.riskScore,
        riskLevel,
        disclaimer: "AI-отчёт не является инвестиционной рекомендацией."
    };
}

function generateMockPortfolioReport(portfolio: PortfolioSimulator): AiReport {
    const riskScore = calculatePortfolioRiskScore(portfolio);
    const riskLevel = toAiRiskLevel(riskScore);
    const totalOpenPositions = portfolio.assetsCount;
    const rubPositive = portfolio.totalRubProfitLoss >= 0;
    const usdPositive = portfolio.totalUsdProfitLoss >= 0;

    return {
        provider: "MOCK",
        verdict: buildPortfolioVerdict(portfolio, riskScore),
        summary: `Портфель содержит ${totalOpenPositions} активов и ${portfolio.lotsCount} открытых лотов. RUB PnL ${rubPositive ? "положительный" : "отрицательный"}, USD PnL ${usdPositive ? "положительный" : "отрицательный"}, общий уровень риска ${riskScore}/100.`,
        positiveFactors: buildPortfolioPositiveFactors(portfolio),
        negativeFactors: buildPortfolioNegativeFactors(portfolio),
        actionItems: [
            "Проверить концентрацию портфеля по крупнейшим позициям.",
            "Сравнить PnL по RUB и USD отдельно.",
            "Посмотреть закрытые сделки и качество точек выхода."
        ],
        riskScore,
        riskLevel,
        disclaimer: "AI-отчёт не является инвестиционной рекомендацией."
    };
}

function buildAssetVerdict(summary: AnalyticsSummary): string {
    if (summary.riskScore >= 80) {
        return `${summary.ticker}: агрессивный профиль риска`;
    }

    if (summary.riskScore >= 60) {
        return `${summary.ticker}: повышенная волатильность`;
    }

    if (summary.priceChangePercent >= 5) {
        return `${summary.ticker}: сильное положительное движение`;
    }

    if (summary.priceChangePercent <= -5) {
        return `${summary.ticker}: заметное снижение`;
    }

    return `${summary.ticker}: умеренный рыночный профиль`;
}

function buildAssetPositiveFactors(summary: AnalyticsSummary): string[] {
    const factors: string[] = [];

    if (summary.priceChangePercent > 0) {
        factors.push(`Положительное движение: ${formatPercent(summary.priceChangePercent)}.`);
    } else {
        factors.push("Актив доступен для сравнения с более сильными инструментами.");
    }

    if (summary.averageVolume > 0) {
        factors.push("Есть объём торгов для базовой оценки активности.");
    }

    if (summary.source !== "DEMO") {
        factors.push(`Данные получены из источника ${summary.source}.`);
    } else {
        factors.push("Fallback-данные позволяют сохранить работу демо без backend.");
    }

    return factors;
}

function buildAssetNegativeFactors(summary: AnalyticsSummary): string[] {
    const factors: string[] = [];

    if (summary.riskScore >= 60) {
        factors.push(`Риск выше среднего: ${summary.riskScore}/100.`);
    } else {
        factors.push("Риск требует проверки на других периодах графика.");
    }

    if (summary.volatilityPercent >= 3) {
        factors.push(`Волатильность заметная: ${formatPercent(summary.volatilityPercent)}.`);
    } else {
        factors.push("Низкая волатильность может ограничивать краткосрочное движение.");
    }

    if (summary.source === "DEMO") {
        factors.push("Источник DEMO снижает точность анализа.");
    } else {
        factors.push("Оценка не учитывает новости, отчётность и внешний фон.");
    }

    return factors;
}

function buildPortfolioVerdict(portfolio: PortfolioSimulator, riskScore: number): string {
    if (portfolio.assetsCount === 0) {
        return "Портфель пока пуст";
    }

    if (riskScore >= 75) {
        return "Портфель требует контроля риска";
    }

    if (portfolio.totalRubProfitLoss >= 0 && portfolio.totalUsdProfitLoss >= 0) {
        return "Портфель в положительной зоне";
    }

    if (portfolio.totalRubProfitLoss < 0 || portfolio.totalUsdProfitLoss < 0) {
        return "Портфель требует пересмотра слабых позиций";
    }

    return "Портфель в рабочем состоянии";
}

function buildPortfolioPositiveFactors(portfolio: PortfolioSimulator): string[] {
    const factors: string[] = [];

    if (portfolio.assetsCount > 1) {
        factors.push("Портфель не завязан на один актив.");
    } else if (portfolio.assetsCount === 1) {
        factors.push("Позиция легко контролируется из-за простой структуры.");
    } else {
        factors.push("Счёт готов к формированию портфеля.");
    }

    if (portfolio.lotsCount > portfolio.assetsCount) {
        factors.push("Лоты разделены по разным точкам входа.");
    } else {
        factors.push("Структура лотов остаётся простой.");
    }

    if (portfolio.totalRubProfitLoss >= 0 || portfolio.totalUsdProfitLoss >= 0) {
        factors.push("Часть портфеля находится в положительной зоне.");
    } else {
        factors.push("Данные портфеля уже готовы для анализа PnL.");
    }

    return factors;
}

function buildPortfolioNegativeFactors(portfolio: PortfolioSimulator): string[] {
    const factors: string[] = [];

    if (portfolio.assetsCount === 0) {
        factors.push("Нет открытых активов для анализа.");
    } else if (portfolio.assetsCount < 3) {
        factors.push("Диверсификация ограничена малым числом активов.");
    } else {
        factors.push("Нужно контролировать перекосы между активами.");
    }

    if (portfolio.totalRubProfitLoss < 0) {
        factors.push("RUB-часть портфеля находится в минусе.");
    } else {
        factors.push("RUB-часть требует периодического контроля фиксации результата.");
    }

    if (portfolio.totalUsdProfitLoss < 0) {
        factors.push("USD-часть портфеля находится в минусе.");
    } else {
        factors.push("USD-часть требует контроля риска на волатильных активах.");
    }

    return factors;
}

function buildVerdictByRisk(riskScore: number): string {
    if (riskScore >= 80) return "Критический риск";
    if (riskScore >= 60) return "Повышенный риск";
    if (riskScore >= 35) return "Средний риск";

    return "Низкий риск";
}

function calculatePortfolioRiskScore(portfolio: PortfolioSimulator): number {
    const openRisk =
        Math.abs(portfolio.totalRubProfitLoss) / 1000 +
        Math.abs(portfolio.totalUsdProfitLoss) / 500;

    const structureRisk = portfolio.lotsCount * 6 + Math.max(0, 3 - portfolio.assetsCount) * 8;

    return Math.min(100, Math.round(openRisk + structureRisk));
}

function toAiRiskLevel(score: number): AiRiskLevel {
    if (score >= 80) return "CRITICAL";
    if (score >= 60) return "HIGH";
    if (score >= 35) return "MEDIUM";

    return "LOW";
}

function formatPercent(value: number): string {
    return `${new Intl.NumberFormat("ru-RU", {
        maximumFractionDigits: 2
    }).format(value)}%`;
}