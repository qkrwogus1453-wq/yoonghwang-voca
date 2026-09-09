#!/usr/bin/env node
/**
 * 윤황보카 앱 검증 스크립트
 *
 * 사용법:
 *   1) 앱 폴더에서 로컬 서버 실행:  python3 -m http.server 8000
 *   2) 다른 터미널에서:            node tools/verify.js [포트]
 *
 * 필요 패키지: npm install puppeteer-core
 * (크롬 경로는 아래 CHROME 상수에서 수정)
 */
const PORT = process.argv[2] || 8000;
const CHROME = process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const puppeteer = require('puppeteer-core');

(async () => {
  const results = [];
  const fail = [];
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'], protocolTimeout: 180000
  });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));

  console.log(`\n검증 시작 — http://localhost:${PORT}/\n`);
  await p.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await p.waitForFunction(() => typeof IDX !== 'undefined' && IDX && IDX.length > 0, { timeout: 20000 });

  // 1. 데이터 무결성
  const r0 = await p.evaluate(async () => {
    const all = await fetchAllItems();
    const bad = { 빈갈래: 0, s불일치: 0, 뜻없음: 0 };
    for (const w of all) {
      if (!w.m || !w.m.trim()) bad.뜻없음++;
      const ps = new Set();
      for (const pr of (w.p || [])) {
        if (!pr.d || !pr.d.trim()) bad.빈갈래++;
        (pr.s || []).forEach(s => ps.add(s));
      }
      const all_s = new Set(w.s || []);
      for (const s of ps) if (!all_s.has(s)) { bad.s불일치++; break; }
    }
    return { 총: all.length, ...bad };
  });
  results.push(['데이터 무결성', JSON.stringify(r0)]);
  if (r0.빈갈래 || r0.s불일치 || r0.뜻없음) fail.push('데이터 무결성');

  // 2. 따라쓰기 전수 (대상 생성 + 칩 개수)
  const r1 = await p.evaluate(async () => {
    const all = await fetchAllItems(); const bad = []; st.mode = 'copy';
    for (const w of all) {
      CQ = [w]; cqi = 0; cGot = [];
      try { drawCopy(); } catch (e) { bad.push(w.id + ':에러'); continue; }
      const el = document.querySelector('.focustxt');
      if (!el) { bad.push(w.id + ':요소없음'); continue; }
      let t = ''; el.childNodes.forEach(n => { if (n.nodeType === 3) t += n.textContent; });
      if (t.trim() !== w._call[0]) bad.push(w.id + ':불일치');
      const chips = document.querySelectorAll('#canswers .cans');
      if (chips.length && chips.length !== w._call.length) bad.push(w.id + ':칩개수');
      const seen = {};
      chips.forEach(c => { const k = (c.querySelector('.canstxt') || {}).textContent;
        if (k && seen[k]) bad.push(w.id + ':칩중복'); seen[k] = 1; });
    }
    return { 총: all.length, 실패: bad.length, 샘플: bad.slice(0, 5) };
  });
  results.push(['따라쓰기 전수', JSON.stringify(r1)]);
  if (r1.실패) fail.push('따라쓰기 전수');

  // 3. 동의어 매칭 키보드 흐름
  await p.evaluate(() => show('setup'));
  await p.click('button[data-m="syn"]'); await p.click('#go');
  await p.waitForFunction(() => document.getElementById('qscr').classList.contains('on'), { timeout: 20000 });
  await new Promise(r => setTimeout(r, 500));
  let ok = 0;
  for (let n = 0; n < 10; n++) {
    const info = await p.evaluate(() => ({
      qi, c: Q[qi].kind === 'syn' ? Q[qi].opts.map((o, i) => o.ok ? i : -1).filter(i => i >= 0) : [Q[qi].ans]
    }));
    for (const i of info.c) { await p.keyboard.press(String(i + 1)); await new Promise(r => setTimeout(r, 130)); }
    await p.keyboard.press('Enter'); await new Promise(r => setTimeout(r, 260));
    await p.keyboard.press('Enter'); await new Promise(r => setTimeout(r, 300));
    if (await p.evaluate(() => qi) > info.qi) ok++;
  }
  results.push(['퀴즈 키보드 진행', ok + '/10']);
  if (ok < 10) fail.push('퀴즈 키보드 진행');

  // 4. 주요 기능 존재 확인
  const r3 = await p.evaluate(() => ({
    약점목록: typeof weakList === 'function',
    동기화: typeof ghSync === 'function',
    메모: typeof memoSet === 'function',
    역방향: typeof buildRev === 'function',
    손글씨: typeof penPick === 'function',
    달력: typeof calDraw === 'function',
    다이어리: typeof diarySet === 'function',
    비슷한단어: typeof similarOf === 'function'
  }));
  results.push(['주요 기능', JSON.stringify(r3)]);
  if (Object.values(r3).some(v => !v)) fail.push('주요 기능');

  // 5. 선지 개수 규칙 (6~9개, 폰은 7개 이하)
  const r4 = await p.evaluate(async () => {
    const all = await fetchAllItems();
    POOL = { words: all.filter(x => x.type === 'word'), phrases: all.filter(x => x.type === 'phrase'), all: all.slice() };
    const cands = all.filter(x => x.s && x.s.length >= 3).slice(0, 200);
    const dist = {}; let over = 0;
    cands.forEach(w => {
      STATS[w.w] = { w: w.w, wrong: 0, right: 0 };
      const q = buildSyn(w); const n = q.opts.length;
      dist[n] = (dist[n] || 0) + 1;
      if (n < 6 || n > 9) over++;
    });
    return { 분포: dist, 규칙위반: over };
  });
  results.push(['선지 개수 규칙', JSON.stringify(r4)]);
  if (r4.규칙위반) fail.push('선지 개수 규칙');

  console.log('─'.repeat(60));
  results.forEach(([k, v]) => console.log(`  ${k}\n    ${v}\n`));
  console.log('  페이지 에러: ' + (errs.length ? errs.slice(0, 3).join(' | ') : '없음'));
  console.log('─'.repeat(60));
  if (fail.length || errs.length) {
    console.log(`\n❌ 실패: ${fail.concat(errs.length ? ['페이지 에러'] : []).join(', ')}\n`);
    process.exitCode = 1;
  } else {
    console.log('\n✅ 전체 통과\n');
  }
  await b.close();
})();
