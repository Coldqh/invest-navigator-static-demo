import { YANDEX_GPT_CONFIG } from "../config/yandexGptConfig";
import type { AnalyticsSummary, Candle, PortfolioSimulator } from "../types/domain";

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

export async function generateAssetReport(
    summary: AnalyticsSummary,
    candles: Candle[] = []
): Promise<AiReport> {
    const fallbackRiskScore = calculateAssetAiRiskScore(summary, candles);

    if (YANDEX_GPT_CONFIG.enabled) {
        const text = await requestYandexGpt(buildAssetPrompt(summary, candles, fallbackRiskScore));
        const parsed = parseAiJson(text, fallbackRiskScore);

        return {
            provider: "YANDEX_GPT",
            ...parsed,
            disclaimer: "Не инвестиционная рекомендация."
        };
    }

    return generateLocalAssetReport(summary, candles);
}

export async function generatePortfolioReport(portfolio: PortfolioSimulator): Promise<AiReport> {
    const fallbackRiskScore = calculatePortfolioRiskScore(portfolio);

    if (YANDEX_GPT_CONFIG.enabled) {
        const text = await requestYandexGpt(buildPortfolioPrompt(portfolio, fallbackRiskScore));
        const parsed = parseAiJson(text, fallbackRiskScore);

        return {
            provider: "YANDEX_GPT",
            ...parsed,
            disclaimer: "Не инвестиционная рекомендация."
        };
    }

    return generateLocalPortfolioReport(portfolio);
}

