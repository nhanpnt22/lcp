package lcp

import "testing"

func TestCrossSdkSqliteEvidence(t *testing.T) {
	env, ok := readCrossEnv()
	if !ok {
		t.Skip("cross-sdk evidence env vars not set")
	}

	datasets := mustLoadCrossDatasets(t, env.DatasetsPath)
	prepareDBPath(t, env.DBPath)
	records := persistDatasetsAndBuildRecords(t, datasets, env.DBPath)
	rows := mustReadAndValidateRows(t, env.DBPath, len(datasets))
	attachRowsToRecords(t, records, rows)
	mustWriteCrossEvidence(t, env.EvidencePath, crossEvidence{
		SDK:      "go",
		DBPath:   env.DBPath,
		Records:  records,
		RowCount: len(rows),
	})
}
