import { useEffect, useRef, useState, useCallback } from "react";

// Stream analytics updates over SSE or WebSocket.
export function useAnalyticsStream({
  mode = "sse",
  url,
  params,
  enabled = true,
  onMessage,
  onStatus,
}) {
  const ref = useRef({
    es: null,
    ws: null,
    retry: 0,
    closedByUser: false,
  });

  const [status, setStatus] = useState("idle"); // idle|connecting|open|error|closed

  const setBothStatus = useCallback(
    (s) => {
      setStatus(s);
      onStatus?.(s);
    },
    [onStatus],
  );

  useEffect(() => {
    if (!enabled || !url) return;

    ref.current.closedByUser = false;
    setBothStatus("connecting");

    const backoffMs = (attempt) => Math.min(15000, 500 * Math.pow(1.8, attempt));

    const connectSSE = () => {
      const qs = params
        ? "?" +
          new URLSearchParams(
            Object.entries(params).reduce((acc, [k, v]) => {
              acc[k] = typeof v === "string" ? v : JSON.stringify(v);
              return acc;
            }, {}),
          ).toString()
        : "";

      const es = new EventSource(`${url}${qs}`, { withCredentials: true });
      ref.current.es = es;

      es.onopen = () => {
        ref.current.retry = 0;
        setBothStatus("open");
      };

      es.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          onMessage?.(parsed);
        } catch {
          // ignore malformed events
        }
      };

      es.onerror = () => {
        setBothStatus("error");
        es.close();
        if (ref.current.closedByUser) return;

        const t = backoffMs(ref.current.retry++);
        setTimeout(() => {
          if (!ref.current.closedByUser) connectSSE();
        }, t);
      };
    };

    const connectWS = () => {
      const ws = new WebSocket(url);
      ref.current.ws = ws;

      ws.onopen = () => {
        ref.current.retry = 0;
        setBothStatus("open");
        if (params) {
          ws.send(JSON.stringify({ action: "subscribe", ...params }));
        }
      };

      ws.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          onMessage?.(parsed);
        } catch {
          // ignore
        }
      };

      ws.onerror = () => setBothStatus("error");

      ws.onclose = () => {
        setBothStatus("closed");
        if (ref.current.closedByUser) return;

        const t = backoffMs(ref.current.retry++);
        setTimeout(() => {
          if (!ref.current.closedByUser) connectWS();
        }, t);
      };
    };

    if (mode === "sse") connectSSE();
    else connectWS();

    return () => {
      ref.current.closedByUser = true;
      ref.current.es?.close?.();
      ref.current.ws?.close?.();
      ref.current.es = null;
      ref.current.ws = null;
      setBothStatus("closed");
    };
  }, [enabled, url, mode, params, onMessage, setBothStatus]);

  return { status };
}
