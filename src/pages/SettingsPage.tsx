import { FormEvent, useEffect, useState } from "react";
import { getSettings, updateSettings } from "../services/settingsService";
import type { AppSettings } from "../types/domain";

export function SettingsPage() {
    const [settings, setSettings] = useState<AppSettings>(getSettings());
    const [message, setMessage] = useState("");

    useEffect(() => {
        setSettings(getSettings());
    }, []);

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        updateSettings(settings);
        setMessage("Настройки сохранены в браузере");
    }

    return (
        <section className="page">
            <div className="page-header">
                <div>
                    <p className="eyebrow">Настройки</p>
                    <h1>Static demo settings</h1>
                </div>
            </div>

            {message && <div className="empty-state">{message}</div>}

            <article className="panel">
                <div className="panel-header">
                    <div>
                        <h2>YandexGPT</h2>
                        <p>Заготовка под прямое браузерное подключение. Полноценный direct client оставлен на следующий этап.</p>
                    </div>
                </div>

                <form className="settings-form" onSubmit={handleSubmit}>
                    <label>
                        <span>Включить YandexGPT experimental</span>
                        <input
                            type="checkbox"
                            checked={settings.yandexGptEnabled}
                            onChange={(event) => setSettings((current) => ({ ...current, yandexGptEnabled: event.target.checked }))}
                        />
                    </label>

                    <label>
                        API key
                        <input
                            value={settings.yandexGptApiKey}
                            type="password"
                            placeholder="Не попадает в GitHub, хранится в localStorage"
                            onChange={(event) => setSettings((current) => ({ ...current, yandexGptApiKey: event.target.value }))}
                        />
                    </label>

                    <label>
                        Folder ID
                        <input
                            value={settings.yandexGptFolderId}
                            placeholder="b1g..."
                            onChange={(event) => setSettings((current) => ({ ...current, yandexGptFolderId: event.target.value }))}
                        />
                    </label>

                    <label>
                        Model
                        <input
                            value={settings.yandexGptModel}
                            placeholder="gpt://folder/yandexgpt-lite/latest"
                            onChange={(event) => setSettings((current) => ({ ...current, yandexGptModel: event.target.value }))}
                        />
                    </label>

                    <button type="submit" className="primary-button">Сохранить</button>
                </form>
            </article>
        </section>
    );
}
