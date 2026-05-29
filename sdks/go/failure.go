package lcp

type FailureDecision string

const (
	FailureBypassToAPI           FailureDecision = "BYPASS_TO_API"
	FailureReturnStaleAndRefresh FailureDecision = "RETURN_STALE_AND_REFRESH"
	FailureHardFail              FailureDecision = "HARD_FAIL"
)

type FailureContext struct {
	InvariantCritical bool
	AllowStale        bool
	FailClosed        bool
}

func ClassifyFailure(ctx FailureContext) FailureDecision {
	if ctx.FailClosed || ctx.InvariantCritical {
		return FailureHardFail
	}
	if ctx.AllowStale {
		return FailureReturnStaleAndRefresh
	}
	return FailureBypassToAPI
}
