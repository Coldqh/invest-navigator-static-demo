import { createDemoCandles, createDemoPriceDrift } from "../data/demoMarketData";
import { getAsset } from "./assetsService";
import type {
    AnalyticsSummary,
    Candle,
    MarketPrice,
    MarketDataSource,
    RiskLevel
} from "../types/domain";

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

export async function getCandles(ticker: string): Promise<Candle[]> {
    const asset = getAsset(ticker);

    if (!asset) {
        throw new Error(`Asset not found: ${ticker}`);
    }

    if (asset.assetType === "CRYPTO") {
        return getBinanceCandles(asset.ticker);
    }

    if (asset.exchange === "MOEX") {
        return getMoexCandles(asset.ticker);
    }

    return createDemoCandles(asset.ticker, "DEMO");
}

export async function getAnalyticsSummary(ticker: string): Promise<AnalyticsSummary> {
    const price = await getMarketPrice(ticker);
    const candles = await getCandles(ticker);

    const closes = candles.map((candle) => candle.close);
    const firstClose = closes[0] ?? price.price;
    const lastClose = closes[closes.length - 1] ?? price.price;
    const priceChange = lastClose - firstClose;
    const priceChangePercent = firstClose === 0 ? 0 : (priceChange / firstClose) * 100;
    const averageVolume = average(candles.map((candle) => candle.volume));
    const volatilityPercent = calculateVolatilityPercent(closes);
    const riskScore = clamp(
        Math.round(volatilityPercent * 5 + Math.abs(priceChangePercent) * 1.4),
        0,
        100
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
        const url = `https://iss.moex.com/iss/engines/stock/markets/shares/securities/${encodeURIComponent(
            ticker
        )}.json?iss.meta=off&iss.only=marketdata&marketdata.columns=SECID,LAST,VALUE,VOLTODAY`;

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

        const lastIndex = columns.indexOf("LAST");
        const volumeIndex = columns.indexOf("VOLTODAY");
        const valueIndex = columns.indexOf("VALUE");

        const price = Number(row[lastIndex]);
        const volume = Number(row[volumeIndex] ?? row[valueIndex] ?? 0);

        if (!Number.isFinite(price) || price <= 0) {
            throw new Error("MOEX LAST is empty");
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

async function getBinanceCandles(ticker: string): Promise<Candle[]> {
    try {
        const response = await fetch(
            `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(ticker)}&interval=1d&limit=30`
        );

        if (!response.ok) {
            throw new Error(`Binance candles failed with ${response.status}`);
        }

        const data = await response.json() as Array<Array<number | string>>;

        return data.map((row) => ({
            timestamp: new Date(Number(row[0])).toISOString(),
            open: Number(row[1]),
            high: Number(row[2]),
            low: Number(row[3]),
            close: Number(row[4]),
            volume: Number(row[5]),
            source: "BINANCE"
        }));
    } catch {
        return createDemoCandles(ticker, "DEMO");
    }
}

async function getMoexCandles(ticker: string): Promise<Candle[]> {
    try {
        const today = new Date();
        const from = new Date(today.getTime() - 45 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10);

        const url = `https://iss.moex.com/iss/engines/stock/markets/shares/securities/${encodeURIComponent(
            ticker
        )}/candles.json?from=${from}&interval=24&iss.meta=off`;

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
        const beginIndex = columns.indexOf("begin");

        return rows.slice(-30).map((row) => ({
            timestamp: new Date(String(row[beginIndex])).toISOString(),
            open: Number(row[openIndex]),
            high: Number(row[highIndex]),
            low: Number(row[lowIndex]),
            close: Number(row[closeIndex]),
            volume: Number(row[valueIndex] ?? 0),
            source: "MOEX"
        }));
    } catch {
        return createDemoCandles(ticker, "DEMO");
    }
}

function getDemoPrice(
    ticker: string,
    name: string,
    source: MarketDataSource
): MarketPrice {
    return {
        ticker,
        name,
        price: createDemoPriceDrift(ticker),
        volume: Math.round(createDemoPriceDrift(ticker) * 1200),
        source,
        timestamp: new Date().toISOString()
    };
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

function toRiskLevel(score: number): RiskLevel {
    if (score >= 80) return "CRITICAL";
    if (score >= 60) return "HIGH";
    if (score >= 35) return "MEDIUM";

    return "LOW";
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}