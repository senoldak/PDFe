import { vi } from "vitest";

const addListener = () => {};

globalThis.chrome = {
  runtime: {
    getURL: (p: string) => `chrome-extension://__EXTENSION_ID__/${p}`,
    onInstalled: { addListener },
    onStartup: { addListener },
    onMessage: { addListener },
  },
  webNavigation: { onBeforeNavigate: { addListener } },
  extension: { isAllowedFileSchemeAccess: vi.fn() },
  tabs: { update: vi.fn() },
  declarativeNetRequest: {
    getDynamicRules: vi.fn(async () => []),
    updateDynamicRules: vi.fn(async () => {}),
  },
} as any;