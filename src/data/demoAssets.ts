import type { Asset } from "../types/domain";

export const DEMO_ASSETS: Asset[] = [
    {
        id: "sber",
        ticker: "SBER",
        name: "Сбербанк",
        assetType: "STOCK",
        exchange: "MOEX",
        currency: "RUB",
        isin: "RU0009029540",
        active: true
    },
    {
        id: "gazp",
        ticker: "GAZP",
        name: "Газпром",
        assetType: "STOCK",
        exchange: "MOEX",
        currency: "RUB",
        isin: "RU0007661625",
        active: true
    },
    {
        id: "lkoh",
        ticker: "LKOH",
        name: "Лукойл",
        assetType: "STOCK",
        exchange: "MOEX",
        currency: "RUB",
        isin: "RU0009024277",
        active: true
    },
    {
        id: "ydex",
        ticker: "YDEX",
        name: "Яндекс",
        assetType: "STOCK",
        exchange: "MOEX",
        currency: "RUB",
        active: true
    },
    {
        id: "btc",
        ticker: "BTCUSDT",
        name: "Bitcoin / Tether",
        assetType: "CRYPTO",
        exchange: "BINANCE",
        currency: "USD",
        active: true
    },
    {
        id: "eth",
        ticker: "ETHUSDT",
        name: "Ethereum / Tether",
        assetType: "CRYPTO",
        exchange: "BINANCE",
        currency: "USD",
        active: true
    },
    {
        id: "sol",
        ticker: "SOLUSDT",
        name: "Solana / Tether",
        assetType: "CRYPTO",
        exchange: "BINANCE",
        currency: "USD",
        active: true
    }
];

export const DEMO_PRICES: Record<string, number> = {
    SBER: 312.45,
    GAZP: 154.2,
    LKOH: 7345,
    YDEX: 4280,
    BTCUSDT: 68450,
    ETHUSDT: 3550,
    SOLUSDT: 168
};
