import { YANDEX_GPT_CONFIG } from "../config/yandexGptConfig";
import type { AnalyticsSummary, PortfolioSimulator } from "../types/domain";

export type AiReport = {
    provider: "MOCK" | "YANDEX_GPT";
    summary: string;
    positiveFactors: string[];
    negativeFactors: string[];
    riskScore: number;
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
            return generateMockAssetReport(summary, "MOCK");
        }
    }

    return generateMockAssetReport(summary, "MOCK");
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
                        "Ты встроенный AI-аналитик демо-приложения Invest Navigator AI.",
                        "Отвечай строго JSON без markdown.",
                        "Не давай инвестиционных рекомендаций к покупке или продаже.",
                        "Давай учебный аналитический обзор: риски, плюсы, минусы, общая картина."
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
        task: "Сделай краткий JSON-отчёт по активу.",
        requiredJsonShape: {
            summary: "string",
            positiveFactors: ["string"],
            negativeFactors: ["string"],
            riskScore: 0
        },
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
        task: "Сделай краткий JSON-отчёт по симуляторному портфелю.",
        requiredJsonShape: {
            summary: "string",
            positiveFactors: ["string"],
            negativeFactors: ["string"],
            riskScore: 0
        },
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

function parseAiJson(text: string, fallbackRiskScore: number): Omit<AiReport, "provider" | "disclaimer"> {
    try {
        const cleanedText = text
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

        const parsed = JSON.parse(cleanedText) as Partial<AiReport>;

        return {
            summary: typeof parsed.summary === "string"
                ? parsed.summary
                : "AI вернул неполный ответ, поэтому показана упрощённая сводка.",
            positiveFactors: normalizeStringArray(parsed.positiveFactors, [
                "AI-анализ успешно получен.",
                "Данные обработаны в браузерной версии приложения."
            ]),
            negativeFactors: normalizeStringArray(parsed.negativeFactors, [
                "Ответ AI был частично неполным.",
                "Статическая версия не имеет серверной проверки данных."
            ]),
            riskScore: normalizeRiskScore(parsed.riskScore, fallbackRiskScore)
        };
    } catch {
        throw new Error("Failed to parse YandexGPT JSON");
    }
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
    if (!Array.isArray(value)) {
        return fallback;
    }

    const items = value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);

    return items.length > 0 ? items : fallback;
}

function normalizeRiskScore(value: unknown, fallback: number): number {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        return fallback;
    }

    return Math.min(100, Math.max(0, Math.round(numericValue)));
}

function generateMockAssetReport(
    summary: AnalyticsSummary,
    provider: "MOCK" | "YANDEX_GPT"
): AiReport {
    return {
        provider,
        summary: `${summary.ticker}: текущая цена ${summary.currentPrice.toFixed(4)}, изменение ${summary.priceChangePercent.toFixed(2)}%, риск ${summary.riskScore}/100.`,
        positiveFactors: [
            "Есть свежие рыночные данные или fallback-данные для демо.",
            "Актив можно сравнить с другими инструментами.",
            "Показатели риска и волатильности считаются прямо в браузере."
        ],
        negativeFactors: [
            "Статическая версия не имеет серверной валидации.",
            "Если браузер блокирует CORS, используется демо-цена.",
            "AI-запрос мог быть заменён fallback-отчётом."
        ],
        riskScore: summary.riskScore,
        disclaimer: "Демо-отчёт не является инвестиционной рекомендацией."
    };
}

function generateMockPortfolioReport(portfolio: PortfolioSimulator): AiReport {
    const riskScore = calculatePortfolioRiskScore(portfolio);

    return {
        provider: "MOCK",
        summary: `В портфеле ${portfolio.assetsCount} активов и ${portfolio.lotsCount} лотов. Основной фокус сейчас — контроль риска, баланса RUB/USD и качества точек входа.`,
        positiveFactors: [
            "Портфель разделён на отдельные лоты, поэтому видны разные точки входа.",
            "Счёт хранит RUB и USD отдельно.",
            "Покупки и продажи фиксируются в журнале операций."
        ],
        negativeFactors: [
            "Данные хранятся только в браузере.",
            "Нет синхронизации между устройствами.",
            "AI-запрос мог быть заменён fallback-отчётом."
        ],
        riskScore,
        disclaimer: "Демо-отчёт не является инвестиционной рекомендацией."
    };
}

function calculatePortfolioRiskScore(portfolio: PortfolioSimulator): number {
    const totalRisk = Math.abs(portfolio.totalRubProfitLoss) + Math.abs(portfolio.totalUsdProfitLoss);

    return Math.min(100, Math.round(totalRisk / 1000 + portfolio.lotsCount * 7));
}