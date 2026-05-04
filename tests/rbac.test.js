const { requireRole } = require('../src/middleware/auth');

describe('RBAC', () => {
  function makeReq(role) { return { role }; }
  function makeRes() {
    return { status: jest.fn().mockReturnThis(), json: jest.fn() };
  }

  test('owner can access owner-only route', () => {
    const next = jest.fn();
    requireRole(['owner'])(makeReq('owner'), makeRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('viewer cannot access owner route', () => {
    const res = makeRes();
    requireRole(['owner'])(makeReq('viewer'), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('editor can access editor+owner route', () => {
    const next = jest.fn();
    requireRole(['owner', 'editor'])(makeReq('editor'), makeRes(), next);
    expect(next).toHaveBeenCalled();
  });
});
