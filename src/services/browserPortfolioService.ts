import { getAsset, getAssets } from "./assetsService";
import { getMarketPrice } from "./browserMarketDataService";
import { readStorage, writeStorage } from "./storageService";
import type {
    CashAccount,
    PortfolioHoldingView,
    PortfolioLot,
    PortfolioLotView,
    PortfolioSimulator,
    PortfolioTransaction
} from "../types/domain";

const ACCOUNT_KEY = "invest.navigator.static.account";
const LOTS_KEY = "invest.navigator.static.lots";
const TRANSACTIONS_KEY = "invest.navigator.static.transactions";

const DEFAULT_ACCOUNT: CashAccount = {
    rubBalance: 0,
    usdBalance: 0,
    updatedAt: new Date().toISOString()
};

export function getAccount(): CashAccount {
    return readStorage<CashAccount>(ACCOUNT_KEY, DEFAULT_ACCOUNT);
}

export function updateAccount(nextAccount: Omit<CashAccount, "updatedAt">): CashAccount {
    const account: CashAccount = {
        ...nextAccount,
        updatedAt: new Date().toISOString()
    };

    writeStorage(ACCOUNT_KEY, account);

    return account;
}

export function getLots(): PortfolioLot[] {
    return readStorage<PortfolioLot[]>(LOTS_KEY, []);
}

export function getTransactions(): PortfolioTransaction[] {
    return readStorage<PortfolioTransaction[]>(TRANSACTIONS_KEY, []);
}

export async function getSimulator(): Promise<PortfolioSimulator> {
    const account = getAccount();
    const lots = getLots().filter((lot) => lot.active && lot.remainingQuantity > 0);
    const transactions = getTransactions();

    const lotsWithPrices = await Promise.all(lots.map(toLotView));
    const holdings = groupLots(lotsWithPrices);

    const totalRubInvested = sumByCurrency(holdings, "RUB", "investedAmount");
    const totalRubCurrentValue = sumByCurrency(holdings, "RUB", "currentValue");
    const totalUsdInvested = sumByCurrency(holdings, "USD", "investedAmount");
    const totalUsdCurrentValue = sumByCurrency(holdings, "USD", "currentValue");

    return {
        account,
        totalRubInvested,
        totalRubCurrentValue,
        totalRubProfitLoss: totalRubCurrentValue - totalRubInvested,
        totalUsdInvested,
        totalUsdCurrentValue,
        totalUsdProfitLoss: totalUsdCurrentValue - totalUsdInvested,
        assetsCount: holdings.length,
        lotsCount: lots.length,
        holdings,
        transactions,
        calculatedAt: new Date().toISOString()
    };
}

export async function buyAsset(ticker: string, quantity: number): Promise<PortfolioSimulator> {
    const asset = getAsset(ticker);

    if (!asset) {
        throw new Error(`Актив не найден: ${ticker}`);
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("Количество должно быть больше 0");
    }

    const price = await getMarketPrice(asset.ticker);
    const totalAmount = quantity * price.price;
    const currency = asset.currency;
    const account = getAccount();

    if (currency === "RUB") {
        if (account.rubBalance < totalAmount) {
            throw new Error("Недостаточно RUB на счёте");
        }

        updateAccount({
            rubBalance: account.rubBalance - totalAmount,
            usdBalance: account.usdBalance
        });
    } else {
        if (account.usdBalance < totalAmount) {
            throw new Error("Недостаточно USD на счёте");
        }

        updateAccount({
            rubBalance: account.rubBalance,
            usdBalance: account.usdBalance - totalAmount
        });
    }

    const now = new Date().toISOString();
    const lot: PortfolioLot = {
        id: crypto.randomUUID(),
        assetId: asset.id,
        ticker: asset.ticker,
        name: asset.name,
        assetType: asset.assetType,
        exchange: asset.exchange,
        currency,
        originalQuantity: quantity,
        remainingQuantity: quantity,
        buyPrice: price.price,
        buyTotalAmount: totalAmount,
        buyPriceSource: price.source,
        buyPriceTimestamp: price.timestamp,
        openedAt: now,
        active: true
    };

    const transaction: PortfolioTransaction = {
        id: crypto.randomUUID(),
        ticker: asset.ticker,
        name: asset.name,
        currency,
        transactionType: "BUY",
        quantity,
        price: price.price,
        totalAmount,
        executedAt: now,
        note: "Static demo buy"
    };

    writeStorage(LOTS_KEY, [lot, ...getLots()]);
    writeStorage(TRANSACTIONS_KEY, [transaction, ...getTransactions()]);

    return getSimulator();
}

export async function sellLot(lotId: string, quantity: number): Promise<PortfolioSimulator> {
    if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("Количество должно быть больше 0");
    }

    const lots = getLots();
    const lot = lots.find((candidate) => candidate.id === lotId);

    if (!lot) {
        throw new Error("Лот не найден");
    }

    if (quantity > lot.remainingQuantity) {
        throw new Error("Нельзя продать больше, чем осталось в лоте");
    }

    const price = await getMarketPrice(lot.ticker);
    const totalAmount = quantity * price.price;
    const account = getAccount();

    if (lot.currency === "RUB") {
        updateAccount({
            rubBalance: account.rubBalance + totalAmount,
            usdBalance: account.usdBalance
        });
    } else {
        updateAccount({
            rubBalance: account.rubBalance,
            usdBalance: account.usdBalance + totalAmount
        });
    }

    const now = new Date().toISOString();

    const updatedLots = lots.map((candidate) => {
        if (candidate.id !== lot.id) {
            return candidate;
        }

        const nextQuantity = candidate.remainingQuantity - quantity;

        return {
            ...candidate,
            remainingQuantity: nextQuantity,
            active: nextQuantity > 0,
            closedAt: nextQuantity > 0 ? candidate.closedAt : now
        };
    });

    const transaction: PortfolioTransaction = {
        id: crypto.randomUUID(),
        ticker: lot.ticker,
        name: lot.name,
        currency: lot.currency,
        transactionType: "SELL",
        quantity,
        price: price.price,
        totalAmount,
        executedAt: now,
        note: "Static demo sell"
    };

    writeStorage(LOTS_KEY, updatedLots);
    writeStorage(TRANSACTIONS_KEY, [transaction, ...getTransactions()]);

    return getSimulator();
}

