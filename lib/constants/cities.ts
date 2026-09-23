// Curated static list of major Israeli cities used for the profile "city"
// field (self-reported, independent of institutions.city — see
// supabase/migrations/20260923000001_faculties_and_city.sql). A static
// constant rather than a DB table: this attribute needs no admin CRUD, RLS
// or FK relationships, unlike institutions/faculties/departments.
export const ISRAELI_CITIES = [
  { value: "tel_aviv", label: "תל אביב" },
  { value: "jerusalem", label: "ירושלים" },
  { value: "haifa", label: "חיפה" },
  { value: "rishon_lezion", label: "ראשון לציון" },
  { value: "petah_tikva", label: "פתח תקווה" },
  { value: "ashdod", label: "אשדוד" },
  { value: "netanya", label: "נתניה" },
  { value: "beer_sheva", label: "באר שבע" },
  { value: "bnei_brak", label: "בני ברק" },
  { value: "holon", label: "חולון" },
  { value: "ramat_gan", label: "רמת גן" },
  { value: "bat_yam", label: "בת ים" },
  { value: "rehovot", label: "רחובות" },
  { value: "ashkelon", label: "אשקלון" },
  { value: "herzliya", label: "הרצליה" },
  { value: "kfar_saba", label: "כפר סבא" },
  { value: "hadera", label: "חדרה" },
  { value: "modiin", label: "מודיעין־מכבים־רעות" },
  { value: "raanana", label: "רעננה" },
  { value: "nazareth", label: "נצרת" },
  { value: "lod", label: "לוד" },
  { value: "ramla", label: "רמלה" },
  { value: "givatayim", label: "גבעתיים" },
  { value: "hod_hasharon", label: "הוד השרון" },
  { value: "eilat", label: "אילת" },
  { value: "kiryat_gat", label: "קרית גת" },
  { value: "afula", label: "עפולה" },
  { value: "tiberias", label: "טבריה" },
  { value: "nahariya", label: "נהריה" },
  { value: "yavne", label: "יבנה" },
] as const;

export type IsraeliCityValue = (typeof ISRAELI_CITIES)[number]["value"];
