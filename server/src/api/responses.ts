export const bad = (message: string) => ({ error: { code: 'bad_request', message } });
export const notFound = { error: { code: 'not_found', message: '没有这个' } };
