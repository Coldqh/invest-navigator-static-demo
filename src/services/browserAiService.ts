import { getSettings } from "./settingsService";
import type { AnalyticsSummary, PortfolioSimulator } from "../types/domain";

export type AiReport = {
    provider: "MOCK" | "YANDEX_GPT_EXPERIMENTAL";
    summary: string;
    positiveFactors: string[];
    negativeFactors: string[];
    riskScore: number;
    disclaimer: string;
};

export async function generateAssetReport(summary: AnalyticsSummary): Promise<AiReport> {
    const settings = getSettings();

    if (settings.yandexGptEnabled && settings.yandexGptApiKey) {
        // Заготовка: прямой браузерный вызов YandexGPT нужно отдельно проверить на CORS.
        // Пока оставляем safe fallback, чтобы GitHub Pages версия не ломалась.
        return generateMockAssetReport(summary, "YANDEX_GPT_EXPERIMENTAL");
    }

    return generateMockAssetReport(summary, "MOCK");
}

export async function generatePortfolioReport(portfolio: PortfolioSimulator): Promise<AiReport> {
    const totalRisk = Math.abs(portfolio.totalRubProfitLoss) + Math.abs(portfolio.totalUsdProfitLoss);
    const riskScore = Math.min(100, Math.round(totalRisk / 1000 + portfolio.lotsCount * 7));

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
            "AI-режим пока работает как mock/fallback.",
            "Нет синхронизации между устройствами."
        ],
        riskScore,
        disclaimer: "Демо-отчёт не является инвестиционной рекомендацией."
    };
}

function generateMockAssetReport(
    summary: AnalyticsSummary,
    provider: "MOCK" | "YANDEX_GPT_EXPERIMENTAL"
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
            "AI-подключение требует отдельной проверки прямого вызова."
        ],
        riskScore: summary.riskScore,
        disclaimer: "Демо-отчёт не является инвестиционной рекомендацией."
    };
}
