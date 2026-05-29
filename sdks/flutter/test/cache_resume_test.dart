import 'dart:convert';

import 'package:lcp_flutter_sdk/lcp_flutter_sdk.dart';
import 'package:test/test.dart';

void main() {
  test('resume state validates non-empty widget id and non-negative version',
      () {
    expect(
        () => ResumeState(widgetId: '', stateVersion: 0), throwsArgumentError);
    expect(() => ResumeState(widgetId: 'widget-1', stateVersion: -1),
        throwsArgumentError);
    expect(ResumeState(widgetId: 'widget-1', stateVersion: 0).widgetId,
        equals('widget-1'));
  });

  test('resume store keeps max state version and exposes size', () {
    final store = InMemoryResumeStateStore();
    store.update(ResumeState(widgetId: 'w1', stateVersion: 1));
    store.update(ResumeState(widgetId: 'w1', stateVersion: 0));
    store.update(ResumeState(widgetId: 'w2', stateVersion: 2));

    expect(store.snapshot(), equals({'w1': 1, 'w2': 2}));
    expect(store.size(), equals(2));
  });

  test('buildResumeHint canonicalizes map and builds deterministic token', () {
    String fakeHash(List<int> input) => base64Url.encode(input);

    final hint = buildResumeHint(
      traceId: 'trace-1',
      widgetStateMap: {'b': 2, 'a': 1},
      hashFn: fakeHash,
    );

    expect(hint['widget_state_map'], equals({'a': 1, 'b': 2}));

    final tokenMaterial = buildResumeTokenMaterial(
      traceId: 'trace-1',
      widgetStateMap: {'a': 1, 'b': 2},
    );
    expect(hint['resume_token'],
        equals(base64Url.encode(utf8.encode(tokenMaterial))));
  });
}
