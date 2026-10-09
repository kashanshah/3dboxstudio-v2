/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
globalThis.PointerEvent = class extends Event { constructor(type, init = {}) { super(type, init); const { pointerId, pointerType, clientX, clientY } = init; Object.assign(this, { pointerId, pointerType, clientX, clientY }); } };
const { attachTouchPinch } = require('../src/lib/touch-pinch.ts');

function setup(accepts = () => true) {
  const element = new EventTarget();
  const pinches = [], cancels = [];
  element.addEventListener('pointercancel', event => cancels.push(event.pointerId));
  const detach = attachTouchPinch(element, { accepts, onPinch: change => pinches.push(change) });
  const send = (type, pointerId, clientX, clientY, pointerType = 'touch') => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { pointerId, pointerType, clientX, clientY });
    element.dispatchEvent(event);
    return event;
  };
  return { element, pinches, cancels, send, detach };
}

test('one finger is left to the view', () => {
  const { send, pinches, cancels } = setup();
  assert.equal(send('pointerdown', 1, 100, 100).defaultPrevented, false);
  assert.equal(send('pointermove', 1, 140, 100).defaultPrevented, false);
  assert.equal(send('pointerup', 1, 140, 100).defaultPrevented, false);
  assert.deepEqual(pinches, []); assert.deepEqual(cancels, []);
});

test('two fingers zoom around their midpoint and pan as they move', () => {
  const { send, pinches, cancels } = setup();
  send('pointerdown', 1, 100, 100);
  assert.equal(send('pointerdown', 2, 200, 100).defaultPrevented, true, 'the second finger never reaches the view');
  assert.deepEqual(cancels, [1], 'the first finger\'s gesture is cancelled');
  // Spread the fingers to twice the distance, keeping the midpoint.
  assert.equal(send('pointermove', 2, 250, 100).defaultPrevented, true);
  send('pointermove', 1, 50, 100);
  const last = pinches.at(-1);
  const total = pinches.reduce((product, change) => product * change.scale, 1);
  assert.ok(Math.abs(total - 2) < 1e-9, `zoomed ${total}`);
  assert.equal(last.x, 150); assert.equal(last.y, 100);
  // Move both fingers down 30 px: a pan with no zoom.
  pinches.length = 0;
  send('pointermove', 1, 50, 130); send('pointermove', 2, 250, 130);
  const dy = pinches.reduce((sum, change) => sum + change.dy, 0);
  assert.equal(dy, 30);
  // Lifting one finger ends the pinch; the other stays out of the view until it lifts.
  assert.equal(send('pointerup', 2, 250, 130).defaultPrevented, true);
  pinches.length = 0;
  assert.equal(send('pointermove', 1, 80, 150).defaultPrevented, true);
  assert.deepEqual(pinches, []);
  assert.equal(send('pointerup', 1, 80, 150).defaultPrevented, true);
  // And the next single touch is the view's again.
  assert.equal(send('pointerdown', 3, 10, 10).defaultPrevented, false);
});

test('mouse and pen are untouched, and touches that start on controls are ignored', () => {
  const { send, pinches } = setup(() => false);
  send('pointerdown', 1, 0, 0); send('pointerdown', 2, 100, 0);
  send('pointermove', 2, 200, 0);
  assert.deepEqual(pinches, []);
  const mouse = setup();
  mouse.send('pointerdown', 1, 0, 0, 'mouse'); mouse.send('pointerdown', 2, 100, 0, 'pen');
  mouse.send('pointermove', 2, 200, 0, 'pen');
  assert.deepEqual(mouse.pinches, []);
});
