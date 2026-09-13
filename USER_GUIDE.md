# BusinessOS &mdash; User Guide

A practical guide to running your books in BusinessOS. It covers what each screen
is for, how to do the common jobs, and — where it matters — *why* the app behaves
the way it does, because a bookkeeping system that surprises you is worse than one
that is slightly slower to learn.

**Live at:** https://businessos.rauhansheikh.com

Building BusinessOS rather than using it? Start with [`README.md`](README.md) instead.

---

## 📑 Contents

- [Key ideas](#key-ideas)
- [Getting started](#getting-started)
- [Your workspace](#your-workspace)
- [People and roles](#people-and-roles)
- [Parties: customers and suppliers](#parties-customers-and-suppliers)
- [Invoices and bills](#invoices-and-bills)
- [GST: how the tax is decided](#gst-how-the-tax-is-decided)
- [Payments](#payments)
- [The aging report](#the-aging-report)
- [The ledger](#the-ledger)
- [Settings](#settings)
- [When something goes wrong](#when-something-goes-wrong)
- [What BusinessOS does not do yet](#what-businessos-does-not-do-yet)

---

## Key ideas

Five things explain most of the app's behaviour. Reading them now will save you
guessing later.

**Nothing is ever edited or deleted once it is in the books.** Mistakes are
corrected by posting an opposite entry, not by changing history. That is why you
will see *Cancel* and *Reverse* where other tools offer *Edit* and *Delete*. What
happened, and what you did about it, both remain visible.

**A draft is not real yet.** Drafts are not numbered, do not appear in the books,
and do not count towards what anyone owes. Issuing an invoice is the moment it
becomes real.

**Invoice numbers have no gaps.** GST requires an unbroken sequence per financial
year, so a number is only allocated when you issue. If you abandon a draft, no
number is consumed. If you cancel an issued invoice, the document and its number
stay — only the money is reversed out.

**Amounts are exact.** Every figure is stored as a whole number of paise, never as
a decimal that could drift. Where rounding is unavoidable — a fractional quantity,
a percentage — it is applied once, explicitly, and shown to you.

**What customers owe you and what you owe suppliers are tracked separately.** If
one company is both a customer and a supplier, you will see both figures, not one
netted number. A single "balance" would hide half the position.

---

## Getting started

### 1. Create your account

Go to **Sign up**, or use **Continue with Google**.

If you sign up with an email address, you will receive a verification link. You
must click it before you can sign in.

### 2. Create your workspace

After your first sign-in you are asked to create a workspace — your business.
You will be asked for:

| Field | Notes |
|---|---|
| **Business name** | What appears throughout the app. |
| **GSTIN** | Optional, but fill it in if you are GST-registered. **The first two digits are your state code, and they decide whether an invoice charges CGST+SGST or IGST.** Without it, BusinessOS assumes every sale is within your state. |
| **Currency** | Defaults to INR. See the warning below. |

> ⚠️ **Set the currency correctly now.** Once the workspace has any ledger entries,
> the currency is locked. Every stored amount is denominated in it, so changing it
> later would silently reinterpret your whole history. Only the workspace owner can
> change workspace settings, and only while the books are empty.

### 3. Find your way around

The top bar carries everything:

| Where | What it is for |
|---|---|
| **Dashboard** | What you are owed, what you owe, and recent activity. |
| **Invoices** | Sales invoices and supplier bills. |
| **Payments** | Money received and paid, and what it settled. |
| **Parties** | Your customers and suppliers. |
| **Ledger** | Every entry, filterable and exportable. |
| **Aging** | How overdue everything is. |
| **Settings** | Company details, members, email wording, and the audit log. |

On a phone, the same links live behind the menu button.

---

## Your workspace

You can belong to several workspaces — your own business, a client's, a side
project. The workspace switcher is in the top bar, next to the business name.

Everything you see is scoped to the workspace you are currently in. Switching is
instantaneous and affects every screen. Your choice is remembered between visits.

Data is never shared between workspaces. A customer added to one does not exist in
another.

---

## People and roles

Invite colleagues from **Settings → Active Workspace Members**. Enter their email address and choose a
role. They receive an email with a link; if they do not have an account yet, they
create one as they accept.

There are three roles.

| | Accountant | Admin | Owner |
|---|:---:|:---:|:---:|
| View everything | ✅ | ✅ | ✅ |
| Add and edit parties | ✅ | ✅ | ✅ |
| Create and issue invoices | ✅ | ✅ | ✅ |
| Record payments | ✅ | ✅ | ✅ |
| Archive a party | — | ✅ | ✅ |
| Cancel an invoice | — | ✅ | ✅ |
| Reverse a payment or ledger entry | — | ✅ | ✅ |
| Manage the item catalogue | — | ✅ | ✅ |
| Invite, remove and re-role members | — | ✅ | ✅ |
| View pending invitations | — | ✅ | ✅ |
| View the audit trail | — | ✅ | ✅ |
| Customise email wording | — | ✅ | ✅ |
| Change company information | — | — | ✅ |
| Make someone an owner | — | — | ✅ |

The dividing line is deliberate: an **accountant does the day-to-day work**, while
**correcting the record** — cancelling, reversing, archiving — sits with admins.
Anything that changes who has access, or the meaning of stored amounts, is the
owner's alone.

Your own role is shown in **Settings → Company Information**.

A workspace always has at least one owner. Removing the last one is refused.

---

## Parties: customers and suppliers

A *party* is anyone you trade with. There is one directory, not separate customer
and supplier lists, because the same company is often both.

### Adding one

**Parties → + Add party.** Only the name is required.

| Field | Why it matters |
|---|---|
| **Party name** | Required. |
| **Phone number**, **Email address** | Contact details; searchable. |
| **Billing address** | Appears on the invoice. |
| **GSTIN** | **Determines CGST+SGST versus IGST on every invoice to them.** Worth getting right. |
| **PAN** | Recorded for your reference. |
| **Opening balance** + **Balance type** | What they already owed you, or you them, before you started using BusinessOS. |

**Opening balances.** If a customer already owed you ₹50,000 on the day you
started, enter it as an opening balance of the *receivable* type. Choose *payable*
for money you already owed a supplier. This is posted to the books like any other
entry, so your totals are right from day one.

### Reading a party's standing

Each party shows what they owe you, what you owe them, or that you are settled.

**Both figures can be non-zero at once**, and that is correct — it means you buy
from and sell to the same company. They are shown separately on purpose.

A figure can also go **negative**, which is not an error: a negative receivable
means the customer has paid you more than they owe, and the surplus is an advance
held against their next invoice.

### Statements

Open any party to see every entry against them, oldest to newest, with a running
balance. **Export Statement** downloads it as CSV.

### Archiving

Admins can archive a party who is no longer active. Archiving hides them from the
default list without touching their history — their entries remain in the books,
because removing them would change your totals. Archived parties can be shown
again with the filter.

---

## Invoices and bills

**Invoices** covers both directions:

- **Sales invoice** — what you bill a customer.
- **Supplier bill** — what a supplier bills you.

They behave identically; only the direction of the money differs.

### The life of an invoice

```
Draft ──issue──▶ Issued ──payment──▶ Part paid ──payment──▶ Paid
  │                 │
delete            cancel ──▶ Cancelled
```

| Status | Meaning |
|---|---|
| **Draft** | Not numbered, not in the books, owed by nobody. Editable and deletable. |
| **Issued** | Numbered, posted, and outstanding. |
| **Part paid** | Some payment has been applied. |
| **Paid** | Fully settled. |
| **Cancelled** | Was issued, then reversed out of the books. Number retained. |

### Creating one

**Invoices → + New invoice.**

**1. The header.** Choose the type and the counterparty, then the dates.

- **Issue date** decides which financial year the number comes from. BusinessOS
  uses the Indian financial year, April to March, so an invoice dated 5 April 2026
  is numbered `INV/2026-27/0001`.
- **Due date** is optional but drives the aging report. Without it, an invoice is
  never counted as overdue.

**2. The lines.** Add one line per thing you are charging for.

| Field | Notes |
|---|---|
| **From the catalogue** | Optional. Fills the rest of the line from a saved item; you can still change anything afterwards. |
| **Description** | Required. |
| **HSN / SAC** | The GST classification code — HSN for goods, SAC for services. Required on invoices above the turnover threshold, so capture it if it applies to you. |
| **Quantity** | Up to three decimal places. |
| **Unit price** | Per unit, before tax. |
| **Discount** | An absolute amount off this line, not a percentage. It cannot exceed the line. |
| **Tax rate** | A percentage — 5, 12, 18, 28. |

**Tax is worked out per line**, so an invoice mixing 18% services and 5% goods is
correct. Each line shows its own total as you type.

**3. Check the totals.** The totals panel updates live, showing the subtotal, the
tax split, any rounding, and the final amount. **These are the same calculations
the books will use** — what you see here is exactly what gets posted.

*Round the payable total to whole units* is on by default, as is conventional on
Indian invoices. The difference is carried as a visible rounding line, never buried
in a price.

**4. Save.**

- **Save as draft** — keep working on it later. No number, no entry in the books.
- **Save and issue** — allocate the number and post it immediately.

### Issuing

Issuing allocates the next number for the financial year and posts the amount to
the books against that party. You will be asked to confirm, because **an issued
invoice cannot be edited**.

If two people issue at the same moment, they cannot receive the same number.

### Cancelling

Admins can cancel an issued invoice. This posts an opposite entry, removing the
amount from the books, and marks the document **Cancelled**.

The document and its number remain. That is not an oversight — deleting either
would leave a hole in the sequence, which GST does not permit.

**Cancellation is refused while payments are allocated to the invoice.** Reverse or
reallocate the payment first. Otherwise you would be cancelling a debt that
somebody has already settled.

### Deleting a draft

A draft never reached the books, so it can simply be deleted. Nothing is reversed
and no number is released, because none was ever taken.

---

## GST: how the tax is decided

This trips people up in every accounting tool, so it is worth stating plainly.

**The split between CGST+SGST and IGST is decided by geography, not by the rate.**

BusinessOS compares the **first two digits of your workspace GSTIN** with the
**first two digits of the party's GSTIN** — those digits are the state code.

| Situation | What is charged |
|---|---|
| Same state | **CGST + SGST**, half the rate each |
| Different states | **IGST**, the full rate |
| Marked exempt | No tax |

So 18% to a customer in your own state is 9% CGST + 9% SGST; the same 18% to
another state is 18% IGST. Same rate, different presentation, different filing.

The invoice form shows which treatment applies as soon as you pick the
counterparty, so you can catch a wrong or missing GSTIN before issuing.

**If either GSTIN is missing, BusinessOS assumes same-state.** That is the common
case, and being wrong about it is visible on the invoice rather than hidden inside
a single combined figure. Fill in both GSTINs to be sure.

Tick **This supply is exempt from GST** for supplies that carry no tax at all.

Where a tax works out to an odd number of paise, CGST takes the extra paisa, so the
two halves always add back to the exact total.

---

## Payments

**Payments** records money that has actually moved: received from a customer, or
paid to a supplier.

### Recording one

**Payments → + Record payment.**

1. **Direction** — received from a customer, or paid to a supplier.
2. **Counterparty** — once chosen, BusinessOS loads everything still outstanding
   for them and shows the total.
3. **Amount**, **date**, and optionally **method** (UPI, bank transfer, cheque,
   cash) and **reference** (a UTR or cheque number).
4. **How to apply it** — the important choice, below.

### The three ways to apply a payment

| Choice | What happens |
|---|---|
| **Settle oldest first** | The payment is applied across open invoices in date order until it runs out. The usual case, and what a customer expects when they pay a round sum against several bills. |
| **Choose the amounts** | You decide what goes against each invoice. Pre-filled with the oldest-first split so you are editing rather than starting blank. |
| **Hold on account** | Nothing is settled. The money is recorded as an advance against that party. |

Whichever you choose, the panel shows how much is **applied to invoices** and how
much is **held on account** before you commit.

**Anything left over is held, not forced onto the newest invoice.** If a customer
pays ₹2,000 against ₹1,500 of bills, the extra ₹500 stays as an advance you can
apply to a future invoice.

You cannot apply more to an invoice than it still owes; the field turns red and the
payment is refused.

### Reading the list

Select any row to see which invoices it settled and for how much. A payment held on
account says so.

### Reversing a payment

For a bounced cheque or a payment entered in error, admins can **Reverse** it.

This posts an opposite entry, and **every invoice it had settled becomes
outstanding again**. The payment itself is kept and marked as reversed, showing
when, by whom, and why — so a reversed payment is never mistaken for one held on
account.

A reversed payment cannot be reversed again or re-applied. If the money genuinely
arrives later, record it as a new payment.

---

## The aging report

**Aging** answers one question: how long has this money been outstanding?

Switch between **Receivables** (what customers owe you) and **Payables** (what you
owe suppliers).

Everything outstanding is bucketed by how far past its due date it is:

**Not due** · **1–30 days** · **31–60 days** · **61–90 days** · **Over 90 days**

Older money is coloured more urgently. Select any counterparty to expand their row
and see the individual documents making up their total.

> **Invoices with no due date never appear as overdue.** They are counted in the
> total and sit in *Not due* indefinitely. If chasing payment matters to you, set
> due dates.

---

## The ledger

**Ledger** is every entry in the workspace, newest first — the complete record
behind the summary figures.

### Filtering and searching

Filter by counterparty, type, and date range, or search descriptions, references
and party names. Results are paged; the totals shown are for everything matching
your filter, not just the visible page.

### Recording an entry directly

Most entries arrive from invoices and payments. You can also record one directly,
which is useful for opening balances and corrections.

| Field | Notes |
|---|---|
| **Transaction type** | Sale, purchase, payment received, payment made, opening balance or adjustment. |
| **Counterparty** | Required. |
| **Amount** | A positive number, at most two decimal places. |
| **Adjustment direction** | For opening balances and adjustments: which side it belongs to. |
| **Invoice / reference number**, **Notes** | Free text, both searchable. |
| **Date** | The business date. May be in the past. |

The date you enter is the date the entry counts for. BusinessOS separately records
when the row was actually written, and that timestamp never moves — so back-dating
is honest rather than invisible.

### Reversing an entry

Admins can reverse any entry. The original stays and an opposite entry is written
alongside it, linked to it.

An entry can only be reversed once, and that is enforced by the database rather
than by a check — two people clicking at the same moment cannot both succeed.

### Exporting

**Export Enterprise CSV** downloads everything matching your current filter — not just the
page you are looking at. The file opens correctly in Excel, and values that a
spreadsheet would otherwise treat as formulas are escaped.

---

## Settings

### Company Information

Your workspace's name, legal entity name, GSTIN, PAN, address, phone, currency and
timezone &mdash; plus your own email and your role in this workspace.

Only an **owner** can change workspace details, and the currency is locked once the
books have entries.

### Active Workspace Members

Members, their roles, and pending invitations. Admins can invite a colleague by
email, change roles, and remove people; only an owner can grant ownership. Pending
invitations can be revoked before they are accepted.

### Email Templates

Admins can reword the emails BusinessOS sends on the workspace's behalf —
invitations, for instance — with a live preview.

Account-level email such as address verification and password reset is deliberately
not editable: those are security messages, and letting them be reworded would make
a convincing phishing template.

### Audit Log & Event History

Admins see who did what, when, and from where, with a search box across the trail. Every privileged action is recorded:
invitations, role changes, invoices issued and cancelled, payments recorded and
reversed, settings changes.

---

## When something goes wrong

**"This invoice is already cancelled."**
Someone else cancelled it first. Refresh the page.

**"Payments are allocated to this invoice."**
You are cancelling an invoice that has been paid. Reverse the payment, or
reallocate it elsewhere, and try again.

**"This payment has been reversed, so it cannot be allocated."**
Reversed payments are permanently closed. Record a new payment instead.

**"Discount is larger than the line amount."**
The discount is an absolute amount, not a percentage. ₹500 off a ₹100 line is what
it says.

**The totals panel is not showing anything.**
It waits until a line has both a quantity and a price, and stays hidden if a line
is invalid — it will not show a total the server would reject.

**The tax split is wrong.**
Check both GSTINs — yours in *Settings*, theirs on the party. The first two digits
of each decide the split. A missing GSTIN makes BusinessOS assume same-state.

**An invoice is not showing as overdue.**
It probably has no due date. Without one it stays in *Not due*.

**A party shows a negative balance.**
They have paid more than they owe. The surplus is an advance, available against
their next invoice.

**A button is missing.**
It is almost certainly your role. Cancelling, reversing and archiving need Admin;
workspace settings need Owner. Your role is shown in *Settings → Company Information*.

**You cannot sign in.**
Check your inbox for the verification link — an unverified account cannot sign in.
Use *Forgot password?* to reset.

---

## What BusinessOS does not do yet

Stated plainly so you can plan around it:

- **No printable invoice.** There is no PDF or print view, so an issued invoice
  cannot yet be sent to a customer from inside the app.
- **No credit notes.** Correcting an issued invoice means cancelling it and issuing
  a new one.
- **No invoice editing.** Issued documents are fixed by design.
- **No trial balance or profit-and-loss screen.** The underlying double-entry data
  supports them; the screens are not built.
- **No screen for managing the item catalogue.** Saved items can be used on an
  invoice, but adding and editing them is not yet exposed.
- **Indian rupee, and currencies with two decimal places.** Currencies such as the
  Japanese yen and Kuwaiti dinar are not supported.
- **Long lists in dropdowns.** The invoice and payment forms load up to 200
  counterparties and items; beyond that a search box is needed.

---

*Something here disagrees with the app? The app is right and this guide is stale —
please say so, and it will be corrected.*
