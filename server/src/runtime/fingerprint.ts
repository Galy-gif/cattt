import { createHash } from 'node:crypto';

const SUBJECT_ALIASES = new Set(['我', '用户本人', '主人', '对方', '你']);

export function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, '');
}

function normalizeSubject(subject: string) {
  const s = normalize(subject);
  return SUBJECT_ALIASES.has(s) ? '用户' : s;
}

/**
 * 记忆的「哪一方面」：subject + predicate。
 * 冲突判断和删除后的阻断都按它，阻断记录只存这个哈希，不存原文。
 */
export function memoryFingerprint(subject: string, predicate: string): string {
  return createHash('sha256')
    .update(`${normalizeSubject(subject)}|${normalize(predicate)}`)
    .digest('hex')
    .slice(0, 32);
}
