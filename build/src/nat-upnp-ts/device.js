"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Device = void 0;
const node_http_1 = __importDefault(require("node:http"));
const node_https_1 = __importDefault(require("node:https"));
const consumers_1 = require("node:stream/consumers");
const url_1 = require("url");
const fast_xml_parser_1 = require("fast-xml-parser");
class Device {
    constructor(url) {
        this.description = url;
        this.services = [
            "urn:schemas-upnp-org:service:WANIPConnection:1",
            "urn:schemas-upnp-org:service:WANIPConnection:2",
            "urn:schemas-upnp-org:service:WANPPPConnection:1",
        ];
    }
    async getXML(url) {
        return httpRequest(url).then(consumers_1.text).then(data => new fast_xml_parser_1.XMLParser().parse(data));
    }
    async getService(types) {
        return this.getXML(this.description).then(({ root: xml }) => {
            const services = this.parseDescription(xml).services.filter(({ serviceType }) => types.includes(serviceType));
            if (services.length === 0 ||
                !services[0].controlURL ||
                !services[0].SCPDURL) {
                throw new Error("Service not found");
            }
            const baseUrl = new url_1.URL(xml.baseURL, this.description);
            const prefix = (url) => new url_1.URL(url, baseUrl.toString()).toString();
            return {
                service: services[0].serviceType,
                SCPDURL: prefix(services[0].SCPDURL),
                controlURL: prefix(services[0].controlURL),
            };
        });
    }
    async run(action, args) {
        const info = await this.getService(this.services);
        const body = `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
        <s:Body><u:${action} xmlns:u=${JSON.stringify(info.service)}>${args.reduce((p, [a, b]) => p + `<${a ?? ''}>${b ?? ''}</${a ?? ''}>`, '')}</u:${action}>
        </s:Body></s:Envelope>`;
        return httpRequest(info.controlURL, {
            method: 'post',
            headers: {
                "Content-Type": 'text/xml; charset="utf-8"',
                "Content-Length": "" + Buffer.byteLength(body),
                Connection: "close",
                SOAPAction: JSON.stringify(info.service + "#" + action),
            },
        }, body)
            .then(consumers_1.text, consumers_1.text).then(data => {
            const res = new fast_xml_parser_1.XMLParser({ removeNSPrefix: true }).parse(data).Envelope.Body;
            if (res.Fault)
                throw res.Fault.detail?.UPnPError || res.Fault;
            return res;
        });
    }
    parseDescription(info) {
        const services = [];
        const devices = [];
        function traverseDevices(device) {
            if (!device)
                return;
            const serviceList = device.serviceList?.service ?? [];
            const deviceList = device.deviceList?.device ?? [];
            devices.push(device);
            if (Array.isArray(serviceList)) {
                services.push(...serviceList);
            }
            else {
                services.push(serviceList);
            }
            if (Array.isArray(deviceList)) {
                deviceList.forEach(traverseDevices);
            }
            else {
                traverseDevices(deviceList);
            }
        }
        traverseDevices(info.device);
        return {
            services,
            devices,
        };
    }
}
exports.Device = Device;
exports.default = Device;
function httpRequest(url, options = {}, body = '') {
    return new Promise((resolve, reject) => (url.startsWith('https:') ? node_https_1.default : node_http_1.default).request(url, options, async (res) => !res.statusCode || res.statusCode >= 400 ? reject(res) : resolve(res)).on('error', reject).end(body));
}
