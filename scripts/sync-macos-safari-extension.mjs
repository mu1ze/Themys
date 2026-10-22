#!/usr/bin/env node
import { cp, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const resources = resolve(root, "macos", "ThemysSafariExtension", "Resources")
const artifact = resolve(root, "artifacts", "extension", process.env.THEMYS_MACOS_ARTIFACT ?? "production")
await mkdir(resolve(resources, "detection"), { recursive: true })
await cp(resolve(artifact, "detection/themys-detection.js"), resolve(resources, "detection/themys-detection.js"))
await cp(resolve(artifact, "detection/themys-capture-policy.js"), resolve(resources, "detection/themys-capture-policy.js"))
await cp(resolve(artifact, "overlay.js"), resolve(resources, "overlay.js"))
await cp(resolve(artifact, "popup-detector.js"), resolve(resources, "popup-detector.js"))

const chromeBackground = await readFile(resolve(artifact, "background.js"), "utf8")
const chromeContent = await readFile(resolve(artifact, "content.js"), "utf8")
const browserAdapter = `const chrome = (() => {
  const api = typeof browser !== "undefined" ? browser : globalThis.chrome;
  if (!api) return api;
  const callbackify = (namespace, method) => (...args) => {
    const callback = typeof args.at(-1) === "function" ? args.pop() : null;
    const result = namespace[method](...args);
    if (callback && result?.then) result.then(callback);
    return result;
  };
  const local = api.storage?.local;
  const storage = local ? { ...api.storage, local: {
    ...local,
    get: callbackify(local, "get"),
    set: callbackify(local, "set"),
    remove: callbackify(local, "remove"),
  } } : api.storage;
  const tabs = api.tabs ? { ...api.tabs,
    create: callbackify(api.tabs, "create"),
    remove: callbackify(api.tabs, "remove"),
    update: callbackify(api.tabs, "update"),
    query: callbackify(api.tabs, "query"),
    sendMessage: callbackify(api.tabs, "sendMessage"),
  } : api.tabs;
  const alarms = api.alarms ? { ...api.alarms,
    create: callbackify(api.alarms, "create"),
    clear: callbackify(api.alarms, "clear"),
  } : api.alarms;
  const adaptMessageEvent = (event) => event ? {
    addListener(listener) {
      event.addListener((message, sender) => {
        let respond;
        const response = new Promise((resolve) => { respond = resolve; });
        const result = listener(message, sender, (value) => respond(value));
        if (result && typeof result.then === "function") return result;
        if (result === true) return response;
        return result;
      });
    },
  } : event;
  const runtime = api.runtime ? {
    ...api.runtime,
    onMessage: adaptMessageEvent(api.runtime.onMessage),
    onMessageExternal: adaptMessageEvent(api.runtime.onMessageExternal),
  } : api.runtime;
  return { ...api, storage, tabs, alarms, runtime };
})();
`
await writeFile(resolve(resources, "background.js"), browserAdapter + chromeBackground)
await writeFile(resolve(resources, "content.js"), browserAdapter + chromeContent)
await writeFile(resolve(resources, "config.js"), `globalThis.THEMYS_CONFIG = Object.freeze(${JSON.stringify({
  environment: process.env.THEMYS_MACOS_ENVIRONMENT ?? "production",
  appOrigin: process.env.THEMYS_PRODUCTION_ORIGIN ?? "https://themys.ca",
  platform: "safari-macos",
}, null, 2)});\n`)
console.log("Synced macOS Safari extension resources")
