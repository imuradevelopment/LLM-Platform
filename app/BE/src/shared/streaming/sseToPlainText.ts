import { parseStreamPart } from 'ai';
import { debugLog } from '../logger';

export function sseToPlainTextTransform(): TransformStream<Uint8Array, Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let carry = '';
  let seenTitle = false;
  let buffer = '';
  const GUARD = 64; // 部分的な <chatTitle> を検知するため末尾バッファを残す

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      const text = decoder.decode(chunk, { stream: true });
      const combined = carry + text;
      const lines = combined.split('\n');

      // keep last partial line for next chunk
      carry = lines.pop() ?? '';

      let acc = '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const part = parseStreamPart(trimmed);
          const value = (() => {
            if (typeof part.value === 'string') return part.value;
            // safety 停止などでテキストが無い場合に備え、空文字を返す
            if (!part.value) return '';
            try {
              const anyVal: any = part.value as any;
              if (typeof anyVal.text === 'string') return anyVal.text;
            } catch {}
            return '';
          })();
          if (value) {
            acc += value;
          }
        } catch (_e) {
          // ignore unparsable lines
        }
      }

      if (acc) {
        buffer += acc;
        // 完結した <chatTitle>...</chatTitle> を全て除去
        if (!seenTitle && /<chatTitle>[^<]*<\/chatTitle>/.test(buffer)) {
          seenTitle = true;
        }
        buffer = buffer.replace(/<chatTitle>[^<]*<\/chatTitle>/g, '');

        // 末尾にタグの開始がある可能性を考慮しつつフラッシュ
        const safeLen = Math.max(0, buffer.length - GUARD);
        if (safeLen > 0) {
          const out = buffer.slice(0, safeLen);
          buffer = buffer.slice(safeLen);
          controller.enqueue(encoder.encode(out));
          debugLog('sseToPlainTextTransform: emit', { bytes: encoder.encode(out).byteLength, textLength: out.length });
        }
      }
    },
    flush(controller) {
      // 終了時、残りを最終正規化して出力
      if (buffer) {
        buffer = buffer.replace(/<chatTitle>[^<]*<\/chatTitle>/g, '');
        if (buffer) {
          controller.enqueue(encoder.encode(buffer));
          debugLog('sseToPlainTextTransform: emit(final)', { bytes: encoder.encode(buffer).byteLength, textLength: buffer.length });
        }
      }
    },
  });
}


