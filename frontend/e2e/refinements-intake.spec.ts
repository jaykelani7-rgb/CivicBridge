import { expect, test } from '@playwright/test';

test('mobile intake exposes the first input and language control without overlap', async ({page})=>{
  await page.setViewportSize({width:390,height:844}); await page.goto('/volunteer');
  await expect(page.locator('#header-mobile-locale')).toBeVisible();
  const input=(await page.locator('#report').boundingBox())!;
  const actions=(await page.locator('.intake-actions').boundingBox())!;
  const nav=(await page.getByTestId('mobile-bottom-navigation').boundingBox())!;
  expect(input.y+input.height).toBeLessThan(actions.y);
  expect(actions.y+actions.height).toBeLessThanOrEqual(nav.y);
  await page.getByRole('button',{name:'Record',exact:true}).click();
  const record=(await page.getByRole('button',{name:'Record your report'}).boundingBox())!;
  expect(record.y+record.height).toBeLessThan(nav.y);
  await page.locator('#language').selectOption('hi-IN');
  await page.locator('#country').selectOption('BR');
  for (const locale of ['pt','hi','en']) {
    await page.locator('#header-mobile-locale').selectOption(locale);
    await expect(page.locator('#language')).toHaveValue('hi-IN'); await expect(page.locator('#country')).toHaveValue('BR');
  }
  await page.locator('header button[aria-controls="mobile-navigation"]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('header button[aria-controls="mobile-navigation"]')).toBeFocused();
  await page.setViewportSize({width:320,height:844});
  await page.addStyleTag({content:'html {font-size:32px!important}'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.locator('#header-mobile-locale')).toBeVisible();
});

test('text and audio survive mode changes and steps; replacement is explicit', async ({page})=>{
  let writes=0;page.on('request',request=>{if(request.method()==='POST')writes++;});
  await page.goto('/volunteer'); await page.locator('#report').fill('Drain blocked near the school.');
  await page.getByRole('button',{name:'Record',exact:true}).click();
  await page.locator('#voice-evidence').setInputFiles({name:'original.wav',mimeType:'audio/wav',buffer:Buffer.from('fixture audio')});
  const original=await page.locator('audio').getAttribute('src');
  await page.getByRole('button',{name:'Write',exact:true}).click();
  await expect(page.locator('#report')).toHaveValue('Drain blocked near the school.');
  await page.getByRole('button',{name:/Continue to location/}).click();
  await page.locator('#admin-area').fill('School Lane, Ward 42');
  await page.getByRole('button',{name:/Review report/}).click();
  await expect(page.getByText('original.wav')).toBeVisible();
  await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByRole('button',{name:'Back',exact:true}).click();
  await page.getByRole('button',{name:'Record',exact:true}).click();
  await expect(page.locator('audio')).toHaveAttribute('src',original!);
  await page.locator('#voice-evidence').setInputFiles({name:'replacement.wav',mimeType:'audio/wav',buffer:Buffer.from('other fixture audio')});
  await expect(page.locator('audio')).toHaveAttribute('src',original!);
  await page.getByRole('button',{name:'Keep current attachment'}).click();
  await expect(page.locator('audio')).toHaveAttribute('src',original!);
  await page.getByRole('button',{name:'Delete recording'}).click();
  await expect(page.locator('audio')).toHaveCount(0);expect(writes).toBe(0);
});

test('shrinking visual viewport hides navigation and keeps the input above sticky actions',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/volunteer');
  await page.locator('#report').focus();
  // A deterministic keyboard geometry test; native device keyboard QA remains separate.
  await page.evaluate(()=>{
    Object.defineProperty(window.visualViewport,'height',{configurable:true,get:()=>500});
    Object.defineProperty(window.visualViewport,'offsetTop',{configurable:true,get:()=>0});
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect(page.getByTestId('mobile-bottom-navigation')).toBeHidden();
  await expect(page.locator('.citizen-intake')).toHaveAttribute('data-keyboard-open','true');
  await expect.poll(async()=>{
    const field=(await page.locator('#report').boundingBox())!;
    const actions=(await page.locator('.intake-actions').boundingBox())!;
    return field.y+field.height<=actions.y && actions.y+actions.height<=501;
  }).toBe(true);
});
