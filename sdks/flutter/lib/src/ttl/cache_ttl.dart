const oacTtlHeader = 'x-oac-cache.ttl_ms';

enum TtlStatus { valid, expired, bypass }

class TtlEvaluationResult {
  const TtlEvaluationResult({
    required this.status,
    this.ttlMs,
    this.expiresAt,
  });

  final TtlStatus status;
  final int? ttlMs;
  final int? expiresAt;
}

int? extractOacTtlMs(Map<String, String?> headers) {
  String? raw = headers[oacTtlHeader];
  raw ??= headers.entries
      .firstWhere(
        (entry) => entry.key.toLowerCase() == oacTtlHeader,
        orElse: () => const MapEntry('', null),
      )
      .value;
  if (raw == null || raw.trim().isEmpty) return null;
  final ttl = int.tryParse(raw);
  if (ttl == null || ttl < 0) return null;
  return ttl;
}

int computeExpiresAt(int createdAt, int ttlMs) => createdAt + ttlMs;

TtlEvaluationResult evaluateTtl({
  required int createdAt,
  required int now,
  int? ttlMs,
}) {
  if (ttlMs == null) return const TtlEvaluationResult(status: TtlStatus.bypass);
  final expiresAt = computeExpiresAt(createdAt, ttlMs);
  if (now < expiresAt) {
    return TtlEvaluationResult(
      status: TtlStatus.valid,
      ttlMs: ttlMs,
      expiresAt: expiresAt,
    );
  }
  return TtlEvaluationResult(
    status: TtlStatus.expired,
    ttlMs: ttlMs,
    expiresAt: expiresAt,
  );
}
