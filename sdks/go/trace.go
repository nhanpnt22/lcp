package lcp

type CacheTraceContext struct {
	TraceID   string
	ActionID  string
	RequestID string
}

func StripTraceFields(value any) any {
	switch v := value.(type) {
	case map[string]any:
		out := make(map[string]any, len(v))
		for key, item := range v {
			if key == "trace_id" || key == "action_id" || key == "request_id" {
				continue
			}
			out[key] = StripTraceFields(item)
		}
		return out
	case []any:
		out := make([]any, len(v))
		for i, item := range v {
			out[i] = StripTraceFields(item)
		}
		return out
	default:
		return value
	}
}

func TraceContextEqual(a, b CacheTraceContext) bool {
	return a.TraceID == b.TraceID && a.ActionID == b.ActionID && a.RequestID == b.RequestID
}
