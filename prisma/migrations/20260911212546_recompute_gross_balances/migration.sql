-- Rebuild every PartyBalance from the ledger under gross semantics.
--
-- Balances were previously stored netted: receivable and payable were collapsed
-- into one signed figure, so a counterparty that was both customer and supplier
-- lost both gross totals. Those snapshots cannot be corrected in place - they
-- are replayed from "Transaction", which is the source of truth.
--
-- The scoring below mirrors effectOf/resolveEffect in
-- src/modules/transactions/ledger.ts. It is duplicated here deliberately: a
-- migration is an immutable record of a point in time, not living code. An
-- integration test asserts the two agree for every party.

WITH scored AS (
  SELECT
    t."partyId",
    t."amountMinor",
    -- A reversal is scored from the entry it reverses, then inverted.
    COALESCE(o."transactionType", t."transactionType") AS src_type,
    COALESCE(o."direction", t."direction")             AS src_direction,
    CASE WHEN t."transactionType" = 'REVERSAL' THEN -1 ELSE 1 END AS flip
  FROM "Transaction" t
  LEFT JOIN "Transaction" o ON o."id" = t."reversedTransactionId"
),
deltas AS (
  SELECT
    "partyId",
    CASE
      WHEN src_type IN ('SALE', 'PAYMENT_RECEIVED')  THEN 'receivable'
      WHEN src_type IN ('PURCHASE', 'PAYMENT_MADE')  THEN 'payable'
      WHEN src_direction = 'RECEIVABLE'              THEN 'receivable'
      ELSE 'payable'
    END AS col,
    flip
      * CASE WHEN src_type IN ('PAYMENT_RECEIVED', 'PAYMENT_MADE') THEN -1 ELSE 1 END
      * "amountMinor" AS delta
  FROM scored
),
totals AS (
  SELECT
    "partyId",
    COALESCE(SUM(delta) FILTER (WHERE col = 'receivable'), 0) AS rec,
    COALESCE(SUM(delta) FILTER (WHERE col = 'payable'), 0)    AS pay
  FROM deltas
  GROUP BY "partyId"
)
UPDATE "PartyBalance" pb
SET "receivableMinor" = totals.rec,
    "payableMinor"    = totals.pay,
    "updatedAt"       = NOW()
FROM totals
WHERE pb."partyId" = totals."partyId";

-- A party with no ledger entries has no totals row above, so zero it explicitly
-- rather than leaving a stale netted figure behind.
UPDATE "PartyBalance"
SET "receivableMinor" = 0,
    "payableMinor"    = 0,
    "updatedAt"       = NOW()
WHERE "partyId" NOT IN (SELECT DISTINCT "partyId" FROM "Transaction");
