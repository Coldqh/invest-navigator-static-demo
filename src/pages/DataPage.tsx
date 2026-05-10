import { ChangeEvent, useMemo, useState } from "react";
import {
    clearStaticAppStorage,
    exportStaticAppData,
    getStaticStorageSizeBytes,
    importStaticAppData
} from "../services/storageService";
import type { StaticAppBackup } from "../types/domain";

export function DataPage() {
    const [backup, setBackup] = useState<StaticAppBackup>(() => exportStaticAppData());
    const [storageSizeBytes, setStorageSizeBytes] = useState(() => getStaticStorageSizeBytes());
    const [importText, setImportText] = useState("");
    const [status, setStatus] = useState("");
    const [error, setError] = useState("");

    const formattedBackup = useMemo(() => {
        return JSON.stringify(backup, null, 2);
    }, [backup]);

    const storageKeys = useMemo(() => {
        return Object.keys(backup.values).sort();
    }, [backup.values]);

    const backupSizeBytes = useMemo(() => {
        return new Blob([formattedBackup]).size;
    }, [formattedBackup]);

    function refresh() {
        setBackup(exportStaticAppData());
        setStorageSizeBytes(getStaticStorageSizeBytes());
    }

    function handleExportFile() {
        try {
            setError("");
            const currentBackup = exportStaticAppData();
            const content = JSON.stringify(currentBackup, null, 2);
            const blob = new Blob([content], {
                type: "application/json;charset=utf-8"
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = url;
            link.download = `invest-navigator-backup-${formatFileDate(new Date())}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            URL.revokeObjectURL(url);

            setStatus("Файл экспорта создан");
            refresh();
        } catch {
            setError("Не удалось экспортировать данные");
        }
    }

    async function handleCopyBackup() {
        try {
            setError("");
            await navigator.clipboard.writeText(formattedBackup);
            setStatus("JSON скопирован в буфер");
        } catch {
            setError("Не удалось скопировать JSON");
        }
    }

    function handleImportFromText() {
        try {
            setError("");
            const parsed = JSON.parse(importText) as StaticAppBackup;

            importStaticAppData(parsed);
            refresh();

            setImportText("");
            setStatus("Данные импортированы");
        } catch (error: unknown) {
            setError(error instanceof Error ? error.message : "Не удалось импортировать JSON");
        }
    }

    function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        const reader = new FileReader();

        reader.onload = () => {
            const text = String(reader.result ?? "");
            setImportText(text);
            setStatus(`Файл загружен: ${file.name}`);
            setError("");
        };

        reader.onerror = () => {
            setError("Не удалось прочитать файл");
        };

        reader.readAsText(file);
        event.target.value = "";
    }

    function handleClearStorage() {
        const confirmed = window.confirm("Удалить все данные приложения из браузера?");

        if (!confirmed) {
            return;
        }

        clearStaticAppStorage();
        refresh();
        setImportText("");
        setStatus("Данные очищены");
        setError("");
    }

    return (
        <section className="page data-page">
            <div className="page-header">
                <div>
                    <p className="eyebrow">Данные</p>
                    <h1>Export / Import</h1>
                </div>
            </div>

            {status && <div className="data-status-block">{status}</div>}
            {error && <div className="error-block">{error}</div>}

            <div className="data-summary-grid">
                <DataStat label="Версия backup" value={String(backup.version)} />
                <DataStat label="Ключей" value={String(storageKeys.length)} />
                <DataStat label="LocalStorage" value={formatBytes(storageSizeBytes)} />
                <DataStat label="Размер backup" value={formatBytes(backupSizeBytes)} />
            </div>

            <div className="data-grid">
                <article className="panel data-actions-panel">
                    <div className="panel-header">
                        <div>
                            <h2>Экспорт</h2>
                        </div>
                    </div>

                    <div className="data-action-list">
                        <button type="button" className="primary-button" onClick={handleExportFile}>
                            Скачать JSON
                        </button>

                        <button type="button" className="ghost-button" onClick={handleCopyBackup}>
                            Скопировать JSON
                        </button>

                        <button type="button" className="ghost-button" onClick={refresh}>
                            Обновить сводку
                        </button>
                    </div>

                    <div className="data-preview-box">
                        <span>Активные ключи</span>

                        {storageKeys.length === 0 ? (
                            <strong>Данных пока нет</strong>
                        ) : (
                            <div className="data-key-list">
                                {storageKeys.map((key) => (
                                    <code key={key}>{key}</code>
                                ))}
                            </div>
                        )}
                    </div>
                </article>

                <article className="panel data-actions-panel">
                    <div className="panel-header">
                        <div>
                            <h2>Импорт</h2>
                        </div>
                    </div>

                    <label className="data-file-picker">
                        <span>Файл backup</span>
                        <input
                            type="file"
                            accept="application/json,.json"
                            onChange={handleFileChange}
                        />
                    </label>

                    <label className="data-textarea-label">
                        <span>JSON</span>
                        <textarea
                            value={importText}
                            placeholder="Вставь backup JSON сюда..."
                            onChange={(event) => setImportText(event.target.value)}
                        />
                    </label>

                    <div className="data-action-list">
                        <button
                            type="button"
                            className="primary-button"
                            disabled={!importText.trim()}
                            onClick={handleImportFromText}
                        >
                            Импортировать
                        </button>

                        <button
                            type="button"
                            className="ghost-button"
                            disabled={!importText.trim()}
                            onClick={() => setImportText("")}
                        >
                            Очистить поле
                        </button>

                        <button type="button" className="ghost-button danger-button" onClick={handleClearStorage}>
                            Стереть данные
                        </button>
                    </div>
                </article>
            </div>

            <article className="panel data-raw-panel">
                <div className="panel-header">
                    <div>
                        <h2>Текущий backup</h2>
                    </div>
                </div>

                <pre>{formattedBackup}</pre>
            </article>
        </section>
    );
}

type DataStatProps = {
    label: string;
    value: string;
};

function DataStat({ label, value }: DataStatProps) {
    return (
        <div className="data-stat-card">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

function formatBytes(value: number): string {
    if (value < 1024) {
        return `${value} B`;
    }

    if (value < 1024 * 1024) {
        return `${(value / 1024).toFixed(2)} KB`;
    }

    return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function formatFileDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    return `${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
}