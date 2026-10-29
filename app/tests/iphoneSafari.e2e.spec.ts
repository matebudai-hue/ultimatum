import { test, expect, devices, type Page } from '@playwright/test';

const playerReady = async (page: Page) => {
  await expect(page.getByText('Sikeresen csatlakoztál')).toBeVisible({ timeout: 25_000 });
};

const joinPlayer = async (page: Page, code: string, name: string) => {
  await page.goto('/?role=player&code=' + code);
  await page.getByLabel('Neved').fill(name);
  await page.getByRole('button', { name: 'Belépek a játékba' }).tap();
  await playerReady(page);
};

const identifyRoles = async (a: Page, b: Page) => {
  await expect.poll(async () => {
    const aProposer = await a.getByText('Mennyit ajánlasz fel a másik játékosnak?').count();
    const bProposer = await b.getByText('Mennyit ajánlasz fel a másik játékosnak?').count();
    return aProposer + bProposer;
  }, { timeout: 25_000 }).toBe(1);

  const aIsProposer = await a.getByText('Mennyit ajánlasz fel a másik játékosnak?').count() > 0;
  return aIsProposer
    ? { proposer: a, receiver: b }
    : { proposer: b, receiver: a };
};

const sendOffer = async (proposer: Page, amount: string) => {
  proposer.once('dialog', dialog => dialog.accept());
  const input = proposer.getByLabel('A másik játékosnak felajánlott kredit');
  await expect(input).toBeVisible();
  await input.fill(amount);
  await proposer.getByRole('button', { name: 'Ajánlat elküldése' }).tap();
  await expect(proposer.getByText(/Ajánlat elküldve:/)).toBeVisible({ timeout: 25_000 });
};

test('A vezérlés és állapotok görgetéskor is látszanak, a kártyákon elérhető a beavatkozás', async ({ browser }) => {
  for (const viewport of [{width: 390, height: 844}, {width: 1440, height: 900}]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    try {
      await page.goto('/?demo=trainer');
      await expect(page.getByRole('heading', {name: 'Élő páros helyzetkép'})).toBeVisible();
      await expect(page.locator('.attention-center')).not.toHaveAttribute('open', '');
      await expect(page.locator('.pair-tile').first().locator('summary')).toHaveText('Beavatkozás');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect.poll(async () => page.locator('.trainer-sticky').evaluate(el => Math.round(el.getBoundingClientRect().top))).toBe(0);
      const command = page.locator('.compact-primary-action');
      const firstMetric = page.locator('.trainer-pulse .pulse-card').first();
      const lastMetric = page.locator('.trainer-pulse .pulse-card').last();
      for (const item of [command, firstMetric, lastMetric]) {
        const box = await item.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.y + box!.height).toBeLessThan(viewport.height);
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      }
    } finally { await context.close(); }
  }
});

test('A közös kassza állapotsávja a rögzített vezérlés alatt marad', async ({ browser }) => {
  const context = await browser.newContext({ viewport: {width: 1280, height: 800} });
  const page = await context.newPage();
  try {
    await page.goto('/?role=trainer&test=1');
    await page.getByLabel('Játékosok száma').fill('2');
    await page.getByRole('button', {name:'Tesztjáték virtuális résztvevőkkel'}).click();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', {name:/Játék indítása.*2 fővel/}).click();
    for (let round=0;round<6;round++) {
      await page.getByRole('button', {name:'Döntések szimulálása'}).click();
      await page.getByRole('button', {name:'Kör lezárása és könyvelése'}).click();
      await page.getByRole('button', {name: round===5 ? 'Első szakasz lezárása → csapatképzés' : 'Következő kör indítása'}).click();
    }
    await page.getByRole('button', {name:'Első kasszakör indítása'}).click();
    const live = page.locator('.pool-sticky-live');
    await expect(live).toBeVisible();
    const values = await page.evaluate(() => {
      const header = document.querySelector('.trainer-sticky')!;
      const bar = document.querySelector('.pool-sticky-live')!;
      return { headerHeight: header.getBoundingClientRect().height, barTop: parseFloat(getComputedStyle(bar).top), position: getComputedStyle(bar).position };
    });
    expect(values.position).toBe('sticky');
    expect(values.barTop).toBeGreaterThanOrEqual(values.headerHeight);
    for (const viewport of [{width: 1280, height: 800}, {width: 390, height: 844}]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => {
        const bar = document.querySelector('.pool-sticky-live')!;
        window.scrollTo(0, window.scrollY + bar.getBoundingClientRect().top + 200);
      });
      await expect.poll(async () => page.evaluate(() => {
        const header = document.querySelector('.trainer-sticky')!.getBoundingClientRect();
        const bar = document.querySelector('.pool-sticky-live')!.getBoundingClientRect();
        return Math.round(bar.top - header.bottom);
      })).toBeGreaterThanOrEqual(0);
      const box = await live.boundingBox();
      expect(box!.y + box!.height).toBeLessThan(viewport.height);
    }
  } finally { await context.close(); }
});

