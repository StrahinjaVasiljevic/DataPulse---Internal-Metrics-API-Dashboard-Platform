const { checkIdempotency, markProcessed } = require('../src/middleware/idempotency');

describe('Idempotency middleware', () => {
  test('passes through on first request', () => {
    const req = { headers: { 'x-idempotency-key': 'key-123' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    checkIdempotency(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('replays cached result on duplicate key', () => {
    const key = 'key-456';
    markProcessed(key, { metric_id: 'abc', status: 'accepted' });

    const req = { headers: { 'x-idempotency-key': key } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    checkIdempotency(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ idempotent_replay: true })
    );
    expect(next).not.toHaveBeenCalled();
  });
});
