import { closePool } from "./db";
import { seedCompanies } from "./pg-store";

async function seed() {
  const n = await seedCompanies();
  console.log(`Seed complete: upserted ${n} Baltic share issuers into companies catalog.`);
}

const isMain = process.argv[1]?.includes("seed");
if (isMain) {
  seed()
    .then(() => closePool())
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
}
