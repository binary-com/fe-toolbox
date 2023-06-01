import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import logger from './logger';

class Http {
    private client: AxiosInstance;

    constructor(base_url: string, config: AxiosRequestConfig) {
        this.client = axios.create({
            baseURL: base_url,
            headers: config?.headers,
            auth: config?.auth,
            responseType: 'json' as const,
        });
    }

    async get<TResponse = Object>(url: string): Promise<TResponse> {
        try {
            const res = await this.client.get<TResponse>(url);
            return res.data;
        } catch (err) {
            this.handleError(err);
        }
        return {} as TResponse;
    }

    async post<TResponse = Object>(url: string, body: Object): Promise<TResponse> {
        try {
            const res = await this.client.post<TResponse>(url, body);
            return res.data;
        } catch (err) {
            this.handleError(err);
        }

        return {} as TResponse;
    }

    async put<TResponse = Object>(url: string, body: Object): Promise<TResponse> {
        try {
            const res = await this.client.put<TResponse>(url, body);
            return res.data;
        } catch (err) {
            this.handleError(err);
        }

        return {} as TResponse;
    }

    private handleError(err: any) {
        if (err instanceof Error) {
            console.log(err);
            logger.log(err.message, 'error');
        } else {
            console.log(err);
        }
    }
}

export default Http;
