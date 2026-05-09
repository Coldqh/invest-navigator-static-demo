# Invest Navigator Static Demo

Лёгкая GitHub Pages версия проекта без backend и PostgreSQL.

## Что уже готово

- React + TypeScript + Vite.
- GitHub Pages deploy workflow.
- `HashRouter`, чтобы страницы работали на GitHub Pages без backend.
- Локальное хранение в `localStorage`.
- Симулятор портфеля:
  - счёт RUB/USD;
  - покупка по текущей цене;
  - продажа лотов;
  - группировка лотов по активам;
  - журнал операций;
  - PnL и срок удержания.
- Market data layer:
  - Binance public API для crypto;
  - MOEX ISS попытка прямого запроса;
  - fallback demo data, если браузер/CORS/сеть не дали получить реальные данные.
- UI-заготовки:
  - Dashboard;
  - Assets;
  - Asset Details;
  - Compare;
  - Portfolio;
  - Settings.

## Что оставлено на потом

Глобально переписывать позже:

- полноценный YandexGPT direct client;
- проверка CORS YandexGPT из браузера;
- расширенные графики свечей;
- сохранение между устройствами;
- импорт старой базы;
- более глубокая AI-аналитика;
- финальная адаптивность.

## Запуск локально

```powershell
cd C:\InvestNavigator\invest-navigator-static-demo; npm install; npm run dev
```

## Сборка

```powershell
cd C:\InvestNavigator\invest-navigator-static-demo; npm run build
```

## Новый репозиторий GitHub

1. Создай новый repo, например `invest-navigator-static-demo`.
2. Распакуй zip в папку.
3. Выполни:

```powershell
cd C:\InvestNavigator\invest-navigator-static-demo; git init; git add .; git commit -m "Initial static demo"; git branch -M main; git remote add origin https://github.com/Coldqh/invest-navigator-static-demo.git; git push -u origin main
```

4. В GitHub repo:
   - Settings → Pages.
   - Source: GitHub Actions.
5. После workflow появится ссылка вида:

```text
https://coldqh.github.io/invest-navigator-static-demo/
```

## Важное ограничение

Данные хранятся в браузере пользователя.  
ПК и телефон будут иметь разные портфели, потому что нет общей серверной базы.
