import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

const authenticatedRoutes = [
  "/dashboard",
  "/daily",
  "/planner",
  "/goals",
  "/growth",
  "/analytics",
  "/finance",
  "/health",
  "/car",
  "/work",
  "/experiments",
  "/timeline",
  "/tasks",
  "/settings"
];

test.describe("product smoke", () => {
  test.beforeEach(async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => {
      consoleErrors.push(error.message);
    });
    await page.exposeFunction("__getConsoleErrors", () => consoleErrors);
  });

  test("login page opens without client errors", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("body")).toContainText(/Вход|Почта|Email/i);
    await expectNoConsoleErrors(page);
  });

  test("authenticated core routes open on desktop and mobile", async ({ page }) => {
    test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run authenticated smoke tests.");

    await signIn(page);

    for (const route of authenticatedRoutes) {
      await page.goto(route);
      await expect(page.locator("body")).not.toContainText(/Runtime Error|Unhandled Runtime Error|Application error/i);
      await expect(page.locator("body")).not.toContainText(/NaN|Infinity|undefined|null/i);
      await expectNoConsoleErrors(page);
    }
  });

  test("mobile daily flow is reachable", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Mobile viewport smoke runs only in the mobile project.");
    test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run authenticated smoke tests.");

    await signIn(page);
    await page.goto("/daily");
    await expect(page.locator("body")).toContainText(/День|Быстрый ввод|Создать план|Добавить задачу/i);
    await expectNoConsoleErrors(page);
  });

  test("goal to daily to dashboard lifecycle smoke", async ({ page }) => {
    test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run authenticated lifecycle tests.");

    await signIn(page);
    await page.goto("/goals");
    await expect(page.locator("body")).toContainText(/Цели|Зачем|Версия себя/i);

    await page.goto("/planner");
    await expect(page.locator("body")).toContainText(/План|Месяц|Задачи/i);

    await page.goto("/daily");
    await expect(page.locator("body")).toContainText(/День|Итог дня|Сегодняшний вклад|Создать план/i);

    await page.goto("/dashboard");
    await expect(page.locator("body")).toContainText(/Дашборд|Следующий шаг|Индекс развития|Главный фокус/i);
    await expectNoConsoleErrors(page);
  });
});

async function signIn(page: Page) {
  await page.goto("/login");

  const emailInput = page.getByLabel(/email|почта/i).or(page.locator('input[type="email"]')).first();
  const passwordInput = page.getByLabel(/пароль|password/i).or(page.locator('input[type="password"]')).first();

  await emailInput.fill(email ?? "");
  await passwordInput.fill(password ?? "");
  await page.getByRole("button", { name: /войти|login/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
}

async function expectNoConsoleErrors(page: Page) {
  const errors = await page.evaluate(async () => {
    const getter = (globalThis as unknown as { __getConsoleErrors?: () => Promise<string[]> }).__getConsoleErrors;
    return getter ? getter() : [];
  });
  expect(errors.filter((error) => !error.includes("favicon"))).toEqual([]);
}
