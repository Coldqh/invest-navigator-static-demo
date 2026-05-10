import { createDemoCandles, createDemoPriceDrift } from "../data/demoMarketData";
import { getAsset } from "./assetsService";
import type {
    AnalyticsSummary,
    Candle,
    MarketPrice,
    MarketDataSource,
    RiskLevel
} from "../types/domain";

export type ChartPeriod = "DAY" | "WEEK" | "MONTH";

export async function getMarketPrice(ticker: string): Promise<MarketPrice> {
    const asset = getAsset(ticker);

    if (!asset) {
        throw new Error(`Asset not found: ${ticker}`);
    }

    if (asset.assetType === "CRYPTO") {
        return getBinancePrice(asset.ticker, asset.name);
    }

    if (asset.exchange === "MOEX") {
        return getMoexPrice(asset.ticker, asset.name);
    }

    return getDemoPrice(asset.ticker, asset.name, "DEMO");
}

export async function getCandles(
    ticker: string,
    period: ChartPeriod = "MONTH"
): Promise<Candle[]> {
    const asset = getAsset(ticker);

    if (!asset) {
        throw new Error(`Asset not found: ${ticker}`);
    }

    if (asset.assetType === "CRYPTO") {
        return getBinanceCandles(asset.ticker, period);
    }

    if (asset.exchange === "MOEX") {
        return getMoexCandles(asset.ticker, period);
    }

    return getDemoCandlesByPeriod(asset.ticker, "DEMO", period);
}

export async function getAnalyticsSummary(ticker: string): Promise<AnalyticsSummary> {
    const asset = getAsset(ticker);
    const price = await getMarketPrice(ticker);
    const candles = await getCandles(ticker, "MONTH");

    const closes = candles.map((candle) => candle.close);
    const firstClose = closes[0] ?? price.price;
    const lastClose = closes[closes.length - 1] ?? price.price;
    const priceChange = lastClose - firstClose;
    const priceChangePercent = firstClose === 0 ? 0 : (priceChange / firstClose) * 100;
    const averageVolume = average(candles.map((candle) => candle.volume));
    const volatilityPercent = calculateVolatilityPercent(closes);
    const maxDrawdownPercent = calculateMaxDrawdownPercent(closes);
    const downsideDaysPercent = calculateDownsideDaysPercent(closes);

    const baseRisk = getBaseRisk(asset?.assetType ?? "UNKNOWN");
    const volatilityRisk = clamp(volatilityPercent * 10, 0, 28);
    const drawdownRisk = clamp(maxDrawdownPercent * 1.55, 0, 30);
    const downsideRisk = clamp(downsideDaysPercent * 0.16, 0, 16);
    const negativeTrendRisk = priceChangePercent < 0
        ? clamp(Math.abs(priceChangePercent) * 1.75, 0, 24)
        : 0;
    const positiveTrendDiscount = priceChangePercent > 0
        ? clamp(priceChangePercent * 1.05, 0, 18)
        : 0;
    const sourcePenalty = price.source === "DEMO" ? 6 : 0;
    const lowDataPenalty = candles.length < 20 ? 5 : 0;

    const riskScore = clamp(
        Math.round(
            baseRisk +
            volatilityRisk +
            drawdownRisk +
            downsideRisk +
            negativeTrendRisk +
            sourcePenalty +
            lowDataPenalty -
            positiveTrendDiscount
        ),
        3,
        92
    );

    return {
        ticker: price.ticker,
        name: price.name,
        currentPrice: price.price,
        firstClose,
        lastClose,
        priceChange,
        priceChangePercent,
        averageVolume,
        volatilityPercent,
        riskScore,
        riskLevel: toRiskLevel(riskScore),
        dataPoints: candles.length,
        source: price.source
    };
}

async function getBinancePrice(ticker: string, name: string): Promise<MarketPrice> {
    try {
        const response = await fetch(
            `https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(ticker)}`
        );

        if (!response.ok) {
            throw new Error(`Binance failed with ${response.status}`);
        }

        const data = await response.json() as {
            lastPrice: string;
            volume: string;
        };

        const price = Number(data.lastPrice);

        if (!Number.isFinite(price) || price <= 0) {
            throw new Error("Binance returned invalid price");
        }

        return {
            ticker,
            name,
            price,
            volume: Number(data.volume),
            source: "BINANCE",
            timestamp: new Date().toISOString()
        };
    } catch {
        return getDemoPrice(ticker, name, "DEMO");
    }
}

