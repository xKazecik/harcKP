/**
 * Zatarcie kar (§11.3) — kopia czystej reguły domenowej.
 * (Worker nie zależy od @harc/domain, żeby budować się niezależnie;
 * zgodność pilnuje test w packages/domain.)
 */
export function expungementDate(finalAt: Date, banEndsAt: Date | null): Date {
  const base = banEndsAt && banEndsAt > finalAt ? banEndsAt : finalAt;
  const d = new Date(base);
  d.setFullYear(d.getFullYear() + 1);
  return d;
}
