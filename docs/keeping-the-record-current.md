# Keeping the record current

Everything about Theo lives in one structured Sanity record. A fix is made once, in one place, and every page and the assistant read it.

## Example: his vet removes ursodiol from the written medication list

Do this in the Studio (https://steadywag.sanity.studio). It takes about two minutes and needs no code.

1. **Medications → Ursodiol.** Set the status to **stopped**, set the end date to the visit date, and edit the note: "Removed from the written list at the visit on <date>. Never given." Publish.
2. **Record gaps → "Which visit told the family not to give ursodiol is not recorded".** Set the status to **resolved** and note the date.
3. **Vet questions → "Can the written medication list be corrected…".** Set the status to **answered**.
4. **Record updates → New.** Kind **Resolved**, basis **Confirmed by his vet**, a one-line title and the date. Add the medication and the gap under "Records this touched". Publish.

Within about a minute (pages revalidate every 60 seconds):

- the ursodiol callout on the home page, on Today and in the desktop sidebar disappears, because it only shows for a medication whose status is "listed-not-given";
- the warning box on the sitter brief disappears for the same reason;
- Visit prep drops the resolved gap and answered question;
- the new entry appears on the **What changed** page;
- the assistant's answers change, because the chart endpoint reads the live record.

## What the app never does

Nothing on the website edits the record from the browser. Changes are made by the owner in the Studio, so every change has a person and a source behind it. Check-ins and appointments are personal logs kept in the visitor's own browser.

## Next steps (not built)

A "Suggest an update" form for family members, which lands as a private draft in the Studio for the owner to approve, and signing in so check-ins and appointments follow the family across devices.
