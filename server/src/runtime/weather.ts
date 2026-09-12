import { z } from 'zod';
import type { Observation, RuntimeTool } from './agent.ts';
import { timeZoneSchema } from './time.ts';

const source = 'Open-Meteo';
const ttlMs = 10 * 60_000;
const placeSchema = z.object({
  id: z.number().int(), name: z.string(), latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180), timezone: timeZoneSchema,
  country: z.string().optional(), country_code: z.string().optional(), admin1: z.string().optional(),
});
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});
export const weatherInputSchema = z.object({
  city: z.string().trim().min(2).max(120).describe('用户明确的现实城市，可用逗号追加行政区；不能从语言、时区或虚拟院子推断'),
  countryCode: z.string().regex(/^[A-Z]{2}$/).optional(),
  locationId: z.number().int().positive().optional().describe('仅在用户消歧后使用本工具返回的地点 ID'),
  kind: z.enum(['current', 'forecast']),
  date: dateSchema.optional().describe('预报的地点当地日期 YYYY-MM-DD；省略时为当地今天'),
}).refine(input => input.kind !== 'current' || !input.date, '当前天气不接受日期，请使用 forecast');
type WeatherInput = z.infer<typeof weatherInputSchema>;
type Result = Omit<Observation, 'call_id'>;
class WeatherError extends Error {
  constructor(readonly code: string, readonly retryable = false, readonly data?: unknown) { super(code); }
}

/** 公共端点供本机非商业开发验证；商业服务需另行配置供应商方案。 */
export class OpenMeteoWeatherProvider {
  private cache = new Map<string, { expires: number; result: Result }>();
  private locations = new Map<string, { expires: number; places: z.infer<typeof placeSchema>[] }>();
  constructor(private fetcher: typeof fetch = fetch, private now: () => Date = () => new Date()) {}

