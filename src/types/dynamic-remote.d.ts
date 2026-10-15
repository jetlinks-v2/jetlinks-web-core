// @jetlinks-web/vite 2.x ships this contract under src, but omits a declaration
// beside the runtime dist entry. Reuse its published types for the runtime import.
declare module '@jetlinks-web/vite/dist/dynamic-remote' {
  export * from '@jetlinks-web/vite/src/federation/types/dynamic-remote'
}
