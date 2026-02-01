"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Client = void 0;
const device_1 = __importDefault(require("./device"));
const ssdp_1 = __importDefault(require("./ssdp"));
class Client {
    constructor(options = {}) {
        this.ssdp = new ssdp_1.default();
        this.timeout = options.timeout || 1800;
    }
    async createMapping(options) {
        return this.getGateway().then(({ gateway, address }) => {
            const ports = normalizeOptions(options);
            return gateway.run("AddPortMapping", [
                ["NewRemoteHost", ports.remote.host + ""],
                ["NewExternalPort", ports.remote.port + ""],
                [
                    "NewProtocol",
                    options.protocol ? options.protocol.toUpperCase() : "TCP",
                ],
                ["NewInternalPort", ports.internal.port + ""],
                ["NewInternalClient", ports.internal.host || address],
                ["NewEnabled", 1],
                ["NewPortMappingDescription", options.description || "node:nat:upnp"],
                ["NewLeaseDuration", options.ttl ?? 60 * 30],
            ]);
        });
    }
    async removeMapping(options) {
        return this.getGateway().then(({ gateway }) => {
            const ports = normalizeOptions(options);
            return gateway.run("DeletePortMapping", [
                ["NewRemoteHost", ports.remote.host + ""],
                ["NewExternalPort", ports.remote.port + ""],
                [
                    "NewProtocol",
                    options.protocol ? options.protocol.toUpperCase() : "TCP",
                ],
            ]);
        });
    }
    async getMappings(options = {}) {
        const { gateway, address } = await this.getGateway();
        let i = 0;
        const results = [];
        while (true) {
            const data = await gateway.run("GetGenericPortMappingEntry", [["NewPortMappingIndex", i++]])
                .catch(() => { });
            if (!data)
                break; // finished
            const key = Object.keys(data).find((k) => k.startsWith('GetGenericPortMappingEntryResponse'));
            if (!key) {
                throw new Error("Incorrect response");
            }
            const res = data[key];
            const result = {
                public: {
                    host: res.NewRemoteHost || "",
                    port: Number(res.NewExternalPort),
                },
                private: {
                    host: res.NewInternalClient,
                    port: Number(res.NewInternalPort),
                },
                protocol: res.NewProtocol.toLowerCase(),
                enabled: res.NewEnabled == 1,
                description: res.NewPortMappingDescription,
                ttl: Number(res.NewLeaseDuration),
                // temporary, so typescript will compile
                local: false,
            };
            result.local = result.private.host === address;
            if (options.local && !result.local) {
                continue;
            }
            if (options.description) {
                if (typeof result.description !== "string")
                    continue;
                if (options.description instanceof RegExp) {
                    if (!options.description.test(result.description))
                        continue;
                }
                else {
                    if (result.description.indexOf(options.description) === -1)
                        continue;
                }
            }
            results.push(result);
        }
        return results;
    }
    async getPublicIp() {
        return this.getGateway().then(async ({ gateway, address }) => {
            const data = await gateway.run("GetExternalIPAddress", []);
            const key = Object.keys(data || {}).find((k) => /^GetExternalIPAddressResponse$/.test(k));
            if (!key)
                throw new Error("Incorrect response");
            return data[key]?.NewExternalIPAddress + "";
        });
    }
    async getGateway() {
        let timeouted = false;
        const p = this.ssdp.search("urn:schemas-upnp-org:device:InternetGatewayDevice:1");
        return new Promise((s, r) => {
            const timeout = setTimeout(() => {
                timeouted = true;
                p.emit("end");
                r(new Error("Connection timed out while searching for the gateway."));
            }, this.timeout);
            p.on("device", (info, address) => {
                if (timeouted)
                    return;
                p.emit("end");
                clearTimeout(timeout);
                // Create gateway
                s({ gateway: new device_1.default(info.location), address });
            });
        });
    }
    close() {
        this.ssdp.close();
    }
}
exports.Client = Client;
function normalizeOptions(options) {
    function toObject(addr) {
        if (typeof addr === "number")
            return { port: addr };
        if (typeof addr === "string" && !isNaN(addr))
            return { port: Number(addr) };
        if (typeof addr === "object")
            return addr;
        return {};
    }
    return {
        remote: toObject(options.public),
        internal: toObject(options.private),
    };
}
exports.default = Client;
