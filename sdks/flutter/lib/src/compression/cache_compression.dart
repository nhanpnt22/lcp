import 'dart:convert';
import 'dart:typed_data';

abstract class CompressionCodec {
  String get name;

  Future<Uint8List> compress(Uint8List input);

  Future<Uint8List> decompress(Uint8List input);
}

class CompressionPacket {
  const CompressionPacket({
    required this.payload,
    required this.compressed,
    required this.encoding,
    required this.originalLength,
    required this.compressedLength,
    this.codec,
  });

  final String payload;
  final bool compressed;
  final String encoding;
  final int originalLength;
  final int compressedLength;
  final String? codec;
}

class CompressionOptions {
  const CompressionOptions({
    this.codec,
    this.minBytes = 256,
  });

  final CompressionCodec? codec;
  final int minBytes;
}

typedef CodecRegistry = Map<String, CompressionCodec>;

String _bytesToHex(Uint8List bytes) {
  final buffer = StringBuffer();
  for (final b in bytes) {
    buffer.write(b.toRadixString(16).padLeft(2, '0'));
  }
  return buffer.toString();
}

Uint8List _hexToBytes(String hex) {
  if (hex.length % 2 != 0) {
    throw StateError('Invalid hex payload length');
  }

  final out = Uint8List(hex.length ~/ 2);
  for (var i = 0; i < hex.length; i += 2) {
    out[i ~/ 2] = int.parse(hex.substring(i, i + 2), radix: 16);
  }
  return out;
}

CompressionPacket _toPacketNoCompression(String utf8Value, Uint8List bytes) {
  return CompressionPacket(
    payload: utf8Value,
    compressed: false,
    encoding: 'utf8',
    originalLength: bytes.length,
    compressedLength: bytes.length,
  );
}

Future<CompressionPacket> compressDeterministic(
  String value, {
  CompressionOptions options = const CompressionOptions(),
}) async {
  final inputBytes = Uint8List.fromList(utf8.encode(value));

  if (options.codec == null || inputBytes.length < options.minBytes) {
    return _toPacketNoCompression(value, inputBytes);
  }

  final compressed = await options.codec!.compress(inputBytes);
  if (compressed.length >= inputBytes.length) {
    return _toPacketNoCompression(value, inputBytes);
  }

  return CompressionPacket(
    payload: _bytesToHex(compressed),
    compressed: true,
    codec: options.codec!.name,
    encoding: 'hex',
    originalLength: inputBytes.length,
    compressedLength: compressed.length,
  );
}

Future<String> decompressDeterministic(
  CompressionPacket packet, {
  required CodecRegistry registry,
}) async {
  if (!packet.compressed) {
    if (packet.encoding != 'utf8') {
      throw StateError('Uncompressed payload must use utf8 encoding');
    }
    return packet.payload;
  }

  final codecName = packet.codec;
  if (codecName == null || codecName.isEmpty) {
    throw StateError('Compressed payload missing codec');
  }

  final codec = registry[codecName];
  if (codec == null) {
    throw StateError('Unknown codec: $codecName');
  }

  if (packet.encoding != 'hex') {
    throw StateError('Compressed payload must use hex encoding');
  }

  final compressedBytes = _hexToBytes(packet.payload);
  final decompressed = await codec.decompress(compressedBytes);
  return utf8.decode(decompressed);
}

CodecRegistry createCodecRegistry(List<CompressionCodec> codecs) {
  final out = <String, CompressionCodec>{};
  for (final codec in codecs) {
    out[codec.name] = codec;
  }
  return out;
}
