/**
 * The default chart of accounts.
 *
 * Every business gets these on creation. The application posts to them by
 * `systemKey`, never by code or name, because both are editable - a user
 * renaming "Sales" to "Revenue" must not break invoice posting.
 *
 * Codes follow the usual convention: 1xxx assets, 2xxx liabilities, 3xxx
 * equity, 4xxx income, 5xxx expenses.
 */
import type { LedgerAccountKey, LedgerAccountType } from "@/generated/prisma/client";

export interface SystemAccountSeed {
  key: LedgerAccountKey;
  code: string;
  name: string;
  type: LedgerAccountType;
  description: string;
  /**
   * Control accounts carry a party on their lines, so the account balance can
   * be broken down per counterparty without a separate sub-ledger.
   */
  isControl?: boolean;
}

export const SYSTEM_ACCOUNTS: readonly SystemAccountSeed[] = [
  {
    key: "CASH",
    code: "1000",
    name: "Cash and Bank",
    type: "ASSET",
    description: "Money held in hand or at the bank.",
  },
  {
    key: "ACCOUNTS_RECEIVABLE",
    code: "1100",
    name: "Accounts Receivable",
    type: "ASSET",
    description: "Amounts customers owe for invoices not yet paid.",
    isControl: true,
  },
  {
    key: "GST_INPUT_CGST",
    code: "1210",
    name: "Input CGST",
    type: "ASSET",
    description: "Central GST paid on purchases, recoverable against output tax.",
  },
  {
    key: "GST_INPUT_SGST",
    code: "1220",
    name: "Input SGST",
    type: "ASSET",
    description: "State GST paid on purchases, recoverable against output tax.",
  },
  {
    key: "GST_INPUT_IGST",
    code: "1230",
    name: "Input IGST",
    type: "ASSET",
    description: "Integrated GST paid on inter-state purchases.",
  },
  {
    key: "ACCOUNTS_PAYABLE",
    code: "2100",
    name: "Accounts Payable",
    type: "LIABILITY",
    description: "Amounts owed to suppliers for bills not yet paid.",
    isControl: true,
  },
  {
    key: "GST_OUTPUT_CGST",
    code: "2210",
    name: "Output CGST",
    type: "LIABILITY",
    description: "Central GST collected on sales, payable to the government.",
  },
  {
    key: "GST_OUTPUT_SGST",
    code: "2220",
    name: "Output SGST",
    type: "LIABILITY",
    description: "State GST collected on sales, payable to the government.",
  },
  {
    key: "GST_OUTPUT_IGST",
    code: "2230",
    name: "Output IGST",
    type: "LIABILITY",
    description: "Integrated GST collected on inter-state sales.",
  },
  {
    key: "OPENING_BALANCE_EQUITY",
    code: "3000",
    name: "Opening Balance Equity",
    type: "EQUITY",
    description:
      "Balancing account for opening balances brought in when a party or account is first recorded.",
  },
  {
    key: "SALES",
    code: "4000",
    name: "Sales",
    type: "INCOME",
    description: "Revenue from goods and services, excluding tax.",
  },
  {
    key: "ROUNDING",
    code: "4900",
    name: "Rounding Difference",
    type: "INCOME",
    description:
      "Absorbs sub-unit differences when a document total is rounded, so entries still balance exactly.",
  },
  {
    key: "PURCHASES",
    code: "5000",
    name: "Purchases",
    type: "EXPENSE",
    description: "Cost of goods and services bought, excluding tax.",
  },
  {
    key: "ADJUSTMENTS",
    code: "5900",
    name: "Balance Adjustments",
    type: "EXPENSE",
    description:
      "Counterpart for manual corrections to a counterparty balance where no other account applies.",
  },
] as const;

/**
 * Whether a debit increases this type of account.
 *
 * Assets and expenses are debit-balance; liabilities, equity and income are
 * credit-balance. This is what turns a signed journal total into a figure a
 * person expects to see as positive.
 */
export function isDebitBalance(type: LedgerAccountType): boolean {
  return type === "ASSET" || type === "EXPENSE";
}

/**
 * Converts a signed journal total (debit positive) into the account's natural
 * sign, so a liability with credits shows as a positive amount owed rather than
 * a negative one.
 */
export function toNaturalBalance(type: LedgerAccountType, signedMinor: bigint): bigint {
  return isDebitBalance(type) ? signedMinor : -signedMinor;
}
