// @ts-nocheck
import supportsColor from "supports-color";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const Time = {
  millisecond: 1,
  second: 1000,
  minute: 1000 * 60,
  hour: 1000 * 60 * 60,
  day: 1000 * 60 * 60 * 24,
  week: 1000 * 60 * 60 * 24 * 7,

  timezoneOffset: new Date().getTimezoneOffset(),

  setTimezoneOffset(offset: number) {
    Time.timezoneOffset = offset;
  },

  getTimezoneOffset() {
    return Time.timezoneOffset;
  },

  getDateNumber(date: number | Date = new Date(), offset?: number) {
    if (typeof date === "number") date = new Date(date);
    if (offset === undefined) offset = Time.timezoneOffset;
    return Math.floor((date.valueOf() / Time.minute - offset) / 1440);
  },

  fromDateNumber(value: number, offset?: number) {
    const date = new Date(value * Time.day);
    if (offset === undefined) offset = Time.timezoneOffset;
    return new Date(+date + offset * Time.minute);
  },

  numeric: /\d+(?:\.\d+)?/.source,
  get timeRegExp() {
    return new RegExp(
      `^${[
        "w(?:eek(?:s)?)?",
        "d(?:ay(?:s)?)?",
        "h(?:our(?:s)?)?",
        "m(?:in(?:ute)?(?:s)?)?",
        "s(?:ec(?:ond)?(?:s)?)?",
      ]
        .map((unit) => `(${this.numeric}${unit})?`)
        .join("")}$`,
    );
  },

  parseTime(source: string) {
    const capture = Time.timeRegExp.exec(source);
    if (!capture) return 0;
    return (
      (Number.parseFloat(capture[1]) * Time.week || 0) +
      (Number.parseFloat(capture[2]) * Time.day || 0) +
      (Number.parseFloat(capture[3]) * Time.hour || 0) +
      (Number.parseFloat(capture[4]) * Time.minute || 0) +
      (Number.parseFloat(capture[5]) * Time.second || 0)
    );
  },

  parseDate(date: string) {
    const parsed = Time.parseTime(date);
    if (parsed) {
      date = (Date.now() + parsed).toString();
    } else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date)) {
      date = `${new Date().toLocaleDateString()}-${date}`;
    } else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date)) {
      date = `${new Date().getFullYear()}-${date}`;
    }
    return date ? new Date(date) : new Date();
  },

  format(ms: number) {
    const abs = Math.abs(ms);
    if (abs >= Time.day - Time.hour / 2) {
      return `${Math.round(ms / Time.day)}d`;
    }
    if (abs >= Time.hour - Time.minute / 2) {
      return `${Math.round(ms / Time.hour)}h`;
    }
    if (abs >= Time.minute - Time.second / 2) {
      return `${Math.round(ms / Time.minute)}m`;
    }
    if (abs >= Time.second) {
      return `${Math.round(ms / Time.second)}s`;
    }
    return `${ms}ms`;
  },

  toDigits(source: number, length = 2) {
    return source.toString().padStart(length, "0");
  },

  template(template: string, time = new Date()) {
    return template
      .replace("yyyy", time.getFullYear().toString())
      .replace("yy", time.getFullYear().toString().slice(2))
      .replace("MM", Time.toDigits(time.getMonth() + 1))
      .replace("dd", Time.toDigits(time.getDate()))
      .replace("hh", Time.toDigits(time.getHours()))
      .replace("mm", Time.toDigits(time.getMinutes()))
      .replace("ss", Time.toDigits(time.getSeconds()))
      .replace("SSS", Time.toDigits(time.getMilliseconds(), 3));
  },
};

const c16 = [6, 2, 3, 4, 5, 1];
const c256 = [
  20, 21, 26, 27, 32, 33, 38, 39, 40, 41, 42, 43, 44, 45, 56, 57, 62, 63, 68, 69, 74, 75, 76, 77,
  78, 79, 80, 81, 92, 93, 98, 99, 112, 113, 129, 134, 135, 148, 149, 160, 161, 162, 163, 164, 165,
  166, 167, 168, 169, 170, 171, 172, 173, 178, 179, 184, 185, 196, 197, 198, 199, 200, 201, 202,
  203, 204, 205, 206, 207, 208, 209, 214, 215, 220, 221,
];

export interface LevelConfig {
  base: number;
  [K: string]: Level;
}

export type Level = number | LevelConfig;
export type LogType = "success" | "error" | "info" | "warn" | "debug";
export type Formatter = (value: string, target: Target, logger: Logger) => unknown;

export interface LabelStyle {
  width?: number;
  margin?: number;
  align?: "left" | "right";
}

export interface Record {
  id: number;
  meta: { namespace: string };
  name: string;
  type: LogType;
  level: number;
  content: string;
  timestamp: number;
}

export interface Target {
  /**
   * - 0: no color support
   * - 1: 16 color support
   * - 2: 256 color support
   * - 3: truecolor support
   */
  colors?: false | number;
  showDiff?: boolean;
  showTime?: string;
  label?: LabelStyle;
  maxLength?: number;
  record?(record: Record): void;
  print?(text: string): void;
  levels?: LevelConfig;
  timestamp?: number;
}

function isAggregateError(
  error: unknown | (Error & { errors: Error[] }),
): error is Error & { errors: Error[] } {
  return error instanceof Error && "errors" in error && Array.isArray(error.errors);
}

