import axios from 'axios';
import crypto from 'crypto';

/**
 * 调试日志函数，确保所有日志只输出到 stderr
 */
function debugLog(...args: any[]): void {
    if (process.stderr && process.stderr.write) {
        process.stderr.write(
            args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg, null, 2)).join(' ') + '\n'
        );
    }
}

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
export class JimengClient {
    private accessKey: string;
    private secretKey: string;
    private endpoint: string;
    private host: string;
    private region: string;
    private service: string;
    private debug: boolean;
    private timeout: number;
    private retries: number;

    /**
     * 创建即梦AI客户端实例
     */
    constructor(config: JimengClientConfig = {}) {
        this.accessKey = config.accessKey || process.env.JIMENG_ACCESS_KEY || '';
        this.secretKey = config.secretKey || process.env.JIMENG_SECRET_KEY || '';
        this.endpoint = config.endpoint || 'https://visual.volcengineapi.com';
        this.host = config.host || 'visual.volcengineapi.com';
        this.region = config.region || 'cn-north-1';
        this.service = config.service || 'cv';
        this.debug = config.debug || false;
        this.timeout = config.timeout || 30000;
        this.retries = config.retries || 3;

        // 验证必要的配置
        if (!this.accessKey || !this.secretKey) {
            throw new Error('缺少必要的配置: accessKey 和 secretKey');
        }

        if (this.debug) {
            debugLog('JimengClient 初始化完成:');
            debugLog('- 端点:', this.endpoint);
            debugLog('- 区域:', this.region);
            debugLog('- 服务:', this.service);
            debugLog('- AccessKey:', this.accessKey);
            debugLog('- SecretKey:', this.secretKey.substring(0, 3) + '...(已隐藏)');
        }
    }

    /**
     * 辅助函数：生成签名密钥
     */
    private getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Buffer {
        const kDate = crypto.createHmac('sha256', key).update(dateStamp).digest();
        const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
        const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
        const kSigning = crypto.createHmac('sha256', kService).update('request').digest();
        return kSigning;
    }

    /**
     * 格式化查询参数
     */
    private formatQuery(parameters: Record<string, string>): string {
        const sortedKeys = Object.keys(parameters).sort();
        return sortedKeys.map(key => `${key}=${parameters[key]}`).join('&');
    }

    /**
     * 火山引擎V4签名算法
     */
    private signV4Request(reqQuery: string, reqBody: string, region?: string): { headers: Record<string, string>; requestUrl: string } {
        const t = new Date();
        const currentDate = t.toISOString().replace(/[:\-]|\.\d{3}/g, '');
        const datestamp = currentDate.substring(0, 8);
        const usedRegion = region || this.region;

        const method = 'POST';
        const canonicalUri = '/';
        const canonicalQuerystring = reqQuery;
        const signedHeaders = 'content-type;host;x-content-sha256;x-date';
        const payloadHash = crypto.createHash('sha256').update(reqBody).digest('hex');
        const contentType = 'application/json';

        const canonicalHeaders = [
            `content-type:${contentType}`,
            `host:${this.host}`,
            `x-content-sha256:${payloadHash}`,
            `x-date:${currentDate}`
        ].join('\n') + '\n';

        const canonicalRequest = [
            method,
            canonicalUri,
            canonicalQuerystring,
            canonicalHeaders,
            signedHeaders,
            payloadHash
        ].join('\n');

        if (this.debug) {
            debugLog('规范请求字符串:\n' + canonicalRequest);
        }

        const algorithm = 'HMAC-SHA256';
        const credentialScope = `${datestamp}/${usedRegion}/${this.service}/request`;
        const stringToSign = [
            algorithm,
            currentDate,
            credentialScope,
            crypto.createHash('sha256').update(canonicalRequest).digest('hex')
        ].join('\n');

        if (this.debug) {
            debugLog('待签名字符串:\n' + stringToSign);
        }

        const signingKey = this.getSignatureKey(this.secretKey, datestamp, usedRegion, this.service);
        const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

        if (this.debug) {
            debugLog('签名值:', signature);
        }

        const authorizationHeader = `${algorithm} Credential=${this.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

        const headers = {
            'X-Date': currentDate,
            'Authorization': authorizationHeader,
            'X-Content-Sha256': payloadHash,
            'Content-Type': contentType,
            'Host': this.host
        };

        const requestUrl = `${this.endpoint}?${canonicalQuerystring}`;

        return { headers, requestUrl };
    }

    /**
     * 生成图像（传统方法，同步）
     */
    async generateImage(params: GenerateImageParams): Promise<ApiResponse> {
        let lastError: Error | null = null;
        let retryCount = 0;

        while (retryCount <= this.retries) {
            try {
                // 验证必要的参数
                if (!params.prompt) {
                    throw new Error('缺少必要的参数: prompt');
                }

                // 查询参数
                const queryParams = {
                    'Action': 'CVProcess',
                    'Version': '2022-08-31'
                };
                const formattedQuery = this.formatQuery(queryParams);

                // 请求体参数
                const bodyParams: any = {
                    req_key: params.req_key || "jimeng_high_aes_general_v21_L",
                    prompt: params.prompt,
                    return_url: params.return_url !== undefined ? params.return_url : true,
                    width: params.width || 512,
                    height: params.height || 512,
                    negative_prompt: params.negative_prompt
                };

                // 移除undefined值
                Object.keys(bodyParams).forEach(key => {
                    if (bodyParams[key] === undefined) {
                        delete bodyParams[key];
                    }
                });

                const formattedBody = JSON.stringify(bodyParams);

                if (this.debug) {
                    debugLog('请求体:', formattedBody);
                }

                // 生成签名和请求头
                const { headers, requestUrl } = this.signV4Request(formattedQuery, formattedBody, params.region);

                if (this.debug) {
                    debugLog('请求URL:', requestUrl);
                    debugLog('请求头:', JSON.stringify(headers, null, 2));
                }

                // 发送请求
                const response = await axios.post(requestUrl, bodyParams, {
                    headers: headers,
                    timeout: this.timeout,
                    validateStatus: null // 允许任何状态码
                });

                if (this.debug) {
                    debugLog('响应状态码:', response.status);
                    debugLog('响应头:', JSON.stringify(response.headers, null, 2));
                    debugLog('响应数据:', JSON.stringify(response.data, null, 2));
                }

                // 处理响应
                if (response.status !== 200) {
                    throw new Error(`HTTP错误! 状态码: ${response.status}`);
                }

                // 检查API错误
                if (response.data.ResponseMetadata && response.data.ResponseMetadata.Error) {
                    const error = response.data.ResponseMetadata.Error;
                    throw new Error(`API错误: ${error.Message || '未知错误'}`);
                }

                // 返回结果
                if (response.data.data && response.data.data.image_urls && response.data.data.image_urls.length > 0) {
                    return {
                        success: true,
                        image_urls: response.data.data.image_urls,
                        raw_response: response.data
                    };
                } else {
                    return {
                        success: false,
                        error: '未生成图像或响应格式不正确',
                        raw_response: response.data
                    };
                }
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                if (this.debug) {
                    debugLog(`尝试 #${retryCount + 1} 失败:`, lastError.message);
                }

