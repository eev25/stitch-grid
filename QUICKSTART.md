# Quickstart

## Install

```sh
npm install
```

## Run the app

```sh
npm run dev
```

## Build

```sh
npm run build     # type-checks (tsc -b) and builds to dist/
npm run preview   # serve the production build
```

## Test

```sh
npm run test       # unit tests (Vitest)
npm run test:watch # unit tests in watch mode
npm run test:e2e   # end-to-end tests (Playwright)
```

First time running e2e tests, install the Playwright browsers:

```sh
npx playwright install chromium
```
