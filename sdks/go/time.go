package lcp

import "time"

func nowMS() int64 {
	return time.Now().UnixMilli()
}
