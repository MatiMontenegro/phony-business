// Full-screen moments: the shift report (promoted / fired), the pause menu
// and the "your line is dead" dialog when the AI runs out.
import { $, clear, money } from './dom.js';
import { t } from '../i18n.js';
import { usage } from '../ai/usage.js';

export class Overlays {
  constructor(ui, root) {
    this.ui = ui;
    this.game = ui.game;
    this.end = $('div', { class: 'end', hidden: true, role: 'dialog', 'aria-modal': 'true' });
    this.menu = $('div', { class: 'modal menu', hidden: true, role: 'dialog', 'aria-modal': 'true' });
    this.dead = $('div', { class: 'modal', hidden: true, role: 'dialog', 'aria-modal': 'true' });
    root.append(this.end, this.menu, this.dead);
    this.menu.addEventListener('pointerdown', (e) => { if (e.target === this.menu) this.closeMenu(); });
  }

  get anyOpen() { return !this.end.hidden || !this.menu.hidden || !this.dead.hidden; }

  showEnd(result) {
    const g = this.game, L = g.lang, me = g.me, s = g.calls.stats;
    clear(this.end);
    this.end.className = 'end ' + result;
    const rows = [[g.profile.name + ' (' + t('you', L) + ')', g.money, s.closed, me.stats.farts, me.stats.pees, me.stats.flops]];
    for (const r of g.remotes.values()) {
      const st = r.pr && Array.isArray(r.pr.st) ? r.pr.st : [];
      rows.push([r.name, (r.pr && r.pr.mo) || 0, st[0] ?? '–', st[1] ?? '–', st[2] ?? '–', st[3] ?? '–']);
    }
    const table = $('table', { class: 'report' },
      $('thead', {}, $('tr', {}, ...['', t('sEarned', L), t('sClosed', L), t('sFarts', L), t('sPees', L), t('sFlops', L)].map((x) => $('th', { text: x })))),
      $('tbody', {}, ...rows.map((r) => $('tr', {}, ...r.map((v, i) => $('td', { text: i === 1 ? money(v) : String(v) }))))));
    const team = g.teamMoney();
    const u = usage.shift;
    const tok = Math.round(u.inTok + u.outTok);
    const ai = g.calls.brainKind === 'backup'
      ? (L === 'es' ? `IA: cerebro de repuesto (gratis, sin conexión). ${s.calls} llamadas.` : `AI: backup brain (free, offline). ${s.calls} calls.`)
      : t('aiUsageLine', L, { req: u.requests, tok: tok.toLocaleString('en-US') }) + (s.calls ? (L === 'es' ? ` · ${s.calls} llamadas` : ` · ${s.calls} calls`) : '');
    this.end.append($('div', { class: 'inner' },
      $('h1', { text: t(result === 'promoted' ? 'promoted' : 'fired', L) }),
      $('p', { class: 'lead', text: `${t(result === 'promoted' ? 'promotedBody' : 'firedBody', L)} ${money(team)} / ${money(g.shift.quota)}` }),
      $('div', { class: 'tablewrap' }, table),
      $('p', { class: 'aiuse', text: ai }),
      $('div', { class: 'btnrow' }, $('button', { class: 'btn yellow', onclick: () => g.requestNextShift() }, t(result === 'promoted' ? 'nextShift' : 'tryAgain', L)))));
    this.end.hidden = false;
    g.input.exitLock();
  }

  hideEnd() { this.end.hidden = true; }

  showLinesDown() {
    const L = this.game.lang;
    clear(this.dead);
    this.dead.append($('div', { class: 'window', style: { width: 'min(460px, 100%)' } },
      $('div', { class: 'titlebar' }, $('span', { class: 'os', text: 'ScamOS' }), $('span', { class: 'line', text: t('linesDownShort', L) })),
      $('div', { class: 'menubody' },
        $('h2', { class: 'deadh', text: t('linesDownTitle', L) }),
        $('p', { text: t('linesDownBody', L) }),
        $('div', { class: 'btnrow left' },
          $('button', { class: 'btn yellow', onclick: () => { this.game.calls.continueWithBackup(); this.dead.hidden = true; } }, t('keepBackup', L)),
          $('button', { class: 'btn', onclick: () => { this.dead.hidden = true; this.game.closePC(() => { if (this.game.me && this.game.me.mode === 'seated') this.game.me.standUp(); }); } }, t('clockOut', L))))));
    this.dead.hidden = false;
    this.game.input.exitLock();
  }

  openMenu() {
    const g = this.game, L = g.lang;
    clear(this.menu);
    const u = usage.shift;
    this.menu.append($('div', { class: 'window' },
      $('div', { class: 'titlebar' }, $('span', { class: 'os', text: 'ScamOS' }), $('span', { class: 'line', text: t('paused', L) })),
      $('div', { class: 'menubody' },
        $('button', { class: 'btn yellow', onclick: () => this.closeMenu() }, t('resume', L)),
        $('button', { class: 'btn', onclick: () => { this.closeMenu(); this.ui.openSettings(); } }, t('settings', L)),
        $('button', { class: 'btn', onclick: () => { this.closeMenu(); this.ui.openSettings('controls'); } }, t('controlsHint', L)),
        $('p', { class: 'aiuse', text: g.calls.brainKind === 'backup' ? t('backupNote', L) : t('aiUsageLine', L, { req: u.requests, tok: Math.round(u.inTok + u.outTok).toLocaleString('en-US') }) }),
        $('button', { class: 'btn', onclick: () => location.reload() }, t('quit', L)))));
    this.menu.hidden = false;
    g.input.exitLock();
  }

  closeMenu() { this.menu.hidden = true; }
}
