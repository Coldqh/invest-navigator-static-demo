import { YANDEX_GPT_CONFIG } from "../config/yandexGptConfig";
import {
    clearStaticAppStorage,
    exportStaticAppData,
    getStaticStorageSizeBytes
} from "../services/storageService";

export function SettingsPage() {
    function handleExportData() {
        const backup = exportStaticAppData();
        const blob = new Blob([JSON.stringify(backup, null, 2)], {
            type: "application/json"
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = `invest-navigator-static-backup-${Date.now()}.json`;
        link.click();

        URL.revokeObjectURL(url);
    }

    function handleClearData() {
        const confirmed = window.confirm("Очистить все демо-данные в этом браузере?");

        if (!confirmed) {
            return;
        }

        clearStaticAppStorage();
        window.location.reload();
    }

    return (
        <section className="page">
            <div className="page-header">
                <div>
                    <p className="eyebrow">Диагностика</p>
                    <h1>Static demo status</h1>
                </div>
            </div>

            <article className="panel">
                <div className="panel-header">
                    <div>
                        <h2>YandexGPT</h2>
                        <p>AI подключён автоматически через встроенный демо-конфиг.</p>
                    </div>
                </div>

                <div className="summary-grid">
                    <Summary label="Статус" value={YANDEX_GPT_CONFIG.enabled ? "Включён" : "Выключен"} />
                    <Summary label="Folder ID" value={YANDEX_GPT_CONFIG.folderId} />
                    <Summary label="Model" value={YANDEX_GPT_CONFIG.modelUri} />
                    <Summary label="Режим" value="Frontend direct + fallback" />
                </div>
            </article>

            <article className="panel">
                <div className="panel-header">
                    <div>
                        <h2>Локальные данные</h2>
                        <p>Счёт, лоты, сделки и прочие демо-данные хранятся в браузере.</p>
                    </div>
                </div>

                <div className="summary-grid">
                    <Summary
                        label="localStorage"
                        value={`${new Intl.NumberFormat("ru-RU").format(getStaticStorageSizeBytes())} байт`}
                    />
                    <Summary label="База данных" value="Не используется" />
                    <Summary label="Backend" value="Не используется" />
                    <Summary label="GitHub Pages" value="Активно" />
                </div>

                <div className="hero-actions">
                    <button type="button" className="primary-button" onClick={handleExportData}>
                        Экспорт данных
                    </button>

                    <button type="button" className="ghost-button danger-button" onClick={handleClearData}>
                        Очистить данные
                    </button>
                </div>
            </article>
        </section>
    );
}

type SummaryProps = {
    label: string;
    value: string;
};

function Summary({ label, value }: SummaryProps) {
    return (
        <div className="summary-card">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}