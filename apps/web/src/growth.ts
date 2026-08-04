import {
  isExternalAcquisitionSource,
  type ExternalAcquisitionSource,
  type NonInviteAcquisitionSource
} from "@elm-chat/shared";

const EXTERNAL_REFERRER_SOURCES: Readonly<Record<string, ExternalAcquisitionSource>> = {
  "freestartuplisting.org": "free-startup-listing",
  "www.freestartuplisting.org": "free-startup-listing",
  "www.zearches.com": "zearches",
  "zearches.com": "zearches"
};

export function resolveExternalAcquisitionSource(
  sourceParam: string | null,
  referrer: string
): ExternalAcquisitionSource | null {
  if (isExternalAcquisitionSource(sourceParam)) {
    return sourceParam;
  }

  if (!referrer) {
    return null;
  }

  try {
    return EXTERNAL_REFERRER_SOURCES[new URL(referrer).hostname.toLowerCase()] ?? null;
  } catch {
    return null;
  }
}

type ClientGrowthEvent =
  | "make_your_own_clicked"
  | "invite_share_handoff"
  | "marketing_page_viewed"
  | "marketing_cta_clicked"
  | "marketing_source_clicked"
  | "marketing_deploy_clicked"
  | "external_referral_viewed"
  | "external_source_clicked"
  | "external_deploy_clicked"
  | "github_star_clicked"
  | "good_first_issue_clicked";

export function recordGrowthEvent(
  event: ClientGrowthEvent,
  source?: NonInviteAcquisitionSource
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
