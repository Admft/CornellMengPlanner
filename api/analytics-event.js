import { handleAnalyticsEvent } from '../server/analyticsHandler.js'

export default function handler(req, res) {
  void handleAnalyticsEvent(req, res)
}
