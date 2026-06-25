// Deterministic seating draft generator — no AI. Groups unassigned confirmed
// guests by side → relationship category → friend subtype, then greedily
// packs each group into tables in order, spilling overflow into the next
// table so a group stays in adjacent tables rather than scattering.

const SIDE_ORDER = ["bride", "groom", ""];
const CATEGORY_ORDER = ["family", "friends", "colleagues", "other", ""];
const SUBTYPE_ORDER = [
  "university",
  "secondary_school",
  "primary_school",
  "tertiary",
  "army",
  "other",
  "",
];

function rank(value, order) {
  const i = order.indexOf(value || "");
  return i === -1 ? order.length : i;
}

function groupGuests(guests) {
  const groups = new Map();
  for (const g of guests) {
    const side = g.party || "";
    const category = g.relationship_group || "";
    const subtype = category === "friends" ? g.friend_subgroup || "" : "";
    const key = `${side}|${category}|${subtype}`;
    if (!groups.has(key)) groups.set(key, { side, category, subtype, guests: [] });
    groups.get(key).guests.push(g);
  }
  return [...groups.values()].sort((a, b) => {
    const s = rank(a.side, SIDE_ORDER) - rank(b.side, SIDE_ORDER);
    if (s !== 0) return s;
    const c = rank(a.category, CATEGORY_ORDER) - rank(b.category, CATEGORY_ORDER);
    if (c !== 0) return c;
    return rank(a.subtype, SUBTYPE_ORDER) - rank(b.subtype, SUBTYPE_ORDER);
  });
}

// guests: full guest list (used to compute current occupancy).
// tables: full table list, in display order.
// Returns { assignments: [{ guestId, tableId }], unplacedGuestIds: [] }.
export function suggestSeating(guests, tables) {
  const unassigned = guests.filter(
    (g) => g.rsvp_status === "confirmed" && !g.table_id
  );

  const occupancy = new Map();
  for (const g of guests) {
    if (g.table_id) occupancy.set(g.table_id, (occupancy.get(g.table_id) || 0) + 1);
  }

  const slots = tables
    .filter((t) => !t.is_locked)
    .map((t) => ({
      id: t.id,
      capacity: t.capacity,
      remaining: Math.max(0, t.capacity - (occupancy.get(t.id) || 0)),
    }));

  const groups = groupGuests(unassigned);
  const assignments = [];
  const unplacedGuestIds = [];

  for (const group of groups) {
    const queue = [...group.guests].sort((a, b) => {
      if (!!a.is_vip !== !!b.is_vip) return a.is_vip ? -1 : 1;
      return (a.name || "").localeCompare(b.name || "");
    });

    let idx = slots.findIndex((s) => s.remaining === s.capacity);
    if (idx === -1) idx = slots.findIndex((s) => s.remaining > 0);

    while (queue.length) {
      if (idx === -1 || idx >= slots.length) {
        unplacedGuestIds.push(...queue.map((g) => g.id));
        break;
      }
      const slot = slots[idx];
      if (slot.remaining <= 0) {
        idx += 1;
        continue;
      }
      const take = queue.splice(0, slot.remaining);
      for (const g of take) assignments.push({ guestId: g.id, tableId: slot.id });
      slot.remaining -= take.length;
      if (queue.length) idx += 1;
    }
  }

  return { assignments, unplacedGuestIds };
}
