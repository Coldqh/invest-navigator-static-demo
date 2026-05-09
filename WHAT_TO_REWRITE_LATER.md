# Что переписываем позже

## Глобальный перенос логики

1. YandexGPT
   - отдельный direct client;
   - настройки API key/folder/model;
   - fallback на mock;
   - проверка CORS;
   - безопасное предупреждение пользователю, что ключ хранится в браузере.

2. Market data
   - расширить MOEX provider;
   - расширить Binance candles;
   - добавить cache;
   - добавить визуальное предупреждение DEMO fallback.

3. Portfolio analytics
   - realized PnL;
   - closed lots;
   - import/export JSON;
   - AI-анализ счёта.

4. UI
   - финальная responsive версия;
   - графики;
   - красивые состояния ошибок;
   - мобильная верстка.