async function requestYandexGpt(prompt: string): Promise<string> {
    if (!YANDEX_GPT_CONFIG.apiKey.trim()) {
        throw new Error(
            "YandexGPT API key не найден. Добавь GitHub secret VITE_YANDEX_GPT_API_KEY и перезапусти deploy."
        );
    }

    if (!YANDEX_GPT_CONFIG.folderId.trim()) {
        throw new Error(
            "YandexGPT folderId не найден. Добавь GitHub secret VITE_YANDEX_GPT_FOLDER_ID или проверь yandexGptConfig.ts."
        );
    }

    if (!YANDEX_GPT_CONFIG.modelUri.trim()) {
        throw new Error(
            "YandexGPT modelUri не найден. Добавь GitHub secret VITE_YANDEX_GPT_MODEL или проверь yandexGptConfig.ts."
        );
    }

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
                temperature: 0.18,
                maxTokens: Math.max(YANDEX_GPT_CONFIG.maxTokens, 900)
            },
            messages: [
                {
                    role: "system",
                    text: [
                        "Ты аналитический движок в инвестиционном демо-приложении.",
                        "Отвечай только валидным JSON без markdown.",
                        "Стиль: коротко, жёстко, продуктово, без воды.",
                        "Не давай команд купить или продать.",
                        "Для отчёта по активу опирайся только на цену, изменение, волатильность, средний объём и свечи.",
                        "Не используй биржу, источник данных, количество свечей, другие активы, базовый риск, backend, demo, API или техническую сторону сбора данных.",
                        "Свежие новости не выдумывать."
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
        const errorText = await response.text().catch(() => "");

        throw new Error(
            `YandexGPT не ответил: ${response.status}. ${errorText.slice(0, 240)}`
        );
    }

    const data = await response.json() as YandexCompletionResponse;
    const text = data.result?.alternatives?.[0]?.message?.text;

    if (!text) {
        throw new Error("YandexGPT вернул пустой ответ.");
    }

    return text;
}

function buildAssetPrompt(
    summary: AnalyticsSummary,
    candles: Candle[],
    fallbackRiskScore: number
): string {
    const preparedCandles = candles.slice(-60).map((candle) => ({
        timestamp: candle.timestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume
    }));

    return JSON.stringify({
        task: "Собери короткий AI-отчёт по активу.",
        output: {
            verdict: "короткая фраза до 64 символов",
            summary: "одно плотное предложение",
            positiveFactors: ["3 коротких пункта"],
            negativeFactors: ["3 коротких пункта"],
            riskScore: "число 0-100, рассчитанное только из разрешённых данных",
            riskLevel: "LOW | MEDIUM | HIGH | CRITICAL"
        },
        hardRules: [
            "Используй только currentPrice, priceChange, priceChangePercent, averageVolume, volatilityPercent и candles.",
            "Не используй биржу.",
            "Не используй источник данных.",
            "Не используй количество свечей или точек как фактор.",
            "Не сравнивай с другими активами.",
            "Не используй базовый риск.",
            "Не упоминай backend, demo, source, dataPoints, API, биржу или техническую сторону сбора данных.",
            "Не добавляй раздел actionItems.",
            "Не советуй купить или продать.",
            "Свежие новости не выдумывать."
        ],
        allowedData: {
            ticker: summary.ticker,
            currentPrice: summary.currentPrice,
            firstClose: summary.firstClose,
            lastClose: summary.lastClose,
            priceChange: summary.priceChange,
            priceChangePercent: summary.priceChangePercent,
            averageVolume: summary.averageVolume,
            volatilityPercent: summary.volatilityPercent,
            candles: preparedCandles
        },
        fallbackRiskScore
    });
}

function buildPortfolioPrompt(portfolio: PortfolioSimulator, fallbackRiskScore: number): string {
    return JSON.stringify({
        task: "Собери короткий AI-отчёт по портфелю.",
        output: {
            verdict: "короткая фраза до 64 символов",
            summary: "одно плотное предложение",
            positiveFactors: ["3 коротких пункта"],
            negativeFactors: ["3 коротких пункта"],
            riskScore: "число 0-100",
            riskLevel: "LOW | MEDIUM | HIGH | CRITICAL"
        },
        constraints: [
            "Не пиши общие фразы.",
            "Не пиши длинные объяснения.",
            "Опирайся на позиции, лоты, PnL, валюты и концентрацию.",
            "Не добавляй раздел actionItems.",
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
        },
        fallbackRiskScore
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
            "Цена и свечи обработаны.",
            "Волатильность учтена.",
            "Средний объём учтён."
        ]),
        negativeFactors: normalizeStringArray(parsed.negativeFactors, [
            "Сильные движения могут быстро смениться.",
            "Свечной контекст ограничен текущим периодом.",
            "Новостной фон не подтверждён."
        ]),
        actionItems: [],
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

function generateLocalAssetReport(summary: AnalyticsSummary, candles: Candle[]): AiReport {
    const riskScore = calculateAssetAiRiskScore(summary, candles);
    const riskLevel = toAiRiskLevel(riskScore);
    const direction = summary.priceChangePercent >= 0 ? "рост" : "падение";
    const absMove = Math.abs(summary.priceChangePercent);
    const drawdown = calculateMaxDrawdownPercent(candles.map((candle) => candle.close));
    const candleBias = calculateCandleBias(candles);

    return {
        provider: "MOCK",
        verdict: buildAssetVerdict(summary, riskScore),
        summary: `${summary.ticker}: ${direction} ${formatPercent(absMove)}, волатильность ${formatPercent(summary.volatilityPercent)}, средний объём ${formatCompactNumber(summary.averageVolume)}.`,
        positiveFactors: [
            summary.priceChangePercent >= 0
                ? `Цена растёт на ${formatPercent(summary.priceChangePercent)}.`
                : `Цена уже снизилась на ${formatPercent(absMove)}.`,
            candleBias >= 0
                ? "Свечная структура держит положительный уклон."
                : "После снижения есть база для проверки реакции.",
            summary.averageVolume > 0
                ? `Средний объём: ${formatCompactNumber(summary.averageVolume)}.`
                : "Объём пока слабый."
        ],
        negativeFactors: [
            summary.volatilityPercent >= 3
                ? `Волатильность высокая: ${formatPercent(summary.volatilityPercent)}.`
                : `Волатильность есть: ${formatPercent(summary.volatilityPercent)}.`,
            drawdown > 0
                ? `Максимальная просадка по свечам: ${formatPercent(drawdown)}.`
                : "Просадка по свечам почти отсутствует.",
            summary.priceChangePercent < 0
                ? `Текущий период красный: ${formatPercent(summary.priceChangePercent)}.`
                : "Рост не отменяет риск отката."
        ],
        actionItems: [],
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
        actionItems: [],
        riskScore,
        riskLevel,
        disclaimer: "Не инвестиционная рекомендация."
    };
}

function calculateAssetAiRiskScore(summary: AnalyticsSummary, candles: Candle[]): number {
    const closes = candles.map((candle) => candle.close);
    const drawdown = calculateMaxDrawdownPercent(closes);
    const downside = calculateDownsideDaysPercent(closes);
    const candleBias = calculateCandleBias(candles);

    const volatilityRisk = clamp(summary.volatilityPercent * 9, 0, 30);
    const drawdownRisk = clamp(drawdown * 1.3, 0, 28);
    const downsideRisk = clamp(downside * 0.12, 0, 14);
    const negativeMoveRisk = summary.priceChangePercent < 0
        ? clamp(Math.abs(summary.priceChangePercent) * 1.4, 0, 22)
        : 0;
    const positiveMoveDiscount = summary.priceChangePercent > 0
        ? clamp(summary.priceChangePercent * 0.9, 0, 16)
        : 0;
    const candleBiasDiscount = candleBias > 0 ? clamp(candleBias * 10, 0, 10) : 0;
    const candleBiasPenalty = candleBias < 0 ? clamp(Math.abs(candleBias) * 10, 0, 10) : 0;

    return clamp(
        Math.round(
            18 +
            volatilityRisk +
            drawdownRisk +
            downsideRisk +
            negativeMoveRisk +
            candleBiasPenalty -
            positiveMoveDiscount -
            candleBiasDiscount
        ),
        5,
        92
    );
}

function buildAssetVerdict(summary: AnalyticsSummary, riskScore: number): string {
    if (riskScore >= 75) return `${summary.ticker}: риск высокий`;
    if (riskScore >= 55) return `${summary.ticker}: движение нервное`;
    if (summary.priceChangePercent >= 5) return `${summary.ticker}: сильный импульс`;
    if (summary.priceChangePercent <= -5) return `${summary.ticker}: просадка`;
    if (summary.volatilityPercent >= 3) return `${summary.ticker}: волатильный режим`;

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

function calculateMaxDrawdownPercent(values: number[]): number {
    if (values.length < 2) {
        return 0;
    }

    let peak = values[0];
    let maxDrawdown = 0;

    values.forEach((value) => {
        peak = Math.max(peak, value);

        if (peak > 0) {
            const drawdown = ((peak - value) / peak) * 100;
            maxDrawdown = Math.max(maxDrawdown, drawdown);
        }
    });

    return maxDrawdown;
}

function calculateDownsideDaysPercent(values: number[]): number {
    if (values.length < 2) {
        return 0;
    }

    const changes = values.slice(1).map((value, index) => {
        return value - values[index];
    });

    const downsideDays = changes.filter((value) => value < 0).length;

    return (downsideDays / changes.length) * 100;
}

function calculateCandleBias(candles: Candle[]): number {
    if (candles.length === 0) {
        return 0;
    }

    const greenCandles = candles.filter((candle) => candle.close >= candle.open).length;
    const redCandles = candles.length - greenCandles;

    return (greenCandles - redCandles) / candles.length;
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
    if (riskScore >= 75) return "Критический риск";
    if (riskScore >= 55) return "Высокий риск";
    if (riskScore >= 32) return "Средний риск";

    return "Низкий риск";
}

function buildSummaryByRisk(riskScore: number): string {
    return `AI оценил риск на ${riskScore}/100.`;
}

function toAiRiskLevel(score: number): AiRiskLevel {
    if (score >= 75) return "CRITICAL";
    if (score >= 55) return "HIGH";
    if (score >= 32) return "MEDIUM";

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