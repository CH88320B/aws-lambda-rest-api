const { Router } = require('./lib/router');
const { ok, error } = require('./lib/response');

const router = new Router();

router.get('/health', () => ok({ status: 'ok', timestamp: new Date().toISOString() }));

exports.handler = async (event) => {
  try {
    return await router.handle(event);
  } catch (err) {
    return error(err);
  }
};

exports.router = router;
