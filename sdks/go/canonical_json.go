package lcp

import (
	"bytes"
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
)

// CanonicalJSONStringify encodes a value with deterministic map key ordering.
func CanonicalJSONStringify(value any) (string, error) {
	var buf bytes.Buffer
	if err := writeCanonicalJSON(&buf, normalizeJSON(value)); err != nil {
		return "", err
	}
	return buf.String(), nil
}

func writeCanonicalJSON(buf *bytes.Buffer, value any) error {
	switch v := value.(type) {
	case nil:
		buf.WriteString("null")
	case bool:
		if v {
			buf.WriteString("true")
		} else {
			buf.WriteString("false")
		}
	case string:
		encoded, _ := json.Marshal(v)
		buf.Write(encoded)
	case json.Number:
		buf.WriteString(v.String())
	case float64:
		buf.WriteString(strconv.FormatFloat(v, 'f', -1, 64))
	case float32:
		buf.WriteString(strconv.FormatFloat(float64(v), 'f', -1, 32))
	case int, int8, int16, int32, int64:
		buf.WriteString(fmt.Sprintf("%d", v))
	case uint, uint8, uint16, uint32, uint64:
		buf.WriteString(fmt.Sprintf("%d", v))
	case []any:
		buf.WriteByte('[')
		for i, item := range v {
			if i > 0 {
				buf.WriteByte(',')
			}
			if err := writeCanonicalJSON(buf, item); err != nil {
				return err
			}
		}
		buf.WriteByte(']')
	case map[string]any:
		keys := make([]string, 0, len(v))
		for k := range v {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		buf.WriteByte('{')
		for i, k := range keys {
			if i > 0 {
				buf.WriteByte(',')
			}
			encodedKey, _ := json.Marshal(k)
			buf.Write(encodedKey)
			buf.WriteByte(':')
			if err := writeCanonicalJSON(buf, v[k]); err != nil {
				return err
			}
		}
		buf.WriteByte('}')
	default:
		encoded, err := json.Marshal(v)
		if err != nil {
			return err
		}
		var decoded any
		if err := json.Unmarshal(encoded, &decoded); err != nil {
			return err
		}
		return writeCanonicalJSON(buf, normalizeJSON(decoded))
	}
	return nil
}

func normalizeJSON(value any) any {
	switch v := value.(type) {
	case map[string]any:
		out := make(map[string]any, len(v))
		for k, item := range v {
			out[k] = normalizeJSON(item)
		}
		return out
	case map[any]any:
		out := make(map[string]any, len(v))
		for k, item := range v {
			out[fmt.Sprint(k)] = normalizeJSON(item)
		}
		return out
	case []any:
		out := make([]any, len(v))
		for i, item := range v {
			out[i] = normalizeJSON(item)
		}
		return out
	default:
		return v
	}
}
