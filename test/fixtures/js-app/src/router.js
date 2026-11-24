import { listUsers } from './model.js';
export function handle(req, res) {
  res.end(JSON.stringify(listUsers()));
}
