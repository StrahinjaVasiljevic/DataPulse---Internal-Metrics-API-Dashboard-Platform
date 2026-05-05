const express = require('express');
const { normalizeMetricSubmission } = require('../lib/metricSubmission');

function makeRouter({ repo, forwardToIngestion }) {
  const router = express.Router();

  router.post('/', async (req, res) => {
    const { ok, errors, normalized } =
      normalizeMetricSubmission(req.body, {
        workspace_id: process.env.DEFAULT_WORKSPACE_ID,
      });

    if (!ok) {
      return res.status(422).json({ errors });
    }

    const row = repo.create(normalized);

    let forwarded = null;
    try {
      forwarded = await forwardToIngestion(req, normalized);
      if (forwarded?.ok) {
        repo.update(row.id, { status: 'processed' });
      }
    } catch (e) {
      repo.update(row.id, { status: 'error' });
    }

    res.status(201).json({
      ...row,
      forwarded,
    });
  });

  router.get('/', (req, res) => {
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 20);
    res.json(repo.list({ page, pageSize }));
  });

  router.get('/:id', (req, res) => {
    const row = repo.get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  });

  router.put('/:id', (req, res) => {
    const row = repo.update(req.params.id, req.body);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  });

  return router;
}

module.exports = { makeRouter };
