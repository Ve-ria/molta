import { randomBytes } from "node:crypto";

const http_chat_ids = {};

export function randomString(length = 16, chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
  const randomValues = randomBytes(length);
  const result = [];
  
  for (let i = 0; i < length; i++) {
    const randomIndex = randomValues[i] % chars.length;
    result.push(chars[randomIndex]);
  }
  
  return result.join('');
}

export function getOrCreateHttpChatId(client_id: string) {
  const cid = http_chat_ids[client_id];
  if (cid) return cid;
  const new_cid = `${client_id}:${randomString(8)}`;
  http_chat_ids[client_id] = new_cid;
  return new_cid;
}

export function expandRandomString(str: string) {
  if (str.includes("randomString")) {
    return str.replace("randomString", randomString(8));
  }
  return str;
}

export function renewHttpChatId(client_id: string) {
    const rand = randomString(8);
    const cid = `${client_id}:${rand}`;
    http_chat_ids[client_id] = cid;
    return cid;
}