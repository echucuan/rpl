// Regenerates src/data/motors.json and src/data/parts.json from an OpenRocket installation.
//
// Usage (from the project folder):
//   node scripts/extract-openrocket-data.mjs "C:\Program Files\OpenRocket\jar\OpenRocket-24.12.jar"
//
// Motors come from datafiles/thrustcurves/thrustcurves.ser (a Java-serialized list of
// ThrustCurveMotor objects). Parts come from the Estes component databases
// (datafiles/components/database/estes_*.orc, Apache-2.0 licensed).
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const jar = process.argv[2];
if (!jar) {
  console.error("Indica la ruta del archivo OpenRocket-*.jar");
  process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), "rpl-or-"));
const wanted = [
  "datafiles/thrustcurves/thrustcurves.ser",
  "datafiles/components/database/estes_classic.orc",
  "datafiles/components/database/estes_ps2.orc",
];
// Windows' bsdtar reads zip files; GNU tar (e.g. from Git Bash) does not.
const tar = process.platform === "win32" ? join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe") : "bsdtar";
execFileSync(tar, ["-xf", jar, "-C", tmp, ...wanted]);

writeFileSync("src/data/motors.json", JSON.stringify(extractMotors(join(tmp, wanted[0]))));
const parts = [wanted[1], wanted[2]].flatMap((f) => extractParts(readFileSync(join(tmp, f), "utf8")));
writeFileSync("src/data/parts.json", JSON.stringify(dedupeParts(parts), null, 1));
rmSync(tmp, { recursive: true, force: true });

// ---------------------------------------------------------------- motors

function extractMotors(file) {
  const all = readJavaSerialized(readFileSync(file)).$items;
  const byName = new Map();
  for (const m of all) {
    const mfr = m.manufacturer?.displayName ?? "";
    if (!/estes/i.test(mfr) || !m.available) continue;
    if (m.totalImpulse > 160) continue; // Estes only makes up to F class; skip mislabelled entries
    const motor = {
      id: m.commonName,
      name: m.commonName,
      diameter: round(m.diameter * 1000, 1), // mm
      length: round(m.length * 1000, 1), // mm
      delays: (m.delays ?? []).filter((d) => Number.isFinite(d) && d < 50),
      totalImpulse: round(m.totalImpulse, 2), // N·s
      averageThrust: round(m.averageThrust, 2), // N
      maxThrust: round(m.maxThrust, 2), // N
      burnTime: round(m.burnTimeEstimate, 3), // s
      propellant: m.propellantInfo ?? "",
      time: m.time.map((t) => round(t, 4)),
      thrust: m.thrust.map((f) => round(f, 3)),
      mass: m.cg.map((c) => round(c.weight * 1000, 2)), // g, total motor mass at each time point
    };
    // Several test curves exist for most motors; keep the most detailed one and
    // the union of the delays listed across them.
    const prev = byName.get(motor.id);
    if (prev) motor.delays = [...new Set([...prev.delays, ...motor.delays])];
    if (!prev || motor.time.length > prev.time.length) byName.set(motor.id, motor);
    else prev.delays = motor.delays;
  }
  for (const m of byName.values()) m.delays.sort((a, b) => a - b);
  const classOrder = (n) => "1/4A 1/2A A B C D E F".split(" ").findIndex((c) => n.replace(/\d+.*$/, "") === c);
  return [...byName.values()].sort((a, b) => classOrder(a.name) - classOrder(b.name) || a.averageThrust - b.averageThrust);
}

// ---------------------------------------------------------------- parts

function extractParts(xml) {
  const materials = new Map();
  for (const m of xml.matchAll(/<Material UnitsOfMeasure="([^"]*)">([\s\S]*?)<\/Material>/g)) {
    materials.set(tag(m[2], "Name"), { density: Number(tag(m[2], "Density")), type: tag(m[2], "Type") });
  }
  const out = [];
  const kinds = { BodyTube: "bodyTube", NoseCone: "noseCone", Parachute: "parachute", LaunchLug: "launchLug", EngineBlock: "engineBlock", CenteringRing: "centeringRing", TubeCoupler: "tubeCoupler" };
  for (const [xmlTag, kind] of Object.entries(kinds)) {
    for (const m of xml.matchAll(new RegExp(`<${xmlTag}>([\\s\\S]*?)</${xmlTag}>`, "g"))) {
      const body = m[1];
      const materialName = tag(body, "Material");
      const material = materials.get(materialName);
      const part = {
        kind,
        partNumber: tag(body, "PartNumber"),
        description: tag(body, "Description"),
        material: materialName,
        density: material?.density, // kg/m³, kg/m² for SURFACE, kg/m for LINE
      };
      for (const f of ["InsideDiameter", "OutsideDiameter", "Length", "ShoulderDiameter", "ShoulderLength", "Diameter", "LineLength", "Thickness"]) {
        const v = length(body, f);
        if (v !== undefined) part[f[0].toLowerCase() + f.slice(1)] = v;
      }
      const shape = tag(body, "Shape");
      if (shape) part.shape = shape.toLowerCase();
      const filled = tag(body, "Filled");
      if (filled) part.filled = filled === "true";
      const lines = tag(body, "LineCount");
      if (lines) part.lineCount = Number(lines);
      const lineMaterial = materials.get(tag(body, "LineMaterial"));
      if (lineMaterial) part.lineDensity = lineMaterial.density;
      const mass = length(body, "Mass", { g: 1, kg: 1000, oz: 28.3495 });
      if (mass !== undefined) part.mass = mass;
      out.push(part);
    }
  }
  return out;
}

