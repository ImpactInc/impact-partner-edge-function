/**
 * Minimal stand-in for `cloudflare:workers` so unit tests can construct
 * WorkerEntrypoint subclasses outside the Workers runtime.
 */
export class WorkerEntrypoint {
  /**
   * @param {ExecutionContext} ctx
   * @param {Object} env
   */
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }
}
