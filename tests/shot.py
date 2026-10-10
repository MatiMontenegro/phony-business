# Screenshot helper: python3 tests/shot.py URL OUT.png [W H] [timeout_s]
import sys, time
from playwright.sync_api import sync_playwright
url, out = sys.argv[1], sys.argv[2]
W = int(sys.argv[3]) if len(sys.argv) > 3 else 1280
H = int(sys.argv[4]) if len(sys.argv) > 4 else 720
TO = float(sys.argv[5]) if len(sys.argv) > 5 else 60
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': W, 'height': H})
    logs = []
    pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}'))
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
    pg.goto(url)
    t = time.time()
    while time.time() - t < TO:
        try:
            if pg.evaluate('window.__ready === true'):
                break
        except Exception:
            pass
        time.sleep(0.25)
    time.sleep(0.5)
    pg.screenshot(path=out, timeout=150000)
    for l in logs[-30:]:
        print(l)
    b.close()
