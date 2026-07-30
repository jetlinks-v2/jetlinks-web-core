/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  readonly VITE_APP_BASE_API: string;
  readonly VITE_APP_DEV_PROXY_URL: string;
  readonly VITE_APP_ENVIRONMENT?: string;
  readonly VITE_APP_RUNTIME_SCOPE?: 'auto' | 'tenant' | 'project';
  readonly VITE_APP_PROJECT_CODE?: string;
  readonly VITE_PUBLIC_PATH?: string;
  readonly VITE_PORT: number;
  readonly tagName: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
