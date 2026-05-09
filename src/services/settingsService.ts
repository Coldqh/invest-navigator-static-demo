import { readStorage, writeStorage } from "./storageService";
import type { AppSettings } from "../types/domain";

const SETTINGS_KEY = "invest.navigator.static.settings";

const DEFAULT_SETTINGS: AppSettings = {
    yandexGptApiKey: "",
    yandexGptFolderId: "",
    yandexGptModel: "gpt://<folder-id>/yandexgpt-lite/latest",
    yandexGptEnabled: false
};

export function getSettings(): AppSettings {
    return readStorage<AppSettings>(SETTINGS_KEY, DEFAULT_SETTINGS);
}

export function updateSettings(settings: AppSettings): AppSettings {
    writeStorage(SETTINGS_KEY, settings);

    return settings;
}
