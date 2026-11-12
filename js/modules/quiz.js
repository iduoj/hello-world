/* Module: quiz — board-style MCQs and "name the culprit" from a generated 12-lead */
(function () {
  'use strict';
  const CL = window.CL;
  const h = CL.h;
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

  const mod = {
    init(root) {
      this.root = root;
      this.mode = 'mcq';
      this.topic = 'All';
      this.score = CL.store.get('quizScore', { right: 0, total: 0 });
      root.appendChild(CL.ui.head('Self-test', 'Quiz',
        'Board-style questions drawn from every section, plus "name the culprit" from a freshly generated 12-lead. Each answer comes with an explanation. For projections, use "Name that view" on the Angio Views tab.'));
      const topics = ['All'].concat(Array.from(new Set(CL.data.quiz.map((q) => q.topic))));
      this.modeSeg = CL.ui.segmented([{ label: 'Questions', value: 'mcq' }, { label: 'Name the culprit (ECG)', value: 'ecg' }], 'mcq', (v) => { this.mode = v; this.topicRow.hidden = v !== 'mcq'; this.next(); }, { label: 'Quiz mode' });
      this.topicRow = h('div', { class: 'row' }, h('span', { class: 'sub' }, 'Topic'), CL.ui.chips(topics.map((t) => ({ label: t, value: t })), 'All', (v) => { this.topic = v; this.deck = null; this.next(); }));
      this.board = h('div', { class: 'scoreboard', 'aria-live': 'polite' });
      this.card = h('div', { class: 'panel' });
      root.appendChild(h('div', { class: 'panel' },
        h('div', { class: 'row', style: { justifyContent: 'space-between' } }, this.modeSeg, h('div', { class: 'row' }, this.board, h('button', { type: 'button', class: 'btn', onclick: () => { this.score = { right: 0, total: 0 }; CL.store.set('quizScore', this.score); this.renderBoard(); } }, 'Reset score'))),
        this.topicRow));
      root.appendChild(this.card);
      this.renderBoard();
      this.next();
    },
    renderBoard() {
      const s = this.score;
      this.board.textContent = 'Score ' + s.right + ' / ' + s.total + (s.total ? '  (' + Math.round(s.right / s.total * 100) + '%)' : '');
    },
    record(ok) { this.score.total++; if (ok) this.score.right++; CL.store.set('quizScore', this.score); this.renderBoard(); },
    next() { if (this.mode === 'ecg') this.ecgQ(); else this.mcq(); },
    mcq() {
      const pool = CL.data.quiz.filter((q) => this.topic === 'All' || q.topic === this.topic);
      if (!this.deck || !this.deck.length) this.deck = shuffle(pool);
      const q = this.deck.pop();
      const order = shuffle(q.opts.map((o, i) => i));
      CL.clear(this.card);
      const opts = h('div', { class: 'q-opts' });
      const after = h('div', { class: 'stack' });
      order.forEach((oi, k) => {
        const b = h('button', { type: 'button', class: 'q-opt' }, h('span', { class: 'k' }, 'ABCD'[k]), q.opts[oi]);
        b.addEventListener('click', () => {
          if (opts.dataset.done) return;
          opts.dataset.done = '1';
          const ok = oi === q.a;
          this.record(ok);
          CL.$$('.q-opt', opts).forEach((x) => { x.disabled = true; });
          b.classList.add(ok ? 'right' : 'wrong');
          if (!ok) opts.children[order.indexOf(q.a)].classList.add('right');
          after.append(h('div', { class: 'callout ' + (ok ? 'ok' : 'warn') }, h('strong', null, ok ? 'Correct. ' : 'Not quite. '), q.ex),
            h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: () => this.next() }, 'Next question →')));
        });
        opts.appendChild(b);
      });
      this.card.append(h('div', { class: 'eyebrow' }, q.topic), h('h2', { style: { textTransform: 'none', letterSpacing: '0', fontFamily: 'var(--font-body)', fontWeight: '600', fontSize: 'var(--step-2)' } }, q.q), opts, after);
    },
    ecgQ() {
      const pool = CL.data.culprits.filter((c) => c.id !== 'normal');
      const sc = pool[Math.floor(Math.random() * pool.length)];
      const others = shuffle(pool.filter((c) => c.id !== sc.id)).slice(0, 3);
      const options = shuffle([sc].concat(others));
      CL.clear(this.card);
      const paper = h('div', { class: 'ecg-paper' }, CL.ECG.render(sc, { stage: 'acute', highlight: false, extra: sc.id === 'post' || sc.id === 'prca' }));
      const opts = h('div', { class: 'q-opts' });
      const after = h('div', { class: 'stack' });
      options.forEach((o, k) => {
        const b = h('button', { type: 'button', class: 'q-opt' }, h('span', { class: 'k' }, 'ABCD'[k]), o.name);
        b.addEventListener('click', () => {
          if (opts.dataset.done) return;
          opts.dataset.done = '1';
          const ok = o.id === sc.id;
          this.record(ok);
          CL.$$('.q-opt', opts).forEach((x) => { x.disabled = true; });
          b.classList.add(ok ? 'right' : 'wrong');
          if (!ok) opts.children[options.indexOf(sc)].classList.add('right');
          CL.clear(paper); paper.appendChild(CL.ECG.render(sc, { stage: 'acute', highlight: true, extra: sc.id === 'post' || sc.id === 'prca' }));
          after.append(h('div', { class: 'callout ' + (ok ? 'ok' : 'warn') }, h('strong', null, (ok ? 'Correct: ' : 'Answer: ') + sc.name + '. '), h('ul', null, sc.teach.slice(0, 3).map((t) => h('li', null, t)))),
            h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', onclick: () => this.next() }, 'Next tracing →'),
              h('button', { type: 'button', class: 'btn', onclick: () => { location.hash = 'territories'; setTimeout(() => CL.modules.territories.pick && CL.modules.territories.pick(sc.id), 50); } }, 'Open in ECG + Echo')));
        });
        opts.appendChild(b);
      });
      this.card.append(h('div', { class: 'eyebrow' }, 'Name the culprit'), h('h2', null, 'Which occlusion or pattern produced this ECG?'), paper, opts, after);
    },
  };
  CL.modules.quiz = mod;
})();
