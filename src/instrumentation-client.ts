import * as Sentry from "@sentry/browser";
import { scrubSentryEvent } from "@/lib/sentry-privacy";

Sentry.init({
  dsn: "https://3857ba083d63d5093c89c565d2d85d7f@o4511594216423424.ingest.us.sentry.io/4511609777815555",
  sendDefaultPii: false,
  beforeSend: scrubSentryEvent,
});
