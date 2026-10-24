import { env_get } from "spacetime:sys@2.2";
import * as _syscalls2_0 from "spacetime:sys@2.0";
import { moduleHooks } from "spacetime:sys@2.0";
import * as _syscalls2_1 from "spacetime:sys@2.1";

//#region ../node_modules/headers-polyfill/lib/index.mjs
var __create$1 = Object.create;
var __defProp$1 = Object.defineProperty;
var __getOwnPropDesc$1 = Object.getOwnPropertyDescriptor;
var __getOwnPropNames$1 = Object.getOwnPropertyNames;
var __getProtoOf$1 = Object.getPrototypeOf;
var __hasOwnProp$1 = Object.prototype.hasOwnProperty;
var __commonJS$1 = (cb, mod) => function __require() {
	return mod || (0, cb[__getOwnPropNames$1(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps$1 = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") {
		for (let key of __getOwnPropNames$1(from)) if (!__hasOwnProp$1.call(to, key) && key !== except) __defProp$1(to, key, {
			get: () => from[key],
			enumerable: !(desc = __getOwnPropDesc$1(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM$1 = (mod, isNodeMode, target) => (target = mod != null ? __create$1(__getProtoOf$1(mod)) : {}, __copyProps$1(isNodeMode || !mod || !mod.__esModule ? __defProp$1(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
var import_set_cookie_parser = __toESM$1(__commonJS$1({ "node_modules/set-cookie-parser/lib/set-cookie.js"(exports, module) {
	"use strict";
	var defaultParseOptions = {
		decodeValues: true,
		map: false,
		silent: false
	};
	function isNonEmptyString(str) {
		return typeof str === "string" && !!str.trim();
	}
	function parseString(setCookieValue, options) {
		var parts = setCookieValue.split(";").filter(isNonEmptyString);
		var parsed = parseNameValuePair(parts.shift());
		var name = parsed.name;
		var value = parsed.value;
		options = options ? Object.assign({}, defaultParseOptions, options) : defaultParseOptions;
		try {
			value = options.decodeValues ? decodeURIComponent(value) : value;
		} catch (e) {
			console.error("set-cookie-parser encountered an error while decoding a cookie with value '" + value + "'. Set options.decodeValues to false to disable this feature.", e);
		}
		var cookie = {
			name,
			value
		};
		parts.forEach(function(part) {
			var sides = part.split("=");
			var key = sides.shift().trimLeft().toLowerCase();
			var value2 = sides.join("=");
			if (key === "expires") cookie.expires = new Date(value2);
			else if (key === "max-age") cookie.maxAge = parseInt(value2, 10);
			else if (key === "secure") cookie.secure = true;
			else if (key === "httponly") cookie.httpOnly = true;
			else if (key === "samesite") cookie.sameSite = value2;
			else cookie[key] = value2;
		});
		return cookie;
	}
	function parseNameValuePair(nameValuePairStr) {
		var name = "";
		var value = "";
		var nameValueArr = nameValuePairStr.split("=");
		if (nameValueArr.length > 1) {
			name = nameValueArr.shift();
			value = nameValueArr.join("=");
		} else value = nameValuePairStr;
		return {
			name,
			value
		};
	}
	function parse(input, options) {
		options = options ? Object.assign({}, defaultParseOptions, options) : defaultParseOptions;
		if (!input) if (!options.map) return [];
		else return {};
		if (input.headers) if (typeof input.headers.getSetCookie === "function") input = input.headers.getSetCookie();
		else if (input.headers["set-cookie"]) input = input.headers["set-cookie"];
		else {
			var sch = input.headers[Object.keys(input.headers).find(function(key) {
				return key.toLowerCase() === "set-cookie";
			})];
			if (!sch && input.headers.cookie && !options.silent) console.warn("Warning: set-cookie-parser appears to have been called on a request object. It is designed to parse Set-Cookie headers from responses, not Cookie headers from requests. Set the option {silent: true} to suppress this warning.");
			input = sch;
		}
		if (!Array.isArray(input)) input = [input];
		options = options ? Object.assign({}, defaultParseOptions, options) : defaultParseOptions;
		if (!options.map) return input.filter(isNonEmptyString).map(function(str) {
			return parseString(str, options);
		});
		else return input.filter(isNonEmptyString).reduce(function(cookies2, str) {
			var cookie = parseString(str, options);
			cookies2[cookie.name] = cookie;
			return cookies2;
		}, {});
	}
	function splitCookiesString2(cookiesString) {
		if (Array.isArray(cookiesString)) return cookiesString;
		if (typeof cookiesString !== "string") return [];
		var cookiesStrings = [];
		var pos = 0;
		var start;
		var ch;
		var lastComma;
		var nextStart;
		var cookiesSeparatorFound;
		function skipWhitespace() {
			while (pos < cookiesString.length && /\s/.test(cookiesString.charAt(pos))) pos += 1;
			return pos < cookiesString.length;
		}
		function notSpecialChar() {
			ch = cookiesString.charAt(pos);
			return ch !== "=" && ch !== ";" && ch !== ",";
		}
		while (pos < cookiesString.length) {
			start = pos;
			cookiesSeparatorFound = false;
			while (skipWhitespace()) {
				ch = cookiesString.charAt(pos);
				if (ch === ",") {
					lastComma = pos;
					pos += 1;
					skipWhitespace();
					nextStart = pos;
					while (pos < cookiesString.length && notSpecialChar()) pos += 1;
					if (pos < cookiesString.length && cookiesString.charAt(pos) === "=") {
						cookiesSeparatorFound = true;
						pos = nextStart;
						cookiesStrings.push(cookiesString.substring(start, lastComma));
						start = pos;
					} else pos = lastComma + 1;
				} else pos += 1;
			}
			if (!cookiesSeparatorFound || pos >= cookiesString.length) cookiesStrings.push(cookiesString.substring(start, cookiesString.length));
		}
		return cookiesStrings;
	}
	module.exports = parse;
	module.exports.parse = parse;
	module.exports.parseString = parseString;
	module.exports.splitCookiesString = splitCookiesString2;
} })());
var HEADERS_INVALID_CHARACTERS = /[^a-z0-9\-#$%&'*+.^_`|~]/i;
function normalizeHeaderName(name) {
	if (HEADERS_INVALID_CHARACTERS.test(name) || name.trim() === "") throw new TypeError("Invalid character in header field name");
	return name.trim().toLowerCase();
}
var charCodesToRemove = [
	String.fromCharCode(10),
	String.fromCharCode(13),
	String.fromCharCode(9),
	String.fromCharCode(32)
];
var HEADER_VALUE_REMOVE_REGEXP = new RegExp(`(^[${charCodesToRemove.join("")}]|$[${charCodesToRemove.join("")}])`, "g");
function normalizeHeaderValue(value) {
	return value.replace(HEADER_VALUE_REMOVE_REGEXP, "");
}
function isValidHeaderName(value) {
	if (typeof value !== "string") return false;
	if (value.length === 0) return false;
	for (let i = 0; i < value.length; i++) {
		const character = value.charCodeAt(i);
		if (character > 127 || !isToken(character)) return false;
	}
	return true;
}
function isToken(value) {
	return ![
		127,
		32,
		"(",
		")",
		"<",
		">",
		"@",
		",",
		";",
		":",
		"\\",
		"\"",
		"/",
		"[",
		"]",
		"?",
		"=",
		"{",
		"}"
	].includes(value);
}
function isValidHeaderValue(value) {
	if (typeof value !== "string") return false;
	if (value.trim() !== value) return false;
	for (let i = 0; i < value.length; i++) {
		const character = value.charCodeAt(i);
		if (character === 0 || character === 10 || character === 13) return false;
	}
	return true;
}
var NORMALIZED_HEADERS = Symbol("normalizedHeaders");
var RAW_HEADER_NAMES = Symbol("rawHeaderNames");
var HEADER_VALUE_DELIMITER = ", ";
var _a, _b, _c;
var Headers = class _Headers {
	constructor(init) {
		this[_a] = {};
		this[_b] = /* @__PURE__ */ new Map();
		this[_c] = "Headers";
		if (["Headers", "HeadersPolyfill"].includes(init?.constructor.name) || init instanceof _Headers || typeof globalThis.Headers !== "undefined" && init instanceof globalThis.Headers) init.forEach((value, name) => {
			this.append(name, value);
		}, this);
		else if (Array.isArray(init)) init.forEach(([name, value]) => {
			this.append(name, Array.isArray(value) ? value.join(HEADER_VALUE_DELIMITER) : value);
		});
		else if (init) Object.getOwnPropertyNames(init).forEach((name) => {
			const value = init[name];
			this.append(name, Array.isArray(value) ? value.join(HEADER_VALUE_DELIMITER) : value);
		});
	}
	[(_a = NORMALIZED_HEADERS, _b = RAW_HEADER_NAMES, _c = Symbol.toStringTag, Symbol.iterator)]() {
		return this.entries();
	}
	*keys() {
		for (const [name] of this.entries()) yield name;
	}
	*values() {
		for (const [, value] of this.entries()) yield value;
	}
	*entries() {
		let sortedKeys = Object.keys(this[NORMALIZED_HEADERS]).sort((a, b) => a.localeCompare(b));
		for (const name of sortedKeys) if (name === "set-cookie") for (const value of this.getSetCookie()) yield [name, value];
		else yield [name, this.get(name)];
	}
	/**
	* Returns a boolean stating whether a `Headers` object contains a certain header.
	*/
	has(name) {
		if (!isValidHeaderName(name)) throw new TypeError(`Invalid header name "${name}"`);
		return this[NORMALIZED_HEADERS].hasOwnProperty(normalizeHeaderName(name));
	}
	/**
	* Returns a `ByteString` sequence of all the values of a header with a given name.
	*/
	get(name) {
		if (!isValidHeaderName(name)) throw TypeError(`Invalid header name "${name}"`);
		return this[NORMALIZED_HEADERS][normalizeHeaderName(name)] ?? null;
	}
	/**
	* Sets a new value for an existing header inside a `Headers` object, or adds the header if it does not already exist.
	*/
	set(name, value) {
		if (!isValidHeaderName(name) || !isValidHeaderValue(value)) return;
		const normalizedName = normalizeHeaderName(name);
		const normalizedValue = normalizeHeaderValue(value);
		this[NORMALIZED_HEADERS][normalizedName] = normalizeHeaderValue(normalizedValue);
		this[RAW_HEADER_NAMES].set(normalizedName, name);
	}
	/**
	* Appends a new value onto an existing header inside a `Headers` object, or adds the header if it does not already exist.
	*/
	append(name, value) {
		if (!isValidHeaderName(name) || !isValidHeaderValue(value)) return;
		const normalizedName = normalizeHeaderName(name);
		const normalizedValue = normalizeHeaderValue(value);
		let resolvedValue = this.has(normalizedName) ? `${this.get(normalizedName)}, ${normalizedValue}` : normalizedValue;
		this.set(name, resolvedValue);
	}
	/**
	* Deletes a header from the `Headers` object.
	*/
	delete(name) {
		if (!isValidHeaderName(name)) return;
		if (!this.has(name)) return;
		const normalizedName = normalizeHeaderName(name);
		delete this[NORMALIZED_HEADERS][normalizedName];
		this[RAW_HEADER_NAMES].delete(normalizedName);
	}
	/**
	* Traverses the `Headers` object,
	* calling the given callback for each header.
	*/
	forEach(callback, thisArg) {
		for (const [name, value] of this.entries()) callback.call(thisArg, value, name, this);
	}
	/**
	* Returns an array containing the values
	* of all Set-Cookie headers associated
	* with a response
	*/
	getSetCookie() {
		const setCookieHeader = this.get("set-cookie");
		if (setCookieHeader === null) return [];
		if (setCookieHeader === "") return [""];
		return (0, import_set_cookie_parser.splitCookiesString)(setCookieHeader);
	}
};

//#endregion
//#region ../node_modules/spacetimedb/dist/server/index.mjs
typeof globalThis !== "undefined" && (globalThis.global = globalThis.global || globalThis, globalThis.window = globalThis.window || globalThis);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
	return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
	return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
};
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") {
		for (let key of __getOwnPropNames(from)) if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: () => from[key],
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(__defProp(target, "default", {
	value: mod,
	enumerable: true
}), mod));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var require_base64_js = __commonJS({ "../../node_modules/.pnpm/base64-js@1.5.1/node_modules/base64-js/index.js"(exports) {
	exports.byteLength = byteLength;
	exports.toByteArray = toByteArray;
	exports.fromByteArray = fromByteArray2;
	var lookup = [];
	var revLookup = [];
	var Arr = typeof Uint8Array !== "undefined" ? Uint8Array : Array;
	var code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	for (i = 0, len = code.length; i < len; ++i) {
		lookup[i] = code[i];
		revLookup[code.charCodeAt(i)] = i;
	}
	var i;
	var len;
	revLookup["-".charCodeAt(0)] = 62;
	revLookup["_".charCodeAt(0)] = 63;
	function getLens(b64) {
		var len2 = b64.length;
		if (len2 % 4 > 0) throw new Error("Invalid string. Length must be a multiple of 4");
		var validLen = b64.indexOf("=");
		if (validLen === -1) validLen = len2;
		var placeHoldersLen = validLen === len2 ? 0 : 4 - validLen % 4;
		return [validLen, placeHoldersLen];
	}
	function byteLength(b64) {
		var lens = getLens(b64);
		var validLen = lens[0];
		var placeHoldersLen = lens[1];
		return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
	}
	function _byteLength(b64, validLen, placeHoldersLen) {
		return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
	}
	function toByteArray(b64) {
		var tmp;
		var lens = getLens(b64);
		var validLen = lens[0];
		var placeHoldersLen = lens[1];
		var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen));
		var curByte = 0;
		var len2 = placeHoldersLen > 0 ? validLen - 4 : validLen;
		var i2;
		for (i2 = 0; i2 < len2; i2 += 4) {
			tmp = revLookup[b64.charCodeAt(i2)] << 18 | revLookup[b64.charCodeAt(i2 + 1)] << 12 | revLookup[b64.charCodeAt(i2 + 2)] << 6 | revLookup[b64.charCodeAt(i2 + 3)];
			arr[curByte++] = tmp >> 16 & 255;
			arr[curByte++] = tmp >> 8 & 255;
			arr[curByte++] = tmp & 255;
		}
		if (placeHoldersLen === 2) {
			tmp = revLookup[b64.charCodeAt(i2)] << 2 | revLookup[b64.charCodeAt(i2 + 1)] >> 4;
			arr[curByte++] = tmp & 255;
		}
		if (placeHoldersLen === 1) {
			tmp = revLookup[b64.charCodeAt(i2)] << 10 | revLookup[b64.charCodeAt(i2 + 1)] << 4 | revLookup[b64.charCodeAt(i2 + 2)] >> 2;
			arr[curByte++] = tmp >> 8 & 255;
			arr[curByte++] = tmp & 255;
		}
		return arr;
	}
	function tripletToBase64(num) {
		return lookup[num >> 18 & 63] + lookup[num >> 12 & 63] + lookup[num >> 6 & 63] + lookup[num & 63];
	}
	function encodeChunk(uint8, start, end) {
		var tmp;
		var output = [];
		for (var i2 = start; i2 < end; i2 += 3) {
			tmp = (uint8[i2] << 16 & 16711680) + (uint8[i2 + 1] << 8 & 65280) + (uint8[i2 + 2] & 255);
			output.push(tripletToBase64(tmp));
		}
		return output.join("");
	}
	function fromByteArray2(uint8) {
		var tmp;
		var len2 = uint8.length;
		var extraBytes = len2 % 3;
		var parts = [];
		var maxChunkLength = 16383;
		for (var i2 = 0, len22 = len2 - extraBytes; i2 < len22; i2 += maxChunkLength) parts.push(encodeChunk(uint8, i2, i2 + maxChunkLength > len22 ? len22 : i2 + maxChunkLength));
		if (extraBytes === 1) {
			tmp = uint8[len2 - 1];
			parts.push(lookup[tmp >> 2] + lookup[tmp << 4 & 63] + "==");
		} else if (extraBytes === 2) {
			tmp = (uint8[len2 - 2] << 8) + uint8[len2 - 1];
			parts.push(lookup[tmp >> 10] + lookup[tmp >> 4 & 63] + lookup[tmp << 2 & 63] + "=");
		}
		return parts.join("");
	}
} });
var require_codes = __commonJS({ "../../node_modules/.pnpm/statuses@2.0.2/node_modules/statuses/codes.json"(exports, module) {
	module.exports = {
		"100": "Continue",
		"101": "Switching Protocols",
		"102": "Processing",
		"103": "Early Hints",
		"200": "OK",
		"201": "Created",
		"202": "Accepted",
		"203": "Non-Authoritative Information",
		"204": "No Content",
		"205": "Reset Content",
		"206": "Partial Content",
		"207": "Multi-Status",
		"208": "Already Reported",
		"226": "IM Used",
		"300": "Multiple Choices",
		"301": "Moved Permanently",
		"302": "Found",
		"303": "See Other",
		"304": "Not Modified",
		"305": "Use Proxy",
		"307": "Temporary Redirect",
		"308": "Permanent Redirect",
		"400": "Bad Request",
		"401": "Unauthorized",
		"402": "Payment Required",
		"403": "Forbidden",
		"404": "Not Found",
		"405": "Method Not Allowed",
		"406": "Not Acceptable",
		"407": "Proxy Authentication Required",
		"408": "Request Timeout",
		"409": "Conflict",
		"410": "Gone",
		"411": "Length Required",
		"412": "Precondition Failed",
		"413": "Payload Too Large",
		"414": "URI Too Long",
		"415": "Unsupported Media Type",
		"416": "Range Not Satisfiable",
		"417": "Expectation Failed",
		"418": "I'm a Teapot",
		"421": "Misdirected Request",
		"422": "Unprocessable Entity",
		"423": "Locked",
		"424": "Failed Dependency",
		"425": "Too Early",
		"426": "Upgrade Required",
		"428": "Precondition Required",
		"429": "Too Many Requests",
		"431": "Request Header Fields Too Large",
		"451": "Unavailable For Legal Reasons",
		"500": "Internal Server Error",
		"501": "Not Implemented",
		"502": "Bad Gateway",
		"503": "Service Unavailable",
		"504": "Gateway Timeout",
		"505": "HTTP Version Not Supported",
		"506": "Variant Also Negotiates",
		"507": "Insufficient Storage",
		"508": "Loop Detected",
		"509": "Bandwidth Limit Exceeded",
		"510": "Not Extended",
		"511": "Network Authentication Required"
	};
} });
var require_statuses = __commonJS({ "../../node_modules/.pnpm/statuses@2.0.2/node_modules/statuses/index.js"(exports, module) {
	var codes = require_codes();
	module.exports = status2;
	status2.message = codes;
	status2.code = createMessageToStatusCodeMap(codes);
	status2.codes = createStatusCodeList(codes);
	status2.redirect = {
		300: true,
		301: true,
		302: true,
		303: true,
		305: true,
		307: true,
		308: true
	};
	status2.empty = {
		204: true,
		205: true,
		304: true
	};
	status2.retry = {
		502: true,
		503: true,
		504: true
	};
	function createMessageToStatusCodeMap(codes2) {
		var map = {};
		Object.keys(codes2).forEach(function forEachCode(code) {
			var message = codes2[code];
			var status3 = Number(code);
			map[message.toLowerCase()] = status3;
		});
		return map;
	}
	function createStatusCodeList(codes2) {
		return Object.keys(codes2).map(function mapCode(code) {
			return Number(code);
		});
	}
	function getStatusCode(message) {
		var msg = message.toLowerCase();
		if (!Object.prototype.hasOwnProperty.call(status2.code, msg)) throw new Error("invalid status message: \"" + message + "\"");
		return status2.code[msg];
	}
	function getStatusMessage(code) {
		if (!Object.prototype.hasOwnProperty.call(status2.message, code)) throw new Error("invalid status code: " + code);
		return status2.message[code];
	}
	function status2(code) {
		if (typeof code === "number") return getStatusMessage(code);
		if (typeof code !== "string") throw new TypeError("code must be a number or string");
		var n = parseInt(code, 10);
		if (!isNaN(n)) return getStatusMessage(n);
		return getStatusCode(code);
	}
} });
var util_stub_exports = {};
__export(util_stub_exports, { inspect: () => inspect });
var inspect;
var init_util_stub = __esm({ "src/util-stub.ts"() {
	inspect = {};
} });
var require_util_inspect = __commonJS({ "../../node_modules/.pnpm/object-inspect@1.13.4/node_modules/object-inspect/util.inspect.js"(exports, module) {
	module.exports = (init_util_stub(), __toCommonJS(util_stub_exports)).inspect;
} });
var require_object_inspect = __commonJS({ "../../node_modules/.pnpm/object-inspect@1.13.4/node_modules/object-inspect/index.js"(exports, module) {
	var hasMap = typeof Map === "function" && Map.prototype;
	var mapSizeDescriptor = Object.getOwnPropertyDescriptor && hasMap ? Object.getOwnPropertyDescriptor(Map.prototype, "size") : null;
	var mapSize = hasMap && mapSizeDescriptor && typeof mapSizeDescriptor.get === "function" ? mapSizeDescriptor.get : null;
	var mapForEach = hasMap && Map.prototype.forEach;
	var hasSet = typeof Set === "function" && Set.prototype;
	var setSizeDescriptor = Object.getOwnPropertyDescriptor && hasSet ? Object.getOwnPropertyDescriptor(Set.prototype, "size") : null;
	var setSize = hasSet && setSizeDescriptor && typeof setSizeDescriptor.get === "function" ? setSizeDescriptor.get : null;
	var setForEach = hasSet && Set.prototype.forEach;
	var weakMapHas = typeof WeakMap === "function" && WeakMap.prototype ? WeakMap.prototype.has : null;
	var weakSetHas = typeof WeakSet === "function" && WeakSet.prototype ? WeakSet.prototype.has : null;
	var weakRefDeref = typeof WeakRef === "function" && WeakRef.prototype ? WeakRef.prototype.deref : null;
	var booleanValueOf = Boolean.prototype.valueOf;
	var objectToString = Object.prototype.toString;
	var functionToString = Function.prototype.toString;
	var $match = String.prototype.match;
	var $slice = String.prototype.slice;
	var $replace = String.prototype.replace;
	var $toUpperCase = String.prototype.toUpperCase;
	var $toLowerCase = String.prototype.toLowerCase;
	var $test = RegExp.prototype.test;
	var $concat = Array.prototype.concat;
	var $join = Array.prototype.join;
	var $arrSlice = Array.prototype.slice;
	var $floor = Math.floor;
	var bigIntValueOf = typeof BigInt === "function" ? BigInt.prototype.valueOf : null;
	var gOPS = Object.getOwnPropertySymbols;
	var symToString = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? Symbol.prototype.toString : null;
	var hasShammedSymbols = typeof Symbol === "function" && typeof Symbol.iterator === "object";
	var toStringTag = typeof Symbol === "function" && Symbol.toStringTag && (typeof Symbol.toStringTag === hasShammedSymbols ? "object" : "symbol") ? Symbol.toStringTag : null;
	var isEnumerable = Object.prototype.propertyIsEnumerable;
	var gPO = (typeof Reflect === "function" ? Reflect.getPrototypeOf : Object.getPrototypeOf) || ([].__proto__ === Array.prototype ? function(O) {
		return O.__proto__;
	} : null);
	function addNumericSeparator(num, str) {
		if (num === Infinity || num === -Infinity || num !== num || num && num > -1e3 && num < 1e3 || $test.call(/e/, str)) return str;
		var sepRegex = /[0-9](?=(?:[0-9]{3})+(?![0-9]))/g;
		if (typeof num === "number") {
			var int = num < 0 ? -$floor(-num) : $floor(num);
			if (int !== num) {
				var intStr = String(int);
				var dec = $slice.call(str, intStr.length + 1);
				return $replace.call(intStr, sepRegex, "$&_") + "." + $replace.call($replace.call(dec, /([0-9]{3})/g, "$&_"), /_$/, "");
			}
		}
		return $replace.call(str, sepRegex, "$&_");
	}
	var utilInspect = require_util_inspect();
	var inspectCustom = utilInspect.custom;
	var inspectSymbol = isSymbol(inspectCustom) ? inspectCustom : null;
	var quotes = {
		__proto__: null,
		"double": "\"",
		single: "'"
	};
	var quoteREs = {
		__proto__: null,
		"double": /(["\\])/g,
		single: /(['\\])/g
	};
	module.exports = function inspect_(obj, options, depth, seen) {
		var opts = options || {};
		if (has(opts, "quoteStyle") && !has(quotes, opts.quoteStyle)) throw new TypeError("option \"quoteStyle\" must be \"single\" or \"double\"");
		if (has(opts, "maxStringLength") && (typeof opts.maxStringLength === "number" ? opts.maxStringLength < 0 && opts.maxStringLength !== Infinity : opts.maxStringLength !== null)) throw new TypeError("option \"maxStringLength\", if provided, must be a positive integer, Infinity, or `null`");
		var customInspect = has(opts, "customInspect") ? opts.customInspect : true;
		if (typeof customInspect !== "boolean" && customInspect !== "symbol") throw new TypeError("option \"customInspect\", if provided, must be `true`, `false`, or `'symbol'`");
		if (has(opts, "indent") && opts.indent !== null && opts.indent !== "	" && !(parseInt(opts.indent, 10) === opts.indent && opts.indent > 0)) throw new TypeError("option \"indent\" must be \"\\t\", an integer > 0, or `null`");
		if (has(opts, "numericSeparator") && typeof opts.numericSeparator !== "boolean") throw new TypeError("option \"numericSeparator\", if provided, must be `true` or `false`");
		var numericSeparator = opts.numericSeparator;
		if (typeof obj === "undefined") return "undefined";
		if (obj === null) return "null";
		if (typeof obj === "boolean") return obj ? "true" : "false";
		if (typeof obj === "string") return inspectString(obj, opts);
		if (typeof obj === "number") {
			if (obj === 0) return Infinity / obj > 0 ? "0" : "-0";
			var str = String(obj);
			return numericSeparator ? addNumericSeparator(obj, str) : str;
		}
		if (typeof obj === "bigint") {
			var bigIntStr = String(obj) + "n";
			return numericSeparator ? addNumericSeparator(obj, bigIntStr) : bigIntStr;
		}
		var maxDepth = typeof opts.depth === "undefined" ? 5 : opts.depth;
		if (typeof depth === "undefined") depth = 0;
		if (depth >= maxDepth && maxDepth > 0 && typeof obj === "object") return isArray(obj) ? "[Array]" : "[Object]";
		var indent = getIndent(opts, depth);
		if (typeof seen === "undefined") seen = [];
		else if (indexOf(seen, obj) >= 0) return "[Circular]";
		function inspect3(value, from, noIndent) {
			if (from) {
				seen = $arrSlice.call(seen);
				seen.push(from);
			}
			if (noIndent) {
				var newOpts = { depth: opts.depth };
				if (has(opts, "quoteStyle")) newOpts.quoteStyle = opts.quoteStyle;
				return inspect_(value, newOpts, depth + 1, seen);
			}
			return inspect_(value, opts, depth + 1, seen);
		}
		if (typeof obj === "function" && !isRegExp(obj)) {
			var name = nameOf(obj);
			var keys = arrObjKeys(obj, inspect3);
			return "[Function" + (name ? ": " + name : " (anonymous)") + "]" + (keys.length > 0 ? " { " + $join.call(keys, ", ") + " }" : "");
		}
		if (isSymbol(obj)) {
			var symString = hasShammedSymbols ? $replace.call(String(obj), /^(Symbol\(.*\))_[^)]*$/, "$1") : symToString.call(obj);
			return typeof obj === "object" && !hasShammedSymbols ? markBoxed(symString) : symString;
		}
		if (isElement(obj)) {
			var s = "<" + $toLowerCase.call(String(obj.nodeName));
			var attrs = obj.attributes || [];
			for (var i = 0; i < attrs.length; i++) s += " " + attrs[i].name + "=" + wrapQuotes(quote(attrs[i].value), "double", opts);
			s += ">";
			if (obj.childNodes && obj.childNodes.length) s += "...";
			s += "</" + $toLowerCase.call(String(obj.nodeName)) + ">";
			return s;
		}
		if (isArray(obj)) {
			if (obj.length === 0) return "[]";
			var xs = arrObjKeys(obj, inspect3);
			if (indent && !singleLineValues(xs)) return "[" + indentedJoin(xs, indent) + "]";
			return "[ " + $join.call(xs, ", ") + " ]";
		}
		if (isError(obj)) {
			var parts = arrObjKeys(obj, inspect3);
			if (!("cause" in Error.prototype) && "cause" in obj && !isEnumerable.call(obj, "cause")) return "{ [" + String(obj) + "] " + $join.call($concat.call("[cause]: " + inspect3(obj.cause), parts), ", ") + " }";
			if (parts.length === 0) return "[" + String(obj) + "]";
			return "{ [" + String(obj) + "] " + $join.call(parts, ", ") + " }";
		}
		if (typeof obj === "object" && customInspect) {
			if (inspectSymbol && typeof obj[inspectSymbol] === "function" && utilInspect) return utilInspect(obj, { depth: maxDepth - depth });
			else if (customInspect !== "symbol" && typeof obj.inspect === "function") return obj.inspect();
		}
		if (isMap(obj)) {
			var mapParts = [];
			if (mapForEach) mapForEach.call(obj, function(value, key) {
				mapParts.push(inspect3(key, obj, true) + " => " + inspect3(value, obj));
			});
			return collectionOf("Map", mapSize.call(obj), mapParts, indent);
		}
		if (isSet(obj)) {
			var setParts = [];
			if (setForEach) setForEach.call(obj, function(value) {
				setParts.push(inspect3(value, obj));
			});
			return collectionOf("Set", setSize.call(obj), setParts, indent);
		}
		if (isWeakMap(obj)) return weakCollectionOf("WeakMap");
		if (isWeakSet(obj)) return weakCollectionOf("WeakSet");
		if (isWeakRef(obj)) return weakCollectionOf("WeakRef");
		if (isNumber(obj)) return markBoxed(inspect3(Number(obj)));
		if (isBigInt(obj)) return markBoxed(inspect3(bigIntValueOf.call(obj)));
		if (isBoolean(obj)) return markBoxed(booleanValueOf.call(obj));
		if (isString(obj)) return markBoxed(inspect3(String(obj)));
		if (typeof window !== "undefined" && obj === window) return "{ [object Window] }";
		if (typeof globalThis !== "undefined" && obj === globalThis || typeof global !== "undefined" && obj === global) return "{ [object globalThis] }";
		if (!isDate(obj) && !isRegExp(obj)) {
			var ys = arrObjKeys(obj, inspect3);
			var isPlainObject = gPO ? gPO(obj) === Object.prototype : obj instanceof Object || obj.constructor === Object;
			var protoTag = obj instanceof Object ? "" : "null prototype";
			var stringTag = !isPlainObject && toStringTag && Object(obj) === obj && toStringTag in obj ? $slice.call(toStr(obj), 8, -1) : protoTag ? "Object" : "";
			var tag = (isPlainObject || typeof obj.constructor !== "function" ? "" : obj.constructor.name ? obj.constructor.name + " " : "") + (stringTag || protoTag ? "[" + $join.call($concat.call([], stringTag || [], protoTag || []), ": ") + "] " : "");
			if (ys.length === 0) return tag + "{}";
			if (indent) return tag + "{" + indentedJoin(ys, indent) + "}";
			return tag + "{ " + $join.call(ys, ", ") + " }";
		}
		return String(obj);
	};
	function wrapQuotes(s, defaultStyle, opts) {
		var quoteChar = quotes[opts.quoteStyle || defaultStyle];
		return quoteChar + s + quoteChar;
	}
	function quote(s) {
		return $replace.call(String(s), /"/g, "&quot;");
	}
	function canTrustToString(obj) {
		return !toStringTag || !(typeof obj === "object" && (toStringTag in obj || typeof obj[toStringTag] !== "undefined"));
	}
	function isArray(obj) {
		return toStr(obj) === "[object Array]" && canTrustToString(obj);
	}
	function isDate(obj) {
		return toStr(obj) === "[object Date]" && canTrustToString(obj);
	}
	function isRegExp(obj) {
		return toStr(obj) === "[object RegExp]" && canTrustToString(obj);
	}
	function isError(obj) {
		return toStr(obj) === "[object Error]" && canTrustToString(obj);
	}
	function isString(obj) {
		return toStr(obj) === "[object String]" && canTrustToString(obj);
	}
	function isNumber(obj) {
		return toStr(obj) === "[object Number]" && canTrustToString(obj);
	}
	function isBoolean(obj) {
		return toStr(obj) === "[object Boolean]" && canTrustToString(obj);
	}
	function isSymbol(obj) {
		if (hasShammedSymbols) return obj && typeof obj === "object" && obj instanceof Symbol;
		if (typeof obj === "symbol") return true;
		if (!obj || typeof obj !== "object" || !symToString) return false;
		try {
			symToString.call(obj);
			return true;
		} catch (e) {}
		return false;
	}
	function isBigInt(obj) {
		if (!obj || typeof obj !== "object" || !bigIntValueOf) return false;
		try {
			bigIntValueOf.call(obj);
			return true;
		} catch (e) {}
		return false;
	}
	var hasOwn2 = Object.prototype.hasOwnProperty || function(key) {
		return key in this;
	};
	function has(obj, key) {
		return hasOwn2.call(obj, key);
	}
	function toStr(obj) {
		return objectToString.call(obj);
	}
	function nameOf(f) {
		if (f.name) return f.name;
		var m = $match.call(functionToString.call(f), /^function\s*([\w$]+)/);
		if (m) return m[1];
		return null;
	}
	function indexOf(xs, x) {
		if (xs.indexOf) return xs.indexOf(x);
		for (var i = 0, l = xs.length; i < l; i++) if (xs[i] === x) return i;
		return -1;
	}
	function isMap(x) {
		if (!mapSize || !x || typeof x !== "object") return false;
		try {
			mapSize.call(x);
			try {
				setSize.call(x);
			} catch (s) {
				return true;
			}
			return x instanceof Map;
		} catch (e) {}
		return false;
	}
	function isWeakMap(x) {
		if (!weakMapHas || !x || typeof x !== "object") return false;
		try {
			weakMapHas.call(x, weakMapHas);
			try {
				weakSetHas.call(x, weakSetHas);
			} catch (s) {
				return true;
			}
			return x instanceof WeakMap;
		} catch (e) {}
		return false;
	}
	function isWeakRef(x) {
		if (!weakRefDeref || !x || typeof x !== "object") return false;
		try {
			weakRefDeref.call(x);
			return true;
		} catch (e) {}
		return false;
	}
	function isSet(x) {
		if (!setSize || !x || typeof x !== "object") return false;
		try {
			setSize.call(x);
			try {
				mapSize.call(x);
			} catch (m) {
				return true;
			}
			return x instanceof Set;
		} catch (e) {}
		return false;
	}
	function isWeakSet(x) {
		if (!weakSetHas || !x || typeof x !== "object") return false;
		try {
			weakSetHas.call(x, weakSetHas);
			try {
				weakMapHas.call(x, weakMapHas);
			} catch (s) {
				return true;
			}
			return x instanceof WeakSet;
		} catch (e) {}
		return false;
	}
	function isElement(x) {
		if (!x || typeof x !== "object") return false;
		if (typeof HTMLElement !== "undefined" && x instanceof HTMLElement) return true;
		return typeof x.nodeName === "string" && typeof x.getAttribute === "function";
	}
	function inspectString(str, opts) {
		if (str.length > opts.maxStringLength) {
			var remaining = str.length - opts.maxStringLength;
			var trailer = "... " + remaining + " more character" + (remaining > 1 ? "s" : "");
			return inspectString($slice.call(str, 0, opts.maxStringLength), opts) + trailer;
		}
		var quoteRE = quoteREs[opts.quoteStyle || "single"];
		quoteRE.lastIndex = 0;
		return wrapQuotes($replace.call($replace.call(str, quoteRE, "\\$1"), /[\x00-\x1f]/g, lowbyte), "single", opts);
	}
	function lowbyte(c) {
		var n = c.charCodeAt(0);
		var x = {
			8: "b",
			9: "t",
			10: "n",
			12: "f",
			13: "r"
		}[n];
		if (x) return "\\" + x;
		return "\\x" + (n < 16 ? "0" : "") + $toUpperCase.call(n.toString(16));
	}
	function markBoxed(str) {
		return "Object(" + str + ")";
	}
	function weakCollectionOf(type) {
		return type + " { ? }";
	}
	function collectionOf(type, size, entries, indent) {
		var joinedEntries = indent ? indentedJoin(entries, indent) : $join.call(entries, ", ");
		return type + " (" + size + ") {" + joinedEntries + "}";
	}
	function singleLineValues(xs) {
		for (var i = 0; i < xs.length; i++) if (indexOf(xs[i], "\n") >= 0) return false;
		return true;
	}
	function getIndent(opts, depth) {
		var baseIndent;
		if (opts.indent === "	") baseIndent = "	";
		else if (typeof opts.indent === "number" && opts.indent > 0) baseIndent = $join.call(Array(opts.indent + 1), " ");
		else return null;
		return {
			base: baseIndent,
			prev: $join.call(Array(depth + 1), baseIndent)
		};
	}
	function indentedJoin(xs, indent) {
		if (xs.length === 0) return "";
		var lineJoiner = "\n" + indent.prev + indent.base;
		return lineJoiner + $join.call(xs, "," + lineJoiner) + "\n" + indent.prev;
	}
	function arrObjKeys(obj, inspect3) {
		var isArr = isArray(obj);
		var xs = [];
		if (isArr) {
			xs.length = obj.length;
			for (var i = 0; i < obj.length; i++) xs[i] = has(obj, i) ? inspect3(obj[i], obj) : "";
		}
		var syms = typeof gOPS === "function" ? gOPS(obj) : [];
		var symMap;
		if (hasShammedSymbols) {
			symMap = {};
			for (var k = 0; k < syms.length; k++) symMap["$" + syms[k]] = syms[k];
		}
		for (var key in obj) {
			if (!has(obj, key)) continue;
			if (isArr && String(Number(key)) === key && key < obj.length) continue;
			if (hasShammedSymbols && symMap["$" + key] instanceof Symbol) continue;
			else if ($test.call(/[^\w$]/, key)) xs.push(inspect3(key, obj) + ": " + inspect3(obj[key], obj));
			else xs.push(key + ": " + inspect3(obj[key], obj));
		}
		if (typeof gOPS === "function") {
			for (var j = 0; j < syms.length; j++) if (isEnumerable.call(obj, syms[j])) xs.push("[" + inspect3(syms[j]) + "]: " + inspect3(obj[syms[j]], obj));
		}
		return xs;
	}
} });
var textDecoder = new TextDecoder("utf-8");
var BinaryReader = class {
	/**
	* The DataView used to read values from the binary data.
	*
	* Note: The DataView's `byteOffset` is relative to the beginning of the
	* underlying ArrayBuffer, not the start of the provided Uint8Array input.
	* This `BinaryReader`'s `#offset` field is used to track the current read position
	* relative to the start of the provided Uint8Array input.
	*/
	view;
	/**
	* Represents the offset (in bytes) relative to the start of the DataView
	* and provided Uint8Array input.
	*
	* Note: This is *not* the absolute byte offset within the underlying ArrayBuffer.
	*/
	offset = 0;
	constructor(input) {
		this.view = input instanceof DataView ? input : new DataView(input.buffer, input.byteOffset, input.byteLength);
		this.offset = 0;
	}
	reset(input) {
		this.view = input instanceof DataView ? input : new DataView(input.buffer, input.byteOffset, input.byteLength);
		this.offset = 0;
	}
	get remaining() {
		return this.view.byteLength - this.offset;
	}
	/** Ensure we have at least `n` bytes left to read */
	#ensure(n) {
		if (this.offset + n > this.view.byteLength) throw new RangeError(`Tried to read ${n} byte(s) at relative offset ${this.offset}, but only ${this.remaining} byte(s) remain`);
	}
	readUInt8Array() {
		const length = this.readU32();
		this.#ensure(length);
		return this.readBytes(length).slice();
	}
	readBool() {
		const value = this.view.getUint8(this.offset);
		this.offset += 1;
		return value !== 0;
	}
	readByte() {
		const value = this.view.getUint8(this.offset);
		this.offset += 1;
		return value;
	}
	readBytes(length) {
		const array = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, length);
		this.offset += length;
		return array;
	}
	readI8() {
		const value = this.view.getInt8(this.offset);
		this.offset += 1;
		return value;
	}
	readU8() {
		return this.readByte();
	}
	readI16() {
		const value = this.view.getInt16(this.offset, true);
		this.offset += 2;
		return value;
	}
	readU16() {
		const value = this.view.getUint16(this.offset, true);
		this.offset += 2;
		return value;
	}
	readI32() {
		const value = this.view.getInt32(this.offset, true);
		this.offset += 4;
		return value;
	}
	readU32() {
		const value = this.view.getUint32(this.offset, true);
		this.offset += 4;
		return value;
	}
	readI64() {
		const value = this.view.getBigInt64(this.offset, true);
		this.offset += 8;
		return value;
	}
	readU64() {
		const value = this.view.getBigUint64(this.offset, true);
		this.offset += 8;
		return value;
	}
	readU128() {
		const lowerPart = this.view.getBigUint64(this.offset, true);
		const upperPart = this.view.getBigUint64(this.offset + 8, true);
		this.offset += 16;
		return (upperPart << BigInt(64)) + lowerPart;
	}
	readI128() {
		const lowerPart = this.view.getBigUint64(this.offset, true);
		const upperPart = this.view.getBigInt64(this.offset + 8, true);
		this.offset += 16;
		return (upperPart << BigInt(64)) + lowerPart;
	}
	readU256() {
		const p0 = this.view.getBigUint64(this.offset, true);
		const p1 = this.view.getBigUint64(this.offset + 8, true);
		const p2 = this.view.getBigUint64(this.offset + 16, true);
		const p3 = this.view.getBigUint64(this.offset + 24, true);
		this.offset += 32;
		return (p3 << BigInt(192)) + (p2 << BigInt(128)) + (p1 << BigInt(64)) + p0;
	}
	readI256() {
		const p0 = this.view.getBigUint64(this.offset, true);
		const p1 = this.view.getBigUint64(this.offset + 8, true);
		const p2 = this.view.getBigUint64(this.offset + 16, true);
		const p3 = this.view.getBigInt64(this.offset + 24, true);
		this.offset += 32;
		return (p3 << BigInt(192)) + (p2 << BigInt(128)) + (p1 << BigInt(64)) + p0;
	}
	readF32() {
		const value = this.view.getFloat32(this.offset, true);
		this.offset += 4;
		return value;
	}
	readF64() {
		const value = this.view.getFloat64(this.offset, true);
		this.offset += 8;
		return value;
	}
	readString() {
		const length = this.readU32();
		this.#ensure(length);
		const bytes = this.readBytes(length);
		return textDecoder.decode(bytes);
	}
};
var import_base64_js = __toESM(require_base64_js());
var textEncoder = new TextEncoder();
var ArrayBufferPrototypeTransfer = ArrayBuffer.prototype.transfer ?? function(newByteLength) {
	if (newByteLength === void 0) return this.slice();
	else if (newByteLength <= this.byteLength) return this.slice(0, newByteLength);
	else {
		const copy = new Uint8Array(newByteLength);
		copy.set(new Uint8Array(this));
		return copy.buffer;
	}
};
var ResizableBuffer = class {
	buffer;
	view;
	constructor(init) {
		this.buffer = typeof init === "number" ? new ArrayBuffer(init) : init;
		this.view = new DataView(this.buffer);
	}
	get capacity() {
		return this.buffer.byteLength;
	}
	grow(newSize) {
		if (newSize <= this.buffer.byteLength) return;
		this.buffer = ArrayBufferPrototypeTransfer.call(this.buffer, newSize);
		this.view = new DataView(this.buffer);
	}
};
var BinaryWriter = class {
	buffer;
	offset = 0;
	constructor(init) {
		this.buffer = typeof init === "number" ? new ResizableBuffer(init) : init;
	}
	clear() {
		this.offset = 0;
	}
	reset(buffer) {
		this.buffer = buffer;
		this.offset = 0;
	}
	expandBuffer(additionalCapacity) {
		const minCapacity = this.offset + additionalCapacity + 1;
		if (minCapacity <= this.buffer.capacity) return;
		let newCapacity = this.buffer.capacity * 2;
		if (newCapacity < minCapacity) newCapacity = minCapacity;
		this.buffer.grow(newCapacity);
	}
	toBase64() {
		return (0, import_base64_js.fromByteArray)(this.getBuffer());
	}
	getBuffer() {
		return new Uint8Array(this.buffer.buffer, 0, this.offset);
	}
	get view() {
		return this.buffer.view;
	}
	writeUInt8Array(value) {
		const length = value.length;
		this.expandBuffer(4 + length);
		this.writeU32(length);
		new Uint8Array(this.buffer.buffer, this.offset).set(value);
		this.offset += length;
	}
	writeBool(value) {
		this.expandBuffer(1);
		this.view.setUint8(this.offset, value ? 1 : 0);
		this.offset += 1;
	}
	writeByte(value) {
		this.expandBuffer(1);
		this.view.setUint8(this.offset, value);
		this.offset += 1;
	}
	writeBytes(value) {
		this.expandBuffer(value.length);
		new Uint8Array(this.buffer.buffer, this.offset, value.length).set(value);
		this.offset += value.length;
	}
	writeI8(value) {
		this.expandBuffer(1);
		this.view.setInt8(this.offset, value);
		this.offset += 1;
	}
	writeU8(value) {
		this.expandBuffer(1);
		this.view.setUint8(this.offset, value);
		this.offset += 1;
	}
	writeI16(value) {
		this.expandBuffer(2);
		this.view.setInt16(this.offset, value, true);
		this.offset += 2;
	}
	writeU16(value) {
		this.expandBuffer(2);
		this.view.setUint16(this.offset, value, true);
		this.offset += 2;
	}
	writeI32(value) {
		this.expandBuffer(4);
		this.view.setInt32(this.offset, value, true);
		this.offset += 4;
	}
	writeU32(value) {
		this.expandBuffer(4);
		this.view.setUint32(this.offset, value, true);
		this.offset += 4;
	}
	writeI64(value) {
		this.expandBuffer(8);
		this.view.setBigInt64(this.offset, value, true);
		this.offset += 8;
	}
	writeU64(value) {
		this.expandBuffer(8);
		this.view.setBigUint64(this.offset, value, true);
		this.offset += 8;
	}
	writeU128(value) {
		this.expandBuffer(16);
		const lowerPart = value & BigInt("0xFFFFFFFFFFFFFFFF");
		const upperPart = value >> BigInt(64);
		this.view.setBigUint64(this.offset, lowerPart, true);
		this.view.setBigUint64(this.offset + 8, upperPart, true);
		this.offset += 16;
	}
	writeI128(value) {
		this.expandBuffer(16);
		const lowerPart = value & BigInt("0xFFFFFFFFFFFFFFFF");
		const upperPart = value >> BigInt(64);
		this.view.setBigInt64(this.offset, lowerPart, true);
		this.view.setBigInt64(this.offset + 8, upperPart, true);
		this.offset += 16;
	}
	writeU256(value) {
		this.expandBuffer(32);
		const low_64_mask = BigInt("0xFFFFFFFFFFFFFFFF");
		const p0 = value & low_64_mask;
		const p1 = value >> BigInt(64) & low_64_mask;
		const p2 = value >> BigInt(128) & low_64_mask;
		const p3 = value >> BigInt(192);
		this.view.setBigUint64(this.offset + 0, p0, true);
		this.view.setBigUint64(this.offset + 8, p1, true);
		this.view.setBigUint64(this.offset + 16, p2, true);
		this.view.setBigUint64(this.offset + 24, p3, true);
		this.offset += 32;
	}
	writeI256(value) {
		this.expandBuffer(32);
		const low_64_mask = BigInt("0xFFFFFFFFFFFFFFFF");
		const p0 = value & low_64_mask;
		const p1 = value >> BigInt(64) & low_64_mask;
		const p2 = value >> BigInt(128) & low_64_mask;
		const p3 = value >> BigInt(192);
		this.view.setBigUint64(this.offset + 0, p0, true);
		this.view.setBigUint64(this.offset + 8, p1, true);
		this.view.setBigUint64(this.offset + 16, p2, true);
		this.view.setBigInt64(this.offset + 24, p3, true);
		this.offset += 32;
	}
	writeF32(value) {
		this.expandBuffer(4);
		this.view.setFloat32(this.offset, value, true);
		this.offset += 4;
	}
	writeF64(value) {
		this.expandBuffer(8);
		this.view.setFloat64(this.offset, value, true);
		this.offset += 8;
	}
	writeString(value) {
		const len = value.length;
		this.expandBuffer(4 + len);
		const bytes = new Uint8Array(this.buffer.buffer);
		let offset = this.offset + 4;
		let i = 0;
		for (; i < len; i++) {
			const c = value.charCodeAt(i);
			if (c >= 128) break;
			bytes[offset++] = c;
		}
		if (i === len) {
			this.view.setUint32(this.offset, len, true);
			this.offset = offset;
			return;
		}
		this.writeUInt8Array(textEncoder.encode(value));
	}
};
function uint8ArrayToHexString(array) {
	return Array.prototype.map.call(array.reverse(), (x) => ("00" + x.toString(16)).slice(-2)).join("");
}
function uint8ArrayToU128(array) {
	if (array.length != 16) throw new Error(`Uint8Array is not 16 bytes long: ${array}`);
	return new BinaryReader(array).readU128();
}
function uint8ArrayToU256(array) {
	if (array.length != 32) throw new Error(`Uint8Array is not 32 bytes long: [${array}]`);
	return new BinaryReader(array).readU256();
}
function hexStringToUint8Array(str) {
	if (str.startsWith("0x")) str = str.slice(2);
	const matches = str.match(/.{1,2}/g) || [];
	return Uint8Array.from(matches.map((byte) => parseInt(byte, 16))).reverse();
}
function hexStringToU128(str) {
	return uint8ArrayToU128(hexStringToUint8Array(str));
}
function hexStringToU256(str) {
	return uint8ArrayToU256(hexStringToUint8Array(str));
}
function u128ToUint8Array(data) {
	const writer = new BinaryWriter(16);
	writer.writeU128(data);
	return writer.getBuffer();
}
function u128ToHexString(data) {
	return uint8ArrayToHexString(u128ToUint8Array(data));
}
function u256ToUint8Array(data) {
	const writer = new BinaryWriter(32);
	writer.writeU256(data);
	return writer.getBuffer();
}
function u256ToHexString(data) {
	return uint8ArrayToHexString(u256ToUint8Array(data));
}
function coerceToBigInt(value, what) {
	if (typeof value === "bigint") return value;
	if (typeof value === "number") return BigInt(value);
	if (typeof value === "string" && value.trim() !== "") return BigInt(value);
	throw new TypeError(`Cannot convert ${typeof value} to ${what}: expected bigint, integer number, or decimal string`);
}
function toPascalCase(s) {
	const str = toCamelCase(s);
	return str.charAt(0).toUpperCase() + str.slice(1);
}
function toCamelCase(s) {
	const str = s.replace(/[-_]+/g, "_").replace(/_([a-zA-Z0-9])/g, (_, c) => c.toUpperCase());
	return str.charAt(0).toLowerCase() + str.slice(1);
}
function bsatnBaseSize(typespace, ty) {
	const assumedArrayLength = 4;
	while (ty.tag === "Ref") ty = typespace.types[ty.value];
	if (ty.tag === "Product") {
		let sum = 0;
		for (const { algebraicType: elem } of ty.value.elements) sum += bsatnBaseSize(typespace, elem);
		return sum;
	} else if (ty.tag === "Sum") {
		let min = Infinity;
		for (const { algebraicType: vari } of ty.value.variants) {
			const vSize = bsatnBaseSize(typespace, vari);
			if (vSize < min) min = vSize;
		}
		if (min === Infinity) min = 0;
		return 4 + min;
	} else if (ty.tag == "Array") return 4 + assumedArrayLength * bsatnBaseSize(typespace, ty.value);
	return {
		String: 4 + assumedArrayLength,
		Sum: 1,
		Bool: 1,
		I8: 1,
		U8: 1,
		I16: 2,
		U16: 2,
		I32: 4,
		U32: 4,
		F32: 4,
		I64: 8,
		U64: 8,
		F64: 8,
		I128: 16,
		U128: 16,
		I256: 32,
		U256: 32
	}[ty.tag];
}
var hasOwn = Object.hasOwn;
var TimeDuration = class _TimeDuration {
	__time_duration_micros__;
	static MICROS_PER_MILLIS = 1000n;
	/**
	* Get the algebraic type representation of the {@link TimeDuration} type.
	* @returns The algebraic type representation of the type.
	*/
	static getAlgebraicType() {
		return AlgebraicType.Product({ elements: [{
			name: "__time_duration_micros__",
			algebraicType: AlgebraicType.I64
		}] });
	}
	static isTimeDuration(algebraicType) {
		if (algebraicType.tag !== "Product") return false;
		const elements = algebraicType.value.elements;
		if (elements.length !== 1) return false;
		const microsElement = elements[0];
		return microsElement.name === "__time_duration_micros__" && microsElement.algebraicType.tag === "I64";
	}
	get micros() {
		return this.__time_duration_micros__;
	}
	get millis() {
		return Number(this.micros / _TimeDuration.MICROS_PER_MILLIS);
	}
	constructor(micros) {
		this.__time_duration_micros__ = coerceToBigInt(micros, "TimeDuration");
	}
	static fromMillis(millis) {
		return new _TimeDuration(BigInt(millis) * _TimeDuration.MICROS_PER_MILLIS);
	}
	/** This outputs the same string format that we use in the host and in Rust modules */
	toString() {
		const micros = this.micros;
		const sign = micros < 0 ? "-" : "+";
		const pos = micros < 0 ? -micros : micros;
		const secs = pos / 1000000n;
		const micros_remaining = pos % 1000000n;
		return `${sign}${secs}.${String(micros_remaining).padStart(6, "0")}`;
	}
};
var Timestamp = class _Timestamp {
	__timestamp_micros_since_unix_epoch__;
	static MICROS_PER_MILLIS = 1000n;
	get microsSinceUnixEpoch() {
		return this.__timestamp_micros_since_unix_epoch__;
	}
	constructor(micros) {
		this.__timestamp_micros_since_unix_epoch__ = coerceToBigInt(micros, "Timestamp");
	}
	/**
	* Get the algebraic type representation of the {@link Timestamp} type.
	* @returns The algebraic type representation of the type.
	*/
	static getAlgebraicType() {
		return AlgebraicType.Product({ elements: [{
			name: "__timestamp_micros_since_unix_epoch__",
			algebraicType: AlgebraicType.I64
		}] });
	}
	static isTimestamp(algebraicType) {
		if (algebraicType.tag !== "Product") return false;
		const elements = algebraicType.value.elements;
		if (elements.length !== 1) return false;
		const microsElement = elements[0];
		return microsElement.name === "__timestamp_micros_since_unix_epoch__" && microsElement.algebraicType.tag === "I64";
	}
	/**
	* The Unix epoch, the midnight at the beginning of January 1, 1970, UTC.
	*/
	static UNIX_EPOCH = new _Timestamp(0n);
	/**
	* Get a `Timestamp` representing the execution environment's belief of the current moment in time.
	*/
	static now() {
		return _Timestamp.fromDate(/* @__PURE__ */ new Date());
	}
	/** Convert to milliseconds since Unix epoch. */
	toMillis() {
		return this.microsSinceUnixEpoch / 1000n;
	}
	/**
	* Get a `Timestamp` representing the same point in time as `date`.
	*/
	static fromDate(date) {
		const millis = date.getTime();
		return new _Timestamp(BigInt(millis) * _Timestamp.MICROS_PER_MILLIS);
	}
	/**
	* Get a `Date` representing approximately the same point in time as `this`.
	*
	* This method truncates to millisecond precision,
	* and throws `RangeError` if the `Timestamp` is outside the range representable as a `Date`.
	*/
	toDate() {
		const millis = this.__timestamp_micros_since_unix_epoch__ / _Timestamp.MICROS_PER_MILLIS;
		if (millis > BigInt(Number.MAX_SAFE_INTEGER) || millis < BigInt(Number.MIN_SAFE_INTEGER)) throw new RangeError("Timestamp is outside of the representable range of JS's Date");
		return new Date(Number(millis));
	}
	/**
	* Get an ISO 8601 / RFC 3339 formatted string representation of this timestamp with microsecond precision.
	*
	* This method preserves the full microsecond precision of the timestamp,
	* and throws `RangeError` if the `Timestamp` is outside the range representable in ISO format.
	*
	* @returns ISO 8601 formatted string with microsecond precision (e.g., '2025-02-17T10:30:45.123456Z')
	*/
	toISOString() {
		const micros = this.__timestamp_micros_since_unix_epoch__;
		const millis = micros / _Timestamp.MICROS_PER_MILLIS;
		if (millis > BigInt(Number.MAX_SAFE_INTEGER) || millis < BigInt(Number.MIN_SAFE_INTEGER)) throw new RangeError("Timestamp is outside of the representable range for ISO string formatting");
		const isoBase = new Date(Number(millis)).toISOString();
		const microsRemainder = Math.abs(Number(micros % 1000000n));
		const fractionalPart = String(microsRemainder).padStart(6, "0");
		return isoBase.replace(/\.\d{3}Z$/, `.${fractionalPart}Z`);
	}
	since(other) {
		return new TimeDuration(this.__timestamp_micros_since_unix_epoch__ - other.__timestamp_micros_since_unix_epoch__);
	}
};
var Uuid = class _Uuid {
	__uuid__;
	/**
	* The nil UUID (all zeros).
	*
	* @example
	* ```ts
	* const uuid = Uuid.NIL;
	* console.assert(
	*   uuid.toString() === "00000000-0000-0000-0000-000000000000"
	* );
	* ```
	*/
	static NIL = new _Uuid(0n);
	static MAX_UUID_BIGINT = 340282366920938463463374607431768211455n;
	/**
	* The max UUID (all ones).
	*
	* @example
	* ```ts
	* const uuid = Uuid.MAX;
	* console.assert(
	*   uuid.toString() === "ffffffff-ffff-ffff-ffff-ffffffffffff"
	* );
	* ```
	*/
	static MAX = new _Uuid(_Uuid.MAX_UUID_BIGINT);
	/**
	* Create a UUID from a raw 128-bit value.
	*
	* @param u - Unsigned 128-bit integer
	* @throws {Error} If the value is outside the valid UUID range
	*/
	constructor(u) {
		const v = coerceToBigInt(u, "Uuid");
		if (v < 0n || v > _Uuid.MAX_UUID_BIGINT) throw new Error("Invalid UUID: must be between 0 and `MAX_UUID_BIGINT`");
		this.__uuid__ = v;
	}
	/**
	* Create a UUID `v4` from explicit random bytes.
	*
	* This method assumes the bytes are already sufficiently random.
	* It only sets the appropriate bits for the UUID version and variant.
	*
	* @param bytes - Exactly 16 random bytes
	* @returns A UUID `v4`
	* @throws {Error} If `bytes.length !== 16`
	*
	* @example
	* ```ts
	* const randomBytes = new Uint8Array(16);
	* const uuid = Uuid.fromRandomBytesV4(randomBytes);
	*
	* console.assert(
	*   uuid.toString() === "00000000-0000-4000-8000-000000000000"
	* );
	* ```
	*/
	static fromRandomBytesV4(bytes) {
		if (bytes.length !== 16) throw new Error("UUID v4 requires 16 bytes");
		const arr = new Uint8Array(bytes);
		arr[6] = arr[6] & 15 | 64;
		arr[8] = arr[8] & 63 | 128;
		return new _Uuid(_Uuid.bytesToBigInt(arr));
	}
	/**
	* Generate a UUID `v7` using a monotonic counter from `0` to `2^31 - 1`,
	* a timestamp, and 4 random bytes.
	*
	* The counter wraps around on overflow.
	*
	* The UUID `v7` is structured as follows:
	*
	* ```ascii
	* ┌───────────────────────────────────────────────┬───────────────────┐
	* | B0  | B1  | B2  | B3  | B4  | B5              |         B6        |
	* ├───────────────────────────────────────────────┼───────────────────┤
	* |                 unix_ts_ms                    |      version 7    |
	* └───────────────────────────────────────────────┴───────────────────┘
	* ┌──────────────┬─────────┬──────────────────┬───────────────────────┐
	* | B7           | B8      | B9  | B10 | B11  | B12 | B13 | B14 | B15 |
	* ├──────────────┼─────────┼──────────────────┼───────────────────────┤
	* | counter_high | variant |    counter_low   |        random         |
	* └──────────────┴─────────┴──────────────────┴───────────────────────┘
	* ```
	*
	* @param counter - Mutable monotonic counter (31-bit)
	* @param now - Timestamp since the Unix epoch
	* @param randomBytes - Exactly 4 random bytes
	* @returns A UUID `v7`
	*
	* @throws {Error} If the `counter` is negative
	* @throws {Error} If the `timestamp` is before the Unix epoch
	* @throws {Error} If `randomBytes.length !== 4`
	*
	* @example
	* ```ts
	* const now = Timestamp.fromMillis(1_686_000_000_000n);
	* const counter = { value: 1 };
	* const randomBytes = new Uint8Array(4);
	*
	* const uuid = Uuid.fromCounterV7(counter, now, randomBytes);
	*
	* console.assert(
	*   uuid.toString() === "0000647e-5180-7000-8000-000200000000"
	* );
	* ```
	*/
	static fromCounterV7(counter, now, randomBytes) {
		if (randomBytes.length !== 4) throw new Error("`fromCounterV7` requires `randomBytes.length == 4`");
		if (counter.value < 0) throw new Error("`fromCounterV7` uuid `counter` must be non-negative");
		if (now.__timestamp_micros_since_unix_epoch__ < 0) throw new Error("`fromCounterV7` `timestamp` before unix epoch");
		const counterVal = counter.value;
		counter.value = counterVal + 1 & 2147483647;
		const tsMs = now.toMillis() & 281474976710655n;
		const bytes = new Uint8Array(16);
		bytes[0] = Number(tsMs >> 40n & 255n);
		bytes[1] = Number(tsMs >> 32n & 255n);
		bytes[2] = Number(tsMs >> 24n & 255n);
		bytes[3] = Number(tsMs >> 16n & 255n);
		bytes[4] = Number(tsMs >> 8n & 255n);
		bytes[5] = Number(tsMs & 255n);
		bytes[7] = counterVal >>> 23 & 255;
		bytes[9] = counterVal >>> 15 & 255;
		bytes[10] = counterVal >>> 7 & 255;
		bytes[11] = (counterVal & 127) << 1 & 255;
		bytes[12] |= randomBytes[0] & 127;
		bytes[13] = randomBytes[1];
		bytes[14] = randomBytes[2];
		bytes[15] = randomBytes[3];
		bytes[6] = bytes[6] & 15 | 112;
		bytes[8] = bytes[8] & 63 | 128;
		return new _Uuid(_Uuid.bytesToBigInt(bytes));
	}
	/**
	* Parse a UUID from a string representation.
	*
	* @param s - UUID string
	* @returns Parsed UUID
	* @throws {Error} If the string is not a valid UUID
	*
	* @example
	* ```ts
	* const s = "01888d6e-5c00-7000-8000-000000000000";
	* const uuid = Uuid.parse(s);
	*
	* console.assert(uuid.toString() === s);
	* ```
	*/
	static parse(s) {
		const hex = s.replace(/-/g, "");
		if (hex.length !== 32) throw new Error("Invalid hex UUID");
		let v = 0n;
		for (let i = 0; i < 32; i += 2) v = v << 8n | BigInt(parseInt(hex.slice(i, i + 2), 16));
		return new _Uuid(v);
	}
	/** Convert to hex string without a 0x prefix. */
	toHexString() {
		return u128ToHexString(this.asBigInt());
	}
	/** Convert to string (hyphenated form). */
	toString() {
		const hex = this.toHexString();
		return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
	}
	/** Convert to bigint (u128). */
	asBigInt() {
		return this.__uuid__;
	}
	/** Return a `Uint8Array` of 16 bytes. */
	toBytes() {
		return _Uuid.bigIntToBytes(this.__uuid__);
	}
	static bytesToBigInt(bytes) {
		let result = 0n;
		for (const b of bytes) result = result << 8n | BigInt(b);
		return result;
	}
	static bigIntToBytes(value) {
		const bytes = new Uint8Array(16);
		for (let i = 15; i >= 0; i--) {
			bytes[i] = Number(value & 255n);
			value >>= 8n;
		}
		return bytes;
	}
	/**
	* Returns the version of this UUID.
	*
	* This represents the algorithm used to generate the value.
	*
	* @returns A `UuidVersion`
	* @throws {Error} If the version field is not recognized
	*/
	getVersion() {
		const version = this.toBytes()[6] >> 4 & 15;
		switch (version) {
			case 4: return "V4";
			case 7: return "V7";
			default:
				if (this == _Uuid.NIL) return "Nil";
				if (this == _Uuid.MAX) return "Max";
				throw new Error(`Unsupported UUID version: ${version}`);
		}
	}
	/**
	* Extract the monotonic counter from a UUIDv7.
	*
	* Intended for testing and diagnostics.
	* Behavior is undefined if called on a non-V7 UUID.
	*
	* @returns 31-bit counter value
	*/
	getCounter() {
		const bytes = this.toBytes();
		const high = bytes[7];
		const mid1 = bytes[9];
		const mid2 = bytes[10];
		const low = bytes[11] >>> 1;
		return high << 23 | mid1 << 15 | mid2 << 7 | low | 0;
	}
	compareTo(other) {
		if (this.__uuid__ < other.__uuid__) return -1;
		if (this.__uuid__ > other.__uuid__) return 1;
		return 0;
	}
	static getAlgebraicType() {
		return AlgebraicType.Product({ elements: [{
			name: "__uuid__",
			algebraicType: AlgebraicType.U128
		}] });
	}
};
var ConnectionId = class _ConnectionId {
	__connection_id__;
	/**
	* Creates a new `ConnectionId`.
	*/
	constructor(data) {
		this.__connection_id__ = coerceToBigInt(data, "ConnectionId");
	}
	/**
	* Get the algebraic type representation of the {@link ConnectionId} type.
	* @returns The algebraic type representation of the type.
	*/
	static getAlgebraicType() {
		return AlgebraicType.Product({ elements: [{
			name: "__connection_id__",
			algebraicType: AlgebraicType.U128
		}] });
	}
	isZero() {
		return this.__connection_id__ === BigInt(0);
	}
	static nullIfZero(addr) {
		if (addr.isZero()) return null;
		else return addr;
	}
	static random() {
		function randomU8() {
			return Math.floor(Math.random() * 255);
		}
		let result = BigInt(0);
		for (let i = 0; i < 16; i++) result = result << BigInt(8) | BigInt(randomU8());
		return new _ConnectionId(result);
	}
	/**
	* Compare two connection IDs for equality.
	*/
	isEqual(other) {
		return this.__connection_id__ == other.__connection_id__;
	}
	/**
	* Check if two connection IDs are equal.
	*/
	equals(other) {
		return this.isEqual(other);
	}
	/**
	* Print the connection ID as a hexadecimal string.
	*/
	toHexString() {
		return u128ToHexString(this.__connection_id__);
	}
	/**
	* Convert the connection ID to a Uint8Array.
	*/
	toUint8Array() {
		return u128ToUint8Array(this.__connection_id__);
	}
	/**
	* Parse a connection ID from a hexadecimal string.
	*/
	static fromString(str) {
		return new _ConnectionId(hexStringToU128(str));
	}
	static fromStringOrNull(str) {
		const addr = _ConnectionId.fromString(str);
		if (addr.isZero()) return null;
		else return addr;
	}
};
var Identity = class _Identity {
	__identity__;
	/**
	* Creates a new `Identity`.
	*
	* `data` can be a hexadecimal string or a `bigint`.
	*/
	constructor(data) {
		this.__identity__ = typeof data === "string" ? hexStringToU256(data) : coerceToBigInt(data, "Identity");
	}
	/**
	* Get the algebraic type representation of the {@link Identity} type.
	* @returns The algebraic type representation of the type.
	*/
	static getAlgebraicType() {
		return AlgebraicType.Product({ elements: [{
			name: "__identity__",
			algebraicType: AlgebraicType.U256
		}] });
	}
	/**
	* Check if two identities are equal.
	*/
	isEqual(other) {
		return this.toHexString() === other.toHexString();
	}
	/**
	* Check if two identities are equal.
	*/
	equals(other) {
		return this.isEqual(other);
	}
	/**
	* Print the identity as a hexadecimal string.
	*/
	toHexString() {
		return u256ToHexString(this.__identity__);
	}
	/**
	* Convert the address to a Uint8Array.
	*/
	toUint8Array() {
		return u256ToUint8Array(this.__identity__);
	}
	/**
	* Parse an Identity from a hexadecimal string.
	*/
	static fromString(str) {
		return new _Identity(str);
	}
	/**
	* Zero identity (0x0000000000000000000000000000000000000000000000000000000000000000)
	*/
	static zero() {
		return new _Identity(0n);
	}
	toString() {
		return this.toHexString();
	}
};
var SERIALIZERS = /* @__PURE__ */ new Map();
var DESERIALIZERS = /* @__PURE__ */ new Map();
var AlgebraicType = {
	Ref: (value) => ({
		tag: "Ref",
		value
	}),
	Sum: (value) => ({
		tag: "Sum",
		value
	}),
	Product: (value) => ({
		tag: "Product",
		value
	}),
	Array: (value) => ({
		tag: "Array",
		value
	}),
	String: { tag: "String" },
	Bool: { tag: "Bool" },
	I8: { tag: "I8" },
	U8: { tag: "U8" },
	I16: { tag: "I16" },
	U16: { tag: "U16" },
	I32: { tag: "I32" },
	U32: { tag: "U32" },
	I64: { tag: "I64" },
	U64: { tag: "U64" },
	I128: { tag: "I128" },
	U128: { tag: "U128" },
	I256: { tag: "I256" },
	U256: { tag: "U256" },
	F32: { tag: "F32" },
	F64: { tag: "F64" },
	makeSerializer(ty, typespace) {
		if (ty.tag === "Ref") {
			if (!typespace) throw new Error("cannot serialize refs without a typespace");
			while (ty.tag === "Ref") ty = typespace.types[ty.value];
		}
		switch (ty.tag) {
			case "Product": return ProductType.makeSerializer(ty.value, typespace);
			case "Sum": return SumType.makeSerializer(ty.value, typespace);
			case "Array": if (ty.value.tag === "U8") return serializeUint8Array;
			else {
				const serialize = AlgebraicType.makeSerializer(ty.value, typespace);
				return (writer, value) => {
					writer.writeU32(value.length);
					for (const elem of value) serialize(writer, elem);
				};
			}
			default: return primitiveSerializers[ty.tag];
		}
	},
	serializeValue(writer, ty, value, typespace) {
		AlgebraicType.makeSerializer(ty, typespace)(writer, value);
	},
	makeDeserializer(ty, typespace) {
		if (ty.tag === "Ref") {
			if (!typespace) throw new Error("cannot deserialize refs without a typespace");
			while (ty.tag === "Ref") ty = typespace.types[ty.value];
		}
		switch (ty.tag) {
			case "Product": return ProductType.makeDeserializer(ty.value, typespace);
			case "Sum": return SumType.makeDeserializer(ty.value, typespace);
			case "Array": if (ty.value.tag === "U8") return deserializeUint8Array;
			else {
				const deserialize = AlgebraicType.makeDeserializer(ty.value, typespace);
				return (reader) => {
					const length = reader.readU32();
					const result = Array(length);
					for (let i = 0; i < length; i++) result[i] = deserialize(reader);
					return result;
				};
			}
			default: return primitiveDeserializers[ty.tag];
		}
	},
	deserializeValue(reader, ty, typespace) {
		return AlgebraicType.makeDeserializer(ty, typespace)(reader);
	},
	intoMapKey: function(ty, value) {
		switch (ty.tag) {
			case "U8":
			case "U16":
			case "U32":
			case "U64":
			case "U128":
			case "U256":
			case "I8":
			case "I16":
			case "I32":
			case "I64":
			case "I128":
			case "I256":
			case "F32":
			case "F64":
			case "String":
			case "Bool": return value;
			case "Product": return ProductType.intoMapKey(ty.value, value);
			default: {
				const writer = new BinaryWriter(10);
				AlgebraicType.serializeValue(writer, ty, value);
				return writer.toBase64();
			}
		}
	}
};
function bindCall(f) {
	return Function.prototype.call.bind(f);
}
var primitiveSerializers = {
	Bool: bindCall(BinaryWriter.prototype.writeBool),
	I8: bindCall(BinaryWriter.prototype.writeI8),
	U8: bindCall(BinaryWriter.prototype.writeU8),
	I16: bindCall(BinaryWriter.prototype.writeI16),
	U16: bindCall(BinaryWriter.prototype.writeU16),
	I32: bindCall(BinaryWriter.prototype.writeI32),
	U32: bindCall(BinaryWriter.prototype.writeU32),
	I64: bindCall(BinaryWriter.prototype.writeI64),
	U64: bindCall(BinaryWriter.prototype.writeU64),
	I128: bindCall(BinaryWriter.prototype.writeI128),
	U128: bindCall(BinaryWriter.prototype.writeU128),
	I256: bindCall(BinaryWriter.prototype.writeI256),
	U256: bindCall(BinaryWriter.prototype.writeU256),
	F32: bindCall(BinaryWriter.prototype.writeF32),
	F64: bindCall(BinaryWriter.prototype.writeF64),
	String: bindCall(BinaryWriter.prototype.writeString)
};
Object.freeze(primitiveSerializers);
var serializeUint8Array = bindCall(BinaryWriter.prototype.writeUInt8Array);
var primitiveDeserializers = {
	Bool: bindCall(BinaryReader.prototype.readBool),
	I8: bindCall(BinaryReader.prototype.readI8),
	U8: bindCall(BinaryReader.prototype.readU8),
	I16: bindCall(BinaryReader.prototype.readI16),
	U16: bindCall(BinaryReader.prototype.readU16),
	I32: bindCall(BinaryReader.prototype.readI32),
	U32: bindCall(BinaryReader.prototype.readU32),
	I64: bindCall(BinaryReader.prototype.readI64),
	U64: bindCall(BinaryReader.prototype.readU64),
	I128: bindCall(BinaryReader.prototype.readI128),
	U128: bindCall(BinaryReader.prototype.readU128),
	I256: bindCall(BinaryReader.prototype.readI256),
	U256: bindCall(BinaryReader.prototype.readU256),
	F32: bindCall(BinaryReader.prototype.readF32),
	F64: bindCall(BinaryReader.prototype.readF64),
	String: bindCall(BinaryReader.prototype.readString)
};
Object.freeze(primitiveDeserializers);
var deserializeUint8Array = bindCall(BinaryReader.prototype.readUInt8Array);
var primitiveSizes = {
	Bool: 1,
	I8: 1,
	U8: 1,
	I16: 2,
	U16: 2,
	I32: 4,
	U32: 4,
	I64: 8,
	U64: 8,
	I128: 16,
	U128: 16,
	I256: 32,
	U256: 32,
	F32: 4,
	F64: 8
};
var fixedSizePrimitives = new Set(Object.keys(primitiveSizes));
var isFixedSizeProduct = (ty) => ty.elements.every(({ algebraicType }) => fixedSizePrimitives.has(algebraicType.tag));
var productSize = (ty) => ty.elements.reduce((acc, { algebraicType }) => acc + primitiveSizes[algebraicType.tag], 0);
var primitiveJSName = {
	Bool: "Uint8",
	I8: "Int8",
	U8: "Uint8",
	I16: "Int16",
	U16: "Uint16",
	I32: "Int32",
	U32: "Uint32",
	I64: "BigInt64",
	U64: "BigUint64",
	F32: "Float32",
	F64: "Float64"
};
var specialProductDeserializers = {
	__time_duration_micros__: (reader) => new TimeDuration(reader.readI64()),
	__timestamp_micros_since_unix_epoch__: (reader) => new Timestamp(reader.readI64()),
	__identity__: (reader) => new Identity(reader.readU256()),
	__connection_id__: (reader) => new ConnectionId(reader.readU128()),
	__uuid__: (reader) => new Uuid(reader.readU128())
};
Object.freeze(specialProductDeserializers);
var unitDeserializer = () => ({});
var getElementInitializer = (element) => {
	let init;
	switch (element.algebraicType.tag) {
		case "String":
			init = "''";
			break;
		case "Bool":
			init = "false";
			break;
		case "I8":
		case "U8":
		case "I16":
		case "U16":
		case "I32":
		case "U32":
			init = "0";
			break;
		case "I64":
		case "U64":
		case "I128":
		case "U128":
		case "I256":
		case "U256":
			init = "0n";
			break;
		case "F32":
		case "F64":
			init = "0.0";
			break;
		default: init = "undefined";
	}
	return `${element.name}: ${init}`;
};
var ProductType = {
	makeSerializer(ty, typespace) {
		let serializer = SERIALIZERS.get(ty);
		if (serializer != null) return serializer;
		if (isFixedSizeProduct(ty)) {
			const body2 = `"use strict";
writer.expandBuffer(${productSize(ty)});
const view = writer.view;
${ty.elements.map(({ name, algebraicType: { tag } }) => tag in primitiveJSName ? `view.set${primitiveJSName[tag]}(writer.offset, value.${name}, ${primitiveSizes[tag] > 1 ? "true" : ""});
writer.offset += ${primitiveSizes[tag]};` : `writer.write${tag}(value.${name});`).join("\n")}`;
			serializer = Function("writer", "value", body2);
			SERIALIZERS.set(ty, serializer);
			return serializer;
		}
		const serializers = {};
		const body = "\"use strict\";\n" + ty.elements.map((element) => `this.${element.name}(writer, value.${element.name});`).join("\n");
		serializer = Function("writer", "value", body).bind(serializers);
		SERIALIZERS.set(ty, serializer);
		for (const { name, algebraicType } of ty.elements) serializers[name] = AlgebraicType.makeSerializer(algebraicType, typespace);
		Object.freeze(serializers);
		return serializer;
	},
	serializeValue(writer, ty, value, typespace) {
		ProductType.makeSerializer(ty, typespace)(writer, value);
	},
	makeDeserializer(ty, typespace) {
		switch (ty.elements.length) {
			case 0: return unitDeserializer;
			case 1: {
				const fieldName = ty.elements[0].name;
				if (hasOwn(specialProductDeserializers, fieldName)) return specialProductDeserializers[fieldName];
			}
		}
		let deserializer = DESERIALIZERS.get(ty);
		if (deserializer != null) return deserializer;
		if (isFixedSizeProduct(ty)) {
			const body = `"use strict";
const result = { ${ty.elements.map(getElementInitializer).join(", ")} };
const view = reader.view;
${ty.elements.map(({ name, algebraicType: { tag } }) => tag in primitiveJSName ? tag === "Bool" ? `result.${name} = view.getUint8(reader.offset) !== 0;
reader.offset += 1;` : `result.${name} = view.get${primitiveJSName[tag]}(reader.offset, ${primitiveSizes[tag] > 1 ? "true" : ""});
reader.offset += ${primitiveSizes[tag]};` : `result.${name} = reader.read${tag}();`).join("\n")}
return result;`;
			deserializer = Function("reader", body);
			DESERIALIZERS.set(ty, deserializer);
			return deserializer;
		}
		const deserializers = {};
		deserializer = Function("reader", `"use strict";
const result = { ${ty.elements.map(getElementInitializer).join(", ")} };
${ty.elements.map(({ name }) => `result.${name} = this.${name}(reader);`).join("\n")}
return result;`).bind(deserializers);
		DESERIALIZERS.set(ty, deserializer);
		for (const { name, algebraicType } of ty.elements) deserializers[name] = AlgebraicType.makeDeserializer(algebraicType, typespace);
		Object.freeze(deserializers);
		return deserializer;
	},
	deserializeValue(reader, ty, typespace) {
		return ProductType.makeDeserializer(ty, typespace)(reader);
	},
	intoMapKey(ty, value) {
		if (ty.elements.length === 1) {
			const fieldName = ty.elements[0].name;
			if (hasOwn(specialProductDeserializers, fieldName)) return value[fieldName];
		}
		const writer = new BinaryWriter(10);
		AlgebraicType.serializeValue(writer, AlgebraicType.Product(ty), value);
		return writer.toBase64();
	}
};
var SumType = {
	makeSerializer(ty, typespace) {
		if (ty.variants.length == 2 && ty.variants[0].name === "some" && ty.variants[1].name === "none") {
			const serialize = AlgebraicType.makeSerializer(ty.variants[0].algebraicType, typespace);
			return (writer, value) => {
				if (value !== null && value !== void 0) {
					writer.writeByte(0);
					serialize(writer, value);
				} else writer.writeByte(1);
			};
		} else if (ty.variants.length == 2 && ty.variants[0].name === "ok" && ty.variants[1].name === "err") {
			const serializeOk = AlgebraicType.makeSerializer(ty.variants[0].algebraicType, typespace);
			const serializeErr = AlgebraicType.makeSerializer(ty.variants[1].algebraicType, typespace);
			return (writer, value) => {
				if ("ok" in value) {
					writer.writeU8(0);
					serializeOk(writer, value.ok);
				} else if ("err" in value) {
					writer.writeU8(1);
					serializeErr(writer, value.err);
				} else throw new TypeError("could not serialize result: object had neither a `ok` nor an `err` field");
			};
		} else {
			let serializer = SERIALIZERS.get(ty);
			if (serializer != null) return serializer;
			const serializers = {};
			const body = `switch (value.tag) {
${ty.variants.map(({ name }, i) => `  case ${JSON.stringify(name)}:
    writer.writeByte(${i});
    return this.${name}(writer, value.value);`).join("\n")}
  default:
    throw new TypeError(
      \`Could not serialize sum type; unknown tag \${value.tag}\`
    )
}
`;
			serializer = Function("writer", "value", body).bind(serializers);
			SERIALIZERS.set(ty, serializer);
			for (const { name, algebraicType } of ty.variants) serializers[name] = AlgebraicType.makeSerializer(algebraicType, typespace);
			Object.freeze(serializers);
			return serializer;
		}
	},
	serializeValue(writer, ty, value, typespace) {
		SumType.makeSerializer(ty, typespace)(writer, value);
	},
	makeDeserializer(ty, typespace) {
		if (ty.variants.length == 2 && ty.variants[0].name === "some" && ty.variants[1].name === "none") {
			const deserialize = AlgebraicType.makeDeserializer(ty.variants[0].algebraicType, typespace);
			return (reader) => {
				const tag = reader.readU8();
				if (tag === 0) return deserialize(reader);
				else if (tag === 1) return;
				else throw `Can't deserialize an option type, couldn't find ${tag} tag`;
			};
		} else if (ty.variants.length == 2 && ty.variants[0].name === "ok" && ty.variants[1].name === "err") {
			const deserializeOk = AlgebraicType.makeDeserializer(ty.variants[0].algebraicType, typespace);
			const deserializeErr = AlgebraicType.makeDeserializer(ty.variants[1].algebraicType, typespace);
			return (reader) => {
				const tag = reader.readByte();
				if (tag === 0) return { ok: deserializeOk(reader) };
				else if (tag === 1) return { err: deserializeErr(reader) };
				else throw `Can't deserialize a result type, couldn't find ${tag} tag`;
			};
		} else {
			let deserializer = DESERIALIZERS.get(ty);
			if (deserializer != null) return deserializer;
			const deserializers = {};
			deserializer = Function("reader", `switch (reader.readU8()) {
${ty.variants.map(({ name }, i) => `case ${i}: return { tag: ${JSON.stringify(name)}, value: this.${name}(reader) };`).join("\n")} }`).bind(deserializers);
			DESERIALIZERS.set(ty, deserializer);
			for (const { name, algebraicType } of ty.variants) deserializers[name] = AlgebraicType.makeDeserializer(algebraicType, typespace);
			Object.freeze(deserializers);
			return deserializer;
		}
	},
	deserializeValue(reader, ty, typespace) {
		return SumType.makeDeserializer(ty, typespace)(reader);
	}
};
var Option = { getAlgebraicType(innerType) {
	return AlgebraicType.Sum({ variants: [{
		name: "some",
		algebraicType: innerType
	}, {
		name: "none",
		algebraicType: AlgebraicType.Product({ elements: [] })
	}] });
} };
var Result = { getAlgebraicType(okType, errType) {
	return AlgebraicType.Sum({ variants: [{
		name: "ok",
		algebraicType: okType
	}, {
		name: "err",
		algebraicType: errType
	}] });
} };
var ScheduleAt = {
	interval(value) {
		return Interval(value);
	},
	time(value) {
		return Time(value);
	},
	getAlgebraicType() {
		return AlgebraicType.Sum({ variants: [{
			name: "Interval",
			algebraicType: TimeDuration.getAlgebraicType()
		}, {
			name: "Time",
			algebraicType: Timestamp.getAlgebraicType()
		}] });
	},
	isScheduleAt(algebraicType) {
		if (algebraicType.tag !== "Sum") return false;
		const variants = algebraicType.value.variants;
		if (variants.length !== 2) return false;
		const intervalVariant = variants.find((v) => v.name === "Interval");
		const timeVariant = variants.find((v) => v.name === "Time");
		if (!intervalVariant || !timeVariant) return false;
		return TimeDuration.isTimeDuration(intervalVariant.algebraicType) && Timestamp.isTimestamp(timeVariant.algebraicType);
	}
};
var Interval = (micros) => ({
	tag: "Interval",
	value: new TimeDuration(micros)
});
var Time = (microsSinceUnixEpoch) => ({
	tag: "Time",
	value: new Timestamp(microsSinceUnixEpoch)
});
var schedule_at_default = ScheduleAt;
function set(x, t2) {
	return {
		...x,
		...t2
	};
}
var TypeBuilder = class {
	/**
	* The TypeScript phantom type. This is not stored at runtime,
	* but is visible to the compiler
	*/
	type;
	/**
	* The SpacetimeDB algebraic type (run‑time value). In addition to storing
	* the runtime representation of the `AlgebraicType`, it also captures
	* the TypeScript type information of the `AlgebraicType`. That is to say
	* the value is not merely an `AlgebraicType`, but is constructed to be
	* the corresponding concrete `AlgebraicType` for the TypeScript type `Type`.
	*
	* e.g. `string` corresponds to `AlgebraicType.String`
	*/
	algebraicType;
	constructor(algebraicType) {
		this.algebraicType = algebraicType;
	}
	optional() {
		return new OptionBuilder(this);
	}
	serialize(writer, value) {
		(this.serialize = AlgebraicType.makeSerializer(this.algebraicType))(writer, value);
	}
	deserialize(reader) {
		return (this.deserialize = AlgebraicType.makeDeserializer(this.algebraicType))(reader);
	}
};
var U8Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.U8);
	}
	index(algorithm = "btree") {
		return new U8ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new U8ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new U8ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new U8ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new U8ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new U8ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var U16Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.U16);
	}
	index(algorithm = "btree") {
		return new U16ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new U16ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new U16ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new U16ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new U16ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new U16ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var U32Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.U32);
	}
	index(algorithm = "btree") {
		return new U32ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new U32ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new U32ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new U32ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new U32ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new U32ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var U64Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.U64);
	}
	index(algorithm = "btree") {
		return new U64ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new U64ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new U64ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new U64ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new U64ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new U64ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var U128Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.U128);
	}
	index(algorithm = "btree") {
		return new U128ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new U128ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new U128ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new U128ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new U128ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new U128ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var U256Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.U256);
	}
	index(algorithm = "btree") {
		return new U256ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new U256ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new U256ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new U256ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new U256ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new U256ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var I8Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.I8);
	}
	index(algorithm = "btree") {
		return new I8ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new I8ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new I8ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new I8ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new I8ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new I8ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var I16Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.I16);
	}
	index(algorithm = "btree") {
		return new I16ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new I16ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new I16ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new I16ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new I16ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new I16ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var I32Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.I32);
	}
	index(algorithm = "btree") {
		return new I32ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new I32ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new I32ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new I32ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new I32ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new I32ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var I64Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.I64);
	}
	index(algorithm = "btree") {
		return new I64ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new I64ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new I64ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new I64ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new I64ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new I64ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var I128Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.I128);
	}
	index(algorithm = "btree") {
		return new I128ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new I128ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new I128ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new I128ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new I128ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new I128ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var I256Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.I256);
	}
	index(algorithm = "btree") {
		return new I256ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new I256ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new I256ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new I256ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new I256ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new I256ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var F32Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.F32);
	}
	default(value) {
		return new F32ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new F32ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var F64Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.F64);
	}
	default(value) {
		return new F64ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new F64ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var BoolBuilder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.Bool);
	}
	index(algorithm = "btree") {
		return new BoolColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new BoolColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new BoolColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	default(value) {
		return new BoolColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new BoolColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var StringBuilder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.String);
	}
	index(algorithm = "btree") {
		return new StringColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new StringColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new StringColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	default(value) {
		return new StringColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new StringColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var ArrayBuilder = class extends TypeBuilder {
	element;
	constructor(element) {
		super(AlgebraicType.Array(element.algebraicType));
		this.element = element;
	}
	default(value) {
		return new ArrayColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new ArrayColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var ByteArrayBuilder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.Array(AlgebraicType.U8));
	}
	default(value) {
		return new ByteArrayColumnBuilder(set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new ByteArrayColumnBuilder(set(defaultMetadata, { name }));
	}
};
var OptionBuilder = class extends TypeBuilder {
	value;
	constructor(value) {
		super(Option.getAlgebraicType(value.algebraicType));
		this.value = value;
	}
	default(value) {
		return new OptionColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new OptionColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var ProductBuilder = class extends TypeBuilder {
	typeName;
	elements;
	constructor(elements, name) {
		function elementsArrayFromElementsObj(obj) {
			return Object.keys(obj).map((key) => ({
				name: key,
				get algebraicType() {
					return obj[key].algebraicType;
				}
			}));
		}
		super(AlgebraicType.Product({ elements: elementsArrayFromElementsObj(elements) }));
		this.typeName = name;
		this.elements = elements;
	}
	default(value) {
		return new ProductColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new ProductColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var ResultBuilder = class extends TypeBuilder {
	ok;
	err;
	constructor(ok, err) {
		super(Result.getAlgebraicType(ok.algebraicType, err.algebraicType));
		this.ok = ok;
		this.err = err;
	}
	default(value) {
		return new ResultColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
};
var UnitBuilder = class extends TypeBuilder {
	constructor() {
		super({
			tag: "Product",
			value: { elements: [] }
		});
	}
};
var RowBuilder = class extends TypeBuilder {
	row;
	typeName;
	constructor(row, name) {
		const mappedRow = Object.fromEntries(Object.entries(row).map(([colName, builder]) => [colName, builder instanceof ColumnBuilder ? builder : new ColumnBuilder(builder, {})]));
		const elements = Object.keys(mappedRow).map((name2) => ({
			name: name2,
			get algebraicType() {
				return mappedRow[name2].typeBuilder.algebraicType;
			}
		}));
		super(AlgebraicType.Product({ elements }));
		this.row = mappedRow;
		this.typeName = name;
	}
};
var SumBuilderImpl = class extends TypeBuilder {
	variants;
	typeName;
	constructor(variants, name) {
		function variantsArrayFromVariantsObj(variants2) {
			return Object.keys(variants2).map((key) => ({
				name: key,
				get algebraicType() {
					return variants2[key].algebraicType;
				}
			}));
		}
		super(AlgebraicType.Sum({ variants: variantsArrayFromVariantsObj(variants) }));
		this.variants = variants;
		this.typeName = name;
		for (const key of Object.keys(variants)) {
			const desc = Object.getOwnPropertyDescriptor(variants, key);
			const isAccessor = !!desc && (typeof desc.get === "function" || typeof desc.set === "function");
			let isUnit2 = false;
			if (!isAccessor) isUnit2 = variants[key] instanceof UnitBuilder;
			if (isUnit2) {
				const constant = this.create(key);
				Object.defineProperty(this, key, {
					value: constant,
					writable: false,
					enumerable: true,
					configurable: false
				});
			} else {
				const fn = ((value) => this.create(key, value));
				Object.defineProperty(this, key, {
					value: fn,
					writable: false,
					enumerable: true,
					configurable: false
				});
			}
		}
	}
	create(tag, value) {
		return value === void 0 ? { tag } : {
			tag,
			value
		};
	}
	default(value) {
		return new SumColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new SumColumnBuilder(this, set(defaultMetadata, { name }));
	}
	index(algorithm = "btree") {
		return new SumColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	primaryKey() {
		return new SumColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
};
var SumBuilder = SumBuilderImpl;
var SimpleSumBuilderImpl = class extends SumBuilderImpl {
	index(algorithm = "btree") {
		return new SimpleSumColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	primaryKey() {
		return new SimpleSumColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
};
var ScheduleAtBuilder = class extends TypeBuilder {
	constructor() {
		super(schedule_at_default.getAlgebraicType());
	}
	default(value) {
		return new ScheduleAtColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new ScheduleAtColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var IdentityBuilder = class extends TypeBuilder {
	constructor() {
		super(Identity.getAlgebraicType());
	}
	index(algorithm = "btree") {
		return new IdentityColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new IdentityColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new IdentityColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new IdentityColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new IdentityColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new IdentityColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var ConnectionIdBuilder = class extends TypeBuilder {
	constructor() {
		super(ConnectionId.getAlgebraicType());
	}
	index(algorithm = "btree") {
		return new ConnectionIdColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new ConnectionIdColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new ConnectionIdColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new ConnectionIdColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new ConnectionIdColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new ConnectionIdColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var TimestampBuilder = class extends TypeBuilder {
	constructor() {
		super(Timestamp.getAlgebraicType());
	}
	index(algorithm = "btree") {
		return new TimestampColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new TimestampColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new TimestampColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new TimestampColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new TimestampColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new TimestampColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var TimeDurationBuilder = class extends TypeBuilder {
	constructor() {
		super(TimeDuration.getAlgebraicType());
	}
	index(algorithm = "btree") {
		return new TimeDurationColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new TimeDurationColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new TimeDurationColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new TimeDurationColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new TimeDurationColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new TimeDurationColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var UuidBuilder = class extends TypeBuilder {
	constructor() {
		super(Uuid.getAlgebraicType());
	}
	index(algorithm = "btree") {
		return new UuidColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new UuidColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new UuidColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new UuidColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new UuidColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new UuidColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var defaultMetadata = {};
var ColumnBuilder = class {
	typeBuilder;
	columnMetadata;
	constructor(typeBuilder, metadata) {
		this.typeBuilder = typeBuilder;
		this.columnMetadata = metadata;
	}
	serialize(writer, value) {
		this.typeBuilder.serialize(writer, value);
	}
	deserialize(reader) {
		return this.typeBuilder.deserialize(reader);
	}
};
var U8ColumnBuilder = class _U8ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _U8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _U8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _U8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _U8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _U8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _U8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var U16ColumnBuilder = class _U16ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _U16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _U16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _U16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _U16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _U16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _U16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var U32ColumnBuilder = class _U32ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _U32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _U32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _U32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _U32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _U32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _U32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var U64ColumnBuilder = class _U64ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _U64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _U64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _U64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _U64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _U64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _U64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var U128ColumnBuilder = class _U128ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _U128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _U128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _U128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _U128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _U128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _U128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var U256ColumnBuilder = class _U256ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _U256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _U256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _U256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _U256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _U256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _U256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var I8ColumnBuilder = class _I8ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _I8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _I8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _I8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _I8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _I8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _I8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var I16ColumnBuilder = class _I16ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _I16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _I16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _I16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _I16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _I16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _I16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var I32ColumnBuilder = class _I32ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _I32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _I32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _I32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _I32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _I32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _I32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var I64ColumnBuilder = class _I64ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _I64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _I64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _I64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _I64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _I64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _I64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var I128ColumnBuilder = class _I128ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _I128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _I128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _I128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _I128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _I128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _I128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var I256ColumnBuilder = class _I256ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _I256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _I256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _I256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _I256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _I256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _I256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var F32ColumnBuilder = class _F32ColumnBuilder extends ColumnBuilder {
	default(value) {
		return new _F32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _F32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var F64ColumnBuilder = class _F64ColumnBuilder extends ColumnBuilder {
	default(value) {
		return new _F64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _F64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var BoolColumnBuilder = class _BoolColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _BoolColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _BoolColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _BoolColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	default(value) {
		return new _BoolColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _BoolColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var StringColumnBuilder = class _StringColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _StringColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _StringColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _StringColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	default(value) {
		return new _StringColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _StringColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var ArrayColumnBuilder = class _ArrayColumnBuilder extends ColumnBuilder {
	default(value) {
		return new _ArrayColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _ArrayColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var ByteArrayColumnBuilder = class _ByteArrayColumnBuilder extends ColumnBuilder {
	constructor(metadata) {
		super(new TypeBuilder(AlgebraicType.Array(AlgebraicType.U8)), metadata);
	}
	default(value) {
		return new _ByteArrayColumnBuilder(set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _ByteArrayColumnBuilder(set(this.columnMetadata, { name }));
	}
};
var OptionColumnBuilder = class _OptionColumnBuilder extends ColumnBuilder {
	default(value) {
		return new _OptionColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _OptionColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var ResultColumnBuilder = class _ResultColumnBuilder extends ColumnBuilder {
	constructor(typeBuilder, metadata) {
		super(typeBuilder, metadata);
	}
	default(value) {
		return new _ResultColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
};
var ProductColumnBuilder = class _ProductColumnBuilder extends ColumnBuilder {
	default(value) {
		return new _ProductColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _ProductColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var SumColumnBuilder = class _SumColumnBuilder extends ColumnBuilder {
	default(value) {
		return new _SumColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _SumColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
	index(algorithm = "btree") {
		return new _SumColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	primaryKey() {
		return new _SumColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
};
var SimpleSumColumnBuilder = class _SimpleSumColumnBuilder extends SumColumnBuilder {
	index(algorithm = "btree") {
		return new _SimpleSumColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	primaryKey() {
		return new _SimpleSumColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
};
var ScheduleAtColumnBuilder = class _ScheduleAtColumnBuilder extends ColumnBuilder {
	default(value) {
		return new _ScheduleAtColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _ScheduleAtColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var IdentityColumnBuilder = class _IdentityColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _IdentityColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _IdentityColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _IdentityColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	default(value) {
		return new _IdentityColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _IdentityColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var ConnectionIdColumnBuilder = class _ConnectionIdColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _ConnectionIdColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _ConnectionIdColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _ConnectionIdColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	default(value) {
		return new _ConnectionIdColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _ConnectionIdColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var TimestampColumnBuilder = class _TimestampColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _TimestampColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _TimestampColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _TimestampColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	default(value) {
		return new _TimestampColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _TimestampColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var TimeDurationColumnBuilder = class _TimeDurationColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _TimeDurationColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _TimeDurationColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _TimeDurationColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	default(value) {
		return new _TimeDurationColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _TimeDurationColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var UuidColumnBuilder = class _UuidColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _UuidColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _UuidColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _UuidColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	default(value) {
		return new _UuidColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _UuidColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var RefBuilder = class extends TypeBuilder {
	ref;
	/** The phantom type of the pointee of this ref. */
	__spacetimeType;
	constructor(ref) {
		super(AlgebraicType.Ref(ref));
		this.ref = ref;
	}
};
var enumImpl = ((nameOrObj, maybeObj) => {
	let obj = nameOrObj;
	let name = void 0;
	if (typeof nameOrObj === "string") {
		if (!maybeObj) throw new TypeError("When providing a name, you must also provide the variants object or array.");
		obj = maybeObj;
		name = nameOrObj;
	}
	if (Array.isArray(obj)) {
		const simpleVariantsObj = {};
		for (const variant of obj) simpleVariantsObj[variant] = new UnitBuilder();
		return new SimpleSumBuilderImpl(simpleVariantsObj, name);
	}
	return new SumBuilder(obj, name);
});
var t = {
	bool: () => new BoolBuilder(),
	string: () => new StringBuilder(),
	number: () => new F64Builder(),
	i8: () => new I8Builder(),
	u8: () => new U8Builder(),
	i16: () => new I16Builder(),
	u16: () => new U16Builder(),
	i32: () => new I32Builder(),
	u32: () => new U32Builder(),
	i64: () => new I64Builder(),
	u64: () => new U64Builder(),
	i128: () => new I128Builder(),
	u128: () => new U128Builder(),
	i256: () => new I256Builder(),
	u256: () => new U256Builder(),
	f32: () => new F32Builder(),
	f64: () => new F64Builder(),
	object: ((nameOrObj, maybeObj) => {
		if (typeof nameOrObj === "string") {
			if (!maybeObj) throw new TypeError("When providing a name, you must also provide the object.");
			return new ProductBuilder(maybeObj, nameOrObj);
		}
		return new ProductBuilder(nameOrObj, void 0);
	}),
	row: ((nameOrObj, maybeObj) => {
		const [obj, name] = typeof nameOrObj === "string" ? [maybeObj, nameOrObj] : [nameOrObj, void 0];
		return new RowBuilder(obj, name);
	}),
	array(e) {
		return new ArrayBuilder(e);
	},
	enum: enumImpl,
	unit() {
		return new UnitBuilder();
	},
	lazy(thunk) {
		let cached = null;
		const get = () => cached ??= thunk();
		return new Proxy({}, {
			get(_t, prop, recv) {
				const target = get();
				const val = Reflect.get(target, prop, recv);
				return typeof val === "function" ? val.bind(target) : val;
			},
			set(_t, prop, value, recv) {
				return Reflect.set(get(), prop, value, recv);
			},
			has(_t, prop) {
				return prop in get();
			},
			ownKeys() {
				return Reflect.ownKeys(get());
			},
			getOwnPropertyDescriptor(_t, prop) {
				return Object.getOwnPropertyDescriptor(get(), prop);
			},
			getPrototypeOf() {
				return Object.getPrototypeOf(get());
			}
		});
	},
	scheduleAt: () => {
		return new ScheduleAtBuilder();
	},
	option(value) {
		return new OptionBuilder(value);
	},
	result(ok, err) {
		return new ResultBuilder(ok, err);
	},
	identity: () => {
		return new IdentityBuilder();
	},
	connectionId: () => {
		return new ConnectionIdBuilder();
	},
	timestamp: () => {
		return new TimestampBuilder();
	},
	timeDuration: () => {
		return new TimeDurationBuilder();
	},
	uuid: () => {
		return new UuidBuilder();
	},
	byteArray: () => {
		return new ByteArrayBuilder();
	}
};
var MAX_ENV_KEY_BYTES = 256;
var MAX_ENV_VALUE_BYTES = 8 * 1024;
var MAX_ENV_VARS = 256;
var environment = new Proxy(Object.freeze(Object.assign(/* @__PURE__ */ Object.create(null), { get: (key) => env_get(key) })), { get(target, key) {
	if (key === "get") return target.get;
	if (typeof key !== "string") return void 0;
	return env_get(key) ?? void 0;
} });
function environmentDeclarations(schema2) {
	const entries = Object.entries(schema2);
	if (entries.length > MAX_ENV_VARS) throw new TypeError("Too many environment declarations");
	const bytes = new TextEncoder();
	return entries.map(([name, definition]) => {
		if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || bytes.encode(name).length > MAX_ENV_KEY_BYTES) throw new TypeError("Invalid environment declaration name");
		const optional = definition instanceof OptionBuilder;
		const inner = optional ? definition.value : definition;
		let ty;
		if (inner instanceof StringBuilder) ty = { tag: "String" };
		else {
			const type = inner?.algebraicType;
			if (type?.tag !== "Sum" || !("variants" in inner)) throw new TypeError(`Environment '${name}' must be a string or simple enum`);
			const values = type.value.variants.map((variant) => {
				if (variant.algebraicType.tag !== "Product" || variant.algebraicType.value.elements.length !== 0) throw new TypeError(`Environment '${name}' cannot use an enum payload`);
				if (typeof variant.name !== "string") throw new TypeError(`Environment '${name}' enum cases must have names`);
				if (bytes.encode(variant.name).length > MAX_ENV_VALUE_BYTES) throw new TypeError(`Environment '${name}' literal is too long`);
				return variant.name;
			});
			if (values.length === 0 || new Set(values).size !== values.length) throw new TypeError(`Environment '${name}' needs a nonempty literal union`);
			ty = values.length === 1 ? {
				tag: "StringLiteral",
				value: values[0]
			} : {
				tag: "Union",
				value: values
			};
		}
		return {
			name,
			ty,
			optional
		};
	});
}
var AlgebraicType2 = t.enum("AlgebraicType", {
	Ref: t.u32(),
	get Sum() {
		return SumType2;
	},
	get Product() {
		return ProductType2;
	},
	get Array() {
		return AlgebraicType2;
	},
	String: t.unit(),
	Bool: t.unit(),
	I8: t.unit(),
	U8: t.unit(),
	I16: t.unit(),
	U16: t.unit(),
	I32: t.unit(),
	U32: t.unit(),
	I64: t.unit(),
	U64: t.unit(),
	I128: t.unit(),
	U128: t.unit(),
	I256: t.unit(),
	U256: t.unit(),
	F32: t.unit(),
	F64: t.unit()
});
var CaseConversionPolicy = t.enum("CaseConversionPolicy", {
	None: t.unit(),
	SnakeCase: t.unit()
});
var EnvVarType = t.enum("EnvVarType", {
	String: t.unit(),
	StringLiteral: t.string(),
	Union: t.array(t.string())
});
var EnvironmentDeclaration = t.object("EnvironmentDeclaration", {
	name: t.string(),
	get ty() {
		return EnvVarType;
	},
	optional: t.bool()
});
var ExplicitNameEntry = t.enum("ExplicitNameEntry", {
	get Table() {
		return NameMapping;
	},
	get Function() {
		return NameMapping;
	},
	get Index() {
		return NameMapping;
	},
	get Namespace() {
		return NameMapping;
	}
});
var ExplicitNames = t.object("ExplicitNames", { get entries() {
	return t.array(ExplicitNameEntry);
} });
var FunctionVisibility = t.enum("FunctionVisibility", {
	Private: t.unit(),
	ClientCallable: t.unit()
});
var HttpHeaderPair = t.object("HttpHeaderPair", {
	name: t.string(),
	value: t.byteArray()
});
var HttpHeaders = t.object("HttpHeaders", { get entries() {
	return t.array(HttpHeaderPair);
} });
var HttpMethod = t.enum("HttpMethod", {
	Get: t.unit(),
	Head: t.unit(),
	Post: t.unit(),
	Put: t.unit(),
	Delete: t.unit(),
	Connect: t.unit(),
	Options: t.unit(),
	Trace: t.unit(),
	Patch: t.unit(),
	Extension: t.string()
});
var HttpRequest = t.object("HttpRequest", {
	get method() {
		return HttpMethod;
	},
	get headers() {
		return HttpHeaders;
	},
	timeout: t.option(t.timeDuration()),
	uri: t.string(),
	get version() {
		return HttpVersion;
	}
});
var HttpResponse = t.object("HttpResponse", {
	get headers() {
		return HttpHeaders;
	},
	get version() {
		return HttpVersion;
	},
	code: t.u16()
});
var HttpVersion = t.enum("HttpVersion", {
	Http09: t.unit(),
	Http10: t.unit(),
	Http11: t.unit(),
	Http2: t.unit(),
	Http3: t.unit()
});
var IndexType = t.enum("IndexType", {
	BTree: t.unit(),
	Hash: t.unit()
});
var Lifecycle = t.enum("Lifecycle", {
	Init: t.unit(),
	OnConnect: t.unit(),
	OnDisconnect: t.unit()
});
var MethodOrAny = t.enum("MethodOrAny", {
	Any: t.unit(),
	get Method() {
		return HttpMethod;
	}
});
var MiscModuleExport = t.enum("MiscModuleExport", { get TypeAlias() {
	return TypeAlias;
} });
var NameMapping = t.object("NameMapping", {
	sourceName: t.string(),
	canonicalName: t.string()
});
var ProductType2 = t.object("ProductType", { get elements() {
	return t.array(ProductTypeElement);
} });
var ProductTypeElement = t.object("ProductTypeElement", {
	name: t.option(t.string()),
	get algebraicType() {
		return AlgebraicType2;
	}
});
var RawColumnDefV8 = t.object("RawColumnDefV8", {
	colName: t.string(),
	get colType() {
		return AlgebraicType2;
	}
});
var RawColumnDefaultValueV10 = t.object("RawColumnDefaultValueV10", {
	colId: t.u16(),
	value: t.byteArray()
});
var RawColumnDefaultValueV9 = t.object("RawColumnDefaultValueV9", {
	table: t.string(),
	colId: t.u16(),
	value: t.byteArray()
});
var RawConstraintDataV9 = t.enum("RawConstraintDataV9", { get Unique() {
	return RawUniqueConstraintDataV9;
} });
var RawConstraintDefV10 = t.object("RawConstraintDefV10", {
	sourceName: t.option(t.string()),
	get data() {
		return RawConstraintDataV9;
	}
});
var RawConstraintDefV8 = t.object("RawConstraintDefV8", {
	constraintName: t.string(),
	constraints: t.u8(),
	columns: t.array(t.u16())
});
var RawConstraintDefV9 = t.object("RawConstraintDefV9", {
	name: t.option(t.string()),
	get data() {
		return RawConstraintDataV9;
	}
});
var RawHttpHandlerDefV10 = t.object("RawHttpHandlerDefV10", { sourceName: t.string() });
var RawHttpRouteDefV10 = t.object("RawHttpRouteDefV10", {
	handlerFunction: t.string(),
	get method() {
		return MethodOrAny;
	},
	path: t.string()
});
var RawIndexAlgorithm = t.enum("RawIndexAlgorithm", {
	BTree: t.array(t.u16()),
	Hash: t.array(t.u16()),
	Direct: t.u16()
});
var RawIndexDefV10 = t.object("RawIndexDefV10", {
	sourceName: t.option(t.string()),
	accessorName: t.option(t.string()),
	get algorithm() {
		return RawIndexAlgorithm;
	}
});
var RawIndexDefV8 = t.object("RawIndexDefV8", {
	indexName: t.string(),
	isUnique: t.bool(),
	get indexType() {
		return IndexType;
	},
	columns: t.array(t.u16())
});
var RawIndexDefV9 = t.object("RawIndexDefV9", {
	name: t.option(t.string()),
	accessorName: t.option(t.string()),
	get algorithm() {
		return RawIndexAlgorithm;
	}
});
var RawLifeCycleReducerDefV10 = t.object("RawLifeCycleReducerDefV10", {
	get lifecycleSpec() {
		return Lifecycle;
	},
	functionName: t.string()
});
var RawMiscModuleExportV9 = t.enum("RawMiscModuleExportV9", {
	get ColumnDefaultValue() {
		return RawColumnDefaultValueV9;
	},
	get Procedure() {
		return RawProcedureDefV9;
	},
	get View() {
		return RawViewDefV9;
	}
});
var RawModuleDef = t.enum("RawModuleDef", {
	get V8BackCompat() {
		return RawModuleDefV8;
	},
	get V9() {
		return RawModuleDefV9;
	},
	get V10() {
		return RawModuleDefV10;
	}
});
var RawModuleDefV10 = t.object("RawModuleDefV10", { get sections() {
	return t.array(RawModuleDefV10Section);
} });
var RawModuleDefV10Section = t.enum("RawModuleDefV10Section", {
	get Typespace() {
		return Typespace;
	},
	get Types() {
		return t.array(RawTypeDefV10);
	},
	get Tables() {
		return t.array(RawTableDefV10);
	},
	get Reducers() {
		return t.array(RawReducerDefV10);
	},
	get Procedures() {
		return t.array(RawProcedureDefV10);
	},
	get Views() {
		return t.array(RawViewDefV10);
	},
	get Schedules() {
		return t.array(RawScheduleDefV10);
	},
	get LifeCycleReducers() {
		return t.array(RawLifeCycleReducerDefV10);
	},
	get RowLevelSecurity() {
		return t.array(RawRowLevelSecurityDefV9);
	},
	get CaseConversionPolicy() {
		return CaseConversionPolicy;
	},
	get ExplicitNames() {
		return ExplicitNames;
	},
	get HttpHandlers() {
		return t.array(RawHttpHandlerDefV10);
	},
	get HttpRoutes() {
		return t.array(RawHttpRouteDefV10);
	},
	get ViewPrimaryKeys() {
		return t.array(RawViewPrimaryKeyDefV10);
	},
	get Submodules() {
		return t.array(RawSubmoduleV10);
	},
	get Environment() {
		return t.array(EnvironmentDeclaration);
	}
});
var RawModuleDefV8 = t.object("RawModuleDefV8", {
	get typespace() {
		return Typespace;
	},
	get tables() {
		return t.array(TableDesc);
	},
	get reducers() {
		return t.array(ReducerDef);
	},
	get miscExports() {
		return t.array(MiscModuleExport);
	}
});
var RawModuleDefV9 = t.object("RawModuleDefV9", {
	get typespace() {
		return Typespace;
	},
	get tables() {
		return t.array(RawTableDefV9);
	},
	get reducers() {
		return t.array(RawReducerDefV9);
	},
	get types() {
		return t.array(RawTypeDefV9);
	},
	get miscExports() {
		return t.array(RawMiscModuleExportV9);
	},
	get rowLevelSecurity() {
		return t.array(RawRowLevelSecurityDefV9);
	}
});
var RawProcedureDefV10 = t.object("RawProcedureDefV10", {
	sourceName: t.string(),
	get params() {
		return ProductType2;
	},
	get returnType() {
		return AlgebraicType2;
	},
	get visibility() {
		return FunctionVisibility;
	}
});
var RawProcedureDefV9 = t.object("RawProcedureDefV9", {
	name: t.string(),
	get params() {
		return ProductType2;
	},
	get returnType() {
		return AlgebraicType2;
	}
});
var RawReducerDefV10 = t.object("RawReducerDefV10", {
	sourceName: t.string(),
	get params() {
		return ProductType2;
	},
	get visibility() {
		return FunctionVisibility;
	},
	get okReturnType() {
		return AlgebraicType2;
	},
	get errReturnType() {
		return AlgebraicType2;
	}
});
var RawReducerDefV9 = t.object("RawReducerDefV9", {
	name: t.string(),
	get params() {
		return ProductType2;
	},
	get lifecycle() {
		return t.option(Lifecycle);
	}
});
var RawRowLevelSecurityDefV9 = t.object("RawRowLevelSecurityDefV9", { sql: t.string() });
var RawScheduleDefV10 = t.object("RawScheduleDefV10", {
	sourceName: t.option(t.string()),
	tableName: t.string(),
	scheduleAtCol: t.u16(),
	functionName: t.string()
});
var RawScheduleDefV9 = t.object("RawScheduleDefV9", {
	name: t.option(t.string()),
	reducerName: t.string(),
	scheduledAtColumn: t.u16()
});
var RawScopedTypeNameV10 = t.object("RawScopedTypeNameV10", {
	scope: t.array(t.string()),
	sourceName: t.string()
});
var RawScopedTypeNameV9 = t.object("RawScopedTypeNameV9", {
	scope: t.array(t.string()),
	name: t.string()
});
var RawSequenceDefV10 = t.object("RawSequenceDefV10", {
	sourceName: t.option(t.string()),
	column: t.u16(),
	start: t.option(t.i128()),
	minValue: t.option(t.i128()),
	maxValue: t.option(t.i128()),
	increment: t.i128()
});
var RawSequenceDefV8 = t.object("RawSequenceDefV8", {
	sequenceName: t.string(),
	colPos: t.u16(),
	increment: t.i128(),
	start: t.option(t.i128()),
	minValue: t.option(t.i128()),
	maxValue: t.option(t.i128()),
	allocated: t.i128()
});
var RawSequenceDefV9 = t.object("RawSequenceDefV9", {
	name: t.option(t.string()),
	column: t.u16(),
	start: t.option(t.i128()),
	minValue: t.option(t.i128()),
	maxValue: t.option(t.i128()),
	increment: t.i128()
});
var RawSubmoduleV10 = t.object("RawSubmoduleV10", {
	namespace: t.string(),
	get module() {
		return RawModuleDefV10;
	}
});
var RawTableDefV10 = t.object("RawTableDefV10", {
	sourceName: t.string(),
	productTypeRef: t.u32(),
	primaryKey: t.array(t.u16()),
	get indexes() {
		return t.array(RawIndexDefV10);
	},
	get constraints() {
		return t.array(RawConstraintDefV10);
	},
	get sequences() {
		return t.array(RawSequenceDefV10);
	},
	get tableType() {
		return TableType;
	},
	get tableAccess() {
		return TableAccess;
	},
	get defaultValues() {
		return t.array(RawColumnDefaultValueV10);
	},
	isEvent: t.bool()
});
var RawTableDefV8 = t.object("RawTableDefV8", {
	tableName: t.string(),
	get columns() {
		return t.array(RawColumnDefV8);
	},
	get indexes() {
		return t.array(RawIndexDefV8);
	},
	get constraints() {
		return t.array(RawConstraintDefV8);
	},
	get sequences() {
		return t.array(RawSequenceDefV8);
	},
	tableType: t.string(),
	tableAccess: t.string(),
	scheduled: t.option(t.string())
});
var RawTableDefV9 = t.object("RawTableDefV9", {
	name: t.string(),
	productTypeRef: t.u32(),
	primaryKey: t.array(t.u16()),
	get indexes() {
		return t.array(RawIndexDefV9);
	},
	get constraints() {
		return t.array(RawConstraintDefV9);
	},
	get sequences() {
		return t.array(RawSequenceDefV9);
	},
	get schedule() {
		return t.option(RawScheduleDefV9);
	},
	get tableType() {
		return TableType;
	},
	get tableAccess() {
		return TableAccess;
	}
});
var RawTypeDefV10 = t.object("RawTypeDefV10", {
	get sourceName() {
		return RawScopedTypeNameV10;
	},
	ty: t.u32(),
	customOrdering: t.bool()
});
var RawTypeDefV9 = t.object("RawTypeDefV9", {
	get name() {
		return RawScopedTypeNameV9;
	},
	ty: t.u32(),
	customOrdering: t.bool()
});
var RawUniqueConstraintDataV9 = t.object("RawUniqueConstraintDataV9", { columns: t.array(t.u16()) });
var RawViewDefV10 = t.object("RawViewDefV10", {
	sourceName: t.string(),
	index: t.u32(),
	isPublic: t.bool(),
	isAnonymous: t.bool(),
	get params() {
		return ProductType2;
	},
	get returnType() {
		return AlgebraicType2;
	}
});
var RawViewDefV9 = t.object("RawViewDefV9", {
	name: t.string(),
	index: t.u32(),
	isPublic: t.bool(),
	isAnonymous: t.bool(),
	get params() {
		return ProductType2;
	},
	get returnType() {
		return AlgebraicType2;
	}
});
var RawViewPrimaryKeyDefV10 = t.object("RawViewPrimaryKeyDefV10", {
	viewSourceName: t.string(),
	columns: t.array(t.string())
});
var ReducerDef = t.object("ReducerDef", {
	name: t.string(),
	get args() {
		return t.array(ProductTypeElement);
	}
});
var SumType2 = t.object("SumType", { get variants() {
	return t.array(SumTypeVariant);
} });
var SumTypeVariant = t.object("SumTypeVariant", {
	name: t.option(t.string()),
	get algebraicType() {
		return AlgebraicType2;
	}
});
var TableAccess = t.enum("TableAccess", {
	Public: t.unit(),
	Private: t.unit()
});
var TableDesc = t.object("TableDesc", {
	get schema() {
		return RawTableDefV8;
	},
	data: t.u32()
});
var TableType = t.enum("TableType", {
	System: t.unit(),
	User: t.unit()
});
var TypeAlias = t.object("TypeAlias", {
	name: t.string(),
	ty: t.u32()
});
var Typespace = t.object("Typespace", { get types() {
	return t.array(AlgebraicType2);
} });
var ViewResultHeader = t.enum("ViewResultHeader", {
	RowData: t.unit(),
	RawSql: t.string()
});
function tableToSchema(accName, schema2, tableDef) {
	const getColName = (i) => schema2.rowType.algebraicType.value.elements[i].name;
	const resolvedIndexes = tableDef.indexes.map((idx) => {
		const accessorName = idx.accessorName;
		if (typeof accessorName !== "string" || accessorName.length === 0) throw new TypeError(`Index '${idx.sourceName ?? "<unknown>"}' on table '${tableDef.sourceName}' is missing accessor name`);
		const columnIds = idx.algorithm.tag === "Direct" ? [idx.algorithm.value] : idx.algorithm.value;
		return {
			name: accessorName,
			unique: tableDef.constraints.some((c) => c.data.tag === "Unique" && c.data.value.columns.every((col) => columnIds.includes(col))),
			algorithm: {
				BTree: "btree",
				Hash: "hash",
				Direct: "direct"
			}[idx.algorithm.tag],
			columns: columnIds.map(getColName)
		};
	});
	return {
		sourceName: schema2.tableName || accName,
		accessorName: accName,
		columns: schema2.rowType.row,
		rowType: schema2.rowSpacetimeType,
		indexes: schema2.idxs,
		constraints: tableDef.constraints.map((c) => ({
			name: c.sourceName,
			constraint: "unique",
			columns: c.data.value.columns.map(getColName)
		})),
		resolvedIndexes,
		tableDef,
		...tableDef.isEvent ? { isEvent: true } : {}
	};
}
var ModuleContext = class {
	#compoundTypes = /* @__PURE__ */ new Map();
	/**
	* The global module definition that gets populated by calls to `reducer()` and lifecycle hooks.
	*/
	#moduleDef = {
		typespace: { types: [] },
		tables: [],
		reducers: [],
		types: [],
		rowLevelSecurity: [],
		schedules: [],
		procedures: [],
		views: [],
		viewPrimaryKeys: [],
		lifeCycleReducers: [],
		httpHandlers: [],
		httpRoutes: [],
		caseConversionPolicy: { tag: "SnakeCase" },
		explicitNames: { entries: [] },
		submodules: [],
		environment: []
	};
	get moduleDef() {
		return this.#moduleDef;
	}
	rawModuleDefV10() {
		const sections = [];
		const push = (s) => {
			if (s) sections.push(s);
		};
		const module = this.#moduleDef;
		push(module.typespace && {
			tag: "Typespace",
			value: module.typespace
		});
		push(module.types && {
			tag: "Types",
			value: module.types
		});
		push(module.tables && {
			tag: "Tables",
			value: module.tables
		});
		push(module.reducers && {
			tag: "Reducers",
			value: module.reducers
		});
		push(module.procedures && {
			tag: "Procedures",
			value: module.procedures
		});
		push(module.views && {
			tag: "Views",
			value: module.views
		});
		push(module.viewPrimaryKeys && {
			tag: "ViewPrimaryKeys",
			value: module.viewPrimaryKeys
		});
		push(module.schedules && {
			tag: "Schedules",
			value: module.schedules
		});
		push(module.lifeCycleReducers && {
			tag: "LifeCycleReducers",
			value: module.lifeCycleReducers
		});
		push(module.httpHandlers && {
			tag: "HttpHandlers",
			value: module.httpHandlers
		});
		push(module.httpRoutes && {
			tag: "HttpRoutes",
			value: module.httpRoutes
		});
		push(module.rowLevelSecurity && {
			tag: "RowLevelSecurity",
			value: module.rowLevelSecurity
		});
		push(module.explicitNames && {
			tag: "ExplicitNames",
			value: module.explicitNames
		});
		push(module.caseConversionPolicy && {
			tag: "CaseConversionPolicy",
			value: module.caseConversionPolicy
		});
		push(module.submodules && {
			tag: "Submodules",
			value: module.submodules
		});
		push({
			tag: "Environment",
			value: module.environment
		});
		return { sections };
	}
	addSubmodule(submodule) {
		this.#moduleDef.submodules.push(submodule);
	}
	/**
	* Set the case conversion policy for this module.
	* Called by the settings mechanism.
	*/
	setCaseConversionPolicy(policy) {
		this.#moduleDef.caseConversionPolicy = policy;
	}
	get typespace() {
		return this.#moduleDef.typespace;
	}
	/**
	* Resolves the actual type of a TypeBuilder by following its references until it reaches a non-ref type.
	* @param typespace The typespace to resolve types against.
	* @param typeBuilder The TypeBuilder to resolve.
	* @returns The resolved algebraic type.
	*/
	resolveType(typeBuilder) {
		let ty = typeBuilder.algebraicType;
		while (ty.tag === "Ref") ty = this.typespace.types[ty.value];
		return ty;
	}
	/**
	* Adds a type to the module definition's typespace as a `Ref` if it is a named compound type (Product or Sum).
	* Otherwise, returns the type as is.
	* @param name
	* @param ty
	* @returns
	*/
	registerTypesRecursively(typeBuilder) {
		if (typeBuilder instanceof ProductBuilder && !isUnit(typeBuilder) || typeBuilder instanceof SumBuilder || typeBuilder instanceof RowBuilder) return this.#registerCompoundTypeRecursively(typeBuilder);
		else if (typeBuilder instanceof OptionBuilder) return new OptionBuilder(this.registerTypesRecursively(typeBuilder.value));
		else if (typeBuilder instanceof ResultBuilder) return new ResultBuilder(this.registerTypesRecursively(typeBuilder.ok), this.registerTypesRecursively(typeBuilder.err));
		else if (typeBuilder instanceof ArrayBuilder) return new ArrayBuilder(this.registerTypesRecursively(typeBuilder.element));
		else return typeBuilder;
	}
	#registerCompoundTypeRecursively(typeBuilder) {
		const ty = typeBuilder.algebraicType;
		const name = typeBuilder.typeName;
		if (name === void 0) throw new Error(`Missing type name for ${typeBuilder.constructor.name ?? "TypeBuilder"} ${JSON.stringify(typeBuilder)}`);
		let r = this.#compoundTypes.get(ty);
		if (r != null) return r;
		const newTy = typeBuilder instanceof RowBuilder || typeBuilder instanceof ProductBuilder ? {
			tag: "Product",
			value: { elements: [] }
		} : {
			tag: "Sum",
			value: { variants: [] }
		};
		r = new RefBuilder(this.#moduleDef.typespace.types.length);
		this.#moduleDef.typespace.types.push(newTy);
		this.#compoundTypes.set(ty, r);
		if (typeBuilder instanceof RowBuilder) for (const [name2, elem] of Object.entries(typeBuilder.row)) newTy.value.elements.push({
			name: name2,
			algebraicType: this.registerTypesRecursively(elem.typeBuilder).algebraicType
		});
		else if (typeBuilder instanceof ProductBuilder) for (const [name2, elem] of Object.entries(typeBuilder.elements)) newTy.value.elements.push({
			name: name2,
			algebraicType: this.registerTypesRecursively(elem).algebraicType
		});
		else if (typeBuilder instanceof SumBuilder) for (const [name2, variant] of Object.entries(typeBuilder.variants)) newTy.value.variants.push({
			name: name2,
			algebraicType: this.registerTypesRecursively(variant).algebraicType
		});
		this.#moduleDef.types.push({
			sourceName: splitName(name),
			ty: r.ref,
			customOrdering: true
		});
		return r;
	}
};
function isUnit(typeBuilder) {
	return typeBuilder.typeName == null && typeBuilder.algebraicType.value.elements.length === 0;
}
function splitName(name) {
	const scope = name.split(".");
	return {
		sourceName: scope.pop(),
		scope
	};
}
var textEncoder2 = new TextEncoder();
var textDecoder2 = new TextDecoder("utf-8");
function deserializeMethod(method) {
	switch (method.tag) {
		case "Get": return "GET";
		case "Head": return "HEAD";
		case "Post": return "POST";
		case "Put": return "PUT";
		case "Delete": return "DELETE";
		case "Connect": return "CONNECT";
		case "Options": return "OPTIONS";
		case "Trace": return "TRACE";
		case "Patch": return "PATCH";
		case "Extension": return method.value;
	}
}
var methods = /* @__PURE__ */ new Map([
	["GET", { tag: "Get" }],
	["HEAD", { tag: "Head" }],
	["POST", { tag: "Post" }],
	["PUT", { tag: "Put" }],
	["DELETE", { tag: "Delete" }],
	["CONNECT", { tag: "Connect" }],
	["OPTIONS", { tag: "Options" }],
	["TRACE", { tag: "Trace" }],
	["PATCH", { tag: "Patch" }]
]);
function serializeMethod(method) {
	return methods.get(method?.toUpperCase() ?? "GET") ?? {
		tag: "Extension",
		value: method
	};
}
function serializeHeaders(headers) {
	return { entries: Array.from(headers.entries(), ([name, value]) => ({
		name,
		value: textEncoder2.encode(value)
	})) };
}
function deserializeHeaders(headers) {
	return new Headers(headers.entries.map(({ name, value }) => [name, textDecoder2.decode(value)]));
}
var makeResponse = Symbol("makeResponse");
var SyncResponse = class _SyncResponse {
	#body;
	#inner;
	constructor(body, init) {
		if (body == null) this.#body = null;
		else if (typeof body === "string") this.#body = body;
		else this.#body = new Uint8Array(body).buffer;
		this.#inner = {
			headers: new Headers(init?.headers),
			status: init?.status ?? 200,
			statusText: init?.statusText ?? "",
			type: "default",
			url: null,
			aborted: false,
			version: init?.version ?? { tag: "Http11" }
		};
	}
	static [makeResponse](body, inner) {
		const me = new _SyncResponse(body);
		me.#inner = inner;
		return me;
	}
	get headers() {
		return this.#inner.headers;
	}
	get status() {
		return this.#inner.status;
	}
	get statusText() {
		return this.#inner.statusText;
	}
	get ok() {
		return 200 <= this.#inner.status && this.#inner.status <= 299;
	}
	get url() {
		return this.#inner.url ?? "";
	}
	get type() {
		return this.#inner.type;
	}
	get version() {
		return this.#inner.version;
	}
	arrayBuffer() {
		return this.bytes().buffer;
	}
	bytes() {
		if (this.#body == null) return new Uint8Array();
		else if (typeof this.#body === "string") return textEncoder2.encode(this.#body);
		else return new Uint8Array(this.#body);
	}
	json() {
		return JSON.parse(this.text());
	}
	text() {
		if (this.#body == null) return "";
		else if (typeof this.#body === "string") return this.#body;
		else return textDecoder2.decode(this.#body);
	}
};
var httpHandlerFn = Symbol("SpacetimeDB.httpHandlerFn");
var makeRequest = Symbol("makeRequest");
function coerceRequestBody(body) {
	if (body == null) return null;
	if (typeof body === "string") return body;
	return new Uint8Array(body);
}
function requestBodyToBytes(body) {
	if (body == null) return new Uint8Array();
	if (typeof body === "string") return textEncoder2.encode(body);
	return body;
}
function requestBodyToText(body) {
	if (body == null) return "";
	if (typeof body === "string") return body;
	return textDecoder2.decode(body);
}
var Request = class _Request {
	#body;
	#inner;
	constructor(url, init = {}) {
		this.#body = coerceRequestBody(init.body);
		this.#inner = {
			headers: new Headers(init.headers),
			method: init.method ?? "GET",
			uri: "" + url,
			version: init.version ?? { tag: "Http11" }
		};
	}
	static [makeRequest](body, inner) {
		const me = new _Request(inner.uri);
		me.#body = coerceRequestBody(body);
		me.#inner = inner;
		return me;
	}
	get headers() {
		return this.#inner.headers;
	}
	get method() {
		return this.#inner.method;
	}
	get uri() {
		return this.#inner.uri;
	}
	get url() {
		return this.#inner.uri;
	}
	get version() {
		return this.#inner.version;
	}
	arrayBuffer() {
		return this.bytes().buffer;
	}
	bytes() {
		return requestBodyToBytes(this.#body);
	}
	json() {
		return JSON.parse(this.text());
	}
	text() {
		return requestBodyToText(this.#body);
	}
};
var exportedHttpHandlerObjects = /* @__PURE__ */ new WeakSet();
function makeHttpHandlerExport(ctx, opts, fn) {
	const handlerExport = Object.assign((...args) => fn(...args), {
		[httpHandlerFn]: fn,
		[exportContext]: ctx,
		[registerExport](ctx2, exportName) {
			if (exportedHttpHandlerObjects.has(handlerExport)) throw new TypeError(`HTTP handler '${exportName}' was exported more than once`);
			exportedHttpHandlerObjects.add(handlerExport);
			registerHttpHandler(ctx2, exportName, fn, opts);
			ctx2.httpHandlerExports.set(handlerExport, exportName);
		}
	});
	return handlerExport;
}
function makeHttpRouterExport(ctx, router) {
	return {
		[exportContext]: ctx,
		[registerExport](ctx2) {
			ctx2.pendingHttpRoutes.push(...router.intoRoutes());
		}
	};
}
function registerHttpHandler(ctx, exportName, fn, opts) {
	ctx.defineHttpHandler(exportName);
	ctx.moduleDef.httpHandlers.push({ sourceName: exportName });
	if (opts?.name != null) ctx.moduleDef.explicitNames.entries.push({
		tag: "Function",
		value: {
			sourceName: exportName,
			canonicalName: opts.name
		}
	});
	if (!fn.name) Object.defineProperty(fn, "name", {
		value: exportName,
		writable: false
	});
	ctx.httpHandlers.push(fn);
}
var import_statuses = __toESM(require_statuses());
var Range = class {
	#from;
	#to;
	constructor(from, to) {
		this.#from = from ?? { tag: "unbounded" };
		this.#to = to ?? { tag: "unbounded" };
	}
	get from() {
		return this.#from;
	}
	get to() {
		return this.#to;
	}
};
function table(opts, row, ..._) {
	const { name, public: isPublic = false, indexes: userIndexes = [], scheduled, event: isEvent = false } = opts;
	const colIds = /* @__PURE__ */ new Map();
	const colNameList = [];
	if (!(row instanceof RowBuilder)) row = new RowBuilder(row);
	row.algebraicType.value.elements.forEach((elem, i) => {
		colIds.set(elem.name, i);
		colNameList.push(elem.name);
	});
	const pk = [];
	const indexes = [];
	const constraints = [];
	const sequences = [];
	let scheduleAtCol;
	const defaultValues = [];
	for (const [name2, builder] of Object.entries(row.row)) {
		const meta = builder.columnMetadata;
		if (meta.isPrimaryKey) pk.push(colIds.get(name2));
		const isUnique = meta.isUnique || meta.isPrimaryKey;
		if (meta.indexType || isUnique) {
			const algo = meta.indexType ?? "btree";
			const id = colIds.get(name2);
			let algorithm;
			switch (algo) {
				case "btree":
					algorithm = RawIndexAlgorithm.BTree([id]);
					break;
				case "hash":
					algorithm = RawIndexAlgorithm.Hash([id]);
					break;
				case "direct":
					algorithm = RawIndexAlgorithm.Direct(id);
					break;
			}
			indexes.push({
				sourceName: void 0,
				accessorName: name2,
				algorithm
			});
		}
		if (isUnique) constraints.push({
			sourceName: void 0,
			data: {
				tag: "Unique",
				value: { columns: [colIds.get(name2)] }
			}
		});
		if (meta.isAutoIncrement) sequences.push({
			sourceName: void 0,
			start: void 0,
			minValue: void 0,
			maxValue: void 0,
			column: colIds.get(name2),
			increment: 1n
		});
		if (Object.prototype.hasOwnProperty.call(meta, "defaultValue")) {
			const writer = new BinaryWriter(16);
			builder.serialize(writer, meta.defaultValue);
			defaultValues.push({
				colId: colIds.get(name2),
				value: writer.getBuffer()
			});
		}
		const algebraicType = builder.typeBuilder.algebraicType;
		if (schedule_at_default.isScheduleAt(algebraicType)) scheduleAtCol = colIds.get(name2);
	}
	for (const indexOpts of userIndexes ?? []) {
		const accessor = indexOpts.accessor;
		if (typeof accessor !== "string" || accessor.length === 0) {
			const tableLabel = name ?? "<unnamed>";
			const indexLabel = indexOpts.name ?? "<unnamed>";
			throw new TypeError(`Index '${indexLabel}' on table '${tableLabel}' must define a non-empty 'accessor'`);
		}
		let algorithm;
		switch (indexOpts.algorithm) {
			case "btree":
				algorithm = {
					tag: "BTree",
					value: indexOpts.columns.map((c) => colIds.get(c))
				};
				break;
			case "hash":
				algorithm = {
					tag: "Hash",
					value: indexOpts.columns.map((c) => colIds.get(c))
				};
				break;
			case "direct":
				algorithm = {
					tag: "Direct",
					value: colIds.get(indexOpts.column)
				};
				break;
		}
		indexes.push({
			sourceName: void 0,
			accessorName: accessor,
			algorithm,
			canonicalName: indexOpts.name
		});
	}
	for (const constraintOpts of opts.constraints ?? []) if (constraintOpts.constraint === "unique") {
		const data = {
			tag: "Unique",
			value: { columns: constraintOpts.columns.map((c) => colIds.get(c)) }
		};
		constraints.push({
			sourceName: constraintOpts.name,
			data
		});
		continue;
	}
	const productType = row.algebraicType.value;
	return {
		rowType: row,
		tableName: name,
		rowSpacetimeType: productType,
		tableDef: (ctx, accName) => {
			const tableName = name ?? accName;
			if (row.typeName === void 0) row.typeName = toPascalCase(tableName);
			for (const index of indexes) {
				const sourceName = index.sourceName = `${accName}_${(index.algorithm.tag === "Direct" ? [index.algorithm.value] : index.algorithm.value).map((i) => colNameList[i]).join("_")}_idx_${index.algorithm.tag.toLowerCase()}`;
				const { canonicalName } = index;
				if (canonicalName !== void 0) ctx.moduleDef.explicitNames.entries.push(ExplicitNameEntry.Index({
					sourceName,
					canonicalName
				}));
			}
			return {
				sourceName: accName,
				productTypeRef: ctx.registerTypesRecursively(row).ref,
				primaryKey: pk,
				indexes,
				constraints,
				sequences,
				tableType: { tag: "User" },
				tableAccess: { tag: isPublic ? "Public" : "Private" },
				defaultValues,
				isEvent
			};
		},
		idxs: userIndexes,
		constraints,
		scheduleAtCol,
		schedule: scheduled && scheduleAtCol !== void 0 ? {
			scheduleAtCol,
			reducer: scheduled
		} : void 0
	};
}
var QueryBrand = Symbol("QueryBrand");
var isRowTypedQuery = (val) => !!val && typeof val === "object" && QueryBrand in val;
function toSql(q) {
	return q.toSql();
}
var SemijoinImpl = class _SemijoinImpl {
	constructor(sourceQuery, filterQuery, joinCondition) {
		this.sourceQuery = sourceQuery;
		this.filterQuery = filterQuery;
		this.joinCondition = joinCondition;
		if (sourceQuery.table.sourceName === filterQuery.table.sourceName) throw new Error("Cannot semijoin a table to itself");
	}
	[QueryBrand] = true;
	type = "semijoin";
	build() {
		return this;
	}
	where(predicate) {
		return new _SemijoinImpl(this.sourceQuery.where(predicate), this.filterQuery, this.joinCondition);
	}
	toSql() {
		const left = this.filterQuery;
		const right = this.sourceQuery;
		const leftTable = quoteIdentifier(left.table.sourceName);
		const rightTable = quoteIdentifier(right.table.sourceName);
		let sql = `SELECT ${rightTable}.* FROM ${leftTable} JOIN ${rightTable} ON ${booleanExprToSql(this.joinCondition)}`;
		const clauses = [];
		if (left.whereClause) clauses.push(booleanExprToSql(left.whereClause));
		if (right.whereClause) clauses.push(booleanExprToSql(right.whereClause));
		if (clauses.length > 0) {
			const whereSql = clauses.length === 1 ? clauses[0] : clauses.map(wrapInParens).join(" AND ");
			sql += ` WHERE ${whereSql}`;
		}
		return sql;
	}
};
var FromBuilder = class _FromBuilder {
	constructor(table2, whereClause) {
		this.table = table2;
		this.whereClause = whereClause;
	}
	[QueryBrand] = true;
	where(predicate) {
		const newCondition = normalizePredicateExpr(predicate(this.table.cols));
		const nextWhere = this.whereClause ? this.whereClause.and(newCondition) : newCondition;
		return new _FromBuilder(this.table, nextWhere);
	}
	rightSemijoin(right, on) {
		const sourceQuery = new _FromBuilder(right);
		const joinCondition = on(this.table.indexedCols, right.indexedCols);
		return new SemijoinImpl(sourceQuery, this, joinCondition);
	}
	leftSemijoin(right, on) {
		const filterQuery = new _FromBuilder(right);
		const joinCondition = on(this.table.indexedCols, right.indexedCols);
		return new SemijoinImpl(this, filterQuery, joinCondition);
	}
	toSql() {
		return renderSelectSqlWithJoins(this.table, this.whereClause);
	}
	build() {
		return this;
	}
};
var TableRefImpl = class {
	[QueryBrand] = true;
	type = "table";
	sourceName;
	accessorName;
	cols;
	indexedCols;
	tableDef;
	get columns() {
		return this.tableDef.columns;
	}
	get indexes() {
		return this.tableDef.indexes;
	}
	get rowType() {
		return this.tableDef.rowType;
	}
	get constraints() {
		return this.tableDef.constraints;
	}
	constructor(tableDef) {
		this.sourceName = tableDef.sourceName;
		this.accessorName = tableDef.accessorName;
		this.cols = createRowExpr(tableDef);
		this.indexedCols = this.cols;
		this.tableDef = tableDef;
		Object.freeze(this);
	}
	asFrom() {
		return new FromBuilder(this);
	}
	rightSemijoin(other, on) {
		return this.asFrom().rightSemijoin(other, on);
	}
	leftSemijoin(other, on) {
		return this.asFrom().leftSemijoin(other, on);
	}
	build() {
		return this.asFrom().build();
	}
	toSql() {
		return this.asFrom().toSql();
	}
	where(predicate) {
		return this.asFrom().where(predicate);
	}
};
function createTableRefFromDef(tableDef) {
	return new TableRefImpl(tableDef);
}
function makeQueryBuilder(schema2) {
	const qb = /* @__PURE__ */ Object.create(null);
	for (const table2 of Object.values(schema2.tables)) {
		const ref = createTableRefFromDef(table2);
		qb[table2.accessorName] = ref;
	}
	return Object.freeze(qb);
}
function createRowExpr(tableDef) {
	const row = {};
	for (const columnName of Object.keys(tableDef.columns)) {
		const columnBuilder = tableDef.columns[columnName];
		const column = new ColumnExpression(tableDef.sourceName, columnName, columnBuilder.typeBuilder.algebraicType, columnBuilder.columnMetadata.name);
		row[columnName] = Object.freeze(column);
	}
	return Object.freeze(row);
}
function renderSelectSqlWithJoins(table2, where, extraClauses = []) {
	const sql = `SELECT * FROM ${quoteIdentifier(table2.sourceName)}`;
	const clauses = [];
	if (where) clauses.push(booleanExprToSql(where));
	clauses.push(...extraClauses);
	if (clauses.length === 0) return sql;
	return `${sql} WHERE ${clauses.length === 1 ? clauses[0] : clauses.map(wrapInParens).join(" AND ")}`;
}
var ColumnExpression = class {
	type = "column";
	column;
	columnName;
	table;
	tsValueType;
	spacetimeType;
	constructor(table2, column, spacetimeType, columnName) {
		this.table = table2;
		this.column = column;
		this.columnName = columnName || column;
		this.spacetimeType = spacetimeType;
	}
	eq(x) {
		return new BooleanExpr({
			type: "eq",
			left: this,
			right: normalizeValue(x)
		});
	}
	ne(x) {
		return new BooleanExpr({
			type: "ne",
			left: this,
			right: normalizeValue(x)
		});
	}
	lt(x) {
		return new BooleanExpr({
			type: "lt",
			left: this,
			right: normalizeValue(x)
		});
	}
	lte(x) {
		return new BooleanExpr({
			type: "lte",
			left: this,
			right: normalizeValue(x)
		});
	}
	gt(x) {
		return new BooleanExpr({
			type: "gt",
			left: this,
			right: normalizeValue(x)
		});
	}
	gte(x) {
		return new BooleanExpr({
			type: "gte",
			left: this,
			right: normalizeValue(x)
		});
	}
};
function literal(value) {
	return {
		type: "literal",
		value
	};
}
function normalizeValue(val) {
	if (val.type === "literal") return val;
	if (typeof val === "object" && val != null && "type" in val && val.type === "column") return val;
	return literal(val);
}
function normalizePredicateExpr(value) {
	if (value instanceof BooleanExpr) return value;
	if (typeof value === "boolean") return new BooleanExpr({
		type: "eq",
		left: literal(value),
		right: literal(true)
	});
	return new BooleanExpr({
		type: "eq",
		left: value,
		right: literal(true)
	});
}
var BooleanExpr = class _BooleanExpr {
	constructor(data) {
		this.data = data;
	}
	and(other) {
		return new _BooleanExpr({
			type: "and",
			clauses: [this.data, other.data]
		});
	}
	or(other) {
		return new _BooleanExpr({
			type: "or",
			clauses: [this.data, other.data]
		});
	}
	not() {
		return new _BooleanExpr({
			type: "not",
			clause: this.data
		});
	}
};
function booleanExprToSql(expr, tableAlias) {
	const data = expr instanceof BooleanExpr ? expr.data : expr;
	switch (data.type) {
		case "eq": return `${valueExprToSql(data.left)} = ${valueExprToSql(data.right)}`;
		case "ne": return `${valueExprToSql(data.left)} <> ${valueExprToSql(data.right)}`;
		case "gt": return `${valueExprToSql(data.left)} > ${valueExprToSql(data.right)}`;
		case "gte": return `${valueExprToSql(data.left)} >= ${valueExprToSql(data.right)}`;
		case "lt": return `${valueExprToSql(data.left)} < ${valueExprToSql(data.right)}`;
		case "lte": return `${valueExprToSql(data.left)} <= ${valueExprToSql(data.right)}`;
		case "and": return data.clauses.map((c) => booleanExprToSql(c)).map(wrapInParens).join(" AND ");
		case "or": return data.clauses.map((c) => booleanExprToSql(c)).map(wrapInParens).join(" OR ");
		case "not": return `NOT ${wrapInParens(booleanExprToSql(data.clause))}`;
	}
}
function wrapInParens(sql) {
	return `(${sql})`;
}
function valueExprToSql(expr, tableAlias) {
	if (isLiteralExpr(expr)) return literalValueToSql(expr.value);
	const table2 = expr.table;
	return `${quoteIdentifier(table2)}.${quoteIdentifier(expr.columnName)}`;
}
function literalValueToSql(value) {
	if (value === null || value === void 0) return "NULL";
	if (value instanceof Identity || value instanceof ConnectionId || value instanceof Uuid) return `0x${value.toHexString()}`;
	if (value instanceof Timestamp) return `'${value.toISOString()}'`;
	switch (typeof value) {
		case "number":
		case "bigint": return String(value);
		case "boolean": return value ? "TRUE" : "FALSE";
		case "string": return `'${value.replace(/'/g, "''")}'`;
		default: return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
	}
}
function quoteIdentifier(name) {
	return name.split(".").map((part) => `"${part.replace(/"/g, "\"\"")}"`).join(".");
}
function isLiteralExpr(expr) {
	return expr.type === "literal";
}
function makeViewExport(ctx, opts, params, ret, fn) {
	const viewExport = fn.bind();
	viewExport[exportContext] = ctx;
	viewExport[registerExport] = (ctx2, exportName) => {
		registerView(ctx2, opts, exportName, params, ret, fn);
	};
	return viewExport;
}
function makeAnonViewExport(ctx, opts, params, ret, fn) {
	const viewExport = fn.bind();
	viewExport[exportContext] = ctx;
	viewExport[registerExport] = (ctx2, exportName) => {
		registerAnonymousView(ctx2, opts, exportName, params, ret, fn);
	};
	return viewExport;
}
function registerView(ctx, opts, exportName, params, ret, fn) {
	const described = describeView(ctx, opts, exportName, false, params, ret);
	ctx.views.push(buildViewInfo(ctx, described, fn));
}
function registerAnonymousView(ctx, opts, exportName, params, ret, fn) {
	const described = describeView(ctx, opts, exportName, true, params, ret);
	ctx.anonViews.push(buildViewInfo(ctx, described, fn));
}
function describeView(ctx, opts, exportName, anon, params, ret) {
	ctx.defineFunction(exportName);
	const paramsBuilder = new RowBuilder(params, toPascalCase(exportName));
	let returnType = ctx.registerTypesRecursively(ret).algebraicType;
	const { value: paramType } = ctx.resolveType(ctx.registerTypesRecursively(paramsBuilder));
	ctx.moduleDef.views.push({
		sourceName: exportName,
		index: (anon ? ctx.anonViews : ctx.views).length,
		isPublic: opts.public,
		isAnonymous: anon,
		params: paramType,
		returnType
	});
	const primaryKeyColumns = viewPrimaryKeyColumns(ret);
	if (primaryKeyColumns.length > 1) throw new TypeError(`View '${exportName}' can have at most one primaryKey() column on its returned row type; found ${primaryKeyColumns.join(", ")}`);
	if (primaryKeyColumns.length === 1 && paramType.elements.length === 0) ctx.moduleDef.viewPrimaryKeys.push({
		viewSourceName: exportName,
		columns: primaryKeyColumns
	});
	if (opts.name != null) ctx.moduleDef.explicitNames.entries.push({
		tag: "Function",
		value: {
			sourceName: exportName,
			canonicalName: opts.name
		}
	});
	const wrapOption = returnType.tag == "Sum";
	if (returnType.tag == "Sum") returnType = AlgebraicType.Array(returnType.value.variants[0].algebraicType);
	return {
		paramType,
		returnType,
		wrapOption
	};
}
function buildViewInfo(ctx, { paramType, returnType, wrapOption }, fn) {
	const { typespace } = ctx;
	return {
		fn: wrapOption ? ((viewCtx, args) => {
			const ret = fn(viewCtx, args);
			return ret == null ? [] : [ret];
		}) : fn,
		deserializeParams: ProductType.makeDeserializer(paramType, typespace),
		serializeReturn: AlgebraicType.makeSerializer(returnType, typespace),
		returnTypeBaseSize: bsatnBaseSize(typespace, returnType)
	};
}
function viewPrimaryKeyColumns(ret) {
	const row = viewReturnRow(ret);
	if (row == null) return [];
	return Object.entries(row.row).filter((entry) => entry[1].columnMetadata.isPrimaryKey === true).map(([name]) => name);
}
function viewReturnRow(ret) {
	if (ret instanceof ArrayBuilder && ret.element instanceof RowBuilder) return ret.element;
	if (ret instanceof OptionBuilder && ret.value instanceof RowBuilder) return ret.value;
}
var SenderError = class extends Error {
	constructor(message) {
		super(message);
	}
	get name() {
		return "SenderError";
	}
};
var SpacetimeHostError = class extends Error {
	constructor(message) {
		super(message);
	}
	get name() {
		return "SpacetimeHostError";
	}
};
var errorData = {
	HostCallFailure: 1,
	NotInTransaction: 2,
	BsatnDecodeError: 3,
	NoSuchTable: 4,
	NoSuchIndex: 5,
	NoSuchIter: 6,
	NoSuchConsoleTimer: 7,
	NoSuchBytes: 8,
	NoSpace: 9,
	BufferTooSmall: 11,
	UniqueAlreadyExists: 12,
	ScheduleAtDelayTooLong: 13,
	IndexNotUnique: 14,
	NoSuchRow: 15,
	AutoIncOverflow: 16,
	WouldBlockTransaction: 17,
	TransactionNotAnonymous: 18,
	TransactionIsReadOnly: 19,
	TransactionIsMut: 20,
	HttpError: 21
};
function mapEntries(x, f) {
	return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, f(k, v)]));
}
var errnoToClass = /* @__PURE__ */ new Map();
var errors = Object.freeze(mapEntries(errorData, (name, code) => {
	const cls = Object.defineProperty(class extends SpacetimeHostError {
		get name() {
			return name;
		}
	}, "name", {
		value: name,
		writable: false
	});
	errnoToClass.set(code, cls);
	return cls;
}));
function getErrorConstructor(code) {
	return errnoToClass.get(code) ?? SpacetimeHostError;
}
var SBigInt = typeof BigInt !== "undefined" ? BigInt : void 0;
var One = typeof BigInt !== "undefined" ? BigInt(1) : void 0;
var ThirtyTwo = typeof BigInt !== "undefined" ? BigInt(32) : void 0;
var NumValues = typeof BigInt !== "undefined" ? BigInt(4294967296) : void 0;
function unsafeUniformBigIntDistribution(from, to, rng) {
	var diff = to - from + One;
	var FinalNumValues = NumValues;
	var NumIterations = 1;
	while (FinalNumValues < diff) {
		FinalNumValues <<= ThirtyTwo;
		++NumIterations;
	}
	var value = generateNext(NumIterations, rng);
	if (value < diff) return value + from;
	if (value + diff < FinalNumValues) return value % diff + from;
	var MaxAcceptedRandom = FinalNumValues - FinalNumValues % diff;
	while (value >= MaxAcceptedRandom) value = generateNext(NumIterations, rng);
	return value % diff + from;
}
function generateNext(NumIterations, rng) {
	var value = SBigInt(rng.unsafeNext() + 2147483648);
	for (var num = 1; num < NumIterations; ++num) {
		var out = rng.unsafeNext();
		value = (value << ThirtyTwo) + SBigInt(out + 2147483648);
	}
	return value;
}
function unsafeUniformIntDistributionInternal(rangeSize, rng) {
	var MaxAllowed = rangeSize > 2 ? ~~(4294967296 / rangeSize) * rangeSize : 4294967296;
	var deltaV = rng.unsafeNext() + 2147483648;
	while (deltaV >= MaxAllowed) deltaV = rng.unsafeNext() + 2147483648;
	return deltaV % rangeSize;
}
function fromNumberToArrayInt64(out, n) {
	if (n < 0) {
		var posN = -n;
		out.sign = -1;
		out.data[0] = ~~(posN / 4294967296);
		out.data[1] = posN >>> 0;
	} else {
		out.sign = 1;
		out.data[0] = ~~(n / 4294967296);
		out.data[1] = n >>> 0;
	}
	return out;
}
function substractArrayInt64(out, arrayIntA, arrayIntB) {
	var lowA = arrayIntA.data[1];
	var highA = arrayIntA.data[0];
	var signA = arrayIntA.sign;
	var lowB = arrayIntB.data[1];
	var highB = arrayIntB.data[0];
	var signB = arrayIntB.sign;
	out.sign = 1;
	if (signA === 1 && signB === -1) {
		var low_1 = lowA + lowB;
		var high = highA + highB + (low_1 > 4294967295 ? 1 : 0);
		out.data[0] = high >>> 0;
		out.data[1] = low_1 >>> 0;
		return out;
	}
	var lowFirst = lowA;
	var highFirst = highA;
	var lowSecond = lowB;
	var highSecond = highB;
	if (signA === -1) {
		lowFirst = lowB;
		highFirst = highB;
		lowSecond = lowA;
		highSecond = highA;
	}
	var reminderLow = 0;
	var low = lowFirst - lowSecond;
	if (low < 0) {
		reminderLow = 1;
		low = low >>> 0;
	}
	out.data[0] = highFirst - highSecond - reminderLow;
	out.data[1] = low;
	return out;
}
function unsafeUniformArrayIntDistributionInternal(out, rangeSize, rng) {
	var rangeLength = rangeSize.length;
	while (true) {
		for (var index = 0; index !== rangeLength; ++index) out[index] = unsafeUniformIntDistributionInternal(index === 0 ? rangeSize[0] + 1 : 4294967296, rng);
		for (var index = 0; index !== rangeLength; ++index) {
			var current = out[index];
			var currentInRange = rangeSize[index];
			if (current < currentInRange) return out;
			else if (current > currentInRange) break;
		}
	}
}
var safeNumberMaxSafeInteger = Number.MAX_SAFE_INTEGER;
var sharedA = {
	sign: 1,
	data: [0, 0]
};
var sharedB = {
	sign: 1,
	data: [0, 0]
};
var sharedC = {
	sign: 1,
	data: [0, 0]
};
var sharedData = [0, 0];
function uniformLargeIntInternal(from, to, rangeSize, rng) {
	var rangeSizeArrayIntValue = rangeSize <= safeNumberMaxSafeInteger ? fromNumberToArrayInt64(sharedC, rangeSize) : substractArrayInt64(sharedC, fromNumberToArrayInt64(sharedA, to), fromNumberToArrayInt64(sharedB, from));
	if (rangeSizeArrayIntValue.data[1] === 4294967295) {
		rangeSizeArrayIntValue.data[0] += 1;
		rangeSizeArrayIntValue.data[1] = 0;
	} else rangeSizeArrayIntValue.data[1] += 1;
	unsafeUniformArrayIntDistributionInternal(sharedData, rangeSizeArrayIntValue.data, rng);
	return sharedData[0] * 4294967296 + sharedData[1] + from;
}
function unsafeUniformIntDistribution(from, to, rng) {
	var rangeSize = to - from;
	if (rangeSize <= 4294967295) return unsafeUniformIntDistributionInternal(rangeSize + 1, rng) + from;
	return uniformLargeIntInternal(from, to, rangeSize, rng);
}
var XoroShiro128Plus = (function() {
	function XoroShiro128Plus2(s01, s00, s11, s10) {
		this.s01 = s01;
		this.s00 = s00;
		this.s11 = s11;
		this.s10 = s10;
	}
	XoroShiro128Plus2.prototype.clone = function() {
		return new XoroShiro128Plus2(this.s01, this.s00, this.s11, this.s10);
	};
	XoroShiro128Plus2.prototype.next = function() {
		var nextRng = new XoroShiro128Plus2(this.s01, this.s00, this.s11, this.s10);
		return [nextRng.unsafeNext(), nextRng];
	};
	XoroShiro128Plus2.prototype.unsafeNext = function() {
		var out = this.s00 + this.s10 | 0;
		var a0 = this.s10 ^ this.s00;
		var a1 = this.s11 ^ this.s01;
		var s00 = this.s00;
		var s01 = this.s01;
		this.s00 = s00 << 24 ^ s01 >>> 8 ^ a0 ^ a0 << 16;
		this.s01 = s01 << 24 ^ s00 >>> 8 ^ a1 ^ (a1 << 16 | a0 >>> 16);
		this.s10 = a1 << 5 ^ a0 >>> 27;
		this.s11 = a0 << 5 ^ a1 >>> 27;
		return out;
	};
	XoroShiro128Plus2.prototype.jump = function() {
		var nextRng = new XoroShiro128Plus2(this.s01, this.s00, this.s11, this.s10);
		nextRng.unsafeJump();
		return nextRng;
	};
	XoroShiro128Plus2.prototype.unsafeJump = function() {
		var ns01 = 0;
		var ns00 = 0;
		var ns11 = 0;
		var ns10 = 0;
		var jump = [
			3639956645,
			3750757012,
			1261568508,
			386426335
		];
		for (var i = 0; i !== 4; ++i) for (var mask = 1; mask; mask <<= 1) {
			if (jump[i] & mask) {
				ns01 ^= this.s01;
				ns00 ^= this.s00;
				ns11 ^= this.s11;
				ns10 ^= this.s10;
			}
			this.unsafeNext();
		}
		this.s01 = ns01;
		this.s00 = ns00;
		this.s11 = ns11;
		this.s10 = ns10;
	};
	XoroShiro128Plus2.prototype.getState = function() {
		return [
			this.s01,
			this.s00,
			this.s11,
			this.s10
		];
	};
	return XoroShiro128Plus2;
})();
function fromState(state) {
	if (!(state.length === 4)) throw new Error("The state must have been produced by a xoroshiro128plus RandomGenerator");
	return new XoroShiro128Plus(state[0], state[1], state[2], state[3]);
}
var xoroshiro128plus = Object.assign(function(seed) {
	return new XoroShiro128Plus(-1, ~seed, seed | 0, 0);
}, { fromState });
var { asUintN } = BigInt;
function pcg32(state) {
	state = asUintN(64, state * 6364136223846793005n + 11634580027462260723n);
	const xorshifted = Number(asUintN(32, (state >> 18n ^ state) >> 27n));
	const rot = Number(asUintN(32, state >> 59n));
	return xorshifted >> rot | xorshifted << 32 - rot;
}
function generateFloat64(rng) {
	const g1 = unsafeUniformIntDistribution(0, (1 << 26) - 1, rng);
	const g2 = unsafeUniformIntDistribution(0, (1 << 27) - 1, rng);
	return (g1 * Math.pow(2, 27) + g2) * Math.pow(2, -53);
}
function makeRandomFromSeed(seed) {
	const rng = xoroshiro128plus(pcg32(seedToBigInt(seed)));
	const random = () => generateFloat64(rng);
	random.fill = (array) => {
		if (isBigIntArray(array)) {
			const upper = (1n << BigInt(array.BYTES_PER_ELEMENT * 8)) - 1n;
			for (let i = 0; i < array.length; i++) array[i] = unsafeUniformBigIntDistribution(0n, upper, rng);
		} else {
			const upper = Math.pow(2, array.BYTES_PER_ELEMENT * 8) - 1;
			for (let i = 0; i < array.length; i++) array[i] = unsafeUniformIntDistribution(0, upper, rng);
		}
		return array;
	};
	random.shuffle = (array) => {
		for (let currentIndex = array.length - 1; currentIndex > 0; currentIndex--) {
			const swapIndex = random.integerInRange(0, currentIndex);
			[array[currentIndex], array[swapIndex]] = [array[swapIndex], array[currentIndex]];
		}
		return array;
	};
	random.uint32 = () => rng.unsafeNext();
	random.integerInRange = (min, max) => unsafeUniformIntDistribution(min, max, rng);
	random.bigintInRange = (min, max) => unsafeUniformBigIntDistribution(min, max, rng);
	return random;
}
function makeRandom(seed) {
	return makeRandomFromSeed(seed);
}
function seedToBigInt(seed) {
	if (typeof seed === "bigint") return seed;
	if (typeof seed === "number") return BigInt(seed);
	if (seed instanceof Uint8Array) {
		let value = 0n;
		const len = Math.min(seed.byteLength, 8);
		for (let i = 0; i < len; i++) value |= BigInt(seed[i]) << BigInt(i * 8);
		return value;
	}
	return seed.microsSinceUnixEpoch;
}
function isBigIntArray(array) {
	return array instanceof BigInt64Array || array instanceof BigUint64Array;
}
var sys = {
	..._syscalls2_0,
	..._syscalls2_1
};
var hostBackend = {
	identity: sys.identity,
	getJwtPayload: sys.get_jwt_payload,
	tableIdFromName: sys.table_id_from_name,
	indexIdFromName: sys.index_id_from_name,
	datastoreTableRowCount: sys.datastore_table_row_count,
	datastoreTableScanBsatn: sys.datastore_table_scan_bsatn,
	datastoreInsertBsatn: sys.datastore_insert_bsatn,
	datastoreDeleteAllByEqBsatn: sys.datastore_delete_all_by_eq_bsatn,
	datastoreIndexScanPointBsatn: sys.datastore_index_scan_point_bsatn,
	datastoreIndexScanRangeBsatn: sys.datastore_index_scan_range_bsatn,
	datastoreDeleteByIndexScanPointBsatn: sys.datastore_delete_by_index_scan_point_bsatn,
	datastoreDeleteByIndexScanRangeBsatn: sys.datastore_delete_by_index_scan_range_bsatn,
	datastoreUpdateBsatn: sys.datastore_update_bsatn,
	datastoreClear: sys.datastore_clear,
	rowIterBsatnAdvance: sys.row_iter_bsatn_advance,
	rowIterBsatnClose: sys.row_iter_bsatn_close,
	procedureStartMutTx: sys.procedure_start_mut_tx,
	procedureCommitMutTx: sys.procedure_commit_mut_tx,
	procedureAbortMutTx: sys.procedure_abort_mut_tx,
	procedureHttpRequest: sys.procedure_http_request
};
var { freeze } = Object;
var sys2 = {
	..._syscalls2_0,
	..._syscalls2_1
};
function isDatastoreBackend(value) {
	return value !== null && typeof value === "object" && "tableIdFromName" in value && "procedureStartMutTx" in value;
}
function requestFromWire(request, body) {
	return Request[makeRequest](body, {
		headers: deserializeHeaders(request.headers),
		method: deserializeMethod(request.method),
		uri: request.uri,
		version: request.version
	});
}
function responseIntoWire(response) {
	return [{
		headers: serializeHeaders(response.headers),
		version: response.version,
		code: response.status
	}, response.bytes()];
}
function parseJsonObject(json) {
	let value;
	try {
		value = JSON.parse(json);
	} catch {
		throw new Error("Invalid JSON: failed to parse string");
	}
	if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a JSON object at the top level");
	return value;
}
var JwtClaimsImpl = class {
	/**
	* Creates a new JwtClaims instance.
	* @param rawPayload The JWT payload as a raw JSON string.
	* @param identity The identity for this JWT. We are only taking this because we don't have a blake3 implementation (which we need to compute it).
	*/
	constructor(rawPayload, identity) {
		this.rawPayload = rawPayload;
		this.fullPayload = parseJsonObject(rawPayload);
		this._identity = identity;
	}
	fullPayload;
	_identity;
	get identity() {
		return this._identity;
	}
	get subject() {
		return this.fullPayload["sub"];
	}
	get issuer() {
		return this.fullPayload["iss"];
	}
	get audience() {
		const aud = this.fullPayload["aud"];
		if (aud == null) return [];
		return typeof aud === "string" ? [aud] : aud;
	}
};
var AuthCtxImpl = class _AuthCtxImpl {
	isInternal;
	_jwtSource;
	_initializedJWT = false;
	_jwtClaims;
	_senderIdentity;
	constructor(opts) {
		this.isInternal = opts.isInternal;
		this._jwtSource = opts.jwtSource;
		this._senderIdentity = opts.senderIdentity;
	}
	_initializeJWT() {
		if (this._initializedJWT) return;
		this._initializedJWT = true;
		const token = this._jwtSource();
		if (!token) this._jwtClaims = null;
		else this._jwtClaims = new JwtClaimsImpl(token, this._senderIdentity);
		Object.freeze(this);
	}
	/** Lazily compute whether a JWT exists and is parseable. */
	get hasJWT() {
		this._initializeJWT();
		return this._jwtClaims !== null;
	}
	/** Lazily parse the JwtClaims only when accessed. */
	get jwt() {
		this._initializeJWT();
		return this._jwtClaims;
	}
	/** Create a context representing internal (non-user) requests. */
	static internal() {
		return new _AuthCtxImpl({
			isInternal: true,
			jwtSource: () => null,
			senderIdentity: Identity.zero()
		});
	}
	/** If there is a connection id, look up the JWT payload from the system tables. */
	static fromBackend(connectionId, sender, backend) {
		if (connectionId === null) return new _AuthCtxImpl({
			isInternal: false,
			jwtSource: () => null,
			senderIdentity: sender
		});
		return new _AuthCtxImpl({
			isInternal: false,
			jwtSource: () => {
				const payloadBuf = backend.getJwtPayload(connectionId.__connection_id__);
				if (payloadBuf.length === 0) return null;
				return new TextDecoder().decode(payloadBuf);
			},
			senderIdentity: sender
		});
	}
	/** If there is a connection id, look up the JWT payload from the host system tables. */
	static fromSystemTables(connectionId, sender) {
		return _AuthCtxImpl.fromBackend(connectionId, sender, hostBackend);
	}
};
var ReducerCtxImpl = class ReducerCtx {
	#identity;
	#senderAuth;
	#uuidCounter;
	#random;
	#backend;
	sender;
	timestamp;
	connectionId;
	db;
	env = environment;
	as;
	constructor(sender, timestamp, connectionId, dbView, backendOrAsViews = hostBackend, senderAuth, random, asViews = {}) {
		Object.seal(this);
		this.sender = sender;
		this.timestamp = timestamp;
		this.connectionId = connectionId;
		this.db = dbView;
		if (isDatastoreBackend(backendOrAsViews)) {
			this.#backend = backendOrAsViews;
			this.#senderAuth = senderAuth;
			this.#random = random;
		} else {
			this.#backend = hostBackend;
			asViews = backendOrAsViews;
		}
		this.as = asViews;
	}
	/** Reset the `ReducerCtx` to be used for a new transaction */
	static resetHost(me, sender, timestamp, connectionId, dbView, asViews) {
		me.sender = sender;
		me.timestamp = timestamp;
		me.connectionId = connectionId;
		me.#backend = hostBackend;
		me.#senderAuth = void 0;
		me.#random = void 0;
		me.#uuidCounter = void 0;
		if (dbView !== void 0) me.db = dbView;
		if (asViews !== void 0) me.as = asViews;
	}
	/** Reset the `ReducerCtx` to be used with an injectable backend. */
	static reset(me, sender, timestamp, connectionId, backendOrDbView = hostBackend, senderAuth, random, dbView, asViews) {
		me.sender = sender;
		me.timestamp = timestamp;
		me.connectionId = connectionId;
		if (isDatastoreBackend(backendOrDbView)) {
			me.#backend = backendOrDbView;
			me.#senderAuth = senderAuth;
			me.#random = random;
		} else {
			me.#backend = hostBackend;
			me.#senderAuth = void 0;
			me.#random = void 0;
			dbView = backendOrDbView;
			asViews = senderAuth;
		}
		me.#uuidCounter = void 0;
		if (dbView !== void 0) me.db = dbView;
		if (asViews !== void 0) me.as = asViews;
	}
	get databaseIdentity() {
		return this.#identity ??= new Identity(this.#backend.identity());
	}
	get identity() {
		return this.databaseIdentity;
	}
	get senderAuth() {
		return this.#senderAuth ??= AuthCtxImpl.fromBackend(this.connectionId, this.sender, this.#backend);
	}
	get random() {
		return this.#random ??= makeRandom(this.timestamp);
	}
	/**
	* Create a new random {@link Uuid} `v4` using this `ReducerCtx`'s RNG.
	*/
	newUuidV4() {
		const bytes = this.random.fill(new Uint8Array(16));
		return Uuid.fromRandomBytesV4(bytes);
	}
	/**
	* Create a new sortable {@link Uuid} `v7` using this `ReducerCtx`'s RNG, counter,
	* and timestamp.
	*/
	newUuidV7() {
		const bytes = this.random.fill(new Uint8Array(4));
		const counter = this.#uuidCounter ??= { value: 0 };
		return Uuid.fromCounterV7(counter, this.timestamp, bytes);
	}
};
var callUserFunction = function __spacetimedb_end_short_backtrace(fn, ...args) {
	return fn(...args);
};
function runWithTx(makeCtx, body, backend = hostBackend) {
	const run = () => {
		const timestamp = backend.procedureStartMutTx();
		try {
			return body(makeCtx(new Timestamp(timestamp)));
		} catch (e) {
			backend.procedureAbortMutTx();
			throw e;
		}
	};
	let res = run();
	try {
		backend.procedureCommitMutTx();
		return res;
	} catch {}
	console.warn("committing anonymous transaction failed");
	res = run();
	try {
		backend.procedureCommitMutTx();
		return res;
	} catch (e) {
		throw new Error("transaction retry failed again", { cause: e });
	}
}
function flattenSubmoduleDispatches(dispatches, parentPrefix = "") {
	const result = [];
	for (const d of dispatches) {
		const namePrefix = parentPrefix + d.namespace + ".";
		result.push({
			reducerFns: d.reducerFns,
			reducerDefs: d.reducerDefs,
			procedureFns: d.procedureFns,
			procedureDefs: d.procedureDefs,
			anonViewFns: d.anonViewFns,
			viewFns: d.viewFns,
			tables: d.tables,
			schemaTables: d.schemaTables,
			typespace: d.typespace,
			dbView_: void 0,
			queryBuilder_: void 0,
			namePrefix,
			subDispatches: d.subDispatches
		});
		result.push(...flattenSubmoduleDispatches(d.subDispatches, namePrefix));
	}
	return result;
}
var makeHooks = (schema2) => new ModuleHooksImpl(schema2);
var ModuleHooksImpl = class {
	#schema;
	#dbView_;
	#consumerAs_;
	#reducerArgsDeserializers;
	#consumerReducerCount;
	#consumerProcedureCount;
	#flatSubmodules;
	#consumerAnonViewCount;
	#consumerViewCount;
	/** Cache the `ReducerCtx` object to avoid allocating anew for every reducer call. */
	#reducerCtx_;
	/** Per-submodule alias ctx maps, cached lazily (parallel to #flatSubmodules). */
	#submoduleAsViews_ = [];
	constructor(schema2) {
		this.#schema = schema2;
		this.#consumerReducerCount = schema2.reducers.length;
		this.#consumerProcedureCount = schema2.procedures.length;
		this.#consumerAnonViewCount = schema2.anonViews.length;
		this.#consumerViewCount = schema2.views.length;
		this.#flatSubmodules = flattenSubmoduleDispatches(schema2.submoduleDispatchInfos);
		const consumerDeserializers = schema2.moduleDef.reducers.map(({ params }) => ProductType.makeDeserializer(params, schema2.typespace));
		const submoduleDeserializers = this.#flatSubmodules.flatMap(({ reducerDefs, typespace }) => reducerDefs.map(({ params }) => ProductType.makeDeserializer(params, typespace)));
		this.#reducerArgsDeserializers = [...consumerDeserializers, ...submoduleDeserializers];
	}
	get #dbView() {
		if (this.#dbView_ !== void 0) return this.#dbView_;
		const rootTables = Object.values(this.#schema.schemaType.tables).map((table2) => [table2.accessorName, makeTableView(this.#schema.typespace, table2.tableDef)]);
		const submoduleNs = this.#schema.submoduleDispatchInfos.map((dispatch) => [dispatch.namespace, buildDbViewForDispatch(dispatch, dispatch.namespace + ".")]);
		this.#dbView_ = freeze(Object.fromEntries([...rootTables, ...submoduleNs]));
		return this.#dbView_;
	}
	#getSubmoduleDbView(submoduleIdx) {
		const m = this.#flatSubmodules[submoduleIdx];
		return m.dbView_ ??= freeze(Object.fromEntries(m.tables.map(({ accessorName, tableDef }) => [accessorName, makeTableView(m.typespace, tableDef, m.namePrefix)])));
	}
	#getSubmoduleAsViews(submoduleIdx) {
		return this.#submoduleAsViews_[submoduleIdx] ??= buildAliasCtxMap(this.#reducerCtx, this.#flatSubmodules[submoduleIdx].subDispatches, this.#flatSubmodules[submoduleIdx].namePrefix);
	}
	/** Query builder scoped to the submodule's own tables, with namespace-prefixed
	*  source names so generated SQL targets the mounted table names. */
	#getSubmoduleQueryBuilder(submoduleIdx) {
		const m = this.#flatSubmodules[submoduleIdx];
		return m.queryBuilder_ ??= makeQueryBuilder({ tables: Object.fromEntries(Object.entries(m.schemaTables).map(([key, def]) => [key, {
			...def,
			sourceName: m.namePrefix + def.sourceName
		}])) });
	}
	get #reducerCtx() {
		return this.#reducerCtx_ ??= new ReducerCtxImpl(Identity.zero(), Timestamp.UNIX_EPOCH, null, this.#dbView);
	}
	get #consumerAs() {
		return this.#consumerAs_ ??= buildAliasCtxMap(this.#reducerCtx, this.#schema.submoduleDispatchInfos, "");
	}
	__describe_module__() {
		const writer = new BinaryWriter(128);
		RawModuleDef.serialize(writer, RawModuleDef.V10(this.#schema.rawModuleDefV10()));
		return writer.getBuffer();
	}
	__get_error_constructor__(code) {
		return getErrorConstructor(code);
	}
	get __sender_error_class__() {
		return SenderError;
	}
	__call_reducer__(reducerId, sender, connId, timestamp, argsBuf) {
		const deserializeArgs = this.#reducerArgsDeserializers[reducerId];
		BINARY_READER.reset(argsBuf);
		const args = deserializeArgs(BINARY_READER);
		const senderIdentity = new Identity(sender);
		let fn;
		let dbView;
		let asViews;
		if (reducerId < this.#consumerReducerCount) {
			fn = this.#schema.reducers[reducerId];
			dbView = this.#dbView;
			asViews = this.#consumerAs;
		} else {
			let offset = this.#consumerReducerCount;
			for (let i = 0; i < this.#flatSubmodules.length; i++) {
				const m = this.#flatSubmodules[i];
				if (reducerId < offset + m.reducerFns.length) {
					fn = m.reducerFns[reducerId - offset];
					dbView = this.#getSubmoduleDbView(i);
					asViews = this.#getSubmoduleAsViews(i);
					break;
				}
				offset += m.reducerFns.length;
			}
			if (fn === void 0) throw new RangeError(`unknown reducerId ${reducerId}`);
		}
		const ctx = this.#reducerCtx;
		ReducerCtxImpl.resetHost(ctx, senderIdentity, new Timestamp(timestamp), ConnectionId.nullIfZero(new ConnectionId(connId)), dbView, asViews);
		callUserFunction(fn, ctx, args);
	}
	__call_view__(id, sender, argsBuf) {
		const moduleCtx = this.#schema;
		let viewFns;
		let localId;
		let dbView;
		let from;
		if (id < this.#consumerViewCount) {
			viewFns = moduleCtx.views;
			localId = id;
			dbView = this.#dbView;
			from = makeQueryBuilder(moduleCtx.schemaType);
		} else {
			let offset = this.#consumerViewCount;
			let found = false;
			for (let i = 0; i < this.#flatSubmodules.length; i++) {
				const m = this.#flatSubmodules[i];
				if (id < offset + m.viewFns.length) {
					viewFns = m.viewFns;
					localId = id - offset;
					dbView = this.#getSubmoduleDbView(i);
					from = this.#getSubmoduleQueryBuilder(i);
					found = true;
					break;
				}
				offset += m.viewFns.length;
			}
			if (!found) throw new RangeError(`unknown viewId ${id}`);
		}
		const { fn, deserializeParams, serializeReturn, returnTypeBaseSize } = viewFns[localId];
		const ret = callUserFunction(fn, freeze({
			env: environment,
			sender: new Identity(sender),
			db: dbView,
			from
		}), deserializeParams(new BinaryReader(argsBuf)));
		const retBuf = new BinaryWriter(returnTypeBaseSize);
		if (isRowTypedQuery(ret)) {
			const query = toSql(ret);
			ViewResultHeader.serialize(retBuf, ViewResultHeader.RawSql(query));
		} else {
			ViewResultHeader.serialize(retBuf, ViewResultHeader.RowData);
			serializeReturn(retBuf, ret);
		}
		return { data: retBuf.getBuffer() };
	}
	__call_view_anon__(id, argsBuf) {
		const moduleCtx = this.#schema;
		let anonViewFns;
		let localId;
		let dbView;
		let from;
		if (id < this.#consumerAnonViewCount) {
			anonViewFns = moduleCtx.anonViews;
			localId = id;
			dbView = this.#dbView;
			from = makeQueryBuilder(moduleCtx.schemaType);
		} else {
			let offset = this.#consumerAnonViewCount;
			let found = false;
			for (let i = 0; i < this.#flatSubmodules.length; i++) {
				const m = this.#flatSubmodules[i];
				if (id < offset + m.anonViewFns.length) {
					anonViewFns = m.anonViewFns;
					localId = id - offset;
					dbView = this.#getSubmoduleDbView(i);
					from = this.#getSubmoduleQueryBuilder(i);
					found = true;
					break;
				}
				offset += m.anonViewFns.length;
			}
			if (!found) throw new RangeError(`unknown anonViewId ${id}`);
		}
		const { fn, deserializeParams, serializeReturn, returnTypeBaseSize } = anonViewFns[localId];
		const ret = callUserFunction(fn, freeze({
			env: environment,
			db: dbView,
			from
		}), deserializeParams(new BinaryReader(argsBuf)));
		const retBuf = new BinaryWriter(returnTypeBaseSize);
		if (isRowTypedQuery(ret)) {
			const query = toSql(ret);
			ViewResultHeader.serialize(retBuf, ViewResultHeader.RawSql(query));
		} else {
			ViewResultHeader.serialize(retBuf, ViewResultHeader.RowData);
			serializeReturn(retBuf, ret);
		}
		return { data: retBuf.getBuffer() };
	}
	__call_procedure__(id, sender, connection_id, timestamp, args) {
		const senderIdentity = new Identity(sender);
		const connId = ConnectionId.nullIfZero(new ConnectionId(connection_id));
		const ts = new Timestamp(timestamp);
		if (id < this.#consumerProcedureCount) return callProcedure(this.#schema.procedures, id, senderIdentity, connId, ts, args, () => this.#dbView, this.#schema.submoduleDispatchInfos);
		let offset = this.#consumerProcedureCount;
		for (let i = 0; i < this.#flatSubmodules.length; i++) {
			const m = this.#flatSubmodules[i];
			if (id < offset + m.procedureFns.length) return callProcedure(m.procedureFns, id - offset, senderIdentity, connId, ts, args, () => this.#getSubmoduleDbView(i), m.subDispatches, m.namePrefix);
			offset += m.procedureFns.length;
		}
		throw new RangeError(`unknown procedureId ${id}`);
	}
	__call_http_handler__(id, timestamp, request, body) {
		const moduleCtx = this.#schema;
		const handler = moduleCtx.httpHandlers[id];
		const [responseMetadata, responseBody] = responseIntoWire(callUserFunction(handler, new HandlerContextImpl(new Timestamp(timestamp), () => this.#dbView, this.#schema.submoduleDispatchInfos), requestFromWire(HttpRequest.deserialize(new BinaryReader(request)), body)));
		const responseBuf = new BinaryWriter(bsatnBaseSize(moduleCtx.typespace, HttpResponse.algebraicType));
		HttpResponse.serialize(responseBuf, responseMetadata);
		return [responseBuf.getBuffer(), responseBody];
	}
};
var BINARY_WRITER = new BinaryWriter(0);
var BINARY_READER = new BinaryReader(new Uint8Array());
var HandlerContextImpl = class {
	constructor(timestamp, dbView, dispatches = []) {
		this.timestamp = timestamp;
		this.#dbView = dbView;
		this.#dispatches = dispatches;
	}
	env = environment;
	#identity;
	#uuidCounter;
	#random;
	#dbView;
	#dispatches;
	#asViews;
	http = httpClient;
	get identity() {
		return this.#identity ??= new Identity(sys2.identity());
	}
	get random() {
		return this.#random ??= makeRandom(this.timestamp);
	}
	get as() {
		return this.#asViews ??= buildHandlerAliasCtxMap(this, this.#dispatches, "");
	}
	withTx(body) {
		const dispatches = this.#dispatches;
		return runWithTx((timestamp) => {
			const tx = new ReducerCtxImpl(Identity.zero(), timestamp, null, this.#dbView());
			if (dispatches.length > 0) tx.as = buildAliasCtxMap(tx, dispatches, "");
			return tx;
		}, body);
	}
	newUuidV4() {
		const bytes = this.random.fill(new Uint8Array(16));
		return Uuid.fromRandomBytesV4(bytes);
	}
	newUuidV7() {
		const bytes = this.random.fill(new Uint8Array(4));
		const counter = this.#uuidCounter ??= { value: 0 };
		return Uuid.fromCounterV7(counter, this.timestamp, bytes);
	}
};
function buildDbViewForDispatch(dispatch, namePrefix) {
	const tableEntries = dispatch.tables.map(({ accessorName, tableDef }) => [accessorName, makeTableView(dispatch.typespace, tableDef, namePrefix)]);
	const subNsEntries = dispatch.subDispatches.map((sub) => [sub.namespace, buildDbViewForDispatch(sub, namePrefix + sub.namespace + ".")]);
	return freeze(Object.fromEntries([...tableEntries, ...subNsEntries]));
}
function buildAliasCtx(parent, dispatch, namePrefix) {
	return {
		get sender() {
			return parent.sender;
		},
		get databaseIdentity() {
			return parent.databaseIdentity;
		},
		get identity() {
			return parent.identity;
		},
		get timestamp() {
			return parent.timestamp;
		},
		get connectionId() {
			return parent.connectionId;
		},
		get senderAuth() {
			return parent.senderAuth;
		},
		get random() {
			return parent.random;
		},
		newUuidV4() {
			return parent.newUuidV4();
		},
		newUuidV7() {
			return parent.newUuidV7();
		},
		db: buildDbViewForDispatch(dispatch, namePrefix),
		as: buildAliasCtxMap(parent, dispatch.subDispatches, namePrefix)
	};
}
function buildAliasCtxMap(parent, dispatches, parentPrefix) {
	return freeze(Object.fromEntries(dispatches.map((d) => [d.namespace, buildAliasCtx(parent, d, parentPrefix + d.namespace + ".")])));
}
function buildHandlerAliasCtx(parent, dispatch, namePrefix) {
	let nsDb_;
	return {
		get timestamp() {
			return parent.timestamp;
		},
		get http() {
			return parent.http;
		},
		get identity() {
			return parent.identity;
		},
		get random() {
			return parent.random;
		},
		as: buildHandlerAliasCtxMap(parent, dispatch.subDispatches, namePrefix),
		withTx(body) {
			return runWithTx((ts) => {
				const tx = new ReducerCtxImpl(Identity.zero(), ts, null, nsDb_ ??= buildDbViewForDispatch(dispatch, namePrefix));
				assignTxAliasViews(tx, dispatch.subDispatches, namePrefix);
				return tx;
			}, body);
		},
		newUuidV4() {
			return parent.newUuidV4();
		},
		newUuidV7() {
			return parent.newUuidV7();
		}
	};
}
function buildHandlerAliasCtxMap(parent, dispatches, parentPrefix) {
	return freeze(Object.fromEntries(dispatches.map((d) => [d.namespace, buildHandlerAliasCtx(parent, d, parentPrefix + d.namespace + ".")])));
}
function buildProcedureAliasCtx(parent, dispatch, namePrefix) {
	let nsDb_;
	return {
		get sender() {
			return parent.sender;
		},
		get databaseIdentity() {
			return parent.databaseIdentity;
		},
		get identity() {
			return parent.identity;
		},
		get timestamp() {
			return parent.timestamp;
		},
		get connectionId() {
			return parent.connectionId;
		},
		get http() {
			return parent.http;
		},
		get random() {
			return parent.random;
		},
		sleep(duration) {
			return parent.sleep(duration);
		},
		as: buildProcedureAliasCtxMap(parent, dispatch.subDispatches, namePrefix),
		withTx(body) {
			return runWithTx((ts) => {
				const tx = new ReducerCtxImpl(parent.sender, ts, parent.connectionId, nsDb_ ??= buildDbViewForDispatch(dispatch, namePrefix));
				assignTxAliasViews(tx, dispatch.subDispatches, namePrefix);
				return tx;
			}, body);
		},
		newUuidV4() {
			return parent.newUuidV4();
		},
		newUuidV7() {
			return parent.newUuidV7();
		}
	};
}
function buildProcedureAliasCtxMap(parent, dispatches, parentPrefix) {
	return freeze(Object.fromEntries(dispatches.map((d) => [d.namespace, buildProcedureAliasCtx(parent, d, parentPrefix + d.namespace + ".")])));
}
function assignTxAliasViews(tx, dispatches, parentPrefix = "") {
	if (dispatches.length > 0) tx.as = buildAliasCtxMap(tx, dispatches, parentPrefix);
}
function makeTableView(typespace, table2, backendOrNamePrefix = hostBackend, namePrefix = "") {
	const backend = isDatastoreBackend(backendOrNamePrefix) ? backendOrNamePrefix : hostBackend;
	if (typeof backendOrNamePrefix === "string") namePrefix = backendOrNamePrefix;
	const table_id = backend.tableIdFromName(namePrefix + table2.sourceName);
	const rowType = typespace.types[table2.productTypeRef];
	if (rowType.tag !== "Product") throw "impossible";
	const serializeRow = AlgebraicType.makeSerializer(rowType, typespace);
	const deserializeRow = AlgebraicType.makeDeserializer(rowType, typespace);
	const sequences = table2.sequences.map((seq) => {
		const col = rowType.value.elements[seq.column];
		const colType = col.algebraicType;
		let sequenceTrigger;
		switch (colType.tag) {
			case "U8":
			case "I8":
			case "U16":
			case "I16":
			case "U32":
			case "I32":
				sequenceTrigger = 0;
				break;
			case "U64":
			case "I64":
			case "U128":
			case "I128":
			case "U256":
			case "I256":
				sequenceTrigger = 0n;
				break;
			default: throw new TypeError("invalid sequence type");
		}
		return {
			colName: col.name,
			sequenceTrigger,
			deserialize: AlgebraicType.makeDeserializer(colType, typespace)
		};
	});
	const hasAutoIncrement = sequences.length > 0;
	const iter = () => tableIterator(backend.datastoreTableScanBsatn(table_id), deserializeRow, backend);
	const integrateGeneratedColumns = hasAutoIncrement ? (row, ret_buf) => {
		BINARY_READER.reset(ret_buf);
		for (const { colName, deserialize, sequenceTrigger } of sequences) if (row[colName] === sequenceTrigger) row[colName] = deserialize(BINARY_READER);
	} : null;
	const generatedColumnsView = (generated, fallback) => generated instanceof Uint8Array ? new DataView(generated.buffer, generated.byteOffset, generated.byteLength) : fallback;
	const tableMethods = {
		count: () => BigInt(backend.datastoreTableRowCount(table_id)),
		iter,
		[Symbol.iterator]: () => iter(),
		insert: (row) => {
			const buf = LEAF_BUF;
			BINARY_WRITER.reset(buf);
			serializeRow(BINARY_WRITER, row);
			const generated = backend.datastoreInsertBsatn(table_id, buf.buffer, BINARY_WRITER.offset);
			const ret = { ...row };
			integrateGeneratedColumns?.(ret, generatedColumnsView(generated, buf.view));
			return ret;
		},
		delete: (row) => {
			const buf = LEAF_BUF;
			BINARY_WRITER.reset(buf);
			BINARY_WRITER.writeU32(1);
			serializeRow(BINARY_WRITER, row);
			return backend.datastoreDeleteAllByEqBsatn(table_id, buf.buffer, BINARY_WRITER.offset) > 0;
		},
		clear: () => {
			const count = BigInt(backend.datastoreTableRowCount(table_id));
			backend.datastoreClear(table_id);
			return count;
		}
	};
	const tableView = Object.assign(/* @__PURE__ */ Object.create(null), tableMethods);
	for (const indexDef of table2.indexes) {
		const accessorName = indexDef.accessorName;
		const index_id = backend.indexIdFromName(namePrefix + indexDef.sourceName);
		let column_ids;
		let isHashIndex = false;
		switch (indexDef.algorithm.tag) {
			case "Hash":
				isHashIndex = true;
				column_ids = indexDef.algorithm.value;
				break;
			case "BTree":
				column_ids = indexDef.algorithm.value;
				break;
			case "Direct":
				column_ids = [indexDef.algorithm.value];
				break;
		}
		const numColumns = column_ids.length;
		const columnSet = new Set(column_ids);
		const isUnique = table2.constraints.filter((x) => x.data.tag === "Unique").some((x) => {
			const constraintColumns = new Set(x.data.value.columns);
			return [...columnSet].every((column) => constraintColumns.has(column));
		});
		const isPrimaryKey = isUnique && column_ids.length === table2.primaryKey.length && column_ids.every((id, i) => table2.primaryKey[i] === id);
		const indexSerializers = column_ids.map((id) => AlgebraicType.makeSerializer(rowType.value.elements[id].algebraicType, typespace));
		const serializePoint = (buffer, colVal) => {
			BINARY_WRITER.reset(buffer);
			for (let i = 0; i < numColumns; i++) indexSerializers[i](BINARY_WRITER, colVal[i]);
			return BINARY_WRITER.offset;
		};
		const serializeSingleElement = numColumns === 1 ? indexSerializers[0] : null;
		const serializeSinglePoint = serializeSingleElement && ((buffer, colVal) => {
			BINARY_WRITER.reset(buffer);
			serializeSingleElement(BINARY_WRITER, colVal);
			return BINARY_WRITER.offset;
		});
		let index;
		if (isUnique && serializeSinglePoint) {
			const base = {
				find: (colVal) => {
					const buf = LEAF_BUF;
					const point_len = serializeSinglePoint(buf, colVal);
					return tableIterateOne(backend.datastoreIndexScanPointBsatn(index_id, buf.buffer, point_len), deserializeRow, backend);
				},
				delete: (colVal) => {
					const buf = LEAF_BUF;
					const point_len = serializeSinglePoint(buf, colVal);
					return backend.datastoreDeleteByIndexScanPointBsatn(index_id, buf.buffer, point_len) > 0;
				}
			};
			if (isPrimaryKey) base.update = (row) => {
				const buf = LEAF_BUF;
				BINARY_WRITER.reset(buf);
				serializeRow(BINARY_WRITER, row);
				const generated = backend.datastoreUpdateBsatn(table_id, index_id, buf.buffer, BINARY_WRITER.offset);
				integrateGeneratedColumns?.(row, generatedColumnsView(generated, buf.view));
				return row;
			};
			index = base;
		} else if (isUnique) {
			const base = {
				find: (colVal) => {
					if (colVal.length !== numColumns) throw new TypeError("wrong number of elements");
					const buf = LEAF_BUF;
					const point_len = serializePoint(buf, colVal);
					return tableIterateOne(backend.datastoreIndexScanPointBsatn(index_id, buf.buffer, point_len), deserializeRow, backend);
				},
				delete: (colVal) => {
					if (colVal.length !== numColumns) throw new TypeError("wrong number of elements");
					const buf = LEAF_BUF;
					const point_len = serializePoint(buf, colVal);
					return backend.datastoreDeleteByIndexScanPointBsatn(index_id, buf.buffer, point_len) > 0;
				}
			};
			if (isPrimaryKey) base.update = (row) => {
				const buf = LEAF_BUF;
				BINARY_WRITER.reset(buf);
				serializeRow(BINARY_WRITER, row);
				const generated = backend.datastoreUpdateBsatn(table_id, index_id, buf.buffer, BINARY_WRITER.offset);
				integrateGeneratedColumns?.(row, generatedColumnsView(generated, buf.view));
				return row;
			};
			index = base;
		} else if (serializeSinglePoint) {
			const serializeSingleRange = !isHashIndex ? (buffer, range) => {
				BINARY_WRITER.reset(buffer);
				const writer = BINARY_WRITER;
				const writeBound = (bound) => {
					writer.writeU8({
						included: 0,
						excluded: 1,
						unbounded: 2
					}[bound.tag]);
					if (bound.tag !== "unbounded") serializeSingleElement(writer, bound.value);
				};
				writeBound(range.from);
				const rstartLen = writer.offset;
				writeBound(range.to);
				return [
					0,
					0,
					rstartLen,
					writer.offset - rstartLen
				];
			} : null;
			const rawIndex = {
				filter: (range) => {
					const buf = LEAF_BUF;
					if (serializeSingleRange && range instanceof Range) {
						const args = serializeSingleRange(buf, range);
						return tableIterator(backend.datastoreIndexScanRangeBsatn(index_id, buf.buffer, ...args), deserializeRow, backend);
					}
					const point_len = serializeSinglePoint(buf, range);
					return tableIterator(backend.datastoreIndexScanPointBsatn(index_id, buf.buffer, point_len), deserializeRow, backend);
				},
				delete: (range) => {
					const buf = LEAF_BUF;
					if (serializeSingleRange && range instanceof Range) {
						const args = serializeSingleRange(buf, range);
						return backend.datastoreDeleteByIndexScanRangeBsatn(index_id, buf.buffer, ...args);
					}
					const point_len = serializeSinglePoint(buf, range);
					return backend.datastoreDeleteByIndexScanPointBsatn(index_id, buf.buffer, point_len);
				}
			};
			if (isHashIndex) index = rawIndex;
			else index = rawIndex;
		} else if (isHashIndex) index = {
			filter: (range) => {
				const buf = LEAF_BUF;
				const point_len = serializePoint(buf, range);
				return tableIterator(backend.datastoreIndexScanPointBsatn(index_id, buf.buffer, point_len), deserializeRow, backend);
			},
			delete: (range) => {
				const buf = LEAF_BUF;
				const point_len = serializePoint(buf, range);
				return backend.datastoreDeleteByIndexScanPointBsatn(index_id, buf.buffer, point_len);
			}
		};
		else {
			const isCompleteScalarKey = (range) => {
				return range.length === numColumns && !(range[range.length - 1] instanceof Range);
			};
			const serializeRange = (buffer, range) => {
				if (range.length > numColumns) throw new TypeError("too many elements");
				BINARY_WRITER.reset(buffer);
				const writer = BINARY_WRITER;
				const prefix_elems = range.length - 1;
				for (let i = 0; i < prefix_elems; i++) indexSerializers[i](writer, range[i]);
				const rstartOffset = writer.offset;
				const term = range[range.length - 1];
				const serializeTerm = indexSerializers[range.length - 1];
				if (term instanceof Range) {
					const writeBound = (bound) => {
						writer.writeU8({
							included: 0,
							excluded: 1,
							unbounded: 2
						}[bound.tag]);
						if (bound.tag !== "unbounded") serializeTerm(writer, bound.value);
					};
					writeBound(term.from);
					const rstartLen = writer.offset - rstartOffset;
					writeBound(term.to);
					return [
						rstartOffset,
						prefix_elems,
						rstartLen,
						writer.offset - rstartOffset - rstartLen
					];
				} else {
					writer.writeU8(0);
					serializeTerm(writer, term);
					return [
						rstartOffset,
						prefix_elems,
						writer.offset - rstartOffset,
						0
					];
				}
			};
			index = {
				filter: (range) => {
					if (!Array.isArray(range)) range = [range];
					if (isCompleteScalarKey(range)) {
						const buf = LEAF_BUF;
						const point_len = serializePoint(buf, range);
						return tableIterator(backend.datastoreIndexScanPointBsatn(index_id, buf.buffer, point_len), deserializeRow, backend);
					} else {
						const buf = LEAF_BUF;
						const args = serializeRange(buf, range);
						return tableIterator(backend.datastoreIndexScanRangeBsatn(index_id, buf.buffer, ...args), deserializeRow, backend);
					}
				},
				delete: (range) => {
					if (!Array.isArray(range)) range = [range];
					if (isCompleteScalarKey(range)) {
						const buf = LEAF_BUF;
						const point_len = serializePoint(buf, range);
						return backend.datastoreDeleteByIndexScanPointBsatn(index_id, buf.buffer, point_len);
					} else {
						const buf = LEAF_BUF;
						const args = serializeRange(buf, range);
						return backend.datastoreDeleteByIndexScanRangeBsatn(index_id, buf.buffer, ...args);
					}
				}
			};
		}
		if (Object.hasOwn(tableView, accessorName)) freeze(Object.assign(tableView[accessorName], index));
		else tableView[accessorName] = freeze(index);
	}
	return freeze(tableView);
}
function* tableIterator(id, deserialize, backend = hostBackend) {
	const iter = new IteratorHandle(id, backend);
	const iterBuf = takeBuf();
	try {
		let amt;
		while (amt = iter.advance(iterBuf)) {
			const reader = new BinaryReader(iterBuf.view);
			while (reader.offset < amt) yield deserialize(reader);
		}
	} finally {
		iter[Symbol.dispose]();
		returnBuf(iterBuf);
	}
}
function tableIterateOne(id, deserialize, backend = hostBackend) {
	const buf = LEAF_BUF;
	if (advanceIterRaw(id, buf, backend) !== 0) {
		BINARY_READER.reset(buf.view);
		return deserialize(BINARY_READER);
	}
	return null;
}
function advanceIterRaw(id, buf, backend = hostBackend) {
	while (true) try {
		return 0 | backend.rowIterBsatnAdvance(id, buf.buffer);
	} catch (e) {
		if (e && typeof e === "object" && hasOwn(e, "__buffer_too_small__")) {
			buf.grow(e.__buffer_too_small__);
			continue;
		}
		throw e;
	}
}
var DEFAULT_BUFFER_CAPACITY = 32 * 1024 * 2;
var ITER_BUFS = [new ResizableBuffer(DEFAULT_BUFFER_CAPACITY)];
var ITER_BUF_COUNT = 1;
function takeBuf() {
	return ITER_BUF_COUNT ? ITER_BUFS[--ITER_BUF_COUNT] : new ResizableBuffer(DEFAULT_BUFFER_CAPACITY);
}
function returnBuf(buf) {
	ITER_BUFS[ITER_BUF_COUNT++] = buf;
}
var LEAF_BUF = new ResizableBuffer(DEFAULT_BUFFER_CAPACITY);
var IteratorHandle = class _IteratorHandle {
	#id;
	#backend;
	static #finalizationRegistry = new FinalizationRegistry(({ id, backend }) => backend.rowIterBsatnClose(id));
	constructor(id, backend = hostBackend) {
		this.#id = id;
		this.#backend = backend;
		_IteratorHandle.#finalizationRegistry.register(this, {
			id,
			backend
		}, this);
	}
	/** Unregister this object with the finalization registry and return the id */
	#detach() {
		const id = this.#id;
		this.#id = -1;
		_IteratorHandle.#finalizationRegistry.unregister(this);
		return id;
	}
	/** Call `row_iter_bsatn_advance`, returning 0 if this iterator has been exhausted. */
	advance(buf) {
		if (this.#id === -1) return 0;
		const ret = advanceIterRaw(this.#id, buf, this.#backend);
		if (ret <= 0) this.#detach();
		return ret < 0 ? -ret : ret;
	}
	[Symbol.dispose]() {
		if (this.#id >= 0) {
			const id = this.#detach();
			this.#backend.rowIterBsatnClose(id);
		}
	}
};
var { freeze: freeze2 } = Object;
var requestBaseSize = bsatnBaseSize({ types: [] }, HttpRequest.algebraicType);
function fetch(url, init = {}) {
	const method = serializeMethod(init.method);
	const headers = serializeHeaders(new Headers(init.headers));
	const uri = "" + url;
	const request = freeze2({
		method,
		headers,
		timeout: init.timeout,
		uri,
		version: { tag: "Http11" }
	});
	const requestBuf = new BinaryWriter(requestBaseSize);
	HttpRequest.serialize(requestBuf, request);
	const body = init.body == null ? new Uint8Array() : typeof init.body === "string" ? init.body : new Uint8Array(init.body);
	const [responseBuf, responseBody] = sys2.procedure_http_request(requestBuf.getBuffer(), body);
	const response = HttpResponse.deserialize(new BinaryReader(responseBuf));
	return SyncResponse[makeResponse](responseBody, {
		type: "basic",
		url: uri,
		status: response.code,
		statusText: import_statuses.default.message[response.code] ?? "",
		headers: deserializeHeaders(response.headers),
		aborted: false,
		version: response.version
	});
}
freeze2(fetch);
var httpClient = freeze2({ fetch });
function makeProcedureExport(ctx, opts, params, ret, fn) {
	const name = opts?.name;
	const procedureExport = (...args) => fn(...args);
	procedureExport[exportContext] = ctx;
	procedureExport[registerExport] = (ctx2, exportName) => {
		registerProcedure(ctx2, name ?? exportName, params, ret, fn);
		ctx2.functionExports.set(procedureExport, name ?? exportName);
		if (opts?.onSchedule !== void 0) ctx2.pendingSchedules.push({
			table: opts.onSchedule,
			functionName: name ?? exportName
		});
	};
	return procedureExport;
}
function registerProcedure(ctx, exportName, params, ret, fn, opts) {
	ctx.defineFunction(exportName);
	const paramsType = { elements: Object.entries(params).map(([n, c]) => ({
		name: n,
		algebraicType: ctx.registerTypesRecursively("typeBuilder" in c ? c.typeBuilder : c).algebraicType
	})) };
	const returnType = ctx.registerTypesRecursively(ret).algebraicType;
	ctx.moduleDef.procedures.push({
		sourceName: exportName,
		params: paramsType,
		returnType,
		visibility: FunctionVisibility.ClientCallable
	});
	const { typespace } = ctx;
	ctx.procedures.push({
		fn,
		deserializeArgs: ProductType.makeDeserializer(paramsType, typespace),
		serializeReturn: AlgebraicType.makeSerializer(returnType, typespace),
		returnTypeBaseSize: bsatnBaseSize(typespace, returnType)
	});
}
function callProcedure(procedures, id, sender, connectionId, timestamp, argsBuf, dbView, dispatches = [], parentPrefix = "") {
	const { fn, deserializeArgs, serializeReturn, returnTypeBaseSize } = procedures[id];
	const args = deserializeArgs(new BinaryReader(argsBuf));
	const ret = callUserFunction(fn, new ProcedureCtxImpl(sender, timestamp, connectionId, dbView, hostBackend, httpClient, void 0, void 0, void 0, dispatches, parentPrefix), args);
	const retBuf = new BinaryWriter(returnTypeBaseSize);
	serializeReturn(retBuf, ret);
	return retBuf.getBuffer();
}
var ProcedureCtxImpl = class ProcedureCtx {
	constructor(sender, timestamp, connectionId, dbView, backend = hostBackend, http = httpClient, sleep = () => {
		throw new Error("procedure sleep is not available in this runtime");
	}, random, childSeedRandom, dispatches = [], parentPrefix = "") {
		this.sender = sender;
		this.timestamp = timestamp;
		this.connectionId = connectionId;
		this.#dbView = dbView;
		this.#backend = backend;
		this.#http = http;
		this.#sleep = sleep;
		this.#random = random;
		this.#childSeedRandom = childSeedRandom;
		this.#dispatches = dispatches;
		this.#parentPrefix = parentPrefix;
	}
	#identity;
	#uuidCounter;
	#random;
	#dbView;
	#backend;
	#http;
	#sleep;
	#childSeedRandom;
	env = environment;
	#dispatches;
	#parentPrefix;
	#asViews;
	get databaseIdentity() {
		return this.#identity ??= new Identity(this.#backend.identity());
	}
	get identity() {
		return this.databaseIdentity;
	}
	get random() {
		return this.#random ??= makeRandom(this.timestamp);
	}
	get http() {
		return this.#http;
	}
	sleep(duration) {
		this.#sleep(duration);
	}
	get as() {
		return this.#asViews ??= buildProcedureAliasCtxMap(this, this.#dispatches, this.#parentPrefix);
	}
	withTx(body) {
		const txSeed = this.#childSeedRandom?.bigintInRange(0n, (1n << 64n) - 1n);
		const dispatches = this.#dispatches;
		const parentPrefix = this.#parentPrefix;
		return runWithTx((timestamp) => {
			const tx = new ReducerCtxImpl(this.sender, timestamp, this.connectionId, this.#dbView(), this.#backend, void 0, txSeed == null ? void 0 : makeRandomFromSeed(txSeed));
			assignTxAliasViews(tx, dispatches, parentPrefix);
			return tx;
		}, body, this.#backend);
	}
	newUuidV4() {
		const bytes = this.random.fill(new Uint8Array(16));
		return Uuid.fromRandomBytesV4(bytes);
	}
	newUuidV7() {
		const bytes = this.random.fill(new Uint8Array(4));
		const counter = this.#uuidCounter ??= { value: 0 };
		return Uuid.fromCounterV7(counter, this.timestamp, bytes);
	}
};
function makeReducerExport(ctx, opts, params, fn, lifecycle) {
	const reducerExport = (...args) => fn(...args);
	reducerExport[exportContext] = ctx;
	reducerExport[registerExport] = (ctx2, exportName) => {
		registerReducer(ctx2, exportName, params, fn, opts, lifecycle);
		ctx2.functionExports.set(reducerExport, exportName);
		if (opts?.onSchedule !== void 0) ctx2.pendingSchedules.push({
			table: opts.onSchedule,
			functionName: exportName
		});
	};
	return reducerExport;
}
function registerReducer(ctx, exportName, params, fn, opts, lifecycle) {
	ctx.defineFunction(exportName);
	if (!(params instanceof RowBuilder)) params = new RowBuilder(params);
	if (params.typeName === void 0) params.typeName = toPascalCase(exportName);
	const ref = ctx.registerTypesRecursively(params);
	const paramsType = ctx.resolveType(ref).value;
	const isLifecycle = lifecycle != null;
	ctx.moduleDef.reducers.push({
		sourceName: exportName,
		params: paramsType,
		visibility: FunctionVisibility.ClientCallable,
		okReturnType: AlgebraicType.Product({ elements: [] }),
		errReturnType: AlgebraicType.String
	});
	if (opts?.name != null) ctx.moduleDef.explicitNames.entries.push({
		tag: "Function",
		value: {
			sourceName: exportName,
			canonicalName: opts.name
		}
	});
	if (isLifecycle) ctx.moduleDef.lifeCycleReducers.push({
		lifecycleSpec: lifecycle,
		functionName: exportName
	});
	if (!fn.name) Object.defineProperty(fn, "name", {
		value: exportName,
		writable: false
	});
	ctx.reducers.push(fn);
}
var SchemaInner = class extends ModuleContext {
	schemaType;
	exportsRegistered = false;
	schedulesResolved = false;
	existingFunctions = /* @__PURE__ */ new Set();
	existingHttpHandlers = /* @__PURE__ */ new Set();
	reducers = [];
	procedures = [];
	views = [];
	anonViews = [];
	httpHandlers = [];
	/**
	* Maps reducer/procedure export objects to their source names.
	* Used for resolving scheduled table targets.
	*/
	functionExports = /* @__PURE__ */ new Map();
	tableSourceNames = /* @__PURE__ */ new Map();
	httpHandlerExports = /* @__PURE__ */ new Map();
	pendingSchedules = [];
	pendingHttpRoutes = [];
	submoduleDispatchInfos = [];
	constructor(getSchemaType) {
		super();
		this.schemaType = getSchemaType(this);
	}
	defineFunction(name) {
		if (this.existingFunctions.has(name)) throw new TypeError(`There is already a reducer, procedure, or view with the name '${name}'`);
		this.existingFunctions.add(name);
	}
	defineHttpHandler(name) {
		if (this.existingHttpHandlers.has(name)) throw new TypeError(`There is already an HTTP handler with the name '${name}'`);
		this.existingHttpHandlers.add(name);
	}
	resolveSchedules() {
		if (this.schedulesResolved) return;
		this.schedulesResolved = true;
		const scheduledTables = /* @__PURE__ */ new Map();
		for (const { functionName: knownFunctionName, reducer, table: table2, tableName: knownTableName, scheduleAtCol: knownScheduleAtCol } of this.pendingSchedules) {
			let tableName = knownTableName;
			if (tableName === void 0) {
				const tableNames = this.tableSourceNames.get(table2);
				if (tableNames !== void 0 && tableNames.length > 1) throw new TypeError("Schedule target table is registered more than once in this schema. Use a distinct table handle for each scheduled table.");
				tableName = tableNames?.[0];
			}
			if (tableName === void 0) throw new TypeError("Schedule target table is not part of this schema.");
			const scheduleAtCol = knownScheduleAtCol ?? table2.scheduleAtCol;
			if (scheduleAtCol === void 0) throw new TypeError(`Table ${tableName} defines a schedule, but it does not have a ScheduleAt column.`);
			const functionName = knownFunctionName ?? (reducer === void 0 ? void 0 : this.functionExports.get(reducer()));
			if (functionName === void 0) {
				const msg = `Table ${tableName} defines a schedule, but it seems like the associated function was not exported.`;
				throw new TypeError(msg);
			}
			const existingFunctionName = scheduledTables.get(tableName);
			if (existingFunctionName !== void 0) throw new TypeError(`Table ${tableName} defines multiple schedules: ${existingFunctionName} and ${functionName}. A schedule table can only be used by one reducer or procedure.`);
			scheduledTables.set(tableName, functionName);
			this.moduleDef.schedules.push({
				sourceName: void 0,
				tableName,
				scheduleAtCol,
				functionName
			});
		}
	}
	resolveHttpRoutes() {
		for (const route of this.pendingHttpRoutes) {
			const handlerFunction = this.httpHandlerExports.get(route.handler);
			if (handlerFunction === void 0) throw new TypeError(`HTTP route for path '${route.path}' refers to a handler that was not exported.`);
			this.moduleDef.httpRoutes.push({
				handlerFunction,
				method: route.method,
				path: route.path
			});
		}
	}
};
var Schema = class {
	#ctx;
	constructor(ctx) {
		this.#ctx = ctx;
	}
	[moduleHooks](exports) {
		this.buildRawModuleDefV10(exports);
		this.#ctx.resolveHttpRoutes();
		return makeHooks(this.#ctx);
	}
	get schemaType() {
		return this.#ctx.schemaType;
	}
	get moduleDef() {
		return this.#ctx.moduleDef;
	}
	get typespace() {
		return this.#ctx.typespace;
	}
	get submoduleDispatchInfos() {
		return this.#ctx.submoduleDispatchInfos;
	}
	/** Internal: register exports and materialize the RawModuleDefV10 for upload. */
	buildRawModuleDefV10(exports, opts) {
		registerModuleExports(this.#ctx, exports, { ignoreNonModuleExports: opts?.ignoreNonModuleExports ?? false });
		this.#ctx.resolveSchedules();
		return this.#ctx.rawModuleDefV10();
	}
	/**
	* @internal – called by schema() when processing a submodule namespace entry.
	* Registers the library's exports and returns both the serialized module def
	* and the runtime dispatch info needed by ModuleHooksImpl for __call_reducer__.
	*/
	buildSubmoduleDispatch(exports) {
		const rawDef = this.buildRawModuleDefV10(exports, { ignoreNonModuleExports: true });
		if (this.#ctx.moduleDef.environment.length !== 0) throw new TypeError("Submodules cannot declare environment variables");
		this.#ctx.resolveHttpRoutes();
		return {
			rawDef,
			dispatch: {
				namespace: "",
				reducerFns: [...this.#ctx.reducers],
				reducerDefs: [...this.#ctx.moduleDef.reducers],
				procedureFns: [...this.#ctx.procedures],
				procedureDefs: [...this.#ctx.moduleDef.procedures],
				anonViewFns: [...this.#ctx.anonViews],
				viewFns: [...this.#ctx.views],
				typespace: this.#ctx.moduleDef.typespace,
				tables: Object.values(this.#ctx.schemaType.tables).map((t2) => ({
					accessorName: t2.accessorName,
					tableDef: t2.tableDef
				})),
				schemaTables: this.#ctx.schemaType.tables,
				subDispatches: [...this.#ctx.submoduleDispatchInfos]
			}
		};
	}
	reducer(...args) {
		let opts, params = {}, fn;
		switch (args.length) {
			case 1:
				[fn] = args;
				break;
			case 2: {
				let arg1;
				[arg1, fn] = args;
				if (typeof arg1.name === "string") opts = arg1;
				else params = arg1;
				break;
			}
			case 3:
				[opts, params, fn] = args;
				break;
		}
		return makeReducerExport(this.#ctx, opts, params, fn);
	}
	init(...args) {
		let opts, fn;
		switch (args.length) {
			case 1:
				[fn] = args;
				break;
			case 2:
				[opts, fn] = args;
				break;
		}
		return makeReducerExport(this.#ctx, opts, {}, fn, Lifecycle.Init);
	}
	clientConnected(...args) {
		let opts, fn;
		switch (args.length) {
			case 1:
				[fn] = args;
				break;
			case 2:
				[opts, fn] = args;
				break;
		}
		return makeReducerExport(this.#ctx, opts, {}, fn, Lifecycle.OnConnect);
	}
	clientDisconnected(...args) {
		let opts, fn;
		switch (args.length) {
			case 1:
				[fn] = args;
				break;
			case 2:
				[opts, fn] = args;
				break;
		}
		return makeReducerExport(this.#ctx, opts, {}, fn, Lifecycle.OnDisconnect);
	}
	view(opts, ...args) {
		let params = {}, ret, fn;
		switch (args.length) {
			case 2:
				[ret, fn] = args;
				break;
			case 3:
				[params, ret, fn] = args;
				break;
		}
		return makeViewExport(this.#ctx, opts, params, ret, fn);
	}
	anonymousView(opts, ...args) {
		let params = {}, ret, fn;
		switch (args.length) {
			case 2:
				[ret, fn] = args;
				break;
			case 3:
				[params, ret, fn] = args;
				break;
		}
		return makeAnonViewExport(this.#ctx, opts, params, ret, fn);
	}
	procedure(...args) {
		let opts, params = {}, ret, fn;
		switch (args.length) {
			case 2:
				[ret, fn] = args;
				break;
			case 3: {
				let arg1;
				[arg1, ret, fn] = args;
				if (typeof arg1.name === "string") opts = arg1;
				else params = arg1;
				break;
			}
			case 4:
				[opts, params, ret, fn] = args;
				break;
		}
		return makeProcedureExport(this.#ctx, opts, params, ret, fn);
	}
	httpHandler(...args) {
		let opts, fn;
		switch (args.length) {
			case 1:
				[fn] = args;
				break;
			case 2:
				[opts, fn] = args;
				break;
		}
		return makeHttpHandlerExport(this.#ctx, opts, fn);
	}
	httpRouter(router) {
		return makeHttpRouterExport(this.#ctx, router);
	}
	/**
	* Bundle multiple reducers, procedures, etc into one value to export.
	* The name they will be exported with is their corresponding key in the `exports` argument.
	*/
	exportGroup(exports) {
		return {
			[exportContext]: this.#ctx,
			[registerExport](ctx, _exportName) {
				for (const [exportName, moduleExport] of Object.entries(exports)) {
					checkExportContext(moduleExport, ctx);
					moduleExport[registerExport](ctx, exportName);
				}
			}
		};
	}
	clientVisibilityFilter = { sql: (filter) => ({
		[exportContext]: this.#ctx,
		[registerExport](ctx, _exportName) {
			ctx.moduleDef.rowLevelSecurity.push({ sql: filter });
		}
	}) };
};
var registerExport = Symbol("SpacetimeDB.registerExport");
var exportContext = Symbol("SpacetimeDB.exportContext");
function isModuleExport(x) {
	return (typeof x === "function" || typeof x === "object") && x !== null && registerExport in x;
}
function checkExportContext(exp, schema2) {
	if (exp[exportContext] != null && exp[exportContext] !== schema2) throw new TypeError("multiple schemas are not supported");
}
function isUntypedTableSchema(x) {
	return typeof x === "object" && x !== null && hasOwn(x, "tableDef");
}
function isSubmoduleNamespace(x) {
	return typeof x === "object" && x !== null && hasOwn(x, "default") && x.default instanceof Schema;
}
function isSubmoduleMount(x) {
	return typeof x === "object" && x !== null && hasOwn(x, "module") && !hasOwn(x, "default") && !hasOwn(x, "tableDef");
}
function defaultImportError(accName) {
	return /* @__PURE__ */ new TypeError(`schema entry '${accName}' looks like a default import; use \`import * as ${accName} from '...'\` so the submodule can see the library's named reducer exports.`);
}
function resolveSubmoduleEntry(accName, entry) {
	if (entry instanceof Schema) throw defaultImportError(accName);
	if (isSubmoduleNamespace(entry)) return { submodule: entry };
	if (!isSubmoduleMount(entry)) return;
	if (entry.module instanceof Schema) throw defaultImportError(accName);
	if (!isSubmoduleNamespace(entry.module)) throw new TypeError(`schema entry '${accName}' has a \`module\` that is not a submodule namespace object; pass the result of \`import * as ${accName} from '...'\`.`);
	if (entry.name === void 0) return { submodule: entry.module };
	if (typeof entry.name !== "string" || entry.name.length === 0) throw new TypeError(`schema entry '${accName}' has an invalid \`name\`; expected a non-empty string for the canonical namespace name.`);
	return {
		submodule: entry.module,
		canonicalName: entry.name
	};
}
function registerModuleExports(schema2, exports, opts) {
	if (schema2.exportsRegistered) return;
	schema2.exportsRegistered = true;
	for (const [name, moduleExport] of Object.entries(exports)) {
		if (name === "default") continue;
		if (!isModuleExport(moduleExport)) {
			if (opts?.ignoreNonModuleExports) continue;
			throw new TypeError("exporting something that is not a spacetime export");
		}
		checkExportContext(moduleExport, schema2);
		moduleExport[registerExport](schema2, name);
	}
}
function schema(entries, moduleSettings) {
	return new Schema(new SchemaInner((ctx2) => {
		ctx2.moduleDef.environment = environmentDeclarations(moduleSettings?.env ?? {});
		if (moduleSettings?.CASE_CONVERSION_POLICY != null) ctx2.setCaseConversionPolicy(moduleSettings.CASE_CONVERSION_POLICY);
		const tableSchemas = {};
		for (const [accName, entry] of Object.entries(entries)) {
			const mount = resolveSubmoduleEntry(accName, entry);
			if (mount !== void 0) {
				const { submodule, canonicalName } = mount;
				const { rawDef, dispatch } = submodule.default.buildSubmoduleDispatch(submodule);
				dispatch.namespace = accName;
				ctx2.addSubmodule({
					namespace: accName,
					module: rawDef
				});
				if (canonicalName !== void 0) ctx2.moduleDef.explicitNames.entries.push({
					tag: "Namespace",
					value: {
						sourceName: accName,
						canonicalName
					}
				});
				ctx2.submoduleDispatchInfos.push(dispatch);
				continue;
			}
			if (!isUntypedTableSchema(entry)) throw new TypeError(`schema entry '${accName}' must be a table, a submodule namespace object, or a \`{ name, module }\` submodule mount`);
			const table2 = entry;
			const tableDef = table2.tableDef(ctx2, accName);
			tableSchemas[accName] = tableToSchema(accName, table2, tableDef);
			const tableSourceNames = ctx2.tableSourceNames.get(table2);
			if (tableSourceNames === void 0) ctx2.tableSourceNames.set(table2, [tableDef.sourceName]);
			else tableSourceNames.push(tableDef.sourceName);
			ctx2.moduleDef.tables.push(tableDef);
			if (table2.schedule) ctx2.pendingSchedules.push({
				table: table2,
				tableName: tableDef.sourceName,
				scheduleAtCol: table2.schedule.scheduleAtCol,
				reducer: table2.schedule.reducer
			});
			if (table2.tableName) ctx2.moduleDef.explicitNames.entries.push({
				tag: "Table",
				value: {
					sourceName: accName,
					canonicalName: table2.tableName
				}
			});
		}
		return {
			tables: tableSchemas,
			env: moduleSettings?.env ?? {}
		};
	}));
}
var import_object_inspect = __toESM(require_object_inspect());
var fmtLog = (...data) => data.map((x) => typeof x === "string" ? x : (0, import_object_inspect.default)(x)).join(" ");
var console_level_error = 0;
var console_level_warn = 1;
var console_level_info = 2;
var console_level_debug = 3;
var console_level_trace = 4;
var timerMap = /* @__PURE__ */ new Map();
var console2 = {
	__proto__: {},
	[Symbol.toStringTag]: "console",
	assert: (condition = false, ...data) => {
		if (!condition) sys2.console_log(console_level_error, fmtLog(...data));
	},
	clear: () => {},
	debug: (...data) => {
		sys2.console_log(console_level_debug, fmtLog(...data));
	},
	error: (...data) => {
		sys2.console_log(console_level_error, fmtLog(...data));
	},
	info: (...data) => {
		sys2.console_log(console_level_info, fmtLog(...data));
	},
	log: (...data) => {
		sys2.console_log(console_level_info, fmtLog(...data));
	},
	table: (tabularData, _properties) => {
		sys2.console_log(console_level_info, fmtLog(tabularData));
	},
	trace: (...data) => {
		sys2.console_log(console_level_trace, fmtLog(...data));
	},
	warn: (...data) => {
		sys2.console_log(console_level_warn, fmtLog(...data));
	},
	dir: (_item, _options) => {},
	dirxml: (..._data) => {},
	count: (_label = "default") => {},
	countReset: (_label = "default") => {},
	group: (..._data) => {},
	groupCollapsed: (..._data) => {},
	groupEnd: () => {},
	time: (label = "default") => {
		if (timerMap.has(label)) {
			sys2.console_log(console_level_warn, `Timer '${label}' already exists.`);
			return;
		}
		timerMap.set(label, sys2.console_timer_start(label));
	},
	timeLog: (label = "default", ...data) => {
		sys2.console_log(console_level_info, fmtLog(label, ...data));
	},
	timeEnd: (label = "default") => {
		const spanId = timerMap.get(label);
		if (spanId === void 0) {
			sys2.console_log(console_level_warn, `Timer '${label}' does not exist.`);
			return;
		}
		sys2.console_timer_end(spanId);
		timerMap.delete(label);
	},
	timeStamp: () => {},
	profile: () => {},
	profileEnd: () => {}
};
globalThis.console = console2;

//#endregion
//#region src/constants.ts
const SPEEDS = [
	.5,
	1,
	2,
	4
];
/** Spread attempts older than this many ticks are deleted, so subscriptions stay light. */
const KEEP_ATTEMPT_TICKS = 2;
const NOTE_MAX = 140;
const ROLES = [
	"security",
	"clinical_engineering",
	"operations",
	"observer"
];
const ANNOTATING_ROLES = [
	"security",
	"clinical_engineering",
	"operations"
];
/** Largest frames_json one run_frames_apply call may carry. */
const FRAMES_MAX = 256 * 1024;
/** Longest run.detail kept from run_fail. */
const DETAIL_MAX = 500;
/** sim_event kinds a frame may carry, and the hospital list each one's targetId names. */
const EVENT_TARGETS = {
	patient_zero: "devices",
	device_infected: "devices",
	service_down: "services",
	diversion: "rooms"
};
const PATIENT_STATES = [
	"ok",
	"delayed",
	"disrupted",
	"diverted"
];
const AGENT_NAMES = [
	"inventory",
	"flow",
	"clinical_workflow",
	"coordinator"
];
/** Who can appear on either end of an agent_message row. "relay" receives round_state and recommendation. */
const SPEAKERS = [
	...AGENT_NAMES,
	"humans",
	"relay"
];
const MESSAGE_TYPES = [
	"proposal_request",
	"proposal",
	"revision",
	"verdict",
	"question",
	"answer",
	"recommendation",
	"round_state",
	"chat"
];
const AGENT_STATUSES = [
	"idle",
	"thinking",
	"speaking",
	"waiting"
];
const ROUND_STATES = [
	"idle",
	"running",
	"waiting_for_human",
	"done"
];
const TEXT_SOURCES = [
	"claude",
	"template",
	""
];
/** Largest payload the relay may store per message. */
const PAYLOAD_MAX = 64 * 1024;

//#endregion
//#region src/schema.ts
const spacetimedb = schema({
	config: table({ name: "config" }, {
		id: t.u32().primaryKey(),
		server_identity: t.identity()
	}),
	session: table({
		name: "session",
		public: true
	}, {
		id: t.string().primaryKey(),
		hospital_json: t.string(),
		hospital_name: t.string(),
		presenter: t.identity(),
		active_run_id: t.string(),
		created_at: t.timestamp(),
		round_state: t.string().default("idle"),
		round: t.u32().default(0),
		round_detail: t.string().default(""),
		entry_points_json: t.string().default("[]"),
		solution_pair_id: t.string().default("")
	}),
	run: table({
		name: "run",
		public: true
	}, {
		id: t.string().primaryKey(),
		session_id: t.string().index("btree"),
		pair_id: t.string(),
		label: t.string(),
		seed: t.u32(),
		patient_zero: t.string(),
		policy_json: t.string(),
		tick: t.u32(),
		status: t.string(),
		speed: t.f64(),
		patients_affected: t.u32(),
		devices_compromised: t.u32(),
		services_down: t.u32(),
		delayed_procedures: t.u32(),
		choke_points_json: t.string(),
		protected_broken_json: t.string(),
		started_at: t.timestamp(),
		final_tick: t.u32().default(0),
		detail: t.string().default(""),
		autoplay: t.bool().default(false),
		step_pending: t.bool().default(false),
		challenges_json: t.string().default("[]"),
		removed_flows_json: t.string().default("[]"),
		assumptions_json: t.string().default("[]"),
		recommendation_id: t.string().default("")
	}),
	device_state: table({
		name: "device_state",
		public: true
	}, {
		id: t.string().primaryKey(),
		run_id: t.string().index("btree"),
		device_id: t.string(),
		infected: t.bool(),
		infected_at_tick: t.i32(),
		infected_by: t.string()
	}),
	service_state: table({
		name: "service_state",
		public: true
	}, {
		id: t.string().primaryKey(),
		run_id: t.string().index("btree"),
		service_id: t.string(),
		down: t.bool(),
		down_since_tick: t.i32()
	}),
	patient_state: table({
		name: "patient_state",
		public: true
	}, {
		id: t.string().primaryKey(),
		run_id: t.string().index("btree"),
		group_id: t.string(),
		state: t.string()
	}),
	spread_attempt: table({
		name: "spread_attempt",
		public: true
	}, {
		id: t.u64().primaryKey().autoInc(),
		run_id: t.string().index("btree"),
		tick: t.u32(),
		from_device: t.string(),
		to_device: t.string(),
		flow_id: t.string(),
		success: t.bool()
	}),
	sim_event: table({
		name: "sim_event",
		public: true
	}, {
		id: t.u64().primaryKey().autoInc(),
		run_id: t.string().index("btree"),
		tick: t.u32(),
		kind: t.string(),
		target_id: t.string(),
		text: t.string()
	}),
	tick_snapshot: table({
		name: "tick_snapshot",
		public: true
	}, {
		id: t.string().primaryKey(),
		run_id: t.string().index("btree"),
		tick: t.u32(),
		infected_count: t.u32(),
		patients_affected: t.u32(),
		infected_ids_json: t.string(),
		services_down_json: t.string(),
		patients_json: t.string()
	}),
	presence: table({
		name: "presence",
		public: true
	}, {
		identity: t.identity().primaryKey(),
		session_id: t.string().index("btree"),
		name: t.string(),
		role: t.string(),
		following: t.bool(),
		last_seen: t.timestamp()
	}),
	annotation: table({
		name: "annotation",
		public: true
	}, {
		id: t.u64().primaryKey().autoInc(),
		session_id: t.string().index("btree"),
		run_id: t.string(),
		kind: t.string(),
		target_id: t.string(),
		note: t.string(),
		author: t.identity(),
		author_name: t.string(),
		role: t.string(),
		active: t.bool(),
		created_at: t.timestamp(),
		cleared_by: t.string()
	}),
	defend_request_log: table({
		name: "defend_request_log",
		public: true
	}, {
		id: t.u64().primaryKey().autoInc(),
		session_id: t.string().index("btree"),
		run_id: t.string(),
		patient_zero: t.string(),
		seed: t.u32(),
		challenges_json: t.string(),
		requested_by: t.identity(),
		requester_name: t.string(),
		created_at: t.timestamp()
	}),
	agent_message: table({
		name: "agent_message",
		public: true
	}, {
		id: t.u64().primaryKey().autoInc(),
		session_id: t.string().index("btree"),
		round: t.u32(),
		seq: t.u32(),
		from_agent: t.string(),
		to_agent: t.string(),
		type: t.string(),
		payload_json: t.string(),
		reason: t.string(),
		reason_source: t.string(),
		direction: t.string(),
		fixture: t.bool(),
		created_at: t.timestamp()
	}),
	agent_status: table({
		name: "agent_status",
		public: true
	}, {
		id: t.string().primaryKey(),
		session_id: t.string().index("btree"),
		agent: t.string(),
		status: t.string(),
		updated_at: t.timestamp()
	}),
	question: table({
		name: "question",
		public: true
	}, {
		id: t.string().primaryKey(),
		session_id: t.string().index("btree"),
		question_id: t.string(),
		round: t.u32(),
		agent: t.string(),
		target_id: t.string(),
		text: t.string(),
		text_source: t.string(),
		choices_json: t.string(),
		allowed_roles_json: t.string(),
		answered: t.bool(),
		answer_choice: t.string(),
		answer_author: t.string(),
		answer_role: t.string(),
		created_at: t.timestamp()
	}),
	recommendation: table({
		name: "recommendation",
		public: true
	}, {
		id: t.string().primaryKey(),
		session_id: t.string().index("btree"),
		round: t.u32(),
		name: t.string(),
		policy_json: t.string(),
		explanation: t.string(),
		explanation_source: t.string(),
		verified_json: t.string(),
		verdicts_json: t.string(),
		required_roles_json: t.string(),
		fixture: t.bool(),
		status: t.string(),
		updated_at: t.timestamp()
	})
});
function fail(message) {
	throw new SenderError(message);
}
function same(a, b) {
	return a.isEqual(b);
}
function isServer(ctx) {
	const c = ctx.db.config.id.find(0);
	return !!c && same(c.server_identity, ctx.sender);
}
function getSession(ctx, sessionId) {
	return ctx.db.session.id.find(sessionId) ?? fail(`Session "${sessionId}" does not exist.`);
}
/** Server-only reducers (AGENTS.md rule 11): watchers and the Node server. */
function requireServer(ctx) {
	if (!isServer(ctx)) fail("Only the server identity can call this reducer.");
}
/** Run controls: the presenter (spec 7.3) or the server identity. */
function requirePresenter(ctx, sessionId) {
	if (!same(getSession(ctx, sessionId).presenter, ctx.sender) && !isServer(ctx)) fail("Only the presenter can control playback.");
}
/** The public rows a run's frames write, besides the run row itself. */
const RUN_ROW_TABLES = [
	"device_state",
	"service_state",
	"patient_state",
	"spread_attempt",
	"sim_event",
	"tick_snapshot"
];
/** A run's columns before frame 0 arrives: run_start, solution_start and run_reset write these. */
const BEFORE_FRAME_0 = {
	tick: 0,
	status: "requested",
	step_pending: false,
	detail: "",
	final_tick: 0,
	patients_affected: 0,
	devices_compromised: 0,
	services_down: 0,
	delayed_procedures: 0,
	choke_points_json: "[]",
	protected_broken_json: "[]",
	removed_flows_json: "[]",
	assumptions_json: "[]"
};
function rowKey(...parts) {
	return parts.join(":");
}
function readRun(ctx, runId) {
	return ctx.db.run.id.find(runId) ?? fail(`Run "${runId}" does not exist.`);
}
/** Playback key: a solution pair moves together. */
function playbackKey(r) {
	return r.pair_id || r.id;
}
/** Every run under this run's playback key (itself, or its whole pair). */
function runsForKey(ctx, r) {
	const k = playbackKey(r);
	return [...ctx.db.run.session_id.filter(r.session_id)].filter((x) => playbackKey(x) === k);
}
function deleteRunRows(ctx, runId) {
	for (const tbl of RUN_ROW_TABLES) for (const row of [...ctx.db[tbl].run_id.filter(runId)]) ctx.db[tbl].delete(row);
}
/** A run in the session that is being computed or played (rule 5: agents wait for it). */
function busyRun(ctx, sessionId) {
	return [...ctx.db.run.session_id.filter(sessionId)].find((r) => r.status === "requested" || r.status === "running");
}
/** Why a playback control can't act on a run in this status. */
function statusRefusal(status) {
	if (status === "requested") return "This run is still being computed.";
	if (status === "done") return "This run has finished. Reset it to play again.";
	if (status === "error") return "This run failed. Reset it to try again.";
	return "";
}

//#endregion
//#region src/hospital.ts
function validateHospital(json) {
	let parsed;
	try {
		parsed = JSON.parse(json);
	} catch {
		fail("The hospital file is not valid JSON.");
	}
	const f = parsed;
	if (f?.schemaVersion !== 1 || !f.hospital) fail("Expected { schemaVersion: 1, hospital: {...} }.");
	const h = f.hospital;
	for (const k of [
		"floors",
		"rooms",
		"devices",
		"flows",
		"services",
		"patients"
	]) if (!Array.isArray(h[k])) fail(`hospital.${k} must be a list.`);
	const ids = new Set(h.devices.map((d) => d.id));
	for (const fl of h.flows) if (!ids.has(fl.from) || !ids.has(fl.to)) fail(`Flow "${fl.id}" refers to a missing device.`);
	for (const g of h.patients) for (const banned of [
		"name",
		"age",
		"birthDate",
		"mrn",
		"diagnosis"
	]) if (banned in g) fail(`Patient group "${g.id}" has "${banned}". Patient groups hold counts only.`);
	if (json.length > 2 * 1024 * 1024) fail("The hospital file is larger than 2 MB.");
	return f;
}
/** The session's hospital. session_create validated it. */
function hospitalOf(ctx, sessionId) {
	return JSON.parse(getSession(ctx, sessionId).hospital_json).hospital;
}
function hospitalIndex(h) {
	return {
		devices: new Set(h.devices.map((d) => d.id)),
		services: new Set(h.services.map((s) => s.id)),
		groups: new Set(h.patients.map((g) => g.id)),
		rooms: new Set(h.rooms.map((r) => r.id)),
		flows: new Set(h.flows.map((f) => f.id))
	};
}

//#endregion
//#region src/ingest.ts
const U32_MAX = 4294967295;
const I32_MAX = 2147483647;
function record(v, path) {
	if (typeof v !== "object" || v === null || Array.isArray(v)) fail(`${path} must be an object.`);
	return v;
}
function obj(v, path, keys, optional = []) {
	const o = record(v, path);
	for (const k of Object.keys(o)) if (!keys.includes(k) && !optional.includes(k)) fail(`${path} has an unknown field "${k}".`);
	for (const k of keys) if (!(k in o)) fail(`${path}.${k} is missing.`);
	return o;
}
function list(v, path) {
	if (!Array.isArray(v)) fail(`${path} must be a list.`);
	return v;
}
function str(v, path) {
	if (typeof v !== "string") fail(`${path} must be a string.`);
	return v;
}
function bool(v, path) {
	if (typeof v !== "boolean") fail(`${path} must be true or false.`);
	return v;
}
function int(v, path, min, max) {
	if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) fail(`${path} must be a whole number from ${min} to ${max}.`);
	return v;
}
function known(id, set, path, what) {
	if (!set.has(id)) fail(`${path} names ${what} "${id}", which is not in the session's hospital.`);
	return id;
}
function idList(v, path, set, what) {
	const out = list(v, path).map((x, i) => known(str(x, `${path}[${i}]`), set, `${path}[${i}]`, what));
	if (new Set(out).size !== out.length) fail(`${path} lists an id twice.`);
	return out;
}
/** Reads a list of per-id changes, with each id at most once. */
function changes(v, path, read, id) {
	const out = list(v, path).map((x, i) => read(x, `${path}[${i}]`));
	if (new Set(out.map(id)).size !== out.length) fail(`${path} lists an id twice.`);
	return out;
}
function readFrame(v, path, ix) {
	const f = obj(v, path, [
		"tick",
		"final",
		"devices",
		"services",
		"patients",
		"attempts",
		"events",
		"snapshot",
		"summary"
	], ["run"]);
	const tick = int(f.tick, `${path}.tick`, 0, U32_MAX);
	const devices = changes(f.devices, `${path}.devices`, (x, p) => {
		const d = obj(x, p, [
			"deviceId",
			"infected",
			"infectedAtTick",
			"infectedBy"
		]);
		const row = {
			deviceId: known(str(d.deviceId, `${p}.deviceId`), ix.devices, `${p}.deviceId`, "device"),
			infected: bool(d.infected, `${p}.infected`),
			infectedAtTick: int(d.infectedAtTick, `${p}.infectedAtTick`, -1, tick),
			infectedBy: str(d.infectedBy, `${p}.infectedBy`)
		};
		if (row.infectedBy) known(row.infectedBy, ix.devices, `${p}.infectedBy`, "device");
		if (row.infected && row.infectedAtTick < 0) fail(`${p} is infected but has no infectedAtTick.`);
		if (!row.infected && (row.infectedAtTick !== -1 || row.infectedBy)) fail(`${p} is not infected, so infectedAtTick must be -1 and infectedBy "".`);
		return row;
	}, (d) => d.deviceId);
	const services = changes(f.services, `${path}.services`, (x, p) => {
		const s = obj(x, p, [
			"serviceId",
			"down",
			"downSinceTick"
		]);
		const row = {
			serviceId: known(str(s.serviceId, `${p}.serviceId`), ix.services, `${p}.serviceId`, "service"),
			down: bool(s.down, `${p}.down`),
			downSinceTick: int(s.downSinceTick, `${p}.downSinceTick`, -1, tick)
		};
		if (row.down !== row.downSinceTick >= 0) fail(`${p}: downSinceTick must be -1 exactly when the service is up.`);
		return row;
	}, (s) => s.serviceId);
	const patients = changes(f.patients, `${path}.patients`, (x, p) => {
		const g = obj(x, p, ["groupId", "state"]);
		return {
			groupId: known(str(g.groupId, `${p}.groupId`), ix.groups, `${p}.groupId`, "patient group"),
			state: patientState(g.state, `${p}.state`)
		};
	}, (g) => g.groupId);
	const attempts = list(f.attempts, `${path}.attempts`).map((x, i) => {
		const p = `${path}.attempts[${i}]`;
		const a = obj(x, p, [
			"from",
			"to",
			"flowId",
			"success"
		]);
		return {
			from: known(str(a.from, `${p}.from`), ix.devices, `${p}.from`, "device"),
			to: known(str(a.to, `${p}.to`), ix.devices, `${p}.to`, "device"),
			flowId: known(str(a.flowId, `${p}.flowId`), ix.flows, `${p}.flowId`, "flow"),
			success: bool(a.success, `${p}.success`)
		};
	});
	const events = list(f.events, `${path}.events`).map((x, i) => {
		const p = `${path}.events[${i}]`;
		const e = obj(x, p, [
			"kind",
			"targetId",
			"text"
		]);
		const kind = str(e.kind, `${p}.kind`);
		if (!Object.prototype.hasOwnProperty.call(EVENT_TARGETS, kind)) fail(`${p}.kind must be one of: ${Object.keys(EVENT_TARGETS).join(", ")}.`);
		const target = EVENT_TARGETS[kind];
		return {
			kind,
			targetId: known(str(e.targetId, `${p}.targetId`), ix[target], `${p}.targetId`, target.slice(0, -1)),
			text: str(e.text, `${p}.text`)
		};
	});
	const sp = `${path}.snapshot`;
	const s = obj(f.snapshot, sp, [
		"infectedCount",
		"patientsAffected",
		"infectedIds",
		"servicesDown",
		"patients"
	]);
	const snapPatients = {};
	for (const [g, st] of Object.entries(record(s.patients, `${sp}.patients`))) snapPatients[known(g, ix.groups, `${sp}.patients`, "patient group")] = patientState(st, `${sp}.patients.${g}`);
	const snapshot = {
		infectedCount: int(s.infectedCount, `${sp}.infectedCount`, 0, U32_MAX),
		patientsAffected: int(s.patientsAffected, `${sp}.patientsAffected`, 0, U32_MAX),
		infectedIds: idList(s.infectedIds, `${sp}.infectedIds`, ix.devices, "device"),
		servicesDown: idList(s.servicesDown, `${sp}.servicesDown`, ix.services, "service"),
		patients: snapPatients
	};
	const mp = `${path}.summary`;
	const m = obj(f.summary, mp, [
		"patientsAffected",
		"devicesCompromised",
		"servicesDown",
		"delayedProcedures",
		"chokePoints"
	]);
	const summary = {
		patientsAffected: int(m.patientsAffected, `${mp}.patientsAffected`, 0, U32_MAX),
		devicesCompromised: int(m.devicesCompromised, `${mp}.devicesCompromised`, 0, U32_MAX),
		servicesDown: int(m.servicesDown, `${mp}.servicesDown`, 0, U32_MAX),
		delayedProcedures: int(m.delayedProcedures, `${mp}.delayedProcedures`, 0, U32_MAX),
		chokePoints: list(m.chokePoints, `${mp}.chokePoints`).map((x, i) => {
			const p = `${mp}.chokePoints[${i}]`;
			const c = obj(x, p, ["deviceId", "share"]);
			if (typeof c.share !== "number" || !(c.share >= 0 && c.share <= 1)) fail(`${p}.share must be a number from 0 to 1.`);
			return {
				deviceId: known(str(c.deviceId, `${p}.deviceId`), ix.devices, `${p}.deviceId`, "device"),
				share: c.share
			};
		})
	};
	let run;
	if (f.run !== void 0) {
		const rp = `${path}.run`;
		const r = obj(f.run, rp, [
			"finalTick",
			"removedFlows",
			"protectedBroken",
			"assumptions"
		]);
		run = {
			finalTick: int(r.finalTick, `${rp}.finalTick`, 0, I32_MAX),
			removedFlows: idList(r.removedFlows, `${rp}.removedFlows`, ix.flows, "flow"),
			protectedBroken: idList(r.protectedBroken, `${rp}.protectedBroken`, ix.flows, "flow"),
			assumptions: list(r.assumptions, `${rp}.assumptions`).map((x, i) => str(x, `${rp}.assumptions[${i}]`))
		};
	}
	return {
		tick,
		final: bool(f.final, `${path}.final`),
		devices,
		services,
		patients,
		attempts,
		events,
		snapshot,
		summary,
		run
	};
}
function patientState(v, path) {
	const s = str(v, path);
	if (!PATIENT_STATES.includes(s)) fail(`${path} must be one of: ${PATIENT_STATES.join(", ")}.`);
	return s;
}
/** Status machine (INTEGRATION.md 5b): frame 0 on a requested run, then each next tick while running or stepping. */
function checkAgainstRun(r, f, ix, path) {
	let finalTick = r.final_tick;
	if (r.status === "requested") {
		if (f.tick !== 0) fail(`${path}: run "${r.id}" is waiting for frame 0, not tick ${f.tick}.`);
		if (!f.run) fail(`${path}: frame 0 must carry run (finalTick, removedFlows, protectedBroken, assumptions).`);
		finalTick = f.run.finalTick;
		const covers = (got, want, what) => {
			if (got !== want) fail(`${path}: frame 0 must list every ${what} (${want}), not ${got}.`);
		};
		covers(f.devices.length, ix.devices.size, "device");
		covers(f.services.length, ix.services.size, "service");
		covers(f.patients.length, ix.groups.size, "patient group");
	} else {
		if (r.status !== "running" && r.status !== "paused") fail(`${path}: run "${r.id}" is ${r.status} and takes no frames.`);
		if (f.run) fail(`${path}: only frame 0 carries run.`);
		if (f.tick !== r.tick + 1) fail(`${path}: run "${r.id}" is at tick ${r.tick}, so the next frame is tick ${r.tick + 1}, not ${f.tick}.`);
		if (r.status === "paused" && !r.step_pending) fail(`${path}: run "${r.id}" is paused and no step was asked for.`);
	}
	if (f.tick > finalTick) fail(`${path}: tick ${f.tick} is past the final tick ${finalTick}.`);
	if (f.final !== (f.tick === finalTick)) fail(`${path}: final must be true exactly on tick ${finalTick}.`);
}
/** The same eight writes for every frame: three state tables, attempts (prune + insert), events, snapshot, the run row. */
function applyFrame(ctx, r, f) {
	const first = f.tick === 0;
	if (first) deleteRunRows(ctx, r.id);
	for (const d of f.devices) {
		const row = {
			id: rowKey(r.id, d.deviceId),
			run_id: r.id,
			device_id: d.deviceId,
			infected: d.infected,
			infected_at_tick: d.infectedAtTick,
			infected_by: d.infectedBy
		};
		if (first) ctx.db.device_state.insert(row);
		else ctx.db.device_state.id.update(row);
	}
	for (const s of f.services) {
		const row = {
			id: rowKey(r.id, s.serviceId),
			run_id: r.id,
			service_id: s.serviceId,
			down: s.down,
			down_since_tick: s.downSinceTick
		};
		if (first) ctx.db.service_state.insert(row);
		else ctx.db.service_state.id.update(row);
	}
	for (const g of f.patients) {
		const row = {
			id: rowKey(r.id, g.groupId),
			run_id: r.id,
			group_id: g.groupId,
			state: g.state
		};
		if (first) ctx.db.patient_state.insert(row);
		else ctx.db.patient_state.id.update(row);
	}
	for (const old of [...ctx.db.spread_attempt.run_id.filter(r.id)]) if (old.tick + KEEP_ATTEMPT_TICKS <= f.tick) ctx.db.spread_attempt.delete(old);
	for (const a of f.attempts) ctx.db.spread_attempt.insert({
		id: 0n,
		run_id: r.id,
		tick: f.tick,
		from_device: a.from,
		to_device: a.to,
		flow_id: a.flowId,
		success: a.success
	});
	for (const e of f.events) ctx.db.sim_event.insert({
		id: 0n,
		run_id: r.id,
		tick: f.tick,
		kind: e.kind,
		target_id: e.targetId,
		text: e.text
	});
	ctx.db.tick_snapshot.insert({
		id: rowKey(r.id, f.tick),
		run_id: r.id,
		tick: f.tick,
		infected_count: f.snapshot.infectedCount,
		patients_affected: f.snapshot.patientsAffected,
		infected_ids_json: JSON.stringify(f.snapshot.infectedIds),
		services_down_json: JSON.stringify(f.snapshot.servicesDown),
		patients_json: JSON.stringify(f.snapshot.patients)
	});
	const next = {
		...r,
		tick: f.tick,
		step_pending: false,
		patients_affected: f.summary.patientsAffected,
		devices_compromised: f.summary.devicesCompromised,
		services_down: f.summary.servicesDown,
		delayed_procedures: f.summary.delayedProcedures,
		choke_points_json: JSON.stringify(f.summary.chokePoints)
	};
	if (f.run) {
		next.final_tick = f.run.finalTick;
		next.protected_broken_json = JSON.stringify(f.run.protectedBroken);
		next.removed_flows_json = JSON.stringify(f.run.removedFlows);
		next.assumptions_json = JSON.stringify(f.run.assumptions);
		next.status = r.autoplay ? "running" : "paused";
	}
	if (f.final) next.status = "done";
	ctx.db.run.id.update(next);
}
/**
* The run watcher's one write path. `frames_json` is `[{ runId, frame: TickFrame }]`,
* one item per run (both runs of a pair go in one call). Everything is checked
* before anything is written, and the call is one transaction: all items land
* or none do.
*/
const run_frames_apply = spacetimedb.reducer({ frames_json: t.string() }, (ctx, { frames_json }) => {
	requireServer(ctx);
	if (frames_json.length > FRAMES_MAX) fail(`frames_json is larger than ${FRAMES_MAX / 1024} KiB. Send fewer frames per call.`);
	let parsed;
	try {
		parsed = JSON.parse(frames_json);
	} catch {
		fail("frames_json is not valid JSON.");
	}
	const items = list(parsed, "frames");
	if (!items.length) fail("frames_json holds no frames.");
	const indexes = /* @__PURE__ */ new Map();
	const seen = /* @__PURE__ */ new Set();
	const batch = items.map((x, i) => {
		const path = `frames[${i}]`;
		const item = obj(x, path, ["runId", "frame"]);
		const runId = str(item.runId, `${path}.runId`);
		if (seen.has(runId)) fail(`${path}: run "${runId}" appears twice in one call.`);
		seen.add(runId);
		const r = readRun(ctx, runId);
		let ix = indexes.get(r.session_id);
		if (!ix) indexes.set(r.session_id, ix = hospitalIndex(hospitalOf(ctx, r.session_id)));
		const frame = readFrame(item.frame, `${path}.frame`, ix);
		checkAgainstRun(r, frame, ix, path);
		return {
			r,
			frame
		};
	});
	for (const { r, frame } of batch) applyFrame(ctx, r, frame);
});
/** The engine refused the run, or the watcher could not feed it (rule 14: show the error). */
const run_fail = spacetimedb.reducer({
	run_id: t.string(),
	detail: t.string()
}, (ctx, { run_id, detail }) => {
	requireServer(ctx);
	const r = readRun(ctx, run_id);
	ctx.db.run.id.update({
		...r,
		status: "error",
		step_pending: false,
		detail: detail.slice(0, DETAIL_MAX)
	});
});

//#endregion
//#region src/solution.ts
/** A fresh pair id per press, so a reopened solution never reuses a stale plan. */
function newPairId(ctx, sessionId, recommendationId) {
	const base = `pair_${recommendationId.replace(/[^A-Za-z0-9_-]/g, "_")}`;
	const used = new Set([...ctx.db.run.session_id.filter(sessionId)].map((r) => r.pair_id));
	let n = 1;
	while (used.has(`${base}_${n}`)) n++;
	return `${base}_${n}`;
}
const solution_start = spacetimedb.reducer({
	session_id: t.string(),
	recommendation_id: t.string(),
	speed: t.f64()
}, (ctx, { session_id, recommendation_id, speed }) => {
	requirePresenter(ctx, session_id);
	const s = getSession(ctx, session_id);
	if (!SPEEDS.includes(speed)) fail("Speed must be 0.5, 1, 2 or 4.");
	const rec = ctx.db.recommendation.id.find(recommendation_id);
	if (!rec || rec.session_id !== session_id) fail(`Recommendation "${recommendation_id}" does not exist in this session.`);
	if (s.round_state === "running" || s.round_state === "waiting_for_human") fail("Wait for the agents to finish negotiating before showing a solution.");
	if (busyRun(ctx, session_id)) fail("Wait for every run in this session to finish, or pause it, before showing a solution.");
	if (!s.active_run_id) fail("Run the attack first. The solution reruns the baseline's attack.");
	const base = readRun(ctx, s.active_run_id);
	const pair_id = newPairId(ctx, session_id, rec.id);
	const common = {
		...BEFORE_FRAME_0,
		session_id,
		pair_id,
		seed: base.seed,
		patient_zero: base.patient_zero,
		speed,
		autoplay: true,
		challenges_json: base.challenges_json,
		started_at: ctx.timestamp
	};
	for (const id of [`${pair_id}_none`, `${pair_id}_plan`]) if (ctx.db.run.id.find(id)) fail(`Run "${id}" already exists.`);
	ctx.db.run.insert({
		...common,
		id: `${pair_id}_none`,
		label: "No segmentation",
		policy_json: "",
		recommendation_id: ""
	});
	ctx.db.run.insert({
		...common,
		id: `${pair_id}_plan`,
		label: `With plan: ${rec.name}`,
		policy_json: rec.policy_json,
		recommendation_id: rec.id
	});
	ctx.db.session.id.update({
		...s,
		solution_pair_id: pair_id
	});
});
/** Back to the session: every tab leaves the solution view. The pair's runs stay. */
const solution_close = spacetimedb.reducer({ session_id: t.string() }, (ctx, { session_id }) => {
	requirePresenter(ctx, session_id);
	const s = getSession(ctx, session_id);
	ctx.db.session.id.update({
		...s,
		solution_pair_id: ""
	});
});

//#endregion
//#region src/agents.ts
function oneOf(value, allowed, what) {
	if (!allowed.includes(value)) fail(`${what} must be one of: ${allowed.join(", ")}.`);
	return value;
}
/**
* Create aggregate fix. Any joined human may ask, once the baseline run has
* finished or been paused: agents never talk while any run in the session is
* being computed or playing (rule 5). The watcher reads the run's seed,
* patient zero and challenges from this row.
*/
const defend_request = spacetimedb.reducer({ session_id: t.string() }, (ctx, { session_id }) => {
	const s = getSession(ctx, session_id);
	const p = ctx.db.presence.identity.find(ctx.sender);
	if (!p || p.session_id !== session_id) fail("Join the session before creating an aggregate fix.");
	const r = s.active_run_id ? ctx.db.run.id.find(s.active_run_id) : void 0;
	if (!r) fail("Run the attack first. The agents work from a baseline run.");
	if (r.status === "requested") fail("The attack is still being computed. Wait for it before creating an aggregate fix.");
	if (r.status === "error") fail("The attack run failed, so there is no baseline for the agents. Reset it or start a new attack.");
	if (r.status === "running") fail("Wait for the run to finish, or pause it, before creating an aggregate fix.");
	if (busyRun(ctx, session_id)) fail("Wait for every run in this session to finish, or pause it, before creating an aggregate fix.");
	if (s.round_state === "running" || s.round_state === "waiting_for_human") fail("An aggregate fix is already being negotiated for this session.");
	ctx.db.defend_request_log.insert({
		id: 0n,
		session_id,
		run_id: r.id,
		patient_zero: r.patient_zero,
		seed: r.seed,
		challenges_json: r.challenges_json,
		requested_by: ctx.sender,
		requester_name: p.name,
		created_at: ctx.timestamp
	});
});
/** One relayed uAgent message, sent or received. seq is assigned here, per session. */
const agent_message_add = spacetimedb.reducer({
	session_id: t.string(),
	round: t.u32(),
	from_agent: t.string(),
	to_agent: t.string(),
	type: t.string(),
	payload_json: t.string(),
	reason: t.string(),
	reason_source: t.string(),
	direction: t.string(),
	fixture: t.bool()
}, (ctx, a) => {
	requireServer(ctx);
	if (!a.session_id) fail("session_id is required.");
	oneOf(a.from_agent, SPEAKERS, "from");
	oneOf(a.to_agent, SPEAKERS, "to");
	oneOf(a.type, MESSAGE_TYPES, "type");
	oneOf(a.reason_source, TEXT_SOURCES, "reason_source");
	oneOf(a.direction, ["sent", "received"], "direction");
	if (a.payload_json.length > PAYLOAD_MAX) fail("The payload is too large.");
	try {
		JSON.parse(a.payload_json);
	} catch {
		fail("The payload is not valid JSON.");
	}
	let seq = 0;
	for (const m of ctx.db.agent_message.session_id.filter(a.session_id)) if (m.seq > seq) seq = m.seq;
	ctx.db.agent_message.insert({
		id: 0n,
		...a,
		seq: seq + 1,
		created_at: ctx.timestamp
	});
});
const agent_status_set = spacetimedb.reducer({
	session_id: t.string(),
	agent: t.string(),
	status: t.string()
}, (ctx, { session_id, agent, status }) => {
	requireServer(ctx);
	oneOf(agent, AGENT_NAMES, "agent");
	oneOf(status, AGENT_STATUSES, "status");
	const row = {
		id: `${session_id}:${agent}`,
		session_id,
		agent,
		status,
		updated_at: ctx.timestamp
	};
	if (ctx.db.agent_status.id.find(row.id)) ctx.db.agent_status.id.update(row);
	else ctx.db.agent_status.insert(row);
});
/** The Coordinator's RoundState, or the watcher's error in `detail` (rule 14: show it). */
const round_state_set = spacetimedb.reducer({
	session_id: t.string(),
	round: t.u32(),
	state: t.string(),
	detail: t.string()
}, (ctx, { session_id, round, state, detail }) => {
	requireServer(ctx);
	oneOf(state, ROUND_STATES, "state");
	const s = getSession(ctx, session_id);
	ctx.db.session.id.update({
		...s,
		round_state: state,
		round,
		round_detail: detail.slice(0, 500)
	});
});

//#endregion
//#region src/question.ts
function stringList(json, what) {
	let v;
	try {
		v = JSON.parse(json);
	} catch {
		fail(`${what} is not valid JSON.`);
	}
	if (!Array.isArray(v) || !v.every((x) => typeof x === "string" && x.length > 0)) fail(`${what} must be a list of strings.`);
	return v;
}
const question_add = spacetimedb.reducer({
	session_id: t.string(),
	question_id: t.string(),
	round: t.u32(),
	agent: t.string(),
	target_id: t.string(),
	text: t.string(),
	text_source: t.string(),
	choices_json: t.string(),
	allowed_roles_json: t.string()
}, (ctx, a) => {
	requireServer(ctx);
	getSession(ctx, a.session_id);
	if (!AGENT_NAMES.includes(a.agent)) fail(`Unknown agent "${a.agent}".`);
	if (!TEXT_SOURCES.includes(a.text_source)) fail("text_source must be claude or template.");
	if (!a.question_id || !a.text) fail("A question needs an id and text.");
	if (stringList(a.choices_json, "choices").length < 2) fail("A question needs at least two choices.");
	const roles = stringList(a.allowed_roles_json, "allowed_roles");
	if (!roles.length || roles.some((r) => !ANNOTATING_ROLES.includes(r))) fail("Allowed roles are security, clinical_engineering or operations.");
	const id = `${a.session_id}:${a.question_id}`;
	if (ctx.db.question.id.find(id)) fail(`Question "${a.question_id}" already exists.`);
	ctx.db.question.insert({
		id,
		...a,
		answered: false,
		answer_choice: "",
		answer_author: "",
		answer_role: "",
		created_at: ctx.timestamp
	});
});
/** A human answers. Their name and role come from their presence row, never from the caller. */
const question_answer = spacetimedb.reducer({
	session_id: t.string(),
	question_id: t.string(),
	choice: t.string()
}, (ctx, { session_id, question_id, choice }) => {
	if (isServer(ctx)) fail("Only humans answer questions.");
	const q = ctx.db.question.id.find(`${session_id}:${question_id}`) ?? fail("That question does not exist.");
	if (q.answered) fail("This question has already been answered.");
	const p = ctx.db.presence.identity.find(ctx.sender);
	if (!p || p.session_id !== session_id) fail("Join the session before answering.");
	const roles = JSON.parse(q.allowed_roles_json);
	if (!roles.includes(p.role)) fail(`Only ${roles.join(" or ")} can answer this question.`);
	if (!JSON.parse(q.choices_json).includes(choice)) fail(`"${choice}" is not one of the choices.`);
	ctx.db.question.id.update({
		...q,
		answered: true,
		answer_choice: choice,
		answer_author: p.name,
		answer_role: p.role
	});
});

//#endregion
//#region src/recommendation.ts
/** `recommendation_json` is agents/protocol.py's Recommendation, as JSON. */
const recommendation_upsert = spacetimedb.reducer({
	session_id: t.string(),
	round: t.u32(),
	recommendation_json: t.string(),
	fixture: t.bool()
}, (ctx, { session_id, round, recommendation_json, fixture }) => {
	requireServer(ctx);
	getSession(ctx, session_id);
	let rec;
	try {
		rec = JSON.parse(recommendation_json);
	} catch {
		fail("The recommendation is not valid JSON.");
	}
	if (!rec?.policy?.name || !Array.isArray(rec.verdicts) || !Array.isArray(rec.requiredRoles) || !rec.requiredRoles.length) fail("A recommendation needs a policy, verdicts and required roles.");
	const id = `${session_id}:${round}`;
	const old = ctx.db.recommendation.id.find(id);
	const row = {
		id,
		session_id,
		round,
		name: rec.policy.name,
		policy_json: JSON.stringify(rec.policy),
		explanation: rec.explanation ?? "",
		explanation_source: rec.explanationSource ?? "",
		verified_json: JSON.stringify(rec.testResult),
		verdicts_json: JSON.stringify(rec.verdicts),
		required_roles_json: JSON.stringify(rec.requiredRoles),
		fixture,
		status: old ? old.status : "draft",
		updated_at: ctx.timestamp
	};
	if (old) ctx.db.recommendation.id.update(row);
	else ctx.db.recommendation.insert(row);
});

//#endregion
//#region src/index.ts
var src_default = spacetimedb;
/** The identity that publishes the module becomes the server identity (watchers, Node server). */
const init = spacetimedb.init((ctx) => {
	ctx.db.config.insert({
		id: 0,
		server_identity: ctx.sender
	});
});
/** Hand the server identity to another token. Only the current server identity can. */
const config_set_server = spacetimedb.reducer({ identity: t.identity() }, (ctx, { identity }) => {
	if (!isServer(ctx)) fail("Only the server identity can change the server identity.");
	ctx.db.config.id.update({
		id: 0,
		server_identity: identity
	});
});
const on_disconnect = spacetimedb.clientDisconnected((ctx) => {
	if (ctx.db.presence.identity.find(ctx.sender)) ctx.db.presence.identity.delete(ctx.sender);
});
const session_create = spacetimedb.reducer({
	session_id: t.string(),
	hospital_json: t.string()
}, (ctx, { session_id, hospital_json }) => {
	if (!/^[a-z0-9_-]{2,40}$/.test(session_id)) fail("Session ids are 2-40 characters: a-z, 0-9, _ or -.");
	if (ctx.db.session.id.find(session_id)) fail(`Session "${session_id}" already exists.`);
	const file = validateHospital(hospital_json);
	ctx.db.session.insert({
		id: session_id,
		hospital_json,
		hospital_name: file.hospital.name,
		presenter: ctx.sender,
		active_run_id: "",
		created_at: ctx.timestamp,
		round_state: "idle",
		round: 0,
		round_detail: "",
		entry_points_json: "[]",
		solution_pair_id: ""
	});
});
/** The engine's legal patient zeros for this hospital, written by the watcher. The UI dims the rest. */
const session_entry_points_set = spacetimedb.reducer({
	session_id: t.string(),
	entry_points_json: t.string()
}, (ctx, { session_id, entry_points_json }) => {
	requireServer(ctx);
	const s = getSession(ctx, session_id);
	let ids;
	try {
		ids = JSON.parse(entry_points_json);
	} catch {
		fail("entry_points_json is not valid JSON.");
	}
	if (!Array.isArray(ids) || !ids.every((x) => typeof x === "string")) fail("entry_points_json must be a list of device ids.");
	if (new Set(ids).size !== ids.length) fail("entry_points_json lists a device twice.");
	const devices = new Set(hospitalOf(ctx, session_id).devices.map((d) => d.id));
	for (const id of ids) if (!devices.has(id)) fail(`Device "${id}" does not exist.`);
	ctx.db.session.id.update({
		...s,
		entry_points_json: JSON.stringify(ids)
	});
});
const presence_join = spacetimedb.reducer({
	session_id: t.string(),
	name: t.string(),
	role: t.string()
}, (ctx, { session_id, name, role }) => {
	getSession(ctx, session_id);
	if (!ROLES.includes(role)) fail(`Role must be one of: ${ROLES.join(", ")}.`);
	const clean = name.trim().slice(0, 40);
	if (!clean) fail("Enter a name.");
	const row = {
		identity: ctx.sender,
		session_id,
		name: clean,
		role,
		following: true,
		last_seen: ctx.timestamp
	};
	if (ctx.db.presence.identity.find(ctx.sender)) ctx.db.presence.identity.update(row);
	else ctx.db.presence.insert(row);
});
const presence_heartbeat = spacetimedb.reducer({ following: t.bool() }, (ctx, { following }) => {
	const p = ctx.db.presence.identity.find(ctx.sender) ?? fail("Join the session first.");
	ctx.db.presence.identity.update({
		...p,
		following,
		last_seen: ctx.timestamp
	});
});
const set_presenter = spacetimedb.reducer({
	session_id: t.string(),
	presenter: t.identity()
}, (ctx, { session_id, presenter }) => {
	requirePresenter(ctx, session_id);
	const s = getSession(ctx, session_id);
	ctx.db.session.id.update({
		...s,
		presenter
	});
});
/** A new run, waiting for the engine. Writes no state rows: frame 0 does. */
const run_start = spacetimedb.reducer({
	session_id: t.string(),
	run_id: t.string(),
	label: t.string(),
	patient_zero: t.string(),
	seed: t.u32(),
	speed: t.f64(),
	policy_json: t.string(),
	pair_id: t.string(),
	autoplay: t.bool()
}, (ctx, a) => {
	requirePresenter(ctx, a.session_id);
	if (ctx.db.run.id.find(a.run_id)) fail(`Run "${a.run_id}" already exists.`);
	if (!SPEEDS.includes(a.speed)) fail("Speed must be 0.5, 1, 2 or 4.");
	const s = getSession(ctx, a.session_id);
	if (!hospitalOf(ctx, a.session_id).devices.some((d) => d.id === a.patient_zero)) fail(`Device "${a.patient_zero}" does not exist.`);
	const entryPoints = JSON.parse(s.entry_points_json);
	if (entryPoints.length && !entryPoints.includes(a.patient_zero)) fail(`The engine can't start an attack on "${a.patient_zero}": patient zero must be a Windows device that runs software and is not a medical device. Pick a highlighted device.`);
	if (a.policy_json) try {
		JSON.parse(a.policy_json);
	} catch {
		fail("The policy is not valid JSON.");
	}
	ctx.db.run.insert({
		...BEFORE_FRAME_0,
		id: a.run_id,
		session_id: a.session_id,
		pair_id: a.pair_id,
		label: a.label || "Run",
		seed: a.seed,
		patient_zero: a.patient_zero,
		policy_json: a.policy_json,
		speed: a.speed,
		autoplay: a.autoplay,
		challenges_json: "[]",
		recommendation_id: "",
		started_at: ctx.timestamp
	});
	if (!a.pair_id) ctx.db.session.id.update({
		...getSession(ctx, a.session_id),
		active_run_id: a.run_id
	});
});
/** Pause or resume every run under the key that is in `from`. Others keep their status. */
function setStatus(ctx, r, from, to) {
	for (const x of runsForKey(ctx, r)) if (x.status === from) ctx.db.run.id.update({
		...x,
		status: to
	});
}
const run_pause = spacetimedb.reducer({ run_id: t.string() }, (ctx, { run_id }) => {
	const r = readRun(ctx, run_id);
	requirePresenter(ctx, r.session_id);
	setStatus(ctx, r, "running", "paused");
});
const run_resume = spacetimedb.reducer({ run_id: t.string() }, (ctx, { run_id }) => {
	const r = readRun(ctx, run_id);
	requirePresenter(ctx, r.session_id);
	const refusal = statusRefusal(r.status);
	if (refusal) fail(refusal);
	setStatus(ctx, r, "paused", "running");
});
const run_set_speed = spacetimedb.reducer({
	run_id: t.string(),
	speed: t.f64()
}, (ctx, { run_id, speed }) => {
	const r = readRun(ctx, run_id);
	requirePresenter(ctx, r.session_id);
	if (!SPEEDS.includes(speed)) fail("Speed must be 0.5, 1, 2 or 4.");
	for (const x of runsForKey(ctx, r)) ctx.db.run.id.update({
		...x,
		speed
	});
});
/** One step while paused: the watcher sees step_pending and applies the next frame. */
const run_step = spacetimedb.reducer({ run_id: t.string() }, (ctx, { run_id }) => {
	const r = readRun(ctx, run_id);
	requirePresenter(ctx, r.session_id);
	if (r.status === "running") fail("Pause the run before stepping.");
	const refusal = statusRefusal(r.status);
	if (refusal) fail(refusal);
	for (const x of runsForKey(ctx, r)) if (x.status === "paused") ctx.db.run.id.update({
		...x,
		step_pending: true
	});
});
/** Back to `requested` with every row cleared. The engine is deterministic, so the watcher recomputes the same run. */
const run_reset = spacetimedb.reducer({ run_id: t.string() }, (ctx, { run_id }) => {
	const r = readRun(ctx, run_id);
	requirePresenter(ctx, r.session_id);
	if (r.status === "requested") fail(statusRefusal(r.status));
	for (const x of runsForKey(ctx, r)) {
		deleteRunRows(ctx, x.id);
		ctx.db.run.id.update({
			...x,
			...BEFORE_FRAME_0,
			autoplay: false
		});
	}
});
const annotation_add = spacetimedb.reducer({
	session_id: t.string(),
	target_id: t.string(),
	note: t.string()
}, (ctx, { session_id, target_id, note }) => {
	const s = getSession(ctx, session_id);
	const p = ctx.db.presence.identity.find(ctx.sender);
	if (!p || p.session_id !== session_id) fail("Join the session before adding a focus.");
	if (!ANNOTATING_ROLES.includes(p.role)) fail("Observers can see focus pins but can't add them.");
	if (!hospitalOf(ctx, session_id).devices.some((d) => d.id === target_id)) fail(`Device "${target_id}" does not exist.`);
	if (note.length > NOTE_MAX) fail(`Notes are at most ${NOTE_MAX} characters.`);
	for (const a of [...ctx.db.annotation.session_id.filter(session_id)]) if (a.active && a.target_id === target_id && same(a.author, ctx.sender)) fail("You already have a focus on this device.");
	ctx.db.annotation.insert({
		id: 0n,
		session_id,
		run_id: s.active_run_id,
		kind: "focus",
		target_id,
		note: note.trim(),
		author: ctx.sender,
		author_name: p.name,
		role: p.role,
		active: true,
		created_at: ctx.timestamp,
		cleared_by: ""
	});
});
const annotation_clear = spacetimedb.reducer({ annotation_id: t.u64() }, (ctx, { annotation_id }) => {
	const a = ctx.db.annotation.id.find(annotation_id) ?? fail("That focus no longer exists.");
	if (!a.active) return;
	const s = getSession(ctx, a.session_id);
	if (!(same(a.author, ctx.sender) || same(s.presenter, ctx.sender) || isServer(ctx))) fail("Only the author or the presenter can clear this focus.");
	ctx.db.annotation.id.update({
		...a,
		active: false,
		cleared_by: ctx.sender.toHexString()
	});
});

//#endregion
export { agent_message_add, agent_status_set, annotation_add, annotation_clear, config_set_server, src_default as default, defend_request, init, on_disconnect, presence_heartbeat, presence_join, question_add, question_answer, recommendation_upsert, round_state_set, run_fail, run_frames_apply, run_pause, run_reset, run_resume, run_set_speed, run_start, run_step, session_create, session_entry_points_set, set_presenter, solution_close, solution_start };
//# debugId=742612d0-f590-4acf-aabe-eddecd53f6b2
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwibmFtZXMiOlsiX19jcmVhdGUiLCJfX2RlZlByb3AiLCJfX2dldE93blByb3BEZXNjIiwiX19nZXRPd25Qcm9wTmFtZXMiLCJfX2dldFByb3RvT2YiLCJfX2hhc093blByb3AiLCJfX2NvbW1vbkpTIiwiX19jb3B5UHJvcHMiLCJfX3RvRVNNIiwiI2Vuc3VyZSIsIiNtb2R1bGVEZWYiLCIjcmVnaXN0ZXJDb21wb3VuZFR5cGVSZWN1cnNpdmVseSIsIiNjb21wb3VuZFR5cGVzIiwiI2JvZHkiLCIjaW5uZXIiLCIjZnJvbSIsIiN0byIsIiNiYWNrZW5kIiwiI3NlbmRlckF1dGgiLCIjcmFuZG9tIiwiI3V1aWRDb3VudGVyIiwiI2lkZW50aXR5IiwiI3NjaGVtYSIsIiNjb25zdW1lclJlZHVjZXJDb3VudCIsIiNjb25zdW1lclByb2NlZHVyZUNvdW50IiwiI2NvbnN1bWVyQW5vblZpZXdDb3VudCIsIiNjb25zdW1lclZpZXdDb3VudCIsIiNmbGF0U3VibW9kdWxlcyIsIiNyZWR1Y2VyQXJnc0Rlc2VyaWFsaXplcnMiLCIjZGJWaWV3IiwiI2RiVmlld18iLCIjc3VibW9kdWxlQXNWaWV3c18iLCIjcmVkdWNlckN0eCIsIiNyZWR1Y2VyQ3R4XyIsIiNjb25zdW1lckFzIiwiI2NvbnN1bWVyQXNfIiwiI2dldFN1Ym1vZHVsZURiVmlldyIsIiNnZXRTdWJtb2R1bGVBc1ZpZXdzIiwiI2dldFN1Ym1vZHVsZVF1ZXJ5QnVpbGRlciIsIiNkaXNwYXRjaGVzIiwiI2FzVmlld3MiLCIjZmluYWxpemF0aW9uUmVnaXN0cnkiLCIjaWQiLCIjZGV0YWNoIiwiI2h0dHAiLCIjc2xlZXAiLCIjY2hpbGRTZWVkUmFuZG9tIiwiI3BhcmVudFByZWZpeCIsIiNjdHgiXSwic291cmNlcyI6WyIuLi9ub2RlX21vZHVsZXMvaGVhZGVycy1wb2x5ZmlsbC9saWIvaW5kZXgubWpzIiwiLi4vbm9kZV9tb2R1bGVzL3NwYWNldGltZWRiL2Rpc3Qvc2VydmVyL2luZGV4Lm1qcyIsInNyYy9jb25zdGFudHMudHMiLCJzcmMvc2NoZW1hLnRzIiwic3JjL2hvc3BpdGFsLnRzIiwic3JjL2luZ2VzdC50cyIsInNyYy9zb2x1dGlvbi50cyIsInNyYy9hZ2VudHMudHMiLCJzcmMvcXVlc3Rpb24udHMiLCJzcmMvcmVjb21tZW5kYXRpb24udHMiLCJzcmMvaW5kZXgudHMiXSwic291cmNlc0NvbnRlbnQiOlsidmFyIF9fY3JlYXRlID0gT2JqZWN0LmNyZWF0ZTtcbnZhciBfX2RlZlByb3AgPSBPYmplY3QuZGVmaW5lUHJvcGVydHk7XG52YXIgX19nZXRPd25Qcm9wRGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3I7XG52YXIgX19nZXRPd25Qcm9wTmFtZXMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcztcbnZhciBfX2dldFByb3RvT2YgPSBPYmplY3QuZ2V0UHJvdG90eXBlT2Y7XG52YXIgX19oYXNPd25Qcm9wID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcbnZhciBfX2NvbW1vbkpTID0gKGNiLCBtb2QpID0+IGZ1bmN0aW9uIF9fcmVxdWlyZSgpIHtcbiAgcmV0dXJuIG1vZCB8fCAoMCwgY2JbX19nZXRPd25Qcm9wTmFtZXMoY2IpWzBdXSkoKG1vZCA9IHsgZXhwb3J0czoge30gfSkuZXhwb3J0cywgbW9kKSwgbW9kLmV4cG9ydHM7XG59O1xudmFyIF9fY29weVByb3BzID0gKHRvLCBmcm9tLCBleGNlcHQsIGRlc2MpID0+IHtcbiAgaWYgKGZyb20gJiYgdHlwZW9mIGZyb20gPT09IFwib2JqZWN0XCIgfHwgdHlwZW9mIGZyb20gPT09IFwiZnVuY3Rpb25cIikge1xuICAgIGZvciAobGV0IGtleSBvZiBfX2dldE93blByb3BOYW1lcyhmcm9tKSlcbiAgICAgIGlmICghX19oYXNPd25Qcm9wLmNhbGwodG8sIGtleSkgJiYga2V5ICE9PSBleGNlcHQpXG4gICAgICAgIF9fZGVmUHJvcCh0bywga2V5LCB7IGdldDogKCkgPT4gZnJvbVtrZXldLCBlbnVtZXJhYmxlOiAhKGRlc2MgPSBfX2dldE93blByb3BEZXNjKGZyb20sIGtleSkpIHx8IGRlc2MuZW51bWVyYWJsZSB9KTtcbiAgfVxuICByZXR1cm4gdG87XG59O1xudmFyIF9fdG9FU00gPSAobW9kLCBpc05vZGVNb2RlLCB0YXJnZXQpID0+ICh0YXJnZXQgPSBtb2QgIT0gbnVsbCA/IF9fY3JlYXRlKF9fZ2V0UHJvdG9PZihtb2QpKSA6IHt9LCBfX2NvcHlQcm9wcyhcbiAgLy8gSWYgdGhlIGltcG9ydGVyIGlzIGluIG5vZGUgY29tcGF0aWJpbGl0eSBtb2RlIG9yIHRoaXMgaXMgbm90IGFuIEVTTVxuICAvLyBmaWxlIHRoYXQgaGFzIGJlZW4gY29udmVydGVkIHRvIGEgQ29tbW9uSlMgZmlsZSB1c2luZyBhIEJhYmVsLVxuICAvLyBjb21wYXRpYmxlIHRyYW5zZm9ybSAoaS5lLiBcIl9fZXNNb2R1bGVcIiBoYXMgbm90IGJlZW4gc2V0KSwgdGhlbiBzZXRcbiAgLy8gXCJkZWZhdWx0XCIgdG8gdGhlIENvbW1vbkpTIFwibW9kdWxlLmV4cG9ydHNcIiBmb3Igbm9kZSBjb21wYXRpYmlsaXR5LlxuICBpc05vZGVNb2RlIHx8ICFtb2QgfHwgIW1vZC5fX2VzTW9kdWxlID8gX19kZWZQcm9wKHRhcmdldCwgXCJkZWZhdWx0XCIsIHsgdmFsdWU6IG1vZCwgZW51bWVyYWJsZTogdHJ1ZSB9KSA6IHRhcmdldCxcbiAgbW9kXG4pKTtcblxuLy8gbm9kZV9tb2R1bGVzL3NldC1jb29raWUtcGFyc2VyL2xpYi9zZXQtY29va2llLmpzXG52YXIgcmVxdWlyZV9zZXRfY29va2llID0gX19jb21tb25KUyh7XG4gIFwibm9kZV9tb2R1bGVzL3NldC1jb29raWUtcGFyc2VyL2xpYi9zZXQtY29va2llLmpzXCIoZXhwb3J0cywgbW9kdWxlKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG4gICAgdmFyIGRlZmF1bHRQYXJzZU9wdGlvbnMgPSB7XG4gICAgICBkZWNvZGVWYWx1ZXM6IHRydWUsXG4gICAgICBtYXA6IGZhbHNlLFxuICAgICAgc2lsZW50OiBmYWxzZVxuICAgIH07XG4gICAgZnVuY3Rpb24gaXNOb25FbXB0eVN0cmluZyhzdHIpIHtcbiAgICAgIHJldHVybiB0eXBlb2Ygc3RyID09PSBcInN0cmluZ1wiICYmICEhc3RyLnRyaW0oKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gcGFyc2VTdHJpbmcoc2V0Q29va2llVmFsdWUsIG9wdGlvbnMpIHtcbiAgICAgIHZhciBwYXJ0cyA9IHNldENvb2tpZVZhbHVlLnNwbGl0KFwiO1wiKS5maWx0ZXIoaXNOb25FbXB0eVN0cmluZyk7XG4gICAgICB2YXIgbmFtZVZhbHVlUGFpclN0ciA9IHBhcnRzLnNoaWZ0KCk7XG4gICAgICB2YXIgcGFyc2VkID0gcGFyc2VOYW1lVmFsdWVQYWlyKG5hbWVWYWx1ZVBhaXJTdHIpO1xuICAgICAgdmFyIG5hbWUgPSBwYXJzZWQubmFtZTtcbiAgICAgIHZhciB2YWx1ZSA9IHBhcnNlZC52YWx1ZTtcbiAgICAgIG9wdGlvbnMgPSBvcHRpb25zID8gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdFBhcnNlT3B0aW9ucywgb3B0aW9ucykgOiBkZWZhdWx0UGFyc2VPcHRpb25zO1xuICAgICAgdHJ5IHtcbiAgICAgICAgdmFsdWUgPSBvcHRpb25zLmRlY29kZVZhbHVlcyA/IGRlY29kZVVSSUNvbXBvbmVudCh2YWx1ZSkgOiB2YWx1ZTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICBcInNldC1jb29raWUtcGFyc2VyIGVuY291bnRlcmVkIGFuIGVycm9yIHdoaWxlIGRlY29kaW5nIGEgY29va2llIHdpdGggdmFsdWUgJ1wiICsgdmFsdWUgKyBcIicuIFNldCBvcHRpb25zLmRlY29kZVZhbHVlcyB0byBmYWxzZSB0byBkaXNhYmxlIHRoaXMgZmVhdHVyZS5cIixcbiAgICAgICAgICBlXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICB2YXIgY29va2llID0ge1xuICAgICAgICBuYW1lLFxuICAgICAgICB2YWx1ZVxuICAgICAgfTtcbiAgICAgIHBhcnRzLmZvckVhY2goZnVuY3Rpb24ocGFydCkge1xuICAgICAgICB2YXIgc2lkZXMgPSBwYXJ0LnNwbGl0KFwiPVwiKTtcbiAgICAgICAgdmFyIGtleSA9IHNpZGVzLnNoaWZ0KCkudHJpbUxlZnQoKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICB2YXIgdmFsdWUyID0gc2lkZXMuam9pbihcIj1cIik7XG4gICAgICAgIGlmIChrZXkgPT09IFwiZXhwaXJlc1wiKSB7XG4gICAgICAgICAgY29va2llLmV4cGlyZXMgPSBuZXcgRGF0ZSh2YWx1ZTIpO1xuICAgICAgICB9IGVsc2UgaWYgKGtleSA9PT0gXCJtYXgtYWdlXCIpIHtcbiAgICAgICAgICBjb29raWUubWF4QWdlID0gcGFyc2VJbnQodmFsdWUyLCAxMCk7XG4gICAgICAgIH0gZWxzZSBpZiAoa2V5ID09PSBcInNlY3VyZVwiKSB7XG4gICAgICAgICAgY29va2llLnNlY3VyZSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSBpZiAoa2V5ID09PSBcImh0dHBvbmx5XCIpIHtcbiAgICAgICAgICBjb29raWUuaHR0cE9ubHkgPSB0cnVlO1xuICAgICAgICB9IGVsc2UgaWYgKGtleSA9PT0gXCJzYW1lc2l0ZVwiKSB7XG4gICAgICAgICAgY29va2llLnNhbWVTaXRlID0gdmFsdWUyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvb2tpZVtrZXldID0gdmFsdWUyO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBjb29raWU7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHBhcnNlTmFtZVZhbHVlUGFpcihuYW1lVmFsdWVQYWlyU3RyKSB7XG4gICAgICB2YXIgbmFtZSA9IFwiXCI7XG4gICAgICB2YXIgdmFsdWUgPSBcIlwiO1xuICAgICAgdmFyIG5hbWVWYWx1ZUFyciA9IG5hbWVWYWx1ZVBhaXJTdHIuc3BsaXQoXCI9XCIpO1xuICAgICAgaWYgKG5hbWVWYWx1ZUFyci5sZW5ndGggPiAxKSB7XG4gICAgICAgIG5hbWUgPSBuYW1lVmFsdWVBcnIuc2hpZnQoKTtcbiAgICAgICAgdmFsdWUgPSBuYW1lVmFsdWVBcnIuam9pbihcIj1cIik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YWx1ZSA9IG5hbWVWYWx1ZVBhaXJTdHI7XG4gICAgICB9XG4gICAgICByZXR1cm4geyBuYW1lLCB2YWx1ZSB9O1xuICAgIH1cbiAgICBmdW5jdGlvbiBwYXJzZShpbnB1dCwgb3B0aW9ucykge1xuICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgPyBPYmplY3QuYXNzaWduKHt9LCBkZWZhdWx0UGFyc2VPcHRpb25zLCBvcHRpb25zKSA6IGRlZmF1bHRQYXJzZU9wdGlvbnM7XG4gICAgICBpZiAoIWlucHV0KSB7XG4gICAgICAgIGlmICghb3B0aW9ucy5tYXApIHtcbiAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHt9O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoaW5wdXQuaGVhZGVycykge1xuICAgICAgICBpZiAodHlwZW9mIGlucHV0LmhlYWRlcnMuZ2V0U2V0Q29va2llID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICBpbnB1dCA9IGlucHV0LmhlYWRlcnMuZ2V0U2V0Q29va2llKCk7XG4gICAgICAgIH0gZWxzZSBpZiAoaW5wdXQuaGVhZGVyc1tcInNldC1jb29raWVcIl0pIHtcbiAgICAgICAgICBpbnB1dCA9IGlucHV0LmhlYWRlcnNbXCJzZXQtY29va2llXCJdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhciBzY2ggPSBpbnB1dC5oZWFkZXJzW09iamVjdC5rZXlzKGlucHV0LmhlYWRlcnMpLmZpbmQoZnVuY3Rpb24oa2V5KSB7XG4gICAgICAgICAgICByZXR1cm4ga2V5LnRvTG93ZXJDYXNlKCkgPT09IFwic2V0LWNvb2tpZVwiO1xuICAgICAgICAgIH0pXTtcbiAgICAgICAgICBpZiAoIXNjaCAmJiBpbnB1dC5oZWFkZXJzLmNvb2tpZSAmJiAhb3B0aW9ucy5zaWxlbnQpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgICAgICAgXCJXYXJuaW5nOiBzZXQtY29va2llLXBhcnNlciBhcHBlYXJzIHRvIGhhdmUgYmVlbiBjYWxsZWQgb24gYSByZXF1ZXN0IG9iamVjdC4gSXQgaXMgZGVzaWduZWQgdG8gcGFyc2UgU2V0LUNvb2tpZSBoZWFkZXJzIGZyb20gcmVzcG9uc2VzLCBub3QgQ29va2llIGhlYWRlcnMgZnJvbSByZXF1ZXN0cy4gU2V0IHRoZSBvcHRpb24ge3NpbGVudDogdHJ1ZX0gdG8gc3VwcHJlc3MgdGhpcyB3YXJuaW5nLlwiXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpbnB1dCA9IHNjaDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGlucHV0KSkge1xuICAgICAgICBpbnB1dCA9IFtpbnB1dF07XG4gICAgICB9XG4gICAgICBvcHRpb25zID0gb3B0aW9ucyA/IE9iamVjdC5hc3NpZ24oe30sIGRlZmF1bHRQYXJzZU9wdGlvbnMsIG9wdGlvbnMpIDogZGVmYXVsdFBhcnNlT3B0aW9ucztcbiAgICAgIGlmICghb3B0aW9ucy5tYXApIHtcbiAgICAgICAgcmV0dXJuIGlucHV0LmZpbHRlcihpc05vbkVtcHR5U3RyaW5nKS5tYXAoZnVuY3Rpb24oc3RyKSB7XG4gICAgICAgICAgcmV0dXJuIHBhcnNlU3RyaW5nKHN0ciwgb3B0aW9ucyk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGNvb2tpZXMgPSB7fTtcbiAgICAgICAgcmV0dXJuIGlucHV0LmZpbHRlcihpc05vbkVtcHR5U3RyaW5nKS5yZWR1Y2UoZnVuY3Rpb24oY29va2llczIsIHN0cikge1xuICAgICAgICAgIHZhciBjb29raWUgPSBwYXJzZVN0cmluZyhzdHIsIG9wdGlvbnMpO1xuICAgICAgICAgIGNvb2tpZXMyW2Nvb2tpZS5uYW1lXSA9IGNvb2tpZTtcbiAgICAgICAgICByZXR1cm4gY29va2llczI7XG4gICAgICAgIH0sIGNvb2tpZXMpO1xuICAgICAgfVxuICAgIH1cbiAgICBmdW5jdGlvbiBzcGxpdENvb2tpZXNTdHJpbmcyKGNvb2tpZXNTdHJpbmcpIHtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KGNvb2tpZXNTdHJpbmcpKSB7XG4gICAgICAgIHJldHVybiBjb29raWVzU3RyaW5nO1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiBjb29raWVzU3RyaW5nICE9PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICAgIH1cbiAgICAgIHZhciBjb29raWVzU3RyaW5ncyA9IFtdO1xuICAgICAgdmFyIHBvcyA9IDA7XG4gICAgICB2YXIgc3RhcnQ7XG4gICAgICB2YXIgY2g7XG4gICAgICB2YXIgbGFzdENvbW1hO1xuICAgICAgdmFyIG5leHRTdGFydDtcbiAgICAgIHZhciBjb29raWVzU2VwYXJhdG9yRm91bmQ7XG4gICAgICBmdW5jdGlvbiBza2lwV2hpdGVzcGFjZSgpIHtcbiAgICAgICAgd2hpbGUgKHBvcyA8IGNvb2tpZXNTdHJpbmcubGVuZ3RoICYmIC9cXHMvLnRlc3QoY29va2llc1N0cmluZy5jaGFyQXQocG9zKSkpIHtcbiAgICAgICAgICBwb3MgKz0gMTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcG9zIDwgY29va2llc1N0cmluZy5sZW5ndGg7XG4gICAgICB9XG4gICAgICBmdW5jdGlvbiBub3RTcGVjaWFsQ2hhcigpIHtcbiAgICAgICAgY2ggPSBjb29raWVzU3RyaW5nLmNoYXJBdChwb3MpO1xuICAgICAgICByZXR1cm4gY2ggIT09IFwiPVwiICYmIGNoICE9PSBcIjtcIiAmJiBjaCAhPT0gXCIsXCI7XG4gICAgICB9XG4gICAgICB3aGlsZSAocG9zIDwgY29va2llc1N0cmluZy5sZW5ndGgpIHtcbiAgICAgICAgc3RhcnQgPSBwb3M7XG4gICAgICAgIGNvb2tpZXNTZXBhcmF0b3JGb3VuZCA9IGZhbHNlO1xuICAgICAgICB3aGlsZSAoc2tpcFdoaXRlc3BhY2UoKSkge1xuICAgICAgICAgIGNoID0gY29va2llc1N0cmluZy5jaGFyQXQocG9zKTtcbiAgICAgICAgICBpZiAoY2ggPT09IFwiLFwiKSB7XG4gICAgICAgICAgICBsYXN0Q29tbWEgPSBwb3M7XG4gICAgICAgICAgICBwb3MgKz0gMTtcbiAgICAgICAgICAgIHNraXBXaGl0ZXNwYWNlKCk7XG4gICAgICAgICAgICBuZXh0U3RhcnQgPSBwb3M7XG4gICAgICAgICAgICB3aGlsZSAocG9zIDwgY29va2llc1N0cmluZy5sZW5ndGggJiYgbm90U3BlY2lhbENoYXIoKSkge1xuICAgICAgICAgICAgICBwb3MgKz0gMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChwb3MgPCBjb29raWVzU3RyaW5nLmxlbmd0aCAmJiBjb29raWVzU3RyaW5nLmNoYXJBdChwb3MpID09PSBcIj1cIikge1xuICAgICAgICAgICAgICBjb29raWVzU2VwYXJhdG9yRm91bmQgPSB0cnVlO1xuICAgICAgICAgICAgICBwb3MgPSBuZXh0U3RhcnQ7XG4gICAgICAgICAgICAgIGNvb2tpZXNTdHJpbmdzLnB1c2goY29va2llc1N0cmluZy5zdWJzdHJpbmcoc3RhcnQsIGxhc3RDb21tYSkpO1xuICAgICAgICAgICAgICBzdGFydCA9IHBvcztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBvcyA9IGxhc3RDb21tYSArIDE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBvcyArPSAxO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoIWNvb2tpZXNTZXBhcmF0b3JGb3VuZCB8fCBwb3MgPj0gY29va2llc1N0cmluZy5sZW5ndGgpIHtcbiAgICAgICAgICBjb29raWVzU3RyaW5ncy5wdXNoKGNvb2tpZXNTdHJpbmcuc3Vic3RyaW5nKHN0YXJ0LCBjb29raWVzU3RyaW5nLmxlbmd0aCkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gY29va2llc1N0cmluZ3M7XG4gICAgfVxuICAgIG1vZHVsZS5leHBvcnRzID0gcGFyc2U7XG4gICAgbW9kdWxlLmV4cG9ydHMucGFyc2UgPSBwYXJzZTtcbiAgICBtb2R1bGUuZXhwb3J0cy5wYXJzZVN0cmluZyA9IHBhcnNlU3RyaW5nO1xuICAgIG1vZHVsZS5leHBvcnRzLnNwbGl0Q29va2llc1N0cmluZyA9IHNwbGl0Q29va2llc1N0cmluZzI7XG4gIH1cbn0pO1xuXG4vLyBzcmMvSGVhZGVycy50c1xudmFyIGltcG9ydF9zZXRfY29va2llX3BhcnNlciA9IF9fdG9FU00ocmVxdWlyZV9zZXRfY29va2llKCkpO1xuXG4vLyBzcmMvdXRpbHMvbm9ybWFsaXplSGVhZGVyTmFtZS50c1xudmFyIEhFQURFUlNfSU5WQUxJRF9DSEFSQUNURVJTID0gL1teYS16MC05XFwtIyQlJicqKy5eX2B8fl0vaTtcbmZ1bmN0aW9uIG5vcm1hbGl6ZUhlYWRlck5hbWUobmFtZSkge1xuICBpZiAoSEVBREVSU19JTlZBTElEX0NIQVJBQ1RFUlMudGVzdChuYW1lKSB8fCBuYW1lLnRyaW0oKSA9PT0gXCJcIikge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJJbnZhbGlkIGNoYXJhY3RlciBpbiBoZWFkZXIgZmllbGQgbmFtZVwiKTtcbiAgfVxuICByZXR1cm4gbmFtZS50cmltKCkudG9Mb3dlckNhc2UoKTtcbn1cblxuLy8gc3JjL3V0aWxzL25vcm1hbGl6ZUhlYWRlclZhbHVlLnRzXG52YXIgY2hhckNvZGVzVG9SZW1vdmUgPSBbXG4gIFN0cmluZy5mcm9tQ2hhckNvZGUoMTApLFxuICBTdHJpbmcuZnJvbUNoYXJDb2RlKDEzKSxcbiAgU3RyaW5nLmZyb21DaGFyQ29kZSg5KSxcbiAgU3RyaW5nLmZyb21DaGFyQ29kZSgzMilcbl07XG52YXIgSEVBREVSX1ZBTFVFX1JFTU9WRV9SRUdFWFAgPSBuZXcgUmVnRXhwKFxuICBgKF5bJHtjaGFyQ29kZXNUb1JlbW92ZS5qb2luKFwiXCIpfV18JFske2NoYXJDb2Rlc1RvUmVtb3ZlLmpvaW4oXCJcIil9XSlgLFxuICBcImdcIlxuKTtcbmZ1bmN0aW9uIG5vcm1hbGl6ZUhlYWRlclZhbHVlKHZhbHVlKSB7XG4gIGNvbnN0IG5leHRWYWx1ZSA9IHZhbHVlLnJlcGxhY2UoSEVBREVSX1ZBTFVFX1JFTU9WRV9SRUdFWFAsIFwiXCIpO1xuICByZXR1cm4gbmV4dFZhbHVlO1xufVxuXG4vLyBzcmMvdXRpbHMvaXNWYWxpZEhlYWRlck5hbWUudHNcbmZ1bmN0aW9uIGlzVmFsaWRIZWFkZXJOYW1lKHZhbHVlKSB7XG4gIGlmICh0eXBlb2YgdmFsdWUgIT09IFwic3RyaW5nXCIpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKHZhbHVlLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBmb3IgKGxldCBpID0gMDsgaSA8IHZhbHVlLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgY2hhcmFjdGVyID0gdmFsdWUuY2hhckNvZGVBdChpKTtcbiAgICBpZiAoY2hhcmFjdGVyID4gMTI3IHx8ICFpc1Rva2VuKGNoYXJhY3RlcikpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5mdW5jdGlvbiBpc1Rva2VuKHZhbHVlKSB7XG4gIHJldHVybiAhW1xuICAgIDEyNyxcbiAgICAzMixcbiAgICBcIihcIixcbiAgICBcIilcIixcbiAgICBcIjxcIixcbiAgICBcIj5cIixcbiAgICBcIkBcIixcbiAgICBcIixcIixcbiAgICBcIjtcIixcbiAgICBcIjpcIixcbiAgICBcIlxcXFxcIixcbiAgICAnXCInLFxuICAgIFwiL1wiLFxuICAgIFwiW1wiLFxuICAgIFwiXVwiLFxuICAgIFwiP1wiLFxuICAgIFwiPVwiLFxuICAgIFwie1wiLFxuICAgIFwifVwiXG4gIF0uaW5jbHVkZXModmFsdWUpO1xufVxuXG4vLyBzcmMvdXRpbHMvaXNWYWxpZEhlYWRlclZhbHVlLnRzXG5mdW5jdGlvbiBpc1ZhbGlkSGVhZGVyVmFsdWUodmFsdWUpIHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gXCJzdHJpbmdcIikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAodmFsdWUudHJpbSgpICE9PSB2YWx1ZSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBmb3IgKGxldCBpID0gMDsgaSA8IHZhbHVlLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgY2hhcmFjdGVyID0gdmFsdWUuY2hhckNvZGVBdChpKTtcbiAgICBpZiAoXG4gICAgICAvLyBOVUwuXG4gICAgICBjaGFyYWN0ZXIgPT09IDAgfHwgLy8gSFRUUCBuZXdsaW5lIGJ5dGVzLlxuICAgICAgY2hhcmFjdGVyID09PSAxMCB8fCBjaGFyYWN0ZXIgPT09IDEzXG4gICAgKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG4vLyBzcmMvSGVhZGVycy50c1xudmFyIE5PUk1BTElaRURfSEVBREVSUyA9IFN5bWJvbChcIm5vcm1hbGl6ZWRIZWFkZXJzXCIpO1xudmFyIFJBV19IRUFERVJfTkFNRVMgPSBTeW1ib2woXCJyYXdIZWFkZXJOYW1lc1wiKTtcbnZhciBIRUFERVJfVkFMVUVfREVMSU1JVEVSID0gXCIsIFwiO1xudmFyIF9hLCBfYiwgX2M7XG52YXIgSGVhZGVycyA9IGNsYXNzIF9IZWFkZXJzIHtcbiAgY29uc3RydWN0b3IoaW5pdCkge1xuICAgIC8vIE5vcm1hbGl6ZWQgaGVhZGVyIHtcIm5hbWVcIjpcImEsIGJcIn0gc3RvcmFnZS5cbiAgICB0aGlzW19hXSA9IHt9O1xuICAgIC8vIEtlZXBzIHRoZSBtYXBwaW5nIGJldHdlZW4gdGhlIHJhdyBoZWFkZXIgbmFtZVxuICAgIC8vIGFuZCB0aGUgbm9ybWFsaXplZCBoZWFkZXIgbmFtZSB0byBlYXNlIHRoZSBsb29rdXAuXG4gICAgdGhpc1tfYl0gPSAvKiBAX19QVVJFX18gKi8gbmV3IE1hcCgpO1xuICAgIHRoaXNbX2NdID0gXCJIZWFkZXJzXCI7XG4gICAgaWYgKFtcIkhlYWRlcnNcIiwgXCJIZWFkZXJzUG9seWZpbGxcIl0uaW5jbHVkZXMoaW5pdD8uY29uc3RydWN0b3IubmFtZSkgfHwgaW5pdCBpbnN0YW5jZW9mIF9IZWFkZXJzIHx8IHR5cGVvZiBnbG9iYWxUaGlzLkhlYWRlcnMgIT09IFwidW5kZWZpbmVkXCIgJiYgaW5pdCBpbnN0YW5jZW9mIGdsb2JhbFRoaXMuSGVhZGVycykge1xuICAgICAgY29uc3QgaW5pdGlhbEhlYWRlcnMgPSBpbml0O1xuICAgICAgaW5pdGlhbEhlYWRlcnMuZm9yRWFjaCgodmFsdWUsIG5hbWUpID0+IHtcbiAgICAgICAgdGhpcy5hcHBlbmQobmFtZSwgdmFsdWUpO1xuICAgICAgfSwgdGhpcyk7XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGluaXQpKSB7XG4gICAgICBpbml0LmZvckVhY2goKFtuYW1lLCB2YWx1ZV0pID0+IHtcbiAgICAgICAgdGhpcy5hcHBlbmQoXG4gICAgICAgICAgbmFtZSxcbiAgICAgICAgICBBcnJheS5pc0FycmF5KHZhbHVlKSA/IHZhbHVlLmpvaW4oSEVBREVSX1ZBTFVFX0RFTElNSVRFUikgOiB2YWx1ZVxuICAgICAgICApO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmIChpbml0KSB7XG4gICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhpbml0KS5mb3JFYWNoKChuYW1lKSA9PiB7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gaW5pdFtuYW1lXTtcbiAgICAgICAgdGhpcy5hcHBlbmQoXG4gICAgICAgICAgbmFtZSxcbiAgICAgICAgICBBcnJheS5pc0FycmF5KHZhbHVlKSA/IHZhbHVlLmpvaW4oSEVBREVSX1ZBTFVFX0RFTElNSVRFUikgOiB2YWx1ZVxuICAgICAgICApO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIFsoX2EgPSBOT1JNQUxJWkVEX0hFQURFUlMsIF9iID0gUkFXX0hFQURFUl9OQU1FUywgX2MgPSBTeW1ib2wudG9TdHJpbmdUYWcsIFN5bWJvbC5pdGVyYXRvcildKCkge1xuICAgIHJldHVybiB0aGlzLmVudHJpZXMoKTtcbiAgfVxuICAqa2V5cygpIHtcbiAgICBmb3IgKGNvbnN0IFtuYW1lXSBvZiB0aGlzLmVudHJpZXMoKSkge1xuICAgICAgeWllbGQgbmFtZTtcbiAgICB9XG4gIH1cbiAgKnZhbHVlcygpIHtcbiAgICBmb3IgKGNvbnN0IFssIHZhbHVlXSBvZiB0aGlzLmVudHJpZXMoKSkge1xuICAgICAgeWllbGQgdmFsdWU7XG4gICAgfVxuICB9XG4gICplbnRyaWVzKCkge1xuICAgIGxldCBzb3J0ZWRLZXlzID0gT2JqZWN0LmtleXModGhpc1tOT1JNQUxJWkVEX0hFQURFUlNdKS5zb3J0KFxuICAgICAgKGEsIGIpID0+IGEubG9jYWxlQ29tcGFyZShiKVxuICAgICk7XG4gICAgZm9yIChjb25zdCBuYW1lIG9mIHNvcnRlZEtleXMpIHtcbiAgICAgIGlmIChuYW1lID09PSBcInNldC1jb29raWVcIikge1xuICAgICAgICBmb3IgKGNvbnN0IHZhbHVlIG9mIHRoaXMuZ2V0U2V0Q29va2llKCkpIHtcbiAgICAgICAgICB5aWVsZCBbbmFtZSwgdmFsdWVdO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB5aWVsZCBbbmFtZSwgdGhpcy5nZXQobmFtZSldO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICAvKipcbiAgICogUmV0dXJucyBhIGJvb2xlYW4gc3RhdGluZyB3aGV0aGVyIGEgYEhlYWRlcnNgIG9iamVjdCBjb250YWlucyBhIGNlcnRhaW4gaGVhZGVyLlxuICAgKi9cbiAgaGFzKG5hbWUpIHtcbiAgICBpZiAoIWlzVmFsaWRIZWFkZXJOYW1lKG5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBJbnZhbGlkIGhlYWRlciBuYW1lIFwiJHtuYW1lfVwiYCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzW05PUk1BTElaRURfSEVBREVSU10uaGFzT3duUHJvcGVydHkobm9ybWFsaXplSGVhZGVyTmFtZShuYW1lKSk7XG4gIH1cbiAgLyoqXG4gICAqIFJldHVybnMgYSBgQnl0ZVN0cmluZ2Agc2VxdWVuY2Ugb2YgYWxsIHRoZSB2YWx1ZXMgb2YgYSBoZWFkZXIgd2l0aCBhIGdpdmVuIG5hbWUuXG4gICAqL1xuICBnZXQobmFtZSkge1xuICAgIGlmICghaXNWYWxpZEhlYWRlck5hbWUobmFtZSkpIHtcbiAgICAgIHRocm93IFR5cGVFcnJvcihgSW52YWxpZCBoZWFkZXIgbmFtZSBcIiR7bmFtZX1cImApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpc1tOT1JNQUxJWkVEX0hFQURFUlNdW25vcm1hbGl6ZUhlYWRlck5hbWUobmFtZSldID8/IG51bGw7XG4gIH1cbiAgLyoqXG4gICAqIFNldHMgYSBuZXcgdmFsdWUgZm9yIGFuIGV4aXN0aW5nIGhlYWRlciBpbnNpZGUgYSBgSGVhZGVyc2Agb2JqZWN0LCBvciBhZGRzIHRoZSBoZWFkZXIgaWYgaXQgZG9lcyBub3QgYWxyZWFkeSBleGlzdC5cbiAgICovXG4gIHNldChuYW1lLCB2YWx1ZSkge1xuICAgIGlmICghaXNWYWxpZEhlYWRlck5hbWUobmFtZSkgfHwgIWlzVmFsaWRIZWFkZXJWYWx1ZSh2YWx1ZSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3Qgbm9ybWFsaXplZE5hbWUgPSBub3JtYWxpemVIZWFkZXJOYW1lKG5hbWUpO1xuICAgIGNvbnN0IG5vcm1hbGl6ZWRWYWx1ZSA9IG5vcm1hbGl6ZUhlYWRlclZhbHVlKHZhbHVlKTtcbiAgICB0aGlzW05PUk1BTElaRURfSEVBREVSU11bbm9ybWFsaXplZE5hbWVdID0gbm9ybWFsaXplSGVhZGVyVmFsdWUobm9ybWFsaXplZFZhbHVlKTtcbiAgICB0aGlzW1JBV19IRUFERVJfTkFNRVNdLnNldChub3JtYWxpemVkTmFtZSwgbmFtZSk7XG4gIH1cbiAgLyoqXG4gICAqIEFwcGVuZHMgYSBuZXcgdmFsdWUgb250byBhbiBleGlzdGluZyBoZWFkZXIgaW5zaWRlIGEgYEhlYWRlcnNgIG9iamVjdCwgb3IgYWRkcyB0aGUgaGVhZGVyIGlmIGl0IGRvZXMgbm90IGFscmVhZHkgZXhpc3QuXG4gICAqL1xuICBhcHBlbmQobmFtZSwgdmFsdWUpIHtcbiAgICBpZiAoIWlzVmFsaWRIZWFkZXJOYW1lKG5hbWUpIHx8ICFpc1ZhbGlkSGVhZGVyVmFsdWUodmFsdWUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IG5vcm1hbGl6ZWROYW1lID0gbm9ybWFsaXplSGVhZGVyTmFtZShuYW1lKTtcbiAgICBjb25zdCBub3JtYWxpemVkVmFsdWUgPSBub3JtYWxpemVIZWFkZXJWYWx1ZSh2YWx1ZSk7XG4gICAgbGV0IHJlc29sdmVkVmFsdWUgPSB0aGlzLmhhcyhub3JtYWxpemVkTmFtZSkgPyBgJHt0aGlzLmdldChub3JtYWxpemVkTmFtZSl9LCAke25vcm1hbGl6ZWRWYWx1ZX1gIDogbm9ybWFsaXplZFZhbHVlO1xuICAgIHRoaXMuc2V0KG5hbWUsIHJlc29sdmVkVmFsdWUpO1xuICB9XG4gIC8qKlxuICAgKiBEZWxldGVzIGEgaGVhZGVyIGZyb20gdGhlIGBIZWFkZXJzYCBvYmplY3QuXG4gICAqL1xuICBkZWxldGUobmFtZSkge1xuICAgIGlmICghaXNWYWxpZEhlYWRlck5hbWUobmFtZSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKCF0aGlzLmhhcyhuYW1lKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBub3JtYWxpemVkTmFtZSA9IG5vcm1hbGl6ZUhlYWRlck5hbWUobmFtZSk7XG4gICAgZGVsZXRlIHRoaXNbTk9STUFMSVpFRF9IRUFERVJTXVtub3JtYWxpemVkTmFtZV07XG4gICAgdGhpc1tSQVdfSEVBREVSX05BTUVTXS5kZWxldGUobm9ybWFsaXplZE5hbWUpO1xuICB9XG4gIC8qKlxuICAgKiBUcmF2ZXJzZXMgdGhlIGBIZWFkZXJzYCBvYmplY3QsXG4gICAqIGNhbGxpbmcgdGhlIGdpdmVuIGNhbGxiYWNrIGZvciBlYWNoIGhlYWRlci5cbiAgICovXG4gIGZvckVhY2goY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICBmb3IgKGNvbnN0IFtuYW1lLCB2YWx1ZV0gb2YgdGhpcy5lbnRyaWVzKCkpIHtcbiAgICAgIGNhbGxiYWNrLmNhbGwodGhpc0FyZywgdmFsdWUsIG5hbWUsIHRoaXMpO1xuICAgIH1cbiAgfVxuICAvKipcbiAgICogUmV0dXJucyBhbiBhcnJheSBjb250YWluaW5nIHRoZSB2YWx1ZXNcbiAgICogb2YgYWxsIFNldC1Db29raWUgaGVhZGVycyBhc3NvY2lhdGVkXG4gICAqIHdpdGggYSByZXNwb25zZVxuICAgKi9cbiAgZ2V0U2V0Q29va2llKCkge1xuICAgIGNvbnN0IHNldENvb2tpZUhlYWRlciA9IHRoaXMuZ2V0KFwic2V0LWNvb2tpZVwiKTtcbiAgICBpZiAoc2V0Q29va2llSGVhZGVyID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICAgIGlmIChzZXRDb29raWVIZWFkZXIgPT09IFwiXCIpIHtcbiAgICAgIHJldHVybiBbXCJcIl07XG4gICAgfVxuICAgIHJldHVybiAoMCwgaW1wb3J0X3NldF9jb29raWVfcGFyc2VyLnNwbGl0Q29va2llc1N0cmluZykoc2V0Q29va2llSGVhZGVyKTtcbiAgfVxufTtcblxuLy8gc3JjL2dldFJhd0hlYWRlcnMudHNcbmZ1bmN0aW9uIGdldFJhd0hlYWRlcnMoaGVhZGVycykge1xuICBjb25zdCByYXdIZWFkZXJzID0ge307XG4gIGZvciAoY29uc3QgW25hbWUsIHZhbHVlXSBvZiBoZWFkZXJzLmVudHJpZXMoKSkge1xuICAgIHJhd0hlYWRlcnNbaGVhZGVyc1tSQVdfSEVBREVSX05BTUVTXS5nZXQobmFtZSldID0gdmFsdWU7XG4gIH1cbiAgcmV0dXJuIHJhd0hlYWRlcnM7XG59XG5cbi8vIHNyYy90cmFuc2Zvcm1lcnMvaGVhZGVyc1RvTGlzdC50c1xuZnVuY3Rpb24gaGVhZGVyc1RvTGlzdChoZWFkZXJzKSB7XG4gIGNvbnN0IGhlYWRlcnNMaXN0ID0gW107XG4gIGhlYWRlcnMuZm9yRWFjaCgodmFsdWUsIG5hbWUpID0+IHtcbiAgICBjb25zdCByZXNvbHZlZFZhbHVlID0gdmFsdWUuaW5jbHVkZXMoXCIsXCIpID8gdmFsdWUuc3BsaXQoXCIsXCIpLm1hcCgodmFsdWUyKSA9PiB2YWx1ZTIudHJpbSgpKSA6IHZhbHVlO1xuICAgIGhlYWRlcnNMaXN0LnB1c2goW25hbWUsIHJlc29sdmVkVmFsdWVdKTtcbiAgfSk7XG4gIHJldHVybiBoZWFkZXJzTGlzdDtcbn1cblxuLy8gc3JjL3RyYW5zZm9ybWVycy9oZWFkZXJzVG9TdHJpbmcudHNcbmZ1bmN0aW9uIGhlYWRlcnNUb1N0cmluZyhoZWFkZXJzKSB7XG4gIGNvbnN0IGxpc3QgPSBoZWFkZXJzVG9MaXN0KGhlYWRlcnMpO1xuICBjb25zdCBsaW5lcyA9IGxpc3QubWFwKChbbmFtZSwgdmFsdWVdKSA9PiB7XG4gICAgY29uc3QgdmFsdWVzID0gW10uY29uY2F0KHZhbHVlKTtcbiAgICByZXR1cm4gYCR7bmFtZX06ICR7dmFsdWVzLmpvaW4oXCIsIFwiKX1gO1xuICB9KTtcbiAgcmV0dXJuIGxpbmVzLmpvaW4oXCJcXHJcXG5cIik7XG59XG5cbi8vIHNyYy90cmFuc2Zvcm1lcnMvaGVhZGVyc1RvT2JqZWN0LnRzXG52YXIgc2luZ2xlVmFsdWVIZWFkZXJzID0gW1widXNlci1hZ2VudFwiXTtcbmZ1bmN0aW9uIGhlYWRlcnNUb09iamVjdChoZWFkZXJzKSB7XG4gIGNvbnN0IGhlYWRlcnNPYmplY3QgPSB7fTtcbiAgaGVhZGVycy5mb3JFYWNoKCh2YWx1ZSwgbmFtZSkgPT4ge1xuICAgIGNvbnN0IGlzTXVsdGlWYWx1ZSA9ICFzaW5nbGVWYWx1ZUhlYWRlcnMuaW5jbHVkZXMobmFtZS50b0xvd2VyQ2FzZSgpKSAmJiB2YWx1ZS5pbmNsdWRlcyhcIixcIik7XG4gICAgaGVhZGVyc09iamVjdFtuYW1lXSA9IGlzTXVsdGlWYWx1ZSA/IHZhbHVlLnNwbGl0KFwiLFwiKS5tYXAoKHMpID0+IHMudHJpbSgpKSA6IHZhbHVlO1xuICB9KTtcbiAgcmV0dXJuIGhlYWRlcnNPYmplY3Q7XG59XG5cbi8vIHNyYy90cmFuc2Zvcm1lcnMvc3RyaW5nVG9IZWFkZXJzLnRzXG5mdW5jdGlvbiBzdHJpbmdUb0hlYWRlcnMoc3RyKSB7XG4gIGNvbnN0IGxpbmVzID0gc3RyLnRyaW0oKS5zcGxpdCgvW1xcclxcbl0rLyk7XG4gIHJldHVybiBsaW5lcy5yZWR1Y2UoKGhlYWRlcnMsIGxpbmUpID0+IHtcbiAgICBpZiAobGluZS50cmltKCkgPT09IFwiXCIpIHtcbiAgICAgIHJldHVybiBoZWFkZXJzO1xuICAgIH1cbiAgICBjb25zdCBwYXJ0cyA9IGxpbmUuc3BsaXQoXCI6IFwiKTtcbiAgICBjb25zdCBuYW1lID0gcGFydHMuc2hpZnQoKTtcbiAgICBjb25zdCB2YWx1ZSA9IHBhcnRzLmpvaW4oXCI6IFwiKTtcbiAgICBoZWFkZXJzLmFwcGVuZChuYW1lLCB2YWx1ZSk7XG4gICAgcmV0dXJuIGhlYWRlcnM7XG4gIH0sIG5ldyBIZWFkZXJzKCkpO1xufVxuXG4vLyBzcmMvdHJhbnNmb3JtZXJzL2xpc3RUb0hlYWRlcnMudHNcbmZ1bmN0aW9uIGxpc3RUb0hlYWRlcnMobGlzdCkge1xuICBjb25zdCBoZWFkZXJzID0gbmV3IEhlYWRlcnMoKTtcbiAgbGlzdC5mb3JFYWNoKChbbmFtZSwgdmFsdWVdKSA9PiB7XG4gICAgY29uc3QgdmFsdWVzID0gW10uY29uY2F0KHZhbHVlKTtcbiAgICB2YWx1ZXMuZm9yRWFjaCgodmFsdWUyKSA9PiB7XG4gICAgICBoZWFkZXJzLmFwcGVuZChuYW1lLCB2YWx1ZTIpO1xuICAgIH0pO1xuICB9KTtcbiAgcmV0dXJuIGhlYWRlcnM7XG59XG5cbi8vIHNyYy90cmFuc2Zvcm1lcnMvcmVkdWNlSGVhZGVyc09iamVjdC50c1xuZnVuY3Rpb24gcmVkdWNlSGVhZGVyc09iamVjdChoZWFkZXJzLCByZWR1Y2VyLCBpbml0aWFsU3RhdGUpIHtcbiAgcmV0dXJuIE9iamVjdC5rZXlzKGhlYWRlcnMpLnJlZHVjZSgobmV4dEhlYWRlcnMsIG5hbWUpID0+IHtcbiAgICByZXR1cm4gcmVkdWNlcihuZXh0SGVhZGVycywgbmFtZSwgaGVhZGVyc1tuYW1lXSk7XG4gIH0sIGluaXRpYWxTdGF0ZSk7XG59XG5cbi8vIHNyYy90cmFuc2Zvcm1lcnMvb2JqZWN0VG9IZWFkZXJzLnRzXG5mdW5jdGlvbiBvYmplY3RUb0hlYWRlcnMoaGVhZGVyc09iamVjdCkge1xuICByZXR1cm4gcmVkdWNlSGVhZGVyc09iamVjdChcbiAgICBoZWFkZXJzT2JqZWN0LFxuICAgIChoZWFkZXJzLCBuYW1lLCB2YWx1ZSkgPT4ge1xuICAgICAgY29uc3QgdmFsdWVzID0gW10uY29uY2F0KHZhbHVlKS5maWx0ZXIoQm9vbGVhbik7XG4gICAgICB2YWx1ZXMuZm9yRWFjaCgodmFsdWUyKSA9PiB7XG4gICAgICAgIGhlYWRlcnMuYXBwZW5kKG5hbWUsIHZhbHVlMik7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBoZWFkZXJzO1xuICAgIH0sXG4gICAgbmV3IEhlYWRlcnMoKVxuICApO1xufVxuXG4vLyBzcmMvdHJhbnNmb3JtZXJzL2ZsYXR0ZW5IZWFkZXJzTGlzdC50c1xuZnVuY3Rpb24gZmxhdHRlbkhlYWRlcnNMaXN0KGxpc3QpIHtcbiAgcmV0dXJuIGxpc3QubWFwKChbbmFtZSwgdmFsdWVzXSkgPT4ge1xuICAgIHJldHVybiBbbmFtZSwgW10uY29uY2F0KHZhbHVlcykuam9pbihcIiwgXCIpXTtcbiAgfSk7XG59XG5cbi8vIHNyYy90cmFuc2Zvcm1lcnMvZmxhdHRlbkhlYWRlcnNPYmplY3QudHNcbmZ1bmN0aW9uIGZsYXR0ZW5IZWFkZXJzT2JqZWN0KGhlYWRlcnNPYmplY3QpIHtcbiAgcmV0dXJuIHJlZHVjZUhlYWRlcnNPYmplY3QoXG4gICAgaGVhZGVyc09iamVjdCxcbiAgICAoaGVhZGVycywgbmFtZSwgdmFsdWUpID0+IHtcbiAgICAgIGhlYWRlcnNbbmFtZV0gPSBbXS5jb25jYXQodmFsdWUpLmpvaW4oXCIsIFwiKTtcbiAgICAgIHJldHVybiBoZWFkZXJzO1xuICAgIH0sXG4gICAge31cbiAgKTtcbn1cbmV4cG9ydCB7XG4gIEhlYWRlcnMsXG4gIGZsYXR0ZW5IZWFkZXJzTGlzdCxcbiAgZmxhdHRlbkhlYWRlcnNPYmplY3QsXG4gIGdldFJhd0hlYWRlcnMsXG4gIGhlYWRlcnNUb0xpc3QsXG4gIGhlYWRlcnNUb09iamVjdCxcbiAgaGVhZGVyc1RvU3RyaW5nLFxuICBsaXN0VG9IZWFkZXJzLFxuICBvYmplY3RUb0hlYWRlcnMsXG4gIHJlZHVjZUhlYWRlcnNPYmplY3QsXG4gIHN0cmluZ1RvSGVhZGVyc1xufTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWluZGV4Lm1qcy5tYXAiLCJpbXBvcnQgeyBlbnZfZ2V0IH0gZnJvbSAnc3BhY2V0aW1lOnN5c0AyLjInO1xuaW1wb3J0ICogYXMgX3N5c2NhbGxzMl8wIGZyb20gJ3NwYWNldGltZTpzeXNAMi4wJztcbmltcG9ydCB7IG1vZHVsZUhvb2tzIH0gZnJvbSAnc3BhY2V0aW1lOnN5c0AyLjAnO1xuaW1wb3J0IHsgSGVhZGVycyB9IGZyb20gJ2hlYWRlcnMtcG9seWZpbGwnO1xuZXhwb3J0IHsgSGVhZGVycyB9IGZyb20gJ2hlYWRlcnMtcG9seWZpbGwnO1xuaW1wb3J0ICogYXMgX3N5c2NhbGxzMl8xIGZyb20gJ3NwYWNldGltZTpzeXNAMi4xJztcblxudHlwZW9mIGdsb2JhbFRoaXMhPT1cInVuZGVmaW5lZFwiJiYoKGdsb2JhbFRoaXMuZ2xvYmFsPWdsb2JhbFRoaXMuZ2xvYmFsfHxnbG9iYWxUaGlzKSwoZ2xvYmFsVGhpcy53aW5kb3c9Z2xvYmFsVGhpcy53aW5kb3d8fGdsb2JhbFRoaXMpKTtcbnZhciBfX2NyZWF0ZSA9IE9iamVjdC5jcmVhdGU7XG52YXIgX19kZWZQcm9wID0gT2JqZWN0LmRlZmluZVByb3BlcnR5O1xudmFyIF9fZ2V0T3duUHJvcERlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yO1xudmFyIF9fZ2V0T3duUHJvcE5hbWVzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXM7XG52YXIgX19nZXRQcm90b09mID0gT2JqZWN0LmdldFByb3RvdHlwZU9mO1xudmFyIF9faGFzT3duUHJvcCA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG52YXIgX19lc20gPSAoZm4sIHJlcykgPT4gZnVuY3Rpb24gX19pbml0KCkge1xuICByZXR1cm4gZm4gJiYgKHJlcyA9ICgwLCBmbltfX2dldE93blByb3BOYW1lcyhmbilbMF1dKShmbiA9IDApKSwgcmVzO1xufTtcbnZhciBfX2NvbW1vbkpTID0gKGNiLCBtb2QpID0+IGZ1bmN0aW9uIF9fcmVxdWlyZSgpIHtcbiAgcmV0dXJuIG1vZCB8fCAoMCwgY2JbX19nZXRPd25Qcm9wTmFtZXMoY2IpWzBdXSkoKG1vZCA9IHsgZXhwb3J0czoge30gfSkuZXhwb3J0cywgbW9kKSwgbW9kLmV4cG9ydHM7XG59O1xudmFyIF9fZXhwb3J0ID0gKHRhcmdldCwgYWxsKSA9PiB7XG4gIGZvciAodmFyIG5hbWUgaW4gYWxsKVxuICAgIF9fZGVmUHJvcCh0YXJnZXQsIG5hbWUsIHsgZ2V0OiBhbGxbbmFtZV0sIGVudW1lcmFibGU6IHRydWUgfSk7XG59O1xudmFyIF9fY29weVByb3BzID0gKHRvLCBmcm9tLCBleGNlcHQsIGRlc2MpID0+IHtcbiAgaWYgKGZyb20gJiYgdHlwZW9mIGZyb20gPT09IFwib2JqZWN0XCIgfHwgdHlwZW9mIGZyb20gPT09IFwiZnVuY3Rpb25cIikge1xuICAgIGZvciAobGV0IGtleSBvZiBfX2dldE93blByb3BOYW1lcyhmcm9tKSlcbiAgICAgIGlmICghX19oYXNPd25Qcm9wLmNhbGwodG8sIGtleSkgJiYga2V5ICE9PSBleGNlcHQpXG4gICAgICAgIF9fZGVmUHJvcCh0bywga2V5LCB7IGdldDogKCkgPT4gZnJvbVtrZXldLCBlbnVtZXJhYmxlOiAhKGRlc2MgPSBfX2dldE93blByb3BEZXNjKGZyb20sIGtleSkpIHx8IGRlc2MuZW51bWVyYWJsZSB9KTtcbiAgfVxuICByZXR1cm4gdG87XG59O1xudmFyIF9fdG9FU00gPSAobW9kLCBpc05vZGVNb2RlLCB0YXJnZXQpID0+ICh0YXJnZXQgPSBtb2QgIT0gbnVsbCA/IF9fY3JlYXRlKF9fZ2V0UHJvdG9PZihtb2QpKSA6IHt9LCBfX2NvcHlQcm9wcyhcbiAgLy8gSWYgdGhlIGltcG9ydGVyIGlzIGluIG5vZGUgY29tcGF0aWJpbGl0eSBtb2RlIG9yIHRoaXMgaXMgbm90IGFuIEVTTVxuICAvLyBmaWxlIHRoYXQgaGFzIGJlZW4gY29udmVydGVkIHRvIGEgQ29tbW9uSlMgZmlsZSB1c2luZyBhIEJhYmVsLVxuICAvLyBjb21wYXRpYmxlIHRyYW5zZm9ybSAoaS5lLiBcIl9fZXNNb2R1bGVcIiBoYXMgbm90IGJlZW4gc2V0KSwgdGhlbiBzZXRcbiAgLy8gXCJkZWZhdWx0XCIgdG8gdGhlIENvbW1vbkpTIFwibW9kdWxlLmV4cG9ydHNcIiBmb3Igbm9kZSBjb21wYXRpYmlsaXR5LlxuICBfX2RlZlByb3AodGFyZ2V0LCBcImRlZmF1bHRcIiwgeyB2YWx1ZTogbW9kLCBlbnVtZXJhYmxlOiB0cnVlIH0pICxcbiAgbW9kXG4pKTtcbnZhciBfX3RvQ29tbW9uSlMgPSAobW9kKSA9PiBfX2NvcHlQcm9wcyhfX2RlZlByb3Aoe30sIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pLCBtb2QpO1xuXG4vLyAuLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vYmFzZTY0LWpzQDEuNS4xL25vZGVfbW9kdWxlcy9iYXNlNjQtanMvaW5kZXguanNcbnZhciByZXF1aXJlX2Jhc2U2NF9qcyA9IF9fY29tbW9uSlMoe1xuICBcIi4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9iYXNlNjQtanNAMS41LjEvbm9kZV9tb2R1bGVzL2Jhc2U2NC1qcy9pbmRleC5qc1wiKGV4cG9ydHMpIHtcbiAgICBleHBvcnRzLmJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoO1xuICAgIGV4cG9ydHMudG9CeXRlQXJyYXkgPSB0b0J5dGVBcnJheTtcbiAgICBleHBvcnRzLmZyb21CeXRlQXJyYXkgPSBmcm9tQnl0ZUFycmF5MjtcbiAgICB2YXIgbG9va3VwID0gW107XG4gICAgdmFyIHJldkxvb2t1cCA9IFtdO1xuICAgIHZhciBBcnIgPSB0eXBlb2YgVWludDhBcnJheSAhPT0gXCJ1bmRlZmluZWRcIiA/IFVpbnQ4QXJyYXkgOiBBcnJheTtcbiAgICB2YXIgY29kZSA9IFwiQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrL1wiO1xuICAgIGZvciAoaSA9IDAsIGxlbiA9IGNvZGUubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgIGxvb2t1cFtpXSA9IGNvZGVbaV07XG4gICAgICByZXZMb29rdXBbY29kZS5jaGFyQ29kZUF0KGkpXSA9IGk7XG4gICAgfVxuICAgIHZhciBpO1xuICAgIHZhciBsZW47XG4gICAgcmV2TG9va3VwW1wiLVwiLmNoYXJDb2RlQXQoMCldID0gNjI7XG4gICAgcmV2TG9va3VwW1wiX1wiLmNoYXJDb2RlQXQoMCldID0gNjM7XG4gICAgZnVuY3Rpb24gZ2V0TGVucyhiNjQpIHtcbiAgICAgIHZhciBsZW4yID0gYjY0Lmxlbmd0aDtcbiAgICAgIGlmIChsZW4yICUgNCA+IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBzdHJpbmcuIExlbmd0aCBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgNFwiKTtcbiAgICAgIH1cbiAgICAgIHZhciB2YWxpZExlbiA9IGI2NC5pbmRleE9mKFwiPVwiKTtcbiAgICAgIGlmICh2YWxpZExlbiA9PT0gLTEpIHZhbGlkTGVuID0gbGVuMjtcbiAgICAgIHZhciBwbGFjZUhvbGRlcnNMZW4gPSB2YWxpZExlbiA9PT0gbGVuMiA/IDAgOiA0IC0gdmFsaWRMZW4gJSA0O1xuICAgICAgcmV0dXJuIFt2YWxpZExlbiwgcGxhY2VIb2xkZXJzTGVuXTtcbiAgICB9XG4gICAgZnVuY3Rpb24gYnl0ZUxlbmd0aChiNjQpIHtcbiAgICAgIHZhciBsZW5zID0gZ2V0TGVucyhiNjQpO1xuICAgICAgdmFyIHZhbGlkTGVuID0gbGVuc1swXTtcbiAgICAgIHZhciBwbGFjZUhvbGRlcnNMZW4gPSBsZW5zWzFdO1xuICAgICAgcmV0dXJuICh2YWxpZExlbiArIHBsYWNlSG9sZGVyc0xlbikgKiAzIC8gNCAtIHBsYWNlSG9sZGVyc0xlbjtcbiAgICB9XG4gICAgZnVuY3Rpb24gX2J5dGVMZW5ndGgoYjY0LCB2YWxpZExlbiwgcGxhY2VIb2xkZXJzTGVuKSB7XG4gICAgICByZXR1cm4gKHZhbGlkTGVuICsgcGxhY2VIb2xkZXJzTGVuKSAqIDMgLyA0IC0gcGxhY2VIb2xkZXJzTGVuO1xuICAgIH1cbiAgICBmdW5jdGlvbiB0b0J5dGVBcnJheShiNjQpIHtcbiAgICAgIHZhciB0bXA7XG4gICAgICB2YXIgbGVucyA9IGdldExlbnMoYjY0KTtcbiAgICAgIHZhciB2YWxpZExlbiA9IGxlbnNbMF07XG4gICAgICB2YXIgcGxhY2VIb2xkZXJzTGVuID0gbGVuc1sxXTtcbiAgICAgIHZhciBhcnIgPSBuZXcgQXJyKF9ieXRlTGVuZ3RoKGI2NCwgdmFsaWRMZW4sIHBsYWNlSG9sZGVyc0xlbikpO1xuICAgICAgdmFyIGN1ckJ5dGUgPSAwO1xuICAgICAgdmFyIGxlbjIgPSBwbGFjZUhvbGRlcnNMZW4gPiAwID8gdmFsaWRMZW4gLSA0IDogdmFsaWRMZW47XG4gICAgICB2YXIgaTI7XG4gICAgICBmb3IgKGkyID0gMDsgaTIgPCBsZW4yOyBpMiArPSA0KSB7XG4gICAgICAgIHRtcCA9IHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpMildIDw8IDE4IHwgcmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkyICsgMSldIDw8IDEyIHwgcmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkyICsgMildIDw8IDYgfCByZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaTIgKyAzKV07XG4gICAgICAgIGFycltjdXJCeXRlKytdID0gdG1wID4+IDE2ICYgMjU1O1xuICAgICAgICBhcnJbY3VyQnl0ZSsrXSA9IHRtcCA+PiA4ICYgMjU1O1xuICAgICAgICBhcnJbY3VyQnl0ZSsrXSA9IHRtcCAmIDI1NTtcbiAgICAgIH1cbiAgICAgIGlmIChwbGFjZUhvbGRlcnNMZW4gPT09IDIpIHtcbiAgICAgICAgdG1wID0gcmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkyKV0gPDwgMiB8IHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpMiArIDEpXSA+PiA0O1xuICAgICAgICBhcnJbY3VyQnl0ZSsrXSA9IHRtcCAmIDI1NTtcbiAgICAgIH1cbiAgICAgIGlmIChwbGFjZUhvbGRlcnNMZW4gPT09IDEpIHtcbiAgICAgICAgdG1wID0gcmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkyKV0gPDwgMTAgfCByZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaTIgKyAxKV0gPDwgNCB8IHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpMiArIDIpXSA+PiAyO1xuICAgICAgICBhcnJbY3VyQnl0ZSsrXSA9IHRtcCA+PiA4ICYgMjU1O1xuICAgICAgICBhcnJbY3VyQnl0ZSsrXSA9IHRtcCAmIDI1NTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhcnI7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHRyaXBsZXRUb0Jhc2U2NChudW0pIHtcbiAgICAgIHJldHVybiBsb29rdXBbbnVtID4+IDE4ICYgNjNdICsgbG9va3VwW251bSA+PiAxMiAmIDYzXSArIGxvb2t1cFtudW0gPj4gNiAmIDYzXSArIGxvb2t1cFtudW0gJiA2M107XG4gICAgfVxuICAgIGZ1bmN0aW9uIGVuY29kZUNodW5rKHVpbnQ4LCBzdGFydCwgZW5kKSB7XG4gICAgICB2YXIgdG1wO1xuICAgICAgdmFyIG91dHB1dCA9IFtdO1xuICAgICAgZm9yICh2YXIgaTIgPSBzdGFydDsgaTIgPCBlbmQ7IGkyICs9IDMpIHtcbiAgICAgICAgdG1wID0gKHVpbnQ4W2kyXSA8PCAxNiAmIDE2NzExNjgwKSArICh1aW50OFtpMiArIDFdIDw8IDggJiA2NTI4MCkgKyAodWludDhbaTIgKyAyXSAmIDI1NSk7XG4gICAgICAgIG91dHB1dC5wdXNoKHRyaXBsZXRUb0Jhc2U2NCh0bXApKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBvdXRwdXQuam9pbihcIlwiKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gZnJvbUJ5dGVBcnJheTIodWludDgpIHtcbiAgICAgIHZhciB0bXA7XG4gICAgICB2YXIgbGVuMiA9IHVpbnQ4Lmxlbmd0aDtcbiAgICAgIHZhciBleHRyYUJ5dGVzID0gbGVuMiAlIDM7XG4gICAgICB2YXIgcGFydHMgPSBbXTtcbiAgICAgIHZhciBtYXhDaHVua0xlbmd0aCA9IDE2MzgzO1xuICAgICAgZm9yICh2YXIgaTIgPSAwLCBsZW4yMiA9IGxlbjIgLSBleHRyYUJ5dGVzOyBpMiA8IGxlbjIyOyBpMiArPSBtYXhDaHVua0xlbmd0aCkge1xuICAgICAgICBwYXJ0cy5wdXNoKGVuY29kZUNodW5rKHVpbnQ4LCBpMiwgaTIgKyBtYXhDaHVua0xlbmd0aCA+IGxlbjIyID8gbGVuMjIgOiBpMiArIG1heENodW5rTGVuZ3RoKSk7XG4gICAgICB9XG4gICAgICBpZiAoZXh0cmFCeXRlcyA9PT0gMSkge1xuICAgICAgICB0bXAgPSB1aW50OFtsZW4yIC0gMV07XG4gICAgICAgIHBhcnRzLnB1c2goXG4gICAgICAgICAgbG9va3VwW3RtcCA+PiAyXSArIGxvb2t1cFt0bXAgPDwgNCAmIDYzXSArIFwiPT1cIlxuICAgICAgICApO1xuICAgICAgfSBlbHNlIGlmIChleHRyYUJ5dGVzID09PSAyKSB7XG4gICAgICAgIHRtcCA9ICh1aW50OFtsZW4yIC0gMl0gPDwgOCkgKyB1aW50OFtsZW4yIC0gMV07XG4gICAgICAgIHBhcnRzLnB1c2goXG4gICAgICAgICAgbG9va3VwW3RtcCA+PiAxMF0gKyBsb29rdXBbdG1wID4+IDQgJiA2M10gKyBsb29rdXBbdG1wIDw8IDIgJiA2M10gKyBcIj1cIlxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHBhcnRzLmpvaW4oXCJcIik7XG4gICAgfVxuICB9XG59KTtcblxuLy8gLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3N0YXR1c2VzQDIuMC4yL25vZGVfbW9kdWxlcy9zdGF0dXNlcy9jb2Rlcy5qc29uXG52YXIgcmVxdWlyZV9jb2RlcyA9IF9fY29tbW9uSlMoe1xuICBcIi4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9zdGF0dXNlc0AyLjAuMi9ub2RlX21vZHVsZXMvc3RhdHVzZXMvY29kZXMuanNvblwiKGV4cG9ydHMsIG1vZHVsZSkge1xuICAgIG1vZHVsZS5leHBvcnRzID0ge1xuICAgICAgXCIxMDBcIjogXCJDb250aW51ZVwiLFxuICAgICAgXCIxMDFcIjogXCJTd2l0Y2hpbmcgUHJvdG9jb2xzXCIsXG4gICAgICBcIjEwMlwiOiBcIlByb2Nlc3NpbmdcIixcbiAgICAgIFwiMTAzXCI6IFwiRWFybHkgSGludHNcIixcbiAgICAgIFwiMjAwXCI6IFwiT0tcIixcbiAgICAgIFwiMjAxXCI6IFwiQ3JlYXRlZFwiLFxuICAgICAgXCIyMDJcIjogXCJBY2NlcHRlZFwiLFxuICAgICAgXCIyMDNcIjogXCJOb24tQXV0aG9yaXRhdGl2ZSBJbmZvcm1hdGlvblwiLFxuICAgICAgXCIyMDRcIjogXCJObyBDb250ZW50XCIsXG4gICAgICBcIjIwNVwiOiBcIlJlc2V0IENvbnRlbnRcIixcbiAgICAgIFwiMjA2XCI6IFwiUGFydGlhbCBDb250ZW50XCIsXG4gICAgICBcIjIwN1wiOiBcIk11bHRpLVN0YXR1c1wiLFxuICAgICAgXCIyMDhcIjogXCJBbHJlYWR5IFJlcG9ydGVkXCIsXG4gICAgICBcIjIyNlwiOiBcIklNIFVzZWRcIixcbiAgICAgIFwiMzAwXCI6IFwiTXVsdGlwbGUgQ2hvaWNlc1wiLFxuICAgICAgXCIzMDFcIjogXCJNb3ZlZCBQZXJtYW5lbnRseVwiLFxuICAgICAgXCIzMDJcIjogXCJGb3VuZFwiLFxuICAgICAgXCIzMDNcIjogXCJTZWUgT3RoZXJcIixcbiAgICAgIFwiMzA0XCI6IFwiTm90IE1vZGlmaWVkXCIsXG4gICAgICBcIjMwNVwiOiBcIlVzZSBQcm94eVwiLFxuICAgICAgXCIzMDdcIjogXCJUZW1wb3JhcnkgUmVkaXJlY3RcIixcbiAgICAgIFwiMzA4XCI6IFwiUGVybWFuZW50IFJlZGlyZWN0XCIsXG4gICAgICBcIjQwMFwiOiBcIkJhZCBSZXF1ZXN0XCIsXG4gICAgICBcIjQwMVwiOiBcIlVuYXV0aG9yaXplZFwiLFxuICAgICAgXCI0MDJcIjogXCJQYXltZW50IFJlcXVpcmVkXCIsXG4gICAgICBcIjQwM1wiOiBcIkZvcmJpZGRlblwiLFxuICAgICAgXCI0MDRcIjogXCJOb3QgRm91bmRcIixcbiAgICAgIFwiNDA1XCI6IFwiTWV0aG9kIE5vdCBBbGxvd2VkXCIsXG4gICAgICBcIjQwNlwiOiBcIk5vdCBBY2NlcHRhYmxlXCIsXG4gICAgICBcIjQwN1wiOiBcIlByb3h5IEF1dGhlbnRpY2F0aW9uIFJlcXVpcmVkXCIsXG4gICAgICBcIjQwOFwiOiBcIlJlcXVlc3QgVGltZW91dFwiLFxuICAgICAgXCI0MDlcIjogXCJDb25mbGljdFwiLFxuICAgICAgXCI0MTBcIjogXCJHb25lXCIsXG4gICAgICBcIjQxMVwiOiBcIkxlbmd0aCBSZXF1aXJlZFwiLFxuICAgICAgXCI0MTJcIjogXCJQcmVjb25kaXRpb24gRmFpbGVkXCIsXG4gICAgICBcIjQxM1wiOiBcIlBheWxvYWQgVG9vIExhcmdlXCIsXG4gICAgICBcIjQxNFwiOiBcIlVSSSBUb28gTG9uZ1wiLFxuICAgICAgXCI0MTVcIjogXCJVbnN1cHBvcnRlZCBNZWRpYSBUeXBlXCIsXG4gICAgICBcIjQxNlwiOiBcIlJhbmdlIE5vdCBTYXRpc2ZpYWJsZVwiLFxuICAgICAgXCI0MTdcIjogXCJFeHBlY3RhdGlvbiBGYWlsZWRcIixcbiAgICAgIFwiNDE4XCI6IFwiSSdtIGEgVGVhcG90XCIsXG4gICAgICBcIjQyMVwiOiBcIk1pc2RpcmVjdGVkIFJlcXVlc3RcIixcbiAgICAgIFwiNDIyXCI6IFwiVW5wcm9jZXNzYWJsZSBFbnRpdHlcIixcbiAgICAgIFwiNDIzXCI6IFwiTG9ja2VkXCIsXG4gICAgICBcIjQyNFwiOiBcIkZhaWxlZCBEZXBlbmRlbmN5XCIsXG4gICAgICBcIjQyNVwiOiBcIlRvbyBFYXJseVwiLFxuICAgICAgXCI0MjZcIjogXCJVcGdyYWRlIFJlcXVpcmVkXCIsXG4gICAgICBcIjQyOFwiOiBcIlByZWNvbmRpdGlvbiBSZXF1aXJlZFwiLFxuICAgICAgXCI0MjlcIjogXCJUb28gTWFueSBSZXF1ZXN0c1wiLFxuICAgICAgXCI0MzFcIjogXCJSZXF1ZXN0IEhlYWRlciBGaWVsZHMgVG9vIExhcmdlXCIsXG4gICAgICBcIjQ1MVwiOiBcIlVuYXZhaWxhYmxlIEZvciBMZWdhbCBSZWFzb25zXCIsXG4gICAgICBcIjUwMFwiOiBcIkludGVybmFsIFNlcnZlciBFcnJvclwiLFxuICAgICAgXCI1MDFcIjogXCJOb3QgSW1wbGVtZW50ZWRcIixcbiAgICAgIFwiNTAyXCI6IFwiQmFkIEdhdGV3YXlcIixcbiAgICAgIFwiNTAzXCI6IFwiU2VydmljZSBVbmF2YWlsYWJsZVwiLFxuICAgICAgXCI1MDRcIjogXCJHYXRld2F5IFRpbWVvdXRcIixcbiAgICAgIFwiNTA1XCI6IFwiSFRUUCBWZXJzaW9uIE5vdCBTdXBwb3J0ZWRcIixcbiAgICAgIFwiNTA2XCI6IFwiVmFyaWFudCBBbHNvIE5lZ290aWF0ZXNcIixcbiAgICAgIFwiNTA3XCI6IFwiSW5zdWZmaWNpZW50IFN0b3JhZ2VcIixcbiAgICAgIFwiNTA4XCI6IFwiTG9vcCBEZXRlY3RlZFwiLFxuICAgICAgXCI1MDlcIjogXCJCYW5kd2lkdGggTGltaXQgRXhjZWVkZWRcIixcbiAgICAgIFwiNTEwXCI6IFwiTm90IEV4dGVuZGVkXCIsXG4gICAgICBcIjUxMVwiOiBcIk5ldHdvcmsgQXV0aGVudGljYXRpb24gUmVxdWlyZWRcIlxuICAgIH07XG4gIH1cbn0pO1xuXG4vLyAuLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vc3RhdHVzZXNAMi4wLjIvbm9kZV9tb2R1bGVzL3N0YXR1c2VzL2luZGV4LmpzXG52YXIgcmVxdWlyZV9zdGF0dXNlcyA9IF9fY29tbW9uSlMoe1xuICBcIi4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9zdGF0dXNlc0AyLjAuMi9ub2RlX21vZHVsZXMvc3RhdHVzZXMvaW5kZXguanNcIihleHBvcnRzLCBtb2R1bGUpIHtcbiAgICB2YXIgY29kZXMgPSByZXF1aXJlX2NvZGVzKCk7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBzdGF0dXMyO1xuICAgIHN0YXR1czIubWVzc2FnZSA9IGNvZGVzO1xuICAgIHN0YXR1czIuY29kZSA9IGNyZWF0ZU1lc3NhZ2VUb1N0YXR1c0NvZGVNYXAoY29kZXMpO1xuICAgIHN0YXR1czIuY29kZXMgPSBjcmVhdGVTdGF0dXNDb2RlTGlzdChjb2Rlcyk7XG4gICAgc3RhdHVzMi5yZWRpcmVjdCA9IHtcbiAgICAgIDMwMDogdHJ1ZSxcbiAgICAgIDMwMTogdHJ1ZSxcbiAgICAgIDMwMjogdHJ1ZSxcbiAgICAgIDMwMzogdHJ1ZSxcbiAgICAgIDMwNTogdHJ1ZSxcbiAgICAgIDMwNzogdHJ1ZSxcbiAgICAgIDMwODogdHJ1ZVxuICAgIH07XG4gICAgc3RhdHVzMi5lbXB0eSA9IHtcbiAgICAgIDIwNDogdHJ1ZSxcbiAgICAgIDIwNTogdHJ1ZSxcbiAgICAgIDMwNDogdHJ1ZVxuICAgIH07XG4gICAgc3RhdHVzMi5yZXRyeSA9IHtcbiAgICAgIDUwMjogdHJ1ZSxcbiAgICAgIDUwMzogdHJ1ZSxcbiAgICAgIDUwNDogdHJ1ZVxuICAgIH07XG4gICAgZnVuY3Rpb24gY3JlYXRlTWVzc2FnZVRvU3RhdHVzQ29kZU1hcChjb2RlczIpIHtcbiAgICAgIHZhciBtYXAgPSB7fTtcbiAgICAgIE9iamVjdC5rZXlzKGNvZGVzMikuZm9yRWFjaChmdW5jdGlvbiBmb3JFYWNoQ29kZShjb2RlKSB7XG4gICAgICAgIHZhciBtZXNzYWdlID0gY29kZXMyW2NvZGVdO1xuICAgICAgICB2YXIgc3RhdHVzMyA9IE51bWJlcihjb2RlKTtcbiAgICAgICAgbWFwW21lc3NhZ2UudG9Mb3dlckNhc2UoKV0gPSBzdGF0dXMzO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gbWFwO1xuICAgIH1cbiAgICBmdW5jdGlvbiBjcmVhdGVTdGF0dXNDb2RlTGlzdChjb2RlczIpIHtcbiAgICAgIHJldHVybiBPYmplY3Qua2V5cyhjb2RlczIpLm1hcChmdW5jdGlvbiBtYXBDb2RlKGNvZGUpIHtcbiAgICAgICAgcmV0dXJuIE51bWJlcihjb2RlKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBmdW5jdGlvbiBnZXRTdGF0dXNDb2RlKG1lc3NhZ2UpIHtcbiAgICAgIHZhciBtc2cgPSBtZXNzYWdlLnRvTG93ZXJDYXNlKCk7XG4gICAgICBpZiAoIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzdGF0dXMyLmNvZGUsIG1zZykpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdpbnZhbGlkIHN0YXR1cyBtZXNzYWdlOiBcIicgKyBtZXNzYWdlICsgJ1wiJyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gc3RhdHVzMi5jb2RlW21zZ107XG4gICAgfVxuICAgIGZ1bmN0aW9uIGdldFN0YXR1c01lc3NhZ2UoY29kZSkge1xuICAgICAgaWYgKCFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoc3RhdHVzMi5tZXNzYWdlLCBjb2RlKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbnZhbGlkIHN0YXR1cyBjb2RlOiBcIiArIGNvZGUpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHN0YXR1czIubWVzc2FnZVtjb2RlXTtcbiAgICB9XG4gICAgZnVuY3Rpb24gc3RhdHVzMihjb2RlKSB7XG4gICAgICBpZiAodHlwZW9mIGNvZGUgPT09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgcmV0dXJuIGdldFN0YXR1c01lc3NhZ2UoY29kZSk7XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIGNvZGUgIT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImNvZGUgbXVzdCBiZSBhIG51bWJlciBvciBzdHJpbmdcIik7XG4gICAgICB9XG4gICAgICB2YXIgbiA9IHBhcnNlSW50KGNvZGUsIDEwKTtcbiAgICAgIGlmICghaXNOYU4obikpIHtcbiAgICAgICAgcmV0dXJuIGdldFN0YXR1c01lc3NhZ2Uobik7XG4gICAgICB9XG4gICAgICByZXR1cm4gZ2V0U3RhdHVzQ29kZShjb2RlKTtcbiAgICB9XG4gIH1cbn0pO1xuXG4vLyBzcmMvdXRpbC1zdHViLnRzXG52YXIgdXRpbF9zdHViX2V4cG9ydHMgPSB7fTtcbl9fZXhwb3J0KHV0aWxfc3R1Yl9leHBvcnRzLCB7XG4gIGluc3BlY3Q6ICgpID0+IGluc3BlY3Rcbn0pO1xudmFyIGluc3BlY3Q7XG52YXIgaW5pdF91dGlsX3N0dWIgPSBfX2VzbSh7XG4gIFwic3JjL3V0aWwtc3R1Yi50c1wiKCkge1xuICAgIGluc3BlY3QgPSB7fTtcbiAgfVxufSk7XG5cbi8vIC4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9vYmplY3QtaW5zcGVjdEAxLjEzLjQvbm9kZV9tb2R1bGVzL29iamVjdC1pbnNwZWN0L3V0aWwuaW5zcGVjdC5qc1xudmFyIHJlcXVpcmVfdXRpbF9pbnNwZWN0ID0gX19jb21tb25KUyh7XG4gIFwiLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL29iamVjdC1pbnNwZWN0QDEuMTMuNC9ub2RlX21vZHVsZXMvb2JqZWN0LWluc3BlY3QvdXRpbC5pbnNwZWN0LmpzXCIoZXhwb3J0cywgbW9kdWxlKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSAoaW5pdF91dGlsX3N0dWIoKSwgX190b0NvbW1vbkpTKHV0aWxfc3R1Yl9leHBvcnRzKSkuaW5zcGVjdDtcbiAgfVxufSk7XG5cbi8vIC4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9vYmplY3QtaW5zcGVjdEAxLjEzLjQvbm9kZV9tb2R1bGVzL29iamVjdC1pbnNwZWN0L2luZGV4LmpzXG52YXIgcmVxdWlyZV9vYmplY3RfaW5zcGVjdCA9IF9fY29tbW9uSlMoe1xuICBcIi4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9vYmplY3QtaW5zcGVjdEAxLjEzLjQvbm9kZV9tb2R1bGVzL29iamVjdC1pbnNwZWN0L2luZGV4LmpzXCIoZXhwb3J0cywgbW9kdWxlKSB7XG4gICAgdmFyIGhhc01hcCA9IHR5cGVvZiBNYXAgPT09IFwiZnVuY3Rpb25cIiAmJiBNYXAucHJvdG90eXBlO1xuICAgIHZhciBtYXBTaXplRGVzY3JpcHRvciA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IgJiYgaGFzTWFwID8gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihNYXAucHJvdG90eXBlLCBcInNpemVcIikgOiBudWxsO1xuICAgIHZhciBtYXBTaXplID0gaGFzTWFwICYmIG1hcFNpemVEZXNjcmlwdG9yICYmIHR5cGVvZiBtYXBTaXplRGVzY3JpcHRvci5nZXQgPT09IFwiZnVuY3Rpb25cIiA/IG1hcFNpemVEZXNjcmlwdG9yLmdldCA6IG51bGw7XG4gICAgdmFyIG1hcEZvckVhY2ggPSBoYXNNYXAgJiYgTWFwLnByb3RvdHlwZS5mb3JFYWNoO1xuICAgIHZhciBoYXNTZXQgPSB0eXBlb2YgU2V0ID09PSBcImZ1bmN0aW9uXCIgJiYgU2V0LnByb3RvdHlwZTtcbiAgICB2YXIgc2V0U2l6ZURlc2NyaXB0b3IgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yICYmIGhhc1NldCA/IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoU2V0LnByb3RvdHlwZSwgXCJzaXplXCIpIDogbnVsbDtcbiAgICB2YXIgc2V0U2l6ZSA9IGhhc1NldCAmJiBzZXRTaXplRGVzY3JpcHRvciAmJiB0eXBlb2Ygc2V0U2l6ZURlc2NyaXB0b3IuZ2V0ID09PSBcImZ1bmN0aW9uXCIgPyBzZXRTaXplRGVzY3JpcHRvci5nZXQgOiBudWxsO1xuICAgIHZhciBzZXRGb3JFYWNoID0gaGFzU2V0ICYmIFNldC5wcm90b3R5cGUuZm9yRWFjaDtcbiAgICB2YXIgaGFzV2Vha01hcCA9IHR5cGVvZiBXZWFrTWFwID09PSBcImZ1bmN0aW9uXCIgJiYgV2Vha01hcC5wcm90b3R5cGU7XG4gICAgdmFyIHdlYWtNYXBIYXMgPSBoYXNXZWFrTWFwID8gV2Vha01hcC5wcm90b3R5cGUuaGFzIDogbnVsbDtcbiAgICB2YXIgaGFzV2Vha1NldCA9IHR5cGVvZiBXZWFrU2V0ID09PSBcImZ1bmN0aW9uXCIgJiYgV2Vha1NldC5wcm90b3R5cGU7XG4gICAgdmFyIHdlYWtTZXRIYXMgPSBoYXNXZWFrU2V0ID8gV2Vha1NldC5wcm90b3R5cGUuaGFzIDogbnVsbDtcbiAgICB2YXIgaGFzV2Vha1JlZiA9IHR5cGVvZiBXZWFrUmVmID09PSBcImZ1bmN0aW9uXCIgJiYgV2Vha1JlZi5wcm90b3R5cGU7XG4gICAgdmFyIHdlYWtSZWZEZXJlZiA9IGhhc1dlYWtSZWYgPyBXZWFrUmVmLnByb3RvdHlwZS5kZXJlZiA6IG51bGw7XG4gICAgdmFyIGJvb2xlYW5WYWx1ZU9mID0gQm9vbGVhbi5wcm90b3R5cGUudmFsdWVPZjtcbiAgICB2YXIgb2JqZWN0VG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuICAgIHZhciBmdW5jdGlvblRvU3RyaW5nID0gRnVuY3Rpb24ucHJvdG90eXBlLnRvU3RyaW5nO1xuICAgIHZhciAkbWF0Y2ggPSBTdHJpbmcucHJvdG90eXBlLm1hdGNoO1xuICAgIHZhciAkc2xpY2UgPSBTdHJpbmcucHJvdG90eXBlLnNsaWNlO1xuICAgIHZhciAkcmVwbGFjZSA9IFN0cmluZy5wcm90b3R5cGUucmVwbGFjZTtcbiAgICB2YXIgJHRvVXBwZXJDYXNlID0gU3RyaW5nLnByb3RvdHlwZS50b1VwcGVyQ2FzZTtcbiAgICB2YXIgJHRvTG93ZXJDYXNlID0gU3RyaW5nLnByb3RvdHlwZS50b0xvd2VyQ2FzZTtcbiAgICB2YXIgJHRlc3QgPSBSZWdFeHAucHJvdG90eXBlLnRlc3Q7XG4gICAgdmFyICRjb25jYXQgPSBBcnJheS5wcm90b3R5cGUuY29uY2F0O1xuICAgIHZhciAkam9pbiA9IEFycmF5LnByb3RvdHlwZS5qb2luO1xuICAgIHZhciAkYXJyU2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2U7XG4gICAgdmFyICRmbG9vciA9IE1hdGguZmxvb3I7XG4gICAgdmFyIGJpZ0ludFZhbHVlT2YgPSB0eXBlb2YgQmlnSW50ID09PSBcImZ1bmN0aW9uXCIgPyBCaWdJbnQucHJvdG90eXBlLnZhbHVlT2YgOiBudWxsO1xuICAgIHZhciBnT1BTID0gT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scztcbiAgICB2YXIgc3ltVG9TdHJpbmcgPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIFN5bWJvbC5pdGVyYXRvciA9PT0gXCJzeW1ib2xcIiA/IFN5bWJvbC5wcm90b3R5cGUudG9TdHJpbmcgOiBudWxsO1xuICAgIHZhciBoYXNTaGFtbWVkU3ltYm9scyA9IHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgU3ltYm9sLml0ZXJhdG9yID09PSBcIm9iamVjdFwiO1xuICAgIHZhciB0b1N0cmluZ1RhZyA9IHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiBTeW1ib2wudG9TdHJpbmdUYWcgJiYgKHR5cGVvZiBTeW1ib2wudG9TdHJpbmdUYWcgPT09IGhhc1NoYW1tZWRTeW1ib2xzID8gXCJvYmplY3RcIiA6IFwic3ltYm9sXCIpID8gU3ltYm9sLnRvU3RyaW5nVGFnIDogbnVsbDtcbiAgICB2YXIgaXNFbnVtZXJhYmxlID0gT2JqZWN0LnByb3RvdHlwZS5wcm9wZXJ0eUlzRW51bWVyYWJsZTtcbiAgICB2YXIgZ1BPID0gKHR5cGVvZiBSZWZsZWN0ID09PSBcImZ1bmN0aW9uXCIgPyBSZWZsZWN0LmdldFByb3RvdHlwZU9mIDogT2JqZWN0LmdldFByb3RvdHlwZU9mKSB8fCAoW10uX19wcm90b19fID09PSBBcnJheS5wcm90b3R5cGUgPyBmdW5jdGlvbihPKSB7XG4gICAgICByZXR1cm4gTy5fX3Byb3RvX187XG4gICAgfSA6IG51bGwpO1xuICAgIGZ1bmN0aW9uIGFkZE51bWVyaWNTZXBhcmF0b3IobnVtLCBzdHIpIHtcbiAgICAgIGlmIChudW0gPT09IEluZmluaXR5IHx8IG51bSA9PT0gLUluZmluaXR5IHx8IG51bSAhPT0gbnVtIHx8IG51bSAmJiBudW0gPiAtMWUzICYmIG51bSA8IDFlMyB8fCAkdGVzdC5jYWxsKC9lLywgc3RyKSkge1xuICAgICAgICByZXR1cm4gc3RyO1xuICAgICAgfVxuICAgICAgdmFyIHNlcFJlZ2V4ID0gL1swLTldKD89KD86WzAtOV17M30pKyg/IVswLTldKSkvZztcbiAgICAgIGlmICh0eXBlb2YgbnVtID09PSBcIm51bWJlclwiKSB7XG4gICAgICAgIHZhciBpbnQgPSBudW0gPCAwID8gLSRmbG9vcigtbnVtKSA6ICRmbG9vcihudW0pO1xuICAgICAgICBpZiAoaW50ICE9PSBudW0pIHtcbiAgICAgICAgICB2YXIgaW50U3RyID0gU3RyaW5nKGludCk7XG4gICAgICAgICAgdmFyIGRlYyA9ICRzbGljZS5jYWxsKHN0ciwgaW50U3RyLmxlbmd0aCArIDEpO1xuICAgICAgICAgIHJldHVybiAkcmVwbGFjZS5jYWxsKGludFN0ciwgc2VwUmVnZXgsIFwiJCZfXCIpICsgXCIuXCIgKyAkcmVwbGFjZS5jYWxsKCRyZXBsYWNlLmNhbGwoZGVjLCAvKFswLTldezN9KS9nLCBcIiQmX1wiKSwgL18kLywgXCJcIik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiAkcmVwbGFjZS5jYWxsKHN0ciwgc2VwUmVnZXgsIFwiJCZfXCIpO1xuICAgIH1cbiAgICB2YXIgdXRpbEluc3BlY3QgPSByZXF1aXJlX3V0aWxfaW5zcGVjdCgpO1xuICAgIHZhciBpbnNwZWN0Q3VzdG9tID0gdXRpbEluc3BlY3QuY3VzdG9tO1xuICAgIHZhciBpbnNwZWN0U3ltYm9sID0gaXNTeW1ib2woaW5zcGVjdEN1c3RvbSkgPyBpbnNwZWN0Q3VzdG9tIDogbnVsbDtcbiAgICB2YXIgcXVvdGVzID0ge1xuICAgICAgX19wcm90b19fOiBudWxsLFxuICAgICAgXCJkb3VibGVcIjogJ1wiJyxcbiAgICAgIHNpbmdsZTogXCInXCJcbiAgICB9O1xuICAgIHZhciBxdW90ZVJFcyA9IHtcbiAgICAgIF9fcHJvdG9fXzogbnVsbCxcbiAgICAgIFwiZG91YmxlXCI6IC8oW1wiXFxcXF0pL2csXG4gICAgICBzaW5nbGU6IC8oWydcXFxcXSkvZ1xuICAgIH07XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpbnNwZWN0XyhvYmosIG9wdGlvbnMsIGRlcHRoLCBzZWVuKSB7XG4gICAgICB2YXIgb3B0cyA9IG9wdGlvbnMgfHwge307XG4gICAgICBpZiAoaGFzKG9wdHMsIFwicXVvdGVTdHlsZVwiKSAmJiAhaGFzKHF1b3Rlcywgb3B0cy5xdW90ZVN0eWxlKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdvcHRpb24gXCJxdW90ZVN0eWxlXCIgbXVzdCBiZSBcInNpbmdsZVwiIG9yIFwiZG91YmxlXCInKTtcbiAgICAgIH1cbiAgICAgIGlmIChoYXMob3B0cywgXCJtYXhTdHJpbmdMZW5ndGhcIikgJiYgKHR5cGVvZiBvcHRzLm1heFN0cmluZ0xlbmd0aCA9PT0gXCJudW1iZXJcIiA/IG9wdHMubWF4U3RyaW5nTGVuZ3RoIDwgMCAmJiBvcHRzLm1heFN0cmluZ0xlbmd0aCAhPT0gSW5maW5pdHkgOiBvcHRzLm1heFN0cmluZ0xlbmd0aCAhPT0gbnVsbCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignb3B0aW9uIFwibWF4U3RyaW5nTGVuZ3RoXCIsIGlmIHByb3ZpZGVkLCBtdXN0IGJlIGEgcG9zaXRpdmUgaW50ZWdlciwgSW5maW5pdHksIG9yIGBudWxsYCcpO1xuICAgICAgfVxuICAgICAgdmFyIGN1c3RvbUluc3BlY3QgPSBoYXMob3B0cywgXCJjdXN0b21JbnNwZWN0XCIpID8gb3B0cy5jdXN0b21JbnNwZWN0IDogdHJ1ZTtcbiAgICAgIGlmICh0eXBlb2YgY3VzdG9tSW5zcGVjdCAhPT0gXCJib29sZWFuXCIgJiYgY3VzdG9tSW5zcGVjdCAhPT0gXCJzeW1ib2xcIikge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwib3B0aW9uIFxcXCJjdXN0b21JbnNwZWN0XFxcIiwgaWYgcHJvdmlkZWQsIG11c3QgYmUgYHRydWVgLCBgZmFsc2VgLCBvciBgJ3N5bWJvbCdgXCIpO1xuICAgICAgfVxuICAgICAgaWYgKGhhcyhvcHRzLCBcImluZGVudFwiKSAmJiBvcHRzLmluZGVudCAhPT0gbnVsbCAmJiBvcHRzLmluZGVudCAhPT0gXCJcdFwiICYmICEocGFyc2VJbnQob3B0cy5pbmRlbnQsIDEwKSA9PT0gb3B0cy5pbmRlbnQgJiYgb3B0cy5pbmRlbnQgPiAwKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdvcHRpb24gXCJpbmRlbnRcIiBtdXN0IGJlIFwiXFxcXHRcIiwgYW4gaW50ZWdlciA+IDAsIG9yIGBudWxsYCcpO1xuICAgICAgfVxuICAgICAgaWYgKGhhcyhvcHRzLCBcIm51bWVyaWNTZXBhcmF0b3JcIikgJiYgdHlwZW9mIG9wdHMubnVtZXJpY1NlcGFyYXRvciAhPT0gXCJib29sZWFuXCIpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignb3B0aW9uIFwibnVtZXJpY1NlcGFyYXRvclwiLCBpZiBwcm92aWRlZCwgbXVzdCBiZSBgdHJ1ZWAgb3IgYGZhbHNlYCcpO1xuICAgICAgfVxuICAgICAgdmFyIG51bWVyaWNTZXBhcmF0b3IgPSBvcHRzLm51bWVyaWNTZXBhcmF0b3I7XG4gICAgICBpZiAodHlwZW9mIG9iaiA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICByZXR1cm4gXCJ1bmRlZmluZWRcIjtcbiAgICAgIH1cbiAgICAgIGlmIChvYmogPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIFwibnVsbFwiO1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiBvYmogPT09IFwiYm9vbGVhblwiKSB7XG4gICAgICAgIHJldHVybiBvYmogPyBcInRydWVcIiA6IFwiZmFsc2VcIjtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2Ygb2JqID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIHJldHVybiBpbnNwZWN0U3RyaW5nKG9iaiwgb3B0cyk7XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIG9iaiA9PT0gXCJudW1iZXJcIikge1xuICAgICAgICBpZiAob2JqID09PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIEluZmluaXR5IC8gb2JqID4gMCA/IFwiMFwiIDogXCItMFwiO1xuICAgICAgICB9XG4gICAgICAgIHZhciBzdHIgPSBTdHJpbmcob2JqKTtcbiAgICAgICAgcmV0dXJuIG51bWVyaWNTZXBhcmF0b3IgPyBhZGROdW1lcmljU2VwYXJhdG9yKG9iaiwgc3RyKSA6IHN0cjtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2Ygb2JqID09PSBcImJpZ2ludFwiKSB7XG4gICAgICAgIHZhciBiaWdJbnRTdHIgPSBTdHJpbmcob2JqKSArIFwiblwiO1xuICAgICAgICByZXR1cm4gbnVtZXJpY1NlcGFyYXRvciA/IGFkZE51bWVyaWNTZXBhcmF0b3Iob2JqLCBiaWdJbnRTdHIpIDogYmlnSW50U3RyO1xuICAgICAgfVxuICAgICAgdmFyIG1heERlcHRoID0gdHlwZW9mIG9wdHMuZGVwdGggPT09IFwidW5kZWZpbmVkXCIgPyA1IDogb3B0cy5kZXB0aDtcbiAgICAgIGlmICh0eXBlb2YgZGVwdGggPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgZGVwdGggPSAwO1xuICAgICAgfVxuICAgICAgaWYgKGRlcHRoID49IG1heERlcHRoICYmIG1heERlcHRoID4gMCAmJiB0eXBlb2Ygb2JqID09PSBcIm9iamVjdFwiKSB7XG4gICAgICAgIHJldHVybiBpc0FycmF5KG9iaikgPyBcIltBcnJheV1cIiA6IFwiW09iamVjdF1cIjtcbiAgICAgIH1cbiAgICAgIHZhciBpbmRlbnQgPSBnZXRJbmRlbnQob3B0cywgZGVwdGgpO1xuICAgICAgaWYgKHR5cGVvZiBzZWVuID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgIHNlZW4gPSBbXTtcbiAgICAgIH0gZWxzZSBpZiAoaW5kZXhPZihzZWVuLCBvYmopID49IDApIHtcbiAgICAgICAgcmV0dXJuIFwiW0NpcmN1bGFyXVwiO1xuICAgICAgfVxuICAgICAgZnVuY3Rpb24gaW5zcGVjdDModmFsdWUsIGZyb20sIG5vSW5kZW50KSB7XG4gICAgICAgIGlmIChmcm9tKSB7XG4gICAgICAgICAgc2VlbiA9ICRhcnJTbGljZS5jYWxsKHNlZW4pO1xuICAgICAgICAgIHNlZW4ucHVzaChmcm9tKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobm9JbmRlbnQpIHtcbiAgICAgICAgICB2YXIgbmV3T3B0cyA9IHtcbiAgICAgICAgICAgIGRlcHRoOiBvcHRzLmRlcHRoXG4gICAgICAgICAgfTtcbiAgICAgICAgICBpZiAoaGFzKG9wdHMsIFwicXVvdGVTdHlsZVwiKSkge1xuICAgICAgICAgICAgbmV3T3B0cy5xdW90ZVN0eWxlID0gb3B0cy5xdW90ZVN0eWxlO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gaW5zcGVjdF8odmFsdWUsIG5ld09wdHMsIGRlcHRoICsgMSwgc2Vlbik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGluc3BlY3RfKHZhbHVlLCBvcHRzLCBkZXB0aCArIDEsIHNlZW4pO1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiBvYmogPT09IFwiZnVuY3Rpb25cIiAmJiAhaXNSZWdFeHAob2JqKSkge1xuICAgICAgICB2YXIgbmFtZSA9IG5hbWVPZihvYmopO1xuICAgICAgICB2YXIga2V5cyA9IGFyck9iaktleXMob2JqLCBpbnNwZWN0Myk7XG4gICAgICAgIHJldHVybiBcIltGdW5jdGlvblwiICsgKG5hbWUgPyBcIjogXCIgKyBuYW1lIDogXCIgKGFub255bW91cylcIikgKyBcIl1cIiArIChrZXlzLmxlbmd0aCA+IDAgPyBcIiB7IFwiICsgJGpvaW4uY2FsbChrZXlzLCBcIiwgXCIpICsgXCIgfVwiIDogXCJcIik7XG4gICAgICB9XG4gICAgICBpZiAoaXNTeW1ib2wob2JqKSkge1xuICAgICAgICB2YXIgc3ltU3RyaW5nID0gaGFzU2hhbW1lZFN5bWJvbHMgPyAkcmVwbGFjZS5jYWxsKFN0cmluZyhvYmopLCAvXihTeW1ib2xcXCguKlxcKSlfW14pXSokLywgXCIkMVwiKSA6IHN5bVRvU3RyaW5nLmNhbGwob2JqKTtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiBvYmogPT09IFwib2JqZWN0XCIgJiYgIWhhc1NoYW1tZWRTeW1ib2xzID8gbWFya0JveGVkKHN5bVN0cmluZykgOiBzeW1TdHJpbmc7XG4gICAgICB9XG4gICAgICBpZiAoaXNFbGVtZW50KG9iaikpIHtcbiAgICAgICAgdmFyIHMgPSBcIjxcIiArICR0b0xvd2VyQ2FzZS5jYWxsKFN0cmluZyhvYmoubm9kZU5hbWUpKTtcbiAgICAgICAgdmFyIGF0dHJzID0gb2JqLmF0dHJpYnV0ZXMgfHwgW107XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXR0cnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBzICs9IFwiIFwiICsgYXR0cnNbaV0ubmFtZSArIFwiPVwiICsgd3JhcFF1b3RlcyhxdW90ZShhdHRyc1tpXS52YWx1ZSksIFwiZG91YmxlXCIsIG9wdHMpO1xuICAgICAgICB9XG4gICAgICAgIHMgKz0gXCI+XCI7XG4gICAgICAgIGlmIChvYmouY2hpbGROb2RlcyAmJiBvYmouY2hpbGROb2Rlcy5sZW5ndGgpIHtcbiAgICAgICAgICBzICs9IFwiLi4uXCI7XG4gICAgICAgIH1cbiAgICAgICAgcyArPSBcIjwvXCIgKyAkdG9Mb3dlckNhc2UuY2FsbChTdHJpbmcob2JqLm5vZGVOYW1lKSkgKyBcIj5cIjtcbiAgICAgICAgcmV0dXJuIHM7XG4gICAgICB9XG4gICAgICBpZiAoaXNBcnJheShvYmopKSB7XG4gICAgICAgIGlmIChvYmoubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIFwiW11cIjtcbiAgICAgICAgfVxuICAgICAgICB2YXIgeHMgPSBhcnJPYmpLZXlzKG9iaiwgaW5zcGVjdDMpO1xuICAgICAgICBpZiAoaW5kZW50ICYmICFzaW5nbGVMaW5lVmFsdWVzKHhzKSkge1xuICAgICAgICAgIHJldHVybiBcIltcIiArIGluZGVudGVkSm9pbih4cywgaW5kZW50KSArIFwiXVwiO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBcIlsgXCIgKyAkam9pbi5jYWxsKHhzLCBcIiwgXCIpICsgXCIgXVwiO1xuICAgICAgfVxuICAgICAgaWYgKGlzRXJyb3Iob2JqKSkge1xuICAgICAgICB2YXIgcGFydHMgPSBhcnJPYmpLZXlzKG9iaiwgaW5zcGVjdDMpO1xuICAgICAgICBpZiAoIShcImNhdXNlXCIgaW4gRXJyb3IucHJvdG90eXBlKSAmJiBcImNhdXNlXCIgaW4gb2JqICYmICFpc0VudW1lcmFibGUuY2FsbChvYmosIFwiY2F1c2VcIikpIHtcbiAgICAgICAgICByZXR1cm4gXCJ7IFtcIiArIFN0cmluZyhvYmopICsgXCJdIFwiICsgJGpvaW4uY2FsbCgkY29uY2F0LmNhbGwoXCJbY2F1c2VdOiBcIiArIGluc3BlY3QzKG9iai5jYXVzZSksIHBhcnRzKSwgXCIsIFwiKSArIFwiIH1cIjtcbiAgICAgICAgfVxuICAgICAgICBpZiAocGFydHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIFwiW1wiICsgU3RyaW5nKG9iaikgKyBcIl1cIjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gXCJ7IFtcIiArIFN0cmluZyhvYmopICsgXCJdIFwiICsgJGpvaW4uY2FsbChwYXJ0cywgXCIsIFwiKSArIFwiIH1cIjtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2Ygb2JqID09PSBcIm9iamVjdFwiICYmIGN1c3RvbUluc3BlY3QpIHtcbiAgICAgICAgaWYgKGluc3BlY3RTeW1ib2wgJiYgdHlwZW9mIG9ialtpbnNwZWN0U3ltYm9sXSA9PT0gXCJmdW5jdGlvblwiICYmIHV0aWxJbnNwZWN0KSB7XG4gICAgICAgICAgcmV0dXJuIHV0aWxJbnNwZWN0KG9iaiwgeyBkZXB0aDogbWF4RGVwdGggLSBkZXB0aCB9KTtcbiAgICAgICAgfSBlbHNlIGlmIChjdXN0b21JbnNwZWN0ICE9PSBcInN5bWJvbFwiICYmIHR5cGVvZiBvYmouaW5zcGVjdCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgcmV0dXJuIG9iai5pbnNwZWN0KCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChpc01hcChvYmopKSB7XG4gICAgICAgIHZhciBtYXBQYXJ0cyA9IFtdO1xuICAgICAgICBpZiAobWFwRm9yRWFjaCkge1xuICAgICAgICAgIG1hcEZvckVhY2guY2FsbChvYmosIGZ1bmN0aW9uKHZhbHVlLCBrZXkpIHtcbiAgICAgICAgICAgIG1hcFBhcnRzLnB1c2goaW5zcGVjdDMoa2V5LCBvYmosIHRydWUpICsgXCIgPT4gXCIgKyBpbnNwZWN0Myh2YWx1ZSwgb2JqKSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvbGxlY3Rpb25PZihcIk1hcFwiLCBtYXBTaXplLmNhbGwob2JqKSwgbWFwUGFydHMsIGluZGVudCk7XG4gICAgICB9XG4gICAgICBpZiAoaXNTZXQob2JqKSkge1xuICAgICAgICB2YXIgc2V0UGFydHMgPSBbXTtcbiAgICAgICAgaWYgKHNldEZvckVhY2gpIHtcbiAgICAgICAgICBzZXRGb3JFYWNoLmNhbGwob2JqLCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICAgICAgc2V0UGFydHMucHVzaChpbnNwZWN0Myh2YWx1ZSwgb2JqKSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvbGxlY3Rpb25PZihcIlNldFwiLCBzZXRTaXplLmNhbGwob2JqKSwgc2V0UGFydHMsIGluZGVudCk7XG4gICAgICB9XG4gICAgICBpZiAoaXNXZWFrTWFwKG9iaikpIHtcbiAgICAgICAgcmV0dXJuIHdlYWtDb2xsZWN0aW9uT2YoXCJXZWFrTWFwXCIpO1xuICAgICAgfVxuICAgICAgaWYgKGlzV2Vha1NldChvYmopKSB7XG4gICAgICAgIHJldHVybiB3ZWFrQ29sbGVjdGlvbk9mKFwiV2Vha1NldFwiKTtcbiAgICAgIH1cbiAgICAgIGlmIChpc1dlYWtSZWYob2JqKSkge1xuICAgICAgICByZXR1cm4gd2Vha0NvbGxlY3Rpb25PZihcIldlYWtSZWZcIik7XG4gICAgICB9XG4gICAgICBpZiAoaXNOdW1iZXIob2JqKSkge1xuICAgICAgICByZXR1cm4gbWFya0JveGVkKGluc3BlY3QzKE51bWJlcihvYmopKSk7XG4gICAgICB9XG4gICAgICBpZiAoaXNCaWdJbnQob2JqKSkge1xuICAgICAgICByZXR1cm4gbWFya0JveGVkKGluc3BlY3QzKGJpZ0ludFZhbHVlT2YuY2FsbChvYmopKSk7XG4gICAgICB9XG4gICAgICBpZiAoaXNCb29sZWFuKG9iaikpIHtcbiAgICAgICAgcmV0dXJuIG1hcmtCb3hlZChib29sZWFuVmFsdWVPZi5jYWxsKG9iaikpO1xuICAgICAgfVxuICAgICAgaWYgKGlzU3RyaW5nKG9iaikpIHtcbiAgICAgICAgcmV0dXJuIG1hcmtCb3hlZChpbnNwZWN0MyhTdHJpbmcob2JqKSkpO1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgJiYgb2JqID09PSB3aW5kb3cpIHtcbiAgICAgICAgcmV0dXJuIFwieyBbb2JqZWN0IFdpbmRvd10gfVwiO1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiBnbG9iYWxUaGlzICE9PSBcInVuZGVmaW5lZFwiICYmIG9iaiA9PT0gZ2xvYmFsVGhpcyB8fCB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiICYmIG9iaiA9PT0gZ2xvYmFsKSB7XG4gICAgICAgIHJldHVybiBcInsgW29iamVjdCBnbG9iYWxUaGlzXSB9XCI7XG4gICAgICB9XG4gICAgICBpZiAoIWlzRGF0ZShvYmopICYmICFpc1JlZ0V4cChvYmopKSB7XG4gICAgICAgIHZhciB5cyA9IGFyck9iaktleXMob2JqLCBpbnNwZWN0Myk7XG4gICAgICAgIHZhciBpc1BsYWluT2JqZWN0ID0gZ1BPID8gZ1BPKG9iaikgPT09IE9iamVjdC5wcm90b3R5cGUgOiBvYmogaW5zdGFuY2VvZiBPYmplY3QgfHwgb2JqLmNvbnN0cnVjdG9yID09PSBPYmplY3Q7XG4gICAgICAgIHZhciBwcm90b1RhZyA9IG9iaiBpbnN0YW5jZW9mIE9iamVjdCA/IFwiXCIgOiBcIm51bGwgcHJvdG90eXBlXCI7XG4gICAgICAgIHZhciBzdHJpbmdUYWcgPSAhaXNQbGFpbk9iamVjdCAmJiB0b1N0cmluZ1RhZyAmJiBPYmplY3Qob2JqKSA9PT0gb2JqICYmIHRvU3RyaW5nVGFnIGluIG9iaiA/ICRzbGljZS5jYWxsKHRvU3RyKG9iaiksIDgsIC0xKSA6IHByb3RvVGFnID8gXCJPYmplY3RcIiA6IFwiXCI7XG4gICAgICAgIHZhciBjb25zdHJ1Y3RvclRhZyA9IGlzUGxhaW5PYmplY3QgfHwgdHlwZW9mIG9iai5jb25zdHJ1Y3RvciAhPT0gXCJmdW5jdGlvblwiID8gXCJcIiA6IG9iai5jb25zdHJ1Y3Rvci5uYW1lID8gb2JqLmNvbnN0cnVjdG9yLm5hbWUgKyBcIiBcIiA6IFwiXCI7XG4gICAgICAgIHZhciB0YWcgPSBjb25zdHJ1Y3RvclRhZyArIChzdHJpbmdUYWcgfHwgcHJvdG9UYWcgPyBcIltcIiArICRqb2luLmNhbGwoJGNvbmNhdC5jYWxsKFtdLCBzdHJpbmdUYWcgfHwgW10sIHByb3RvVGFnIHx8IFtdKSwgXCI6IFwiKSArIFwiXSBcIiA6IFwiXCIpO1xuICAgICAgICBpZiAoeXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIHRhZyArIFwie31cIjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaW5kZW50KSB7XG4gICAgICAgICAgcmV0dXJuIHRhZyArIFwie1wiICsgaW5kZW50ZWRKb2luKHlzLCBpbmRlbnQpICsgXCJ9XCI7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRhZyArIFwieyBcIiArICRqb2luLmNhbGwoeXMsIFwiLCBcIikgKyBcIiB9XCI7XG4gICAgICB9XG4gICAgICByZXR1cm4gU3RyaW5nKG9iaik7XG4gICAgfTtcbiAgICBmdW5jdGlvbiB3cmFwUXVvdGVzKHMsIGRlZmF1bHRTdHlsZSwgb3B0cykge1xuICAgICAgdmFyIHN0eWxlID0gb3B0cy5xdW90ZVN0eWxlIHx8IGRlZmF1bHRTdHlsZTtcbiAgICAgIHZhciBxdW90ZUNoYXIgPSBxdW90ZXNbc3R5bGVdO1xuICAgICAgcmV0dXJuIHF1b3RlQ2hhciArIHMgKyBxdW90ZUNoYXI7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHF1b3RlKHMpIHtcbiAgICAgIHJldHVybiAkcmVwbGFjZS5jYWxsKFN0cmluZyhzKSwgL1wiL2csIFwiJnF1b3Q7XCIpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBjYW5UcnVzdFRvU3RyaW5nKG9iaikge1xuICAgICAgcmV0dXJuICF0b1N0cmluZ1RhZyB8fCAhKHR5cGVvZiBvYmogPT09IFwib2JqZWN0XCIgJiYgKHRvU3RyaW5nVGFnIGluIG9iaiB8fCB0eXBlb2Ygb2JqW3RvU3RyaW5nVGFnXSAhPT0gXCJ1bmRlZmluZWRcIikpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBpc0FycmF5KG9iaikge1xuICAgICAgcmV0dXJuIHRvU3RyKG9iaikgPT09IFwiW29iamVjdCBBcnJheV1cIiAmJiBjYW5UcnVzdFRvU3RyaW5nKG9iaik7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGlzRGF0ZShvYmopIHtcbiAgICAgIHJldHVybiB0b1N0cihvYmopID09PSBcIltvYmplY3QgRGF0ZV1cIiAmJiBjYW5UcnVzdFRvU3RyaW5nKG9iaik7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGlzUmVnRXhwKG9iaikge1xuICAgICAgcmV0dXJuIHRvU3RyKG9iaikgPT09IFwiW29iamVjdCBSZWdFeHBdXCIgJiYgY2FuVHJ1c3RUb1N0cmluZyhvYmopO1xuICAgIH1cbiAgICBmdW5jdGlvbiBpc0Vycm9yKG9iaikge1xuICAgICAgcmV0dXJuIHRvU3RyKG9iaikgPT09IFwiW29iamVjdCBFcnJvcl1cIiAmJiBjYW5UcnVzdFRvU3RyaW5nKG9iaik7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGlzU3RyaW5nKG9iaikge1xuICAgICAgcmV0dXJuIHRvU3RyKG9iaikgPT09IFwiW29iamVjdCBTdHJpbmddXCIgJiYgY2FuVHJ1c3RUb1N0cmluZyhvYmopO1xuICAgIH1cbiAgICBmdW5jdGlvbiBpc051bWJlcihvYmopIHtcbiAgICAgIHJldHVybiB0b1N0cihvYmopID09PSBcIltvYmplY3QgTnVtYmVyXVwiICYmIGNhblRydXN0VG9TdHJpbmcob2JqKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gaXNCb29sZWFuKG9iaikge1xuICAgICAgcmV0dXJuIHRvU3RyKG9iaikgPT09IFwiW29iamVjdCBCb29sZWFuXVwiICYmIGNhblRydXN0VG9TdHJpbmcob2JqKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gaXNTeW1ib2wob2JqKSB7XG4gICAgICBpZiAoaGFzU2hhbW1lZFN5bWJvbHMpIHtcbiAgICAgICAgcmV0dXJuIG9iaiAmJiB0eXBlb2Ygb2JqID09PSBcIm9iamVjdFwiICYmIG9iaiBpbnN0YW5jZW9mIFN5bWJvbDtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2Ygb2JqID09PSBcInN5bWJvbFwiKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgaWYgKCFvYmogfHwgdHlwZW9mIG9iaiAhPT0gXCJvYmplY3RcIiB8fCAhc3ltVG9TdHJpbmcpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgdHJ5IHtcbiAgICAgICAgc3ltVG9TdHJpbmcuY2FsbChvYmopO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgZnVuY3Rpb24gaXNCaWdJbnQob2JqKSB7XG4gICAgICBpZiAoIW9iaiB8fCB0eXBlb2Ygb2JqICE9PSBcIm9iamVjdFwiIHx8ICFiaWdJbnRWYWx1ZU9mKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIHRyeSB7XG4gICAgICAgIGJpZ0ludFZhbHVlT2YuY2FsbChvYmopO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgdmFyIGhhc093bjIgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5IHx8IGZ1bmN0aW9uKGtleSkge1xuICAgICAgcmV0dXJuIGtleSBpbiB0aGlzO1xuICAgIH07XG4gICAgZnVuY3Rpb24gaGFzKG9iaiwga2V5KSB7XG4gICAgICByZXR1cm4gaGFzT3duMi5jYWxsKG9iaiwga2V5KTtcbiAgICB9XG4gICAgZnVuY3Rpb24gdG9TdHIob2JqKSB7XG4gICAgICByZXR1cm4gb2JqZWN0VG9TdHJpbmcuY2FsbChvYmopO1xuICAgIH1cbiAgICBmdW5jdGlvbiBuYW1lT2YoZikge1xuICAgICAgaWYgKGYubmFtZSkge1xuICAgICAgICByZXR1cm4gZi5uYW1lO1xuICAgICAgfVxuICAgICAgdmFyIG0gPSAkbWF0Y2guY2FsbChmdW5jdGlvblRvU3RyaW5nLmNhbGwoZiksIC9eZnVuY3Rpb25cXHMqKFtcXHckXSspLyk7XG4gICAgICBpZiAobSkge1xuICAgICAgICByZXR1cm4gbVsxXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBmdW5jdGlvbiBpbmRleE9mKHhzLCB4KSB7XG4gICAgICBpZiAoeHMuaW5kZXhPZikge1xuICAgICAgICByZXR1cm4geHMuaW5kZXhPZih4KTtcbiAgICAgIH1cbiAgICAgIGZvciAodmFyIGkgPSAwLCBsID0geHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIGlmICh4c1tpXSA9PT0geCkge1xuICAgICAgICAgIHJldHVybiBpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gLTE7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGlzTWFwKHgpIHtcbiAgICAgIGlmICghbWFwU2l6ZSB8fCAheCB8fCB0eXBlb2YgeCAhPT0gXCJvYmplY3RcIikge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICBtYXBTaXplLmNhbGwoeCk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgc2V0U2l6ZS5jYWxsKHgpO1xuICAgICAgICB9IGNhdGNoIChzKSB7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHggaW5zdGFuY2VvZiBNYXA7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICB9XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGlzV2Vha01hcCh4KSB7XG4gICAgICBpZiAoIXdlYWtNYXBIYXMgfHwgIXggfHwgdHlwZW9mIHggIT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgdHJ5IHtcbiAgICAgICAgd2Vha01hcEhhcy5jYWxsKHgsIHdlYWtNYXBIYXMpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHdlYWtTZXRIYXMuY2FsbCh4LCB3ZWFrU2V0SGFzKTtcbiAgICAgICAgfSBjYXRjaCAocykge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB4IGluc3RhbmNlb2YgV2Vha01hcDtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgZnVuY3Rpb24gaXNXZWFrUmVmKHgpIHtcbiAgICAgIGlmICghd2Vha1JlZkRlcmVmIHx8ICF4IHx8IHR5cGVvZiB4ICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIHRyeSB7XG4gICAgICAgIHdlYWtSZWZEZXJlZi5jYWxsKHgpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgZnVuY3Rpb24gaXNTZXQoeCkge1xuICAgICAgaWYgKCFzZXRTaXplIHx8ICF4IHx8IHR5cGVvZiB4ICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIHRyeSB7XG4gICAgICAgIHNldFNpemUuY2FsbCh4KTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBtYXBTaXplLmNhbGwoeCk7XG4gICAgICAgIH0gY2F0Y2ggKG0pIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4geCBpbnN0YW5jZW9mIFNldDtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgZnVuY3Rpb24gaXNXZWFrU2V0KHgpIHtcbiAgICAgIGlmICghd2Vha1NldEhhcyB8fCAheCB8fCB0eXBlb2YgeCAhPT0gXCJvYmplY3RcIikge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICB3ZWFrU2V0SGFzLmNhbGwoeCwgd2Vha1NldEhhcyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgd2Vha01hcEhhcy5jYWxsKHgsIHdlYWtNYXBIYXMpO1xuICAgICAgICB9IGNhdGNoIChzKSB7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHggaW5zdGFuY2VvZiBXZWFrU2V0O1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBmdW5jdGlvbiBpc0VsZW1lbnQoeCkge1xuICAgICAgaWYgKCF4IHx8IHR5cGVvZiB4ICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2YgSFRNTEVsZW1lbnQgIT09IFwidW5kZWZpbmVkXCIgJiYgeCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHR5cGVvZiB4Lm5vZGVOYW1lID09PSBcInN0cmluZ1wiICYmIHR5cGVvZiB4LmdldEF0dHJpYnV0ZSA9PT0gXCJmdW5jdGlvblwiO1xuICAgIH1cbiAgICBmdW5jdGlvbiBpbnNwZWN0U3RyaW5nKHN0ciwgb3B0cykge1xuICAgICAgaWYgKHN0ci5sZW5ndGggPiBvcHRzLm1heFN0cmluZ0xlbmd0aCkge1xuICAgICAgICB2YXIgcmVtYWluaW5nID0gc3RyLmxlbmd0aCAtIG9wdHMubWF4U3RyaW5nTGVuZ3RoO1xuICAgICAgICB2YXIgdHJhaWxlciA9IFwiLi4uIFwiICsgcmVtYWluaW5nICsgXCIgbW9yZSBjaGFyYWN0ZXJcIiArIChyZW1haW5pbmcgPiAxID8gXCJzXCIgOiBcIlwiKTtcbiAgICAgICAgcmV0dXJuIGluc3BlY3RTdHJpbmcoJHNsaWNlLmNhbGwoc3RyLCAwLCBvcHRzLm1heFN0cmluZ0xlbmd0aCksIG9wdHMpICsgdHJhaWxlcjtcbiAgICAgIH1cbiAgICAgIHZhciBxdW90ZVJFID0gcXVvdGVSRXNbb3B0cy5xdW90ZVN0eWxlIHx8IFwic2luZ2xlXCJdO1xuICAgICAgcXVvdGVSRS5sYXN0SW5kZXggPSAwO1xuICAgICAgdmFyIHMgPSAkcmVwbGFjZS5jYWxsKCRyZXBsYWNlLmNhbGwoc3RyLCBxdW90ZVJFLCBcIlxcXFwkMVwiKSwgL1tcXHgwMC1cXHgxZl0vZywgbG93Ynl0ZSk7XG4gICAgICByZXR1cm4gd3JhcFF1b3RlcyhzLCBcInNpbmdsZVwiLCBvcHRzKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gbG93Ynl0ZShjKSB7XG4gICAgICB2YXIgbiA9IGMuY2hhckNvZGVBdCgwKTtcbiAgICAgIHZhciB4ID0ge1xuICAgICAgICA4OiBcImJcIixcbiAgICAgICAgOTogXCJ0XCIsXG4gICAgICAgIDEwOiBcIm5cIixcbiAgICAgICAgMTI6IFwiZlwiLFxuICAgICAgICAxMzogXCJyXCJcbiAgICAgIH1bbl07XG4gICAgICBpZiAoeCkge1xuICAgICAgICByZXR1cm4gXCJcXFxcXCIgKyB4O1xuICAgICAgfVxuICAgICAgcmV0dXJuIFwiXFxcXHhcIiArIChuIDwgMTYgPyBcIjBcIiA6IFwiXCIpICsgJHRvVXBwZXJDYXNlLmNhbGwobi50b1N0cmluZygxNikpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBtYXJrQm94ZWQoc3RyKSB7XG4gICAgICByZXR1cm4gXCJPYmplY3QoXCIgKyBzdHIgKyBcIilcIjtcbiAgICB9XG4gICAgZnVuY3Rpb24gd2Vha0NvbGxlY3Rpb25PZih0eXBlKSB7XG4gICAgICByZXR1cm4gdHlwZSArIFwiIHsgPyB9XCI7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGNvbGxlY3Rpb25PZih0eXBlLCBzaXplLCBlbnRyaWVzLCBpbmRlbnQpIHtcbiAgICAgIHZhciBqb2luZWRFbnRyaWVzID0gaW5kZW50ID8gaW5kZW50ZWRKb2luKGVudHJpZXMsIGluZGVudCkgOiAkam9pbi5jYWxsKGVudHJpZXMsIFwiLCBcIik7XG4gICAgICByZXR1cm4gdHlwZSArIFwiIChcIiArIHNpemUgKyBcIikge1wiICsgam9pbmVkRW50cmllcyArIFwifVwiO1xuICAgIH1cbiAgICBmdW5jdGlvbiBzaW5nbGVMaW5lVmFsdWVzKHhzKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHhzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChpbmRleE9mKHhzW2ldLCBcIlxcblwiKSA+PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgZnVuY3Rpb24gZ2V0SW5kZW50KG9wdHMsIGRlcHRoKSB7XG4gICAgICB2YXIgYmFzZUluZGVudDtcbiAgICAgIGlmIChvcHRzLmluZGVudCA9PT0gXCJcdFwiKSB7XG4gICAgICAgIGJhc2VJbmRlbnQgPSBcIlx0XCI7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBvcHRzLmluZGVudCA9PT0gXCJudW1iZXJcIiAmJiBvcHRzLmluZGVudCA+IDApIHtcbiAgICAgICAgYmFzZUluZGVudCA9ICRqb2luLmNhbGwoQXJyYXkob3B0cy5pbmRlbnQgKyAxKSwgXCIgXCIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgICByZXR1cm4ge1xuICAgICAgICBiYXNlOiBiYXNlSW5kZW50LFxuICAgICAgICBwcmV2OiAkam9pbi5jYWxsKEFycmF5KGRlcHRoICsgMSksIGJhc2VJbmRlbnQpXG4gICAgICB9O1xuICAgIH1cbiAgICBmdW5jdGlvbiBpbmRlbnRlZEpvaW4oeHMsIGluZGVudCkge1xuICAgICAgaWYgKHhzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gXCJcIjtcbiAgICAgIH1cbiAgICAgIHZhciBsaW5lSm9pbmVyID0gXCJcXG5cIiArIGluZGVudC5wcmV2ICsgaW5kZW50LmJhc2U7XG4gICAgICByZXR1cm4gbGluZUpvaW5lciArICRqb2luLmNhbGwoeHMsIFwiLFwiICsgbGluZUpvaW5lcikgKyBcIlxcblwiICsgaW5kZW50LnByZXY7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGFyck9iaktleXMob2JqLCBpbnNwZWN0Mykge1xuICAgICAgdmFyIGlzQXJyID0gaXNBcnJheShvYmopO1xuICAgICAgdmFyIHhzID0gW107XG4gICAgICBpZiAoaXNBcnIpIHtcbiAgICAgICAgeHMubGVuZ3RoID0gb2JqLmxlbmd0aDtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYmoubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICB4c1tpXSA9IGhhcyhvYmosIGkpID8gaW5zcGVjdDMob2JqW2ldLCBvYmopIDogXCJcIjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdmFyIHN5bXMgPSB0eXBlb2YgZ09QUyA9PT0gXCJmdW5jdGlvblwiID8gZ09QUyhvYmopIDogW107XG4gICAgICB2YXIgc3ltTWFwO1xuICAgICAgaWYgKGhhc1NoYW1tZWRTeW1ib2xzKSB7XG4gICAgICAgIHN5bU1hcCA9IHt9O1xuICAgICAgICBmb3IgKHZhciBrID0gMDsgayA8IHN5bXMubGVuZ3RoOyBrKyspIHtcbiAgICAgICAgICBzeW1NYXBbXCIkXCIgKyBzeW1zW2tdXSA9IHN5bXNba107XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICAgICAgaWYgKCFoYXMob2JqLCBrZXkpKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGlzQXJyICYmIFN0cmluZyhOdW1iZXIoa2V5KSkgPT09IGtleSAmJiBrZXkgPCBvYmoubGVuZ3RoKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGhhc1NoYW1tZWRTeW1ib2xzICYmIHN5bU1hcFtcIiRcIiArIGtleV0gaW5zdGFuY2VvZiBTeW1ib2wpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfSBlbHNlIGlmICgkdGVzdC5jYWxsKC9bXlxcdyRdLywga2V5KSkge1xuICAgICAgICAgIHhzLnB1c2goaW5zcGVjdDMoa2V5LCBvYmopICsgXCI6IFwiICsgaW5zcGVjdDMob2JqW2tleV0sIG9iaikpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHhzLnB1c2goa2V5ICsgXCI6IFwiICsgaW5zcGVjdDMob2JqW2tleV0sIG9iaikpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIGdPUFMgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IHN5bXMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICBpZiAoaXNFbnVtZXJhYmxlLmNhbGwob2JqLCBzeW1zW2pdKSkge1xuICAgICAgICAgICAgeHMucHVzaChcIltcIiArIGluc3BlY3QzKHN5bXNbal0pICsgXCJdOiBcIiArIGluc3BlY3QzKG9ialtzeW1zW2pdXSwgb2JqKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4geHM7XG4gICAgfVxuICB9XG59KTtcblxuLy8gc3JjL2xpYi9iaW5hcnlfcmVhZGVyLnRzXG52YXIgdGV4dERlY29kZXIgPSBuZXcgVGV4dERlY29kZXIoXCJ1dGYtOFwiKTtcbnZhciBCaW5hcnlSZWFkZXIgPSBjbGFzcyB7XG4gIC8qKlxuICAgKiBUaGUgRGF0YVZpZXcgdXNlZCB0byByZWFkIHZhbHVlcyBmcm9tIHRoZSBiaW5hcnkgZGF0YS5cbiAgICpcbiAgICogTm90ZTogVGhlIERhdGFWaWV3J3MgYGJ5dGVPZmZzZXRgIGlzIHJlbGF0aXZlIHRvIHRoZSBiZWdpbm5pbmcgb2YgdGhlXG4gICAqIHVuZGVybHlpbmcgQXJyYXlCdWZmZXIsIG5vdCB0aGUgc3RhcnQgb2YgdGhlIHByb3ZpZGVkIFVpbnQ4QXJyYXkgaW5wdXQuXG4gICAqIFRoaXMgYEJpbmFyeVJlYWRlcmAncyBgI29mZnNldGAgZmllbGQgaXMgdXNlZCB0byB0cmFjayB0aGUgY3VycmVudCByZWFkIHBvc2l0aW9uXG4gICAqIHJlbGF0aXZlIHRvIHRoZSBzdGFydCBvZiB0aGUgcHJvdmlkZWQgVWludDhBcnJheSBpbnB1dC5cbiAgICovXG4gIHZpZXc7XG4gIC8qKlxuICAgKiBSZXByZXNlbnRzIHRoZSBvZmZzZXQgKGluIGJ5dGVzKSByZWxhdGl2ZSB0byB0aGUgc3RhcnQgb2YgdGhlIERhdGFWaWV3XG4gICAqIGFuZCBwcm92aWRlZCBVaW50OEFycmF5IGlucHV0LlxuICAgKlxuICAgKiBOb3RlOiBUaGlzIGlzICpub3QqIHRoZSBhYnNvbHV0ZSBieXRlIG9mZnNldCB3aXRoaW4gdGhlIHVuZGVybHlpbmcgQXJyYXlCdWZmZXIuXG4gICAqL1xuICBvZmZzZXQgPSAwO1xuICBjb25zdHJ1Y3RvcihpbnB1dCkge1xuICAgIHRoaXMudmlldyA9IGlucHV0IGluc3RhbmNlb2YgRGF0YVZpZXcgPyBpbnB1dCA6IG5ldyBEYXRhVmlldyhpbnB1dC5idWZmZXIsIGlucHV0LmJ5dGVPZmZzZXQsIGlucHV0LmJ5dGVMZW5ndGgpO1xuICAgIHRoaXMub2Zmc2V0ID0gMDtcbiAgfVxuICByZXNldChpbnB1dCkge1xuICAgIHRoaXMudmlldyA9IGlucHV0IGluc3RhbmNlb2YgRGF0YVZpZXcgPyBpbnB1dCA6IG5ldyBEYXRhVmlldyhpbnB1dC5idWZmZXIsIGlucHV0LmJ5dGVPZmZzZXQsIGlucHV0LmJ5dGVMZW5ndGgpO1xuICAgIHRoaXMub2Zmc2V0ID0gMDtcbiAgfVxuICBnZXQgcmVtYWluaW5nKCkge1xuICAgIHJldHVybiB0aGlzLnZpZXcuYnl0ZUxlbmd0aCAtIHRoaXMub2Zmc2V0O1xuICB9XG4gIC8qKiBFbnN1cmUgd2UgaGF2ZSBhdCBsZWFzdCBgbmAgYnl0ZXMgbGVmdCB0byByZWFkICovXG4gICNlbnN1cmUobikge1xuICAgIGlmICh0aGlzLm9mZnNldCArIG4gPiB0aGlzLnZpZXcuYnl0ZUxlbmd0aCkge1xuICAgICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoXG4gICAgICAgIGBUcmllZCB0byByZWFkICR7bn0gYnl0ZShzKSBhdCByZWxhdGl2ZSBvZmZzZXQgJHt0aGlzLm9mZnNldH0sIGJ1dCBvbmx5ICR7dGhpcy5yZW1haW5pbmd9IGJ5dGUocykgcmVtYWluYFxuICAgICAgKTtcbiAgICB9XG4gIH1cbiAgcmVhZFVJbnQ4QXJyYXkoKSB7XG4gICAgY29uc3QgbGVuZ3RoID0gdGhpcy5yZWFkVTMyKCk7XG4gICAgdGhpcy4jZW5zdXJlKGxlbmd0aCk7XG4gICAgcmV0dXJuIHRoaXMucmVhZEJ5dGVzKGxlbmd0aCkuc2xpY2UoKTtcbiAgfVxuICByZWFkQm9vbCgpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMudmlldy5nZXRVaW50OCh0aGlzLm9mZnNldCk7XG4gICAgdGhpcy5vZmZzZXQgKz0gMTtcbiAgICByZXR1cm4gdmFsdWUgIT09IDA7XG4gIH1cbiAgcmVhZEJ5dGUoKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnZpZXcuZ2V0VWludDgodGhpcy5vZmZzZXQpO1xuICAgIHRoaXMub2Zmc2V0ICs9IDE7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG4gIHJlYWRCeXRlcyhsZW5ndGgpIHtcbiAgICBjb25zdCBhcnJheSA9IG5ldyBVaW50OEFycmF5KFxuICAgICAgdGhpcy52aWV3LmJ1ZmZlcixcbiAgICAgIHRoaXMudmlldy5ieXRlT2Zmc2V0ICsgdGhpcy5vZmZzZXQsXG4gICAgICBsZW5ndGhcbiAgICApO1xuICAgIHRoaXMub2Zmc2V0ICs9IGxlbmd0aDtcbiAgICByZXR1cm4gYXJyYXk7XG4gIH1cbiAgcmVhZEk4KCkge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy52aWV3LmdldEludDgodGhpcy5vZmZzZXQpO1xuICAgIHRoaXMub2Zmc2V0ICs9IDE7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG4gIHJlYWRVOCgpIHtcbiAgICByZXR1cm4gdGhpcy5yZWFkQnl0ZSgpO1xuICB9XG4gIHJlYWRJMTYoKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnZpZXcuZ2V0SW50MTYodGhpcy5vZmZzZXQsIHRydWUpO1xuICAgIHRoaXMub2Zmc2V0ICs9IDI7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG4gIHJlYWRVMTYoKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnZpZXcuZ2V0VWludDE2KHRoaXMub2Zmc2V0LCB0cnVlKTtcbiAgICB0aGlzLm9mZnNldCArPSAyO1xuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxuICByZWFkSTMyKCkge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy52aWV3LmdldEludDMyKHRoaXMub2Zmc2V0LCB0cnVlKTtcbiAgICB0aGlzLm9mZnNldCArPSA0O1xuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxuICByZWFkVTMyKCkge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy52aWV3LmdldFVpbnQzMih0aGlzLm9mZnNldCwgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gNDtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cbiAgcmVhZEk2NCgpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMudmlldy5nZXRCaWdJbnQ2NCh0aGlzLm9mZnNldCwgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gODtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cbiAgcmVhZFU2NCgpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMudmlldy5nZXRCaWdVaW50NjQodGhpcy5vZmZzZXQsIHRydWUpO1xuICAgIHRoaXMub2Zmc2V0ICs9IDg7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG4gIHJlYWRVMTI4KCkge1xuICAgIGNvbnN0IGxvd2VyUGFydCA9IHRoaXMudmlldy5nZXRCaWdVaW50NjQodGhpcy5vZmZzZXQsIHRydWUpO1xuICAgIGNvbnN0IHVwcGVyUGFydCA9IHRoaXMudmlldy5nZXRCaWdVaW50NjQodGhpcy5vZmZzZXQgKyA4LCB0cnVlKTtcbiAgICB0aGlzLm9mZnNldCArPSAxNjtcbiAgICByZXR1cm4gKHVwcGVyUGFydCA8PCBCaWdJbnQoNjQpKSArIGxvd2VyUGFydDtcbiAgfVxuICByZWFkSTEyOCgpIHtcbiAgICBjb25zdCBsb3dlclBhcnQgPSB0aGlzLnZpZXcuZ2V0QmlnVWludDY0KHRoaXMub2Zmc2V0LCB0cnVlKTtcbiAgICBjb25zdCB1cHBlclBhcnQgPSB0aGlzLnZpZXcuZ2V0QmlnSW50NjQodGhpcy5vZmZzZXQgKyA4LCB0cnVlKTtcbiAgICB0aGlzLm9mZnNldCArPSAxNjtcbiAgICByZXR1cm4gKHVwcGVyUGFydCA8PCBCaWdJbnQoNjQpKSArIGxvd2VyUGFydDtcbiAgfVxuICByZWFkVTI1NigpIHtcbiAgICBjb25zdCBwMCA9IHRoaXMudmlldy5nZXRCaWdVaW50NjQodGhpcy5vZmZzZXQsIHRydWUpO1xuICAgIGNvbnN0IHAxID0gdGhpcy52aWV3LmdldEJpZ1VpbnQ2NCh0aGlzLm9mZnNldCArIDgsIHRydWUpO1xuICAgIGNvbnN0IHAyID0gdGhpcy52aWV3LmdldEJpZ1VpbnQ2NCh0aGlzLm9mZnNldCArIDE2LCB0cnVlKTtcbiAgICBjb25zdCBwMyA9IHRoaXMudmlldy5nZXRCaWdVaW50NjQodGhpcy5vZmZzZXQgKyAyNCwgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gMzI7XG4gICAgcmV0dXJuIChwMyA8PCBCaWdJbnQoMyAqIDY0KSkgKyAocDIgPDwgQmlnSW50KDIgKiA2NCkpICsgKHAxIDw8IEJpZ0ludCgxICogNjQpKSArIHAwO1xuICB9XG4gIHJlYWRJMjU2KCkge1xuICAgIGNvbnN0IHAwID0gdGhpcy52aWV3LmdldEJpZ1VpbnQ2NCh0aGlzLm9mZnNldCwgdHJ1ZSk7XG4gICAgY29uc3QgcDEgPSB0aGlzLnZpZXcuZ2V0QmlnVWludDY0KHRoaXMub2Zmc2V0ICsgOCwgdHJ1ZSk7XG4gICAgY29uc3QgcDIgPSB0aGlzLnZpZXcuZ2V0QmlnVWludDY0KHRoaXMub2Zmc2V0ICsgMTYsIHRydWUpO1xuICAgIGNvbnN0IHAzID0gdGhpcy52aWV3LmdldEJpZ0ludDY0KHRoaXMub2Zmc2V0ICsgMjQsIHRydWUpO1xuICAgIHRoaXMub2Zmc2V0ICs9IDMyO1xuICAgIHJldHVybiAocDMgPDwgQmlnSW50KDMgKiA2NCkpICsgKHAyIDw8IEJpZ0ludCgyICogNjQpKSArIChwMSA8PCBCaWdJbnQoMSAqIDY0KSkgKyBwMDtcbiAgfVxuICByZWFkRjMyKCkge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy52aWV3LmdldEZsb2F0MzIodGhpcy5vZmZzZXQsIHRydWUpO1xuICAgIHRoaXMub2Zmc2V0ICs9IDQ7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG4gIHJlYWRGNjQoKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnZpZXcuZ2V0RmxvYXQ2NCh0aGlzLm9mZnNldCwgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gODtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cbiAgcmVhZFN0cmluZygpIHtcbiAgICBjb25zdCBsZW5ndGggPSB0aGlzLnJlYWRVMzIoKTtcbiAgICB0aGlzLiNlbnN1cmUobGVuZ3RoKTtcbiAgICBjb25zdCBieXRlcyA9IHRoaXMucmVhZEJ5dGVzKGxlbmd0aCk7XG4gICAgcmV0dXJuIHRleHREZWNvZGVyLmRlY29kZShieXRlcyk7XG4gIH1cbn07XG5cbi8vIHNyYy9saWIvYmluYXJ5X3dyaXRlci50c1xudmFyIGltcG9ydF9iYXNlNjRfanMgPSBfX3RvRVNNKHJlcXVpcmVfYmFzZTY0X2pzKCkpO1xudmFyIHRleHRFbmNvZGVyID0gbmV3IFRleHRFbmNvZGVyKCk7XG52YXIgQXJyYXlCdWZmZXJQcm90b3R5cGVUcmFuc2ZlciA9IEFycmF5QnVmZmVyLnByb3RvdHlwZS50cmFuc2ZlciA/PyBmdW5jdGlvbihuZXdCeXRlTGVuZ3RoKSB7XG4gIGlmIChuZXdCeXRlTGVuZ3RoID09PSB2b2lkIDApIHtcbiAgICByZXR1cm4gdGhpcy5zbGljZSgpO1xuICB9IGVsc2UgaWYgKG5ld0J5dGVMZW5ndGggPD0gdGhpcy5ieXRlTGVuZ3RoKSB7XG4gICAgcmV0dXJuIHRoaXMuc2xpY2UoMCwgbmV3Qnl0ZUxlbmd0aCk7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgY29weSA9IG5ldyBVaW50OEFycmF5KG5ld0J5dGVMZW5ndGgpO1xuICAgIGNvcHkuc2V0KG5ldyBVaW50OEFycmF5KHRoaXMpKTtcbiAgICByZXR1cm4gY29weS5idWZmZXI7XG4gIH1cbn07XG52YXIgUmVzaXphYmxlQnVmZmVyID0gY2xhc3Mge1xuICBidWZmZXI7XG4gIHZpZXc7XG4gIGNvbnN0cnVjdG9yKGluaXQpIHtcbiAgICB0aGlzLmJ1ZmZlciA9IHR5cGVvZiBpbml0ID09PSBcIm51bWJlclwiID8gbmV3IEFycmF5QnVmZmVyKGluaXQpIDogaW5pdDtcbiAgICB0aGlzLnZpZXcgPSBuZXcgRGF0YVZpZXcodGhpcy5idWZmZXIpO1xuICB9XG4gIGdldCBjYXBhY2l0eSgpIHtcbiAgICByZXR1cm4gdGhpcy5idWZmZXIuYnl0ZUxlbmd0aDtcbiAgfVxuICBncm93KG5ld1NpemUpIHtcbiAgICBpZiAobmV3U2l6ZSA8PSB0aGlzLmJ1ZmZlci5ieXRlTGVuZ3RoKSByZXR1cm47XG4gICAgdGhpcy5idWZmZXIgPSBBcnJheUJ1ZmZlclByb3RvdHlwZVRyYW5zZmVyLmNhbGwodGhpcy5idWZmZXIsIG5ld1NpemUpO1xuICAgIHRoaXMudmlldyA9IG5ldyBEYXRhVmlldyh0aGlzLmJ1ZmZlcik7XG4gIH1cbn07XG52YXIgQmluYXJ5V3JpdGVyID0gY2xhc3Mge1xuICBidWZmZXI7XG4gIG9mZnNldCA9IDA7XG4gIGNvbnN0cnVjdG9yKGluaXQpIHtcbiAgICB0aGlzLmJ1ZmZlciA9IHR5cGVvZiBpbml0ID09PSBcIm51bWJlclwiID8gbmV3IFJlc2l6YWJsZUJ1ZmZlcihpbml0KSA6IGluaXQ7XG4gIH1cbiAgY2xlYXIoKSB7XG4gICAgdGhpcy5vZmZzZXQgPSAwO1xuICB9XG4gIHJlc2V0KGJ1ZmZlcikge1xuICAgIHRoaXMuYnVmZmVyID0gYnVmZmVyO1xuICAgIHRoaXMub2Zmc2V0ID0gMDtcbiAgfVxuICBleHBhbmRCdWZmZXIoYWRkaXRpb25hbENhcGFjaXR5KSB7XG4gICAgY29uc3QgbWluQ2FwYWNpdHkgPSB0aGlzLm9mZnNldCArIGFkZGl0aW9uYWxDYXBhY2l0eSArIDE7XG4gICAgaWYgKG1pbkNhcGFjaXR5IDw9IHRoaXMuYnVmZmVyLmNhcGFjaXR5KSByZXR1cm47XG4gICAgbGV0IG5ld0NhcGFjaXR5ID0gdGhpcy5idWZmZXIuY2FwYWNpdHkgKiAyO1xuICAgIGlmIChuZXdDYXBhY2l0eSA8IG1pbkNhcGFjaXR5KSBuZXdDYXBhY2l0eSA9IG1pbkNhcGFjaXR5O1xuICAgIHRoaXMuYnVmZmVyLmdyb3cobmV3Q2FwYWNpdHkpO1xuICB9XG4gIHRvQmFzZTY0KCkge1xuICAgIHJldHVybiAoMCwgaW1wb3J0X2Jhc2U2NF9qcy5mcm9tQnl0ZUFycmF5KSh0aGlzLmdldEJ1ZmZlcigpKTtcbiAgfVxuICBnZXRCdWZmZXIoKSB7XG4gICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KHRoaXMuYnVmZmVyLmJ1ZmZlciwgMCwgdGhpcy5vZmZzZXQpO1xuICB9XG4gIGdldCB2aWV3KCkge1xuICAgIHJldHVybiB0aGlzLmJ1ZmZlci52aWV3O1xuICB9XG4gIHdyaXRlVUludDhBcnJheSh2YWx1ZSkge1xuICAgIGNvbnN0IGxlbmd0aCA9IHZhbHVlLmxlbmd0aDtcbiAgICB0aGlzLmV4cGFuZEJ1ZmZlcig0ICsgbGVuZ3RoKTtcbiAgICB0aGlzLndyaXRlVTMyKGxlbmd0aCk7XG4gICAgbmV3IFVpbnQ4QXJyYXkodGhpcy5idWZmZXIuYnVmZmVyLCB0aGlzLm9mZnNldCkuc2V0KHZhbHVlKTtcbiAgICB0aGlzLm9mZnNldCArPSBsZW5ndGg7XG4gIH1cbiAgd3JpdGVCb29sKHZhbHVlKSB7XG4gICAgdGhpcy5leHBhbmRCdWZmZXIoMSk7XG4gICAgdGhpcy52aWV3LnNldFVpbnQ4KHRoaXMub2Zmc2V0LCB2YWx1ZSA/IDEgOiAwKTtcbiAgICB0aGlzLm9mZnNldCArPSAxO1xuICB9XG4gIHdyaXRlQnl0ZSh2YWx1ZSkge1xuICAgIHRoaXMuZXhwYW5kQnVmZmVyKDEpO1xuICAgIHRoaXMudmlldy5zZXRVaW50OCh0aGlzLm9mZnNldCwgdmFsdWUpO1xuICAgIHRoaXMub2Zmc2V0ICs9IDE7XG4gIH1cbiAgd3JpdGVCeXRlcyh2YWx1ZSkge1xuICAgIHRoaXMuZXhwYW5kQnVmZmVyKHZhbHVlLmxlbmd0aCk7XG4gICAgbmV3IFVpbnQ4QXJyYXkodGhpcy5idWZmZXIuYnVmZmVyLCB0aGlzLm9mZnNldCwgdmFsdWUubGVuZ3RoKS5zZXQodmFsdWUpO1xuICAgIHRoaXMub2Zmc2V0ICs9IHZhbHVlLmxlbmd0aDtcbiAgfVxuICB3cml0ZUk4KHZhbHVlKSB7XG4gICAgdGhpcy5leHBhbmRCdWZmZXIoMSk7XG4gICAgdGhpcy52aWV3LnNldEludDgodGhpcy5vZmZzZXQsIHZhbHVlKTtcbiAgICB0aGlzLm9mZnNldCArPSAxO1xuICB9XG4gIHdyaXRlVTgodmFsdWUpIHtcbiAgICB0aGlzLmV4cGFuZEJ1ZmZlcigxKTtcbiAgICB0aGlzLnZpZXcuc2V0VWludDgodGhpcy5vZmZzZXQsIHZhbHVlKTtcbiAgICB0aGlzLm9mZnNldCArPSAxO1xuICB9XG4gIHdyaXRlSTE2KHZhbHVlKSB7XG4gICAgdGhpcy5leHBhbmRCdWZmZXIoMik7XG4gICAgdGhpcy52aWV3LnNldEludDE2KHRoaXMub2Zmc2V0LCB2YWx1ZSwgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gMjtcbiAgfVxuICB3cml0ZVUxNih2YWx1ZSkge1xuICAgIHRoaXMuZXhwYW5kQnVmZmVyKDIpO1xuICAgIHRoaXMudmlldy5zZXRVaW50MTYodGhpcy5vZmZzZXQsIHZhbHVlLCB0cnVlKTtcbiAgICB0aGlzLm9mZnNldCArPSAyO1xuICB9XG4gIHdyaXRlSTMyKHZhbHVlKSB7XG4gICAgdGhpcy5leHBhbmRCdWZmZXIoNCk7XG4gICAgdGhpcy52aWV3LnNldEludDMyKHRoaXMub2Zmc2V0LCB2YWx1ZSwgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gNDtcbiAgfVxuICB3cml0ZVUzMih2YWx1ZSkge1xuICAgIHRoaXMuZXhwYW5kQnVmZmVyKDQpO1xuICAgIHRoaXMudmlldy5zZXRVaW50MzIodGhpcy5vZmZzZXQsIHZhbHVlLCB0cnVlKTtcbiAgICB0aGlzLm9mZnNldCArPSA0O1xuICB9XG4gIHdyaXRlSTY0KHZhbHVlKSB7XG4gICAgdGhpcy5leHBhbmRCdWZmZXIoOCk7XG4gICAgdGhpcy52aWV3LnNldEJpZ0ludDY0KHRoaXMub2Zmc2V0LCB2YWx1ZSwgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gODtcbiAgfVxuICB3cml0ZVU2NCh2YWx1ZSkge1xuICAgIHRoaXMuZXhwYW5kQnVmZmVyKDgpO1xuICAgIHRoaXMudmlldy5zZXRCaWdVaW50NjQodGhpcy5vZmZzZXQsIHZhbHVlLCB0cnVlKTtcbiAgICB0aGlzLm9mZnNldCArPSA4O1xuICB9XG4gIHdyaXRlVTEyOCh2YWx1ZSkge1xuICAgIHRoaXMuZXhwYW5kQnVmZmVyKDE2KTtcbiAgICBjb25zdCBsb3dlclBhcnQgPSB2YWx1ZSAmIEJpZ0ludChcIjB4RkZGRkZGRkZGRkZGRkZGRlwiKTtcbiAgICBjb25zdCB1cHBlclBhcnQgPSB2YWx1ZSA+PiBCaWdJbnQoNjQpO1xuICAgIHRoaXMudmlldy5zZXRCaWdVaW50NjQodGhpcy5vZmZzZXQsIGxvd2VyUGFydCwgdHJ1ZSk7XG4gICAgdGhpcy52aWV3LnNldEJpZ1VpbnQ2NCh0aGlzLm9mZnNldCArIDgsIHVwcGVyUGFydCwgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gMTY7XG4gIH1cbiAgd3JpdGVJMTI4KHZhbHVlKSB7XG4gICAgdGhpcy5leHBhbmRCdWZmZXIoMTYpO1xuICAgIGNvbnN0IGxvd2VyUGFydCA9IHZhbHVlICYgQmlnSW50KFwiMHhGRkZGRkZGRkZGRkZGRkZGXCIpO1xuICAgIGNvbnN0IHVwcGVyUGFydCA9IHZhbHVlID4+IEJpZ0ludCg2NCk7XG4gICAgdGhpcy52aWV3LnNldEJpZ0ludDY0KHRoaXMub2Zmc2V0LCBsb3dlclBhcnQsIHRydWUpO1xuICAgIHRoaXMudmlldy5zZXRCaWdJbnQ2NCh0aGlzLm9mZnNldCArIDgsIHVwcGVyUGFydCwgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gMTY7XG4gIH1cbiAgd3JpdGVVMjU2KHZhbHVlKSB7XG4gICAgdGhpcy5leHBhbmRCdWZmZXIoMzIpO1xuICAgIGNvbnN0IGxvd182NF9tYXNrID0gQmlnSW50KFwiMHhGRkZGRkZGRkZGRkZGRkZGXCIpO1xuICAgIGNvbnN0IHAwID0gdmFsdWUgJiBsb3dfNjRfbWFzaztcbiAgICBjb25zdCBwMSA9IHZhbHVlID4+IEJpZ0ludCg2NCAqIDEpICYgbG93XzY0X21hc2s7XG4gICAgY29uc3QgcDIgPSB2YWx1ZSA+PiBCaWdJbnQoNjQgKiAyKSAmIGxvd182NF9tYXNrO1xuICAgIGNvbnN0IHAzID0gdmFsdWUgPj4gQmlnSW50KDY0ICogMyk7XG4gICAgdGhpcy52aWV3LnNldEJpZ1VpbnQ2NCh0aGlzLm9mZnNldCArIDggKiAwLCBwMCwgdHJ1ZSk7XG4gICAgdGhpcy52aWV3LnNldEJpZ1VpbnQ2NCh0aGlzLm9mZnNldCArIDggKiAxLCBwMSwgdHJ1ZSk7XG4gICAgdGhpcy52aWV3LnNldEJpZ1VpbnQ2NCh0aGlzLm9mZnNldCArIDggKiAyLCBwMiwgdHJ1ZSk7XG4gICAgdGhpcy52aWV3LnNldEJpZ1VpbnQ2NCh0aGlzLm9mZnNldCArIDggKiAzLCBwMywgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gMzI7XG4gIH1cbiAgd3JpdGVJMjU2KHZhbHVlKSB7XG4gICAgdGhpcy5leHBhbmRCdWZmZXIoMzIpO1xuICAgIGNvbnN0IGxvd182NF9tYXNrID0gQmlnSW50KFwiMHhGRkZGRkZGRkZGRkZGRkZGXCIpO1xuICAgIGNvbnN0IHAwID0gdmFsdWUgJiBsb3dfNjRfbWFzaztcbiAgICBjb25zdCBwMSA9IHZhbHVlID4+IEJpZ0ludCg2NCAqIDEpICYgbG93XzY0X21hc2s7XG4gICAgY29uc3QgcDIgPSB2YWx1ZSA+PiBCaWdJbnQoNjQgKiAyKSAmIGxvd182NF9tYXNrO1xuICAgIGNvbnN0IHAzID0gdmFsdWUgPj4gQmlnSW50KDY0ICogMyk7XG4gICAgdGhpcy52aWV3LnNldEJpZ1VpbnQ2NCh0aGlzLm9mZnNldCArIDggKiAwLCBwMCwgdHJ1ZSk7XG4gICAgdGhpcy52aWV3LnNldEJpZ1VpbnQ2NCh0aGlzLm9mZnNldCArIDggKiAxLCBwMSwgdHJ1ZSk7XG4gICAgdGhpcy52aWV3LnNldEJpZ1VpbnQ2NCh0aGlzLm9mZnNldCArIDggKiAyLCBwMiwgdHJ1ZSk7XG4gICAgdGhpcy52aWV3LnNldEJpZ0ludDY0KHRoaXMub2Zmc2V0ICsgOCAqIDMsIHAzLCB0cnVlKTtcbiAgICB0aGlzLm9mZnNldCArPSAzMjtcbiAgfVxuICB3cml0ZUYzMih2YWx1ZSkge1xuICAgIHRoaXMuZXhwYW5kQnVmZmVyKDQpO1xuICAgIHRoaXMudmlldy5zZXRGbG9hdDMyKHRoaXMub2Zmc2V0LCB2YWx1ZSwgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gNDtcbiAgfVxuICB3cml0ZUY2NCh2YWx1ZSkge1xuICAgIHRoaXMuZXhwYW5kQnVmZmVyKDgpO1xuICAgIHRoaXMudmlldy5zZXRGbG9hdDY0KHRoaXMub2Zmc2V0LCB2YWx1ZSwgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gODtcbiAgfVxuICB3cml0ZVN0cmluZyh2YWx1ZSkge1xuICAgIGNvbnN0IGxlbiA9IHZhbHVlLmxlbmd0aDtcbiAgICB0aGlzLmV4cGFuZEJ1ZmZlcig0ICsgbGVuKTtcbiAgICBjb25zdCBieXRlcyA9IG5ldyBVaW50OEFycmF5KHRoaXMuYnVmZmVyLmJ1ZmZlcik7XG4gICAgbGV0IG9mZnNldCA9IHRoaXMub2Zmc2V0ICsgNDtcbiAgICBsZXQgaSA9IDA7XG4gICAgZm9yICg7IGkgPCBsZW47IGkrKykge1xuICAgICAgY29uc3QgYyA9IHZhbHVlLmNoYXJDb2RlQXQoaSk7XG4gICAgICBpZiAoYyA+PSAxMjgpIGJyZWFrO1xuICAgICAgYnl0ZXNbb2Zmc2V0KytdID0gYztcbiAgICB9XG4gICAgaWYgKGkgPT09IGxlbikge1xuICAgICAgdGhpcy52aWV3LnNldFVpbnQzMih0aGlzLm9mZnNldCwgbGVuLCB0cnVlKTtcbiAgICAgIHRoaXMub2Zmc2V0ID0gb2Zmc2V0O1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLndyaXRlVUludDhBcnJheSh0ZXh0RW5jb2Rlci5lbmNvZGUodmFsdWUpKTtcbiAgfVxufTtcblxuLy8gc3JjL2xpYi91dGlsLnRzXG5mdW5jdGlvbiB1aW50OEFycmF5VG9IZXhTdHJpbmcoYXJyYXkpIHtcbiAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5tYXAuY2FsbChhcnJheS5yZXZlcnNlKCksICh4KSA9PiAoXCIwMFwiICsgeC50b1N0cmluZygxNikpLnNsaWNlKC0yKSkuam9pbihcIlwiKTtcbn1cbmZ1bmN0aW9uIHVpbnQ4QXJyYXlUb1UxMjgoYXJyYXkpIHtcbiAgaWYgKGFycmF5Lmxlbmd0aCAhPSAxNikge1xuICAgIHRocm93IG5ldyBFcnJvcihgVWludDhBcnJheSBpcyBub3QgMTYgYnl0ZXMgbG9uZzogJHthcnJheX1gKTtcbiAgfVxuICByZXR1cm4gbmV3IEJpbmFyeVJlYWRlcihhcnJheSkucmVhZFUxMjgoKTtcbn1cbmZ1bmN0aW9uIHVpbnQ4QXJyYXlUb1UyNTYoYXJyYXkpIHtcbiAgaWYgKGFycmF5Lmxlbmd0aCAhPSAzMikge1xuICAgIHRocm93IG5ldyBFcnJvcihgVWludDhBcnJheSBpcyBub3QgMzIgYnl0ZXMgbG9uZzogWyR7YXJyYXl9XWApO1xuICB9XG4gIHJldHVybiBuZXcgQmluYXJ5UmVhZGVyKGFycmF5KS5yZWFkVTI1NigpO1xufVxuZnVuY3Rpb24gaGV4U3RyaW5nVG9VaW50OEFycmF5KHN0cikge1xuICBpZiAoc3RyLnN0YXJ0c1dpdGgoXCIweFwiKSkge1xuICAgIHN0ciA9IHN0ci5zbGljZSgyKTtcbiAgfVxuICBjb25zdCBtYXRjaGVzID0gc3RyLm1hdGNoKC8uezEsMn0vZykgfHwgW107XG4gIGNvbnN0IGRhdGEgPSBVaW50OEFycmF5LmZyb20oXG4gICAgbWF0Y2hlcy5tYXAoKGJ5dGUpID0+IHBhcnNlSW50KGJ5dGUsIDE2KSlcbiAgKTtcbiAgcmV0dXJuIGRhdGEucmV2ZXJzZSgpO1xufVxuZnVuY3Rpb24gaGV4U3RyaW5nVG9VMTI4KHN0cikge1xuICByZXR1cm4gdWludDhBcnJheVRvVTEyOChoZXhTdHJpbmdUb1VpbnQ4QXJyYXkoc3RyKSk7XG59XG5mdW5jdGlvbiBoZXhTdHJpbmdUb1UyNTYoc3RyKSB7XG4gIHJldHVybiB1aW50OEFycmF5VG9VMjU2KGhleFN0cmluZ1RvVWludDhBcnJheShzdHIpKTtcbn1cbmZ1bmN0aW9uIHUxMjhUb1VpbnQ4QXJyYXkoZGF0YSkge1xuICBjb25zdCB3cml0ZXIgPSBuZXcgQmluYXJ5V3JpdGVyKDE2KTtcbiAgd3JpdGVyLndyaXRlVTEyOChkYXRhKTtcbiAgcmV0dXJuIHdyaXRlci5nZXRCdWZmZXIoKTtcbn1cbmZ1bmN0aW9uIHUxMjhUb0hleFN0cmluZyhkYXRhKSB7XG4gIHJldHVybiB1aW50OEFycmF5VG9IZXhTdHJpbmcodTEyOFRvVWludDhBcnJheShkYXRhKSk7XG59XG5mdW5jdGlvbiB1MjU2VG9VaW50OEFycmF5KGRhdGEpIHtcbiAgY29uc3Qgd3JpdGVyID0gbmV3IEJpbmFyeVdyaXRlcigzMik7XG4gIHdyaXRlci53cml0ZVUyNTYoZGF0YSk7XG4gIHJldHVybiB3cml0ZXIuZ2V0QnVmZmVyKCk7XG59XG5mdW5jdGlvbiB1MjU2VG9IZXhTdHJpbmcoZGF0YSkge1xuICByZXR1cm4gdWludDhBcnJheVRvSGV4U3RyaW5nKHUyNTZUb1VpbnQ4QXJyYXkoZGF0YSkpO1xufVxuZnVuY3Rpb24gY29lcmNlVG9CaWdJbnQodmFsdWUsIHdoYXQpIHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJiaWdpbnRcIikgcmV0dXJuIHZhbHVlO1xuICBpZiAodHlwZW9mIHZhbHVlID09PSBcIm51bWJlclwiKSByZXR1cm4gQmlnSW50KHZhbHVlKTtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJzdHJpbmdcIiAmJiB2YWx1ZS50cmltKCkgIT09IFwiXCIpIHJldHVybiBCaWdJbnQodmFsdWUpO1xuICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgIGBDYW5ub3QgY29udmVydCAke3R5cGVvZiB2YWx1ZX0gdG8gJHt3aGF0fTogZXhwZWN0ZWQgYmlnaW50LCBpbnRlZ2VyIG51bWJlciwgb3IgZGVjaW1hbCBzdHJpbmdgXG4gICk7XG59XG5mdW5jdGlvbiB0b1Bhc2NhbENhc2Uocykge1xuICBjb25zdCBzdHIgPSB0b0NhbWVsQ2FzZShzKTtcbiAgcmV0dXJuIHN0ci5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHN0ci5zbGljZSgxKTtcbn1cbmZ1bmN0aW9uIHRvQ2FtZWxDYXNlKHMpIHtcbiAgY29uc3Qgc3RyID0gcy5yZXBsYWNlKC9bLV9dKy9nLCBcIl9cIikucmVwbGFjZSgvXyhbYS16QS1aMC05XSkvZywgKF8sIGMpID0+IGMudG9VcHBlckNhc2UoKSk7XG4gIHJldHVybiBzdHIuY2hhckF0KDApLnRvTG93ZXJDYXNlKCkgKyBzdHIuc2xpY2UoMSk7XG59XG5mdW5jdGlvbiBic2F0bkJhc2VTaXplKHR5cGVzcGFjZSwgdHkpIHtcbiAgY29uc3QgYXNzdW1lZEFycmF5TGVuZ3RoID0gNDtcbiAgd2hpbGUgKHR5LnRhZyA9PT0gXCJSZWZcIikgdHkgPSB0eXBlc3BhY2UudHlwZXNbdHkudmFsdWVdO1xuICBpZiAodHkudGFnID09PSBcIlByb2R1Y3RcIikge1xuICAgIGxldCBzdW0gPSAwO1xuICAgIGZvciAoY29uc3QgeyBhbGdlYnJhaWNUeXBlOiBlbGVtIH0gb2YgdHkudmFsdWUuZWxlbWVudHMpIHtcbiAgICAgIHN1bSArPSBic2F0bkJhc2VTaXplKHR5cGVzcGFjZSwgZWxlbSk7XG4gICAgfVxuICAgIHJldHVybiBzdW07XG4gIH0gZWxzZSBpZiAodHkudGFnID09PSBcIlN1bVwiKSB7XG4gICAgbGV0IG1pbiA9IEluZmluaXR5O1xuICAgIGZvciAoY29uc3QgeyBhbGdlYnJhaWNUeXBlOiB2YXJpIH0gb2YgdHkudmFsdWUudmFyaWFudHMpIHtcbiAgICAgIGNvbnN0IHZTaXplID0gYnNhdG5CYXNlU2l6ZSh0eXBlc3BhY2UsIHZhcmkpO1xuICAgICAgaWYgKHZTaXplIDwgbWluKSBtaW4gPSB2U2l6ZTtcbiAgICB9XG4gICAgaWYgKG1pbiA9PT0gSW5maW5pdHkpIG1pbiA9IDA7XG4gICAgcmV0dXJuIDQgKyBtaW47XG4gIH0gZWxzZSBpZiAodHkudGFnID09IFwiQXJyYXlcIikge1xuICAgIHJldHVybiA0ICsgYXNzdW1lZEFycmF5TGVuZ3RoICogYnNhdG5CYXNlU2l6ZSh0eXBlc3BhY2UsIHR5LnZhbHVlKTtcbiAgfVxuICByZXR1cm4ge1xuICAgIFN0cmluZzogNCArIGFzc3VtZWRBcnJheUxlbmd0aCxcbiAgICBTdW06IDEsXG4gICAgQm9vbDogMSxcbiAgICBJODogMSxcbiAgICBVODogMSxcbiAgICBJMTY6IDIsXG4gICAgVTE2OiAyLFxuICAgIEkzMjogNCxcbiAgICBVMzI6IDQsXG4gICAgRjMyOiA0LFxuICAgIEk2NDogOCxcbiAgICBVNjQ6IDgsXG4gICAgRjY0OiA4LFxuICAgIEkxMjg6IDE2LFxuICAgIFUxMjg6IDE2LFxuICAgIEkyNTY6IDMyLFxuICAgIFUyNTY6IDMyXG4gIH1bdHkudGFnXTtcbn1cbnZhciBoYXNPd24gPSBPYmplY3QuaGFzT3duO1xuXG4vLyBzcmMvbGliL3RpbWVfZHVyYXRpb24udHNcbnZhciBUaW1lRHVyYXRpb24gPSBjbGFzcyBfVGltZUR1cmF0aW9uIHtcbiAgX190aW1lX2R1cmF0aW9uX21pY3Jvc19fO1xuICBzdGF0aWMgTUlDUk9TX1BFUl9NSUxMSVMgPSAxMDAwbjtcbiAgLyoqXG4gICAqIEdldCB0aGUgYWxnZWJyYWljIHR5cGUgcmVwcmVzZW50YXRpb24gb2YgdGhlIHtAbGluayBUaW1lRHVyYXRpb259IHR5cGUuXG4gICAqIEByZXR1cm5zIFRoZSBhbGdlYnJhaWMgdHlwZSByZXByZXNlbnRhdGlvbiBvZiB0aGUgdHlwZS5cbiAgICovXG4gIHN0YXRpYyBnZXRBbGdlYnJhaWNUeXBlKCkge1xuICAgIHJldHVybiBBbGdlYnJhaWNUeXBlLlByb2R1Y3Qoe1xuICAgICAgZWxlbWVudHM6IFtcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6IFwiX190aW1lX2R1cmF0aW9uX21pY3Jvc19fXCIsXG4gICAgICAgICAgYWxnZWJyYWljVHlwZTogQWxnZWJyYWljVHlwZS5JNjRcbiAgICAgICAgfVxuICAgICAgXVxuICAgIH0pO1xuICB9XG4gIHN0YXRpYyBpc1RpbWVEdXJhdGlvbihhbGdlYnJhaWNUeXBlKSB7XG4gICAgaWYgKGFsZ2VicmFpY1R5cGUudGFnICE9PSBcIlByb2R1Y3RcIikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBjb25zdCBlbGVtZW50cyA9IGFsZ2VicmFpY1R5cGUudmFsdWUuZWxlbWVudHM7XG4gICAgaWYgKGVsZW1lbnRzLmxlbmd0aCAhPT0gMSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBjb25zdCBtaWNyb3NFbGVtZW50ID0gZWxlbWVudHNbMF07XG4gICAgcmV0dXJuIG1pY3Jvc0VsZW1lbnQubmFtZSA9PT0gXCJfX3RpbWVfZHVyYXRpb25fbWljcm9zX19cIiAmJiBtaWNyb3NFbGVtZW50LmFsZ2VicmFpY1R5cGUudGFnID09PSBcIkk2NFwiO1xuICB9XG4gIGdldCBtaWNyb3MoKSB7XG4gICAgcmV0dXJuIHRoaXMuX190aW1lX2R1cmF0aW9uX21pY3Jvc19fO1xuICB9XG4gIGdldCBtaWxsaXMoKSB7XG4gICAgcmV0dXJuIE51bWJlcih0aGlzLm1pY3JvcyAvIF9UaW1lRHVyYXRpb24uTUlDUk9TX1BFUl9NSUxMSVMpO1xuICB9XG4gIGNvbnN0cnVjdG9yKG1pY3Jvcykge1xuICAgIHRoaXMuX190aW1lX2R1cmF0aW9uX21pY3Jvc19fID0gY29lcmNlVG9CaWdJbnQobWljcm9zLCBcIlRpbWVEdXJhdGlvblwiKTtcbiAgfVxuICBzdGF0aWMgZnJvbU1pbGxpcyhtaWxsaXMpIHtcbiAgICByZXR1cm4gbmV3IF9UaW1lRHVyYXRpb24oQmlnSW50KG1pbGxpcykgKiBfVGltZUR1cmF0aW9uLk1JQ1JPU19QRVJfTUlMTElTKTtcbiAgfVxuICAvKiogVGhpcyBvdXRwdXRzIHRoZSBzYW1lIHN0cmluZyBmb3JtYXQgdGhhdCB3ZSB1c2UgaW4gdGhlIGhvc3QgYW5kIGluIFJ1c3QgbW9kdWxlcyAqL1xuICB0b1N0cmluZygpIHtcbiAgICBjb25zdCBtaWNyb3MgPSB0aGlzLm1pY3JvcztcbiAgICBjb25zdCBzaWduID0gbWljcm9zIDwgMCA/IFwiLVwiIDogXCIrXCI7XG4gICAgY29uc3QgcG9zID0gbWljcm9zIDwgMCA/IC1taWNyb3MgOiBtaWNyb3M7XG4gICAgY29uc3Qgc2VjcyA9IHBvcyAvIDEwMDAwMDBuO1xuICAgIGNvbnN0IG1pY3Jvc19yZW1haW5pbmcgPSBwb3MgJSAxMDAwMDAwbjtcbiAgICByZXR1cm4gYCR7c2lnbn0ke3NlY3N9LiR7U3RyaW5nKG1pY3Jvc19yZW1haW5pbmcpLnBhZFN0YXJ0KDYsIFwiMFwiKX1gO1xuICB9XG59O1xuXG4vLyBzcmMvbGliL3RpbWVzdGFtcC50c1xudmFyIFRpbWVzdGFtcCA9IGNsYXNzIF9UaW1lc3RhbXAge1xuICBfX3RpbWVzdGFtcF9taWNyb3Nfc2luY2VfdW5peF9lcG9jaF9fO1xuICBzdGF0aWMgTUlDUk9TX1BFUl9NSUxMSVMgPSAxMDAwbjtcbiAgZ2V0IG1pY3Jvc1NpbmNlVW5peEVwb2NoKCkge1xuICAgIHJldHVybiB0aGlzLl9fdGltZXN0YW1wX21pY3Jvc19zaW5jZV91bml4X2Vwb2NoX187XG4gIH1cbiAgY29uc3RydWN0b3IobWljcm9zKSB7XG4gICAgdGhpcy5fX3RpbWVzdGFtcF9taWNyb3Nfc2luY2VfdW5peF9lcG9jaF9fID0gY29lcmNlVG9CaWdJbnQoXG4gICAgICBtaWNyb3MsXG4gICAgICBcIlRpbWVzdGFtcFwiXG4gICAgKTtcbiAgfVxuICAvKipcbiAgICogR2V0IHRoZSBhbGdlYnJhaWMgdHlwZSByZXByZXNlbnRhdGlvbiBvZiB0aGUge0BsaW5rIFRpbWVzdGFtcH0gdHlwZS5cbiAgICogQHJldHVybnMgVGhlIGFsZ2VicmFpYyB0eXBlIHJlcHJlc2VudGF0aW9uIG9mIHRoZSB0eXBlLlxuICAgKi9cbiAgc3RhdGljIGdldEFsZ2VicmFpY1R5cGUoKSB7XG4gICAgcmV0dXJuIEFsZ2VicmFpY1R5cGUuUHJvZHVjdCh7XG4gICAgICBlbGVtZW50czogW1xuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogXCJfX3RpbWVzdGFtcF9taWNyb3Nfc2luY2VfdW5peF9lcG9jaF9fXCIsXG4gICAgICAgICAgYWxnZWJyYWljVHlwZTogQWxnZWJyYWljVHlwZS5JNjRcbiAgICAgICAgfVxuICAgICAgXVxuICAgIH0pO1xuICB9XG4gIHN0YXRpYyBpc1RpbWVzdGFtcChhbGdlYnJhaWNUeXBlKSB7XG4gICAgaWYgKGFsZ2VicmFpY1R5cGUudGFnICE9PSBcIlByb2R1Y3RcIikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBjb25zdCBlbGVtZW50cyA9IGFsZ2VicmFpY1R5cGUudmFsdWUuZWxlbWVudHM7XG4gICAgaWYgKGVsZW1lbnRzLmxlbmd0aCAhPT0gMSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBjb25zdCBtaWNyb3NFbGVtZW50ID0gZWxlbWVudHNbMF07XG4gICAgcmV0dXJuIG1pY3Jvc0VsZW1lbnQubmFtZSA9PT0gXCJfX3RpbWVzdGFtcF9taWNyb3Nfc2luY2VfdW5peF9lcG9jaF9fXCIgJiYgbWljcm9zRWxlbWVudC5hbGdlYnJhaWNUeXBlLnRhZyA9PT0gXCJJNjRcIjtcbiAgfVxuICAvKipcbiAgICogVGhlIFVuaXggZXBvY2gsIHRoZSBtaWRuaWdodCBhdCB0aGUgYmVnaW5uaW5nIG9mIEphbnVhcnkgMSwgMTk3MCwgVVRDLlxuICAgKi9cbiAgc3RhdGljIFVOSVhfRVBPQ0ggPSBuZXcgX1RpbWVzdGFtcCgwbik7XG4gIC8qKlxuICAgKiBHZXQgYSBgVGltZXN0YW1wYCByZXByZXNlbnRpbmcgdGhlIGV4ZWN1dGlvbiBlbnZpcm9ubWVudCdzIGJlbGllZiBvZiB0aGUgY3VycmVudCBtb21lbnQgaW4gdGltZS5cbiAgICovXG4gIHN0YXRpYyBub3coKSB7XG4gICAgcmV0dXJuIF9UaW1lc3RhbXAuZnJvbURhdGUoLyogQF9fUFVSRV9fICovIG5ldyBEYXRlKCkpO1xuICB9XG4gIC8qKiBDb252ZXJ0IHRvIG1pbGxpc2Vjb25kcyBzaW5jZSBVbml4IGVwb2NoLiAqL1xuICB0b01pbGxpcygpIHtcbiAgICByZXR1cm4gdGhpcy5taWNyb3NTaW5jZVVuaXhFcG9jaCAvIDEwMDBuO1xuICB9XG4gIC8qKlxuICAgKiBHZXQgYSBgVGltZXN0YW1wYCByZXByZXNlbnRpbmcgdGhlIHNhbWUgcG9pbnQgaW4gdGltZSBhcyBgZGF0ZWAuXG4gICAqL1xuICBzdGF0aWMgZnJvbURhdGUoZGF0ZSkge1xuICAgIGNvbnN0IG1pbGxpcyA9IGRhdGUuZ2V0VGltZSgpO1xuICAgIGNvbnN0IG1pY3JvcyA9IEJpZ0ludChtaWxsaXMpICogX1RpbWVzdGFtcC5NSUNST1NfUEVSX01JTExJUztcbiAgICByZXR1cm4gbmV3IF9UaW1lc3RhbXAobWljcm9zKTtcbiAgfVxuICAvKipcbiAgICogR2V0IGEgYERhdGVgIHJlcHJlc2VudGluZyBhcHByb3hpbWF0ZWx5IHRoZSBzYW1lIHBvaW50IGluIHRpbWUgYXMgYHRoaXNgLlxuICAgKlxuICAgKiBUaGlzIG1ldGhvZCB0cnVuY2F0ZXMgdG8gbWlsbGlzZWNvbmQgcHJlY2lzaW9uLFxuICAgKiBhbmQgdGhyb3dzIGBSYW5nZUVycm9yYCBpZiB0aGUgYFRpbWVzdGFtcGAgaXMgb3V0c2lkZSB0aGUgcmFuZ2UgcmVwcmVzZW50YWJsZSBhcyBhIGBEYXRlYC5cbiAgICovXG4gIHRvRGF0ZSgpIHtcbiAgICBjb25zdCBtaWNyb3MgPSB0aGlzLl9fdGltZXN0YW1wX21pY3Jvc19zaW5jZV91bml4X2Vwb2NoX187XG4gICAgY29uc3QgbWlsbGlzID0gbWljcm9zIC8gX1RpbWVzdGFtcC5NSUNST1NfUEVSX01JTExJUztcbiAgICBpZiAobWlsbGlzID4gQmlnSW50KE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKSB8fCBtaWxsaXMgPCBCaWdJbnQoTnVtYmVyLk1JTl9TQUZFX0lOVEVHRVIpKSB7XG4gICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcbiAgICAgICAgXCJUaW1lc3RhbXAgaXMgb3V0c2lkZSBvZiB0aGUgcmVwcmVzZW50YWJsZSByYW5nZSBvZiBKUydzIERhdGVcIlxuICAgICAgKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBEYXRlKE51bWJlcihtaWxsaXMpKTtcbiAgfVxuICAvKipcbiAgICogR2V0IGFuIElTTyA4NjAxIC8gUkZDIDMzMzkgZm9ybWF0dGVkIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiB0aGlzIHRpbWVzdGFtcCB3aXRoIG1pY3Jvc2Vjb25kIHByZWNpc2lvbi5cbiAgICpcbiAgICogVGhpcyBtZXRob2QgcHJlc2VydmVzIHRoZSBmdWxsIG1pY3Jvc2Vjb25kIHByZWNpc2lvbiBvZiB0aGUgdGltZXN0YW1wLFxuICAgKiBhbmQgdGhyb3dzIGBSYW5nZUVycm9yYCBpZiB0aGUgYFRpbWVzdGFtcGAgaXMgb3V0c2lkZSB0aGUgcmFuZ2UgcmVwcmVzZW50YWJsZSBpbiBJU08gZm9ybWF0LlxuICAgKlxuICAgKiBAcmV0dXJucyBJU08gODYwMSBmb3JtYXR0ZWQgc3RyaW5nIHdpdGggbWljcm9zZWNvbmQgcHJlY2lzaW9uIChlLmcuLCAnMjAyNS0wMi0xN1QxMDozMDo0NS4xMjM0NTZaJylcbiAgICovXG4gIHRvSVNPU3RyaW5nKCkge1xuICAgIGNvbnN0IG1pY3JvcyA9IHRoaXMuX190aW1lc3RhbXBfbWljcm9zX3NpbmNlX3VuaXhfZXBvY2hfXztcbiAgICBjb25zdCBtaWxsaXMgPSBtaWNyb3MgLyBfVGltZXN0YW1wLk1JQ1JPU19QRVJfTUlMTElTO1xuICAgIGlmIChtaWxsaXMgPiBCaWdJbnQoTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpIHx8IG1pbGxpcyA8IEJpZ0ludChOdW1iZXIuTUlOX1NBRkVfSU5URUdFUikpIHtcbiAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKFxuICAgICAgICBcIlRpbWVzdGFtcCBpcyBvdXRzaWRlIG9mIHRoZSByZXByZXNlbnRhYmxlIHJhbmdlIGZvciBJU08gc3RyaW5nIGZvcm1hdHRpbmdcIlxuICAgICAgKTtcbiAgICB9XG4gICAgY29uc3QgZGF0ZSA9IG5ldyBEYXRlKE51bWJlcihtaWxsaXMpKTtcbiAgICBjb25zdCBpc29CYXNlID0gZGF0ZS50b0lTT1N0cmluZygpO1xuICAgIGNvbnN0IG1pY3Jvc1JlbWFpbmRlciA9IE1hdGguYWJzKE51bWJlcihtaWNyb3MgJSAxMDAwMDAwbikpO1xuICAgIGNvbnN0IGZyYWN0aW9uYWxQYXJ0ID0gU3RyaW5nKG1pY3Jvc1JlbWFpbmRlcikucGFkU3RhcnQoNiwgXCIwXCIpO1xuICAgIHJldHVybiBpc29CYXNlLnJlcGxhY2UoL1xcLlxcZHszfVokLywgYC4ke2ZyYWN0aW9uYWxQYXJ0fVpgKTtcbiAgfVxuICBzaW5jZShvdGhlcikge1xuICAgIHJldHVybiBuZXcgVGltZUR1cmF0aW9uKFxuICAgICAgdGhpcy5fX3RpbWVzdGFtcF9taWNyb3Nfc2luY2VfdW5peF9lcG9jaF9fIC0gb3RoZXIuX190aW1lc3RhbXBfbWljcm9zX3NpbmNlX3VuaXhfZXBvY2hfX1xuICAgICk7XG4gIH1cbn07XG5cbi8vIHNyYy9saWIvdXVpZC50c1xudmFyIFV1aWQgPSBjbGFzcyBfVXVpZCB7XG4gIF9fdXVpZF9fO1xuICAvKipcbiAgICogVGhlIG5pbCBVVUlEIChhbGwgemVyb3MpLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGB0c1xuICAgKiBjb25zdCB1dWlkID0gVXVpZC5OSUw7XG4gICAqIGNvbnNvbGUuYXNzZXJ0KFxuICAgKiAgIHV1aWQudG9TdHJpbmcoKSA9PT0gXCIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDBcIlxuICAgKiApO1xuICAgKiBgYGBcbiAgICovXG4gIHN0YXRpYyBOSUwgPSBuZXcgX1V1aWQoMG4pO1xuICBzdGF0aWMgTUFYX1VVSURfQklHSU5UID0gMHhmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZm47XG4gIC8qKlxuICAgKiBUaGUgbWF4IFVVSUQgKGFsbCBvbmVzKS5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHNcbiAgICogY29uc3QgdXVpZCA9IFV1aWQuTUFYO1xuICAgKiBjb25zb2xlLmFzc2VydChcbiAgICogICB1dWlkLnRvU3RyaW5nKCkgPT09IFwiZmZmZmZmZmYtZmZmZi1mZmZmLWZmZmYtZmZmZmZmZmZmZmZmXCJcbiAgICogKTtcbiAgICogYGBgXG4gICAqL1xuICBzdGF0aWMgTUFYID0gbmV3IF9VdWlkKF9VdWlkLk1BWF9VVUlEX0JJR0lOVCk7XG4gIC8qKlxuICAgKiBDcmVhdGUgYSBVVUlEIGZyb20gYSByYXcgMTI4LWJpdCB2YWx1ZS5cbiAgICpcbiAgICogQHBhcmFtIHUgLSBVbnNpZ25lZCAxMjgtYml0IGludGVnZXJcbiAgICogQHRocm93cyB7RXJyb3J9IElmIHRoZSB2YWx1ZSBpcyBvdXRzaWRlIHRoZSB2YWxpZCBVVUlEIHJhbmdlXG4gICAqL1xuICBjb25zdHJ1Y3Rvcih1KSB7XG4gICAgY29uc3QgdiA9IGNvZXJjZVRvQmlnSW50KHUsIFwiVXVpZFwiKTtcbiAgICBpZiAodiA8IDBuIHx8IHYgPiBfVXVpZC5NQVhfVVVJRF9CSUdJTlQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgVVVJRDogbXVzdCBiZSBiZXR3ZWVuIDAgYW5kIGBNQVhfVVVJRF9CSUdJTlRgXCIpO1xuICAgIH1cbiAgICB0aGlzLl9fdXVpZF9fID0gdjtcbiAgfVxuICAvKipcbiAgICogQ3JlYXRlIGEgVVVJRCBgdjRgIGZyb20gZXhwbGljaXQgcmFuZG9tIGJ5dGVzLlxuICAgKlxuICAgKiBUaGlzIG1ldGhvZCBhc3N1bWVzIHRoZSBieXRlcyBhcmUgYWxyZWFkeSBzdWZmaWNpZW50bHkgcmFuZG9tLlxuICAgKiBJdCBvbmx5IHNldHMgdGhlIGFwcHJvcHJpYXRlIGJpdHMgZm9yIHRoZSBVVUlEIHZlcnNpb24gYW5kIHZhcmlhbnQuXG4gICAqXG4gICAqIEBwYXJhbSBieXRlcyAtIEV4YWN0bHkgMTYgcmFuZG9tIGJ5dGVzXG4gICAqIEByZXR1cm5zIEEgVVVJRCBgdjRgXG4gICAqIEB0aHJvd3Mge0Vycm9yfSBJZiBgYnl0ZXMubGVuZ3RoICE9PSAxNmBcbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHNcbiAgICogY29uc3QgcmFuZG9tQnl0ZXMgPSBuZXcgVWludDhBcnJheSgxNik7XG4gICAqIGNvbnN0IHV1aWQgPSBVdWlkLmZyb21SYW5kb21CeXRlc1Y0KHJhbmRvbUJ5dGVzKTtcbiAgICpcbiAgICogY29uc29sZS5hc3NlcnQoXG4gICAqICAgdXVpZC50b1N0cmluZygpID09PSBcIjAwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTAwMDAwMDAwMDAwMFwiXG4gICAqICk7XG4gICAqIGBgYFxuICAgKi9cbiAgc3RhdGljIGZyb21SYW5kb21CeXRlc1Y0KGJ5dGVzKSB7XG4gICAgaWYgKGJ5dGVzLmxlbmd0aCAhPT0gMTYpIHRocm93IG5ldyBFcnJvcihcIlVVSUQgdjQgcmVxdWlyZXMgMTYgYnl0ZXNcIik7XG4gICAgY29uc3QgYXJyID0gbmV3IFVpbnQ4QXJyYXkoYnl0ZXMpO1xuICAgIGFycls2XSA9IGFycls2XSAmIDE1IHwgNjQ7XG4gICAgYXJyWzhdID0gYXJyWzhdICYgNjMgfCAxMjg7XG4gICAgcmV0dXJuIG5ldyBfVXVpZChfVXVpZC5ieXRlc1RvQmlnSW50KGFycikpO1xuICB9XG4gIC8qKlxuICAgKiBHZW5lcmF0ZSBhIFVVSUQgYHY3YCB1c2luZyBhIG1vbm90b25pYyBjb3VudGVyIGZyb20gYDBgIHRvIGAyXjMxIC0gMWAsXG4gICAqIGEgdGltZXN0YW1wLCBhbmQgNCByYW5kb20gYnl0ZXMuXG4gICAqXG4gICAqIFRoZSBjb3VudGVyIHdyYXBzIGFyb3VuZCBvbiBvdmVyZmxvdy5cbiAgICpcbiAgICogVGhlIFVVSUQgYHY3YCBpcyBzdHJ1Y3R1cmVkIGFzIGZvbGxvd3M6XG4gICAqXG4gICAqIGBgYGFzY2lpXG4gICAqIOKUjOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUrOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUkFxuICAgKiB8IEIwICB8IEIxICB8IEIyICB8IEIzICB8IEI0ICB8IEI1ICAgICAgICAgICAgICB8ICAgICAgICAgQjYgICAgICAgIHxcbiAgICog4pSc4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pS84pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSkXG4gICAqIHwgICAgICAgICAgICAgICAgIHVuaXhfdHNfbXMgICAgICAgICAgICAgICAgICAgIHwgICAgICB2ZXJzaW9uIDcgICAgfFxuICAgKiDilJTilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilLTilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilJhcbiAgICog4pSM4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSs4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSs4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSs4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSQXG4gICAqIHwgQjcgICAgICAgICAgIHwgQjggICAgICB8IEI5ICB8IEIxMCB8IEIxMSAgfCBCMTIgfCBCMTMgfCBCMTQgfCBCMTUgfFxuICAgKiDilJzilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilLzilIDilIDilIDilIDilIDilIDilIDilIDilIDilLzilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilLzilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilKRcbiAgICogfCBjb3VudGVyX2hpZ2ggfCB2YXJpYW50IHwgICAgY291bnRlcl9sb3cgICB8ICAgICAgICByYW5kb20gICAgICAgICB8XG4gICAqIOKUlOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUtOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUtOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUtOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUmFxuICAgKiBgYGBcbiAgICpcbiAgICogQHBhcmFtIGNvdW50ZXIgLSBNdXRhYmxlIG1vbm90b25pYyBjb3VudGVyICgzMS1iaXQpXG4gICAqIEBwYXJhbSBub3cgLSBUaW1lc3RhbXAgc2luY2UgdGhlIFVuaXggZXBvY2hcbiAgICogQHBhcmFtIHJhbmRvbUJ5dGVzIC0gRXhhY3RseSA0IHJhbmRvbSBieXRlc1xuICAgKiBAcmV0dXJucyBBIFVVSUQgYHY3YFxuICAgKlxuICAgKiBAdGhyb3dzIHtFcnJvcn0gSWYgdGhlIGBjb3VudGVyYCBpcyBuZWdhdGl2ZVxuICAgKiBAdGhyb3dzIHtFcnJvcn0gSWYgdGhlIGB0aW1lc3RhbXBgIGlzIGJlZm9yZSB0aGUgVW5peCBlcG9jaFxuICAgKiBAdGhyb3dzIHtFcnJvcn0gSWYgYHJhbmRvbUJ5dGVzLmxlbmd0aCAhPT0gNGBcbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHNcbiAgICogY29uc3Qgbm93ID0gVGltZXN0YW1wLmZyb21NaWxsaXMoMV82ODZfMDAwXzAwMF8wMDBuKTtcbiAgICogY29uc3QgY291bnRlciA9IHsgdmFsdWU6IDEgfTtcbiAgICogY29uc3QgcmFuZG9tQnl0ZXMgPSBuZXcgVWludDhBcnJheSg0KTtcbiAgICpcbiAgICogY29uc3QgdXVpZCA9IFV1aWQuZnJvbUNvdW50ZXJWNyhjb3VudGVyLCBub3csIHJhbmRvbUJ5dGVzKTtcbiAgICpcbiAgICogY29uc29sZS5hc3NlcnQoXG4gICAqICAgdXVpZC50b1N0cmluZygpID09PSBcIjAwMDA2NDdlLTUxODAtNzAwMC04MDAwLTAwMDIwMDAwMDAwMFwiXG4gICAqICk7XG4gICAqIGBgYFxuICAgKi9cbiAgc3RhdGljIGZyb21Db3VudGVyVjcoY291bnRlciwgbm93LCByYW5kb21CeXRlcykge1xuICAgIGlmIChyYW5kb21CeXRlcy5sZW5ndGggIT09IDQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcImBmcm9tQ291bnRlclY3YCByZXF1aXJlcyBgcmFuZG9tQnl0ZXMubGVuZ3RoID09IDRgXCIpO1xuICAgIH1cbiAgICBpZiAoY291bnRlci52YWx1ZSA8IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcImBmcm9tQ291bnRlclY3YCB1dWlkIGBjb3VudGVyYCBtdXN0IGJlIG5vbi1uZWdhdGl2ZVwiKTtcbiAgICB9XG4gICAgaWYgKG5vdy5fX3RpbWVzdGFtcF9taWNyb3Nfc2luY2VfdW5peF9lcG9jaF9fIDwgMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiYGZyb21Db3VudGVyVjdgIGB0aW1lc3RhbXBgIGJlZm9yZSB1bml4IGVwb2NoXCIpO1xuICAgIH1cbiAgICBjb25zdCBjb3VudGVyVmFsID0gY291bnRlci52YWx1ZTtcbiAgICBjb3VudGVyLnZhbHVlID0gY291bnRlclZhbCArIDEgJiAyMTQ3NDgzNjQ3O1xuICAgIGNvbnN0IHRzTXMgPSBub3cudG9NaWxsaXMoKSAmIDB4ZmZmZmZmZmZmZmZmbjtcbiAgICBjb25zdCBieXRlcyA9IG5ldyBVaW50OEFycmF5KDE2KTtcbiAgICBieXRlc1swXSA9IE51bWJlcih0c01zID4+IDQwbiAmIDB4ZmZuKTtcbiAgICBieXRlc1sxXSA9IE51bWJlcih0c01zID4+IDMybiAmIDB4ZmZuKTtcbiAgICBieXRlc1syXSA9IE51bWJlcih0c01zID4+IDI0biAmIDB4ZmZuKTtcbiAgICBieXRlc1szXSA9IE51bWJlcih0c01zID4+IDE2biAmIDB4ZmZuKTtcbiAgICBieXRlc1s0XSA9IE51bWJlcih0c01zID4+IDhuICYgMHhmZm4pO1xuICAgIGJ5dGVzWzVdID0gTnVtYmVyKHRzTXMgJiAweGZmbik7XG4gICAgYnl0ZXNbN10gPSBjb3VudGVyVmFsID4+PiAyMyAmIDI1NTtcbiAgICBieXRlc1s5XSA9IGNvdW50ZXJWYWwgPj4+IDE1ICYgMjU1O1xuICAgIGJ5dGVzWzEwXSA9IGNvdW50ZXJWYWwgPj4+IDcgJiAyNTU7XG4gICAgYnl0ZXNbMTFdID0gKGNvdW50ZXJWYWwgJiAxMjcpIDw8IDEgJiAyNTU7XG4gICAgYnl0ZXNbMTJdIHw9IHJhbmRvbUJ5dGVzWzBdICYgMTI3O1xuICAgIGJ5dGVzWzEzXSA9IHJhbmRvbUJ5dGVzWzFdO1xuICAgIGJ5dGVzWzE0XSA9IHJhbmRvbUJ5dGVzWzJdO1xuICAgIGJ5dGVzWzE1XSA9IHJhbmRvbUJ5dGVzWzNdO1xuICAgIGJ5dGVzWzZdID0gYnl0ZXNbNl0gJiAxNSB8IDExMjtcbiAgICBieXRlc1s4XSA9IGJ5dGVzWzhdICYgNjMgfCAxMjg7XG4gICAgcmV0dXJuIG5ldyBfVXVpZChfVXVpZC5ieXRlc1RvQmlnSW50KGJ5dGVzKSk7XG4gIH1cbiAgLyoqXG4gICAqIFBhcnNlIGEgVVVJRCBmcm9tIGEgc3RyaW5nIHJlcHJlc2VudGF0aW9uLlxuICAgKlxuICAgKiBAcGFyYW0gcyAtIFVVSUQgc3RyaW5nXG4gICAqIEByZXR1cm5zIFBhcnNlZCBVVUlEXG4gICAqIEB0aHJvd3Mge0Vycm9yfSBJZiB0aGUgc3RyaW5nIGlzIG5vdCBhIHZhbGlkIFVVSURcbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHNcbiAgICogY29uc3QgcyA9IFwiMDE4ODhkNmUtNWMwMC03MDAwLTgwMDAtMDAwMDAwMDAwMDAwXCI7XG4gICAqIGNvbnN0IHV1aWQgPSBVdWlkLnBhcnNlKHMpO1xuICAgKlxuICAgKiBjb25zb2xlLmFzc2VydCh1dWlkLnRvU3RyaW5nKCkgPT09IHMpO1xuICAgKiBgYGBcbiAgICovXG4gIHN0YXRpYyBwYXJzZShzKSB7XG4gICAgY29uc3QgaGV4ID0gcy5yZXBsYWNlKC8tL2csIFwiXCIpO1xuICAgIGlmIChoZXgubGVuZ3RoICE9PSAzMikgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBoZXggVVVJRFwiKTtcbiAgICBsZXQgdiA9IDBuO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMzI7IGkgKz0gMikge1xuICAgICAgdiA9IHYgPDwgOG4gfCBCaWdJbnQocGFyc2VJbnQoaGV4LnNsaWNlKGksIGkgKyAyKSwgMTYpKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBfVXVpZCh2KTtcbiAgfVxuICAvKiogQ29udmVydCB0byBoZXggc3RyaW5nIHdpdGhvdXQgYSAweCBwcmVmaXguICovXG4gIHRvSGV4U3RyaW5nKCkge1xuICAgIHJldHVybiB1MTI4VG9IZXhTdHJpbmcodGhpcy5hc0JpZ0ludCgpKTtcbiAgfVxuICAvKiogQ29udmVydCB0byBzdHJpbmcgKGh5cGhlbmF0ZWQgZm9ybSkuICovXG4gIHRvU3RyaW5nKCkge1xuICAgIGNvbnN0IGhleCA9IHRoaXMudG9IZXhTdHJpbmcoKTtcbiAgICByZXR1cm4gaGV4LnNsaWNlKDAsIDgpICsgXCItXCIgKyBoZXguc2xpY2UoOCwgMTIpICsgXCItXCIgKyBoZXguc2xpY2UoMTIsIDE2KSArIFwiLVwiICsgaGV4LnNsaWNlKDE2LCAyMCkgKyBcIi1cIiArIGhleC5zbGljZSgyMCk7XG4gIH1cbiAgLyoqIENvbnZlcnQgdG8gYmlnaW50ICh1MTI4KS4gKi9cbiAgYXNCaWdJbnQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX191dWlkX187XG4gIH1cbiAgLyoqIFJldHVybiBhIGBVaW50OEFycmF5YCBvZiAxNiBieXRlcy4gKi9cbiAgdG9CeXRlcygpIHtcbiAgICByZXR1cm4gX1V1aWQuYmlnSW50VG9CeXRlcyh0aGlzLl9fdXVpZF9fKTtcbiAgfVxuICBzdGF0aWMgYnl0ZXNUb0JpZ0ludChieXRlcykge1xuICAgIGxldCByZXN1bHQgPSAwbjtcbiAgICBmb3IgKGNvbnN0IGIgb2YgYnl0ZXMpIHJlc3VsdCA9IHJlc3VsdCA8PCA4biB8IEJpZ0ludChiKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIHN0YXRpYyBiaWdJbnRUb0J5dGVzKHZhbHVlKSB7XG4gICAgY29uc3QgYnl0ZXMgPSBuZXcgVWludDhBcnJheSgxNik7XG4gICAgZm9yIChsZXQgaSA9IDE1OyBpID49IDA7IGktLSkge1xuICAgICAgYnl0ZXNbaV0gPSBOdW1iZXIodmFsdWUgJiAweGZmbik7XG4gICAgICB2YWx1ZSA+Pj0gOG47XG4gICAgfVxuICAgIHJldHVybiBieXRlcztcbiAgfVxuICAvKipcbiAgICogUmV0dXJucyB0aGUgdmVyc2lvbiBvZiB0aGlzIFVVSUQuXG4gICAqXG4gICAqIFRoaXMgcmVwcmVzZW50cyB0aGUgYWxnb3JpdGhtIHVzZWQgdG8gZ2VuZXJhdGUgdGhlIHZhbHVlLlxuICAgKlxuICAgKiBAcmV0dXJucyBBIGBVdWlkVmVyc2lvbmBcbiAgICogQHRocm93cyB7RXJyb3J9IElmIHRoZSB2ZXJzaW9uIGZpZWxkIGlzIG5vdCByZWNvZ25pemVkXG4gICAqL1xuICBnZXRWZXJzaW9uKCkge1xuICAgIGNvbnN0IHZlcnNpb24gPSB0aGlzLnRvQnl0ZXMoKVs2XSA+PiA0ICYgMTU7XG4gICAgc3dpdGNoICh2ZXJzaW9uKSB7XG4gICAgICBjYXNlIDQ6XG4gICAgICAgIHJldHVybiBcIlY0XCI7XG4gICAgICBjYXNlIDc6XG4gICAgICAgIHJldHVybiBcIlY3XCI7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAodGhpcyA9PSBfVXVpZC5OSUwpIHtcbiAgICAgICAgICByZXR1cm4gXCJOaWxcIjtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcyA9PSBfVXVpZC5NQVgpIHtcbiAgICAgICAgICByZXR1cm4gXCJNYXhcIjtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIFVVSUQgdmVyc2lvbjogJHt2ZXJzaW9ufWApO1xuICAgIH1cbiAgfVxuICAvKipcbiAgICogRXh0cmFjdCB0aGUgbW9ub3RvbmljIGNvdW50ZXIgZnJvbSBhIFVVSUR2Ny5cbiAgICpcbiAgICogSW50ZW5kZWQgZm9yIHRlc3RpbmcgYW5kIGRpYWdub3N0aWNzLlxuICAgKiBCZWhhdmlvciBpcyB1bmRlZmluZWQgaWYgY2FsbGVkIG9uIGEgbm9uLVY3IFVVSUQuXG4gICAqXG4gICAqIEByZXR1cm5zIDMxLWJpdCBjb3VudGVyIHZhbHVlXG4gICAqL1xuICBnZXRDb3VudGVyKCkge1xuICAgIGNvbnN0IGJ5dGVzID0gdGhpcy50b0J5dGVzKCk7XG4gICAgY29uc3QgaGlnaCA9IGJ5dGVzWzddO1xuICAgIGNvbnN0IG1pZDEgPSBieXRlc1s5XTtcbiAgICBjb25zdCBtaWQyID0gYnl0ZXNbMTBdO1xuICAgIGNvbnN0IGxvdyA9IGJ5dGVzWzExXSA+Pj4gMTtcbiAgICByZXR1cm4gaGlnaCA8PCAyMyB8IG1pZDEgPDwgMTUgfCBtaWQyIDw8IDcgfCBsb3cgfCAwO1xuICB9XG4gIGNvbXBhcmVUbyhvdGhlcikge1xuICAgIGlmICh0aGlzLl9fdXVpZF9fIDwgb3RoZXIuX191dWlkX18pIHJldHVybiAtMTtcbiAgICBpZiAodGhpcy5fX3V1aWRfXyA+IG90aGVyLl9fdXVpZF9fKSByZXR1cm4gMTtcbiAgICByZXR1cm4gMDtcbiAgfVxuICBzdGF0aWMgZ2V0QWxnZWJyYWljVHlwZSgpIHtcbiAgICByZXR1cm4gQWxnZWJyYWljVHlwZS5Qcm9kdWN0KHtcbiAgICAgIGVsZW1lbnRzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiBcIl9fdXVpZF9fXCIsXG4gICAgICAgICAgYWxnZWJyYWljVHlwZTogQWxnZWJyYWljVHlwZS5VMTI4XG4gICAgICAgIH1cbiAgICAgIF1cbiAgICB9KTtcbiAgfVxufTtcblxuLy8gc3JjL2xpYi9jb25uZWN0aW9uX2lkLnRzXG52YXIgQ29ubmVjdGlvbklkID0gY2xhc3MgX0Nvbm5lY3Rpb25JZCB7XG4gIF9fY29ubmVjdGlvbl9pZF9fO1xuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBgQ29ubmVjdGlvbklkYC5cbiAgICovXG4gIGNvbnN0cnVjdG9yKGRhdGEpIHtcbiAgICB0aGlzLl9fY29ubmVjdGlvbl9pZF9fID0gY29lcmNlVG9CaWdJbnQoZGF0YSwgXCJDb25uZWN0aW9uSWRcIik7XG4gIH1cbiAgLyoqXG4gICAqIEdldCB0aGUgYWxnZWJyYWljIHR5cGUgcmVwcmVzZW50YXRpb24gb2YgdGhlIHtAbGluayBDb25uZWN0aW9uSWR9IHR5cGUuXG4gICAqIEByZXR1cm5zIFRoZSBhbGdlYnJhaWMgdHlwZSByZXByZXNlbnRhdGlvbiBvZiB0aGUgdHlwZS5cbiAgICovXG4gIHN0YXRpYyBnZXRBbGdlYnJhaWNUeXBlKCkge1xuICAgIHJldHVybiBBbGdlYnJhaWNUeXBlLlByb2R1Y3Qoe1xuICAgICAgZWxlbWVudHM6IFtcbiAgICAgICAgeyBuYW1lOiBcIl9fY29ubmVjdGlvbl9pZF9fXCIsIGFsZ2VicmFpY1R5cGU6IEFsZ2VicmFpY1R5cGUuVTEyOCB9XG4gICAgICBdXG4gICAgfSk7XG4gIH1cbiAgaXNaZXJvKCkge1xuICAgIHJldHVybiB0aGlzLl9fY29ubmVjdGlvbl9pZF9fID09PSBCaWdJbnQoMCk7XG4gIH1cbiAgc3RhdGljIG51bGxJZlplcm8oYWRkcikge1xuICAgIGlmIChhZGRyLmlzWmVybygpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGFkZHI7XG4gICAgfVxuICB9XG4gIHN0YXRpYyByYW5kb20oKSB7XG4gICAgZnVuY3Rpb24gcmFuZG9tVTgoKSB7XG4gICAgICByZXR1cm4gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMjU1KTtcbiAgICB9XG4gICAgbGV0IHJlc3VsdCA9IEJpZ0ludCgwKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IDE2OyBpKyspIHtcbiAgICAgIHJlc3VsdCA9IHJlc3VsdCA8PCBCaWdJbnQoOCkgfCBCaWdJbnQocmFuZG9tVTgoKSk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgX0Nvbm5lY3Rpb25JZChyZXN1bHQpO1xuICB9XG4gIC8qKlxuICAgKiBDb21wYXJlIHR3byBjb25uZWN0aW9uIElEcyBmb3IgZXF1YWxpdHkuXG4gICAqL1xuICBpc0VxdWFsKG90aGVyKSB7XG4gICAgcmV0dXJuIHRoaXMuX19jb25uZWN0aW9uX2lkX18gPT0gb3RoZXIuX19jb25uZWN0aW9uX2lkX187XG4gIH1cbiAgLyoqXG4gICAqIENoZWNrIGlmIHR3byBjb25uZWN0aW9uIElEcyBhcmUgZXF1YWwuXG4gICAqL1xuICBlcXVhbHMob3RoZXIpIHtcbiAgICByZXR1cm4gdGhpcy5pc0VxdWFsKG90aGVyKTtcbiAgfVxuICAvKipcbiAgICogUHJpbnQgdGhlIGNvbm5lY3Rpb24gSUQgYXMgYSBoZXhhZGVjaW1hbCBzdHJpbmcuXG4gICAqL1xuICB0b0hleFN0cmluZygpIHtcbiAgICByZXR1cm4gdTEyOFRvSGV4U3RyaW5nKHRoaXMuX19jb25uZWN0aW9uX2lkX18pO1xuICB9XG4gIC8qKlxuICAgKiBDb252ZXJ0IHRoZSBjb25uZWN0aW9uIElEIHRvIGEgVWludDhBcnJheS5cbiAgICovXG4gIHRvVWludDhBcnJheSgpIHtcbiAgICByZXR1cm4gdTEyOFRvVWludDhBcnJheSh0aGlzLl9fY29ubmVjdGlvbl9pZF9fKTtcbiAgfVxuICAvKipcbiAgICogUGFyc2UgYSBjb25uZWN0aW9uIElEIGZyb20gYSBoZXhhZGVjaW1hbCBzdHJpbmcuXG4gICAqL1xuICBzdGF0aWMgZnJvbVN0cmluZyhzdHIpIHtcbiAgICByZXR1cm4gbmV3IF9Db25uZWN0aW9uSWQoaGV4U3RyaW5nVG9VMTI4KHN0cikpO1xuICB9XG4gIHN0YXRpYyBmcm9tU3RyaW5nT3JOdWxsKHN0cikge1xuICAgIGNvbnN0IGFkZHIgPSBfQ29ubmVjdGlvbklkLmZyb21TdHJpbmcoc3RyKTtcbiAgICBpZiAoYWRkci5pc1plcm8oKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBhZGRyO1xuICAgIH1cbiAgfVxufTtcblxuLy8gc3JjL2xpYi9pZGVudGl0eS50c1xudmFyIElkZW50aXR5ID0gY2xhc3MgX0lkZW50aXR5IHtcbiAgX19pZGVudGl0eV9fO1xuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBgSWRlbnRpdHlgLlxuICAgKlxuICAgKiBgZGF0YWAgY2FuIGJlIGEgaGV4YWRlY2ltYWwgc3RyaW5nIG9yIGEgYGJpZ2ludGAuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihkYXRhKSB7XG4gICAgdGhpcy5fX2lkZW50aXR5X18gPSB0eXBlb2YgZGF0YSA9PT0gXCJzdHJpbmdcIiA/IGhleFN0cmluZ1RvVTI1NihkYXRhKSA6IGNvZXJjZVRvQmlnSW50KGRhdGEsIFwiSWRlbnRpdHlcIik7XG4gIH1cbiAgLyoqXG4gICAqIEdldCB0aGUgYWxnZWJyYWljIHR5cGUgcmVwcmVzZW50YXRpb24gb2YgdGhlIHtAbGluayBJZGVudGl0eX0gdHlwZS5cbiAgICogQHJldHVybnMgVGhlIGFsZ2VicmFpYyB0eXBlIHJlcHJlc2VudGF0aW9uIG9mIHRoZSB0eXBlLlxuICAgKi9cbiAgc3RhdGljIGdldEFsZ2VicmFpY1R5cGUoKSB7XG4gICAgcmV0dXJuIEFsZ2VicmFpY1R5cGUuUHJvZHVjdCh7XG4gICAgICBlbGVtZW50czogW3sgbmFtZTogXCJfX2lkZW50aXR5X19cIiwgYWxnZWJyYWljVHlwZTogQWxnZWJyYWljVHlwZS5VMjU2IH1dXG4gICAgfSk7XG4gIH1cbiAgLyoqXG4gICAqIENoZWNrIGlmIHR3byBpZGVudGl0aWVzIGFyZSBlcXVhbC5cbiAgICovXG4gIGlzRXF1YWwob3RoZXIpIHtcbiAgICByZXR1cm4gdGhpcy50b0hleFN0cmluZygpID09PSBvdGhlci50b0hleFN0cmluZygpO1xuICB9XG4gIC8qKlxuICAgKiBDaGVjayBpZiB0d28gaWRlbnRpdGllcyBhcmUgZXF1YWwuXG4gICAqL1xuICBlcXVhbHMob3RoZXIpIHtcbiAgICByZXR1cm4gdGhpcy5pc0VxdWFsKG90aGVyKTtcbiAgfVxuICAvKipcbiAgICogUHJpbnQgdGhlIGlkZW50aXR5IGFzIGEgaGV4YWRlY2ltYWwgc3RyaW5nLlxuICAgKi9cbiAgdG9IZXhTdHJpbmcoKSB7XG4gICAgcmV0dXJuIHUyNTZUb0hleFN0cmluZyh0aGlzLl9faWRlbnRpdHlfXyk7XG4gIH1cbiAgLyoqXG4gICAqIENvbnZlcnQgdGhlIGFkZHJlc3MgdG8gYSBVaW50OEFycmF5LlxuICAgKi9cbiAgdG9VaW50OEFycmF5KCkge1xuICAgIHJldHVybiB1MjU2VG9VaW50OEFycmF5KHRoaXMuX19pZGVudGl0eV9fKTtcbiAgfVxuICAvKipcbiAgICogUGFyc2UgYW4gSWRlbnRpdHkgZnJvbSBhIGhleGFkZWNpbWFsIHN0cmluZy5cbiAgICovXG4gIHN0YXRpYyBmcm9tU3RyaW5nKHN0cikge1xuICAgIHJldHVybiBuZXcgX0lkZW50aXR5KHN0cik7XG4gIH1cbiAgLyoqXG4gICAqIFplcm8gaWRlbnRpdHkgKDB4MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMClcbiAgICovXG4gIHN0YXRpYyB6ZXJvKCkge1xuICAgIHJldHVybiBuZXcgX0lkZW50aXR5KDBuKTtcbiAgfVxuICB0b1N0cmluZygpIHtcbiAgICByZXR1cm4gdGhpcy50b0hleFN0cmluZygpO1xuICB9XG59O1xuXG4vLyBzcmMvbGliL2FsZ2VicmFpY190eXBlLnRzXG52YXIgU0VSSUFMSVpFUlMgPSAvKiBAX19QVVJFX18gKi8gbmV3IE1hcCgpO1xudmFyIERFU0VSSUFMSVpFUlMgPSAvKiBAX19QVVJFX18gKi8gbmV3IE1hcCgpO1xudmFyIEFsZ2VicmFpY1R5cGUgPSB7XG4gIFJlZjogKHZhbHVlKSA9PiAoeyB0YWc6IFwiUmVmXCIsIHZhbHVlIH0pLFxuICBTdW06ICh2YWx1ZSkgPT4gKHtcbiAgICB0YWc6IFwiU3VtXCIsXG4gICAgdmFsdWVcbiAgfSksXG4gIFByb2R1Y3Q6ICh2YWx1ZSkgPT4gKHtcbiAgICB0YWc6IFwiUHJvZHVjdFwiLFxuICAgIHZhbHVlXG4gIH0pLFxuICBBcnJheTogKHZhbHVlKSA9PiAoe1xuICAgIHRhZzogXCJBcnJheVwiLFxuICAgIHZhbHVlXG4gIH0pLFxuICBTdHJpbmc6IHsgdGFnOiBcIlN0cmluZ1wiIH0sXG4gIEJvb2w6IHsgdGFnOiBcIkJvb2xcIiB9LFxuICBJODogeyB0YWc6IFwiSThcIiB9LFxuICBVODogeyB0YWc6IFwiVThcIiB9LFxuICBJMTY6IHsgdGFnOiBcIkkxNlwiIH0sXG4gIFUxNjogeyB0YWc6IFwiVTE2XCIgfSxcbiAgSTMyOiB7IHRhZzogXCJJMzJcIiB9LFxuICBVMzI6IHsgdGFnOiBcIlUzMlwiIH0sXG4gIEk2NDogeyB0YWc6IFwiSTY0XCIgfSxcbiAgVTY0OiB7IHRhZzogXCJVNjRcIiB9LFxuICBJMTI4OiB7IHRhZzogXCJJMTI4XCIgfSxcbiAgVTEyODogeyB0YWc6IFwiVTEyOFwiIH0sXG4gIEkyNTY6IHsgdGFnOiBcIkkyNTZcIiB9LFxuICBVMjU2OiB7IHRhZzogXCJVMjU2XCIgfSxcbiAgRjMyOiB7IHRhZzogXCJGMzJcIiB9LFxuICBGNjQ6IHsgdGFnOiBcIkY2NFwiIH0sXG4gIG1ha2VTZXJpYWxpemVyKHR5LCB0eXBlc3BhY2UpIHtcbiAgICBpZiAodHkudGFnID09PSBcIlJlZlwiKSB7XG4gICAgICBpZiAoIXR5cGVzcGFjZSlcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiY2Fubm90IHNlcmlhbGl6ZSByZWZzIHdpdGhvdXQgYSB0eXBlc3BhY2VcIik7XG4gICAgICB3aGlsZSAodHkudGFnID09PSBcIlJlZlwiKSB0eSA9IHR5cGVzcGFjZS50eXBlc1t0eS52YWx1ZV07XG4gICAgfVxuICAgIHN3aXRjaCAodHkudGFnKSB7XG4gICAgICBjYXNlIFwiUHJvZHVjdFwiOlxuICAgICAgICByZXR1cm4gUHJvZHVjdFR5cGUubWFrZVNlcmlhbGl6ZXIodHkudmFsdWUsIHR5cGVzcGFjZSk7XG4gICAgICBjYXNlIFwiU3VtXCI6XG4gICAgICAgIHJldHVybiBTdW1UeXBlLm1ha2VTZXJpYWxpemVyKHR5LnZhbHVlLCB0eXBlc3BhY2UpO1xuICAgICAgY2FzZSBcIkFycmF5XCI6XG4gICAgICAgIGlmICh0eS52YWx1ZS50YWcgPT09IFwiVThcIikge1xuICAgICAgICAgIHJldHVybiBzZXJpYWxpemVVaW50OEFycmF5O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IHNlcmlhbGl6ZSA9IEFsZ2VicmFpY1R5cGUubWFrZVNlcmlhbGl6ZXIodHkudmFsdWUsIHR5cGVzcGFjZSk7XG4gICAgICAgICAgcmV0dXJuICh3cml0ZXIsIHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB3cml0ZXIud3JpdGVVMzIodmFsdWUubGVuZ3RoKTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgZWxlbSBvZiB2YWx1ZSkge1xuICAgICAgICAgICAgICBzZXJpYWxpemUod3JpdGVyLCBlbGVtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gcHJpbWl0aXZlU2VyaWFsaXplcnNbdHkudGFnXTtcbiAgICB9XG4gIH0sXG4gIC8qKiBAZGVwcmVjYXRlZCBVc2UgYG1ha2VTZXJpYWxpemVyYCBpbnN0ZWFkLiAqL1xuICBzZXJpYWxpemVWYWx1ZSh3cml0ZXIsIHR5LCB2YWx1ZSwgdHlwZXNwYWNlKSB7XG4gICAgQWxnZWJyYWljVHlwZS5tYWtlU2VyaWFsaXplcih0eSwgdHlwZXNwYWNlKSh3cml0ZXIsIHZhbHVlKTtcbiAgfSxcbiAgbWFrZURlc2VyaWFsaXplcih0eSwgdHlwZXNwYWNlKSB7XG4gICAgaWYgKHR5LnRhZyA9PT0gXCJSZWZcIikge1xuICAgICAgaWYgKCF0eXBlc3BhY2UpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImNhbm5vdCBkZXNlcmlhbGl6ZSByZWZzIHdpdGhvdXQgYSB0eXBlc3BhY2VcIik7XG4gICAgICB3aGlsZSAodHkudGFnID09PSBcIlJlZlwiKSB0eSA9IHR5cGVzcGFjZS50eXBlc1t0eS52YWx1ZV07XG4gICAgfVxuICAgIHN3aXRjaCAodHkudGFnKSB7XG4gICAgICBjYXNlIFwiUHJvZHVjdFwiOlxuICAgICAgICByZXR1cm4gUHJvZHVjdFR5cGUubWFrZURlc2VyaWFsaXplcih0eS52YWx1ZSwgdHlwZXNwYWNlKTtcbiAgICAgIGNhc2UgXCJTdW1cIjpcbiAgICAgICAgcmV0dXJuIFN1bVR5cGUubWFrZURlc2VyaWFsaXplcih0eS52YWx1ZSwgdHlwZXNwYWNlKTtcbiAgICAgIGNhc2UgXCJBcnJheVwiOlxuICAgICAgICBpZiAodHkudmFsdWUudGFnID09PSBcIlU4XCIpIHtcbiAgICAgICAgICByZXR1cm4gZGVzZXJpYWxpemVVaW50OEFycmF5O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IGRlc2VyaWFsaXplID0gQWxnZWJyYWljVHlwZS5tYWtlRGVzZXJpYWxpemVyKFxuICAgICAgICAgICAgdHkudmFsdWUsXG4gICAgICAgICAgICB0eXBlc3BhY2VcbiAgICAgICAgICApO1xuICAgICAgICAgIHJldHVybiAocmVhZGVyKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBsZW5ndGggPSByZWFkZXIucmVhZFUzMigpO1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gQXJyYXkobGVuZ3RoKTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgcmVzdWx0W2ldID0gZGVzZXJpYWxpemUocmVhZGVyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIHByaW1pdGl2ZURlc2VyaWFsaXplcnNbdHkudGFnXTtcbiAgICB9XG4gIH0sXG4gIC8qKiBAZGVwcmVjYXRlZCBVc2UgYG1ha2VEZXNlcmlhbGl6ZXJgIGluc3RlYWQuICovXG4gIGRlc2VyaWFsaXplVmFsdWUocmVhZGVyLCB0eSwgdHlwZXNwYWNlKSB7XG4gICAgcmV0dXJuIEFsZ2VicmFpY1R5cGUubWFrZURlc2VyaWFsaXplcih0eSwgdHlwZXNwYWNlKShyZWFkZXIpO1xuICB9LFxuICAvKipcbiAgICogQ29udmVydCBhIHZhbHVlIG9mIHRoZSBhbGdlYnJhaWMgdHlwZSBpbnRvIHNvbWV0aGluZyB0aGF0IGNhbiBiZSB1c2VkIGFzIGEga2V5IGluIGEgbWFwLlxuICAgKiBUaGVyZSBhcmUgbm8gZ3VhcmFudGVlcyBhYm91dCBiZWluZyBhYmxlIHRvIG9yZGVyIGl0LlxuICAgKiBUaGlzIGlzIG9ubHkgZ3VhcmFudGVlZCB0byBiZSBjb21wYXJhYmxlIHRvIG90aGVyIHZhbHVlcyBvZiB0aGUgc2FtZSB0eXBlLlxuICAgKiBAcGFyYW0gdmFsdWUgQSB2YWx1ZSBvZiB0aGUgYWxnZWJyYWljIHR5cGVcbiAgICogQHJldHVybnMgU29tZXRoaW5nIHRoYXQgY2FuIGJlIHVzZWQgYXMgYSBrZXkgaW4gYSBtYXAuXG4gICAqL1xuICBpbnRvTWFwS2V5OiBmdW5jdGlvbih0eSwgdmFsdWUpIHtcbiAgICBzd2l0Y2ggKHR5LnRhZykge1xuICAgICAgY2FzZSBcIlU4XCI6XG4gICAgICBjYXNlIFwiVTE2XCI6XG4gICAgICBjYXNlIFwiVTMyXCI6XG4gICAgICBjYXNlIFwiVTY0XCI6XG4gICAgICBjYXNlIFwiVTEyOFwiOlxuICAgICAgY2FzZSBcIlUyNTZcIjpcbiAgICAgIGNhc2UgXCJJOFwiOlxuICAgICAgY2FzZSBcIkkxNlwiOlxuICAgICAgY2FzZSBcIkkzMlwiOlxuICAgICAgY2FzZSBcIkk2NFwiOlxuICAgICAgY2FzZSBcIkkxMjhcIjpcbiAgICAgIGNhc2UgXCJJMjU2XCI6XG4gICAgICBjYXNlIFwiRjMyXCI6XG4gICAgICBjYXNlIFwiRjY0XCI6XG4gICAgICBjYXNlIFwiU3RyaW5nXCI6XG4gICAgICBjYXNlIFwiQm9vbFwiOlxuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICBjYXNlIFwiUHJvZHVjdFwiOlxuICAgICAgICByZXR1cm4gUHJvZHVjdFR5cGUuaW50b01hcEtleSh0eS52YWx1ZSwgdmFsdWUpO1xuICAgICAgZGVmYXVsdDoge1xuICAgICAgICBjb25zdCB3cml0ZXIgPSBuZXcgQmluYXJ5V3JpdGVyKDEwKTtcbiAgICAgICAgQWxnZWJyYWljVHlwZS5zZXJpYWxpemVWYWx1ZSh3cml0ZXIsIHR5LCB2YWx1ZSk7XG4gICAgICAgIHJldHVybiB3cml0ZXIudG9CYXNlNjQoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn07XG5mdW5jdGlvbiBiaW5kQ2FsbChmKSB7XG4gIHJldHVybiBGdW5jdGlvbi5wcm90b3R5cGUuY2FsbC5iaW5kKGYpO1xufVxudmFyIHByaW1pdGl2ZVNlcmlhbGl6ZXJzID0ge1xuICBCb29sOiBiaW5kQ2FsbChCaW5hcnlXcml0ZXIucHJvdG90eXBlLndyaXRlQm9vbCksXG4gIEk4OiBiaW5kQ2FsbChCaW5hcnlXcml0ZXIucHJvdG90eXBlLndyaXRlSTgpLFxuICBVODogYmluZENhbGwoQmluYXJ5V3JpdGVyLnByb3RvdHlwZS53cml0ZVU4KSxcbiAgSTE2OiBiaW5kQ2FsbChCaW5hcnlXcml0ZXIucHJvdG90eXBlLndyaXRlSTE2KSxcbiAgVTE2OiBiaW5kQ2FsbChCaW5hcnlXcml0ZXIucHJvdG90eXBlLndyaXRlVTE2KSxcbiAgSTMyOiBiaW5kQ2FsbChCaW5hcnlXcml0ZXIucHJvdG90eXBlLndyaXRlSTMyKSxcbiAgVTMyOiBiaW5kQ2FsbChCaW5hcnlXcml0ZXIucHJvdG90eXBlLndyaXRlVTMyKSxcbiAgSTY0OiBiaW5kQ2FsbChCaW5hcnlXcml0ZXIucHJvdG90eXBlLndyaXRlSTY0KSxcbiAgVTY0OiBiaW5kQ2FsbChCaW5hcnlXcml0ZXIucHJvdG90eXBlLndyaXRlVTY0KSxcbiAgSTEyODogYmluZENhbGwoQmluYXJ5V3JpdGVyLnByb3RvdHlwZS53cml0ZUkxMjgpLFxuICBVMTI4OiBiaW5kQ2FsbChCaW5hcnlXcml0ZXIucHJvdG90eXBlLndyaXRlVTEyOCksXG4gIEkyNTY6IGJpbmRDYWxsKEJpbmFyeVdyaXRlci5wcm90b3R5cGUud3JpdGVJMjU2KSxcbiAgVTI1NjogYmluZENhbGwoQmluYXJ5V3JpdGVyLnByb3RvdHlwZS53cml0ZVUyNTYpLFxuICBGMzI6IGJpbmRDYWxsKEJpbmFyeVdyaXRlci5wcm90b3R5cGUud3JpdGVGMzIpLFxuICBGNjQ6IGJpbmRDYWxsKEJpbmFyeVdyaXRlci5wcm90b3R5cGUud3JpdGVGNjQpLFxuICBTdHJpbmc6IGJpbmRDYWxsKEJpbmFyeVdyaXRlci5wcm90b3R5cGUud3JpdGVTdHJpbmcpXG59O1xuT2JqZWN0LmZyZWV6ZShwcmltaXRpdmVTZXJpYWxpemVycyk7XG52YXIgc2VyaWFsaXplVWludDhBcnJheSA9IGJpbmRDYWxsKEJpbmFyeVdyaXRlci5wcm90b3R5cGUud3JpdGVVSW50OEFycmF5KTtcbnZhciBwcmltaXRpdmVEZXNlcmlhbGl6ZXJzID0ge1xuICBCb29sOiBiaW5kQ2FsbChCaW5hcnlSZWFkZXIucHJvdG90eXBlLnJlYWRCb29sKSxcbiAgSTg6IGJpbmRDYWxsKEJpbmFyeVJlYWRlci5wcm90b3R5cGUucmVhZEk4KSxcbiAgVTg6IGJpbmRDYWxsKEJpbmFyeVJlYWRlci5wcm90b3R5cGUucmVhZFU4KSxcbiAgSTE2OiBiaW5kQ2FsbChCaW5hcnlSZWFkZXIucHJvdG90eXBlLnJlYWRJMTYpLFxuICBVMTY6IGJpbmRDYWxsKEJpbmFyeVJlYWRlci5wcm90b3R5cGUucmVhZFUxNiksXG4gIEkzMjogYmluZENhbGwoQmluYXJ5UmVhZGVyLnByb3RvdHlwZS5yZWFkSTMyKSxcbiAgVTMyOiBiaW5kQ2FsbChCaW5hcnlSZWFkZXIucHJvdG90eXBlLnJlYWRVMzIpLFxuICBJNjQ6IGJpbmRDYWxsKEJpbmFyeVJlYWRlci5wcm90b3R5cGUucmVhZEk2NCksXG4gIFU2NDogYmluZENhbGwoQmluYXJ5UmVhZGVyLnByb3RvdHlwZS5yZWFkVTY0KSxcbiAgSTEyODogYmluZENhbGwoQmluYXJ5UmVhZGVyLnByb3RvdHlwZS5yZWFkSTEyOCksXG4gIFUxMjg6IGJpbmRDYWxsKEJpbmFyeVJlYWRlci5wcm90b3R5cGUucmVhZFUxMjgpLFxuICBJMjU2OiBiaW5kQ2FsbChCaW5hcnlSZWFkZXIucHJvdG90eXBlLnJlYWRJMjU2KSxcbiAgVTI1NjogYmluZENhbGwoQmluYXJ5UmVhZGVyLnByb3RvdHlwZS5yZWFkVTI1NiksXG4gIEYzMjogYmluZENhbGwoQmluYXJ5UmVhZGVyLnByb3RvdHlwZS5yZWFkRjMyKSxcbiAgRjY0OiBiaW5kQ2FsbChCaW5hcnlSZWFkZXIucHJvdG90eXBlLnJlYWRGNjQpLFxuICBTdHJpbmc6IGJpbmRDYWxsKEJpbmFyeVJlYWRlci5wcm90b3R5cGUucmVhZFN0cmluZylcbn07XG5PYmplY3QuZnJlZXplKHByaW1pdGl2ZURlc2VyaWFsaXplcnMpO1xudmFyIGRlc2VyaWFsaXplVWludDhBcnJheSA9IGJpbmRDYWxsKEJpbmFyeVJlYWRlci5wcm90b3R5cGUucmVhZFVJbnQ4QXJyYXkpO1xudmFyIHByaW1pdGl2ZVNpemVzID0ge1xuICBCb29sOiAxLFxuICBJODogMSxcbiAgVTg6IDEsXG4gIEkxNjogMixcbiAgVTE2OiAyLFxuICBJMzI6IDQsXG4gIFUzMjogNCxcbiAgSTY0OiA4LFxuICBVNjQ6IDgsXG4gIEkxMjg6IDE2LFxuICBVMTI4OiAxNixcbiAgSTI1NjogMzIsXG4gIFUyNTY6IDMyLFxuICBGMzI6IDQsXG4gIEY2NDogOFxufTtcbnZhciBmaXhlZFNpemVQcmltaXRpdmVzID0gbmV3IFNldChPYmplY3Qua2V5cyhwcmltaXRpdmVTaXplcykpO1xudmFyIGlzRml4ZWRTaXplUHJvZHVjdCA9ICh0eSkgPT4gdHkuZWxlbWVudHMuZXZlcnkoXG4gICh7IGFsZ2VicmFpY1R5cGUgfSkgPT4gZml4ZWRTaXplUHJpbWl0aXZlcy5oYXMoYWxnZWJyYWljVHlwZS50YWcpXG4pO1xudmFyIHByb2R1Y3RTaXplID0gKHR5KSA9PiB0eS5lbGVtZW50cy5yZWR1Y2UoXG4gIChhY2MsIHsgYWxnZWJyYWljVHlwZSB9KSA9PiBhY2MgKyBwcmltaXRpdmVTaXplc1thbGdlYnJhaWNUeXBlLnRhZ10sXG4gIDBcbik7XG52YXIgcHJpbWl0aXZlSlNOYW1lID0ge1xuICBCb29sOiBcIlVpbnQ4XCIsXG4gIEk4OiBcIkludDhcIixcbiAgVTg6IFwiVWludDhcIixcbiAgSTE2OiBcIkludDE2XCIsXG4gIFUxNjogXCJVaW50MTZcIixcbiAgSTMyOiBcIkludDMyXCIsXG4gIFUzMjogXCJVaW50MzJcIixcbiAgSTY0OiBcIkJpZ0ludDY0XCIsXG4gIFU2NDogXCJCaWdVaW50NjRcIixcbiAgRjMyOiBcIkZsb2F0MzJcIixcbiAgRjY0OiBcIkZsb2F0NjRcIlxufTtcbnZhciBzcGVjaWFsUHJvZHVjdERlc2VyaWFsaXplcnMgPSB7XG4gIF9fdGltZV9kdXJhdGlvbl9taWNyb3NfXzogKHJlYWRlcikgPT4gbmV3IFRpbWVEdXJhdGlvbihyZWFkZXIucmVhZEk2NCgpKSxcbiAgX190aW1lc3RhbXBfbWljcm9zX3NpbmNlX3VuaXhfZXBvY2hfXzogKHJlYWRlcikgPT4gbmV3IFRpbWVzdGFtcChyZWFkZXIucmVhZEk2NCgpKSxcbiAgX19pZGVudGl0eV9fOiAocmVhZGVyKSA9PiBuZXcgSWRlbnRpdHkocmVhZGVyLnJlYWRVMjU2KCkpLFxuICBfX2Nvbm5lY3Rpb25faWRfXzogKHJlYWRlcikgPT4gbmV3IENvbm5lY3Rpb25JZChyZWFkZXIucmVhZFUxMjgoKSksXG4gIF9fdXVpZF9fOiAocmVhZGVyKSA9PiBuZXcgVXVpZChyZWFkZXIucmVhZFUxMjgoKSlcbn07XG5PYmplY3QuZnJlZXplKHNwZWNpYWxQcm9kdWN0RGVzZXJpYWxpemVycyk7XG52YXIgdW5pdERlc2VyaWFsaXplciA9ICgpID0+ICh7fSk7XG52YXIgZ2V0RWxlbWVudEluaXRpYWxpemVyID0gKGVsZW1lbnQpID0+IHtcbiAgbGV0IGluaXQ7XG4gIHN3aXRjaCAoZWxlbWVudC5hbGdlYnJhaWNUeXBlLnRhZykge1xuICAgIGNhc2UgXCJTdHJpbmdcIjpcbiAgICAgIGluaXQgPSBcIicnXCI7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwiQm9vbFwiOlxuICAgICAgaW5pdCA9IFwiZmFsc2VcIjtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJJOFwiOlxuICAgIGNhc2UgXCJVOFwiOlxuICAgIGNhc2UgXCJJMTZcIjpcbiAgICBjYXNlIFwiVTE2XCI6XG4gICAgY2FzZSBcIkkzMlwiOlxuICAgIGNhc2UgXCJVMzJcIjpcbiAgICAgIGluaXQgPSBcIjBcIjtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJJNjRcIjpcbiAgICBjYXNlIFwiVTY0XCI6XG4gICAgY2FzZSBcIkkxMjhcIjpcbiAgICBjYXNlIFwiVTEyOFwiOlxuICAgIGNhc2UgXCJJMjU2XCI6XG4gICAgY2FzZSBcIlUyNTZcIjpcbiAgICAgIGluaXQgPSBcIjBuXCI7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwiRjMyXCI6XG4gICAgY2FzZSBcIkY2NFwiOlxuICAgICAgaW5pdCA9IFwiMC4wXCI7XG4gICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgaW5pdCA9IFwidW5kZWZpbmVkXCI7XG4gIH1cbiAgcmV0dXJuIGAke2VsZW1lbnQubmFtZX06ICR7aW5pdH1gO1xufTtcbnZhciBQcm9kdWN0VHlwZSA9IHtcbiAgbWFrZVNlcmlhbGl6ZXIodHksIHR5cGVzcGFjZSkge1xuICAgIGxldCBzZXJpYWxpemVyID0gU0VSSUFMSVpFUlMuZ2V0KHR5KTtcbiAgICBpZiAoc2VyaWFsaXplciAhPSBudWxsKSByZXR1cm4gc2VyaWFsaXplcjtcbiAgICBpZiAoaXNGaXhlZFNpemVQcm9kdWN0KHR5KSkge1xuICAgICAgY29uc3Qgc2l6ZSA9IHByb2R1Y3RTaXplKHR5KTtcbiAgICAgIGNvbnN0IGJvZHkyID0gYFwidXNlIHN0cmljdFwiO1xud3JpdGVyLmV4cGFuZEJ1ZmZlcigke3NpemV9KTtcbmNvbnN0IHZpZXcgPSB3cml0ZXIudmlldztcbiR7dHkuZWxlbWVudHMubWFwKFxuICAgICAgICAoeyBuYW1lLCBhbGdlYnJhaWNUeXBlOiB7IHRhZyB9IH0pID0+IHRhZyBpbiBwcmltaXRpdmVKU05hbWUgPyBgdmlldy5zZXQke3ByaW1pdGl2ZUpTTmFtZVt0YWddfSh3cml0ZXIub2Zmc2V0LCB2YWx1ZS4ke25hbWV9LCAke3ByaW1pdGl2ZVNpemVzW3RhZ10gPiAxID8gXCJ0cnVlXCIgOiBcIlwifSk7XG53cml0ZXIub2Zmc2V0ICs9ICR7cHJpbWl0aXZlU2l6ZXNbdGFnXX07YCA6IGB3cml0ZXIud3JpdGUke3RhZ30odmFsdWUuJHtuYW1lfSk7YFxuICAgICAgKS5qb2luKFwiXFxuXCIpfWA7XG4gICAgICBzZXJpYWxpemVyID0gRnVuY3Rpb24oXCJ3cml0ZXJcIiwgXCJ2YWx1ZVwiLCBib2R5Mik7XG4gICAgICBTRVJJQUxJWkVSUy5zZXQodHksIHNlcmlhbGl6ZXIpO1xuICAgICAgcmV0dXJuIHNlcmlhbGl6ZXI7XG4gICAgfVxuICAgIGNvbnN0IHNlcmlhbGl6ZXJzID0ge307XG4gICAgY29uc3QgYm9keSA9ICdcInVzZSBzdHJpY3RcIjtcXG4nICsgdHkuZWxlbWVudHMubWFwKFxuICAgICAgKGVsZW1lbnQpID0+IGB0aGlzLiR7ZWxlbWVudC5uYW1lfSh3cml0ZXIsIHZhbHVlLiR7ZWxlbWVudC5uYW1lfSk7YFxuICAgICkuam9pbihcIlxcblwiKTtcbiAgICBzZXJpYWxpemVyID0gRnVuY3Rpb24oXCJ3cml0ZXJcIiwgXCJ2YWx1ZVwiLCBib2R5KS5iaW5kKFxuICAgICAgc2VyaWFsaXplcnNcbiAgICApO1xuICAgIFNFUklBTElaRVJTLnNldCh0eSwgc2VyaWFsaXplcik7XG4gICAgZm9yIChjb25zdCB7IG5hbWUsIGFsZ2VicmFpY1R5cGUgfSBvZiB0eS5lbGVtZW50cykge1xuICAgICAgc2VyaWFsaXplcnNbbmFtZV0gPSBBbGdlYnJhaWNUeXBlLm1ha2VTZXJpYWxpemVyKFxuICAgICAgICBhbGdlYnJhaWNUeXBlLFxuICAgICAgICB0eXBlc3BhY2VcbiAgICAgICk7XG4gICAgfVxuICAgIE9iamVjdC5mcmVlemUoc2VyaWFsaXplcnMpO1xuICAgIHJldHVybiBzZXJpYWxpemVyO1xuICB9LFxuICAvKiogQGRlcHJlY2F0ZWQgVXNlIGBtYWtlU2VyaWFsaXplcmAgaW5zdGVhZC4gKi9cbiAgc2VyaWFsaXplVmFsdWUod3JpdGVyLCB0eSwgdmFsdWUsIHR5cGVzcGFjZSkge1xuICAgIFByb2R1Y3RUeXBlLm1ha2VTZXJpYWxpemVyKHR5LCB0eXBlc3BhY2UpKHdyaXRlciwgdmFsdWUpO1xuICB9LFxuICBtYWtlRGVzZXJpYWxpemVyKHR5LCB0eXBlc3BhY2UpIHtcbiAgICBzd2l0Y2ggKHR5LmVsZW1lbnRzLmxlbmd0aCkge1xuICAgICAgY2FzZSAwOlxuICAgICAgICByZXR1cm4gdW5pdERlc2VyaWFsaXplcjtcbiAgICAgIGNhc2UgMToge1xuICAgICAgICBjb25zdCBmaWVsZE5hbWUgPSB0eS5lbGVtZW50c1swXS5uYW1lO1xuICAgICAgICBpZiAoaGFzT3duKHNwZWNpYWxQcm9kdWN0RGVzZXJpYWxpemVycywgZmllbGROYW1lKSlcbiAgICAgICAgICByZXR1cm4gc3BlY2lhbFByb2R1Y3REZXNlcmlhbGl6ZXJzW2ZpZWxkTmFtZV07XG4gICAgICB9XG4gICAgfVxuICAgIGxldCBkZXNlcmlhbGl6ZXIgPSBERVNFUklBTElaRVJTLmdldCh0eSk7XG4gICAgaWYgKGRlc2VyaWFsaXplciAhPSBudWxsKSByZXR1cm4gZGVzZXJpYWxpemVyO1xuICAgIGlmIChpc0ZpeGVkU2l6ZVByb2R1Y3QodHkpKSB7XG4gICAgICBjb25zdCBib2R5ID0gYFwidXNlIHN0cmljdFwiO1xuY29uc3QgcmVzdWx0ID0geyAke3R5LmVsZW1lbnRzLm1hcChnZXRFbGVtZW50SW5pdGlhbGl6ZXIpLmpvaW4oXCIsIFwiKX0gfTtcbmNvbnN0IHZpZXcgPSByZWFkZXIudmlldztcbiR7dHkuZWxlbWVudHMubWFwKFxuICAgICAgICAoeyBuYW1lLCBhbGdlYnJhaWNUeXBlOiB7IHRhZyB9IH0pID0+IHRhZyBpbiBwcmltaXRpdmVKU05hbWUgPyB0YWcgPT09IFwiQm9vbFwiID8gYHJlc3VsdC4ke25hbWV9ID0gdmlldy5nZXRVaW50OChyZWFkZXIub2Zmc2V0KSAhPT0gMDtcbnJlYWRlci5vZmZzZXQgKz0gMTtgIDogYHJlc3VsdC4ke25hbWV9ID0gdmlldy5nZXQke3ByaW1pdGl2ZUpTTmFtZVt0YWddfShyZWFkZXIub2Zmc2V0LCAke3ByaW1pdGl2ZVNpemVzW3RhZ10gPiAxID8gXCJ0cnVlXCIgOiBcIlwifSk7XG5yZWFkZXIub2Zmc2V0ICs9ICR7cHJpbWl0aXZlU2l6ZXNbdGFnXX07YCA6IGByZXN1bHQuJHtuYW1lfSA9IHJlYWRlci5yZWFkJHt0YWd9KCk7YFxuICAgICAgKS5qb2luKFwiXFxuXCIpfVxucmV0dXJuIHJlc3VsdDtgO1xuICAgICAgZGVzZXJpYWxpemVyID0gRnVuY3Rpb24oXCJyZWFkZXJcIiwgYm9keSk7XG4gICAgICBERVNFUklBTElaRVJTLnNldCh0eSwgZGVzZXJpYWxpemVyKTtcbiAgICAgIHJldHVybiBkZXNlcmlhbGl6ZXI7XG4gICAgfVxuICAgIGNvbnN0IGRlc2VyaWFsaXplcnMgPSB7fTtcbiAgICBkZXNlcmlhbGl6ZXIgPSBGdW5jdGlvbihcbiAgICAgIFwicmVhZGVyXCIsXG4gICAgICBgXCJ1c2Ugc3RyaWN0XCI7XG5jb25zdCByZXN1bHQgPSB7ICR7dHkuZWxlbWVudHMubWFwKGdldEVsZW1lbnRJbml0aWFsaXplcikuam9pbihcIiwgXCIpfSB9O1xuJHt0eS5lbGVtZW50cy5tYXAoKHsgbmFtZSB9KSA9PiBgcmVzdWx0LiR7bmFtZX0gPSB0aGlzLiR7bmFtZX0ocmVhZGVyKTtgKS5qb2luKFwiXFxuXCIpfVxucmV0dXJuIHJlc3VsdDtgXG4gICAgKS5iaW5kKGRlc2VyaWFsaXplcnMpO1xuICAgIERFU0VSSUFMSVpFUlMuc2V0KHR5LCBkZXNlcmlhbGl6ZXIpO1xuICAgIGZvciAoY29uc3QgeyBuYW1lLCBhbGdlYnJhaWNUeXBlIH0gb2YgdHkuZWxlbWVudHMpIHtcbiAgICAgIGRlc2VyaWFsaXplcnNbbmFtZV0gPSBBbGdlYnJhaWNUeXBlLm1ha2VEZXNlcmlhbGl6ZXIoXG4gICAgICAgIGFsZ2VicmFpY1R5cGUsXG4gICAgICAgIHR5cGVzcGFjZVxuICAgICAgKTtcbiAgICB9XG4gICAgT2JqZWN0LmZyZWV6ZShkZXNlcmlhbGl6ZXJzKTtcbiAgICByZXR1cm4gZGVzZXJpYWxpemVyO1xuICB9LFxuICAvKiogQGRlcHJlY2F0ZWQgVXNlIGBtYWtlRGVzZXJpYWxpemVyYCBpbnN0ZWFkLiAqL1xuICBkZXNlcmlhbGl6ZVZhbHVlKHJlYWRlciwgdHksIHR5cGVzcGFjZSkge1xuICAgIHJldHVybiBQcm9kdWN0VHlwZS5tYWtlRGVzZXJpYWxpemVyKHR5LCB0eXBlc3BhY2UpKHJlYWRlcik7XG4gIH0sXG4gIGludG9NYXBLZXkodHksIHZhbHVlKSB7XG4gICAgaWYgKHR5LmVsZW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgY29uc3QgZmllbGROYW1lID0gdHkuZWxlbWVudHNbMF0ubmFtZTtcbiAgICAgIGlmIChoYXNPd24oc3BlY2lhbFByb2R1Y3REZXNlcmlhbGl6ZXJzLCBmaWVsZE5hbWUpKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZVtmaWVsZE5hbWVdO1xuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCB3cml0ZXIgPSBuZXcgQmluYXJ5V3JpdGVyKDEwKTtcbiAgICBBbGdlYnJhaWNUeXBlLnNlcmlhbGl6ZVZhbHVlKHdyaXRlciwgQWxnZWJyYWljVHlwZS5Qcm9kdWN0KHR5KSwgdmFsdWUpO1xuICAgIHJldHVybiB3cml0ZXIudG9CYXNlNjQoKTtcbiAgfVxufTtcbnZhciBTdW1UeXBlID0ge1xuICBtYWtlU2VyaWFsaXplcih0eSwgdHlwZXNwYWNlKSB7XG4gICAgaWYgKHR5LnZhcmlhbnRzLmxlbmd0aCA9PSAyICYmIHR5LnZhcmlhbnRzWzBdLm5hbWUgPT09IFwic29tZVwiICYmIHR5LnZhcmlhbnRzWzFdLm5hbWUgPT09IFwibm9uZVwiKSB7XG4gICAgICBjb25zdCBzZXJpYWxpemUgPSBBbGdlYnJhaWNUeXBlLm1ha2VTZXJpYWxpemVyKFxuICAgICAgICB0eS52YXJpYW50c1swXS5hbGdlYnJhaWNUeXBlLFxuICAgICAgICB0eXBlc3BhY2VcbiAgICAgICk7XG4gICAgICByZXR1cm4gKHdyaXRlciwgdmFsdWUpID0+IHtcbiAgICAgICAgaWYgKHZhbHVlICE9PSBudWxsICYmIHZhbHVlICE9PSB2b2lkIDApIHtcbiAgICAgICAgICB3cml0ZXIud3JpdGVCeXRlKDApO1xuICAgICAgICAgIHNlcmlhbGl6ZSh3cml0ZXIsIHZhbHVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB3cml0ZXIud3JpdGVCeXRlKDEpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0gZWxzZSBpZiAodHkudmFyaWFudHMubGVuZ3RoID09IDIgJiYgdHkudmFyaWFudHNbMF0ubmFtZSA9PT0gXCJva1wiICYmIHR5LnZhcmlhbnRzWzFdLm5hbWUgPT09IFwiZXJyXCIpIHtcbiAgICAgIGNvbnN0IHNlcmlhbGl6ZU9rID0gQWxnZWJyYWljVHlwZS5tYWtlU2VyaWFsaXplcihcbiAgICAgICAgdHkudmFyaWFudHNbMF0uYWxnZWJyYWljVHlwZSxcbiAgICAgICAgdHlwZXNwYWNlXG4gICAgICApO1xuICAgICAgY29uc3Qgc2VyaWFsaXplRXJyID0gQWxnZWJyYWljVHlwZS5tYWtlU2VyaWFsaXplcihcbiAgICAgICAgdHkudmFyaWFudHNbMV0uYWxnZWJyYWljVHlwZSxcbiAgICAgICAgdHlwZXNwYWNlXG4gICAgICApO1xuICAgICAgcmV0dXJuICh3cml0ZXIsIHZhbHVlKSA9PiB7XG4gICAgICAgIGlmIChcIm9rXCIgaW4gdmFsdWUpIHtcbiAgICAgICAgICB3cml0ZXIud3JpdGVVOCgwKTtcbiAgICAgICAgICBzZXJpYWxpemVPayh3cml0ZXIsIHZhbHVlLm9rKTtcbiAgICAgICAgfSBlbHNlIGlmIChcImVyclwiIGluIHZhbHVlKSB7XG4gICAgICAgICAgd3JpdGVyLndyaXRlVTgoMSk7XG4gICAgICAgICAgc2VyaWFsaXplRXJyKHdyaXRlciwgdmFsdWUuZXJyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgICAgXCJjb3VsZCBub3Qgc2VyaWFsaXplIHJlc3VsdDogb2JqZWN0IGhhZCBuZWl0aGVyIGEgYG9rYCBub3IgYW4gYGVycmAgZmllbGRcIlxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBzZXJpYWxpemVyID0gU0VSSUFMSVpFUlMuZ2V0KHR5KTtcbiAgICAgIGlmIChzZXJpYWxpemVyICE9IG51bGwpIHJldHVybiBzZXJpYWxpemVyO1xuICAgICAgY29uc3Qgc2VyaWFsaXplcnMgPSB7fTtcbiAgICAgIGNvbnN0IGJvZHkgPSBgc3dpdGNoICh2YWx1ZS50YWcpIHtcbiR7dHkudmFyaWFudHMubWFwKFxuICAgICAgICAoeyBuYW1lIH0sIGkpID0+IGAgIGNhc2UgJHtKU09OLnN0cmluZ2lmeShuYW1lKX06XG4gICAgd3JpdGVyLndyaXRlQnl0ZSgke2l9KTtcbiAgICByZXR1cm4gdGhpcy4ke25hbWV9KHdyaXRlciwgdmFsdWUudmFsdWUpO2BcbiAgICAgICkuam9pbihcIlxcblwiKX1cbiAgZGVmYXVsdDpcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgXFxgQ291bGQgbm90IHNlcmlhbGl6ZSBzdW0gdHlwZTsgdW5rbm93biB0YWcgXFwke3ZhbHVlLnRhZ31cXGBcbiAgICApXG59XG5gO1xuICAgICAgc2VyaWFsaXplciA9IEZ1bmN0aW9uKFwid3JpdGVyXCIsIFwidmFsdWVcIiwgYm9keSkuYmluZChcbiAgICAgICAgc2VyaWFsaXplcnNcbiAgICAgICk7XG4gICAgICBTRVJJQUxJWkVSUy5zZXQodHksIHNlcmlhbGl6ZXIpO1xuICAgICAgZm9yIChjb25zdCB7IG5hbWUsIGFsZ2VicmFpY1R5cGUgfSBvZiB0eS52YXJpYW50cykge1xuICAgICAgICBzZXJpYWxpemVyc1tuYW1lXSA9IEFsZ2VicmFpY1R5cGUubWFrZVNlcmlhbGl6ZXIoXG4gICAgICAgICAgYWxnZWJyYWljVHlwZSxcbiAgICAgICAgICB0eXBlc3BhY2VcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIE9iamVjdC5mcmVlemUoc2VyaWFsaXplcnMpO1xuICAgICAgcmV0dXJuIHNlcmlhbGl6ZXI7XG4gICAgfVxuICB9LFxuICAvKiogQGRlcHJlY2F0ZWQgVXNlIGBtYWtlU2VyaWFsaXplcmAgaW5zdGVhZC4gKi9cbiAgc2VyaWFsaXplVmFsdWUod3JpdGVyLCB0eSwgdmFsdWUsIHR5cGVzcGFjZSkge1xuICAgIFN1bVR5cGUubWFrZVNlcmlhbGl6ZXIodHksIHR5cGVzcGFjZSkod3JpdGVyLCB2YWx1ZSk7XG4gIH0sXG4gIG1ha2VEZXNlcmlhbGl6ZXIodHksIHR5cGVzcGFjZSkge1xuICAgIGlmICh0eS52YXJpYW50cy5sZW5ndGggPT0gMiAmJiB0eS52YXJpYW50c1swXS5uYW1lID09PSBcInNvbWVcIiAmJiB0eS52YXJpYW50c1sxXS5uYW1lID09PSBcIm5vbmVcIikge1xuICAgICAgY29uc3QgZGVzZXJpYWxpemUgPSBBbGdlYnJhaWNUeXBlLm1ha2VEZXNlcmlhbGl6ZXIoXG4gICAgICAgIHR5LnZhcmlhbnRzWzBdLmFsZ2VicmFpY1R5cGUsXG4gICAgICAgIHR5cGVzcGFjZVxuICAgICAgKTtcbiAgICAgIHJldHVybiAocmVhZGVyKSA9PiB7XG4gICAgICAgIGNvbnN0IHRhZyA9IHJlYWRlci5yZWFkVTgoKTtcbiAgICAgICAgaWYgKHRhZyA9PT0gMCkge1xuICAgICAgICAgIHJldHVybiBkZXNlcmlhbGl6ZShyZWFkZXIpO1xuICAgICAgICB9IGVsc2UgaWYgKHRhZyA9PT0gMSkge1xuICAgICAgICAgIHJldHVybiB2b2lkIDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgYENhbid0IGRlc2VyaWFsaXplIGFuIG9wdGlvbiB0eXBlLCBjb3VsZG4ndCBmaW5kICR7dGFnfSB0YWdgO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0gZWxzZSBpZiAodHkudmFyaWFudHMubGVuZ3RoID09IDIgJiYgdHkudmFyaWFudHNbMF0ubmFtZSA9PT0gXCJva1wiICYmIHR5LnZhcmlhbnRzWzFdLm5hbWUgPT09IFwiZXJyXCIpIHtcbiAgICAgIGNvbnN0IGRlc2VyaWFsaXplT2sgPSBBbGdlYnJhaWNUeXBlLm1ha2VEZXNlcmlhbGl6ZXIoXG4gICAgICAgIHR5LnZhcmlhbnRzWzBdLmFsZ2VicmFpY1R5cGUsXG4gICAgICAgIHR5cGVzcGFjZVxuICAgICAgKTtcbiAgICAgIGNvbnN0IGRlc2VyaWFsaXplRXJyID0gQWxnZWJyYWljVHlwZS5tYWtlRGVzZXJpYWxpemVyKFxuICAgICAgICB0eS52YXJpYW50c1sxXS5hbGdlYnJhaWNUeXBlLFxuICAgICAgICB0eXBlc3BhY2VcbiAgICAgICk7XG4gICAgICByZXR1cm4gKHJlYWRlcikgPT4ge1xuICAgICAgICBjb25zdCB0YWcgPSByZWFkZXIucmVhZEJ5dGUoKTtcbiAgICAgICAgaWYgKHRhZyA9PT0gMCkge1xuICAgICAgICAgIHJldHVybiB7IG9rOiBkZXNlcmlhbGl6ZU9rKHJlYWRlcikgfTtcbiAgICAgICAgfSBlbHNlIGlmICh0YWcgPT09IDEpIHtcbiAgICAgICAgICByZXR1cm4geyBlcnI6IGRlc2VyaWFsaXplRXJyKHJlYWRlcikgfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBgQ2FuJ3QgZGVzZXJpYWxpemUgYSByZXN1bHQgdHlwZSwgY291bGRuJ3QgZmluZCAke3RhZ30gdGFnYDtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IGRlc2VyaWFsaXplciA9IERFU0VSSUFMSVpFUlMuZ2V0KHR5KTtcbiAgICAgIGlmIChkZXNlcmlhbGl6ZXIgIT0gbnVsbCkgcmV0dXJuIGRlc2VyaWFsaXplcjtcbiAgICAgIGNvbnN0IGRlc2VyaWFsaXplcnMgPSB7fTtcbiAgICAgIGRlc2VyaWFsaXplciA9IEZ1bmN0aW9uKFxuICAgICAgICBcInJlYWRlclwiLFxuICAgICAgICBgc3dpdGNoIChyZWFkZXIucmVhZFU4KCkpIHtcbiR7dHkudmFyaWFudHMubWFwKFxuICAgICAgICAgICh7IG5hbWUgfSwgaSkgPT4gYGNhc2UgJHtpfTogcmV0dXJuIHsgdGFnOiAke0pTT04uc3RyaW5naWZ5KG5hbWUpfSwgdmFsdWU6IHRoaXMuJHtuYW1lfShyZWFkZXIpIH07YFxuICAgICAgICApLmpvaW4oXCJcXG5cIil9IH1gXG4gICAgICApLmJpbmQoZGVzZXJpYWxpemVycyk7XG4gICAgICBERVNFUklBTElaRVJTLnNldCh0eSwgZGVzZXJpYWxpemVyKTtcbiAgICAgIGZvciAoY29uc3QgeyBuYW1lLCBhbGdlYnJhaWNUeXBlIH0gb2YgdHkudmFyaWFudHMpIHtcbiAgICAgICAgZGVzZXJpYWxpemVyc1tuYW1lXSA9IEFsZ2VicmFpY1R5cGUubWFrZURlc2VyaWFsaXplcihcbiAgICAgICAgICBhbGdlYnJhaWNUeXBlLFxuICAgICAgICAgIHR5cGVzcGFjZVxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgT2JqZWN0LmZyZWV6ZShkZXNlcmlhbGl6ZXJzKTtcbiAgICAgIHJldHVybiBkZXNlcmlhbGl6ZXI7XG4gICAgfVxuICB9LFxuICAvKiogQGRlcHJlY2F0ZWQgVXNlIGBtYWtlRGVzZXJpYWxpemVyYCBpbnN0ZWFkLiAqL1xuICBkZXNlcmlhbGl6ZVZhbHVlKHJlYWRlciwgdHksIHR5cGVzcGFjZSkge1xuICAgIHJldHVybiBTdW1UeXBlLm1ha2VEZXNlcmlhbGl6ZXIodHksIHR5cGVzcGFjZSkocmVhZGVyKTtcbiAgfVxufTtcblxuLy8gc3JjL2xpYi9vcHRpb24udHNcbnZhciBPcHRpb24gPSB7XG4gIGdldEFsZ2VicmFpY1R5cGUoaW5uZXJUeXBlKSB7XG4gICAgcmV0dXJuIEFsZ2VicmFpY1R5cGUuU3VtKHtcbiAgICAgIHZhcmlhbnRzOiBbXG4gICAgICAgIHsgbmFtZTogXCJzb21lXCIsIGFsZ2VicmFpY1R5cGU6IGlubmVyVHlwZSB9LFxuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogXCJub25lXCIsXG4gICAgICAgICAgYWxnZWJyYWljVHlwZTogQWxnZWJyYWljVHlwZS5Qcm9kdWN0KHsgZWxlbWVudHM6IFtdIH0pXG4gICAgICAgIH1cbiAgICAgIF1cbiAgICB9KTtcbiAgfVxufTtcblxuLy8gc3JjL2xpYi9yZXN1bHQudHNcbnZhciBSZXN1bHQgPSB7XG4gIGdldEFsZ2VicmFpY1R5cGUob2tUeXBlLCBlcnJUeXBlKSB7XG4gICAgcmV0dXJuIEFsZ2VicmFpY1R5cGUuU3VtKHtcbiAgICAgIHZhcmlhbnRzOiBbXG4gICAgICAgIHsgbmFtZTogXCJva1wiLCBhbGdlYnJhaWNUeXBlOiBva1R5cGUgfSxcbiAgICAgICAgeyBuYW1lOiBcImVyclwiLCBhbGdlYnJhaWNUeXBlOiBlcnJUeXBlIH1cbiAgICAgIF1cbiAgICB9KTtcbiAgfVxufTtcblxuLy8gc3JjL2xpYi9zY2hlZHVsZV9hdC50c1xudmFyIFNjaGVkdWxlQXQgPSB7XG4gIGludGVydmFsKHZhbHVlKSB7XG4gICAgcmV0dXJuIEludGVydmFsKHZhbHVlKTtcbiAgfSxcbiAgdGltZSh2YWx1ZSkge1xuICAgIHJldHVybiBUaW1lKHZhbHVlKTtcbiAgfSxcbiAgZ2V0QWxnZWJyYWljVHlwZSgpIHtcbiAgICByZXR1cm4gQWxnZWJyYWljVHlwZS5TdW0oe1xuICAgICAgdmFyaWFudHM6IFtcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6IFwiSW50ZXJ2YWxcIixcbiAgICAgICAgICBhbGdlYnJhaWNUeXBlOiBUaW1lRHVyYXRpb24uZ2V0QWxnZWJyYWljVHlwZSgpXG4gICAgICAgIH0sXG4gICAgICAgIHsgbmFtZTogXCJUaW1lXCIsIGFsZ2VicmFpY1R5cGU6IFRpbWVzdGFtcC5nZXRBbGdlYnJhaWNUeXBlKCkgfVxuICAgICAgXVxuICAgIH0pO1xuICB9LFxuICBpc1NjaGVkdWxlQXQoYWxnZWJyYWljVHlwZSkge1xuICAgIGlmIChhbGdlYnJhaWNUeXBlLnRhZyAhPT0gXCJTdW1cIikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBjb25zdCB2YXJpYW50cyA9IGFsZ2VicmFpY1R5cGUudmFsdWUudmFyaWFudHM7XG4gICAgaWYgKHZhcmlhbnRzLmxlbmd0aCAhPT0gMikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBjb25zdCBpbnRlcnZhbFZhcmlhbnQgPSB2YXJpYW50cy5maW5kKCh2KSA9PiB2Lm5hbWUgPT09IFwiSW50ZXJ2YWxcIik7XG4gICAgY29uc3QgdGltZVZhcmlhbnQgPSB2YXJpYW50cy5maW5kKCh2KSA9PiB2Lm5hbWUgPT09IFwiVGltZVwiKTtcbiAgICBpZiAoIWludGVydmFsVmFyaWFudCB8fCAhdGltZVZhcmlhbnQpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIFRpbWVEdXJhdGlvbi5pc1RpbWVEdXJhdGlvbihpbnRlcnZhbFZhcmlhbnQuYWxnZWJyYWljVHlwZSkgJiYgVGltZXN0YW1wLmlzVGltZXN0YW1wKHRpbWVWYXJpYW50LmFsZ2VicmFpY1R5cGUpO1xuICB9XG59O1xudmFyIEludGVydmFsID0gKG1pY3JvcykgPT4gKHtcbiAgdGFnOiBcIkludGVydmFsXCIsXG4gIHZhbHVlOiBuZXcgVGltZUR1cmF0aW9uKG1pY3Jvcylcbn0pO1xudmFyIFRpbWUgPSAobWljcm9zU2luY2VVbml4RXBvY2gpID0+ICh7XG4gIHRhZzogXCJUaW1lXCIsXG4gIHZhbHVlOiBuZXcgVGltZXN0YW1wKG1pY3Jvc1NpbmNlVW5peEVwb2NoKVxufSk7XG52YXIgc2NoZWR1bGVfYXRfZGVmYXVsdCA9IFNjaGVkdWxlQXQ7XG5cbi8vIHNyYy9saWIvdHlwZV91dGlsLnRzXG5mdW5jdGlvbiBzZXQoeCwgdDIpIHtcbiAgcmV0dXJuIHsgLi4ueCwgLi4udDIgfTtcbn1cblxuLy8gc3JjL2xpYi90eXBlX2J1aWxkZXJzLnRzXG52YXIgVHlwZUJ1aWxkZXIgPSBjbGFzcyB7XG4gIC8qKlxuICAgKiBUaGUgVHlwZVNjcmlwdCBwaGFudG9tIHR5cGUuIFRoaXMgaXMgbm90IHN0b3JlZCBhdCBydW50aW1lLFxuICAgKiBidXQgaXMgdmlzaWJsZSB0byB0aGUgY29tcGlsZXJcbiAgICovXG4gIHR5cGU7XG4gIC8qKlxuICAgKiBUaGUgU3BhY2V0aW1lREIgYWxnZWJyYWljIHR5cGUgKHJ1buKAkXRpbWUgdmFsdWUpLiBJbiBhZGRpdGlvbiB0byBzdG9yaW5nXG4gICAqIHRoZSBydW50aW1lIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBgQWxnZWJyYWljVHlwZWAsIGl0IGFsc28gY2FwdHVyZXNcbiAgICogdGhlIFR5cGVTY3JpcHQgdHlwZSBpbmZvcm1hdGlvbiBvZiB0aGUgYEFsZ2VicmFpY1R5cGVgLiBUaGF0IGlzIHRvIHNheVxuICAgKiB0aGUgdmFsdWUgaXMgbm90IG1lcmVseSBhbiBgQWxnZWJyYWljVHlwZWAsIGJ1dCBpcyBjb25zdHJ1Y3RlZCB0byBiZVxuICAgKiB0aGUgY29ycmVzcG9uZGluZyBjb25jcmV0ZSBgQWxnZWJyYWljVHlwZWAgZm9yIHRoZSBUeXBlU2NyaXB0IHR5cGUgYFR5cGVgLlxuICAgKlxuICAgKiBlLmcuIGBzdHJpbmdgIGNvcnJlc3BvbmRzIHRvIGBBbGdlYnJhaWNUeXBlLlN0cmluZ2BcbiAgICovXG4gIGFsZ2VicmFpY1R5cGU7XG4gIGNvbnN0cnVjdG9yKGFsZ2VicmFpY1R5cGUpIHtcbiAgICB0aGlzLmFsZ2VicmFpY1R5cGUgPSBhbGdlYnJhaWNUeXBlO1xuICB9XG4gIG9wdGlvbmFsKCkge1xuICAgIHJldHVybiBuZXcgT3B0aW9uQnVpbGRlcih0aGlzKTtcbiAgfVxuICBzZXJpYWxpemUod3JpdGVyLCB2YWx1ZSkge1xuICAgIGNvbnN0IHNlcmlhbGl6ZSA9IHRoaXMuc2VyaWFsaXplID0gQWxnZWJyYWljVHlwZS5tYWtlU2VyaWFsaXplcihcbiAgICAgIHRoaXMuYWxnZWJyYWljVHlwZVxuICAgICk7XG4gICAgc2VyaWFsaXplKHdyaXRlciwgdmFsdWUpO1xuICB9XG4gIGRlc2VyaWFsaXplKHJlYWRlcikge1xuICAgIGNvbnN0IGRlc2VyaWFsaXplID0gdGhpcy5kZXNlcmlhbGl6ZSA9IEFsZ2VicmFpY1R5cGUubWFrZURlc2VyaWFsaXplcihcbiAgICAgIHRoaXMuYWxnZWJyYWljVHlwZVxuICAgICk7XG4gICAgcmV0dXJuIGRlc2VyaWFsaXplKHJlYWRlcik7XG4gIH1cbn07XG52YXIgVThCdWlsZGVyID0gY2xhc3MgZXh0ZW5kcyBUeXBlQnVpbGRlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKEFsZ2VicmFpY1R5cGUuVTgpO1xuICB9XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgVThDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IFU4Q29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgVThDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgVThDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBVOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IFU4Q29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IG5hbWUgfSkpO1xuICB9XG59O1xudmFyIFUxNkJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoQWxnZWJyYWljVHlwZS5VMTYpO1xuICB9XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgVTE2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBVMTZDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSkpO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBVMTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgVTE2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzQXV0b0luY3JlbWVudDogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgVTE2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgVTE2Q29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IG5hbWUgfSkpO1xuICB9XG59O1xudmFyIFUzMkJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoQWxnZWJyYWljVHlwZS5VMzIpO1xuICB9XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgVTMyQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBVMzJDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSkpO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBVMzJDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgVTMyQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzQXV0b0luY3JlbWVudDogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgVTMyQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgVTMyQ29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IG5hbWUgfSkpO1xuICB9XG59O1xudmFyIFU2NEJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoQWxnZWJyYWljVHlwZS5VNjQpO1xuICB9XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgVTY0Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBVNjRDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSkpO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBVNjRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgVTY0Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzQXV0b0luY3JlbWVudDogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgVTY0Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgVTY0Q29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IG5hbWUgfSkpO1xuICB9XG59O1xudmFyIFUxMjhCdWlsZGVyID0gY2xhc3MgZXh0ZW5kcyBUeXBlQnVpbGRlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKEFsZ2VicmFpY1R5cGUuVTEyOCk7XG4gIH1cbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBVMTI4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBVMTI4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgVTEyOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGF1dG9JbmMoKSB7XG4gICAgcmV0dXJuIG5ldyBVMTI4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzQXV0b0luY3JlbWVudDogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgVTEyOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IFUxMjhDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgVTI1NkJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoQWxnZWJyYWljVHlwZS5VMjU2KTtcbiAgfVxuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IFUyNTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IFUyNTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBVMjU2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgYXV0b0luYygpIHtcbiAgICByZXR1cm4gbmV3IFUyNTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBVMjU2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgVTI1NkNvbHVtbkJ1aWxkZXIodGhpcywgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBuYW1lIH0pKTtcbiAgfVxufTtcbnZhciBJOEJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoQWxnZWJyYWljVHlwZS5JOCk7XG4gIH1cbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBJOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgSThDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSkpO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBJOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGF1dG9JbmMoKSB7XG4gICAgcmV0dXJuIG5ldyBJOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc0F1dG9JbmNyZW1lbnQ6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IEk4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgSThDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgSTE2QnVpbGRlciA9IGNsYXNzIGV4dGVuZHMgVHlwZUJ1aWxkZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihBbGdlYnJhaWNUeXBlLkkxNik7XG4gIH1cbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBJMTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IEkxNkNvbHVtbkJ1aWxkZXIodGhpcywgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KSk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IEkxNkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGF1dG9JbmMoKSB7XG4gICAgcmV0dXJuIG5ldyBJMTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBJMTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBJMTZDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgSTMyQnVpbGRlciA9IGNsYXNzIGV4dGVuZHMgVHlwZUJ1aWxkZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihBbGdlYnJhaWNUeXBlLkkzMik7XG4gIH1cbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBJMzJDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IEkzMkNvbHVtbkJ1aWxkZXIodGhpcywgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KSk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IEkzMkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGF1dG9JbmMoKSB7XG4gICAgcmV0dXJuIG5ldyBJMzJDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBJMzJDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBJMzJDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgSTY0QnVpbGRlciA9IGNsYXNzIGV4dGVuZHMgVHlwZUJ1aWxkZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihBbGdlYnJhaWNUeXBlLkk2NCk7XG4gIH1cbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBJNjRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IEk2NENvbHVtbkJ1aWxkZXIodGhpcywgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KSk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IEk2NENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGF1dG9JbmMoKSB7XG4gICAgcmV0dXJuIG5ldyBJNjRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBJNjRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBJNjRDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgSTEyOEJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoQWxnZWJyYWljVHlwZS5JMTI4KTtcbiAgfVxuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IEkxMjhDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IEkxMjhDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBJMTI4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgYXV0b0luYygpIHtcbiAgICByZXR1cm4gbmV3IEkxMjhDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBJMTI4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgSTEyOENvbHVtbkJ1aWxkZXIodGhpcywgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBuYW1lIH0pKTtcbiAgfVxufTtcbnZhciBJMjU2QnVpbGRlciA9IGNsYXNzIGV4dGVuZHMgVHlwZUJ1aWxkZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihBbGdlYnJhaWNUeXBlLkkyNTYpO1xuICB9XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgSTI1NkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgSTI1NkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IEkyNTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgSTI1NkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc0F1dG9JbmNyZW1lbnQ6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IEkyNTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBJMjU2Q29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IG5hbWUgfSkpO1xuICB9XG59O1xudmFyIEYzMkJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoQWxnZWJyYWljVHlwZS5GMzIpO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IEYzMkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IEYzMkNvbHVtbkJ1aWxkZXIodGhpcywgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBuYW1lIH0pKTtcbiAgfVxufTtcbnZhciBGNjRCdWlsZGVyID0gY2xhc3MgZXh0ZW5kcyBUeXBlQnVpbGRlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKEFsZ2VicmFpY1R5cGUuRjY0KTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBGNjRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBGNjRDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgQm9vbEJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoQWxnZWJyYWljVHlwZS5Cb29sKTtcbiAgfVxuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IEJvb2xDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IEJvb2xDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBCb29sQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgQm9vbENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IEJvb2xDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgU3RyaW5nQnVpbGRlciA9IGNsYXNzIGV4dGVuZHMgVHlwZUJ1aWxkZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihBbGdlYnJhaWNUeXBlLlN0cmluZyk7XG4gIH1cbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBTdHJpbmdDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IFN0cmluZ0NvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IFN0cmluZ0NvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IFN0cmluZ0NvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IFN0cmluZ0NvbHVtbkJ1aWxkZXIodGhpcywgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBuYW1lIH0pKTtcbiAgfVxufTtcbnZhciBBcnJheUJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgZWxlbWVudDtcbiAgY29uc3RydWN0b3IoZWxlbWVudCkge1xuICAgIHN1cGVyKEFsZ2VicmFpY1R5cGUuQXJyYXkoZWxlbWVudC5hbGdlYnJhaWNUeXBlKSk7XG4gICAgdGhpcy5lbGVtZW50ID0gZWxlbWVudDtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBBcnJheUNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IEFycmF5Q29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IG5hbWUgfSkpO1xuICB9XG59O1xudmFyIEJ5dGVBcnJheUJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoQWxnZWJyYWljVHlwZS5BcnJheShBbGdlYnJhaWNUeXBlLlU4KSk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgQnl0ZUFycmF5Q29sdW1uQnVpbGRlcihcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBCeXRlQXJyYXlDb2x1bW5CdWlsZGVyKHNldChkZWZhdWx0TWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgT3B0aW9uQnVpbGRlciA9IGNsYXNzIGV4dGVuZHMgVHlwZUJ1aWxkZXIge1xuICB2YWx1ZTtcbiAgY29uc3RydWN0b3IodmFsdWUpIHtcbiAgICBzdXBlcihPcHRpb24uZ2V0QWxnZWJyYWljVHlwZSh2YWx1ZS5hbGdlYnJhaWNUeXBlKSk7XG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IE9wdGlvbkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IE9wdGlvbkNvbHVtbkJ1aWxkZXIodGhpcywgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBuYW1lIH0pKTtcbiAgfVxufTtcbnZhciBQcm9kdWN0QnVpbGRlciA9IGNsYXNzIGV4dGVuZHMgVHlwZUJ1aWxkZXIge1xuICB0eXBlTmFtZTtcbiAgZWxlbWVudHM7XG4gIGNvbnN0cnVjdG9yKGVsZW1lbnRzLCBuYW1lKSB7XG4gICAgZnVuY3Rpb24gZWxlbWVudHNBcnJheUZyb21FbGVtZW50c09iaihvYmopIHtcbiAgICAgIHJldHVybiBPYmplY3Qua2V5cyhvYmopLm1hcCgoa2V5KSA9PiAoe1xuICAgICAgICBuYW1lOiBrZXksXG4gICAgICAgIC8vIExhemlseSByZXNvbHZlIHRoZSB1bmRlcmx5aW5nIG9iamVjdCdzIGFsZ2VicmFpY1R5cGUuXG4gICAgICAgIC8vIFRoaXMgd2lsbCBjYWxsIG9ialtrZXldLmFsZ2VicmFpY1R5cGUgb25seSB3aGVuIHNvbWVvbmVcbiAgICAgICAgLy8gYWN0dWFsbHkgcmVhZHMgdGhpcyBwcm9wZXJ0eS5cbiAgICAgICAgZ2V0IGFsZ2VicmFpY1R5cGUoKSB7XG4gICAgICAgICAgcmV0dXJuIG9ialtrZXldLmFsZ2VicmFpY1R5cGU7XG4gICAgICAgIH1cbiAgICAgIH0pKTtcbiAgICB9XG4gICAgc3VwZXIoXG4gICAgICBBbGdlYnJhaWNUeXBlLlByb2R1Y3Qoe1xuICAgICAgICBlbGVtZW50czogZWxlbWVudHNBcnJheUZyb21FbGVtZW50c09iaihlbGVtZW50cylcbiAgICAgIH0pXG4gICAgKTtcbiAgICB0aGlzLnR5cGVOYW1lID0gbmFtZTtcbiAgICB0aGlzLmVsZW1lbnRzID0gZWxlbWVudHM7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgUHJvZHVjdENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IFByb2R1Y3RDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgUmVzdWx0QnVpbGRlciA9IGNsYXNzIGV4dGVuZHMgVHlwZUJ1aWxkZXIge1xuICBvaztcbiAgZXJyO1xuICBjb25zdHJ1Y3RvcihvaywgZXJyKSB7XG4gICAgc3VwZXIoUmVzdWx0LmdldEFsZ2VicmFpY1R5cGUob2suYWxnZWJyYWljVHlwZSwgZXJyLmFsZ2VicmFpY1R5cGUpKTtcbiAgICB0aGlzLm9rID0gb2s7XG4gICAgdGhpcy5lcnIgPSBlcnI7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgUmVzdWx0Q29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSkpO1xuICB9XG59O1xudmFyIFVuaXRCdWlsZGVyID0gY2xhc3MgZXh0ZW5kcyBUeXBlQnVpbGRlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKHsgdGFnOiBcIlByb2R1Y3RcIiwgdmFsdWU6IHsgZWxlbWVudHM6IFtdIH0gfSk7XG4gIH1cbn07XG52YXIgUm93QnVpbGRlciA9IGNsYXNzIGV4dGVuZHMgVHlwZUJ1aWxkZXIge1xuICByb3c7XG4gIHR5cGVOYW1lO1xuICBjb25zdHJ1Y3Rvcihyb3csIG5hbWUpIHtcbiAgICBjb25zdCBtYXBwZWRSb3cgPSBPYmplY3QuZnJvbUVudHJpZXMoXG4gICAgICBPYmplY3QuZW50cmllcyhyb3cpLm1hcCgoW2NvbE5hbWUsIGJ1aWxkZXJdKSA9PiBbXG4gICAgICAgIGNvbE5hbWUsXG4gICAgICAgIGJ1aWxkZXIgaW5zdGFuY2VvZiBDb2x1bW5CdWlsZGVyID8gYnVpbGRlciA6IG5ldyBDb2x1bW5CdWlsZGVyKGJ1aWxkZXIsIHt9KVxuICAgICAgXSlcbiAgICApO1xuICAgIGNvbnN0IGVsZW1lbnRzID0gT2JqZWN0LmtleXMobWFwcGVkUm93KS5tYXAoKG5hbWUyKSA9PiAoe1xuICAgICAgbmFtZTogbmFtZTIsXG4gICAgICBnZXQgYWxnZWJyYWljVHlwZSgpIHtcbiAgICAgICAgcmV0dXJuIG1hcHBlZFJvd1tuYW1lMl0udHlwZUJ1aWxkZXIuYWxnZWJyYWljVHlwZTtcbiAgICAgIH1cbiAgICB9KSk7XG4gICAgc3VwZXIoQWxnZWJyYWljVHlwZS5Qcm9kdWN0KHsgZWxlbWVudHMgfSkpO1xuICAgIHRoaXMucm93ID0gbWFwcGVkUm93O1xuICAgIHRoaXMudHlwZU5hbWUgPSBuYW1lO1xuICB9XG59O1xudmFyIFN1bUJ1aWxkZXJJbXBsID0gY2xhc3MgZXh0ZW5kcyBUeXBlQnVpbGRlciB7XG4gIHZhcmlhbnRzO1xuICB0eXBlTmFtZTtcbiAgY29uc3RydWN0b3IodmFyaWFudHMsIG5hbWUpIHtcbiAgICBmdW5jdGlvbiB2YXJpYW50c0FycmF5RnJvbVZhcmlhbnRzT2JqKHZhcmlhbnRzMikge1xuICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKHZhcmlhbnRzMikubWFwKChrZXkpID0+ICh7XG4gICAgICAgIG5hbWU6IGtleSxcbiAgICAgICAgLy8gTGF6aWx5IHJlc29sdmUgdGhlIHVuZGVybHlpbmcgb2JqZWN0J3MgYWxnZWJyYWljVHlwZS5cbiAgICAgICAgLy8gVGhpcyB3aWxsIGNhbGwgb2JqW2tleV0uYWxnZWJyYWljVHlwZSBvbmx5IHdoZW4gc29tZW9uZVxuICAgICAgICAvLyBhY3R1YWxseSByZWFkcyB0aGlzIHByb3BlcnR5LlxuICAgICAgICBnZXQgYWxnZWJyYWljVHlwZSgpIHtcbiAgICAgICAgICByZXR1cm4gdmFyaWFudHMyW2tleV0uYWxnZWJyYWljVHlwZTtcbiAgICAgICAgfVxuICAgICAgfSkpO1xuICAgIH1cbiAgICBzdXBlcihcbiAgICAgIEFsZ2VicmFpY1R5cGUuU3VtKHtcbiAgICAgICAgdmFyaWFudHM6IHZhcmlhbnRzQXJyYXlGcm9tVmFyaWFudHNPYmoodmFyaWFudHMpXG4gICAgICB9KVxuICAgICk7XG4gICAgdGhpcy52YXJpYW50cyA9IHZhcmlhbnRzO1xuICAgIHRoaXMudHlwZU5hbWUgPSBuYW1lO1xuICAgIGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKHZhcmlhbnRzKSkge1xuICAgICAgY29uc3QgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodmFyaWFudHMsIGtleSk7XG4gICAgICBjb25zdCBpc0FjY2Vzc29yID0gISFkZXNjICYmICh0eXBlb2YgZGVzYy5nZXQgPT09IFwiZnVuY3Rpb25cIiB8fCB0eXBlb2YgZGVzYy5zZXQgPT09IFwiZnVuY3Rpb25cIik7XG4gICAgICBsZXQgaXNVbml0MiA9IGZhbHNlO1xuICAgICAgaWYgKCFpc0FjY2Vzc29yKSB7XG4gICAgICAgIGNvbnN0IHZhcmlhbnQgPSB2YXJpYW50c1trZXldO1xuICAgICAgICBpc1VuaXQyID0gdmFyaWFudCBpbnN0YW5jZW9mIFVuaXRCdWlsZGVyO1xuICAgICAgfVxuICAgICAgaWYgKGlzVW5pdDIpIHtcbiAgICAgICAgY29uc3QgY29uc3RhbnQgPSB0aGlzLmNyZWF0ZShrZXkpO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywga2V5LCB7XG4gICAgICAgICAgdmFsdWU6IGNvbnN0YW50LFxuICAgICAgICAgIHdyaXRhYmxlOiBmYWxzZSxcbiAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgIGNvbmZpZ3VyYWJsZTogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBmbiA9ICgodmFsdWUpID0+IHRoaXMuY3JlYXRlKGtleSwgdmFsdWUpKTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIGtleSwge1xuICAgICAgICAgIHZhbHVlOiBmbixcbiAgICAgICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICBjb25maWd1cmFibGU6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBjcmVhdGUodGFnLCB2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZSA9PT0gdm9pZCAwID8geyB0YWcgfSA6IHsgdGFnLCB2YWx1ZSB9O1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IFN1bUNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IFN1bUNvbHVtbkJ1aWxkZXIodGhpcywgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBuYW1lIH0pKTtcbiAgfVxuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IFN1bUNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IFN1bUNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG59O1xudmFyIFN1bUJ1aWxkZXIgPSBTdW1CdWlsZGVySW1wbDtcbnZhciBTaW1wbGVTdW1CdWlsZGVySW1wbCA9IGNsYXNzIGV4dGVuZHMgU3VtQnVpbGRlckltcGwge1xuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IFNpbXBsZVN1bUNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IFNpbXBsZVN1bUNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG59O1xudmFyIFNpbXBsZVN1bUJ1aWxkZXIgPSBTaW1wbGVTdW1CdWlsZGVySW1wbDtcbnZhciBTY2hlZHVsZUF0QnVpbGRlciA9IGNsYXNzIGV4dGVuZHMgVHlwZUJ1aWxkZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihzY2hlZHVsZV9hdF9kZWZhdWx0LmdldEFsZ2VicmFpY1R5cGUoKSk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgU2NoZWR1bGVBdENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IFNjaGVkdWxlQXRDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgSWRlbnRpdHlCdWlsZGVyID0gY2xhc3MgZXh0ZW5kcyBUeXBlQnVpbGRlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKElkZW50aXR5LmdldEFsZ2VicmFpY1R5cGUoKSk7XG4gIH1cbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBJZGVudGl0eUNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgSWRlbnRpdHlDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBJZGVudGl0eUNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGF1dG9JbmMoKSB7XG4gICAgcmV0dXJuIG5ldyBJZGVudGl0eUNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc0F1dG9JbmNyZW1lbnQ6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IElkZW50aXR5Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgSWRlbnRpdHlDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgQ29ubmVjdGlvbklkQnVpbGRlciA9IGNsYXNzIGV4dGVuZHMgVHlwZUJ1aWxkZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihDb25uZWN0aW9uSWQuZ2V0QWxnZWJyYWljVHlwZSgpKTtcbiAgfVxuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IENvbm5lY3Rpb25JZENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgQ29ubmVjdGlvbklkQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgQ29ubmVjdGlvbklkQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgYXV0b0luYygpIHtcbiAgICByZXR1cm4gbmV3IENvbm5lY3Rpb25JZENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc0F1dG9JbmNyZW1lbnQ6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IENvbm5lY3Rpb25JZENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IENvbm5lY3Rpb25JZENvbHVtbkJ1aWxkZXIodGhpcywgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBuYW1lIH0pKTtcbiAgfVxufTtcbnZhciBUaW1lc3RhbXBCdWlsZGVyID0gY2xhc3MgZXh0ZW5kcyBUeXBlQnVpbGRlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFRpbWVzdGFtcC5nZXRBbGdlYnJhaWNUeXBlKCkpO1xuICB9XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgVGltZXN0YW1wQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBUaW1lc3RhbXBDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBUaW1lc3RhbXBDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgVGltZXN0YW1wQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzQXV0b0luY3JlbWVudDogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgVGltZXN0YW1wQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgVGltZXN0YW1wQ29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IG5hbWUgfSkpO1xuICB9XG59O1xudmFyIFRpbWVEdXJhdGlvbkJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoVGltZUR1cmF0aW9uLmdldEFsZ2VicmFpY1R5cGUoKSk7XG4gIH1cbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBUaW1lRHVyYXRpb25Db2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IFRpbWVEdXJhdGlvbkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IFRpbWVEdXJhdGlvbkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGF1dG9JbmMoKSB7XG4gICAgcmV0dXJuIG5ldyBUaW1lRHVyYXRpb25Db2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBUaW1lRHVyYXRpb25Db2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBUaW1lRHVyYXRpb25Db2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgVXVpZEJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoVXVpZC5nZXRBbGdlYnJhaWNUeXBlKCkpO1xuICB9XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgVXVpZENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgVXVpZENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IFV1aWRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgVXVpZENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc0F1dG9JbmNyZW1lbnQ6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IFV1aWRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBVdWlkQ29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IG5hbWUgfSkpO1xuICB9XG59O1xudmFyIGRlZmF1bHRNZXRhZGF0YSA9IHt9O1xudmFyIENvbHVtbkJ1aWxkZXIgPSBjbGFzcyB7XG4gIHR5cGVCdWlsZGVyO1xuICBjb2x1bW5NZXRhZGF0YTtcbiAgY29uc3RydWN0b3IodHlwZUJ1aWxkZXIsIG1ldGFkYXRhKSB7XG4gICAgdGhpcy50eXBlQnVpbGRlciA9IHR5cGVCdWlsZGVyO1xuICAgIHRoaXMuY29sdW1uTWV0YWRhdGEgPSBtZXRhZGF0YTtcbiAgfVxuICBzZXJpYWxpemUod3JpdGVyLCB2YWx1ZSkge1xuICAgIHRoaXMudHlwZUJ1aWxkZXIuc2VyaWFsaXplKHdyaXRlciwgdmFsdWUpO1xuICB9XG4gIGRlc2VyaWFsaXplKHJlYWRlcikge1xuICAgIHJldHVybiB0aGlzLnR5cGVCdWlsZGVyLmRlc2VyaWFsaXplKHJlYWRlcik7XG4gIH1cbn07XG52YXIgVThDb2x1bW5CdWlsZGVyID0gY2xhc3MgX1U4Q29sdW1uQnVpbGRlciBleHRlbmRzIENvbHVtbkJ1aWxkZXIge1xuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IF9VOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IF9VOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBfVThDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgYXV0b0luYygpIHtcbiAgICByZXR1cm4gbmV3IF9VOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBfVThDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7XG4gICAgICAgIGRlZmF1bHRWYWx1ZTogdmFsdWVcbiAgICAgIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IF9VOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgbmFtZSB9KVxuICAgICk7XG4gIH1cbn07XG52YXIgVTE2Q29sdW1uQnVpbGRlciA9IGNsYXNzIF9VMTZDb2x1bW5CdWlsZGVyIGV4dGVuZHMgQ29sdW1uQnVpbGRlciB7XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgX1UxNkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IF9VMTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgX1UxNkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgX1UxNkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBfVTE2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwge1xuICAgICAgICBkZWZhdWx0VmFsdWU6IHZhbHVlXG4gICAgICB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBfVTE2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBuYW1lIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBVMzJDb2x1bW5CdWlsZGVyID0gY2xhc3MgX1UzMkNvbHVtbkJ1aWxkZXIgZXh0ZW5kcyBDb2x1bW5CdWlsZGVyIHtcbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBfVTMyQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgX1UzMkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBfVTMyQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGF1dG9JbmMoKSB7XG4gICAgcmV0dXJuIG5ldyBfVTMyQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc0F1dG9JbmNyZW1lbnQ6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9VMzJDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7XG4gICAgICAgIGRlZmF1bHRWYWx1ZTogdmFsdWVcbiAgICAgIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IF9VMzJDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IG5hbWUgfSlcbiAgICApO1xuICB9XG59O1xudmFyIFU2NENvbHVtbkJ1aWxkZXIgPSBjbGFzcyBfVTY0Q29sdW1uQnVpbGRlciBleHRlbmRzIENvbHVtbkJ1aWxkZXIge1xuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IF9VNjRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBfVTY0Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IF9VNjRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgYXV0b0luYygpIHtcbiAgICByZXR1cm4gbmV3IF9VNjRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzQXV0b0luY3JlbWVudDogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgX1U2NENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHtcbiAgICAgICAgZGVmYXVsdFZhbHVlOiB2YWx1ZVxuICAgICAgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgX1U2NENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgbmFtZSB9KVxuICAgICk7XG4gIH1cbn07XG52YXIgVTEyOENvbHVtbkJ1aWxkZXIgPSBjbGFzcyBfVTEyOENvbHVtbkJ1aWxkZXIgZXh0ZW5kcyBDb2x1bW5CdWlsZGVyIHtcbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBfVTEyOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IF9VMTI4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IF9VMTI4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGF1dG9JbmMoKSB7XG4gICAgcmV0dXJuIG5ldyBfVTEyOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBfVTEyOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHtcbiAgICAgICAgZGVmYXVsdFZhbHVlOiB2YWx1ZVxuICAgICAgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgX1UxMjhDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IG5hbWUgfSlcbiAgICApO1xuICB9XG59O1xudmFyIFUyNTZDb2x1bW5CdWlsZGVyID0gY2xhc3MgX1UyNTZDb2x1bW5CdWlsZGVyIGV4dGVuZHMgQ29sdW1uQnVpbGRlciB7XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgX1UyNTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBfVTI1NkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBfVTI1NkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgX1UyNTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzQXV0b0luY3JlbWVudDogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgX1UyNTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7XG4gICAgICAgIGRlZmF1bHRWYWx1ZTogdmFsdWVcbiAgICAgIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IF9VMjU2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBuYW1lIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBJOENvbHVtbkJ1aWxkZXIgPSBjbGFzcyBfSThDb2x1bW5CdWlsZGVyIGV4dGVuZHMgQ29sdW1uQnVpbGRlciB7XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgX0k4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgX0k4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IF9JOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgX0k4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc0F1dG9JbmNyZW1lbnQ6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9JOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHtcbiAgICAgICAgZGVmYXVsdFZhbHVlOiB2YWx1ZVxuICAgICAgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgX0k4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBuYW1lIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBJMTZDb2x1bW5CdWlsZGVyID0gY2xhc3MgX0kxNkNvbHVtbkJ1aWxkZXIgZXh0ZW5kcyBDb2x1bW5CdWlsZGVyIHtcbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBfSTE2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgX0kxNkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBfSTE2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGF1dG9JbmMoKSB7XG4gICAgcmV0dXJuIG5ldyBfSTE2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc0F1dG9JbmNyZW1lbnQ6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9JMTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7XG4gICAgICAgIGRlZmF1bHRWYWx1ZTogdmFsdWVcbiAgICAgIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IF9JMTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IG5hbWUgfSlcbiAgICApO1xuICB9XG59O1xudmFyIEkzMkNvbHVtbkJ1aWxkZXIgPSBjbGFzcyBfSTMyQ29sdW1uQnVpbGRlciBleHRlbmRzIENvbHVtbkJ1aWxkZXIge1xuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IF9JMzJDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBfSTMyQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IF9JMzJDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgYXV0b0luYygpIHtcbiAgICByZXR1cm4gbmV3IF9JMzJDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzQXV0b0luY3JlbWVudDogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgX0kzMkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHtcbiAgICAgICAgZGVmYXVsdFZhbHVlOiB2YWx1ZVxuICAgICAgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgX0kzMkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgbmFtZSB9KVxuICAgICk7XG4gIH1cbn07XG52YXIgSTY0Q29sdW1uQnVpbGRlciA9IGNsYXNzIF9JNjRDb2x1bW5CdWlsZGVyIGV4dGVuZHMgQ29sdW1uQnVpbGRlciB7XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgX0k2NENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IF9JNjRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgX0k2NENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgX0k2NENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBfSTY0Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwge1xuICAgICAgICBkZWZhdWx0VmFsdWU6IHZhbHVlXG4gICAgICB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBfSTY0Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBuYW1lIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBJMTI4Q29sdW1uQnVpbGRlciA9IGNsYXNzIF9JMTI4Q29sdW1uQnVpbGRlciBleHRlbmRzIENvbHVtbkJ1aWxkZXIge1xuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IF9JMTI4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgX0kxMjhDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgX0kxMjhDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgYXV0b0luYygpIHtcbiAgICByZXR1cm4gbmV3IF9JMTI4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc0F1dG9JbmNyZW1lbnQ6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9JMTI4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwge1xuICAgICAgICBkZWZhdWx0VmFsdWU6IHZhbHVlXG4gICAgICB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBfSTEyOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgbmFtZSB9KVxuICAgICk7XG4gIH1cbn07XG52YXIgSTI1NkNvbHVtbkJ1aWxkZXIgPSBjbGFzcyBfSTI1NkNvbHVtbkJ1aWxkZXIgZXh0ZW5kcyBDb2x1bW5CdWlsZGVyIHtcbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBfSTI1NkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IF9JMjU2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IF9JMjU2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGF1dG9JbmMoKSB7XG4gICAgcmV0dXJuIG5ldyBfSTI1NkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBfSTI1NkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHtcbiAgICAgICAgZGVmYXVsdFZhbHVlOiB2YWx1ZVxuICAgICAgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgX0kyNTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IG5hbWUgfSlcbiAgICApO1xuICB9XG59O1xudmFyIEYzMkNvbHVtbkJ1aWxkZXIgPSBjbGFzcyBfRjMyQ29sdW1uQnVpbGRlciBleHRlbmRzIENvbHVtbkJ1aWxkZXIge1xuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBfRjMyQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwge1xuICAgICAgICBkZWZhdWx0VmFsdWU6IHZhbHVlXG4gICAgICB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBfRjMyQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBuYW1lIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBGNjRDb2x1bW5CdWlsZGVyID0gY2xhc3MgX0Y2NENvbHVtbkJ1aWxkZXIgZXh0ZW5kcyBDb2x1bW5CdWlsZGVyIHtcbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgX0Y2NENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHtcbiAgICAgICAgZGVmYXVsdFZhbHVlOiB2YWx1ZVxuICAgICAgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgX0Y2NENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgbmFtZSB9KVxuICAgICk7XG4gIH1cbn07XG52YXIgQm9vbENvbHVtbkJ1aWxkZXIgPSBjbGFzcyBfQm9vbENvbHVtbkJ1aWxkZXIgZXh0ZW5kcyBDb2x1bW5CdWlsZGVyIHtcbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBfQm9vbENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IF9Cb29sQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IF9Cb29sQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9Cb29sQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwge1xuICAgICAgICBkZWZhdWx0VmFsdWU6IHZhbHVlXG4gICAgICB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBfQm9vbENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgbmFtZSB9KVxuICAgICk7XG4gIH1cbn07XG52YXIgU3RyaW5nQ29sdW1uQnVpbGRlciA9IGNsYXNzIF9TdHJpbmdDb2x1bW5CdWlsZGVyIGV4dGVuZHMgQ29sdW1uQnVpbGRlciB7XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgX1N0cmluZ0NvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IF9TdHJpbmdDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgX1N0cmluZ0NvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBfU3RyaW5nQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwge1xuICAgICAgICBkZWZhdWx0VmFsdWU6IHZhbHVlXG4gICAgICB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBfU3RyaW5nQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBuYW1lIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBBcnJheUNvbHVtbkJ1aWxkZXIgPSBjbGFzcyBfQXJyYXlDb2x1bW5CdWlsZGVyIGV4dGVuZHMgQ29sdW1uQnVpbGRlciB7XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9BcnJheUNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHtcbiAgICAgICAgZGVmYXVsdFZhbHVlOiB2YWx1ZVxuICAgICAgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgX0FycmF5Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBuYW1lIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBCeXRlQXJyYXlDb2x1bW5CdWlsZGVyID0gY2xhc3MgX0J5dGVBcnJheUNvbHVtbkJ1aWxkZXIgZXh0ZW5kcyBDb2x1bW5CdWlsZGVyIHtcbiAgY29uc3RydWN0b3IobWV0YWRhdGEpIHtcbiAgICBzdXBlcihuZXcgVHlwZUJ1aWxkZXIoQWxnZWJyYWljVHlwZS5BcnJheShBbGdlYnJhaWNUeXBlLlU4KSksIG1ldGFkYXRhKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBfQnl0ZUFycmF5Q29sdW1uQnVpbGRlcihcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgX0J5dGVBcnJheUNvbHVtbkJ1aWxkZXIoc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgT3B0aW9uQ29sdW1uQnVpbGRlciA9IGNsYXNzIF9PcHRpb25Db2x1bW5CdWlsZGVyIGV4dGVuZHMgQ29sdW1uQnVpbGRlciB7XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9PcHRpb25Db2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7XG4gICAgICAgIGRlZmF1bHRWYWx1ZTogdmFsdWVcbiAgICAgIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IF9PcHRpb25Db2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IG5hbWUgfSlcbiAgICApO1xuICB9XG59O1xudmFyIFJlc3VsdENvbHVtbkJ1aWxkZXIgPSBjbGFzcyBfUmVzdWx0Q29sdW1uQnVpbGRlciBleHRlbmRzIENvbHVtbkJ1aWxkZXIge1xuICBjb25zdHJ1Y3Rvcih0eXBlQnVpbGRlciwgbWV0YWRhdGEpIHtcbiAgICBzdXBlcih0eXBlQnVpbGRlciwgbWV0YWRhdGEpO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9SZXN1bHRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7XG4gICAgICAgIGRlZmF1bHRWYWx1ZTogdmFsdWVcbiAgICAgIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBQcm9kdWN0Q29sdW1uQnVpbGRlciA9IGNsYXNzIF9Qcm9kdWN0Q29sdW1uQnVpbGRlciBleHRlbmRzIENvbHVtbkJ1aWxkZXIge1xuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBfUHJvZHVjdENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBfUHJvZHVjdENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgbmFtZSB9KVxuICAgICk7XG4gIH1cbn07XG52YXIgU3VtQ29sdW1uQnVpbGRlciA9IGNsYXNzIF9TdW1Db2x1bW5CdWlsZGVyIGV4dGVuZHMgQ29sdW1uQnVpbGRlciB7XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9TdW1Db2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgX1N1bUNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgbmFtZSB9KVxuICAgICk7XG4gIH1cbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBfU3VtQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IF9TdW1Db2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbn07XG52YXIgU2ltcGxlU3VtQ29sdW1uQnVpbGRlciA9IGNsYXNzIF9TaW1wbGVTdW1Db2x1bW5CdWlsZGVyIGV4dGVuZHMgU3VtQ29sdW1uQnVpbGRlciB7XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgX1NpbXBsZVN1bUNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBfU2ltcGxlU3VtQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG59O1xudmFyIFNjaGVkdWxlQXRDb2x1bW5CdWlsZGVyID0gY2xhc3MgX1NjaGVkdWxlQXRDb2x1bW5CdWlsZGVyIGV4dGVuZHMgQ29sdW1uQnVpbGRlciB7XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9TY2hlZHVsZUF0Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IF9TY2hlZHVsZUF0Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBuYW1lIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBJZGVudGl0eUNvbHVtbkJ1aWxkZXIgPSBjbGFzcyBfSWRlbnRpdHlDb2x1bW5CdWlsZGVyIGV4dGVuZHMgQ29sdW1uQnVpbGRlciB7XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgX0lkZW50aXR5Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgX0lkZW50aXR5Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IF9JZGVudGl0eUNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBfSWRlbnRpdHlDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgX0lkZW50aXR5Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBuYW1lIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBDb25uZWN0aW9uSWRDb2x1bW5CdWlsZGVyID0gY2xhc3MgX0Nvbm5lY3Rpb25JZENvbHVtbkJ1aWxkZXIgZXh0ZW5kcyBDb2x1bW5CdWlsZGVyIHtcbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBfQ29ubmVjdGlvbklkQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgX0Nvbm5lY3Rpb25JZENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBfQ29ubmVjdGlvbklkQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9Db25uZWN0aW9uSWRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgX0Nvbm5lY3Rpb25JZENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgbmFtZSB9KVxuICAgICk7XG4gIH1cbn07XG52YXIgVGltZXN0YW1wQ29sdW1uQnVpbGRlciA9IGNsYXNzIF9UaW1lc3RhbXBDb2x1bW5CdWlsZGVyIGV4dGVuZHMgQ29sdW1uQnVpbGRlciB7XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgX1RpbWVzdGFtcENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IF9UaW1lc3RhbXBDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgX1RpbWVzdGFtcENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBfVGltZXN0YW1wQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IF9UaW1lc3RhbXBDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IG5hbWUgfSlcbiAgICApO1xuICB9XG59O1xudmFyIFRpbWVEdXJhdGlvbkNvbHVtbkJ1aWxkZXIgPSBjbGFzcyBfVGltZUR1cmF0aW9uQ29sdW1uQnVpbGRlciBleHRlbmRzIENvbHVtbkJ1aWxkZXIge1xuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IF9UaW1lRHVyYXRpb25Db2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBfVGltZUR1cmF0aW9uQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IF9UaW1lRHVyYXRpb25Db2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgX1RpbWVEdXJhdGlvbkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBfVGltZUR1cmF0aW9uQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBuYW1lIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBVdWlkQ29sdW1uQnVpbGRlciA9IGNsYXNzIF9VdWlkQ29sdW1uQnVpbGRlciBleHRlbmRzIENvbHVtbkJ1aWxkZXIge1xuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IF9VdWlkQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgX1V1aWRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgX1V1aWRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgX1V1aWRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgX1V1aWRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IG5hbWUgfSlcbiAgICApO1xuICB9XG59O1xudmFyIFJlZkJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgcmVmO1xuICAvKiogVGhlIHBoYW50b20gdHlwZSBvZiB0aGUgcG9pbnRlZSBvZiB0aGlzIHJlZi4gKi9cbiAgX19zcGFjZXRpbWVUeXBlO1xuICBjb25zdHJ1Y3RvcihyZWYpIHtcbiAgICBzdXBlcihBbGdlYnJhaWNUeXBlLlJlZihyZWYpKTtcbiAgICB0aGlzLnJlZiA9IHJlZjtcbiAgfVxufTtcbnZhciBlbnVtSW1wbCA9ICgobmFtZU9yT2JqLCBtYXliZU9iaikgPT4ge1xuICBsZXQgb2JqID0gbmFtZU9yT2JqO1xuICBsZXQgbmFtZSA9IHZvaWQgMDtcbiAgaWYgKHR5cGVvZiBuYW1lT3JPYmogPT09IFwic3RyaW5nXCIpIHtcbiAgICBpZiAoIW1heWJlT2JqKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICBcIldoZW4gcHJvdmlkaW5nIGEgbmFtZSwgeW91IG11c3QgYWxzbyBwcm92aWRlIHRoZSB2YXJpYW50cyBvYmplY3Qgb3IgYXJyYXkuXCJcbiAgICAgICk7XG4gICAgfVxuICAgIG9iaiA9IG1heWJlT2JqO1xuICAgIG5hbWUgPSBuYW1lT3JPYmo7XG4gIH1cbiAgaWYgKEFycmF5LmlzQXJyYXkob2JqKSkge1xuICAgIGNvbnN0IHNpbXBsZVZhcmlhbnRzT2JqID0ge307XG4gICAgZm9yIChjb25zdCB2YXJpYW50IG9mIG9iaikge1xuICAgICAgc2ltcGxlVmFyaWFudHNPYmpbdmFyaWFudF0gPSBuZXcgVW5pdEJ1aWxkZXIoKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBTaW1wbGVTdW1CdWlsZGVySW1wbChzaW1wbGVWYXJpYW50c09iaiwgbmFtZSk7XG4gIH1cbiAgcmV0dXJuIG5ldyBTdW1CdWlsZGVyKG9iaiwgbmFtZSk7XG59KTtcbnZhciB0ID0ge1xuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBgQm9vbGAge0BsaW5rIEFsZ2VicmFpY1R5cGV9IHRvIGJlIHVzZWQgaW4gdGFibGUgZGVmaW5pdGlvbnNcbiAgICogUmVwcmVzZW50ZWQgYXMgYGJvb2xlYW5gIGluIFR5cGVTY3JpcHQuXG4gICAqIEByZXR1cm5zIEEgbmV3IHtAbGluayBCb29sQnVpbGRlcn0gaW5zdGFuY2VcbiAgICovXG4gIGJvb2w6ICgpID0+IG5ldyBCb29sQnVpbGRlcigpLFxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBgU3RyaW5nYCB7QGxpbmsgQWxnZWJyYWljVHlwZX0gdG8gYmUgdXNlZCBpbiB0YWJsZSBkZWZpbml0aW9uc1xuICAgKiBSZXByZXNlbnRlZCBhcyBgc3RyaW5nYCBpbiBUeXBlU2NyaXB0LlxuICAgKiBAcmV0dXJucyBBIG5ldyB7QGxpbmsgU3RyaW5nQnVpbGRlcn0gaW5zdGFuY2VcbiAgICovXG4gIHN0cmluZzogKCkgPT4gbmV3IFN0cmluZ0J1aWxkZXIoKSxcbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgYEY2NGAge0BsaW5rIEFsZ2VicmFpY1R5cGV9IHRvIGJlIHVzZWQgaW4gdGFibGUgZGVmaW5pdGlvbnNcbiAgICogUmVwcmVzZW50ZWQgYXMgYG51bWJlcmAgaW4gVHlwZVNjcmlwdC5cbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIEY2NEJ1aWxkZXJ9IGluc3RhbmNlXG4gICAqL1xuICBudW1iZXI6ICgpID0+IG5ldyBGNjRCdWlsZGVyKCksXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IGBJOGAge0BsaW5rIEFsZ2VicmFpY1R5cGV9IHRvIGJlIHVzZWQgaW4gdGFibGUgZGVmaW5pdGlvbnNcbiAgICogUmVwcmVzZW50ZWQgYXMgYG51bWJlcmAgaW4gVHlwZVNjcmlwdC5cbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIEk4QnVpbGRlcn0gaW5zdGFuY2VcbiAgICovXG4gIGk4OiAoKSA9PiBuZXcgSThCdWlsZGVyKCksXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IGBVOGAge0BsaW5rIEFsZ2VicmFpY1R5cGV9IHRvIGJlIHVzZWQgaW4gdGFibGUgZGVmaW5pdGlvbnNcbiAgICogUmVwcmVzZW50ZWQgYXMgYG51bWJlcmAgaW4gVHlwZVNjcmlwdC5cbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIFU4QnVpbGRlcn0gaW5zdGFuY2VcbiAgICovXG4gIHU4OiAoKSA9PiBuZXcgVThCdWlsZGVyKCksXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IGBJMTZgIHtAbGluayBBbGdlYnJhaWNUeXBlfSB0byBiZSB1c2VkIGluIHRhYmxlIGRlZmluaXRpb25zXG4gICAqIFJlcHJlc2VudGVkIGFzIGBudW1iZXJgIGluIFR5cGVTY3JpcHQuXG4gICAqIEByZXR1cm5zIEEgbmV3IHtAbGluayBJMTZCdWlsZGVyfSBpbnN0YW5jZVxuICAgKi9cbiAgaTE2OiAoKSA9PiBuZXcgSTE2QnVpbGRlcigpLFxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBgVTE2YCB7QGxpbmsgQWxnZWJyYWljVHlwZX0gdG8gYmUgdXNlZCBpbiB0YWJsZSBkZWZpbml0aW9uc1xuICAgKiBSZXByZXNlbnRlZCBhcyBgbnVtYmVyYCBpbiBUeXBlU2NyaXB0LlxuICAgKiBAcmV0dXJucyBBIG5ldyB7QGxpbmsgVTE2QnVpbGRlcn0gaW5zdGFuY2VcbiAgICovXG4gIHUxNjogKCkgPT4gbmV3IFUxNkJ1aWxkZXIoKSxcbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgYEkzMmAge0BsaW5rIEFsZ2VicmFpY1R5cGV9IHRvIGJlIHVzZWQgaW4gdGFibGUgZGVmaW5pdGlvbnNcbiAgICogUmVwcmVzZW50ZWQgYXMgYG51bWJlcmAgaW4gVHlwZVNjcmlwdC5cbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIEkzMkJ1aWxkZXJ9IGluc3RhbmNlXG4gICAqL1xuICBpMzI6ICgpID0+IG5ldyBJMzJCdWlsZGVyKCksXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IGBVMzJgIHtAbGluayBBbGdlYnJhaWNUeXBlfSB0byBiZSB1c2VkIGluIHRhYmxlIGRlZmluaXRpb25zXG4gICAqIFJlcHJlc2VudGVkIGFzIGBudW1iZXJgIGluIFR5cGVTY3JpcHQuXG4gICAqIEByZXR1cm5zIEEgbmV3IHtAbGluayBVMzJCdWlsZGVyfSBpbnN0YW5jZVxuICAgKi9cbiAgdTMyOiAoKSA9PiBuZXcgVTMyQnVpbGRlcigpLFxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBgSTY0YCB7QGxpbmsgQWxnZWJyYWljVHlwZX0gdG8gYmUgdXNlZCBpbiB0YWJsZSBkZWZpbml0aW9uc1xuICAgKiBSZXByZXNlbnRlZCBhcyBgYmlnaW50YCBpbiBUeXBlU2NyaXB0LlxuICAgKiBAcmV0dXJucyBBIG5ldyB7QGxpbmsgSTY0QnVpbGRlcn0gaW5zdGFuY2VcbiAgICovXG4gIGk2NDogKCkgPT4gbmV3IEk2NEJ1aWxkZXIoKSxcbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgYFU2NGAge0BsaW5rIEFsZ2VicmFpY1R5cGV9IHRvIGJlIHVzZWQgaW4gdGFibGUgZGVmaW5pdGlvbnNcbiAgICogUmVwcmVzZW50ZWQgYXMgYGJpZ2ludGAgaW4gVHlwZVNjcmlwdC5cbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIFU2NEJ1aWxkZXJ9IGluc3RhbmNlXG4gICAqL1xuICB1NjQ6ICgpID0+IG5ldyBVNjRCdWlsZGVyKCksXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IGBJMTI4YCB7QGxpbmsgQWxnZWJyYWljVHlwZX0gdG8gYmUgdXNlZCBpbiB0YWJsZSBkZWZpbml0aW9uc1xuICAgKiBSZXByZXNlbnRlZCBhcyBgYmlnaW50YCBpbiBUeXBlU2NyaXB0LlxuICAgKiBAcmV0dXJucyBBIG5ldyB7QGxpbmsgSTEyOEJ1aWxkZXJ9IGluc3RhbmNlXG4gICAqL1xuICBpMTI4OiAoKSA9PiBuZXcgSTEyOEJ1aWxkZXIoKSxcbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgYFUxMjhgIHtAbGluayBBbGdlYnJhaWNUeXBlfSB0byBiZSB1c2VkIGluIHRhYmxlIGRlZmluaXRpb25zXG4gICAqIFJlcHJlc2VudGVkIGFzIGBiaWdpbnRgIGluIFR5cGVTY3JpcHQuXG4gICAqIEByZXR1cm5zIEEgbmV3IHtAbGluayBVMTI4QnVpbGRlcn0gaW5zdGFuY2VcbiAgICovXG4gIHUxMjg6ICgpID0+IG5ldyBVMTI4QnVpbGRlcigpLFxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBgSTI1NmAge0BsaW5rIEFsZ2VicmFpY1R5cGV9IHRvIGJlIHVzZWQgaW4gdGFibGUgZGVmaW5pdGlvbnNcbiAgICogUmVwcmVzZW50ZWQgYXMgYGJpZ2ludGAgaW4gVHlwZVNjcmlwdC5cbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIEkyNTZCdWlsZGVyfSBpbnN0YW5jZVxuICAgKi9cbiAgaTI1NjogKCkgPT4gbmV3IEkyNTZCdWlsZGVyKCksXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IGBVMjU2YCB7QGxpbmsgQWxnZWJyYWljVHlwZX0gdG8gYmUgdXNlZCBpbiB0YWJsZSBkZWZpbml0aW9uc1xuICAgKiBSZXByZXNlbnRlZCBhcyBgYmlnaW50YCBpbiBUeXBlU2NyaXB0LlxuICAgKiBAcmV0dXJucyBBIG5ldyB7QGxpbmsgVTI1NkJ1aWxkZXJ9IGluc3RhbmNlXG4gICAqL1xuICB1MjU2OiAoKSA9PiBuZXcgVTI1NkJ1aWxkZXIoKSxcbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgYEYzMmAge0BsaW5rIEFsZ2VicmFpY1R5cGV9IHRvIGJlIHVzZWQgaW4gdGFibGUgZGVmaW5pdGlvbnNcbiAgICogUmVwcmVzZW50ZWQgYXMgYG51bWJlcmAgaW4gVHlwZVNjcmlwdC5cbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIEYzMkJ1aWxkZXJ9IGluc3RhbmNlXG4gICAqL1xuICBmMzI6ICgpID0+IG5ldyBGMzJCdWlsZGVyKCksXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IGBGNjRgIHtAbGluayBBbGdlYnJhaWNUeXBlfSB0byBiZSB1c2VkIGluIHRhYmxlIGRlZmluaXRpb25zXG4gICAqIFJlcHJlc2VudGVkIGFzIGBudW1iZXJgIGluIFR5cGVTY3JpcHQuXG4gICAqIEByZXR1cm5zIEEgbmV3IHtAbGluayBGNjRCdWlsZGVyfSBpbnN0YW5jZVxuICAgKi9cbiAgZjY0OiAoKSA9PiBuZXcgRjY0QnVpbGRlcigpLFxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBgUHJvZHVjdGAge0BsaW5rIEFsZ2VicmFpY1R5cGV9IHRvIGJlIHVzZWQgaW4gdGFibGUgZGVmaW5pdGlvbnMuIFByb2R1Y3QgdHlwZXMgaW4gU3BhY2V0aW1lREJcbiAgICogYXJlIGVzc2VudGlhbGx5IHRoZSBzYW1lIGFzIG9iamVjdHMgaW4gSmF2YVNjcmlwdC9UeXBlU2NyaXB0LlxuICAgKiBQcm9wZXJ0aWVzIG9mIHRoZSBvYmplY3QgbXVzdCBhbHNvIGJlIHtAbGluayBUeXBlQnVpbGRlcn1zLlxuICAgKiBSZXByZXNlbnRlZCBhcyBhbiBvYmplY3Qgd2l0aCBzcGVjaWZpYyBwcm9wZXJ0aWVzIGluIFR5cGVTY3JpcHQuXG4gICAqXG4gICAqIEBwYXJhbSBuYW1lIChvcHRpb25hbCkgQSBkaXNwbGF5IG5hbWUgZm9yIHRoZSBwcm9kdWN0IHR5cGUuIElmIG9taXR0ZWQsIGFuIGFub255bW91cyBwcm9kdWN0IHR5cGUgaXMgY3JlYXRlZC5cbiAgICogQHBhcmFtIG9iaiBUaGUgb2JqZWN0IGRlZmluaW5nIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSB0eXBlLCB3aG9zZSBwcm9wZXJ0eVxuICAgKiB2YWx1ZXMgbXVzdCBiZSB7QGxpbmsgVHlwZUJ1aWxkZXJ9cy5cbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIFByb2R1Y3RCdWlsZGVyfSBpbnN0YW5jZS5cbiAgICovXG4gIG9iamVjdDogKChuYW1lT3JPYmosIG1heWJlT2JqKSA9PiB7XG4gICAgaWYgKHR5cGVvZiBuYW1lT3JPYmogPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIGlmICghbWF5YmVPYmopIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICBcIldoZW4gcHJvdmlkaW5nIGEgbmFtZSwgeW91IG11c3QgYWxzbyBwcm92aWRlIHRoZSBvYmplY3QuXCJcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgUHJvZHVjdEJ1aWxkZXIobWF5YmVPYmosIG5hbWVPck9iaik7XG4gICAgfVxuICAgIHJldHVybiBuZXcgUHJvZHVjdEJ1aWxkZXIobmFtZU9yT2JqLCB2b2lkIDApO1xuICB9KSxcbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgYFJvd2Age0BsaW5rIEFsZ2VicmFpY1R5cGV9IHRvIGJlIHVzZWQgaW4gdGFibGUgZGVmaW5pdGlvbnMuIFJvdyB0eXBlcyBpbiBTcGFjZXRpbWVEQlxuICAgKiBhcmUgc2ltaWxhciB0byBgUHJvZHVjdGAgdHlwZXMsIGJ1dCBhcmUgc3BlY2lmaWNhbGx5IHVzZWQgdG8gZGVmaW5lIHRoZSBzY2hlbWEgb2YgYSB0YWJsZSByb3cuXG4gICAqIFByb3BlcnRpZXMgb2YgdGhlIG9iamVjdCBtdXN0IGFsc28gYmUge0BsaW5rIFR5cGVCdWlsZGVyfSBvciB7QGxpbmsgQ29sdW1uQnVpbGRlcn1zLlxuICAgKlxuICAgKiBZb3UgY2FuIHJlcHJlc2VudCBhIGBSb3dgIGFzIGVpdGhlciBhIHtAbGluayBSb3dPYmp9IG9yIGFuIHtAbGluayBSb3dCdWlsZGVyfSB0eXBlIHdoZW5cbiAgICogZGVmaW5pbmcgYSB0YWJsZSBzY2hlbWEuXG4gICAqXG4gICAqIFRoZSB7QGxpbmsgUm93QnVpbGRlcn0gdHlwZSBpcyB1c2VmdWwgd2hlbiB5b3Ugd2FudCB0byBjcmVhdGUgYSB0eXBlIHdoaWNoIGNhbiBiZSB1c2VkIGFueXdoZXJlXG4gICAqIGEge0BsaW5rIFR5cGVCdWlsZGVyfSBpcyBhY2NlcHRlZCwgc3VjaCBhcyBpbiBuZXN0ZWQgb2JqZWN0cyBvciBhcnJheXMsIG9yIGFzIHRoZSBhcmd1bWVudFxuICAgKiB0byBhIHNjaGVkdWxlZCBmdW5jdGlvbi5cbiAgICpcbiAgICogQHBhcmFtIG9iaiBUaGUgb2JqZWN0IGRlZmluaW5nIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSByb3csIHdob3NlIHByb3BlcnR5XG4gICAqIHZhbHVlcyBtdXN0IGJlIHtAbGluayBUeXBlQnVpbGRlcn1zIG9yIHtAbGluayBDb2x1bW5CdWlsZGVyfXMuXG4gICAqIEByZXR1cm5zIEEgbmV3IHtAbGluayBSb3dCdWlsZGVyfSBpbnN0YW5jZVxuICAgKi9cbiAgcm93OiAoKG5hbWVPck9iaiwgbWF5YmVPYmopID0+IHtcbiAgICBjb25zdCBbb2JqLCBuYW1lXSA9IHR5cGVvZiBuYW1lT3JPYmogPT09IFwic3RyaW5nXCIgPyBbbWF5YmVPYmosIG5hbWVPck9ial0gOiBbbmFtZU9yT2JqLCB2b2lkIDBdO1xuICAgIHJldHVybiBuZXcgUm93QnVpbGRlcihvYmosIG5hbWUpO1xuICB9KSxcbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgYEFycmF5YCB7QGxpbmsgQWxnZWJyYWljVHlwZX0gdG8gYmUgdXNlZCBpbiB0YWJsZSBkZWZpbml0aW9ucy5cbiAgICogUmVwcmVzZW50ZWQgYXMgYW4gYXJyYXkgaW4gVHlwZVNjcmlwdC5cbiAgICogQHBhcmFtIGVsZW1lbnQgVGhlIGVsZW1lbnQgdHlwZSBvZiB0aGUgYXJyYXksIHdoaWNoIG11c3QgYmUgYSBgVHlwZUJ1aWxkZXJgLlxuICAgKiBAcmV0dXJucyBBIG5ldyB7QGxpbmsgQXJyYXlCdWlsZGVyfSBpbnN0YW5jZVxuICAgKi9cbiAgYXJyYXkoZSkge1xuICAgIHJldHVybiBuZXcgQXJyYXlCdWlsZGVyKGUpO1xuICB9LFxuICBlbnVtOiBlbnVtSW1wbCxcbiAgLyoqXG4gICAqIFRoaXMgaXMgYSBzcGVjaWFsIGhlbHBlciBmdW5jdGlvbiBmb3IgY29udmVuaWVudGx5IGNyZWF0aW5nIGBQcm9kdWN0YCB0eXBlIGNvbHVtbnMgd2l0aCBubyBmaWVsZHMuXG4gICAqXG4gICAqIEByZXR1cm5zIEEgbmV3IHtAbGluayBQcm9kdWN0QnVpbGRlcn0gaW5zdGFuY2Ugd2l0aCBubyBmaWVsZHMuXG4gICAqL1xuICB1bml0KCkge1xuICAgIHJldHVybiBuZXcgVW5pdEJ1aWxkZXIoKTtcbiAgfSxcbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBsYXppbHktZXZhbHVhdGVkIHtAbGluayBUeXBlQnVpbGRlcn0uIFRoaXMgaXMgdXNlZnVsIGZvciBjcmVhdGluZ1xuICAgKiByZWN1cnNpdmUgdHlwZXMsIHN1Y2ggYXMgYSB0cmVlIG9yIGxpbmtlZCBsaXN0LlxuICAgKiBAcGFyYW0gdGh1bmsgQSBmdW5jdGlvbiB0aGF0IHJldHVybnMgYSB7QGxpbmsgVHlwZUJ1aWxkZXJ9LlxuICAgKiBAcmV0dXJucyBBIHByb3h5IHtAbGluayBUeXBlQnVpbGRlcn0gdGhhdCBldmFsdWF0ZXMgdGhlIHRodW5rIG9uIGZpcnN0IGFjY2Vzcy5cbiAgICovXG4gIGxhenkodGh1bmspIHtcbiAgICBsZXQgY2FjaGVkID0gbnVsbDtcbiAgICBjb25zdCBnZXQgPSAoKSA9PiBjYWNoZWQgPz89IHRodW5rKCk7XG4gICAgY29uc3QgcHJveHkgPSBuZXcgUHJveHkoe30sIHtcbiAgICAgIGdldChfdCwgcHJvcCwgcmVjdikge1xuICAgICAgICBjb25zdCB0YXJnZXQgPSBnZXQoKTtcbiAgICAgICAgY29uc3QgdmFsID0gUmVmbGVjdC5nZXQodGFyZ2V0LCBwcm9wLCByZWN2KTtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiB2YWwgPT09IFwiZnVuY3Rpb25cIiA/IHZhbC5iaW5kKHRhcmdldCkgOiB2YWw7XG4gICAgICB9LFxuICAgICAgc2V0KF90LCBwcm9wLCB2YWx1ZSwgcmVjdikge1xuICAgICAgICByZXR1cm4gUmVmbGVjdC5zZXQoZ2V0KCksIHByb3AsIHZhbHVlLCByZWN2KTtcbiAgICAgIH0sXG4gICAgICBoYXMoX3QsIHByb3ApIHtcbiAgICAgICAgcmV0dXJuIHByb3AgaW4gZ2V0KCk7XG4gICAgICB9LFxuICAgICAgb3duS2V5cygpIHtcbiAgICAgICAgcmV0dXJuIFJlZmxlY3Qub3duS2V5cyhnZXQoKSk7XG4gICAgICB9LFxuICAgICAgZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKF90LCBwcm9wKSB7XG4gICAgICAgIHJldHVybiBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKGdldCgpLCBwcm9wKTtcbiAgICAgIH0sXG4gICAgICBnZXRQcm90b3R5cGVPZigpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5nZXRQcm90b3R5cGVPZihnZXQoKSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHByb3h5O1xuICB9LFxuICAvKipcbiAgICogVGhpcyBpcyBhIHNwZWNpYWwgaGVscGVyIGZ1bmN0aW9uIGZvciBjb252ZW5pZW50bHkgY3JlYXRpbmcge0BsaW5rIFNjaGVkdWxlQXR9IHR5cGUgY29sdW1ucy5cbiAgICogQHJldHVybnMgQSBuZXcgQ29sdW1uQnVpbGRlciBpbnN0YW5jZSB3aXRoIHRoZSB7QGxpbmsgU2NoZWR1bGVBdH0gdHlwZS5cbiAgICovXG4gIHNjaGVkdWxlQXQ6ICgpID0+IHtcbiAgICByZXR1cm4gbmV3IFNjaGVkdWxlQXRCdWlsZGVyKCk7XG4gIH0sXG4gIC8qKlxuICAgKiBUaGlzIGlzIGEgY29udmVuaWVuY2UgbWV0aG9kIGZvciBjcmVhdGluZyBhIGNvbHVtbiB3aXRoIHRoZSB7QGxpbmsgT3B0aW9ufSB0eXBlLlxuICAgKiBZb3UgY2FuIGNyZWF0ZSBhIGNvbHVtbiBvZiB0aGUgc2FtZSB0eXBlIGJ5IGNvbnN0cnVjdGluZyBhbiBlbnVtIHdpdGggYSBgc29tZWAgYW5kIGBub25lYCB2YXJpYW50LlxuICAgKiBAcGFyYW0gdmFsdWUgVGhlIHR5cGUgb2YgdGhlIHZhbHVlIGNvbnRhaW5lZCBpbiB0aGUgYHNvbWVgIHZhcmlhbnQgb2YgdGhlIGBPcHRpb25gLlxuICAgKiBAcmV0dXJucyBBIG5ldyB7QGxpbmsgT3B0aW9uQnVpbGRlcn0gaW5zdGFuY2Ugd2l0aCB0aGUge0BsaW5rIE9wdGlvbn0gdHlwZS5cbiAgICovXG4gIG9wdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgT3B0aW9uQnVpbGRlcih2YWx1ZSk7XG4gIH0sXG4gIC8qKlxuICAgKiBUaGlzIGlzIGEgY29udmVuaWVuY2UgbWV0aG9kIGZvciBjcmVhdGluZyBhIGNvbHVtbiB3aXRoIHRoZSB7QGxpbmsgUmVzdWx0fSB0eXBlLlxuICAgKiBZb3UgY2FuIGNyZWF0ZSBhIGNvbHVtbiBvZiB0aGUgc2FtZSB0eXBlIGJ5IGNvbnN0cnVjdGluZyBhbiBlbnVtIHdpdGggYW4gYG9rYCBhbmQgYGVycmAgdmFyaWFudC5cbiAgICogQHBhcmFtIG9rIFRoZSB0eXBlIG9mIHRoZSB2YWx1ZSBjb250YWluZWQgaW4gdGhlIGBva2AgdmFyaWFudCBvZiB0aGUgYFJlc3VsdGAuXG4gICAqIEBwYXJhbSBlcnIgVGhlIHR5cGUgb2YgdGhlIHZhbHVlIGNvbnRhaW5lZCBpbiB0aGUgYGVycmAgdmFyaWFudCBvZiB0aGUgYFJlc3VsdGAuXG4gICAqIEByZXR1cm5zIEEgbmV3IHtAbGluayBSZXN1bHRCdWlsZGVyfSBpbnN0YW5jZSB3aXRoIHRoZSB7QGxpbmsgUmVzdWx0fSB0eXBlLlxuICAgKi9cbiAgcmVzdWx0KG9rLCBlcnIpIHtcbiAgICByZXR1cm4gbmV3IFJlc3VsdEJ1aWxkZXIob2ssIGVycik7XG4gIH0sXG4gIC8qKlxuICAgKiBUaGlzIGlzIGEgY29udmVuaWVuY2UgbWV0aG9kIGZvciBjcmVhdGluZyBhIGNvbHVtbiB3aXRoIHRoZSB7QGxpbmsgSWRlbnRpdHl9IHR5cGUuXG4gICAqIFlvdSBjYW4gY3JlYXRlIGEgY29sdW1uIG9mIHRoZSBzYW1lIHR5cGUgYnkgY29uc3RydWN0aW5nIGFuIGBvYmplY3RgIHdpdGggYSBzaW5nbGUgYF9faWRlbnRpdHlfX2AgZWxlbWVudC5cbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIFR5cGVCdWlsZGVyfSBpbnN0YW5jZSB3aXRoIHRoZSB7QGxpbmsgSWRlbnRpdHl9IHR5cGUuXG4gICAqL1xuICBpZGVudGl0eTogKCkgPT4ge1xuICAgIHJldHVybiBuZXcgSWRlbnRpdHlCdWlsZGVyKCk7XG4gIH0sXG4gIC8qKlxuICAgKiBUaGlzIGlzIGEgY29udmVuaWVuY2UgbWV0aG9kIGZvciBjcmVhdGluZyBhIGNvbHVtbiB3aXRoIHRoZSB7QGxpbmsgQ29ubmVjdGlvbklkfSB0eXBlLlxuICAgKiBZb3UgY2FuIGNyZWF0ZSBhIGNvbHVtbiBvZiB0aGUgc2FtZSB0eXBlIGJ5IGNvbnN0cnVjdGluZyBhbiBgb2JqZWN0YCB3aXRoIGEgc2luZ2xlIGBfX2Nvbm5lY3Rpb25faWRfX2AgZWxlbWVudC5cbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIFR5cGVCdWlsZGVyfSBpbnN0YW5jZSB3aXRoIHRoZSB7QGxpbmsgQ29ubmVjdGlvbklkfSB0eXBlLlxuICAgKi9cbiAgY29ubmVjdGlvbklkOiAoKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBDb25uZWN0aW9uSWRCdWlsZGVyKCk7XG4gIH0sXG4gIC8qKlxuICAgKiBUaGlzIGlzIGEgY29udmVuaWVuY2UgbWV0aG9kIGZvciBjcmVhdGluZyBhIGNvbHVtbiB3aXRoIHRoZSB7QGxpbmsgVGltZXN0YW1wfSB0eXBlLlxuICAgKiBZb3UgY2FuIGNyZWF0ZSBhIGNvbHVtbiBvZiB0aGUgc2FtZSB0eXBlIGJ5IGNvbnN0cnVjdGluZyBhbiBgb2JqZWN0YCB3aXRoIGEgc2luZ2xlIGBfX3RpbWVzdGFtcF9taWNyb3Nfc2luY2VfdW5peF9lcG9jaF9fYCBlbGVtZW50LlxuICAgKiBAcmV0dXJucyBBIG5ldyB7QGxpbmsgVHlwZUJ1aWxkZXJ9IGluc3RhbmNlIHdpdGggdGhlIHtAbGluayBUaW1lc3RhbXB9IHR5cGUuXG4gICAqL1xuICB0aW1lc3RhbXA6ICgpID0+IHtcbiAgICByZXR1cm4gbmV3IFRpbWVzdGFtcEJ1aWxkZXIoKTtcbiAgfSxcbiAgLyoqXG4gICAqIFRoaXMgaXMgYSBjb252ZW5pZW5jZSBtZXRob2QgZm9yIGNyZWF0aW5nIGEgY29sdW1uIHdpdGggdGhlIHtAbGluayBUaW1lRHVyYXRpb259IHR5cGUuXG4gICAqIFlvdSBjYW4gY3JlYXRlIGEgY29sdW1uIG9mIHRoZSBzYW1lIHR5cGUgYnkgY29uc3RydWN0aW5nIGFuIGBvYmplY3RgIHdpdGggYSBzaW5nbGUgYF9fdGltZV9kdXJhdGlvbl9taWNyb3NfX2AgZWxlbWVudC5cbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIFR5cGVCdWlsZGVyfSBpbnN0YW5jZSB3aXRoIHRoZSB7QGxpbmsgVGltZUR1cmF0aW9ufSB0eXBlLlxuICAgKi9cbiAgdGltZUR1cmF0aW9uOiAoKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBUaW1lRHVyYXRpb25CdWlsZGVyKCk7XG4gIH0sXG4gIC8qKlxuICAgKiBUaGlzIGlzIGEgY29udmVuaWVuY2UgbWV0aG9kIGZvciBjcmVhdGluZyBhIGNvbHVtbiB3aXRoIHRoZSB7QGxpbmsgVXVpZH0gdHlwZS5cbiAgICogWW91IGNhbiBjcmVhdGUgYSBjb2x1bW4gb2YgdGhlIHNhbWUgdHlwZSBieSBjb25zdHJ1Y3RpbmcgYW4gYG9iamVjdGAgd2l0aCBhIHNpbmdsZSBgX191dWlkX19gIGVsZW1lbnQuXG4gICAqIEByZXR1cm5zIEEgbmV3IHtAbGluayBUeXBlQnVpbGRlcn0gaW5zdGFuY2Ugd2l0aCB0aGUge0BsaW5rIFV1aWR9IHR5cGUuXG4gICAqL1xuICB1dWlkOiAoKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBVdWlkQnVpbGRlcigpO1xuICB9LFxuICAvKipcbiAgICogVGhpcyBpcyBhIGNvbnZlbmllbmNlIG1ldGhvZCBmb3IgY3JlYXRpbmcgYSBjb2x1bW4gd2l0aCB0aGUgYEJ5dGVBcnJheWAgdHlwZS5cbiAgICogWW91IGNhbiBjcmVhdGUgYSBjb2x1bW4gb2YgdGhlIHNhbWUgdHlwZSBieSBjb25zdHJ1Y3RpbmcgYW4gYGFycmF5YCBvZiBgdThgLlxuICAgKiBUaGUgVHlwZVNjcmlwdCByZXByZXNlbnRhdGlvbiBpcyB7QGxpbmsgVWludDhBcnJheX0uXG4gICAqIEByZXR1cm5zIEEgbmV3IHtAbGluayBCeXRlQXJyYXlCdWlsZGVyfSBpbnN0YW5jZSB3aXRoIHRoZSBgQnl0ZUFycmF5YCB0eXBlLlxuICAgKi9cbiAgYnl0ZUFycmF5OiAoKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBCeXRlQXJyYXlCdWlsZGVyKCk7XG4gIH1cbn07XG52YXIgTUFYX0VOVl9LRVlfQllURVMgPSAyNTY7XG52YXIgTUFYX0VOVl9WQUxVRV9CWVRFUyA9IDggKiAxMDI0O1xudmFyIE1BWF9FTlZfVkFSUyA9IDI1NjtcbnZhciBlbnZpcm9ubWVudCA9IG5ldyBQcm94eShcbiAgT2JqZWN0LmZyZWV6ZShcbiAgICBPYmplY3QuYXNzaWduKC8qIEBfX1BVUkVfXyAqLyBPYmplY3QuY3JlYXRlKG51bGwpLCB7IGdldDogKGtleSkgPT4gZW52X2dldChrZXkpIH0pXG4gICksXG4gIHtcbiAgICBnZXQodGFyZ2V0LCBrZXkpIHtcbiAgICAgIGlmIChrZXkgPT09IFwiZ2V0XCIpIHJldHVybiB0YXJnZXQuZ2V0O1xuICAgICAgaWYgKHR5cGVvZiBrZXkgIT09IFwic3RyaW5nXCIpIHJldHVybiB2b2lkIDA7XG4gICAgICByZXR1cm4gZW52X2dldChrZXkpID8/IHZvaWQgMDtcbiAgICB9XG4gIH1cbik7XG5mdW5jdGlvbiBlbnZpcm9ubWVudERlY2xhcmF0aW9ucyhzY2hlbWEyKSB7XG4gIGNvbnN0IGVudHJpZXMgPSBPYmplY3QuZW50cmllcyhzY2hlbWEyKTtcbiAgaWYgKGVudHJpZXMubGVuZ3RoID4gTUFYX0VOVl9WQVJTKVxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJUb28gbWFueSBlbnZpcm9ubWVudCBkZWNsYXJhdGlvbnNcIik7XG4gIGNvbnN0IGJ5dGVzID0gbmV3IFRleHRFbmNvZGVyKCk7XG4gIHJldHVybiBlbnRyaWVzLm1hcCgoW25hbWUsIGRlZmluaXRpb25dKSA9PiB7XG4gICAgaWYgKCEvXltBLVphLXpfXVtBLVphLXowLTlfXSokLy50ZXN0KG5hbWUpIHx8IGJ5dGVzLmVuY29kZShuYW1lKS5sZW5ndGggPiBNQVhfRU5WX0tFWV9CWVRFUykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkludmFsaWQgZW52aXJvbm1lbnQgZGVjbGFyYXRpb24gbmFtZVwiKTtcbiAgICB9XG4gICAgY29uc3Qgb3B0aW9uYWwgPSBkZWZpbml0aW9uIGluc3RhbmNlb2YgT3B0aW9uQnVpbGRlcjtcbiAgICBjb25zdCBpbm5lciA9IG9wdGlvbmFsID8gZGVmaW5pdGlvbi52YWx1ZSA6IGRlZmluaXRpb247XG4gICAgbGV0IHR5O1xuICAgIGlmIChpbm5lciBpbnN0YW5jZW9mIFN0cmluZ0J1aWxkZXIpIHtcbiAgICAgIHR5ID0geyB0YWc6IFwiU3RyaW5nXCIgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdHlwZSA9IGlubmVyPy5hbGdlYnJhaWNUeXBlO1xuICAgICAgaWYgKHR5cGU/LnRhZyAhPT0gXCJTdW1cIiB8fCAhKFwidmFyaWFudHNcIiBpbiBpbm5lcikpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICBgRW52aXJvbm1lbnQgJyR7bmFtZX0nIG11c3QgYmUgYSBzdHJpbmcgb3Igc2ltcGxlIGVudW1gXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBjb25zdCB2YWx1ZXMgPSB0eXBlLnZhbHVlLnZhcmlhbnRzLm1hcCgodmFyaWFudCkgPT4ge1xuICAgICAgICBpZiAodmFyaWFudC5hbGdlYnJhaWNUeXBlLnRhZyAhPT0gXCJQcm9kdWN0XCIgfHwgdmFyaWFudC5hbGdlYnJhaWNUeXBlLnZhbHVlLmVsZW1lbnRzLmxlbmd0aCAhPT0gMCkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgICAgICBgRW52aXJvbm1lbnQgJyR7bmFtZX0nIGNhbm5vdCB1c2UgYW4gZW51bSBwYXlsb2FkYFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiB2YXJpYW50Lm5hbWUgIT09IFwic3RyaW5nXCIpXG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICAgIGBFbnZpcm9ubWVudCAnJHtuYW1lfScgZW51bSBjYXNlcyBtdXN0IGhhdmUgbmFtZXNgXG4gICAgICAgICAgKTtcbiAgICAgICAgaWYgKGJ5dGVzLmVuY29kZSh2YXJpYW50Lm5hbWUpLmxlbmd0aCA+IE1BWF9FTlZfVkFMVUVfQllURVMpXG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgRW52aXJvbm1lbnQgJyR7bmFtZX0nIGxpdGVyYWwgaXMgdG9vIGxvbmdgKTtcbiAgICAgICAgcmV0dXJuIHZhcmlhbnQubmFtZTtcbiAgICAgIH0pO1xuICAgICAgaWYgKHZhbHVlcy5sZW5ndGggPT09IDAgfHwgbmV3IFNldCh2YWx1ZXMpLnNpemUgIT09IHZhbHVlcy5sZW5ndGgpXG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgICAgYEVudmlyb25tZW50ICcke25hbWV9JyBuZWVkcyBhIG5vbmVtcHR5IGxpdGVyYWwgdW5pb25gXG4gICAgICAgICk7XG4gICAgICB0eSA9IHZhbHVlcy5sZW5ndGggPT09IDEgPyB7IHRhZzogXCJTdHJpbmdMaXRlcmFsXCIsIHZhbHVlOiB2YWx1ZXNbMF0gfSA6IHsgdGFnOiBcIlVuaW9uXCIsIHZhbHVlOiB2YWx1ZXMgfTtcbiAgICB9XG4gICAgcmV0dXJuIHsgbmFtZSwgdHksIG9wdGlvbmFsIH07XG4gIH0pO1xufVxuXG4vLyBzcmMvbGliL2F1dG9nZW4vdHlwZXMudHNcbnZhciBBbGdlYnJhaWNUeXBlMiA9IHQuZW51bShcIkFsZ2VicmFpY1R5cGVcIiwge1xuICBSZWY6IHQudTMyKCksXG4gIGdldCBTdW0oKSB7XG4gICAgcmV0dXJuIFN1bVR5cGUyO1xuICB9LFxuICBnZXQgUHJvZHVjdCgpIHtcbiAgICByZXR1cm4gUHJvZHVjdFR5cGUyO1xuICB9LFxuICBnZXQgQXJyYXkoKSB7XG4gICAgcmV0dXJuIEFsZ2VicmFpY1R5cGUyO1xuICB9LFxuICBTdHJpbmc6IHQudW5pdCgpLFxuICBCb29sOiB0LnVuaXQoKSxcbiAgSTg6IHQudW5pdCgpLFxuICBVODogdC51bml0KCksXG4gIEkxNjogdC51bml0KCksXG4gIFUxNjogdC51bml0KCksXG4gIEkzMjogdC51bml0KCksXG4gIFUzMjogdC51bml0KCksXG4gIEk2NDogdC51bml0KCksXG4gIFU2NDogdC51bml0KCksXG4gIEkxMjg6IHQudW5pdCgpLFxuICBVMTI4OiB0LnVuaXQoKSxcbiAgSTI1NjogdC51bml0KCksXG4gIFUyNTY6IHQudW5pdCgpLFxuICBGMzI6IHQudW5pdCgpLFxuICBGNjQ6IHQudW5pdCgpXG59KTtcbnZhciBDYXNlQ29udmVyc2lvblBvbGljeSA9IHQuZW51bShcIkNhc2VDb252ZXJzaW9uUG9saWN5XCIsIHtcbiAgTm9uZTogdC51bml0KCksXG4gIFNuYWtlQ2FzZTogdC51bml0KClcbn0pO1xudmFyIEVudlZhclR5cGUgPSB0LmVudW0oXCJFbnZWYXJUeXBlXCIsIHtcbiAgU3RyaW5nOiB0LnVuaXQoKSxcbiAgU3RyaW5nTGl0ZXJhbDogdC5zdHJpbmcoKSxcbiAgVW5pb246IHQuYXJyYXkodC5zdHJpbmcoKSlcbn0pO1xudmFyIEVudmlyb25tZW50RGVjbGFyYXRpb24gPSB0Lm9iamVjdChcIkVudmlyb25tZW50RGVjbGFyYXRpb25cIiwge1xuICBuYW1lOiB0LnN0cmluZygpLFxuICBnZXQgdHkoKSB7XG4gICAgcmV0dXJuIEVudlZhclR5cGU7XG4gIH0sXG4gIG9wdGlvbmFsOiB0LmJvb2woKVxufSk7XG52YXIgRXhwbGljaXROYW1lRW50cnkgPSB0LmVudW0oXCJFeHBsaWNpdE5hbWVFbnRyeVwiLCB7XG4gIGdldCBUYWJsZSgpIHtcbiAgICByZXR1cm4gTmFtZU1hcHBpbmc7XG4gIH0sXG4gIGdldCBGdW5jdGlvbigpIHtcbiAgICByZXR1cm4gTmFtZU1hcHBpbmc7XG4gIH0sXG4gIGdldCBJbmRleCgpIHtcbiAgICByZXR1cm4gTmFtZU1hcHBpbmc7XG4gIH0sXG4gIGdldCBOYW1lc3BhY2UoKSB7XG4gICAgcmV0dXJuIE5hbWVNYXBwaW5nO1xuICB9XG59KTtcbnZhciBFeHBsaWNpdE5hbWVzID0gdC5vYmplY3QoXCJFeHBsaWNpdE5hbWVzXCIsIHtcbiAgZ2V0IGVudHJpZXMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoRXhwbGljaXROYW1lRW50cnkpO1xuICB9XG59KTtcbnZhciBGdW5jdGlvblZpc2liaWxpdHkgPSB0LmVudW0oXCJGdW5jdGlvblZpc2liaWxpdHlcIiwge1xuICBQcml2YXRlOiB0LnVuaXQoKSxcbiAgQ2xpZW50Q2FsbGFibGU6IHQudW5pdCgpXG59KTtcbnZhciBIdHRwSGVhZGVyUGFpciA9IHQub2JqZWN0KFwiSHR0cEhlYWRlclBhaXJcIiwge1xuICBuYW1lOiB0LnN0cmluZygpLFxuICB2YWx1ZTogdC5ieXRlQXJyYXkoKVxufSk7XG52YXIgSHR0cEhlYWRlcnMgPSB0Lm9iamVjdChcIkh0dHBIZWFkZXJzXCIsIHtcbiAgZ2V0IGVudHJpZXMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoSHR0cEhlYWRlclBhaXIpO1xuICB9XG59KTtcbnZhciBIdHRwTWV0aG9kID0gdC5lbnVtKFwiSHR0cE1ldGhvZFwiLCB7XG4gIEdldDogdC51bml0KCksXG4gIEhlYWQ6IHQudW5pdCgpLFxuICBQb3N0OiB0LnVuaXQoKSxcbiAgUHV0OiB0LnVuaXQoKSxcbiAgRGVsZXRlOiB0LnVuaXQoKSxcbiAgQ29ubmVjdDogdC51bml0KCksXG4gIE9wdGlvbnM6IHQudW5pdCgpLFxuICBUcmFjZTogdC51bml0KCksXG4gIFBhdGNoOiB0LnVuaXQoKSxcbiAgRXh0ZW5zaW9uOiB0LnN0cmluZygpXG59KTtcbnZhciBIdHRwUmVxdWVzdCA9IHQub2JqZWN0KFwiSHR0cFJlcXVlc3RcIiwge1xuICBnZXQgbWV0aG9kKCkge1xuICAgIHJldHVybiBIdHRwTWV0aG9kO1xuICB9LFxuICBnZXQgaGVhZGVycygpIHtcbiAgICByZXR1cm4gSHR0cEhlYWRlcnM7XG4gIH0sXG4gIHRpbWVvdXQ6IHQub3B0aW9uKHQudGltZUR1cmF0aW9uKCkpLFxuICB1cmk6IHQuc3RyaW5nKCksXG4gIGdldCB2ZXJzaW9uKCkge1xuICAgIHJldHVybiBIdHRwVmVyc2lvbjtcbiAgfVxufSk7XG52YXIgSHR0cFJlc3BvbnNlID0gdC5vYmplY3QoXCJIdHRwUmVzcG9uc2VcIiwge1xuICBnZXQgaGVhZGVycygpIHtcbiAgICByZXR1cm4gSHR0cEhlYWRlcnM7XG4gIH0sXG4gIGdldCB2ZXJzaW9uKCkge1xuICAgIHJldHVybiBIdHRwVmVyc2lvbjtcbiAgfSxcbiAgY29kZTogdC51MTYoKVxufSk7XG52YXIgSHR0cFZlcnNpb24gPSB0LmVudW0oXCJIdHRwVmVyc2lvblwiLCB7XG4gIEh0dHAwOTogdC51bml0KCksXG4gIEh0dHAxMDogdC51bml0KCksXG4gIEh0dHAxMTogdC51bml0KCksXG4gIEh0dHAyOiB0LnVuaXQoKSxcbiAgSHR0cDM6IHQudW5pdCgpXG59KTtcbnZhciBJbmRleFR5cGUgPSB0LmVudW0oXCJJbmRleFR5cGVcIiwge1xuICBCVHJlZTogdC51bml0KCksXG4gIEhhc2g6IHQudW5pdCgpXG59KTtcbnZhciBMaWZlY3ljbGUgPSB0LmVudW0oXCJMaWZlY3ljbGVcIiwge1xuICBJbml0OiB0LnVuaXQoKSxcbiAgT25Db25uZWN0OiB0LnVuaXQoKSxcbiAgT25EaXNjb25uZWN0OiB0LnVuaXQoKVxufSk7XG52YXIgTWV0aG9kT3JBbnkgPSB0LmVudW0oXCJNZXRob2RPckFueVwiLCB7XG4gIEFueTogdC51bml0KCksXG4gIGdldCBNZXRob2QoKSB7XG4gICAgcmV0dXJuIEh0dHBNZXRob2Q7XG4gIH1cbn0pO1xudmFyIE1pc2NNb2R1bGVFeHBvcnQgPSB0LmVudW0oXCJNaXNjTW9kdWxlRXhwb3J0XCIsIHtcbiAgZ2V0IFR5cGVBbGlhcygpIHtcbiAgICByZXR1cm4gVHlwZUFsaWFzO1xuICB9XG59KTtcbnZhciBOYW1lTWFwcGluZyA9IHQub2JqZWN0KFwiTmFtZU1hcHBpbmdcIiwge1xuICBzb3VyY2VOYW1lOiB0LnN0cmluZygpLFxuICBjYW5vbmljYWxOYW1lOiB0LnN0cmluZygpXG59KTtcbnZhciBQcm9kdWN0VHlwZTIgPSB0Lm9iamVjdChcIlByb2R1Y3RUeXBlXCIsIHtcbiAgZ2V0IGVsZW1lbnRzKCkge1xuICAgIHJldHVybiB0LmFycmF5KFByb2R1Y3RUeXBlRWxlbWVudCk7XG4gIH1cbn0pO1xudmFyIFByb2R1Y3RUeXBlRWxlbWVudCA9IHQub2JqZWN0KFwiUHJvZHVjdFR5cGVFbGVtZW50XCIsIHtcbiAgbmFtZTogdC5vcHRpb24odC5zdHJpbmcoKSksXG4gIGdldCBhbGdlYnJhaWNUeXBlKCkge1xuICAgIHJldHVybiBBbGdlYnJhaWNUeXBlMjtcbiAgfVxufSk7XG52YXIgUmF3Q29sdW1uRGVmVjggPSB0Lm9iamVjdChcIlJhd0NvbHVtbkRlZlY4XCIsIHtcbiAgY29sTmFtZTogdC5zdHJpbmcoKSxcbiAgZ2V0IGNvbFR5cGUoKSB7XG4gICAgcmV0dXJuIEFsZ2VicmFpY1R5cGUyO1xuICB9XG59KTtcbnZhciBSYXdDb2x1bW5EZWZhdWx0VmFsdWVWMTAgPSB0Lm9iamVjdChcIlJhd0NvbHVtbkRlZmF1bHRWYWx1ZVYxMFwiLCB7XG4gIGNvbElkOiB0LnUxNigpLFxuICB2YWx1ZTogdC5ieXRlQXJyYXkoKVxufSk7XG52YXIgUmF3Q29sdW1uRGVmYXVsdFZhbHVlVjkgPSB0Lm9iamVjdChcIlJhd0NvbHVtbkRlZmF1bHRWYWx1ZVY5XCIsIHtcbiAgdGFibGU6IHQuc3RyaW5nKCksXG4gIGNvbElkOiB0LnUxNigpLFxuICB2YWx1ZTogdC5ieXRlQXJyYXkoKVxufSk7XG52YXIgUmF3Q29uc3RyYWludERhdGFWOSA9IHQuZW51bShcIlJhd0NvbnN0cmFpbnREYXRhVjlcIiwge1xuICBnZXQgVW5pcXVlKCkge1xuICAgIHJldHVybiBSYXdVbmlxdWVDb25zdHJhaW50RGF0YVY5O1xuICB9XG59KTtcbnZhciBSYXdDb25zdHJhaW50RGVmVjEwID0gdC5vYmplY3QoXCJSYXdDb25zdHJhaW50RGVmVjEwXCIsIHtcbiAgc291cmNlTmFtZTogdC5vcHRpb24odC5zdHJpbmcoKSksXG4gIGdldCBkYXRhKCkge1xuICAgIHJldHVybiBSYXdDb25zdHJhaW50RGF0YVY5O1xuICB9XG59KTtcbnZhciBSYXdDb25zdHJhaW50RGVmVjggPSB0Lm9iamVjdChcIlJhd0NvbnN0cmFpbnREZWZWOFwiLCB7XG4gIGNvbnN0cmFpbnROYW1lOiB0LnN0cmluZygpLFxuICBjb25zdHJhaW50czogdC51OCgpLFxuICBjb2x1bW5zOiB0LmFycmF5KHQudTE2KCkpXG59KTtcbnZhciBSYXdDb25zdHJhaW50RGVmVjkgPSB0Lm9iamVjdChcIlJhd0NvbnN0cmFpbnREZWZWOVwiLCB7XG4gIG5hbWU6IHQub3B0aW9uKHQuc3RyaW5nKCkpLFxuICBnZXQgZGF0YSgpIHtcbiAgICByZXR1cm4gUmF3Q29uc3RyYWludERhdGFWOTtcbiAgfVxufSk7XG52YXIgUmF3SHR0cEhhbmRsZXJEZWZWMTAgPSB0Lm9iamVjdChcIlJhd0h0dHBIYW5kbGVyRGVmVjEwXCIsIHtcbiAgc291cmNlTmFtZTogdC5zdHJpbmcoKVxufSk7XG52YXIgUmF3SHR0cFJvdXRlRGVmVjEwID0gdC5vYmplY3QoXCJSYXdIdHRwUm91dGVEZWZWMTBcIiwge1xuICBoYW5kbGVyRnVuY3Rpb246IHQuc3RyaW5nKCksXG4gIGdldCBtZXRob2QoKSB7XG4gICAgcmV0dXJuIE1ldGhvZE9yQW55O1xuICB9LFxuICBwYXRoOiB0LnN0cmluZygpXG59KTtcbnZhciBSYXdJbmRleEFsZ29yaXRobSA9IHQuZW51bShcIlJhd0luZGV4QWxnb3JpdGhtXCIsIHtcbiAgQlRyZWU6IHQuYXJyYXkodC51MTYoKSksXG4gIEhhc2g6IHQuYXJyYXkodC51MTYoKSksXG4gIERpcmVjdDogdC51MTYoKVxufSk7XG52YXIgUmF3SW5kZXhEZWZWMTAgPSB0Lm9iamVjdChcIlJhd0luZGV4RGVmVjEwXCIsIHtcbiAgc291cmNlTmFtZTogdC5vcHRpb24odC5zdHJpbmcoKSksXG4gIGFjY2Vzc29yTmFtZTogdC5vcHRpb24odC5zdHJpbmcoKSksXG4gIGdldCBhbGdvcml0aG0oKSB7XG4gICAgcmV0dXJuIFJhd0luZGV4QWxnb3JpdGhtO1xuICB9XG59KTtcbnZhciBSYXdJbmRleERlZlY4ID0gdC5vYmplY3QoXCJSYXdJbmRleERlZlY4XCIsIHtcbiAgaW5kZXhOYW1lOiB0LnN0cmluZygpLFxuICBpc1VuaXF1ZTogdC5ib29sKCksXG4gIGdldCBpbmRleFR5cGUoKSB7XG4gICAgcmV0dXJuIEluZGV4VHlwZTtcbiAgfSxcbiAgY29sdW1uczogdC5hcnJheSh0LnUxNigpKVxufSk7XG52YXIgUmF3SW5kZXhEZWZWOSA9IHQub2JqZWN0KFwiUmF3SW5kZXhEZWZWOVwiLCB7XG4gIG5hbWU6IHQub3B0aW9uKHQuc3RyaW5nKCkpLFxuICBhY2Nlc3Nvck5hbWU6IHQub3B0aW9uKHQuc3RyaW5nKCkpLFxuICBnZXQgYWxnb3JpdGhtKCkge1xuICAgIHJldHVybiBSYXdJbmRleEFsZ29yaXRobTtcbiAgfVxufSk7XG52YXIgUmF3TGlmZUN5Y2xlUmVkdWNlckRlZlYxMCA9IHQub2JqZWN0KFxuICBcIlJhd0xpZmVDeWNsZVJlZHVjZXJEZWZWMTBcIixcbiAge1xuICAgIGdldCBsaWZlY3ljbGVTcGVjKCkge1xuICAgICAgcmV0dXJuIExpZmVjeWNsZTtcbiAgICB9LFxuICAgIGZ1bmN0aW9uTmFtZTogdC5zdHJpbmcoKVxuICB9XG4pO1xudmFyIFJhd01pc2NNb2R1bGVFeHBvcnRWOSA9IHQuZW51bShcIlJhd01pc2NNb2R1bGVFeHBvcnRWOVwiLCB7XG4gIGdldCBDb2x1bW5EZWZhdWx0VmFsdWUoKSB7XG4gICAgcmV0dXJuIFJhd0NvbHVtbkRlZmF1bHRWYWx1ZVY5O1xuICB9LFxuICBnZXQgUHJvY2VkdXJlKCkge1xuICAgIHJldHVybiBSYXdQcm9jZWR1cmVEZWZWOTtcbiAgfSxcbiAgZ2V0IFZpZXcoKSB7XG4gICAgcmV0dXJuIFJhd1ZpZXdEZWZWOTtcbiAgfVxufSk7XG52YXIgUmF3TW9kdWxlRGVmID0gdC5lbnVtKFwiUmF3TW9kdWxlRGVmXCIsIHtcbiAgZ2V0IFY4QmFja0NvbXBhdCgpIHtcbiAgICByZXR1cm4gUmF3TW9kdWxlRGVmVjg7XG4gIH0sXG4gIGdldCBWOSgpIHtcbiAgICByZXR1cm4gUmF3TW9kdWxlRGVmVjk7XG4gIH0sXG4gIGdldCBWMTAoKSB7XG4gICAgcmV0dXJuIFJhd01vZHVsZURlZlYxMDtcbiAgfVxufSk7XG52YXIgUmF3TW9kdWxlRGVmVjEwID0gdC5vYmplY3QoXCJSYXdNb2R1bGVEZWZWMTBcIiwge1xuICBnZXQgc2VjdGlvbnMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoUmF3TW9kdWxlRGVmVjEwU2VjdGlvbik7XG4gIH1cbn0pO1xudmFyIFJhd01vZHVsZURlZlYxMFNlY3Rpb24gPSB0LmVudW0oXCJSYXdNb2R1bGVEZWZWMTBTZWN0aW9uXCIsIHtcbiAgZ2V0IFR5cGVzcGFjZSgpIHtcbiAgICByZXR1cm4gVHlwZXNwYWNlO1xuICB9LFxuICBnZXQgVHlwZXMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoUmF3VHlwZURlZlYxMCk7XG4gIH0sXG4gIGdldCBUYWJsZXMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoUmF3VGFibGVEZWZWMTApO1xuICB9LFxuICBnZXQgUmVkdWNlcnMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoUmF3UmVkdWNlckRlZlYxMCk7XG4gIH0sXG4gIGdldCBQcm9jZWR1cmVzKCkge1xuICAgIHJldHVybiB0LmFycmF5KFJhd1Byb2NlZHVyZURlZlYxMCk7XG4gIH0sXG4gIGdldCBWaWV3cygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdWaWV3RGVmVjEwKTtcbiAgfSxcbiAgZ2V0IFNjaGVkdWxlcygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdTY2hlZHVsZURlZlYxMCk7XG4gIH0sXG4gIGdldCBMaWZlQ3ljbGVSZWR1Y2VycygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdMaWZlQ3ljbGVSZWR1Y2VyRGVmVjEwKTtcbiAgfSxcbiAgZ2V0IFJvd0xldmVsU2VjdXJpdHkoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoUmF3Um93TGV2ZWxTZWN1cml0eURlZlY5KTtcbiAgfSxcbiAgZ2V0IENhc2VDb252ZXJzaW9uUG9saWN5KCkge1xuICAgIHJldHVybiBDYXNlQ29udmVyc2lvblBvbGljeTtcbiAgfSxcbiAgZ2V0IEV4cGxpY2l0TmFtZXMoKSB7XG4gICAgcmV0dXJuIEV4cGxpY2l0TmFtZXM7XG4gIH0sXG4gIGdldCBIdHRwSGFuZGxlcnMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoUmF3SHR0cEhhbmRsZXJEZWZWMTApO1xuICB9LFxuICBnZXQgSHR0cFJvdXRlcygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdIdHRwUm91dGVEZWZWMTApO1xuICB9LFxuICBnZXQgVmlld1ByaW1hcnlLZXlzKCkge1xuICAgIHJldHVybiB0LmFycmF5KFJhd1ZpZXdQcmltYXJ5S2V5RGVmVjEwKTtcbiAgfSxcbiAgZ2V0IFN1Ym1vZHVsZXMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoUmF3U3VibW9kdWxlVjEwKTtcbiAgfSxcbiAgZ2V0IEVudmlyb25tZW50KCkge1xuICAgIHJldHVybiB0LmFycmF5KEVudmlyb25tZW50RGVjbGFyYXRpb24pO1xuICB9XG59KTtcbnZhciBSYXdNb2R1bGVEZWZWOCA9IHQub2JqZWN0KFwiUmF3TW9kdWxlRGVmVjhcIiwge1xuICBnZXQgdHlwZXNwYWNlKCkge1xuICAgIHJldHVybiBUeXBlc3BhY2U7XG4gIH0sXG4gIGdldCB0YWJsZXMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoVGFibGVEZXNjKTtcbiAgfSxcbiAgZ2V0IHJlZHVjZXJzKCkge1xuICAgIHJldHVybiB0LmFycmF5KFJlZHVjZXJEZWYpO1xuICB9LFxuICBnZXQgbWlzY0V4cG9ydHMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoTWlzY01vZHVsZUV4cG9ydCk7XG4gIH1cbn0pO1xudmFyIFJhd01vZHVsZURlZlY5ID0gdC5vYmplY3QoXCJSYXdNb2R1bGVEZWZWOVwiLCB7XG4gIGdldCB0eXBlc3BhY2UoKSB7XG4gICAgcmV0dXJuIFR5cGVzcGFjZTtcbiAgfSxcbiAgZ2V0IHRhYmxlcygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdUYWJsZURlZlY5KTtcbiAgfSxcbiAgZ2V0IHJlZHVjZXJzKCkge1xuICAgIHJldHVybiB0LmFycmF5KFJhd1JlZHVjZXJEZWZWOSk7XG4gIH0sXG4gIGdldCB0eXBlcygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdUeXBlRGVmVjkpO1xuICB9LFxuICBnZXQgbWlzY0V4cG9ydHMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoUmF3TWlzY01vZHVsZUV4cG9ydFY5KTtcbiAgfSxcbiAgZ2V0IHJvd0xldmVsU2VjdXJpdHkoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoUmF3Um93TGV2ZWxTZWN1cml0eURlZlY5KTtcbiAgfVxufSk7XG52YXIgUmF3UHJvY2VkdXJlRGVmVjEwID0gdC5vYmplY3QoXCJSYXdQcm9jZWR1cmVEZWZWMTBcIiwge1xuICBzb3VyY2VOYW1lOiB0LnN0cmluZygpLFxuICBnZXQgcGFyYW1zKCkge1xuICAgIHJldHVybiBQcm9kdWN0VHlwZTI7XG4gIH0sXG4gIGdldCByZXR1cm5UeXBlKCkge1xuICAgIHJldHVybiBBbGdlYnJhaWNUeXBlMjtcbiAgfSxcbiAgZ2V0IHZpc2liaWxpdHkoKSB7XG4gICAgcmV0dXJuIEZ1bmN0aW9uVmlzaWJpbGl0eTtcbiAgfVxufSk7XG52YXIgUmF3UHJvY2VkdXJlRGVmVjkgPSB0Lm9iamVjdChcIlJhd1Byb2NlZHVyZURlZlY5XCIsIHtcbiAgbmFtZTogdC5zdHJpbmcoKSxcbiAgZ2V0IHBhcmFtcygpIHtcbiAgICByZXR1cm4gUHJvZHVjdFR5cGUyO1xuICB9LFxuICBnZXQgcmV0dXJuVHlwZSgpIHtcbiAgICByZXR1cm4gQWxnZWJyYWljVHlwZTI7XG4gIH1cbn0pO1xudmFyIFJhd1JlZHVjZXJEZWZWMTAgPSB0Lm9iamVjdChcIlJhd1JlZHVjZXJEZWZWMTBcIiwge1xuICBzb3VyY2VOYW1lOiB0LnN0cmluZygpLFxuICBnZXQgcGFyYW1zKCkge1xuICAgIHJldHVybiBQcm9kdWN0VHlwZTI7XG4gIH0sXG4gIGdldCB2aXNpYmlsaXR5KCkge1xuICAgIHJldHVybiBGdW5jdGlvblZpc2liaWxpdHk7XG4gIH0sXG4gIGdldCBva1JldHVyblR5cGUoKSB7XG4gICAgcmV0dXJuIEFsZ2VicmFpY1R5cGUyO1xuICB9LFxuICBnZXQgZXJyUmV0dXJuVHlwZSgpIHtcbiAgICByZXR1cm4gQWxnZWJyYWljVHlwZTI7XG4gIH1cbn0pO1xudmFyIFJhd1JlZHVjZXJEZWZWOSA9IHQub2JqZWN0KFwiUmF3UmVkdWNlckRlZlY5XCIsIHtcbiAgbmFtZTogdC5zdHJpbmcoKSxcbiAgZ2V0IHBhcmFtcygpIHtcbiAgICByZXR1cm4gUHJvZHVjdFR5cGUyO1xuICB9LFxuICBnZXQgbGlmZWN5Y2xlKCkge1xuICAgIHJldHVybiB0Lm9wdGlvbihMaWZlY3ljbGUpO1xuICB9XG59KTtcbnZhciBSYXdSb3dMZXZlbFNlY3VyaXR5RGVmVjkgPSB0Lm9iamVjdChcIlJhd1Jvd0xldmVsU2VjdXJpdHlEZWZWOVwiLCB7XG4gIHNxbDogdC5zdHJpbmcoKVxufSk7XG52YXIgUmF3U2NoZWR1bGVEZWZWMTAgPSB0Lm9iamVjdChcIlJhd1NjaGVkdWxlRGVmVjEwXCIsIHtcbiAgc291cmNlTmFtZTogdC5vcHRpb24odC5zdHJpbmcoKSksXG4gIHRhYmxlTmFtZTogdC5zdHJpbmcoKSxcbiAgc2NoZWR1bGVBdENvbDogdC51MTYoKSxcbiAgZnVuY3Rpb25OYW1lOiB0LnN0cmluZygpXG59KTtcbnZhciBSYXdTY2hlZHVsZURlZlY5ID0gdC5vYmplY3QoXCJSYXdTY2hlZHVsZURlZlY5XCIsIHtcbiAgbmFtZTogdC5vcHRpb24odC5zdHJpbmcoKSksXG4gIHJlZHVjZXJOYW1lOiB0LnN0cmluZygpLFxuICBzY2hlZHVsZWRBdENvbHVtbjogdC51MTYoKVxufSk7XG52YXIgUmF3U2NvcGVkVHlwZU5hbWVWMTAgPSB0Lm9iamVjdChcIlJhd1Njb3BlZFR5cGVOYW1lVjEwXCIsIHtcbiAgc2NvcGU6IHQuYXJyYXkodC5zdHJpbmcoKSksXG4gIHNvdXJjZU5hbWU6IHQuc3RyaW5nKClcbn0pO1xudmFyIFJhd1Njb3BlZFR5cGVOYW1lVjkgPSB0Lm9iamVjdChcIlJhd1Njb3BlZFR5cGVOYW1lVjlcIiwge1xuICBzY29wZTogdC5hcnJheSh0LnN0cmluZygpKSxcbiAgbmFtZTogdC5zdHJpbmcoKVxufSk7XG52YXIgUmF3U2VxdWVuY2VEZWZWMTAgPSB0Lm9iamVjdChcIlJhd1NlcXVlbmNlRGVmVjEwXCIsIHtcbiAgc291cmNlTmFtZTogdC5vcHRpb24odC5zdHJpbmcoKSksXG4gIGNvbHVtbjogdC51MTYoKSxcbiAgc3RhcnQ6IHQub3B0aW9uKHQuaTEyOCgpKSxcbiAgbWluVmFsdWU6IHQub3B0aW9uKHQuaTEyOCgpKSxcbiAgbWF4VmFsdWU6IHQub3B0aW9uKHQuaTEyOCgpKSxcbiAgaW5jcmVtZW50OiB0LmkxMjgoKVxufSk7XG52YXIgUmF3U2VxdWVuY2VEZWZWOCA9IHQub2JqZWN0KFwiUmF3U2VxdWVuY2VEZWZWOFwiLCB7XG4gIHNlcXVlbmNlTmFtZTogdC5zdHJpbmcoKSxcbiAgY29sUG9zOiB0LnUxNigpLFxuICBpbmNyZW1lbnQ6IHQuaTEyOCgpLFxuICBzdGFydDogdC5vcHRpb24odC5pMTI4KCkpLFxuICBtaW5WYWx1ZTogdC5vcHRpb24odC5pMTI4KCkpLFxuICBtYXhWYWx1ZTogdC5vcHRpb24odC5pMTI4KCkpLFxuICBhbGxvY2F0ZWQ6IHQuaTEyOCgpXG59KTtcbnZhciBSYXdTZXF1ZW5jZURlZlY5ID0gdC5vYmplY3QoXCJSYXdTZXF1ZW5jZURlZlY5XCIsIHtcbiAgbmFtZTogdC5vcHRpb24odC5zdHJpbmcoKSksXG4gIGNvbHVtbjogdC51MTYoKSxcbiAgc3RhcnQ6IHQub3B0aW9uKHQuaTEyOCgpKSxcbiAgbWluVmFsdWU6IHQub3B0aW9uKHQuaTEyOCgpKSxcbiAgbWF4VmFsdWU6IHQub3B0aW9uKHQuaTEyOCgpKSxcbiAgaW5jcmVtZW50OiB0LmkxMjgoKVxufSk7XG52YXIgUmF3U3VibW9kdWxlVjEwID0gdC5vYmplY3QoXCJSYXdTdWJtb2R1bGVWMTBcIiwge1xuICBuYW1lc3BhY2U6IHQuc3RyaW5nKCksXG4gIGdldCBtb2R1bGUoKSB7XG4gICAgcmV0dXJuIFJhd01vZHVsZURlZlYxMDtcbiAgfVxufSk7XG52YXIgUmF3VGFibGVEZWZWMTAgPSB0Lm9iamVjdChcIlJhd1RhYmxlRGVmVjEwXCIsIHtcbiAgc291cmNlTmFtZTogdC5zdHJpbmcoKSxcbiAgcHJvZHVjdFR5cGVSZWY6IHQudTMyKCksXG4gIHByaW1hcnlLZXk6IHQuYXJyYXkodC51MTYoKSksXG4gIGdldCBpbmRleGVzKCkge1xuICAgIHJldHVybiB0LmFycmF5KFJhd0luZGV4RGVmVjEwKTtcbiAgfSxcbiAgZ2V0IGNvbnN0cmFpbnRzKCkge1xuICAgIHJldHVybiB0LmFycmF5KFJhd0NvbnN0cmFpbnREZWZWMTApO1xuICB9LFxuICBnZXQgc2VxdWVuY2VzKCkge1xuICAgIHJldHVybiB0LmFycmF5KFJhd1NlcXVlbmNlRGVmVjEwKTtcbiAgfSxcbiAgZ2V0IHRhYmxlVHlwZSgpIHtcbiAgICByZXR1cm4gVGFibGVUeXBlO1xuICB9LFxuICBnZXQgdGFibGVBY2Nlc3MoKSB7XG4gICAgcmV0dXJuIFRhYmxlQWNjZXNzO1xuICB9LFxuICBnZXQgZGVmYXVsdFZhbHVlcygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdDb2x1bW5EZWZhdWx0VmFsdWVWMTApO1xuICB9LFxuICBpc0V2ZW50OiB0LmJvb2woKVxufSk7XG52YXIgUmF3VGFibGVEZWZWOCA9IHQub2JqZWN0KFwiUmF3VGFibGVEZWZWOFwiLCB7XG4gIHRhYmxlTmFtZTogdC5zdHJpbmcoKSxcbiAgZ2V0IGNvbHVtbnMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoUmF3Q29sdW1uRGVmVjgpO1xuICB9LFxuICBnZXQgaW5kZXhlcygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdJbmRleERlZlY4KTtcbiAgfSxcbiAgZ2V0IGNvbnN0cmFpbnRzKCkge1xuICAgIHJldHVybiB0LmFycmF5KFJhd0NvbnN0cmFpbnREZWZWOCk7XG4gIH0sXG4gIGdldCBzZXF1ZW5jZXMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoUmF3U2VxdWVuY2VEZWZWOCk7XG4gIH0sXG4gIHRhYmxlVHlwZTogdC5zdHJpbmcoKSxcbiAgdGFibGVBY2Nlc3M6IHQuc3RyaW5nKCksXG4gIHNjaGVkdWxlZDogdC5vcHRpb24odC5zdHJpbmcoKSlcbn0pO1xudmFyIFJhd1RhYmxlRGVmVjkgPSB0Lm9iamVjdChcIlJhd1RhYmxlRGVmVjlcIiwge1xuICBuYW1lOiB0LnN0cmluZygpLFxuICBwcm9kdWN0VHlwZVJlZjogdC51MzIoKSxcbiAgcHJpbWFyeUtleTogdC5hcnJheSh0LnUxNigpKSxcbiAgZ2V0IGluZGV4ZXMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoUmF3SW5kZXhEZWZWOSk7XG4gIH0sXG4gIGdldCBjb25zdHJhaW50cygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdDb25zdHJhaW50RGVmVjkpO1xuICB9LFxuICBnZXQgc2VxdWVuY2VzKCkge1xuICAgIHJldHVybiB0LmFycmF5KFJhd1NlcXVlbmNlRGVmVjkpO1xuICB9LFxuICBnZXQgc2NoZWR1bGUoKSB7XG4gICAgcmV0dXJuIHQub3B0aW9uKFJhd1NjaGVkdWxlRGVmVjkpO1xuICB9LFxuICBnZXQgdGFibGVUeXBlKCkge1xuICAgIHJldHVybiBUYWJsZVR5cGU7XG4gIH0sXG4gIGdldCB0YWJsZUFjY2VzcygpIHtcbiAgICByZXR1cm4gVGFibGVBY2Nlc3M7XG4gIH1cbn0pO1xudmFyIFJhd1R5cGVEZWZWMTAgPSB0Lm9iamVjdChcIlJhd1R5cGVEZWZWMTBcIiwge1xuICBnZXQgc291cmNlTmFtZSgpIHtcbiAgICByZXR1cm4gUmF3U2NvcGVkVHlwZU5hbWVWMTA7XG4gIH0sXG4gIHR5OiB0LnUzMigpLFxuICBjdXN0b21PcmRlcmluZzogdC5ib29sKClcbn0pO1xudmFyIFJhd1R5cGVEZWZWOSA9IHQub2JqZWN0KFwiUmF3VHlwZURlZlY5XCIsIHtcbiAgZ2V0IG5hbWUoKSB7XG4gICAgcmV0dXJuIFJhd1Njb3BlZFR5cGVOYW1lVjk7XG4gIH0sXG4gIHR5OiB0LnUzMigpLFxuICBjdXN0b21PcmRlcmluZzogdC5ib29sKClcbn0pO1xudmFyIFJhd1VuaXF1ZUNvbnN0cmFpbnREYXRhVjkgPSB0Lm9iamVjdChcbiAgXCJSYXdVbmlxdWVDb25zdHJhaW50RGF0YVY5XCIsXG4gIHtcbiAgICBjb2x1bW5zOiB0LmFycmF5KHQudTE2KCkpXG4gIH1cbik7XG52YXIgUmF3Vmlld0RlZlYxMCA9IHQub2JqZWN0KFwiUmF3Vmlld0RlZlYxMFwiLCB7XG4gIHNvdXJjZU5hbWU6IHQuc3RyaW5nKCksXG4gIGluZGV4OiB0LnUzMigpLFxuICBpc1B1YmxpYzogdC5ib29sKCksXG4gIGlzQW5vbnltb3VzOiB0LmJvb2woKSxcbiAgZ2V0IHBhcmFtcygpIHtcbiAgICByZXR1cm4gUHJvZHVjdFR5cGUyO1xuICB9LFxuICBnZXQgcmV0dXJuVHlwZSgpIHtcbiAgICByZXR1cm4gQWxnZWJyYWljVHlwZTI7XG4gIH1cbn0pO1xudmFyIFJhd1ZpZXdEZWZWOSA9IHQub2JqZWN0KFwiUmF3Vmlld0RlZlY5XCIsIHtcbiAgbmFtZTogdC5zdHJpbmcoKSxcbiAgaW5kZXg6IHQudTMyKCksXG4gIGlzUHVibGljOiB0LmJvb2woKSxcbiAgaXNBbm9ueW1vdXM6IHQuYm9vbCgpLFxuICBnZXQgcGFyYW1zKCkge1xuICAgIHJldHVybiBQcm9kdWN0VHlwZTI7XG4gIH0sXG4gIGdldCByZXR1cm5UeXBlKCkge1xuICAgIHJldHVybiBBbGdlYnJhaWNUeXBlMjtcbiAgfVxufSk7XG52YXIgUmF3Vmlld1ByaW1hcnlLZXlEZWZWMTAgPSB0Lm9iamVjdChcIlJhd1ZpZXdQcmltYXJ5S2V5RGVmVjEwXCIsIHtcbiAgdmlld1NvdXJjZU5hbWU6IHQuc3RyaW5nKCksXG4gIGNvbHVtbnM6IHQuYXJyYXkodC5zdHJpbmcoKSlcbn0pO1xudmFyIFJlZHVjZXJEZWYgPSB0Lm9iamVjdChcIlJlZHVjZXJEZWZcIiwge1xuICBuYW1lOiB0LnN0cmluZygpLFxuICBnZXQgYXJncygpIHtcbiAgICByZXR1cm4gdC5hcnJheShQcm9kdWN0VHlwZUVsZW1lbnQpO1xuICB9XG59KTtcbnZhciBTdW1UeXBlMiA9IHQub2JqZWN0KFwiU3VtVHlwZVwiLCB7XG4gIGdldCB2YXJpYW50cygpIHtcbiAgICByZXR1cm4gdC5hcnJheShTdW1UeXBlVmFyaWFudCk7XG4gIH1cbn0pO1xudmFyIFN1bVR5cGVWYXJpYW50ID0gdC5vYmplY3QoXCJTdW1UeXBlVmFyaWFudFwiLCB7XG4gIG5hbWU6IHQub3B0aW9uKHQuc3RyaW5nKCkpLFxuICBnZXQgYWxnZWJyYWljVHlwZSgpIHtcbiAgICByZXR1cm4gQWxnZWJyYWljVHlwZTI7XG4gIH1cbn0pO1xudmFyIFRhYmxlQWNjZXNzID0gdC5lbnVtKFwiVGFibGVBY2Nlc3NcIiwge1xuICBQdWJsaWM6IHQudW5pdCgpLFxuICBQcml2YXRlOiB0LnVuaXQoKVxufSk7XG52YXIgVGFibGVEZXNjID0gdC5vYmplY3QoXCJUYWJsZURlc2NcIiwge1xuICBnZXQgc2NoZW1hKCkge1xuICAgIHJldHVybiBSYXdUYWJsZURlZlY4O1xuICB9LFxuICBkYXRhOiB0LnUzMigpXG59KTtcbnZhciBUYWJsZVR5cGUgPSB0LmVudW0oXCJUYWJsZVR5cGVcIiwge1xuICBTeXN0ZW06IHQudW5pdCgpLFxuICBVc2VyOiB0LnVuaXQoKVxufSk7XG52YXIgVHlwZUFsaWFzID0gdC5vYmplY3QoXCJUeXBlQWxpYXNcIiwge1xuICBuYW1lOiB0LnN0cmluZygpLFxuICB0eTogdC51MzIoKVxufSk7XG52YXIgVHlwZXNwYWNlID0gdC5vYmplY3QoXCJUeXBlc3BhY2VcIiwge1xuICBnZXQgdHlwZXMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoQWxnZWJyYWljVHlwZTIpO1xuICB9XG59KTtcbnZhciBWaWV3UmVzdWx0SGVhZGVyID0gdC5lbnVtKFwiVmlld1Jlc3VsdEhlYWRlclwiLCB7XG4gIFJvd0RhdGE6IHQudW5pdCgpLFxuICBSYXdTcWw6IHQuc3RyaW5nKClcbn0pO1xuXG4vLyBzcmMvbGliL3NjaGVtYS50c1xuZnVuY3Rpb24gdGFibGVUb1NjaGVtYShhY2NOYW1lLCBzY2hlbWEyLCB0YWJsZURlZikge1xuICBjb25zdCBnZXRDb2xOYW1lID0gKGkpID0+IHNjaGVtYTIucm93VHlwZS5hbGdlYnJhaWNUeXBlLnZhbHVlLmVsZW1lbnRzW2ldLm5hbWU7XG4gIGNvbnN0IHJlc29sdmVkSW5kZXhlcyA9IHRhYmxlRGVmLmluZGV4ZXMubWFwKFxuICAgIChpZHgpID0+IHtcbiAgICAgIGNvbnN0IGFjY2Vzc29yTmFtZSA9IGlkeC5hY2Nlc3Nvck5hbWU7XG4gICAgICBpZiAodHlwZW9mIGFjY2Vzc29yTmFtZSAhPT0gXCJzdHJpbmdcIiB8fCBhY2Nlc3Nvck5hbWUubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgICAgYEluZGV4ICcke2lkeC5zb3VyY2VOYW1lID8/IFwiPHVua25vd24+XCJ9JyBvbiB0YWJsZSAnJHt0YWJsZURlZi5zb3VyY2VOYW1lfScgaXMgbWlzc2luZyBhY2Nlc3NvciBuYW1lYFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgY29uc3QgY29sdW1uSWRzID0gaWR4LmFsZ29yaXRobS50YWcgPT09IFwiRGlyZWN0XCIgPyBbaWR4LmFsZ29yaXRobS52YWx1ZV0gOiBpZHguYWxnb3JpdGhtLnZhbHVlO1xuICAgICAgY29uc3QgdW5pcXVlID0gdGFibGVEZWYuY29uc3RyYWludHMuc29tZShcbiAgICAgICAgKGMpID0+IGMuZGF0YS50YWcgPT09IFwiVW5pcXVlXCIgJiYgYy5kYXRhLnZhbHVlLmNvbHVtbnMuZXZlcnkoKGNvbCkgPT4gY29sdW1uSWRzLmluY2x1ZGVzKGNvbCkpXG4gICAgICApO1xuICAgICAgY29uc3QgYWxnb3JpdGhtID0ge1xuICAgICAgICBCVHJlZTogXCJidHJlZVwiLFxuICAgICAgICBIYXNoOiBcImhhc2hcIixcbiAgICAgICAgRGlyZWN0OiBcImRpcmVjdFwiXG4gICAgICB9W2lkeC5hbGdvcml0aG0udGFnXTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG5hbWU6IGFjY2Vzc29yTmFtZSxcbiAgICAgICAgdW5pcXVlLFxuICAgICAgICBhbGdvcml0aG0sXG4gICAgICAgIGNvbHVtbnM6IGNvbHVtbklkcy5tYXAoZ2V0Q29sTmFtZSlcbiAgICAgIH07XG4gICAgfVxuICApO1xuICByZXR1cm4ge1xuICAgIC8vIEZvciBjbGllbnQsYHNjaGFtYS50YWJsZU5hbWVgIHdpbGwgYWx3YXlzIGJlIHRoZXJlIGFzIGNhbm9uaWNhbCBuYW1lLlxuICAgIC8vIEZvciBtb2R1bGUsIGlmIGV4cGxpY2l0IG5hbWUgaXMgbm90IHByb3ZpZGVkIHZpYSBgbmFtZWAsIGFjY2Vzc29yIG5hbWUgd2lsbFxuICAgIC8vIGJlIHVzZWQsIGl0IGlzIHN0b3JlZCBhcyBhbGlhcyBpbiBkYXRhYmFzZSwgaGVuY2Ugd29ya3MgaW4gcXVlcnkgYnVpbGRlci5cbiAgICBzb3VyY2VOYW1lOiBzY2hlbWEyLnRhYmxlTmFtZSB8fCBhY2NOYW1lLFxuICAgIGFjY2Vzc29yTmFtZTogYWNjTmFtZSxcbiAgICBjb2x1bW5zOiBzY2hlbWEyLnJvd1R5cGUucm93LFxuICAgIC8vIHR5cGVkIGFzIFRbaV1bJ3Jvd1R5cGUnXVsncm93J10gdW5kZXIgVGFibGVzVG9TY2hlbWE8VD5cbiAgICByb3dUeXBlOiBzY2hlbWEyLnJvd1NwYWNldGltZVR5cGUsXG4gICAgLy8gS2VlcCBkZWNsYXJhdGl2ZSBpbmRleGVzIGluIHRoZWlyIG9yaWdpbmFsIHNoYXBlIGZvciB0eXBlLWxldmVsIGNvbnN1bWVycy5cbiAgICBpbmRleGVzOiBzY2hlbWEyLmlkeHMsXG4gICAgY29uc3RyYWludHM6IHRhYmxlRGVmLmNvbnN0cmFpbnRzLm1hcCgoYykgPT4gKHtcbiAgICAgIG5hbWU6IGMuc291cmNlTmFtZSxcbiAgICAgIGNvbnN0cmFpbnQ6IFwidW5pcXVlXCIsXG4gICAgICBjb2x1bW5zOiBjLmRhdGEudmFsdWUuY29sdW1ucy5tYXAoZ2V0Q29sTmFtZSlcbiAgICB9KSksXG4gICAgLy8gRXhwb3NlIHJlc29sdmVkIHJ1bnRpbWUgaW5kZXhlcyBzZXBhcmF0ZWx5IHNvIHJ1bnRpbWUgdXNlcnMgZG9uJ3QgaGF2ZSB0b1xuICAgIC8vIHJlaW50ZXJwcmV0IGBpbmRleGVzYCB3aXRoIHVuc2FmZSBjYXN0cy5cbiAgICByZXNvbHZlZEluZGV4ZXMsXG4gICAgdGFibGVEZWYsXG4gICAgLi4udGFibGVEZWYuaXNFdmVudCA/IHsgaXNFdmVudDogdHJ1ZSB9IDoge31cbiAgfTtcbn1cbnZhciBNb2R1bGVDb250ZXh0ID0gY2xhc3Mge1xuICAjY29tcG91bmRUeXBlcyA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgTWFwKCk7XG4gIC8qKlxuICAgKiBUaGUgZ2xvYmFsIG1vZHVsZSBkZWZpbml0aW9uIHRoYXQgZ2V0cyBwb3B1bGF0ZWQgYnkgY2FsbHMgdG8gYHJlZHVjZXIoKWAgYW5kIGxpZmVjeWNsZSBob29rcy5cbiAgICovXG4gICNtb2R1bGVEZWYgPSB7XG4gICAgdHlwZXNwYWNlOiB7IHR5cGVzOiBbXSB9LFxuICAgIHRhYmxlczogW10sXG4gICAgcmVkdWNlcnM6IFtdLFxuICAgIHR5cGVzOiBbXSxcbiAgICByb3dMZXZlbFNlY3VyaXR5OiBbXSxcbiAgICBzY2hlZHVsZXM6IFtdLFxuICAgIHByb2NlZHVyZXM6IFtdLFxuICAgIHZpZXdzOiBbXSxcbiAgICB2aWV3UHJpbWFyeUtleXM6IFtdLFxuICAgIGxpZmVDeWNsZVJlZHVjZXJzOiBbXSxcbiAgICBodHRwSGFuZGxlcnM6IFtdLFxuICAgIGh0dHBSb3V0ZXM6IFtdLFxuICAgIGNhc2VDb252ZXJzaW9uUG9saWN5OiB7IHRhZzogXCJTbmFrZUNhc2VcIiB9LFxuICAgIGV4cGxpY2l0TmFtZXM6IHtcbiAgICAgIGVudHJpZXM6IFtdXG4gICAgfSxcbiAgICBzdWJtb2R1bGVzOiBbXSxcbiAgICBlbnZpcm9ubWVudDogW11cbiAgfTtcbiAgZ2V0IG1vZHVsZURlZigpIHtcbiAgICByZXR1cm4gdGhpcy4jbW9kdWxlRGVmO1xuICB9XG4gIHJhd01vZHVsZURlZlYxMCgpIHtcbiAgICBjb25zdCBzZWN0aW9ucyA9IFtdO1xuICAgIGNvbnN0IHB1c2ggPSAocykgPT4ge1xuICAgICAgaWYgKHMpIHNlY3Rpb25zLnB1c2gocyk7XG4gICAgfTtcbiAgICBjb25zdCBtb2R1bGUgPSB0aGlzLiNtb2R1bGVEZWY7XG4gICAgcHVzaChtb2R1bGUudHlwZXNwYWNlICYmIHsgdGFnOiBcIlR5cGVzcGFjZVwiLCB2YWx1ZTogbW9kdWxlLnR5cGVzcGFjZSB9KTtcbiAgICBwdXNoKG1vZHVsZS50eXBlcyAmJiB7IHRhZzogXCJUeXBlc1wiLCB2YWx1ZTogbW9kdWxlLnR5cGVzIH0pO1xuICAgIHB1c2gobW9kdWxlLnRhYmxlcyAmJiB7IHRhZzogXCJUYWJsZXNcIiwgdmFsdWU6IG1vZHVsZS50YWJsZXMgfSk7XG4gICAgcHVzaChtb2R1bGUucmVkdWNlcnMgJiYgeyB0YWc6IFwiUmVkdWNlcnNcIiwgdmFsdWU6IG1vZHVsZS5yZWR1Y2VycyB9KTtcbiAgICBwdXNoKG1vZHVsZS5wcm9jZWR1cmVzICYmIHsgdGFnOiBcIlByb2NlZHVyZXNcIiwgdmFsdWU6IG1vZHVsZS5wcm9jZWR1cmVzIH0pO1xuICAgIHB1c2gobW9kdWxlLnZpZXdzICYmIHsgdGFnOiBcIlZpZXdzXCIsIHZhbHVlOiBtb2R1bGUudmlld3MgfSk7XG4gICAgcHVzaChcbiAgICAgIG1vZHVsZS52aWV3UHJpbWFyeUtleXMgJiYge1xuICAgICAgICB0YWc6IFwiVmlld1ByaW1hcnlLZXlzXCIsXG4gICAgICAgIHZhbHVlOiBtb2R1bGUudmlld1ByaW1hcnlLZXlzXG4gICAgICB9XG4gICAgKTtcbiAgICBwdXNoKG1vZHVsZS5zY2hlZHVsZXMgJiYgeyB0YWc6IFwiU2NoZWR1bGVzXCIsIHZhbHVlOiBtb2R1bGUuc2NoZWR1bGVzIH0pO1xuICAgIHB1c2goXG4gICAgICBtb2R1bGUubGlmZUN5Y2xlUmVkdWNlcnMgJiYge1xuICAgICAgICB0YWc6IFwiTGlmZUN5Y2xlUmVkdWNlcnNcIixcbiAgICAgICAgdmFsdWU6IG1vZHVsZS5saWZlQ3ljbGVSZWR1Y2Vyc1xuICAgICAgfVxuICAgICk7XG4gICAgcHVzaChcbiAgICAgIG1vZHVsZS5odHRwSGFuZGxlcnMgJiYge1xuICAgICAgICB0YWc6IFwiSHR0cEhhbmRsZXJzXCIsXG4gICAgICAgIHZhbHVlOiBtb2R1bGUuaHR0cEhhbmRsZXJzXG4gICAgICB9XG4gICAgKTtcbiAgICBwdXNoKFxuICAgICAgbW9kdWxlLmh0dHBSb3V0ZXMgJiYge1xuICAgICAgICB0YWc6IFwiSHR0cFJvdXRlc1wiLFxuICAgICAgICB2YWx1ZTogbW9kdWxlLmh0dHBSb3V0ZXNcbiAgICAgIH1cbiAgICApO1xuICAgIHB1c2goXG4gICAgICBtb2R1bGUucm93TGV2ZWxTZWN1cml0eSAmJiB7XG4gICAgICAgIHRhZzogXCJSb3dMZXZlbFNlY3VyaXR5XCIsXG4gICAgICAgIHZhbHVlOiBtb2R1bGUucm93TGV2ZWxTZWN1cml0eVxuICAgICAgfVxuICAgICk7XG4gICAgcHVzaChcbiAgICAgIG1vZHVsZS5leHBsaWNpdE5hbWVzICYmIHtcbiAgICAgICAgdGFnOiBcIkV4cGxpY2l0TmFtZXNcIixcbiAgICAgICAgdmFsdWU6IG1vZHVsZS5leHBsaWNpdE5hbWVzXG4gICAgICB9XG4gICAgKTtcbiAgICBwdXNoKFxuICAgICAgbW9kdWxlLmNhc2VDb252ZXJzaW9uUG9saWN5ICYmIHtcbiAgICAgICAgdGFnOiBcIkNhc2VDb252ZXJzaW9uUG9saWN5XCIsXG4gICAgICAgIHZhbHVlOiBtb2R1bGUuY2FzZUNvbnZlcnNpb25Qb2xpY3lcbiAgICAgIH1cbiAgICApO1xuICAgIHB1c2goXG4gICAgICBtb2R1bGUuc3VibW9kdWxlcyAmJiB7XG4gICAgICAgIHRhZzogXCJTdWJtb2R1bGVzXCIsXG4gICAgICAgIHZhbHVlOiBtb2R1bGUuc3VibW9kdWxlc1xuICAgICAgfVxuICAgICk7XG4gICAgcHVzaCh7IHRhZzogXCJFbnZpcm9ubWVudFwiLCB2YWx1ZTogbW9kdWxlLmVudmlyb25tZW50IH0pO1xuICAgIHJldHVybiB7IHNlY3Rpb25zIH07XG4gIH1cbiAgYWRkU3VibW9kdWxlKHN1Ym1vZHVsZSkge1xuICAgIHRoaXMuI21vZHVsZURlZi5zdWJtb2R1bGVzLnB1c2goc3VibW9kdWxlKTtcbiAgfVxuICAvKipcbiAgICogU2V0IHRoZSBjYXNlIGNvbnZlcnNpb24gcG9saWN5IGZvciB0aGlzIG1vZHVsZS5cbiAgICogQ2FsbGVkIGJ5IHRoZSBzZXR0aW5ncyBtZWNoYW5pc20uXG4gICAqL1xuICBzZXRDYXNlQ29udmVyc2lvblBvbGljeShwb2xpY3kpIHtcbiAgICB0aGlzLiNtb2R1bGVEZWYuY2FzZUNvbnZlcnNpb25Qb2xpY3kgPSBwb2xpY3k7XG4gIH1cbiAgZ2V0IHR5cGVzcGFjZSgpIHtcbiAgICByZXR1cm4gdGhpcy4jbW9kdWxlRGVmLnR5cGVzcGFjZTtcbiAgfVxuICAvKipcbiAgICogUmVzb2x2ZXMgdGhlIGFjdHVhbCB0eXBlIG9mIGEgVHlwZUJ1aWxkZXIgYnkgZm9sbG93aW5nIGl0cyByZWZlcmVuY2VzIHVudGlsIGl0IHJlYWNoZXMgYSBub24tcmVmIHR5cGUuXG4gICAqIEBwYXJhbSB0eXBlc3BhY2UgVGhlIHR5cGVzcGFjZSB0byByZXNvbHZlIHR5cGVzIGFnYWluc3QuXG4gICAqIEBwYXJhbSB0eXBlQnVpbGRlciBUaGUgVHlwZUJ1aWxkZXIgdG8gcmVzb2x2ZS5cbiAgICogQHJldHVybnMgVGhlIHJlc29sdmVkIGFsZ2VicmFpYyB0eXBlLlxuICAgKi9cbiAgcmVzb2x2ZVR5cGUodHlwZUJ1aWxkZXIpIHtcbiAgICBsZXQgdHkgPSB0eXBlQnVpbGRlci5hbGdlYnJhaWNUeXBlO1xuICAgIHdoaWxlICh0eS50YWcgPT09IFwiUmVmXCIpIHtcbiAgICAgIHR5ID0gdGhpcy50eXBlc3BhY2UudHlwZXNbdHkudmFsdWVdO1xuICAgIH1cbiAgICByZXR1cm4gdHk7XG4gIH1cbiAgLyoqXG4gICAqIEFkZHMgYSB0eXBlIHRvIHRoZSBtb2R1bGUgZGVmaW5pdGlvbidzIHR5cGVzcGFjZSBhcyBhIGBSZWZgIGlmIGl0IGlzIGEgbmFtZWQgY29tcG91bmQgdHlwZSAoUHJvZHVjdCBvciBTdW0pLlxuICAgKiBPdGhlcndpc2UsIHJldHVybnMgdGhlIHR5cGUgYXMgaXMuXG4gICAqIEBwYXJhbSBuYW1lXG4gICAqIEBwYXJhbSB0eVxuICAgKiBAcmV0dXJuc1xuICAgKi9cbiAgcmVnaXN0ZXJUeXBlc1JlY3Vyc2l2ZWx5KHR5cGVCdWlsZGVyKSB7XG4gICAgaWYgKHR5cGVCdWlsZGVyIGluc3RhbmNlb2YgUHJvZHVjdEJ1aWxkZXIgJiYgIWlzVW5pdCh0eXBlQnVpbGRlcikgfHwgdHlwZUJ1aWxkZXIgaW5zdGFuY2VvZiBTdW1CdWlsZGVyIHx8IHR5cGVCdWlsZGVyIGluc3RhbmNlb2YgUm93QnVpbGRlcikge1xuICAgICAgcmV0dXJuIHRoaXMuI3JlZ2lzdGVyQ29tcG91bmRUeXBlUmVjdXJzaXZlbHkodHlwZUJ1aWxkZXIpO1xuICAgIH0gZWxzZSBpZiAodHlwZUJ1aWxkZXIgaW5zdGFuY2VvZiBPcHRpb25CdWlsZGVyKSB7XG4gICAgICByZXR1cm4gbmV3IE9wdGlvbkJ1aWxkZXIoXG4gICAgICAgIHRoaXMucmVnaXN0ZXJUeXBlc1JlY3Vyc2l2ZWx5KHR5cGVCdWlsZGVyLnZhbHVlKVxuICAgICAgKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVCdWlsZGVyIGluc3RhbmNlb2YgUmVzdWx0QnVpbGRlcikge1xuICAgICAgcmV0dXJuIG5ldyBSZXN1bHRCdWlsZGVyKFxuICAgICAgICB0aGlzLnJlZ2lzdGVyVHlwZXNSZWN1cnNpdmVseSh0eXBlQnVpbGRlci5vayksXG4gICAgICAgIHRoaXMucmVnaXN0ZXJUeXBlc1JlY3Vyc2l2ZWx5KHR5cGVCdWlsZGVyLmVycilcbiAgICAgICk7XG4gICAgfSBlbHNlIGlmICh0eXBlQnVpbGRlciBpbnN0YW5jZW9mIEFycmF5QnVpbGRlcikge1xuICAgICAgcmV0dXJuIG5ldyBBcnJheUJ1aWxkZXIoXG4gICAgICAgIHRoaXMucmVnaXN0ZXJUeXBlc1JlY3Vyc2l2ZWx5KHR5cGVCdWlsZGVyLmVsZW1lbnQpXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdHlwZUJ1aWxkZXI7XG4gICAgfVxuICB9XG4gICNyZWdpc3RlckNvbXBvdW5kVHlwZVJlY3Vyc2l2ZWx5KHR5cGVCdWlsZGVyKSB7XG4gICAgY29uc3QgdHkgPSB0eXBlQnVpbGRlci5hbGdlYnJhaWNUeXBlO1xuICAgIGNvbnN0IG5hbWUgPSB0eXBlQnVpbGRlci50eXBlTmFtZTtcbiAgICBpZiAobmFtZSA9PT0gdm9pZCAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBNaXNzaW5nIHR5cGUgbmFtZSBmb3IgJHt0eXBlQnVpbGRlci5jb25zdHJ1Y3Rvci5uYW1lID8/IFwiVHlwZUJ1aWxkZXJcIn0gJHtKU09OLnN0cmluZ2lmeSh0eXBlQnVpbGRlcil9YFxuICAgICAgKTtcbiAgICB9XG4gICAgbGV0IHIgPSB0aGlzLiNjb21wb3VuZFR5cGVzLmdldCh0eSk7XG4gICAgaWYgKHIgIT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHI7XG4gICAgfVxuICAgIGNvbnN0IG5ld1R5ID0gdHlwZUJ1aWxkZXIgaW5zdGFuY2VvZiBSb3dCdWlsZGVyIHx8IHR5cGVCdWlsZGVyIGluc3RhbmNlb2YgUHJvZHVjdEJ1aWxkZXIgPyB7XG4gICAgICB0YWc6IFwiUHJvZHVjdFwiLFxuICAgICAgdmFsdWU6IHsgZWxlbWVudHM6IFtdIH1cbiAgICB9IDoge1xuICAgICAgdGFnOiBcIlN1bVwiLFxuICAgICAgdmFsdWU6IHsgdmFyaWFudHM6IFtdIH1cbiAgICB9O1xuICAgIHIgPSBuZXcgUmVmQnVpbGRlcih0aGlzLiNtb2R1bGVEZWYudHlwZXNwYWNlLnR5cGVzLmxlbmd0aCk7XG4gICAgdGhpcy4jbW9kdWxlRGVmLnR5cGVzcGFjZS50eXBlcy5wdXNoKG5ld1R5KTtcbiAgICB0aGlzLiNjb21wb3VuZFR5cGVzLnNldCh0eSwgcik7XG4gICAgaWYgKHR5cGVCdWlsZGVyIGluc3RhbmNlb2YgUm93QnVpbGRlcikge1xuICAgICAgZm9yIChjb25zdCBbbmFtZTIsIGVsZW1dIG9mIE9iamVjdC5lbnRyaWVzKHR5cGVCdWlsZGVyLnJvdykpIHtcbiAgICAgICAgbmV3VHkudmFsdWUuZWxlbWVudHMucHVzaCh7XG4gICAgICAgICAgbmFtZTogbmFtZTIsXG4gICAgICAgICAgYWxnZWJyYWljVHlwZTogdGhpcy5yZWdpc3RlclR5cGVzUmVjdXJzaXZlbHkoZWxlbS50eXBlQnVpbGRlcikuYWxnZWJyYWljVHlwZVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHR5cGVCdWlsZGVyIGluc3RhbmNlb2YgUHJvZHVjdEJ1aWxkZXIpIHtcbiAgICAgIGZvciAoY29uc3QgW25hbWUyLCBlbGVtXSBvZiBPYmplY3QuZW50cmllcyh0eXBlQnVpbGRlci5lbGVtZW50cykpIHtcbiAgICAgICAgbmV3VHkudmFsdWUuZWxlbWVudHMucHVzaCh7XG4gICAgICAgICAgbmFtZTogbmFtZTIsXG4gICAgICAgICAgYWxnZWJyYWljVHlwZTogdGhpcy5yZWdpc3RlclR5cGVzUmVjdXJzaXZlbHkoZWxlbSkuYWxnZWJyYWljVHlwZVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHR5cGVCdWlsZGVyIGluc3RhbmNlb2YgU3VtQnVpbGRlcikge1xuICAgICAgZm9yIChjb25zdCBbbmFtZTIsIHZhcmlhbnRdIG9mIE9iamVjdC5lbnRyaWVzKHR5cGVCdWlsZGVyLnZhcmlhbnRzKSkge1xuICAgICAgICBuZXdUeS52YWx1ZS52YXJpYW50cy5wdXNoKHtcbiAgICAgICAgICBuYW1lOiBuYW1lMixcbiAgICAgICAgICBhbGdlYnJhaWNUeXBlOiB0aGlzLnJlZ2lzdGVyVHlwZXNSZWN1cnNpdmVseSh2YXJpYW50KS5hbGdlYnJhaWNUeXBlXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLiNtb2R1bGVEZWYudHlwZXMucHVzaCh7XG4gICAgICBzb3VyY2VOYW1lOiBzcGxpdE5hbWUobmFtZSksXG4gICAgICB0eTogci5yZWYsXG4gICAgICBjdXN0b21PcmRlcmluZzogdHJ1ZVxuICAgIH0pO1xuICAgIHJldHVybiByO1xuICB9XG59O1xuZnVuY3Rpb24gaXNVbml0KHR5cGVCdWlsZGVyKSB7XG4gIHJldHVybiB0eXBlQnVpbGRlci50eXBlTmFtZSA9PSBudWxsICYmIHR5cGVCdWlsZGVyLmFsZ2VicmFpY1R5cGUudmFsdWUuZWxlbWVudHMubGVuZ3RoID09PSAwO1xufVxuZnVuY3Rpb24gc3BsaXROYW1lKG5hbWUpIHtcbiAgY29uc3Qgc2NvcGUgPSBuYW1lLnNwbGl0KFwiLlwiKTtcbiAgcmV0dXJuIHsgc291cmNlTmFtZTogc2NvcGUucG9wKCksIHNjb3BlIH07XG59XG52YXIgdGV4dEVuY29kZXIyID0gbmV3IFRleHRFbmNvZGVyKCk7XG52YXIgdGV4dERlY29kZXIyID0gbmV3IFRleHREZWNvZGVyKFwidXRmLThcIik7XG5mdW5jdGlvbiBkZXNlcmlhbGl6ZU1ldGhvZChtZXRob2QpIHtcbiAgc3dpdGNoIChtZXRob2QudGFnKSB7XG4gICAgY2FzZSBcIkdldFwiOlxuICAgICAgcmV0dXJuIFwiR0VUXCI7XG4gICAgY2FzZSBcIkhlYWRcIjpcbiAgICAgIHJldHVybiBcIkhFQURcIjtcbiAgICBjYXNlIFwiUG9zdFwiOlxuICAgICAgcmV0dXJuIFwiUE9TVFwiO1xuICAgIGNhc2UgXCJQdXRcIjpcbiAgICAgIHJldHVybiBcIlBVVFwiO1xuICAgIGNhc2UgXCJEZWxldGVcIjpcbiAgICAgIHJldHVybiBcIkRFTEVURVwiO1xuICAgIGNhc2UgXCJDb25uZWN0XCI6XG4gICAgICByZXR1cm4gXCJDT05ORUNUXCI7XG4gICAgY2FzZSBcIk9wdGlvbnNcIjpcbiAgICAgIHJldHVybiBcIk9QVElPTlNcIjtcbiAgICBjYXNlIFwiVHJhY2VcIjpcbiAgICAgIHJldHVybiBcIlRSQUNFXCI7XG4gICAgY2FzZSBcIlBhdGNoXCI6XG4gICAgICByZXR1cm4gXCJQQVRDSFwiO1xuICAgIGNhc2UgXCJFeHRlbnNpb25cIjpcbiAgICAgIHJldHVybiBtZXRob2QudmFsdWU7XG4gIH1cbn1cbnZhciBtZXRob2RzID0gLyogQF9fUFVSRV9fICovIG5ldyBNYXAoW1xuICBbXCJHRVRcIiwgeyB0YWc6IFwiR2V0XCIgfV0sXG4gIFtcIkhFQURcIiwgeyB0YWc6IFwiSGVhZFwiIH1dLFxuICBbXCJQT1NUXCIsIHsgdGFnOiBcIlBvc3RcIiB9XSxcbiAgW1wiUFVUXCIsIHsgdGFnOiBcIlB1dFwiIH1dLFxuICBbXCJERUxFVEVcIiwgeyB0YWc6IFwiRGVsZXRlXCIgfV0sXG4gIFtcIkNPTk5FQ1RcIiwgeyB0YWc6IFwiQ29ubmVjdFwiIH1dLFxuICBbXCJPUFRJT05TXCIsIHsgdGFnOiBcIk9wdGlvbnNcIiB9XSxcbiAgW1wiVFJBQ0VcIiwgeyB0YWc6IFwiVHJhY2VcIiB9XSxcbiAgW1wiUEFUQ0hcIiwgeyB0YWc6IFwiUGF0Y2hcIiB9XVxuXSk7XG5mdW5jdGlvbiBzZXJpYWxpemVNZXRob2QobWV0aG9kKSB7XG4gIHJldHVybiBtZXRob2RzLmdldChtZXRob2Q/LnRvVXBwZXJDYXNlKCkgPz8gXCJHRVRcIikgPz8ge1xuICAgIHRhZzogXCJFeHRlbnNpb25cIixcbiAgICB2YWx1ZTogbWV0aG9kXG4gIH07XG59XG5mdW5jdGlvbiBzZXJpYWxpemVIZWFkZXJzKGhlYWRlcnMpIHtcbiAgcmV0dXJuIHtcbiAgICBlbnRyaWVzOiBBcnJheS5mcm9tKGhlYWRlcnMuZW50cmllcygpLCAoW25hbWUsIHZhbHVlXSkgPT4gKHtcbiAgICAgIG5hbWUsXG4gICAgICB2YWx1ZTogdGV4dEVuY29kZXIyLmVuY29kZSh2YWx1ZSlcbiAgICB9KSlcbiAgfTtcbn1cbmZ1bmN0aW9uIGRlc2VyaWFsaXplSGVhZGVycyhoZWFkZXJzKSB7XG4gIHJldHVybiBuZXcgSGVhZGVycyhcbiAgICBoZWFkZXJzLmVudHJpZXMubWFwKCh7IG5hbWUsIHZhbHVlIH0pID0+IFtcbiAgICAgIG5hbWUsXG4gICAgICB0ZXh0RGVjb2RlcjIuZGVjb2RlKHZhbHVlKVxuICAgIF0pXG4gICk7XG59XG52YXIgbWFrZVJlc3BvbnNlID0gU3ltYm9sKFwibWFrZVJlc3BvbnNlXCIpO1xudmFyIFN5bmNSZXNwb25zZSA9IGNsYXNzIF9TeW5jUmVzcG9uc2Uge1xuICAjYm9keTtcbiAgI2lubmVyO1xuICBjb25zdHJ1Y3Rvcihib2R5LCBpbml0KSB7XG4gICAgaWYgKGJvZHkgPT0gbnVsbCkge1xuICAgICAgdGhpcy4jYm9keSA9IG51bGw7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgYm9keSA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgdGhpcy4jYm9keSA9IGJvZHk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuI2JvZHkgPSBuZXcgVWludDhBcnJheShib2R5KS5idWZmZXI7XG4gICAgfVxuICAgIHRoaXMuI2lubmVyID0ge1xuICAgICAgaGVhZGVyczogbmV3IEhlYWRlcnMoaW5pdD8uaGVhZGVycyksXG4gICAgICBzdGF0dXM6IGluaXQ/LnN0YXR1cyA/PyAyMDAsXG4gICAgICBzdGF0dXNUZXh0OiBpbml0Py5zdGF0dXNUZXh0ID8/IFwiXCIsXG4gICAgICB0eXBlOiBcImRlZmF1bHRcIixcbiAgICAgIHVybDogbnVsbCxcbiAgICAgIGFib3J0ZWQ6IGZhbHNlLFxuICAgICAgdmVyc2lvbjogaW5pdD8udmVyc2lvbiA/PyB7IHRhZzogXCJIdHRwMTFcIiB9XG4gICAgfTtcbiAgfVxuICBzdGF0aWMgW21ha2VSZXNwb25zZV0oYm9keSwgaW5uZXIpIHtcbiAgICBjb25zdCBtZSA9IG5ldyBfU3luY1Jlc3BvbnNlKGJvZHkpO1xuICAgIG1lLiNpbm5lciA9IGlubmVyO1xuICAgIHJldHVybiBtZTtcbiAgfVxuICBnZXQgaGVhZGVycygpIHtcbiAgICByZXR1cm4gdGhpcy4jaW5uZXIuaGVhZGVycztcbiAgfVxuICBnZXQgc3RhdHVzKCkge1xuICAgIHJldHVybiB0aGlzLiNpbm5lci5zdGF0dXM7XG4gIH1cbiAgZ2V0IHN0YXR1c1RleHQoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2lubmVyLnN0YXR1c1RleHQ7XG4gIH1cbiAgZ2V0IG9rKCkge1xuICAgIHJldHVybiAyMDAgPD0gdGhpcy4jaW5uZXIuc3RhdHVzICYmIHRoaXMuI2lubmVyLnN0YXR1cyA8PSAyOTk7XG4gIH1cbiAgZ2V0IHVybCgpIHtcbiAgICByZXR1cm4gdGhpcy4jaW5uZXIudXJsID8/IFwiXCI7XG4gIH1cbiAgZ2V0IHR5cGUoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2lubmVyLnR5cGU7XG4gIH1cbiAgZ2V0IHZlcnNpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuI2lubmVyLnZlcnNpb247XG4gIH1cbiAgYXJyYXlCdWZmZXIoKSB7XG4gICAgcmV0dXJuIHRoaXMuYnl0ZXMoKS5idWZmZXI7XG4gIH1cbiAgYnl0ZXMoKSB7XG4gICAgaWYgKHRoaXMuI2JvZHkgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KCk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgdGhpcy4jYm9keSA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgcmV0dXJuIHRleHRFbmNvZGVyMi5lbmNvZGUodGhpcy4jYm9keSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBuZXcgVWludDhBcnJheSh0aGlzLiNib2R5KTtcbiAgICB9XG4gIH1cbiAganNvbigpIHtcbiAgICByZXR1cm4gSlNPTi5wYXJzZSh0aGlzLnRleHQoKSk7XG4gIH1cbiAgdGV4dCgpIHtcbiAgICBpZiAodGhpcy4jYm9keSA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gXCJcIjtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiB0aGlzLiNib2R5ID09PSBcInN0cmluZ1wiKSB7XG4gICAgICByZXR1cm4gdGhpcy4jYm9keTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRleHREZWNvZGVyMi5kZWNvZGUodGhpcy4jYm9keSk7XG4gICAgfVxuICB9XG59O1xuXG4vLyBzcmMvc2VydmVyL2h0dHBfaGFuZGxlcnMudHNcbnZhciBodHRwSGFuZGxlckZuID0gU3ltYm9sKFwiU3BhY2V0aW1lREIuaHR0cEhhbmRsZXJGblwiKTtcbnZhciBBQ0NFUFRBQkxFX1JPVVRFX1BBVEhfQ0hBUlNfSFVNQU5fREVTQ1JJUFRJT04gPSBcIkFTQ0lJIGxvd2VyY2FzZSBsZXR0ZXJzLCBkaWdpdHMgYW5kIGAtX34vYFwiO1xudmFyIG1ha2VSZXF1ZXN0ID0gU3ltYm9sKFwibWFrZVJlcXVlc3RcIik7XG5mdW5jdGlvbiBjb2VyY2VSZXF1ZXN0Qm9keShib2R5KSB7XG4gIGlmIChib2R5ID09IG51bGwpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBpZiAodHlwZW9mIGJvZHkgPT09IFwic3RyaW5nXCIpIHtcbiAgICByZXR1cm4gYm9keTtcbiAgfVxuICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoYm9keSk7XG59XG5mdW5jdGlvbiByZXF1ZXN0Qm9keVRvQnl0ZXMoYm9keSkge1xuICBpZiAoYm9keSA9PSBudWxsKSB7XG4gICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KCk7XG4gIH1cbiAgaWYgKHR5cGVvZiBib2R5ID09PSBcInN0cmluZ1wiKSB7XG4gICAgcmV0dXJuIHRleHRFbmNvZGVyMi5lbmNvZGUoYm9keSk7XG4gIH1cbiAgcmV0dXJuIGJvZHk7XG59XG5mdW5jdGlvbiByZXF1ZXN0Qm9keVRvVGV4dChib2R5KSB7XG4gIGlmIChib2R5ID09IG51bGwpIHtcbiAgICByZXR1cm4gXCJcIjtcbiAgfVxuICBpZiAodHlwZW9mIGJvZHkgPT09IFwic3RyaW5nXCIpIHtcbiAgICByZXR1cm4gYm9keTtcbiAgfVxuICByZXR1cm4gdGV4dERlY29kZXIyLmRlY29kZShib2R5KTtcbn1cbmZ1bmN0aW9uIGNoYXJhY3RlcklzQWNjZXB0YWJsZUZvclJvdXRlUGF0aChjKSB7XG4gIHJldHVybiBjID49IFwiYVwiICYmIGMgPD0gXCJ6XCIgfHwgYyA+PSBcIjBcIiAmJiBjIDw9IFwiOVwiIHx8IGMgPT09IFwiLVwiIHx8IGMgPT09IFwiX1wiIHx8IGMgPT09IFwiflwiIHx8IGMgPT09IFwiL1wiO1xufVxuZnVuY3Rpb24gYXNzZXJ0VmFsaWRQYXRoKHBhdGgpIHtcbiAgaWYgKHBhdGggIT09IFwiXCIgJiYgIXBhdGguc3RhcnRzV2l0aChcIi9cIikpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBSb3V0ZSBwYXRocyBtdXN0IHN0YXJ0IHdpdGggXFxgL1xcYDogJHtwYXRofWApO1xuICB9XG4gIGlmICghWy4uLnBhdGhdLmV2ZXJ5KGNoYXJhY3RlcklzQWNjZXB0YWJsZUZvclJvdXRlUGF0aCkpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgYFJvdXRlIHBhdGhzIG1heSBjb250YWluIG9ubHkgJHtBQ0NFUFRBQkxFX1JPVVRFX1BBVEhfQ0hBUlNfSFVNQU5fREVTQ1JJUFRJT059OiAke3BhdGh9YFxuICAgICk7XG4gIH1cbn1cbmZ1bmN0aW9uIHJvdXRlc092ZXJsYXAoYSwgYikge1xuICBjb25zdCBtZXRob2RzTWF0Y2ggPSAobGVmdCwgcmlnaHQpID0+IHtcbiAgICBpZiAobGVmdC50YWcgIT09IHJpZ2h0LnRhZykge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBpZiAobGVmdC50YWcgPT09IFwiRXh0ZW5zaW9uXCIgJiYgcmlnaHQudGFnID09PSBcIkV4dGVuc2lvblwiKSB7XG4gICAgICByZXR1cm4gbGVmdC52YWx1ZSA9PT0gcmlnaHQudmFsdWU7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9O1xuICByZXR1cm4gYS5wYXRoID09PSBiLnBhdGggJiYgKGEubWV0aG9kLnRhZyA9PT0gXCJBbnlcIiB8fCBiLm1ldGhvZC50YWcgPT09IFwiQW55XCIgfHwgYS5tZXRob2QudGFnID09PSBcIk1ldGhvZFwiICYmIGIubWV0aG9kLnRhZyA9PT0gXCJNZXRob2RcIiAmJiBtZXRob2RzTWF0Y2goYS5tZXRob2QudmFsdWUsIGIubWV0aG9kLnZhbHVlKSk7XG59XG5mdW5jdGlvbiBqb2luUGF0aHMocHJlZml4LCBzdWZmaXgpIHtcbiAgaWYgKHByZWZpeCA9PT0gXCIvXCIpIHtcbiAgICByZXR1cm4gc3VmZml4O1xuICB9XG4gIGlmIChzdWZmaXggPT09IFwiL1wiKSB7XG4gICAgcmV0dXJuIHByZWZpeDtcbiAgfVxuICBsZXQgcHJlZml4RW5kID0gcHJlZml4Lmxlbmd0aDtcbiAgd2hpbGUgKHByZWZpeEVuZCA+IDAgJiYgcHJlZml4W3ByZWZpeEVuZCAtIDFdID09PSBcIi9cIikge1xuICAgIHByZWZpeEVuZC0tO1xuICB9XG4gIGxldCBzdWZmaXhTdGFydCA9IDA7XG4gIHdoaWxlIChzdWZmaXhTdGFydCA8IHN1ZmZpeC5sZW5ndGggJiYgc3VmZml4W3N1ZmZpeFN0YXJ0XSA9PT0gXCIvXCIpIHtcbiAgICBzdWZmaXhTdGFydCsrO1xuICB9XG4gIGNvbnN0IGpvaW5lZFByZWZpeCA9IHByZWZpeC5zbGljZSgwLCBwcmVmaXhFbmQpO1xuICBjb25zdCBqb2luZWRTdWZmaXggPSBzdWZmaXguc2xpY2Uoc3VmZml4U3RhcnQpO1xuICByZXR1cm4gYCR7am9pbmVkUHJlZml4fS8ke2pvaW5lZFN1ZmZpeH1gO1xufVxudmFyIFJlcXVlc3QgPSBjbGFzcyBfUmVxdWVzdCB7XG4gICNib2R5O1xuICAjaW5uZXI7XG4gIGNvbnN0cnVjdG9yKHVybCwgaW5pdCA9IHt9KSB7XG4gICAgdGhpcy4jYm9keSA9IGNvZXJjZVJlcXVlc3RCb2R5KGluaXQuYm9keSk7XG4gICAgdGhpcy4jaW5uZXIgPSB7XG4gICAgICBoZWFkZXJzOiBuZXcgSGVhZGVycyhpbml0LmhlYWRlcnMpLFxuICAgICAgbWV0aG9kOiBpbml0Lm1ldGhvZCA/PyBcIkdFVFwiLFxuICAgICAgdXJpOiBcIlwiICsgdXJsLFxuICAgICAgdmVyc2lvbjogaW5pdC52ZXJzaW9uID8/IHsgdGFnOiBcIkh0dHAxMVwiIH1cbiAgICB9O1xuICB9XG4gIHN0YXRpYyBbbWFrZVJlcXVlc3RdKGJvZHksIGlubmVyKSB7XG4gICAgY29uc3QgbWUgPSBuZXcgX1JlcXVlc3QoaW5uZXIudXJpKTtcbiAgICBtZS4jYm9keSA9IGNvZXJjZVJlcXVlc3RCb2R5KGJvZHkpO1xuICAgIG1lLiNpbm5lciA9IGlubmVyO1xuICAgIHJldHVybiBtZTtcbiAgfVxuICBnZXQgaGVhZGVycygpIHtcbiAgICByZXR1cm4gdGhpcy4jaW5uZXIuaGVhZGVycztcbiAgfVxuICBnZXQgbWV0aG9kKCkge1xuICAgIHJldHVybiB0aGlzLiNpbm5lci5tZXRob2Q7XG4gIH1cbiAgZ2V0IHVyaSgpIHtcbiAgICByZXR1cm4gdGhpcy4jaW5uZXIudXJpO1xuICB9XG4gIGdldCB1cmwoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2lubmVyLnVyaTtcbiAgfVxuICBnZXQgdmVyc2lvbigpIHtcbiAgICByZXR1cm4gdGhpcy4jaW5uZXIudmVyc2lvbjtcbiAgfVxuICBhcnJheUJ1ZmZlcigpIHtcbiAgICByZXR1cm4gdGhpcy5ieXRlcygpLmJ1ZmZlcjtcbiAgfVxuICBieXRlcygpIHtcbiAgICByZXR1cm4gcmVxdWVzdEJvZHlUb0J5dGVzKHRoaXMuI2JvZHkpO1xuICB9XG4gIGpzb24oKSB7XG4gICAgcmV0dXJuIEpTT04ucGFyc2UodGhpcy50ZXh0KCkpO1xuICB9XG4gIHRleHQoKSB7XG4gICAgcmV0dXJuIHJlcXVlc3RCb2R5VG9UZXh0KHRoaXMuI2JvZHkpO1xuICB9XG59O1xudmFyIGV4cG9ydGVkSHR0cEhhbmRsZXJPYmplY3RzID0gLyogQF9fUFVSRV9fICovIG5ldyBXZWFrU2V0KCk7XG52YXIgUm91dGVyID0gY2xhc3MgX1JvdXRlciB7XG4gICNyb3V0ZXM7XG4gIGNvbnN0cnVjdG9yKHJvdXRlcyA9IFtdKSB7XG4gICAgdGhpcy4jcm91dGVzID0gcm91dGVzO1xuICB9XG4gIGdldChwYXRoLCBoYW5kbGVyKSB7XG4gICAgcmV0dXJuIHRoaXMuYWRkUm91dGUoXG4gICAgICB7IHRhZzogXCJNZXRob2RcIiwgdmFsdWU6IHsgdGFnOiBcIkdldFwiIH0gfSxcbiAgICAgIHBhdGgsXG4gICAgICBoYW5kbGVyXG4gICAgKTtcbiAgfVxuICBoZWFkKHBhdGgsIGhhbmRsZXIpIHtcbiAgICByZXR1cm4gdGhpcy5hZGRSb3V0ZShcbiAgICAgIHsgdGFnOiBcIk1ldGhvZFwiLCB2YWx1ZTogeyB0YWc6IFwiSGVhZFwiIH0gfSxcbiAgICAgIHBhdGgsXG4gICAgICBoYW5kbGVyXG4gICAgKTtcbiAgfVxuICBvcHRpb25zKHBhdGgsIGhhbmRsZXIpIHtcbiAgICByZXR1cm4gdGhpcy5hZGRSb3V0ZShcbiAgICAgIHsgdGFnOiBcIk1ldGhvZFwiLCB2YWx1ZTogeyB0YWc6IFwiT3B0aW9uc1wiIH0gfSxcbiAgICAgIHBhdGgsXG4gICAgICBoYW5kbGVyXG4gICAgKTtcbiAgfVxuICBwdXQocGF0aCwgaGFuZGxlcikge1xuICAgIHJldHVybiB0aGlzLmFkZFJvdXRlKFxuICAgICAgeyB0YWc6IFwiTWV0aG9kXCIsIHZhbHVlOiB7IHRhZzogXCJQdXRcIiB9IH0sXG4gICAgICBwYXRoLFxuICAgICAgaGFuZGxlclxuICAgICk7XG4gIH1cbiAgZGVsZXRlKHBhdGgsIGhhbmRsZXIpIHtcbiAgICByZXR1cm4gdGhpcy5hZGRSb3V0ZShcbiAgICAgIHsgdGFnOiBcIk1ldGhvZFwiLCB2YWx1ZTogeyB0YWc6IFwiRGVsZXRlXCIgfSB9LFxuICAgICAgcGF0aCxcbiAgICAgIGhhbmRsZXJcbiAgICApO1xuICB9XG4gIHBvc3QocGF0aCwgaGFuZGxlcikge1xuICAgIHJldHVybiB0aGlzLmFkZFJvdXRlKFxuICAgICAgeyB0YWc6IFwiTWV0aG9kXCIsIHZhbHVlOiB7IHRhZzogXCJQb3N0XCIgfSB9LFxuICAgICAgcGF0aCxcbiAgICAgIGhhbmRsZXJcbiAgICApO1xuICB9XG4gIHBhdGNoKHBhdGgsIGhhbmRsZXIpIHtcbiAgICByZXR1cm4gdGhpcy5hZGRSb3V0ZShcbiAgICAgIHsgdGFnOiBcIk1ldGhvZFwiLCB2YWx1ZTogeyB0YWc6IFwiUGF0Y2hcIiB9IH0sXG4gICAgICBwYXRoLFxuICAgICAgaGFuZGxlclxuICAgICk7XG4gIH1cbiAgYW55KHBhdGgsIGhhbmRsZXIpIHtcbiAgICByZXR1cm4gdGhpcy5hZGRSb3V0ZSh7IHRhZzogXCJBbnlcIiB9LCBwYXRoLCBoYW5kbGVyKTtcbiAgfVxuICBuZXN0KHBhdGgsIHN1YlJvdXRlcikge1xuICAgIGFzc2VydFZhbGlkUGF0aChwYXRoKTtcbiAgICBpZiAodGhpcy4jcm91dGVzLnNvbWUoKHJvdXRlKSA9PiByb3V0ZS5wYXRoLnN0YXJ0c1dpdGgocGF0aCkpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICBgQ2Fubm90IG5lc3Qgcm91dGVyIGF0IFxcYCR7cGF0aH1cXGA7IGV4aXN0aW5nIHJvdXRlcyBvdmVybGFwIHdpdGggbmVzdGVkIHBhdGhgXG4gICAgICApO1xuICAgIH1cbiAgICBsZXQgbWVyZ2VkID0gbmV3IF9Sb3V0ZXIodGhpcy4jcm91dGVzKTtcbiAgICBmb3IgKGNvbnN0IHJvdXRlIG9mIHN1YlJvdXRlci4jcm91dGVzKSB7XG4gICAgICBtZXJnZWQgPSBtZXJnZWQuYWRkUm91dGUoXG4gICAgICAgIHJvdXRlLm1ldGhvZCxcbiAgICAgICAgam9pblBhdGhzKHBhdGgsIHJvdXRlLnBhdGgpLFxuICAgICAgICByb3V0ZS5oYW5kbGVyXG4gICAgICApO1xuICAgIH1cbiAgICByZXR1cm4gbWVyZ2VkO1xuICB9XG4gIG1lcmdlKG90aGVyUm91dGVyKSB7XG4gICAgbGV0IG1lcmdlZCA9IG5ldyBfUm91dGVyKHRoaXMuI3JvdXRlcyk7XG4gICAgZm9yIChjb25zdCByb3V0ZSBvZiBvdGhlclJvdXRlci4jcm91dGVzKSB7XG4gICAgICBtZXJnZWQgPSBtZXJnZWQuYWRkUm91dGUocm91dGUubWV0aG9kLCByb3V0ZS5wYXRoLCByb3V0ZS5oYW5kbGVyKTtcbiAgICB9XG4gICAgcmV0dXJuIG1lcmdlZDtcbiAgfVxuICBpbnRvUm91dGVzKCkge1xuICAgIHJldHVybiB0aGlzLiNyb3V0ZXMuc2xpY2UoKTtcbiAgfVxuICBhZGRSb3V0ZShtZXRob2QsIHBhdGgsIGhhbmRsZXIpIHtcbiAgICBhc3NlcnRWYWxpZFBhdGgocGF0aCk7XG4gICAgY29uc3QgY2FuZGlkYXRlID0geyBtZXRob2QsIHBhdGgsIGhhbmRsZXIgfTtcbiAgICBpZiAodGhpcy4jcm91dGVzLnNvbWUoKHJvdXRlKSA9PiByb3V0ZXNPdmVybGFwKHJvdXRlLCBjYW5kaWRhdGUpKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgUm91dGUgY29uZmxpY3QgZm9yIFxcYCR7cGF0aH1cXGBgKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBfUm91dGVyKFsuLi50aGlzLiNyb3V0ZXMsIGNhbmRpZGF0ZV0pO1xuICB9XG59O1xuZnVuY3Rpb24gbWFrZUh0dHBIYW5kbGVyRXhwb3J0KGN0eCwgb3B0cywgZm4pIHtcbiAgY29uc3QgaGFuZGxlckV4cG9ydCA9IE9iamVjdC5hc3NpZ24oXG4gICAgKC4uLmFyZ3MpID0+IGZuKC4uLmFyZ3MpLFxuICAgIHtcbiAgICAgIFtodHRwSGFuZGxlckZuXTogZm4sXG4gICAgICBbZXhwb3J0Q29udGV4dF06IGN0eCxcbiAgICAgIFtyZWdpc3RlckV4cG9ydF0oY3R4MiwgZXhwb3J0TmFtZSkge1xuICAgICAgICBpZiAoZXhwb3J0ZWRIdHRwSGFuZGxlck9iamVjdHMuaGFzKGhhbmRsZXJFeHBvcnQpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICAgIGBIVFRQIGhhbmRsZXIgJyR7ZXhwb3J0TmFtZX0nIHdhcyBleHBvcnRlZCBtb3JlIHRoYW4gb25jZWBcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIGV4cG9ydGVkSHR0cEhhbmRsZXJPYmplY3RzLmFkZChoYW5kbGVyRXhwb3J0KTtcbiAgICAgICAgcmVnaXN0ZXJIdHRwSGFuZGxlcihjdHgyLCBleHBvcnROYW1lLCBmbiwgb3B0cyk7XG4gICAgICAgIGN0eDIuaHR0cEhhbmRsZXJFeHBvcnRzLnNldChcbiAgICAgICAgICBoYW5kbGVyRXhwb3J0LFxuICAgICAgICAgIGV4cG9ydE5hbWVcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG4gICk7XG4gIHJldHVybiBoYW5kbGVyRXhwb3J0O1xufVxuZnVuY3Rpb24gbWFrZUh0dHBSb3V0ZXJFeHBvcnQoY3R4LCByb3V0ZXIpIHtcbiAgcmV0dXJuIHtcbiAgICBbZXhwb3J0Q29udGV4dF06IGN0eCxcbiAgICBbcmVnaXN0ZXJFeHBvcnRdKGN0eDIpIHtcbiAgICAgIGN0eDIucGVuZGluZ0h0dHBSb3V0ZXMucHVzaCguLi5yb3V0ZXIuaW50b1JvdXRlcygpKTtcbiAgICB9XG4gIH07XG59XG5mdW5jdGlvbiByZWdpc3Rlckh0dHBIYW5kbGVyKGN0eCwgZXhwb3J0TmFtZSwgZm4sIG9wdHMpIHtcbiAgY3R4LmRlZmluZUh0dHBIYW5kbGVyKGV4cG9ydE5hbWUpO1xuICBjdHgubW9kdWxlRGVmLmh0dHBIYW5kbGVycy5wdXNoKHsgc291cmNlTmFtZTogZXhwb3J0TmFtZSB9KTtcbiAgaWYgKG9wdHM/Lm5hbWUgIT0gbnVsbCkge1xuICAgIGN0eC5tb2R1bGVEZWYuZXhwbGljaXROYW1lcy5lbnRyaWVzLnB1c2goe1xuICAgICAgdGFnOiBcIkZ1bmN0aW9uXCIsXG4gICAgICB2YWx1ZToge1xuICAgICAgICBzb3VyY2VOYW1lOiBleHBvcnROYW1lLFxuICAgICAgICBjYW5vbmljYWxOYW1lOiBvcHRzLm5hbWVcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuICBpZiAoIWZuLm5hbWUpIHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZm4sIFwibmFtZVwiLCB7IHZhbHVlOiBleHBvcnROYW1lLCB3cml0YWJsZTogZmFsc2UgfSk7XG4gIH1cbiAgY3R4Lmh0dHBIYW5kbGVycy5wdXNoKGZuKTtcbn1cblxuLy8gc3JjL3NlcnZlci9odHRwX2ludGVybmFsLnRzXG52YXIgaW1wb3J0X3N0YXR1c2VzID0gX190b0VTTShyZXF1aXJlX3N0YXR1c2VzKCkpO1xuXG4vLyBzcmMvc2VydmVyL3JhbmdlLnRzXG52YXIgUmFuZ2UgPSBjbGFzcyB7XG4gICNmcm9tO1xuICAjdG87XG4gIGNvbnN0cnVjdG9yKGZyb20sIHRvKSB7XG4gICAgdGhpcy4jZnJvbSA9IGZyb20gPz8geyB0YWc6IFwidW5ib3VuZGVkXCIgfTtcbiAgICB0aGlzLiN0byA9IHRvID8/IHsgdGFnOiBcInVuYm91bmRlZFwiIH07XG4gIH1cbiAgZ2V0IGZyb20oKSB7XG4gICAgcmV0dXJuIHRoaXMuI2Zyb207XG4gIH1cbiAgZ2V0IHRvKCkge1xuICAgIHJldHVybiB0aGlzLiN0bztcbiAgfVxufTtcblxuLy8gc3JjL2xpYi90YWJsZS50c1xuZnVuY3Rpb24gdGFibGUob3B0cywgcm93LCAuLi5fKSB7XG4gIGNvbnN0IHtcbiAgICBuYW1lLFxuICAgIHB1YmxpYzogaXNQdWJsaWMgPSBmYWxzZSxcbiAgICBpbmRleGVzOiB1c2VySW5kZXhlcyA9IFtdLFxuICAgIHNjaGVkdWxlZCxcbiAgICBldmVudDogaXNFdmVudCA9IGZhbHNlXG4gIH0gPSBvcHRzO1xuICBjb25zdCBjb2xJZHMgPSAvKiBAX19QVVJFX18gKi8gbmV3IE1hcCgpO1xuICBjb25zdCBjb2xOYW1lTGlzdCA9IFtdO1xuICBpZiAoIShyb3cgaW5zdGFuY2VvZiBSb3dCdWlsZGVyKSkge1xuICAgIHJvdyA9IG5ldyBSb3dCdWlsZGVyKHJvdyk7XG4gIH1cbiAgcm93LmFsZ2VicmFpY1R5cGUudmFsdWUuZWxlbWVudHMuZm9yRWFjaCgoZWxlbSwgaSkgPT4ge1xuICAgIGNvbElkcy5zZXQoZWxlbS5uYW1lLCBpKTtcbiAgICBjb2xOYW1lTGlzdC5wdXNoKGVsZW0ubmFtZSk7XG4gIH0pO1xuICBjb25zdCBwayA9IFtdO1xuICBjb25zdCBpbmRleGVzID0gW107XG4gIGNvbnN0IGNvbnN0cmFpbnRzID0gW107XG4gIGNvbnN0IHNlcXVlbmNlcyA9IFtdO1xuICBsZXQgc2NoZWR1bGVBdENvbDtcbiAgY29uc3QgZGVmYXVsdFZhbHVlcyA9IFtdO1xuICBmb3IgKGNvbnN0IFtuYW1lMiwgYnVpbGRlcl0gb2YgT2JqZWN0LmVudHJpZXMocm93LnJvdykpIHtcbiAgICBjb25zdCBtZXRhID0gYnVpbGRlci5jb2x1bW5NZXRhZGF0YTtcbiAgICBpZiAobWV0YS5pc1ByaW1hcnlLZXkpIHtcbiAgICAgIHBrLnB1c2goY29sSWRzLmdldChuYW1lMikpO1xuICAgIH1cbiAgICBjb25zdCBpc1VuaXF1ZSA9IG1ldGEuaXNVbmlxdWUgfHwgbWV0YS5pc1ByaW1hcnlLZXk7XG4gICAgaWYgKG1ldGEuaW5kZXhUeXBlIHx8IGlzVW5pcXVlKSB7XG4gICAgICBjb25zdCBhbGdvID0gbWV0YS5pbmRleFR5cGUgPz8gXCJidHJlZVwiO1xuICAgICAgY29uc3QgaWQgPSBjb2xJZHMuZ2V0KG5hbWUyKTtcbiAgICAgIGxldCBhbGdvcml0aG07XG4gICAgICBzd2l0Y2ggKGFsZ28pIHtcbiAgICAgICAgY2FzZSBcImJ0cmVlXCI6XG4gICAgICAgICAgYWxnb3JpdGhtID0gUmF3SW5kZXhBbGdvcml0aG0uQlRyZWUoW2lkXSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgXCJoYXNoXCI6XG4gICAgICAgICAgYWxnb3JpdGhtID0gUmF3SW5kZXhBbGdvcml0aG0uSGFzaChbaWRdKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBcImRpcmVjdFwiOlxuICAgICAgICAgIGFsZ29yaXRobSA9IFJhd0luZGV4QWxnb3JpdGhtLkRpcmVjdChpZCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBpbmRleGVzLnB1c2goe1xuICAgICAgICBzb3VyY2VOYW1lOiB2b2lkIDAsXG4gICAgICAgIC8vIFVubmFtZWQgaW5kZXhlcyB3aWxsIGJlIGFzc2lnbmVkIGEgZ2xvYmFsbHkgdW5pcXVlIG5hbWVcbiAgICAgICAgYWNjZXNzb3JOYW1lOiBuYW1lMixcbiAgICAgICAgYWxnb3JpdGhtXG4gICAgICB9KTtcbiAgICB9XG4gICAgaWYgKGlzVW5pcXVlKSB7XG4gICAgICBjb25zdHJhaW50cy5wdXNoKHtcbiAgICAgICAgc291cmNlTmFtZTogdm9pZCAwLFxuICAgICAgICBkYXRhOiB7IHRhZzogXCJVbmlxdWVcIiwgdmFsdWU6IHsgY29sdW1uczogW2NvbElkcy5nZXQobmFtZTIpXSB9IH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICBpZiAobWV0YS5pc0F1dG9JbmNyZW1lbnQpIHtcbiAgICAgIHNlcXVlbmNlcy5wdXNoKHtcbiAgICAgICAgc291cmNlTmFtZTogdm9pZCAwLFxuICAgICAgICBzdGFydDogdm9pZCAwLFxuICAgICAgICBtaW5WYWx1ZTogdm9pZCAwLFxuICAgICAgICBtYXhWYWx1ZTogdm9pZCAwLFxuICAgICAgICBjb2x1bW46IGNvbElkcy5nZXQobmFtZTIpLFxuICAgICAgICBpbmNyZW1lbnQ6IDFuXG4gICAgICB9KTtcbiAgICB9XG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChtZXRhLCBcImRlZmF1bHRWYWx1ZVwiKSkge1xuICAgICAgY29uc3Qgd3JpdGVyID0gbmV3IEJpbmFyeVdyaXRlcigxNik7XG4gICAgICBidWlsZGVyLnNlcmlhbGl6ZSh3cml0ZXIsIG1ldGEuZGVmYXVsdFZhbHVlKTtcbiAgICAgIGRlZmF1bHRWYWx1ZXMucHVzaCh7XG4gICAgICAgIGNvbElkOiBjb2xJZHMuZ2V0KG5hbWUyKSxcbiAgICAgICAgdmFsdWU6IHdyaXRlci5nZXRCdWZmZXIoKVxuICAgICAgfSk7XG4gICAgfVxuICAgIGNvbnN0IGFsZ2VicmFpY1R5cGUgPSBidWlsZGVyLnR5cGVCdWlsZGVyLmFsZ2VicmFpY1R5cGU7XG4gICAgaWYgKHNjaGVkdWxlX2F0X2RlZmF1bHQuaXNTY2hlZHVsZUF0KGFsZ2VicmFpY1R5cGUpKSB7XG4gICAgICBzY2hlZHVsZUF0Q29sID0gY29sSWRzLmdldChuYW1lMik7XG4gICAgfVxuICB9XG4gIGZvciAoY29uc3QgaW5kZXhPcHRzIG9mIHVzZXJJbmRleGVzID8/IFtdKSB7XG4gICAgY29uc3QgYWNjZXNzb3IgPSBpbmRleE9wdHMuYWNjZXNzb3I7XG4gICAgaWYgKHR5cGVvZiBhY2Nlc3NvciAhPT0gXCJzdHJpbmdcIiB8fCBhY2Nlc3Nvci5sZW5ndGggPT09IDApIHtcbiAgICAgIGNvbnN0IHRhYmxlTGFiZWwgPSBuYW1lID8/IFwiPHVubmFtZWQ+XCI7XG4gICAgICBjb25zdCBpbmRleExhYmVsID0gaW5kZXhPcHRzLm5hbWUgPz8gXCI8dW5uYW1lZD5cIjtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgIGBJbmRleCAnJHtpbmRleExhYmVsfScgb24gdGFibGUgJyR7dGFibGVMYWJlbH0nIG11c3QgZGVmaW5lIGEgbm9uLWVtcHR5ICdhY2Nlc3NvcidgXG4gICAgICApO1xuICAgIH1cbiAgICBsZXQgYWxnb3JpdGhtO1xuICAgIHN3aXRjaCAoaW5kZXhPcHRzLmFsZ29yaXRobSkge1xuICAgICAgY2FzZSBcImJ0cmVlXCI6XG4gICAgICAgIGFsZ29yaXRobSA9IHtcbiAgICAgICAgICB0YWc6IFwiQlRyZWVcIixcbiAgICAgICAgICB2YWx1ZTogaW5kZXhPcHRzLmNvbHVtbnMubWFwKChjKSA9PiBjb2xJZHMuZ2V0KGMpKVxuICAgICAgICB9O1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgXCJoYXNoXCI6XG4gICAgICAgIGFsZ29yaXRobSA9IHtcbiAgICAgICAgICB0YWc6IFwiSGFzaFwiLFxuICAgICAgICAgIHZhbHVlOiBpbmRleE9wdHMuY29sdW1ucy5tYXAoKGMpID0+IGNvbElkcy5nZXQoYykpXG4gICAgICAgIH07XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcImRpcmVjdFwiOlxuICAgICAgICBhbGdvcml0aG0gPSB7IHRhZzogXCJEaXJlY3RcIiwgdmFsdWU6IGNvbElkcy5nZXQoaW5kZXhPcHRzLmNvbHVtbikgfTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGluZGV4ZXMucHVzaCh7XG4gICAgICBzb3VyY2VOYW1lOiB2b2lkIDAsXG4gICAgICBhY2Nlc3Nvck5hbWU6IGFjY2Vzc29yLFxuICAgICAgYWxnb3JpdGhtLFxuICAgICAgY2Fub25pY2FsTmFtZTogaW5kZXhPcHRzLm5hbWVcbiAgICB9KTtcbiAgfVxuICBmb3IgKGNvbnN0IGNvbnN0cmFpbnRPcHRzIG9mIG9wdHMuY29uc3RyYWludHMgPz8gW10pIHtcbiAgICBpZiAoY29uc3RyYWludE9wdHMuY29uc3RyYWludCA9PT0gXCJ1bmlxdWVcIikge1xuICAgICAgY29uc3QgZGF0YSA9IHtcbiAgICAgICAgdGFnOiBcIlVuaXF1ZVwiLFxuICAgICAgICB2YWx1ZTogeyBjb2x1bW5zOiBjb25zdHJhaW50T3B0cy5jb2x1bW5zLm1hcCgoYykgPT4gY29sSWRzLmdldChjKSkgfVxuICAgICAgfTtcbiAgICAgIGNvbnN0cmFpbnRzLnB1c2goeyBzb3VyY2VOYW1lOiBjb25zdHJhaW50T3B0cy5uYW1lLCBkYXRhIH0pO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICB9XG4gIGNvbnN0IHByb2R1Y3RUeXBlID0gcm93LmFsZ2VicmFpY1R5cGUudmFsdWU7XG4gIGNvbnN0IHNjaGVkdWxlID0gc2NoZWR1bGVkICYmIHNjaGVkdWxlQXRDb2wgIT09IHZvaWQgMCA/IHsgc2NoZWR1bGVBdENvbCwgcmVkdWNlcjogc2NoZWR1bGVkIH0gOiB2b2lkIDA7XG4gIHJldHVybiB7XG4gICAgcm93VHlwZTogcm93LFxuICAgIHRhYmxlTmFtZTogbmFtZSxcbiAgICByb3dTcGFjZXRpbWVUeXBlOiBwcm9kdWN0VHlwZSxcbiAgICB0YWJsZURlZjogKGN0eCwgYWNjTmFtZSkgPT4ge1xuICAgICAgY29uc3QgdGFibGVOYW1lID0gbmFtZSA/PyBhY2NOYW1lO1xuICAgICAgaWYgKHJvdy50eXBlTmFtZSA9PT0gdm9pZCAwKSB7XG4gICAgICAgIHJvdy50eXBlTmFtZSA9IHRvUGFzY2FsQ2FzZSh0YWJsZU5hbWUpO1xuICAgICAgfVxuICAgICAgZm9yIChjb25zdCBpbmRleCBvZiBpbmRleGVzKSB7XG4gICAgICAgIGNvbnN0IGNvbHMgPSBpbmRleC5hbGdvcml0aG0udGFnID09PSBcIkRpcmVjdFwiID8gW2luZGV4LmFsZ29yaXRobS52YWx1ZV0gOiBpbmRleC5hbGdvcml0aG0udmFsdWU7XG4gICAgICAgIGNvbnN0IGNvbFMgPSBjb2xzLm1hcCgoaSkgPT4gY29sTmFtZUxpc3RbaV0pLmpvaW4oXCJfXCIpO1xuICAgICAgICBjb25zdCBzb3VyY2VOYW1lID0gaW5kZXguc291cmNlTmFtZSA9IGAke2FjY05hbWV9XyR7Y29sU31faWR4XyR7aW5kZXguYWxnb3JpdGhtLnRhZy50b0xvd2VyQ2FzZSgpfWA7XG4gICAgICAgIGNvbnN0IHsgY2Fub25pY2FsTmFtZSB9ID0gaW5kZXg7XG4gICAgICAgIGlmIChjYW5vbmljYWxOYW1lICE9PSB2b2lkIDApIHtcbiAgICAgICAgICBjdHgubW9kdWxlRGVmLmV4cGxpY2l0TmFtZXMuZW50cmllcy5wdXNoKFxuICAgICAgICAgICAgRXhwbGljaXROYW1lRW50cnkuSW5kZXgoeyBzb3VyY2VOYW1lLCBjYW5vbmljYWxOYW1lIH0pXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc291cmNlTmFtZTogYWNjTmFtZSxcbiAgICAgICAgcHJvZHVjdFR5cGVSZWY6IGN0eC5yZWdpc3RlclR5cGVzUmVjdXJzaXZlbHkocm93KS5yZWYsXG4gICAgICAgIHByaW1hcnlLZXk6IHBrLFxuICAgICAgICBpbmRleGVzLFxuICAgICAgICBjb25zdHJhaW50cyxcbiAgICAgICAgc2VxdWVuY2VzLFxuICAgICAgICB0YWJsZVR5cGU6IHsgdGFnOiBcIlVzZXJcIiB9LFxuICAgICAgICB0YWJsZUFjY2VzczogeyB0YWc6IGlzUHVibGljID8gXCJQdWJsaWNcIiA6IFwiUHJpdmF0ZVwiIH0sXG4gICAgICAgIGRlZmF1bHRWYWx1ZXMsXG4gICAgICAgIGlzRXZlbnRcbiAgICAgIH07XG4gICAgfSxcbiAgICAvLyBQcmVzZXJ2ZSB0aGUgZGVjbGFyZWQgaW5kZXggb3B0aW9ucyBhcyBydW50aW1lIGRhdGEgc28gYHRhYmxlVG9TY2hlbWFgXG4gICAgLy8gY2FuIGV4cG9zZSB0aGVtIHdpdGhvdXQgdHlwZS1zbXVnZ2xpbmcuXG4gICAgaWR4czogdXNlckluZGV4ZXMsXG4gICAgY29uc3RyYWludHMsXG4gICAgc2NoZWR1bGVBdENvbCxcbiAgICBzY2hlZHVsZVxuICB9O1xufVxuXG4vLyBzcmMvbGliL3F1ZXJ5LnRzXG52YXIgUXVlcnlCcmFuZCA9IFN5bWJvbChcIlF1ZXJ5QnJhbmRcIik7XG52YXIgaXNSb3dUeXBlZFF1ZXJ5ID0gKHZhbCkgPT4gISF2YWwgJiYgdHlwZW9mIHZhbCA9PT0gXCJvYmplY3RcIiAmJiBRdWVyeUJyYW5kIGluIHZhbDtcbnZhciBpc1R5cGVkUXVlcnkgPSAodmFsKSA9PiAhIXZhbCAmJiB0eXBlb2YgdmFsID09PSBcIm9iamVjdFwiICYmIFF1ZXJ5QnJhbmQgaW4gdmFsO1xuZnVuY3Rpb24gdG9TcWwocSkge1xuICByZXR1cm4gcS50b1NxbCgpO1xufVxudmFyIFNlbWlqb2luSW1wbCA9IGNsYXNzIF9TZW1pam9pbkltcGwge1xuICBjb25zdHJ1Y3Rvcihzb3VyY2VRdWVyeSwgZmlsdGVyUXVlcnksIGpvaW5Db25kaXRpb24pIHtcbiAgICB0aGlzLnNvdXJjZVF1ZXJ5ID0gc291cmNlUXVlcnk7XG4gICAgdGhpcy5maWx0ZXJRdWVyeSA9IGZpbHRlclF1ZXJ5O1xuICAgIHRoaXMuam9pbkNvbmRpdGlvbiA9IGpvaW5Db25kaXRpb247XG4gICAgaWYgKHNvdXJjZVF1ZXJ5LnRhYmxlLnNvdXJjZU5hbWUgPT09IGZpbHRlclF1ZXJ5LnRhYmxlLnNvdXJjZU5hbWUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkNhbm5vdCBzZW1pam9pbiBhIHRhYmxlIHRvIGl0c2VsZlwiKTtcbiAgICB9XG4gIH1cbiAgW1F1ZXJ5QnJhbmRdID0gdHJ1ZTtcbiAgdHlwZSA9IFwic2VtaWpvaW5cIjtcbiAgYnVpbGQoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgd2hlcmUocHJlZGljYXRlKSB7XG4gICAgY29uc3QgbmV4dFNvdXJjZVF1ZXJ5ID0gdGhpcy5zb3VyY2VRdWVyeS53aGVyZShwcmVkaWNhdGUpO1xuICAgIHJldHVybiBuZXcgX1NlbWlqb2luSW1wbChcbiAgICAgIG5leHRTb3VyY2VRdWVyeSxcbiAgICAgIHRoaXMuZmlsdGVyUXVlcnksXG4gICAgICB0aGlzLmpvaW5Db25kaXRpb25cbiAgICApO1xuICB9XG4gIHRvU3FsKCkge1xuICAgIGNvbnN0IGxlZnQgPSB0aGlzLmZpbHRlclF1ZXJ5O1xuICAgIGNvbnN0IHJpZ2h0ID0gdGhpcy5zb3VyY2VRdWVyeTtcbiAgICBjb25zdCBsZWZ0VGFibGUgPSBxdW90ZUlkZW50aWZpZXIobGVmdC50YWJsZS5zb3VyY2VOYW1lKTtcbiAgICBjb25zdCByaWdodFRhYmxlID0gcXVvdGVJZGVudGlmaWVyKHJpZ2h0LnRhYmxlLnNvdXJjZU5hbWUpO1xuICAgIGxldCBzcWwgPSBgU0VMRUNUICR7cmlnaHRUYWJsZX0uKiBGUk9NICR7bGVmdFRhYmxlfSBKT0lOICR7cmlnaHRUYWJsZX0gT04gJHtib29sZWFuRXhwclRvU3FsKHRoaXMuam9pbkNvbmRpdGlvbil9YDtcbiAgICBjb25zdCBjbGF1c2VzID0gW107XG4gICAgaWYgKGxlZnQud2hlcmVDbGF1c2UpIHtcbiAgICAgIGNsYXVzZXMucHVzaChib29sZWFuRXhwclRvU3FsKGxlZnQud2hlcmVDbGF1c2UpKTtcbiAgICB9XG4gICAgaWYgKHJpZ2h0LndoZXJlQ2xhdXNlKSB7XG4gICAgICBjbGF1c2VzLnB1c2goYm9vbGVhbkV4cHJUb1NxbChyaWdodC53aGVyZUNsYXVzZSkpO1xuICAgIH1cbiAgICBpZiAoY2xhdXNlcy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCB3aGVyZVNxbCA9IGNsYXVzZXMubGVuZ3RoID09PSAxID8gY2xhdXNlc1swXSA6IGNsYXVzZXMubWFwKHdyYXBJblBhcmVucykuam9pbihcIiBBTkQgXCIpO1xuICAgICAgc3FsICs9IGAgV0hFUkUgJHt3aGVyZVNxbH1gO1xuICAgIH1cbiAgICByZXR1cm4gc3FsO1xuICB9XG59O1xudmFyIEZyb21CdWlsZGVyID0gY2xhc3MgX0Zyb21CdWlsZGVyIHtcbiAgY29uc3RydWN0b3IodGFibGUyLCB3aGVyZUNsYXVzZSkge1xuICAgIHRoaXMudGFibGUgPSB0YWJsZTI7XG4gICAgdGhpcy53aGVyZUNsYXVzZSA9IHdoZXJlQ2xhdXNlO1xuICB9XG4gIFtRdWVyeUJyYW5kXSA9IHRydWU7XG4gIHdoZXJlKHByZWRpY2F0ZSkge1xuICAgIGNvbnN0IG5ld0NvbmRpdGlvbiA9IG5vcm1hbGl6ZVByZWRpY2F0ZUV4cHIocHJlZGljYXRlKHRoaXMudGFibGUuY29scykpO1xuICAgIGNvbnN0IG5leHRXaGVyZSA9IHRoaXMud2hlcmVDbGF1c2UgPyB0aGlzLndoZXJlQ2xhdXNlLmFuZChuZXdDb25kaXRpb24pIDogbmV3Q29uZGl0aW9uO1xuICAgIHJldHVybiBuZXcgX0Zyb21CdWlsZGVyKHRoaXMudGFibGUsIG5leHRXaGVyZSk7XG4gIH1cbiAgcmlnaHRTZW1pam9pbihyaWdodCwgb24pIHtcbiAgICBjb25zdCBzb3VyY2VRdWVyeSA9IG5ldyBfRnJvbUJ1aWxkZXIocmlnaHQpO1xuICAgIGNvbnN0IGpvaW5Db25kaXRpb24gPSBvbihcbiAgICAgIHRoaXMudGFibGUuaW5kZXhlZENvbHMsXG4gICAgICByaWdodC5pbmRleGVkQ29sc1xuICAgICk7XG4gICAgcmV0dXJuIG5ldyBTZW1pam9pbkltcGwoc291cmNlUXVlcnksIHRoaXMsIGpvaW5Db25kaXRpb24pO1xuICB9XG4gIGxlZnRTZW1pam9pbihyaWdodCwgb24pIHtcbiAgICBjb25zdCBmaWx0ZXJRdWVyeSA9IG5ldyBfRnJvbUJ1aWxkZXIocmlnaHQpO1xuICAgIGNvbnN0IGpvaW5Db25kaXRpb24gPSBvbihcbiAgICAgIHRoaXMudGFibGUuaW5kZXhlZENvbHMsXG4gICAgICByaWdodC5pbmRleGVkQ29sc1xuICAgICk7XG4gICAgcmV0dXJuIG5ldyBTZW1pam9pbkltcGwodGhpcywgZmlsdGVyUXVlcnksIGpvaW5Db25kaXRpb24pO1xuICB9XG4gIHRvU3FsKCkge1xuICAgIHJldHVybiByZW5kZXJTZWxlY3RTcWxXaXRoSm9pbnModGhpcy50YWJsZSwgdGhpcy53aGVyZUNsYXVzZSk7XG4gIH1cbiAgYnVpbGQoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbn07XG52YXIgVGFibGVSZWZJbXBsID0gY2xhc3Mge1xuICBbUXVlcnlCcmFuZF0gPSB0cnVlO1xuICB0eXBlID0gXCJ0YWJsZVwiO1xuICBzb3VyY2VOYW1lO1xuICBhY2Nlc3Nvck5hbWU7XG4gIGNvbHM7XG4gIGluZGV4ZWRDb2xzO1xuICB0YWJsZURlZjtcbiAgLy8gRGVsZWdhdGUgVW50eXBlZFRhYmxlRGVmIHByb3BlcnRpZXMgZnJvbSB0YWJsZURlZiBzbyB0aGlzIGNhbiBiZSB1c2VkIGFzIGEgdGFibGUgZGVmLlxuICBnZXQgY29sdW1ucygpIHtcbiAgICByZXR1cm4gdGhpcy50YWJsZURlZi5jb2x1bW5zO1xuICB9XG4gIGdldCBpbmRleGVzKCkge1xuICAgIHJldHVybiB0aGlzLnRhYmxlRGVmLmluZGV4ZXM7XG4gIH1cbiAgZ2V0IHJvd1R5cGUoKSB7XG4gICAgcmV0dXJuIHRoaXMudGFibGVEZWYucm93VHlwZTtcbiAgfVxuICBnZXQgY29uc3RyYWludHMoKSB7XG4gICAgcmV0dXJuIHRoaXMudGFibGVEZWYuY29uc3RyYWludHM7XG4gIH1cbiAgY29uc3RydWN0b3IodGFibGVEZWYpIHtcbiAgICB0aGlzLnNvdXJjZU5hbWUgPSB0YWJsZURlZi5zb3VyY2VOYW1lO1xuICAgIHRoaXMuYWNjZXNzb3JOYW1lID0gdGFibGVEZWYuYWNjZXNzb3JOYW1lO1xuICAgIHRoaXMuY29scyA9IGNyZWF0ZVJvd0V4cHIodGFibGVEZWYpO1xuICAgIHRoaXMuaW5kZXhlZENvbHMgPSB0aGlzLmNvbHM7XG4gICAgdGhpcy50YWJsZURlZiA9IHRhYmxlRGVmO1xuICAgIE9iamVjdC5mcmVlemUodGhpcyk7XG4gIH1cbiAgYXNGcm9tKCkge1xuICAgIHJldHVybiBuZXcgRnJvbUJ1aWxkZXIodGhpcyk7XG4gIH1cbiAgcmlnaHRTZW1pam9pbihvdGhlciwgb24pIHtcbiAgICByZXR1cm4gdGhpcy5hc0Zyb20oKS5yaWdodFNlbWlqb2luKG90aGVyLCBvbik7XG4gIH1cbiAgbGVmdFNlbWlqb2luKG90aGVyLCBvbikge1xuICAgIHJldHVybiB0aGlzLmFzRnJvbSgpLmxlZnRTZW1pam9pbihvdGhlciwgb24pO1xuICB9XG4gIGJ1aWxkKCkge1xuICAgIHJldHVybiB0aGlzLmFzRnJvbSgpLmJ1aWxkKCk7XG4gIH1cbiAgdG9TcWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuYXNGcm9tKCkudG9TcWwoKTtcbiAgfVxuICB3aGVyZShwcmVkaWNhdGUpIHtcbiAgICByZXR1cm4gdGhpcy5hc0Zyb20oKS53aGVyZShwcmVkaWNhdGUpO1xuICB9XG59O1xuZnVuY3Rpb24gY3JlYXRlVGFibGVSZWZGcm9tRGVmKHRhYmxlRGVmKSB7XG4gIHJldHVybiBuZXcgVGFibGVSZWZJbXBsKHRhYmxlRGVmKTtcbn1cbmZ1bmN0aW9uIG1ha2VRdWVyeUJ1aWxkZXIoc2NoZW1hMikge1xuICBjb25zdCBxYiA9IC8qIEBfX1BVUkVfXyAqLyBPYmplY3QuY3JlYXRlKG51bGwpO1xuICBmb3IgKGNvbnN0IHRhYmxlMiBvZiBPYmplY3QudmFsdWVzKHNjaGVtYTIudGFibGVzKSkge1xuICAgIGNvbnN0IHJlZiA9IGNyZWF0ZVRhYmxlUmVmRnJvbURlZihcbiAgICAgIHRhYmxlMlxuICAgICk7XG4gICAgcWJbdGFibGUyLmFjY2Vzc29yTmFtZV0gPSByZWY7XG4gIH1cbiAgcmV0dXJuIE9iamVjdC5mcmVlemUocWIpO1xufVxuZnVuY3Rpb24gbWFrZUZyb21CdWlsZGVyKHRhYmxlcykge1xuICBjb25zdCByZXN1bHQgPSAvKiBAX19QVVJFX18gKi8gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgY29uc3QgbmFtZXNwYWNlcyA9IC8qIEBfX1BVUkVfXyAqLyBPYmplY3QuY3JlYXRlKFxuICAgIG51bGxcbiAgKTtcbiAgZm9yIChjb25zdCB0YWJsZTIgb2YgT2JqZWN0LnZhbHVlcyh0YWJsZXMpKSB7XG4gICAgY29uc3QgZG90SWR4ID0gdGFibGUyLnNvdXJjZU5hbWUuaW5kZXhPZihcIi5cIik7XG4gICAgaWYgKGRvdElkeCA9PT0gLTEpIHtcbiAgICAgIHJlc3VsdFt0YWJsZTIuYWNjZXNzb3JOYW1lXSA9IGNyZWF0ZVRhYmxlUmVmRnJvbURlZih0YWJsZTIpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBucyA9IHRhYmxlMi5zb3VyY2VOYW1lLnNsaWNlKDAsIGRvdElkeCk7XG4gICAgICBjb25zdCBrZXkgPSB0YWJsZTIuc291cmNlTmFtZS5zbGljZShkb3RJZHggKyAxKTtcbiAgICAgIChuYW1lc3BhY2VzW25zXSA/Pz0gLyogQF9fUFVSRV9fICovIE9iamVjdC5jcmVhdGUobnVsbCkpW2tleV0gPSBjcmVhdGVUYWJsZVJlZkZyb21EZWYoXG4gICAgICAgIHRhYmxlMlxuICAgICAgKTtcbiAgICB9XG4gIH1cbiAgZm9yIChjb25zdCBbbnMsIG5zVGFibGVzXSBvZiBPYmplY3QuZW50cmllcyhuYW1lc3BhY2VzKSkge1xuICAgIHJlc3VsdFtuc10gPSBPYmplY3QuZnJlZXplKG5zVGFibGVzKTtcbiAgfVxuICByZXR1cm4gT2JqZWN0LmZyZWV6ZShyZXN1bHQpO1xufVxuZnVuY3Rpb24gY3JlYXRlUm93RXhwcih0YWJsZURlZikge1xuICBjb25zdCByb3cgPSB7fTtcbiAgZm9yIChjb25zdCBjb2x1bW5OYW1lIG9mIE9iamVjdC5rZXlzKHRhYmxlRGVmLmNvbHVtbnMpKSB7XG4gICAgY29uc3QgY29sdW1uQnVpbGRlciA9IHRhYmxlRGVmLmNvbHVtbnNbY29sdW1uTmFtZV07XG4gICAgY29uc3QgY29sdW1uID0gbmV3IENvbHVtbkV4cHJlc3Npb24oXG4gICAgICB0YWJsZURlZi5zb3VyY2VOYW1lLFxuICAgICAgY29sdW1uTmFtZSxcbiAgICAgIGNvbHVtbkJ1aWxkZXIudHlwZUJ1aWxkZXIuYWxnZWJyYWljVHlwZSxcbiAgICAgIGNvbHVtbkJ1aWxkZXIuY29sdW1uTWV0YWRhdGEubmFtZVxuICAgICk7XG4gICAgcm93W2NvbHVtbk5hbWVdID0gT2JqZWN0LmZyZWV6ZShjb2x1bW4pO1xuICB9XG4gIHJldHVybiBPYmplY3QuZnJlZXplKHJvdyk7XG59XG5mdW5jdGlvbiByZW5kZXJTZWxlY3RTcWxXaXRoSm9pbnModGFibGUyLCB3aGVyZSwgZXh0cmFDbGF1c2VzID0gW10pIHtcbiAgY29uc3QgcXVvdGVkVGFibGUgPSBxdW90ZUlkZW50aWZpZXIodGFibGUyLnNvdXJjZU5hbWUpO1xuICBjb25zdCBzcWwgPSBgU0VMRUNUICogRlJPTSAke3F1b3RlZFRhYmxlfWA7XG4gIGNvbnN0IGNsYXVzZXMgPSBbXTtcbiAgaWYgKHdoZXJlKSBjbGF1c2VzLnB1c2goYm9vbGVhbkV4cHJUb1NxbCh3aGVyZSkpO1xuICBjbGF1c2VzLnB1c2goLi4uZXh0cmFDbGF1c2VzKTtcbiAgaWYgKGNsYXVzZXMubGVuZ3RoID09PSAwKSByZXR1cm4gc3FsO1xuICBjb25zdCB3aGVyZVNxbCA9IGNsYXVzZXMubGVuZ3RoID09PSAxID8gY2xhdXNlc1swXSA6IGNsYXVzZXMubWFwKHdyYXBJblBhcmVucykuam9pbihcIiBBTkQgXCIpO1xuICByZXR1cm4gYCR7c3FsfSBXSEVSRSAke3doZXJlU3FsfWA7XG59XG52YXIgQ29sdW1uRXhwcmVzc2lvbiA9IGNsYXNzIHtcbiAgdHlwZSA9IFwiY29sdW1uXCI7XG4gIC8vIFRoaXMgaXMgdGhlIGNvbHVtbiBhY2Nlc3NvclxuICBjb2x1bW47XG4gIC8vIFRoZSBuYW1lIG9mIHRoZSBjb2x1bW4gaW4gdGhlIGRhdGFiYXNlLlxuICBjb2x1bW5OYW1lO1xuICB0YWJsZTtcbiAgLy8gcGhhbnRvbTogYWN0dWFsIHJ1bnRpbWUgdmFsdWUgaXMgdW5kZWZpbmVkXG4gIHRzVmFsdWVUeXBlO1xuICBzcGFjZXRpbWVUeXBlO1xuICBjb25zdHJ1Y3Rvcih0YWJsZTIsIGNvbHVtbiwgc3BhY2V0aW1lVHlwZSwgY29sdW1uTmFtZSkge1xuICAgIHRoaXMudGFibGUgPSB0YWJsZTI7XG4gICAgdGhpcy5jb2x1bW4gPSBjb2x1bW47XG4gICAgdGhpcy5jb2x1bW5OYW1lID0gY29sdW1uTmFtZSB8fCBjb2x1bW47XG4gICAgdGhpcy5zcGFjZXRpbWVUeXBlID0gc3BhY2V0aW1lVHlwZTtcbiAgfVxuICBlcSh4KSB7XG4gICAgcmV0dXJuIG5ldyBCb29sZWFuRXhwcih7XG4gICAgICB0eXBlOiBcImVxXCIsXG4gICAgICBsZWZ0OiB0aGlzLFxuICAgICAgcmlnaHQ6IG5vcm1hbGl6ZVZhbHVlKHgpXG4gICAgfSk7XG4gIH1cbiAgbmUoeCkge1xuICAgIHJldHVybiBuZXcgQm9vbGVhbkV4cHIoe1xuICAgICAgdHlwZTogXCJuZVwiLFxuICAgICAgbGVmdDogdGhpcyxcbiAgICAgIHJpZ2h0OiBub3JtYWxpemVWYWx1ZSh4KVxuICAgIH0pO1xuICB9XG4gIGx0KHgpIHtcbiAgICByZXR1cm4gbmV3IEJvb2xlYW5FeHByKHtcbiAgICAgIHR5cGU6IFwibHRcIixcbiAgICAgIGxlZnQ6IHRoaXMsXG4gICAgICByaWdodDogbm9ybWFsaXplVmFsdWUoeClcbiAgICB9KTtcbiAgfVxuICBsdGUoeCkge1xuICAgIHJldHVybiBuZXcgQm9vbGVhbkV4cHIoe1xuICAgICAgdHlwZTogXCJsdGVcIixcbiAgICAgIGxlZnQ6IHRoaXMsXG4gICAgICByaWdodDogbm9ybWFsaXplVmFsdWUoeClcbiAgICB9KTtcbiAgfVxuICBndCh4KSB7XG4gICAgcmV0dXJuIG5ldyBCb29sZWFuRXhwcih7XG4gICAgICB0eXBlOiBcImd0XCIsXG4gICAgICBsZWZ0OiB0aGlzLFxuICAgICAgcmlnaHQ6IG5vcm1hbGl6ZVZhbHVlKHgpXG4gICAgfSk7XG4gIH1cbiAgZ3RlKHgpIHtcbiAgICByZXR1cm4gbmV3IEJvb2xlYW5FeHByKHtcbiAgICAgIHR5cGU6IFwiZ3RlXCIsXG4gICAgICBsZWZ0OiB0aGlzLFxuICAgICAgcmlnaHQ6IG5vcm1hbGl6ZVZhbHVlKHgpXG4gICAgfSk7XG4gIH1cbn07XG5mdW5jdGlvbiBsaXRlcmFsKHZhbHVlKSB7XG4gIHJldHVybiB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZSB9O1xufVxuZnVuY3Rpb24gbm9ybWFsaXplVmFsdWUodmFsKSB7XG4gIGlmICh2YWwudHlwZSA9PT0gXCJsaXRlcmFsXCIpXG4gICAgcmV0dXJuIHZhbDtcbiAgaWYgKHR5cGVvZiB2YWwgPT09IFwib2JqZWN0XCIgJiYgdmFsICE9IG51bGwgJiYgXCJ0eXBlXCIgaW4gdmFsICYmIHZhbC50eXBlID09PSBcImNvbHVtblwiKSB7XG4gICAgcmV0dXJuIHZhbDtcbiAgfVxuICByZXR1cm4gbGl0ZXJhbCh2YWwpO1xufVxuZnVuY3Rpb24gbm9ybWFsaXplUHJlZGljYXRlRXhwcih2YWx1ZSkge1xuICBpZiAodmFsdWUgaW5zdGFuY2VvZiBCb29sZWFuRXhwcikgcmV0dXJuIHZhbHVlO1xuICBpZiAodHlwZW9mIHZhbHVlID09PSBcImJvb2xlYW5cIikge1xuICAgIHJldHVybiBuZXcgQm9vbGVhbkV4cHIoe1xuICAgICAgdHlwZTogXCJlcVwiLFxuICAgICAgbGVmdDogbGl0ZXJhbCh2YWx1ZSksXG4gICAgICByaWdodDogbGl0ZXJhbCh0cnVlKVxuICAgIH0pO1xuICB9XG4gIHJldHVybiBuZXcgQm9vbGVhbkV4cHIoe1xuICAgIHR5cGU6IFwiZXFcIixcbiAgICBsZWZ0OiB2YWx1ZSxcbiAgICByaWdodDogbGl0ZXJhbCh0cnVlKVxuICB9KTtcbn1cbnZhciBCb29sZWFuRXhwciA9IGNsYXNzIF9Cb29sZWFuRXhwciB7XG4gIGNvbnN0cnVjdG9yKGRhdGEpIHtcbiAgICB0aGlzLmRhdGEgPSBkYXRhO1xuICB9XG4gIGFuZChvdGhlcikge1xuICAgIHJldHVybiBuZXcgX0Jvb2xlYW5FeHByKHtcbiAgICAgIHR5cGU6IFwiYW5kXCIsXG4gICAgICBjbGF1c2VzOiBbdGhpcy5kYXRhLCBvdGhlci5kYXRhXVxuICAgIH0pO1xuICB9XG4gIG9yKG90aGVyKSB7XG4gICAgcmV0dXJuIG5ldyBfQm9vbGVhbkV4cHIoe1xuICAgICAgdHlwZTogXCJvclwiLFxuICAgICAgY2xhdXNlczogW3RoaXMuZGF0YSwgb3RoZXIuZGF0YV1cbiAgICB9KTtcbiAgfVxuICBub3QoKSB7XG4gICAgcmV0dXJuIG5ldyBfQm9vbGVhbkV4cHIoeyB0eXBlOiBcIm5vdFwiLCBjbGF1c2U6IHRoaXMuZGF0YSB9KTtcbiAgfVxufTtcbmZ1bmN0aW9uIG5vdChjbGF1c2UpIHtcbiAgcmV0dXJuIG5ldyBCb29sZWFuRXhwcih7IHR5cGU6IFwibm90XCIsIGNsYXVzZTogY2xhdXNlLmRhdGEgfSk7XG59XG5mdW5jdGlvbiBhbmQoZmlyc3QsIHNlY29uZCwgLi4ucmVzdCkge1xuICBjb25zdCBjbGF1c2VzID0gW2ZpcnN0LCBzZWNvbmQsIC4uLnJlc3RdO1xuICByZXR1cm4gbmV3IEJvb2xlYW5FeHByKHtcbiAgICB0eXBlOiBcImFuZFwiLFxuICAgIGNsYXVzZXM6IGNsYXVzZXMubWFwKChjKSA9PiBjLmRhdGEpXG4gIH0pO1xufVxuZnVuY3Rpb24gb3IoZmlyc3QsIHNlY29uZCwgLi4ucmVzdCkge1xuICBjb25zdCBjbGF1c2VzID0gW2ZpcnN0LCBzZWNvbmQsIC4uLnJlc3RdO1xuICByZXR1cm4gbmV3IEJvb2xlYW5FeHByKHtcbiAgICB0eXBlOiBcIm9yXCIsXG4gICAgY2xhdXNlczogY2xhdXNlcy5tYXAoKGMpID0+IGMuZGF0YSlcbiAgfSk7XG59XG5mdW5jdGlvbiBib29sZWFuRXhwclRvU3FsKGV4cHIsIHRhYmxlQWxpYXMpIHtcbiAgY29uc3QgZGF0YSA9IGV4cHIgaW5zdGFuY2VvZiBCb29sZWFuRXhwciA/IGV4cHIuZGF0YSA6IGV4cHI7XG4gIHN3aXRjaCAoZGF0YS50eXBlKSB7XG4gICAgY2FzZSBcImVxXCI6XG4gICAgICByZXR1cm4gYCR7dmFsdWVFeHByVG9TcWwoZGF0YS5sZWZ0KX0gPSAke3ZhbHVlRXhwclRvU3FsKGRhdGEucmlnaHQpfWA7XG4gICAgY2FzZSBcIm5lXCI6XG4gICAgICByZXR1cm4gYCR7dmFsdWVFeHByVG9TcWwoZGF0YS5sZWZ0KX0gPD4gJHt2YWx1ZUV4cHJUb1NxbChkYXRhLnJpZ2h0KX1gO1xuICAgIGNhc2UgXCJndFwiOlxuICAgICAgcmV0dXJuIGAke3ZhbHVlRXhwclRvU3FsKGRhdGEubGVmdCl9ID4gJHt2YWx1ZUV4cHJUb1NxbChkYXRhLnJpZ2h0KX1gO1xuICAgIGNhc2UgXCJndGVcIjpcbiAgICAgIHJldHVybiBgJHt2YWx1ZUV4cHJUb1NxbChkYXRhLmxlZnQpfSA+PSAke3ZhbHVlRXhwclRvU3FsKGRhdGEucmlnaHQpfWA7XG4gICAgY2FzZSBcImx0XCI6XG4gICAgICByZXR1cm4gYCR7dmFsdWVFeHByVG9TcWwoZGF0YS5sZWZ0KX0gPCAke3ZhbHVlRXhwclRvU3FsKGRhdGEucmlnaHQpfWA7XG4gICAgY2FzZSBcImx0ZVwiOlxuICAgICAgcmV0dXJuIGAke3ZhbHVlRXhwclRvU3FsKGRhdGEubGVmdCl9IDw9ICR7dmFsdWVFeHByVG9TcWwoZGF0YS5yaWdodCl9YDtcbiAgICBjYXNlIFwiYW5kXCI6XG4gICAgICByZXR1cm4gZGF0YS5jbGF1c2VzLm1hcCgoYykgPT4gYm9vbGVhbkV4cHJUb1NxbChjKSkubWFwKHdyYXBJblBhcmVucykuam9pbihcIiBBTkQgXCIpO1xuICAgIGNhc2UgXCJvclwiOlxuICAgICAgcmV0dXJuIGRhdGEuY2xhdXNlcy5tYXAoKGMpID0+IGJvb2xlYW5FeHByVG9TcWwoYykpLm1hcCh3cmFwSW5QYXJlbnMpLmpvaW4oXCIgT1IgXCIpO1xuICAgIGNhc2UgXCJub3RcIjpcbiAgICAgIHJldHVybiBgTk9UICR7d3JhcEluUGFyZW5zKGJvb2xlYW5FeHByVG9TcWwoZGF0YS5jbGF1c2UpKX1gO1xuICB9XG59XG5mdW5jdGlvbiB3cmFwSW5QYXJlbnMoc3FsKSB7XG4gIHJldHVybiBgKCR7c3FsfSlgO1xufVxuZnVuY3Rpb24gdmFsdWVFeHByVG9TcWwoZXhwciwgdGFibGVBbGlhcykge1xuICBpZiAoaXNMaXRlcmFsRXhwcihleHByKSkge1xuICAgIHJldHVybiBsaXRlcmFsVmFsdWVUb1NxbChleHByLnZhbHVlKTtcbiAgfVxuICBjb25zdCB0YWJsZTIgPSBleHByLnRhYmxlO1xuICByZXR1cm4gYCR7cXVvdGVJZGVudGlmaWVyKHRhYmxlMil9LiR7cXVvdGVJZGVudGlmaWVyKGV4cHIuY29sdW1uTmFtZSl9YDtcbn1cbmZ1bmN0aW9uIGxpdGVyYWxWYWx1ZVRvU3FsKHZhbHVlKSB7XG4gIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gdm9pZCAwKSB7XG4gICAgcmV0dXJuIFwiTlVMTFwiO1xuICB9XG4gIGlmICh2YWx1ZSBpbnN0YW5jZW9mIElkZW50aXR5IHx8IHZhbHVlIGluc3RhbmNlb2YgQ29ubmVjdGlvbklkIHx8IHZhbHVlIGluc3RhbmNlb2YgVXVpZCkge1xuICAgIHJldHVybiBgMHgke3ZhbHVlLnRvSGV4U3RyaW5nKCl9YDtcbiAgfVxuICBpZiAodmFsdWUgaW5zdGFuY2VvZiBUaW1lc3RhbXApIHtcbiAgICByZXR1cm4gYCcke3ZhbHVlLnRvSVNPU3RyaW5nKCl9J2A7XG4gIH1cbiAgc3dpdGNoICh0eXBlb2YgdmFsdWUpIHtcbiAgICBjYXNlIFwibnVtYmVyXCI6XG4gICAgY2FzZSBcImJpZ2ludFwiOlxuICAgICAgcmV0dXJuIFN0cmluZyh2YWx1ZSk7XG4gICAgY2FzZSBcImJvb2xlYW5cIjpcbiAgICAgIHJldHVybiB2YWx1ZSA/IFwiVFJVRVwiIDogXCJGQUxTRVwiO1xuICAgIGNhc2UgXCJzdHJpbmdcIjpcbiAgICAgIHJldHVybiBgJyR7dmFsdWUucmVwbGFjZSgvJy9nLCBcIicnXCIpfSdgO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gYCcke0pTT04uc3RyaW5naWZ5KHZhbHVlKS5yZXBsYWNlKC8nL2csIFwiJydcIil9J2A7XG4gIH1cbn1cbmZ1bmN0aW9uIHF1b3RlSWRlbnRpZmllcihuYW1lKSB7XG4gIHJldHVybiBuYW1lLnNwbGl0KFwiLlwiKS5tYXAoKHBhcnQpID0+IGBcIiR7cGFydC5yZXBsYWNlKC9cIi9nLCAnXCJcIicpfVwiYCkuam9pbihcIi5cIik7XG59XG5mdW5jdGlvbiBpc0xpdGVyYWxFeHByKGV4cHIpIHtcbiAgcmV0dXJuIGV4cHIudHlwZSA9PT0gXCJsaXRlcmFsXCI7XG59XG5mdW5jdGlvbiBldmFsdWF0ZUJvb2xlYW5FeHByKGV4cHIsIHJvdykge1xuICByZXR1cm4gZXZhbHVhdGVEYXRhKGV4cHIuZGF0YSwgcm93KTtcbn1cbmZ1bmN0aW9uIGV2YWx1YXRlRGF0YShkYXRhLCByb3cpIHtcbiAgc3dpdGNoIChkYXRhLnR5cGUpIHtcbiAgICBjYXNlIFwiZXFcIjpcbiAgICAgIHJldHVybiByZXNvbHZlVmFsdWUoZGF0YS5sZWZ0LCByb3cpID09PSByZXNvbHZlVmFsdWUoZGF0YS5yaWdodCwgcm93KTtcbiAgICBjYXNlIFwibmVcIjpcbiAgICAgIHJldHVybiByZXNvbHZlVmFsdWUoZGF0YS5sZWZ0LCByb3cpICE9PSByZXNvbHZlVmFsdWUoZGF0YS5yaWdodCwgcm93KTtcbiAgICBjYXNlIFwiZ3RcIjpcbiAgICAgIHJldHVybiByZXNvbHZlVmFsdWUoZGF0YS5sZWZ0LCByb3cpID4gcmVzb2x2ZVZhbHVlKGRhdGEucmlnaHQsIHJvdyk7XG4gICAgY2FzZSBcImd0ZVwiOlxuICAgICAgcmV0dXJuIHJlc29sdmVWYWx1ZShkYXRhLmxlZnQsIHJvdykgPj0gcmVzb2x2ZVZhbHVlKGRhdGEucmlnaHQsIHJvdyk7XG4gICAgY2FzZSBcImx0XCI6XG4gICAgICByZXR1cm4gcmVzb2x2ZVZhbHVlKGRhdGEubGVmdCwgcm93KSA8IHJlc29sdmVWYWx1ZShkYXRhLnJpZ2h0LCByb3cpO1xuICAgIGNhc2UgXCJsdGVcIjpcbiAgICAgIHJldHVybiByZXNvbHZlVmFsdWUoZGF0YS5sZWZ0LCByb3cpIDw9IHJlc29sdmVWYWx1ZShkYXRhLnJpZ2h0LCByb3cpO1xuICAgIGNhc2UgXCJhbmRcIjpcbiAgICAgIHJldHVybiBkYXRhLmNsYXVzZXMuZXZlcnkoKGMpID0+IGV2YWx1YXRlRGF0YShjLCByb3cpKTtcbiAgICBjYXNlIFwib3JcIjpcbiAgICAgIHJldHVybiBkYXRhLmNsYXVzZXMuc29tZSgoYykgPT4gZXZhbHVhdGVEYXRhKGMsIHJvdykpO1xuICAgIGNhc2UgXCJub3RcIjpcbiAgICAgIHJldHVybiAhZXZhbHVhdGVEYXRhKGRhdGEuY2xhdXNlLCByb3cpO1xuICB9XG59XG5mdW5jdGlvbiByZXNvbHZlVmFsdWUoZXhwciwgcm93KSB7XG4gIGlmIChpc0xpdGVyYWxFeHByKGV4cHIpKSB7XG4gICAgcmV0dXJuIHRvQ29tcGFyYWJsZVZhbHVlKGV4cHIudmFsdWUpO1xuICB9XG4gIHJldHVybiB0b0NvbXBhcmFibGVWYWx1ZShyb3dbZXhwci5jb2x1bW5dKTtcbn1cbmZ1bmN0aW9uIGlzSGV4U2VyaWFsaXphYmxlTGlrZSh2YWx1ZSkge1xuICByZXR1cm4gISF2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHZhbHVlLnRvSGV4U3RyaW5nID09PSBcImZ1bmN0aW9uXCI7XG59XG5mdW5jdGlvbiBpc1RpbWVzdGFtcExpa2UodmFsdWUpIHtcbiAgaWYgKCF2YWx1ZSB8fCB0eXBlb2YgdmFsdWUgIT09IFwib2JqZWN0XCIpIHJldHVybiBmYWxzZTtcbiAgaWYgKHZhbHVlIGluc3RhbmNlb2YgVGltZXN0YW1wKSByZXR1cm4gdHJ1ZTtcbiAgY29uc3QgbWljcm9zID0gdmFsdWVbXCJfX3RpbWVzdGFtcF9taWNyb3Nfc2luY2VfdW5peF9lcG9jaF9fXCJdO1xuICByZXR1cm4gdHlwZW9mIG1pY3JvcyA9PT0gXCJiaWdpbnRcIjtcbn1cbmZ1bmN0aW9uIHRvQ29tcGFyYWJsZVZhbHVlKHZhbHVlKSB7XG4gIGlmIChpc0hleFNlcmlhbGl6YWJsZUxpa2UodmFsdWUpKSB7XG4gICAgcmV0dXJuIHZhbHVlLnRvSGV4U3RyaW5nKCk7XG4gIH1cbiAgaWYgKGlzVGltZXN0YW1wTGlrZSh2YWx1ZSkpIHtcbiAgICByZXR1cm4gdmFsdWUuX190aW1lc3RhbXBfbWljcm9zX3NpbmNlX3VuaXhfZXBvY2hfXztcbiAgfVxuICByZXR1cm4gdmFsdWU7XG59XG5mdW5jdGlvbiBnZXRRdWVyeVRhYmxlTmFtZShxdWVyeSkge1xuICBpZiAocXVlcnkudGFibGUpIHJldHVybiBxdWVyeS50YWJsZS5uYW1lO1xuICBpZiAocXVlcnkubmFtZSkgcmV0dXJuIHF1ZXJ5Lm5hbWU7XG4gIGlmIChxdWVyeS5zb3VyY2VRdWVyeSkgcmV0dXJuIHF1ZXJ5LnNvdXJjZVF1ZXJ5LnRhYmxlLm5hbWU7XG4gIHRocm93IG5ldyBFcnJvcihcIkNhbm5vdCBleHRyYWN0IHRhYmxlIG5hbWUgZnJvbSBxdWVyeVwiKTtcbn1cbmZ1bmN0aW9uIGdldFF1ZXJ5QWNjZXNzb3JOYW1lKHF1ZXJ5KSB7XG4gIGlmIChxdWVyeS50YWJsZSkgcmV0dXJuIHF1ZXJ5LnRhYmxlLmFjY2Vzc29yTmFtZTtcbiAgaWYgKHF1ZXJ5LmFjY2Vzc29yTmFtZSkgcmV0dXJuIHF1ZXJ5LmFjY2Vzc29yTmFtZTtcbiAgaWYgKHF1ZXJ5LnNvdXJjZVF1ZXJ5KSByZXR1cm4gcXVlcnkuc291cmNlUXVlcnkudGFibGUuYWNjZXNzb3JOYW1lO1xuICB0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZXh0cmFjdCBhY2Nlc3NvciBuYW1lIGZyb20gcXVlcnlcIik7XG59XG5mdW5jdGlvbiBnZXRRdWVyeVdoZXJlQ2xhdXNlKHF1ZXJ5KSB7XG4gIGlmIChxdWVyeS53aGVyZUNsYXVzZSkgcmV0dXJuIHF1ZXJ5LndoZXJlQ2xhdXNlO1xuICByZXR1cm4gdm9pZCAwO1xufVxuXG4vLyBzcmMvc2VydmVyL3ZpZXdzLnRzXG5mdW5jdGlvbiBtYWtlVmlld0V4cG9ydChjdHgsIG9wdHMsIHBhcmFtcywgcmV0LCBmbikge1xuICBjb25zdCB2aWV3RXhwb3J0ID0gKFxuICAgIC8vIEB0cy1leHBlY3QtZXJyb3IgdHlwZXNjcmlwdCBpbmNvcnJlY3RseSBzYXlzIEZ1bmN0aW9uI2JpbmQgcmVxdWlyZXMgYW4gYXJndW1lbnQuXG4gICAgZm4uYmluZCgpXG4gICk7XG4gIHZpZXdFeHBvcnRbZXhwb3J0Q29udGV4dF0gPSBjdHg7XG4gIHZpZXdFeHBvcnRbcmVnaXN0ZXJFeHBvcnRdID0gKGN0eDIsIGV4cG9ydE5hbWUpID0+IHtcbiAgICByZWdpc3RlclZpZXcoY3R4Miwgb3B0cywgZXhwb3J0TmFtZSwgcGFyYW1zLCByZXQsIGZuKTtcbiAgfTtcbiAgcmV0dXJuIHZpZXdFeHBvcnQ7XG59XG5mdW5jdGlvbiBtYWtlQW5vblZpZXdFeHBvcnQoY3R4LCBvcHRzLCBwYXJhbXMsIHJldCwgZm4pIHtcbiAgY29uc3Qgdmlld0V4cG9ydCA9IChcbiAgICAvLyBAdHMtZXhwZWN0LWVycm9yIHR5cGVzY3JpcHQgaW5jb3JyZWN0bHkgc2F5cyBGdW5jdGlvbiNiaW5kIHJlcXVpcmVzIGFuIGFyZ3VtZW50LlxuICAgIGZuLmJpbmQoKVxuICApO1xuICB2aWV3RXhwb3J0W2V4cG9ydENvbnRleHRdID0gY3R4O1xuICB2aWV3RXhwb3J0W3JlZ2lzdGVyRXhwb3J0XSA9IChjdHgyLCBleHBvcnROYW1lKSA9PiB7XG4gICAgcmVnaXN0ZXJBbm9ueW1vdXNWaWV3KGN0eDIsIG9wdHMsIGV4cG9ydE5hbWUsIHBhcmFtcywgcmV0LCBmbik7XG4gIH07XG4gIHJldHVybiB2aWV3RXhwb3J0O1xufVxuZnVuY3Rpb24gcmVnaXN0ZXJWaWV3KGN0eCwgb3B0cywgZXhwb3J0TmFtZSwgcGFyYW1zLCByZXQsIGZuKSB7XG4gIGNvbnN0IGRlc2NyaWJlZCA9IGRlc2NyaWJlVmlldyhjdHgsIG9wdHMsIGV4cG9ydE5hbWUsIGZhbHNlLCBwYXJhbXMsIHJldCk7XG4gIGN0eC52aWV3cy5wdXNoKGJ1aWxkVmlld0luZm8oY3R4LCBkZXNjcmliZWQsIGZuKSk7XG59XG5mdW5jdGlvbiByZWdpc3RlckFub255bW91c1ZpZXcoY3R4LCBvcHRzLCBleHBvcnROYW1lLCBwYXJhbXMsIHJldCwgZm4pIHtcbiAgY29uc3QgZGVzY3JpYmVkID0gZGVzY3JpYmVWaWV3KGN0eCwgb3B0cywgZXhwb3J0TmFtZSwgdHJ1ZSwgcGFyYW1zLCByZXQpO1xuICBjdHguYW5vblZpZXdzLnB1c2goYnVpbGRWaWV3SW5mbyhjdHgsIGRlc2NyaWJlZCwgZm4pKTtcbn1cbmZ1bmN0aW9uIGRlc2NyaWJlVmlldyhjdHgsIG9wdHMsIGV4cG9ydE5hbWUsIGFub24sIHBhcmFtcywgcmV0KSB7XG4gIGN0eC5kZWZpbmVGdW5jdGlvbihleHBvcnROYW1lKTtcbiAgY29uc3QgcGFyYW1zQnVpbGRlciA9IG5ldyBSb3dCdWlsZGVyKHBhcmFtcywgdG9QYXNjYWxDYXNlKGV4cG9ydE5hbWUpKTtcbiAgbGV0IHJldHVyblR5cGUgPSBjdHgucmVnaXN0ZXJUeXBlc1JlY3Vyc2l2ZWx5KHJldCkuYWxnZWJyYWljVHlwZTtcbiAgY29uc3QgeyB2YWx1ZTogcGFyYW1UeXBlIH0gPSBjdHgucmVzb2x2ZVR5cGUoXG4gICAgY3R4LnJlZ2lzdGVyVHlwZXNSZWN1cnNpdmVseShwYXJhbXNCdWlsZGVyKVxuICApO1xuICBjdHgubW9kdWxlRGVmLnZpZXdzLnB1c2goe1xuICAgIHNvdXJjZU5hbWU6IGV4cG9ydE5hbWUsXG4gICAgaW5kZXg6IChhbm9uID8gY3R4LmFub25WaWV3cyA6IGN0eC52aWV3cykubGVuZ3RoLFxuICAgIGlzUHVibGljOiBvcHRzLnB1YmxpYyxcbiAgICBpc0Fub255bW91czogYW5vbixcbiAgICBwYXJhbXM6IHBhcmFtVHlwZSxcbiAgICByZXR1cm5UeXBlXG4gIH0pO1xuICBjb25zdCBwcmltYXJ5S2V5Q29sdW1ucyA9IHZpZXdQcmltYXJ5S2V5Q29sdW1ucyhyZXQpO1xuICBpZiAocHJpbWFyeUtleUNvbHVtbnMubGVuZ3RoID4gMSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICBgVmlldyAnJHtleHBvcnROYW1lfScgY2FuIGhhdmUgYXQgbW9zdCBvbmUgcHJpbWFyeUtleSgpIGNvbHVtbiBvbiBpdHMgcmV0dXJuZWQgcm93IHR5cGU7IGZvdW5kICR7cHJpbWFyeUtleUNvbHVtbnMuam9pbihcIiwgXCIpfWBcbiAgICApO1xuICB9XG4gIGlmIChwcmltYXJ5S2V5Q29sdW1ucy5sZW5ndGggPT09IDEgJiYgcGFyYW1UeXBlLmVsZW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGN0eC5tb2R1bGVEZWYudmlld1ByaW1hcnlLZXlzLnB1c2goe1xuICAgICAgdmlld1NvdXJjZU5hbWU6IGV4cG9ydE5hbWUsXG4gICAgICBjb2x1bW5zOiBwcmltYXJ5S2V5Q29sdW1uc1xuICAgIH0pO1xuICB9XG4gIGlmIChvcHRzLm5hbWUgIT0gbnVsbCkge1xuICAgIGN0eC5tb2R1bGVEZWYuZXhwbGljaXROYW1lcy5lbnRyaWVzLnB1c2goe1xuICAgICAgdGFnOiBcIkZ1bmN0aW9uXCIsXG4gICAgICB2YWx1ZToge1xuICAgICAgICBzb3VyY2VOYW1lOiBleHBvcnROYW1lLFxuICAgICAgICBjYW5vbmljYWxOYW1lOiBvcHRzLm5hbWVcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuICBjb25zdCB3cmFwT3B0aW9uID0gcmV0dXJuVHlwZS50YWcgPT0gXCJTdW1cIjtcbiAgaWYgKHJldHVyblR5cGUudGFnID09IFwiU3VtXCIpIHtcbiAgICByZXR1cm5UeXBlID0gQWxnZWJyYWljVHlwZS5BcnJheShcbiAgICAgIHJldHVyblR5cGUudmFsdWUudmFyaWFudHNbMF0uYWxnZWJyYWljVHlwZVxuICAgICk7XG4gIH1cbiAgcmV0dXJuIHsgcGFyYW1UeXBlLCByZXR1cm5UeXBlLCB3cmFwT3B0aW9uIH07XG59XG5mdW5jdGlvbiBidWlsZFZpZXdJbmZvKGN0eCwgeyBwYXJhbVR5cGUsIHJldHVyblR5cGUsIHdyYXBPcHRpb24gfSwgZm4pIHtcbiAgY29uc3QgeyB0eXBlc3BhY2UgfSA9IGN0eDtcbiAgcmV0dXJuIHtcbiAgICBmbjogd3JhcE9wdGlvbiA/ICgodmlld0N0eCwgYXJncykgPT4ge1xuICAgICAgY29uc3QgcmV0ID0gZm4odmlld0N0eCwgYXJncyk7XG4gICAgICByZXR1cm4gcmV0ID09IG51bGwgPyBbXSA6IFtyZXRdO1xuICAgIH0pIDogZm4sXG4gICAgZGVzZXJpYWxpemVQYXJhbXM6IFByb2R1Y3RUeXBlLm1ha2VEZXNlcmlhbGl6ZXIocGFyYW1UeXBlLCB0eXBlc3BhY2UpLFxuICAgIHNlcmlhbGl6ZVJldHVybjogQWxnZWJyYWljVHlwZS5tYWtlU2VyaWFsaXplcihyZXR1cm5UeXBlLCB0eXBlc3BhY2UpLFxuICAgIHJldHVyblR5cGVCYXNlU2l6ZTogYnNhdG5CYXNlU2l6ZSh0eXBlc3BhY2UsIHJldHVyblR5cGUpXG4gIH07XG59XG5mdW5jdGlvbiB2aWV3UHJpbWFyeUtleUNvbHVtbnMocmV0KSB7XG4gIGNvbnN0IHJvdyA9IHZpZXdSZXR1cm5Sb3cocmV0KTtcbiAgaWYgKHJvdyA9PSBudWxsKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG4gIHJldHVybiBPYmplY3QuZW50cmllcyhyb3cucm93KS5maWx0ZXIoXG4gICAgKGVudHJ5KSA9PiBlbnRyeVsxXS5jb2x1bW5NZXRhZGF0YS5pc1ByaW1hcnlLZXkgPT09IHRydWVcbiAgKS5tYXAoKFtuYW1lXSkgPT4gbmFtZSk7XG59XG5mdW5jdGlvbiB2aWV3UmV0dXJuUm93KHJldCkge1xuICBpZiAocmV0IGluc3RhbmNlb2YgQXJyYXlCdWlsZGVyICYmIHJldC5lbGVtZW50IGluc3RhbmNlb2YgUm93QnVpbGRlcikge1xuICAgIHJldHVybiByZXQuZWxlbWVudDtcbiAgfVxuICBpZiAocmV0IGluc3RhbmNlb2YgT3B0aW9uQnVpbGRlciAmJiByZXQudmFsdWUgaW5zdGFuY2VvZiBSb3dCdWlsZGVyKSB7XG4gICAgcmV0dXJuIHJldC52YWx1ZTtcbiAgfVxuICByZXR1cm4gdm9pZCAwO1xufVxuXG4vLyBzcmMvbGliL2Vycm9ycy50c1xudmFyIFNlbmRlckVycm9yID0gY2xhc3MgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG1lc3NhZ2UpIHtcbiAgICBzdXBlcihtZXNzYWdlKTtcbiAgfVxuICBnZXQgbmFtZSgpIHtcbiAgICByZXR1cm4gXCJTZW5kZXJFcnJvclwiO1xuICB9XG59O1xuXG4vLyBzcmMvc2VydmVyL2Vycm9ycy50c1xudmFyIFNwYWNldGltZUhvc3RFcnJvciA9IGNsYXNzIGV4dGVuZHMgRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihtZXNzYWdlKSB7XG4gICAgc3VwZXIobWVzc2FnZSk7XG4gIH1cbiAgZ2V0IG5hbWUoKSB7XG4gICAgcmV0dXJuIFwiU3BhY2V0aW1lSG9zdEVycm9yXCI7XG4gIH1cbn07XG52YXIgZXJyb3JEYXRhID0ge1xuICAvKipcbiAgICogQSBnZW5lcmljIGVycm9yIGNsYXNzIGZvciB1bmtub3duIGVycm9yIGNvZGVzLlxuICAgKi9cbiAgSG9zdENhbGxGYWlsdXJlOiAxLFxuICAvKipcbiAgICogRXJyb3IgaW5kaWNhdGluZyB0aGF0IGFuIEFCSSBjYWxsIHdhcyBtYWRlIG91dHNpZGUgb2YgYSB0cmFuc2FjdGlvbi5cbiAgICovXG4gIE5vdEluVHJhbnNhY3Rpb246IDIsXG4gIC8qKlxuICAgKiBFcnJvciBpbmRpY2F0aW5nIHRoYXQgQlNBVE4gZGVjb2RpbmcgZmFpbGVkLlxuICAgKiBUaGlzIHR5cGljYWxseSBtZWFucyB0aGF0IHRoZSBkYXRhIGNvdWxkIG5vdCBiZSBkZWNvZGVkIHRvIHRoZSBleHBlY3RlZCB0eXBlLlxuICAgKi9cbiAgQnNhdG5EZWNvZGVFcnJvcjogMyxcbiAgLyoqXG4gICAqIEVycm9yIGluZGljYXRpbmcgdGhhdCBhIHNwZWNpZmllZCB0YWJsZSBkb2VzIG5vdCBleGlzdC5cbiAgICovXG4gIE5vU3VjaFRhYmxlOiA0LFxuICAvKipcbiAgICogRXJyb3IgaW5kaWNhdGluZyB0aGF0IGEgc3BlY2lmaWVkIGluZGV4IGRvZXMgbm90IGV4aXN0LlxuICAgKi9cbiAgTm9TdWNoSW5kZXg6IDUsXG4gIC8qKlxuICAgKiBFcnJvciBpbmRpY2F0aW5nIHRoYXQgYSBzcGVjaWZpZWQgcm93IGl0ZXJhdG9yIGlzIG5vdCB2YWxpZC5cbiAgICovXG4gIE5vU3VjaEl0ZXI6IDYsXG4gIC8qKlxuICAgKiBFcnJvciBpbmRpY2F0aW5nIHRoYXQgYSBzcGVjaWZpZWQgY29uc29sZSB0aW1lciBkb2VzIG5vdCBleGlzdC5cbiAgICovXG4gIE5vU3VjaENvbnNvbGVUaW1lcjogNyxcbiAgLyoqXG4gICAqIEVycm9yIGluZGljYXRpbmcgdGhhdCBhIHNwZWNpZmllZCBieXRlcyBzb3VyY2Ugb3Igc2luayBpcyBub3QgdmFsaWQuXG4gICAqL1xuICBOb1N1Y2hCeXRlczogOCxcbiAgLyoqXG4gICAqIEVycm9yIGluZGljYXRpbmcgdGhhdCBhIHByb3ZpZGVkIHNpbmsgaGFzIG5vIG1vcmUgc3BhY2UgbGVmdC5cbiAgICovXG4gIE5vU3BhY2U6IDksXG4gIC8qKlxuICAgKiBFcnJvciBpbmRpY2F0aW5nIHRoYXQgdGhlcmUgaXMgbm8gbW9yZSBzcGFjZSBpbiB0aGUgZGF0YWJhc2UuXG4gICAqL1xuICBCdWZmZXJUb29TbWFsbDogMTEsXG4gIC8qKlxuICAgKiBFcnJvciBpbmRpY2F0aW5nIHRoYXQgYSB2YWx1ZSB3aXRoIGEgZ2l2ZW4gdW5pcXVlIGlkZW50aWZpZXIgYWxyZWFkeSBleGlzdHMuXG4gICAqL1xuICBVbmlxdWVBbHJlYWR5RXhpc3RzOiAxMixcbiAgLyoqXG4gICAqIEVycm9yIGluZGljYXRpbmcgdGhhdCB0aGUgc3BlY2lmaWVkIGRlbGF5IGluIHNjaGVkdWxpbmcgYSByb3cgd2FzIHRvbyBsb25nLlxuICAgKi9cbiAgU2NoZWR1bGVBdERlbGF5VG9vTG9uZzogMTMsXG4gIC8qKlxuICAgKiBFcnJvciBpbmRpY2F0aW5nIHRoYXQgYW4gaW5kZXggd2FzIG5vdCB1bmlxdWUgd2hlbiBpdCB3YXMgZXhwZWN0ZWQgdG8gYmUuXG4gICAqL1xuICBJbmRleE5vdFVuaXF1ZTogMTQsXG4gIC8qKlxuICAgKiBFcnJvciBpbmRpY2F0aW5nIHRoYXQgYW4gaW5kZXggd2FzIG5vdCB1bmlxdWUgd2hlbiBpdCB3YXMgZXhwZWN0ZWQgdG8gYmUuXG4gICAqL1xuICBOb1N1Y2hSb3c6IDE1LFxuICAvKipcbiAgICogRXJyb3IgaW5kaWNhdGluZyB0aGF0IGFuIGF1dG8taW5jcmVtZW50IHNlcXVlbmNlIGhhcyBvdmVyZmxvd2VkLlxuICAgKi9cbiAgQXV0b0luY092ZXJmbG93OiAxNixcbiAgV291bGRCbG9ja1RyYW5zYWN0aW9uOiAxNyxcbiAgVHJhbnNhY3Rpb25Ob3RBbm9ueW1vdXM6IDE4LFxuICBUcmFuc2FjdGlvbklzUmVhZE9ubHk6IDE5LFxuICBUcmFuc2FjdGlvbklzTXV0OiAyMCxcbiAgSHR0cEVycm9yOiAyMVxufTtcbmZ1bmN0aW9uIG1hcEVudHJpZXMoeCwgZikge1xuICByZXR1cm4gT2JqZWN0LmZyb21FbnRyaWVzKFxuICAgIE9iamVjdC5lbnRyaWVzKHgpLm1hcCgoW2ssIHZdKSA9PiBbaywgZihrLCB2KV0pXG4gICk7XG59XG52YXIgZXJybm9Ub0NsYXNzID0gLyogQF9fUFVSRV9fICovIG5ldyBNYXAoKTtcbnZhciBlcnJvcnMgPSBPYmplY3QuZnJlZXplKFxuICBtYXBFbnRyaWVzKGVycm9yRGF0YSwgKG5hbWUsIGNvZGUpID0+IHtcbiAgICBjb25zdCBjbHMgPSBPYmplY3QuZGVmaW5lUHJvcGVydHkoXG4gICAgICBjbGFzcyBleHRlbmRzIFNwYWNldGltZUhvc3RFcnJvciB7XG4gICAgICAgIGdldCBuYW1lKCkge1xuICAgICAgICAgIHJldHVybiBuYW1lO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgXCJuYW1lXCIsXG4gICAgICB7IHZhbHVlOiBuYW1lLCB3cml0YWJsZTogZmFsc2UgfVxuICAgICk7XG4gICAgZXJybm9Ub0NsYXNzLnNldChjb2RlLCBjbHMpO1xuICAgIHJldHVybiBjbHM7XG4gIH0pXG4pO1xuZnVuY3Rpb24gZ2V0RXJyb3JDb25zdHJ1Y3Rvcihjb2RlKSB7XG4gIHJldHVybiBlcnJub1RvQ2xhc3MuZ2V0KGNvZGUpID8/IFNwYWNldGltZUhvc3RFcnJvcjtcbn1cblxuLy8gLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3B1cmUtcmFuZEA3LjAuMS9ub2RlX21vZHVsZXMvcHVyZS1yYW5kL2xpYi9lc20vZGlzdHJpYnV0aW9uL1Vuc2FmZVVuaWZvcm1CaWdJbnREaXN0cmlidXRpb24uanNcbnZhciBTQmlnSW50ID0gdHlwZW9mIEJpZ0ludCAhPT0gXCJ1bmRlZmluZWRcIiA/IEJpZ0ludCA6IHZvaWQgMDtcbnZhciBPbmUgPSB0eXBlb2YgQmlnSW50ICE9PSBcInVuZGVmaW5lZFwiID8gQmlnSW50KDEpIDogdm9pZCAwO1xudmFyIFRoaXJ0eVR3byA9IHR5cGVvZiBCaWdJbnQgIT09IFwidW5kZWZpbmVkXCIgPyBCaWdJbnQoMzIpIDogdm9pZCAwO1xudmFyIE51bVZhbHVlcyA9IHR5cGVvZiBCaWdJbnQgIT09IFwidW5kZWZpbmVkXCIgPyBCaWdJbnQoNDI5NDk2NzI5NikgOiB2b2lkIDA7XG5mdW5jdGlvbiB1bnNhZmVVbmlmb3JtQmlnSW50RGlzdHJpYnV0aW9uKGZyb20sIHRvLCBybmcpIHtcbiAgdmFyIGRpZmYgPSB0byAtIGZyb20gKyBPbmU7XG4gIHZhciBGaW5hbE51bVZhbHVlcyA9IE51bVZhbHVlcztcbiAgdmFyIE51bUl0ZXJhdGlvbnMgPSAxO1xuICB3aGlsZSAoRmluYWxOdW1WYWx1ZXMgPCBkaWZmKSB7XG4gICAgRmluYWxOdW1WYWx1ZXMgPDw9IFRoaXJ0eVR3bztcbiAgICArK051bUl0ZXJhdGlvbnM7XG4gIH1cbiAgdmFyIHZhbHVlID0gZ2VuZXJhdGVOZXh0KE51bUl0ZXJhdGlvbnMsIHJuZyk7XG4gIGlmICh2YWx1ZSA8IGRpZmYpIHtcbiAgICByZXR1cm4gdmFsdWUgKyBmcm9tO1xuICB9XG4gIGlmICh2YWx1ZSArIGRpZmYgPCBGaW5hbE51bVZhbHVlcykge1xuICAgIHJldHVybiB2YWx1ZSAlIGRpZmYgKyBmcm9tO1xuICB9XG4gIHZhciBNYXhBY2NlcHRlZFJhbmRvbSA9IEZpbmFsTnVtVmFsdWVzIC0gRmluYWxOdW1WYWx1ZXMgJSBkaWZmO1xuICB3aGlsZSAodmFsdWUgPj0gTWF4QWNjZXB0ZWRSYW5kb20pIHtcbiAgICB2YWx1ZSA9IGdlbmVyYXRlTmV4dChOdW1JdGVyYXRpb25zLCBybmcpO1xuICB9XG4gIHJldHVybiB2YWx1ZSAlIGRpZmYgKyBmcm9tO1xufVxuZnVuY3Rpb24gZ2VuZXJhdGVOZXh0KE51bUl0ZXJhdGlvbnMsIHJuZykge1xuICB2YXIgdmFsdWUgPSBTQmlnSW50KHJuZy51bnNhZmVOZXh0KCkgKyAyMTQ3NDgzNjQ4KTtcbiAgZm9yICh2YXIgbnVtID0gMTsgbnVtIDwgTnVtSXRlcmF0aW9uczsgKytudW0pIHtcbiAgICB2YXIgb3V0ID0gcm5nLnVuc2FmZU5leHQoKTtcbiAgICB2YWx1ZSA9ICh2YWx1ZSA8PCBUaGlydHlUd28pICsgU0JpZ0ludChvdXQgKyAyMTQ3NDgzNjQ4KTtcbiAgfVxuICByZXR1cm4gdmFsdWU7XG59XG5cbi8vIC4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9wdXJlLXJhbmRANy4wLjEvbm9kZV9tb2R1bGVzL3B1cmUtcmFuZC9saWIvZXNtL2Rpc3RyaWJ1dGlvbi9pbnRlcm5hbHMvVW5zYWZlVW5pZm9ybUludERpc3RyaWJ1dGlvbkludGVybmFsLmpzXG5mdW5jdGlvbiB1bnNhZmVVbmlmb3JtSW50RGlzdHJpYnV0aW9uSW50ZXJuYWwocmFuZ2VTaXplLCBybmcpIHtcbiAgdmFyIE1heEFsbG93ZWQgPSByYW5nZVNpemUgPiAyID8gfn4oNDI5NDk2NzI5NiAvIHJhbmdlU2l6ZSkgKiByYW5nZVNpemUgOiA0Mjk0OTY3Mjk2O1xuICB2YXIgZGVsdGFWID0gcm5nLnVuc2FmZU5leHQoKSArIDIxNDc0ODM2NDg7XG4gIHdoaWxlIChkZWx0YVYgPj0gTWF4QWxsb3dlZCkge1xuICAgIGRlbHRhViA9IHJuZy51bnNhZmVOZXh0KCkgKyAyMTQ3NDgzNjQ4O1xuICB9XG4gIHJldHVybiBkZWx0YVYgJSByYW5nZVNpemU7XG59XG5cbi8vIC4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9wdXJlLXJhbmRANy4wLjEvbm9kZV9tb2R1bGVzL3B1cmUtcmFuZC9saWIvZXNtL2Rpc3RyaWJ1dGlvbi9pbnRlcm5hbHMvQXJyYXlJbnQ2NC5qc1xuZnVuY3Rpb24gZnJvbU51bWJlclRvQXJyYXlJbnQ2NChvdXQsIG4pIHtcbiAgaWYgKG4gPCAwKSB7XG4gICAgdmFyIHBvc04gPSAtbjtcbiAgICBvdXQuc2lnbiA9IC0xO1xuICAgIG91dC5kYXRhWzBdID0gfn4ocG9zTiAvIDQyOTQ5NjcyOTYpO1xuICAgIG91dC5kYXRhWzFdID0gcG9zTiA+Pj4gMDtcbiAgfSBlbHNlIHtcbiAgICBvdXQuc2lnbiA9IDE7XG4gICAgb3V0LmRhdGFbMF0gPSB+fihuIC8gNDI5NDk2NzI5Nik7XG4gICAgb3V0LmRhdGFbMV0gPSBuID4+PiAwO1xuICB9XG4gIHJldHVybiBvdXQ7XG59XG5mdW5jdGlvbiBzdWJzdHJhY3RBcnJheUludDY0KG91dCwgYXJyYXlJbnRBLCBhcnJheUludEIpIHtcbiAgdmFyIGxvd0EgPSBhcnJheUludEEuZGF0YVsxXTtcbiAgdmFyIGhpZ2hBID0gYXJyYXlJbnRBLmRhdGFbMF07XG4gIHZhciBzaWduQSA9IGFycmF5SW50QS5zaWduO1xuICB2YXIgbG93QiA9IGFycmF5SW50Qi5kYXRhWzFdO1xuICB2YXIgaGlnaEIgPSBhcnJheUludEIuZGF0YVswXTtcbiAgdmFyIHNpZ25CID0gYXJyYXlJbnRCLnNpZ247XG4gIG91dC5zaWduID0gMTtcbiAgaWYgKHNpZ25BID09PSAxICYmIHNpZ25CID09PSAtMSkge1xuICAgIHZhciBsb3dfMSA9IGxvd0EgKyBsb3dCO1xuICAgIHZhciBoaWdoID0gaGlnaEEgKyBoaWdoQiArIChsb3dfMSA+IDQyOTQ5NjcyOTUgPyAxIDogMCk7XG4gICAgb3V0LmRhdGFbMF0gPSBoaWdoID4+PiAwO1xuICAgIG91dC5kYXRhWzFdID0gbG93XzEgPj4+IDA7XG4gICAgcmV0dXJuIG91dDtcbiAgfVxuICB2YXIgbG93Rmlyc3QgPSBsb3dBO1xuICB2YXIgaGlnaEZpcnN0ID0gaGlnaEE7XG4gIHZhciBsb3dTZWNvbmQgPSBsb3dCO1xuICB2YXIgaGlnaFNlY29uZCA9IGhpZ2hCO1xuICBpZiAoc2lnbkEgPT09IC0xKSB7XG4gICAgbG93Rmlyc3QgPSBsb3dCO1xuICAgIGhpZ2hGaXJzdCA9IGhpZ2hCO1xuICAgIGxvd1NlY29uZCA9IGxvd0E7XG4gICAgaGlnaFNlY29uZCA9IGhpZ2hBO1xuICB9XG4gIHZhciByZW1pbmRlckxvdyA9IDA7XG4gIHZhciBsb3cgPSBsb3dGaXJzdCAtIGxvd1NlY29uZDtcbiAgaWYgKGxvdyA8IDApIHtcbiAgICByZW1pbmRlckxvdyA9IDE7XG4gICAgbG93ID0gbG93ID4+PiAwO1xuICB9XG4gIG91dC5kYXRhWzBdID0gaGlnaEZpcnN0IC0gaGlnaFNlY29uZCAtIHJlbWluZGVyTG93O1xuICBvdXQuZGF0YVsxXSA9IGxvdztcbiAgcmV0dXJuIG91dDtcbn1cblxuLy8gLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3B1cmUtcmFuZEA3LjAuMS9ub2RlX21vZHVsZXMvcHVyZS1yYW5kL2xpYi9lc20vZGlzdHJpYnV0aW9uL2ludGVybmFscy9VbnNhZmVVbmlmb3JtQXJyYXlJbnREaXN0cmlidXRpb25JbnRlcm5hbC5qc1xuZnVuY3Rpb24gdW5zYWZlVW5pZm9ybUFycmF5SW50RGlzdHJpYnV0aW9uSW50ZXJuYWwob3V0LCByYW5nZVNpemUsIHJuZykge1xuICB2YXIgcmFuZ2VMZW5ndGggPSByYW5nZVNpemUubGVuZ3RoO1xuICB3aGlsZSAodHJ1ZSkge1xuICAgIGZvciAodmFyIGluZGV4ID0gMDsgaW5kZXggIT09IHJhbmdlTGVuZ3RoOyArK2luZGV4KSB7XG4gICAgICB2YXIgaW5kZXhSYW5nZVNpemUgPSBpbmRleCA9PT0gMCA/IHJhbmdlU2l6ZVswXSArIDEgOiA0Mjk0OTY3Mjk2O1xuICAgICAgdmFyIGcgPSB1bnNhZmVVbmlmb3JtSW50RGlzdHJpYnV0aW9uSW50ZXJuYWwoaW5kZXhSYW5nZVNpemUsIHJuZyk7XG4gICAgICBvdXRbaW5kZXhdID0gZztcbiAgICB9XG4gICAgZm9yICh2YXIgaW5kZXggPSAwOyBpbmRleCAhPT0gcmFuZ2VMZW5ndGg7ICsraW5kZXgpIHtcbiAgICAgIHZhciBjdXJyZW50ID0gb3V0W2luZGV4XTtcbiAgICAgIHZhciBjdXJyZW50SW5SYW5nZSA9IHJhbmdlU2l6ZVtpbmRleF07XG4gICAgICBpZiAoY3VycmVudCA8IGN1cnJlbnRJblJhbmdlKSB7XG4gICAgICAgIHJldHVybiBvdXQ7XG4gICAgICB9IGVsc2UgaWYgKGN1cnJlbnQgPiBjdXJyZW50SW5SYW5nZSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLy8gLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3B1cmUtcmFuZEA3LjAuMS9ub2RlX21vZHVsZXMvcHVyZS1yYW5kL2xpYi9lc20vZGlzdHJpYnV0aW9uL1Vuc2FmZVVuaWZvcm1JbnREaXN0cmlidXRpb24uanNcbnZhciBzYWZlTnVtYmVyTWF4U2FmZUludGVnZXIgPSBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUjtcbnZhciBzaGFyZWRBID0geyBzaWduOiAxLCBkYXRhOiBbMCwgMF0gfTtcbnZhciBzaGFyZWRCID0geyBzaWduOiAxLCBkYXRhOiBbMCwgMF0gfTtcbnZhciBzaGFyZWRDID0geyBzaWduOiAxLCBkYXRhOiBbMCwgMF0gfTtcbnZhciBzaGFyZWREYXRhID0gWzAsIDBdO1xuZnVuY3Rpb24gdW5pZm9ybUxhcmdlSW50SW50ZXJuYWwoZnJvbSwgdG8sIHJhbmdlU2l6ZSwgcm5nKSB7XG4gIHZhciByYW5nZVNpemVBcnJheUludFZhbHVlID0gcmFuZ2VTaXplIDw9IHNhZmVOdW1iZXJNYXhTYWZlSW50ZWdlciA/IGZyb21OdW1iZXJUb0FycmF5SW50NjQoc2hhcmVkQywgcmFuZ2VTaXplKSA6IHN1YnN0cmFjdEFycmF5SW50NjQoc2hhcmVkQywgZnJvbU51bWJlclRvQXJyYXlJbnQ2NChzaGFyZWRBLCB0byksIGZyb21OdW1iZXJUb0FycmF5SW50NjQoc2hhcmVkQiwgZnJvbSkpO1xuICBpZiAocmFuZ2VTaXplQXJyYXlJbnRWYWx1ZS5kYXRhWzFdID09PSA0Mjk0OTY3Mjk1KSB7XG4gICAgcmFuZ2VTaXplQXJyYXlJbnRWYWx1ZS5kYXRhWzBdICs9IDE7XG4gICAgcmFuZ2VTaXplQXJyYXlJbnRWYWx1ZS5kYXRhWzFdID0gMDtcbiAgfSBlbHNlIHtcbiAgICByYW5nZVNpemVBcnJheUludFZhbHVlLmRhdGFbMV0gKz0gMTtcbiAgfVxuICB1bnNhZmVVbmlmb3JtQXJyYXlJbnREaXN0cmlidXRpb25JbnRlcm5hbChzaGFyZWREYXRhLCByYW5nZVNpemVBcnJheUludFZhbHVlLmRhdGEsIHJuZyk7XG4gIHJldHVybiBzaGFyZWREYXRhWzBdICogNDI5NDk2NzI5NiArIHNoYXJlZERhdGFbMV0gKyBmcm9tO1xufVxuZnVuY3Rpb24gdW5zYWZlVW5pZm9ybUludERpc3RyaWJ1dGlvbihmcm9tLCB0bywgcm5nKSB7XG4gIHZhciByYW5nZVNpemUgPSB0byAtIGZyb207XG4gIGlmIChyYW5nZVNpemUgPD0gNDI5NDk2NzI5NSkge1xuICAgIHZhciBnID0gdW5zYWZlVW5pZm9ybUludERpc3RyaWJ1dGlvbkludGVybmFsKHJhbmdlU2l6ZSArIDEsIHJuZyk7XG4gICAgcmV0dXJuIGcgKyBmcm9tO1xuICB9XG4gIHJldHVybiB1bmlmb3JtTGFyZ2VJbnRJbnRlcm5hbChmcm9tLCB0bywgcmFuZ2VTaXplLCBybmcpO1xufVxuXG4vLyAuLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vcHVyZS1yYW5kQDcuMC4xL25vZGVfbW9kdWxlcy9wdXJlLXJhbmQvbGliL2VzbS9nZW5lcmF0b3IvWG9yb1NoaXJvLmpzXG52YXIgWG9yb1NoaXJvMTI4UGx1cyA9IChmdW5jdGlvbigpIHtcbiAgZnVuY3Rpb24gWG9yb1NoaXJvMTI4UGx1czIoczAxLCBzMDAsIHMxMSwgczEwKSB7XG4gICAgdGhpcy5zMDEgPSBzMDE7XG4gICAgdGhpcy5zMDAgPSBzMDA7XG4gICAgdGhpcy5zMTEgPSBzMTE7XG4gICAgdGhpcy5zMTAgPSBzMTA7XG4gIH1cbiAgWG9yb1NoaXJvMTI4UGx1czIucHJvdG90eXBlLmNsb25lID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBYb3JvU2hpcm8xMjhQbHVzMih0aGlzLnMwMSwgdGhpcy5zMDAsIHRoaXMuczExLCB0aGlzLnMxMCk7XG4gIH07XG4gIFhvcm9TaGlybzEyOFBsdXMyLnByb3RvdHlwZS5uZXh0ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIG5leHRSbmcgPSBuZXcgWG9yb1NoaXJvMTI4UGx1czIodGhpcy5zMDEsIHRoaXMuczAwLCB0aGlzLnMxMSwgdGhpcy5zMTApO1xuICAgIHZhciBvdXQgPSBuZXh0Um5nLnVuc2FmZU5leHQoKTtcbiAgICByZXR1cm4gW291dCwgbmV4dFJuZ107XG4gIH07XG4gIFhvcm9TaGlybzEyOFBsdXMyLnByb3RvdHlwZS51bnNhZmVOZXh0ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIG91dCA9IHRoaXMuczAwICsgdGhpcy5zMTAgfCAwO1xuICAgIHZhciBhMCA9IHRoaXMuczEwIF4gdGhpcy5zMDA7XG4gICAgdmFyIGExID0gdGhpcy5zMTEgXiB0aGlzLnMwMTtcbiAgICB2YXIgczAwID0gdGhpcy5zMDA7XG4gICAgdmFyIHMwMSA9IHRoaXMuczAxO1xuICAgIHRoaXMuczAwID0gczAwIDw8IDI0IF4gczAxID4+PiA4IF4gYTAgXiBhMCA8PCAxNjtcbiAgICB0aGlzLnMwMSA9IHMwMSA8PCAyNCBeIHMwMCA+Pj4gOCBeIGExIF4gKGExIDw8IDE2IHwgYTAgPj4+IDE2KTtcbiAgICB0aGlzLnMxMCA9IGExIDw8IDUgXiBhMCA+Pj4gMjc7XG4gICAgdGhpcy5zMTEgPSBhMCA8PCA1IF4gYTEgPj4+IDI3O1xuICAgIHJldHVybiBvdXQ7XG4gIH07XG4gIFhvcm9TaGlybzEyOFBsdXMyLnByb3RvdHlwZS5qdW1wID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIG5leHRSbmcgPSBuZXcgWG9yb1NoaXJvMTI4UGx1czIodGhpcy5zMDEsIHRoaXMuczAwLCB0aGlzLnMxMSwgdGhpcy5zMTApO1xuICAgIG5leHRSbmcudW5zYWZlSnVtcCgpO1xuICAgIHJldHVybiBuZXh0Um5nO1xuICB9O1xuICBYb3JvU2hpcm8xMjhQbHVzMi5wcm90b3R5cGUudW5zYWZlSnVtcCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBuczAxID0gMDtcbiAgICB2YXIgbnMwMCA9IDA7XG4gICAgdmFyIG5zMTEgPSAwO1xuICAgIHZhciBuczEwID0gMDtcbiAgICB2YXIganVtcCA9IFszNjM5OTU2NjQ1LCAzNzUwNzU3MDEyLCAxMjYxNTY4NTA4LCAzODY0MjYzMzVdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpICE9PSA0OyArK2kpIHtcbiAgICAgIGZvciAodmFyIG1hc2sgPSAxOyBtYXNrOyBtYXNrIDw8PSAxKSB7XG4gICAgICAgIGlmIChqdW1wW2ldICYgbWFzaykge1xuICAgICAgICAgIG5zMDEgXj0gdGhpcy5zMDE7XG4gICAgICAgICAgbnMwMCBePSB0aGlzLnMwMDtcbiAgICAgICAgICBuczExIF49IHRoaXMuczExO1xuICAgICAgICAgIG5zMTAgXj0gdGhpcy5zMTA7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy51bnNhZmVOZXh0KCk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuczAxID0gbnMwMTtcbiAgICB0aGlzLnMwMCA9IG5zMDA7XG4gICAgdGhpcy5zMTEgPSBuczExO1xuICAgIHRoaXMuczEwID0gbnMxMDtcbiAgfTtcbiAgWG9yb1NoaXJvMTI4UGx1czIucHJvdG90eXBlLmdldFN0YXRlID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIFt0aGlzLnMwMSwgdGhpcy5zMDAsIHRoaXMuczExLCB0aGlzLnMxMF07XG4gIH07XG4gIHJldHVybiBYb3JvU2hpcm8xMjhQbHVzMjtcbn0pKCk7XG5mdW5jdGlvbiBmcm9tU3RhdGUoc3RhdGUpIHtcbiAgdmFyIHZhbGlkID0gc3RhdGUubGVuZ3RoID09PSA0O1xuICBpZiAoIXZhbGlkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVGhlIHN0YXRlIG11c3QgaGF2ZSBiZWVuIHByb2R1Y2VkIGJ5IGEgeG9yb3NoaXJvMTI4cGx1cyBSYW5kb21HZW5lcmF0b3JcIik7XG4gIH1cbiAgcmV0dXJuIG5ldyBYb3JvU2hpcm8xMjhQbHVzKHN0YXRlWzBdLCBzdGF0ZVsxXSwgc3RhdGVbMl0sIHN0YXRlWzNdKTtcbn1cbnZhciB4b3Jvc2hpcm8xMjhwbHVzID0gT2JqZWN0LmFzc2lnbihmdW5jdGlvbihzZWVkKSB7XG4gIHJldHVybiBuZXcgWG9yb1NoaXJvMTI4UGx1cygtMSwgfnNlZWQsIHNlZWQgfCAwLCAwKTtcbn0sIHsgZnJvbVN0YXRlIH0pO1xuXG4vLyBzcmMvc2VydmVyL3JuZy50c1xudmFyIHsgYXNVaW50TiB9ID0gQmlnSW50O1xuZnVuY3Rpb24gcGNnMzIoc3RhdGUpIHtcbiAgY29uc3QgTVVMID0gNjM2NDEzNjIyMzg0Njc5MzAwNW47XG4gIGNvbnN0IElOQyA9IDExNjM0NTgwMDI3NDYyMjYwNzIzbjtcbiAgc3RhdGUgPSBhc1VpbnROKDY0LCBzdGF0ZSAqIE1VTCArIElOQyk7XG4gIGNvbnN0IHhvcnNoaWZ0ZWQgPSBOdW1iZXIoYXNVaW50TigzMiwgKHN0YXRlID4+IDE4biBeIHN0YXRlKSA+PiAyN24pKTtcbiAgY29uc3Qgcm90ID0gTnVtYmVyKGFzVWludE4oMzIsIHN0YXRlID4+IDU5bikpO1xuICByZXR1cm4geG9yc2hpZnRlZCA+PiByb3QgfCB4b3JzaGlmdGVkIDw8IDMyIC0gcm90O1xufVxuZnVuY3Rpb24gZ2VuZXJhdGVGbG9hdDY0KHJuZykge1xuICBjb25zdCBnMSA9IHVuc2FmZVVuaWZvcm1JbnREaXN0cmlidXRpb24oMCwgKDEgPDwgMjYpIC0gMSwgcm5nKTtcbiAgY29uc3QgZzIgPSB1bnNhZmVVbmlmb3JtSW50RGlzdHJpYnV0aW9uKDAsICgxIDw8IDI3KSAtIDEsIHJuZyk7XG4gIGNvbnN0IHZhbHVlID0gKGcxICogTWF0aC5wb3coMiwgMjcpICsgZzIpICogTWF0aC5wb3coMiwgLTUzKTtcbiAgcmV0dXJuIHZhbHVlO1xufVxuZnVuY3Rpb24gbWFrZVJhbmRvbUZyb21TZWVkKHNlZWQpIHtcbiAgY29uc3Qgcm5nID0geG9yb3NoaXJvMTI4cGx1cyhwY2czMihzZWVkVG9CaWdJbnQoc2VlZCkpKTtcbiAgY29uc3QgcmFuZG9tID0gKCkgPT4gZ2VuZXJhdGVGbG9hdDY0KHJuZyk7XG4gIHJhbmRvbS5maWxsID0gKGFycmF5KSA9PiB7XG4gICAgaWYgKGlzQmlnSW50QXJyYXkoYXJyYXkpKSB7XG4gICAgICBjb25zdCB1cHBlciA9ICgxbiA8PCBCaWdJbnQoYXJyYXkuQllURVNfUEVSX0VMRU1FTlQgKiA4KSkgLSAxbjtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgYXJyYXlbaV0gPSB1bnNhZmVVbmlmb3JtQmlnSW50RGlzdHJpYnV0aW9uKDBuLCB1cHBlciwgcm5nKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdXBwZXIgPSBNYXRoLnBvdygyLCBhcnJheS5CWVRFU19QRVJfRUxFTUVOVCAqIDgpIC0gMTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgYXJyYXlbaV0gPSB1bnNhZmVVbmlmb3JtSW50RGlzdHJpYnV0aW9uKDAsIHVwcGVyLCBybmcpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYXJyYXk7XG4gIH07XG4gIHJhbmRvbS5zaHVmZmxlID0gKGFycmF5KSA9PiB7XG4gICAgZm9yIChsZXQgY3VycmVudEluZGV4ID0gYXJyYXkubGVuZ3RoIC0gMTsgY3VycmVudEluZGV4ID4gMDsgY3VycmVudEluZGV4LS0pIHtcbiAgICAgIGNvbnN0IHN3YXBJbmRleCA9IHJhbmRvbS5pbnRlZ2VySW5SYW5nZSgwLCBjdXJyZW50SW5kZXgpO1xuICAgICAgW2FycmF5W2N1cnJlbnRJbmRleF0sIGFycmF5W3N3YXBJbmRleF1dID0gW1xuICAgICAgICBhcnJheVtzd2FwSW5kZXhdLFxuICAgICAgICBhcnJheVtjdXJyZW50SW5kZXhdXG4gICAgICBdO1xuICAgIH1cbiAgICByZXR1cm4gYXJyYXk7XG4gIH07XG4gIHJhbmRvbS51aW50MzIgPSAoKSA9PiBybmcudW5zYWZlTmV4dCgpO1xuICByYW5kb20uaW50ZWdlckluUmFuZ2UgPSAobWluLCBtYXgpID0+IHVuc2FmZVVuaWZvcm1JbnREaXN0cmlidXRpb24obWluLCBtYXgsIHJuZyk7XG4gIHJhbmRvbS5iaWdpbnRJblJhbmdlID0gKG1pbiwgbWF4KSA9PiB1bnNhZmVVbmlmb3JtQmlnSW50RGlzdHJpYnV0aW9uKG1pbiwgbWF4LCBybmcpO1xuICByZXR1cm4gcmFuZG9tO1xufVxuZnVuY3Rpb24gbWFrZVJhbmRvbShzZWVkKSB7XG4gIHJldHVybiBtYWtlUmFuZG9tRnJvbVNlZWQoc2VlZCk7XG59XG5mdW5jdGlvbiBzZWVkVG9CaWdJbnQoc2VlZCkge1xuICBpZiAodHlwZW9mIHNlZWQgPT09IFwiYmlnaW50XCIpIHJldHVybiBzZWVkO1xuICBpZiAodHlwZW9mIHNlZWQgPT09IFwibnVtYmVyXCIpIHJldHVybiBCaWdJbnQoc2VlZCk7XG4gIGlmIChzZWVkIGluc3RhbmNlb2YgVWludDhBcnJheSkge1xuICAgIGxldCB2YWx1ZSA9IDBuO1xuICAgIGNvbnN0IGxlbiA9IE1hdGgubWluKHNlZWQuYnl0ZUxlbmd0aCwgOCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgdmFsdWUgfD0gQmlnSW50KHNlZWRbaV0pIDw8IEJpZ0ludChpICogOCk7XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxuICByZXR1cm4gc2VlZC5taWNyb3NTaW5jZVVuaXhFcG9jaDtcbn1cbmZ1bmN0aW9uIGlzQmlnSW50QXJyYXkoYXJyYXkpIHtcbiAgcmV0dXJuIGFycmF5IGluc3RhbmNlb2YgQmlnSW50NjRBcnJheSB8fCBhcnJheSBpbnN0YW5jZW9mIEJpZ1VpbnQ2NEFycmF5O1xufVxudmFyIHN5cyA9IHsgLi4uX3N5c2NhbGxzMl8wLCAuLi5fc3lzY2FsbHMyXzEgfTtcbnZhciBob3N0QmFja2VuZCA9IHtcbiAgLy8gRGlyZWN0IHJlZmVyZW5jZXMga2VlcCBiYWNrZW5kIGluamVjdGlvbiBmcm9tIGFkZGluZyBhIHdyYXBwZXIgY2FsbCB0byB0aGUgaG9zdCBob3QgcGF0aC5cbiAgaWRlbnRpdHk6IHN5cy5pZGVudGl0eSxcbiAgZ2V0Snd0UGF5bG9hZDogc3lzLmdldF9qd3RfcGF5bG9hZCxcbiAgdGFibGVJZEZyb21OYW1lOiBzeXMudGFibGVfaWRfZnJvbV9uYW1lLFxuICBpbmRleElkRnJvbU5hbWU6IHN5cy5pbmRleF9pZF9mcm9tX25hbWUsXG4gIGRhdGFzdG9yZVRhYmxlUm93Q291bnQ6IHN5cy5kYXRhc3RvcmVfdGFibGVfcm93X2NvdW50LFxuICBkYXRhc3RvcmVUYWJsZVNjYW5Cc2F0bjogc3lzLmRhdGFzdG9yZV90YWJsZV9zY2FuX2JzYXRuLFxuICBkYXRhc3RvcmVJbnNlcnRCc2F0bjogc3lzLmRhdGFzdG9yZV9pbnNlcnRfYnNhdG4sXG4gIGRhdGFzdG9yZURlbGV0ZUFsbEJ5RXFCc2F0bjogc3lzLmRhdGFzdG9yZV9kZWxldGVfYWxsX2J5X2VxX2JzYXRuLFxuICBkYXRhc3RvcmVJbmRleFNjYW5Qb2ludEJzYXRuOiBzeXMuZGF0YXN0b3JlX2luZGV4X3NjYW5fcG9pbnRfYnNhdG4sXG4gIGRhdGFzdG9yZUluZGV4U2NhblJhbmdlQnNhdG46IHN5cy5kYXRhc3RvcmVfaW5kZXhfc2Nhbl9yYW5nZV9ic2F0bixcbiAgZGF0YXN0b3JlRGVsZXRlQnlJbmRleFNjYW5Qb2ludEJzYXRuOiBzeXMuZGF0YXN0b3JlX2RlbGV0ZV9ieV9pbmRleF9zY2FuX3BvaW50X2JzYXRuLFxuICBkYXRhc3RvcmVEZWxldGVCeUluZGV4U2NhblJhbmdlQnNhdG46IHN5cy5kYXRhc3RvcmVfZGVsZXRlX2J5X2luZGV4X3NjYW5fcmFuZ2VfYnNhdG4sXG4gIGRhdGFzdG9yZVVwZGF0ZUJzYXRuOiBzeXMuZGF0YXN0b3JlX3VwZGF0ZV9ic2F0bixcbiAgZGF0YXN0b3JlQ2xlYXI6IHN5cy5kYXRhc3RvcmVfY2xlYXIsXG4gIHJvd0l0ZXJCc2F0bkFkdmFuY2U6IHN5cy5yb3dfaXRlcl9ic2F0bl9hZHZhbmNlLFxuICByb3dJdGVyQnNhdG5DbG9zZTogc3lzLnJvd19pdGVyX2JzYXRuX2Nsb3NlLFxuICBwcm9jZWR1cmVTdGFydE11dFR4OiBzeXMucHJvY2VkdXJlX3N0YXJ0X211dF90eCxcbiAgcHJvY2VkdXJlQ29tbWl0TXV0VHg6IHN5cy5wcm9jZWR1cmVfY29tbWl0X211dF90eCxcbiAgcHJvY2VkdXJlQWJvcnRNdXRUeDogc3lzLnByb2NlZHVyZV9hYm9ydF9tdXRfdHgsXG4gIHByb2NlZHVyZUh0dHBSZXF1ZXN0OiBzeXMucHJvY2VkdXJlX2h0dHBfcmVxdWVzdFxufTtcblxuLy8gc3JjL3NlcnZlci9ydW50aW1lLnRzXG52YXIgeyBmcmVlemUgfSA9IE9iamVjdDtcbnZhciBzeXMyID0geyAuLi5fc3lzY2FsbHMyXzAsIC4uLl9zeXNjYWxsczJfMSB9O1xuZnVuY3Rpb24gaXNEYXRhc3RvcmVCYWNrZW5kKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSAhPT0gbnVsbCAmJiB0eXBlb2YgdmFsdWUgPT09IFwib2JqZWN0XCIgJiYgXCJ0YWJsZUlkRnJvbU5hbWVcIiBpbiB2YWx1ZSAmJiBcInByb2NlZHVyZVN0YXJ0TXV0VHhcIiBpbiB2YWx1ZTtcbn1cbmZ1bmN0aW9uIHJlcXVlc3RGcm9tV2lyZShyZXF1ZXN0LCBib2R5KSB7XG4gIHJldHVybiBSZXF1ZXN0W21ha2VSZXF1ZXN0XShib2R5LCB7XG4gICAgaGVhZGVyczogZGVzZXJpYWxpemVIZWFkZXJzKHJlcXVlc3QuaGVhZGVycyksXG4gICAgbWV0aG9kOiBkZXNlcmlhbGl6ZU1ldGhvZChyZXF1ZXN0Lm1ldGhvZCksXG4gICAgdXJpOiByZXF1ZXN0LnVyaSxcbiAgICB2ZXJzaW9uOiByZXF1ZXN0LnZlcnNpb25cbiAgfSk7XG59XG5mdW5jdGlvbiByZXNwb25zZUludG9XaXJlKHJlc3BvbnNlKSB7XG4gIHJldHVybiBbXG4gICAge1xuICAgICAgaGVhZGVyczogc2VyaWFsaXplSGVhZGVycyhyZXNwb25zZS5oZWFkZXJzKSxcbiAgICAgIHZlcnNpb246IHJlc3BvbnNlLnZlcnNpb24sXG4gICAgICBjb2RlOiByZXNwb25zZS5zdGF0dXNcbiAgICB9LFxuICAgIHJlc3BvbnNlLmJ5dGVzKClcbiAgXTtcbn1cbmZ1bmN0aW9uIHBhcnNlSnNvbk9iamVjdChqc29uKSB7XG4gIGxldCB2YWx1ZTtcbiAgdHJ5IHtcbiAgICB2YWx1ZSA9IEpTT04ucGFyc2UoanNvbik7XG4gIH0gY2F0Y2gge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgSlNPTjogZmFpbGVkIHRvIHBhcnNlIHN0cmluZ1wiKTtcbiAgfVxuICBpZiAodmFsdWUgPT09IG51bGwgfHwgdHlwZW9mIHZhbHVlICE9PSBcIm9iamVjdFwiIHx8IEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiRXhwZWN0ZWQgYSBKU09OIG9iamVjdCBhdCB0aGUgdG9wIGxldmVsXCIpO1xuICB9XG4gIHJldHVybiB2YWx1ZTtcbn1cbnZhciBKd3RDbGFpbXNJbXBsID0gY2xhc3Mge1xuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBKd3RDbGFpbXMgaW5zdGFuY2UuXG4gICAqIEBwYXJhbSByYXdQYXlsb2FkIFRoZSBKV1QgcGF5bG9hZCBhcyBhIHJhdyBKU09OIHN0cmluZy5cbiAgICogQHBhcmFtIGlkZW50aXR5IFRoZSBpZGVudGl0eSBmb3IgdGhpcyBKV1QuIFdlIGFyZSBvbmx5IHRha2luZyB0aGlzIGJlY2F1c2Ugd2UgZG9uJ3QgaGF2ZSBhIGJsYWtlMyBpbXBsZW1lbnRhdGlvbiAod2hpY2ggd2UgbmVlZCB0byBjb21wdXRlIGl0KS5cbiAgICovXG4gIGNvbnN0cnVjdG9yKHJhd1BheWxvYWQsIGlkZW50aXR5KSB7XG4gICAgdGhpcy5yYXdQYXlsb2FkID0gcmF3UGF5bG9hZDtcbiAgICB0aGlzLmZ1bGxQYXlsb2FkID0gcGFyc2VKc29uT2JqZWN0KHJhd1BheWxvYWQpO1xuICAgIHRoaXMuX2lkZW50aXR5ID0gaWRlbnRpdHk7XG4gIH1cbiAgZnVsbFBheWxvYWQ7XG4gIF9pZGVudGl0eTtcbiAgZ2V0IGlkZW50aXR5KCkge1xuICAgIHJldHVybiB0aGlzLl9pZGVudGl0eTtcbiAgfVxuICBnZXQgc3ViamVjdCgpIHtcbiAgICByZXR1cm4gdGhpcy5mdWxsUGF5bG9hZFtcInN1YlwiXTtcbiAgfVxuICBnZXQgaXNzdWVyKCkge1xuICAgIHJldHVybiB0aGlzLmZ1bGxQYXlsb2FkW1wiaXNzXCJdO1xuICB9XG4gIGdldCBhdWRpZW5jZSgpIHtcbiAgICBjb25zdCBhdWQgPSB0aGlzLmZ1bGxQYXlsb2FkW1wiYXVkXCJdO1xuICAgIGlmIChhdWQgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgICByZXR1cm4gdHlwZW9mIGF1ZCA9PT0gXCJzdHJpbmdcIiA/IFthdWRdIDogYXVkO1xuICB9XG59O1xudmFyIEF1dGhDdHhJbXBsID0gY2xhc3MgX0F1dGhDdHhJbXBsIHtcbiAgaXNJbnRlcm5hbDtcbiAgLy8gU291cmNlIG9mIHRoZSBKV1QgcGF5bG9hZCBzdHJpbmcsIGlmIHRoZXJlIGlzIG9uZS5cbiAgX2p3dFNvdXJjZTtcbiAgLy8gV2hldGhlciB3ZSBoYXZlIGluaXRpYWxpemVkIHRoZSBKV1QgY2xhaW1zLlxuICBfaW5pdGlhbGl6ZWRKV1QgPSBmYWxzZTtcbiAgX2p3dENsYWltcztcbiAgX3NlbmRlcklkZW50aXR5O1xuICBjb25zdHJ1Y3RvcihvcHRzKSB7XG4gICAgdGhpcy5pc0ludGVybmFsID0gb3B0cy5pc0ludGVybmFsO1xuICAgIHRoaXMuX2p3dFNvdXJjZSA9IG9wdHMuand0U291cmNlO1xuICAgIHRoaXMuX3NlbmRlcklkZW50aXR5ID0gb3B0cy5zZW5kZXJJZGVudGl0eTtcbiAgfVxuICBfaW5pdGlhbGl6ZUpXVCgpIHtcbiAgICBpZiAodGhpcy5faW5pdGlhbGl6ZWRKV1QpIHJldHVybjtcbiAgICB0aGlzLl9pbml0aWFsaXplZEpXVCA9IHRydWU7XG4gICAgY29uc3QgdG9rZW4gPSB0aGlzLl9qd3RTb3VyY2UoKTtcbiAgICBpZiAoIXRva2VuKSB7XG4gICAgICB0aGlzLl9qd3RDbGFpbXMgPSBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9qd3RDbGFpbXMgPSBuZXcgSnd0Q2xhaW1zSW1wbCh0b2tlbiwgdGhpcy5fc2VuZGVySWRlbnRpdHkpO1xuICAgIH1cbiAgICBPYmplY3QuZnJlZXplKHRoaXMpO1xuICB9XG4gIC8qKiBMYXppbHkgY29tcHV0ZSB3aGV0aGVyIGEgSldUIGV4aXN0cyBhbmQgaXMgcGFyc2VhYmxlLiAqL1xuICBnZXQgaGFzSldUKCkge1xuICAgIHRoaXMuX2luaXRpYWxpemVKV1QoKTtcbiAgICByZXR1cm4gdGhpcy5fand0Q2xhaW1zICE9PSBudWxsO1xuICB9XG4gIC8qKiBMYXppbHkgcGFyc2UgdGhlIEp3dENsYWltcyBvbmx5IHdoZW4gYWNjZXNzZWQuICovXG4gIGdldCBqd3QoKSB7XG4gICAgdGhpcy5faW5pdGlhbGl6ZUpXVCgpO1xuICAgIHJldHVybiB0aGlzLl9qd3RDbGFpbXM7XG4gIH1cbiAgLyoqIENyZWF0ZSBhIGNvbnRleHQgcmVwcmVzZW50aW5nIGludGVybmFsIChub24tdXNlcikgcmVxdWVzdHMuICovXG4gIHN0YXRpYyBpbnRlcm5hbCgpIHtcbiAgICByZXR1cm4gbmV3IF9BdXRoQ3R4SW1wbCh7XG4gICAgICBpc0ludGVybmFsOiB0cnVlLFxuICAgICAgand0U291cmNlOiAoKSA9PiBudWxsLFxuICAgICAgc2VuZGVySWRlbnRpdHk6IElkZW50aXR5Lnplcm8oKVxuICAgIH0pO1xuICB9XG4gIC8qKiBJZiB0aGVyZSBpcyBhIGNvbm5lY3Rpb24gaWQsIGxvb2sgdXAgdGhlIEpXVCBwYXlsb2FkIGZyb20gdGhlIHN5c3RlbSB0YWJsZXMuICovXG4gIHN0YXRpYyBmcm9tQmFja2VuZChjb25uZWN0aW9uSWQsIHNlbmRlciwgYmFja2VuZCkge1xuICAgIGlmIChjb25uZWN0aW9uSWQgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBuZXcgX0F1dGhDdHhJbXBsKHtcbiAgICAgICAgaXNJbnRlcm5hbDogZmFsc2UsXG4gICAgICAgIGp3dFNvdXJjZTogKCkgPT4gbnVsbCxcbiAgICAgICAgc2VuZGVySWRlbnRpdHk6IHNlbmRlclxuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgX0F1dGhDdHhJbXBsKHtcbiAgICAgIGlzSW50ZXJuYWw6IGZhbHNlLFxuICAgICAgand0U291cmNlOiAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHBheWxvYWRCdWYgPSBiYWNrZW5kLmdldEp3dFBheWxvYWQoXG4gICAgICAgICAgY29ubmVjdGlvbklkLl9fY29ubmVjdGlvbl9pZF9fXG4gICAgICAgICk7XG4gICAgICAgIGlmIChwYXlsb2FkQnVmLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG51bGw7XG4gICAgICAgIGNvbnN0IHBheWxvYWRTdHIgPSBuZXcgVGV4dERlY29kZXIoKS5kZWNvZGUocGF5bG9hZEJ1Zik7XG4gICAgICAgIHJldHVybiBwYXlsb2FkU3RyO1xuICAgICAgfSxcbiAgICAgIHNlbmRlcklkZW50aXR5OiBzZW5kZXJcbiAgICB9KTtcbiAgfVxuICAvKiogSWYgdGhlcmUgaXMgYSBjb25uZWN0aW9uIGlkLCBsb29rIHVwIHRoZSBKV1QgcGF5bG9hZCBmcm9tIHRoZSBob3N0IHN5c3RlbSB0YWJsZXMuICovXG4gIHN0YXRpYyBmcm9tU3lzdGVtVGFibGVzKGNvbm5lY3Rpb25JZCwgc2VuZGVyKSB7XG4gICAgcmV0dXJuIF9BdXRoQ3R4SW1wbC5mcm9tQmFja2VuZChjb25uZWN0aW9uSWQsIHNlbmRlciwgaG9zdEJhY2tlbmQpO1xuICB9XG59O1xudmFyIFJlZHVjZXJDdHhJbXBsID0gY2xhc3MgUmVkdWNlckN0eCB7XG4gICNpZGVudGl0eTtcbiAgI3NlbmRlckF1dGg7XG4gICN1dWlkQ291bnRlcjtcbiAgI3JhbmRvbTtcbiAgI2JhY2tlbmQ7XG4gIHNlbmRlcjtcbiAgdGltZXN0YW1wO1xuICBjb25uZWN0aW9uSWQ7XG4gIGRiO1xuICBlbnYgPSBlbnZpcm9ubWVudDtcbiAgYXM7XG4gIGNvbnN0cnVjdG9yKHNlbmRlciwgdGltZXN0YW1wLCBjb25uZWN0aW9uSWQsIGRiVmlldywgYmFja2VuZE9yQXNWaWV3cyA9IGhvc3RCYWNrZW5kLCBzZW5kZXJBdXRoLCByYW5kb20sIGFzVmlld3MgPSB7fSkge1xuICAgIE9iamVjdC5zZWFsKHRoaXMpO1xuICAgIHRoaXMuc2VuZGVyID0gc2VuZGVyO1xuICAgIHRoaXMudGltZXN0YW1wID0gdGltZXN0YW1wO1xuICAgIHRoaXMuY29ubmVjdGlvbklkID0gY29ubmVjdGlvbklkO1xuICAgIHRoaXMuZGIgPSBkYlZpZXc7XG4gICAgaWYgKGlzRGF0YXN0b3JlQmFja2VuZChiYWNrZW5kT3JBc1ZpZXdzKSkge1xuICAgICAgdGhpcy4jYmFja2VuZCA9IGJhY2tlbmRPckFzVmlld3M7XG4gICAgICB0aGlzLiNzZW5kZXJBdXRoID0gc2VuZGVyQXV0aDtcbiAgICAgIHRoaXMuI3JhbmRvbSA9IHJhbmRvbTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy4jYmFja2VuZCA9IGhvc3RCYWNrZW5kO1xuICAgICAgYXNWaWV3cyA9IGJhY2tlbmRPckFzVmlld3M7XG4gICAgfVxuICAgIHRoaXMuYXMgPSBhc1ZpZXdzO1xuICB9XG4gIC8qKiBSZXNldCB0aGUgYFJlZHVjZXJDdHhgIHRvIGJlIHVzZWQgZm9yIGEgbmV3IHRyYW5zYWN0aW9uICovXG4gIHN0YXRpYyByZXNldEhvc3QobWUsIHNlbmRlciwgdGltZXN0YW1wLCBjb25uZWN0aW9uSWQsIGRiVmlldywgYXNWaWV3cykge1xuICAgIG1lLnNlbmRlciA9IHNlbmRlcjtcbiAgICBtZS50aW1lc3RhbXAgPSB0aW1lc3RhbXA7XG4gICAgbWUuY29ubmVjdGlvbklkID0gY29ubmVjdGlvbklkO1xuICAgIG1lLiNiYWNrZW5kID0gaG9zdEJhY2tlbmQ7XG4gICAgbWUuI3NlbmRlckF1dGggPSB2b2lkIDA7XG4gICAgbWUuI3JhbmRvbSA9IHZvaWQgMDtcbiAgICBtZS4jdXVpZENvdW50ZXIgPSB2b2lkIDA7XG4gICAgaWYgKGRiVmlldyAhPT0gdm9pZCAwKSB7XG4gICAgICBtZS5kYiA9IGRiVmlldztcbiAgICB9XG4gICAgaWYgKGFzVmlld3MgIT09IHZvaWQgMCkge1xuICAgICAgbWUuYXMgPSBhc1ZpZXdzO1xuICAgIH1cbiAgfVxuICAvKiogUmVzZXQgdGhlIGBSZWR1Y2VyQ3R4YCB0byBiZSB1c2VkIHdpdGggYW4gaW5qZWN0YWJsZSBiYWNrZW5kLiAqL1xuICBzdGF0aWMgcmVzZXQobWUsIHNlbmRlciwgdGltZXN0YW1wLCBjb25uZWN0aW9uSWQsIGJhY2tlbmRPckRiVmlldyA9IGhvc3RCYWNrZW5kLCBzZW5kZXJBdXRoLCByYW5kb20sIGRiVmlldywgYXNWaWV3cykge1xuICAgIG1lLnNlbmRlciA9IHNlbmRlcjtcbiAgICBtZS50aW1lc3RhbXAgPSB0aW1lc3RhbXA7XG4gICAgbWUuY29ubmVjdGlvbklkID0gY29ubmVjdGlvbklkO1xuICAgIGlmIChpc0RhdGFzdG9yZUJhY2tlbmQoYmFja2VuZE9yRGJWaWV3KSkge1xuICAgICAgbWUuI2JhY2tlbmQgPSBiYWNrZW5kT3JEYlZpZXc7XG4gICAgICBtZS4jc2VuZGVyQXV0aCA9IHNlbmRlckF1dGg7XG4gICAgICBtZS4jcmFuZG9tID0gcmFuZG9tO1xuICAgIH0gZWxzZSB7XG4gICAgICBtZS4jYmFja2VuZCA9IGhvc3RCYWNrZW5kO1xuICAgICAgbWUuI3NlbmRlckF1dGggPSB2b2lkIDA7XG4gICAgICBtZS4jcmFuZG9tID0gdm9pZCAwO1xuICAgICAgZGJWaWV3ID0gYmFja2VuZE9yRGJWaWV3O1xuICAgICAgYXNWaWV3cyA9IHNlbmRlckF1dGg7XG4gICAgfVxuICAgIG1lLiN1dWlkQ291bnRlciA9IHZvaWQgMDtcbiAgICBpZiAoZGJWaWV3ICE9PSB2b2lkIDApIHtcbiAgICAgIG1lLmRiID0gZGJWaWV3O1xuICAgIH1cbiAgICBpZiAoYXNWaWV3cyAhPT0gdm9pZCAwKSB7XG4gICAgICBtZS5hcyA9IGFzVmlld3M7XG4gICAgfVxuICB9XG4gIGdldCBkYXRhYmFzZUlkZW50aXR5KCkge1xuICAgIHJldHVybiB0aGlzLiNpZGVudGl0eSA/Pz0gbmV3IElkZW50aXR5KHRoaXMuI2JhY2tlbmQuaWRlbnRpdHkoKSk7XG4gIH1cbiAgZ2V0IGlkZW50aXR5KCkge1xuICAgIHJldHVybiB0aGlzLmRhdGFiYXNlSWRlbnRpdHk7XG4gIH1cbiAgZ2V0IHNlbmRlckF1dGgoKSB7XG4gICAgcmV0dXJuIHRoaXMuI3NlbmRlckF1dGggPz89IEF1dGhDdHhJbXBsLmZyb21CYWNrZW5kKFxuICAgICAgdGhpcy5jb25uZWN0aW9uSWQsXG4gICAgICB0aGlzLnNlbmRlcixcbiAgICAgIHRoaXMuI2JhY2tlbmRcbiAgICApO1xuICB9XG4gIGdldCByYW5kb20oKSB7XG4gICAgcmV0dXJuIHRoaXMuI3JhbmRvbSA/Pz0gbWFrZVJhbmRvbSh0aGlzLnRpbWVzdGFtcCk7XG4gIH1cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyByYW5kb20ge0BsaW5rIFV1aWR9IGB2NGAgdXNpbmcgdGhpcyBgUmVkdWNlckN0eGAncyBSTkcuXG4gICAqL1xuICBuZXdVdWlkVjQoKSB7XG4gICAgY29uc3QgYnl0ZXMgPSB0aGlzLnJhbmRvbS5maWxsKG5ldyBVaW50OEFycmF5KDE2KSk7XG4gICAgcmV0dXJuIFV1aWQuZnJvbVJhbmRvbUJ5dGVzVjQoYnl0ZXMpO1xuICB9XG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgc29ydGFibGUge0BsaW5rIFV1aWR9IGB2N2AgdXNpbmcgdGhpcyBgUmVkdWNlckN0eGAncyBSTkcsIGNvdW50ZXIsXG4gICAqIGFuZCB0aW1lc3RhbXAuXG4gICAqL1xuICBuZXdVdWlkVjcoKSB7XG4gICAgY29uc3QgYnl0ZXMgPSB0aGlzLnJhbmRvbS5maWxsKG5ldyBVaW50OEFycmF5KDQpKTtcbiAgICBjb25zdCBjb3VudGVyID0gdGhpcy4jdXVpZENvdW50ZXIgPz89IHsgdmFsdWU6IDAgfTtcbiAgICByZXR1cm4gVXVpZC5mcm9tQ291bnRlclY3KGNvdW50ZXIsIHRoaXMudGltZXN0YW1wLCBieXRlcyk7XG4gIH1cbn07XG52YXIgY2FsbFVzZXJGdW5jdGlvbiA9IGZ1bmN0aW9uIF9fc3BhY2V0aW1lZGJfZW5kX3Nob3J0X2JhY2t0cmFjZShmbiwgLi4uYXJncykge1xuICByZXR1cm4gZm4oLi4uYXJncyk7XG59O1xuZnVuY3Rpb24gcnVuV2l0aFR4KG1ha2VDdHgsIGJvZHksIGJhY2tlbmQgPSBob3N0QmFja2VuZCkge1xuICBjb25zdCBydW4gPSAoKSA9PiB7XG4gICAgY29uc3QgdGltZXN0YW1wID0gYmFja2VuZC5wcm9jZWR1cmVTdGFydE11dFR4KCk7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBib2R5KG1ha2VDdHgobmV3IFRpbWVzdGFtcCh0aW1lc3RhbXApKSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgYmFja2VuZC5wcm9jZWR1cmVBYm9ydE11dFR4KCk7XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfTtcbiAgbGV0IHJlcyA9IHJ1bigpO1xuICB0cnkge1xuICAgIGJhY2tlbmQucHJvY2VkdXJlQ29tbWl0TXV0VHgoKTtcbiAgICByZXR1cm4gcmVzO1xuICB9IGNhdGNoIHtcbiAgfVxuICBjb25zb2xlLndhcm4oXCJjb21taXR0aW5nIGFub255bW91cyB0cmFuc2FjdGlvbiBmYWlsZWRcIik7XG4gIHJlcyA9IHJ1bigpO1xuICB0cnkge1xuICAgIGJhY2tlbmQucHJvY2VkdXJlQ29tbWl0TXV0VHgoKTtcbiAgICByZXR1cm4gcmVzO1xuICB9IGNhdGNoIChlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwidHJhbnNhY3Rpb24gcmV0cnkgZmFpbGVkIGFnYWluXCIsIHsgY2F1c2U6IGUgfSk7XG4gIH1cbn1cbmZ1bmN0aW9uIGZsYXR0ZW5TdWJtb2R1bGVEaXNwYXRjaGVzKGRpc3BhdGNoZXMsIHBhcmVudFByZWZpeCA9IFwiXCIpIHtcbiAgY29uc3QgcmVzdWx0ID0gW107XG4gIGZvciAoY29uc3QgZCBvZiBkaXNwYXRjaGVzKSB7XG4gICAgY29uc3QgbmFtZVByZWZpeCA9IHBhcmVudFByZWZpeCArIGQubmFtZXNwYWNlICsgXCIuXCI7XG4gICAgcmVzdWx0LnB1c2goe1xuICAgICAgcmVkdWNlckZuczogZC5yZWR1Y2VyRm5zLFxuICAgICAgcmVkdWNlckRlZnM6IGQucmVkdWNlckRlZnMsXG4gICAgICBwcm9jZWR1cmVGbnM6IGQucHJvY2VkdXJlRm5zLFxuICAgICAgcHJvY2VkdXJlRGVmczogZC5wcm9jZWR1cmVEZWZzLFxuICAgICAgYW5vblZpZXdGbnM6IGQuYW5vblZpZXdGbnMsXG4gICAgICB2aWV3Rm5zOiBkLnZpZXdGbnMsXG4gICAgICB0YWJsZXM6IGQudGFibGVzLFxuICAgICAgc2NoZW1hVGFibGVzOiBkLnNjaGVtYVRhYmxlcyxcbiAgICAgIHR5cGVzcGFjZTogZC50eXBlc3BhY2UsXG4gICAgICBkYlZpZXdfOiB2b2lkIDAsXG4gICAgICBxdWVyeUJ1aWxkZXJfOiB2b2lkIDAsXG4gICAgICBuYW1lUHJlZml4LFxuICAgICAgc3ViRGlzcGF0Y2hlczogZC5zdWJEaXNwYXRjaGVzXG4gICAgfSk7XG4gICAgcmVzdWx0LnB1c2goLi4uZmxhdHRlblN1Ym1vZHVsZURpc3BhdGNoZXMoZC5zdWJEaXNwYXRjaGVzLCBuYW1lUHJlZml4KSk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbnZhciBtYWtlSG9va3MgPSAoc2NoZW1hMikgPT4gbmV3IE1vZHVsZUhvb2tzSW1wbChzY2hlbWEyKTtcbnZhciBNb2R1bGVIb29rc0ltcGwgPSBjbGFzcyB7XG4gICNzY2hlbWE7XG4gICNkYlZpZXdfO1xuICAjY29uc3VtZXJBc187XG4gICNyZWR1Y2VyQXJnc0Rlc2VyaWFsaXplcnM7XG4gICNjb25zdW1lclJlZHVjZXJDb3VudDtcbiAgI2NvbnN1bWVyUHJvY2VkdXJlQ291bnQ7XG4gICNmbGF0U3VibW9kdWxlcztcbiAgI2NvbnN1bWVyQW5vblZpZXdDb3VudDtcbiAgI2NvbnN1bWVyVmlld0NvdW50O1xuICAvKiogQ2FjaGUgdGhlIGBSZWR1Y2VyQ3R4YCBvYmplY3QgdG8gYXZvaWQgYWxsb2NhdGluZyBhbmV3IGZvciBldmVyeSByZWR1Y2VyIGNhbGwuICovXG4gICNyZWR1Y2VyQ3R4XztcbiAgLyoqIFBlci1zdWJtb2R1bGUgYWxpYXMgY3R4IG1hcHMsIGNhY2hlZCBsYXppbHkgKHBhcmFsbGVsIHRvICNmbGF0U3VibW9kdWxlcykuICovXG4gICNzdWJtb2R1bGVBc1ZpZXdzXyA9IFtdO1xuICBjb25zdHJ1Y3RvcihzY2hlbWEyKSB7XG4gICAgdGhpcy4jc2NoZW1hID0gc2NoZW1hMjtcbiAgICB0aGlzLiNjb25zdW1lclJlZHVjZXJDb3VudCA9IHNjaGVtYTIucmVkdWNlcnMubGVuZ3RoO1xuICAgIHRoaXMuI2NvbnN1bWVyUHJvY2VkdXJlQ291bnQgPSBzY2hlbWEyLnByb2NlZHVyZXMubGVuZ3RoO1xuICAgIHRoaXMuI2NvbnN1bWVyQW5vblZpZXdDb3VudCA9IHNjaGVtYTIuYW5vblZpZXdzLmxlbmd0aDtcbiAgICB0aGlzLiNjb25zdW1lclZpZXdDb3VudCA9IHNjaGVtYTIudmlld3MubGVuZ3RoO1xuICAgIHRoaXMuI2ZsYXRTdWJtb2R1bGVzID0gZmxhdHRlblN1Ym1vZHVsZURpc3BhdGNoZXMoXG4gICAgICBzY2hlbWEyLnN1Ym1vZHVsZURpc3BhdGNoSW5mb3NcbiAgICApO1xuICAgIGNvbnN0IGNvbnN1bWVyRGVzZXJpYWxpemVycyA9IHNjaGVtYTIubW9kdWxlRGVmLnJlZHVjZXJzLm1hcChcbiAgICAgICh7IHBhcmFtcyB9KSA9PiBQcm9kdWN0VHlwZS5tYWtlRGVzZXJpYWxpemVyKHBhcmFtcywgc2NoZW1hMi50eXBlc3BhY2UpXG4gICAgKTtcbiAgICBjb25zdCBzdWJtb2R1bGVEZXNlcmlhbGl6ZXJzID0gdGhpcy4jZmxhdFN1Ym1vZHVsZXMuZmxhdE1hcChcbiAgICAgICh7IHJlZHVjZXJEZWZzLCB0eXBlc3BhY2UgfSkgPT4gcmVkdWNlckRlZnMubWFwKFxuICAgICAgICAoeyBwYXJhbXMgfSkgPT4gUHJvZHVjdFR5cGUubWFrZURlc2VyaWFsaXplcihwYXJhbXMsIHR5cGVzcGFjZSlcbiAgICAgIClcbiAgICApO1xuICAgIHRoaXMuI3JlZHVjZXJBcmdzRGVzZXJpYWxpemVycyA9IFtcbiAgICAgIC4uLmNvbnN1bWVyRGVzZXJpYWxpemVycyxcbiAgICAgIC4uLnN1Ym1vZHVsZURlc2VyaWFsaXplcnNcbiAgICBdO1xuICB9XG4gIGdldCAjZGJWaWV3KCkge1xuICAgIGlmICh0aGlzLiNkYlZpZXdfICE9PSB2b2lkIDApIHJldHVybiB0aGlzLiNkYlZpZXdfO1xuICAgIGNvbnN0IHJvb3RUYWJsZXMgPSBPYmplY3QudmFsdWVzKHRoaXMuI3NjaGVtYS5zY2hlbWFUeXBlLnRhYmxlcykubWFwKFxuICAgICAgKHRhYmxlMikgPT4gW1xuICAgICAgICB0YWJsZTIuYWNjZXNzb3JOYW1lLFxuICAgICAgICBtYWtlVGFibGVWaWV3KHRoaXMuI3NjaGVtYS50eXBlc3BhY2UsIHRhYmxlMi50YWJsZURlZilcbiAgICAgIF1cbiAgICApO1xuICAgIGNvbnN0IHN1Ym1vZHVsZU5zID0gdGhpcy4jc2NoZW1hLnN1Ym1vZHVsZURpc3BhdGNoSW5mb3MubWFwKChkaXNwYXRjaCkgPT4gW1xuICAgICAgZGlzcGF0Y2gubmFtZXNwYWNlLFxuICAgICAgYnVpbGREYlZpZXdGb3JEaXNwYXRjaChkaXNwYXRjaCwgZGlzcGF0Y2gubmFtZXNwYWNlICsgXCIuXCIpXG4gICAgXSk7XG4gICAgdGhpcy4jZGJWaWV3XyA9IGZyZWV6ZShcbiAgICAgIE9iamVjdC5mcm9tRW50cmllcyhbLi4ucm9vdFRhYmxlcywgLi4uc3VibW9kdWxlTnNdKVxuICAgICk7XG4gICAgcmV0dXJuIHRoaXMuI2RiVmlld187XG4gIH1cbiAgI2dldFN1Ym1vZHVsZURiVmlldyhzdWJtb2R1bGVJZHgpIHtcbiAgICBjb25zdCBtID0gdGhpcy4jZmxhdFN1Ym1vZHVsZXNbc3VibW9kdWxlSWR4XTtcbiAgICByZXR1cm4gbS5kYlZpZXdfID8/PSBmcmVlemUoXG4gICAgICBPYmplY3QuZnJvbUVudHJpZXMoXG4gICAgICAgIG0udGFibGVzLm1hcCgoeyBhY2Nlc3Nvck5hbWUsIHRhYmxlRGVmIH0pID0+IFtcbiAgICAgICAgICBhY2Nlc3Nvck5hbWUsXG4gICAgICAgICAgbWFrZVRhYmxlVmlldyhtLnR5cGVzcGFjZSwgdGFibGVEZWYsIG0ubmFtZVByZWZpeClcbiAgICAgICAgXSlcbiAgICAgIClcbiAgICApO1xuICB9XG4gICNnZXRTdWJtb2R1bGVBc1ZpZXdzKHN1Ym1vZHVsZUlkeCkge1xuICAgIHJldHVybiB0aGlzLiNzdWJtb2R1bGVBc1ZpZXdzX1tzdWJtb2R1bGVJZHhdID8/PSBidWlsZEFsaWFzQ3R4TWFwKFxuICAgICAgdGhpcy4jcmVkdWNlckN0eCxcbiAgICAgIHRoaXMuI2ZsYXRTdWJtb2R1bGVzW3N1Ym1vZHVsZUlkeF0uc3ViRGlzcGF0Y2hlcyxcbiAgICAgIHRoaXMuI2ZsYXRTdWJtb2R1bGVzW3N1Ym1vZHVsZUlkeF0ubmFtZVByZWZpeFxuICAgICk7XG4gIH1cbiAgLyoqIFF1ZXJ5IGJ1aWxkZXIgc2NvcGVkIHRvIHRoZSBzdWJtb2R1bGUncyBvd24gdGFibGVzLCB3aXRoIG5hbWVzcGFjZS1wcmVmaXhlZFxuICAgKiAgc291cmNlIG5hbWVzIHNvIGdlbmVyYXRlZCBTUUwgdGFyZ2V0cyB0aGUgbW91bnRlZCB0YWJsZSBuYW1lcy4gKi9cbiAgI2dldFN1Ym1vZHVsZVF1ZXJ5QnVpbGRlcihzdWJtb2R1bGVJZHgpIHtcbiAgICBjb25zdCBtID0gdGhpcy4jZmxhdFN1Ym1vZHVsZXNbc3VibW9kdWxlSWR4XTtcbiAgICByZXR1cm4gbS5xdWVyeUJ1aWxkZXJfID8/PSBtYWtlUXVlcnlCdWlsZGVyKHtcbiAgICAgIHRhYmxlczogT2JqZWN0LmZyb21FbnRyaWVzKFxuICAgICAgICBPYmplY3QuZW50cmllcyhtLnNjaGVtYVRhYmxlcykubWFwKChba2V5LCBkZWZdKSA9PiBbXG4gICAgICAgICAga2V5LFxuICAgICAgICAgIHsgLi4uZGVmLCBzb3VyY2VOYW1lOiBtLm5hbWVQcmVmaXggKyBkZWYuc291cmNlTmFtZSB9XG4gICAgICAgIF0pXG4gICAgICApXG4gICAgfSk7XG4gIH1cbiAgZ2V0ICNyZWR1Y2VyQ3R4KCkge1xuICAgIHJldHVybiB0aGlzLiNyZWR1Y2VyQ3R4XyA/Pz0gbmV3IFJlZHVjZXJDdHhJbXBsKFxuICAgICAgSWRlbnRpdHkuemVybygpLFxuICAgICAgVGltZXN0YW1wLlVOSVhfRVBPQ0gsXG4gICAgICBudWxsLFxuICAgICAgdGhpcy4jZGJWaWV3XG4gICAgKTtcbiAgfVxuICBnZXQgI2NvbnN1bWVyQXMoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2NvbnN1bWVyQXNfID8/PSBidWlsZEFsaWFzQ3R4TWFwKFxuICAgICAgdGhpcy4jcmVkdWNlckN0eCxcbiAgICAgIHRoaXMuI3NjaGVtYS5zdWJtb2R1bGVEaXNwYXRjaEluZm9zLFxuICAgICAgXCJcIlxuICAgICk7XG4gIH1cbiAgX19kZXNjcmliZV9tb2R1bGVfXygpIHtcbiAgICBjb25zdCB3cml0ZXIgPSBuZXcgQmluYXJ5V3JpdGVyKDEyOCk7XG4gICAgUmF3TW9kdWxlRGVmLnNlcmlhbGl6ZShcbiAgICAgIHdyaXRlcixcbiAgICAgIFJhd01vZHVsZURlZi5WMTAodGhpcy4jc2NoZW1hLnJhd01vZHVsZURlZlYxMCgpKVxuICAgICk7XG4gICAgcmV0dXJuIHdyaXRlci5nZXRCdWZmZXIoKTtcbiAgfVxuICBfX2dldF9lcnJvcl9jb25zdHJ1Y3Rvcl9fKGNvZGUpIHtcbiAgICByZXR1cm4gZ2V0RXJyb3JDb25zdHJ1Y3Rvcihjb2RlKTtcbiAgfVxuICBnZXQgX19zZW5kZXJfZXJyb3JfY2xhc3NfXygpIHtcbiAgICByZXR1cm4gU2VuZGVyRXJyb3I7XG4gIH1cbiAgX19jYWxsX3JlZHVjZXJfXyhyZWR1Y2VySWQsIHNlbmRlciwgY29ubklkLCB0aW1lc3RhbXAsIGFyZ3NCdWYpIHtcbiAgICBjb25zdCBkZXNlcmlhbGl6ZUFyZ3MgPSB0aGlzLiNyZWR1Y2VyQXJnc0Rlc2VyaWFsaXplcnNbcmVkdWNlcklkXTtcbiAgICBCSU5BUllfUkVBREVSLnJlc2V0KGFyZ3NCdWYpO1xuICAgIGNvbnN0IGFyZ3MgPSBkZXNlcmlhbGl6ZUFyZ3MoQklOQVJZX1JFQURFUik7XG4gICAgY29uc3Qgc2VuZGVySWRlbnRpdHkgPSBuZXcgSWRlbnRpdHkoc2VuZGVyKTtcbiAgICBsZXQgZm47XG4gICAgbGV0IGRiVmlldztcbiAgICBsZXQgYXNWaWV3cztcbiAgICBpZiAocmVkdWNlcklkIDwgdGhpcy4jY29uc3VtZXJSZWR1Y2VyQ291bnQpIHtcbiAgICAgIGZuID0gdGhpcy4jc2NoZW1hLnJlZHVjZXJzW3JlZHVjZXJJZF07XG4gICAgICBkYlZpZXcgPSB0aGlzLiNkYlZpZXc7XG4gICAgICBhc1ZpZXdzID0gdGhpcy4jY29uc3VtZXJBcztcbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IG9mZnNldCA9IHRoaXMuI2NvbnN1bWVyUmVkdWNlckNvdW50O1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLiNmbGF0U3VibW9kdWxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBtID0gdGhpcy4jZmxhdFN1Ym1vZHVsZXNbaV07XG4gICAgICAgIGlmIChyZWR1Y2VySWQgPCBvZmZzZXQgKyBtLnJlZHVjZXJGbnMubGVuZ3RoKSB7XG4gICAgICAgICAgZm4gPSBtLnJlZHVjZXJGbnNbcmVkdWNlcklkIC0gb2Zmc2V0XTtcbiAgICAgICAgICBkYlZpZXcgPSB0aGlzLiNnZXRTdWJtb2R1bGVEYlZpZXcoaSk7XG4gICAgICAgICAgYXNWaWV3cyA9IHRoaXMuI2dldFN1Ym1vZHVsZUFzVmlld3MoaSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgb2Zmc2V0ICs9IG0ucmVkdWNlckZucy5sZW5ndGg7XG4gICAgICB9XG4gICAgICBpZiAoZm4gPT09IHZvaWQgMCkge1xuICAgICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihgdW5rbm93biByZWR1Y2VySWQgJHtyZWR1Y2VySWR9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IGN0eCA9IHRoaXMuI3JlZHVjZXJDdHg7XG4gICAgUmVkdWNlckN0eEltcGwucmVzZXRIb3N0KFxuICAgICAgY3R4LFxuICAgICAgc2VuZGVySWRlbnRpdHksXG4gICAgICBuZXcgVGltZXN0YW1wKHRpbWVzdGFtcCksXG4gICAgICBDb25uZWN0aW9uSWQubnVsbElmWmVybyhuZXcgQ29ubmVjdGlvbklkKGNvbm5JZCkpLFxuICAgICAgZGJWaWV3LFxuICAgICAgYXNWaWV3c1xuICAgICk7XG4gICAgY2FsbFVzZXJGdW5jdGlvbihmbiwgY3R4LCBhcmdzKTtcbiAgfVxuICBfX2NhbGxfdmlld19fKGlkLCBzZW5kZXIsIGFyZ3NCdWYpIHtcbiAgICBjb25zdCBtb2R1bGVDdHggPSB0aGlzLiNzY2hlbWE7XG4gICAgbGV0IHZpZXdGbnM7XG4gICAgbGV0IGxvY2FsSWQ7XG4gICAgbGV0IGRiVmlldztcbiAgICBsZXQgZnJvbTtcbiAgICBpZiAoaWQgPCB0aGlzLiNjb25zdW1lclZpZXdDb3VudCkge1xuICAgICAgdmlld0ZucyA9IG1vZHVsZUN0eC52aWV3cztcbiAgICAgIGxvY2FsSWQgPSBpZDtcbiAgICAgIGRiVmlldyA9IHRoaXMuI2RiVmlldztcbiAgICAgIGZyb20gPSBtYWtlUXVlcnlCdWlsZGVyKG1vZHVsZUN0eC5zY2hlbWFUeXBlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IG9mZnNldCA9IHRoaXMuI2NvbnN1bWVyVmlld0NvdW50O1xuICAgICAgbGV0IGZvdW5kID0gZmFsc2U7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuI2ZsYXRTdWJtb2R1bGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IG0gPSB0aGlzLiNmbGF0U3VibW9kdWxlc1tpXTtcbiAgICAgICAgaWYgKGlkIDwgb2Zmc2V0ICsgbS52aWV3Rm5zLmxlbmd0aCkge1xuICAgICAgICAgIHZpZXdGbnMgPSBtLnZpZXdGbnM7XG4gICAgICAgICAgbG9jYWxJZCA9IGlkIC0gb2Zmc2V0O1xuICAgICAgICAgIGRiVmlldyA9IHRoaXMuI2dldFN1Ym1vZHVsZURiVmlldyhpKTtcbiAgICAgICAgICBmcm9tID0gdGhpcy4jZ2V0U3VibW9kdWxlUXVlcnlCdWlsZGVyKGkpO1xuICAgICAgICAgIGZvdW5kID0gdHJ1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBvZmZzZXQgKz0gbS52aWV3Rm5zLmxlbmd0aDtcbiAgICAgIH1cbiAgICAgIGlmICghZm91bmQpIHRocm93IG5ldyBSYW5nZUVycm9yKGB1bmtub3duIHZpZXdJZCAke2lkfWApO1xuICAgIH1cbiAgICBjb25zdCB7IGZuLCBkZXNlcmlhbGl6ZVBhcmFtcywgc2VyaWFsaXplUmV0dXJuLCByZXR1cm5UeXBlQmFzZVNpemUgfSA9IHZpZXdGbnNbbG9jYWxJZF07XG4gICAgY29uc3QgY3R4ID0gZnJlZXplKHtcbiAgICAgIGVudjogZW52aXJvbm1lbnQsXG4gICAgICBzZW5kZXI6IG5ldyBJZGVudGl0eShzZW5kZXIpLFxuICAgICAgZGI6IGRiVmlldyxcbiAgICAgIGZyb21cbiAgICB9KTtcbiAgICBjb25zdCBhcmdzID0gZGVzZXJpYWxpemVQYXJhbXMobmV3IEJpbmFyeVJlYWRlcihhcmdzQnVmKSk7XG4gICAgY29uc3QgcmV0ID0gY2FsbFVzZXJGdW5jdGlvbihmbiwgY3R4LCBhcmdzKTtcbiAgICBjb25zdCByZXRCdWYgPSBuZXcgQmluYXJ5V3JpdGVyKHJldHVyblR5cGVCYXNlU2l6ZSk7XG4gICAgaWYgKGlzUm93VHlwZWRRdWVyeShyZXQpKSB7XG4gICAgICBjb25zdCBxdWVyeSA9IHRvU3FsKHJldCk7XG4gICAgICBWaWV3UmVzdWx0SGVhZGVyLnNlcmlhbGl6ZShyZXRCdWYsIFZpZXdSZXN1bHRIZWFkZXIuUmF3U3FsKHF1ZXJ5KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIFZpZXdSZXN1bHRIZWFkZXIuc2VyaWFsaXplKHJldEJ1ZiwgVmlld1Jlc3VsdEhlYWRlci5Sb3dEYXRhKTtcbiAgICAgIHNlcmlhbGl6ZVJldHVybihyZXRCdWYsIHJldCk7XG4gICAgfVxuICAgIHJldHVybiB7IGRhdGE6IHJldEJ1Zi5nZXRCdWZmZXIoKSB9O1xuICB9XG4gIF9fY2FsbF92aWV3X2Fub25fXyhpZCwgYXJnc0J1Zikge1xuICAgIGNvbnN0IG1vZHVsZUN0eCA9IHRoaXMuI3NjaGVtYTtcbiAgICBsZXQgYW5vblZpZXdGbnM7XG4gICAgbGV0IGxvY2FsSWQ7XG4gICAgbGV0IGRiVmlldztcbiAgICBsZXQgZnJvbTtcbiAgICBpZiAoaWQgPCB0aGlzLiNjb25zdW1lckFub25WaWV3Q291bnQpIHtcbiAgICAgIGFub25WaWV3Rm5zID0gbW9kdWxlQ3R4LmFub25WaWV3cztcbiAgICAgIGxvY2FsSWQgPSBpZDtcbiAgICAgIGRiVmlldyA9IHRoaXMuI2RiVmlldztcbiAgICAgIGZyb20gPSBtYWtlUXVlcnlCdWlsZGVyKG1vZHVsZUN0eC5zY2hlbWFUeXBlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IG9mZnNldCA9IHRoaXMuI2NvbnN1bWVyQW5vblZpZXdDb3VudDtcbiAgICAgIGxldCBmb3VuZCA9IGZhbHNlO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLiNmbGF0U3VibW9kdWxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBtID0gdGhpcy4jZmxhdFN1Ym1vZHVsZXNbaV07XG4gICAgICAgIGlmIChpZCA8IG9mZnNldCArIG0uYW5vblZpZXdGbnMubGVuZ3RoKSB7XG4gICAgICAgICAgYW5vblZpZXdGbnMgPSBtLmFub25WaWV3Rm5zO1xuICAgICAgICAgIGxvY2FsSWQgPSBpZCAtIG9mZnNldDtcbiAgICAgICAgICBkYlZpZXcgPSB0aGlzLiNnZXRTdWJtb2R1bGVEYlZpZXcoaSk7XG4gICAgICAgICAgZnJvbSA9IHRoaXMuI2dldFN1Ym1vZHVsZVF1ZXJ5QnVpbGRlcihpKTtcbiAgICAgICAgICBmb3VuZCA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgb2Zmc2V0ICs9IG0uYW5vblZpZXdGbnMubGVuZ3RoO1xuICAgICAgfVxuICAgICAgaWYgKCFmb3VuZCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoYHVua25vd24gYW5vblZpZXdJZCAke2lkfWApO1xuICAgIH1cbiAgICBjb25zdCB7IGZuLCBkZXNlcmlhbGl6ZVBhcmFtcywgc2VyaWFsaXplUmV0dXJuLCByZXR1cm5UeXBlQmFzZVNpemUgfSA9IGFub25WaWV3Rm5zW2xvY2FsSWRdO1xuICAgIGNvbnN0IGN0eCA9IGZyZWV6ZSh7XG4gICAgICBlbnY6IGVudmlyb25tZW50LFxuICAgICAgZGI6IGRiVmlldyxcbiAgICAgIGZyb21cbiAgICB9KTtcbiAgICBjb25zdCBhcmdzID0gZGVzZXJpYWxpemVQYXJhbXMobmV3IEJpbmFyeVJlYWRlcihhcmdzQnVmKSk7XG4gICAgY29uc3QgcmV0ID0gY2FsbFVzZXJGdW5jdGlvbihmbiwgY3R4LCBhcmdzKTtcbiAgICBjb25zdCByZXRCdWYgPSBuZXcgQmluYXJ5V3JpdGVyKHJldHVyblR5cGVCYXNlU2l6ZSk7XG4gICAgaWYgKGlzUm93VHlwZWRRdWVyeShyZXQpKSB7XG4gICAgICBjb25zdCBxdWVyeSA9IHRvU3FsKHJldCk7XG4gICAgICBWaWV3UmVzdWx0SGVhZGVyLnNlcmlhbGl6ZShyZXRCdWYsIFZpZXdSZXN1bHRIZWFkZXIuUmF3U3FsKHF1ZXJ5KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIFZpZXdSZXN1bHRIZWFkZXIuc2VyaWFsaXplKHJldEJ1ZiwgVmlld1Jlc3VsdEhlYWRlci5Sb3dEYXRhKTtcbiAgICAgIHNlcmlhbGl6ZVJldHVybihyZXRCdWYsIHJldCk7XG4gICAgfVxuICAgIHJldHVybiB7IGRhdGE6IHJldEJ1Zi5nZXRCdWZmZXIoKSB9O1xuICB9XG4gIF9fY2FsbF9wcm9jZWR1cmVfXyhpZCwgc2VuZGVyLCBjb25uZWN0aW9uX2lkLCB0aW1lc3RhbXAsIGFyZ3MpIHtcbiAgICBjb25zdCBzZW5kZXJJZGVudGl0eSA9IG5ldyBJZGVudGl0eShzZW5kZXIpO1xuICAgIGNvbnN0IGNvbm5JZCA9IENvbm5lY3Rpb25JZC5udWxsSWZaZXJvKG5ldyBDb25uZWN0aW9uSWQoY29ubmVjdGlvbl9pZCkpO1xuICAgIGNvbnN0IHRzID0gbmV3IFRpbWVzdGFtcCh0aW1lc3RhbXApO1xuICAgIGlmIChpZCA8IHRoaXMuI2NvbnN1bWVyUHJvY2VkdXJlQ291bnQpIHtcbiAgICAgIHJldHVybiBjYWxsUHJvY2VkdXJlKFxuICAgICAgICB0aGlzLiNzY2hlbWEucHJvY2VkdXJlcyxcbiAgICAgICAgaWQsXG4gICAgICAgIHNlbmRlcklkZW50aXR5LFxuICAgICAgICBjb25uSWQsXG4gICAgICAgIHRzLFxuICAgICAgICBhcmdzLFxuICAgICAgICAoKSA9PiB0aGlzLiNkYlZpZXcsXG4gICAgICAgIHRoaXMuI3NjaGVtYS5zdWJtb2R1bGVEaXNwYXRjaEluZm9zXG4gICAgICApO1xuICAgIH1cbiAgICBsZXQgb2Zmc2V0ID0gdGhpcy4jY29uc3VtZXJQcm9jZWR1cmVDb3VudDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuI2ZsYXRTdWJtb2R1bGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBtID0gdGhpcy4jZmxhdFN1Ym1vZHVsZXNbaV07XG4gICAgICBpZiAoaWQgPCBvZmZzZXQgKyBtLnByb2NlZHVyZUZucy5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxQcm9jZWR1cmUoXG4gICAgICAgICAgbS5wcm9jZWR1cmVGbnMsXG4gICAgICAgICAgaWQgLSBvZmZzZXQsXG4gICAgICAgICAgc2VuZGVySWRlbnRpdHksXG4gICAgICAgICAgY29ubklkLFxuICAgICAgICAgIHRzLFxuICAgICAgICAgIGFyZ3MsXG4gICAgICAgICAgKCkgPT4gdGhpcy4jZ2V0U3VibW9kdWxlRGJWaWV3KGkpLFxuICAgICAgICAgIG0uc3ViRGlzcGF0Y2hlcyxcbiAgICAgICAgICBtLm5hbWVQcmVmaXhcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIG9mZnNldCArPSBtLnByb2NlZHVyZUZucy5sZW5ndGg7XG4gICAgfVxuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKGB1bmtub3duIHByb2NlZHVyZUlkICR7aWR9YCk7XG4gIH1cbiAgX19jYWxsX2h0dHBfaGFuZGxlcl9fKGlkLCB0aW1lc3RhbXAsIHJlcXVlc3QsIGJvZHkpIHtcbiAgICBjb25zdCBtb2R1bGVDdHggPSB0aGlzLiNzY2hlbWE7XG4gICAgY29uc3QgaGFuZGxlciA9IG1vZHVsZUN0eC5odHRwSGFuZGxlcnNbaWRdO1xuICAgIGNvbnN0IGN0eCA9IG5ldyBIYW5kbGVyQ29udGV4dEltcGwoXG4gICAgICBuZXcgVGltZXN0YW1wKHRpbWVzdGFtcCksXG4gICAgICAoKSA9PiB0aGlzLiNkYlZpZXcsXG4gICAgICB0aGlzLiNzY2hlbWEuc3VibW9kdWxlRGlzcGF0Y2hJbmZvc1xuICAgICk7XG4gICAgY29uc3QgcmVxdWVzdE1ldGFkYXRhID0gSHR0cFJlcXVlc3QuZGVzZXJpYWxpemUobmV3IEJpbmFyeVJlYWRlcihyZXF1ZXN0KSk7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBjYWxsVXNlckZ1bmN0aW9uKFxuICAgICAgaGFuZGxlcixcbiAgICAgIGN0eCxcbiAgICAgIHJlcXVlc3RGcm9tV2lyZShyZXF1ZXN0TWV0YWRhdGEsIGJvZHkpXG4gICAgKTtcbiAgICBjb25zdCBbcmVzcG9uc2VNZXRhZGF0YSwgcmVzcG9uc2VCb2R5XSA9IHJlc3BvbnNlSW50b1dpcmUocmVzcG9uc2UpO1xuICAgIGNvbnN0IHJlc3BvbnNlQnVmID0gbmV3IEJpbmFyeVdyaXRlcihcbiAgICAgIGJzYXRuQmFzZVNpemUobW9kdWxlQ3R4LnR5cGVzcGFjZSwgSHR0cFJlc3BvbnNlLmFsZ2VicmFpY1R5cGUpXG4gICAgKTtcbiAgICBIdHRwUmVzcG9uc2Uuc2VyaWFsaXplKHJlc3BvbnNlQnVmLCByZXNwb25zZU1ldGFkYXRhKTtcbiAgICByZXR1cm4gW3Jlc3BvbnNlQnVmLmdldEJ1ZmZlcigpLCByZXNwb25zZUJvZHldO1xuICB9XG59O1xudmFyIEJJTkFSWV9XUklURVIgPSBuZXcgQmluYXJ5V3JpdGVyKDApO1xudmFyIEJJTkFSWV9SRUFERVIgPSBuZXcgQmluYXJ5UmVhZGVyKG5ldyBVaW50OEFycmF5KCkpO1xudmFyIEhhbmRsZXJDb250ZXh0SW1wbCA9IGNsYXNzIHtcbiAgY29uc3RydWN0b3IodGltZXN0YW1wLCBkYlZpZXcsIGRpc3BhdGNoZXMgPSBbXSkge1xuICAgIHRoaXMudGltZXN0YW1wID0gdGltZXN0YW1wO1xuICAgIHRoaXMuI2RiVmlldyA9IGRiVmlldztcbiAgICB0aGlzLiNkaXNwYXRjaGVzID0gZGlzcGF0Y2hlcztcbiAgfVxuICBlbnYgPSBlbnZpcm9ubWVudDtcbiAgI2lkZW50aXR5O1xuICAjdXVpZENvdW50ZXI7XG4gICNyYW5kb207XG4gICNkYlZpZXc7XG4gICNkaXNwYXRjaGVzO1xuICAjYXNWaWV3cztcbiAgaHR0cCA9IGh0dHBDbGllbnQ7XG4gIGdldCBpZGVudGl0eSgpIHtcbiAgICByZXR1cm4gdGhpcy4jaWRlbnRpdHkgPz89IG5ldyBJZGVudGl0eShzeXMyLmlkZW50aXR5KCkpO1xuICB9XG4gIGdldCByYW5kb20oKSB7XG4gICAgcmV0dXJuIHRoaXMuI3JhbmRvbSA/Pz0gbWFrZVJhbmRvbSh0aGlzLnRpbWVzdGFtcCk7XG4gIH1cbiAgZ2V0IGFzKCkge1xuICAgIHJldHVybiB0aGlzLiNhc1ZpZXdzID8/PSBidWlsZEhhbmRsZXJBbGlhc0N0eE1hcChcbiAgICAgIHRoaXMsXG4gICAgICB0aGlzLiNkaXNwYXRjaGVzLFxuICAgICAgXCJcIlxuICAgICk7XG4gIH1cbiAgd2l0aFR4KGJvZHkpIHtcbiAgICBjb25zdCBkaXNwYXRjaGVzID0gdGhpcy4jZGlzcGF0Y2hlcztcbiAgICByZXR1cm4gcnVuV2l0aFR4KCh0aW1lc3RhbXApID0+IHtcbiAgICAgIGNvbnN0IHR4ID0gbmV3IFJlZHVjZXJDdHhJbXBsKFxuICAgICAgICBJZGVudGl0eS56ZXJvKCksXG4gICAgICAgIHRpbWVzdGFtcCxcbiAgICAgICAgbnVsbCxcbiAgICAgICAgdGhpcy4jZGJWaWV3KClcbiAgICAgICk7XG4gICAgICBpZiAoZGlzcGF0Y2hlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIHR4LmFzID0gYnVpbGRBbGlhc0N0eE1hcCh0eCwgZGlzcGF0Y2hlcywgXCJcIik7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHg7XG4gICAgfSwgYm9keSk7XG4gIH1cbiAgbmV3VXVpZFY0KCkge1xuICAgIGNvbnN0IGJ5dGVzID0gdGhpcy5yYW5kb20uZmlsbChuZXcgVWludDhBcnJheSgxNikpO1xuICAgIHJldHVybiBVdWlkLmZyb21SYW5kb21CeXRlc1Y0KGJ5dGVzKTtcbiAgfVxuICBuZXdVdWlkVjcoKSB7XG4gICAgY29uc3QgYnl0ZXMgPSB0aGlzLnJhbmRvbS5maWxsKG5ldyBVaW50OEFycmF5KDQpKTtcbiAgICBjb25zdCBjb3VudGVyID0gdGhpcy4jdXVpZENvdW50ZXIgPz89IHsgdmFsdWU6IDAgfTtcbiAgICByZXR1cm4gVXVpZC5mcm9tQ291bnRlclY3KGNvdW50ZXIsIHRoaXMudGltZXN0YW1wLCBieXRlcyk7XG4gIH1cbn07XG5mdW5jdGlvbiBidWlsZERiVmlld0ZvckRpc3BhdGNoKGRpc3BhdGNoLCBuYW1lUHJlZml4KSB7XG4gIGNvbnN0IHRhYmxlRW50cmllcyA9IGRpc3BhdGNoLnRhYmxlcy5tYXAoKHsgYWNjZXNzb3JOYW1lLCB0YWJsZURlZiB9KSA9PiBbXG4gICAgYWNjZXNzb3JOYW1lLFxuICAgIG1ha2VUYWJsZVZpZXcoZGlzcGF0Y2gudHlwZXNwYWNlLCB0YWJsZURlZiwgbmFtZVByZWZpeClcbiAgXSk7XG4gIGNvbnN0IHN1Yk5zRW50cmllcyA9IGRpc3BhdGNoLnN1YkRpc3BhdGNoZXMubWFwKChzdWIpID0+IFtcbiAgICBzdWIubmFtZXNwYWNlLFxuICAgIGJ1aWxkRGJWaWV3Rm9yRGlzcGF0Y2goc3ViLCBuYW1lUHJlZml4ICsgc3ViLm5hbWVzcGFjZSArIFwiLlwiKVxuICBdKTtcbiAgcmV0dXJuIGZyZWV6ZShPYmplY3QuZnJvbUVudHJpZXMoWy4uLnRhYmxlRW50cmllcywgLi4uc3ViTnNFbnRyaWVzXSkpO1xufVxuZnVuY3Rpb24gYnVpbGRBbGlhc0N0eChwYXJlbnQsIGRpc3BhdGNoLCBuYW1lUHJlZml4KSB7XG4gIGNvbnN0IG5zRGIgPSBidWlsZERiVmlld0ZvckRpc3BhdGNoKGRpc3BhdGNoLCBuYW1lUHJlZml4KTtcbiAgY29uc3Qgc3ViQXMgPSBidWlsZEFsaWFzQ3R4TWFwKHBhcmVudCwgZGlzcGF0Y2guc3ViRGlzcGF0Y2hlcywgbmFtZVByZWZpeCk7XG4gIHJldHVybiB7XG4gICAgZ2V0IHNlbmRlcigpIHtcbiAgICAgIHJldHVybiBwYXJlbnQuc2VuZGVyO1xuICAgIH0sXG4gICAgZ2V0IGRhdGFiYXNlSWRlbnRpdHkoKSB7XG4gICAgICByZXR1cm4gcGFyZW50LmRhdGFiYXNlSWRlbnRpdHk7XG4gICAgfSxcbiAgICBnZXQgaWRlbnRpdHkoKSB7XG4gICAgICByZXR1cm4gcGFyZW50LmlkZW50aXR5O1xuICAgIH0sXG4gICAgZ2V0IHRpbWVzdGFtcCgpIHtcbiAgICAgIHJldHVybiBwYXJlbnQudGltZXN0YW1wO1xuICAgIH0sXG4gICAgZ2V0IGNvbm5lY3Rpb25JZCgpIHtcbiAgICAgIHJldHVybiBwYXJlbnQuY29ubmVjdGlvbklkO1xuICAgIH0sXG4gICAgZ2V0IHNlbmRlckF1dGgoKSB7XG4gICAgICByZXR1cm4gcGFyZW50LnNlbmRlckF1dGg7XG4gICAgfSxcbiAgICBnZXQgcmFuZG9tKCkge1xuICAgICAgcmV0dXJuIHBhcmVudC5yYW5kb207XG4gICAgfSxcbiAgICBuZXdVdWlkVjQoKSB7XG4gICAgICByZXR1cm4gcGFyZW50Lm5ld1V1aWRWNCgpO1xuICAgIH0sXG4gICAgbmV3VXVpZFY3KCkge1xuICAgICAgcmV0dXJuIHBhcmVudC5uZXdVdWlkVjcoKTtcbiAgICB9LFxuICAgIGRiOiBuc0RiLFxuICAgIGFzOiBzdWJBc1xuICB9O1xufVxuZnVuY3Rpb24gYnVpbGRBbGlhc0N0eE1hcChwYXJlbnQsIGRpc3BhdGNoZXMsIHBhcmVudFByZWZpeCkge1xuICByZXR1cm4gZnJlZXplKFxuICAgIE9iamVjdC5mcm9tRW50cmllcyhcbiAgICAgIGRpc3BhdGNoZXMubWFwKChkKSA9PiBbXG4gICAgICAgIGQubmFtZXNwYWNlLFxuICAgICAgICBidWlsZEFsaWFzQ3R4KHBhcmVudCwgZCwgcGFyZW50UHJlZml4ICsgZC5uYW1lc3BhY2UgKyBcIi5cIilcbiAgICAgIF0pXG4gICAgKVxuICApO1xufVxuZnVuY3Rpb24gYnVpbGRIYW5kbGVyQWxpYXNDdHgocGFyZW50LCBkaXNwYXRjaCwgbmFtZVByZWZpeCkge1xuICBsZXQgbnNEYl87XG4gIGNvbnN0IHN1YkFzID0gYnVpbGRIYW5kbGVyQWxpYXNDdHhNYXAoXG4gICAgcGFyZW50LFxuICAgIGRpc3BhdGNoLnN1YkRpc3BhdGNoZXMsXG4gICAgbmFtZVByZWZpeFxuICApO1xuICByZXR1cm4ge1xuICAgIGdldCB0aW1lc3RhbXAoKSB7XG4gICAgICByZXR1cm4gcGFyZW50LnRpbWVzdGFtcDtcbiAgICB9LFxuICAgIGdldCBodHRwKCkge1xuICAgICAgcmV0dXJuIHBhcmVudC5odHRwO1xuICAgIH0sXG4gICAgZ2V0IGlkZW50aXR5KCkge1xuICAgICAgcmV0dXJuIHBhcmVudC5pZGVudGl0eTtcbiAgICB9LFxuICAgIGdldCByYW5kb20oKSB7XG4gICAgICByZXR1cm4gcGFyZW50LnJhbmRvbTtcbiAgICB9LFxuICAgIGFzOiBzdWJBcyxcbiAgICB3aXRoVHgoYm9keSkge1xuICAgICAgcmV0dXJuIHJ1bldpdGhUeCgodHMpID0+IHtcbiAgICAgICAgY29uc3QgdHggPSBuZXcgUmVkdWNlckN0eEltcGwoXG4gICAgICAgICAgSWRlbnRpdHkuemVybygpLFxuICAgICAgICAgIHRzLFxuICAgICAgICAgIG51bGwsXG4gICAgICAgICAgbnNEYl8gPz89IGJ1aWxkRGJWaWV3Rm9yRGlzcGF0Y2goXG4gICAgICAgICAgICBkaXNwYXRjaCxcbiAgICAgICAgICAgIG5hbWVQcmVmaXhcbiAgICAgICAgICApXG4gICAgICAgICk7XG4gICAgICAgIGFzc2lnblR4QWxpYXNWaWV3cyh0eCwgZGlzcGF0Y2guc3ViRGlzcGF0Y2hlcywgbmFtZVByZWZpeCk7XG4gICAgICAgIHJldHVybiB0eDtcbiAgICAgIH0sIGJvZHkpO1xuICAgIH0sXG4gICAgbmV3VXVpZFY0KCkge1xuICAgICAgcmV0dXJuIHBhcmVudC5uZXdVdWlkVjQoKTtcbiAgICB9LFxuICAgIG5ld1V1aWRWNygpIHtcbiAgICAgIHJldHVybiBwYXJlbnQubmV3VXVpZFY3KCk7XG4gICAgfVxuICB9O1xufVxuZnVuY3Rpb24gYnVpbGRIYW5kbGVyQWxpYXNDdHhNYXAocGFyZW50LCBkaXNwYXRjaGVzLCBwYXJlbnRQcmVmaXgpIHtcbiAgcmV0dXJuIGZyZWV6ZShcbiAgICBPYmplY3QuZnJvbUVudHJpZXMoXG4gICAgICBkaXNwYXRjaGVzLm1hcCgoZCkgPT4gW1xuICAgICAgICBkLm5hbWVzcGFjZSxcbiAgICAgICAgYnVpbGRIYW5kbGVyQWxpYXNDdHgocGFyZW50LCBkLCBwYXJlbnRQcmVmaXggKyBkLm5hbWVzcGFjZSArIFwiLlwiKVxuICAgICAgXSlcbiAgICApXG4gICk7XG59XG5mdW5jdGlvbiBidWlsZFByb2NlZHVyZUFsaWFzQ3R4KHBhcmVudCwgZGlzcGF0Y2gsIG5hbWVQcmVmaXgpIHtcbiAgbGV0IG5zRGJfO1xuICBjb25zdCBzdWJBcyA9IGJ1aWxkUHJvY2VkdXJlQWxpYXNDdHhNYXAoXG4gICAgcGFyZW50LFxuICAgIGRpc3BhdGNoLnN1YkRpc3BhdGNoZXMsXG4gICAgbmFtZVByZWZpeFxuICApO1xuICByZXR1cm4ge1xuICAgIGdldCBzZW5kZXIoKSB7XG4gICAgICByZXR1cm4gcGFyZW50LnNlbmRlcjtcbiAgICB9LFxuICAgIGdldCBkYXRhYmFzZUlkZW50aXR5KCkge1xuICAgICAgcmV0dXJuIHBhcmVudC5kYXRhYmFzZUlkZW50aXR5O1xuICAgIH0sXG4gICAgZ2V0IGlkZW50aXR5KCkge1xuICAgICAgcmV0dXJuIHBhcmVudC5pZGVudGl0eTtcbiAgICB9LFxuICAgIGdldCB0aW1lc3RhbXAoKSB7XG4gICAgICByZXR1cm4gcGFyZW50LnRpbWVzdGFtcDtcbiAgICB9LFxuICAgIGdldCBjb25uZWN0aW9uSWQoKSB7XG4gICAgICByZXR1cm4gcGFyZW50LmNvbm5lY3Rpb25JZDtcbiAgICB9LFxuICAgIGdldCBodHRwKCkge1xuICAgICAgcmV0dXJuIHBhcmVudC5odHRwO1xuICAgIH0sXG4gICAgZ2V0IHJhbmRvbSgpIHtcbiAgICAgIHJldHVybiBwYXJlbnQucmFuZG9tO1xuICAgIH0sXG4gICAgc2xlZXAoZHVyYXRpb24pIHtcbiAgICAgIHJldHVybiBwYXJlbnQuc2xlZXAoZHVyYXRpb24pO1xuICAgIH0sXG4gICAgYXM6IHN1YkFzLFxuICAgIHdpdGhUeChib2R5KSB7XG4gICAgICByZXR1cm4gcnVuV2l0aFR4KCh0cykgPT4ge1xuICAgICAgICBjb25zdCB0eCA9IG5ldyBSZWR1Y2VyQ3R4SW1wbChcbiAgICAgICAgICBwYXJlbnQuc2VuZGVyLFxuICAgICAgICAgIHRzLFxuICAgICAgICAgIHBhcmVudC5jb25uZWN0aW9uSWQsXG4gICAgICAgICAgbnNEYl8gPz89IGJ1aWxkRGJWaWV3Rm9yRGlzcGF0Y2goXG4gICAgICAgICAgICBkaXNwYXRjaCxcbiAgICAgICAgICAgIG5hbWVQcmVmaXhcbiAgICAgICAgICApXG4gICAgICAgICk7XG4gICAgICAgIGFzc2lnblR4QWxpYXNWaWV3cyh0eCwgZGlzcGF0Y2guc3ViRGlzcGF0Y2hlcywgbmFtZVByZWZpeCk7XG4gICAgICAgIHJldHVybiB0eDtcbiAgICAgIH0sIGJvZHkpO1xuICAgIH0sXG4gICAgbmV3VXVpZFY0KCkge1xuICAgICAgcmV0dXJuIHBhcmVudC5uZXdVdWlkVjQoKTtcbiAgICB9LFxuICAgIG5ld1V1aWRWNygpIHtcbiAgICAgIHJldHVybiBwYXJlbnQubmV3VXVpZFY3KCk7XG4gICAgfVxuICB9O1xufVxuZnVuY3Rpb24gYnVpbGRQcm9jZWR1cmVBbGlhc0N0eE1hcChwYXJlbnQsIGRpc3BhdGNoZXMsIHBhcmVudFByZWZpeCkge1xuICByZXR1cm4gZnJlZXplKFxuICAgIE9iamVjdC5mcm9tRW50cmllcyhcbiAgICAgIGRpc3BhdGNoZXMubWFwKChkKSA9PiBbXG4gICAgICAgIGQubmFtZXNwYWNlLFxuICAgICAgICBidWlsZFByb2NlZHVyZUFsaWFzQ3R4KHBhcmVudCwgZCwgcGFyZW50UHJlZml4ICsgZC5uYW1lc3BhY2UgKyBcIi5cIilcbiAgICAgIF0pXG4gICAgKVxuICApO1xufVxuZnVuY3Rpb24gYXNzaWduVHhBbGlhc1ZpZXdzKHR4LCBkaXNwYXRjaGVzLCBwYXJlbnRQcmVmaXggPSBcIlwiKSB7XG4gIGlmIChkaXNwYXRjaGVzLmxlbmd0aCA+IDApIHtcbiAgICB0eC5hcyA9IGJ1aWxkQWxpYXNDdHhNYXAodHgsIGRpc3BhdGNoZXMsIHBhcmVudFByZWZpeCk7XG4gIH1cbn1cbmZ1bmN0aW9uIG1ha2VUYWJsZVZpZXcodHlwZXNwYWNlLCB0YWJsZTIsIGJhY2tlbmRPck5hbWVQcmVmaXggPSBob3N0QmFja2VuZCwgbmFtZVByZWZpeCA9IFwiXCIpIHtcbiAgY29uc3QgYmFja2VuZCA9IGlzRGF0YXN0b3JlQmFja2VuZChiYWNrZW5kT3JOYW1lUHJlZml4KSA/IGJhY2tlbmRPck5hbWVQcmVmaXggOiBob3N0QmFja2VuZDtcbiAgaWYgKHR5cGVvZiBiYWNrZW5kT3JOYW1lUHJlZml4ID09PSBcInN0cmluZ1wiKSB7XG4gICAgbmFtZVByZWZpeCA9IGJhY2tlbmRPck5hbWVQcmVmaXg7XG4gIH1cbiAgY29uc3QgdGFibGVfaWQgPSBiYWNrZW5kLnRhYmxlSWRGcm9tTmFtZShuYW1lUHJlZml4ICsgdGFibGUyLnNvdXJjZU5hbWUpO1xuICBjb25zdCByb3dUeXBlID0gdHlwZXNwYWNlLnR5cGVzW3RhYmxlMi5wcm9kdWN0VHlwZVJlZl07XG4gIGlmIChyb3dUeXBlLnRhZyAhPT0gXCJQcm9kdWN0XCIpIHtcbiAgICB0aHJvdyBcImltcG9zc2libGVcIjtcbiAgfVxuICBjb25zdCBzZXJpYWxpemVSb3cgPSBBbGdlYnJhaWNUeXBlLm1ha2VTZXJpYWxpemVyKHJvd1R5cGUsIHR5cGVzcGFjZSk7XG4gIGNvbnN0IGRlc2VyaWFsaXplUm93ID0gQWxnZWJyYWljVHlwZS5tYWtlRGVzZXJpYWxpemVyKHJvd1R5cGUsIHR5cGVzcGFjZSk7XG4gIGNvbnN0IHNlcXVlbmNlcyA9IHRhYmxlMi5zZXF1ZW5jZXMubWFwKChzZXEpID0+IHtcbiAgICBjb25zdCBjb2wgPSByb3dUeXBlLnZhbHVlLmVsZW1lbnRzW3NlcS5jb2x1bW5dO1xuICAgIGNvbnN0IGNvbFR5cGUgPSBjb2wuYWxnZWJyYWljVHlwZTtcbiAgICBsZXQgc2VxdWVuY2VUcmlnZ2VyO1xuICAgIHN3aXRjaCAoY29sVHlwZS50YWcpIHtcbiAgICAgIGNhc2UgXCJVOFwiOlxuICAgICAgY2FzZSBcIkk4XCI6XG4gICAgICBjYXNlIFwiVTE2XCI6XG4gICAgICBjYXNlIFwiSTE2XCI6XG4gICAgICBjYXNlIFwiVTMyXCI6XG4gICAgICBjYXNlIFwiSTMyXCI6XG4gICAgICAgIHNlcXVlbmNlVHJpZ2dlciA9IDA7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcIlU2NFwiOlxuICAgICAgY2FzZSBcIkk2NFwiOlxuICAgICAgY2FzZSBcIlUxMjhcIjpcbiAgICAgIGNhc2UgXCJJMTI4XCI6XG4gICAgICBjYXNlIFwiVTI1NlwiOlxuICAgICAgY2FzZSBcIkkyNTZcIjpcbiAgICAgICAgc2VxdWVuY2VUcmlnZ2VyID0gMG47XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImludmFsaWQgc2VxdWVuY2UgdHlwZVwiKTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbE5hbWU6IGNvbC5uYW1lLFxuICAgICAgc2VxdWVuY2VUcmlnZ2VyLFxuICAgICAgZGVzZXJpYWxpemU6IEFsZ2VicmFpY1R5cGUubWFrZURlc2VyaWFsaXplcihjb2xUeXBlLCB0eXBlc3BhY2UpXG4gICAgfTtcbiAgfSk7XG4gIGNvbnN0IGhhc0F1dG9JbmNyZW1lbnQgPSBzZXF1ZW5jZXMubGVuZ3RoID4gMDtcbiAgY29uc3QgaXRlciA9ICgpID0+IHRhYmxlSXRlcmF0b3IoXG4gICAgYmFja2VuZC5kYXRhc3RvcmVUYWJsZVNjYW5Cc2F0bih0YWJsZV9pZCksXG4gICAgZGVzZXJpYWxpemVSb3csXG4gICAgYmFja2VuZFxuICApO1xuICBjb25zdCBpbnRlZ3JhdGVHZW5lcmF0ZWRDb2x1bW5zID0gaGFzQXV0b0luY3JlbWVudCA/IChyb3csIHJldF9idWYpID0+IHtcbiAgICBCSU5BUllfUkVBREVSLnJlc2V0KHJldF9idWYpO1xuICAgIGZvciAoY29uc3QgeyBjb2xOYW1lLCBkZXNlcmlhbGl6ZSwgc2VxdWVuY2VUcmlnZ2VyIH0gb2Ygc2VxdWVuY2VzKSB7XG4gICAgICBpZiAocm93W2NvbE5hbWVdID09PSBzZXF1ZW5jZVRyaWdnZXIpIHtcbiAgICAgICAgcm93W2NvbE5hbWVdID0gZGVzZXJpYWxpemUoQklOQVJZX1JFQURFUik7XG4gICAgICB9XG4gICAgfVxuICB9IDogbnVsbDtcbiAgY29uc3QgZ2VuZXJhdGVkQ29sdW1uc1ZpZXcgPSAoZ2VuZXJhdGVkLCBmYWxsYmFjaykgPT4gZ2VuZXJhdGVkIGluc3RhbmNlb2YgVWludDhBcnJheSA/IG5ldyBEYXRhVmlldyhcbiAgICBnZW5lcmF0ZWQuYnVmZmVyLFxuICAgIGdlbmVyYXRlZC5ieXRlT2Zmc2V0LFxuICAgIGdlbmVyYXRlZC5ieXRlTGVuZ3RoXG4gICkgOiBmYWxsYmFjaztcbiAgY29uc3QgdGFibGVNZXRob2RzID0ge1xuICAgIGNvdW50OiAoKSA9PiBCaWdJbnQoYmFja2VuZC5kYXRhc3RvcmVUYWJsZVJvd0NvdW50KHRhYmxlX2lkKSksXG4gICAgaXRlcixcbiAgICBbU3ltYm9sLml0ZXJhdG9yXTogKCkgPT4gaXRlcigpLFxuICAgIGluc2VydDogKHJvdykgPT4ge1xuICAgICAgY29uc3QgYnVmID0gTEVBRl9CVUY7XG4gICAgICBCSU5BUllfV1JJVEVSLnJlc2V0KGJ1Zik7XG4gICAgICBzZXJpYWxpemVSb3coQklOQVJZX1dSSVRFUiwgcm93KTtcbiAgICAgIGNvbnN0IGdlbmVyYXRlZCA9IGJhY2tlbmQuZGF0YXN0b3JlSW5zZXJ0QnNhdG4oXG4gICAgICAgIHRhYmxlX2lkLFxuICAgICAgICBidWYuYnVmZmVyLFxuICAgICAgICBCSU5BUllfV1JJVEVSLm9mZnNldFxuICAgICAgKTtcbiAgICAgIGNvbnN0IHJldCA9IHsgLi4ucm93IH07XG4gICAgICBpbnRlZ3JhdGVHZW5lcmF0ZWRDb2x1bW5zPy4oXG4gICAgICAgIHJldCxcbiAgICAgICAgZ2VuZXJhdGVkQ29sdW1uc1ZpZXcoZ2VuZXJhdGVkLCBidWYudmlldylcbiAgICAgICk7XG4gICAgICByZXR1cm4gcmV0O1xuICAgIH0sXG4gICAgZGVsZXRlOiAocm93KSA9PiB7XG4gICAgICBjb25zdCBidWYgPSBMRUFGX0JVRjtcbiAgICAgIEJJTkFSWV9XUklURVIucmVzZXQoYnVmKTtcbiAgICAgIEJJTkFSWV9XUklURVIud3JpdGVVMzIoMSk7XG4gICAgICBzZXJpYWxpemVSb3coQklOQVJZX1dSSVRFUiwgcm93KTtcbiAgICAgIGNvbnN0IGNvdW50ID0gYmFja2VuZC5kYXRhc3RvcmVEZWxldGVBbGxCeUVxQnNhdG4oXG4gICAgICAgIHRhYmxlX2lkLFxuICAgICAgICBidWYuYnVmZmVyLFxuICAgICAgICBCSU5BUllfV1JJVEVSLm9mZnNldFxuICAgICAgKTtcbiAgICAgIHJldHVybiBjb3VudCA+IDA7XG4gICAgfSxcbiAgICBjbGVhcjogKCkgPT4ge1xuICAgICAgY29uc3QgY291bnQgPSBCaWdJbnQoYmFja2VuZC5kYXRhc3RvcmVUYWJsZVJvd0NvdW50KHRhYmxlX2lkKSk7XG4gICAgICBiYWNrZW5kLmRhdGFzdG9yZUNsZWFyKHRhYmxlX2lkKTtcbiAgICAgIHJldHVybiBjb3VudDtcbiAgICB9XG4gIH07XG4gIGNvbnN0IHRhYmxlVmlldyA9IE9iamVjdC5hc3NpZ24oXG4gICAgLyogQF9fUFVSRV9fICovIE9iamVjdC5jcmVhdGUobnVsbCksXG4gICAgdGFibGVNZXRob2RzXG4gICk7XG4gIGZvciAoY29uc3QgaW5kZXhEZWYgb2YgdGFibGUyLmluZGV4ZXMpIHtcbiAgICBjb25zdCBhY2Nlc3Nvck5hbWUgPSBpbmRleERlZi5hY2Nlc3Nvck5hbWU7XG4gICAgY29uc3QgaW5kZXhfaWQgPSBiYWNrZW5kLmluZGV4SWRGcm9tTmFtZShuYW1lUHJlZml4ICsgaW5kZXhEZWYuc291cmNlTmFtZSk7XG4gICAgbGV0IGNvbHVtbl9pZHM7XG4gICAgbGV0IGlzSGFzaEluZGV4ID0gZmFsc2U7XG4gICAgc3dpdGNoIChpbmRleERlZi5hbGdvcml0aG0udGFnKSB7XG4gICAgICBjYXNlIFwiSGFzaFwiOlxuICAgICAgICBpc0hhc2hJbmRleCA9IHRydWU7XG4gICAgICAgIGNvbHVtbl9pZHMgPSBpbmRleERlZi5hbGdvcml0aG0udmFsdWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcIkJUcmVlXCI6XG4gICAgICAgIGNvbHVtbl9pZHMgPSBpbmRleERlZi5hbGdvcml0aG0udmFsdWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcIkRpcmVjdFwiOlxuICAgICAgICBjb2x1bW5faWRzID0gW2luZGV4RGVmLmFsZ29yaXRobS52YWx1ZV07XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBjb25zdCBudW1Db2x1bW5zID0gY29sdW1uX2lkcy5sZW5ndGg7XG4gICAgY29uc3QgY29sdW1uU2V0ID0gbmV3IFNldChjb2x1bW5faWRzKTtcbiAgICBjb25zdCBpc1VuaXF1ZSA9IHRhYmxlMi5jb25zdHJhaW50cy5maWx0ZXIoKHgpID0+IHguZGF0YS50YWcgPT09IFwiVW5pcXVlXCIpLnNvbWUoKHgpID0+IHtcbiAgICAgIGNvbnN0IGNvbnN0cmFpbnRDb2x1bW5zID0gbmV3IFNldCh4LmRhdGEudmFsdWUuY29sdW1ucyk7XG4gICAgICByZXR1cm4gWy4uLmNvbHVtblNldF0uZXZlcnkoKGNvbHVtbikgPT4gY29uc3RyYWludENvbHVtbnMuaGFzKGNvbHVtbikpO1xuICAgIH0pO1xuICAgIGNvbnN0IGlzUHJpbWFyeUtleSA9IGlzVW5pcXVlICYmIGNvbHVtbl9pZHMubGVuZ3RoID09PSB0YWJsZTIucHJpbWFyeUtleS5sZW5ndGggJiYgY29sdW1uX2lkcy5ldmVyeSgoaWQsIGkpID0+IHRhYmxlMi5wcmltYXJ5S2V5W2ldID09PSBpZCk7XG4gICAgY29uc3QgaW5kZXhTZXJpYWxpemVycyA9IGNvbHVtbl9pZHMubWFwKFxuICAgICAgKGlkKSA9PiBBbGdlYnJhaWNUeXBlLm1ha2VTZXJpYWxpemVyKFxuICAgICAgICByb3dUeXBlLnZhbHVlLmVsZW1lbnRzW2lkXS5hbGdlYnJhaWNUeXBlLFxuICAgICAgICB0eXBlc3BhY2VcbiAgICAgIClcbiAgICApO1xuICAgIGNvbnN0IHNlcmlhbGl6ZVBvaW50ID0gKGJ1ZmZlciwgY29sVmFsKSA9PiB7XG4gICAgICBCSU5BUllfV1JJVEVSLnJlc2V0KGJ1ZmZlcik7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bUNvbHVtbnM7IGkrKykge1xuICAgICAgICBpbmRleFNlcmlhbGl6ZXJzW2ldKEJJTkFSWV9XUklURVIsIGNvbFZhbFtpXSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gQklOQVJZX1dSSVRFUi5vZmZzZXQ7XG4gICAgfTtcbiAgICBjb25zdCBzZXJpYWxpemVTaW5nbGVFbGVtZW50ID0gbnVtQ29sdW1ucyA9PT0gMSA/IGluZGV4U2VyaWFsaXplcnNbMF0gOiBudWxsO1xuICAgIGNvbnN0IHNlcmlhbGl6ZVNpbmdsZVBvaW50ID0gc2VyaWFsaXplU2luZ2xlRWxlbWVudCAmJiAoKGJ1ZmZlciwgY29sVmFsKSA9PiB7XG4gICAgICBCSU5BUllfV1JJVEVSLnJlc2V0KGJ1ZmZlcik7XG4gICAgICBzZXJpYWxpemVTaW5nbGVFbGVtZW50KEJJTkFSWV9XUklURVIsIGNvbFZhbCk7XG4gICAgICByZXR1cm4gQklOQVJZX1dSSVRFUi5vZmZzZXQ7XG4gICAgfSk7XG4gICAgbGV0IGluZGV4O1xuICAgIGlmIChpc1VuaXF1ZSAmJiBzZXJpYWxpemVTaW5nbGVQb2ludCkge1xuICAgICAgY29uc3QgYmFzZSA9IHtcbiAgICAgICAgZmluZDogKGNvbFZhbCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGJ1ZiA9IExFQUZfQlVGO1xuICAgICAgICAgIGNvbnN0IHBvaW50X2xlbiA9IHNlcmlhbGl6ZVNpbmdsZVBvaW50KGJ1ZiwgY29sVmFsKTtcbiAgICAgICAgICBjb25zdCBpdGVyX2lkID0gYmFja2VuZC5kYXRhc3RvcmVJbmRleFNjYW5Qb2ludEJzYXRuKFxuICAgICAgICAgICAgaW5kZXhfaWQsXG4gICAgICAgICAgICBidWYuYnVmZmVyLFxuICAgICAgICAgICAgcG9pbnRfbGVuXG4gICAgICAgICAgKTtcbiAgICAgICAgICByZXR1cm4gdGFibGVJdGVyYXRlT25lKGl0ZXJfaWQsIGRlc2VyaWFsaXplUm93LCBiYWNrZW5kKTtcbiAgICAgICAgfSxcbiAgICAgICAgZGVsZXRlOiAoY29sVmFsKSA9PiB7XG4gICAgICAgICAgY29uc3QgYnVmID0gTEVBRl9CVUY7XG4gICAgICAgICAgY29uc3QgcG9pbnRfbGVuID0gc2VyaWFsaXplU2luZ2xlUG9pbnQoYnVmLCBjb2xWYWwpO1xuICAgICAgICAgIGNvbnN0IG51bSA9IGJhY2tlbmQuZGF0YXN0b3JlRGVsZXRlQnlJbmRleFNjYW5Qb2ludEJzYXRuKFxuICAgICAgICAgICAgaW5kZXhfaWQsXG4gICAgICAgICAgICBidWYuYnVmZmVyLFxuICAgICAgICAgICAgcG9pbnRfbGVuXG4gICAgICAgICAgKTtcbiAgICAgICAgICByZXR1cm4gbnVtID4gMDtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIGlmIChpc1ByaW1hcnlLZXkpIHtcbiAgICAgICAgYmFzZS51cGRhdGUgPSAocm93KSA9PiB7XG4gICAgICAgICAgY29uc3QgYnVmID0gTEVBRl9CVUY7XG4gICAgICAgICAgQklOQVJZX1dSSVRFUi5yZXNldChidWYpO1xuICAgICAgICAgIHNlcmlhbGl6ZVJvdyhCSU5BUllfV1JJVEVSLCByb3cpO1xuICAgICAgICAgIGNvbnN0IGdlbmVyYXRlZCA9IGJhY2tlbmQuZGF0YXN0b3JlVXBkYXRlQnNhdG4oXG4gICAgICAgICAgICB0YWJsZV9pZCxcbiAgICAgICAgICAgIGluZGV4X2lkLFxuICAgICAgICAgICAgYnVmLmJ1ZmZlcixcbiAgICAgICAgICAgIEJJTkFSWV9XUklURVIub2Zmc2V0XG4gICAgICAgICAgKTtcbiAgICAgICAgICBpbnRlZ3JhdGVHZW5lcmF0ZWRDb2x1bW5zPy4oXG4gICAgICAgICAgICByb3csXG4gICAgICAgICAgICBnZW5lcmF0ZWRDb2x1bW5zVmlldyhnZW5lcmF0ZWQsIGJ1Zi52aWV3KVxuICAgICAgICAgICk7XG4gICAgICAgICAgcmV0dXJuIHJvdztcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIGluZGV4ID0gYmFzZTtcbiAgICB9IGVsc2UgaWYgKGlzVW5pcXVlKSB7XG4gICAgICBjb25zdCBiYXNlID0ge1xuICAgICAgICBmaW5kOiAoY29sVmFsKSA9PiB7XG4gICAgICAgICAgaWYgKGNvbFZhbC5sZW5ndGggIT09IG51bUNvbHVtbnMpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJ3cm9uZyBudW1iZXIgb2YgZWxlbWVudHNcIik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IGJ1ZiA9IExFQUZfQlVGO1xuICAgICAgICAgIGNvbnN0IHBvaW50X2xlbiA9IHNlcmlhbGl6ZVBvaW50KGJ1ZiwgY29sVmFsKTtcbiAgICAgICAgICBjb25zdCBpdGVyX2lkID0gYmFja2VuZC5kYXRhc3RvcmVJbmRleFNjYW5Qb2ludEJzYXRuKFxuICAgICAgICAgICAgaW5kZXhfaWQsXG4gICAgICAgICAgICBidWYuYnVmZmVyLFxuICAgICAgICAgICAgcG9pbnRfbGVuXG4gICAgICAgICAgKTtcbiAgICAgICAgICByZXR1cm4gdGFibGVJdGVyYXRlT25lKGl0ZXJfaWQsIGRlc2VyaWFsaXplUm93LCBiYWNrZW5kKTtcbiAgICAgICAgfSxcbiAgICAgICAgZGVsZXRlOiAoY29sVmFsKSA9PiB7XG4gICAgICAgICAgaWYgKGNvbFZhbC5sZW5ndGggIT09IG51bUNvbHVtbnMpXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwid3JvbmcgbnVtYmVyIG9mIGVsZW1lbnRzXCIpO1xuICAgICAgICAgIGNvbnN0IGJ1ZiA9IExFQUZfQlVGO1xuICAgICAgICAgIGNvbnN0IHBvaW50X2xlbiA9IHNlcmlhbGl6ZVBvaW50KGJ1ZiwgY29sVmFsKTtcbiAgICAgICAgICBjb25zdCBudW0gPSBiYWNrZW5kLmRhdGFzdG9yZURlbGV0ZUJ5SW5kZXhTY2FuUG9pbnRCc2F0bihcbiAgICAgICAgICAgIGluZGV4X2lkLFxuICAgICAgICAgICAgYnVmLmJ1ZmZlcixcbiAgICAgICAgICAgIHBvaW50X2xlblxuICAgICAgICAgICk7XG4gICAgICAgICAgcmV0dXJuIG51bSA+IDA7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBpZiAoaXNQcmltYXJ5S2V5KSB7XG4gICAgICAgIGJhc2UudXBkYXRlID0gKHJvdykgPT4ge1xuICAgICAgICAgIGNvbnN0IGJ1ZiA9IExFQUZfQlVGO1xuICAgICAgICAgIEJJTkFSWV9XUklURVIucmVzZXQoYnVmKTtcbiAgICAgICAgICBzZXJpYWxpemVSb3coQklOQVJZX1dSSVRFUiwgcm93KTtcbiAgICAgICAgICBjb25zdCBnZW5lcmF0ZWQgPSBiYWNrZW5kLmRhdGFzdG9yZVVwZGF0ZUJzYXRuKFxuICAgICAgICAgICAgdGFibGVfaWQsXG4gICAgICAgICAgICBpbmRleF9pZCxcbiAgICAgICAgICAgIGJ1Zi5idWZmZXIsXG4gICAgICAgICAgICBCSU5BUllfV1JJVEVSLm9mZnNldFxuICAgICAgICAgICk7XG4gICAgICAgICAgaW50ZWdyYXRlR2VuZXJhdGVkQ29sdW1ucz8uKFxuICAgICAgICAgICAgcm93LFxuICAgICAgICAgICAgZ2VuZXJhdGVkQ29sdW1uc1ZpZXcoZ2VuZXJhdGVkLCBidWYudmlldylcbiAgICAgICAgICApO1xuICAgICAgICAgIHJldHVybiByb3c7XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBpbmRleCA9IGJhc2U7XG4gICAgfSBlbHNlIGlmIChzZXJpYWxpemVTaW5nbGVQb2ludCkge1xuICAgICAgY29uc3Qgc2VyaWFsaXplU2luZ2xlUmFuZ2UgPSAhaXNIYXNoSW5kZXggPyAoYnVmZmVyLCByYW5nZSkgPT4ge1xuICAgICAgICBCSU5BUllfV1JJVEVSLnJlc2V0KGJ1ZmZlcik7XG4gICAgICAgIGNvbnN0IHdyaXRlciA9IEJJTkFSWV9XUklURVI7XG4gICAgICAgIGNvbnN0IHdyaXRlQm91bmQgPSAoYm91bmQpID0+IHtcbiAgICAgICAgICBjb25zdCB0YWdzID0geyBpbmNsdWRlZDogMCwgZXhjbHVkZWQ6IDEsIHVuYm91bmRlZDogMiB9O1xuICAgICAgICAgIHdyaXRlci53cml0ZVU4KHRhZ3NbYm91bmQudGFnXSk7XG4gICAgICAgICAgaWYgKGJvdW5kLnRhZyAhPT0gXCJ1bmJvdW5kZWRcIilcbiAgICAgICAgICAgIHNlcmlhbGl6ZVNpbmdsZUVsZW1lbnQod3JpdGVyLCBib3VuZC52YWx1ZSk7XG4gICAgICAgIH07XG4gICAgICAgIHdyaXRlQm91bmQocmFuZ2UuZnJvbSk7XG4gICAgICAgIGNvbnN0IHJzdGFydExlbiA9IHdyaXRlci5vZmZzZXQ7XG4gICAgICAgIHdyaXRlQm91bmQocmFuZ2UudG8pO1xuICAgICAgICBjb25zdCByZW5kTGVuID0gd3JpdGVyLm9mZnNldCAtIHJzdGFydExlbjtcbiAgICAgICAgcmV0dXJuIFswLCAwLCByc3RhcnRMZW4sIHJlbmRMZW5dO1xuICAgICAgfSA6IG51bGw7XG4gICAgICBjb25zdCByYXdJbmRleCA9IHtcbiAgICAgICAgZmlsdGVyOiAocmFuZ2UpID0+IHtcbiAgICAgICAgICBjb25zdCBidWYgPSBMRUFGX0JVRjtcbiAgICAgICAgICBpZiAoc2VyaWFsaXplU2luZ2xlUmFuZ2UgJiYgcmFuZ2UgaW5zdGFuY2VvZiBSYW5nZSkge1xuICAgICAgICAgICAgY29uc3QgYXJncyA9IHNlcmlhbGl6ZVNpbmdsZVJhbmdlKGJ1ZiwgcmFuZ2UpO1xuICAgICAgICAgICAgY29uc3QgaXRlcl9pZDIgPSBiYWNrZW5kLmRhdGFzdG9yZUluZGV4U2NhblJhbmdlQnNhdG4oXG4gICAgICAgICAgICAgIGluZGV4X2lkLFxuICAgICAgICAgICAgICBidWYuYnVmZmVyLFxuICAgICAgICAgICAgICAuLi5hcmdzXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmV0dXJuIHRhYmxlSXRlcmF0b3IoaXRlcl9pZDIsIGRlc2VyaWFsaXplUm93LCBiYWNrZW5kKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgcG9pbnRfbGVuID0gc2VyaWFsaXplU2luZ2xlUG9pbnQoYnVmLCByYW5nZSk7XG4gICAgICAgICAgY29uc3QgaXRlcl9pZCA9IGJhY2tlbmQuZGF0YXN0b3JlSW5kZXhTY2FuUG9pbnRCc2F0bihcbiAgICAgICAgICAgIGluZGV4X2lkLFxuICAgICAgICAgICAgYnVmLmJ1ZmZlcixcbiAgICAgICAgICAgIHBvaW50X2xlblxuICAgICAgICAgICk7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlSXRlcmF0b3IoaXRlcl9pZCwgZGVzZXJpYWxpemVSb3csIGJhY2tlbmQpO1xuICAgICAgICB9LFxuICAgICAgICBkZWxldGU6IChyYW5nZSkgPT4ge1xuICAgICAgICAgIGNvbnN0IGJ1ZiA9IExFQUZfQlVGO1xuICAgICAgICAgIGlmIChzZXJpYWxpemVTaW5nbGVSYW5nZSAmJiByYW5nZSBpbnN0YW5jZW9mIFJhbmdlKSB7XG4gICAgICAgICAgICBjb25zdCBhcmdzID0gc2VyaWFsaXplU2luZ2xlUmFuZ2UoYnVmLCByYW5nZSk7XG4gICAgICAgICAgICByZXR1cm4gYmFja2VuZC5kYXRhc3RvcmVEZWxldGVCeUluZGV4U2NhblJhbmdlQnNhdG4oXG4gICAgICAgICAgICAgIGluZGV4X2lkLFxuICAgICAgICAgICAgICBidWYuYnVmZmVyLFxuICAgICAgICAgICAgICAuLi5hcmdzXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBwb2ludF9sZW4gPSBzZXJpYWxpemVTaW5nbGVQb2ludChidWYsIHJhbmdlKTtcbiAgICAgICAgICByZXR1cm4gYmFja2VuZC5kYXRhc3RvcmVEZWxldGVCeUluZGV4U2NhblBvaW50QnNhdG4oXG4gICAgICAgICAgICBpbmRleF9pZCxcbiAgICAgICAgICAgIGJ1Zi5idWZmZXIsXG4gICAgICAgICAgICBwb2ludF9sZW5cbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgaWYgKGlzSGFzaEluZGV4KSB7XG4gICAgICAgIGluZGV4ID0gcmF3SW5kZXg7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpbmRleCA9IHJhd0luZGV4O1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXNIYXNoSW5kZXgpIHtcbiAgICAgIGluZGV4ID0ge1xuICAgICAgICBmaWx0ZXI6IChyYW5nZSkgPT4ge1xuICAgICAgICAgIGNvbnN0IGJ1ZiA9IExFQUZfQlVGO1xuICAgICAgICAgIGNvbnN0IHBvaW50X2xlbiA9IHNlcmlhbGl6ZVBvaW50KGJ1ZiwgcmFuZ2UpO1xuICAgICAgICAgIGNvbnN0IGl0ZXJfaWQgPSBiYWNrZW5kLmRhdGFzdG9yZUluZGV4U2NhblBvaW50QnNhdG4oXG4gICAgICAgICAgICBpbmRleF9pZCxcbiAgICAgICAgICAgIGJ1Zi5idWZmZXIsXG4gICAgICAgICAgICBwb2ludF9sZW5cbiAgICAgICAgICApO1xuICAgICAgICAgIHJldHVybiB0YWJsZUl0ZXJhdG9yKGl0ZXJfaWQsIGRlc2VyaWFsaXplUm93LCBiYWNrZW5kKTtcbiAgICAgICAgfSxcbiAgICAgICAgZGVsZXRlOiAocmFuZ2UpID0+IHtcbiAgICAgICAgICBjb25zdCBidWYgPSBMRUFGX0JVRjtcbiAgICAgICAgICBjb25zdCBwb2ludF9sZW4gPSBzZXJpYWxpemVQb2ludChidWYsIHJhbmdlKTtcbiAgICAgICAgICByZXR1cm4gYmFja2VuZC5kYXRhc3RvcmVEZWxldGVCeUluZGV4U2NhblBvaW50QnNhdG4oXG4gICAgICAgICAgICBpbmRleF9pZCxcbiAgICAgICAgICAgIGJ1Zi5idWZmZXIsXG4gICAgICAgICAgICBwb2ludF9sZW5cbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBpc0NvbXBsZXRlU2NhbGFyS2V5ID0gKHJhbmdlKSA9PiB7XG4gICAgICAgIHJldHVybiByYW5nZS5sZW5ndGggPT09IG51bUNvbHVtbnMgJiYgIShyYW5nZVtyYW5nZS5sZW5ndGggLSAxXSBpbnN0YW5jZW9mIFJhbmdlKTtcbiAgICAgIH07XG4gICAgICBjb25zdCBzZXJpYWxpemVSYW5nZSA9IChidWZmZXIsIHJhbmdlKSA9PiB7XG4gICAgICAgIGlmIChyYW5nZS5sZW5ndGggPiBudW1Db2x1bW5zKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwidG9vIG1hbnkgZWxlbWVudHNcIik7XG4gICAgICAgIEJJTkFSWV9XUklURVIucmVzZXQoYnVmZmVyKTtcbiAgICAgICAgY29uc3Qgd3JpdGVyID0gQklOQVJZX1dSSVRFUjtcbiAgICAgICAgY29uc3QgcHJlZml4X2VsZW1zID0gcmFuZ2UubGVuZ3RoIC0gMTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcmVmaXhfZWxlbXM7IGkrKykge1xuICAgICAgICAgIGluZGV4U2VyaWFsaXplcnNbaV0od3JpdGVyLCByYW5nZVtpXSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcnN0YXJ0T2Zmc2V0ID0gd3JpdGVyLm9mZnNldDtcbiAgICAgICAgY29uc3QgdGVybSA9IHJhbmdlW3JhbmdlLmxlbmd0aCAtIDFdO1xuICAgICAgICBjb25zdCBzZXJpYWxpemVUZXJtID0gaW5kZXhTZXJpYWxpemVyc1tyYW5nZS5sZW5ndGggLSAxXTtcbiAgICAgICAgaWYgKHRlcm0gaW5zdGFuY2VvZiBSYW5nZSkge1xuICAgICAgICAgIGNvbnN0IHdyaXRlQm91bmQgPSAoYm91bmQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHRhZ3MgPSB7IGluY2x1ZGVkOiAwLCBleGNsdWRlZDogMSwgdW5ib3VuZGVkOiAyIH07XG4gICAgICAgICAgICB3cml0ZXIud3JpdGVVOCh0YWdzW2JvdW5kLnRhZ10pO1xuICAgICAgICAgICAgaWYgKGJvdW5kLnRhZyAhPT0gXCJ1bmJvdW5kZWRcIikgc2VyaWFsaXplVGVybSh3cml0ZXIsIGJvdW5kLnZhbHVlKTtcbiAgICAgICAgICB9O1xuICAgICAgICAgIHdyaXRlQm91bmQodGVybS5mcm9tKTtcbiAgICAgICAgICBjb25zdCByc3RhcnRMZW4gPSB3cml0ZXIub2Zmc2V0IC0gcnN0YXJ0T2Zmc2V0O1xuICAgICAgICAgIHdyaXRlQm91bmQodGVybS50byk7XG4gICAgICAgICAgY29uc3QgcmVuZExlbiA9IHdyaXRlci5vZmZzZXQgLSByc3RhcnRPZmZzZXQgLSByc3RhcnRMZW47XG4gICAgICAgICAgcmV0dXJuIFtyc3RhcnRPZmZzZXQsIHByZWZpeF9lbGVtcywgcnN0YXJ0TGVuLCByZW5kTGVuXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB3cml0ZXIud3JpdGVVOCgwKTtcbiAgICAgICAgICBzZXJpYWxpemVUZXJtKHdyaXRlciwgdGVybSk7XG4gICAgICAgICAgY29uc3QgcnN0YXJ0TGVuID0gd3JpdGVyLm9mZnNldCAtIHJzdGFydE9mZnNldDtcbiAgICAgICAgICBjb25zdCByZW5kTGVuID0gMDtcbiAgICAgICAgICByZXR1cm4gW3JzdGFydE9mZnNldCwgcHJlZml4X2VsZW1zLCByc3RhcnRMZW4sIHJlbmRMZW5dO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgaW5kZXggPSB7XG4gICAgICAgIGZpbHRlcjogKHJhbmdlKSA9PiB7XG4gICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHJhbmdlKSkgcmFuZ2UgPSBbcmFuZ2VdO1xuICAgICAgICAgIGlmIChpc0NvbXBsZXRlU2NhbGFyS2V5KHJhbmdlKSkge1xuICAgICAgICAgICAgY29uc3QgYnVmID0gTEVBRl9CVUY7XG4gICAgICAgICAgICBjb25zdCBwb2ludF9sZW4gPSBzZXJpYWxpemVQb2ludChidWYsIHJhbmdlKTtcbiAgICAgICAgICAgIGNvbnN0IGl0ZXJfaWQgPSBiYWNrZW5kLmRhdGFzdG9yZUluZGV4U2NhblBvaW50QnNhdG4oXG4gICAgICAgICAgICAgIGluZGV4X2lkLFxuICAgICAgICAgICAgICBidWYuYnVmZmVyLFxuICAgICAgICAgICAgICBwb2ludF9sZW5cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICByZXR1cm4gdGFibGVJdGVyYXRvcihpdGVyX2lkLCBkZXNlcmlhbGl6ZVJvdywgYmFja2VuZCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGJ1ZiA9IExFQUZfQlVGO1xuICAgICAgICAgICAgY29uc3QgYXJncyA9IHNlcmlhbGl6ZVJhbmdlKGJ1ZiwgcmFuZ2UpO1xuICAgICAgICAgICAgY29uc3QgaXRlcl9pZCA9IGJhY2tlbmQuZGF0YXN0b3JlSW5kZXhTY2FuUmFuZ2VCc2F0bihcbiAgICAgICAgICAgICAgaW5kZXhfaWQsXG4gICAgICAgICAgICAgIGJ1Zi5idWZmZXIsXG4gICAgICAgICAgICAgIC4uLmFyZ3NcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICByZXR1cm4gdGFibGVJdGVyYXRvcihpdGVyX2lkLCBkZXNlcmlhbGl6ZVJvdywgYmFja2VuZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBkZWxldGU6IChyYW5nZSkgPT4ge1xuICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShyYW5nZSkpIHJhbmdlID0gW3JhbmdlXTtcbiAgICAgICAgICBpZiAoaXNDb21wbGV0ZVNjYWxhcktleShyYW5nZSkpIHtcbiAgICAgICAgICAgIGNvbnN0IGJ1ZiA9IExFQUZfQlVGO1xuICAgICAgICAgICAgY29uc3QgcG9pbnRfbGVuID0gc2VyaWFsaXplUG9pbnQoYnVmLCByYW5nZSk7XG4gICAgICAgICAgICByZXR1cm4gYmFja2VuZC5kYXRhc3RvcmVEZWxldGVCeUluZGV4U2NhblBvaW50QnNhdG4oXG4gICAgICAgICAgICAgIGluZGV4X2lkLFxuICAgICAgICAgICAgICBidWYuYnVmZmVyLFxuICAgICAgICAgICAgICBwb2ludF9sZW5cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGJ1ZiA9IExFQUZfQlVGO1xuICAgICAgICAgICAgY29uc3QgYXJncyA9IHNlcmlhbGl6ZVJhbmdlKGJ1ZiwgcmFuZ2UpO1xuICAgICAgICAgICAgcmV0dXJuIGJhY2tlbmQuZGF0YXN0b3JlRGVsZXRlQnlJbmRleFNjYW5SYW5nZUJzYXRuKFxuICAgICAgICAgICAgICBpbmRleF9pZCxcbiAgICAgICAgICAgICAgYnVmLmJ1ZmZlcixcbiAgICAgICAgICAgICAgLi4uYXJnc1xuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfVxuICAgIGlmIChPYmplY3QuaGFzT3duKHRhYmxlVmlldywgYWNjZXNzb3JOYW1lKSkge1xuICAgICAgZnJlZXplKE9iamVjdC5hc3NpZ24odGFibGVWaWV3W2FjY2Vzc29yTmFtZV0sIGluZGV4KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRhYmxlVmlld1thY2Nlc3Nvck5hbWVdID0gZnJlZXplKGluZGV4KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZyZWV6ZSh0YWJsZVZpZXcpO1xufVxuZnVuY3Rpb24qIHRhYmxlSXRlcmF0b3IoaWQsIGRlc2VyaWFsaXplLCBiYWNrZW5kID0gaG9zdEJhY2tlbmQpIHtcbiAgY29uc3QgaXRlciA9IG5ldyBJdGVyYXRvckhhbmRsZShpZCwgYmFja2VuZCk7XG4gIGNvbnN0IGl0ZXJCdWYgPSB0YWtlQnVmKCk7XG4gIHRyeSB7XG4gICAgbGV0IGFtdDtcbiAgICB3aGlsZSAoYW10ID0gaXRlci5hZHZhbmNlKGl0ZXJCdWYpKSB7XG4gICAgICBjb25zdCByZWFkZXIgPSBuZXcgQmluYXJ5UmVhZGVyKGl0ZXJCdWYudmlldyk7XG4gICAgICB3aGlsZSAocmVhZGVyLm9mZnNldCA8IGFtdCkge1xuICAgICAgICB5aWVsZCBkZXNlcmlhbGl6ZShyZWFkZXIpO1xuICAgICAgfVxuICAgIH1cbiAgfSBmaW5hbGx5IHtcbiAgICBpdGVyW1N5bWJvbC5kaXNwb3NlXSgpO1xuICAgIHJldHVybkJ1ZihpdGVyQnVmKTtcbiAgfVxufVxuZnVuY3Rpb24gdGFibGVJdGVyYXRlT25lKGlkLCBkZXNlcmlhbGl6ZSwgYmFja2VuZCA9IGhvc3RCYWNrZW5kKSB7XG4gIGNvbnN0IGJ1ZiA9IExFQUZfQlVGO1xuICBjb25zdCByZXQgPSBhZHZhbmNlSXRlclJhdyhpZCwgYnVmLCBiYWNrZW5kKTtcbiAgaWYgKHJldCAhPT0gMCkge1xuICAgIEJJTkFSWV9SRUFERVIucmVzZXQoYnVmLnZpZXcpO1xuICAgIHJldHVybiBkZXNlcmlhbGl6ZShCSU5BUllfUkVBREVSKTtcbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cbmZ1bmN0aW9uIGFkdmFuY2VJdGVyUmF3KGlkLCBidWYsIGJhY2tlbmQgPSBob3N0QmFja2VuZCkge1xuICB3aGlsZSAodHJ1ZSkge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gMCB8IGJhY2tlbmQucm93SXRlckJzYXRuQWR2YW5jZShpZCwgYnVmLmJ1ZmZlcik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGUgJiYgdHlwZW9mIGUgPT09IFwib2JqZWN0XCIgJiYgaGFzT3duKGUsIFwiX19idWZmZXJfdG9vX3NtYWxsX19cIikpIHtcbiAgICAgICAgYnVmLmdyb3coZS5fX2J1ZmZlcl90b29fc21hbGxfXyk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gIH1cbn1cbnZhciBERUZBVUxUX0JVRkZFUl9DQVBBQ0lUWSA9IDMyICogMTAyNCAqIDI7XG52YXIgSVRFUl9CVUZTID0gW1xuICBuZXcgUmVzaXphYmxlQnVmZmVyKERFRkFVTFRfQlVGRkVSX0NBUEFDSVRZKVxuXTtcbnZhciBJVEVSX0JVRl9DT1VOVCA9IDE7XG5mdW5jdGlvbiB0YWtlQnVmKCkge1xuICByZXR1cm4gSVRFUl9CVUZfQ09VTlQgPyBJVEVSX0JVRlNbLS1JVEVSX0JVRl9DT1VOVF0gOiBuZXcgUmVzaXphYmxlQnVmZmVyKERFRkFVTFRfQlVGRkVSX0NBUEFDSVRZKTtcbn1cbmZ1bmN0aW9uIHJldHVybkJ1ZihidWYpIHtcbiAgSVRFUl9CVUZTW0lURVJfQlVGX0NPVU5UKytdID0gYnVmO1xufVxudmFyIExFQUZfQlVGID0gbmV3IFJlc2l6YWJsZUJ1ZmZlcihERUZBVUxUX0JVRkZFUl9DQVBBQ0lUWSk7XG52YXIgSXRlcmF0b3JIYW5kbGUgPSBjbGFzcyBfSXRlcmF0b3JIYW5kbGUge1xuICAjaWQ7XG4gICNiYWNrZW5kO1xuICBzdGF0aWMgI2ZpbmFsaXphdGlvblJlZ2lzdHJ5ID0gbmV3IEZpbmFsaXphdGlvblJlZ2lzdHJ5KCh7IGlkLCBiYWNrZW5kIH0pID0+IGJhY2tlbmQucm93SXRlckJzYXRuQ2xvc2UoaWQpKTtcbiAgY29uc3RydWN0b3IoaWQsIGJhY2tlbmQgPSBob3N0QmFja2VuZCkge1xuICAgIHRoaXMuI2lkID0gaWQ7XG4gICAgdGhpcy4jYmFja2VuZCA9IGJhY2tlbmQ7XG4gICAgX0l0ZXJhdG9ySGFuZGxlLiNmaW5hbGl6YXRpb25SZWdpc3RyeS5yZWdpc3Rlcih0aGlzLCB7IGlkLCBiYWNrZW5kIH0sIHRoaXMpO1xuICB9XG4gIC8qKiBVbnJlZ2lzdGVyIHRoaXMgb2JqZWN0IHdpdGggdGhlIGZpbmFsaXphdGlvbiByZWdpc3RyeSBhbmQgcmV0dXJuIHRoZSBpZCAqL1xuICAjZGV0YWNoKCkge1xuICAgIGNvbnN0IGlkID0gdGhpcy4jaWQ7XG4gICAgdGhpcy4jaWQgPSAtMTtcbiAgICBfSXRlcmF0b3JIYW5kbGUuI2ZpbmFsaXphdGlvblJlZ2lzdHJ5LnVucmVnaXN0ZXIodGhpcyk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKiBDYWxsIGByb3dfaXRlcl9ic2F0bl9hZHZhbmNlYCwgcmV0dXJuaW5nIDAgaWYgdGhpcyBpdGVyYXRvciBoYXMgYmVlbiBleGhhdXN0ZWQuICovXG4gIGFkdmFuY2UoYnVmKSB7XG4gICAgaWYgKHRoaXMuI2lkID09PSAtMSkgcmV0dXJuIDA7XG4gICAgY29uc3QgcmV0ID0gYWR2YW5jZUl0ZXJSYXcodGhpcy4jaWQsIGJ1ZiwgdGhpcy4jYmFja2VuZCk7XG4gICAgaWYgKHJldCA8PSAwKSB0aGlzLiNkZXRhY2goKTtcbiAgICByZXR1cm4gcmV0IDwgMCA/IC1yZXQgOiByZXQ7XG4gIH1cbiAgW1N5bWJvbC5kaXNwb3NlXSgpIHtcbiAgICBpZiAodGhpcy4jaWQgPj0gMCkge1xuICAgICAgY29uc3QgaWQgPSB0aGlzLiNkZXRhY2goKTtcbiAgICAgIHRoaXMuI2JhY2tlbmQucm93SXRlckJzYXRuQ2xvc2UoaWQpO1xuICAgIH1cbiAgfVxufTtcblxuLy8gc3JjL3NlcnZlci9odHRwX2ludGVybmFsLnRzXG52YXIgeyBmcmVlemU6IGZyZWV6ZTIgfSA9IE9iamVjdDtcbnZhciByZXF1ZXN0QmFzZVNpemUgPSBic2F0bkJhc2VTaXplKHsgdHlwZXM6IFtdIH0sIEh0dHBSZXF1ZXN0LmFsZ2VicmFpY1R5cGUpO1xuZnVuY3Rpb24gZmV0Y2godXJsLCBpbml0ID0ge30pIHtcbiAgY29uc3QgbWV0aG9kID0gc2VyaWFsaXplTWV0aG9kKGluaXQubWV0aG9kKTtcbiAgY29uc3QgaGVhZGVycyA9IHNlcmlhbGl6ZUhlYWRlcnMobmV3IEhlYWRlcnMoaW5pdC5oZWFkZXJzKSk7XG4gIGNvbnN0IHVyaSA9IFwiXCIgKyB1cmw7XG4gIGNvbnN0IHJlcXVlc3QgPSBmcmVlemUyKHtcbiAgICBtZXRob2QsXG4gICAgaGVhZGVycyxcbiAgICB0aW1lb3V0OiBpbml0LnRpbWVvdXQsXG4gICAgdXJpLFxuICAgIHZlcnNpb246IHsgdGFnOiBcIkh0dHAxMVwiIH1cbiAgfSk7XG4gIGNvbnN0IHJlcXVlc3RCdWYgPSBuZXcgQmluYXJ5V3JpdGVyKHJlcXVlc3RCYXNlU2l6ZSk7XG4gIEh0dHBSZXF1ZXN0LnNlcmlhbGl6ZShyZXF1ZXN0QnVmLCByZXF1ZXN0KTtcbiAgY29uc3QgYm9keSA9IGluaXQuYm9keSA9PSBudWxsID8gbmV3IFVpbnQ4QXJyYXkoKSA6IHR5cGVvZiBpbml0LmJvZHkgPT09IFwic3RyaW5nXCIgPyBpbml0LmJvZHkgOiBuZXcgVWludDhBcnJheShpbml0LmJvZHkpO1xuICBjb25zdCBbcmVzcG9uc2VCdWYsIHJlc3BvbnNlQm9keV0gPSBzeXMyLnByb2NlZHVyZV9odHRwX3JlcXVlc3QoXG4gICAgcmVxdWVzdEJ1Zi5nZXRCdWZmZXIoKSxcbiAgICBib2R5XG4gICk7XG4gIGNvbnN0IHJlc3BvbnNlID0gSHR0cFJlc3BvbnNlLmRlc2VyaWFsaXplKG5ldyBCaW5hcnlSZWFkZXIocmVzcG9uc2VCdWYpKTtcbiAgcmV0dXJuIFN5bmNSZXNwb25zZVttYWtlUmVzcG9uc2VdKHJlc3BvbnNlQm9keSwge1xuICAgIHR5cGU6IFwiYmFzaWNcIixcbiAgICB1cmw6IHVyaSxcbiAgICBzdGF0dXM6IHJlc3BvbnNlLmNvZGUsXG4gICAgLy8gYHN0YXR1cyhjb2RlKWAgdGhyb3dzIGZvciBjb2RlcyBpdCBkb2Vzbid0IGtub3csIGxpa2UgQ2xvdWRmbGFyZSdzIDUzMC5cbiAgICBzdGF0dXNUZXh0OiBpbXBvcnRfc3RhdHVzZXMuZGVmYXVsdC5tZXNzYWdlW3Jlc3BvbnNlLmNvZGVdID8/IFwiXCIsXG4gICAgaGVhZGVyczogZGVzZXJpYWxpemVIZWFkZXJzKHJlc3BvbnNlLmhlYWRlcnMpLFxuICAgIGFib3J0ZWQ6IGZhbHNlLFxuICAgIHZlcnNpb246IHJlc3BvbnNlLnZlcnNpb25cbiAgfSk7XG59XG5mcmVlemUyKGZldGNoKTtcbnZhciBodHRwQ2xpZW50ID0gZnJlZXplMih7IGZldGNoIH0pO1xuXG4vLyBzcmMvc2VydmVyL3Byb2NlZHVyZXMudHNcbmZ1bmN0aW9uIG1ha2VQcm9jZWR1cmVFeHBvcnQoY3R4LCBvcHRzLCBwYXJhbXMsIHJldCwgZm4pIHtcbiAgY29uc3QgbmFtZSA9IG9wdHM/Lm5hbWU7XG4gIGNvbnN0IHByb2NlZHVyZUV4cG9ydCA9ICguLi5hcmdzKSA9PiBmbiguLi5hcmdzKTtcbiAgcHJvY2VkdXJlRXhwb3J0W2V4cG9ydENvbnRleHRdID0gY3R4O1xuICBwcm9jZWR1cmVFeHBvcnRbcmVnaXN0ZXJFeHBvcnRdID0gKGN0eDIsIGV4cG9ydE5hbWUpID0+IHtcbiAgICByZWdpc3RlclByb2NlZHVyZShjdHgyLCBuYW1lID8/IGV4cG9ydE5hbWUsIHBhcmFtcywgcmV0LCBmbik7XG4gICAgY3R4Mi5mdW5jdGlvbkV4cG9ydHMuc2V0KFxuICAgICAgcHJvY2VkdXJlRXhwb3J0LFxuICAgICAgbmFtZSA/PyBleHBvcnROYW1lXG4gICAgKTtcbiAgICBpZiAob3B0cz8ub25TY2hlZHVsZSAhPT0gdm9pZCAwKSB7XG4gICAgICBjdHgyLnBlbmRpbmdTY2hlZHVsZXMucHVzaCh7XG4gICAgICAgIHRhYmxlOiBvcHRzLm9uU2NoZWR1bGUsXG4gICAgICAgIGZ1bmN0aW9uTmFtZTogbmFtZSA/PyBleHBvcnROYW1lXG4gICAgICB9KTtcbiAgICB9XG4gIH07XG4gIHJldHVybiBwcm9jZWR1cmVFeHBvcnQ7XG59XG5mdW5jdGlvbiByZWdpc3RlclByb2NlZHVyZShjdHgsIGV4cG9ydE5hbWUsIHBhcmFtcywgcmV0LCBmbiwgb3B0cykge1xuICBjdHguZGVmaW5lRnVuY3Rpb24oZXhwb3J0TmFtZSk7XG4gIGNvbnN0IHBhcmFtc1R5cGUgPSB7XG4gICAgZWxlbWVudHM6IE9iamVjdC5lbnRyaWVzKHBhcmFtcykubWFwKChbbiwgY10pID0+ICh7XG4gICAgICBuYW1lOiBuLFxuICAgICAgYWxnZWJyYWljVHlwZTogY3R4LnJlZ2lzdGVyVHlwZXNSZWN1cnNpdmVseShcbiAgICAgICAgXCJ0eXBlQnVpbGRlclwiIGluIGMgPyBjLnR5cGVCdWlsZGVyIDogY1xuICAgICAgKS5hbGdlYnJhaWNUeXBlXG4gICAgfSkpXG4gIH07XG4gIGNvbnN0IHJldHVyblR5cGUgPSBjdHgucmVnaXN0ZXJUeXBlc1JlY3Vyc2l2ZWx5KHJldCkuYWxnZWJyYWljVHlwZTtcbiAgY3R4Lm1vZHVsZURlZi5wcm9jZWR1cmVzLnB1c2goe1xuICAgIHNvdXJjZU5hbWU6IGV4cG9ydE5hbWUsXG4gICAgcGFyYW1zOiBwYXJhbXNUeXBlLFxuICAgIHJldHVyblR5cGUsXG4gICAgdmlzaWJpbGl0eTogRnVuY3Rpb25WaXNpYmlsaXR5LkNsaWVudENhbGxhYmxlXG4gIH0pO1xuICBjb25zdCB7IHR5cGVzcGFjZSB9ID0gY3R4O1xuICBjdHgucHJvY2VkdXJlcy5wdXNoKHtcbiAgICBmbixcbiAgICBkZXNlcmlhbGl6ZUFyZ3M6IFByb2R1Y3RUeXBlLm1ha2VEZXNlcmlhbGl6ZXIocGFyYW1zVHlwZSwgdHlwZXNwYWNlKSxcbiAgICBzZXJpYWxpemVSZXR1cm46IEFsZ2VicmFpY1R5cGUubWFrZVNlcmlhbGl6ZXIocmV0dXJuVHlwZSwgdHlwZXNwYWNlKSxcbiAgICByZXR1cm5UeXBlQmFzZVNpemU6IGJzYXRuQmFzZVNpemUodHlwZXNwYWNlLCByZXR1cm5UeXBlKVxuICB9KTtcbn1cbmZ1bmN0aW9uIGNhbGxQcm9jZWR1cmUocHJvY2VkdXJlcywgaWQsIHNlbmRlciwgY29ubmVjdGlvbklkLCB0aW1lc3RhbXAsIGFyZ3NCdWYsIGRiVmlldywgZGlzcGF0Y2hlcyA9IFtdLCBwYXJlbnRQcmVmaXggPSBcIlwiKSB7XG4gIGNvbnN0IHsgZm4sIGRlc2VyaWFsaXplQXJncywgc2VyaWFsaXplUmV0dXJuLCByZXR1cm5UeXBlQmFzZVNpemUgfSA9IHByb2NlZHVyZXNbaWRdO1xuICBjb25zdCBhcmdzID0gZGVzZXJpYWxpemVBcmdzKG5ldyBCaW5hcnlSZWFkZXIoYXJnc0J1ZikpO1xuICBjb25zdCBjdHggPSBuZXcgUHJvY2VkdXJlQ3R4SW1wbChcbiAgICBzZW5kZXIsXG4gICAgdGltZXN0YW1wLFxuICAgIGNvbm5lY3Rpb25JZCxcbiAgICBkYlZpZXcsXG4gICAgaG9zdEJhY2tlbmQsXG4gICAgaHR0cENsaWVudCxcbiAgICB2b2lkIDAsXG4gICAgdm9pZCAwLFxuICAgIHZvaWQgMCxcbiAgICBkaXNwYXRjaGVzLFxuICAgIHBhcmVudFByZWZpeFxuICApO1xuICBjb25zdCByZXQgPSBjYWxsVXNlckZ1bmN0aW9uKGZuLCBjdHgsIGFyZ3MpO1xuICBjb25zdCByZXRCdWYgPSBuZXcgQmluYXJ5V3JpdGVyKHJldHVyblR5cGVCYXNlU2l6ZSk7XG4gIHNlcmlhbGl6ZVJldHVybihyZXRCdWYsIHJldCk7XG4gIHJldHVybiByZXRCdWYuZ2V0QnVmZmVyKCk7XG59XG52YXIgUHJvY2VkdXJlQ3R4SW1wbCA9IGNsYXNzIFByb2NlZHVyZUN0eCB7XG4gIGNvbnN0cnVjdG9yKHNlbmRlciwgdGltZXN0YW1wLCBjb25uZWN0aW9uSWQsIGRiVmlldywgYmFja2VuZCA9IGhvc3RCYWNrZW5kLCBodHRwID0gaHR0cENsaWVudCwgc2xlZXAgPSAoKSA9PiB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwicHJvY2VkdXJlIHNsZWVwIGlzIG5vdCBhdmFpbGFibGUgaW4gdGhpcyBydW50aW1lXCIpO1xuICB9LCByYW5kb20sIGNoaWxkU2VlZFJhbmRvbSwgZGlzcGF0Y2hlcyA9IFtdLCBwYXJlbnRQcmVmaXggPSBcIlwiKSB7XG4gICAgdGhpcy5zZW5kZXIgPSBzZW5kZXI7XG4gICAgdGhpcy50aW1lc3RhbXAgPSB0aW1lc3RhbXA7XG4gICAgdGhpcy5jb25uZWN0aW9uSWQgPSBjb25uZWN0aW9uSWQ7XG4gICAgdGhpcy4jZGJWaWV3ID0gZGJWaWV3O1xuICAgIHRoaXMuI2JhY2tlbmQgPSBiYWNrZW5kO1xuICAgIHRoaXMuI2h0dHAgPSBodHRwO1xuICAgIHRoaXMuI3NsZWVwID0gc2xlZXA7XG4gICAgdGhpcy4jcmFuZG9tID0gcmFuZG9tO1xuICAgIHRoaXMuI2NoaWxkU2VlZFJhbmRvbSA9IGNoaWxkU2VlZFJhbmRvbTtcbiAgICB0aGlzLiNkaXNwYXRjaGVzID0gZGlzcGF0Y2hlcztcbiAgICB0aGlzLiNwYXJlbnRQcmVmaXggPSBwYXJlbnRQcmVmaXg7XG4gIH1cbiAgI2lkZW50aXR5O1xuICAjdXVpZENvdW50ZXI7XG4gICNyYW5kb207XG4gICNkYlZpZXc7XG4gICNiYWNrZW5kO1xuICAjaHR0cDtcbiAgI3NsZWVwO1xuICAjY2hpbGRTZWVkUmFuZG9tO1xuICBlbnYgPSBlbnZpcm9ubWVudDtcbiAgI2Rpc3BhdGNoZXM7XG4gICNwYXJlbnRQcmVmaXg7XG4gICNhc1ZpZXdzO1xuICBnZXQgZGF0YWJhc2VJZGVudGl0eSgpIHtcbiAgICByZXR1cm4gdGhpcy4jaWRlbnRpdHkgPz89IG5ldyBJZGVudGl0eSh0aGlzLiNiYWNrZW5kLmlkZW50aXR5KCkpO1xuICB9XG4gIGdldCBpZGVudGl0eSgpIHtcbiAgICByZXR1cm4gdGhpcy5kYXRhYmFzZUlkZW50aXR5O1xuICB9XG4gIGdldCByYW5kb20oKSB7XG4gICAgcmV0dXJuIHRoaXMuI3JhbmRvbSA/Pz0gbWFrZVJhbmRvbSh0aGlzLnRpbWVzdGFtcCk7XG4gIH1cbiAgZ2V0IGh0dHAoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2h0dHA7XG4gIH1cbiAgc2xlZXAoZHVyYXRpb24pIHtcbiAgICB0aGlzLiNzbGVlcChkdXJhdGlvbik7XG4gIH1cbiAgZ2V0IGFzKCkge1xuICAgIHJldHVybiB0aGlzLiNhc1ZpZXdzID8/PSBidWlsZFByb2NlZHVyZUFsaWFzQ3R4TWFwKFxuICAgICAgdGhpcyxcbiAgICAgIHRoaXMuI2Rpc3BhdGNoZXMsXG4gICAgICB0aGlzLiNwYXJlbnRQcmVmaXhcbiAgICApO1xuICB9XG4gIHdpdGhUeChib2R5KSB7XG4gICAgY29uc3QgdHhTZWVkID0gdGhpcy4jY2hpbGRTZWVkUmFuZG9tPy5iaWdpbnRJblJhbmdlKDBuLCAoMW4gPDwgNjRuKSAtIDFuKTtcbiAgICBjb25zdCBkaXNwYXRjaGVzID0gdGhpcy4jZGlzcGF0Y2hlcztcbiAgICBjb25zdCBwYXJlbnRQcmVmaXggPSB0aGlzLiNwYXJlbnRQcmVmaXg7XG4gICAgcmV0dXJuIHJ1bldpdGhUeChcbiAgICAgICh0aW1lc3RhbXApID0+IHtcbiAgICAgICAgY29uc3QgdHggPSBuZXcgUmVkdWNlckN0eEltcGwoXG4gICAgICAgICAgdGhpcy5zZW5kZXIsXG4gICAgICAgICAgdGltZXN0YW1wLFxuICAgICAgICAgIHRoaXMuY29ubmVjdGlvbklkLFxuICAgICAgICAgIHRoaXMuI2RiVmlldygpLFxuICAgICAgICAgIHRoaXMuI2JhY2tlbmQsXG4gICAgICAgICAgdm9pZCAwLFxuICAgICAgICAgIHR4U2VlZCA9PSBudWxsID8gdm9pZCAwIDogbWFrZVJhbmRvbUZyb21TZWVkKHR4U2VlZClcbiAgICAgICAgKTtcbiAgICAgICAgYXNzaWduVHhBbGlhc1ZpZXdzKHR4LCBkaXNwYXRjaGVzLCBwYXJlbnRQcmVmaXgpO1xuICAgICAgICByZXR1cm4gdHg7XG4gICAgICB9LFxuICAgICAgYm9keSxcbiAgICAgIHRoaXMuI2JhY2tlbmRcbiAgICApO1xuICB9XG4gIG5ld1V1aWRWNCgpIHtcbiAgICBjb25zdCBieXRlcyA9IHRoaXMucmFuZG9tLmZpbGwobmV3IFVpbnQ4QXJyYXkoMTYpKTtcbiAgICByZXR1cm4gVXVpZC5mcm9tUmFuZG9tQnl0ZXNWNChieXRlcyk7XG4gIH1cbiAgbmV3VXVpZFY3KCkge1xuICAgIGNvbnN0IGJ5dGVzID0gdGhpcy5yYW5kb20uZmlsbChuZXcgVWludDhBcnJheSg0KSk7XG4gICAgY29uc3QgY291bnRlciA9IHRoaXMuI3V1aWRDb3VudGVyID8/PSB7IHZhbHVlOiAwIH07XG4gICAgcmV0dXJuIFV1aWQuZnJvbUNvdW50ZXJWNyhjb3VudGVyLCB0aGlzLnRpbWVzdGFtcCwgYnl0ZXMpO1xuICB9XG59O1xuXG4vLyBzcmMvc2VydmVyL3JlZHVjZXJzLnRzXG5mdW5jdGlvbiBtYWtlUmVkdWNlckV4cG9ydChjdHgsIG9wdHMsIHBhcmFtcywgZm4sIGxpZmVjeWNsZSkge1xuICBjb25zdCByZWR1Y2VyRXhwb3J0ID0gKC4uLmFyZ3MpID0+IGZuKC4uLmFyZ3MpO1xuICByZWR1Y2VyRXhwb3J0W2V4cG9ydENvbnRleHRdID0gY3R4O1xuICByZWR1Y2VyRXhwb3J0W3JlZ2lzdGVyRXhwb3J0XSA9IChjdHgyLCBleHBvcnROYW1lKSA9PiB7XG4gICAgcmVnaXN0ZXJSZWR1Y2VyKGN0eDIsIGV4cG9ydE5hbWUsIHBhcmFtcywgZm4sIG9wdHMsIGxpZmVjeWNsZSk7XG4gICAgY3R4Mi5mdW5jdGlvbkV4cG9ydHMuc2V0KFxuICAgICAgcmVkdWNlckV4cG9ydCxcbiAgICAgIGV4cG9ydE5hbWVcbiAgICApO1xuICAgIGlmIChvcHRzPy5vblNjaGVkdWxlICE9PSB2b2lkIDApIHtcbiAgICAgIGN0eDIucGVuZGluZ1NjaGVkdWxlcy5wdXNoKHtcbiAgICAgICAgdGFibGU6IG9wdHMub25TY2hlZHVsZSxcbiAgICAgICAgZnVuY3Rpb25OYW1lOiBleHBvcnROYW1lXG4gICAgICB9KTtcbiAgICB9XG4gIH07XG4gIHJldHVybiByZWR1Y2VyRXhwb3J0O1xufVxuZnVuY3Rpb24gcmVnaXN0ZXJSZWR1Y2VyKGN0eCwgZXhwb3J0TmFtZSwgcGFyYW1zLCBmbiwgb3B0cywgbGlmZWN5Y2xlKSB7XG4gIGN0eC5kZWZpbmVGdW5jdGlvbihleHBvcnROYW1lKTtcbiAgaWYgKCEocGFyYW1zIGluc3RhbmNlb2YgUm93QnVpbGRlcikpIHtcbiAgICBwYXJhbXMgPSBuZXcgUm93QnVpbGRlcihwYXJhbXMpO1xuICB9XG4gIGlmIChwYXJhbXMudHlwZU5hbWUgPT09IHZvaWQgMCkge1xuICAgIHBhcmFtcy50eXBlTmFtZSA9IHRvUGFzY2FsQ2FzZShleHBvcnROYW1lKTtcbiAgfVxuICBjb25zdCByZWYgPSBjdHgucmVnaXN0ZXJUeXBlc1JlY3Vyc2l2ZWx5KHBhcmFtcyk7XG4gIGNvbnN0IHBhcmFtc1R5cGUgPSBjdHgucmVzb2x2ZVR5cGUocmVmKS52YWx1ZTtcbiAgY29uc3QgaXNMaWZlY3ljbGUgPSBsaWZlY3ljbGUgIT0gbnVsbDtcbiAgY3R4Lm1vZHVsZURlZi5yZWR1Y2Vycy5wdXNoKHtcbiAgICBzb3VyY2VOYW1lOiBleHBvcnROYW1lLFxuICAgIHBhcmFtczogcGFyYW1zVHlwZSxcbiAgICAvL01vZHVsZURlZiB2YWxpZGF0aW9uIGNvZGUgaXMgcmVzcG9uc2libGUgdG8gbWFyayBwcml2YXRlIHJlZHVjZXJzXG4gICAgdmlzaWJpbGl0eTogRnVuY3Rpb25WaXNpYmlsaXR5LkNsaWVudENhbGxhYmxlLFxuICAgIC8vSGFyZGNvZGVkIGZvciBub3cgLSByZWR1Y2VycyBkbyBub3QgcmV0dXJuIHZhbHVlcyB5ZXRcbiAgICBva1JldHVyblR5cGU6IEFsZ2VicmFpY1R5cGUuUHJvZHVjdCh7IGVsZW1lbnRzOiBbXSB9KSxcbiAgICBlcnJSZXR1cm5UeXBlOiBBbGdlYnJhaWNUeXBlLlN0cmluZ1xuICB9KTtcbiAgaWYgKG9wdHM/Lm5hbWUgIT0gbnVsbCkge1xuICAgIGN0eC5tb2R1bGVEZWYuZXhwbGljaXROYW1lcy5lbnRyaWVzLnB1c2goe1xuICAgICAgdGFnOiBcIkZ1bmN0aW9uXCIsXG4gICAgICB2YWx1ZToge1xuICAgICAgICBzb3VyY2VOYW1lOiBleHBvcnROYW1lLFxuICAgICAgICBjYW5vbmljYWxOYW1lOiBvcHRzLm5hbWVcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuICBpZiAoaXNMaWZlY3ljbGUpIHtcbiAgICBjdHgubW9kdWxlRGVmLmxpZmVDeWNsZVJlZHVjZXJzLnB1c2goe1xuICAgICAgbGlmZWN5Y2xlU3BlYzogbGlmZWN5Y2xlLFxuICAgICAgZnVuY3Rpb25OYW1lOiBleHBvcnROYW1lXG4gICAgfSk7XG4gIH1cbiAgaWYgKCFmbi5uYW1lKSB7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGZuLCBcIm5hbWVcIiwgeyB2YWx1ZTogZXhwb3J0TmFtZSwgd3JpdGFibGU6IGZhbHNlIH0pO1xuICB9XG4gIGN0eC5yZWR1Y2Vycy5wdXNoKGZuKTtcbn1cblxuLy8gc3JjL3NlcnZlci9zY2hlbWEudHNcbnZhciBTY2hlbWFJbm5lciA9IGNsYXNzIGV4dGVuZHMgTW9kdWxlQ29udGV4dCB7XG4gIHNjaGVtYVR5cGU7XG4gIGV4cG9ydHNSZWdpc3RlcmVkID0gZmFsc2U7XG4gIHNjaGVkdWxlc1Jlc29sdmVkID0gZmFsc2U7XG4gIGV4aXN0aW5nRnVuY3Rpb25zID0gLyogQF9fUFVSRV9fICovIG5ldyBTZXQoKTtcbiAgZXhpc3RpbmdIdHRwSGFuZGxlcnMgPSAvKiBAX19QVVJFX18gKi8gbmV3IFNldCgpO1xuICByZWR1Y2VycyA9IFtdO1xuICBwcm9jZWR1cmVzID0gW107XG4gIHZpZXdzID0gW107XG4gIGFub25WaWV3cyA9IFtdO1xuICBodHRwSGFuZGxlcnMgPSBbXTtcbiAgLyoqXG4gICAqIE1hcHMgcmVkdWNlci9wcm9jZWR1cmUgZXhwb3J0IG9iamVjdHMgdG8gdGhlaXIgc291cmNlIG5hbWVzLlxuICAgKiBVc2VkIGZvciByZXNvbHZpbmcgc2NoZWR1bGVkIHRhYmxlIHRhcmdldHMuXG4gICAqL1xuICBmdW5jdGlvbkV4cG9ydHMgPSAvKiBAX19QVVJFX18gKi8gbmV3IE1hcCgpO1xuICB0YWJsZVNvdXJjZU5hbWVzID0gLyogQF9fUFVSRV9fICovIG5ldyBNYXAoKTtcbiAgaHR0cEhhbmRsZXJFeHBvcnRzID0gLyogQF9fUFVSRV9fICovIG5ldyBNYXAoKTtcbiAgcGVuZGluZ1NjaGVkdWxlcyA9IFtdO1xuICBwZW5kaW5nSHR0cFJvdXRlcyA9IFtdO1xuICBzdWJtb2R1bGVEaXNwYXRjaEluZm9zID0gW107XG4gIGNvbnN0cnVjdG9yKGdldFNjaGVtYVR5cGUpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuc2NoZW1hVHlwZSA9IGdldFNjaGVtYVR5cGUodGhpcyk7XG4gIH1cbiAgZGVmaW5lRnVuY3Rpb24obmFtZSkge1xuICAgIGlmICh0aGlzLmV4aXN0aW5nRnVuY3Rpb25zLmhhcyhuYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgYFRoZXJlIGlzIGFscmVhZHkgYSByZWR1Y2VyLCBwcm9jZWR1cmUsIG9yIHZpZXcgd2l0aCB0aGUgbmFtZSAnJHtuYW1lfSdgXG4gICAgICApO1xuICAgIH1cbiAgICB0aGlzLmV4aXN0aW5nRnVuY3Rpb25zLmFkZChuYW1lKTtcbiAgfVxuICBkZWZpbmVIdHRwSGFuZGxlcihuYW1lKSB7XG4gICAgaWYgKHRoaXMuZXhpc3RpbmdIdHRwSGFuZGxlcnMuaGFzKG5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICBgVGhlcmUgaXMgYWxyZWFkeSBhbiBIVFRQIGhhbmRsZXIgd2l0aCB0aGUgbmFtZSAnJHtuYW1lfSdgXG4gICAgICApO1xuICAgIH1cbiAgICB0aGlzLmV4aXN0aW5nSHR0cEhhbmRsZXJzLmFkZChuYW1lKTtcbiAgfVxuICByZXNvbHZlU2NoZWR1bGVzKCkge1xuICAgIGlmICh0aGlzLnNjaGVkdWxlc1Jlc29sdmVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMuc2NoZWR1bGVzUmVzb2x2ZWQgPSB0cnVlO1xuICAgIGNvbnN0IHNjaGVkdWxlZFRhYmxlcyA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgTWFwKCk7XG4gICAgZm9yIChjb25zdCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGtub3duRnVuY3Rpb25OYW1lLFxuICAgICAgcmVkdWNlcixcbiAgICAgIHRhYmxlOiB0YWJsZTIsXG4gICAgICB0YWJsZU5hbWU6IGtub3duVGFibGVOYW1lLFxuICAgICAgc2NoZWR1bGVBdENvbDoga25vd25TY2hlZHVsZUF0Q29sXG4gICAgfSBvZiB0aGlzLnBlbmRpbmdTY2hlZHVsZXMpIHtcbiAgICAgIGxldCB0YWJsZU5hbWUgPSBrbm93blRhYmxlTmFtZTtcbiAgICAgIGlmICh0YWJsZU5hbWUgPT09IHZvaWQgMCkge1xuICAgICAgICBjb25zdCB0YWJsZU5hbWVzID0gdGhpcy50YWJsZVNvdXJjZU5hbWVzLmdldCh0YWJsZTIpO1xuICAgICAgICBpZiAodGFibGVOYW1lcyAhPT0gdm9pZCAwICYmIHRhYmxlTmFtZXMubGVuZ3RoID4gMSkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgICAgICBcIlNjaGVkdWxlIHRhcmdldCB0YWJsZSBpcyByZWdpc3RlcmVkIG1vcmUgdGhhbiBvbmNlIGluIHRoaXMgc2NoZW1hLiBVc2UgYSBkaXN0aW5jdCB0YWJsZSBoYW5kbGUgZm9yIGVhY2ggc2NoZWR1bGVkIHRhYmxlLlwiXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICB0YWJsZU5hbWUgPSB0YWJsZU5hbWVzPy5bMF07XG4gICAgICB9XG4gICAgICBpZiAodGFibGVOYW1lID09PSB2b2lkIDApIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICBcIlNjaGVkdWxlIHRhcmdldCB0YWJsZSBpcyBub3QgcGFydCBvZiB0aGlzIHNjaGVtYS5cIlxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgY29uc3Qgc2NoZWR1bGVBdENvbCA9IGtub3duU2NoZWR1bGVBdENvbCA/PyB0YWJsZTIuc2NoZWR1bGVBdENvbDtcbiAgICAgIGlmIChzY2hlZHVsZUF0Q29sID09PSB2b2lkIDApIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICBgVGFibGUgJHt0YWJsZU5hbWV9IGRlZmluZXMgYSBzY2hlZHVsZSwgYnV0IGl0IGRvZXMgbm90IGhhdmUgYSBTY2hlZHVsZUF0IGNvbHVtbi5gXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBjb25zdCBmdW5jdGlvbk5hbWUgPSBrbm93bkZ1bmN0aW9uTmFtZSA/PyAocmVkdWNlciA9PT0gdm9pZCAwID8gdm9pZCAwIDogdGhpcy5mdW5jdGlvbkV4cG9ydHMuZ2V0KHJlZHVjZXIoKSkpO1xuICAgICAgaWYgKGZ1bmN0aW9uTmFtZSA9PT0gdm9pZCAwKSB7XG4gICAgICAgIGNvbnN0IG1zZyA9IGBUYWJsZSAke3RhYmxlTmFtZX0gZGVmaW5lcyBhIHNjaGVkdWxlLCBidXQgaXQgc2VlbXMgbGlrZSB0aGUgYXNzb2NpYXRlZCBmdW5jdGlvbiB3YXMgbm90IGV4cG9ydGVkLmA7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IobXNnKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGV4aXN0aW5nRnVuY3Rpb25OYW1lID0gc2NoZWR1bGVkVGFibGVzLmdldCh0YWJsZU5hbWUpO1xuICAgICAgaWYgKGV4aXN0aW5nRnVuY3Rpb25OYW1lICE9PSB2b2lkIDApIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICBgVGFibGUgJHt0YWJsZU5hbWV9IGRlZmluZXMgbXVsdGlwbGUgc2NoZWR1bGVzOiAke2V4aXN0aW5nRnVuY3Rpb25OYW1lfSBhbmQgJHtmdW5jdGlvbk5hbWV9LiBBIHNjaGVkdWxlIHRhYmxlIGNhbiBvbmx5IGJlIHVzZWQgYnkgb25lIHJlZHVjZXIgb3IgcHJvY2VkdXJlLmBcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHNjaGVkdWxlZFRhYmxlcy5zZXQodGFibGVOYW1lLCBmdW5jdGlvbk5hbWUpO1xuICAgICAgdGhpcy5tb2R1bGVEZWYuc2NoZWR1bGVzLnB1c2goe1xuICAgICAgICBzb3VyY2VOYW1lOiB2b2lkIDAsXG4gICAgICAgIHRhYmxlTmFtZSxcbiAgICAgICAgc2NoZWR1bGVBdENvbCxcbiAgICAgICAgZnVuY3Rpb25OYW1lXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgcmVzb2x2ZUh0dHBSb3V0ZXMoKSB7XG4gICAgZm9yIChjb25zdCByb3V0ZSBvZiB0aGlzLnBlbmRpbmdIdHRwUm91dGVzKSB7XG4gICAgICBjb25zdCBoYW5kbGVyRnVuY3Rpb24gPSB0aGlzLmh0dHBIYW5kbGVyRXhwb3J0cy5nZXQocm91dGUuaGFuZGxlcik7XG4gICAgICBpZiAoaGFuZGxlckZ1bmN0aW9uID09PSB2b2lkIDApIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICBgSFRUUCByb3V0ZSBmb3IgcGF0aCAnJHtyb3V0ZS5wYXRofScgcmVmZXJzIHRvIGEgaGFuZGxlciB0aGF0IHdhcyBub3QgZXhwb3J0ZWQuYFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgdGhpcy5tb2R1bGVEZWYuaHR0cFJvdXRlcy5wdXNoKHtcbiAgICAgICAgaGFuZGxlckZ1bmN0aW9uLFxuICAgICAgICBtZXRob2Q6IHJvdXRlLm1ldGhvZCxcbiAgICAgICAgcGF0aDogcm91dGUucGF0aFxuICAgICAgfSk7XG4gICAgfVxuICB9XG59O1xudmFyIFNjaGVtYSA9IGNsYXNzIHtcbiAgI2N0eDtcbiAgY29uc3RydWN0b3IoY3R4KSB7XG4gICAgdGhpcy4jY3R4ID0gY3R4O1xuICB9XG4gIFttb2R1bGVIb29rc10oZXhwb3J0cykge1xuICAgIHRoaXMuYnVpbGRSYXdNb2R1bGVEZWZWMTAoZXhwb3J0cyk7XG4gICAgdGhpcy4jY3R4LnJlc29sdmVIdHRwUm91dGVzKCk7XG4gICAgcmV0dXJuIG1ha2VIb29rcyh0aGlzLiNjdHgpO1xuICB9XG4gIGdldCBzY2hlbWFUeXBlKCkge1xuICAgIHJldHVybiB0aGlzLiNjdHguc2NoZW1hVHlwZTtcbiAgfVxuICBnZXQgbW9kdWxlRGVmKCkge1xuICAgIHJldHVybiB0aGlzLiNjdHgubW9kdWxlRGVmO1xuICB9XG4gIGdldCB0eXBlc3BhY2UoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2N0eC50eXBlc3BhY2U7XG4gIH1cbiAgZ2V0IHN1Ym1vZHVsZURpc3BhdGNoSW5mb3MoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2N0eC5zdWJtb2R1bGVEaXNwYXRjaEluZm9zO1xuICB9XG4gIC8qKiBJbnRlcm5hbDogcmVnaXN0ZXIgZXhwb3J0cyBhbmQgbWF0ZXJpYWxpemUgdGhlIFJhd01vZHVsZURlZlYxMCBmb3IgdXBsb2FkLiAqL1xuICBidWlsZFJhd01vZHVsZURlZlYxMChleHBvcnRzLCBvcHRzKSB7XG4gICAgcmVnaXN0ZXJNb2R1bGVFeHBvcnRzKHRoaXMuI2N0eCwgZXhwb3J0cywge1xuICAgICAgaWdub3JlTm9uTW9kdWxlRXhwb3J0czogb3B0cz8uaWdub3JlTm9uTW9kdWxlRXhwb3J0cyA/PyBmYWxzZVxuICAgIH0pO1xuICAgIHRoaXMuI2N0eC5yZXNvbHZlU2NoZWR1bGVzKCk7XG4gICAgcmV0dXJuIHRoaXMuI2N0eC5yYXdNb2R1bGVEZWZWMTAoKTtcbiAgfVxuICAvKipcbiAgICogQGludGVybmFsIOKAkyBjYWxsZWQgYnkgc2NoZW1hKCkgd2hlbiBwcm9jZXNzaW5nIGEgc3VibW9kdWxlIG5hbWVzcGFjZSBlbnRyeS5cbiAgICogUmVnaXN0ZXJzIHRoZSBsaWJyYXJ5J3MgZXhwb3J0cyBhbmQgcmV0dXJucyBib3RoIHRoZSBzZXJpYWxpemVkIG1vZHVsZSBkZWZcbiAgICogYW5kIHRoZSBydW50aW1lIGRpc3BhdGNoIGluZm8gbmVlZGVkIGJ5IE1vZHVsZUhvb2tzSW1wbCBmb3IgX19jYWxsX3JlZHVjZXJfXy5cbiAgICovXG4gIGJ1aWxkU3VibW9kdWxlRGlzcGF0Y2goZXhwb3J0cykge1xuICAgIGNvbnN0IHJhd0RlZiA9IHRoaXMuYnVpbGRSYXdNb2R1bGVEZWZWMTAoZXhwb3J0cywge1xuICAgICAgaWdub3JlTm9uTW9kdWxlRXhwb3J0czogdHJ1ZVxuICAgIH0pO1xuICAgIGlmICh0aGlzLiNjdHgubW9kdWxlRGVmLmVudmlyb25tZW50Lmxlbmd0aCAhPT0gMCkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN1Ym1vZHVsZXMgY2Fubm90IGRlY2xhcmUgZW52aXJvbm1lbnQgdmFyaWFibGVzXCIpO1xuICAgIH1cbiAgICB0aGlzLiNjdHgucmVzb2x2ZUh0dHBSb3V0ZXMoKTtcbiAgICByZXR1cm4ge1xuICAgICAgcmF3RGVmLFxuICAgICAgZGlzcGF0Y2g6IHtcbiAgICAgICAgbmFtZXNwYWNlOiBcIlwiLFxuICAgICAgICByZWR1Y2VyRm5zOiBbLi4udGhpcy4jY3R4LnJlZHVjZXJzXSxcbiAgICAgICAgcmVkdWNlckRlZnM6IFsuLi50aGlzLiNjdHgubW9kdWxlRGVmLnJlZHVjZXJzXSxcbiAgICAgICAgcHJvY2VkdXJlRm5zOiBbLi4udGhpcy4jY3R4LnByb2NlZHVyZXNdLFxuICAgICAgICBwcm9jZWR1cmVEZWZzOiBbLi4udGhpcy4jY3R4Lm1vZHVsZURlZi5wcm9jZWR1cmVzXSxcbiAgICAgICAgYW5vblZpZXdGbnM6IFsuLi50aGlzLiNjdHguYW5vblZpZXdzXSxcbiAgICAgICAgdmlld0ZuczogWy4uLnRoaXMuI2N0eC52aWV3c10sXG4gICAgICAgIHR5cGVzcGFjZTogdGhpcy4jY3R4Lm1vZHVsZURlZi50eXBlc3BhY2UsXG4gICAgICAgIHRhYmxlczogT2JqZWN0LnZhbHVlcyh0aGlzLiNjdHguc2NoZW1hVHlwZS50YWJsZXMpLm1hcCgodDIpID0+ICh7XG4gICAgICAgICAgYWNjZXNzb3JOYW1lOiB0Mi5hY2Nlc3Nvck5hbWUsXG4gICAgICAgICAgdGFibGVEZWY6IHQyLnRhYmxlRGVmXG4gICAgICAgIH0pKSxcbiAgICAgICAgc2NoZW1hVGFibGVzOiB0aGlzLiNjdHguc2NoZW1hVHlwZS50YWJsZXMsXG4gICAgICAgIHN1YkRpc3BhdGNoZXM6IFsuLi50aGlzLiNjdHguc3VibW9kdWxlRGlzcGF0Y2hJbmZvc11cbiAgICAgIH1cbiAgICB9O1xuICB9XG4gIHJlZHVjZXIoLi4uYXJncykge1xuICAgIGxldCBvcHRzLCBwYXJhbXMgPSB7fSwgZm47XG4gICAgc3dpdGNoIChhcmdzLmxlbmd0aCkge1xuICAgICAgY2FzZSAxOlxuICAgICAgICBbZm5dID0gYXJncztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6IHtcbiAgICAgICAgbGV0IGFyZzE7XG4gICAgICAgIFthcmcxLCBmbl0gPSBhcmdzO1xuICAgICAgICBpZiAodHlwZW9mIGFyZzEubmFtZSA9PT0gXCJzdHJpbmdcIilcbiAgICAgICAgICBvcHRzID0gYXJnMTtcbiAgICAgICAgZWxzZSBwYXJhbXMgPSBhcmcxO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgMzpcbiAgICAgICAgW29wdHMsIHBhcmFtcywgZm5dID0gYXJncztcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiBtYWtlUmVkdWNlckV4cG9ydCh0aGlzLiNjdHgsIG9wdHMsIHBhcmFtcywgZm4pO1xuICB9XG4gIGluaXQoLi4uYXJncykge1xuICAgIGxldCBvcHRzLCBmbjtcbiAgICBzd2l0Y2ggKGFyZ3MubGVuZ3RoKSB7XG4gICAgICBjYXNlIDE6XG4gICAgICAgIFtmbl0gPSBhcmdzO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgW29wdHMsIGZuXSA9IGFyZ3M7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICByZXR1cm4gbWFrZVJlZHVjZXJFeHBvcnQodGhpcy4jY3R4LCBvcHRzLCB7fSwgZm4sIExpZmVjeWNsZS5Jbml0KTtcbiAgfVxuICBjbGllbnRDb25uZWN0ZWQoLi4uYXJncykge1xuICAgIGxldCBvcHRzLCBmbjtcbiAgICBzd2l0Y2ggKGFyZ3MubGVuZ3RoKSB7XG4gICAgICBjYXNlIDE6XG4gICAgICAgIFtmbl0gPSBhcmdzO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgW29wdHMsIGZuXSA9IGFyZ3M7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICByZXR1cm4gbWFrZVJlZHVjZXJFeHBvcnQodGhpcy4jY3R4LCBvcHRzLCB7fSwgZm4sIExpZmVjeWNsZS5PbkNvbm5lY3QpO1xuICB9XG4gIGNsaWVudERpc2Nvbm5lY3RlZCguLi5hcmdzKSB7XG4gICAgbGV0IG9wdHMsIGZuO1xuICAgIHN3aXRjaCAoYXJncy5sZW5ndGgpIHtcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgW2ZuXSA9IGFyZ3M7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBbb3B0cywgZm5dID0gYXJncztcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiBtYWtlUmVkdWNlckV4cG9ydCh0aGlzLiNjdHgsIG9wdHMsIHt9LCBmbiwgTGlmZWN5Y2xlLk9uRGlzY29ubmVjdCk7XG4gIH1cbiAgdmlldyhvcHRzLCAuLi5hcmdzKSB7XG4gICAgbGV0IHBhcmFtcyA9IHt9LCByZXQsIGZuO1xuICAgIHN3aXRjaCAoYXJncy5sZW5ndGgpIHtcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgW3JldCwgZm5dID0gYXJncztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIFtwYXJhbXMsIHJldCwgZm5dID0gYXJncztcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiBtYWtlVmlld0V4cG9ydCh0aGlzLiNjdHgsIG9wdHMsIHBhcmFtcywgcmV0LCBmbik7XG4gIH1cbiAgYW5vbnltb3VzVmlldyhvcHRzLCAuLi5hcmdzKSB7XG4gICAgbGV0IHBhcmFtcyA9IHt9LCByZXQsIGZuO1xuICAgIHN3aXRjaCAoYXJncy5sZW5ndGgpIHtcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgW3JldCwgZm5dID0gYXJncztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIFtwYXJhbXMsIHJldCwgZm5dID0gYXJncztcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiBtYWtlQW5vblZpZXdFeHBvcnQoXG4gICAgICB0aGlzLiNjdHgsXG4gICAgICBvcHRzLFxuICAgICAgcGFyYW1zLFxuICAgICAgcmV0LFxuICAgICAgZm5cbiAgICApO1xuICB9XG4gIHByb2NlZHVyZSguLi5hcmdzKSB7XG4gICAgbGV0IG9wdHMsIHBhcmFtcyA9IHt9LCByZXQsIGZuO1xuICAgIHN3aXRjaCAoYXJncy5sZW5ndGgpIHtcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgW3JldCwgZm5dID0gYXJncztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6IHtcbiAgICAgICAgbGV0IGFyZzE7XG4gICAgICAgIFthcmcxLCByZXQsIGZuXSA9IGFyZ3M7XG4gICAgICAgIGlmICh0eXBlb2YgYXJnMS5uYW1lID09PSBcInN0cmluZ1wiKVxuICAgICAgICAgIG9wdHMgPSBhcmcxO1xuICAgICAgICBlbHNlIHBhcmFtcyA9IGFyZzE7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSA0OlxuICAgICAgICBbb3B0cywgcGFyYW1zLCByZXQsIGZuXSA9IGFyZ3M7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICByZXR1cm4gbWFrZVByb2NlZHVyZUV4cG9ydCh0aGlzLiNjdHgsIG9wdHMsIHBhcmFtcywgcmV0LCBmbik7XG4gIH1cbiAgaHR0cEhhbmRsZXIoLi4uYXJncykge1xuICAgIGxldCBvcHRzLCBmbjtcbiAgICBzd2l0Y2ggKGFyZ3MubGVuZ3RoKSB7XG4gICAgICBjYXNlIDE6XG4gICAgICAgIFtmbl0gPSBhcmdzO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgW29wdHMsIGZuXSA9IGFyZ3M7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICByZXR1cm4gbWFrZUh0dHBIYW5kbGVyRXhwb3J0KHRoaXMuI2N0eCwgb3B0cywgZm4pO1xuICB9XG4gIGh0dHBSb3V0ZXIocm91dGVyKSB7XG4gICAgcmV0dXJuIG1ha2VIdHRwUm91dGVyRXhwb3J0KHRoaXMuI2N0eCwgcm91dGVyKTtcbiAgfVxuICAvKipcbiAgICogQnVuZGxlIG11bHRpcGxlIHJlZHVjZXJzLCBwcm9jZWR1cmVzLCBldGMgaW50byBvbmUgdmFsdWUgdG8gZXhwb3J0LlxuICAgKiBUaGUgbmFtZSB0aGV5IHdpbGwgYmUgZXhwb3J0ZWQgd2l0aCBpcyB0aGVpciBjb3JyZXNwb25kaW5nIGtleSBpbiB0aGUgYGV4cG9ydHNgIGFyZ3VtZW50LlxuICAgKi9cbiAgZXhwb3J0R3JvdXAoZXhwb3J0cykge1xuICAgIHJldHVybiB7XG4gICAgICBbZXhwb3J0Q29udGV4dF06IHRoaXMuI2N0eCxcbiAgICAgIFtyZWdpc3RlckV4cG9ydF0oY3R4LCBfZXhwb3J0TmFtZSkge1xuICAgICAgICBmb3IgKGNvbnN0IFtleHBvcnROYW1lLCBtb2R1bGVFeHBvcnRdIG9mIE9iamVjdC5lbnRyaWVzKGV4cG9ydHMpKSB7XG4gICAgICAgICAgY2hlY2tFeHBvcnRDb250ZXh0KG1vZHVsZUV4cG9ydCwgY3R4KTtcbiAgICAgICAgICBtb2R1bGVFeHBvcnRbcmVnaXN0ZXJFeHBvcnRdKGN0eCwgZXhwb3J0TmFtZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuICB9XG4gIGNsaWVudFZpc2liaWxpdHlGaWx0ZXIgPSB7XG4gICAgc3FsOiAoZmlsdGVyKSA9PiAoe1xuICAgICAgW2V4cG9ydENvbnRleHRdOiB0aGlzLiNjdHgsXG4gICAgICBbcmVnaXN0ZXJFeHBvcnRdKGN0eCwgX2V4cG9ydE5hbWUpIHtcbiAgICAgICAgY3R4Lm1vZHVsZURlZi5yb3dMZXZlbFNlY3VyaXR5LnB1c2goeyBzcWw6IGZpbHRlciB9KTtcbiAgICAgIH1cbiAgICB9KVxuICB9O1xufTtcbnZhciByZWdpc3RlckV4cG9ydCA9IFN5bWJvbChcIlNwYWNldGltZURCLnJlZ2lzdGVyRXhwb3J0XCIpO1xudmFyIGV4cG9ydENvbnRleHQgPSBTeW1ib2woXCJTcGFjZXRpbWVEQi5leHBvcnRDb250ZXh0XCIpO1xuZnVuY3Rpb24gaXNNb2R1bGVFeHBvcnQoeCkge1xuICByZXR1cm4gKHR5cGVvZiB4ID09PSBcImZ1bmN0aW9uXCIgfHwgdHlwZW9mIHggPT09IFwib2JqZWN0XCIpICYmIHggIT09IG51bGwgJiYgcmVnaXN0ZXJFeHBvcnQgaW4geDtcbn1cbmZ1bmN0aW9uIGNoZWNrRXhwb3J0Q29udGV4dChleHAsIHNjaGVtYTIpIHtcbiAgaWYgKGV4cFtleHBvcnRDb250ZXh0XSAhPSBudWxsICYmIGV4cFtleHBvcnRDb250ZXh0XSAhPT0gc2NoZW1hMikge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJtdWx0aXBsZSBzY2hlbWFzIGFyZSBub3Qgc3VwcG9ydGVkXCIpO1xuICB9XG59XG5mdW5jdGlvbiBpc1VudHlwZWRUYWJsZVNjaGVtYSh4KSB7XG4gIHJldHVybiB0eXBlb2YgeCA9PT0gXCJvYmplY3RcIiAmJiB4ICE9PSBudWxsICYmIGhhc093bih4LCBcInRhYmxlRGVmXCIpO1xufVxuZnVuY3Rpb24gaXNTdWJtb2R1bGVOYW1lc3BhY2UoeCkge1xuICByZXR1cm4gdHlwZW9mIHggPT09IFwib2JqZWN0XCIgJiYgeCAhPT0gbnVsbCAmJiBoYXNPd24oeCwgXCJkZWZhdWx0XCIpICYmIHguZGVmYXVsdCBpbnN0YW5jZW9mIFNjaGVtYTtcbn1cbmZ1bmN0aW9uIGlzU3VibW9kdWxlTW91bnQoeCkge1xuICByZXR1cm4gdHlwZW9mIHggPT09IFwib2JqZWN0XCIgJiYgeCAhPT0gbnVsbCAmJiBoYXNPd24oeCwgXCJtb2R1bGVcIikgJiYgIWhhc093bih4LCBcImRlZmF1bHRcIikgJiYgIWhhc093bih4LCBcInRhYmxlRGVmXCIpO1xufVxuZnVuY3Rpb24gZGVmYXVsdEltcG9ydEVycm9yKGFjY05hbWUpIHtcbiAgcmV0dXJuIG5ldyBUeXBlRXJyb3IoXG4gICAgYHNjaGVtYSBlbnRyeSAnJHthY2NOYW1lfScgbG9va3MgbGlrZSBhIGRlZmF1bHQgaW1wb3J0OyB1c2UgXFxgaW1wb3J0ICogYXMgJHthY2NOYW1lfSBmcm9tICcuLi4nXFxgIHNvIHRoZSBzdWJtb2R1bGUgY2FuIHNlZSB0aGUgbGlicmFyeSdzIG5hbWVkIHJlZHVjZXIgZXhwb3J0cy5gXG4gICk7XG59XG5mdW5jdGlvbiByZXNvbHZlU3VibW9kdWxlRW50cnkoYWNjTmFtZSwgZW50cnkpIHtcbiAgaWYgKGVudHJ5IGluc3RhbmNlb2YgU2NoZW1hKSB7XG4gICAgdGhyb3cgZGVmYXVsdEltcG9ydEVycm9yKGFjY05hbWUpO1xuICB9XG4gIGlmIChpc1N1Ym1vZHVsZU5hbWVzcGFjZShlbnRyeSkpIHtcbiAgICByZXR1cm4geyBzdWJtb2R1bGU6IGVudHJ5IH07XG4gIH1cbiAgaWYgKCFpc1N1Ym1vZHVsZU1vdW50KGVudHJ5KSkge1xuICAgIHJldHVybiB2b2lkIDA7XG4gIH1cbiAgaWYgKGVudHJ5Lm1vZHVsZSBpbnN0YW5jZW9mIFNjaGVtYSkge1xuICAgIHRocm93IGRlZmF1bHRJbXBvcnRFcnJvcihhY2NOYW1lKTtcbiAgfVxuICBpZiAoIWlzU3VibW9kdWxlTmFtZXNwYWNlKGVudHJ5Lm1vZHVsZSkpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgYHNjaGVtYSBlbnRyeSAnJHthY2NOYW1lfScgaGFzIGEgXFxgbW9kdWxlXFxgIHRoYXQgaXMgbm90IGEgc3VibW9kdWxlIG5hbWVzcGFjZSBvYmplY3Q7IHBhc3MgdGhlIHJlc3VsdCBvZiBcXGBpbXBvcnQgKiBhcyAke2FjY05hbWV9IGZyb20gJy4uLidcXGAuYFxuICAgICk7XG4gIH1cbiAgaWYgKGVudHJ5Lm5hbWUgPT09IHZvaWQgMCkge1xuICAgIHJldHVybiB7IHN1Ym1vZHVsZTogZW50cnkubW9kdWxlIH07XG4gIH1cbiAgaWYgKHR5cGVvZiBlbnRyeS5uYW1lICE9PSBcInN0cmluZ1wiIHx8IGVudHJ5Lm5hbWUubGVuZ3RoID09PSAwKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgIGBzY2hlbWEgZW50cnkgJyR7YWNjTmFtZX0nIGhhcyBhbiBpbnZhbGlkIFxcYG5hbWVcXGA7IGV4cGVjdGVkIGEgbm9uLWVtcHR5IHN0cmluZyBmb3IgdGhlIGNhbm9uaWNhbCBuYW1lc3BhY2UgbmFtZS5gXG4gICAgKTtcbiAgfVxuICByZXR1cm4geyBzdWJtb2R1bGU6IGVudHJ5Lm1vZHVsZSwgY2Fub25pY2FsTmFtZTogZW50cnkubmFtZSB9O1xufVxuZnVuY3Rpb24gcmVnaXN0ZXJNb2R1bGVFeHBvcnRzKHNjaGVtYTIsIGV4cG9ydHMsIG9wdHMpIHtcbiAgaWYgKHNjaGVtYTIuZXhwb3J0c1JlZ2lzdGVyZWQpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgc2NoZW1hMi5leHBvcnRzUmVnaXN0ZXJlZCA9IHRydWU7XG4gIGZvciAoY29uc3QgW25hbWUsIG1vZHVsZUV4cG9ydF0gb2YgT2JqZWN0LmVudHJpZXMoZXhwb3J0cykpIHtcbiAgICBpZiAobmFtZSA9PT0gXCJkZWZhdWx0XCIpIGNvbnRpbnVlO1xuICAgIGlmICghaXNNb2R1bGVFeHBvcnQobW9kdWxlRXhwb3J0KSkge1xuICAgICAgaWYgKG9wdHM/Lmlnbm9yZU5vbk1vZHVsZUV4cG9ydHMpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiZXhwb3J0aW5nIHNvbWV0aGluZyB0aGF0IGlzIG5vdCBhIHNwYWNldGltZSBleHBvcnRcIik7XG4gICAgfVxuICAgIGNoZWNrRXhwb3J0Q29udGV4dChtb2R1bGVFeHBvcnQsIHNjaGVtYTIpO1xuICAgIG1vZHVsZUV4cG9ydFtyZWdpc3RlckV4cG9ydF0oc2NoZW1hMiwgbmFtZSk7XG4gIH1cbn1cbmZ1bmN0aW9uIHNjaGVtYShlbnRyaWVzLCBtb2R1bGVTZXR0aW5ncykge1xuICBjb25zdCBjdHggPSBuZXcgU2NoZW1hSW5uZXIoKGN0eDIpID0+IHtcbiAgICBjdHgyLm1vZHVsZURlZi5lbnZpcm9ubWVudCA9IGVudmlyb25tZW50RGVjbGFyYXRpb25zKFxuICAgICAgbW9kdWxlU2V0dGluZ3M/LmVudiA/PyB7fVxuICAgICk7XG4gICAgaWYgKG1vZHVsZVNldHRpbmdzPy5DQVNFX0NPTlZFUlNJT05fUE9MSUNZICE9IG51bGwpIHtcbiAgICAgIGN0eDIuc2V0Q2FzZUNvbnZlcnNpb25Qb2xpY3kobW9kdWxlU2V0dGluZ3MuQ0FTRV9DT05WRVJTSU9OX1BPTElDWSk7XG4gICAgfVxuICAgIGNvbnN0IHRhYmxlU2NoZW1hcyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2FjY05hbWUsIGVudHJ5XSBvZiBPYmplY3QuZW50cmllcyhlbnRyaWVzKSkge1xuICAgICAgY29uc3QgbW91bnQgPSByZXNvbHZlU3VibW9kdWxlRW50cnkoYWNjTmFtZSwgZW50cnkpO1xuICAgICAgaWYgKG1vdW50ICE9PSB2b2lkIDApIHtcbiAgICAgICAgY29uc3QgeyBzdWJtb2R1bGUsIGNhbm9uaWNhbE5hbWUgfSA9IG1vdW50O1xuICAgICAgICBjb25zdCB7IHJhd0RlZiwgZGlzcGF0Y2ggfSA9IHN1Ym1vZHVsZS5kZWZhdWx0LmJ1aWxkU3VibW9kdWxlRGlzcGF0Y2goc3VibW9kdWxlKTtcbiAgICAgICAgZGlzcGF0Y2gubmFtZXNwYWNlID0gYWNjTmFtZTtcbiAgICAgICAgY3R4Mi5hZGRTdWJtb2R1bGUoeyBuYW1lc3BhY2U6IGFjY05hbWUsIG1vZHVsZTogcmF3RGVmIH0pO1xuICAgICAgICBpZiAoY2Fub25pY2FsTmFtZSAhPT0gdm9pZCAwKSB7XG4gICAgICAgICAgY3R4Mi5tb2R1bGVEZWYuZXhwbGljaXROYW1lcy5lbnRyaWVzLnB1c2goe1xuICAgICAgICAgICAgdGFnOiBcIk5hbWVzcGFjZVwiLFxuICAgICAgICAgICAgdmFsdWU6IHsgc291cmNlTmFtZTogYWNjTmFtZSwgY2Fub25pY2FsTmFtZSB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgY3R4Mi5zdWJtb2R1bGVEaXNwYXRjaEluZm9zLnB1c2goZGlzcGF0Y2gpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGlmICghaXNVbnR5cGVkVGFibGVTY2hlbWEoZW50cnkpKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgICAgYHNjaGVtYSBlbnRyeSAnJHthY2NOYW1lfScgbXVzdCBiZSBhIHRhYmxlLCBhIHN1Ym1vZHVsZSBuYW1lc3BhY2Ugb2JqZWN0LCBvciBhIFxcYHsgbmFtZSwgbW9kdWxlIH1cXGAgc3VibW9kdWxlIG1vdW50YFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgY29uc3QgdGFibGUyID0gZW50cnk7XG4gICAgICBjb25zdCB0YWJsZURlZiA9IHRhYmxlMi50YWJsZURlZihjdHgyLCBhY2NOYW1lKTtcbiAgICAgIHRhYmxlU2NoZW1hc1thY2NOYW1lXSA9IHRhYmxlVG9TY2hlbWEoYWNjTmFtZSwgdGFibGUyLCB0YWJsZURlZik7XG4gICAgICBjb25zdCB0YWJsZVNvdXJjZU5hbWVzID0gY3R4Mi50YWJsZVNvdXJjZU5hbWVzLmdldCh0YWJsZTIpO1xuICAgICAgaWYgKHRhYmxlU291cmNlTmFtZXMgPT09IHZvaWQgMCkge1xuICAgICAgICBjdHgyLnRhYmxlU291cmNlTmFtZXMuc2V0KHRhYmxlMiwgW3RhYmxlRGVmLnNvdXJjZU5hbWVdKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRhYmxlU291cmNlTmFtZXMucHVzaCh0YWJsZURlZi5zb3VyY2VOYW1lKTtcbiAgICAgIH1cbiAgICAgIGN0eDIubW9kdWxlRGVmLnRhYmxlcy5wdXNoKHRhYmxlRGVmKTtcbiAgICAgIGlmICh0YWJsZTIuc2NoZWR1bGUpIHtcbiAgICAgICAgY3R4Mi5wZW5kaW5nU2NoZWR1bGVzLnB1c2goe1xuICAgICAgICAgIHRhYmxlOiB0YWJsZTIsXG4gICAgICAgICAgdGFibGVOYW1lOiB0YWJsZURlZi5zb3VyY2VOYW1lLFxuICAgICAgICAgIHNjaGVkdWxlQXRDb2w6IHRhYmxlMi5zY2hlZHVsZS5zY2hlZHVsZUF0Q29sLFxuICAgICAgICAgIHJlZHVjZXI6IHRhYmxlMi5zY2hlZHVsZS5yZWR1Y2VyXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgaWYgKHRhYmxlMi50YWJsZU5hbWUpIHtcbiAgICAgICAgY3R4Mi5tb2R1bGVEZWYuZXhwbGljaXROYW1lcy5lbnRyaWVzLnB1c2goe1xuICAgICAgICAgIHRhZzogXCJUYWJsZVwiLFxuICAgICAgICAgIHZhbHVlOiB7XG4gICAgICAgICAgICBzb3VyY2VOYW1lOiBhY2NOYW1lLFxuICAgICAgICAgICAgY2Fub25pY2FsTmFtZTogdGFibGUyLnRhYmxlTmFtZVxuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICB0YWJsZXM6IHRhYmxlU2NoZW1hcyxcbiAgICAgIGVudjogbW9kdWxlU2V0dGluZ3M/LmVudiA/PyB7fVxuICAgIH07XG4gIH0pO1xuICByZXR1cm4gbmV3IFNjaGVtYShjdHgpO1xufVxuXG4vLyBzcmMvc2VydmVyL2NvbnNvbGUudHNcbnZhciBpbXBvcnRfb2JqZWN0X2luc3BlY3QgPSBfX3RvRVNNKHJlcXVpcmVfb2JqZWN0X2luc3BlY3QoKSk7XG52YXIgZm10TG9nID0gKC4uLmRhdGEpID0+IGRhdGEubWFwKCh4KSA9PiB0eXBlb2YgeCA9PT0gXCJzdHJpbmdcIiA/IHggOiAoMCwgaW1wb3J0X29iamVjdF9pbnNwZWN0LmRlZmF1bHQpKHgpKS5qb2luKFwiIFwiKTtcbnZhciBjb25zb2xlX2xldmVsX2Vycm9yID0gMDtcbnZhciBjb25zb2xlX2xldmVsX3dhcm4gPSAxO1xudmFyIGNvbnNvbGVfbGV2ZWxfaW5mbyA9IDI7XG52YXIgY29uc29sZV9sZXZlbF9kZWJ1ZyA9IDM7XG52YXIgY29uc29sZV9sZXZlbF90cmFjZSA9IDQ7XG52YXIgdGltZXJNYXAgPSAvKiBAX19QVVJFX18gKi8gbmV3IE1hcCgpO1xudmFyIGNvbnNvbGUyID0ge1xuICAvLyBAdHMtZXhwZWN0LWVycm9yIHdlIHdhbnQgYSBibGFuayBwcm90b3R5cGUsIGJ1dCB0eXBlc2NyaXB0IGNvbXBsYWluc1xuICBfX3Byb3RvX186IHt9LFxuICBbU3ltYm9sLnRvU3RyaW5nVGFnXTogXCJjb25zb2xlXCIsXG4gIGFzc2VydDogKGNvbmRpdGlvbiA9IGZhbHNlLCAuLi5kYXRhKSA9PiB7XG4gICAgaWYgKCFjb25kaXRpb24pIHtcbiAgICAgIHN5czIuY29uc29sZV9sb2coY29uc29sZV9sZXZlbF9lcnJvciwgZm10TG9nKC4uLmRhdGEpKTtcbiAgICB9XG4gIH0sXG4gIGNsZWFyOiAoKSA9PiB7XG4gIH0sXG4gIGRlYnVnOiAoLi4uZGF0YSkgPT4ge1xuICAgIHN5czIuY29uc29sZV9sb2coY29uc29sZV9sZXZlbF9kZWJ1ZywgZm10TG9nKC4uLmRhdGEpKTtcbiAgfSxcbiAgZXJyb3I6ICguLi5kYXRhKSA9PiB7XG4gICAgc3lzMi5jb25zb2xlX2xvZyhjb25zb2xlX2xldmVsX2Vycm9yLCBmbXRMb2coLi4uZGF0YSkpO1xuICB9LFxuICBpbmZvOiAoLi4uZGF0YSkgPT4ge1xuICAgIHN5czIuY29uc29sZV9sb2coY29uc29sZV9sZXZlbF9pbmZvLCBmbXRMb2coLi4uZGF0YSkpO1xuICB9LFxuICBsb2c6ICguLi5kYXRhKSA9PiB7XG4gICAgc3lzMi5jb25zb2xlX2xvZyhjb25zb2xlX2xldmVsX2luZm8sIGZtdExvZyguLi5kYXRhKSk7XG4gIH0sXG4gIHRhYmxlOiAodGFidWxhckRhdGEsIF9wcm9wZXJ0aWVzKSA9PiB7XG4gICAgc3lzMi5jb25zb2xlX2xvZyhjb25zb2xlX2xldmVsX2luZm8sIGZtdExvZyh0YWJ1bGFyRGF0YSkpO1xuICB9LFxuICB0cmFjZTogKC4uLmRhdGEpID0+IHtcbiAgICBzeXMyLmNvbnNvbGVfbG9nKGNvbnNvbGVfbGV2ZWxfdHJhY2UsIGZtdExvZyguLi5kYXRhKSk7XG4gIH0sXG4gIHdhcm46ICguLi5kYXRhKSA9PiB7XG4gICAgc3lzMi5jb25zb2xlX2xvZyhjb25zb2xlX2xldmVsX3dhcm4sIGZtdExvZyguLi5kYXRhKSk7XG4gIH0sXG4gIGRpcjogKF9pdGVtLCBfb3B0aW9ucykgPT4ge1xuICB9LFxuICBkaXJ4bWw6ICguLi5fZGF0YSkgPT4ge1xuICB9LFxuICAvLyBDb3VudGluZ1xuICBjb3VudDogKF9sYWJlbCA9IFwiZGVmYXVsdFwiKSA9PiB7XG4gIH0sXG4gIGNvdW50UmVzZXQ6IChfbGFiZWwgPSBcImRlZmF1bHRcIikgPT4ge1xuICB9LFxuICAvLyBHcm91cGluZ1xuICBncm91cDogKC4uLl9kYXRhKSA9PiB7XG4gIH0sXG4gIGdyb3VwQ29sbGFwc2VkOiAoLi4uX2RhdGEpID0+IHtcbiAgfSxcbiAgZ3JvdXBFbmQ6ICgpID0+IHtcbiAgfSxcbiAgLy8gVGltaW5nXG4gIHRpbWU6IChsYWJlbCA9IFwiZGVmYXVsdFwiKSA9PiB7XG4gICAgaWYgKHRpbWVyTWFwLmhhcyhsYWJlbCkpIHtcbiAgICAgIHN5czIuY29uc29sZV9sb2coY29uc29sZV9sZXZlbF93YXJuLCBgVGltZXIgJyR7bGFiZWx9JyBhbHJlYWR5IGV4aXN0cy5gKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGltZXJNYXAuc2V0KGxhYmVsLCBzeXMyLmNvbnNvbGVfdGltZXJfc3RhcnQobGFiZWwpKTtcbiAgfSxcbiAgdGltZUxvZzogKGxhYmVsID0gXCJkZWZhdWx0XCIsIC4uLmRhdGEpID0+IHtcbiAgICBzeXMyLmNvbnNvbGVfbG9nKGNvbnNvbGVfbGV2ZWxfaW5mbywgZm10TG9nKGxhYmVsLCAuLi5kYXRhKSk7XG4gIH0sXG4gIHRpbWVFbmQ6IChsYWJlbCA9IFwiZGVmYXVsdFwiKSA9PiB7XG4gICAgY29uc3Qgc3BhbklkID0gdGltZXJNYXAuZ2V0KGxhYmVsKTtcbiAgICBpZiAoc3BhbklkID09PSB2b2lkIDApIHtcbiAgICAgIHN5czIuY29uc29sZV9sb2coY29uc29sZV9sZXZlbF93YXJuLCBgVGltZXIgJyR7bGFiZWx9JyBkb2VzIG5vdCBleGlzdC5gKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgc3lzMi5jb25zb2xlX3RpbWVyX2VuZChzcGFuSWQpO1xuICAgIHRpbWVyTWFwLmRlbGV0ZShsYWJlbCk7XG4gIH0sXG4gIC8vIEFkZGl0aW9uYWwgY29uc29sZSBtZXRob2RzIHRvIHNhdGlzZnkgdGhlIENvbnNvbGUgaW50ZXJmYWNlXG4gIHRpbWVTdGFtcDogKCkgPT4ge1xuICB9LFxuICBwcm9maWxlOiAoKSA9PiB7XG4gIH0sXG4gIHByb2ZpbGVFbmQ6ICgpID0+IHtcbiAgfVxufTtcblxuLy8gc3JjL3NlcnZlci9wb2x5ZmlsbHMudHNcbmdsb2JhbFRoaXMuY29uc29sZSA9IGNvbnNvbGUyO1xuLyohIEJ1bmRsZWQgbGljZW5zZSBpbmZvcm1hdGlvbjpcblxuc3RhdHVzZXMvaW5kZXguanM6XG4gICgqIVxuICAgKiBzdGF0dXNlc1xuICAgKiBDb3B5cmlnaHQoYykgMjAxNCBKb25hdGhhbiBPbmdcbiAgICogQ29weXJpZ2h0KGMpIDIwMTYgRG91Z2xhcyBDaHJpc3RvcGhlciBXaWxzb25cbiAgICogTUlUIExpY2Vuc2VkXG4gICAqKVxuKi9cblxuZXhwb3J0IHsgQXJyYXlCdWlsZGVyLCBBcnJheUNvbHVtbkJ1aWxkZXIsIEJvb2xCdWlsZGVyLCBCb29sQ29sdW1uQnVpbGRlciwgQm9vbGVhbkV4cHIsIEJ5dGVBcnJheUJ1aWxkZXIsIEJ5dGVBcnJheUNvbHVtbkJ1aWxkZXIsIENhc2VDb252ZXJzaW9uUG9saWN5LCBDb2x1bW5CdWlsZGVyLCBDb2x1bW5FeHByZXNzaW9uLCBDb25uZWN0aW9uSWRCdWlsZGVyLCBDb25uZWN0aW9uSWRDb2x1bW5CdWlsZGVyLCBGMzJCdWlsZGVyLCBGMzJDb2x1bW5CdWlsZGVyLCBGNjRCdWlsZGVyLCBGNjRDb2x1bW5CdWlsZGVyLCBJMTI4QnVpbGRlciwgSTEyOENvbHVtbkJ1aWxkZXIsIEkxNkJ1aWxkZXIsIEkxNkNvbHVtbkJ1aWxkZXIsIEkyNTZCdWlsZGVyLCBJMjU2Q29sdW1uQnVpbGRlciwgSTMyQnVpbGRlciwgSTMyQ29sdW1uQnVpbGRlciwgSTY0QnVpbGRlciwgSTY0Q29sdW1uQnVpbGRlciwgSThCdWlsZGVyLCBJOENvbHVtbkJ1aWxkZXIsIElkZW50aXR5QnVpbGRlciwgSWRlbnRpdHlDb2x1bW5CdWlsZGVyLCBPcHRpb25CdWlsZGVyLCBPcHRpb25Db2x1bW5CdWlsZGVyLCBQcm9kdWN0QnVpbGRlciwgUHJvZHVjdENvbHVtbkJ1aWxkZXIsIFJhbmdlLCBSZWZCdWlsZGVyLCBSZXF1ZXN0LCBSZXN1bHRCdWlsZGVyLCBSZXN1bHRDb2x1bW5CdWlsZGVyLCBSb3V0ZXIsIFJvd0J1aWxkZXIsIFNjaGVkdWxlQXQsIFNjaGVkdWxlQXRCdWlsZGVyLCBTY2hlZHVsZUF0Q29sdW1uQnVpbGRlciwgU2VuZGVyRXJyb3IsIFNpbXBsZVN1bUJ1aWxkZXIsIFNpbXBsZVN1bUNvbHVtbkJ1aWxkZXIsIFNwYWNldGltZUhvc3RFcnJvciwgU3RyaW5nQnVpbGRlciwgU3RyaW5nQ29sdW1uQnVpbGRlciwgU3VtQnVpbGRlciwgU3VtQ29sdW1uQnVpbGRlciwgU3luY1Jlc3BvbnNlLCBUaW1lRHVyYXRpb25CdWlsZGVyLCBUaW1lRHVyYXRpb25Db2x1bW5CdWlsZGVyLCBUaW1lc3RhbXBCdWlsZGVyLCBUaW1lc3RhbXBDb2x1bW5CdWlsZGVyLCBUeXBlQnVpbGRlciwgVTEyOEJ1aWxkZXIsIFUxMjhDb2x1bW5CdWlsZGVyLCBVMTZCdWlsZGVyLCBVMTZDb2x1bW5CdWlsZGVyLCBVMjU2QnVpbGRlciwgVTI1NkNvbHVtbkJ1aWxkZXIsIFUzMkJ1aWxkZXIsIFUzMkNvbHVtbkJ1aWxkZXIsIFU2NEJ1aWxkZXIsIFU2NENvbHVtbkJ1aWxkZXIsIFU4QnVpbGRlciwgVThDb2x1bW5CdWlsZGVyLCBVdWlkQnVpbGRlciwgVXVpZENvbHVtbkJ1aWxkZXIsIGFuZCwgY3JlYXRlVGFibGVSZWZGcm9tRGVmLCBlcnJvcnMsIGV2YWx1YXRlQm9vbGVhbkV4cHIsIGdldFF1ZXJ5QWNjZXNzb3JOYW1lLCBnZXRRdWVyeVRhYmxlTmFtZSwgZ2V0UXVlcnlXaGVyZUNsYXVzZSwgaXNSb3dUeXBlZFF1ZXJ5LCBpc1R5cGVkUXVlcnksIGxpdGVyYWwsIG1ha2VGcm9tQnVpbGRlciwgbWFrZVF1ZXJ5QnVpbGRlciwgbm90LCBvciwgc2NoZW1hLCB0LCB0YWJsZSwgdG9DYW1lbENhc2UsIHRvQ29tcGFyYWJsZVZhbHVlLCB0b1NxbCB9O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9aW5kZXgubWpzLm1hcFxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9aW5kZXgubWpzLm1hcCIsIi8vIE1vZHVsZSBjb25zdGFudHMuIEtlcHQgb3V0IG9mIGluZGV4LnRzIGJlY2F1c2UgZXZlcnkgZXhwb3J0IHRoZXJlIG11c3QgYmUgYVxuLy8gdGFibGUsIHJlZHVjZXIgb3IgbGlmZWN5Y2xlIGhvb2ssIG9yIFNwYWNldGltZURCIHJlZnVzZXMgdG8gbG9hZCB0aGUgbW9kdWxlLlxuXG4vKiogT25lIHRpY2sgbGFzdHMgdGhpcyBsb25nIGF0IDF4LiBUaGUgcnVuIHdhdGNoZXIgcGFjZXMgZnJhbWVzIGF0IFRJQ0tfTVMgLyBzcGVlZCAoYXBwcy93YXRjaGVyIG1pcnJvcnMgaXQpLiAqL1xuZXhwb3J0IGNvbnN0IFRJQ0tfTVMgPSAxMDAwO1xuZXhwb3J0IGNvbnN0IFNQRUVEUyA9IFswLjUsIDEsIDIsIDRdIGFzIGNvbnN0O1xuLyoqIFNwcmVhZCBhdHRlbXB0cyBvbGRlciB0aGFuIHRoaXMgbWFueSB0aWNrcyBhcmUgZGVsZXRlZCwgc28gc3Vic2NyaXB0aW9ucyBzdGF5IGxpZ2h0LiAqL1xuZXhwb3J0IGNvbnN0IEtFRVBfQVRURU1QVF9USUNLUyA9IDI7XG5leHBvcnQgY29uc3QgTk9URV9NQVggPSAxNDA7XG5leHBvcnQgY29uc3QgUk9MRVMgPSBbXCJzZWN1cml0eVwiLCBcImNsaW5pY2FsX2VuZ2luZWVyaW5nXCIsIFwib3BlcmF0aW9uc1wiLCBcIm9ic2VydmVyXCJdIGFzIGNvbnN0O1xuZXhwb3J0IGNvbnN0IEFOTk9UQVRJTkdfUk9MRVMgPSBbXCJzZWN1cml0eVwiLCBcImNsaW5pY2FsX2VuZ2luZWVyaW5nXCIsIFwib3BlcmF0aW9uc1wiXSBhcyBjb25zdDtcblxuLy8gUnVucy4gVGhlIGVuZ2luZSBjb21wdXRlcyBldmVyeSBmcmFtZTsgdGhlIHJ1biB3YXRjaGVyIGZlZWRzIHRoZW0gaW4gKGluZ2VzdC50cykuXG4vKiogcmVxdWVzdGVkOiB3YWl0aW5nIGZvciB0aGUgZW5naW5lLiBydW5uaW5nL3BhdXNlZDogZnJhbWVzIGFycml2aW5nLiBkb25lOiB0aGUgZmluYWwgZnJhbWUgbGFuZGVkLiBlcnJvcjogc2VlIHJ1bi5kZXRhaWwuICovXG5leHBvcnQgY29uc3QgUlVOX1NUQVRVU0VTID0gW1wicmVxdWVzdGVkXCIsIFwicnVubmluZ1wiLCBcInBhdXNlZFwiLCBcImRvbmVcIiwgXCJlcnJvclwiXSBhcyBjb25zdDtcbi8qKiBMYXJnZXN0IGZyYW1lc19qc29uIG9uZSBydW5fZnJhbWVzX2FwcGx5IGNhbGwgbWF5IGNhcnJ5LiAqL1xuZXhwb3J0IGNvbnN0IEZSQU1FU19NQVggPSAyNTYgKiAxMDI0O1xuLyoqIExvbmdlc3QgcnVuLmRldGFpbCBrZXB0IGZyb20gcnVuX2ZhaWwuICovXG5leHBvcnQgY29uc3QgREVUQUlMX01BWCA9IDUwMDtcbi8qKiBzaW1fZXZlbnQga2luZHMgYSBmcmFtZSBtYXkgY2FycnksIGFuZCB0aGUgaG9zcGl0YWwgbGlzdCBlYWNoIG9uZSdzIHRhcmdldElkIG5hbWVzLiAqL1xuZXhwb3J0IGNvbnN0IEVWRU5UX1RBUkdFVFMgPSB7XG4gIHBhdGllbnRfemVybzogXCJkZXZpY2VzXCIsXG4gIGRldmljZV9pbmZlY3RlZDogXCJkZXZpY2VzXCIsXG4gIHNlcnZpY2VfZG93bjogXCJzZXJ2aWNlc1wiLFxuICBkaXZlcnNpb246IFwicm9vbXNcIixcbn0gYXMgY29uc3Q7XG5leHBvcnQgY29uc3QgUEFUSUVOVF9TVEFURVMgPSBbXCJva1wiLCBcImRlbGF5ZWRcIiwgXCJkaXNydXB0ZWRcIiwgXCJkaXZlcnRlZFwiXSBhcyBjb25zdDtcblxuLy8gQWdlbnQgcm93cyAoRjEpLiBOYW1lcyBtYXRjaCBhZ2VudHMvcHJvdG9jb2wucHkuXG5leHBvcnQgY29uc3QgQUdFTlRfTkFNRVMgPSBbXCJpbnZlbnRvcnlcIiwgXCJmbG93XCIsIFwiY2xpbmljYWxfd29ya2Zsb3dcIiwgXCJjb29yZGluYXRvclwiXSBhcyBjb25zdDtcbi8qKiBXaG8gY2FuIGFwcGVhciBvbiBlaXRoZXIgZW5kIG9mIGFuIGFnZW50X21lc3NhZ2Ugcm93LiBcInJlbGF5XCIgcmVjZWl2ZXMgcm91bmRfc3RhdGUgYW5kIHJlY29tbWVuZGF0aW9uLiAqL1xuZXhwb3J0IGNvbnN0IFNQRUFLRVJTID0gWy4uLkFHRU5UX05BTUVTLCBcImh1bWFuc1wiLCBcInJlbGF5XCJdIGFzIGNvbnN0O1xuZXhwb3J0IGNvbnN0IE1FU1NBR0VfVFlQRVMgPSBbXG4gIFwicHJvcG9zYWxfcmVxdWVzdFwiLCBcInByb3Bvc2FsXCIsIFwicmV2aXNpb25cIiwgXCJ2ZXJkaWN0XCIsIFwicXVlc3Rpb25cIiwgXCJhbnN3ZXJcIiwgXCJyZWNvbW1lbmRhdGlvblwiLCBcInJvdW5kX3N0YXRlXCIsIFwiY2hhdFwiLFxuXSBhcyBjb25zdDtcbmV4cG9ydCBjb25zdCBBR0VOVF9TVEFUVVNFUyA9IFtcImlkbGVcIiwgXCJ0aGlua2luZ1wiLCBcInNwZWFraW5nXCIsIFwid2FpdGluZ1wiXSBhcyBjb25zdDtcbmV4cG9ydCBjb25zdCBST1VORF9TVEFURVMgPSBbXCJpZGxlXCIsIFwicnVubmluZ1wiLCBcIndhaXRpbmdfZm9yX2h1bWFuXCIsIFwiZG9uZVwiXSBhcyBjb25zdDtcbmV4cG9ydCBjb25zdCBURVhUX1NPVVJDRVMgPSBbXCJjbGF1ZGVcIiwgXCJ0ZW1wbGF0ZVwiLCBcIlwiXSBhcyBjb25zdDtcbi8qKiBMYXJnZXN0IHBheWxvYWQgdGhlIHJlbGF5IG1heSBzdG9yZSBwZXIgbWVzc2FnZS4gKi9cbmV4cG9ydCBjb25zdCBQQVlMT0FEX01BWCA9IDY0ICogMTAyNDtcbiIsIi8vIEV2ZXJ5IHRhYmxlIG9mIHRoZSBIaXBwb2NyYS50ZWNoIG1vZHVsZSwgcGx1cyBoZWxwZXJzIHNoYXJlZCBieSB0aGUgcmVkdWNlclxuLy8gZmlsZXMuIFJlZHVjZXJzIGxpdmUgaW4gaW5kZXgudHMgKGJhc2UpIGFuZCBpbiBvbmUgZmlsZSBwZXIgZmVhdHVyZVxuLy8gKGluZ2VzdC50cywgc29sdXRpb24udHMsIGFnZW50cy50cywgcXVlc3Rpb24udHMsIHJlY29tbWVuZGF0aW9uLnRzKSwgYWxsXG4vLyByZS1leHBvcnRlZCBmcm9tIGluZGV4LnRzLlxuLy9cbi8vIFRoZSBtb2R1bGUgaXMgdGhlIGxpdmUgc3RhdGUgYnVzLCBub3QgdGhlIGNvbXB1dGU6IHJ1biByb3dzIGFycml2ZSBhcyBlbmdpbmVcbi8vIGZyYW1lcyB0aHJvdWdoIHJ1bl9mcmFtZXNfYXBwbHkgKGluZ2VzdC50cyksIGFuZCBldmVyeSBjbGllbnQgc3Vic2NyaWJlcy5cbi8vXG4vLyBBbGwgZGF0YSBpcyBzeW50aGV0aWMuIFBhdGllbnQgZ3JvdXBzIGFyZSBjb3VudHMuXG5cbmltcG9ydCB7IHNjaGVtYSwgdGFibGUsIHQsIFNlbmRlckVycm9yIH0gZnJvbSBcInNwYWNldGltZWRiL3NlcnZlclwiO1xuaW1wb3J0IHR5cGUgeyBJZGVudGl0eSwgVGltZXN0YW1wIH0gZnJvbSBcInNwYWNldGltZWRiXCI7XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gdGFibGVzXG5cbmNvbnN0IGNvbmZpZyA9IHRhYmxlKFxuICB7IG5hbWU6IFwiY29uZmlnXCIgfSwgLy8gcHJpdmF0ZVxuICB7IGlkOiB0LnUzMigpLnByaW1hcnlLZXkoKSwgc2VydmVyX2lkZW50aXR5OiB0LmlkZW50aXR5KCkgfSxcbik7XG5cbmNvbnN0IHNlc3Npb24gPSB0YWJsZShcbiAgeyBuYW1lOiBcInNlc3Npb25cIiwgcHVibGljOiB0cnVlIH0sXG4gIHtcbiAgICBpZDogdC5zdHJpbmcoKS5wcmltYXJ5S2V5KCksXG4gICAgaG9zcGl0YWxfanNvbjogdC5zdHJpbmcoKSxcbiAgICBob3NwaXRhbF9uYW1lOiB0LnN0cmluZygpLFxuICAgIHByZXNlbnRlcjogdC5pZGVudGl0eSgpLFxuICAgIGFjdGl2ZV9ydW5faWQ6IHQuc3RyaW5nKCksXG4gICAgY3JlYXRlZF9hdDogdC50aW1lc3RhbXAoKSxcbiAgICAvLyBBZ2dyZWdhdGUtZml4IHJvdW5kIChzcGVjIERhdGEgTW9kZWw6IHNlc3Npb24ucm91bmRTdGF0ZSkuIFdyaXR0ZW4gb25seSBieVxuICAgIC8vIHJvdW5kX3N0YXRlX3NldC4gRGVmYXVsdHMgbGV0IGFuIGV4aXN0aW5nIGRhdGFiYXNlIG1pZ3JhdGUuXG4gICAgcm91bmRfc3RhdGU6IHQuc3RyaW5nKCkuZGVmYXVsdChcImlkbGVcIiksIC8vIGlkbGUgfCBydW5uaW5nIHwgd2FpdGluZ19mb3JfaHVtYW4gfCBkb25lXG4gICAgcm91bmQ6IHQudTMyKCkuZGVmYXVsdCgwKSxcbiAgICByb3VuZF9kZXRhaWw6IHQuc3RyaW5nKCkuZGVmYXVsdChcIlwiKSwgLy8gdGhlIENvb3JkaW5hdG9yJ3MgZGV0YWlsLCBvciB0aGUgd2F0Y2hlcidzIGVycm9yXG4gICAgLy8gRGV2aWNlIGlkcyB0aGUgZW5naW5lIGFjY2VwdHMgYXMgcGF0aWVudCB6ZXJvLCB3cml0dGVuIGJ5IHRoZSB3YXRjaGVyXG4gICAgLy8gKHNlc3Npb25fZW50cnlfcG9pbnRzX3NldCkuIFwiW11cIiA9IG5vdCBrbm93biB5ZXQ7IHJ1bl9zdGFydCB0aGVuIGFjY2VwdHMgYW55IGRldmljZS5cbiAgICBlbnRyeV9wb2ludHNfanNvbjogdC5zdHJpbmcoKS5kZWZhdWx0KFwiW11cIiksXG4gICAgc29sdXRpb25fcGFpcl9pZDogdC5zdHJpbmcoKS5kZWZhdWx0KFwiXCIpLCAvLyB0aGUgcGFpciB0aGUgc29sdXRpb24gdmlldyBzaG93czsgZXZlcnkgdGFiIGZvbGxvd3MgaXRcbiAgfSxcbik7XG5cbi8qKiBPbmUgdmlzaWJsZSBydW4uIEVuZ2luZSBjb2x1bW5zIHN0YXJ0IGVtcHR5IGFuZCBmaWxsIGZyb20gZnJhbWUgMCAoaW5nZXN0LnRzKS4gKi9cbmNvbnN0IHJ1biA9IHRhYmxlKFxuICB7IG5hbWU6IFwicnVuXCIsIHB1YmxpYzogdHJ1ZSB9LFxuICB7XG4gICAgaWQ6IHQuc3RyaW5nKCkucHJpbWFyeUtleSgpLFxuICAgIHNlc3Npb25faWQ6IHQuc3RyaW5nKCkuaW5kZXgoXCJidHJlZVwiKSxcbiAgICBwYWlyX2lkOiB0LnN0cmluZygpLCAvLyBcIlwiIHVubGVzcyBwYXJ0IG9mIGEgc29sdXRpb24tdmlldyBwYWlyXG4gICAgbGFiZWw6IHQuc3RyaW5nKCksXG4gICAgc2VlZDogdC51MzIoKSwgLy8gYWNjZXB0ZWQgYW5kIGlnbm9yZWQ6IHRoZSBlbmdpbmUgaGFzIG5vIFJOR1xuICAgIHBhdGllbnRfemVybzogdC5zdHJpbmcoKSxcbiAgICBwb2xpY3lfanNvbjogdC5zdHJpbmcoKSwgLy8gXCJcIiA9IG5vIHNlZ21lbnRhdGlvbjsgb3RoZXJ3aXNlIHRoZSBhZ2VudHMnIFBvbGljeSwgb3BhcXVlIGhlcmVcbiAgICB0aWNrOiB0LnUzMigpLFxuICAgIHN0YXR1czogdC5zdHJpbmcoKSwgLy8gcmVxdWVzdGVkIHwgcnVubmluZyB8IHBhdXNlZCB8IGRvbmUgfCBlcnJvclxuICAgIHNwZWVkOiB0LmY2NCgpLFxuICAgIHBhdGllbnRzX2FmZmVjdGVkOiB0LnUzMigpLFxuICAgIGRldmljZXNfY29tcHJvbWlzZWQ6IHQudTMyKCksXG4gICAgc2VydmljZXNfZG93bjogdC51MzIoKSxcbiAgICBkZWxheWVkX3Byb2NlZHVyZXM6IHQudTMyKCksXG4gICAgY2hva2VfcG9pbnRzX2pzb246IHQuc3RyaW5nKCksXG4gICAgcHJvdGVjdGVkX2Jyb2tlbl9qc29uOiB0LnN0cmluZygpLFxuICAgIHN0YXJ0ZWRfYXQ6IHQudGltZXN0YW1wKCksXG4gICAgLy8gRGVmYXVsdHMgbGV0IGFuIGV4aXN0aW5nIGRhdGFiYXNlIG1pZ3JhdGUuXG4gICAgZmluYWxfdGljazogdC51MzIoKS5kZWZhdWx0KDApLCAvLyBmcm9tIGZyYW1lIDBcbiAgICBkZXRhaWw6IHQuc3RyaW5nKCkuZGVmYXVsdChcIlwiKSwgLy8gdGhlIGVuZ2luZSdzIG9yIHRoZSB3YXRjaGVyJ3MgZXJyb3IgKHJ1bGUgMTQpOyBuZXZlciBzZXNzaW9uLnJvdW5kX2RldGFpbFxuICAgIGF1dG9wbGF5OiB0LmJvb2woKS5kZWZhdWx0KGZhbHNlKSwgLy8gZnJhbWUgMCBsZWF2ZXMgdGhlIHJ1biBydW5uaW5nICh0cnVlKSBvciBwYXVzZWRcbiAgICBzdGVwX3BlbmRpbmc6IHQuYm9vbCgpLmRlZmF1bHQoZmFsc2UpLCAvLyB0aGUgcHJlc2VudGVyIGFza2VkIGZvciBvbmUgc3RlcCB3aGlsZSBwYXVzZWRcbiAgICBjaGFsbGVuZ2VzX2pzb246IHQuc3RyaW5nKCkuZGVmYXVsdChcIltdXCIpLFxuICAgIHJlbW92ZWRfZmxvd3NfanNvbjogdC5zdHJpbmcoKS5kZWZhdWx0KFwiW11cIiksIC8vIGZyb20gZnJhbWUgMFxuICAgIGFzc3VtcHRpb25zX2pzb246IHQuc3RyaW5nKCkuZGVmYXVsdChcIltdXCIpLCAvLyB0aGUgZW5naW5lJ3MgW1NdIG5vdGVzLCBmcm9tIGZyYW1lIDBcbiAgICByZWNvbW1lbmRhdGlvbl9pZDogdC5zdHJpbmcoKS5kZWZhdWx0KFwiXCIpLCAvLyBzZXQgb24gYSBzb2x1dGlvbiByZXJ1bidzIHBsYW4gc2lkZVxuICB9LFxuKTtcblxuY29uc3QgZGV2aWNlX3N0YXRlID0gdGFibGUoXG4gIHsgbmFtZTogXCJkZXZpY2Vfc3RhdGVcIiwgcHVibGljOiB0cnVlIH0sXG4gIHtcbiAgICBpZDogdC5zdHJpbmcoKS5wcmltYXJ5S2V5KCksIC8vIGAke3J1bl9pZH06JHtkZXZpY2VfaWR9YFxuICAgIHJ1bl9pZDogdC5zdHJpbmcoKS5pbmRleChcImJ0cmVlXCIpLFxuICAgIGRldmljZV9pZDogdC5zdHJpbmcoKSxcbiAgICBpbmZlY3RlZDogdC5ib29sKCksXG4gICAgaW5mZWN0ZWRfYXRfdGljazogdC5pMzIoKSwgLy8gLTEgPSBub3QgaW5mZWN0ZWRcbiAgICBpbmZlY3RlZF9ieTogdC5zdHJpbmcoKSwgLy8gXCJcIiA9IHBhdGllbnQgemVybyBvciBub3QgaW5mZWN0ZWRcbiAgfSxcbik7XG5cbmNvbnN0IHNlcnZpY2Vfc3RhdGUgPSB0YWJsZShcbiAgeyBuYW1lOiBcInNlcnZpY2Vfc3RhdGVcIiwgcHVibGljOiB0cnVlIH0sXG4gIHtcbiAgICBpZDogdC5zdHJpbmcoKS5wcmltYXJ5S2V5KCksXG4gICAgcnVuX2lkOiB0LnN0cmluZygpLmluZGV4KFwiYnRyZWVcIiksXG4gICAgc2VydmljZV9pZDogdC5zdHJpbmcoKSxcbiAgICBkb3duOiB0LmJvb2woKSxcbiAgICBkb3duX3NpbmNlX3RpY2s6IHQuaTMyKCksXG4gIH0sXG4pO1xuXG5jb25zdCBwYXRpZW50X3N0YXRlID0gdGFibGUoXG4gIHsgbmFtZTogXCJwYXRpZW50X3N0YXRlXCIsIHB1YmxpYzogdHJ1ZSB9LFxuICB7XG4gICAgaWQ6IHQuc3RyaW5nKCkucHJpbWFyeUtleSgpLFxuICAgIHJ1bl9pZDogdC5zdHJpbmcoKS5pbmRleChcImJ0cmVlXCIpLFxuICAgIGdyb3VwX2lkOiB0LnN0cmluZygpLFxuICAgIHN0YXRlOiB0LnN0cmluZygpLCAvLyBvayB8IGRlbGF5ZWQgfCBkaXNydXB0ZWQgfCBkaXZlcnRlZFxuICB9LFxuKTtcblxuY29uc3Qgc3ByZWFkX2F0dGVtcHQgPSB0YWJsZShcbiAgeyBuYW1lOiBcInNwcmVhZF9hdHRlbXB0XCIsIHB1YmxpYzogdHJ1ZSB9LFxuICB7XG4gICAgaWQ6IHQudTY0KCkucHJpbWFyeUtleSgpLmF1dG9JbmMoKSxcbiAgICBydW5faWQ6IHQuc3RyaW5nKCkuaW5kZXgoXCJidHJlZVwiKSxcbiAgICB0aWNrOiB0LnUzMigpLFxuICAgIGZyb21fZGV2aWNlOiB0LnN0cmluZygpLFxuICAgIHRvX2RldmljZTogdC5zdHJpbmcoKSxcbiAgICBmbG93X2lkOiB0LnN0cmluZygpLFxuICAgIHN1Y2Nlc3M6IHQuYm9vbCgpLFxuICB9LFxuKTtcblxuY29uc3Qgc2ltX2V2ZW50ID0gdGFibGUoXG4gIHsgbmFtZTogXCJzaW1fZXZlbnRcIiwgcHVibGljOiB0cnVlIH0sXG4gIHtcbiAgICBpZDogdC51NjQoKS5wcmltYXJ5S2V5KCkuYXV0b0luYygpLFxuICAgIHJ1bl9pZDogdC5zdHJpbmcoKS5pbmRleChcImJ0cmVlXCIpLFxuICAgIHRpY2s6IHQudTMyKCksXG4gICAga2luZDogdC5zdHJpbmcoKSxcbiAgICB0YXJnZXRfaWQ6IHQuc3RyaW5nKCksXG4gICAgdGV4dDogdC5zdHJpbmcoKSxcbiAgfSxcbik7XG5cbmNvbnN0IHRpY2tfc25hcHNob3QgPSB0YWJsZShcbiAgeyBuYW1lOiBcInRpY2tfc25hcHNob3RcIiwgcHVibGljOiB0cnVlIH0sXG4gIHtcbiAgICBpZDogdC5zdHJpbmcoKS5wcmltYXJ5S2V5KCksIC8vIGAke3J1bl9pZH06JHt0aWNrfWBcbiAgICBydW5faWQ6IHQuc3RyaW5nKCkuaW5kZXgoXCJidHJlZVwiKSxcbiAgICB0aWNrOiB0LnUzMigpLFxuICAgIGluZmVjdGVkX2NvdW50OiB0LnUzMigpLFxuICAgIHBhdGllbnRzX2FmZmVjdGVkOiB0LnUzMigpLFxuICAgIGluZmVjdGVkX2lkc19qc29uOiB0LnN0cmluZygpLFxuICAgIHNlcnZpY2VzX2Rvd25fanNvbjogdC5zdHJpbmcoKSxcbiAgICBwYXRpZW50c19qc29uOiB0LnN0cmluZygpLFxuICB9LFxuKTtcblxuY29uc3QgcHJlc2VuY2UgPSB0YWJsZShcbiAgeyBuYW1lOiBcInByZXNlbmNlXCIsIHB1YmxpYzogdHJ1ZSB9LFxuICB7XG4gICAgaWRlbnRpdHk6IHQuaWRlbnRpdHkoKS5wcmltYXJ5S2V5KCksXG4gICAgc2Vzc2lvbl9pZDogdC5zdHJpbmcoKS5pbmRleChcImJ0cmVlXCIpLFxuICAgIG5hbWU6IHQuc3RyaW5nKCksXG4gICAgcm9sZTogdC5zdHJpbmcoKSxcbiAgICBmb2xsb3dpbmc6IHQuYm9vbCgpLFxuICAgIGxhc3Rfc2VlbjogdC50aW1lc3RhbXAoKSxcbiAgfSxcbik7XG5cbi8qKiBGb2N1cyBhbm5vdGF0aW9ucyAoc3BlYyA3LjgpLiBDb250ZXh0IGZvciB0aGUgYWdlbnRzLCBuZXZlciBhbiBvcmRlci4gKi9cbmNvbnN0IGFubm90YXRpb24gPSB0YWJsZShcbiAgeyBuYW1lOiBcImFubm90YXRpb25cIiwgcHVibGljOiB0cnVlIH0sXG4gIHtcbiAgICBpZDogdC51NjQoKS5wcmltYXJ5S2V5KCkuYXV0b0luYygpLFxuICAgIHNlc3Npb25faWQ6IHQuc3RyaW5nKCkuaW5kZXgoXCJidHJlZVwiKSxcbiAgICBydW5faWQ6IHQuc3RyaW5nKCksXG4gICAga2luZDogdC5zdHJpbmcoKSwgLy8gZm9jdXNcbiAgICB0YXJnZXRfaWQ6IHQuc3RyaW5nKCksIC8vIGRldmljZSBpZFxuICAgIG5vdGU6IHQuc3RyaW5nKCksXG4gICAgYXV0aG9yOiB0LmlkZW50aXR5KCksXG4gICAgYXV0aG9yX25hbWU6IHQuc3RyaW5nKCksXG4gICAgcm9sZTogdC5zdHJpbmcoKSxcbiAgICBhY3RpdmU6IHQuYm9vbCgpLFxuICAgIGNyZWF0ZWRfYXQ6IHQudGltZXN0YW1wKCksXG4gICAgY2xlYXJlZF9ieTogdC5zdHJpbmcoKSwgLy8gXCJcIiB3aGlsZSBhY3RpdmVcbiAgfSxcbik7XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gYWdlbnQgdGFibGVzIChGMSwgRjIpXG5cbi8qKiBPbmUgcm93IHBlciBcIkNyZWF0ZSBhZ2dyZWdhdGUgZml4XCIgcHJlc3MgKHRoZSBkZWZlbmRfcmVxdWVzdCByZWR1Y2VyKS4gVGhlIHJvdW5kIHdhdGNoZXIgd2FrZXMgdGhlIENvb3JkaW5hdG9yIG9uIGVhY2ggaW5zZXJ0LiAqL1xuY29uc3QgZGVmZW5kX3JlcXVlc3RfbG9nID0gdGFibGUoXG4gIHsgbmFtZTogXCJkZWZlbmRfcmVxdWVzdF9sb2dcIiwgcHVibGljOiB0cnVlIH0sXG4gIHtcbiAgICBpZDogdC51NjQoKS5wcmltYXJ5S2V5KCkuYXV0b0luYygpLFxuICAgIHNlc3Npb25faWQ6IHQuc3RyaW5nKCkuaW5kZXgoXCJidHJlZVwiKSxcbiAgICBydW5faWQ6IHQuc3RyaW5nKCksIC8vIHRoZSBiYXNlbGluZSBydW4gdGhlIGFnZW50cyByZWFkXG4gICAgcGF0aWVudF96ZXJvOiB0LnN0cmluZygpLFxuICAgIHNlZWQ6IHQudTMyKCksXG4gICAgY2hhbGxlbmdlc19qc29uOiB0LnN0cmluZygpLCAvLyBDaGFsbGVuZ2VJZFtdLCBjb3BpZWQgZnJvbSB0aGUgcnVuIChcIltdXCIgdW50aWwgY2hhbGxlbmdlX2FkZCBleGlzdHMpXG4gICAgcmVxdWVzdGVkX2J5OiB0LmlkZW50aXR5KCksXG4gICAgcmVxdWVzdGVyX25hbWU6IHQuc3RyaW5nKCksXG4gICAgY3JlYXRlZF9hdDogdC50aW1lc3RhbXAoKSxcbiAgfSxcbik7XG5cbi8qKiBFdmVyeSB1QWdlbnQgbWVzc2FnZSwgc2VudCBhbmQgcmVjZWl2ZWQsIG1pcnJvcmVkIGJ5IHRoZSB3YXRjaGVyJ3MgcmVsYXkgKHJ1bGUgMTApLiAqL1xuY29uc3QgYWdlbnRfbWVzc2FnZSA9IHRhYmxlKFxuICB7IG5hbWU6IFwiYWdlbnRfbWVzc2FnZVwiLCBwdWJsaWM6IHRydWUgfSxcbiAge1xuICAgIGlkOiB0LnU2NCgpLnByaW1hcnlLZXkoKS5hdXRvSW5jKCksXG4gICAgc2Vzc2lvbl9pZDogdC5zdHJpbmcoKS5pbmRleChcImJ0cmVlXCIpLFxuICAgIHJvdW5kOiB0LnUzMigpLFxuICAgIHNlcTogdC51MzIoKSwgLy8gcGVyIHNlc3Npb24sIGFzc2lnbmVkIGhlcmVcbiAgICBmcm9tX2FnZW50OiB0LnN0cmluZygpLCAvLyBhZ2VudCBuYW1lIG9yIFwiaHVtYW5zXCJcbiAgICB0b19hZ2VudDogdC5zdHJpbmcoKSwgLy8gYWdlbnQgbmFtZSwgXCJodW1hbnNcIiBvciBcInJlbGF5XCJcbiAgICB0eXBlOiB0LnN0cmluZygpLFxuICAgIHBheWxvYWRfanNvbjogdC5zdHJpbmcoKSwgLy8gdGhlIHByb3RvY29sIG1vZGVsLCBhcyBKU09OXG4gICAgcmVhc29uOiB0LnN0cmluZygpLFxuICAgIHJlYXNvbl9zb3VyY2U6IHQuc3RyaW5nKCksIC8vIGNsYXVkZSB8IHRlbXBsYXRlIHwgXCJcIlxuICAgIGRpcmVjdGlvbjogdC5zdHJpbmcoKSwgLy8gc2VudCB8IHJlY2VpdmVkXG4gICAgZml4dHVyZTogdC5ib29sKCksIC8vIG51bWJlcnMgY2FtZSBmcm9tIGZpeHR1cmUgZmlsZXMsIG5vdCB0aGUgZW5naW5lXG4gICAgY3JlYXRlZF9hdDogdC50aW1lc3RhbXAoKSxcbiAgfSxcbik7XG5cbmNvbnN0IGFnZW50X3N0YXR1cyA9IHRhYmxlKFxuICB7IG5hbWU6IFwiYWdlbnRfc3RhdHVzXCIsIHB1YmxpYzogdHJ1ZSB9LFxuICB7XG4gICAgaWQ6IHQuc3RyaW5nKCkucHJpbWFyeUtleSgpLCAvLyBgJHtzZXNzaW9uX2lkfToke2FnZW50fWBcbiAgICBzZXNzaW9uX2lkOiB0LnN0cmluZygpLmluZGV4KFwiYnRyZWVcIiksXG4gICAgYWdlbnQ6IHQuc3RyaW5nKCksXG4gICAgc3RhdHVzOiB0LnN0cmluZygpLCAvLyBpZGxlIHwgdGhpbmtpbmcgfCBzcGVha2luZyB8IHdhaXRpbmdcbiAgICB1cGRhdGVkX2F0OiB0LnRpbWVzdGFtcCgpLFxuICB9LFxuKTtcblxuLyoqIEFuIGFnZW50IGFza2luZyBodW1hbnMgZm9yIGEgZmFjdCBpdCBjYW4ndCBjb21wdXRlLiBPbmx5IGFsbG93ZWQgcm9sZXMgYW5zd2VyLiAqL1xuY29uc3QgcXVlc3Rpb24gPSB0YWJsZShcbiAgeyBuYW1lOiBcInF1ZXN0aW9uXCIsIHB1YmxpYzogdHJ1ZSB9LFxuICB7XG4gICAgaWQ6IHQuc3RyaW5nKCkucHJpbWFyeUtleSgpLCAvLyBgJHtzZXNzaW9uX2lkfToke3F1ZXN0aW9uX2lkfWBcbiAgICBzZXNzaW9uX2lkOiB0LnN0cmluZygpLmluZGV4KFwiYnRyZWVcIiksXG4gICAgcXVlc3Rpb25faWQ6IHQuc3RyaW5nKCksIC8vIHRoZSBhZ2VudCdzIGlkOyBBbnN3ZXIucXVlc3Rpb25JZCByZWZlcnMgdG8gaXRcbiAgICByb3VuZDogdC51MzIoKSxcbiAgICBhZ2VudDogdC5zdHJpbmcoKSxcbiAgICB0YXJnZXRfaWQ6IHQuc3RyaW5nKCksIC8vIGRldmljZSBvciBmbG93IGlkXG4gICAgdGV4dDogdC5zdHJpbmcoKSxcbiAgICB0ZXh0X3NvdXJjZTogdC5zdHJpbmcoKSwgLy8gY2xhdWRlIHwgdGVtcGxhdGVcbiAgICBjaG9pY2VzX2pzb246IHQuc3RyaW5nKCksXG4gICAgYWxsb3dlZF9yb2xlc19qc29uOiB0LnN0cmluZygpLFxuICAgIGFuc3dlcmVkOiB0LmJvb2woKSxcbiAgICBhbnN3ZXJfY2hvaWNlOiB0LnN0cmluZygpLFxuICAgIGFuc3dlcl9hdXRob3I6IHQuc3RyaW5nKCksXG4gICAgYW5zd2VyX3JvbGU6IHQuc3RyaW5nKCksXG4gICAgY3JlYXRlZF9hdDogdC50aW1lc3RhbXAoKSxcbiAgfSxcbik7XG5cbi8qKiBUaGUgQ29vcmRpbmF0b3IncyBwdWJsaXNoZWQgcGxhbnMuIGBzdGF0dXNgIGlzIHdyaXR0ZW4gb25seSBieSByZXZpZXdfc3VibWl0IChydWxlIDkpLiAqL1xuY29uc3QgcmVjb21tZW5kYXRpb24gPSB0YWJsZShcbiAgeyBuYW1lOiBcInJlY29tbWVuZGF0aW9uXCIsIHB1YmxpYzogdHJ1ZSB9LFxuICB7XG4gICAgaWQ6IHQuc3RyaW5nKCkucHJpbWFyeUtleSgpLCAvLyBgJHtzZXNzaW9uX2lkfToke3JvdW5kfWBcbiAgICBzZXNzaW9uX2lkOiB0LnN0cmluZygpLmluZGV4KFwiYnRyZWVcIiksXG4gICAgcm91bmQ6IHQudTMyKCksXG4gICAgbmFtZTogdC5zdHJpbmcoKSxcbiAgICBwb2xpY3lfanNvbjogdC5zdHJpbmcoKSxcbiAgICBleHBsYW5hdGlvbjogdC5zdHJpbmcoKSxcbiAgICBleHBsYW5hdGlvbl9zb3VyY2U6IHQuc3RyaW5nKCksXG4gICAgdmVyaWZpZWRfanNvbjogdC5zdHJpbmcoKSwgLy8gdGhlIFJ1blJlc3VsdCBmcm9tIHRoZSBlbmdpbmUgKGhpcHBvLXNpbSlcbiAgICB2ZXJkaWN0c19qc29uOiB0LnN0cmluZygpLFxuICAgIHJlcXVpcmVkX3JvbGVzX2pzb246IHQuc3RyaW5nKCksXG4gICAgZml4dHVyZTogdC5ib29sKCksXG4gICAgc3RhdHVzOiB0LnN0cmluZygpLCAvLyBkcmFmdCB8IHJlYWR5XG4gICAgdXBkYXRlZF9hdDogdC50aW1lc3RhbXAoKSxcbiAgfSxcbik7XG5cbmNvbnN0IHNwYWNldGltZWRiID0gc2NoZW1hKHtcbiAgY29uZmlnLCBzZXNzaW9uLCBydW4sIGRldmljZV9zdGF0ZSwgc2VydmljZV9zdGF0ZSwgcGF0aWVudF9zdGF0ZSxcbiAgc3ByZWFkX2F0dGVtcHQsIHNpbV9ldmVudCwgdGlja19zbmFwc2hvdCwgcHJlc2VuY2UsIGFubm90YXRpb24sXG4gIGRlZmVuZF9yZXF1ZXN0X2xvZywgYWdlbnRfbWVzc2FnZSwgYWdlbnRfc3RhdHVzLCBxdWVzdGlvbiwgcmVjb21tZW5kYXRpb24sXG59KTtcbmV4cG9ydCBkZWZhdWx0IHNwYWNldGltZWRiO1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIHNoYXJlZCBoZWxwZXJzXG5cbmV4cG9ydCBmdW5jdGlvbiBmYWlsKG1lc3NhZ2U6IHN0cmluZyk6IG5ldmVyIHtcbiAgdGhyb3cgbmV3IFNlbmRlckVycm9yKG1lc3NhZ2UpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2FtZShhOiBJZGVudGl0eSwgYjogSWRlbnRpdHkpOiBib29sZWFuIHtcbiAgcmV0dXJuIGEuaXNFcXVhbChiKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzU2VydmVyKGN0eDogYW55KTogYm9vbGVhbiB7XG4gIGNvbnN0IGMgPSBjdHguZGIuY29uZmlnLmlkLmZpbmQoMCk7XG4gIHJldHVybiAhIWMgJiYgc2FtZShjLnNlcnZlcl9pZGVudGl0eSwgY3R4LnNlbmRlcik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRTZXNzaW9uKGN0eDogYW55LCBzZXNzaW9uSWQ6IHN0cmluZykge1xuICByZXR1cm4gY3R4LmRiLnNlc3Npb24uaWQuZmluZChzZXNzaW9uSWQpID8/IGZhaWwoYFNlc3Npb24gXCIke3Nlc3Npb25JZH1cIiBkb2VzIG5vdCBleGlzdC5gKTtcbn1cblxuLyoqIFNlcnZlci1vbmx5IHJlZHVjZXJzIChBR0VOVFMubWQgcnVsZSAxMSk6IHdhdGNoZXJzIGFuZCB0aGUgTm9kZSBzZXJ2ZXIuICovXG5leHBvcnQgZnVuY3Rpb24gcmVxdWlyZVNlcnZlcihjdHg6IGFueSk6IHZvaWQge1xuICBpZiAoIWlzU2VydmVyKGN0eCkpIGZhaWwoXCJPbmx5IHRoZSBzZXJ2ZXIgaWRlbnRpdHkgY2FuIGNhbGwgdGhpcyByZWR1Y2VyLlwiKTtcbn1cblxuLyoqIFJ1biBjb250cm9sczogdGhlIHByZXNlbnRlciAoc3BlYyA3LjMpIG9yIHRoZSBzZXJ2ZXIgaWRlbnRpdHkuICovXG5leHBvcnQgZnVuY3Rpb24gcmVxdWlyZVByZXNlbnRlcihjdHg6IGFueSwgc2Vzc2lvbklkOiBzdHJpbmcpOiB2b2lkIHtcbiAgY29uc3QgcyA9IGdldFNlc3Npb24oY3R4LCBzZXNzaW9uSWQpO1xuICBpZiAoIXNhbWUocy5wcmVzZW50ZXIsIGN0eC5zZW5kZXIpICYmICFpc1NlcnZlcihjdHgpKSBmYWlsKFwiT25seSB0aGUgcHJlc2VudGVyIGNhbiBjb250cm9sIHBsYXliYWNrLlwiKTtcbn1cblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSBydW4gaGVscGVyc1xuXG5leHBvcnQgdHlwZSBSdW5Sb3cgPSB7XG4gIGlkOiBzdHJpbmc7IHNlc3Npb25faWQ6IHN0cmluZzsgcGFpcl9pZDogc3RyaW5nOyBsYWJlbDogc3RyaW5nOyBzZWVkOiBudW1iZXI7IHBhdGllbnRfemVybzogc3RyaW5nO1xuICBwb2xpY3lfanNvbjogc3RyaW5nOyB0aWNrOiBudW1iZXI7IHN0YXR1czogc3RyaW5nOyBzcGVlZDogbnVtYmVyOyBwYXRpZW50c19hZmZlY3RlZDogbnVtYmVyO1xuICBkZXZpY2VzX2NvbXByb21pc2VkOiBudW1iZXI7IHNlcnZpY2VzX2Rvd246IG51bWJlcjsgZGVsYXllZF9wcm9jZWR1cmVzOiBudW1iZXI7XG4gIGNob2tlX3BvaW50c19qc29uOiBzdHJpbmc7IHByb3RlY3RlZF9icm9rZW5fanNvbjogc3RyaW5nOyBzdGFydGVkX2F0OiBUaW1lc3RhbXA7XG4gIGZpbmFsX3RpY2s6IG51bWJlcjsgZGV0YWlsOiBzdHJpbmc7IGF1dG9wbGF5OiBib29sZWFuOyBzdGVwX3BlbmRpbmc6IGJvb2xlYW47IGNoYWxsZW5nZXNfanNvbjogc3RyaW5nO1xuICByZW1vdmVkX2Zsb3dzX2pzb246IHN0cmluZzsgYXNzdW1wdGlvbnNfanNvbjogc3RyaW5nOyByZWNvbW1lbmRhdGlvbl9pZDogc3RyaW5nO1xufTtcblxuLyoqIFRoZSBwdWJsaWMgcm93cyBhIHJ1bidzIGZyYW1lcyB3cml0ZSwgYmVzaWRlcyB0aGUgcnVuIHJvdyBpdHNlbGYuICovXG5leHBvcnQgY29uc3QgUlVOX1JPV19UQUJMRVMgPSBbXCJkZXZpY2Vfc3RhdGVcIiwgXCJzZXJ2aWNlX3N0YXRlXCIsIFwicGF0aWVudF9zdGF0ZVwiLCBcInNwcmVhZF9hdHRlbXB0XCIsIFwic2ltX2V2ZW50XCIsIFwidGlja19zbmFwc2hvdFwiXSBhcyBjb25zdDtcblxuLyoqIEEgcnVuJ3MgY29sdW1ucyBiZWZvcmUgZnJhbWUgMCBhcnJpdmVzOiBydW5fc3RhcnQsIHNvbHV0aW9uX3N0YXJ0IGFuZCBydW5fcmVzZXQgd3JpdGUgdGhlc2UuICovXG5leHBvcnQgY29uc3QgQkVGT1JFX0ZSQU1FXzAgPSB7XG4gIHRpY2s6IDAsIHN0YXR1czogXCJyZXF1ZXN0ZWRcIiwgc3RlcF9wZW5kaW5nOiBmYWxzZSwgZGV0YWlsOiBcIlwiLCBmaW5hbF90aWNrOiAwLFxuICBwYXRpZW50c19hZmZlY3RlZDogMCwgZGV2aWNlc19jb21wcm9taXNlZDogMCwgc2VydmljZXNfZG93bjogMCwgZGVsYXllZF9wcm9jZWR1cmVzOiAwLFxuICBjaG9rZV9wb2ludHNfanNvbjogXCJbXVwiLCBwcm90ZWN0ZWRfYnJva2VuX2pzb246IFwiW11cIiwgcmVtb3ZlZF9mbG93c19qc29uOiBcIltdXCIsIGFzc3VtcHRpb25zX2pzb246IFwiW11cIixcbn0gYXMgY29uc3Q7XG5cbmV4cG9ydCBmdW5jdGlvbiByb3dLZXkoLi4ucGFydHM6IChzdHJpbmcgfCBudW1iZXIpW10pOiBzdHJpbmcge1xuICByZXR1cm4gcGFydHMuam9pbihcIjpcIik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWFkUnVuKGN0eDogYW55LCBydW5JZDogc3RyaW5nKTogUnVuUm93IHtcbiAgcmV0dXJuIChjdHguZGIucnVuLmlkLmZpbmQocnVuSWQpIGFzIFJ1blJvdyB8IHVuZGVmaW5lZCkgPz8gZmFpbChgUnVuIFwiJHtydW5JZH1cIiBkb2VzIG5vdCBleGlzdC5gKTtcbn1cblxuLyoqIFBsYXliYWNrIGtleTogYSBzb2x1dGlvbiBwYWlyIG1vdmVzIHRvZ2V0aGVyLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBsYXliYWNrS2V5KHI6IHsgaWQ6IHN0cmluZzsgcGFpcl9pZDogc3RyaW5nIH0pOiBzdHJpbmcge1xuICByZXR1cm4gci5wYWlyX2lkIHx8IHIuaWQ7XG59XG5cbi8qKiBFdmVyeSBydW4gdW5kZXIgdGhpcyBydW4ncyBwbGF5YmFjayBrZXkgKGl0c2VsZiwgb3IgaXRzIHdob2xlIHBhaXIpLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJ1bnNGb3JLZXkoY3R4OiBhbnksIHI6IFJ1blJvdyk6IFJ1blJvd1tdIHtcbiAgY29uc3QgayA9IHBsYXliYWNrS2V5KHIpO1xuICByZXR1cm4gWy4uLmN0eC5kYi5ydW4uc2Vzc2lvbl9pZC5maWx0ZXIoci5zZXNzaW9uX2lkKV0uZmlsdGVyKCh4OiBSdW5Sb3cpID0+IHBsYXliYWNrS2V5KHgpID09PSBrKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlbGV0ZVJ1blJvd3MoY3R4OiBhbnksIHJ1bklkOiBzdHJpbmcpOiB2b2lkIHtcbiAgZm9yIChjb25zdCB0Ymwgb2YgUlVOX1JPV19UQUJMRVMpIHtcbiAgICBmb3IgKGNvbnN0IHJvdyBvZiBbLi4uY3R4LmRiW3RibF0ucnVuX2lkLmZpbHRlcihydW5JZCldKSBjdHguZGJbdGJsXS5kZWxldGUocm93KTtcbiAgfVxufVxuXG4vKiogQSBydW4gaW4gdGhlIHNlc3Npb24gdGhhdCBpcyBiZWluZyBjb21wdXRlZCBvciBwbGF5ZWQgKHJ1bGUgNTogYWdlbnRzIHdhaXQgZm9yIGl0KS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBidXN5UnVuKGN0eDogYW55LCBzZXNzaW9uSWQ6IHN0cmluZyk6IFJ1blJvdyB8IHVuZGVmaW5lZCB7XG4gIHJldHVybiBbLi4uY3R4LmRiLnJ1bi5zZXNzaW9uX2lkLmZpbHRlcihzZXNzaW9uSWQpXS5maW5kKChyOiBSdW5Sb3cpID0+IHIuc3RhdHVzID09PSBcInJlcXVlc3RlZFwiIHx8IHIuc3RhdHVzID09PSBcInJ1bm5pbmdcIik7XG59XG5cbi8qKiBXaHkgYSBwbGF5YmFjayBjb250cm9sIGNhbid0IGFjdCBvbiBhIHJ1biBpbiB0aGlzIHN0YXR1cy4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzdGF0dXNSZWZ1c2FsKHN0YXR1czogc3RyaW5nKTogc3RyaW5nIHtcbiAgaWYgKHN0YXR1cyA9PT0gXCJyZXF1ZXN0ZWRcIikgcmV0dXJuIFwiVGhpcyBydW4gaXMgc3RpbGwgYmVpbmcgY29tcHV0ZWQuXCI7XG4gIGlmIChzdGF0dXMgPT09IFwiZG9uZVwiKSByZXR1cm4gXCJUaGlzIHJ1biBoYXMgZmluaXNoZWQuIFJlc2V0IGl0IHRvIHBsYXkgYWdhaW4uXCI7XG4gIGlmIChzdGF0dXMgPT09IFwiZXJyb3JcIikgcmV0dXJuIFwiVGhpcyBydW4gZmFpbGVkLiBSZXNldCBpdCB0byB0cnkgYWdhaW4uXCI7XG4gIHJldHVybiBcIlwiO1xufVxuIiwiLy8gVGhlIGhvc3BpdGFsIGZpbGUgdGhlIG1vZHVsZSBzdG9yZXMgb24gZWFjaCBzZXNzaW9uOiBpdHMgc2hhcGVcbi8vIChkb2NzL2hpcHBvY3JhdGVjaC9IT1NQSVRBTF9TQ0hFTUEubWQpIGFuZCB0aGUgc2VydmVyLXNpZGUgY2hlY2tzLiBUeXBlcyBhbmRcbi8vIHZhbGlkYXRpb24gb25seS4gVGhlIG1vZHVsZSBuZXZlciBzaW11bGF0ZXM6IHNwcmVhZCwgaW1wYWN0IGFuZCBwYXRpZW50XG4vLyBzdGF0ZXMgY29tZSBmcm9tIHRoZSBQeXRob24gZW5naW5lIGFzIGZyYW1lcyAoaW5nZXN0LnRzKS5cbi8vXG4vLyBOb3QgcmUtZXhwb3J0ZWQgZnJvbSBpbmRleC50cywgc28gaXQgbWF5IGV4cG9ydCBoZWxwZXJzLlxuLy9cbi8vIEFsbCBkYXRhIGlzIHN5bnRoZXRpYy4gUGF0aWVudCBncm91cHMgYXJlIGNvdW50cy5cblxuaW1wb3J0IHsgZmFpbCwgZ2V0U2Vzc2lvbiB9IGZyb20gXCIuL3NjaGVtYVwiO1xuXG5leHBvcnQgdHlwZSBQb2ludCA9IFtudW1iZXIsIG51bWJlcl07XG5cbmV4cG9ydCB0eXBlIFJvb21UeXBlID1cbiAgfCBcImltYWdpbmdcIiB8IFwiZXJcIiB8IFwiaWN1XCIgfCBcInBoYXJtYWN5XCIgfCBcIm9yXCIgfCBcInNlcnZlclwiXG4gIHwgXCJsYWJcIiB8IFwiYWRtaW5cIiB8IFwid2FpdGluZ1wiIHwgXCJ3YXJkXCIgfCBcIm90aGVyXCI7XG5cbmV4cG9ydCB0eXBlIERldmljZVR5cGUgPVxuICB8IFwibXJpXCIgfCBcImN0XCIgfCBcIndvcmtzdGF0aW9uXCIgfCBcIm51cnNlX3N0YXRpb25cIiB8IFwicGF0aWVudF9tb25pdG9yXCJcbiAgfCBcImluZnVzaW9uX3B1bXBcIiB8IFwic2VydmVyX3JhY2tcIiB8IFwicGhhcm1hY3lfY2FiaW5ldFwiIHwgXCJsYWJfYW5hbHl6ZXJcIlxuICB8IFwiYW5lc3RoZXNpYV9tYWNoaW5lXCIgfCBcImJhZGdlX3JlYWRlclwiIHwgXCJodmFjXCIgfCBcInVua25vd25cIjtcblxuZXhwb3J0IHR5cGUgUHJvdG9jb2wgPSBcInNtYlwiIHwgXCJyZHBcIiB8IFwiaHR0cFwiIHwgXCJodHRwc1wiIHwgXCJkaWNvbVwiIHwgXCJobDdcIiB8IFwib3RoZXJcIjtcblxuZXhwb3J0IHR5cGUgRmxvb3IgPSB7IGlkOiBzdHJpbmc7IG5hbWU6IHN0cmluZzsgbGV2ZWw6IG51bWJlciB9O1xuXG5leHBvcnQgdHlwZSBSb29tID0ge1xuICBpZDogc3RyaW5nOyBmbG9vcklkOiBzdHJpbmc7IG5hbWU6IHN0cmluZzsgdHlwZTogUm9vbVR5cGU7IHpvbmU6IHN0cmluZzsgcG9seWdvbjogUG9pbnRbXTtcbn07XG5cbmV4cG9ydCB0eXBlIERldmljZSA9IHtcbiAgaWQ6IHN0cmluZztcbiAgcm9vbUlkOiBzdHJpbmc7XG4gIHR5cGU6IERldmljZVR5cGU7XG4gIHJvbGU/OiBcInBhY3NcIiB8IFwiZWhyX2VuZ2luZVwiIHwgXCJmaWxlX3NlcnZlclwiIHwgXCJkb21haW5fY29udHJvbGxlclwiIHwgXCJvdGhlclwiO1xuICBuYW1lOiBzdHJpbmc7XG4gIG1ha2U/OiBzdHJpbmc7XG4gIG1vZGVsPzogc3RyaW5nO1xuICBvczogc3RyaW5nO1xuICB2dWxuZXJhYmxlOiBib29sZWFuO1xuICBjcml0aWNhbGl0eTogXCJsb3dcIiB8IFwibWVkaXVtXCIgfCBcImhpZ2hcIiB8IFwibGlmZV9zdXBwb3J0XCI7XG4gIHZsYW46IG51bWJlcjtcbiAgcG9zaXRpb246IFBvaW50O1xufTtcblxuZXhwb3J0IHR5cGUgRmxvdyA9IHtcbiAgaWQ6IHN0cmluZztcbiAgZnJvbTogc3RyaW5nO1xuICB0bzogc3RyaW5nO1xuICBwcm90b2NvbDogUHJvdG9jb2w7XG4gIHBvcnQ6IG51bWJlcjtcbiAgcHJvdGVjdGVkOiBib29sZWFuO1xuICBvYnNlcnZlZD86IGJvb2xlYW47XG4gIHB1cnBvc2U/OiBzdHJpbmc7XG4gIGFjdGl2ZT86IGJvb2xlYW47XG59O1xuXG5leHBvcnQgdHlwZSBTZXJ2aWNlID0ge1xuICBpZDogc3RyaW5nOyBuYW1lOiBzdHJpbmc7IGRlcGVuZHNPbkRldmljZXM6IHN0cmluZ1tdOyBjb25zZXF1ZW5jZTogc3RyaW5nOyBjcml0aWNhbD86IGJvb2xlYW47XG59O1xuXG5leHBvcnQgdHlwZSBQYXRpZW50R3JvdXBUeXBlID0gXCJpY3VcIiB8IFwiZXJcIiB8IFwic3VyZ2ljYWxcIiB8IFwib3V0cGF0aWVudF9zY2FuXCIgfCBcIndhaXRpbmdcIjtcblxuZXhwb3J0IHR5cGUgUGF0aWVudEdyb3VwID0ge1xuICBpZDogc3RyaW5nOyByb29tSWQ6IHN0cmluZzsgdHlwZTogUGF0aWVudEdyb3VwVHlwZTsgY291bnQ6IG51bWJlcjsgZGVwZW5kc09uU2VydmljZXM6IHN0cmluZ1tdO1xufTtcblxuZXhwb3J0IHR5cGUgSG9zcGl0YWwgPSB7XG4gIGlkOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgZmxvb3JzOiBGbG9vcltdO1xuICByb29tczogUm9vbVtdO1xuICBkZXZpY2VzOiBEZXZpY2VbXTtcbiAgZmxvd3M6IEZsb3dbXTtcbiAgc2VydmljZXM6IFNlcnZpY2VbXTtcbiAgcGF0aWVudHM6IFBhdGllbnRHcm91cFtdO1xufTtcblxuZXhwb3J0IHR5cGUgSG9zcGl0YWxGaWxlID0geyBzY2hlbWFWZXJzaW9uOiAxOyBob3NwaXRhbDogSG9zcGl0YWwgfTtcblxuLyoqIEV2ZXJ5IGlkIGEgZnJhbWUgbWF5IG5hbWUsIGJ5IGtpbmQuICovXG5leHBvcnQgdHlwZSBIb3NwaXRhbEluZGV4ID0ge1xuICBkZXZpY2VzOiBTZXQ8c3RyaW5nPjtcbiAgc2VydmljZXM6IFNldDxzdHJpbmc+O1xuICBncm91cHM6IFNldDxzdHJpbmc+O1xuICByb29tczogU2V0PHN0cmluZz47XG4gIGZsb3dzOiBTZXQ8c3RyaW5nPjtcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiB2YWxpZGF0ZUhvc3BpdGFsKGpzb246IHN0cmluZyk6IEhvc3BpdGFsRmlsZSB7XG4gIGxldCBwYXJzZWQ6IHVua25vd247XG4gIHRyeSB7XG4gICAgcGFyc2VkID0gSlNPTi5wYXJzZShqc29uKTtcbiAgfSBjYXRjaCB7XG4gICAgZmFpbChcIlRoZSBob3NwaXRhbCBmaWxlIGlzIG5vdCB2YWxpZCBKU09OLlwiKTtcbiAgfVxuICBjb25zdCBmID0gcGFyc2VkIGFzIFBhcnRpYWw8SG9zcGl0YWxGaWxlPjtcbiAgLy8gRnVsbCB2YWxpZGF0aW9uIChldmVyeSBwYXRoLCBldmVyeSBydWxlKSBsaXZlcyBpbiBwYWNrYWdlcy9zY2hlbWEgYW5kIHJ1bnNcbiAgLy8gaW4gdGhlIGJyb3dzZXIgZmlyc3QuIFRoaXMgaXMgdGhlIHNlcnZlci1zaWRlIGJhY2tzdG9wIGZvciB0aGUgZXNzZW50aWFscy5cbiAgaWYgKGY/LnNjaGVtYVZlcnNpb24gIT09IDEgfHwgIWYuaG9zcGl0YWwpIGZhaWwoXCJFeHBlY3RlZCB7IHNjaGVtYVZlcnNpb246IDEsIGhvc3BpdGFsOiB7Li4ufSB9LlwiKTtcbiAgY29uc3QgaCA9IGYuaG9zcGl0YWw7XG4gIGZvciAoY29uc3QgayBvZiBbXCJmbG9vcnNcIiwgXCJyb29tc1wiLCBcImRldmljZXNcIiwgXCJmbG93c1wiLCBcInNlcnZpY2VzXCIsIFwicGF0aWVudHNcIl0gYXMgY29uc3QpIHtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoaFtrXSkpIGZhaWwoYGhvc3BpdGFsLiR7a30gbXVzdCBiZSBhIGxpc3QuYCk7XG4gIH1cbiAgY29uc3QgaWRzID0gbmV3IFNldChoLmRldmljZXMubWFwKChkKSA9PiBkLmlkKSk7XG4gIGZvciAoY29uc3QgZmwgb2YgaC5mbG93cykgaWYgKCFpZHMuaGFzKGZsLmZyb20pIHx8ICFpZHMuaGFzKGZsLnRvKSkgZmFpbChgRmxvdyBcIiR7ZmwuaWR9XCIgcmVmZXJzIHRvIGEgbWlzc2luZyBkZXZpY2UuYCk7XG4gIGZvciAoY29uc3QgZyBvZiBoLnBhdGllbnRzIGFzIGFueVtdKSB7XG4gICAgZm9yIChjb25zdCBiYW5uZWQgb2YgW1wibmFtZVwiLCBcImFnZVwiLCBcImJpcnRoRGF0ZVwiLCBcIm1yblwiLCBcImRpYWdub3Npc1wiXSkge1xuICAgICAgaWYgKGJhbm5lZCBpbiBnKSBmYWlsKGBQYXRpZW50IGdyb3VwIFwiJHtnLmlkfVwiIGhhcyBcIiR7YmFubmVkfVwiLiBQYXRpZW50IGdyb3VwcyBob2xkIGNvdW50cyBvbmx5LmApO1xuICAgIH1cbiAgfVxuICBpZiAoanNvbi5sZW5ndGggPiAyICogMTAyNCAqIDEwMjQpIGZhaWwoXCJUaGUgaG9zcGl0YWwgZmlsZSBpcyBsYXJnZXIgdGhhbiAyIE1CLlwiKTtcbiAgcmV0dXJuIGYgYXMgSG9zcGl0YWxGaWxlO1xufVxuXG4vKiogVGhlIHNlc3Npb24ncyBob3NwaXRhbC4gc2Vzc2lvbl9jcmVhdGUgdmFsaWRhdGVkIGl0LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGhvc3BpdGFsT2YoY3R4OiBhbnksIHNlc3Npb25JZDogc3RyaW5nKTogSG9zcGl0YWwge1xuICByZXR1cm4gKEpTT04ucGFyc2UoZ2V0U2Vzc2lvbihjdHgsIHNlc3Npb25JZCkuaG9zcGl0YWxfanNvbikgYXMgSG9zcGl0YWxGaWxlKS5ob3NwaXRhbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGhvc3BpdGFsSW5kZXgoaDogSG9zcGl0YWwpOiBIb3NwaXRhbEluZGV4IHtcbiAgcmV0dXJuIHtcbiAgICBkZXZpY2VzOiBuZXcgU2V0KGguZGV2aWNlcy5tYXAoKGQpID0+IGQuaWQpKSxcbiAgICBzZXJ2aWNlczogbmV3IFNldChoLnNlcnZpY2VzLm1hcCgocykgPT4gcy5pZCkpLFxuICAgIGdyb3VwczogbmV3IFNldChoLnBhdGllbnRzLm1hcCgoZykgPT4gZy5pZCkpLFxuICAgIHJvb21zOiBuZXcgU2V0KGgucm9vbXMubWFwKChyKSA9PiByLmlkKSksXG4gICAgZmxvd3M6IG5ldyBTZXQoaC5mbG93cy5tYXAoKGYpID0+IGYuaWQpKSxcbiAgfTtcbn1cbiIsIi8vIFJ1biBpbmdlc3Rpb24gKEFHRU5UUy5tZCBydWxlcyAzLCA0KS4gVGhlIFB5dGhvbiBlbmdpbmUgY29tcHV0ZXMgZWFjaCB2aXNpYmxlXG4vLyBydW47IHRoZSBydW4gd2F0Y2hlciBmZWVkcyBpdHMgZnJhbWVzIGluIGhlcmUsIG9uZSB0aWNrIHBlciBiZWF0LCB0aHJvdWdoIHRoZVxuLy8gc2VydmVyLW9ubHkgcnVuX2ZyYW1lc19hcHBseS4gVGhlIG1vZHVsZSBjaGVja3MgZXZlcnkgZnJhbWUgYWdhaW5zdCB0aGUgcnVuXG4vLyBhbmQgdGhlIHNlc3Npb24ncyBob3NwaXRhbCwgdGhlbiB3cml0ZXMgdGhlIHJvd3MgZXZlcnkgbGFwdG9wIHN1YnNjcmliZXMgdG8uXG4vLyBJdCBuZXZlciBjb21wdXRlcyBzcHJlYWQsIGltcGFjdCBvciBwYXRpZW50IHN0YXRlcy5cbi8vXG4vLyBBIGZyYW1lIGlzIHRoZSBlbmdpbmUncyBUaWNrRnJhbWUgKEhPU1BJVEFMX1NDSEVNQS5tZCBcIlJ1biBmcmFtZXNcIjsgSU5URUdSQVRJT04ubWQgNWEpLlxuLy8gRXZlcnkgZXhwb3J0IGhlcmUgbXVzdCBiZSBhIHJlZHVjZXIgKGluZGV4LnRzIHJlLWV4cG9ydHMgdGhpcyBmaWxlKS5cblxuaW1wb3J0IHsgdCB9IGZyb20gXCJzcGFjZXRpbWVkYi9zZXJ2ZXJcIjtcblxuaW1wb3J0IHsgREVUQUlMX01BWCwgRVZFTlRfVEFSR0VUUywgRlJBTUVTX01BWCwgS0VFUF9BVFRFTVBUX1RJQ0tTLCBQQVRJRU5UX1NUQVRFUyB9IGZyb20gXCIuL2NvbnN0YW50c1wiO1xuaW1wb3J0IHsgaG9zcGl0YWxJbmRleCwgaG9zcGl0YWxPZiwgdHlwZSBIb3NwaXRhbEluZGV4IH0gZnJvbSBcIi4vaG9zcGl0YWxcIjtcbmltcG9ydCBzcGFjZXRpbWVkYiwgeyBkZWxldGVSdW5Sb3dzLCBmYWlsLCByZWFkUnVuLCByZXF1aXJlU2VydmVyLCByb3dLZXksIHR5cGUgUnVuUm93IH0gZnJvbSBcIi4vc2NoZW1hXCI7XG5cbnR5cGUgRGV2aWNlQ2hhbmdlID0geyBkZXZpY2VJZDogc3RyaW5nOyBpbmZlY3RlZDogYm9vbGVhbjsgaW5mZWN0ZWRBdFRpY2s6IG51bWJlcjsgaW5mZWN0ZWRCeTogc3RyaW5nIH07XG50eXBlIFNlcnZpY2VDaGFuZ2UgPSB7IHNlcnZpY2VJZDogc3RyaW5nOyBkb3duOiBib29sZWFuOyBkb3duU2luY2VUaWNrOiBudW1iZXIgfTtcbnR5cGUgUGF0aWVudENoYW5nZSA9IHsgZ3JvdXBJZDogc3RyaW5nOyBzdGF0ZTogc3RyaW5nIH07XG50eXBlIEF0dGVtcHQgPSB7IGZyb206IHN0cmluZzsgdG86IHN0cmluZzsgZmxvd0lkOiBzdHJpbmc7IHN1Y2Nlc3M6IGJvb2xlYW4gfTtcbnR5cGUgRnJhbWVFdmVudCA9IHsga2luZDogc3RyaW5nOyB0YXJnZXRJZDogc3RyaW5nOyB0ZXh0OiBzdHJpbmcgfTtcbnR5cGUgU25hcHNob3QgPSB7XG4gIGluZmVjdGVkQ291bnQ6IG51bWJlcjsgcGF0aWVudHNBZmZlY3RlZDogbnVtYmVyOyBpbmZlY3RlZElkczogc3RyaW5nW107IHNlcnZpY2VzRG93bjogc3RyaW5nW107IHBhdGllbnRzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xufTtcbnR5cGUgU3VtbWFyeSA9IHtcbiAgcGF0aWVudHNBZmZlY3RlZDogbnVtYmVyOyBkZXZpY2VzQ29tcHJvbWlzZWQ6IG51bWJlcjsgc2VydmljZXNEb3duOiBudW1iZXI7IGRlbGF5ZWRQcm9jZWR1cmVzOiBudW1iZXI7XG4gIGNob2tlUG9pbnRzOiB7IGRldmljZUlkOiBzdHJpbmc7IHNoYXJlOiBudW1iZXIgfVtdO1xufTtcbnR5cGUgUnVuSW5mbyA9IHsgZmluYWxUaWNrOiBudW1iZXI7IHJlbW92ZWRGbG93czogc3RyaW5nW107IHByb3RlY3RlZEJyb2tlbjogc3RyaW5nW107IGFzc3VtcHRpb25zOiBzdHJpbmdbXSB9O1xudHlwZSBUaWNrRnJhbWUgPSB7XG4gIHRpY2s6IG51bWJlcjsgZmluYWw6IGJvb2xlYW47IGRldmljZXM6IERldmljZUNoYW5nZVtdOyBzZXJ2aWNlczogU2VydmljZUNoYW5nZVtdOyBwYXRpZW50czogUGF0aWVudENoYW5nZVtdO1xuICBhdHRlbXB0czogQXR0ZW1wdFtdOyBldmVudHM6IEZyYW1lRXZlbnRbXTsgc25hcHNob3Q6IFNuYXBzaG90OyBzdW1tYXJ5OiBTdW1tYXJ5OyBydW4/OiBSdW5JbmZvO1xufTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSBzdHJpY3QgcmVhZGVyc1xuLy8gRWFjaCBvbmUgbmFtZXMgdGhlIHBhdGggaXQgZmFpbGVkIG9uLCBzbyB0aGUgd2F0Y2hlcidzIHJ1bl9mYWlsIGRldGFpbCBzYXlzIHdoYXQgYnJva2UuXG5cbmNvbnN0IFUzMl9NQVggPSAweGZmZmZmZmZmO1xuY29uc3QgSTMyX01BWCA9IDB4N2ZmZmZmZmY7XG5cbmZ1bmN0aW9uIHJlY29yZCh2OiB1bmtub3duLCBwYXRoOiBzdHJpbmcpOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIGlmICh0eXBlb2YgdiAhPT0gXCJvYmplY3RcIiB8fCB2ID09PSBudWxsIHx8IEFycmF5LmlzQXJyYXkodikpIGZhaWwoYCR7cGF0aH0gbXVzdCBiZSBhbiBvYmplY3QuYCk7XG4gIHJldHVybiB2IGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xufVxuXG5mdW5jdGlvbiBvYmoodjogdW5rbm93biwgcGF0aDogc3RyaW5nLCBrZXlzOiByZWFkb25seSBzdHJpbmdbXSwgb3B0aW9uYWw6IHJlYWRvbmx5IHN0cmluZ1tdID0gW10pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIGNvbnN0IG8gPSByZWNvcmQodiwgcGF0aCk7XG4gIGZvciAoY29uc3QgayBvZiBPYmplY3Qua2V5cyhvKSkgaWYgKCFrZXlzLmluY2x1ZGVzKGspICYmICFvcHRpb25hbC5pbmNsdWRlcyhrKSkgZmFpbChgJHtwYXRofSBoYXMgYW4gdW5rbm93biBmaWVsZCBcIiR7a31cIi5gKTtcbiAgZm9yIChjb25zdCBrIG9mIGtleXMpIGlmICghKGsgaW4gbykpIGZhaWwoYCR7cGF0aH0uJHtrfSBpcyBtaXNzaW5nLmApO1xuICByZXR1cm4gbztcbn1cblxuZnVuY3Rpb24gbGlzdCh2OiB1bmtub3duLCBwYXRoOiBzdHJpbmcpOiB1bmtub3duW10ge1xuICBpZiAoIUFycmF5LmlzQXJyYXkodikpIGZhaWwoYCR7cGF0aH0gbXVzdCBiZSBhIGxpc3QuYCk7XG4gIHJldHVybiB2O1xufVxuXG5mdW5jdGlvbiBzdHIodjogdW5rbm93biwgcGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgaWYgKHR5cGVvZiB2ICE9PSBcInN0cmluZ1wiKSBmYWlsKGAke3BhdGh9IG11c3QgYmUgYSBzdHJpbmcuYCk7XG4gIHJldHVybiB2O1xufVxuXG5mdW5jdGlvbiBib29sKHY6IHVua25vd24sIHBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBpZiAodHlwZW9mIHYgIT09IFwiYm9vbGVhblwiKSBmYWlsKGAke3BhdGh9IG11c3QgYmUgdHJ1ZSBvciBmYWxzZS5gKTtcbiAgcmV0dXJuIHY7XG59XG5cbmZ1bmN0aW9uIGludCh2OiB1bmtub3duLCBwYXRoOiBzdHJpbmcsIG1pbjogbnVtYmVyLCBtYXg6IG51bWJlcik6IG51bWJlciB7XG4gIGlmICh0eXBlb2YgdiAhPT0gXCJudW1iZXJcIiB8fCAhTnVtYmVyLmlzSW50ZWdlcih2KSB8fCB2IDwgbWluIHx8IHYgPiBtYXgpIGZhaWwoYCR7cGF0aH0gbXVzdCBiZSBhIHdob2xlIG51bWJlciBmcm9tICR7bWlufSB0byAke21heH0uYCk7XG4gIHJldHVybiB2O1xufVxuXG5mdW5jdGlvbiBrbm93bihpZDogc3RyaW5nLCBzZXQ6IFNldDxzdHJpbmc+LCBwYXRoOiBzdHJpbmcsIHdoYXQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmICghc2V0LmhhcyhpZCkpIGZhaWwoYCR7cGF0aH0gbmFtZXMgJHt3aGF0fSBcIiR7aWR9XCIsIHdoaWNoIGlzIG5vdCBpbiB0aGUgc2Vzc2lvbidzIGhvc3BpdGFsLmApO1xuICByZXR1cm4gaWQ7XG59XG5cbmZ1bmN0aW9uIGlkTGlzdCh2OiB1bmtub3duLCBwYXRoOiBzdHJpbmcsIHNldDogU2V0PHN0cmluZz4sIHdoYXQ6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgY29uc3Qgb3V0ID0gbGlzdCh2LCBwYXRoKS5tYXAoKHgsIGkpID0+IGtub3duKHN0cih4LCBgJHtwYXRofVske2l9XWApLCBzZXQsIGAke3BhdGh9WyR7aX1dYCwgd2hhdCkpO1xuICBpZiAobmV3IFNldChvdXQpLnNpemUgIT09IG91dC5sZW5ndGgpIGZhaWwoYCR7cGF0aH0gbGlzdHMgYW4gaWQgdHdpY2UuYCk7XG4gIHJldHVybiBvdXQ7XG59XG5cbi8qKiBSZWFkcyBhIGxpc3Qgb2YgcGVyLWlkIGNoYW5nZXMsIHdpdGggZWFjaCBpZCBhdCBtb3N0IG9uY2UuICovXG5mdW5jdGlvbiBjaGFuZ2VzPFQ+KHY6IHVua25vd24sIHBhdGg6IHN0cmluZywgcmVhZDogKHg6IHVua25vd24sIHA6IHN0cmluZykgPT4gVCwgaWQ6ICh4OiBUKSA9PiBzdHJpbmcpOiBUW10ge1xuICBjb25zdCBvdXQgPSBsaXN0KHYsIHBhdGgpLm1hcCgoeCwgaSkgPT4gcmVhZCh4LCBgJHtwYXRofVske2l9XWApKTtcbiAgaWYgKG5ldyBTZXQob3V0Lm1hcChpZCkpLnNpemUgIT09IG91dC5sZW5ndGgpIGZhaWwoYCR7cGF0aH0gbGlzdHMgYW4gaWQgdHdpY2UuYCk7XG4gIHJldHVybiBvdXQ7XG59XG5cbmZ1bmN0aW9uIHJlYWRGcmFtZSh2OiB1bmtub3duLCBwYXRoOiBzdHJpbmcsIGl4OiBIb3NwaXRhbEluZGV4KTogVGlja0ZyYW1lIHtcbiAgY29uc3QgZiA9IG9iaih2LCBwYXRoLCBbXCJ0aWNrXCIsIFwiZmluYWxcIiwgXCJkZXZpY2VzXCIsIFwic2VydmljZXNcIiwgXCJwYXRpZW50c1wiLCBcImF0dGVtcHRzXCIsIFwiZXZlbnRzXCIsIFwic25hcHNob3RcIiwgXCJzdW1tYXJ5XCJdLCBbXCJydW5cIl0pO1xuICBjb25zdCB0aWNrID0gaW50KGYudGljaywgYCR7cGF0aH0udGlja2AsIDAsIFUzMl9NQVgpO1xuXG4gIGNvbnN0IGRldmljZXMgPSBjaGFuZ2VzKGYuZGV2aWNlcywgYCR7cGF0aH0uZGV2aWNlc2AsICh4LCBwKSA9PiB7XG4gICAgY29uc3QgZCA9IG9iaih4LCBwLCBbXCJkZXZpY2VJZFwiLCBcImluZmVjdGVkXCIsIFwiaW5mZWN0ZWRBdFRpY2tcIiwgXCJpbmZlY3RlZEJ5XCJdKTtcbiAgICBjb25zdCByb3cgPSB7XG4gICAgICBkZXZpY2VJZDoga25vd24oc3RyKGQuZGV2aWNlSWQsIGAke3B9LmRldmljZUlkYCksIGl4LmRldmljZXMsIGAke3B9LmRldmljZUlkYCwgXCJkZXZpY2VcIiksXG4gICAgICBpbmZlY3RlZDogYm9vbChkLmluZmVjdGVkLCBgJHtwfS5pbmZlY3RlZGApLFxuICAgICAgaW5mZWN0ZWRBdFRpY2s6IGludChkLmluZmVjdGVkQXRUaWNrLCBgJHtwfS5pbmZlY3RlZEF0VGlja2AsIC0xLCB0aWNrKSxcbiAgICAgIGluZmVjdGVkQnk6IHN0cihkLmluZmVjdGVkQnksIGAke3B9LmluZmVjdGVkQnlgKSxcbiAgICB9O1xuICAgIGlmIChyb3cuaW5mZWN0ZWRCeSkga25vd24ocm93LmluZmVjdGVkQnksIGl4LmRldmljZXMsIGAke3B9LmluZmVjdGVkQnlgLCBcImRldmljZVwiKTtcbiAgICBpZiAocm93LmluZmVjdGVkICYmIHJvdy5pbmZlY3RlZEF0VGljayA8IDApIGZhaWwoYCR7cH0gaXMgaW5mZWN0ZWQgYnV0IGhhcyBubyBpbmZlY3RlZEF0VGljay5gKTtcbiAgICBpZiAoIXJvdy5pbmZlY3RlZCAmJiAocm93LmluZmVjdGVkQXRUaWNrICE9PSAtMSB8fCByb3cuaW5mZWN0ZWRCeSkpIGZhaWwoYCR7cH0gaXMgbm90IGluZmVjdGVkLCBzbyBpbmZlY3RlZEF0VGljayBtdXN0IGJlIC0xIGFuZCBpbmZlY3RlZEJ5IFwiXCIuYCk7XG4gICAgcmV0dXJuIHJvdztcbiAgfSwgKGQpID0+IGQuZGV2aWNlSWQpO1xuXG4gIGNvbnN0IHNlcnZpY2VzID0gY2hhbmdlcyhmLnNlcnZpY2VzLCBgJHtwYXRofS5zZXJ2aWNlc2AsICh4LCBwKSA9PiB7XG4gICAgY29uc3QgcyA9IG9iaih4LCBwLCBbXCJzZXJ2aWNlSWRcIiwgXCJkb3duXCIsIFwiZG93blNpbmNlVGlja1wiXSk7XG4gICAgY29uc3Qgcm93ID0ge1xuICAgICAgc2VydmljZUlkOiBrbm93bihzdHIocy5zZXJ2aWNlSWQsIGAke3B9LnNlcnZpY2VJZGApLCBpeC5zZXJ2aWNlcywgYCR7cH0uc2VydmljZUlkYCwgXCJzZXJ2aWNlXCIpLFxuICAgICAgZG93bjogYm9vbChzLmRvd24sIGAke3B9LmRvd25gKSxcbiAgICAgIGRvd25TaW5jZVRpY2s6IGludChzLmRvd25TaW5jZVRpY2ssIGAke3B9LmRvd25TaW5jZVRpY2tgLCAtMSwgdGljayksXG4gICAgfTtcbiAgICBpZiAocm93LmRvd24gIT09IHJvdy5kb3duU2luY2VUaWNrID49IDApIGZhaWwoYCR7cH06IGRvd25TaW5jZVRpY2sgbXVzdCBiZSAtMSBleGFjdGx5IHdoZW4gdGhlIHNlcnZpY2UgaXMgdXAuYCk7XG4gICAgcmV0dXJuIHJvdztcbiAgfSwgKHMpID0+IHMuc2VydmljZUlkKTtcblxuICBjb25zdCBwYXRpZW50cyA9IGNoYW5nZXMoZi5wYXRpZW50cywgYCR7cGF0aH0ucGF0aWVudHNgLCAoeCwgcCkgPT4ge1xuICAgIGNvbnN0IGcgPSBvYmooeCwgcCwgW1wiZ3JvdXBJZFwiLCBcInN0YXRlXCJdKTtcbiAgICByZXR1cm4ge1xuICAgICAgZ3JvdXBJZDoga25vd24oc3RyKGcuZ3JvdXBJZCwgYCR7cH0uZ3JvdXBJZGApLCBpeC5ncm91cHMsIGAke3B9Lmdyb3VwSWRgLCBcInBhdGllbnQgZ3JvdXBcIiksXG4gICAgICBzdGF0ZTogcGF0aWVudFN0YXRlKGcuc3RhdGUsIGAke3B9LnN0YXRlYCksXG4gICAgfTtcbiAgfSwgKGcpID0+IGcuZ3JvdXBJZCk7XG5cbiAgY29uc3QgYXR0ZW1wdHMgPSBsaXN0KGYuYXR0ZW1wdHMsIGAke3BhdGh9LmF0dGVtcHRzYCkubWFwKCh4LCBpKSA9PiB7XG4gICAgY29uc3QgcCA9IGAke3BhdGh9LmF0dGVtcHRzWyR7aX1dYDtcbiAgICBjb25zdCBhID0gb2JqKHgsIHAsIFtcImZyb21cIiwgXCJ0b1wiLCBcImZsb3dJZFwiLCBcInN1Y2Nlc3NcIl0pO1xuICAgIHJldHVybiB7XG4gICAgICBmcm9tOiBrbm93bihzdHIoYS5mcm9tLCBgJHtwfS5mcm9tYCksIGl4LmRldmljZXMsIGAke3B9LmZyb21gLCBcImRldmljZVwiKSxcbiAgICAgIHRvOiBrbm93bihzdHIoYS50bywgYCR7cH0udG9gKSwgaXguZGV2aWNlcywgYCR7cH0udG9gLCBcImRldmljZVwiKSxcbiAgICAgIGZsb3dJZDoga25vd24oc3RyKGEuZmxvd0lkLCBgJHtwfS5mbG93SWRgKSwgaXguZmxvd3MsIGAke3B9LmZsb3dJZGAsIFwiZmxvd1wiKSxcbiAgICAgIHN1Y2Nlc3M6IGJvb2woYS5zdWNjZXNzLCBgJHtwfS5zdWNjZXNzYCksXG4gICAgfTtcbiAgfSk7XG5cbiAgY29uc3QgZXZlbnRzID0gbGlzdChmLmV2ZW50cywgYCR7cGF0aH0uZXZlbnRzYCkubWFwKCh4LCBpKSA9PiB7XG4gICAgY29uc3QgcCA9IGAke3BhdGh9LmV2ZW50c1ske2l9XWA7XG4gICAgY29uc3QgZSA9IG9iaih4LCBwLCBbXCJraW5kXCIsIFwidGFyZ2V0SWRcIiwgXCJ0ZXh0XCJdKTtcbiAgICBjb25zdCBraW5kID0gc3RyKGUua2luZCwgYCR7cH0ua2luZGApO1xuICAgIGlmICghT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKEVWRU5UX1RBUkdFVFMsIGtpbmQpKSBmYWlsKGAke3B9LmtpbmQgbXVzdCBiZSBvbmUgb2Y6ICR7T2JqZWN0LmtleXMoRVZFTlRfVEFSR0VUUykuam9pbihcIiwgXCIpfS5gKTtcbiAgICBjb25zdCB0YXJnZXQ6IGtleW9mIEhvc3BpdGFsSW5kZXggPSBFVkVOVF9UQVJHRVRTW2tpbmQgYXMga2V5b2YgdHlwZW9mIEVWRU5UX1RBUkdFVFNdO1xuICAgIHJldHVybiB7XG4gICAgICBraW5kLFxuICAgICAgdGFyZ2V0SWQ6IGtub3duKHN0cihlLnRhcmdldElkLCBgJHtwfS50YXJnZXRJZGApLCBpeFt0YXJnZXRdLCBgJHtwfS50YXJnZXRJZGAsIHRhcmdldC5zbGljZSgwLCAtMSkpLFxuICAgICAgdGV4dDogc3RyKGUudGV4dCwgYCR7cH0udGV4dGApLFxuICAgIH07XG4gIH0pO1xuXG4gIGNvbnN0IHNwID0gYCR7cGF0aH0uc25hcHNob3RgO1xuICBjb25zdCBzID0gb2JqKGYuc25hcHNob3QsIHNwLCBbXCJpbmZlY3RlZENvdW50XCIsIFwicGF0aWVudHNBZmZlY3RlZFwiLCBcImluZmVjdGVkSWRzXCIsIFwic2VydmljZXNEb3duXCIsIFwicGF0aWVudHNcIl0pO1xuICBjb25zdCBzbmFwUGF0aWVudHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgZm9yIChjb25zdCBbZywgc3RdIG9mIE9iamVjdC5lbnRyaWVzKHJlY29yZChzLnBhdGllbnRzLCBgJHtzcH0ucGF0aWVudHNgKSkpIHtcbiAgICBzbmFwUGF0aWVudHNba25vd24oZywgaXguZ3JvdXBzLCBgJHtzcH0ucGF0aWVudHNgLCBcInBhdGllbnQgZ3JvdXBcIildID0gcGF0aWVudFN0YXRlKHN0LCBgJHtzcH0ucGF0aWVudHMuJHtnfWApO1xuICB9XG4gIGNvbnN0IHNuYXBzaG90ID0ge1xuICAgIGluZmVjdGVkQ291bnQ6IGludChzLmluZmVjdGVkQ291bnQsIGAke3NwfS5pbmZlY3RlZENvdW50YCwgMCwgVTMyX01BWCksXG4gICAgcGF0aWVudHNBZmZlY3RlZDogaW50KHMucGF0aWVudHNBZmZlY3RlZCwgYCR7c3B9LnBhdGllbnRzQWZmZWN0ZWRgLCAwLCBVMzJfTUFYKSxcbiAgICBpbmZlY3RlZElkczogaWRMaXN0KHMuaW5mZWN0ZWRJZHMsIGAke3NwfS5pbmZlY3RlZElkc2AsIGl4LmRldmljZXMsIFwiZGV2aWNlXCIpLFxuICAgIHNlcnZpY2VzRG93bjogaWRMaXN0KHMuc2VydmljZXNEb3duLCBgJHtzcH0uc2VydmljZXNEb3duYCwgaXguc2VydmljZXMsIFwic2VydmljZVwiKSxcbiAgICBwYXRpZW50czogc25hcFBhdGllbnRzLFxuICB9O1xuXG4gIGNvbnN0IG1wID0gYCR7cGF0aH0uc3VtbWFyeWA7XG4gIGNvbnN0IG0gPSBvYmooZi5zdW1tYXJ5LCBtcCwgW1wicGF0aWVudHNBZmZlY3RlZFwiLCBcImRldmljZXNDb21wcm9taXNlZFwiLCBcInNlcnZpY2VzRG93blwiLCBcImRlbGF5ZWRQcm9jZWR1cmVzXCIsIFwiY2hva2VQb2ludHNcIl0pO1xuICBjb25zdCBzdW1tYXJ5ID0ge1xuICAgIHBhdGllbnRzQWZmZWN0ZWQ6IGludChtLnBhdGllbnRzQWZmZWN0ZWQsIGAke21wfS5wYXRpZW50c0FmZmVjdGVkYCwgMCwgVTMyX01BWCksXG4gICAgZGV2aWNlc0NvbXByb21pc2VkOiBpbnQobS5kZXZpY2VzQ29tcHJvbWlzZWQsIGAke21wfS5kZXZpY2VzQ29tcHJvbWlzZWRgLCAwLCBVMzJfTUFYKSxcbiAgICBzZXJ2aWNlc0Rvd246IGludChtLnNlcnZpY2VzRG93biwgYCR7bXB9LnNlcnZpY2VzRG93bmAsIDAsIFUzMl9NQVgpLFxuICAgIGRlbGF5ZWRQcm9jZWR1cmVzOiBpbnQobS5kZWxheWVkUHJvY2VkdXJlcywgYCR7bXB9LmRlbGF5ZWRQcm9jZWR1cmVzYCwgMCwgVTMyX01BWCksXG4gICAgY2hva2VQb2ludHM6IGxpc3QobS5jaG9rZVBvaW50cywgYCR7bXB9LmNob2tlUG9pbnRzYCkubWFwKCh4LCBpKSA9PiB7XG4gICAgICBjb25zdCBwID0gYCR7bXB9LmNob2tlUG9pbnRzWyR7aX1dYDtcbiAgICAgIGNvbnN0IGMgPSBvYmooeCwgcCwgW1wiZGV2aWNlSWRcIiwgXCJzaGFyZVwiXSk7XG4gICAgICBpZiAodHlwZW9mIGMuc2hhcmUgIT09IFwibnVtYmVyXCIgfHwgIShjLnNoYXJlID49IDAgJiYgYy5zaGFyZSA8PSAxKSkgZmFpbChgJHtwfS5zaGFyZSBtdXN0IGJlIGEgbnVtYmVyIGZyb20gMCB0byAxLmApO1xuICAgICAgcmV0dXJuIHsgZGV2aWNlSWQ6IGtub3duKHN0cihjLmRldmljZUlkLCBgJHtwfS5kZXZpY2VJZGApLCBpeC5kZXZpY2VzLCBgJHtwfS5kZXZpY2VJZGAsIFwiZGV2aWNlXCIpLCBzaGFyZTogYy5zaGFyZSB9O1xuICAgIH0pLFxuICB9O1xuXG4gIGxldCBydW46IFJ1bkluZm8gfCB1bmRlZmluZWQ7XG4gIGlmIChmLnJ1biAhPT0gdW5kZWZpbmVkKSB7XG4gICAgY29uc3QgcnAgPSBgJHtwYXRofS5ydW5gO1xuICAgIGNvbnN0IHIgPSBvYmooZi5ydW4sIHJwLCBbXCJmaW5hbFRpY2tcIiwgXCJyZW1vdmVkRmxvd3NcIiwgXCJwcm90ZWN0ZWRCcm9rZW5cIiwgXCJhc3N1bXB0aW9uc1wiXSk7XG4gICAgcnVuID0ge1xuICAgICAgZmluYWxUaWNrOiBpbnQoci5maW5hbFRpY2ssIGAke3JwfS5maW5hbFRpY2tgLCAwLCBJMzJfTUFYKSxcbiAgICAgIHJlbW92ZWRGbG93czogaWRMaXN0KHIucmVtb3ZlZEZsb3dzLCBgJHtycH0ucmVtb3ZlZEZsb3dzYCwgaXguZmxvd3MsIFwiZmxvd1wiKSxcbiAgICAgIHByb3RlY3RlZEJyb2tlbjogaWRMaXN0KHIucHJvdGVjdGVkQnJva2VuLCBgJHtycH0ucHJvdGVjdGVkQnJva2VuYCwgaXguZmxvd3MsIFwiZmxvd1wiKSxcbiAgICAgIGFzc3VtcHRpb25zOiBsaXN0KHIuYXNzdW1wdGlvbnMsIGAke3JwfS5hc3N1bXB0aW9uc2ApLm1hcCgoeCwgaSkgPT4gc3RyKHgsIGAke3JwfS5hc3N1bXB0aW9uc1ske2l9XWApKSxcbiAgICB9O1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICB0aWNrLCBmaW5hbDogYm9vbChmLmZpbmFsLCBgJHtwYXRofS5maW5hbGApLCBkZXZpY2VzLCBzZXJ2aWNlcywgcGF0aWVudHMsIGF0dGVtcHRzLCBldmVudHMsIHNuYXBzaG90LCBzdW1tYXJ5LCBydW4sXG4gIH07XG59XG5cbmZ1bmN0aW9uIHBhdGllbnRTdGF0ZSh2OiB1bmtub3duLCBwYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBzID0gc3RyKHYsIHBhdGgpO1xuICBpZiAoIShQQVRJRU5UX1NUQVRFUyBhcyByZWFkb25seSBzdHJpbmdbXSkuaW5jbHVkZXMocykpIGZhaWwoYCR7cGF0aH0gbXVzdCBiZSBvbmUgb2Y6ICR7UEFUSUVOVF9TVEFURVMuam9pbihcIiwgXCIpfS5gKTtcbiAgcmV0dXJuIHM7XG59XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gcnVuIHJ1bGVzXG5cbi8qKiBTdGF0dXMgbWFjaGluZSAoSU5URUdSQVRJT04ubWQgNWIpOiBmcmFtZSAwIG9uIGEgcmVxdWVzdGVkIHJ1biwgdGhlbiBlYWNoIG5leHQgdGljayB3aGlsZSBydW5uaW5nIG9yIHN0ZXBwaW5nLiAqL1xuZnVuY3Rpb24gY2hlY2tBZ2FpbnN0UnVuKHI6IFJ1blJvdywgZjogVGlja0ZyYW1lLCBpeDogSG9zcGl0YWxJbmRleCwgcGF0aDogc3RyaW5nKTogdm9pZCB7XG4gIGxldCBmaW5hbFRpY2sgPSByLmZpbmFsX3RpY2s7XG4gIGlmIChyLnN0YXR1cyA9PT0gXCJyZXF1ZXN0ZWRcIikge1xuICAgIGlmIChmLnRpY2sgIT09IDApIGZhaWwoYCR7cGF0aH06IHJ1biBcIiR7ci5pZH1cIiBpcyB3YWl0aW5nIGZvciBmcmFtZSAwLCBub3QgdGljayAke2YudGlja30uYCk7XG4gICAgaWYgKCFmLnJ1bikgZmFpbChgJHtwYXRofTogZnJhbWUgMCBtdXN0IGNhcnJ5IHJ1biAoZmluYWxUaWNrLCByZW1vdmVkRmxvd3MsIHByb3RlY3RlZEJyb2tlbiwgYXNzdW1wdGlvbnMpLmApO1xuICAgIGZpbmFsVGljayA9IGYucnVuLmZpbmFsVGljaztcbiAgICBjb25zdCBjb3ZlcnMgPSAoZ290OiBudW1iZXIsIHdhbnQ6IG51bWJlciwgd2hhdDogc3RyaW5nKSA9PiB7XG4gICAgICBpZiAoZ290ICE9PSB3YW50KSBmYWlsKGAke3BhdGh9OiBmcmFtZSAwIG11c3QgbGlzdCBldmVyeSAke3doYXR9ICgke3dhbnR9KSwgbm90ICR7Z290fS5gKTtcbiAgICB9O1xuICAgIGNvdmVycyhmLmRldmljZXMubGVuZ3RoLCBpeC5kZXZpY2VzLnNpemUsIFwiZGV2aWNlXCIpO1xuICAgIGNvdmVycyhmLnNlcnZpY2VzLmxlbmd0aCwgaXguc2VydmljZXMuc2l6ZSwgXCJzZXJ2aWNlXCIpO1xuICAgIGNvdmVycyhmLnBhdGllbnRzLmxlbmd0aCwgaXguZ3JvdXBzLnNpemUsIFwicGF0aWVudCBncm91cFwiKTtcbiAgfSBlbHNlIHtcbiAgICBpZiAoci5zdGF0dXMgIT09IFwicnVubmluZ1wiICYmIHIuc3RhdHVzICE9PSBcInBhdXNlZFwiKSBmYWlsKGAke3BhdGh9OiBydW4gXCIke3IuaWR9XCIgaXMgJHtyLnN0YXR1c30gYW5kIHRha2VzIG5vIGZyYW1lcy5gKTtcbiAgICBpZiAoZi5ydW4pIGZhaWwoYCR7cGF0aH06IG9ubHkgZnJhbWUgMCBjYXJyaWVzIHJ1bi5gKTtcbiAgICBpZiAoZi50aWNrICE9PSByLnRpY2sgKyAxKSBmYWlsKGAke3BhdGh9OiBydW4gXCIke3IuaWR9XCIgaXMgYXQgdGljayAke3IudGlja30sIHNvIHRoZSBuZXh0IGZyYW1lIGlzIHRpY2sgJHtyLnRpY2sgKyAxfSwgbm90ICR7Zi50aWNrfS5gKTtcbiAgICBpZiAoci5zdGF0dXMgPT09IFwicGF1c2VkXCIgJiYgIXIuc3RlcF9wZW5kaW5nKSBmYWlsKGAke3BhdGh9OiBydW4gXCIke3IuaWR9XCIgaXMgcGF1c2VkIGFuZCBubyBzdGVwIHdhcyBhc2tlZCBmb3IuYCk7XG4gIH1cbiAgaWYgKGYudGljayA+IGZpbmFsVGljaykgZmFpbChgJHtwYXRofTogdGljayAke2YudGlja30gaXMgcGFzdCB0aGUgZmluYWwgdGljayAke2ZpbmFsVGlja30uYCk7XG4gIGlmIChmLmZpbmFsICE9PSAoZi50aWNrID09PSBmaW5hbFRpY2spKSBmYWlsKGAke3BhdGh9OiBmaW5hbCBtdXN0IGJlIHRydWUgZXhhY3RseSBvbiB0aWNrICR7ZmluYWxUaWNrfS5gKTtcbn1cblxuLyoqIFRoZSBzYW1lIGVpZ2h0IHdyaXRlcyBmb3IgZXZlcnkgZnJhbWU6IHRocmVlIHN0YXRlIHRhYmxlcywgYXR0ZW1wdHMgKHBydW5lICsgaW5zZXJ0KSwgZXZlbnRzLCBzbmFwc2hvdCwgdGhlIHJ1biByb3cuICovXG5mdW5jdGlvbiBhcHBseUZyYW1lKGN0eDogYW55LCByOiBSdW5Sb3csIGY6IFRpY2tGcmFtZSk6IHZvaWQge1xuICBjb25zdCBmaXJzdCA9IGYudGljayA9PT0gMDtcbiAgaWYgKGZpcnN0KSBkZWxldGVSdW5Sb3dzKGN0eCwgci5pZCk7IC8vIG5vdGhpbmcgc2hvdWxkIGJlIHRoZXJlOyBhIHN0YWxlIHJvdyB3b3VsZCBibG9jayB0aGUgaW5zZXJ0c1xuXG4gIGZvciAoY29uc3QgZCBvZiBmLmRldmljZXMpIHtcbiAgICBjb25zdCByb3cgPSB7IGlkOiByb3dLZXkoci5pZCwgZC5kZXZpY2VJZCksIHJ1bl9pZDogci5pZCwgZGV2aWNlX2lkOiBkLmRldmljZUlkLCBpbmZlY3RlZDogZC5pbmZlY3RlZCxcbiAgICAgIGluZmVjdGVkX2F0X3RpY2s6IGQuaW5mZWN0ZWRBdFRpY2ssIGluZmVjdGVkX2J5OiBkLmluZmVjdGVkQnkgfTtcbiAgICBpZiAoZmlyc3QpIGN0eC5kYi5kZXZpY2Vfc3RhdGUuaW5zZXJ0KHJvdyk7XG4gICAgZWxzZSBjdHguZGIuZGV2aWNlX3N0YXRlLmlkLnVwZGF0ZShyb3cpO1xuICB9XG4gIGZvciAoY29uc3QgcyBvZiBmLnNlcnZpY2VzKSB7XG4gICAgY29uc3Qgcm93ID0geyBpZDogcm93S2V5KHIuaWQsIHMuc2VydmljZUlkKSwgcnVuX2lkOiByLmlkLCBzZXJ2aWNlX2lkOiBzLnNlcnZpY2VJZCwgZG93bjogcy5kb3duLCBkb3duX3NpbmNlX3RpY2s6IHMuZG93blNpbmNlVGljayB9O1xuICAgIGlmIChmaXJzdCkgY3R4LmRiLnNlcnZpY2Vfc3RhdGUuaW5zZXJ0KHJvdyk7XG4gICAgZWxzZSBjdHguZGIuc2VydmljZV9zdGF0ZS5pZC51cGRhdGUocm93KTtcbiAgfVxuICBmb3IgKGNvbnN0IGcgb2YgZi5wYXRpZW50cykge1xuICAgIGNvbnN0IHJvdyA9IHsgaWQ6IHJvd0tleShyLmlkLCBnLmdyb3VwSWQpLCBydW5faWQ6IHIuaWQsIGdyb3VwX2lkOiBnLmdyb3VwSWQsIHN0YXRlOiBnLnN0YXRlIH07XG4gICAgaWYgKGZpcnN0KSBjdHguZGIucGF0aWVudF9zdGF0ZS5pbnNlcnQocm93KTtcbiAgICBlbHNlIGN0eC5kYi5wYXRpZW50X3N0YXRlLmlkLnVwZGF0ZShyb3cpO1xuICB9XG5cbiAgZm9yIChjb25zdCBvbGQgb2YgWy4uLmN0eC5kYi5zcHJlYWRfYXR0ZW1wdC5ydW5faWQuZmlsdGVyKHIuaWQpXSkge1xuICAgIGlmIChvbGQudGljayArIEtFRVBfQVRURU1QVF9USUNLUyA8PSBmLnRpY2spIGN0eC5kYi5zcHJlYWRfYXR0ZW1wdC5kZWxldGUob2xkKTtcbiAgfVxuICBmb3IgKGNvbnN0IGEgb2YgZi5hdHRlbXB0cykge1xuICAgIGN0eC5kYi5zcHJlYWRfYXR0ZW1wdC5pbnNlcnQoe1xuICAgICAgaWQ6IDBuLCBydW5faWQ6IHIuaWQsIHRpY2s6IGYudGljaywgZnJvbV9kZXZpY2U6IGEuZnJvbSwgdG9fZGV2aWNlOiBhLnRvLCBmbG93X2lkOiBhLmZsb3dJZCwgc3VjY2VzczogYS5zdWNjZXNzLFxuICAgIH0pO1xuICB9XG4gIGZvciAoY29uc3QgZSBvZiBmLmV2ZW50cykge1xuICAgIGN0eC5kYi5zaW1fZXZlbnQuaW5zZXJ0KHsgaWQ6IDBuLCBydW5faWQ6IHIuaWQsIHRpY2s6IGYudGljaywga2luZDogZS5raW5kLCB0YXJnZXRfaWQ6IGUudGFyZ2V0SWQsIHRleHQ6IGUudGV4dCB9KTtcbiAgfVxuXG4gIGN0eC5kYi50aWNrX3NuYXBzaG90Lmluc2VydCh7XG4gICAgaWQ6IHJvd0tleShyLmlkLCBmLnRpY2spLCBydW5faWQ6IHIuaWQsIHRpY2s6IGYudGljayxcbiAgICBpbmZlY3RlZF9jb3VudDogZi5zbmFwc2hvdC5pbmZlY3RlZENvdW50LCBwYXRpZW50c19hZmZlY3RlZDogZi5zbmFwc2hvdC5wYXRpZW50c0FmZmVjdGVkLFxuICAgIGluZmVjdGVkX2lkc19qc29uOiBKU09OLnN0cmluZ2lmeShmLnNuYXBzaG90LmluZmVjdGVkSWRzKSxcbiAgICBzZXJ2aWNlc19kb3duX2pzb246IEpTT04uc3RyaW5naWZ5KGYuc25hcHNob3Quc2VydmljZXNEb3duKSxcbiAgICBwYXRpZW50c19qc29uOiBKU09OLnN0cmluZ2lmeShmLnNuYXBzaG90LnBhdGllbnRzKSxcbiAgfSk7XG5cbiAgY29uc3QgbmV4dDogUnVuUm93ID0ge1xuICAgIC4uLnIsXG4gICAgdGljazogZi50aWNrLFxuICAgIHN0ZXBfcGVuZGluZzogZmFsc2UsXG4gICAgcGF0aWVudHNfYWZmZWN0ZWQ6IGYuc3VtbWFyeS5wYXRpZW50c0FmZmVjdGVkLFxuICAgIGRldmljZXNfY29tcHJvbWlzZWQ6IGYuc3VtbWFyeS5kZXZpY2VzQ29tcHJvbWlzZWQsXG4gICAgc2VydmljZXNfZG93bjogZi5zdW1tYXJ5LnNlcnZpY2VzRG93bixcbiAgICBkZWxheWVkX3Byb2NlZHVyZXM6IGYuc3VtbWFyeS5kZWxheWVkUHJvY2VkdXJlcyxcbiAgICBjaG9rZV9wb2ludHNfanNvbjogSlNPTi5zdHJpbmdpZnkoZi5zdW1tYXJ5LmNob2tlUG9pbnRzKSxcbiAgfTtcbiAgaWYgKGYucnVuKSB7XG4gICAgbmV4dC5maW5hbF90aWNrID0gZi5ydW4uZmluYWxUaWNrO1xuICAgIG5leHQucHJvdGVjdGVkX2Jyb2tlbl9qc29uID0gSlNPTi5zdHJpbmdpZnkoZi5ydW4ucHJvdGVjdGVkQnJva2VuKTtcbiAgICBuZXh0LnJlbW92ZWRfZmxvd3NfanNvbiA9IEpTT04uc3RyaW5naWZ5KGYucnVuLnJlbW92ZWRGbG93cyk7XG4gICAgbmV4dC5hc3N1bXB0aW9uc19qc29uID0gSlNPTi5zdHJpbmdpZnkoZi5ydW4uYXNzdW1wdGlvbnMpO1xuICAgIG5leHQuc3RhdHVzID0gci5hdXRvcGxheSA/IFwicnVubmluZ1wiIDogXCJwYXVzZWRcIjtcbiAgfVxuICBpZiAoZi5maW5hbCkgbmV4dC5zdGF0dXMgPSBcImRvbmVcIjtcbiAgY3R4LmRiLnJ1bi5pZC51cGRhdGUobmV4dCk7XG59XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gcmVkdWNlcnNcblxuLyoqXG4gKiBUaGUgcnVuIHdhdGNoZXIncyBvbmUgd3JpdGUgcGF0aC4gYGZyYW1lc19qc29uYCBpcyBgW3sgcnVuSWQsIGZyYW1lOiBUaWNrRnJhbWUgfV1gLFxuICogb25lIGl0ZW0gcGVyIHJ1biAoYm90aCBydW5zIG9mIGEgcGFpciBnbyBpbiBvbmUgY2FsbCkuIEV2ZXJ5dGhpbmcgaXMgY2hlY2tlZFxuICogYmVmb3JlIGFueXRoaW5nIGlzIHdyaXR0ZW4sIGFuZCB0aGUgY2FsbCBpcyBvbmUgdHJhbnNhY3Rpb246IGFsbCBpdGVtcyBsYW5kXG4gKiBvciBub25lIGRvLlxuICovXG5leHBvcnQgY29uc3QgcnVuX2ZyYW1lc19hcHBseSA9IHNwYWNldGltZWRiLnJlZHVjZXIoeyBmcmFtZXNfanNvbjogdC5zdHJpbmcoKSB9LCAoY3R4LCB7IGZyYW1lc19qc29uIH0pID0+IHtcbiAgcmVxdWlyZVNlcnZlcihjdHgpO1xuICBpZiAoZnJhbWVzX2pzb24ubGVuZ3RoID4gRlJBTUVTX01BWCkgZmFpbChgZnJhbWVzX2pzb24gaXMgbGFyZ2VyIHRoYW4gJHtGUkFNRVNfTUFYIC8gMTAyNH0gS2lCLiBTZW5kIGZld2VyIGZyYW1lcyBwZXIgY2FsbC5gKTtcbiAgbGV0IHBhcnNlZDogdW5rbm93bjtcbiAgdHJ5IHtcbiAgICBwYXJzZWQgPSBKU09OLnBhcnNlKGZyYW1lc19qc29uKTtcbiAgfSBjYXRjaCB7XG4gICAgZmFpbChcImZyYW1lc19qc29uIGlzIG5vdCB2YWxpZCBKU09OLlwiKTtcbiAgfVxuICBjb25zdCBpdGVtcyA9IGxpc3QocGFyc2VkLCBcImZyYW1lc1wiKTtcbiAgaWYgKCFpdGVtcy5sZW5ndGgpIGZhaWwoXCJmcmFtZXNfanNvbiBob2xkcyBubyBmcmFtZXMuXCIpO1xuXG4gIGNvbnN0IGluZGV4ZXMgPSBuZXcgTWFwPHN0cmluZywgSG9zcGl0YWxJbmRleD4oKTtcbiAgY29uc3Qgc2VlbiA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBjb25zdCBiYXRjaCA9IGl0ZW1zLm1hcCgoeCwgaSkgPT4ge1xuICAgIGNvbnN0IHBhdGggPSBgZnJhbWVzWyR7aX1dYDtcbiAgICBjb25zdCBpdGVtID0gb2JqKHgsIHBhdGgsIFtcInJ1bklkXCIsIFwiZnJhbWVcIl0pO1xuICAgIGNvbnN0IHJ1bklkID0gc3RyKGl0ZW0ucnVuSWQsIGAke3BhdGh9LnJ1bklkYCk7XG4gICAgaWYgKHNlZW4uaGFzKHJ1bklkKSkgZmFpbChgJHtwYXRofTogcnVuIFwiJHtydW5JZH1cIiBhcHBlYXJzIHR3aWNlIGluIG9uZSBjYWxsLmApO1xuICAgIHNlZW4uYWRkKHJ1bklkKTtcbiAgICBjb25zdCByID0gcmVhZFJ1bihjdHgsIHJ1bklkKTtcbiAgICBsZXQgaXggPSBpbmRleGVzLmdldChyLnNlc3Npb25faWQpO1xuICAgIGlmICghaXgpIGluZGV4ZXMuc2V0KHIuc2Vzc2lvbl9pZCwgKGl4ID0gaG9zcGl0YWxJbmRleChob3NwaXRhbE9mKGN0eCwgci5zZXNzaW9uX2lkKSkpKTtcbiAgICBjb25zdCBmcmFtZSA9IHJlYWRGcmFtZShpdGVtLmZyYW1lLCBgJHtwYXRofS5mcmFtZWAsIGl4KTtcbiAgICBjaGVja0FnYWluc3RSdW4ociwgZnJhbWUsIGl4LCBwYXRoKTtcbiAgICByZXR1cm4geyByLCBmcmFtZSB9O1xuICB9KTtcblxuICBmb3IgKGNvbnN0IHsgciwgZnJhbWUgfSBvZiBiYXRjaCkgYXBwbHlGcmFtZShjdHgsIHIsIGZyYW1lKTtcbn0pO1xuXG4vKiogVGhlIGVuZ2luZSByZWZ1c2VkIHRoZSBydW4sIG9yIHRoZSB3YXRjaGVyIGNvdWxkIG5vdCBmZWVkIGl0IChydWxlIDE0OiBzaG93IHRoZSBlcnJvcikuICovXG5leHBvcnQgY29uc3QgcnVuX2ZhaWwgPSBzcGFjZXRpbWVkYi5yZWR1Y2VyKHsgcnVuX2lkOiB0LnN0cmluZygpLCBkZXRhaWw6IHQuc3RyaW5nKCkgfSwgKGN0eCwgeyBydW5faWQsIGRldGFpbCB9KSA9PiB7XG4gIHJlcXVpcmVTZXJ2ZXIoY3R4KTtcbiAgY29uc3QgciA9IHJlYWRSdW4oY3R4LCBydW5faWQpO1xuICBjdHguZGIucnVuLmlkLnVwZGF0ZSh7IC4uLnIsIHN0YXR1czogXCJlcnJvclwiLCBzdGVwX3BlbmRpbmc6IGZhbHNlLCBkZXRhaWw6IGRldGFpbC5zbGljZSgwLCBERVRBSUxfTUFYKSB9KTtcbn0pO1xuIiwiLy8gVGhlIHNvbHV0aW9uIHZpZXcgKEY0KS4gXCJTaG93IHRoZSBzb2x1dGlvblwiIHJlcnVucyB0aGUgYXR0YWNrIGFzIG9uZSBsb2Nrc3RlcFxuLy8gcGFpcjogbm8gc2VnbWVudGF0aW9uIG9uIG9uZSBzaWRlLCB0aGUgcmVjb21tZW5kYXRpb24ncyBwbGFuIG9uIHRoZSBvdGhlci5cbi8vIFRoZSBydW4gd2F0Y2hlciBjb21wdXRlcyBib3RoIHRocm91Z2ggdGhlIGVuZ2luZSBhbmQgZmVlZHMgdGhlaXIgZnJhbWVzIGluXG4vLyBvbmUgY2FsbCwgc28gYm90aCBzaWRlcyBhZHZhbmNlIHRvZ2V0aGVyLiBFdmVyeSB0YWIgZm9sbG93c1xuLy8gc2Vzc2lvbi5zb2x1dGlvbl9wYWlyX2lkIGludG8gdGhlIHZpZXcuXG4vL1xuLy8gTm90IGEgZGVwbG95bWVudCAocnVsZSA5KTogbm90aGluZyBoZXJlIHdyaXRlcyByZWNvbW1lbmRhdGlvbi5zdGF0dXMuIFRoZVxuLy8gc2Vzc2lvbidzIGJhc2VsaW5lIChhY3RpdmVfcnVuX2lkKSBzdGF5cyBwdXQsIHNvIHRoZSBBZ2VudCBSb29tIGtlZXBzIHJlYWRpbmcgaXQuXG4vLyBFdmVyeSBleHBvcnQgaGVyZSBtdXN0IGJlIGEgcmVkdWNlciAoaW5kZXgudHMgcmUtZXhwb3J0cyB0aGlzIGZpbGUpLlxuXG5pbXBvcnQgeyB0IH0gZnJvbSBcInNwYWNldGltZWRiL3NlcnZlclwiO1xuXG5pbXBvcnQgeyBTUEVFRFMgfSBmcm9tIFwiLi9jb25zdGFudHNcIjtcbmltcG9ydCBzcGFjZXRpbWVkYiwgeyBCRUZPUkVfRlJBTUVfMCwgYnVzeVJ1biwgZmFpbCwgZ2V0U2Vzc2lvbiwgcmVhZFJ1biwgcmVxdWlyZVByZXNlbnRlciB9IGZyb20gXCIuL3NjaGVtYVwiO1xuXG4vKiogQSBmcmVzaCBwYWlyIGlkIHBlciBwcmVzcywgc28gYSByZW9wZW5lZCBzb2x1dGlvbiBuZXZlciByZXVzZXMgYSBzdGFsZSBwbGFuLiAqL1xuZnVuY3Rpb24gbmV3UGFpcklkKGN0eDogYW55LCBzZXNzaW9uSWQ6IHN0cmluZywgcmVjb21tZW5kYXRpb25JZDogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgYmFzZSA9IGBwYWlyXyR7cmVjb21tZW5kYXRpb25JZC5yZXBsYWNlKC9bXkEtWmEtejAtOV8tXS9nLCBcIl9cIil9YDtcbiAgY29uc3QgdXNlZCA9IG5ldyBTZXQoWy4uLmN0eC5kYi5ydW4uc2Vzc2lvbl9pZC5maWx0ZXIoc2Vzc2lvbklkKV0ubWFwKChyOiB7IHBhaXJfaWQ6IHN0cmluZyB9KSA9PiByLnBhaXJfaWQpKTtcbiAgbGV0IG4gPSAxO1xuICB3aGlsZSAodXNlZC5oYXMoYCR7YmFzZX1fJHtufWApKSBuKys7XG4gIHJldHVybiBgJHtiYXNlfV8ke259YDtcbn1cblxuZXhwb3J0IGNvbnN0IHNvbHV0aW9uX3N0YXJ0ID0gc3BhY2V0aW1lZGIucmVkdWNlcihcbiAgeyBzZXNzaW9uX2lkOiB0LnN0cmluZygpLCByZWNvbW1lbmRhdGlvbl9pZDogdC5zdHJpbmcoKSwgc3BlZWQ6IHQuZjY0KCkgfSxcbiAgKGN0eCwgeyBzZXNzaW9uX2lkLCByZWNvbW1lbmRhdGlvbl9pZCwgc3BlZWQgfSkgPT4ge1xuICAgIHJlcXVpcmVQcmVzZW50ZXIoY3R4LCBzZXNzaW9uX2lkKTtcbiAgICBjb25zdCBzID0gZ2V0U2Vzc2lvbihjdHgsIHNlc3Npb25faWQpO1xuICAgIGlmICghKFNQRUVEUyBhcyByZWFkb25seSBudW1iZXJbXSkuaW5jbHVkZXMoc3BlZWQpKSBmYWlsKFwiU3BlZWQgbXVzdCBiZSAwLjUsIDEsIDIgb3IgNC5cIik7XG4gICAgY29uc3QgcmVjID0gY3R4LmRiLnJlY29tbWVuZGF0aW9uLmlkLmZpbmQocmVjb21tZW5kYXRpb25faWQpO1xuICAgIGlmICghcmVjIHx8IHJlYy5zZXNzaW9uX2lkICE9PSBzZXNzaW9uX2lkKSBmYWlsKGBSZWNvbW1lbmRhdGlvbiBcIiR7cmVjb21tZW5kYXRpb25faWR9XCIgZG9lcyBub3QgZXhpc3QgaW4gdGhpcyBzZXNzaW9uLmApO1xuICAgIGlmIChzLnJvdW5kX3N0YXRlID09PSBcInJ1bm5pbmdcIiB8fCBzLnJvdW5kX3N0YXRlID09PSBcIndhaXRpbmdfZm9yX2h1bWFuXCIpIHtcbiAgICAgIGZhaWwoXCJXYWl0IGZvciB0aGUgYWdlbnRzIHRvIGZpbmlzaCBuZWdvdGlhdGluZyBiZWZvcmUgc2hvd2luZyBhIHNvbHV0aW9uLlwiKTtcbiAgICB9XG4gICAgaWYgKGJ1c3lSdW4oY3R4LCBzZXNzaW9uX2lkKSkgZmFpbChcIldhaXQgZm9yIGV2ZXJ5IHJ1biBpbiB0aGlzIHNlc3Npb24gdG8gZmluaXNoLCBvciBwYXVzZSBpdCwgYmVmb3JlIHNob3dpbmcgYSBzb2x1dGlvbi5cIik7XG4gICAgaWYgKCFzLmFjdGl2ZV9ydW5faWQpIGZhaWwoXCJSdW4gdGhlIGF0dGFjayBmaXJzdC4gVGhlIHNvbHV0aW9uIHJlcnVucyB0aGUgYmFzZWxpbmUncyBhdHRhY2suXCIpO1xuICAgIGNvbnN0IGJhc2UgPSByZWFkUnVuKGN0eCwgcy5hY3RpdmVfcnVuX2lkKTtcblxuICAgIGNvbnN0IHBhaXJfaWQgPSBuZXdQYWlySWQoY3R4LCBzZXNzaW9uX2lkLCByZWMuaWQpO1xuICAgIGNvbnN0IGNvbW1vbiA9IHtcbiAgICAgIC4uLkJFRk9SRV9GUkFNRV8wLCBzZXNzaW9uX2lkLCBwYWlyX2lkLCBzZWVkOiBiYXNlLnNlZWQsIHBhdGllbnRfemVybzogYmFzZS5wYXRpZW50X3plcm8sIHNwZWVkLFxuICAgICAgYXV0b3BsYXk6IHRydWUsIGNoYWxsZW5nZXNfanNvbjogYmFzZS5jaGFsbGVuZ2VzX2pzb24sIHN0YXJ0ZWRfYXQ6IGN0eC50aW1lc3RhbXAsXG4gICAgfTtcbiAgICBmb3IgKGNvbnN0IGlkIG9mIFtgJHtwYWlyX2lkfV9ub25lYCwgYCR7cGFpcl9pZH1fcGxhbmBdKSB7XG4gICAgICBpZiAoY3R4LmRiLnJ1bi5pZC5maW5kKGlkKSkgZmFpbChgUnVuIFwiJHtpZH1cIiBhbHJlYWR5IGV4aXN0cy5gKTtcbiAgICB9XG4gICAgY3R4LmRiLnJ1bi5pbnNlcnQoeyAuLi5jb21tb24sIGlkOiBgJHtwYWlyX2lkfV9ub25lYCwgbGFiZWw6IFwiTm8gc2VnbWVudGF0aW9uXCIsIHBvbGljeV9qc29uOiBcIlwiLCByZWNvbW1lbmRhdGlvbl9pZDogXCJcIiB9KTtcbiAgICBjdHguZGIucnVuLmluc2VydCh7XG4gICAgICAuLi5jb21tb24sIGlkOiBgJHtwYWlyX2lkfV9wbGFuYCwgbGFiZWw6IGBXaXRoIHBsYW46ICR7cmVjLm5hbWV9YCwgcG9saWN5X2pzb246IHJlYy5wb2xpY3lfanNvbiwgcmVjb21tZW5kYXRpb25faWQ6IHJlYy5pZCxcbiAgICB9KTtcbiAgICBjdHguZGIuc2Vzc2lvbi5pZC51cGRhdGUoeyAuLi5zLCBzb2x1dGlvbl9wYWlyX2lkOiBwYWlyX2lkIH0pO1xuICB9LFxuKTtcblxuLyoqIEJhY2sgdG8gdGhlIHNlc3Npb246IGV2ZXJ5IHRhYiBsZWF2ZXMgdGhlIHNvbHV0aW9uIHZpZXcuIFRoZSBwYWlyJ3MgcnVucyBzdGF5LiAqL1xuZXhwb3J0IGNvbnN0IHNvbHV0aW9uX2Nsb3NlID0gc3BhY2V0aW1lZGIucmVkdWNlcih7IHNlc3Npb25faWQ6IHQuc3RyaW5nKCkgfSwgKGN0eCwgeyBzZXNzaW9uX2lkIH0pID0+IHtcbiAgcmVxdWlyZVByZXNlbnRlcihjdHgsIHNlc3Npb25faWQpO1xuICBjb25zdCBzID0gZ2V0U2Vzc2lvbihjdHgsIHNlc3Npb25faWQpO1xuICBjdHguZGIuc2Vzc2lvbi5pZC51cGRhdGUoeyAuLi5zLCBzb2x1dGlvbl9wYWlyX2lkOiBcIlwiIH0pO1xufSk7XG4iLCIvLyBBZ2VudCByb3VuZHMgKEYxKTogdGhlIFwiQ3JlYXRlIGFnZ3JlZ2F0ZSBmaXhcIiByZXF1ZXN0LCBhbmQgdGhlIHJvd3MgdGhlXG4vLyB3YXRjaGVyJ3MgcmVsYXkgbWlycm9ycyBmcm9tIHRoZSB1QWdlbnRzIChBR0VOVFMubWQgcnVsZXMgNSwgMTAsIDExKS5cbi8vIFJlZHVjZXJzIG1ha2Ugbm8gbmV0d29yayBjYWxsczogdGhlIHJvdW5kIHdhdGNoZXIgc2VlcyBkZWZlbmRfcmVxdWVzdF9sb2cgcm93c1xuLy8gYW5kIHdha2VzIHRoZSBDb29yZGluYXRvciBpdHNlbGYuXG5cbmltcG9ydCB7IHQgfSBmcm9tIFwic3BhY2V0aW1lZGIvc2VydmVyXCI7XG5cbmltcG9ydCB7IEFHRU5UX05BTUVTLCBBR0VOVF9TVEFUVVNFUywgTUVTU0FHRV9UWVBFUywgUEFZTE9BRF9NQVgsIFJPVU5EX1NUQVRFUywgU1BFQUtFUlMsIFRFWFRfU09VUkNFUyB9IGZyb20gXCIuL2NvbnN0YW50c1wiO1xuaW1wb3J0IHNwYWNldGltZWRiLCB7IGJ1c3lSdW4sIGZhaWwsIGdldFNlc3Npb24sIHJlcXVpcmVTZXJ2ZXIgfSBmcm9tIFwiLi9zY2hlbWFcIjtcblxuZnVuY3Rpb24gb25lT2Y8VCBleHRlbmRzIHN0cmluZz4odmFsdWU6IHN0cmluZywgYWxsb3dlZDogcmVhZG9ubHkgVFtdLCB3aGF0OiBzdHJpbmcpOiBUIHtcbiAgaWYgKCEoYWxsb3dlZCBhcyByZWFkb25seSBzdHJpbmdbXSkuaW5jbHVkZXModmFsdWUpKSBmYWlsKGAke3doYXR9IG11c3QgYmUgb25lIG9mOiAke2FsbG93ZWQuam9pbihcIiwgXCIpfS5gKTtcbiAgcmV0dXJuIHZhbHVlIGFzIFQ7XG59XG5cbi8qKlxuICogQ3JlYXRlIGFnZ3JlZ2F0ZSBmaXguIEFueSBqb2luZWQgaHVtYW4gbWF5IGFzaywgb25jZSB0aGUgYmFzZWxpbmUgcnVuIGhhc1xuICogZmluaXNoZWQgb3IgYmVlbiBwYXVzZWQ6IGFnZW50cyBuZXZlciB0YWxrIHdoaWxlIGFueSBydW4gaW4gdGhlIHNlc3Npb24gaXNcbiAqIGJlaW5nIGNvbXB1dGVkIG9yIHBsYXlpbmcgKHJ1bGUgNSkuIFRoZSB3YXRjaGVyIHJlYWRzIHRoZSBydW4ncyBzZWVkLFxuICogcGF0aWVudCB6ZXJvIGFuZCBjaGFsbGVuZ2VzIGZyb20gdGhpcyByb3cuXG4gKi9cbmV4cG9ydCBjb25zdCBkZWZlbmRfcmVxdWVzdCA9IHNwYWNldGltZWRiLnJlZHVjZXIoeyBzZXNzaW9uX2lkOiB0LnN0cmluZygpIH0sIChjdHgsIHsgc2Vzc2lvbl9pZCB9KSA9PiB7XG4gIGNvbnN0IHMgPSBnZXRTZXNzaW9uKGN0eCwgc2Vzc2lvbl9pZCk7XG4gIGNvbnN0IHAgPSBjdHguZGIucHJlc2VuY2UuaWRlbnRpdHkuZmluZChjdHguc2VuZGVyKTtcbiAgaWYgKCFwIHx8IHAuc2Vzc2lvbl9pZCAhPT0gc2Vzc2lvbl9pZCkgZmFpbChcIkpvaW4gdGhlIHNlc3Npb24gYmVmb3JlIGNyZWF0aW5nIGFuIGFnZ3JlZ2F0ZSBmaXguXCIpO1xuICBjb25zdCByID0gcy5hY3RpdmVfcnVuX2lkID8gY3R4LmRiLnJ1bi5pZC5maW5kKHMuYWN0aXZlX3J1bl9pZCkgOiB1bmRlZmluZWQ7XG4gIGlmICghcikgZmFpbChcIlJ1biB0aGUgYXR0YWNrIGZpcnN0LiBUaGUgYWdlbnRzIHdvcmsgZnJvbSBhIGJhc2VsaW5lIHJ1bi5cIik7XG4gIGlmIChyLnN0YXR1cyA9PT0gXCJyZXF1ZXN0ZWRcIikgZmFpbChcIlRoZSBhdHRhY2sgaXMgc3RpbGwgYmVpbmcgY29tcHV0ZWQuIFdhaXQgZm9yIGl0IGJlZm9yZSBjcmVhdGluZyBhbiBhZ2dyZWdhdGUgZml4LlwiKTtcbiAgaWYgKHIuc3RhdHVzID09PSBcImVycm9yXCIpIGZhaWwoXCJUaGUgYXR0YWNrIHJ1biBmYWlsZWQsIHNvIHRoZXJlIGlzIG5vIGJhc2VsaW5lIGZvciB0aGUgYWdlbnRzLiBSZXNldCBpdCBvciBzdGFydCBhIG5ldyBhdHRhY2suXCIpO1xuICBpZiAoci5zdGF0dXMgPT09IFwicnVubmluZ1wiKSBmYWlsKFwiV2FpdCBmb3IgdGhlIHJ1biB0byBmaW5pc2gsIG9yIHBhdXNlIGl0LCBiZWZvcmUgY3JlYXRpbmcgYW4gYWdncmVnYXRlIGZpeC5cIik7XG4gIGlmIChidXN5UnVuKGN0eCwgc2Vzc2lvbl9pZCkpIGZhaWwoXCJXYWl0IGZvciBldmVyeSBydW4gaW4gdGhpcyBzZXNzaW9uIHRvIGZpbmlzaCwgb3IgcGF1c2UgaXQsIGJlZm9yZSBjcmVhdGluZyBhbiBhZ2dyZWdhdGUgZml4LlwiKTtcbiAgaWYgKHMucm91bmRfc3RhdGUgPT09IFwicnVubmluZ1wiIHx8IHMucm91bmRfc3RhdGUgPT09IFwid2FpdGluZ19mb3JfaHVtYW5cIikge1xuICAgIGZhaWwoXCJBbiBhZ2dyZWdhdGUgZml4IGlzIGFscmVhZHkgYmVpbmcgbmVnb3RpYXRlZCBmb3IgdGhpcyBzZXNzaW9uLlwiKTtcbiAgfVxuICBjdHguZGIuZGVmZW5kX3JlcXVlc3RfbG9nLmluc2VydCh7XG4gICAgaWQ6IDBuLCBzZXNzaW9uX2lkLCBydW5faWQ6IHIuaWQsIHBhdGllbnRfemVybzogci5wYXRpZW50X3plcm8sIHNlZWQ6IHIuc2VlZCwgY2hhbGxlbmdlc19qc29uOiByLmNoYWxsZW5nZXNfanNvbixcbiAgICByZXF1ZXN0ZWRfYnk6IGN0eC5zZW5kZXIsIHJlcXVlc3Rlcl9uYW1lOiBwLm5hbWUsIGNyZWF0ZWRfYXQ6IGN0eC50aW1lc3RhbXAsXG4gIH0pO1xufSk7XG5cbi8qKiBPbmUgcmVsYXllZCB1QWdlbnQgbWVzc2FnZSwgc2VudCBvciByZWNlaXZlZC4gc2VxIGlzIGFzc2lnbmVkIGhlcmUsIHBlciBzZXNzaW9uLiAqL1xuZXhwb3J0IGNvbnN0IGFnZW50X21lc3NhZ2VfYWRkID0gc3BhY2V0aW1lZGIucmVkdWNlcihcbiAge1xuICAgIHNlc3Npb25faWQ6IHQuc3RyaW5nKCksIHJvdW5kOiB0LnUzMigpLCBmcm9tX2FnZW50OiB0LnN0cmluZygpLCB0b19hZ2VudDogdC5zdHJpbmcoKSwgdHlwZTogdC5zdHJpbmcoKSxcbiAgICBwYXlsb2FkX2pzb246IHQuc3RyaW5nKCksIHJlYXNvbjogdC5zdHJpbmcoKSwgcmVhc29uX3NvdXJjZTogdC5zdHJpbmcoKSwgZGlyZWN0aW9uOiB0LnN0cmluZygpLCBmaXh0dXJlOiB0LmJvb2woKSxcbiAgfSxcbiAgKGN0eCwgYSkgPT4ge1xuICAgIHJlcXVpcmVTZXJ2ZXIoY3R4KTtcbiAgICBpZiAoIWEuc2Vzc2lvbl9pZCkgZmFpbChcInNlc3Npb25faWQgaXMgcmVxdWlyZWQuXCIpO1xuICAgIG9uZU9mKGEuZnJvbV9hZ2VudCwgU1BFQUtFUlMsIFwiZnJvbVwiKTtcbiAgICBvbmVPZihhLnRvX2FnZW50LCBTUEVBS0VSUywgXCJ0b1wiKTtcbiAgICBvbmVPZihhLnR5cGUsIE1FU1NBR0VfVFlQRVMsIFwidHlwZVwiKTtcbiAgICBvbmVPZihhLnJlYXNvbl9zb3VyY2UsIFRFWFRfU09VUkNFUywgXCJyZWFzb25fc291cmNlXCIpO1xuICAgIG9uZU9mKGEuZGlyZWN0aW9uLCBbXCJzZW50XCIsIFwicmVjZWl2ZWRcIl0gYXMgY29uc3QsIFwiZGlyZWN0aW9uXCIpO1xuICAgIGlmIChhLnBheWxvYWRfanNvbi5sZW5ndGggPiBQQVlMT0FEX01BWCkgZmFpbChcIlRoZSBwYXlsb2FkIGlzIHRvbyBsYXJnZS5cIik7XG4gICAgdHJ5IHtcbiAgICAgIEpTT04ucGFyc2UoYS5wYXlsb2FkX2pzb24pO1xuICAgIH0gY2F0Y2gge1xuICAgICAgZmFpbChcIlRoZSBwYXlsb2FkIGlzIG5vdCB2YWxpZCBKU09OLlwiKTtcbiAgICB9XG4gICAgbGV0IHNlcSA9IDA7XG4gICAgZm9yIChjb25zdCBtIG9mIGN0eC5kYi5hZ2VudF9tZXNzYWdlLnNlc3Npb25faWQuZmlsdGVyKGEuc2Vzc2lvbl9pZCkpIGlmIChtLnNlcSA+IHNlcSkgc2VxID0gbS5zZXE7XG4gICAgY3R4LmRiLmFnZW50X21lc3NhZ2UuaW5zZXJ0KHsgaWQ6IDBuLCAuLi5hLCBzZXE6IHNlcSArIDEsIGNyZWF0ZWRfYXQ6IGN0eC50aW1lc3RhbXAgfSk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgYWdlbnRfc3RhdHVzX3NldCA9IHNwYWNldGltZWRiLnJlZHVjZXIoXG4gIHsgc2Vzc2lvbl9pZDogdC5zdHJpbmcoKSwgYWdlbnQ6IHQuc3RyaW5nKCksIHN0YXR1czogdC5zdHJpbmcoKSB9LFxuICAoY3R4LCB7IHNlc3Npb25faWQsIGFnZW50LCBzdGF0dXMgfSkgPT4ge1xuICAgIHJlcXVpcmVTZXJ2ZXIoY3R4KTtcbiAgICBvbmVPZihhZ2VudCwgQUdFTlRfTkFNRVMsIFwiYWdlbnRcIik7XG4gICAgb25lT2Yoc3RhdHVzLCBBR0VOVF9TVEFUVVNFUywgXCJzdGF0dXNcIik7XG4gICAgY29uc3Qgcm93ID0geyBpZDogYCR7c2Vzc2lvbl9pZH06JHthZ2VudH1gLCBzZXNzaW9uX2lkLCBhZ2VudCwgc3RhdHVzLCB1cGRhdGVkX2F0OiBjdHgudGltZXN0YW1wIH07XG4gICAgaWYgKGN0eC5kYi5hZ2VudF9zdGF0dXMuaWQuZmluZChyb3cuaWQpKSBjdHguZGIuYWdlbnRfc3RhdHVzLmlkLnVwZGF0ZShyb3cpO1xuICAgIGVsc2UgY3R4LmRiLmFnZW50X3N0YXR1cy5pbnNlcnQocm93KTtcbiAgfSxcbik7XG5cbi8qKiBUaGUgQ29vcmRpbmF0b3IncyBSb3VuZFN0YXRlLCBvciB0aGUgd2F0Y2hlcidzIGVycm9yIGluIGBkZXRhaWxgIChydWxlIDE0OiBzaG93IGl0KS4gKi9cbmV4cG9ydCBjb25zdCByb3VuZF9zdGF0ZV9zZXQgPSBzcGFjZXRpbWVkYi5yZWR1Y2VyKFxuICB7IHNlc3Npb25faWQ6IHQuc3RyaW5nKCksIHJvdW5kOiB0LnUzMigpLCBzdGF0ZTogdC5zdHJpbmcoKSwgZGV0YWlsOiB0LnN0cmluZygpIH0sXG4gIChjdHgsIHsgc2Vzc2lvbl9pZCwgcm91bmQsIHN0YXRlLCBkZXRhaWwgfSkgPT4ge1xuICAgIHJlcXVpcmVTZXJ2ZXIoY3R4KTtcbiAgICBvbmVPZihzdGF0ZSwgUk9VTkRfU1RBVEVTLCBcInN0YXRlXCIpO1xuICAgIGNvbnN0IHMgPSBnZXRTZXNzaW9uKGN0eCwgc2Vzc2lvbl9pZCk7XG4gICAgY3R4LmRiLnNlc3Npb24uaWQudXBkYXRlKHsgLi4ucywgcm91bmRfc3RhdGU6IHN0YXRlLCByb3VuZCwgcm91bmRfZGV0YWlsOiBkZXRhaWwuc2xpY2UoMCwgNTAwKSB9KTtcbiAgfSxcbik7XG4iLCIvLyBRdWVzdGlvbnMgdG8gaHVtYW5zIChGMSkuIFRoZSBJbnZlbnRvcnkgQWdlbnQgZGVjaWRlcyBpbiBjb2RlIHdoZXRoZXIgdG8gYXNrO1xuLy8gdGhlIHdhdGNoZXIgd3JpdGVzIHRoZSBxdWVzdGlvbiBoZXJlLCBhbmQgb25seSBhIGh1bWFuIGluIGFuIGFsbG93ZWQgcm9sZVxuLy8gYW5zd2VycyBpdCAoQUdFTlRTLm1kIHJ1bGVzIDgsIDkpLiBUaGUgYW5zd2VyIHdhdGNoZXIgdGhlbiByZXN1bWVzIHRoZSByb3VuZC5cblxuaW1wb3J0IHsgdCB9IGZyb20gXCJzcGFjZXRpbWVkYi9zZXJ2ZXJcIjtcblxuaW1wb3J0IHsgQUdFTlRfTkFNRVMsIEFOTk9UQVRJTkdfUk9MRVMsIFRFWFRfU09VUkNFUyB9IGZyb20gXCIuL2NvbnN0YW50c1wiO1xuaW1wb3J0IHNwYWNldGltZWRiLCB7IGZhaWwsIGdldFNlc3Npb24sIGlzU2VydmVyLCByZXF1aXJlU2VydmVyIH0gZnJvbSBcIi4vc2NoZW1hXCI7XG5cbmZ1bmN0aW9uIHN0cmluZ0xpc3QoanNvbjogc3RyaW5nLCB3aGF0OiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIGxldCB2OiB1bmtub3duO1xuICB0cnkge1xuICAgIHYgPSBKU09OLnBhcnNlKGpzb24pO1xuICB9IGNhdGNoIHtcbiAgICBmYWlsKGAke3doYXR9IGlzIG5vdCB2YWxpZCBKU09OLmApO1xuICB9XG4gIGlmICghQXJyYXkuaXNBcnJheSh2KSB8fCAhdi5ldmVyeSgoeCkgPT4gdHlwZW9mIHggPT09IFwic3RyaW5nXCIgJiYgeC5sZW5ndGggPiAwKSkgZmFpbChgJHt3aGF0fSBtdXN0IGJlIGEgbGlzdCBvZiBzdHJpbmdzLmApO1xuICByZXR1cm4gdiBhcyBzdHJpbmdbXTtcbn1cblxuZXhwb3J0IGNvbnN0IHF1ZXN0aW9uX2FkZCA9IHNwYWNldGltZWRiLnJlZHVjZXIoXG4gIHtcbiAgICBzZXNzaW9uX2lkOiB0LnN0cmluZygpLCBxdWVzdGlvbl9pZDogdC5zdHJpbmcoKSwgcm91bmQ6IHQudTMyKCksIGFnZW50OiB0LnN0cmluZygpLCB0YXJnZXRfaWQ6IHQuc3RyaW5nKCksXG4gICAgdGV4dDogdC5zdHJpbmcoKSwgdGV4dF9zb3VyY2U6IHQuc3RyaW5nKCksIGNob2ljZXNfanNvbjogdC5zdHJpbmcoKSwgYWxsb3dlZF9yb2xlc19qc29uOiB0LnN0cmluZygpLFxuICB9LFxuICAoY3R4LCBhKSA9PiB7XG4gICAgcmVxdWlyZVNlcnZlcihjdHgpO1xuICAgIGdldFNlc3Npb24oY3R4LCBhLnNlc3Npb25faWQpO1xuICAgIGlmICghKEFHRU5UX05BTUVTIGFzIHJlYWRvbmx5IHN0cmluZ1tdKS5pbmNsdWRlcyhhLmFnZW50KSkgZmFpbChgVW5rbm93biBhZ2VudCBcIiR7YS5hZ2VudH1cIi5gKTtcbiAgICBpZiAoIShURVhUX1NPVVJDRVMgYXMgcmVhZG9ubHkgc3RyaW5nW10pLmluY2x1ZGVzKGEudGV4dF9zb3VyY2UpKSBmYWlsKFwidGV4dF9zb3VyY2UgbXVzdCBiZSBjbGF1ZGUgb3IgdGVtcGxhdGUuXCIpO1xuICAgIGlmICghYS5xdWVzdGlvbl9pZCB8fCAhYS50ZXh0KSBmYWlsKFwiQSBxdWVzdGlvbiBuZWVkcyBhbiBpZCBhbmQgdGV4dC5cIik7XG4gICAgaWYgKHN0cmluZ0xpc3QoYS5jaG9pY2VzX2pzb24sIFwiY2hvaWNlc1wiKS5sZW5ndGggPCAyKSBmYWlsKFwiQSBxdWVzdGlvbiBuZWVkcyBhdCBsZWFzdCB0d28gY2hvaWNlcy5cIik7XG4gICAgY29uc3Qgcm9sZXMgPSBzdHJpbmdMaXN0KGEuYWxsb3dlZF9yb2xlc19qc29uLCBcImFsbG93ZWRfcm9sZXNcIik7XG4gICAgaWYgKCFyb2xlcy5sZW5ndGggfHwgcm9sZXMuc29tZSgocikgPT4gIShBTk5PVEFUSU5HX1JPTEVTIGFzIHJlYWRvbmx5IHN0cmluZ1tdKS5pbmNsdWRlcyhyKSkpIHtcbiAgICAgIGZhaWwoXCJBbGxvd2VkIHJvbGVzIGFyZSBzZWN1cml0eSwgY2xpbmljYWxfZW5naW5lZXJpbmcgb3Igb3BlcmF0aW9ucy5cIik7XG4gICAgfVxuICAgIGNvbnN0IGlkID0gYCR7YS5zZXNzaW9uX2lkfToke2EucXVlc3Rpb25faWR9YDtcbiAgICBpZiAoY3R4LmRiLnF1ZXN0aW9uLmlkLmZpbmQoaWQpKSBmYWlsKGBRdWVzdGlvbiBcIiR7YS5xdWVzdGlvbl9pZH1cIiBhbHJlYWR5IGV4aXN0cy5gKTtcbiAgICBjdHguZGIucXVlc3Rpb24uaW5zZXJ0KHtcbiAgICAgIGlkLCAuLi5hLCBhbnN3ZXJlZDogZmFsc2UsIGFuc3dlcl9jaG9pY2U6IFwiXCIsIGFuc3dlcl9hdXRob3I6IFwiXCIsIGFuc3dlcl9yb2xlOiBcIlwiLCBjcmVhdGVkX2F0OiBjdHgudGltZXN0YW1wLFxuICAgIH0pO1xuICB9LFxuKTtcblxuLyoqIEEgaHVtYW4gYW5zd2Vycy4gVGhlaXIgbmFtZSBhbmQgcm9sZSBjb21lIGZyb20gdGhlaXIgcHJlc2VuY2Ugcm93LCBuZXZlciBmcm9tIHRoZSBjYWxsZXIuICovXG5leHBvcnQgY29uc3QgcXVlc3Rpb25fYW5zd2VyID0gc3BhY2V0aW1lZGIucmVkdWNlcihcbiAgeyBzZXNzaW9uX2lkOiB0LnN0cmluZygpLCBxdWVzdGlvbl9pZDogdC5zdHJpbmcoKSwgY2hvaWNlOiB0LnN0cmluZygpIH0sXG4gIChjdHgsIHsgc2Vzc2lvbl9pZCwgcXVlc3Rpb25faWQsIGNob2ljZSB9KSA9PiB7XG4gICAgaWYgKGlzU2VydmVyKGN0eCkpIGZhaWwoXCJPbmx5IGh1bWFucyBhbnN3ZXIgcXVlc3Rpb25zLlwiKTtcbiAgICBjb25zdCBxID0gY3R4LmRiLnF1ZXN0aW9uLmlkLmZpbmQoYCR7c2Vzc2lvbl9pZH06JHtxdWVzdGlvbl9pZH1gKSA/PyBmYWlsKFwiVGhhdCBxdWVzdGlvbiBkb2VzIG5vdCBleGlzdC5cIik7XG4gICAgaWYgKHEuYW5zd2VyZWQpIGZhaWwoXCJUaGlzIHF1ZXN0aW9uIGhhcyBhbHJlYWR5IGJlZW4gYW5zd2VyZWQuXCIpO1xuICAgIGNvbnN0IHAgPSBjdHguZGIucHJlc2VuY2UuaWRlbnRpdHkuZmluZChjdHguc2VuZGVyKTtcbiAgICBpZiAoIXAgfHwgcC5zZXNzaW9uX2lkICE9PSBzZXNzaW9uX2lkKSBmYWlsKFwiSm9pbiB0aGUgc2Vzc2lvbiBiZWZvcmUgYW5zd2VyaW5nLlwiKTtcbiAgICBjb25zdCByb2xlcyA9IEpTT04ucGFyc2UocS5hbGxvd2VkX3JvbGVzX2pzb24pIGFzIHN0cmluZ1tdO1xuICAgIGlmICghcm9sZXMuaW5jbHVkZXMocC5yb2xlKSkgZmFpbChgT25seSAke3JvbGVzLmpvaW4oXCIgb3IgXCIpfSBjYW4gYW5zd2VyIHRoaXMgcXVlc3Rpb24uYCk7XG4gICAgaWYgKCEoSlNPTi5wYXJzZShxLmNob2ljZXNfanNvbikgYXMgc3RyaW5nW10pLmluY2x1ZGVzKGNob2ljZSkpIGZhaWwoYFwiJHtjaG9pY2V9XCIgaXMgbm90IG9uZSBvZiB0aGUgY2hvaWNlcy5gKTtcbiAgICBjdHguZGIucXVlc3Rpb24uaWQudXBkYXRlKHsgLi4ucSwgYW5zd2VyZWQ6IHRydWUsIGFuc3dlcl9jaG9pY2U6IGNob2ljZSwgYW5zd2VyX2F1dGhvcjogcC5uYW1lLCBhbnN3ZXJfcm9sZTogcC5yb2xlIH0pO1xuICB9LFxuKTtcbiIsIi8vIFJlY29tbWVuZGF0aW9ucyAoRjIpLiBUaGUgQ29vcmRpbmF0b3IgcHVibGlzaGVzIG9uZSBwZXIgZmluaXNoZWQgcm91bmQ7IHRoZVxuLy8gd2F0Y2hlciB1cHNlcnRzIGl0IGhlcmUuIGBzdGF0dXNgIHN0YXJ0cyBhcyBkcmFmdCBhbmQgaXMgY2hhbmdlZCBvbmx5IGJ5XG4vLyByZXZpZXdfc3VibWl0IChBR0VOVFMubWQgcnVsZSA5KTogYW4gdXBkYXRlIG5ldmVyIHRvdWNoZXMgaXQuXG5cbmltcG9ydCB7IHQgfSBmcm9tIFwic3BhY2V0aW1lZGIvc2VydmVyXCI7XG5cbmltcG9ydCBzcGFjZXRpbWVkYiwgeyBmYWlsLCBnZXRTZXNzaW9uLCByZXF1aXJlU2VydmVyIH0gZnJvbSBcIi4vc2NoZW1hXCI7XG5cbnR5cGUgUHVibGlzaGVkID0ge1xuICBwb2xpY3k6IHsgbmFtZTogc3RyaW5nIH07XG4gIHRlc3RSZXN1bHQ6IHVua25vd247XG4gIHZlcmRpY3RzOiB1bmtub3duW107XG4gIGV4cGxhbmF0aW9uOiBzdHJpbmc7XG4gIGV4cGxhbmF0aW9uU291cmNlPzogc3RyaW5nIHwgbnVsbDtcbiAgcmVxdWlyZWRSb2xlczogc3RyaW5nW107XG59O1xuXG4vKiogYHJlY29tbWVuZGF0aW9uX2pzb25gIGlzIGFnZW50cy9wcm90b2NvbC5weSdzIFJlY29tbWVuZGF0aW9uLCBhcyBKU09OLiAqL1xuZXhwb3J0IGNvbnN0IHJlY29tbWVuZGF0aW9uX3Vwc2VydCA9IHNwYWNldGltZWRiLnJlZHVjZXIoXG4gIHsgc2Vzc2lvbl9pZDogdC5zdHJpbmcoKSwgcm91bmQ6IHQudTMyKCksIHJlY29tbWVuZGF0aW9uX2pzb246IHQuc3RyaW5nKCksIGZpeHR1cmU6IHQuYm9vbCgpIH0sXG4gIChjdHgsIHsgc2Vzc2lvbl9pZCwgcm91bmQsIHJlY29tbWVuZGF0aW9uX2pzb24sIGZpeHR1cmUgfSkgPT4ge1xuICAgIHJlcXVpcmVTZXJ2ZXIoY3R4KTtcbiAgICBnZXRTZXNzaW9uKGN0eCwgc2Vzc2lvbl9pZCk7XG4gICAgbGV0IHJlYzogUHVibGlzaGVkO1xuICAgIHRyeSB7XG4gICAgICByZWMgPSBKU09OLnBhcnNlKHJlY29tbWVuZGF0aW9uX2pzb24pIGFzIFB1Ymxpc2hlZDtcbiAgICB9IGNhdGNoIHtcbiAgICAgIGZhaWwoXCJUaGUgcmVjb21tZW5kYXRpb24gaXMgbm90IHZhbGlkIEpTT04uXCIpO1xuICAgIH1cbiAgICBpZiAoIXJlYz8ucG9saWN5Py5uYW1lIHx8ICFBcnJheS5pc0FycmF5KHJlYy52ZXJkaWN0cykgfHwgIUFycmF5LmlzQXJyYXkocmVjLnJlcXVpcmVkUm9sZXMpIHx8ICFyZWMucmVxdWlyZWRSb2xlcy5sZW5ndGgpIHtcbiAgICAgIGZhaWwoXCJBIHJlY29tbWVuZGF0aW9uIG5lZWRzIGEgcG9saWN5LCB2ZXJkaWN0cyBhbmQgcmVxdWlyZWQgcm9sZXMuXCIpO1xuICAgIH1cbiAgICBjb25zdCBpZCA9IGAke3Nlc3Npb25faWR9OiR7cm91bmR9YDtcbiAgICBjb25zdCBvbGQgPSBjdHguZGIucmVjb21tZW5kYXRpb24uaWQuZmluZChpZCk7XG4gICAgY29uc3Qgcm93ID0ge1xuICAgICAgaWQsIHNlc3Npb25faWQsIHJvdW5kLCBuYW1lOiByZWMucG9saWN5Lm5hbWUsIHBvbGljeV9qc29uOiBKU09OLnN0cmluZ2lmeShyZWMucG9saWN5KSxcbiAgICAgIGV4cGxhbmF0aW9uOiByZWMuZXhwbGFuYXRpb24gPz8gXCJcIiwgZXhwbGFuYXRpb25fc291cmNlOiByZWMuZXhwbGFuYXRpb25Tb3VyY2UgPz8gXCJcIixcbiAgICAgIHZlcmlmaWVkX2pzb246IEpTT04uc3RyaW5naWZ5KHJlYy50ZXN0UmVzdWx0KSwgdmVyZGljdHNfanNvbjogSlNPTi5zdHJpbmdpZnkocmVjLnZlcmRpY3RzKSxcbiAgICAgIHJlcXVpcmVkX3JvbGVzX2pzb246IEpTT04uc3RyaW5naWZ5KHJlYy5yZXF1aXJlZFJvbGVzKSwgZml4dHVyZSxcbiAgICAgIHN0YXR1czogb2xkID8gb2xkLnN0YXR1cyA6IFwiZHJhZnRcIiwgdXBkYXRlZF9hdDogY3R4LnRpbWVzdGFtcCxcbiAgICB9O1xuICAgIGlmIChvbGQpIGN0eC5kYi5yZWNvbW1lbmRhdGlvbi5pZC51cGRhdGUocm93KTtcbiAgICBlbHNlIGN0eC5kYi5yZWNvbW1lbmRhdGlvbi5pbnNlcnQocm93KTtcbiAgfSxcbik7XG4iLCIvLyBIaXBwb2NyYS50ZWNoIFNwYWNldGltZURCIG1vZHVsZSAoVHlwZVNjcmlwdCkuXG4vL1xuLy8gVGhlIGxpdmUgc3RhdGUgYnVzLCBub3QgdGhlIGNvbXB1dGUuIFRoZSBQeXRob24gZW5naW5lIChlbmdpbmUvc2ltX2NvcmUpXG4vLyBjb21wdXRlcyBldmVyeSB2aXNpYmxlIHJ1bjsgdGhlIHJ1biB3YXRjaGVyIGZlZWRzIGl0cyBmcmFtZXMgaW4gdGhyb3VnaCB0aGVcbi8vIHNlcnZlci1vbmx5IHJ1bl9mcmFtZXNfYXBwbHkgKGluZ2VzdC50cyksIHBhY2VkIGF0IHRoZSBydW4ncyBzcGVlZCwgYW5kIGV2ZXJ5XG4vLyBsYXB0b3Agc3Vic2NyaWJlcyB0byB0aGUgcm93cyAoQUdFTlRTLm1kIHJ1bGVzIDMsIDQpLiBUaGUgcGxheWJhY2sgcmVkdWNlcnNcbi8vIGhlcmUgb25seSBjaGFuZ2UgZmxhZ3MgdGhlIHdhdGNoZXIgb2JleXMuIFJlZHVjZXJzIG1ha2Ugbm8gbmV0d29yayBjYWxscyAocnVsZSA3KS5cbi8vXG4vLyBBbGwgZGF0YSBpcyBzeW50aGV0aWMuIFBhdGllbnQgZ3JvdXBzIGFyZSBjb3VudHMuXG5cbmltcG9ydCB7IHQgfSBmcm9tIFwic3BhY2V0aW1lZGIvc2VydmVyXCI7XG5cbmltcG9ydCB7IEFOTk9UQVRJTkdfUk9MRVMsIE5PVEVfTUFYLCBST0xFUywgU1BFRURTIH0gZnJvbSBcIi4vY29uc3RhbnRzXCI7XG5pbXBvcnQgeyBob3NwaXRhbE9mLCB2YWxpZGF0ZUhvc3BpdGFsIH0gZnJvbSBcIi4vaG9zcGl0YWxcIjtcbmltcG9ydCBzcGFjZXRpbWVkYiwge1xuICBCRUZPUkVfRlJBTUVfMCwgZGVsZXRlUnVuUm93cywgZmFpbCwgZ2V0U2Vzc2lvbiwgaXNTZXJ2ZXIsIHJlYWRSdW4sIHJlcXVpcmVQcmVzZW50ZXIsIHJlcXVpcmVTZXJ2ZXIsIHJ1bnNGb3JLZXksIHNhbWUsXG4gIHN0YXR1c1JlZnVzYWwsIHR5cGUgUnVuUm93LFxufSBmcm9tIFwiLi9zY2hlbWFcIjtcblxuLy8gVGFibGVzIGxpdmUgaW4gc2NoZW1hLnRzOyBmZWF0dXJlIHJlZHVjZXJzIGluIHRoZWlyIG93biBmaWxlcywgcmUtZXhwb3J0ZWQgaGVyZS5cbmV4cG9ydCBkZWZhdWx0IHNwYWNldGltZWRiO1xuZXhwb3J0ICogZnJvbSBcIi4vaW5nZXN0XCI7XG5leHBvcnQgKiBmcm9tIFwiLi9zb2x1dGlvblwiO1xuZXhwb3J0ICogZnJvbSBcIi4vYWdlbnRzXCI7XG5leHBvcnQgKiBmcm9tIFwiLi9xdWVzdGlvblwiO1xuZXhwb3J0ICogZnJvbSBcIi4vcmVjb21tZW5kYXRpb25cIjtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSBsaWZlY3ljbGVcblxuLyoqIFRoZSBpZGVudGl0eSB0aGF0IHB1Ymxpc2hlcyB0aGUgbW9kdWxlIGJlY29tZXMgdGhlIHNlcnZlciBpZGVudGl0eSAod2F0Y2hlcnMsIE5vZGUgc2VydmVyKS4gKi9cbmV4cG9ydCBjb25zdCBpbml0ID0gc3BhY2V0aW1lZGIuaW5pdCgoY3R4KSA9PiB7XG4gIGN0eC5kYi5jb25maWcuaW5zZXJ0KHsgaWQ6IDAsIHNlcnZlcl9pZGVudGl0eTogY3R4LnNlbmRlciB9KTtcbn0pO1xuXG4vKiogSGFuZCB0aGUgc2VydmVyIGlkZW50aXR5IHRvIGFub3RoZXIgdG9rZW4uIE9ubHkgdGhlIGN1cnJlbnQgc2VydmVyIGlkZW50aXR5IGNhbi4gKi9cbmV4cG9ydCBjb25zdCBjb25maWdfc2V0X3NlcnZlciA9IHNwYWNldGltZWRiLnJlZHVjZXIoeyBpZGVudGl0eTogdC5pZGVudGl0eSgpIH0sIChjdHgsIHsgaWRlbnRpdHkgfSkgPT4ge1xuICBpZiAoIWlzU2VydmVyKGN0eCkpIGZhaWwoXCJPbmx5IHRoZSBzZXJ2ZXIgaWRlbnRpdHkgY2FuIGNoYW5nZSB0aGUgc2VydmVyIGlkZW50aXR5LlwiKTtcbiAgY3R4LmRiLmNvbmZpZy5pZC51cGRhdGUoeyBpZDogMCwgc2VydmVyX2lkZW50aXR5OiBpZGVudGl0eSB9KTtcbn0pO1xuXG5leHBvcnQgY29uc3Qgb25fZGlzY29ubmVjdCA9IHNwYWNldGltZWRiLmNsaWVudERpc2Nvbm5lY3RlZCgoY3R4KSA9PiB7XG4gIGNvbnN0IHAgPSBjdHguZGIucHJlc2VuY2UuaWRlbnRpdHkuZmluZChjdHguc2VuZGVyKTtcbiAgaWYgKHApIGN0eC5kYi5wcmVzZW5jZS5pZGVudGl0eS5kZWxldGUoY3R4LnNlbmRlcik7XG59KTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSBzZXNzaW9ucyBhbmQgcHJlc2VuY2VcblxuZXhwb3J0IGNvbnN0IHNlc3Npb25fY3JlYXRlID0gc3BhY2V0aW1lZGIucmVkdWNlcihcbiAgeyBzZXNzaW9uX2lkOiB0LnN0cmluZygpLCBob3NwaXRhbF9qc29uOiB0LnN0cmluZygpIH0sXG4gIChjdHgsIHsgc2Vzc2lvbl9pZCwgaG9zcGl0YWxfanNvbiB9KSA9PiB7XG4gICAgaWYgKCEvXlthLXowLTlfLV17Miw0MH0kLy50ZXN0KHNlc3Npb25faWQpKSBmYWlsKFwiU2Vzc2lvbiBpZHMgYXJlIDItNDAgY2hhcmFjdGVyczogYS16LCAwLTksIF8gb3IgLS5cIik7XG4gICAgaWYgKGN0eC5kYi5zZXNzaW9uLmlkLmZpbmQoc2Vzc2lvbl9pZCkpIGZhaWwoYFNlc3Npb24gXCIke3Nlc3Npb25faWR9XCIgYWxyZWFkeSBleGlzdHMuYCk7XG4gICAgY29uc3QgZmlsZSA9IHZhbGlkYXRlSG9zcGl0YWwoaG9zcGl0YWxfanNvbik7XG4gICAgY3R4LmRiLnNlc3Npb24uaW5zZXJ0KHtcbiAgICAgIGlkOiBzZXNzaW9uX2lkLCBob3NwaXRhbF9qc29uLCBob3NwaXRhbF9uYW1lOiBmaWxlLmhvc3BpdGFsLm5hbWUsXG4gICAgICBwcmVzZW50ZXI6IGN0eC5zZW5kZXIsIGFjdGl2ZV9ydW5faWQ6IFwiXCIsIGNyZWF0ZWRfYXQ6IGN0eC50aW1lc3RhbXAsXG4gICAgICByb3VuZF9zdGF0ZTogXCJpZGxlXCIsIHJvdW5kOiAwLCByb3VuZF9kZXRhaWw6IFwiXCIsIGVudHJ5X3BvaW50c19qc29uOiBcIltdXCIsIHNvbHV0aW9uX3BhaXJfaWQ6IFwiXCIsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG4vKiogVGhlIGVuZ2luZSdzIGxlZ2FsIHBhdGllbnQgemVyb3MgZm9yIHRoaXMgaG9zcGl0YWwsIHdyaXR0ZW4gYnkgdGhlIHdhdGNoZXIuIFRoZSBVSSBkaW1zIHRoZSByZXN0LiAqL1xuZXhwb3J0IGNvbnN0IHNlc3Npb25fZW50cnlfcG9pbnRzX3NldCA9IHNwYWNldGltZWRiLnJlZHVjZXIoXG4gIHsgc2Vzc2lvbl9pZDogdC5zdHJpbmcoKSwgZW50cnlfcG9pbnRzX2pzb246IHQuc3RyaW5nKCkgfSxcbiAgKGN0eCwgeyBzZXNzaW9uX2lkLCBlbnRyeV9wb2ludHNfanNvbiB9KSA9PiB7XG4gICAgcmVxdWlyZVNlcnZlcihjdHgpO1xuICAgIGNvbnN0IHMgPSBnZXRTZXNzaW9uKGN0eCwgc2Vzc2lvbl9pZCk7XG4gICAgbGV0IGlkczogdW5rbm93bjtcbiAgICB0cnkge1xuICAgICAgaWRzID0gSlNPTi5wYXJzZShlbnRyeV9wb2ludHNfanNvbik7XG4gICAgfSBjYXRjaCB7XG4gICAgICBmYWlsKFwiZW50cnlfcG9pbnRzX2pzb24gaXMgbm90IHZhbGlkIEpTT04uXCIpO1xuICAgIH1cbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoaWRzKSB8fCAhaWRzLmV2ZXJ5KCh4KSA9PiB0eXBlb2YgeCA9PT0gXCJzdHJpbmdcIikpIGZhaWwoXCJlbnRyeV9wb2ludHNfanNvbiBtdXN0IGJlIGEgbGlzdCBvZiBkZXZpY2UgaWRzLlwiKTtcbiAgICBpZiAobmV3IFNldChpZHMpLnNpemUgIT09IGlkcy5sZW5ndGgpIGZhaWwoXCJlbnRyeV9wb2ludHNfanNvbiBsaXN0cyBhIGRldmljZSB0d2ljZS5cIik7XG4gICAgY29uc3QgZGV2aWNlcyA9IG5ldyBTZXQoaG9zcGl0YWxPZihjdHgsIHNlc3Npb25faWQpLmRldmljZXMubWFwKChkKSA9PiBkLmlkKSk7XG4gICAgZm9yIChjb25zdCBpZCBvZiBpZHMgYXMgc3RyaW5nW10pIGlmICghZGV2aWNlcy5oYXMoaWQpKSBmYWlsKGBEZXZpY2UgXCIke2lkfVwiIGRvZXMgbm90IGV4aXN0LmApO1xuICAgIGN0eC5kYi5zZXNzaW9uLmlkLnVwZGF0ZSh7IC4uLnMsIGVudHJ5X3BvaW50c19qc29uOiBKU09OLnN0cmluZ2lmeShpZHMpIH0pO1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IHByZXNlbmNlX2pvaW4gPSBzcGFjZXRpbWVkYi5yZWR1Y2VyKFxuICB7IHNlc3Npb25faWQ6IHQuc3RyaW5nKCksIG5hbWU6IHQuc3RyaW5nKCksIHJvbGU6IHQuc3RyaW5nKCkgfSxcbiAgKGN0eCwgeyBzZXNzaW9uX2lkLCBuYW1lLCByb2xlIH0pID0+IHtcbiAgICBnZXRTZXNzaW9uKGN0eCwgc2Vzc2lvbl9pZCk7XG4gICAgaWYgKCEoUk9MRVMgYXMgcmVhZG9ubHkgc3RyaW5nW10pLmluY2x1ZGVzKHJvbGUpKSBmYWlsKGBSb2xlIG11c3QgYmUgb25lIG9mOiAke1JPTEVTLmpvaW4oXCIsIFwiKX0uYCk7XG4gICAgY29uc3QgY2xlYW4gPSBuYW1lLnRyaW0oKS5zbGljZSgwLCA0MCk7XG4gICAgaWYgKCFjbGVhbikgZmFpbChcIkVudGVyIGEgbmFtZS5cIik7XG4gICAgY29uc3Qgcm93ID0geyBpZGVudGl0eTogY3R4LnNlbmRlciwgc2Vzc2lvbl9pZCwgbmFtZTogY2xlYW4sIHJvbGUsIGZvbGxvd2luZzogdHJ1ZSwgbGFzdF9zZWVuOiBjdHgudGltZXN0YW1wIH07XG4gICAgaWYgKGN0eC5kYi5wcmVzZW5jZS5pZGVudGl0eS5maW5kKGN0eC5zZW5kZXIpKSBjdHguZGIucHJlc2VuY2UuaWRlbnRpdHkudXBkYXRlKHJvdyk7XG4gICAgZWxzZSBjdHguZGIucHJlc2VuY2UuaW5zZXJ0KHJvdyk7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3QgcHJlc2VuY2VfaGVhcnRiZWF0ID0gc3BhY2V0aW1lZGIucmVkdWNlcih7IGZvbGxvd2luZzogdC5ib29sKCkgfSwgKGN0eCwgeyBmb2xsb3dpbmcgfSkgPT4ge1xuICBjb25zdCBwID0gY3R4LmRiLnByZXNlbmNlLmlkZW50aXR5LmZpbmQoY3R4LnNlbmRlcikgPz8gZmFpbChcIkpvaW4gdGhlIHNlc3Npb24gZmlyc3QuXCIpO1xuICBjdHguZGIucHJlc2VuY2UuaWRlbnRpdHkudXBkYXRlKHsgLi4ucCwgZm9sbG93aW5nLCBsYXN0X3NlZW46IGN0eC50aW1lc3RhbXAgfSk7XG59KTtcblxuZXhwb3J0IGNvbnN0IHNldF9wcmVzZW50ZXIgPSBzcGFjZXRpbWVkYi5yZWR1Y2VyKFxuICB7IHNlc3Npb25faWQ6IHQuc3RyaW5nKCksIHByZXNlbnRlcjogdC5pZGVudGl0eSgpIH0sXG4gIChjdHgsIHsgc2Vzc2lvbl9pZCwgcHJlc2VudGVyIH0pID0+IHtcbiAgICByZXF1aXJlUHJlc2VudGVyKGN0eCwgc2Vzc2lvbl9pZCk7XG4gICAgY29uc3QgcyA9IGdldFNlc3Npb24oY3R4LCBzZXNzaW9uX2lkKTtcbiAgICBjdHguZGIuc2Vzc2lvbi5pZC51cGRhdGUoeyAuLi5zLCBwcmVzZW50ZXIgfSk7XG4gIH0sXG4pO1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIHJ1bnNcbi8vIFN0YXR1cyBtYWNoaW5lIChJTlRFR1JBVElPTi5tZCA1Yik6IHJ1bl9zdGFydCwgc29sdXRpb25fc3RhcnQgYW5kIHJ1bl9yZXNldFxuLy8gbGVhdmUgYSBydW4gYHJlcXVlc3RlZGA7IHRoZSB3YXRjaGVyJ3MgZnJhbWUgMCBtYWtlcyBpdCBydW5uaW5nIG9yIHBhdXNlZCAoYnlcbi8vIGF1dG9wbGF5KTsgcnVuX2ZhaWwgbWFrZXMgaXQgYGVycm9yYDsgdGhlIGZpbmFsIGZyYW1lIG1ha2VzIGl0IGBkb25lYC5cblxuLyoqIEEgbmV3IHJ1biwgd2FpdGluZyBmb3IgdGhlIGVuZ2luZS4gV3JpdGVzIG5vIHN0YXRlIHJvd3M6IGZyYW1lIDAgZG9lcy4gKi9cbmV4cG9ydCBjb25zdCBydW5fc3RhcnQgPSBzcGFjZXRpbWVkYi5yZWR1Y2VyKFxuICB7XG4gICAgc2Vzc2lvbl9pZDogdC5zdHJpbmcoKSwgcnVuX2lkOiB0LnN0cmluZygpLCBsYWJlbDogdC5zdHJpbmcoKSwgcGF0aWVudF96ZXJvOiB0LnN0cmluZygpLFxuICAgIHNlZWQ6IHQudTMyKCksIHNwZWVkOiB0LmY2NCgpLCBwb2xpY3lfanNvbjogdC5zdHJpbmcoKSwgcGFpcl9pZDogdC5zdHJpbmcoKSwgYXV0b3BsYXk6IHQuYm9vbCgpLFxuICB9LFxuICAoY3R4LCBhKSA9PiB7XG4gICAgcmVxdWlyZVByZXNlbnRlcihjdHgsIGEuc2Vzc2lvbl9pZCk7XG4gICAgaWYgKGN0eC5kYi5ydW4uaWQuZmluZChhLnJ1bl9pZCkpIGZhaWwoYFJ1biBcIiR7YS5ydW5faWR9XCIgYWxyZWFkeSBleGlzdHMuYCk7XG4gICAgaWYgKCEoU1BFRURTIGFzIHJlYWRvbmx5IG51bWJlcltdKS5pbmNsdWRlcyhhLnNwZWVkKSkgZmFpbChcIlNwZWVkIG11c3QgYmUgMC41LCAxLCAyIG9yIDQuXCIpO1xuICAgIGNvbnN0IHMgPSBnZXRTZXNzaW9uKGN0eCwgYS5zZXNzaW9uX2lkKTtcbiAgICBjb25zdCBoID0gaG9zcGl0YWxPZihjdHgsIGEuc2Vzc2lvbl9pZCk7XG4gICAgaWYgKCFoLmRldmljZXMuc29tZSgoZCkgPT4gZC5pZCA9PT0gYS5wYXRpZW50X3plcm8pKSBmYWlsKGBEZXZpY2UgXCIke2EucGF0aWVudF96ZXJvfVwiIGRvZXMgbm90IGV4aXN0LmApO1xuICAgIGNvbnN0IGVudHJ5UG9pbnRzID0gSlNPTi5wYXJzZShzLmVudHJ5X3BvaW50c19qc29uKSBhcyBzdHJpbmdbXTtcbiAgICBpZiAoZW50cnlQb2ludHMubGVuZ3RoICYmICFlbnRyeVBvaW50cy5pbmNsdWRlcyhhLnBhdGllbnRfemVybykpIHtcbiAgICAgIGZhaWwoYFRoZSBlbmdpbmUgY2FuJ3Qgc3RhcnQgYW4gYXR0YWNrIG9uIFwiJHthLnBhdGllbnRfemVyb31cIjogcGF0aWVudCB6ZXJvIG11c3QgYmUgYSBXaW5kb3dzIGRldmljZSB0aGF0IHJ1bnMgc29mdHdhcmUgYW5kIGlzIG5vdCBhIG1lZGljYWwgZGV2aWNlLiBQaWNrIGEgaGlnaGxpZ2h0ZWQgZGV2aWNlLmApO1xuICAgIH1cbiAgICBpZiAoYS5wb2xpY3lfanNvbikge1xuICAgICAgdHJ5IHtcbiAgICAgICAgSlNPTi5wYXJzZShhLnBvbGljeV9qc29uKTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICBmYWlsKFwiVGhlIHBvbGljeSBpcyBub3QgdmFsaWQgSlNPTi5cIik7XG4gICAgICB9XG4gICAgfVxuICAgIGN0eC5kYi5ydW4uaW5zZXJ0KHtcbiAgICAgIC4uLkJFRk9SRV9GUkFNRV8wLFxuICAgICAgaWQ6IGEucnVuX2lkLCBzZXNzaW9uX2lkOiBhLnNlc3Npb25faWQsIHBhaXJfaWQ6IGEucGFpcl9pZCwgbGFiZWw6IGEubGFiZWwgfHwgXCJSdW5cIiwgc2VlZDogYS5zZWVkLFxuICAgICAgcGF0aWVudF96ZXJvOiBhLnBhdGllbnRfemVybywgcG9saWN5X2pzb246IGEucG9saWN5X2pzb24sIHNwZWVkOiBhLnNwZWVkLCBhdXRvcGxheTogYS5hdXRvcGxheSxcbiAgICAgIGNoYWxsZW5nZXNfanNvbjogXCJbXVwiLCByZWNvbW1lbmRhdGlvbl9pZDogXCJcIiwgc3RhcnRlZF9hdDogY3R4LnRpbWVzdGFtcCxcbiAgICB9KTtcbiAgICBpZiAoIWEucGFpcl9pZCkgY3R4LmRiLnNlc3Npb24uaWQudXBkYXRlKHsgLi4uZ2V0U2Vzc2lvbihjdHgsIGEuc2Vzc2lvbl9pZCksIGFjdGl2ZV9ydW5faWQ6IGEucnVuX2lkIH0pO1xuICB9LFxuKTtcblxuLyoqIFBhdXNlIG9yIHJlc3VtZSBldmVyeSBydW4gdW5kZXIgdGhlIGtleSB0aGF0IGlzIGluIGBmcm9tYC4gT3RoZXJzIGtlZXAgdGhlaXIgc3RhdHVzLiAqL1xuZnVuY3Rpb24gc2V0U3RhdHVzKGN0eDogYW55LCByOiBSdW5Sb3csIGZyb206IHN0cmluZywgdG86IHN0cmluZyk6IHZvaWQge1xuICBmb3IgKGNvbnN0IHggb2YgcnVuc0ZvcktleShjdHgsIHIpKSBpZiAoeC5zdGF0dXMgPT09IGZyb20pIGN0eC5kYi5ydW4uaWQudXBkYXRlKHsgLi4ueCwgc3RhdHVzOiB0byB9KTtcbn1cblxuZXhwb3J0IGNvbnN0IHJ1bl9wYXVzZSA9IHNwYWNldGltZWRiLnJlZHVjZXIoeyBydW5faWQ6IHQuc3RyaW5nKCkgfSwgKGN0eCwgeyBydW5faWQgfSkgPT4ge1xuICBjb25zdCByID0gcmVhZFJ1bihjdHgsIHJ1bl9pZCk7XG4gIHJlcXVpcmVQcmVzZW50ZXIoY3R4LCByLnNlc3Npb25faWQpO1xuICBzZXRTdGF0dXMoY3R4LCByLCBcInJ1bm5pbmdcIiwgXCJwYXVzZWRcIik7XG59KTtcblxuZXhwb3J0IGNvbnN0IHJ1bl9yZXN1bWUgPSBzcGFjZXRpbWVkYi5yZWR1Y2VyKHsgcnVuX2lkOiB0LnN0cmluZygpIH0sIChjdHgsIHsgcnVuX2lkIH0pID0+IHtcbiAgY29uc3QgciA9IHJlYWRSdW4oY3R4LCBydW5faWQpO1xuICByZXF1aXJlUHJlc2VudGVyKGN0eCwgci5zZXNzaW9uX2lkKTtcbiAgY29uc3QgcmVmdXNhbCA9IHN0YXR1c1JlZnVzYWwoci5zdGF0dXMpO1xuICBpZiAocmVmdXNhbCkgZmFpbChyZWZ1c2FsKTtcbiAgc2V0U3RhdHVzKGN0eCwgciwgXCJwYXVzZWRcIiwgXCJydW5uaW5nXCIpO1xufSk7XG5cbmV4cG9ydCBjb25zdCBydW5fc2V0X3NwZWVkID0gc3BhY2V0aW1lZGIucmVkdWNlcih7IHJ1bl9pZDogdC5zdHJpbmcoKSwgc3BlZWQ6IHQuZjY0KCkgfSwgKGN0eCwgeyBydW5faWQsIHNwZWVkIH0pID0+IHtcbiAgY29uc3QgciA9IHJlYWRSdW4oY3R4LCBydW5faWQpO1xuICByZXF1aXJlUHJlc2VudGVyKGN0eCwgci5zZXNzaW9uX2lkKTtcbiAgaWYgKCEoU1BFRURTIGFzIHJlYWRvbmx5IG51bWJlcltdKS5pbmNsdWRlcyhzcGVlZCkpIGZhaWwoXCJTcGVlZCBtdXN0IGJlIDAuNSwgMSwgMiBvciA0LlwiKTtcbiAgZm9yIChjb25zdCB4IG9mIHJ1bnNGb3JLZXkoY3R4LCByKSkgY3R4LmRiLnJ1bi5pZC51cGRhdGUoeyAuLi54LCBzcGVlZCB9KTtcbn0pO1xuXG4vKiogT25lIHN0ZXAgd2hpbGUgcGF1c2VkOiB0aGUgd2F0Y2hlciBzZWVzIHN0ZXBfcGVuZGluZyBhbmQgYXBwbGllcyB0aGUgbmV4dCBmcmFtZS4gKi9cbmV4cG9ydCBjb25zdCBydW5fc3RlcCA9IHNwYWNldGltZWRiLnJlZHVjZXIoeyBydW5faWQ6IHQuc3RyaW5nKCkgfSwgKGN0eCwgeyBydW5faWQgfSkgPT4ge1xuICBjb25zdCByID0gcmVhZFJ1bihjdHgsIHJ1bl9pZCk7XG4gIHJlcXVpcmVQcmVzZW50ZXIoY3R4LCByLnNlc3Npb25faWQpO1xuICBpZiAoci5zdGF0dXMgPT09IFwicnVubmluZ1wiKSBmYWlsKFwiUGF1c2UgdGhlIHJ1biBiZWZvcmUgc3RlcHBpbmcuXCIpO1xuICBjb25zdCByZWZ1c2FsID0gc3RhdHVzUmVmdXNhbChyLnN0YXR1cyk7XG4gIGlmIChyZWZ1c2FsKSBmYWlsKHJlZnVzYWwpO1xuICBmb3IgKGNvbnN0IHggb2YgcnVuc0ZvcktleShjdHgsIHIpKSBpZiAoeC5zdGF0dXMgPT09IFwicGF1c2VkXCIpIGN0eC5kYi5ydW4uaWQudXBkYXRlKHsgLi4ueCwgc3RlcF9wZW5kaW5nOiB0cnVlIH0pO1xufSk7XG5cbi8qKiBCYWNrIHRvIGByZXF1ZXN0ZWRgIHdpdGggZXZlcnkgcm93IGNsZWFyZWQuIFRoZSBlbmdpbmUgaXMgZGV0ZXJtaW5pc3RpYywgc28gdGhlIHdhdGNoZXIgcmVjb21wdXRlcyB0aGUgc2FtZSBydW4uICovXG5leHBvcnQgY29uc3QgcnVuX3Jlc2V0ID0gc3BhY2V0aW1lZGIucmVkdWNlcih7IHJ1bl9pZDogdC5zdHJpbmcoKSB9LCAoY3R4LCB7IHJ1bl9pZCB9KSA9PiB7XG4gIGNvbnN0IHIgPSByZWFkUnVuKGN0eCwgcnVuX2lkKTtcbiAgcmVxdWlyZVByZXNlbnRlcihjdHgsIHIuc2Vzc2lvbl9pZCk7XG4gIGlmIChyLnN0YXR1cyA9PT0gXCJyZXF1ZXN0ZWRcIikgZmFpbChzdGF0dXNSZWZ1c2FsKHIuc3RhdHVzKSk7XG4gIGZvciAoY29uc3QgeCBvZiBydW5zRm9yS2V5KGN0eCwgcikpIHtcbiAgICBkZWxldGVSdW5Sb3dzKGN0eCwgeC5pZCk7XG4gICAgY3R4LmRiLnJ1bi5pZC51cGRhdGUoeyAuLi54LCAuLi5CRUZPUkVfRlJBTUVfMCwgYXV0b3BsYXk6IGZhbHNlIH0pO1xuICB9XG59KTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSBmb2N1cyBhbm5vdGF0aW9ucyAoc3BlYyA3LjgpXG5cbmV4cG9ydCBjb25zdCBhbm5vdGF0aW9uX2FkZCA9IHNwYWNldGltZWRiLnJlZHVjZXIoXG4gIHsgc2Vzc2lvbl9pZDogdC5zdHJpbmcoKSwgdGFyZ2V0X2lkOiB0LnN0cmluZygpLCBub3RlOiB0LnN0cmluZygpIH0sXG4gIChjdHgsIHsgc2Vzc2lvbl9pZCwgdGFyZ2V0X2lkLCBub3RlIH0pID0+IHtcbiAgICBjb25zdCBzID0gZ2V0U2Vzc2lvbihjdHgsIHNlc3Npb25faWQpO1xuICAgIGNvbnN0IHAgPSBjdHguZGIucHJlc2VuY2UuaWRlbnRpdHkuZmluZChjdHguc2VuZGVyKTtcbiAgICBpZiAoIXAgfHwgcC5zZXNzaW9uX2lkICE9PSBzZXNzaW9uX2lkKSBmYWlsKFwiSm9pbiB0aGUgc2Vzc2lvbiBiZWZvcmUgYWRkaW5nIGEgZm9jdXMuXCIpO1xuICAgIGlmICghKEFOTk9UQVRJTkdfUk9MRVMgYXMgcmVhZG9ubHkgc3RyaW5nW10pLmluY2x1ZGVzKHAucm9sZSkpIGZhaWwoXCJPYnNlcnZlcnMgY2FuIHNlZSBmb2N1cyBwaW5zIGJ1dCBjYW4ndCBhZGQgdGhlbS5cIik7XG4gICAgaWYgKCFob3NwaXRhbE9mKGN0eCwgc2Vzc2lvbl9pZCkuZGV2aWNlcy5zb21lKChkKSA9PiBkLmlkID09PSB0YXJnZXRfaWQpKSBmYWlsKGBEZXZpY2UgXCIke3RhcmdldF9pZH1cIiBkb2VzIG5vdCBleGlzdC5gKTtcbiAgICBpZiAobm90ZS5sZW5ndGggPiBOT1RFX01BWCkgZmFpbChgTm90ZXMgYXJlIGF0IG1vc3QgJHtOT1RFX01BWH0gY2hhcmFjdGVycy5gKTtcbiAgICBmb3IgKGNvbnN0IGEgb2YgWy4uLmN0eC5kYi5hbm5vdGF0aW9uLnNlc3Npb25faWQuZmlsdGVyKHNlc3Npb25faWQpXSkge1xuICAgICAgaWYgKGEuYWN0aXZlICYmIGEudGFyZ2V0X2lkID09PSB0YXJnZXRfaWQgJiYgc2FtZShhLmF1dGhvciwgY3R4LnNlbmRlcikpIGZhaWwoXCJZb3UgYWxyZWFkeSBoYXZlIGEgZm9jdXMgb24gdGhpcyBkZXZpY2UuXCIpO1xuICAgIH1cbiAgICBjdHguZGIuYW5ub3RhdGlvbi5pbnNlcnQoe1xuICAgICAgaWQ6IDBuLCBzZXNzaW9uX2lkLCBydW5faWQ6IHMuYWN0aXZlX3J1bl9pZCwga2luZDogXCJmb2N1c1wiLCB0YXJnZXRfaWQsIG5vdGU6IG5vdGUudHJpbSgpLFxuICAgICAgYXV0aG9yOiBjdHguc2VuZGVyLCBhdXRob3JfbmFtZTogcC5uYW1lLCByb2xlOiBwLnJvbGUsIGFjdGl2ZTogdHJ1ZSwgY3JlYXRlZF9hdDogY3R4LnRpbWVzdGFtcCwgY2xlYXJlZF9ieTogXCJcIixcbiAgICB9KTtcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBhbm5vdGF0aW9uX2NsZWFyID0gc3BhY2V0aW1lZGIucmVkdWNlcih7IGFubm90YXRpb25faWQ6IHQudTY0KCkgfSwgKGN0eCwgeyBhbm5vdGF0aW9uX2lkIH0pID0+IHtcbiAgY29uc3QgYSA9IGN0eC5kYi5hbm5vdGF0aW9uLmlkLmZpbmQoYW5ub3RhdGlvbl9pZCkgPz8gZmFpbChcIlRoYXQgZm9jdXMgbm8gbG9uZ2VyIGV4aXN0cy5cIik7XG4gIGlmICghYS5hY3RpdmUpIHJldHVybjtcbiAgY29uc3QgcyA9IGdldFNlc3Npb24oY3R4LCBhLnNlc3Npb25faWQpO1xuICBjb25zdCBhbGxvd2VkID0gc2FtZShhLmF1dGhvciwgY3R4LnNlbmRlcikgfHwgc2FtZShzLnByZXNlbnRlciwgY3R4LnNlbmRlcikgfHwgaXNTZXJ2ZXIoY3R4KTtcbiAgaWYgKCFhbGxvd2VkKSBmYWlsKFwiT25seSB0aGUgYXV0aG9yIG9yIHRoZSBwcmVzZW50ZXIgY2FuIGNsZWFyIHRoaXMgZm9jdXMuXCIpO1xuICBjdHguZGIuYW5ub3RhdGlvbi5pZC51cGRhdGUoeyAuLi5hLCBhY3RpdmU6IGZhbHNlLCBjbGVhcmVkX2J5OiBjdHguc2VuZGVyLnRvSGV4U3RyaW5nKCkgfSk7XG59KTtcbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsSUFBSUEsYUFBVyxPQUFPO0FBQ3RCLElBQUlDLGNBQVksT0FBTztBQUN2QixJQUFJQyxxQkFBbUIsT0FBTztBQUM5QixJQUFJQyxzQkFBb0IsT0FBTztBQUMvQixJQUFJQyxpQkFBZSxPQUFPO0FBQzFCLElBQUlDLGlCQUFlLE9BQU8sVUFBVTtBQUNwQyxJQUFJQyxnQkFBYyxJQUFJLFFBQVEsU0FBUyxZQUFZO0FBQ2pELFFBQU8sUUFBUSxHQUFHLEdBQUdILG9CQUFrQixHQUFHLENBQUMsTUFBTSxNQUFNLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRSxTQUFTLElBQUksRUFBRSxJQUFJOztBQUU3RixJQUFJSSxpQkFBZSxJQUFJLE1BQU0sUUFBUSxTQUFTO0FBQzVDLEtBQUksUUFBUSxPQUFPLFNBQVMsWUFBWSxPQUFPLFNBQVMsWUFDdEQ7T0FBSyxJQUFJLE9BQU9KLG9CQUFrQixLQUFLLENBQ3JDLEtBQUksQ0FBQ0UsZUFBYSxLQUFLLElBQUksSUFBSSxJQUFJLFFBQVEsT0FDekMsYUFBVSxJQUFJLEtBQUs7R0FBRSxXQUFXLEtBQUs7R0FBTSxZQUFZLEVBQUUsT0FBT0gsbUJBQWlCLE1BQU0sSUFBSSxLQUFLLEtBQUs7R0FBWSxDQUFDOztBQUV4SCxRQUFPOztBQUVULElBQUlNLGFBQVcsS0FBSyxZQUFZLFlBQVksU0FBUyxPQUFPLE9B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