test('iPhone Safari: hat páros kör és módosított kasszatét átmegy Firebase-en', async ({ browser }) => {
  test.setTimeout(180_000);
  const trainerContext = await browser.newContext({
    ...devices['Desktop Safari'],
    browserName: undefined,
  });
  const iphoneAContext = await browser.newContext({ ...devices['iPhone 13'] });
  const iphoneBContext = await browser.newContext({ ...devices['iPhone 13'] });

  const trainer = await trainerContext.newPage();
  const iphoneA = await iphoneAContext.newPage();
  const iphoneB = await iphoneBContext.newPage();

  try {
    await trainer.goto('/?role=trainer');
    await trainer.getByRole('button', { name: 'Új játék' }).click();

    await expect.poll(() => new URL(trainer.url()).searchParams.get('code'), { timeout: 25_000 })
      .not.toBeNull();
    const code = new URL(trainer.url()).searchParams.get('code');
    expect(code).toBeTruthy();

    await Promise.all([
      joinPlayer(iphoneA, code!, 'iPhone A'),
      joinPlayer(iphoneB, code!, 'iPhone B'),
    ]);

    const start = trainer.getByRole('button', { name: /Játék indítása.*2 fővel/ });
    await expect(start).toBeEnabled({ timeout: 25_000 });
    trainer.once('dialog', dialog => dialog.accept());
    await start.click();

    // 1a: valódi touch eseménnyel ELFOGADÁS.
    let roles = await identifyRoles(iphoneA, iphoneB);
    await sendOffer(roles.proposer, '40000');

    const accept = roles.receiver.getByRole('button', { name: 'Elfogadom' });
    await expect(accept).toBeVisible({ timeout: 25_000 });
    await expect(accept).toBeEnabled();
    await accept.tap();
    await expect(roles.receiver.getByText('Elfogadtad az ajánlatot.')).toBeVisible({ timeout: 25_000 });

    const close1a = trainer.getByRole('button', { name: 'Kör lezárása és könyvelése' });
    await expect(close1a).toBeEnabled({ timeout: 25_000 });
    await close1a.click();

    const next = trainer.getByRole('button', { name: 'Következő kör indítása' });
    await expect(next).toBeEnabled({ timeout: 25_000 });
    await next.click();

    // 1b: ugyanaz az iPhone/Safari útvonal ELUTASÍTÁSSAL.
    roles = await identifyRoles(iphoneA, iphoneB);
    await sendOffer(roles.proposer, '35000');

    const reject = roles.receiver.getByRole('button', { name: 'Elutasítom' });
    await expect(reject).toBeVisible({ timeout: 25_000 });
    await expect(reject).toBeEnabled();
    await reject.tap();
    await expect(roles.receiver.getByText('Elutasítottad az ajánlatot.')).toBeVisible({ timeout: 25_000 });

    const close1b = trainer.getByRole('button', { name: 'Kör lezárása és könyvelése' });
    await expect(close1b).toBeEnabled({ timeout: 25_000 });
    await close1b.click();

    const actorFor = async (label: string) => {
      await expect.poll(async () =>
        await iphoneA.getByLabel(label, {exact:true}).count() + await iphoneB.getByLabel(label, {exact:true}).count(),
      ).toBe(1);
      return await iphoneA.getByLabel(label, {exact:true}).count() ? iphoneA : iphoneB;
    };
    const amountDecision = async (page: Page, label: string, button: string, amount: string) => {
      await page.getByLabel(label, {exact:true}).fill(amount);
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', {name:button,exact:true}).tap();
    };
    for (let round=0;round<4;round++) {
      await trainer.getByRole('button',{name:'Következő kör indítása',exact:true}).click();
      if (round<2) {
        const dictator = await actorFor('A másik játékosnak adott kredit');
        await amountDecision(dictator,'A másik játékosnak adott kredit','Döntés elküldése','20000');
      } else {
        const sender = await actorFor('Mennyit küldesz a másik játékosnak?');
        await amountDecision(sender,'Mennyit küldesz a másik játékosnak?','Küldés','30000');
        const returner = await actorFor('Mennyit adsz vissza?');
        await amountDecision(returner,'Mennyit adsz vissza?','Visszaadás elküldése','45000');
      }
      const close = trainer.getByRole('button',{name:'Kör lezárása és könyvelése',exact:true});
      await expect(close).toBeEnabled();
      await close.click();
    }
    await trainer.getByRole('button',{name:'Első szakasz lezárása → csapatképzés',exact:true}).click();
    await trainer.getByRole('button',{name:'Első kasszakör indítása',exact:true}).click();
    await amountDecision(iphoneA,'Befizetés','Tét mentése','10000');
    await expect(iphoneA.getByText(/Beérkezett:/)).toBeVisible();
    await iphoneA.reload();
    await expect(iphoneA.getByText(/Beérkezett:/)).toBeVisible();
    await iphoneA.getByRole('button',{name:'Módosítom',exact:true}).tap();
    await amountDecision(iphoneA,'Befizetés','Tét módosítása','15000');
    await expect(iphoneA.getByText(/Beérkezett:.*15\s*000/)).toBeVisible();
    await amountDecision(iphoneB,'Befizetés','Tét mentése','20000');
    await expect(iphoneB.getByText(/Beérkezett:.*20\s*000/)).toBeVisible();
    await expect(trainer.locator('.trainer-pulse .pulse-card').first().getByText('2/2',{exact:true})).toBeVisible();
    await trainer.getByRole('button',{name:'Tétek lezárása',exact:true}).click();
    await expect(iphoneA.getByText(/Tét lezárva:.*15\s*000/)).toBeVisible();
    await trainer.getByRole('button',{name:'Bank elszámol',exact:true}).click();
    await expect(iphoneA.getByText(/Visszakaptál:.*35\s*000/)).toBeVisible();
    await expect(iphoneB.getByText(/Visszakaptál:.*35\s*000/)).toBeVisible();

    console.log('IPHONE SAFARI SIX ROUNDS + POOL EDIT + RELOAD + EXACT PAYOUT OK · game=' + code);
  } finally {
    await Promise.all([
      trainerContext.close(),
      iphoneAContext.close(),
      iphoneBContext.close(),
    ]);
  }
});

