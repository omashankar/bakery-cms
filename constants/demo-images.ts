/**
 * Verified Unsplash assets for demo/seed content.
 * Some older photo IDs in this project now return 404 from Unsplash.
 */

export const demoPhotoIds = {
  chocolateCake: "photo-1578985545062-69928b1d9587",
  pastries: "photo-1486427944299-d1955d23e34d",
  weddingCake: "photo-1519225421980-715cb0215aed",
  avatarWoman: "photo-1494790108377-be9c29b29330",
  avatarMan: "photo-1507003211169-0a1dd7228f2d",
  brownieCake: "photo-1603532648955-039310d9ed75",
  tiramisu: "photo-1571877227200-a0d98ea607e9",
  cupcakes: "photo-1535254973040-607b474cb50d",
  cookies: "photo-1558961363-fa8fdf82db35",
  stackCake: "photo-1542826438-bd32f43d626f",
  // Previous ids for these two returned non-bakery photos (fried chicken / curry).
  dessertPlate: "photo-1562440499-64c9a111f713",
  decoratedCake: "photo-1464349153735-7db50ed83c84",
  berryCake: "photo-1535141192574-5d4897c12636",
  blushCake: "photo-1621303837174-89787a7d4729",
  iceCreamCake: "photo-1557925923-cd4648e211a0",
  pinkCupcakes: "photo-1563729784474-d77dbb933a9e",
  redVelvet: "photo-1586985289906-406988974504",
} as const;

/** Build a sized Unsplash URL from a photo id */
export function unsplash(
  photoId: string,
  width = 600,
  height = 600,
  fit: "crop" | "max" = "crop"
): string {
  return `https://images.unsplash.com/${photoId}?w=${width}&h=${height}&fit=${fit}`;
}

/** Legacy photo ids that Unsplash no longer serves — map to working replacements */
const brokenPhotoReplacements: Record<string, string> = {
  "photo-1565958011703-44f982eba591": demoPhotoIds.dessertPlate,
  "photo-1614707267537-b85daf00f840": demoPhotoIds.cupcakes,
  "photo-1535254940644-445f602d36f3": demoPhotoIds.cookies,
  "photo-1586788680434-30d324b2d50a": demoPhotoIds.stackCake,
  "photo-1606890737304-57cb1ea8feaf": demoPhotoIds.tiramisu,
  "photo-1563729787504-440f5b929bf0": demoPhotoIds.brownieCake,
  "photo-1558636508-e0db3814bd1a": demoPhotoIds.chocolateCake,
  "photo-1464349095438-e9a21285a5b3": demoPhotoIds.decoratedCake,
  "photo-1520854221256-17451b941bf0": demoPhotoIds.weddingCake,
  "photo-1621303836514-c6efb7a6f3c1": demoPhotoIds.stackCake,
  "photo-1438761681033-6461ffad8d80": demoPhotoIds.avatarWoman,
  "photo-1464349095432-e9a21285b5f3": demoPhotoIds.cookies,
};

/** Rewrite known-dead Unsplash links while preserving requested dimensions */
export function fixBrokenImageUrl(url: string): string {
  if (!url) return url;

  for (const [brokenId, replacement] of Object.entries(brokenPhotoReplacements)) {
    if (!url.includes(brokenId)) continue;

    if (url.startsWith("http")) {
      try {
        const parsed = new URL(url);
        const width = parsed.searchParams.get("w") ?? "600";
        const height = parsed.searchParams.get("h") ?? width;
        const fit = parsed.searchParams.get("fit") === "max" ? "max" : "crop";
        return unsplash(replacement, Number(width), Number(height), fit);
      } catch {
        return unsplash(replacement, 600, 600);
      }
    }

    return unsplash(replacement, 600, 600);
  }

  return url;
}
