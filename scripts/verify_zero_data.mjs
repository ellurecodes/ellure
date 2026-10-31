import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const APP_URL = 'http://localhost:4173';
const ARTIFACT_DIR = '/home/vishal/.gemini/antigravity/brain/8118ac58-94a2-4a2b-8196-0c492382e4fe';
const CHROME_PATH = '/usr/bin/google-chrome';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runZeroDataVerification() {
  console.log('--- STARTING ZERO PRE-ENTERED DATA VERIFICATION ---');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1280, height: 800 },
  });

  const page = await browser.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  const results = {
    cleanStateIndexedDbAudit: false,
    emptyStatesAcrossRoutes: {},
    noFakeCharts: false,
    onboardingChecklistInitial: false,
    addRealRecordsReactivity: false,
    checklistAutoTick: false,
    deleteAllDataRestoration: false,
    finalIndexedDbZeroCheck: false,
    consoleErrorsCount: 0,
  };

  try {
    // 1. Navigate to /auth and clear all data
    await page.goto(`${APP_URL}/auth`, { waitUntil: 'networkidle2' });
    await sleep(600);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      return new Promise(resolve => {
        const req = indexedDB.deleteDatabase('LifeOS_DB');
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
        req.onblocked = () => resolve(true);
      });
    });

    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(800);

    // 2. Register fresh student user
    const studentUser = `zero_user_${Date.now().toString().slice(-4)}`;
    console.log(`Step 1: Registering brand-new student account: ${studentUser}...`);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const regBtn = btns.find(b => b.textContent.includes('Register'));
      if (regBtn) regBtn.click();
    });
    await sleep(500);

    await page.type('input[placeholder*="rohit_cs"]', studentUser);
    await page.type('input[placeholder*="Rohit Sharma"]', 'Zero Data User');
    await page.type('input[placeholder*="At least 4 characters"]', 'pass123');

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const submitBtn = btns.find(b => b.textContent.includes('Submit for Approval'));
      if (submitBtn) submitBtn.click();
    });
    await sleep(1000);

    // 3. Admin logs in and approves user
    console.log('Step 2: Admin logs in and accepts student account...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const signinTab = btns.find(b => b.textContent.includes('Sign In'));
      if (signinTab) signinTab.click();
    });
    await sleep(400);

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const shortcut = btns.find(b => b.textContent.includes('admin / admin123'));
      if (shortcut) shortcut.click();
    });
    await sleep(400);

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const signin = btns.find(b => b.textContent.includes('Sign In to LifeOS'));
      if (signin) signin.click();
    });
    await sleep(1500);

    // Accept student user in admin table
    await page.evaluate((uname) => {
      const rows = Array.from(document.querySelectorAll('tr'));
      const r = rows.find(x => x.textContent.includes(uname));
      if (r) {
        const acceptBtn = Array.from(r.querySelectorAll('button')).find(b => b.textContent.includes('Accept'));
        if (acceptBtn) acceptBtn.click();
      }
    }, studentUser);
    await sleep(1000);

    // Logout admin
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const logoutBtn = btns.find(b => b.textContent.includes('Sign Out'));
      if (logoutBtn) logoutBtn.click();
    });
    await sleep(1000);

    // 4. Log in as the fresh student
    console.log('Step 3: Logging in as approved student...');
    await page.waitForSelector('input[placeholder*="rahul, sneha"]');
    await page.type('input[placeholder*="rahul, sneha"]', studentUser);
    await page.type('input[placeholder*="••••••••"]', 'pass123');

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const signin = btns.find(b => b.textContent.includes('Sign In to LifeOS'));
      if (signin) signin.click();
    });
    await sleep(2000);

    // Wait for Dashboard to mount
    await page.waitForSelector('.tabular-nums', { timeout: 8000 });
    console.log('Student logged in successfully. URL:', page.url());

    // 5. Audit IndexedDB directly
    console.log('Step 4: Inspecting IndexedDB tables directly for ZERO records...');
    const auditDb = async () => {
      return await page.evaluate(async () => {
        return new Promise((resolve, reject) => {
          const req = indexedDB.open('LifeOS_DB');
          req.onsuccess = () => {
            const db = req.result;
            const tableNames = [
              'accounts',
              'transactions',
              'platforms',
              'earningRecords',
              'withdrawals',
              'budgets',
              'savingsGoals',
              'recurringTransactions',
              'subjects',
              'academicTasks',
              'habits',
              'habitLogs',
              'fitnessMetricLogs',
              'goals',
            ];

            const tx = db.transaction(tableNames.concat(['settings']), 'readonly');
            const counts = {};
            let completed = 0;

            for (const name of tableNames) {
              const countReq = tx.objectStore(name).count();
              countReq.onsuccess = () => {
                counts[name] = countReq.result;
                completed++;
                if (completed === tableNames.length + 1) checkDone();
              };
            }

            const setReq = tx.objectStore('settings').getAll();
            let settingsRecord = null;
            setReq.onsuccess = () => {
              settingsRecord = setReq.result;
              completed++;
              if (completed === tableNames.length + 1) checkDone();
            };

            function checkDone() {
              resolve({ counts, settingsRecord });
            }
          };
          req.onerror = () => reject(req.error);
        });
      });
    };

    const dbAudit = await auditDb();
    console.log('Initial IndexedDB User Table Counts:', dbAudit.counts);
    const totalRecords = Object.values(dbAudit.counts).reduce((a, b) => a + b, 0);
    if (totalRecords === 0) {
      console.log('PASS: All 14 user data tables contain exactly 0 records on first launch!');
      results.cleanStateIndexedDbAudit = true;
    } else {
      console.error('FAIL: Found pre-seeded records:', dbAudit.counts);
    }

    // Check settings defaults
    const userSettings = dbAudit.settingsRecord?.[0];
    console.log('User Settings Record on First Launch:', {
      currency: userSettings?.currency,
      theme: userSettings?.theme,
      monthlyAllowancePaise: userSettings?.monthlyAllowancePaise,
      fitnessToggles: userSettings?.fitnessToggles,
      customCategories: userSettings?.customCategories,
      showOnboardingChecklist: userSettings?.showOnboardingChecklist,
    });

    // 6. Capture Empty State Dashboard screenshot
    const dashScreenshotPath = path.join(ARTIFACT_DIR, 'zero_data_dashboard.png');
    await page.screenshot({ path: dashScreenshotPath, fullPage: true });
    console.log(`Saved screenshot: ${dashScreenshotPath}`);

    // Check Dashboard elements
    const dashText = await page.evaluate(() => document.body.innerText);
    const hasZeroMoney = dashText.includes('₹0.00');
    const hasAccountPrompt = dashText.includes('Add your first account to get started');
    const hasNoCashFlowNotice = dashText.includes('No cash flow recorded this month yet');
    const hasGettingStarted = dashText.includes('Getting Started with LifeOS');
    const hasZeroChecklist = dashText.includes('0 of 5 completed');

    console.log('Dashboard Empty State Checks:', {
      hasZeroMoney,
      hasAccountPrompt,
      hasNoCashFlowNotice,
      hasGettingStarted,
      hasZeroChecklist,
    });

    results.noFakeCharts = hasNoCashFlowNotice;
    results.onboardingChecklistInitial = hasGettingStarted && hasZeroChecklist;
    results.emptyStatesAcrossRoutes['dashboard'] = hasZeroMoney && hasAccountPrompt && hasNoCashFlowNotice;

    // 7. Verify empty states across all routes
    const routes = [
      { path: '/finance', name: 'finance', expectedPattern: /No accounts created yet/ },
      { path: '/earnings', name: 'earnings', expectedPattern: /Not enough data|No earning records yet/ },
      { path: '/academics', name: 'academics', expectedPattern: /No today tasks|No courses registered/ },
      { path: '/habits', name: 'habits', expectedPattern: /No habits tracked/ },
      { path: '/goals', name: 'goals', expectedPattern: /No goals defined/ },
      { path: '/agenda', name: 'agenda', expectedPattern: /Your Daily Agenda is Clear/ },
      { path: '/reports', name: 'reports', expectedPattern: /Not enough data yet/ },
      { path: '/trash', name: 'trash', expectedPattern: /Trash is clean/ },
      { path: '/settings', name: 'settings', expectedPattern: /Settings & Privacy Center/ },
    ];

    for (const r of routes) {
      await page.goto(`${APP_URL}${r.path}`, { waitUntil: 'networkidle2' });
      await sleep(600);
      const text = await page.evaluate(() => document.body.innerText);
      const pass = r.expectedPattern.test(text);
      results.emptyStatesAcrossRoutes[r.name] = pass;
      console.log(`Route [${r.path}] empty state pattern check: ${pass ? 'PASS' : 'FAIL'}`);
    }

    // Capture Settings page check (confirming no "load sample data")
    const settingsText = await page.evaluate(() => document.body.innerText);
    const hasSampleDataButton = settingsText.includes('Load Sample Data') || settingsText.includes('Preview Sample Data');
    console.log('Settings Sample Data Button Check (Must be FALSE):', hasSampleDataButton);

    // 8. Add real records and verify reactivity
    console.log('Step 5: Adding real user records across modules...');
    await page.goto(`${APP_URL}/finance`, { waitUntil: 'networkidle2' });
    await sleep(600);

    // Add Account
    console.log('Adding Account: My SBI Account with ₹2,500 opening balance...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const addAcc = btns.find(b => b.textContent.includes('Add First Account') || b.textContent.includes('New Account'));
      if (addAcc) addAcc.click();
    });
    await sleep(400);

    await page.type('input[placeholder*="Canara Bank"]', 'My SBI Account');
    const accNumberInput = await page.$('input[type="number"]');
    if (accNumberInput) {
      await accNumberInput.click({ clickCount: 3 });
      await accNumberInput.type('2500');
    }
    await sleep(300);

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const create = btns.find(b => b.textContent.includes('Create Account'));
      if (create) create.click();
    });
    await sleep(800);

    // Record Expense via QuickAdd Modal
    console.log('Recording Transaction: Physics Textbook ₹450...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const quickAdd = btns.find(b => b.textContent.includes('Quick Add') || b.getAttribute('title') === 'Quick Add Record');
      if (quickAdd) quickAdd.click();
    });
    await sleep(500);

    await page.type('input[placeholder*="Canteen Lunch"]', 'Physics Textbook');
    await page.type('input[placeholder="0.00"]', '450');
    await sleep(300);

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const save = btns.find(b => b.textContent.includes('Record Expense'));
      if (save) save.click();
    });
    await sleep(800);

    // Add Course
    console.log('Adding Course: CS101 Algorithms...');
    await page.goto(`${APP_URL}/academics`, { waitUntil: 'networkidle2' });
    await sleep(600);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const newCourse = btns.find(b => b.textContent.includes('New Course'));
      if (newCourse) newCourse.click();
    });
    await sleep(400);

    await page.type('input[placeholder*="CS201"]', 'CS101');
    await page.type('input[placeholder*="Data Structures"]', 'Algorithms');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const save = btns.find(b => b.textContent.includes('Register Course'));
      if (save) save.click();
    });
    await sleep(800);

    // Add Platform
    console.log('Adding Platform: Upwork Freelance...');
    await page.goto(`${APP_URL}/earnings`, { waitUntil: 'networkidle2' });
    await sleep(600);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const addPlat = btns.find(b => b.textContent.includes('Add Platform'));
      if (addPlat) addPlat.click();
    });
    await sleep(400);

    await page.type('input[placeholder*="Upwork"]', 'Upwork Freelance');
    await page.type('input[placeholder="https://example.com"]', 'https://upwork.com');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const save = btns.find(b => b.textContent.includes('Save Platform'));
      if (save) save.click();
    });
    await sleep(800);

    // Add Goal
    console.log('Adding Goal: Score 9.0 CGPA...');
    await page.goto(`${APP_URL}/goals`, { waitUntil: 'networkidle2' });
    await sleep(600);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const addGoal = btns.find(b => b.textContent.includes('Define Goal') || b.textContent.includes('New Goal'));
      if (addGoal) addGoal.click();
    });
    await sleep(400);

    await page.type('input[placeholder*="Score 8.5"]', 'Score 9.0 CGPA');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const save = btns.find(b => b.textContent.includes('Create Goal'));
      if (save) save.click();
    });
    await sleep(800);

    // 9. Inspect Dashboard after adding records
    console.log('Step 6: Verifying Dashboard with real user data...');
    await page.goto(`${APP_URL}/`, { waitUntil: 'networkidle2' });
    await sleep(1000);

    const updatedDashText = await page.evaluate(() => document.body.innerText);
    const showsUpdatedMoney = updatedDashText.includes('₹2,050.00'); // ₹2500 opening - ₹450 expense = ₹2050
    const showsExpense = updatedDashText.includes('₹450.00');
    const showsCompletedChecklist = updatedDashText.includes('5 of 5 completed');

    console.log('Updated Dashboard Verification:', {
      showsUpdatedMoney,
      showsExpense,
      showsCompletedChecklist,
    });

    results.addRealRecordsReactivity = showsUpdatedMoney && showsExpense;
    results.checklistAutoTick = showsCompletedChecklist;

    // 10. Run "Delete All Local Data" in Settings
    console.log('Step 7: Testing "Delete All Local Data" in Settings...');
    await page.goto(`${APP_URL}/settings`, { waitUntil: 'networkidle2' });
    await sleep(600);

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const wipeBtn = btns.find(b => b.textContent.includes('Delete All Local Data'));
      if (wipeBtn) wipeBtn.click();
    });
    await sleep(500);

    await page.type('input[placeholder="DELETE ALL DATA"]', 'DELETE ALL DATA');
    await sleep(400);

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const confirmWipe = btns.find(b => b.textContent.includes('Wipe Everything'));
      if (confirmWipe) confirmWipe.click();
    });
    await sleep(2000);

    // 11. Verify restored to exact zero-data state
    console.log('Step 8: Verifying restored clean zero-data state...');
    await page.goto(`${APP_URL}/`, { waitUntil: 'networkidle2' });
    await sleep(1000);

    const restoredDashText = await page.evaluate(() => document.body.innerText);
    const restoredZeroMoney = restoredDashText.includes('₹0.00');
    const restoredAccountPrompt = restoredDashText.includes('Add your first account to get started');
    const restoredChecklist = restoredDashText.includes('0 of 5 completed');

    console.log('Restored Zero-Data State Verification:', {
      restoredZeroMoney,
      restoredAccountPrompt,
      restoredChecklist,
    });

    const finalDbAudit = await auditDb();
    const finalTotalRecords = Object.values(finalDbAudit.counts).reduce((a, b) => a + b, 0);
    console.log('Final IndexedDB counts after wipe:', finalDbAudit.counts);

    results.deleteAllDataRestoration = restoredZeroMoney && restoredAccountPrompt && restoredChecklist;
    results.finalIndexedDbZeroCheck = finalTotalRecords === 0;
    results.consoleErrorsCount = consoleErrors.length;

    console.log('--- ALL VERIFICATION STEPS COMPLETE ---');
    console.log('FINAL RESULTS:', JSON.stringify(results, null, 2));

    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'scratch', 'zero_data_results.json'),
      JSON.stringify(results, null, 2)
    );
  } finally {
    await browser.close();
  }
}

runZeroDataVerification().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
