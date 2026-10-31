import puppeteer from 'puppeteer-core';

const BASE_URL = 'http://localhost:4173';

async function run() {
  console.log('--- STARTING 1,000 TRANSACTIONS PERFORMANCE BENCHMARK ---');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });

  // Type student credentials directly
  await page.waitForSelector('input[placeholder*="rahul, sneha"]');
  await page.type('input[placeholder*="rahul, sneha"]', 'demo_student');
  await page.type('input[placeholder*="••••••••"]', 'student123');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const submit = btns.find(b => b.textContent.includes('Sign In to LifeOS'));
    if (submit) submit.click();
  });
  await new Promise(r => setTimeout(r, 2000));

  // Verify dashboard loaded
  const onDashboard = await page.evaluate(() => !document.querySelector('form'));
  console.log('Logged into dashboard:', onDashboard);

  // Insert 1,000 transactions into IndexedDB directly
  console.log('Injecting 1,000 realistic transactions into student ledger via IndexedDB...');
  const insertStart = Date.now();
  await page.evaluate(async () => {
    return new Promise((resolve, reject) => {
      const session = JSON.parse(localStorage.getItem('lifeos_current_user') || '{}');
      const uid = session.id;
      const req = indexedDB.open('LifeOS_DB');
      req.onsuccess = (e) => {
        const idb = e.target.result;
        const tx = idb.transaction(['transactions'], 'readwrite');
        const store = tx.objectStore('transactions');

        const baseDate = new Date();
        for (let i = 1; i <= 1000; i++) {
          const d = new Date(baseDate.getTime() - i * 3600 * 1000 * 4);
          const dateStr = d.toISOString().slice(0, 10);
          store.put({
            id: `bench_tx_${Date.now()}_${i}`,
            userId: uid,
            type: i % 10 === 0 ? 'income' : 'expense',
            date: dateStr,
            title: `Benchmark Record #${i}`,
            accountId: `acc_cash_${uid}`,
            amountPaise: (i * 150) % 50000 + 1000,
            category: i % 2 === 0 ? 'Food & Canteen' : 'Academics & Books',
            notes: `Performance stress test transaction entry #${i}`,
            tags: ['benchmark', 'stress-test'],
            createdAt: d.toISOString(),
            updatedAt: d.toISOString(),
            deletedAt: null,
          });
        }
        tx.oncomplete = () => resolve();
        tx.onerror = (err) => reject(err);
      };
      req.onerror = (err) => reject(err);
    });
  });

  const insertDuration = Date.now() - insertStart;
  console.log(`1,000 transactions injected in ${insertDuration}ms.`);

  // Measure page navigation and Ledger render time
  console.log('Navigating to Finance Ledger with 1,000+ transactions...');
  const renderStart = Date.now();
  await page.goto(`${BASE_URL}/finance`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('[role="tab"]', { timeout: 6000 });

  // Switch to Ledger tab
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
    const ledgerTab = tabs.find(b => b.textContent.includes('Transaction Ledger') || b.textContent.includes('Ledger'));
    if (ledgerTab) ledgerTab.click();
  });

  await page.waitForSelector('table tbody tr', { timeout: 6000 });
  const renderDuration = Date.now() - renderStart;

  const count = await page.evaluate(() => {
    return document.querySelectorAll('tbody tr').length;
  });

  console.log(`Ledger table with ${count} records rendered in ${renderDuration}ms.`);
  console.log(renderDuration < 1500 ? '✅ PASS: Rendered under 1.5s!' : '❌ FAIL: Render took over 1.5s');

  await browser.close();
}

run();
