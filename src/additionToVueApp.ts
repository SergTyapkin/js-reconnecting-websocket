import {type WS} from "./index";

declare module 'vue' {
  interface ComponentCustomProperties {
    $ws: WS,
  }
}
