import React from "react";
import { Caption } from "./Caption";

export function Utf8ArrayToStr(array: Uint8Array): string {
  var out, i, len, c;
  var char2, char3;

  out = "";
  len = array.length;
  i = 0;
  while (i < len) {
    c = array[i++];
    switch (c >> 4) {
      case 0:
      case 1:
      case 2:
      case 3:
      case 4:
      case 5:
      case 6:
      case 7:
        // 0xxxxxxx
        out += String.fromCharCode(c);
        break;
      case 12:
      case 13:
        // 110x xxxx   10xx xxxx
        char2 = array[i++];
        out += String.fromCharCode(((c & 0x1f) << 6) | (char2 & 0x3f));
        break;
      case 14:
        // 1110 xxxx  10xx xxxx  10xx xxxx
        char2 = array[i++];
        char3 = array[i++];
        out += String.fromCharCode(
          ((c & 0x0f) << 12) | ((char2 & 0x3f) << 6) | ((char3 & 0x3f) << 0)
        );
        break;
    }
  }

  return out;
}

export const toSeconds = (raw: string): number => {
  if (!raw) return 0;
  const [h, m, s] = raw.split(":").map(parseFloat);
  return h * 60 * 60 + m * 60 + s;
};
export const parserFactory = (
  dispatch: React.Dispatch<{
    array?: Caption[];
    clear: boolean;
    done: boolean;
    chunk: number;
  }>
) =>
  new WritableStream({
    start(controller: any) {
      controller.chunk = -1;
      dispatch({ chunk: controller.chunk, clear: true, done: false });
      controller.holdover = "";
    },
    close() {
      dispatch({ chunk: -1, clear: false, done: true });
    },
    write(chunk: Uint8Array, controller: any) {
      controller.chunk++;
      const stringy = Utf8ArrayToStr(chunk);
      const lines = `${controller.holdover}${stringy}`
        .split(/\r\n\r\n/)
        .filter((line) => /\d/.test(line));
      if (!/\r\n$/.test(lines[lines.length - 1] || ""))
        controller.holdover = lines.pop();
      const array = lines
        .map((string) => string.split("\r\n"))
        .map(([times, rawText]) => {
          const [, startRaw, endRaw, align] =
            times?.match(/([^ ]+) --> ([^ ]+)(align:\w+)?/) || [];
          const [, voice, text] = rawText?.match(/^<v ([^>]+)> (.+)$/) || [];
          return { startRaw, endRaw, align, voice, text };
        })
        .map((d) => ({ ...d, end: toSeconds(d.endRaw) }))
        .map((d) => ({ ...d, start: toSeconds(d.startRaw) }));
      dispatch({ chunk: controller.chunk, array, clear: false, done: false });
    },
  });
export const format = (raw: number): string => {
  const hours = Math.floor(raw / (60 * 60));
  const minutes = Math.floor((raw - hours * 60 * 60) / 60);
  const seconds = raw - hours * 60 * 60 - minutes * 60;
  return `${hours.toFixed(0).padStart(2, "0")}:${minutes
    .toFixed(0)
    .padStart(2, "0")}:${seconds.toFixed(5).padStart(2)}`;
};