function dedupeParts(parts) {
  const seen = new Set();
  return parts.filter((p) => {
    const key = `${p.kind}|${p.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function tag(body, name) {
  const m = body.match(new RegExp(`<${name}(?:\\s[^>]*)?>([^<]*)</${name}>`));
  return m ? m[1].trim() : undefined;
}

// Lengths are returned in millimetres (or grams when a mass scale is given).
function length(body, name, scale = { in: 25.4, mm: 1, cm: 10, m: 1000, ft: 304.8 }) {
  const m = body.match(new RegExp(`<${name}(?:\\s+Unit="([^"]*)")?>([^<]*)</${name}>`));
  if (!m) return undefined;
  const unit = m[1] ?? Object.keys(scale)[0];
  if (!(unit in scale)) throw new Error(`Unidad desconocida ${unit} en ${name}`);
  return round(Number(m[2]) * scale[unit], 3);
}

function round(v, d) {
  const k = 10 ** d;
  return Math.round(v * k) / k;
}

// ---------------------------------------------------------------- Java serialization

// Minimal reader for the Java Object Serialization Stream format: enough for
// OpenRocket's motor database (objects, arrays, strings, enums, back-references,
// and ArrayList's custom writeObject data).
function readJavaSerialized(buf) {
  let p = 0;
  const handles = [];
  const BASE = 0x7e0000;
  const u8 = () => buf[p++];
  const u16 = () => { const v = buf.readUInt16BE(p); p += 2; return v; };
  const i32 = () => { const v = buf.readInt32BE(p); p += 4; return v; };
  const i64 = () => { const v = buf.readBigInt64BE(p); p += 8; return Number(v); };
  const utf = () => { const n = u16(); const s = buf.toString("utf8", p, p + n); p += n; return s; };
  const keep = (o) => { handles.push(o); return o; };

  const prim = (t) => {
    switch (t) {
      case "B": return buf.readInt8(p++);
      case "C": return String.fromCharCode(u16());
      case "D": { const v = buf.readDoubleBE(p); p += 8; return v; }
      case "F": { const v = buf.readFloatBE(p); p += 4; return v; }
      case "I": return i32();
      case "J": return i64();
      case "S": { const v = buf.readInt16BE(p); p += 2; return v; }
      case "Z": return u8() !== 0;
    }
    throw new Error(`Tipo primitivo desconocido ${t}`);
  };

  const classDesc = () => {
    const tc = u8();
    if (tc === 0x70) return null;
    if (tc === 0x71) return handles[i32() - BASE];
    if (tc !== 0x72) throw new Error(`Se esperaba una clase en ${p}`);
    const desc = keep({ name: utf() });
    p += 8; // serialVersionUID
    desc.flags = u8();
    desc.fields = [];
    for (let i = u16(); i > 0; i--) {
      const type = String.fromCharCode(u8());
      const name = utf();
      if (type === "L" || type === "[") content();
      desc.fields.push({ type, name });
    }
    annotations();
    desc.super = classDesc();
    return desc;
  };

  const annotations = () => {
    const out = [];
    while (buf[p] !== 0x78) out.push(content());
    p++;
    return out;
  };

  const content = () => {
    const tc = u8();
    switch (tc) {
      case 0x70: return null;
      case 0x71: return handles[i32() - BASE];
      case 0x74: return keep(utf());
      case 0x77: { const n = u8(); p += n; return { block: true }; }
      case 0x7a: { const n = i32(); p += n; return { block: true }; }
      case 0x7e: { classDesc(); const slot = handles.length; keep(null); const v = content(); handles[slot] = v; return v; }
      case 0x72: p--; return classDesc();
      case 0x75: {
        const d = classDesc();
        const arr = keep([]);
        const et = d.name[1];
        for (let n = i32(); n > 0; n--) arr.push(et === "L" || et === "[" ? content() : prim(et));
        return arr;
      }
      case 0x73: {
        const d = classDesc();
        const obj = keep({});
        const chain = [];
        for (let c = d; c; c = c.super) chain.unshift(c);
        for (const c of chain) {
          for (const f of c.fields) obj[f.name] = f.type === "L" || f.type === "[" ? content() : prim(f.type);
          if (c.flags & 0x01) {
            const extra = annotations().filter((x) => !(x && x.block));
            if (c.name === "java.util.ArrayList") obj.$items = extra;
          }
        }
        return obj;
      }
    }
    throw new Error(`Código desconocido 0x${tc.toString(16)} en ${p}`);
  };

  if (u16() !== 0xaced || u16() !== 5) throw new Error("No es un archivo serializado de Java");
  return content();
}
