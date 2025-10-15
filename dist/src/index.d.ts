/**
 * 客户端配置接口
 */
export interface JimengClientConfig {
    accessKey?: string;
    secretKey?: string;
    endpoint?: string;
    host?: string;
    region?: string;
    service?: string;
    debug?: boolean;
    timeout?: number;
    retries?: number;
}
/**
 * 生成图像参数
 */
export interface GenerateImageParams {
    prompt: string;
    width?: number;
    height?: number;
    req_key?: string;
    return_url?: boolean;
    negative_prompt?: string;
    region?: string;
}
/**
 * 生成视频参数（文生视频）
 */
export interface GenerateVideoParams {
    prompt: string;
    req_key?: string;
    region?: string;
}
/**
 * 图生视频参数
 */
export interface GenerateI2VParams {
    image_url?: string;
    image_urls?: string[];
    prompt?: string;
    req_key?: string;
    aspect_ratio?: string;
    region?: string;
}
/**
 * 即梦4.0参数
 */
export interface JimengV40Params {
    prompt: string;
    image_urls?: string[];
    width?: number;
    height?: number;
    size?: number;
    scale?: number;
    force_single?: boolean;
    seed?: number;
    min_ratio?: number;
    max_ratio?: number;
}
/**
 * 即梦图生图3.0参数
 */
export interface JimengI2IV30Params {
    image_urls: string[];
    prompt: string;
    width?: number;
    height?: number;
    scale?: number;
    seed?: number;
}
/**
 * 即梦文生图3.1/3.0参数
 */
export interface JimengT2IParams {
    prompt: string;
    use_pre_llm?: boolean;
    width?: number;
    height?: number;
    seed?: number;
}
/**
 * API响应接口
 */
export interface ApiResponse {
    success: boolean;
    image_urls?: string[];
    video_urls?: string[];
    error?: string;
    raw_response?: any;
    task_id?: string;
    status?: string;
    data?: any;
}
/**
 * 即梦AI客户端
 * 使用火山引擎V4签名算法实现
 */
export declare class JimengClient {
    private accessKey;
    private secretKey;
    private endpoint;
    private host;
    private region;
    private service;
    private debug;
    private timeout;
    private retries;
    /**
     * 创建即梦AI客户端实例
     */
    constructor(config?: JimengClientConfig);
    /**
     * 辅助函数：生成签名密钥
     */
    private getSignatureKey;
    /**
     * 格式化查询参数
     */
    private formatQuery;
    /**
     * 火山引擎V4签名算法
     */
    private signV4Request;
    /**
     * 生成图像（传统方法，同步）
     */
    generateImage(params: GenerateImageParams): Promise<ApiResponse>;
    /**
     * 通用异步任务提交 - 支持所有即梦AI异步接口
     */
    submitAsyncTask(params: any): Promise<ApiResponse>;
    /**
     * 通用异步任务查询 - 支持所有即梦AI异步接口
     */
    queryAsyncTask(params: {
        req_key: string;
        task_id: string;
        req_json?: string;
    }): Promise<ApiResponse>;
    /**
     * 即梦4.0图片生成 - 提交任务
     */
    submitJimengV40Task(params: JimengV40Params): Promise<ApiResponse>;
    /**
     * 即梦4.0图片生成 - 同步方法（内部轮询）
     */
    generateJimengV40Image(params: JimengV40Params): Promise<ApiResponse>;
    /**
     * 即梦图生图3.0 - 提交任务
     */
    submitJimengI2IV30Task(params: JimengI2IV30Params): Promise<ApiResponse>;
    /**
     * 即梦图生图3.0 - 同步方法（内部轮询）
     */
    generateJimengI2IV30Image(params: JimengI2IV30Params): Promise<ApiResponse>;
    /**
     * 即梦文生图3.1 - 提交任务
     */
    submitJimengT2IV31Task(params: JimengT2IParams): Promise<ApiResponse>;
    /**
     * 即梦文生图3.1 - 同步方法（内部轮询）
     */
    generateJimengT2IV31Image(params: JimengT2IParams): Promise<ApiResponse>;
    /**
     * 即梦文生图3.0 - 提交任务
     */
    submitJimengT2IV30Task(params: JimengT2IParams): Promise<ApiResponse>;
    /**
     * 即梦文生图3.0 - 同步方法（内部轮询）
     */
    generateJimengT2IV30Image(params: JimengT2IParams): Promise<ApiResponse>;
    /**
     * 生成视频 - 文生视频 (异步方式: 提交任务)
     */
    submitVideoTask(params: GenerateVideoParams): Promise<ApiResponse>;
    /**
     * 查询视频生成任务结果
     */
    getVideoTaskResult(taskId: string, reqKey?: string): Promise<ApiResponse>;
    /**
     * 生成视频 - 文生视频 (同步方式，内部轮询)
     */
    generateVideo(params: GenerateVideoParams): Promise<ApiResponse>;
    /**
     * 提交图生视频任务 - 图片生成视频
     */
    submitI2VTask(params: GenerateI2VParams): Promise<ApiResponse>;
    /**
     * 生成视频 - 图片生成视频 (同步方式，内部轮询)
     */
    generateI2VVideo(params: GenerateI2VParams): Promise<ApiResponse>;
}
export declare function verifyKeys(keys: string[], required: string[]): string[];
