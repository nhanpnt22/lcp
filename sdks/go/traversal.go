package lcp

import "encoding/json"

// normalizeTraversalValue converts arbitrary values into generic JSON-like
// structures (map[string]any, []any, scalars) for deterministic recursive scans.
func normalizeTraversalValue(value any) any {
	encoded, err := json.Marshal(value)
	if err != nil {
		return value
	}
	var decoded any
	if err := json.Unmarshal(encoded, &decoded); err != nil {
		return value
	}
	return decoded
}
