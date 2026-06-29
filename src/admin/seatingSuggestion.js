// Deterministic seating draft generator — no AI.
//
// Hard rule: groom guests and bride guests never share a table.
// Soft rule: within each side, sub-groups (category × subtype) are ordered
// by size descending so the largest clusters fill first. When a sub-group
// overflows a table, remaining seats are filled by the next sub-group —
// mixing within a side is intentional and keeps tables full.

const SIDE_ORDER = ["groom", "bride", ""];

// guests: full guest list (used to compute current occupancy).
// tables: full table list, in display order.
// Returns { assignments: [{ guestId, tableId }], unplacedGuestIds: [] }.
export function suggestSeating(guests, tables) {
  const unassigned = guests.filter(
    (g) => g.rsvp_status === "confirmed" && !g.table_id
  );

  const occupancy = new Map();
  for (const g of guests) {
    if (g.table_id && g.rsvp_status === "confirmed")
      occupancy.set(g.table_id, (occupancy.get(g.table_id) || 0) + 1);
  }

  const slots = tables
    .filter((t) => !t.is_locked)
    .map((t) => ({
      id: t.id,
      capacity: t.capacity,
      remaining: Math.max(0, t.capacity - (occupancy.get(t.id) || 0)),
    }));

  // Bucket guests by side.
  const bySide = new Map();
  for (const g of unassigned) {
    const side = g.party || "";
    if (!bySide.has(side)) bySide.set(side, []);
    bySide.get(side).push(g);
  }

  const assignments = [];
  const unplacedGuestIds = [];
  let slotIdx = 0;

  for (const side of SIDE_ORDER) {
    const sideGuests = bySide.get(side);
    if (!sideGuests?.length) continue;

    // Hard boundary: advance past any partial tables from the previous side
    // so groom and bride guests can never end up in the same table.
    while (
      slotIdx < slots.length &&
      slots[slotIdx].remaining < slots[slotIdx].capacity
    ) {
      slotIdx++;
    }

    // Within the side, group by category × subtype and sort largest-first.
    const subGroups = new Map();
    for (const g of sideGuests) {
      const category = g.relationship_group || "";
      const subtype = category === "friends" ? g.friend_subgroup || "" : "";
      const key = `${category}|${subtype}`;
      if (!subGroups.has(key)) subGroups.set(key, []);
      subGroups.get(key).push(g);
    }

    // Build a flat queue: biggest sub-group first; VIPs lead within each sub-group.
    const queue = [...subGroups.values()]
      .sort((a, b) => b.length - a.length)
      .flatMap((group) =>
        [...group].sort((a, b) => {
          if (!!a.is_vip !== !!b.is_vip) return a.is_vip ? -1 : 1;
          return (a.name || "").localeCompare(b.name || "");
        })
      );

    // Greedy fill: pack each table to capacity before moving to the next.
    // Sub-group overflow naturally blends with the next sub-group's guests.
    let idx = slotIdx;
    while (queue.length) {
      if (idx >= slots.length) {
        unplacedGuestIds.push(...queue.map((g) => g.id));
        break;
      }
      const slot = slots[idx];
      if (slot.remaining <= 0) { idx++; continue; }
      const take = queue.splice(0, slot.remaining);
      for (const g of take) assignments.push({ guestId: g.id, tableId: slot.id });
      slot.remaining -= take.length;
      if (slot.remaining === 0) idx++;
    }

    if (idx > slotIdx) slotIdx = idx;
  }

  return { assignments, unplacedGuestIds };
}
