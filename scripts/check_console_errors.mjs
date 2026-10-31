import puppeteer from 'puppeteer-core';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1280, height: 800 },
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  const consoleWarns = [];
  const networkErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({ text: msg.text(), location: msg.location() });
    } else if (msg.type() === 'warning') {
      consoleWarns.push({ text: msg.text(), location: msg.location() });
    }
  });

  page.on('requestfailed', request => {
    networkErrors.push({
      url: request.url(),
      errorText: request.failure()?.errorText,
    });
  });

  console.log('1. Checking unauthenticated root /');
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle2' });
  await sleep(1000);

  // Sign in as admin to check /admin
  console.log('2. Signing in as admin...');
  await page.evaluate(() => {
    const inputs = document.querySelectorAll('input');
    inputs[0].value = 'admin';
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[1].value = 'admin123';
    inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
    const btns = Array.from(document.querySelectorAll('button'));
    const submit = btns.find(b => b.textContent.includes('Sign In to LifeOS'));
    if (submit) submit.click();
  });
  await sleep(1500);

  console.log('3. Visiting /admin');
  await page.goto('http://localhost:4173/admin', { waitUntil: 'networkidle2' });
  await sleep(1000);

  // Now create and approve a student user for comprehensive route testing
  console.log('4. Logging out admin and logging in as student...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const logout = btns.find(b => b.textContent.includes('Sign Out'));
    if (logout) logout.click();
  });
  await sleep(1000);

  // Register student
  const studentUser = `qa_student_${Date.now().toString().slice(-4)}`;
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const regTab = btns.find(b => b.textContent.includes('Register'));
    if (regTab) regTab.click();
  });
  await sleep(500);

  await page.type('input[placeholder*="rohit_cs"]', studentUser);
  await page.type('input[placeholder*="Rohit Sharma"]', 'QA Test Student');
  await page.type('input[placeholder*="At least 4 characters"]', 'password123');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const reg = btns.find(b => b.textContent.includes('Submit for Approval'));
    if (reg) reg.click();
  });
  await sleep(1000);

  // Log in as admin to approve
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const signTab = btns.find(b => b.textContent.includes('Sign In'));
    if (signTab) signTab.click();
  });
  await sleep(500);
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const shortcut = btns.find(b => b.textContent.includes('admin / admin123'));
    if (shortcut) shortcut.click();
    const submit = btns.find(b => b.textContent.includes('Sign In to LifeOS'));
    if (submit) submit.click();
  });
  await sleep(1500);

  // Approve student in admin table
  await page.evaluate((uname) => {
    const rows = Array.from(document.querySelectorAll('tr'));
    const targetRow = rows.find(r => r.textContent.includes(uname));
    if (targetRow) {
      const btn = targetRow.querySelector('button');
      if (btn && btn.textContent.includes('Accept')) btn.click();
    }
  }, studentUser);
  await sleep(1000);

  // Log out admin
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const logout = btns.find(b => b.textContent.includes('Sign Out'));
    if (logout) logout.click();
  });
  await sleep(1000);

  // Log in as student
  await page.type('input[placeholder*="rahul, sneha"]', studentUser);
  await page.type('input[placeholder*="••••••••"]', 'password123');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const submit = btns.find(b => b.textContent.includes('Sign In to LifeOS'));
    if (submit) submit.click();
  });
  await sleep(2000);

  const routes = [
    '/',
    '/finance',
    '/earnings',
    '/academics',
    '/habits',
    '/goals',
    '/agenda',
    '/reports',
    '/trash',
    '/settings',
  ];

  for (const route of routes) {
    console.log(`Checking student route: ${route}`);
    await page.goto(`http://localhost:4173${route}`, { waitUntil: 'networkidle2' });
    await sleep(800);
  }

  console.log('\n--- CONSOLE ERRORS ---');
  console.log(JSON.stringify(consoleErrors, null, 2));

  console.log('\n--- NETWORK ERRORS ---');
  console.log(JSON.stringify(networkErrors, null, 2));

  console.log('\n--- CONSOLE WARNS ---');
  console.log(JSON.stringify(consoleWarns, null, 2));

  await browser.close();
  return { consoleErrors, networkErrors, consoleWarns };
}

run();
