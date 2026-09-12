import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenMeteoWeatherProvider, weatherInputSchema } from '../src/runtime/weather.ts';
const place = { id: 1796236, name: '上海', latitude: 31.22, longitude: 121.46, timezone: 'Asia/Shanghai' };
const current = { timezone: place.timezone, current: { time: '2026-09-13T07:30', temperature_2m: 23, precipitation: null }, current_units: { temperature_2m: '°C', precipitation: 'mm' } };
const input = { city: '上海', kind: 'current' as const };
const signal = () => new AbortController().signal;
function fixture(responses: unknown[]) {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json(responses.shift()));
  return { fetcher, provider: new OpenMeteoWeatherProvider(fetcher, () => new Date('2026-09-12T23:30:00Z')) };
}
afterEach(() => vi.useRealTimers());
describe('天气确定性 fixture（不是实时天气）', () => {
  it('必须明确地点，拒绝错误日期和当前天气带日期', () => {
    for (const value of [{ kind: 'current' }, { city: ' ', kind: 'current' }, { ...input, date: '2026-09-13' }, { ...input, kind: 'forecast', date: '2026-02-30' }]) expect(weatherInputSchema.safeParse(value).success).toBe(false);
  });
  it('重名不请求天气；用户选定返回的ID后使用供应商坐标', async () => {
    const places = [place, { ...place, id: 2 }];
    const { provider, fetcher } = fixture([{ results: places }, current]);
    expect((await provider.query(input, signal())).error?.code).toBe('location_ambiguous');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await provider.query({ ...input, locationId: place.id }, signal())).toMatchObject({ status: 'succeeded' });
    expect(String(fetcher.mock.calls[1]![0])).toContain('latitude=31.22');
  });
  it('保留模型估算时间与单位；缺失值不补造；缓存保留原始获取时刻', async () => {
    const { provider, fetcher } = fixture([{ results: [place] }, current]);
    const first = await provider.query(input, signal());
    expect(first).toMatchObject({ source: 'Open-Meteo', data: { time: '2026-09-13T07:30', basis: 'model_current_conditions', measurements: { temperature_2m: { value: 23, unit: '°C' } } } });
    expect((first.data as any).measurements.precipitation).toBeUndefined();
    const second = await provider.query(input, signal());
    expect(second.observed_at).toBe(first.observed_at);
    expect(second).toMatchObject({ data: { cached: true } });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  });
  it('跨午夜用地点当地日期查询预报，与当前缓存分开', async () => {
    const { provider, fetcher } = fixture([{ results: [place] }, current, {
      timezone: place.timezone, daily: { time: ['2026-09-13'], temperature_2m_max: [28] }, daily_units: { temperature_2m_max: '°C' },
    }]);
    await provider.query(input, signal());
    expect(await provider.query({ ...input, kind: 'forecast' }, signal())).toMatchObject({ data: { kind: 'forecast', time: '2026-09-13' } });
    expect(String(fetcher.mock.calls[2]![0])).toContain('start_date=2026-09-13');
  });
  it('拒绝过期、超范围预报和无有效测量的数据', async () => {
    const { provider } = fixture([{ results: [place] }, { timezone: place.timezone, current: { time: '2026-09-13T07:30' }, current_units: {} }]);
    for (const date of ['2026-09-12', '2026-09-29']) expect((await provider.query({ ...input, kind: 'forecast', date }, signal())).error?.code).toBe('forecast_date_out_of_range');
    expect((await provider.query(input, signal())).error?.code).toBe('weather_invalid_data');
  });
  it('地理缓存按国家隔离，一天后刷新；天气缓存命中完全不联网', async () => {
    let now = new Date('2026-09-12T23:30:00Z');
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ results: [place] }))
      .mockResolvedValueOnce(Response.json(current)).mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(Response.json({ results: [place] })).mockResolvedValueOnce(Response.json(current));
    const provider = new OpenMeteoWeatherProvider(fetcher, () => now);
    await provider.query(input, signal());
    expect(await provider.query(input, signal())).toMatchObject({ data: { cached: true } });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect((await provider.query({ ...input, countryCode: 'US' }, signal())).status).toBe('failed');
    now = new Date(now.getTime() + 86_400_000);
    await provider.query(input, signal());
    expect(String(fetcher.mock.calls[3]![0])).toContain('geocoding-api');
    expect(fetcher).toHaveBeenCalledTimes(5);
  });
  it('十分钟后重新获取，故障不会把过期缓存伪称当前成功结果', async () => {
    let now = new Date('2026-09-12T23:30:00Z');
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ results: [place] })).mockResolvedValueOnce(Response.json(current))
      .mockResolvedValueOnce(new Response('', { status: 429 }));
    const provider = new OpenMeteoWeatherProvider(fetcher, () => now);
    await provider.query(input, signal());
    now = new Date(now.getTime() + 600_000);
    expect(await provider.query(input, signal())).toMatchObject({ status: 'failed', error: { code: 'weather_rate_limited' } });
  });
  it('3秒超时取消网络，调用方取消向上传播', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>((_url, options) => new Promise((_resolve, reject) => {
      options!.signal!.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }));
    const provider = new OpenMeteoWeatherProvider(fetcher);
    const timeout = provider.query(input, signal());
    await vi.advanceTimersByTimeAsync(3_000);
    expect(await timeout).toMatchObject({ error: { code: 'weather_timeout' } });
    const controller = new AbortController();
    const canceled = provider.query(input, controller.signal);
    const rejected = expect(canceled).rejects.toBeDefined();
    controller.abort(); await rejected;
    expect(fetcher.mock.calls[1]![1]!.signal!.aborted).toBe(true);
  });
});
