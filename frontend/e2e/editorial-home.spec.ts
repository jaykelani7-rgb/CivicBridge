import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route(/\/api\/public\/hotspots(?:\?.*)?$/, route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({error:{code:"UNAVAILABLE",message:"Unavailable"}}) }));
});

test("example stays separate from live failures, changes manually, and keeps its height", async ({ page }) => {
  await page.goto("/");
  const journey = page.locator("#example-journey");
  const height = (await journey.boundingBox())!.height;
  for (const name of ["Connect", "Understand", "Review", "Report"]) {
    await journey.getByRole("button", {name, exact:true}).click();
    await expect(journey.getByRole("button", {name, exact:true})).toHaveAttribute("aria-pressed", "true");
    expect((await journey.boundingBox())!.height).toBe(height);
  }
  await expect(page.getByText("Public updates are temporarily unavailable")).toBeVisible();
  await expect(journey.getByText(/Illustrative only/)).toBeVisible();
  await expect(page.locator("#browse [data-hotspot-id]")).toHaveCount(0);
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return [document.fonts.check('400 20px Newsreader'), document.fonts.check('italic 400 20px Newsreader'), document.fonts.check('400 16px "DM Sans"')];
  });
  expect(fonts).toEqual([true,true,true]);
  const foreground = await page.locator('.hero-actions a').first().evaluate(el=>getComputedStyle(el).color);
  expect(foreground).toBe('rgb(250, 247, 238)');
});

test("translated journey content fits on mobile and tablet, and remains keyboard operable", async ({ page }) => {
  for (const width of [390,768,1440]) {
    await page.setViewportSize({width,height:1000});
    for (const locale of ['hi','pt']) {
      await page.goto('/more');
      await page.locator('#more-locale').selectOption(locale);
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('lang',locale === 'hi' ? 'hi' : 'pt-BR');
      for (const button of await page.locator('.journey-controls button').all()) {
        await button.focus();
        await page.keyboard.press('Enter');
        await expect(button).toHaveAttribute('aria-pressed','true');
        const fits = await page.locator('.journey-content').evaluate(el=>el.scrollHeight<=el.clientHeight);
        expect(fits, `${locale} journey content fits at ${width}`).toBe(true);
      }
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
    }
  }
});

test("switching languages in place restores navigation and skip-link labels", async ({ page }) => {
  await page.setViewportSize({width:390, height:844});
  await page.goto('/');
  const expected = {
    hi: ['होम', 'देखें', 'रिपोर्ट', 'स्थिति', 'अधिक'],
    pt: ['Início', 'Explorar', 'Relatar', 'Status', 'Mais'],
    en: ['Home', 'Explore', 'Report', 'Track', 'More'],
  };
  for (const locale of ['hi','pt','en'] as const) {
    await page.locator('header button[aria-controls="mobile-navigation"]').click();
    await page.locator('#mobile-locale').selectOption(locale);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('mobile-bottom-navigation').getByRole('link')).toHaveText(expected[locale]);
  }
  await expect(page.locator('.skip-link')).toHaveText('Skip to main content');
  await expect(page.locator('.hero-actions a').first()).toHaveText('Report an issue');
});
