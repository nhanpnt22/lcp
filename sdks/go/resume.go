package lcp

import "sync"

type ResumeState struct {
	WidgetID     string
	StateVersion int64
}

type InMemoryResumeStateStore struct {
	mu    sync.RWMutex
	state map[string]int64
}

func NewInMemoryResumeStateStore() *InMemoryResumeStateStore {
	return &InMemoryResumeStateStore{state: map[string]int64{}}
}

func (s *InMemoryResumeStateStore) Update(state ResumeState) {
	if state.WidgetID == "" || state.StateVersion < 0 {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if current, ok := s.state[state.WidgetID]; ok && current > state.StateVersion {
		return
	}
	s.state[state.WidgetID] = state.StateVersion
}

func (s *InMemoryResumeStateStore) Snapshot() map[string]int64 {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make(map[string]int64, len(s.state))
	for k, v := range s.state {
		out[k] = v
	}
	return out
}

func (s *InMemoryResumeStateStore) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.state = map[string]int64{}
}

func (s *InMemoryResumeStateStore) Size() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.state)
}

func BuildResumeHint(traceID string, widgetStateMap map[string]int64, hashFn HashFn) (map[string]any, error) {
	if hashFn == nil {
		return nil, ErrHashFnRequired
	}
	canonical, err := CanonicalJSONStringify(widgetStateMap)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"trace_id":      traceID,
		"resume_token":  hashFn([]byte(canonical)),
		"widget_states": widgetStateMap,
	}, nil
}
