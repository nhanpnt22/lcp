package lcp

import "math"

func (e *ReadThroughCacheEngine[T]) shouldBypassStateAlignment(request CacheRequest[T], data T) bool {
	asMap, ok := any(data).(map[string]any)
	if !ok {
		return false
	}
	widgetID, _ := asMap["widget_id"].(string)
	stateVersion, ok := asInt64(asMap["state_version"])
	if !ok || widgetID == "" || stateVersion < 0 {
		return false
	}
	if e.resumeStore != nil {
		if current, exists := e.resumeStore.Snapshot()[widgetID]; exists && current > stateVersion {
			return true
		}
	}
	if request.ResumeState != nil && request.ResumeState.WidgetID == widgetID && stateVersion < request.ResumeState.StateVersion {
		return true
	}
	return false
}

func (e *ReadThroughCacheEngine[T]) trackResumeState(source CacheSource, data T, cacheKey string, request CacheRequest[T]) {
	if e.resumeStore == nil {
		return
	}
	if e.resolveResumeState != nil {
		state := e.resolveResumeState(ResolveResumeStateParams[T]{
			Source:   source,
			Data:     data,
			CacheKey: cacheKey,
			Request:  request,
		})
		if state != nil {
			e.resumeStore.Update(*state)
		}
		return
	}
	asMap, ok := any(data).(map[string]any)
	if !ok {
		return
	}
	widgetID, _ := asMap["widget_id"].(string)
	stateVersion, ok := asInt64(asMap["state_version"])
	if !ok || widgetID == "" {
		return
	}
	e.resumeStore.Update(ResumeState{WidgetID: widgetID, StateVersion: stateVersion})
}

func asInt64(value any) (int64, bool) {
	switch v := value.(type) {
	case int:
		return int64(v), true
	case int32:
		return int64(v), true
	case int64:
		return v, true
	case float64:
		if math.IsNaN(v) || math.IsInf(v, 0) || math.Trunc(v) != v {
			return 0, false
		}
		return int64(v), true
	default:
		return 0, false
	}
}
