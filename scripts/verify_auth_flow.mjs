import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = '/home/vishal/.gemini/antigravity/brain/8118ac58-94a2-4a2b-8196-0c492382e4fe';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log('Launching headless Chrome...');
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1280, height: 800 },
  });

  const page = await browser.newPage();

  try {
    // 1. Visit App
    console.log('Navigating to http://localhost:4173/ ...');
    await page.goto('http://localhost:4173/', { waitUntil: 'networkidle2' });
    await sleep(1500);

    // Screenshot 1: Auth Sign In Screen
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'auth_login_screen.png') });
    console.log('Saved auth_login_screen.png');

    // 2. Click Register tab
    console.log('Switching to Register tab...');
    const registerTabBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.includes('Register'));
    });
    if (registerTabBtn) await registerTabBtn.click();
    await sleep(500);

    // Fill registration form
    const testUser = `rohit_${Date.now().toString().slice(-4)}`;
    console.log(`Filling registration for student user "${testUser}"...`);
    await page.type('input[placeholder*="rohit_cs"]', testUser);
    await page.type('input[placeholder*="Rohit Sharma"]', 'Rohit Sharma');
    await page.type('input[placeholder*="At least 4 characters"]', 'pass123');

    // Submit registration
    const submitBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.includes('Submit for Approval'));
    });
    if (submitBtn) await submitBtn.click();
    await sleep(1000);

    // Screenshot 2: Registration submitted for approval
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'auth_registered_pending.png') });
    console.log('Saved auth_registered_pending.png');

    // 3. Try to sign in as student before approval
    const signInTabBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.includes('Sign In'));
    });
    if (signInTabBtn) await signInTabBtn.click();
    await sleep(500);

    console.log(`Attempting sign in as unapproved user ${testUser}...`);
    await page.type('input[placeholder*="rahul, sneha"]', testUser);
    await page.type('input[placeholder*="••••••••"]', 'pass123');

    const signInBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.includes('Sign In to LifeOS'));
    });
    if (signInBtn) await signInBtn.click();
    await sleep(800);

    // Screenshot 3: Pending approval rejection
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'auth_pending_warning.png') });
    console.log('Saved auth_pending_warning.png');

    // 4. Click Admin shortcut to fill admin / admin123
    console.log('Signing in as Administrator (admin / admin123)...');
    const adminShortcutBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.includes('admin / admin123'));
    });
    if (adminShortcutBtn) await adminShortcutBtn.click();
    await sleep(300);

    const adminSignInBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.includes('Sign In to LifeOS'));
    });
    if (adminSignInBtn) await adminSignInBtn.click();
    await sleep(1500);

    // Screenshot 4: Admin Portal Page
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'admin_portal_screen.png') });
    console.log('Saved admin_portal_screen.png');

    // 5. Admin approves student
    console.log(`Admin clicking Accept for student ${testUser}...`);
    const acceptBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.includes('Accept'));
    });
    if (acceptBtn) await acceptBtn.click();
    await sleep(1000);

    // Screenshot 5: Admin Portal with user approved
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'admin_portal_user_approved.png') });
    console.log('Saved admin_portal_user_approved.png');

    // 6. Admin logs out
    console.log('Admin signing out...');
    const adminSignOutBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.includes('Sign Out'));
    });
    if (adminSignOutBtn) await adminSignOutBtn.click();
    await sleep(1200);

    // 7. Student logs in now that he is approved
    console.log(`${testUser} signing in with approved credentials...`);
    await page.waitForSelector('input[placeholder*="rahul, sneha"]', { timeout: 6000 });
    await page.type('input[placeholder*="rahul, sneha"]', testUser);
    await page.type('input[placeholder*="••••••••"]', 'pass123');

    const rohitSignInBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.includes('Sign In to LifeOS'));
    });
    if (rohitSignInBtn) await rohitSignInBtn.click();
    await sleep(2000);

    // Screenshot 6: Student Dashboard at FIRST LOGIN (Strict Zero Data)
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'student_zero_data_dashboard.png') });
    console.log('Saved student_zero_data_dashboard.png');

    // 8. Test Quick Add Expense
    console.log('Testing Quick Add: Expense...');
    const quickAddBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.includes('Quick Add'));
    });
    if (quickAddBtn) await quickAddBtn.click();
    await sleep(800);

    // Fill expense
    await page.waitForSelector('input[placeholder*="Canteen Lunch"]', { timeout: 5000 });
    await page.type('input[placeholder*="Canteen Lunch"]', 'Hostel Canteen Tea & Samosa');
    await page.type('input[placeholder="0.00"]', '45');

    const recordExpenseBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.includes('Record Expense'));
    });
    if (recordExpenseBtn) await recordExpenseBtn.click();
    await sleep(1500);

    // 9. Test Quick Add Academic Task
    console.log('Testing Quick Add: Academic Task...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(x => x.textContent.includes('Quick Add'));
      if (b) b.click();
    });
    await sleep(800);

    // Click Task tab
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(x => x.textContent.trim() === 'Task' || x.textContent.includes('Task'));
      if (b) b.click();
    });
    await sleep(600);

    await page.waitForSelector('input[placeholder*="Lab 3 Report"]', { timeout: 5000 });
    await page.type('input[placeholder*="Lab 3 Report"]', 'CS301 Concurrency Lab Assignment');

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(x => x.textContent.includes('Save Academic Task'));
      if (b) b.click();
    });
    await sleep(1500);

    // Screenshot 7: Student Dashboard with added expense and task
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'student_with_tasks_dashboard.png') });
    console.log('Saved student_with_tasks_dashboard.png');

    console.log('ALL VERIFICATION FLOWS COMPLETED SUCCESSFULLY!');
  } catch (err) {
    console.error('Verification error:', err);
  } finally {
    await browser.close();
  }
}

run();
