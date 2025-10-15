"use strict";
/**
 * dotenv-silent.ts
 *
 * 这是一个 dotenv 的包装器，禁止所有输出到标准输出
 */
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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = config;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * 从文件加载环境变量
 */
function config(options = {}) {
    try {
        // 获取文件路径
        const filePath = options.path || path.resolve(process.cwd(), '.env');
        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            return { parsed: null };
        }
        // 读取文件内容
        const content = fs.readFileSync(filePath, 'utf8');
        const result = {};
        // 解析文件内容
        content.split('\n').forEach(line => {
            // 忽略注释和空行
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) {
                return;
            }
            // 解析键值对
            const keyValue = trimmedLine.split('=');
            if (keyValue.length >= 2) {
                const key = keyValue[0].trim();
                let value = keyValue.slice(1).join('=').trim();
                // 移除引号
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.substring(1, value.length - 1);
                }
                else if (value.startsWith("'") && value.endsWith("'")) {
                    value = value.substring(1, value.length - 1);
                }
                // 设置环境变量
                process.env[key] = value;
                result[key] = value;
            }
        });
        return { parsed: result };
    }
    catch (error) {
        return { parsed: null };
    }
}
