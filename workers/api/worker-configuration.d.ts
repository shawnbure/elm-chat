type DurableObjectId = { toString(): string };

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface DurableObjectState {
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put<T>(key: string, value: T): Promise<void>;
    delete(key: string): Promise<boolean>;
    list<T>(options?: { prefix?: string }): Promise<Map<string, T>>;
    setAlarm(scheduledTime: number | Date): Promise<void>;
    deleteAlarm(): Promise<void>;
  };
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
  acceptWebSocket(webSocket: WebSocket, tags?: string[]): void;
  getWebSockets(): WebSocket[];
}

interface DurableObjectStub extends Fetcher {}

interface DurableObjectNamespace<T = unknown> {
  get(id: DurableObjectId): DurableObjectStub & T;
  getByName(name: string): DurableObjectStub & T;
  idFromName(name: string): DurableObjectId;
}

interface WebSocket {
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): unknown;
}

declare var WebSocketPair: {
  new (): { 0: WebSocket; 1: WebSocket };
};

declare module "cloudflare:workers" {
  export class DurableObject<Env = unknown> {
    protected ctx: DurableObjectState;
    protected env: Env;
    constructor(ctx: DurableObjectState, env: Env);
  }
}

