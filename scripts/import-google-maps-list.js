const fs = require("fs");

const dataPath = "masjid-data.json";
const sharedUrl = "https://maps.app.goo.gl/CBsgN9ZWMAqCLKLE7";

const rawEntries = `
Sufaraa|704 N Preston Rd, Celina, TX 75009|Code: 026291; Celina Masjid. Only brothers, no wudu area
Islamic Centers of Prosper and Celina - ICPC|2616 S Legacy Dr, Celina, TX 75009|Google Maps list code: 93500
Sufaraa - Mckinney||
Islamic Association of Tarrant County||Al-Ibraheemi
Dar El-Quran||
Salaam||
Masjid-e-Sajideen||
Imaan Melissa||
Dallas Diyanet Mosque||
Masjid Salahadeen||
IslamInSpanish Dallas Outreach Center||Temporarily closed in Google Maps list
Anna Islamic Center||
Ar Rahman Mosque||
Islamic Center of Rowlett||
HEB Masjid||
Annoor Center||
Bayyinah Institute||
Bayt Al-Karim Islamic Center||
Musallah Masjid Mosque (2nd Fl) Seena One Medical Center||
Al-Mu'min Mosque||
Unity Islamic Center - Mansfield Masjid Official||
Dar Al-Arqam Mosque||
Dar El-Eman Islamic Center (DEIC)||
Greenville Musallah||
Desoto House of Peace - Mosque & Community Center||
Al-Hedayah Academy||
Zia ul Quran Masjid||
Islamic Center of Forney - ICF||
Dar Elsalam Islamic Center||
Islamic center of Denison||
Masjid Faruq of Grand Prairie TX||
Bosnian American Cultural Center of North Texas||
Dar Alhuda Inc مسجد||
Masjid Al Quran||
Islamic Center of Euless مسجد||
Masjid al-Islam - Dallas, TX||
Euless Musalla||
Barkaat-Ul-Quran||
Maktab Foundation||
Las Colinas Islamic Center||
Al Razzaq Islamic Centre||
Nour Al-Quran Society||
Association for Guidance and Education (Rowlett Musallah)||
Bilal Community Center||
Makkah Masjid (Garland Mosque)||
American Imams Academy , AIA Masjid||
Dallas Muslim Community Center (DMCC)||
Masjid Faizan E Madinah Wylie||
Al-Ansar Society||
Islamic Association Texas (Masjid Ahsan)||
Minhaj ul-Quran||
Noori Mosque||
ICNA Center||
IQA||
Qalam Institute||
ISRA Foundation||
WEST PLANO MUSALLAH||
Islamic Society Of Mesquite||
Islamic Association Of Desoto Texas||
McKinney Mosque||
Madinah Mosque of Carrollton||
Grand Prairie Masjid||
Islamic Association of Colleyville مسجد||
Islamic Association of Fort Worth مسجد||
Keller Islamic Center (KIC)||
Islamic Association-Mesquite||
Masjid Yaseen||
Mansfield Islamic Center||
ISAT Center Masjid||
Islamic Association of Carrollton (IAC)||
Islamic Society of Denton||
Islamic Association of Lewisville & Flower Mound||
Duncanville Islamic Center||Temporarily closed in Google Maps list
Dialogue Institute Dallas||
Princeton Islamic Center||
Islamic Center of South Dallas||
Islamic Association of North Texas (IANT Masjid)||
Mesquite Islamic Center (MIC Mosque)||
Sachse Muslim Society||
Islamic Center of Aubrey||
Islamic Center of Southlake||
Islamic Center of Irving||
ICC - Islamic Center of Coppell||
Bosniaks Islamic Center Dallas-Fort Worth (BIC)||
Islamic Center of Wylie||
Islamic Association of Collin County (Plano Mosque)||
MAS Islamic Center Of Dallas||
Islamic Center of Frisco||
Valley Ranch Islamic Center (VRIC)||
East Plano Islamic Center (EPIC Masjid)||
Islamic Center of Quad Cities||
McKinney Islamic Association||
Islamic Association of Allen||
`.trim();

const aliases = new Map([
  ["American Imams Academy , AIA Masjid", "american-imams-academy"],
  ["Dallas Muslim Community Center (DMCC)", "dmcc-masjid"],
  ["Sachse Muslim Society", "sachse-muslim-society"],
  ["Islamic Center of Wylie", "islamic-center-of-wylie"],
  ["East Plano Islamic Center (EPIC Masjid)", "epic-masjid"],
]);

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 58);
}

function cityFromAddress(address) {
  return address?.match(/, ([A-Za-z .-]+), TX/)?.[1] ?? "";
}

const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const existingIds = new Set(data.masjids.map((masjid) => masjid.id));
let added = 0;

for (const line of rawEntries.split("\n")) {
  const [name, address, extraNote = ""] = line.split("|");
  const aliasId = aliases.get(name);

  if (aliasId) {
    const existing = data.masjids.find((masjid) => masjid.id === aliasId);

    if (existing) {
      existing.source.googleMapsListUrl = sharedUrl;
      existing.source.googleMapsListName = name;
      existing.source.googleMapsListCheckedAt = "2026-06-20";
    }

    continue;
  }

  let id = slugify(name);
  const baseId = id;
  let suffix = 2;

  while (existingIds.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  existingIds.add(id);

  data.masjids.push({
    id,
    name,
    shortName: name,
    website: "",
    address: address || undefined,
    city: cityFromAddress(address),
    state: "TX",
    jumuahTimes: [],
    source: {
      type: "google maps list",
      url: sharedUrl,
      checkedAt: "2026-06-20",
    },
    notes: [
      "Imported from Ahmed Sheikh shared Google Maps list of Islamic Centers and Musallahs.",
      "Website and Jumu'ah times need research.",
      extraNote,
    ]
      .filter(Boolean)
      .join(" "),
  });

  added += 1;
}

data.lastUpdated = "2026-06-20";
data.collectionNotes = [
  "Imported additional DFW Islamic centers and musallahs from Ahmed Sheikh's shared Google Maps list; entries without websites or times are marked for research.",
  ...data.collectionNotes.filter(
    (note) => !note.startsWith("Imported additional DFW"),
  ),
];

fs.writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Added ${added}; total ${data.masjids.length}`);
