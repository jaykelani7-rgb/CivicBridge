import {expect,test} from '@playwright/test';
test('populated real components fit all requested sizes and cannot make API writes',async({page})=>{
  const apiRequests:string[]=[];page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/'))apiRequests.push(request.url());});
  await page.goto('/');await expect(page.getByText(/ISOLATED TEST FIXTURES/)).toBeVisible();
  for(const [width,height] of [[390,844],[768,1024],[1440,1000],[320,844]]){
    await page.setViewportSize({width,height});
    for(const surface of ['public','evidence','policy','impact','states']){
      await page.getByRole('navigation',{name:'Fixture surfaces'}).getByRole('button',{name:surface,exact:true}).click();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${surface} ${width}`).toBe(true);
    }
  }
  await page.getByRole('button',{name:'policy',exact:true}).click();
  await expect(page.getByLabel('Hotspot ID')).toHaveValue('hotspot-1');
  await page.getByRole('button',{name:'Create under-review recommendation'}).click();
  await expect(page.getByText('Fixture only: proposal was not created.')).toBeVisible();
  await page.getByRole('button',{name:'evidence',exact:true}).click();
  for(const tab of ['Citizen Evidence','Score Breakdown','Data Sources','Limitations','Methodology','Overview']){
    await page.getByRole('tab',{name:tab,exact:true}).click();await expect(page.getByRole('tab',{name:tab,exact:true})).toHaveAttribute('aria-selected','true');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),tab).toBe(true);
  }
  await page.getByRole('button',{name:'Text size 200%'}).click();
  for(const surface of ['public','evidence','policy','impact','states']){
    await page.getByRole('button',{name:surface,exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${surface} enlarged`).toBe(true);
    // Check descendants too: overflow-hidden must not make clipped content pass.
    const outside=await page.locator('main').evaluate(el=>[...el.querySelectorAll('h1,h2,h3,p,article,dd,input,textarea')].filter(node=>{const b=node.getBoundingClientRect();return b.width>0&&(b.left<0||b.right>innerWidth+1);}).map(node=>node.textContent?.slice(0,50)));
    expect(outside,`${surface} clipped content`).toEqual([]);
  }
  expect(apiRequests).toEqual([]);
});
test('public detail and translated cards keep long localities visible',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await page.locator('#header-mobile-locale').selectOption('pt');
  await page.locator('[data-hotspot-id="fixture-drainage"]').getByRole('button').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByText(/School entrance and the eastern access lane/)).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