export type LoggerType = Logger &
  typeof Logger & {
    info: (...args) => void;
    warn: (...args) => void;
    debug: (...args) => void;
    error: (...args) => void;
    success: (...args) => void;
  };

export class Logger {
  constructor(
    public name: string,
    public meta?: [],
    private namespace?: string,
  ) {
    this.createMethod("success", Logger.SUCCESS);
    this.createMethod("error", Logger.ERROR);
    this.createMethod("info", Logger.INFO);
    this.createMethod("warn", Logger.WARN);
    this.createMethod("debug", Logger.DEBUG);
  }
  static readonly SILENT = 0;
  static readonly SUCCESS = 1;
  static readonly ERROR = 1;
  static readonly INFO = 2;
  static readonly WARN = 2;
  static readonly DEBUG = 3;

  // Global configuration
  static id = 0;
  static targets: Target[] = [];
  static formatters = Object.create(null);

  static levels: LevelConfig = {
    base: 2,
  };

  static format(name: string, formatter: Formatter) {
    Logger.formatters[name] = formatter;
  }

  static color(target: Target, code: number, value: string, decoration = "") {
    if (!target.colors) return `${value}`;
    return `\u001b[3${code < 8 ? code : `8;5;${code}`}${target.colors >= 2 ? decoration : ""}m${value}\u001b[0m`;
  }

  static code(name: string, target: Target) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = hash * 8 - hash + name.charCodeAt(i) + 13;
      hash = Math.trunc(hash);
    }
    const colors = !target.colors ? [] : target.colors >= 2 ? c256 : c16;
    return colors[Math.abs(hash) % colors.length];
  }

  static render(target: Target, record: Record) {
    const prefix = `[${record.type[0].toUpperCase()}]`;
    const space = " ".repeat(target.label?.margin ?? 1);
    let indent = 3 + space.length;
    let output = "";
    if (target.showTime) {
      indent += target.showTime.length + space.length;
      output += Logger.color(target, 8, Time.template(target.showTime)) + space;
    }
    const displayName = record.meta?.namespace || record.name;
    const code = Logger.code(displayName, target);
    const label = Logger.color(target, code, displayName, ";1");
    const padLength = (target.label?.width ?? 0) + label.length - displayName.length;
    if (target.label?.align === "right") {
      output += label.padStart(padLength) + space + prefix + space;
      indent += (target.label.width ?? 0) + space.length;
    } else {
      output += prefix + space + label.padEnd(padLength) + space;
    }
    output += record.content.replace(/\n/g, `\n${" ".repeat(indent)}`);
    if (target.showDiff && target.timestamp) {
      const diff = record.timestamp - target.timestamp;
      output += Logger.color(target, code, ` +${diff}`);
    }
    return output;
  }

  extend(namespace: string) {
    return new Logger(`${this.name}:${namespace}`, this.meta);
  }

  createMethod(type: LogType, level: number) {
    this[type] = (...args) => {
      if (args.length === 1 && args[0] instanceof Error) {
        if (args[0].cause) {
          this[type](args[0].cause);
        } else if (isAggregateError(args[0])) {
          args[0].errors.forEach((error) => {
            this[type](error);
          });
          return;
        }
      }
      const id = ++Logger.id;
      const timestamp = Date.now();
      for (const target of Logger.targets) {
        if (this.getLevel(target) < level) continue;
        const content = this.formatMessage(target, ...args);
        const record: Record = {
          id,
          type,
          level,
          name: this.name,
          meta: { ...this.meta, namespace: this.namespace },
          content,
          timestamp,
        };
        if (target.record) {
          target.record(record);
        } else if (target.print) {
          target.print(Logger.render(target, record));
        }
        target.timestamp = timestamp;
      }
    };
  }

  private formatMessage(target: Target, ...args: unknown[]) {
    if (args[0] instanceof Error) {
      args[0] = args[0].stack || args[0].message;
      args.unshift("%s");
    } else if (typeof args[0] !== "string") {
      args.unshift("%o");
    }

    let format: string = args.shift() as string;
    format = format.replace(/%([a-zA-Z%])/g, (match, char) => {
      if (match === "%%") return "%";
      const formatter = Logger.formatters[char];
      if (typeof formatter === "function") {
        const value = args.shift() as string;
        return formatter(value, target, this);
      }
      return match;
    });

    const { maxLength = 10240 } = target;
    return format
      .split(/\r?\n/g)
      .map((line) => line.slice(0, maxLength) + (line.length > maxLength ? "..." : ""))
      .join("\n");
  }

  getLevel(target?: Target) {
    const paths = this.name.split(":");
    let config: Level = target?.levels || Logger.levels;
    do {
      config = config[paths.shift()] ?? config.base;
    } while (paths.length && typeof config === "object");
    return config as number;
  }
}

Logger.format("s", (value) => value);
Logger.format("d", (value) => +value);
Logger.format("j", (value) => JSON.stringify(value));
Logger.format("c", (value, target, logger) => {
  return Logger.color(target, Logger.code(logger.name, target), value);
});
Logger.format("C", (value, target) => {
  return Logger.color(target, 15, value, ";1");
});

Logger.targets = [];
Logger.targets.push({
  showTime: "yyyy-MM-dd hh:mm:ss.SSS",
  colors: supportsColor.stdout ? supportsColor.stdout.level : 0,
  print(text) {
    console.log(text)
  },
});