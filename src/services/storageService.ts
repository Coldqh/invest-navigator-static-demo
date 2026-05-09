import type { StaticAppBackup } from "../types/domain";

const STORAGE_PREFIX = "invest.navigator.static.";

export function readStorage<T>(key: string, fallback: T): T {
    if (!isStorageAvailable()) {
        return fallback;
    }

    try {
        const raw = localStorage.getItem(key);

        if (!raw) {
            return fallback;
        }

        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

export function writeStorage<T>(key: string, value: T): void {
    if (!isStorageAvailable()) {
        return;
    }

    localStorage.setItem(key, JSON.stringify(value));
}

export function removeStorage(key: string): void {
    if (!isStorageAvailable()) {
        return;
    }

    localStorage.removeItem(key);
}

export function clearStaticAppStorage(): void {
    if (!isStorageAvailable()) {
        return;
    }

    Object.keys(localStorage)
        .filter((key) => key.startsWith(STORAGE_PREFIX))
        .forEach((key) => localStorage.removeItem(key));
}

export function exportStaticAppData(): StaticAppBackup {
    const values: Record<string, unknown> = {};

    if (isStorageAvailable()) {
        Object.keys(localStorage)
            .filter((key) => key.startsWith(STORAGE_PREFIX))
            .forEach((key) => {
                values[key] = readStorage<unknown>(key, null);
            });
    }

    return {
        version: 1,
        exportedAt: new Date().toISOString(),
        values
    };
}

export function importStaticAppData(backup: StaticAppBackup): void {
    if (!isStorageAvailable()) {
        return;
    }

    if (!backup || backup.version !== 1 || !backup.values) {
        throw new Error("Некорректный файл данных");
    }

    Object.entries(backup.values).forEach(([key, value]) => {
        if (key.startsWith(STORAGE_PREFIX)) {
            writeStorage(key, value);
        }
    });
}

export function getStaticStorageSizeBytes(): number {
    if (!isStorageAvailable()) {
        return 0;
    }

    return Object.keys(localStorage)
        .filter((key) => key.startsWith(STORAGE_PREFIX))
        .reduce((total, key) => {
            const value = localStorage.getItem(key) ?? "";

            return total + key.length + value.length;
        }, 0);
}

function isStorageAvailable(): boolean {
    try {
        return typeof window !== "undefined" && Boolean(window.localStorage);
    } catch {
        return false;
    }
}