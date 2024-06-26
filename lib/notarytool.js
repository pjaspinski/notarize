"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notarizeAndWaitForNotaryTool = exports.isNotaryToolAvailable = void 0;
const debug_1 = __importDefault(require("debug"));
const path = __importStar(require("path"));
const spawn_1 = require("./spawn");
const helpers_1 = require("./helpers");
const validate_args_1 = require("./validate-args");
const d = (0, debug_1.default)('electron-notarize:notarytool');
function authorizationArgs(rawOpts) {
    const opts = (0, validate_args_1.validateNotaryToolAuthorizationArgs)(rawOpts);
    if ((0, validate_args_1.isNotaryToolPasswordCredentials)(opts)) {
        return [
            '--apple-id',
            (0, helpers_1.makeSecret)(opts.appleId),
            '--password',
            (0, helpers_1.makeSecret)(opts.appleIdPassword),
            '--team-id',
            (0, helpers_1.makeSecret)(opts.teamId),
        ];
    }
    else if ((0, validate_args_1.isNotaryToolApiKeyCredentials)(opts)) {
        return [
            '--key',
            (0, helpers_1.makeSecret)(opts.appleApiKey),
            '--key-id',
            (0, helpers_1.makeSecret)(opts.appleApiKeyId),
            '--issuer',
            (0, helpers_1.makeSecret)(opts.appleApiIssuer),
        ];
    }
    else {
        // --keychain is optional -- when not specified, the iCloud keychain is used by notarytool
        if (opts.keychain) {
            return ['--keychain', opts.keychain, '--keychain-profile', opts.keychainProfile];
        }
        return ['--keychain-profile', opts.keychainProfile];
    }
}
function isNotaryToolAvailable() {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield (0, spawn_1.spawn)('xcrun', ['--find', 'notarytool']);
        return result.code === 0;
    });
}
exports.isNotaryToolAvailable = isNotaryToolAvailable;
function notarizeAndWaitForNotaryTool(opts) {
    return __awaiter(this, void 0, void 0, function* () {
        d('starting notarize process for app:', opts.appPath);
        return yield (0, helpers_1.withTempDir)((dir) => __awaiter(this, void 0, void 0, function* () {
            const fileExt = path.extname(opts.appPath);
            let filePath;
            if (fileExt === '.dmg' || fileExt === '.pkg') {
                filePath = path.resolve(dir, opts.appPath);
                d('attempting to upload file to Apple: ', filePath);
            }
            else {
                filePath = path.resolve(dir, `${path.parse(opts.appPath).name}.zip`);
                d('zipping application to:', filePath);
                const zipResult = yield (0, spawn_1.spawn)('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', path.basename(opts.appPath), filePath], {
                    cwd: path.dirname(opts.appPath),
                });
                if (zipResult.code !== 0) {
                    throw new Error(`Failed to zip application, exited with code: ${zipResult.code}\n\n${zipResult.output}`);
                }
                d('zip succeeded, attempting to upload to Apple');
            }
            const notarizeArgs = [
                'submit',
                filePath,
                ...authorizationArgs(opts),
                '--wait',
                '--output-format',
                'json',
            ];
            const result = yield (0, spawn_1.spawn)('/Applications/Xcode.app/Contents/Developer/usr/bin/notarytool', notarizeArgs);
            const rawOut = result.output.trim();
            let parsed;
            try {
                parsed = JSON.parse(rawOut);
            }
            catch (err) {
                throw new Error(`Failed to notarize via notarytool.  Failed with unexpected result: \n\n${rawOut}`);
            }
            if (result.code === 0 && parsed.status === 'Accepted') {
                d('notarization success');
                return;
            }
            let logOutput;
            if (parsed.id) {
                try {
                    const logResult = yield (0, spawn_1.spawn)('xcrun', [
                        'notarytool',
                        'log',
                        parsed.id,
                        ...authorizationArgs(opts),
                    ]);
                    d('notarization log', logResult.output);
                    logOutput = logResult.output;
                }
                catch (e) {
                    d('failed to pull notarization logs', e);
                }
            }
            let message = `Failed to notarize via notarytool\n\n${result.output} ${JSON.stringify(result)} ${JSON.stringify(parsed)}`;
            if (logOutput) {
                message += `\n\nDiagnostics from notarytool log: ${logOutput}`;
            }
            throw new Error(message);
        }));
    });
}
exports.notarizeAndWaitForNotaryTool = notarizeAndWaitForNotaryTool;
//# sourceMappingURL=notarytool.js.map