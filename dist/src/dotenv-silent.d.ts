/**
 * dotenv-silent.ts
 *
 * 这是一个 dotenv 的包装器，禁止所有输出到标准输出
 */
/**
 * 从文件加载环境变量
 */
export declare function config(options?: {
    path?: string;
    debug?: boolean;
}): {
    parsed: Record<string, string> | null;
};
