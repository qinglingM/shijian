/* eslint-disable */
const h = require('C:/Users/Administrator/.openclaw/skills/browser-automation/index.js')

async function snap(label) {
  const r = await h.handleScreenshot({ fullPage: true })
  const file = String(r).match(/screenshot-\d+\.png/)?.[0]
  console.log(`>>> ${label}  =>  ${file}`)
  return file
}

async function clear() {
  // Reset draft / auth so each run is fresh
  await h.handleEvaluate({
    script: `
      try {
        localStorage.removeItem('shijian:practice-draft');
        // keep auth token so we don't re-sign-in every time
      } catch {}
    `,
  })
}

;(async () => {
  await h.handleNavigate({ url: 'http://localhost:5173/' })
  await new Promise((r) => setTimeout(r, 3500))  // wait for auth
  await clear()
  await h.handleNavigate({ url: 'http://localhost:5173/' })
  await new Promise((r) => setTimeout(r, 1500))
  await snap('00-home-empty')

  // Step 1
  await h.handleClick({ selector: 'text=+ 开始食鉴一家店' })
  await new Promise((r) => setTimeout(r, 600))
  await snap('01-step1-initial')

  await h.handleFill({ selector: 'input[placeholder*="搜店名"]', value: '海底捞' })
  await new Promise((r) => setTimeout(r, 800))
  await snap('02-step1-results')

  await h.handleClick({ selector: 'text=就是这家' })  // pick first match
  await new Promise((r) => setTimeout(r, 1200))
  await snap('03-step2-fresh')

  // Step 2
  await h.handleClick({ selector: 'button:has(span:has-text("夯爆了"))' })
  await new Promise((r) => setTimeout(r, 400))
  await h.handleFill({
    selector: 'textarea[placeholder*="服务员"]',
    value: '锅底料还行，服务员忘记加菜两次',
  })
  await new Promise((r) => setTimeout(r, 200))
  await snap('04-step2-tier-selected')

  await h.handleClick({ selector: 'text=下一步' })
  await new Promise((r) => setTimeout(r, 700))
  await snap('05-step3-fresh')

  // Step 3: add a new dish
  await h.handleClick({ selector: 'button:has-text("新增菜品")' })
  await new Promise((r) => setTimeout(r, 400))
  await h.handleFill({ selector: 'input[placeholder*="菜名"]', value: '麻辣肥牛' })
  await new Promise((r) => setTimeout(r, 200))
  // Click score "9" button
  await h.handleClick({ selector: '[data-testid="score-9"]' })
  await new Promise((r) => setTimeout(r, 200))
  await h.handleFill({ selector: 'textarea[placeholder*="锐评"]', value: '挺稳的，下次还会再点' })
  await new Promise((r) => setTimeout(r, 200))
  await snap('06-step3-with-dish')

  // Submit preview
  await h.handleClick({ selector: 'button:has-text("鉴定完毕")' })
  await new Promise((r) => setTimeout(r, 500))
  await snap('07-submit-preview')

  // Manual entry path
  await h.handleNavigate({ url: 'http://localhost:5173/practice/manual' })
  await new Promise((r) => setTimeout(r, 600))
  await snap('08-manual-warning')
  await h.handleClick({ selector: 'text=继续手动补充' })
  await new Promise((r) => setTimeout(r, 600))
  await snap('09-manual-form')
})().catch((e) => {
  console.error('SCRIPT FAILED', e)
  process.exit(1)
})
