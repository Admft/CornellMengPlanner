import { handleGetStats } from '../server/analyticsHandler.js'

export default function handler(req, res) {
  void handleGetStats(req, res)
}
