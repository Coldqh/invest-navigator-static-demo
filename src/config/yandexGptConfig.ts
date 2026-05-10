export const YANDEX_GPT_CONFIG = {
    enabled: true,
    apiKey: import.meta.env.VITE_YANDEX_GPT_API_KEY ?? "",
    folderId: import.meta.env.VITE_YANDEX_GPT_FOLDER_ID ?? "b1g9sq89lelk86ji7gol",
    modelUri:
        import.meta.env.VITE_YANDEX_GPT_MODEL ??
        "gpt://b1g9sq89lelk86ji7gol/yandexgpt-lite/latest",
    completionUrl: "https://llm.api.cloud.yandex.net/foundationModels/v1/completion",
    proxyUrl: import.meta.env.VITE_YANDEX_GPT_PROXY_URL ?? "",
    temperature: 0.25,
    maxTokens: 900
};