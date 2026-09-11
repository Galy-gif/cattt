import { createHash } from 'node:crypto';

/** 开发者 token 的哈希。库里只存这个。单独一个文件，脚本引用它不会连带起队列连接 */
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
