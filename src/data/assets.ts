import type { Asset } from "../types/domain";

export const ASSETS: Asset[] = [
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
        id: "vtbr",
        ticker: "VTBR",
        name: "ВТБ",
        assetType: "STOCK",
        exchange: "MOEX",
        currency: "RUB",
        isin: "RU000A0JP5V6",
        active: true
    },
    {
        id: "rosn",
        ticker: "ROSN",
        name: "Роснефть",
        assetType: "STOCK",
        exchange: "MOEX",
        currency: "RUB",
        isin: "RU000A0J2Q06",
        active: true
    },
    {
        id: "mgnt",
        ticker: "MGNT",
        name: "Магнит",
        assetType: "STOCK",
        exchange: "MOEX",
        currency: "RUB",
        isin: "RU000A0JKQU8",
        active: true
    },
    {
        id: "aflt",
        ticker: "AFLT",
        name: "Аэрофлот",
        assetType: "STOCK",
        exchange: "MOEX",
        currency: "RUB",
        isin: "RU0009062285",
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
        id: "bnb",
        ticker: "BNBUSDT",
        name: "BNB / Tether",
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
    },
    {
        id: "xrp",
        ticker: "XRPUSDT",
        name: "XRP / Tether",
        assetType: "CRYPTO",
        exchange: "BINANCE",
        currency: "USD",
        active: true
    },
    {
        id: "doge",
        ticker: "DOGEUSDT",
        name: "Dogecoin / Tether",
        assetType: "CRYPTO",
        exchange: "BINANCE",
        currency: "USD",
        active: true
    }
];