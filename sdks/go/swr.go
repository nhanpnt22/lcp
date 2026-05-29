package lcp

import "context"

// RunSWRRefresh invokes refresh asynchronously and drops the result by default.
func RunSWRRefresh[T any](ctx context.Context, refresh func(context.Context) (T, error)) {
	if refresh == nil {
		return
	}
	go func() {
		_, _ = refresh(ctx)
	}()
}
