import type { MarketingAcquisitionSource } from "@elm-chat/shared";

type ClientGrowthEvent = "make_your_own_clicked" | "marketing_cta_clicked";

export function recordGrowthEvent(
  event: ClientGrowthEvent,
  source?: MarketingAcquisitionSource
): void {
  const body = JSON.stringify({ event, source });
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/growth", new Blob([body], { type: "application/json" }));
    return;
  }
  void fetch("/api/growth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true
  });
}
