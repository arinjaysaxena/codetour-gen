import http from 'node:http';
import { handle } from './router.js';
export function serve(port) {
  return http.createServer(handle).listen(port);
}
