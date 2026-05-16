/* eslint-disable */
const h = require('C:/Users/Administrator/.openclaw/skills/browser-automation/index.js')

;(async () => {
  // Install console hooks via init script if available
  await h.handleEvaluate({
    script: `
      // Set up a marker so we know if hooks were installed BEFORE page load
      // (this won't survive navigation but won't break either)
      true
    `,
  }).catch(() => {})
  await h.handleNavigate({ url: 'http://localhost:5173/' })
  // Wait a tick for window object to exist
  await new Promise((r) => setTimeout(r, 50))
  await h.handleEvaluate({
    script: `
      window.__logs = [];
      const origLog = console.log;
      const origErr = console.error;
      const origWarn = console.warn;
      console.log  = (...a) => { window.__logs.push(['log',   a.map(String).join(' ')]); origLog(...a); };
      console.error = (...a) => { window.__logs.push(['error', a.map(String).join(' ')]); origErr(...a); };
      console.warn  = (...a) => { window.__logs.push(['warn',  a.map(String).join(' ')]); origWarn(...a); };
      window.addEventListener('error', e => window.__logs.push(['win-error', e.message]));
      window.addEventListener('unhandledrejection', e => window.__logs.push(['rejection', String(e.reason && e.reason.message || e.reason)]));
      // Test direct fetch to supabase
      window.__test_supabase = async () => {
        try {
          const r = await fetch('https://jpdnnfbxcgdjhpwcchqd.supabase.co/auth/v1/token?grant_type=password', {
            method: 'POST',
            headers: { apikey: 'sb_publishable_fFqF2gk7FRN5hXoIrBWG-Q_6Dx8zWaL', 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: '770638046@qq.com', password: 'Nidhogg131313' }),
          });
          return r.status + ': ' + (await r.text()).slice(0, 100);
        } catch (e) {
          return 'ERR: ' + e.message;
        }
      };
    `,
  })
  await new Promise((r) => setTimeout(r, 8000))

  const state = await h.handleEvaluate({
    script: `JSON.stringify({
      text: document.body.innerText.slice(0, 500),
      authLogs: window.__authLogs || [],
      ls: Object.keys(localStorage),
    })`,
  })
  console.log('=== STATE ===\n' + state)

  const fetchTest = await h.handleEvaluate({
    script: `window.__test_supabase().then(r => r)`,
  })
  console.log('=== DIRECT FETCH ===\n' + fetchTest)

  const shot = await h.handleScreenshot({ fullPage: true })
  console.log(shot)

  // Click the demo toggle (eye icon)
  await h.handleClick({ selector: 'button[aria-label*="示例"]' })
  await new Promise((r) => setTimeout(r, 500))
  const shot2 = await h.handleScreenshot({ fullPage: true })
  console.log('DEMO VIEW:', shot2)
})().catch((e) => {
  console.error('SCRIPT FAILED', e)
  process.exit(1)
})
