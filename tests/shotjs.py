# Screenshot helper with JS: python3 tests/shotjs.py URL OUT.png W H TIMEOUT "js to run after ready"
import sys, time
from playwright.sync_api import sync_playwright
url, out = sys.argv[1], sys.argv[2]
W = int(sys.argv[3]) if len(sys.argv) > 3 else 1280
H = int(sys.argv[4]) if len(sys.argv) > 4 else 720
TO = float(sys.argv[5]) if len(sys.argv) > 5 else 60
JS = sys.argv[6] if len(sys.argv) > 6 else ''
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    import os
    mobile = os.environ.get('MOBILE') == '1'
    pg = b.new_page(viewport={'width': W, 'height': H}, is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1)
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
    if JS:
        try:
            r = pg.evaluate(JS)
            if r is not None: print('JS =>', r)
        except Exception as e:
            print('JS error', e)
    time.sleep(0.5)
    pg.screenshot(path=out, timeout=150000)
    for l in logs[-30:]:
        print(l)
    b.close()
