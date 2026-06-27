const TICKERS = [
    "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT",
    "SBER", "GAZP", "LKOH", "YDEX", "VTBR", "ROSN", "MGNT", "AFLT"
];

const ICON_MAP: Record<string, string> = {
    BTCUSDT: "/asset-icons-real/BTCUSDT.png",
    ETHUSDT: "/asset-icons-real/ETHUSDT.png",
    BNBUSDT: "/asset-icons-real/BNBUSDT.png",
    SOLUSDT: "/asset-icons-real/SOLUSDT.png",
    XRPUSDT: "/asset-icons-real/XRPUSDT.png",
    DOGEUSDT: "/asset-icons-real/DOGEUSDT.png",
    SBER: "/asset-icons-real/SBER.png",
    GAZP: "/asset-icons-real/GAZP.png",
    LKOH: "/asset-icons-real/LKOH.png",
    YDEX: "/asset-icons-real/YDEX.png",
    VTBR: "/asset-icons-real/VTBR.png",
    ROSN: "/asset-icons-real/ROSN.png",
    MGNT: "/asset-icons-real/MGNT.png",
    AFLT: "/asset-icons-real/AFLT.png"
};

function resolveTicker(element: Element): string | null {
    const href = element instanceof HTMLAnchorElement ? element.href.toUpperCase() : "";
    const text = (element.textContent ?? "").toUpperCase();
    const source = `${href} ${text}`;

    return TICKERS.find((ticker) => source.includes(ticker)) ?? null;
}

function applyIcon(element: Element) {
    if (!(element instanceof HTMLElement)) {
        return;
    }

    const ticker = resolveTicker(element);

    if (!ticker) {
        return;
    }

    const iconUrl = ICON_MAP[ticker];

    if (!iconUrl) {
        return;
    }

    element.classList.add("asset-icon-badge");
    element.dataset.assetIcon = ticker;
    element.style.setProperty("--asset-icon-url", `url("${iconUrl}")`);
}

function applyIcons(root: ParentNode = document) {
    const selectors = [
        "a.asset-thin-row",
        ".compact-holding-main",
        ".asset-details-hero h1",
        ".asset-details-hero-main h1"
    ];

    root.querySelectorAll(selectors.join(",")).forEach(applyIcon);
}

function clearBrokenV21Wrappers() {
    document.querySelectorAll(".inv-asset-with-icon").forEach((wrapper) => {
        const parent = wrapper.parentElement;

        if (!parent) {
            return;
        }

        while (wrapper.firstChild) {
            parent.insertBefore(wrapper.firstChild, wrapper);
        }

        wrapper.remove();
    });

    document.querySelectorAll(".inv-asset-icon").forEach((icon) => icon.remove());
}

export function bootstrapAssetIconBadges() {
    const run = () => {
        clearBrokenV21Wrappers();
        applyIcons(document);
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", run, { once: true });
    } else {
        run();
    }

    const observer = new MutationObserver((mutations) => {
        clearBrokenV21Wrappers();

        for (const mutation of mutations) {
            mutation.addedNodes.forEach((node) => {
                if (node instanceof HTMLElement) {
                    applyIcons(node);
                }
            });
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}
