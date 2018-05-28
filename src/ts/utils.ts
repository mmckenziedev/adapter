/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
/* eslint-env node */
let logDisabled_ = true;
let deprecationWarnings_ = true;

/**
 * Extract browser version out of the provided user agent string.
 *
 * @param {!string} uastring userAgent string.
 * @param {!string} expr Regular expression used as match criteria.
 * @param {!number} pos position in the version string to be returned.
 * @return {!number} browser version.
 */
export function extractVersion(
  uastring: string,
  expr: RegExp,
  pos: number
): number | null {
  const match = uastring.match(expr);

  if (match !== null && match.length >= pos) {
    return parseInt(match[pos], 10);
  } else {
    return null;
  }
}

// Wraps the peerconnection event eventNameToWrap in a function
// which returns the modified event object.
export function wrapPeerConnectionEvent(
  window: Window,
  eventNameToWrap: string,
  wrapper: Function
) {
  if (!window.RTCPeerConnection) {
    return;
  }
  const proto = window.RTCPeerConnection.prototype;
  const nativeAddEventListener = proto.addEventListener;
  proto.addEventListener = function(nativeEventName: string, cb: Function) {
    if (nativeEventName !== eventNameToWrap) {
      return nativeAddEventListener.apply(this, arguments);
    }
    const wrappedCallback = (e: Event) => {
      cb(wrapper(e));
    };
    this._eventMap = this._eventMap || {};
    this._eventMap[cb] = wrappedCallback;
    return nativeAddEventListener.apply(this, [
      nativeEventName,
      wrappedCallback
    ]);
  };

  const nativeRemoveEventListener = proto.removeEventListener;
  proto.removeEventListener = function(nativeEventName: string, cb: Function) {
    if (
      nativeEventName !== eventNameToWrap ||
      !this._eventMap ||
      !this._eventMap[cb]
    ) {
      return nativeRemoveEventListener.apply(this, arguments);
    }
    const unwrappedCb = this._eventMap[cb];
    delete this._eventMap[cb];
    return nativeRemoveEventListener.apply(this, [
      nativeEventName,
      unwrappedCb
    ]);
  };

  Object.defineProperty(proto, `on${eventNameToWrap}`, {
    get() {
      return this[`_on${eventNameToWrap}`];
    },
    set(cb) {
      if (this[`_on${eventNameToWrap}`]) {
        this.removeEventListener(
          eventNameToWrap,
          this[`_on${eventNameToWrap}`]
        );
        delete this[`_on${eventNameToWrap}`];
      }
      if (cb) {
        this.addEventListener(
          eventNameToWrap,
          (this[`_on${eventNameToWrap}`] = cb)
        );
      }
    },
    enumerable: true,
    configurable: true
  });
}

// Utility methods.
export function disableLog(bool: boolean) {
  if (typeof bool !== "boolean") {
    return new Error(`Argument type: ${typeof bool}. Please use a boolean.`);
  }
  logDisabled_ = bool;
  return bool ? "adapter.js logging disabled" : "adapter.js logging enabled";
}

/**
 * Disable or enable deprecation warnings
 * @param {!boolean} bool set to true to disable warnings.
 */
export function disableWarnings(bool: boolean) {
  if (typeof bool !== "boolean") {
    return new Error(`Argument type: ${typeof bool}. Please use a boolean.`);
  }
  deprecationWarnings_ = !bool;
  return `adapter.js deprecation warnings ${bool ? "disabled" : "enabled"}`;
}

export function log(...args: any[]) {
  if (typeof window === "object") {
    if (logDisabled_) {
      return;
    }
    if (typeof console !== "undefined" && typeof console.log === "function") {
      console.log.apply(console, arguments);
    }
  }
}

/**
 * Shows a deprecation warning suggesting the modern and spec-compatible API.
 */
export function deprecated(oldMethod, newMethod) {
  if (!deprecationWarnings_) {
    return;
  }
  console.warn(`${oldMethod} is deprecated, please use ${newMethod} instead.`);
}

export interface BrowserResult {
  browser: string | null;
  version: number | null;
}

/**
 * Browser detector.
 *
 * @return {object} result containing browser and version
 *     properties.
 */
export function detectBrowser(window: Window) {
  const navigator = window && window.navigator;

  // Returned result object.
  const result: BrowserResult = {} as BrowserResult;
  result.browser = null;
  result.version = null;

  // Fail early if it's not a browser
  if (typeof window === "undefined" || !window.navigator) {
    result.browser = "Not a browser.";
    return result;
  }

  if (navigator.mozGetUserMedia) {
    // Firefox.
    result.browser = "firefox";
    result.version = extractVersion(navigator.userAgent, /Firefox\/(\d+)\./, 1);
  } else if (navigator.webkitGetUserMedia) {
    // Chrome, Chromium, Webview, Opera.
    // Version matches Chrome/WebRTC version.
    result.browser = "chrome";
    result.version = extractVersion(
      navigator.userAgent,
      /Chrom(e|ium)\/(\d+)\./,
      2
    );
  } else if (
    navigator.mediaDevices &&
    navigator.userAgent.match(/Edge\/(\d+).(\d+)$/)
  ) {
    // Edge.
    result.browser = "edge";
    result.version = extractVersion(
      navigator.userAgent,
      /Edge\/(\d+).(\d+)$/,
      2
    );
  } else if (
    window.RTCPeerConnection &&
    navigator.userAgent.match(/AppleWebKit\/(\d+)\./)
  ) {
    // Safari.
    result.browser = "safari";
    result.version = extractVersion(
      navigator.userAgent,
      /AppleWebKit\/(\d+)\./,
      1
    );
  } else {
    // Default fallthrough: not supported.
    result.browser = "Not a supported browser.";
    return result;
  }

  return result;
}
