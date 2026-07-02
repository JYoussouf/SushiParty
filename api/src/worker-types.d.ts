interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  meta: unknown;
  error?: string;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(column?: string): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface DurableObjectNamespace {
  getByName(name: string): DurableObjectStub;
}

interface R2HTTPMetadata {
  contentType?: string;
}

interface R2Object {
  body: ReadableStream;
  httpMetadata?: R2HTTPMetadata;
}

interface R2Bucket {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream | string,
    options?: { httpMetadata?: R2HTTPMetadata },
  ): Promise<R2Object>;
  get(key: string): Promise<R2Object | null>;
  delete(key: string): Promise<void>;
}

interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}

interface DurableObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
}

interface DurableObjectState {
  storage: DurableObjectStorage;
  acceptWebSocket(ws: WebSocket): void;
  getWebSockets(): WebSocket[];
}

declare class WebSocketPair {
  0: WebSocket;
  1: WebSocket;
}
