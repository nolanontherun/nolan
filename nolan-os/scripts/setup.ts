import fs from "node:fs";
import path from "node:path";
import { getDb } from "../src/lib/db";
import { applyDefaults, loadSeed } from "../src/lib/seed";

const seedPath = path.join(process.cwd(), "data-private", "seed.json");
getDb();
applyDefaults();
const n = (getDb().prepare("SELECT COUNT(*) c FROM deals").get() as any).c;
if (n > 0) {
  console.log(`Database already has ${n} deals. Nothing imported. Delete data/nolan-os.db to start over.`);
} else if (fs.existsSync(seedPath)) {
  loadSeed(JSON.parse(fs.readFileSync(seedPath, "utf8")));
  console.log("Seed loaded from data-private/seed.json");
} else {
  console.log("No data-private/seed.json found: started with an empty database. Use Data > Import to bring your records in.");
}
