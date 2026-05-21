import type { WS } from "./index";

export {};

declare module 'vue' {
  interface ComponentCustomProperties {
    $ws: WS;
  }
}