                retryCount++;

                // 如果已经达到最大重试次数，返回错误
                if (retryCount > this.retries) {
                    if (this.debug) {
                        debugLog(`已达到最大重试次数 (${this.retries})，放弃重试`);
                    }
                    return {
                        success: false,
                        error: lastError.message
                    };
                }

                // 指数退避策略
                const waitTime = Math.min(1000 * Math.pow(2, retryCount - 1), 10000);
                if (this.debug) {
                    debugLog(`等待 ${waitTime}ms 后重试...`);
                }
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        // 不应该运行到这里
        return {
            success: false,
            error: '未知错误'
        };
    }

    /**
     * 通用异步任务提交 - 支持所有即梦AI异步接口
     */
    async submitAsyncTask(params: any): Promise<ApiResponse> {
        try {
            // 查询参数 - 使用异步提交任务API
            const queryParams = {
                'Action': 'CVSync2AsyncSubmitTask',
                'Version': '2022-08-31'
            };
            const formattedQuery = this.formatQuery(queryParams);

            const formattedBody = JSON.stringify(params);

            if (this.debug) {
                debugLog('提交异步任务请求体:', formattedBody);
            }

            // 生成签名和请求头
            const { headers, requestUrl } = this.signV4Request(formattedQuery, formattedBody);

            if (this.debug) {
                debugLog('提交异步任务请求URL:', requestUrl);
            }

            // 发送请求
            const response = await axios.post(requestUrl, params, {
                headers: headers,
                timeout: this.timeout,
                validateStatus: null
            });

            if (this.debug) {
                debugLog('提交异步任务响应:', JSON.stringify(response.data, null, 2));
            }

            // 处理响应
            if (response.status !== 200) {
                throw new Error(`HTTP错误! 状态码: ${response.status}`);
            }

            // 检查API错误
            if (response.data.code !== 10000) {
                throw new Error(`API错误: ${response.data.message || '未知错误'} (错误码: ${response.data.code})`);
            }

            // 返回结果
            if (response.data.data && response.data.data.task_id) {
                return {
                    success: true,
                    task_id: response.data.data.task_id,
                    raw_response: response.data
                };
            } else {
                return {
                    success: false,
                    error: '提交任务失败或响应格式不正确',
                    raw_response: response.data
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * 通用异步任务查询 - 支持所有即梦AI异步接口
     */
    async queryAsyncTask(params: { req_key: string; task_id: string; req_json?: string }): Promise<ApiResponse> {
        try {
            // 查询参数
            const queryParams = {
                'Action': 'CVSync2AsyncGetResult',
                'Version': '2022-08-31'
            };
            const formattedQuery = this.formatQuery(queryParams);

            // 请求体参数
            const bodyParams: any = {
                req_key: params.req_key,
                task_id: params.task_id
            };

            // 如果有req_json，使用提供的；否则使用默认的（返回URL）
            if (params.req_json) {
                bodyParams.req_json = params.req_json;
            } else {
                // 默认配置：返回图片URL（根据API文档，需要设置return_url: true）
                bodyParams.req_json = JSON.stringify({
                    return_url: true
                });
            }

            const formattedBody = JSON.stringify(bodyParams);

            if (this.debug) {
                debugLog('查询异步任务请求体:', formattedBody);
            }

            // 生成签名和请求头
            const { headers, requestUrl } = this.signV4Request(formattedQuery, formattedBody);

            if (this.debug) {
                debugLog('查询异步任务请求URL:', requestUrl);
            }

            // 发送请求
            const response = await axios.post(requestUrl, bodyParams, {
                headers: headers,
                timeout: this.timeout,
                validateStatus: null
            });

            if (this.debug) {
                debugLog('查询异步任务响应:', JSON.stringify(response.data, null, 2));
            }

            // 处理响应
            if (response.status !== 200) {
                throw new Error(`HTTP错误! 状态码: ${response.status}`);
            }

            // 检查业务错误码
            if (response.data.code !== 10000) {
                // 特殊处理审核错误
                if ([50411, 50511, 50412, 50512, 50413].includes(response.data.code)) {
                    return {
                        success: false,
                        status: 'FAILED',
                        error: response.data.message,
                        raw_response: response.data
                    };
                }
                throw new Error(`API错误: ${response.data.message || '未知错误'} (错误码: ${response.data.code})`);
            }

            // 返回结果
            const taskData = response.data.data;
            const taskStatus = taskData.status;

            // 标准化状态值
            let normalizedStatus = '';
            switch (taskStatus) {
                case 'in_queue':
                    normalizedStatus = 'PENDING';
                    break;
                case 'generating':
                case 'processing':
                    normalizedStatus = 'RUNNING';
                    break;
                case 'done':
                    normalizedStatus = 'SUCCEEDED';
                    break;
                case 'fail':
                case 'failed':
                    normalizedStatus = 'FAILED';
                    break;
                default:
                    normalizedStatus = taskStatus.toUpperCase();
            }

            return {
                success: true,
                status: normalizedStatus,
                data: taskData,
                raw_response: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * 即梦4.0图片生成 - 提交任务
     */
    async submitJimengV40Task(params: JimengV40Params): Promise<ApiResponse> {
        // 参数验证和清理（根据API文档）
        const cleanParams: any = {
            req_key: 'jimeng_t2i_v40',
            prompt: params.prompt
        };

        // 1. width和height必须同时存在才有效
        if (params.width && params.height) {
            // 验证宽高乘积范围
            const area = params.width * params.height;
            if (area < 1024 * 1024 || area > 4096 * 4096) {
                return {
                    success: false,
                    error: `宽高乘积必须在[1048576, 16777216]范围内，当前值：${area}`
                };
            }
            cleanParams.width = params.width;
            cleanParams.height = params.height;
            // 如果指定了宽高，不传size（优先使用宽高）
        } else if (!params.width && !params.height && params.size) {
            // 2. 如果没有宽高，可以传size
            // 验证size范围（size是面积，不是边长）
            if (params.size < 1024 * 1024) {
                debugLog(`警告：size值${params.size}太小，自动调整为最小值1048576（1024×1024）`);
                cleanParams.size = 1024 * 1024; // 最小值
            } else if (params.size > 4096 * 4096) {
                debugLog(`警告：size值${params.size}太大，自动调整为最大值16777216（4096×4096）`);
                cleanParams.size = 4096 * 4096; // 最大值
            } else {
                cleanParams.size = params.size;
            }
        }
        // 如果width和height只传了一个，都不传（避免报错）
        // 如果都没传，API会使用默认值2048×2048

        // 3. 其他可选参数
        if (params.image_urls && params.image_urls.length > 0) {
            cleanParams.image_urls = params.image_urls;
        }
        if (params.scale !== undefined) {
            cleanParams.scale = params.scale;
        }
        if (params.force_single !== undefined) {
            cleanParams.force_single = params.force_single;
        }
        if (params.seed !== undefined) {
            cleanParams.seed = params.seed;
        }
        if (params.min_ratio !== undefined) {
            cleanParams.min_ratio = params.min_ratio;
        }
        if (params.max_ratio !== undefined) {
            cleanParams.max_ratio = params.max_ratio;
        }

        return this.submitAsyncTask(cleanParams);
    }

    /**
     * 即梦4.0图片生成 - 同步方法（内部轮询）
     */
    async generateJimengV40Image(params: JimengV40Params): Promise<ApiResponse> {
        debugLog('即梦4.0图片生成中...(内部会自动提交任务并轮询结果)');

        // 提交任务
        const taskResult = await this.submitJimengV40Task(params);
        if (!taskResult.success || !taskResult.task_id) {
            return {
                success: false,
                error: taskResult.error || '提交任务失败'
            };
        }

        debugLog(`任务提交成功，任务ID: ${taskResult.task_id}`);
        debugLog('开始轮询任务结果...');

        // 轮询查询任务结果
        const maxAttempts = 60; // 最多等待60次（5分钟）
        const pollingInterval = 5000; // 5秒轮询一次

        for (let i = 0; i < maxAttempts; i++) {
            debugLog(`轮询任务结果 (${i + 1}/${maxAttempts})...`);

            // 查询任务结果
            const result = await this.queryAsyncTask({
                req_key: 'jimeng_t2i_v40',
                task_id: taskResult.task_id,
                req_json: JSON.stringify({ return_url: true })
            });

            if (result.success) {
                // 根据任务状态处理
                if (result.status === 'SUCCEEDED' && result.data) {
                    const imageUrls = result.data.image_urls || [];
                    if (imageUrls.length > 0) {
                        debugLog('图片生成成功!');
                        return {
                            success: true,
                            image_urls: imageUrls,
                            raw_response: result.raw_response,
                            task_id: taskResult.task_id
                        };
                    }
                } else if (result.status === 'FAILED') {
                    return {
                        success: false,
                        error: result.error || '图片生成任务失败',
                        raw_response: result.raw_response,
                        task_id: taskResult.task_id
                    };
                } else if (result.status === 'PENDING' || result.status === 'RUNNING') {
                    debugLog(`任务仍在进行中，状态: ${result.status}，等待 ${pollingInterval / 1000} 秒后重试...`);
                    // 任务仍在进行中，继续等待
                    await new Promise(resolve => setTimeout(resolve, pollingInterval));
                    continue;
                }
            }

            // 查询失败或状态异常，等待后重试
            debugLog('查询任务结果失败或状态异常，等待后重试...');
            await new Promise(resolve => setTimeout(resolve, pollingInterval));
        }

        // 超过最大尝试次数
        return {
            success: false,
            error: '轮询任务结果超时，图片生成可能仍在进行中',
            task_id: taskResult.task_id
        };
    }

    /**
     * 即梦图生图3.0 - 提交任务
     */
    async submitJimengI2IV30Task(params: JimengI2IV30Params): Promise<ApiResponse> {
        const taskParams = {
            req_key: 'jimeng_i2i_v30',
            ...params
        };
        return this.submitAsyncTask(taskParams);
    }

    /**
     * 即梦图生图3.0 - 同步方法（内部轮询）
     */
    async generateJimengI2IV30Image(params: JimengI2IV30Params): Promise<ApiResponse> {
        debugLog('即梦图生图3.0编辑中...(内部会自动提交任务并轮询结果)');

        // 提交任务
        const taskResult = await this.submitJimengI2IV30Task(params);
        if (!taskResult.success || !taskResult.task_id) {
            return {
                success: false,
                error: taskResult.error || '提交任务失败'
            };
        }

        debugLog(`任务提交成功，任务ID: ${taskResult.task_id}`);
        debugLog('开始轮询任务结果...');

        // 轮询查询任务结果
        const maxAttempts = 60; // 最多等待60次（5分钟）
        const pollingInterval = 5000; // 5秒轮询一次

        for (let i = 0; i < maxAttempts; i++) {
            debugLog(`轮询任务结果 (${i + 1}/${maxAttempts})...`);

            // 查询任务结果
            const result = await this.queryAsyncTask({
                req_key: 'jimeng_i2i_v30',
                task_id: taskResult.task_id,
                req_json: JSON.stringify({ return_url: true })
            });

            if (result.success) {
                // 根据任务状态处理
                if (result.status === 'SUCCEEDED' && result.data) {
                    const imageUrls = result.data.image_urls || [];
                    if (imageUrls.length > 0) {
                        debugLog('图片编辑成功!');
                        return {
                            success: true,
                            image_urls: imageUrls,
                            raw_response: result.raw_response,
                            task_id: taskResult.task_id
                        };
                    }
                } else if (result.status === 'FAILED') {
                    return {
                        success: false,
                        error: result.error || '图片编辑任务失败',
                        raw_response: result.raw_response,
                        task_id: taskResult.task_id
                    };
                } else if (result.status === 'PENDING' || result.status === 'RUNNING') {
                    debugLog(`任务仍在进行中，状态: ${result.status}，等待 ${pollingInterval / 1000} 秒后重试...`);
                    // 任务仍在进行中，继续等待
                    await new Promise(resolve => setTimeout(resolve, pollingInterval));
                    continue;
                }
            }

            // 查询失败或状态异常，等待后重试
            debugLog('查询任务结果失败或状态异常，等待后重试...');
            await new Promise(resolve => setTimeout(resolve, pollingInterval));
        }

        // 超过最大尝试次数
        return {
            success: false,
            error: '轮询任务结果超时，图片编辑可能仍在进行中',
            task_id: taskResult.task_id
        };
    }

    /**
     * 即梦文生图3.1 - 提交任务
     */
    async submitJimengT2IV31Task(params: JimengT2IParams): Promise<ApiResponse> {
        const taskParams = {
            req_key: 'jimeng_t2i_v31',
            ...params
        };
        return this.submitAsyncTask(taskParams);
    }

    /**
     * 即梦文生图3.1 - 同步方法（内部轮询）
     */
    async generateJimengT2IV31Image(params: JimengT2IParams): Promise<ApiResponse> {
        debugLog('即梦文生图3.1生成中...(内部会自动提交任务并轮询结果)');

        // 提交任务
        const taskResult = await this.submitJimengT2IV31Task(params);
        if (!taskResult.success || !taskResult.task_id) {
            return {
                success: false,
                error: taskResult.error || '提交任务失败'
            };
        }

        debugLog(`任务提交成功，任务ID: ${taskResult.task_id}`);
        debugLog('开始轮询任务结果...');

        // 轮询查询任务结果
        const maxAttempts = 60; // 最多等待60次（5分钟）
        const pollingInterval = 5000; // 5秒轮询一次

        for (let i = 0; i < maxAttempts; i++) {
            debugLog(`轮询任务结果 (${i + 1}/${maxAttempts})...`);

            // 查询任务结果
            const result = await this.queryAsyncTask({
                req_key: 'jimeng_t2i_v31',
                task_id: taskResult.task_id,
                req_json: JSON.stringify({ return_url: true })
            });

            if (result.success) {
                // 根据任务状态处理
                if (result.status === 'SUCCEEDED' && result.data) {
                    const imageUrls = result.data.image_urls || [];
                    if (imageUrls.length > 0) {
                        debugLog('图片生成成功!');
                        return {
                            success: true,
                            image_urls: imageUrls,
                            raw_response: result.raw_response,
                            task_id: taskResult.task_id
                        };
                    }
                } else if (result.status === 'FAILED') {
                    return {
                        success: false,
                        error: result.error || '图片生成任务失败',
                        raw_response: result.raw_response,
                        task_id: taskResult.task_id
                    };
                } else if (result.status === 'PENDING' || result.status === 'RUNNING') {
                    debugLog(`任务仍在进行中，状态: ${result.status}，等待 ${pollingInterval / 1000} 秒后重试...`);
                    // 任务仍在进行中，继续等待
                    await new Promise(resolve => setTimeout(resolve, pollingInterval));
                    continue;
                }
            }

            // 查询失败或状态异常，等待后重试
            debugLog('查询任务结果失败或状态异常，等待后重试...');
            await new Promise(resolve => setTimeout(resolve, pollingInterval));
        }

        // 超过最大尝试次数
        return {
            success: false,
            error: '轮询任务结果超时，图片生成可能仍在进行中',
            task_id: taskResult.task_id
        };
    }

    /**
     * 即梦文生图3.0 - 提交任务
     */
    async submitJimengT2IV30Task(params: JimengT2IParams): Promise<ApiResponse> {
        const taskParams = {
            req_key: 'jimeng_t2i_v30',
            ...params
        };
        return this.submitAsyncTask(taskParams);
    }

    /**
     * 即梦文生图3.0 - 同步方法（内部轮询）
     */
    async generateJimengT2IV30Image(params: JimengT2IParams): Promise<ApiResponse> {
        debugLog('即梦文生图3.0生成中...(内部会自动提交任务并轮询结果)');

        // 提交任务
        const taskResult = await this.submitJimengT2IV30Task(params);
        if (!taskResult.success || !taskResult.task_id) {
            return {
                success: false,
                error: taskResult.error || '提交任务失败'
            };
        }

        debugLog(`任务提交成功，任务ID: ${taskResult.task_id}`);
        debugLog('开始轮询任务结果...');

        // 轮询查询任务结果
        const maxAttempts = 60; // 最多等待60次（5分钟）
        const pollingInterval = 5000; // 5秒轮询一次

        for (let i = 0; i < maxAttempts; i++) {
            debugLog(`轮询任务结果 (${i + 1}/${maxAttempts})...`);

            // 查询任务结果
            const result = await this.queryAsyncTask({
                req_key: 'jimeng_t2i_v30',
                task_id: taskResult.task_id,
                req_json: JSON.stringify({ return_url: true })
            });

            if (result.success) {
                // 根据任务状态处理
                if (result.status === 'SUCCEEDED' && result.data) {
                    const imageUrls = result.data.image_urls || [];
                    if (imageUrls.length > 0) {
                        debugLog('图片生成成功!');
                        return {
                            success: true,
                            image_urls: imageUrls,
                            raw_response: result.raw_response,
                            task_id: taskResult.task_id
                        };
                    }
                } else if (result.status === 'FAILED') {
                    return {
                        success: false,
                        error: result.error || '图片生成任务失败',
                        raw_response: result.raw_response,
                        task_id: taskResult.task_id
                    };
                } else if (result.status === 'PENDING' || result.status === 'RUNNING') {
                    debugLog(`任务仍在进行中，状态: ${result.status}，等待 ${pollingInterval / 1000} 秒后重试...`);
                    // 任务仍在进行中，继续等待
                    await new Promise(resolve => setTimeout(resolve, pollingInterval));
                    continue;
                }
            }

            // 查询失败或状态异常，等待后重试
            debugLog('查询任务结果失败或状态异常，等待后重试...');
            await new Promise(resolve => setTimeout(resolve, pollingInterval));
        }

        // 超过最大尝试次数
        return {
            success: false,
            error: '轮询任务结果超时，图片生成可能仍在进行中',
            task_id: taskResult.task_id
        };
    }

    /**
     * 生成视频 - 文生视频 (异步方式: 提交任务)
     */
    async submitVideoTask(params: GenerateVideoParams): Promise<ApiResponse> {
        let lastError: Error | null = null;
        const retries = 1; // 只重试一次
        let retryCount = 0;

        while (retryCount <= retries) {
            try {
                // 验证必要的参数
                if (!params.prompt) {
                    throw new Error('缺少必要的参数: prompt');
                }

                // 查询参数 - 使用异步提交任务API
                const queryParams = {
                    'Action': 'CVSync2AsyncSubmitTask',
                    'Version': '2022-08-31'
                };
                const formattedQuery = this.formatQuery(queryParams);

                // 请求体参数
                const bodyParams = {
                    req_key: params.req_key || "jimeng_vgfm_t2v_l20",
                    prompt: params.prompt
                };

                const formattedBody = JSON.stringify(bodyParams);

                // 总是开启调试信息以便排查问题
                debugLog('提交任务请求体:', formattedBody);

                // 生成签名和请求头
                const { headers, requestUrl } = this.signV4Request(
                    formattedQuery,
                    formattedBody,
                    params.region
                );

                // 打印请求信息以便调试
                debugLog('提交任务请求URL:', requestUrl);
                debugLog('提交任务请求头:', JSON.stringify(headers, null, 2));

                // 发送请求
                const response = await axios.post(requestUrl, bodyParams, {
                    headers: headers,
                    timeout: this.timeout,
                    validateStatus: null // 允许任何状态码
                });

                // 打印响应信息以便调试
                debugLog('提交任务响应状态码:', response.status);
                debugLog('提交任务响应数据:', JSON.stringify(response.data, null, 2));

                // 处理响应
                if (response.status !== 200) {
                    // 特殊处理429错误
                    if (response.status === 429) {
                        throw new Error(`API并发限制错误: 请求过于频繁，请稍后再试。详细信息: ${JSON.stringify(response.data)}`);
                    }
                    throw new Error(`HTTP错误! 状态码: ${response.status}，详细信息: ${JSON.stringify(response.data)}`);
                }

                // 检查API错误
                if (response.data.ResponseMetadata && response.data.ResponseMetadata.Error) {
                    const error = response.data.ResponseMetadata.Error;
                    throw new Error(`API错误: ${error.Message || '未知错误'}, 错误码: ${error.Code || '无代码'}`);
                }

                // 返回结果 - 任务ID
                if (response.data.data && response.data.data.task_id) {
                    return {
                        success: true,
                        task_id: response.data.data.task_id,
                        raw_response: response.data
                    };
                } else {
                    return {
                        success: false,
                        error: '提交任务失败或响应格式不正确',
                        raw_response: response.data
                    };
                }
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                if (this.debug) {
                    debugLog(`尝试提交任务 #${retryCount + 1} 失败:`, lastError.message);
                }

                retryCount++;

                // 如果已经达到最大重试次数，返回错误
                if (retryCount > retries) {
                    if (this.debug) {
                        debugLog(`已达到最大重试次数 (${retries})，放弃重试`);
                    }

                    // 如果是429错误，给出更友好的提示
                    if (lastError.message.includes('429') || lastError.message.includes('并发限制')) {
                        return {
                            success: false,
                            error: '请求频率受限，请等待几分钟后再尝试提交视频生成任务。火山引擎对视频生成API有严格的并发限制。'
                        };
                    }

                    return {
                        success: false,
                        error: lastError.message
                    };
                }

                // 视频API调用等待时间设为固定的60秒（1分钟），符合QPS=1的限制
                const waitTime = 60000; // 60秒 = 1分钟
                debugLog(`请求受限，等待 ${waitTime / 1000} 秒后重试...`);
                debugLog(`将在 ${new Date(Date.now() + waitTime).toLocaleTimeString()} 重试`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        // 不应该运行到这里
        return {
            success: false,
            error: '未知错误'
        };
    }

    /**
     * 查询视频生成任务结果
     */
    async getVideoTaskResult(taskId: string, reqKey: string = "jimeng_vgfm_t2v_l20"): Promise<ApiResponse> {
        let lastError: Error | null = null;
        const retries = 1; // 只重试一次
        let retryCount = 0;

        while (retryCount <= retries) {
            try {
                // 查询参数 - 使用查询结果API
                const queryParams = {
                    'Action': 'CVSync2AsyncGetResult',
                    'Version': '2022-08-31'
                };
                const formattedQuery = this.formatQuery(queryParams);

                // 请求体参数
                const bodyParams = {
                    req_key: reqKey,
                    task_id: taskId
                };

                const formattedBody = JSON.stringify(bodyParams);

                // 总是开启调试信息以便排查问题
                debugLog('查询结果请求体:', formattedBody);

                // 生成签名和请求头
                const { headers, requestUrl } = this.signV4Request(
                    formattedQuery,
                    formattedBody,
                    reqKey.split('_')[2] // 提取region
                );

                // 开启调试信息
                debugLog('查询结果请求URL:', requestUrl);
                debugLog('查询结果请求头:', headers);

                // 发送请求
                const response = await axios({
                    url: requestUrl,
                    method: 'POST',
                    headers: headers,
                    data: formattedBody,
                });

                debugLog('查询结果响应状态码:', response.status);
                debugLog('查询结果响应数据:', JSON.stringify(response.data, null, 2));

                // 处理响应
                if (response.status === 200) {
                    const data = response.data;

                    // 处理服务器内部错误和其他业务错误
                    if (data.code !== 10000) {
                        // 处理特定错误代码
                        if (data.code === 50411) {
                            // 内容安全检查未通过
                            return {
                                success: false,
                                status: 'FAILED',
                                error: `内容安全检查未通过: ${data.message}`,
                                raw_response: data
                            };
                        }

                        // 其他业务错误
                        throw new Error(`服务器返回业务错误: ${data.message} (错误码: ${data.code})`);
                    }

                    // 处理状态
                    const taskData = data.data;
                    const taskStatus = taskData.status;

                    let normalizedStatus = '';

                    // 标准化状态值
                    switch (taskStatus) {
                        case 'in_queue':
                            normalizedStatus = 'PENDING';
                            break;
                        case 'processing':
                            normalizedStatus = 'RUNNING';
                            break;
                        case 'done':
                            normalizedStatus = 'SUCCEEDED';
                            break;
                        case 'fail':
                            normalizedStatus = 'FAILED';
                            break;
                        default:
                            normalizedStatus = taskStatus.toUpperCase();
                    }

                    // 解析视频URL - 从两个可能的位置获取
                    let videoUrls: string[] = [];

                    // 1. 从resp_data中解析视频URLs（需要先将字符串解析为JSON对象）
                    if (taskData.resp_data && typeof taskData.resp_data === 'string') {
                        try {
                            const respData = JSON.parse(taskData.resp_data);
                            if (respData.urls && Array.isArray(respData.urls)) {
                                videoUrls = respData.urls;
                            }
                        } catch (e) {
                            debugLog('解析resp_data时出错:', e);
                        }
                    }

                    // 2. 如果存在video_url字段，添加到videoUrls
                    if (taskData.video_url && typeof taskData.video_url === 'string') {
                        videoUrls.push(taskData.video_url);
                    }

                    // 返回任务状态和视频URL
                    return {
                        success: true,
                        status: normalizedStatus,
                        video_urls: videoUrls,
                        raw_response: data
                    };
                } else {
                    throw new Error(`HTTP错误! 状态码: ${response.status}，详细信息: ${JSON.stringify(response.data)}`);
                }
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                if (this.debug) {
                    debugLog(`尝试查询结果 #${retryCount + 1} 失败:`, lastError.message);
                }

                retryCount++;

                // 如果已经达到最大重试次数，返回错误
                if (retryCount > retries) {
                    if (this.debug) {
                        debugLog(`已达到最大重试次数 (${retries})，放弃重试`);
                    }
                    return {
                        success: false,
                        error: lastError.message
                    };
                }

                // 查询结果API调用使用较短的重试时间
                const waitTime = 5000; // 5秒
                debugLog(`查询失败，等待 ${waitTime / 1000} 秒后重试...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        // 不应该运行到这里
        return {
            success: false,
            error: '未知错误'
        };
    }

    /**
     * 生成视频 - 文生视频 (同步方式，内部轮询)
     */
    async generateVideo(params: GenerateVideoParams): Promise<ApiResponse> {
        debugLog('视频生成中...(内部会自动提交任务并轮询结果)');

        // 提交任务
        const taskResult = await this.submitVideoTask(params);
        if (!taskResult.success || !taskResult.task_id) {
            return {
                success: false,
                error: taskResult.error || '提交任务失败'
            };
        }

        debugLog(`任务提交成功，任务ID: ${taskResult.task_id}`);
        debugLog('开始轮询任务结果...');

        // 轮询查询任务结果
        const maxAttempts = 100; // 最多等待100次
        const pollingInterval = 5000; // 5秒轮询一次

        for (let i = 0; i < maxAttempts; i++) {
            debugLog(`轮询任务结果 (${i + 1}/${maxAttempts})...`);

            // 查询任务结果
            const result = await this.getVideoTaskResult(taskResult.task_id, params.req_key);

            if (result.success) {
                // 根据任务状态处理
                if ((result.status === 'SUCCEEDED' || result.status === 'done') && result.video_urls && result.video_urls.length > 0) {
                    debugLog('视频生成成功!');
                    return {
                        success: true,
                        video_urls: result.video_urls,
                        raw_response: result.raw_response,
                        task_id: taskResult.task_id
                    };
                } else if (result.status === 'FAILED') {
                    return {
                        success: false,
                        error: '视频生成任务失败',
                        raw_response: result.raw_response,
                        task_id: taskResult.task_id
                    };
                } else if (result.status === 'PENDING' || result.status === 'RUNNING') {
                    debugLog(`任务仍在进行中，状态: ${result.status}，等待 ${pollingInterval / 1000} 秒后重试...`);
                    // 任务仍在进行中，继续等待
                    await new Promise(resolve => setTimeout(resolve, pollingInterval));
                    continue;
                }
            }

            // 查询失败或状态异常，等待后重试
            debugLog('查询任务结果失败或状态异常，等待后重试...');
            await new Promise(resolve => setTimeout(resolve, pollingInterval));
        }

        // 超过最大尝试次数
        return {
            success: false,
            error: '轮询任务结果超时，请使用任务ID手动查询结果',
            task_id: taskResult.task_id
        };
    }

    /**
     * 提交图生视频任务 - 图片生成视频
     */
    async submitI2VTask(params: GenerateI2VParams): Promise<ApiResponse> {
        let lastError: Error | null = null;
        const retries = 1; // 只重试一次
        let retryCount = 0;

        while (retryCount <= retries) {
            try {
                // 准备图片URL数组
                let imageUrls: string[] = [];
                if (params.image_urls && params.image_urls.length > 0) {
                    // 优先使用image_urls数组
                    imageUrls = params.image_urls;
                } else if (params.image_url) {
                    // 如果没有提供image_urls但提供了image_url，则将其转换为数组
                    imageUrls = [params.image_url];
                } else {
                    throw new Error('缺少必要的参数: image_url 或 image_urls');
                }

                // 查询参数 - 使用异步提交任务API
                const queryParams = {
                    'Action': 'CVSync2AsyncSubmitTask',
                    'Version': '2022-08-31'
                };
                const formattedQuery = this.formatQuery(queryParams);

                // 请求体参数 - 默认使用图生视频模型
                const bodyParams: any = {
                    req_key: params.req_key || "jimeng_vgfm_i2v_l20",
                    image_urls: imageUrls,
                    // 必须指定aspect_ratio参数，不能使用keep_ratio
                    aspect_ratio: params.aspect_ratio || "16:9",
                    // 如果有提示词则添加
                    ...(params.prompt ? { prompt: params.prompt } : {})
                };

                const formattedBody = JSON.stringify(bodyParams);

                // 调试信息
                debugLog('提交任务请求体:', formattedBody);

                // 生成签名和请求头
                const { headers, requestUrl } = this.signV4Request(
                    formattedQuery,
                    formattedBody,
                    params.region
                );

                // 调试信息
                debugLog('提交任务请求URL:', requestUrl);
                debugLog('提交任务请求头:', headers);

                // 发送请求
                const response = await axios({
                    url: requestUrl,
                    method: 'POST',
                    headers: headers,
                    data: formattedBody
                });

                // 调试信息
                debugLog('提交任务响应状态码:', response.status);
                debugLog('提交任务响应数据:', JSON.stringify(response.data, null, 2));

                // 处理响应
                if (response.status === 200) {
                    if (response.data.status === 10000 || response.data.code === 10000) {
                        // 从响应中提取任务ID
                        const taskId = response.data.data?.task_id;

                        if (!taskId) {
                            throw new Error('服务器未返回任务ID');
                        }

                        return {
                            success: true,
                            task_id: taskId,
                            raw_response: response.data
                        };
                    } else {
                        throw new Error(`API错误: ${response.data.message || '未知错误'}, 错误码: ${response.data.code || response.data.status || '无'}`);
                    }
                } else {
                    throw new Error(`HTTP错误! 状态码: ${response.status}，详细信息: ${JSON.stringify(response.data)}`);
                }
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                // 提取错误信息，检查是否是由于图片格式问题
                const errorMsg = lastError.message || '';
                if (errorMsg.includes('Image Decode Error') ||
                    errorMsg.includes('image format unsupported') ||
                    errorMsg.includes('image url')) {
                    // 图片格式错误，提供更友好的错误信息
                    return {
                        success: false,
                        error: `图片格式不支持或无法访问。请确保提供的是可公开访问的JPEG或PNG格式图片URL。详细错误: ${errorMsg}`
                    };
                }

                debugLog(`提交图生视频任务尝试 #${retryCount + 1} 失败: ${lastError.message}`);

                if (retryCount < retries) {
                    // 计算重试等待时间 - 固定为60秒以避免API限流
                    const waitSeconds = 60;
                    const nextRetryTime = new Date(Date.now() + waitSeconds * 1000);
                    const timeString = nextRetryTime.toLocaleTimeString();

                    debugLog(`提交任务失败，将在 ${timeString} 重试...`);

                    // 等待指定时间
                    await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
                    retryCount++;
                } else {
                    debugLog(`已达到最大重试次数 (${retries})，放弃重试`);
                    break;
                }
            }
        }

        return {
            success: false,
            error: lastError ? lastError.message : '提交任务失败，已达到最大重试次数'
        };
    }

    /**
     * 生成视频 - 图片生成视频 (同步方式，内部轮询)
     */
    async generateI2VVideo(params: GenerateI2VParams): Promise<ApiResponse> {
        debugLog('生成图生视频中...(内部会自动提交任务并轮询结果)');

        // 提交任务
        const taskResult = await this.submitI2VTask(params);
        if (!taskResult.success || !taskResult.task_id) {
            return {
                success: false,
                error: taskResult.error || '提交任务失败'
            };
        }

        debugLog(`任务提交成功，任务ID: ${taskResult.task_id}`);
        debugLog('开始轮询任务结果...');

        // 轮询查询任务结果 - 复用文生视频的查询结果方法
        const maxAttempts = 100; // 最多等待100次
        const pollingInterval = 5000; // 5秒轮询一次

        for (let i = 0; i < maxAttempts; i++) {
            debugLog(`轮询任务结果 (${i + 1}/${maxAttempts})...`);

            // 查询任务结果
            const result = await this.getVideoTaskResult(taskResult.task_id, params.req_key || "jimeng_vgfm_i2v_l20");

            if (result.success) {
                // 根据任务状态处理
                if ((result.status === 'SUCCEEDED' || result.status === 'done') && result.video_urls && result.video_urls.length > 0) {
                    debugLog('视频生成成功!');
                    return {
                        success: true,
                        video_urls: result.video_urls,
                        raw_response: result.raw_response,
                        task_id: taskResult.task_id
                    };
                } else if (result.status === 'FAILED') {
                    return {
                        success: false,
                        error: '视频生成任务失败',
                        raw_response: result.raw_response,
                        task_id: taskResult.task_id
                    };
                } else if (result.status === 'PENDING' || result.status === 'RUNNING' || result.status === 'in_queue') {
                    debugLog(`任务仍在进行中，状态: ${result.status}，等待 ${pollingInterval / 1000} 秒后重试...`);
                    // 任务仍在进行中，继续等待
                    await new Promise(resolve => setTimeout(resolve, pollingInterval));
                    continue;
                }
            }

            // 查询失败或状态异常，等待后重试
            debugLog('查询任务结果失败或状态异常，等待后重试...');
            await new Promise(resolve => setTimeout(resolve, pollingInterval));
        }

        // 超过最大尝试次数
        return {
            success: false,
            error: '轮询任务结果超时，请使用任务ID手动查询结果',
            task_id: taskResult.task_id
        };
    }
}

// 验证键辅助函数
export function verifyKeys(keys: string[], required: string[]): string[] {
    return required.filter(key => !keys.includes(key));
}

