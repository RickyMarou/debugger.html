/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

// Tests for stepping through Babel's compile output.
requestLongerTimeout(4);

async function breakpointSteps(dbg, fixture, { line, column }, steps) {
  const filename = `fixtures/${fixture}/input.js`;
  const fnName = fixture.replace(/-([a-z])/g, (s, c) => c.toUpperCase());

  await invokeWithBreakpoint(dbg, fnName, filename, { line, column }, async source => {
    await runSteps(dbg, source, steps);
  });

  ok(true, `Ran tests for ${fixture} at line ${line} column ${column}`);
}

async function runSteps(dbg, source, steps) {
  const { selectors: { getVisibleSelectedFrame }, getState } = dbg;

  for (const [i, [type, position]] of steps.entries()) {
    switch (type) {
      case "stepOver":
        await stepOver(dbg);
        break;
      case "stepIn":
        await stepIn(dbg);
        break;
      default:
        throw new Error("Unknown stepping type");
    }

    const { location } = getVisibleSelectedFrame(getState());

    is(location.sourceId, source.id, `Step ${i} has correct sourceId`);
    is(location.line, position.line, `Step ${i} has correct line`);
    is(location.column, position.column, `Step ${i} has correct column`);

    assertPausedLocation(dbg);
  }
}

function testStepOverForOf(dbg) {
  return breakpointSteps(dbg, "babel-step-over-for-of", { line: 4, column: 2 }, [
    ["stepOver", { line: 6, column: 2 }],
    ["stepOver", { line: 7, column: 4 }],
    ["stepOver", { line: 6, column: 2 }],
    ["stepOver", { line: 7, column: 4 }],
    ["stepOver", { line: 6, column: 2 }],
    ["stepOver", { line: 10, column: 2 }]
  ]);
}

// This codifies the current behavior, but stepping twice over the for
// header isn't ideal.
function testStepOverForOfArray(dbg) {
  return breakpointSteps(dbg, "babel-step-over-for-of-array", { line: 3, column: 2 }, [
    ["stepOver", { line: 5, column: 2 }],
    ["stepOver", { line: 5, column: 7 }],
    ["stepOver", { line: 6, column: 4 }],
    ["stepOver", { line: 5, column: 2 }],
    ["stepOver", { line: 5, column: 7 }],
    ["stepOver", { line: 6, column: 4 }],
    ["stepOver", { line: 5, column: 2 }],
    ["stepOver", { line: 9, column: 2 }]
  ]);
}

// The closure means it isn't actually possible to step into the for body,
// and Babel doesn't map the _loop() call, so we step past it automatically.
function testStepOveForOfClosure(dbg) {
  return breakpointSteps(
    dbg,
    "babel-step-over-for-of-closure",
    { line: 6, column: 2 },
    [
      ["stepOver", { line: 8, column: 2 }],
      ["stepOver", { line: 12, column: 2 }]
    ]
  );
}

// Same as the previous, not possible to step into the body. The less
// complicated array logic makes it possible to step into the header at least,
// but this does end up double-visiting the for head.
function testStepOverForOfArrayClosure(dbg) {
  return breakpointSteps(
    dbg,
    "babel-step-over-for-of-array-closure",
    { line: 3, column: 2 },
    [
      ["stepOver", { line: 5, column: 2 }],
      ["stepOver", { line: 5, column: 7 }],
      ["stepOver", { line: 5, column: 2 }],
      ["stepOver", { line: 5, column: 7 }],
      ["stepOver", { line: 5, column: 2 }],
      ["stepOver", { line: 9, column: 2 }]
    ]
  );
}

function testStepOverFunctionParams(dbg) {
  return breakpointSteps(
    dbg,
    "babel-step-over-function-params",
    { line: 6, column: 2 },
    [["stepOver", { line: 7, column: 2 }], ["stepIn", { line: 2, column: 2 }]]
  );
}

function testStepOverRegeneratorAwait(dbg) {
  return breakpointSteps(
    dbg,
    "babel-step-over-regenerator-await",
    { line: 2, column: 2 },
    [
      // Won't work until a fix to regenerator lands and we rebuild.
      // https://github.com/facebook/regenerator/issues/342
      // ["stepOver", { line: 4, column: 2 }],
    ]
  );
}

add_task(async function() {
  const dbg = await initDebugger("doc-sourcemapped.html");

  await testStepOverForOf(dbg);
  await testStepOverForOfArray(dbg);
  await testStepOveForOfClosure(dbg);
  await testStepOverForOfArrayClosure(dbg);
  await testStepOverFunctionParams(dbg);
  await testStepOverRegeneratorAwait(dbg);
});