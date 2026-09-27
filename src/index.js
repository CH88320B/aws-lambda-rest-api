const { Router } = require('./lib/router');
const { ok, error } = require('./lib/response');
const { requireAuth, requireRole } = require('./lib/auth');
const auth = require('./handlers/auth');
const products = require('./handlers/products');
const docs = require('./handlers/docs');

const router = new Router();

router.get('/health', () => ok({ status: 'ok', timestamp: new Date().toISOString() }));
router.get('/docs', docs.ui);
router.get('/docs/openapi.yaml', docs.spec);

// Auth
router.post('/auth/register', auth.register);
router.post('/auth/login', auth.login);
router.get('/auth/me', requireAuth, auth.me);

// Products: reads are public, writes require a valid token, deletes require admin
router.get('/products', products.list);
router.get('/products/{id}', products.get);
router.post('/products', requireAuth, products.create);
router.put('/products/{id}', requireAuth, products.update);
router.delete('/products/{id}', requireAuth, requireRole('admin'), products.remove);

exports.handler = async (event) => {
  try {
    return await router.handle(event);
  } catch (err) {
    return error(err);
  }
};

exports.router = router;
