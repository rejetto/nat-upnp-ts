"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
const index_test_1 = require("./index.test");
(0, index_test_1.setupTest)("NAT-UPNP/Ssdp", (opts) => {
    let client;
    opts.runBefore(() => {
        client = new src_1.Ssdp();
    });
    opts.runAfter(() => {
        client.close();
    });
    opts.run("Find router device", async () => {
        const p = client.search("urn:schemas-upnp-org:device:InternetGatewayDevice:1");
        return new Promise((s) => {
            p.on("device", (device) => {
                p.emit("end");
                s(typeof device.location === "string");
            });
        });
    });
});
