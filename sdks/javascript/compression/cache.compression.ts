const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface CompressionCodec {
  name: string;
  compress(input: Uint8Array): Promise<Uint8Array>;
  decompress(input: Uint8Array): Promise<Uint8Array>;
}

export interface CompressionPacket {
  payload: string;
  compressed: boolean;
  codec?: string;
  encoding: "utf8" | "hex";
  original_length: number;
  compressed_length: number;
}

export interface CompressionOptions {
  codec?: CompressionCodec;
  minBytes?: number;
}

export interface CodecRegistry {
  [codecName: string]: CompressionCodec;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Invalid hex payload length");
  }

  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

function toPacketNoCompression(utf8: string, bytes: Uint8Array): CompressionPacket {
  return {
    payload: utf8,
    compressed: false,
    encoding: "utf8",
    original_length: bytes.length,
    compressed_length: bytes.length
  };
}

/**
 * Optional transparent compression with deterministic fallback behavior.
 */
export async function compressDeterministic(
  value: string,
  options: CompressionOptions = {}
): Promise<CompressionPacket> {
  const inputBytes = textEncoder.encode(value);
  const minBytes = options.minBytes ?? 256;

  if (!options.codec || inputBytes.length < minBytes) {
    return toPacketNoCompression(value, inputBytes);
  }

  const compressed = await options.codec.compress(inputBytes);
  if (compressed.length >= inputBytes.length) {
    return toPacketNoCompression(value, inputBytes);
  }

  return {
    payload: bytesToHex(compressed),
    compressed: true,
    codec: options.codec.name,
    encoding: "hex",
    original_length: inputBytes.length,
    compressed_length: compressed.length
  };
}

/**
 * Deterministic decompression that preserves transparent behavior.
 */
export async function decompressDeterministic(
  packet: CompressionPacket,
  registry: CodecRegistry
): Promise<string> {
  if (!packet.compressed) {
    if (packet.encoding !== "utf8") {
      throw new Error("Uncompressed payload must use utf8 encoding");
    }
    return packet.payload;
  }

  if (!packet.codec) {
    throw new Error("Compressed payload missing codec");
  }

  const codec = registry[packet.codec];
  if (!codec) {
    throw new Error(`Unknown codec: ${packet.codec}`);
  }

  if (packet.encoding !== "hex") {
    throw new Error("Compressed payload must use hex encoding");
  }

  const compressedBytes = hexToBytes(packet.payload);
  const decompressed = await codec.decompress(compressedBytes);
  return textDecoder.decode(decompressed);
}

export function createCodecRegistry(codecs: CompressionCodec[]): CodecRegistry {
  const out: CodecRegistry = {};
  for (const codec of codecs) {
    out[codec.name] = codec;
  }
  return out;
}
