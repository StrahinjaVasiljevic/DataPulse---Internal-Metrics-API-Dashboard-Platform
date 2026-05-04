const db = require('./client');

async function getMetric(name, workspaceId) {
  if (!db.isConnected()) {
    const records = db.memoryStore.filter(
      r => r.metric_name === name && r.workspace_id === workspaceId
    );
    if (!records.length) return null;
    return records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
  }
  const result = await db.query(
    `SELECT * FROM metrics WHERE metric_name=$1 AND workspace_id=$2 ORDER BY timestamp DESC LIMIT 1`,
    [name, workspaceId]
  );
  return result.rows[0] || null;
}

async function getHistory(name, workspaceId, days) {
  const since = new Date(Date.now() - days * 86400000);
  if (!db.isConnected()) {
    return db.memoryStore
      .filter(r => r.metric_name === name && r.workspace_id === workspaceId && new Date(r.timestamp) >= since)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }
  const result = await db.query(
    `SELECT * FROM metrics WHERE metric_name=$1 AND workspace_id=$2 AND timestamp>=$3 ORDER BY timestamp ASC`,
    [name, workspaceId, since]
  );
  return result.rows;
}

async function getDashboard(workspaceId) {
  if (!db.isConnected()) {
    const map = {};
    for (const r of db.memoryStore.filter(r => r.workspace_id === workspaceId)) {
      if (!map[r.metric_name]) map[r.metric_name] = [];
      map[r.metric_name].push(r);
    }
    return {
      workspaceId,
      metrics: Object.entries(map).map(([name, records]) => ({
        name,
        latest: records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]?.value,
        count: records.length
      })),
      generated: new Date().toISOString()
    };
  }
  const result = await db.query(
    `SELECT metric_name, MAX(value) as latest, COUNT(*) as count FROM metrics WHERE workspace_id=$1 GROUP BY metric_name`,
    [workspaceId]
  );
  return { workspaceId, metrics: result.rows, generated: new Date().toISOString() };
}

module.exports = { getMetric, getHistory, getDashboard };