export function resetPortfolio(): void {
    writeStorage(ACCOUNT_KEY, DEFAULT_ACCOUNT);
    writeStorage(LOTS_KEY, []);
    writeStorage(TRANSACTIONS_KEY, []);
}

async function toLotView(lot: PortfolioLot): Promise<PortfolioLotView> {
    const price = await getMarketPrice(lot.ticker);
    const investedAmount = lot.remainingQuantity * lot.buyPrice;
    const currentValue = lot.remainingQuantity * price.price;
    const profitLoss = currentValue - investedAmount;

    return {
        ...lot,
        currentPrice: price.price,
        investedAmount,
        currentValue,
        profitLoss,
        profitLossPercent: investedAmount === 0 ? 0 : (profitLoss / investedAmount) * 100,
        holdingDays: calculateHoldingDays(lot.openedAt),
        currentPriceSource: price.source,
        currentPriceTimestamp: price.timestamp
    };
}

function groupLots(lots: PortfolioLotView[]): PortfolioHoldingView[] {
    const grouped = new Map<string, PortfolioLotView[]>();

    lots.forEach((lot) => {
        const current = grouped.get(lot.ticker) ?? [];
        grouped.set(lot.ticker, [...current, lot]);
    });

    return Array.from(grouped.entries())
        .map(([, group]) => {
            const first = group[0];
            const totalQuantity = sum(group.map((lot) => lot.remainingQuantity));
            const investedAmount = sum(group.map((lot) => lot.investedAmount));
            const currentValue = sum(group.map((lot) => lot.currentValue));
            const profitLoss = currentValue - investedAmount;

            return {
                assetId: first.assetId,
                ticker: first.ticker,
                name: first.name,
                assetType: first.assetType,
                exchange: first.exchange,
                currency: first.currency,
                totalQuantity,
                averageBuyPrice: totalQuantity === 0 ? 0 : investedAmount / totalQuantity,
                currentPrice: first.currentPrice,
                investedAmount,
                currentValue,
                profitLoss,
                profitLossPercent: investedAmount === 0 ? 0 : (profitLoss / investedAmount) * 100,
                holdingDays: Math.max(...group.map((lot) => lot.holdingDays)),
                currentPriceSource: first.currentPriceSource,
                currentPriceTimestamp: first.currentPriceTimestamp,
                lots: group.sort((a, b) => b.openedAt.localeCompare(a.openedAt))
            };
        })
        .sort((a, b) => b.currentValue - a.currentValue);
}

function calculateHoldingDays(openedAt: string): number {
    const openedDate = new Date(openedAt);
    const diff = Date.now() - openedDate.getTime();

    return Math.max(0, Math.floor(diff / 86_400_000));
}

function sum(values: number[]): number {
    return values.reduce((total, value) => total + value, 0);
}

function sumByCurrency(
    holdings: PortfolioHoldingView[],
    currency: "RUB" | "USD",
    key: "investedAmount" | "currentValue"
): number {
    return holdings
        .filter((holding) => holding.currency === currency)
        .reduce((total, holding) => total + holding[key], 0);
}

export function seedDemoPortfolio(): void {
    const assets = getAssets();
    const sber = assets.find((asset) => asset.ticker === "SBER");
    const btc = assets.find((asset) => asset.ticker === "BTCUSDT");

    updateAccount({
        rubBalance: 100000,
        usdBalance: 10000
    });

    const now = new Date();

    const demoLots: PortfolioLot[] = [];

    if (sber) {
        demoLots.push({
            id: crypto.randomUUID(),
            assetId: sber.id,
            ticker: sber.ticker,
            name: sber.name,
            assetType: sber.assetType,
            exchange: sber.exchange,
            currency: sber.currency,
            originalQuantity: 20,
            remainingQuantity: 20,
            buyPrice: 280,
            buyTotalAmount: 5600,
            buyPriceSource: "DEMO",
            buyPriceTimestamp: now.toISOString(),
            openedAt: new Date(now.getTime() - 19 * 86_400_000).toISOString(),
            active: true
        });
    }

    if (btc) {
        demoLots.push({
            id: crypto.randomUUID(),
            assetId: btc.id,
            ticker: btc.ticker,
            name: btc.name,
            assetType: btc.assetType,
            exchange: btc.exchange,
            currency: btc.currency,
            originalQuantity: 0.05,
            remainingQuantity: 0.05,
            buyPrice: 65000,
            buyTotalAmount: 3250,
            buyPriceSource: "DEMO",
            buyPriceTimestamp: now.toISOString(),
            openedAt: new Date(now.getTime() - 7 * 86_400_000).toISOString(),
            active: true
        });
    }

    writeStorage(LOTS_KEY, demoLots);
    writeStorage(TRANSACTIONS_KEY, []);
}
