/**
 * @spectyra/engine-client — for web/browser only.
 *
 * SDK, Desktop, and Companion use @spectyra/optimization-engine
 * which runs ALL algorithms locally. This package exists only for
 * the Angular web app, which calls the API server for real optimization.
 */

export { optimizeClient, type OptimizeClientInput } from "./engine.js";
