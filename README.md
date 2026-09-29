# Cargo 7 Admin

Самостоятельная React-админ-панель для GitHub Pages: вход администратора, создание и управление посылками, доплаты и отзывы. Firebase Web App config уже подключён к проекту.

Для просмотра без Firebase используйте демо-вход `ADMINCRG` / `CRGADM321`. В демо-режиме записи сохраняются только в localStorage текущего браузера; это не защита данных, пароль находится в публичном клиентском коде. Для реальной общей базы настройте Firebase по шагам ниже.

## Запуск

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Firebase-администраторы: `smixnevertime@gmail.com` и `mmabou287@gmail.com`. Первый входит по нику `ADMINCRG`, второй — по своему email. Пароли каждый использует от своего Firebase Authentication аккаунта. При первой попытке входа неподтверждённого пользователя панель отправит verification email; подтвердите email и войдите ещё раз. Правила доступа в обоих приложениях уже привязаны к обоим адресам.

Скопируйте правила из `database.rules.json` в Realtime Database → Rules и опубликуйте их. `shipments/{code}` и `reviews/{id}` читаются и редактируются только подтверждённым администратором; клиент читает только `publicTracking/{code}` и `publicReviews/{id}`. Не разрешайте запись всем пользователям.

## GitHub Pages

Поместите содержимое этой папки в отдельный GitHub-репозиторий. В Settings → Pages выберите **GitHub Actions**. Список администраторов уже включён в приложение; Actions secrets не нужны. Push в `main` запустит сборку и публикацию. Не задавайте пароль в коде или GitHub secrets; он хранится только в Firebase Authentication.

Сроки авиа (5–12 дней) и автобуса (10–18 дней) выбираются при создании заказа. Этап шкалы вычисляется по времени в браузере; пауза, остановка, ручной статус и доплата синхронизируются через Realtime Database.# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
