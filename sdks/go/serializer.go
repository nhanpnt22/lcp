package lcp

func CanonicalSerialize(value any) ([]byte, error) {
	str, err := CanonicalJSONStringify(value)
	if err != nil {
		return nil, err
	}
	return []byte(str), nil
}
