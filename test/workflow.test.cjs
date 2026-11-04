const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function app() {
  const html = readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
  const nodes = new Map();
  const context = vm.createContext({
    document: { getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, { value: '', innerHTML: '', textContent: '', addEventListener(){} });
      return nodes.get(id);
    } },
    alert() {}, localStorage: {getItem(){return null;},setItem(){}}, confirm(){return true;}
  });
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], context);
  return context;
}
function approveAll(a) {
  a.store[a.cur].items.forEach((it, i) => Object.keys(it.f).forEach(k => a.onAppr(i, k)));
}
test('RFQ is blocked until every field is approved, then invalidated on hold', () => {
  const a = app();
  a.document.getElementById('btnRfq').onclick();
  assert.equal(a.store[a.cur].rfqs.length, 0);
  approveAll(a);
  assert.equal(a.check().length, 0);
  a.document.getElementById('btnRfq').onclick();
  assert.equal(a.store[a.cur].rfqs[0].rows[0].q, '2 EA');
  a.onHold(0, 'qty');
  assert.equal(a.store[a.cur].rfqs[0].st, '이전 버전 · 사용 불가');
  a.document.getElementById('btnRfq').onclick();
  assert.equal(a.store[a.cur].rfqs.length, 1);
});
test('missing, unreadable and conflicting samples remain blocked', () => {
  const a = app();
  for (const key of ['B', 'C']) {
    a.cur = key;
    approveAll(a);
    assert.ok(a.check().length > 0);
    a.document.getElementById('btnRfq').onclick();
    assert.equal(a.store[a.cur].rfqs.length, 0);
  }
});
test('quantity accepts positive finite amounts and unit; calculator rejects infinity', () => {
  const a = app();
  assert.equal(a.parseQ('2.5 m').n, 2.5);
  assert.equal(a.parseQ('0 EA'), null);
  assert.equal(a.parseQ('3'), null);
  assert.equal(a.parseQ('9'.repeat(400) + ' EA'), null);
  a.document.getElementById('inT').value = 'Infinity';
  a.document.getElementById('outT').value = '0';
  a.document.getElementById('btnCost').onclick();
  assert.match(a.document.getElementById('cost').textContent, /오류/);
});
test('quote-only changes clear approval and preserve user override for reapproval', () => {
  const a = app(); a.cur = 'C';
  for (const [id,value] of Object.entries({ev:'SUS316',eb:'검토자',er:'재질 확인',ee:'추가 문서'})) a.document.getElementById(id).value=value;
  a.onSave(0,'material'); a.onAppr(0,'material');
  a.document.getElementById('btnRe').onclick();
  const f=a.store.C.items[0].f.material;
  assert.equal(f.appr,null); assert.equal(f.over.v,'SUS316'); assert.equal(f.curSt,'RESOLVED');
  a.onAppr(0,'material'); assert.equal(f.appr.v,'SUS316');
});
