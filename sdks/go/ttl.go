package lcp

import "strconv"

type TtlStatus string

const (
	TtlStatusValid   TtlStatus = "VALID"
	TtlStatusExpired TtlStatus = "EXPIRED"
	TtlStatusBypass  TtlStatus = "BYPASS"
)

type TtlEvaluation struct {
	Status TtlStatus
}

func EvaluateTTL(createdAt, now, ttlMS int64) TtlEvaluation {
	if ttlMS <= 0 {
		return TtlEvaluation{Status: TtlStatusBypass}
	}
	if now >= createdAt+ttlMS {
		return TtlEvaluation{Status: TtlStatusExpired}
	}
	return TtlEvaluation{Status: TtlStatusValid}
}

func ExtractOACTTLMS(headers map[string]string) *int64 {
	for k, v := range headers {
		if k == "x-oac-ttl-ms" || k == "X-OAC-TTL-MS" {
			parsed, err := strconv.ParseInt(v, 10, 64)
			if err != nil || parsed <= 0 {
				return nil
			}
			return &parsed
		}
	}
	return nil
}
