declare module 'jwks-client' {
  export interface JwksClient {
    getSigningKey(kid: string): Promise<{
      getPublicKey(): string;
    }>;
  }

  export interface JwksClientOptions {
    jwksUri: string;
    cache?: boolean;
    cacheMaxAge?: number;
    rateLimit?: boolean;
    jwksRequestsPerMinute?: number;
  }

  export default function jwksClient(options: JwksClientOptions): JwksClient;
  export namespace jwksClient {
    export interface JwksClient {
      getSigningKey(kid: string): Promise<{
        getPublicKey(): string;
      }>;
    }
  }
}