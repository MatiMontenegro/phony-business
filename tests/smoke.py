# Smoke test of the real flow: lobby -> clock in -> sit -> ring -> answer -> PC -> talk -> pay -> collect.
import sys, time, json
from playwright.sync_api import sync_playwright
url = sys.argv[1]
out = sys.argv[2]

def wait(pg, cond, limit=120, step=0.4):
    t = time.time()
    while time.time() - t < limit:
        try:
            if pg.evaluate(cond): return round(time.time() - t, 1)
        except Exception as e:
            pass
        time.sleep(step)
    return None

with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width': 1100, 'height': 640})
    pg = ctx.new_page()
    logs = []
    pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
    pg.goto(url)
    print('lobby', wait(pg, 'window.__ready === true && !!window.__ui && !!window.__ui.lobby', 200))
    pg.evaluate("window.__ui.lobby.punch()")
    print('joined', wait(pg, "!!(window.__game.me && window.__game.mode === 'play')", 200))
    pg.evaluate("""(() => { const g = window.__game; const d = g.office.desks[0]; g.me.controller.teleport(d.seat); g.me.char.position.copy(d.seat); g.me.sitAt(d); g.switchboard.timer = 1e9; g.switchboard.rings.push({ id: 'smk', d: 0, mk: 'grandpabot', pr: 2, ch: 'banana', age: 0 }); })()""")
    print('logged in', wait(pg, "!window.__game.screens.loggingIn"))
    pg.keyboard.press('Enter')  # answer
    print('connected', wait(pg, "window.__game.calls.state === 'connected'", 30))
    pg.keyboard.press('Enter')  # open the PC
    print('pc open', wait(pg, "window.__ui.desktop.phase === 'open'", 60))
    pg.evaluate("window.__ui.desktop.wins.mail.hide()")
    pg.evaluate("window.__ui.desktop.input && window.__ui.desktop.input.focus()")
    pg.keyboard.type('beep boop! hola abuelo, beep beep')
    pg.keyboard.press('Enter')
    print('reply1', wait(pg, "window.__game.calls.call.transcript.length >= 3 && !window.__game.calls.busy", 60))
    for i in range(4):
        pg.keyboard.type('beep boop, pagame con tus tornillos, beep')
        pg.keyboard.press('Enter')
        wait(pg, "!window.__game.calls.busy && window.__game.calls.call && window.__game.calls.call.transcript.slice(-1)[0].who === 'mark'", 60)
        if pg.evaluate("window.__game.calls.vouchers.length > 0"): break
    print('transcript', json.dumps(pg.evaluate("window.__game.calls.call ? window.__game.calls.call.transcript.map(m => m.who + ': ' + m.text) : []"), ensure_ascii=False)[:1400])
    v = pg.evaluate("window.__game.calls.vouchers.map(v => v.code)")
    print('vouchers', v)
    if v:
        pg.evaluate("window.__ui.desktop.openApp('leads')")
        pg.evaluate("window.__ui.desktop.voucherIn.focus()")
        pg.keyboard.type(v[0].lower().replace('-', ' '))
        pg.keyboard.press('Enter')
        time.sleep(1)
        print('money', pg.evaluate("window.__game.money"), pg.evaluate("window.__ui.desktop.voucherMsg.textContent"))
    pg.screenshot(path=out, timeout=150000)
    pg.keyboard.press('Escape')
    pg.keyboard.press('Escape')
    print('back at chair', wait(pg, "window.__ui.desktop.phase === 'closed'", 60))
    pg.keyboard.press('KeyX')
    print('hung up', wait(pg, "window.__game.calls.state === 'wrapup'", 20))
    pg.keyboard.press('KeyE')
    print('stood', wait(pg, "window.__game.me.mode === 'walk'", 20))
    pg.keyboard.down('KeyP')
    time.sleep(2)
    print('peeing', pg.evaluate("window.__game.me.peeing"), pg.evaluate("window.__game.me.bladder.toFixed(2)"))
    pg.keyboard.up('KeyP')
    for l in logs[-25:]: print(l)
    b.close()