async function getMoexPrice(ticker: string, name: string): Promise<MarketPrice> {
    try {
        const url = `https://iss.moex.com/iss/engines/stock/markets/shares/boards/TQBR/securities/${encodeURIComponent(
            ticker
        )}.json?iss.meta=off&iss.only=marketdata&marketdata.columns=SECID,LAST,LCURRENTPRICE,LEGALCLOSEPRICE,MARKETPRICE,PREVPRICE,VOLTODAY,VALUE`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`MOEX failed with ${response.status}`);
        }

        const data = await response.json() as {
            marketdata?: {
                columns?: string[];
                data?: Array<Array<string | number | null>>;
            };
        };

        const columns = data.marketdata?.columns ?? [];
        const row = data.marketdata?.data?.[0];

        if (!row) {
            throw new Error("MOEX empty response");
        }

        const price = firstPositiveNumber(row, columns, [
            "LAST",
            "LCURRENTPRICE",
            "LEGALCLOSEPRICE",
            "MARKETPRICE",
            "PREVPRICE"
        ]);

        const volume = firstFiniteNumber(row, columns, [
            "VOLTODAY",
            "VALUE"
        ]);

        if (!Number.isFinite(price) || price <= 0) {
            throw new Error("MOEX price is empty");
        }

        return {
            ticker,
            name,
            price,
            volume,
            source: "MOEX",
            timestamp: new Date().toISOString()
        };
    } catch {
        return getDemoPrice(ticker, name, "DEMO");
    }
}

async function getBinanceCandles(
    ticker: string,
    period: ChartPeriod
): Promise<Candle[]> {
    try {
        const config = getBinancePeriodConfig(period);

        const response = await fetch(
            `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(ticker)}&interval=${config.interval}&limit=${config.limit}`
        );

        if (!response.ok) {
            throw new Error(`Binance candles failed with ${response.status}`);
        }

        const data = await response.json() as Array<Array<number | string>>;

        const candles = data.map<Candle>((row) => ({
            timestamp: new Date(Number(row[0])).toISOString(),
            open: Number(row[1]),
            high: Number(row[2]),
            low: Number(row[3]),
            close: Number(row[4]),
            volume: Number(row[5]),
            source: "BINANCE"
        })).filter((candle) => {
            return (
                Number.isFinite(candle.open) &&
                Number.isFinite(candle.high) &&
                Number.isFinite(candle.low) &&
                Number.isFinite(candle.close)
            );
        });

        if (candles.length === 0) {
            throw new Error("Binance candles parsed empty");
        }

        return candles;
    } catch {
        return getDemoCandlesByPeriod(ticker, "DEMO", period);
    }
}

async function getMoexCandles(
    ticker: string,
    period: ChartPeriod
): Promise<Candle[]> {
    try {
        const config = getMoexPeriodConfig(period);
        const from = new Date(Date.now() - config.daysBack * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10);

        const url = `https://iss.moex.com/iss/engines/stock/markets/shares/boards/TQBR/securities/${encodeURIComponent(
            ticker
        )}/candles.json?from=${from}&interval=${config.interval}&iss.meta=off`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`MOEX candles failed with ${response.status}`);
        }

        const data = await response.json() as {
            candles?: {
                columns?: string[];
                data?: Array<Array<string | number | null>>;
            };
        };

        const columns = data.candles?.columns ?? [];
        const rows = data.candles?.data ?? [];

        if (rows.length === 0) {
            throw new Error("MOEX candles empty response");
        }

        const openIndex = columns.indexOf("open");
        const closeIndex = columns.indexOf("close");
        const highIndex = columns.indexOf("high");
        const lowIndex = columns.indexOf("low");
        const valueIndex = columns.indexOf("value");
        const volumeIndex = columns.indexOf("volume");
        const beginIndex = columns.indexOf("begin");

        const candles: Candle[] = rows
            .slice(-config.limit)
            .map<Candle>((row) => ({
                timestamp: new Date(String(row[beginIndex])).toISOString(),
                open: Number(row[openIndex]),
                high: Number(row[highIndex]),
                low: Number(row[lowIndex]),
                close: Number(row[closeIndex]),
                volume: Number(row[volumeIndex] ?? row[valueIndex] ?? 0),
                source: "MOEX"
            }))
            .filter((candle) => {
                return (
                    Number.isFinite(candle.open) &&
                    Number.isFinite(candle.high) &&
                    Number.isFinite(candle.low) &&
                    Number.isFinite(candle.close)
                );
            });

        if (candles.length === 0) {
            throw new Error("MOEX candles parsed empty");
        }

        return candles;
    } catch {
        return getDemoCandlesByPeriod(ticker, "DEMO", period);
    }
}

