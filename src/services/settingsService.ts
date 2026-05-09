import { YANDEX_GPT_CONFIG } from "../config/yandexGptConfig";
import type { AppSettings } from "../types/domain";

export function getSettings(): AppSettings {
    return {
        yandexGptApiKey: YANDEX_GPT_CONFIG.apiKey,
        yandexGptFolderId: YANDEX_GPT_CONFIG.folderId,
        yandexGptModel: YANDEX_GPT_CONFIG.modelUri,
        yandexGptEnabled: YANDEX_GPT_CONFIG.enabled
    };
}

export function updateSettings(settings: AppSettings): AppSettings {
    return settings;
}