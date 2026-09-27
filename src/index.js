const { Router } = require('./lib/router');
const { ok, error } = require('./lib/response');
const products = require('./handlers/products');

const router = new Router();

router.get('/health', () => ok({ status: 'ok', timestamp: new Date().toISOString() }));

router.get('/products', products.list);
router.get('/products/{id}', products.get);
router.post('/products', products.create);
router.put('/products/{id}', products.update);
router.delete('/products/{id}', products.remove);

exports.handler = async (event) => {
  try {
    return await router.handle(event);
  } catch (err) {
    return error(err);
  }
};

exports.router = router;
