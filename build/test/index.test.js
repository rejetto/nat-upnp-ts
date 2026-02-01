"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestOptions = exports.setupTest = void 0;
const queue = [];
let running = false;
function header(s) {
    console.log("\n==========", s, "==========");
}
function footer(n) {
    const arr = [];
    arr.length = n;
    console.log("\n===========" + arr.fill("=").join("") + "===========\n");
}
async function runNextInQueue(prev) {
    footer(prev.length);
    const [name, opts] = queue.shift() ?? [];
    if (!name || !opts)
        return;
    header(name);
    opts.startTests().then(() => runNextInQueue(name));
}
function setupTest(testName, callback) {
    const testOptions = new TestOptions();
    callback(testOptions);
    if (running) {
        queue.push([testName, testOptions]);
        return;
    }
    running = true;
    header(testName);
    testOptions.startTests().then(() => runNextInQueue(testName));
}
exports.setupTest = setupTest;
class TestOptions {
    constructor() {
        this.testCount = 5;
        this.tests = [];
        this.isRunning = false;
        this.runBeforeCallback = null;
        this.runAfterCallback = null;
    }
    runBefore(callback) {
        this.runBeforeCallback = callback;
    }
    runAfter(callback) {
        this.runAfterCallback = callback;
    }
    run(desc, callback) {
        this.tests.push([desc, callback]);
    }
    async startTests() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        const testCount = this.testCount;
        const tests = [...this.tests];
        const runBefore = this.runBeforeCallback ?? (() => null);
        const runAfter = this.runAfterCallback ?? (() => null);
        for (let x = 0; x < tests.length; x++) {
            const [testName, run] = tests[x];
            const results = [];
            const errors = [];
            console.log("\n" + testName);
            for (let y = 0; y < testCount; y++) {
                runBefore();
                results.push(await run()
                    .then((s) => {
                    if (s) {
                        console.log("Test #" + (y + 1) + ":", "\x1b[32msuccess\x1b[0m");
                    }
                    else {
                        console.log("Test #" + (y + 1) + ":", "\x1b[31mfailed\x1b[0m");
                    }
                    return s;
                })
                    .catch((err) => {
                    console.log("Test #" + (y + 1) + ":", "\x1b[31mfailed\x1b[0m");
                    errors.push(err);
                    return false;
                }));
                runAfter();
            }
            if (!results.some((el) => !el)) {
                // success
                console.log("Testcase: \x1b[32msuccess\x1b[0m");
            }
            else {
                // failed
                errors.forEach((err) => console.error(err));
                console.log("Testcase: \x1b[31mfailed with", errors.length, "errors\x1b[0m");
            }
        }
    }
    get isTestRunning() {
        return this.isRunning;
    }
}
exports.TestOptions = TestOptions;
require("./api.test");
require("./ssdp.test");
