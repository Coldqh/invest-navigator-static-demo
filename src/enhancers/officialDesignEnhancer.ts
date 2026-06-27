
const KNOWN_TICKERS = [
    "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT",
    "SBER", "GAZP", "LKOH", "YDEX", "VTBR", "ROSN", "MGNT", "AFLT"
] as const;

const ICON_MAP: Record<string, string> = {
    BTCUSDT: "/asset-icons/BTCUSDT.png",
    ETHUSDT: "/asset-icons/ETHUSDT.png",
    BNBUSDT: "/asset-icons/BNBUSDT.png",
    SOLUSDT: "/asset-icons/SOLUSDT.png",
    XRPUSDT: "/asset-icons/XRPUSDT.png",
    DOGEUSDT: "/asset-icons/DOGEUSDT.png",
    DOGE: "/asset-icons/DOGE.png",
    SBER: "/asset-icons/SBER.png",
    GAZP: "/asset-icons/GAZP.png",
    LKOH: "/asset-icons/LKOH.png",
    YDEX: "/asset-icons/YDEX.png",
    VTBR: "/asset-icons/VTBR.png",
    ROSN: "/asset-icons/ROSN.png",
    MGNT: "/asset-icons/MGNT.png",
    AFLT: "/asset-icons/AFLT.png"
};

const CANDIDATE_SELECTORS = [
    "a[href^='/assets/']",
    ".asset-thin-row",
    ".compact-holding-main",
    ".compare-page h2",
    ".compare-page h3",
    ".compare-vs-select",
    "h1",
    ".asset-details-hero h1",
    ".asset-details-title"
];

function extractTicker(text: string): string | null {
    const clean = text.toUpperCase();
    for (const ticker of KNOWN_TICKERS) {
        if (clean.includes(ticker)) return ticker;
    }
    const m = clean.match(/\b(SBER|GAZP|LKOH|YDEX|VTBR|ROSN|MGNT|AFLT|BTCUSDT|ETHUSDT|BNBUSDT|SOLUSDT|XRPUSDT|DOGEUSDT|DOGE)\b/);
    return m ? m[1] : null;
}

function alreadyHasIcon(el: Element): boolean {
    return Boolean(el.querySelector(":scope > .inv-asset-icon, :scope > .inv-asset-with-icon"));
}

function iconizeElement(el: Element) {
    if (!(el instanceof HTMLElement)) return;
    if (alreadyHasIcon(el)) return;
    const text = el.innerText?.trim();
    if (!text) return;
    const ticker = extractTicker(text);
    if (!ticker) return;
    const src = ICON_MAP[ticker];
    if (!src) return;

    // Try only on top-level / prominent nodes, avoid duplicates on nested tiny spans.
    if (el.closest('.inv-asset-with-icon')) return;

    const img = document.createElement('img');
    img.src = src;
    img.alt = ticker;
    img.className = 'inv-asset-icon';
    img.decoding = 'async';
    img.loading = 'lazy';

    const wrap = document.createElement('span');
    wrap.className = 'inv-asset-with-icon';

    while (el.firstChild) {
        wrap.appendChild(el.firstChild);
    }

    el.appendChild(img);
    el.appendChild(wrap);
    el.classList.add('inv-asset-title-host');

    // For headings, icon before text.
    el.insertBefore(img, wrap);
}

function applyIcons(root: ParentNode = document) {
    for (const selector of CANDIDATE_SELECTORS) {
        root.querySelectorAll(selector).forEach(iconizeElement);
    }
}

function fixLogoTitle() {
    document.querySelectorAll('.brand > span, .app-brand > span, .header-brand > span').forEach((el) => {
        if (el instanceof HTMLElement) {
            el.textContent = '';
        }
    });
}

export function bootstrapOfficialDesignEnhancer() {
    const run = () => {
        applyIcons(document);
        fixLogoTitle();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
        run();
    }

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            mutation.addedNodes.forEach((node) => {
                if (node instanceof HTMLElement) {
                    applyIcons(node);
                }
            });
        }
        fixLogoTitle();
    });

    observer.observe(document.body, { childList: true, subtree: true });
}
