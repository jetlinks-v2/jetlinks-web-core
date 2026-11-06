export type AMapErrorKind = 'sdk' | 'map' | 'ui' | 'timeout';

export interface AMapError {
    kind: AMapErrorKind;
    code?: string;
    info?: string;
    message?: string;
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
    value !== null && typeof value === 'object' ? value as Record<string, unknown> : undefined;

const asText = (value: unknown): string | undefined => {
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return undefined;
};

/** 保留 SDK 实际暴露的字段，兼容错误事件包装，不根据错误码推断 info。 */
export function normalizeAMapError(reason: unknown, kind: AMapErrorKind): AMapError {
    const root = asRecord(reason);
    const records = [root, asRecord(root?.error), asRecord(root?.data), asRecord(root?.detail)];
    const field = (...keys: string[]) => {
        for (const record of records) {
            for (const key of keys) {
                const text = asText(record?.[key]);
                if (text !== undefined) return text;
            }
        }
    };

    return {
        kind,
        code: field('infocode', 'errcode', 'code'),
        info: field('info') ?? (typeof reason === 'string' ? asText(reason) : undefined),
        message: field('message'),
    };
}
