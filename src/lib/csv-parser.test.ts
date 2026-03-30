import { describe, it, expect } from "vitest";
import { parseCSV } from "./csv-parser";

describe("parseCSV", () => {
  it("parses a normal CSV", () => {
    const result = parseCSV("a,b,c\n1,2,3");
    expect(result.headers).toEqual(["a", "b", "c"]);
    expect(result.rows).toEqual([["1", "2", "3"]]);
  });

  it("handles multiline quoted fields (RFC 4180)", () => {
    const csv = '"a","b"\n"hello\nworld","test"';
    const result = parseCSV(csv);
    expect(result.headers).toEqual(["a", "b"]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0][0]).toBe("hello\nworld");
    expect(result.rows[0][1]).toBe("test");
  });

  it("handles escaped quotes within quoted fields", () => {
    const csv = '"a"\n"say ""hello""","ok"';
    const result = parseCSV(csv);
    expect(result.headers).toEqual(["a"]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0][0]).toBe('say "hello"');
    expect(result.rows[0][1]).toBe("ok");
  });

  it("handles Windows line endings (\\r\\n)", () => {
    const csv = "a,b\r\n1,2\r\n3,4";
    const result = parseCSV(csv);
    expect(result.headers).toEqual(["a", "b"]);
    expect(result.rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("skips empty lines between rows", () => {
    const csv = "a,b\n\n1,2\n\n3,4";
    const result = parseCSV(csv);
    expect(result.headers).toEqual(["a", "b"]);
    expect(result.rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("handles trailing newline without creating extra row", () => {
    const csv = "a,b\n1,2\n";
    const result = parseCSV(csv);
    expect(result.headers).toEqual(["a", "b"]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual(["1", "2"]);
  });
});
