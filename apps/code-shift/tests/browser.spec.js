import { test, expect } from '@playwright/test';
// Pilot MVP flow: instructor runs monitor + events, students read the chart and give medications by scanning.
// Headless Chrome has no camera, so the session is created with manual entry allowed; scan-required gating is checked separately.
test('instructor and students run the pilot flow', async ({ browser }) => {
  const contexts = await Promise.all(Array.from({length:4},()=>browser.newContext({viewport:{width:1400,height:1000}})));
  const pages = await Promise.all(contexts.map(c=>c.newPage()));
  const [instructor,...students]=pages;
  const errors=[]; for(const p of pages)p.on('pageerror',e=>errors.push(e.message));
  const nav=(page,name)=>page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name,exact:true}).first();
  try {
    // Instructor creates the session
    await instructor.goto('/'); await instructor.getByLabel('Instructor key').fill('browser-test-key'); await instructor.getByRole('button',{name:'Open instructor workspace'}).click();
    await instructor.getByLabel(/Require students to scan/).uncheck(); await instructor.getByRole('button',{name:'Create session',exact:true}).click();
    await expect(instructor.getByRole('heading',{name:'Patient monitor',exact:true})).toBeVisible();
    // Students join and see the chart
    for(let i=0;i<3;i++) {
      await students[i].goto('/'); await students[i].getByRole('button',{name:'Student',exact:true}).click(); await students[i].getByLabel('Your roster name').selectOption({label:`Student 0${i+1}`}); await students[i].getByRole('button',{name:'Join session'}).click();
      await expect(students[i].getByRole('heading',{name:'My worklist',exact:true})).toBeVisible(); await nav(students[i],'Chart').click(); await expect(students[i].getByRole('heading',{name:'Patient chart',exact:true})).toBeVisible(); await expect(students[i].getByText('Carl Shapiro').first()).toBeVisible();
      await expect(nav(students[i],'Monitor and events')).toHaveCount(0); await expect(students[i].getByRole('button',{name:/Facilitator pack/})).toHaveCount(0);
      await students[i].getByRole('button',{name:'Lab results',exact:true}).click(); await expect(students[i].getByText('Troponin',{exact:true})).toBeVisible();
      expect(JSON.stringify(await (await students[i].request.get('/api/state')).json())).not.toContain('MED-ASA325');
      expect((await students[i].request.post('/api/status',{data:{status:'ended',role:'instructor'}})).status()).toBe(403);
    }
    // Instructor sets the monitor; the chart banner on the phones follows
    await instructor.getByRole('button',{name:'Chest pain episode'}).click(); await expect(instructor.getByLabel('HR',{exact:true})).toHaveValue('112'); await instructor.getByRole('button',{name:'Apply to monitor'}).click(); await expect(instructor.getByText('Monitor updated.')).toBeVisible(); await expect(instructor.getByTestId('vital-hr')).toHaveText('112');
    await expect(students[2].getByText(/HR 112 .* BP 168[/]96/).first()).toBeVisible({timeout:15000});
    // Instructor releases a scenario event; students see it under Updates
    await instructor.getByRole('button',{name:'Release',exact:true}).first().click(); await instructor.getByRole('button',{name:'Release now'}).click(); await expect(instructor.getByText(/released \d/)).toBeVisible();
    await expect(students[2].getByRole('region',{name:'Updates'})).toContainText('12-lead ECG resulted',{timeout:15000});
    // Student gives Aspirin: wrong label is stopped at scan time, right label documents
    await nav(students[2],'MAR').click();
    const giveManual=async (medCode)=>{ await students[2].getByRole('article',{name:/Aspirin/}).getByRole('button',{name:'Give'}).click(); await students[2].getByRole('button',{name:/Enter the code manually/}).click(); await students[2].getByLabel('Wristband code (manual)').fill('CS-12049023'); await students[2].getByRole('button',{name:'Next',exact:true}).click(); await students[2].getByLabel('Medication label code (manual)').fill(medCode); await students[2].getByRole('button',{name:'Next',exact:true}).click(); if (medCode==='MED-ASA325') { await students[2].getByLabel('Reason for manual entry').fill('headless test, no camera'); await students[2].getByRole('button',{name:'Document given'}).click(); } };
    await giveManual('MED-METO25'); await expect(students[2].getByText('Stop.')).toBeVisible(); await expect(students[2].getByText(/WRONG MEDICATION/)).toBeVisible(); await students[2].getByRole('button',{name:'Close',exact:true}).first().click();
    await giveManual('MED-ASA325'); await expect(students[2].getByText('Documented',{exact:true})).toBeVisible(); await expect(students[2].getByText(/MANUAL ENTRY \(headless test, no camera\)/)).toBeVisible(); await students[2].getByRole('button',{name:'Done'}).click();
    await expect(students[2].getByRole('article',{name:/Aspirin/}).getByText(/^Given/).first()).toBeVisible(); await expect(students[2].getByRole('article',{name:/Aspirin/}).getByText(/1 scan alert/)).toBeVisible(); await expect(students[2].getByRole('article',{name:/Aspirin/}).getByText(/Already given/)).toBeVisible(); await expect(students[2].getByRole('article',{name:/Aspirin/}).getByText(/1 manual/)).toBeVisible();
    // Instructor requires scanning: manual entry disappears for students
    await nav(instructor,'eMAR').click(); await instructor.getByRole('button',{name:'Require scanning'}).click(); await expect(instructor.getByRole('button',{name:/Scanning required/})).toBeVisible({timeout:15000});
    await expect(students[2].getByText(/Scanning is required in this session/)).toBeVisible({timeout:15000}); await students[2].getByRole('article',{name:/Metoprolol/}).getByRole('button',{name:'Give'}).click(); await expect(students[2].getByRole('button',{name:/Enter the code manually/})).toHaveCount(0); await students[2].getByRole('button',{name:'Close',exact:true}).first().click();
    // Instructor registers a physical barcode
    await instructor.getByLabel('Physical barcode').fill('0312345678901'); await expect(instructor.getByText('Unknown code: ready to register.')).toBeVisible(); await instructor.getByLabel('Assign to').selectOption({label:'Nitroglycerin 0.4 mg'}); await instructor.getByRole('button',{name:'Register',exact:true}).click(); await expect(instructor.getByText('Registered.')).toBeVisible(); await expect(instructor.getByRole('cell',{name:'0312345678901'})).toBeVisible();
    // Provider call by choices: student picks situation + recommendation, instructor taps a reply
    await nav(students[0],'Provider').click(); await students[0].getByRole('button',{name:/^Chest pain unrelieved/}).click(); await students[0].getByRole('button',{name:/Request new orders/}).click(); await expect(students[0].getByText(/Waiting for the provider/)).toBeVisible();
    await nav(instructor,'Provider').click(); await instructor.getByRole('button',{name:/Give morphine 2 mg/}).click(); await expect(instructor.getByText(/^Provider: Give morphine/)).toBeVisible(); await expect(students[0].getByText(/^Provider: Give morphine/)).toBeVisible({timeout:15000});
    await nav(students[0],'Orders').click(); await expect(students[0].getByText(/2 new orders to acknowledge/)).toBeVisible({timeout:15000}); await students[0].getByRole('button',{name:'Acknowledge'}).first().click(); await expect(students[0].getByText(/1 new order to acknowledge/)).toBeVisible(); await nav(students[0],'MAR').click(); await expect(students[0].getByRole('article',{name:/Morphine/})).toBeVisible({timeout:15000}); await expect(students[0].getByText('Identify the patient')).toBeVisible();
    // Worklist: student taps a task done, instructor confirms
    await nav(students[1],'Worklist').click(); await expect(students[1].getByText(/Apply cardiac monitor/)).toBeVisible(); await students[1].getByRole('article').filter({hasText:'Apply cardiac monitor'}).getByRole('button',{name:'Done'}).click(); await expect(students[1].getByText(/awaiting instructor review/).first()).toBeVisible({timeout:15000}).catch(async()=>{ await students[1].getByRole('button',{name:'Show'}).click(); await expect(students[1].getByText(/awaiting instructor review/).first()).toBeVisible(); });
    await nav(instructor,'Worklist').click(); await instructor.getByRole('article').filter({hasText:'Apply cardiac monitor'}).getByRole('button',{name:'Confirm'}).click(); await expect(instructor.getByText(/confirmed by Instructor/)).toBeVisible();
    // Evidence, debrief, labels, room display
    await nav(instructor,'Evidence timeline').click(); await expect(instructor.getByText('Medication given',{exact:true}).first()).toBeVisible(); await expect(instructor.getByText('Scan alert',{exact:true}).first()).toBeVisible();
    for(const student of students){ const state=await student.request.get('/api/state'); expect(JSON.stringify(await state.json())).not.toContain('Patient voice'); }
    const labels=await contexts[0].newPage(); await labels.goto('/labels'); await expect(labels.getByRole('heading',{name:'Printable labels'})).toBeVisible(); expect(await labels.locator('svg.barcode rect').count()).toBeGreaterThan(50); expect(Number((await labels.locator('svg.barcode').first().locator('g').first().getAttribute('transform')).match(/translate\((\d+)/)[1])).toBeGreaterThanOrEqual(20); await labels.close();
    const debrief=await contexts[0].newPage(); await debrief.goto('/debrief'); await expect(debrief.getByRole('heading',{name:'Debrief report'})).toBeVisible(); await expect(debrief.getByRole('heading',{name:'Safety catches'})).toBeVisible(); await debrief.close();
    const display=await browser.newPage(); await display.goto('/display'); await expect(display.getByTestId('vital-hr')).toHaveText(/\d+/); await display.close();
    // Pause/resume, phone layout, offline recovery
    await nav(instructor,'Patient chart').click(); await instructor.getByRole('button',{name:'Pause session',exact:true}).click();
    await expect(students[1].getByRole('article',{name:/Aspirin/}).getByRole('button',{name:'Give'})).toBeDisabled({timeout:15000}).catch(async()=>{ await nav(students[1],'MAR').click(); await expect(students[1].getByRole('article',{name:/Aspirin/}).getByRole('button',{name:'Give'})).toBeDisabled({timeout:15000}); });
    await instructor.getByRole('button',{name:'Resume session',exact:true}).click(); await expect(students[1].getByRole('article',{name:/Aspirin/}).getByRole('button',{name:'Give'})).toBeEnabled({timeout:15000});
    await students[1].setViewportSize({width:390,height:844}); await nav(students[1],'Chart').click(); await expect(students[1].getByRole('heading',{name:'Patient chart',exact:true})).toBeVisible();
    expect(await students[1].evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await contexts[1].setOffline(true); await expect(students[0].getByText('Reconnecting').first()).toBeVisible({timeout:20000}); await contexts[1].setOffline(false); await expect(students[0].getByText('Connected').first()).toBeVisible({timeout:20000});
    const external=[]; await students[2].route('**/*',route=>{ if(new URL(route.request().url()).hostname!=='127.0.0.1'){external.push(route.request().url());return route.abort();}return route.continue(); }); await students[2].reload(); await expect(students[2].getByRole('heading',{name:/My worklist|Patient chart|Medications/})).toBeVisible(); expect(external).toEqual([]);
    expect(errors).toEqual([]);
  } finally { await Promise.all(contexts.map(c=>c.close())); }
});