  async query(input: WeatherInput, callerSignal: AbortSignal): Promise<Result> {
    callerSignal.throwIfAborted();
    const timer = new AbortController();
    const timeout = setTimeout(() => timer.abort(), 3_000);
    const signal = AbortSignal.any([callerSignal, timer.signal]);
    const read = async (url: URL): Promise<unknown> => {
      signal.throwIfAborted();
      const response = await this.fetcher(url, { signal });
      if (!response.ok) throw new WeatherError(response.status === 429 ? 'weather_rate_limited' : 'weather_unavailable', true);
      return response.json();
    };
    try {
      const search = new URL('https://geocoding-api.open-meteo.com/v1/search');
      search.search = new URLSearchParams({ name: input.city, count: '100', language: 'zh', ...(input.countryCode ? { countryCode: input.countryCode } : {}) }).toString();
      const searchKey = search.href;
      const known = this.locations.get(searchKey);
      let candidates = known && known.expires > this.now().getTime() ? known.places : undefined;
      if (!candidates) {
        const found = z.object({ results: z.array(placeSchema).optional() }).parse(await read(search));
        candidates = found.results ?? [];
        signal.throwIfAborted();
        // 仅缓存经过 schema 校验的候选；消歧重试与天气缓存命中不依赖网络。
        if (candidates.length) {
          for (const [key, entry] of this.locations) if (entry.expires <= this.now().getTime()) this.locations.delete(key);
          if (this.locations.size >= 256) this.locations.delete(this.locations.keys().next().value!);
          this.locations.set(searchKey, { expires: this.now().getTime() + 86_400_000, places: candidates });
        }
      }
      if (!candidates.length) throw new WeatherError('location_not_found');
      const place = input.locationId ? candidates.find(p => p.id === input.locationId) : candidates.length === 1 ? candidates[0] : undefined;
      if (!place) throw new WeatherError(input.locationId ? 'location_not_found' : 'location_ambiguous', false,
        { candidates: candidates.slice(0, 10), hasMore: candidates.length > 10, instruction: '请用户明确国家或行政区后再查询，不自行挑选城市。' });
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: place.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(this.now());
      const date = input.date ?? today;
      const daysAhead = (Date.parse(date) - Date.parse(today)) / 86_400_000;
      if (input.kind === 'forecast' && (daysAhead < 0 || daysAhead > 15)) throw new WeatherError('forecast_date_out_of_range');
      const key = `${place.id}:${input.kind}:${input.kind === 'forecast' ? date : ''}`;
      const cached = this.cache.get(key);
      if (cached && cached.expires > this.now().getTime()) {
        signal.throwIfAborted();
        return { ...cached.result, data: { ...(cached.result.data as object), cached: true } };
      }
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      const fields = input.kind === 'current'
        ? ['temperature_2m', 'apparent_temperature', 'precipitation', 'weather_code', 'wind_speed_10m']
        : ['temperature_2m_max', 'temperature_2m_min', 'precipitation_sum', 'precipitation_probability_max', 'weather_code'];
      url.search = new URLSearchParams({ latitude: String(place.latitude), longitude: String(place.longitude), timezone: place.timezone,
        temperature_unit: 'celsius', wind_speed_unit: 'kmh', precipitation_unit: 'mm',
        ...(input.kind === 'current' ? { current: fields.join(',') } : { daily: fields.join(','), start_date: date, end_date: date }),
      }).toString();
      const payload = z.object({ timezone: timeZoneSchema, current: z.record(z.string(), z.unknown()).optional(),
        current_units: z.record(z.string(), z.string()).optional(), daily: z.record(z.string(), z.unknown()).optional(),
        daily_units: z.record(z.string(), z.string()).optional() }).parse(await read(url));
      const values = input.kind === 'current' ? payload.current : payload.daily;
      const units = input.kind === 'current' ? payload.current_units : payload.daily_units;
      const time = input.kind === 'current' ? values?.time : Array.isArray(values?.time) ? values.time[0] : undefined;
      if (typeof time !== 'string' || (input.kind === 'forecast' && time !== date) || !units) throw new WeatherError('weather_invalid_data', true);
      const measurements: Record<string, { value: number; unit: string }> = {};
      for (const field of fields) {
        const raw = values?.[field];
        const value = input.kind === 'current' ? raw : Array.isArray(raw) ? raw[0] : undefined;
        if (typeof value === 'number' && Number.isFinite(value) && units[field]) measurements[field] = { value, unit: units[field] };
      }
      if (!Object.keys(measurements).length) throw new WeatherError('weather_invalid_data', true);
      signal.throwIfAborted();
      const fetchedAt = this.now().toISOString();
      const result: Result = { status: 'succeeded', source, observed_at: fetchedAt, data: {
        location: place, kind: input.kind, time, timeZone: payload.timezone, fetchedAt,
        // current 是供应商模型的当前时段估算，不伪称地面实测。
        basis: input.kind === 'current' ? 'model_current_conditions' : 'model_forecast',
        measurements, cached: false, stale: false,
        attribution: 'Weather data by Open-Meteo (CC BY 4.0); location data by GeoNames',
        sourceUrl: 'https://open-meteo.com/',
      } };
      for (const [cacheKey, entry] of this.cache) if (entry.expires <= this.now().getTime()) this.cache.delete(cacheKey);
      if (this.cache.size >= 256) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, { expires: this.now().getTime() + ttlMs, result });
      return result;
    } catch (error) {
      callerSignal.throwIfAborted();
      const failure = timer.signal.aborted ? new WeatherError('weather_timeout', true) : error instanceof WeatherError ? error : new WeatherError('weather_unavailable', true);
      return { status: 'failed', source, observed_at: this.now().toISOString(), error: { code: failure.code, retryable: failure.retryable }, ...(failure.data ? { data: failure.data } : {}) };
    } finally { clearTimeout(timeout); }
  }
}
const provider = new OpenMeteoWeatherProvider();
export function weatherTool(weather: OpenMeteoWeatherProvider = provider): RuntimeTool {
  return {
    description: '查询用户明确城市的现实天气（Open-Meteo），与院子视觉天气无关。重名必须询问用户消歧；current 是模型当前估算，forecast 是当地日期预报（今天起16天内）。回答保留来源、时间与单位；未知字段保持未知。',
    inputSchema: weatherInputSchema,
    execute: (input, signal) => weather.query(weatherInputSchema.parse(input), signal),
  };
}
