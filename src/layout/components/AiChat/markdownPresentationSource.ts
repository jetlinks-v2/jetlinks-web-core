export type MarkdownPresentationSource =
  | { kind: 'inline'; content: string }
  | { kind: 'file'; uri: string; path: string };

export type MarkdownPresentationPathNormalizer = (value: string) => string;

/** Creates renderer-neutral source helpers around the host's bounded session-file path policy. */
export const createMarkdownPresentationSourceResolver = (
  normalizePath: MarkdownPresentationPathNormalizer,
) => {
  const toFileSource = (content: string): MarkdownPresentationSource | undefined => {
    const source = content.trim();
    if (!/^fs:\/\//i.test(source)) return undefined;
    if (/\s/.test(source)) return undefined;
    const path = normalizePath(source);
    return path ? { kind: 'file', uri: `fs://${path}`, path } : undefined;
  };

  const decode = (content: string): MarkdownPresentationSource | undefined => {
    const source = String(content || '').trim();
    if (!source) return undefined;
    if (/^fs:\/\//i.test(source)) return toFileSource(source);
    return { kind: 'inline', content: source };
  };

  const normalizeSource = (value: unknown): MarkdownPresentationSource | undefined => {
    if (!value || typeof value !== 'object' || !('kind' in value)) return undefined;
    if (value.kind === 'inline') {
      if (!('content' in value) || typeof value.content !== 'string') return undefined;
      const content = value.content.trim();
      return content ? { kind: 'inline', content } : undefined;
    }
    if (value.kind !== 'file' || !('uri' in value) || typeof value.uri !== 'string') {
      return undefined;
    }
    return toFileSource(value.uri);
  };

  const resolve = (content: string, value?: unknown): MarkdownPresentationSource => decode(content)
    || normalizeSource(value)
    || { kind: 'inline', content: '' };

  return { decode, resolve };
};
