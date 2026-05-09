export type AssetType =
    | "STOCK"
    | "BOND"
    | "ETF"
    | "INDEX"
    | "CURRENCY"
    | "CRYPTO";

export type Currency = "RUB" | "USD";

export type MarketDataSource = "MOEX" | "BINANCE" | "DEMO";

export type ProviderStatus = "AVAILABLE" | "DEGRADED" | "UNAVAILABLE";

export type Asset = {
    id: string;
    ticker: string;
    name: string;
    assetType: AssetType;
    exchange: string;
    currency: Currency;
    isin?: string | null;
    active: boolean;
};

export type MarketPrice = {
    ticker: string;
    name: string;
    price: number;
    volume: number;
    source: MarketDataSource;
    timestamp: string;
};

export type Candle = {
    timestamp: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    source: MarketDataSource;
};

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type AnalyticsSummary = {
    ticker: string;
    name: string;
    currentPrice: number;
    firstClose: number;
    lastClose: number;
    priceChange: number;
    priceChangePercent: number;
    averageVolume: number;
    volatilityPercent: number;
    riskScore: number;
    riskLevel: RiskLevel;
    dataPoints: number;
    source: string;
};

export type CashAccount = {
    rubBalance: number;
    usdBalance: number;
    updatedAt: string;
};

export type TransactionType = "BUY" | "SELL";

export type PortfolioLot = {
    id: string;
    assetId: string;
    ticker: string;
    name: string;
    assetType: AssetType;
    exchange: string;
    currency: Currency;
    originalQuantity: number;
    remainingQuantity: number;
    buyPrice: number;
    buyTotalAmount: number;
    buyPriceSource: string;
    buyPriceTimestamp: string;
    openedAt: string;
    closedAt?: string | null;
    active: boolean;
};

export type PortfolioTransaction = {
    id: string;
    ticker: string;
    name: string;
    currency: Currency;
    transactionType: TransactionType;
    quantity: number;
    price: number;
    totalAmount: number;
    executedAt: string;
    note?: string | null;
};

export type PortfolioLotView = PortfolioLot & {
    currentPrice: number;
    investedAmount: number;
    currentValue: number;
    profitLoss: number;
    profitLossPercent: number;
    holdingDays: number;
    currentPriceSource: string;
    currentPriceTimestamp: string;
};

export type PortfolioHoldingView = {
    assetId: string;
    ticker: string;
    name: string;
    assetType: AssetType;
    exchange: string;
    currency: Currency;
    totalQuantity: number;
    averageBuyPrice: number;
    currentPrice: number;
    investedAmount: number;
    currentValue: number;
    profitLoss: number;
    profitLossPercent: number;
    holdingDays: number;
    currentPriceSource: string;
    currentPriceTimestamp: string;
    lots: PortfolioLotView[];
};

export type PortfolioSimulator = {
    account: CashAccount;
    totalRubInvested: number;
    totalRubCurrentValue: number;
    totalRubProfitLoss: number;
    totalUsdInvested: number;
    totalUsdCurrentValue: number;
    totalUsdProfitLoss: number;
    assetsCount: number;
    lotsCount: number;
    holdings: PortfolioHoldingView[];
    transactions: PortfolioTransaction[];
    calculatedAt: string;
};

export type AppSettings = {
    yandexGptApiKey: string;
    yandexGptFolderId: string;
    yandexGptModel: string;
    yandexGptEnabled: boolean;
};

export type StaticAppBackup = {
    version: number;
    exportedAt: string;
    values: Record<string, unknown>;
};