function getDemoPrice(
    ticker: string,
    name: string,
    source: MarketDataSource
): MarketPrice {
    const price = createDemoPriceDrift(ticker);

    return {
        ticker,
        name,
        price,
        volume: Math.round(price * 1200),
        source,
        timestamp: new Date().toISOString()
    };
}

function getDemoCandlesByPeriod(
    ticker: string,
    source: MarketDataSource,
    period: ChartPeriod
): Candle[] {
    if (period === "DAY") {
        return createDemoCandles(ticker, source, 24);
    }

    if (period === "WEEK") {
        return createDemoCandles(ticker, source, 14);
    }

    return createDemoCandles(ticker, source, 30);
}

function getBinancePeriodConfig(period: ChartPeriod): {
    interval: string;
    limit: number;
} {
    if (period === "DAY") {
        return {
            interval: "1h",
            limit: 24
        };
    }

    if (period === "WEEK") {
        return {
            interval: "4h",
            limit: 42
        };
    }

    return {
        interval: "1d",
        limit: 30
    };
}

function getMoexPeriodConfig(period: ChartPeriod): {
    interval: number;
    limit: number;
    daysBack: number;
} {
    if (period === "DAY") {
        return {
            interval: 60,
            limit: 24,
            daysBack: 3
        };
    }

    if (period === "WEEK") {
        return {
            interval: 60,
            limit: 42,
            daysBack: 10
        };
    }

    return {
        interval: 24,
        limit: 30,
        daysBack: 45
    };
}

function firstPositiveNumber(
    row: Array<string | number | null>,
    columns: string[],
    names: string[]
): number {
    for (const name of names) {
        const index = columns.indexOf(name);

        if (index < 0) {
            continue;
        }

        const value = Number(row[index]);

        if (Number.isFinite(value) && value > 0) {
            return value;
        }
    }

    return 0;
}

function firstFiniteNumber(
    row: Array<string | number | null>,
    columns: string[],
    names: string[]
): number {
    for (const name of names) {
        const index = columns.indexOf(name);

        if (index < 0) {
            continue;
        }

        const value = Number(row[index]);

        if (Number.isFinite(value)) {
            return value;
        }
    }

    return 0;
}

function getBaseRisk(assetType: string): number {
    if (assetType === "CRYPTO") {
        return 22;
    }

    if (assetType === "STOCK") {
        return 14;
    }

    if (assetType === "ETF" || assetType === "INDEX") {
        return 10;
    }

    if (assetType === "BOND" || assetType === "CURRENCY") {
        return 8;
    }

    return 16;
}

function average(values: number[]): number {
    if (values.length === 0) {
        return 0;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateVolatilityPercent(values: number[]): number {
    if (values.length < 2) {
        return 0;
    }

    const changes = values.slice(1).map((value, index) => {
        const previous = values[index];

        if (previous === 0) {
            return 0;
        }

        return ((value - previous) / previous) * 100;
    });

    return average(changes.map((value) => Math.abs(value)));
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

function toRiskLevel(score: number): RiskLevel {
    if (score >= 75) return "CRITICAL";
    if (score >= 55) return "HIGH";
    if (score >= 32) return "MEDIUM";

    return "LOW";
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}