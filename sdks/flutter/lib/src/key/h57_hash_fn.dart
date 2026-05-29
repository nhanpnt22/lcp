import 'package:f57/b57.dart';

/// H57 hash function: BLAKE3 → B57 encoding.
/// Uses the F57 reference implementation (github.com/nhanpnt22/f57).
///
/// Pass this as the [hashFn] argument to [computeCacheKey].
String h57HashFn(List<int> bytes) {
  return h57Hash(bytes, H57Length.hashAuto);
}
